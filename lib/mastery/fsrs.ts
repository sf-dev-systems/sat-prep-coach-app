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
