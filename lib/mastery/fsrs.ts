/**
 * lib/mastery/fsrs.ts
 * FSRS-style update to `mastery.stability` / `mastery.next_review`.
 * Reference: 00 SYSTEM/docs/PRD v1-2.md F4 — "correct answers extend
 * stability; misses reduce it." This is a lightweight, FSRS-inspired
 * schedule (not a full FSRS port — PRD explicitly calls this "FSRS-style"),
 * scaled by question difficulty the same way the BKT update is.
 *
 * Pure functions only — no I/O, no framework imports (lib/ boundary rule).
 */

const MIN_STABILITY_DAYS = 0.5;
const MAX_STABILITY_DAYS = 90;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDifficulty(difficulty: number): number {
  return clamp((difficulty - 1) / 2, 0, 1);
}

export interface FsrsInput {
  stability: number; // days
  difficulty: number; // 1..3
  isCorrect: boolean;
}

export interface FsrsResult {
  stability: number;
  nextReview: Date;
}

// Grace window before an overdue review is treated as decayed memory rather
// than "just scheduled, hasn't come up yet."
const OVERDUE_GRACE_DAYS = 1;

export interface ForgettingDecayInput {
  pMastery: number;
  stability: number; // days
  nextReview: string | null; // ISO
  lastPracticed: string | null; // ISO
}

export interface ForgettingDecayResult {
  pMastery: number;
  stability: number;
  nextReview: Date;
}

/**
 * Nightly-only companion to updateFsrs (PRD F4: "refresh next_review across
 * all skills"). updateFsrs only ever runs on an actual attempt; it has no
 * way to represent memory decay from the mere passage of time when a
 * scheduled review is skipped entirely. This applies a standard FSRS-style
 * retrievability decay — R = (1 + t/(9*S))^-1, where t is days since last
 * practiced and S is current stability — to any row overdue by more than
 * OVERDUE_GRACE_DAYS, shrinking both p_mastery and stability by the lost
 * retrievability and rescheduling next_review from `now` (not from the
 * missed date), so a skipped review doesn't compound into ever-further
 * overdue drift. Rows that are current (next_review still in the future)
 * are left untouched — they were already correctly scheduled at last
 * practice, and this is a decay model, not a resync.
 *
 * Returns null when there's nothing to decay (no review ever scheduled, or
 * not yet overdue past the grace window).
 */
export function applyForgettingDecay(input: ForgettingDecayInput, now: Date = new Date()): ForgettingDecayResult | null {
  if (!input.nextReview || !input.lastPracticed) return null;

  const nextReviewMs = new Date(input.nextReview).getTime();
  const overdueDays = (now.getTime() - nextReviewMs) / (24 * 60 * 60 * 1000);
  if (overdueDays < OVERDUE_GRACE_DAYS) return null;

  const elapsedDays = (now.getTime() - new Date(input.lastPracticed).getTime()) / (24 * 60 * 60 * 1000);
  const stabilityDays = Math.max(input.stability, MIN_STABILITY_DAYS);
  const retrievability = 1 / (1 + elapsedDays / (9 * stabilityDays));

  // Blend rather than multiply straight through: full retrievability loss
  // should meaningfully lower confidence, not erase it to near-zero on one
  // missed night — mirrors updateBkt's damped-not-destructive philosophy.
  const pMastery = clamp(input.pMastery * (0.5 + 0.5 * retrievability), 0.05, 0.99);
  const stability = clamp(stabilityDays * retrievability, MIN_STABILITY_DAYS, MAX_STABILITY_DAYS);
  const nextReview = new Date(now.getTime() + stability * 24 * 60 * 60 * 1000);

  return { pMastery, stability, nextReview };
}

export function updateFsrs(input: FsrsInput, now: Date = new Date()): FsrsResult {
  const { stability, difficulty, isCorrect } = input;
  const normDifficulty = normalizeDifficulty(difficulty);

  // Diminishing-returns damping so stability doesn't grow unbounded on long
  // correct streaks — growth slows as stability itself gets larger.
  const damping = 1 / (1 + stability / 30);

  let newStability: number;
  if (isCorrect) {
    // Harder correct answers extend stability more (more evidence of real
    // retention); easier ones extend it less.
    const growth = 1 + (0.3 + 0.4 * normDifficulty) * damping;
    newStability = stability * growth;
  } else {
    // Missing an easier question is a stronger signal of forgetting than
    // missing a hard one, so it cuts stability harder.
    const decay = 0.6 - 0.2 * normDifficulty;
    newStability = Math.max(stability * decay, MIN_STABILITY_DAYS);
  }

  newStability = clamp(newStability, MIN_STABILITY_DAYS, MAX_STABILITY_DAYS);

  const nextReview = new Date(now.getTime() + newStability * 24 * 60 * 60 * 1000);
  return { stability: newStability, nextReview };
}
