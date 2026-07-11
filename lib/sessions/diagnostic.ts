/**
 * lib/sessions/diagnostic.ts
 * PRD F1 — Diagnostic (first run): ~40 questions, section-adaptive, where
 * the second half of each section's difficulty is conditioned on that
 * section's first-half performance.
 *
 * DESIGN DECISION (flagged per CLAUDE.md working rules, not silently
 * picked): this lives in its own module rather than folded into
 * `assemblePracticeSession` (./index.ts) because diagnostic assembly is
 * inherently two-phase — the second half of a section literally cannot be
 * chosen until first-half accuracy exists, whereas the practice assembler
 * is a single-pass, assemble-everything-up-front operation. Splitting it
 * out keeps that assembler's logic (due/vulnerability/calibration
 * priority) untouched and free of a phase-2-only concept.
 *
 * `assembleDiagnosticFirstHalves` runs server-side (called from
 * app/diagnostic/page.tsx, same pattern as app/session/page.tsx) since it
 * also creates the `sessions` row. `assembleDiagnosticSecondHalf` is
 * designed to be called from the CLIENT (browser Supabase client) between
 * sections, once first-half accuracy is known — it only reads the shared
 * `skills`/`questions` content tables, which are authenticated-read-only
 * for every user (schema invariant #4), so no new API route/Server Action
 * is needed. This mirrors the existing pattern where useMissLoop already
 * performs `attempts`/`mastery` writes directly from the client under RLS.
 *
 * lib/ boundary rule: imports nothing from app/, components/, next, or
 * react. DB access only via lib/db.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import {
  Question,
  Skill,
  startPracticeSession,
  fetchSkills,
  fetchQuestionsBySkill,
  fetchValidatedQuestions,
} from '../db';

export interface DiagnosticItem {
  question: Question;
  skillName: string;
  section: Skill['section'];
}

export interface DiagnosticSectionPlan {
  section: Skill['section'];
  firstHalf: DiagnosticItem[];
  /** Not yet assembled — filled in by assembleDiagnosticSecondHalf once first-half accuracy is known. */
  secondHalfCount: number;
}

export interface DiagnosticPlan {
  sessionId: string;
  sections: DiagnosticSectionPlan[];
  /** Every leaf skill_id in the taxonomy, for initializeMasteryRows on completion. */
  leafSkillIds: string[];
}

const DEFAULT_TOTAL_QUESTIONS = 40; // PRD F1: "~40 questions"
const NEUTRAL_DIFFICULTY = 2; // 1..3 scale — first half always starts neutral (no prior data to condition on)
const SECTION_ORDER: Skill['section'][] = ['math', 'rw', 'strategy'];

/**
 * Difficulty band assigned to a section's second half, conditioned on
 * first-half accuracy (PRD F1's "section-adaptive" clause). Thresholds are
 * a first-pass heuristic, consistent with this project's standing caveat
 * that difficulty<->success calibration constants are not yet empirically
 * tuned (see AGENT_HANDOFF.md).
 */
export function difficultyForAccuracy(accuracy: number): number {
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.4) return 2;
  return 1;
}

function pickClosestDifficulty(pool: Question[], target: number, usedIds: Set<string>): Question | undefined {
  return pool
    .filter((q) => q.validated && !usedIds.has(q.id))
    .sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target))[0];
}

/**
 * Round-robins across a section's leaf skills, taking one question per
 * skill per pass at (or closest to) `targetDifficulty`, until `count`
 * questions are selected or every skill's pool is exhausted. Shared by both
 * diagnostic halves so first/second-half selection logic can't drift.
 */
async function selectSectionQuestions(
  supabase: SupabaseClient,
  skills: Skill[],
  count: number,
  targetDifficulty: number,
  usedIds: Set<string>
): Promise<DiagnosticItem[]> {
  const selected: DiagnosticItem[] = [];
  if (skills.length === 0 || count <= 0) return selected;

  const poolCache = new Map<string, Question[]>();
  const poolFor = async (skill: Skill): Promise<Question[]> => {
    const cached = poolCache.get(skill.id);
    if (cached) return cached;
    const pool = await fetchQuestionsBySkill(supabase, skill.id, 10);
    poolCache.set(skill.id, pool);
    return pool;
  };

  let madeProgress = true;
  while (selected.length < count && madeProgress) {
    madeProgress = false;
    for (const skill of skills) {
      if (selected.length >= count) break;
      const pool = await poolFor(skill);
      const q = pickClosestDifficulty(pool, targetDifficulty, usedIds);
      if (!q) continue;
      selected.push({ question: q, skillName: skill.name, section: skill.section });
      usedIds.add(q.id);
      madeProgress = true;
    }
  }

  // Fallback top-up for a sparse bank — mirrors ./index.ts's assembler fallback.
  if (selected.length < count) {
    const topUp = await fetchValidatedQuestions(supabase, count - selected.length + 10);
    for (const q of topUp) {
      if (selected.length >= count) break;
      if (usedIds.has(q.id)) continue;
      const skill = skills.find((s) => s.id === q.skill_id);
      if (!skill) continue; // keep this section's fallback confined to this section's skills
      selected.push({ question: q, skillName: skill.name, section: skill.section });
      usedIds.add(q.id);
    }
  }

  return selected;
}

