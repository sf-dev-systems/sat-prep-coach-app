import { SupabaseClient } from '@supabase/supabase-js';
import {
  Question,
  Skill,
  startPracticeSession,
  fetchSkills,
  fetchQuestionsBySkill,
  fetchValidatedQuestions,
  fetchRecentAttempts,
  fetchRecentSessions,
  fetchBehaviorSignals,
} from '../db';
import { fetchMasteryMap } from '../mastery';
import { averagePace } from '../scoring/behavior-signals';

export type SessionCategory = 'review' | 'priority' | 'mixed' | 'confidence_builder';

export interface PlannedSessionItem {
  question: Question;
  skillName: string;
  category: SessionCategory;
}

export interface CompositionBucket {
  category: Exclude<SessionCategory, 'confidence_builder'>;
  label: string;
  count: number;
}

export interface PracticeSessionPlan {
  sessionId: string;
  items: PlannedSessionItem[];
  /** Time-budgeted plan (PRD F2), e.g. \"~40 min\" — see estimateSessionBudget's provisional caveat. */
  plannedMinutes: number;
  /** Per-category breakdown of `items`, e.g. \"15 review / 12 priority / 5 mixed\" (PRD F2's illustrative composition). */
  composition: CompositionBucket[];
  /**
   * High-mastery questions held in reserve, not part of `items`. SessionRunner
   * splices one in after 2 consecutive misses (PRD F2) — this is a runtime
   * reaction to how the student is actually doing, so it can't be decided at
   * assembly time; the pool just needs to already exist when that moment hits.
   */
  confidenceBuilderPool: PlannedSessionItem[];
}

// Cold-start fallback (PRD F2): a skill with no mastery row yet is treated
// as low-mastery and immediately due, so it surfaces early rather than
// being starved by skills that already have practice history.
const COLD_START_P_MASTERY = 0.15;
const COLD_START_NEXT_REVIEW = new Date(0);

// Spread factor for the difficulty <-> expected-success model below. At the
// \"neutral\" question difficulty (normDifficulty 0.5) expected success equals
// p_mastery; each step away from neutral shifts expected success by up to
// +/-DIFFICULTY_SPREAD.
const DIFFICULTY_SPREAD = 0.6;
const TARGET_SUCCESS_RATE = 0.75;

// PRD F2 time-budget defaults / bounds (see estimateSessionBudget doc comment
// for why these are provisional rather than read from behavior_signals).
const DEFAULT_SECONDS_PER_QUESTION = 90; // matches dashboard.ts's \"On Track\" pace threshold
const DEFAULT_FOCUS_MINUTES = 40; // PRD F2's own illustrative example (\"~40 min\")
const MIN_FOCUS_MINUTES = 20;
const MAX_FOCUS_MINUTES = 60;
const MIN_QUESTION_COUNT = 15; // PRD F2: \"15-25 questions\"
const MAX_QUESTION_COUNT = 25;

// Confidence-builder pool (PRD F2: \"insert one high-mastery confidence-builder\").
const CONFIDENCE_BUILDER_POOL_SIZE = 2;
const CONFIDENCE_BUILDER_MIN_MASTERY = 0.75;

interface SkillPriority {
  skill: Skill;
  pMastery: number;
  isDue: boolean;
  vulnerabilityScore: number; // p_mastery * weight; lower = more urgent
}

export interface SessionBudget {
  targetQuestionCount: number;
  plannedMinutes: number;
  avgSecondsPerQuestion: number;
  /** false once a real behavior_signals row backed this estimate; true when it fell back to the live attempts/sessions proxy. */
  isProvisional: boolean;
}

/**
 * Shared correctness check for both the practice session and diagnostic
 * runners (components/session/SessionRunner.tsx,
 * components/diagnostic/DiagnosticRunner.tsx) — kept in one place so the
 * two flows can't silently diverge on how an answer is scored.
 */
export function checkCorrect(question: Question, response: string): boolean {
  return question.choices
    ? response.trim().toUpperCase() === question.correct_answer.trim().toUpperCase()
    : response.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
}

/** Map the 1..3 difficulty scale onto 0..1, mirroring lib/mastery/bkt.ts's normalizeDifficulty. */
function normalizeDifficulty(difficulty: number): number {
  return Math.max(0, Math.min(1, (difficulty - 1) / 2));
}

/**
 * Expected probability of success on a question of the given difficulty for
 * a student at the given p_mastery. Consistent with the BKT model's
 * assumption that difficulty 2 (\"neutral\") tracks p_mastery directly, with
 * easier/harder questions shifting expected success up/down.
 */
