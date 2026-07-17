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
  /** Time-budgeted plan (PRD F2), e.g. "~40 min" — see estimateSessionBudget's provisional caveat. */
  plannedMinutes: number;
  /** Per-category breakdown of items, e.g. "15 review / 12 priority / 5 mixed" (PRD F2's illustrative composition). */
  composition: CompositionBucket[];
  /**
   * High-mastery questions held in reserve, not part of items. SessionRunner
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
// "neutral" question difficulty (normDifficulty 0.5) expected success equals
// p_mastery; each step away from neutral shifts expected success by up to
// +/-DIFFICULTY_SPREAD.
const DIFFICULTY_SPREAD = 0.6;
const TARGET_SUCCESS_RATE = 0.75;

// PRD F2 time-budget defaults / bounds (see estimateSessionBudget doc comment
// for why these are provisional rather than read from behavior_signals).
const DEFAULT_SECONDS_PER_QUESTION = 90; // matches dashboard.ts's "On Track" pace threshold
const DEFAULT_FOCUS_MINUTES = 40; // PRD F2's own illustrative example ("~40 min")
const MIN_FOCUS_MINUTES = 20;
const MAX_FOCUS_MINUTES = 60;
const MIN_QUESTION_COUNT = 15; // PRD F2: "15-25 questions"
const MAX_QUESTION_COUNT = 25;

// Confidence-builder pool (PRD F2: "insert one high-mastery confidence-builder").
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
 * assumption that difficulty 2 ("neutral") tracks p_mastery directly, with
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
 * PRD F2's session-length cap: "Reads behavior_signals: cap planned session
 * length at avg_focus_minutes/fatigue_minute." Now reads the real
 * behavior_signals row (populated nightly by lib/scoring/nightly.ts) when
 * one exists — the cap is min(avg_focus_minutes, fatigue_minute) when
 * both are present, since fatigue_minute (accuracy drop-off) is the harder
 * ceiling of the two once accuracy has actually started declining.
 * avg_pace_by_difficulty (averaged across difficulty buckets) replaces
 * the flat per-question time estimate too.
 *
 * A brand-new student (or one whose first sessions row predates the
 * nightly job's most recent run) has no behavior_signals row yet —
 * same degrade-never-block pattern as lib/mastery/dashboard.ts's
 * readiness panel: fall back to a live proxy computed directly from
 * recent attempts/sessions, flagged via isProvisional.
 */
export async function estimateSessionBudget(supabase: SupabaseClient, userId: string): Promise<SessionBudget> {
  const signals = await fetchBehaviorSignals(supabase, userId);

  const signalPace = averagePace(signals?.avg_pace_by_difficulty ?? null);
  const signalFocusCap =
    signals?.avg_focus_minutes != null || signals?.fatigue_minute != null
      ? Math.min(...[signals?.avg_focus_minutes, signals?.fatigue_minute].filter((v): v is number => v != null))
      : null;

  if (signalPace != null && signalFocusCap != null) {
    const plannedMinutes = Math.round(Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_FOCUS_MINUTES, signalFocusCap)));
    const rawCount = Math.round((plannedMinutes * 60) / signalPace);
    const targetQuestionCount = Math.max(MIN_QUESTION_COUNT, Math.min(MAX_QUESTION_COUNT, rawCount));
    return { targetQuestionCount, plannedMinutes, avgSecondsPerQuestion: signalPace, isProvisional: false };
  }

  // Provisional fallback — same live-computed proxy this function used
  // before behavior_signals existed.
  const [attempts, sessions] = await Promise.all([
    fetchRecentAttempts(supabase, userId, 200),
    fetchRecentSessions(supabase, userId, 20),
  ]);

  const timedAttempts = attempts.filter((a) => a.time_spent_seconds != null);
  const avgSecondsPerQuestion =
    signalPace ??
    (timedAttempts.length
      ? timedAttempts.reduce((sum, a) => sum + (a.time_spent_seconds as number), 0) / timedAttempts.length
      : DEFAULT_SECONDS_PER_QUESTION);

  const completed = sessions.filter((s) => s.started_at && s.ended_at);
  const durationsMinutes = completed
    .map((s) => (new Date(s.ended_at as string).getTime() - new Date(s.started_at).getTime()) / 60000)
    .filter((m) => m > 0);
  const avgDuration = durationsMinutes.length
    ? durationsMinutes.reduce((sum, m) => sum + m, 0) / durationsMinutes.length
    : DEFAULT_FOCUS_MINUTES;
  const plannedMinutes = Math.round(
    Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_FOCUS_MINUTES, signalFocusCap ?? avgDuration))
  );

  const rawCount = Math.round((plannedMinutes * 60) / avgSecondsPerQuestion);
  const targetQuestionCount = Math.max(MIN_QUESTION_COUNT, Math.min(MAX_QUESTION_COUNT, rawCount));

  return { targetQuestionCount, plannedMinutes, avgSecondsPerQuestion, isProvisional: true };
}