/**
 * First halves of every section (PRD F1), plus the `sessions` row. Splits
 * `totalQuestionCount` across sections proportional to each section's leaf
 * skill count — read live from the taxonomy via fetchSkills, never
 * hardcoded, so this self-adjusts if the seed changes (see AGENT_HANDOFF's
 * noted taxonomy-count discrepancy between PRD prose and the actual seed).
 */
export async function assembleDiagnosticFirstHalves(
  supabase: SupabaseClient,
  userId: string,
  totalQuestionCount: number = DEFAULT_TOTAL_QUESTIONS
): Promise<DiagnosticPlan> {
  const session = await startPracticeSession(supabase, userId, 'diagnostic');
  const skills = await fetchSkills(supabase);
  const leafSkills = skills.filter((s) => s.parent_skill_id !== null);

  if (leafSkills.length === 0) {
    throw new Error('No skills seeded in the database. Please run seed-skills script first.');
  }

  const bySection = new Map<Skill['section'], Skill[]>();
  for (const skill of leafSkills) {
    const list = bySection.get(skill.section) ?? [];
    list.push(skill);
    bySection.set(skill.section, list);
  }

  const activeSections = SECTION_ORDER.filter((s) => (bySection.get(s)?.length ?? 0) > 0);
  const totalLeafCount = leafSkills.length;

  // Proportional allocation by leaf-skill count; remainder goes to the
  // largest section so counts always sum to exactly totalQuestionCount.
  const rawCounts = activeSections.map((section) => {
    const n = bySection.get(section)!.length;
    return { section, count: Math.round((totalQuestionCount * n) / totalLeafCount) };
  });
  const allocated = rawCounts.reduce((sum, r) => sum + r.count, 0);
  if (rawCounts.length > 0) {
    rawCounts.sort((a, b) => bySection.get(b.section)!.length - bySection.get(a.section)!.length);
    rawCounts[0].count += totalQuestionCount - allocated;
  }
  // Restore canonical section order for display/traversal after the sort above.
  rawCounts.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section));

  const usedIds = new Set<string>();
  const sections: DiagnosticSectionPlan[] = [];

  for (const { section, count } of rawCounts) {
    const firstHalfCount = Math.ceil(count / 2);
    const secondHalfCount = count - firstHalfCount;
    const firstHalf = await selectSectionQuestions(
      supabase,
      bySection.get(section)!,
      firstHalfCount,
      NEUTRAL_DIFFICULTY,
      usedIds
    );
    sections.push({ section, firstHalf, secondHalfCount });
  }

  return {
    sessionId: session.id,
    sections,
    leafSkillIds: leafSkills.map((s) => s.id),
  };
}

/**
 * Second half of one section. Call once that section's first half is fully
 * answered — `accuracy` is the fraction correct on those first-half
 * attempts (the caller already has this locally, from the attempts it just
 * logged via useMissLoop, so no extra DB round-trip is needed to compute
 * it). `excludeQuestionIds` must include every question already served
 * this diagnostic so far (all sections), to prevent repeats.
 */
export async function assembleDiagnosticSecondHalf(
  supabase: SupabaseClient,
  section: Skill['section'],
  count: number,
  accuracy: number,
  excludeQuestionIds: string[]
): Promise<DiagnosticItem[]> {
  if (count <= 0) return [];
  const skills = await fetchSkills(supabase);
  const sectionSkills = skills.filter((s) => s.parent_skill_id !== null && s.section === section);
  const targetDifficulty = difficultyForAccuracy(accuracy);
  const usedIds = new Set(excludeQuestionIds);
  return selectSectionQuestions(supabase, sectionSkills, count, targetDifficulty, usedIds);
}