function expectedSuccessRate(pMastery: number, difficulty: number): number {
  const normDifficulty = normalizeDifficulty(difficulty);
  const raw = pMastery + (0.5 - normDifficulty) * DIFFICULTY_SPREAD;
  return Math.max(0.05, Math.min(0.95, raw));
}

/** Distance from the ~75% expected-success calibration sweet spot (PRD F2, priority 3). */
function calibrationDistance(pMastery: number, difficulty: number): number {
  return Math.abs(expectedSuccessRate(pMastery, difficulty) - TARGET_SUCCESS_RATE);
}

/**
 * PRD F2's session-length cap: \"Reads behavior_signals: cap planned session
 * length at avg_focus_minutes/fatigue_minute.\" Now reads the real
 * `behavior_signals` row (populated nightly by lib/scoring/nightly.ts) when
 * one exists — the cap is `min(avg_focus_minutes, fatigue_minute)` when
 * both are present, since fatigue_minute (accuracy drop-off) is the harder
 * ceiling of the two once accuracy has actually started declining.
 * `avg_pace_by_difficulty` (averaged across difficulty buckets) replaces\n * the flat per-question time estimate too.\n *\n * A brand-new student (or one whose first `sessions` row predates the\n * nightly job's most recent run) has no `behavior_signals` row yet —\n * same degrade-never-block pattern as `lib/mastery/dashboard.ts`'s\n * readiness panel: fall back to a live proxy computed directly from\n * recent `attempts`/`sessions`, flagged via `isProvisional`.\n */\nexport async function estimateSessionBudget(supabase: SupabaseClient, userId: string): Promise<SessionBudget> {\n  const signals = await fetchBehaviorSignals(supabase, userId);\n\n  const signalPace = averagePace(signals?.avg_pace_by_difficulty ?? null);\n  const signalFocusCap =\n    signals?.avg_focus_minutes != null || signals?.fatigue_minute != null\n      ? Math.min(...[signals?.avg_focus_minutes, signals?.fatigue_minute].filter((v): v is number => v != null))\n      : null;\n\n  if (signalPace != null && signalFocusCap != null) {\n    const plannedMinutes = Math.round(Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_FOCUS_MINUTES, signalFocusCap)));\n    const rawCount = Math.round((plannedMinutes * 60) / signalPace);\n    const targetQuestionCount = Math.max(MIN_QUESTION_COUNT, Math.min(MAX_QUESTION_COUNT, rawCount));\n    return { targetQuestionCount, plannedMinutes, avgSecondsPerQuestion: signalPace, isProvisional: false };\n  }\n\n  // Provisional fallback — same live-computed proxy this function used\n  // before behavior_signals existed.\n  const [attempts, sessions] = await Promise.all([\n    fetchRecentAttempts(supabase, userId, 200),\n    fetchRecentSessions(supabase, userId, 20),\n  ]);\n\n  const timedAttempts = attempts.filter((a) => a.time_spent_seconds != null);\n  const avgSecondsPerQuestion =\n    signalPace ??\n    (timedAttempts.length\n      ? timedAttempts.reduce((sum, a) => sum + (a.time_spent_seconds as number), 0) / timedAttempts.length\n      : DEFAULT_SECONDS_PER_QUESTION);\n\n  const completed = sessions.filter((s) => s.started_at && s.ended_at);\n  const durationsMinutes = completed\n    .map((s) => (new Date(s.ended_at as string).getTime() - new Date(s.started_at).getTime()) / 60000)\n    .filter((m) => m > 0);\n  const avgDuration = durationsMinutes.length\n    ? durationsMinutes.reduce((sum, m) => sum + m, 0) / durationsMinutes.length\n    : DEFAULT_FOCUS_MINUTES;\n  const plannedMinutes = Math.round(\n    Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_FOCUS_MINUTES, signalFocusCap ?? avgDuration))\n  );\n\n  const rawCount = Math.round((plannedMinutes * 60) / avgSecondsPerQuestion);\n  const targetQuestionCount = Math.max(MIN_QUESTION_COUNT, Math.min(MAX_QUESTION_COUNT, rawCount));\n\n  return { targetQuestionCount, plannedMinutes, avgSecondsPerQuestion, isProvisional: true };\n}\n\nfunction labelForBucket(category: CompositionBucket['category'], items: PlannedSessionItem[]): string {\n  if (category === 'review') return 'Spaced-repetition review';\n  if (category === 'mixed') return 'Mixed practice';\n  const domains = Array.from(new Set(items.map((i) => i.skillName))).slice(0, 2);\n  return domains.length ? `Priority skills (${domains.join(', ')})` : 'Priority skills';\n}\n\n/** Groups planned `items` (excluding the confidence-builder reserve pool) into PRD F2's composition breakdown. */\nfunction buildComposition(items: PlannedSessionItem[]): CompositionBucket[] {\n  const buckets: Record<CompositionBucket['category'], PlannedSessionItem[]> = {\n    review: [],\n    priority: [],\n    mixed: [],\n  };\n\n  for (const item of items) {\n    if (item.category === 'confidence_builder') continue; // reserve pool, not part of the planned mix\n    buckets[item.category].push(item);\n  }\n\n  return (['review', 'priority', 'mixed'] as const)\n    .map((category) => ({\n      category,\n      label: labelForBucket(category, buckets[category]),\n      count: buckets[category].length,\n    }))\n    .filter((bucket) => bucket.count > 0);\n}\n\n/**\n * Adaptive practice session assembler (PRD F2). Selection priority:\n *   1. Skills with mastery.next_review <= now (spaced-repetition due).\n *   2. Lowest p_mastery x weight (vulnerability gap).\n *   3. Within a skill, the question difficulty closest to ~75% expected\n *      success (calibration sweet spot).\n * Mastery data is read exclusively through lib/mastery's fetchMasteryMap\n * (which itself goes through lib/db) — this module never queries the\n * mastery table directly.\n *\n * `requestedQuestionCount` is optional — when omitted, session length is\n * capped by `estimateSessionBudget`'s provisional focus-minutes proxy\n * (PRD F2's `behavior_signals`-based cap) instead of a flat default.\n * \n * `targetSkillId` forces assembly to focus completely on a single skill (Drill This Skill mode).\n */\nexport async function assemblePracticeSession(\n  supabase: SupabaseClient,\n  userId: string,\n  sessionType: 'diagnostic' | 'practice' | 'review' | 'full_test_entry' = 'practice',\n  targetSkillId?: string,\n  requestedQuestionCount?: number\n): Promise<PracticeSessionPlan> {\n  // 1. Create a session row in the database\n  const session = await startPracticeSession(supabase, userId, sessionType);\n\n  // 2. Fetch skills + mastery state, and the time budget for this session.\n  const [skills, budget] = await Promise.all([fetchSkills(supabase), estimateSessionBudget(supabase, userId)]);\n  if (skills.length === 0) {\n    throw new Error('No skills seeded in the database. Please run seed-skills script first.');\n  }\n\n  const targetQuestionCount = requestedQuestionCount ?? budget.targetQuestionCount;\n  const plannedMinutes = requestedQuestionCount\n    ? Math.round((requestedQuestionCount * budget.avgSecondsPerQuestion) / 60)\n    : budget.plannedMinutes;\n\n  // Filter to actual testable skills (leaf nodes with a section/domain and non-zero weight —\n  // strategy skills are weighted 0 and excluded from question selection).\n  const testableSkills = skills.filter((s) => s.parent_skill_id !== null && s.weight !== 0);\n  let activeSkills = testableSkills.length > 0 ? testableSkills : skills;\n\n  // If we have a single target skill request (Drill mode from mastery map)\n  if (targetSkillId) {\n    const match = activeSkills.find((s) => s.id === targetSkillId);\n    if (match) {\n      activeSkills = [match];\n    }\n  }\n\n  const masteryMap = await fetchMasteryMap(supabase, userId);\n  const now = new Date();\n\n  // 3. Rank skills by PRD F2 priority (1) due, then (2) vulnerability gap.\n  const skillPriorities: SkillPriority[] = activeSkills.map((skill) => {\n    const mastery = masteryMap.get(skill.id);\n    const pMastery = mastery?.p_mastery ?? COLD_START_P_MASTERY;\n    const nextReview = mastery?.next_review ? new Date(mastery.next_review) : COLD_START_NEXT_REVIEW;\n    const isDue = nextReview.getTime() <= now.getTime();\n    const weight = skill.weight ?? 0;\n    return { skill, pMastery, isDue, vulnerabilityScore: pMastery * weight };\n  });\n\n  // Only sort by global priority if we aren't drilling a single targeted skill\n  if (!targetSkillId) {\n    skillPriorities.sort((a, b) => {\n      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;\n      return a.vulnerabilityScore - b.vulnerabilityScore;\n    });\n  }\n\n  // Composition tier per non-due skill\n  const nonDueOrdered = skillPriorities.filter((p) => !p.isDue);\n  const priorityTierSize = Math.max(1, Math.ceil(nonDueOrdered.length / 2));\n  const tierBySkillId = new Map<string, Exclude<SessionCategory, 'confidence_builder'>>();\n  for (const p of skillPriorities) {\n    if (p.isDue) tierBySkillId.set(p.skill.id, 'review');\n  }\n  nonDueOrdered.forEach((p, i) => {\n    tierBySkillId.set(p.skill.id, i < priorityTierSize ? 'priority' : 'mixed');\n  });\n\n  const skillIdMap = new Map(skills.map((s) => [s.id, s.name]));\n  const selectedQuestions: PlannedSessionItem[] = [];\n  const selectedIds = new Set<string>();\n  const questionCache = new Map<string, Question[]>();\n\n  async function candidatesFor(priority: SkillPriority): Promise<Question[]> {\n    const cached = questionCache.get(priority.skill.id);\n    if (cached) return cached;\n\n    const questions = await fetchQuestionsBySkill(supabase, priority.skill.id, 15);\n    const ranked = questions\n      .filter((q) => q.validated)\n      .sort(\n        (a, b) =>\n          calibrationDistance(priority.pMastery, a.difficulty) - calibrationDistance(priority.pMastery, b.difficulty)\n      );\n\n    questionCache.set(priority.skill.id, ranked);\n    return ranked;\n  }\n\n  // 4. Walk the priority-ordered skill list in passes, taking the best\n  // calibration-matched question from each skill per pass, until the\n  // session is full or every skill's pool is exhausted.\n  let madeProgress = true;\n  while (selectedQuestions.length < targetQuestionCount && madeProgress) {\n    madeProgress = false;\n\n    for (const priority of skillPriorities) {\n      if (selectedQuestions.length >= targetQuestionCount) break;\n\n      const pool = await candidatesFor(priority);\n      const next = pool.find((q) => !selectedIds.has(q.id));\n      if (!next) continue;\n\n      selectedQuestions.push({\n        question: next,\n        skillName: skillIdMap.get(priority.skill.id) ?? priority.skill.name ?? 'Unknown Skill',\n        category: tierBySkillId.get(priority.skill.id) ?? 'mixed',\n      });\n      selectedIds.add(next.id);\n      madeProgress = true;\n    }\n  }\n\n  // 5. Fallback: if weighted skill selection couldn't fill the session\n  // (e.g. sparse question bank), top up from any validated question.\n  if (selectedQuestions.length < targetQuestionCount) {\n    const anyQuestions = await fetchValidatedQuestions(supabase, targetQuestionCount - selectedQuestions.length + 10);\n    for (const q of anyQuestions) {\n      if (selectedQuestions.length >= targetQuestionCount) break;\n      if (selectedIds.has(q.id)) continue;\n      selectedQuestions.push({\n        question: q,\n        skillName: skillIdMap.get(q.skill_id || '') || 'Unknown Skill',\n        category: 'mixed',\n      });\n      selectedIds.add(q.id);\n    }\n  }\n\n  // 6. Confidence-builder reserve pool (PRD F2)\n  const strongSkills = activeSkills\n    .map((skill) => ({ skill, pMastery: masteryMap.get(skill.id)?.p_mastery ?? 0 }))\n    .filter((s) => s.pMastery >= CONFIDENCE_BUILDER_MIN_MASTERY)\n    .sort((a, b) => b.pMastery - a.pMastery);\n\n  const confidenceBuilderPool: PlannedSessionItem[] = [];\n  for (const { skill } of strongSkills) {\n    if (confidenceBuilderPool.length >= CONFIDENCE_BUILDER_POOL_SIZE) break;\n    const questions = await fetchQuestionsBySkill(supabase, skill.id, 10);\n    const easiest = questions\n      .filter((q) => q.validated && !selectedIds.has(q.id))\n      .sort((a, b) => a.difficulty - b.difficulty)[0];\n    if (easiest) {\n      confidenceBuilderPool.push({\n        question: easiest,\n        skillName: skillIdMap.get(skill.id) ?? skill.name,\n        category: 'confidence_builder',\n      });\n      selectedIds.add(easiest.id);\n    }\n  }\n\n  return {\n    sessionId: session.id,\n    items: selectedQuestions,\n    plannedMinutes,\n    composition: buildComposition(selectedQuestions),\n    confidenceBuilderPool,\n  };\n}\n