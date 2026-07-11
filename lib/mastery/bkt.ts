/**
 * lib/mastery/bkt.ts
 * Bayesian Knowledge Tracing update for `mastery.p_mastery`.
 * Reference: 00 SYSTEM/docs/PRD v1-2.md F4.
 *   correct:   p += (1-p) * learn_rate, scaled down if the question was
 *              easy relative to current mastery
 *   incorrect: p *= (1 - slip_penalty), scaled by difficulty and error_type
 *
 * Pure functions only — no I/O, no framework imports (lib/ boundary rule).
 */
import type { Attempt } from '../db';

const BASE_LEARN_RATE = 0.15;
const BASE_SLIP_PENALTY = 0.15;
const MIN_MASTERY = 0.02;
const MAX_MASTERY = 0.98;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Map the 1..3 difficulty scale onto 0..1. */
function normalizeDifficulty(difficulty: number): number {
  return clamp((difficulty - 1) / 2, 0, 1);
}

/**
 * Retry credit scales inversely with hints consumed — PRD F3.2: "Fewer
 * hints used -> more credit." A clean retry (0 hints) earns nearly full
 * learn-rate credit; a 3-hint near-walkthrough earns little, since the
 * student mostly followed a worked path rather than recalling the method.
 */
function retryCreditFactor(hintsUsed: number): number {
  const table = [0.9, 0.7, 0.5, 0.3];
  return table[clamp(hintsUsed, 0, 3)];
}

/**
 * Careless/misread errors get a reduced mastery penalty vs. concept errors
 * (PRD F3.5). `null` (no self-tag yet, e.g. mid-miss-loop) treats as a full
 * concept-level penalty — the conservative default.
 */
function errorTypeMultiplier(errorType: Attempt['error_type']): number {
  switch (errorType) {
    case 'concept':
      return 1.0;
    case 'calculation':
      return 0.85;
    case 'timing':
      return 0.7;
    case 'guess':
      return 0.9;
    case 'misread':
      return 0.6;
    case 'careless':
      return 0.5;
    default:
      return 1.0;
  }
}

export interface BktInput {
  pMastery: number;
  difficulty: number;
  isCorrect: boolean;
  errorType: Attempt['error_type'];
  wasRetry: boolean;
  hintsUsed: number;
}

/** Returns the updated p_mastery (0..1), clamped away from the 0/1 extremes. */
export function updateBkt(input: BktInput): number {
  const { pMastery, difficulty, isCorrect, errorType, wasRetry, hintsUsed } = input;
  const normDifficulty = normalizeDifficulty(difficulty);

  if (isCorrect) {
    // A question that's easy relative to current mastery confirms little —
    // scale the learn rate down as (normDifficulty - pMastery) goes negative.
    const challengeFactor = clamp(0.5 + (normDifficulty - pMastery), 0.4, 1.3);
    let learnRate = BASE_LEARN_RATE * challengeFactor;
    if (wasRetry) learnRate *= retryCreditFactor(hintsUsed);
    const updated = pMastery + (1 - pMastery) * learnRate;
    return clamp(updated, MIN_MASTERY, MAX_MASTERY);
  }

  // Missing a harder question is less surprising than missing an easy one,
  // so the difficulty multiplier shrinks as normDifficulty rises.
  const difficultyMultiplier = 1.3 - 0.3 * normDifficulty;
  const slipPenalty = clamp(BASE_SLIP_PENALTY * difficultyMultiplier * errorTypeMultiplier(errorType), 0, 0.5);
  const updated = pMastery * (1 - slipPenalty);
  return clamp(updated, MIN_MASTERY, MAX_MASTERY);
}