function labelForBucket(category: CompositionBucket['category'], items: PlannedSessionItem[]): string {
  if (category === 'review') return 'Spaced-repetition review';
  if (category === 'mixed') return 'Mixed practice';
  const domains = Array.from(new Set(items.map((i) => i.skillName))).slice(0, 2);
  return domains.length ? `Priority skills (${domains.join(', ')})` : 'Priority skills';
}

/** Groups planned items (excluding the confidence-builder reserve pool) into PRD F2's composition breakdown. */
function buildComposition(items: PlannedSessionItem[]): CompositionBucket[] {
  const buckets: Record<CompositionBucket['category'], PlannedSessionItem[]> = {
    review: [],
    priority: [],
    mixed: [],
  };

  for (const item of items) {
    if (item.category === 'confidence_builder') continue; // reserve pool, not part of the planned mix
    buckets[item.category].push(item);
  }

  return (['review', 'priority', 'mixed'] as const)
    .map((category) => ({
      category,
      label: labelForBucket(category, buckets[category]),
      count: buckets[category].length,
    }))
    .filter((bucket) => bucket.count > 0);
}

/**
 * Adaptive practice session assembler (PRD F2). Selection priority:
 *   1. Skills with mastery.next_review <= now (spaced-repetition due).
 *   2. Lowest p_mastery x weight (vulnerability gap).
 *   3. Within a skill, the question difficulty closest to ~75% expected
 *      success (calibration sweet spot).
 * Mastery data is read exclusively through lib/mastery's fetchMasteryMap
 * (which itself goes through lib/db) — this module never queries the
 * mastery table directly.
 *
 * requestedQuestionCount is optional — when omitted, session length is
 * capped by estimateSessionBudget's provisional focus-minutes proxy
 * (PRD F2's behavior_signals-based cap) instead of a flat default.
 * 
 * targetSkillId forces assembly to focus completely on a single skill (Drill This Skill mode).
 */
