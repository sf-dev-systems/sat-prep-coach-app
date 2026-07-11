/**
 * lib/mastery/index.ts
 * Orchestration layer for BKT + FSRS mastery updates against the `mastery`
 * table (schema locked in supabase/migrations/20260710000000_initial_schema.sql,
 * composite PK (user_id, skill_id)). Pure math lives in ./bkt and ./fsrs;
 * all raw table access lives in lib/db per the "DB access only via lib/db"
 * invariant — this file only orchestrates.
 *
 * lib/ boundary rule: imports nothing from app/, components/, next, or react.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchMasteryRow,
  fetchMasteryRows,
  upsertMasteryRow,
  upsertMasteryRowsIgnoringDuplicates,
  type Attempt,
  type Mastery,
} from '../db';
import { updateBkt } from './bkt';
import { updateFsrs, applyForgettingDecay } from './fsrs';

const DEFAULT_P_MASTERY = 0.3;
const DEFAULT_STABILITY = 1.0;

export interface AttemptOutcome {
  skillId: string;
  isCorrect: boolean;
  difficulty: number; // 1..3, from questions.difficulty
  errorType: Attempt['error_type'];
  wasRetry: boolean;
  hintsUsed: number;
}

function defaultMastery(userId: string, skillId: string): Mastery {
  return {
    user_id: userId,
    skill_id: skillId,
    p_mastery: DEFAULT_P_MASTERY,
    stability: DEFAULT_STABILITY,
    attempts_count: 0,
    last_practiced: null,
    next_review: null,
  };
}

/**
 * Per-attempt mastery update (PRD F4). Call this once for every `attempts`
 * row written — both the initial submission and a miss-loop retry. Reads
 * the current mastery row (or PRD defaults if this is the student's first
 * attempt at the skill), runs the BKT + FSRS math, and upserts the result.
 */
export async function updateMasteryOnAttempt(
  supabase: SupabaseClient,
  userId: string,
  outcome: AttemptOutcome
): Promise<Mastery> {
  const current = (await fetchMasteryRow(supabase, userId, outcome.skillId)) ?? defaultMastery(userId, outcome.skillId);

  const pMastery = updateBkt({
    pMastery: current.p_mastery,
    difficulty: outcome.difficulty,
    isCorrect: outcome.isCorrect,
    errorType: outcome.errorType,
    wasRetry: outcome.wasRetry,
    hintsUsed: outcome.hintsUsed,
  });

  const now = new Date();
  const { stability, nextReview } = updateFsrs(
    {
      stability: current.stability,
      difficulty: outcome.difficulty,
      isCorrect: outcome.isCorrect,
    },
    now
  );

  return upsertMasteryRow(supabase, {
    user_id: userId,
    skill_id: outcome.skillId,
    p_mastery: pMastery,
    stability,
    attempts_count: current.attempts_count + 1,
    last_practiced: now.toISOString(),
    next_review: nextReview.toISOString(),
  });
}

/**
 * Diagnostic support (PRD F1): "On completion: initialize every `mastery`
 * row." Idempotent — skips rows that already exist rather than resetting
 * progress if called again. Not wired to a route yet (F1's diagnostic flow
 * itself is a separate Phase 2 item); exported so that flow can call it
 * without re-deriving the upsert shape.
 */
export async function initializeMasteryRows(
  supabase: SupabaseClient,
  userId: string,
  skillIds: string[]
): Promise<void> {
  if (skillIds.length === 0) return;
  await upsertMasteryRowsIgnoringDuplicates(
    supabase,
    skillIds.map((skillId) => defaultMastery(userId, skillId))
  );
}

/** All mastery rows for a user, keyed by skill_id, for dashboard/session-assembler consumption. */
export async function fetchMasteryMap(supabase: SupabaseClient, userId: string): Promise<Map<string, Mastery>> {
  const rows = await fetchMasteryRows(supabase, userId);
  return new Map(rows.map((row) => [row.skill_id, row]));
}

/**
 * PRD F4 nightly job's "refresh next_review across all skills" clause.
 * Applies applyForgettingDecay to every mastery row for this user; rows
 * that aren't overdue past the grace window are left untouched (returned
 * count only reflects rows actually decayed). Called from
 * lib/scoring/nightly.ts's per-user loop — never from a user-facing
 * request, since it's meant to run once per night, not per page load.
 */
export async function refreshMasteryDecayForUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const rows = await fetchMasteryRows(supabase, userId);
  let decayedCount = 0;

  for (const row of rows) {
    const decay = applyForgettingDecay(
      {
        pMastery: row.p_mastery,
        stability: row.stability,
        nextReview: row.next_review,
        lastPracticed: row.last_practiced,
      },
      now
    );
    if (!decay) continue;

    await upsertMasteryRow(supabase, {
      ...row,
      p_mastery: decay.pMastery,
      stability: decay.stability,
      next_review: decay.nextReview.toISOString(),
    });
    decayedCount += 1;
  }

  return decayedCount;
}