export async function assemblePracticeSession(
  supabase: SupabaseClient,
  userId: string,
  sessionType: 'diagnostic' | 'practice' | 'review' | 'full_test_entry' = 'practice',
  targetSkillId?: string,
  requestedQuestionCount?: number
): Promise<PracticeSessionPlan> {
  // 1. Create a session row in the database
  const session = await startPracticeSession(supabase, userId, sessionType);

  // 2. Fetch skills + mastery state, and the time budget for this session.
  const [skills, budget] = await Promise.all([fetchSkills(supabase), estimateSessionBudget(supabase, userId)]);
  if (skills.length === 0) {
    throw new Error('No skills seeded in the database. Please run seed-skills script first.');
  }

  const targetQuestionCount = requestedQuestionCount ?? budget.targetQuestionCount;
  const plannedMinutes = requestedQuestionCount
    ? Math.round((requestedQuestionCount * budget.avgSecondsPerQuestion) / 60)
    : budget.plannedMinutes;

  // Filter to actual testable skills (leaf nodes with a section/domain and non-zero weight —
  // strategy skills are weighted 0 and excluded from question selection).
  const testableSkills = skills.filter((s) => s.parent_skill_id !== null && s.weight !== 0);
  let activeSkills = testableSkills.length > 0 ? testableSkills : skills;

  // If we have a single target skill request (Drill mode from mastery map)
  if (targetSkillId) {
    const match = activeSkills.find((s) => s.id === targetSkillId);
    if (match) {
      activeSkills = [match];
    }
  }

  const masteryMap = await fetchMasteryMap(supabase, userId);
  const now = new Date();

  // 3. Rank skills by PRD F2 priority (1) due, then (2) vulnerability gap.
  const skillPriorities: SkillPriority[] = activeSkills.map((skill) => {
    const mastery = masteryMap.get(skill.id);
    const pMastery = mastery?.p_mastery ?? COLD_START_P_MASTERY;
    const nextReview = mastery?.next_review ? new Date(mastery.next_review) : COLD_START_NEXT_REVIEW;
    const isDue = nextReview.getTime() <= now.getTime();
    const weight = skill.weight ?? 0;
    return { skill, pMastery, isDue, vulnerabilityScore: pMastery * weight };
  });

  // Only sort by global priority if we aren't drilling a single targeted skill
  if (!targetSkillId) {
    skillPriorities.sort((a, b) => {
      if (a.isDue !== b.isDue) return a.isDue ? -1 : 1;
      return a.vulnerabilityScore - b.vulnerabilityScore;
    });
  }

  // Composition tier per non-due skill
  const nonDueOrdered = skillPriorities.filter((p) => !p.isDue);
  const priorityTierSize = Math.max(1, Math.ceil(nonDueOrdered.length / 2));
  const tierBySkillId = new Map<string, Exclude<SessionCategory, 'confidence_builder'>>();
  for (const p of skillPriorities) {
    if (p.isDue) tierBySkillId.set(p.skill.id, 'review');
  }
  nonDueOrdered.forEach((p, i) => {
    tierBySkillId.set(p.skill.id, i < priorityTierSize ? 'priority' : 'mixed');
  });

  const skillIdMap = new Map(skills.map((s) => [s.id, s.name]));
  const selectedQuestions: PlannedSessionItem[] = [];
  const selectedIds = new Set<string>();
  const questionCache = new Map<string, Question[]>();

  async function candidatesFor(priority: SkillPriority): Promise<Question[]> {
    const cached = questionCache.get(priority.skill.id);
    if (cached) return cached;

    const questions = await fetchQuestionsBySkill(supabase, priority.skill.id, 15);
    const ranked = questions
      .filter((q) => q.validated)
      .sort(
        (a, b) =>
          calibrationDistance(priority.pMastery, a.difficulty) - calibrationDistance(priority.pMastery, b.difficulty)
      );

    questionCache.set(priority.skill.id, ranked);
    return ranked;
  }

  // 4. Walk the priority-ordered skill list in passes, taking the best
  // calibration-matched question from each skill per pass, until the
  // session is full or every skill's pool is exhausted.
  let madeProgress = true;
  while (selectedQuestions.length < targetQuestionCount && madeProgress) {
    madeProgress = false;

    for (const priority of skillPriorities) {
      if (selectedQuestions.length >= targetQuestionCount) break;

      const pool = await candidatesFor(priority);
      const next = pool.find((q) => !selectedIds.has(q.id));
      if (!next) continue;

      selectedQuestions.push({
        question: next,
        skillName: skillIdMap.get(priority.skill.id) ?? priority.skill.name ?? 'Unknown Skill',
        category: tierBySkillId.get(priority.skill.id) ?? 'mixed',
      });
      selectedIds.add(next.id);
      madeProgress = true;
    }
  }

  // 5. Fallback: if weighted skill selection couldn't fill the session
  // (e.g. sparse question bank), top up from any validated question.
  if (selectedQuestions.length < targetQuestionCount) {
    const anyQuestions = await fetchValidatedQuestions(supabase, targetQuestionCount - selectedQuestions.length + 10);
    for (const q of anyQuestions) {
      if (selectedQuestions.length >= targetQuestionCount) break;
      if (selectedIds.has(q.id)) continue;
      selectedQuestions.push({
        question: q,
        skillName: skillIdMap.get(q.skill_id || '') || 'Unknown Skill',
        category: 'mixed',
      });
      selectedIds.add(q.id);
    }
  }

  // 6. Confidence-builder reserve pool (PRD F2)
  const strongSkills = activeSkills
    .map((skill) => ({ skill, pMastery: masteryMap.get(skill.id)?.p_mastery ?? 0 }))
    .filter((s) => s.pMastery >= CONFIDENCE_BUILDER_MIN_MASTERY)
    .sort((a, b) => b.pMastery - a.pMastery);

  const confidenceBuilderPool: PlannedSessionItem[] = [];
  for (const { skill } of strongSkills) {
    if (confidenceBuilderPool.length >= CONFIDENCE_BUILDER_POOL_SIZE) break;
    const questions = await fetchQuestionsBySkill(supabase, skill.id, 10);
    const easiest = questions
      .filter((q) => q.validated && !selectedIds.has(q.id))
      .sort((a, b) => a.difficulty - b.difficulty)[0];
    if (easiest) {
      confidenceBuilderPool.push({
        question: easiest,
        skillName: skillIdMap.get(skill.id) ?? skill.name,
        category: 'confidence_builder',
      });
      selectedIds.add(easiest.id);
    }
  }

  return {
    sessionId: session.id,
    items: selectedQuestions,
    plannedMinutes,
    composition: buildComposition(selectedQuestions),
    confidenceBuilderPool,
  };
}
