/**
 * lib/scoring/behavior-signals.ts
 * Pure computation for PRD F4's nightly `behavior_signals` job: pace by
 * difficulty, fatigue minute, focus minutes, time-of-day performance,
 * post-miss accuracy, calibration score. No I/O here — lib/scoring/nightly.ts
 * fetches attempts/sessions via lib/db and passes them in; this module just
 * does the math, so it's trivially unit-testable and mirrors lib/mastery's
 * bkt.ts/fsrs.ts split (pure math vs. orchestration).
 *
 * lib/ boundary rule: imports nothing from app/, components/, next, or react.
 */
import type { AttemptWithDifficulty, Session, TimeOfDayBucket } from '../db';

// Below this many qualifying samples, a signal is considered too noisy to
// trust and is reported as null (dashboard/session-assembler readers already
// have a provisional fallback for the null case — see their doc comments).
const MIN_SAMPLES_FOR_SIGNAL = 5;
const MIN_SAMPLES_PER_BUCKET = 3;

// A sustained accuracy drop of this many percentage points below the
// session's first-5-minutes baseline marks the fatigue minute.
const FATIGUE_ACCURACY_DROP_THRESHOLD = 0.2;
const FATIGUE_BASELINE_WINDOW_MINUTES = 5;

// PRD F3: "after 2 consecutive misses" — same threshold the miss loop itself
// uses to decide when to splice in a confidence-builder.
const POST_MISS_STREAK = 2;

export interface PaceByDifficulty {
  [difficulty: string]: number;
}

export interface TimeOfDayPerformance {
  [hour: string]: TimeOfDayBucket;
}

export interface BehaviorSignalsResult {
  avgPaceByDifficulty: PaceByDifficulty | null;
  fatigueMinute: number | null;
  avgFocusMinutes: number | null;
  timeOfDayPerformance: TimeOfDayPerformance | null;
  postMissAccuracy: number | null;
  calibrationScore: number | null;
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K | null | undefined): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (key == null) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

/** avg_pace_by_difficulty: mean time_spent_seconds per question difficulty (1..3). */
export function computeAvgPaceByDifficulty(attempts: AttemptWithDifficulty[]): PaceByDifficulty | null {
  const byDifficulty = groupBy(
    attempts.filter((a) => a.time_spent_seconds != null && a.difficulty != null),
    (a) => a.difficulty
  );
  if (byDifficulty.size === 0) return null;

  const result: PaceByDifficulty = {};
  for (const [difficulty, group] of Array.from(byDifficulty)) {
    const seconds = group.map((a) => a.time_spent_seconds as number);
    result[String(difficulty)] = Math.round(seconds.reduce((s, v) => s + v, 0) / seconds.length);
  }
  return result;
}

/** Flattened mean across whatever difficulty buckets exist — used by dashboard/session-assembler as a single "typical pace" figure. */
export function averagePace(paceByDifficulty: PaceByDifficulty | null): number | null {
  if (!paceByDifficulty) return null;
  const values = Object.values(paceByDifficulty);
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** time_of_day_performance: accuracy/pace bucketed by local hour (0-23). */
export function computeTimeOfDayPerformance(attempts: AttemptWithDifficulty[]): TimeOfDayPerformance | null {
  const byHour = groupBy(
    attempts.filter((a) => a.is_correct != null),
    (a) => new Date(a.created_at).getHours()
  );

  const result: TimeOfDayPerformance = {};
  for (const [hour, group] of Array.from(byHour)) {
    if (group.length < MIN_SAMPLES_PER_BUCKET) continue; // too few samples in this hour to mean anything
    const correct = group.filter((a) => a.is_correct).length;
    const timed = group.filter((a) => a.time_spent_seconds != null);
    result[String(hour)] = {
      accuracy: Math.round((correct / group.length) * 100) / 100,
      avg_pace_seconds: timed.length
        ? Math.round(timed.reduce((s, a) => s + (a.time_spent_seconds as number), 0) / timed.length)
        : 0,
      n: group.length,
    };
  }
  return Object.keys(result).length ? result : null;
}

/** post_miss_accuracy: accuracy on attempts that follow >=2 consecutive misses within the same session. */
export function computePostMissAccuracy(attempts: AttemptWithDifficulty[]): number | null {
  const bySession = groupBy(
    attempts.filter((a) => a.is_correct != null),
    (a) => a.session_id
  );

  let hits = 0;
  let total = 0;
  for (const sessionAttempts of Array.from(bySession.values())) {
    // Caller guarantees ascending created_at order (fetchAttemptsSince), so
    // within-session order here reflects the order the student actually saw.
    let missStreak = 0;
    for (const a of sessionAttempts) {
      if (missStreak >= POST_MISS_STREAK) {
        total += 1;
        if (a.is_correct) hits += 1;
      }
      missStreak = a.is_correct ? 0 : missStreak + 1;
    }
  }

  return total >= MIN_SAMPLES_FOR_SIGNAL ? Math.round((hits / total) * 100) / 100 : null;
}

/** calibration_score: fraction of confidence-tagged attempts where confidence lines up with correctness. Same rule as the dashboard's provisional stand-in, now the canonical source. */
export function computeCalibrationScore(attempts: AttemptWithDifficulty[]): number | null {
  const tagged = attempts.filter((a) => a.confidence != null && a.is_correct != null);
  if (tagged.length < MIN_SAMPLES_FOR_SIGNAL) return null;

  const calibrated = tagged.filter(
    (a) =>
      (a.confidence === 'high' && a.is_correct) || (a.confidence === 'low' && !a.is_correct) || a.confidence === 'medium'
  );
  return Math.round((calibrated.length / tagged.length) * 100) / 100;
}

/**
 * avg_focus_minutes + fatigue_minute together: bucket every attempt by
 * minute-of-session (attempt.created_at - session.started_at), compare each
 * minute's accuracy against the first-5-minutes baseline, and report the
 * first sustained drop as fatigue_minute. avg_focus_minutes is the mean
 * completed-session duration (same proxy dashboard.ts/index.ts used
 * provisionally, now computed from the full lookback window instead of a
 * capped recent-sessions fetch).
 */
export function computeFocusAndFatigue(
  attempts: AttemptWithDifficulty[],
  sessions: Session[]
): { avgFocusMinutes: number | null; fatigueMinute: number | null } {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const bySession = groupBy(
    attempts.filter((a) => a.is_correct != null),
    (a) => a.session_id
  );

  const minuteBuckets = new Map<number, { correct: number; total: number }>();
  const sessionDurations: number[] = [];

  for (const [sessionId, sessionAttempts] of Array.from(bySession)) {
    const session = sessionById.get(sessionId as string);
    if (!session?.started_at) continue;
    const startMs = new Date(session.started_at).getTime();

    for (const a of sessionAttempts) {
      const minute = Math.floor((new Date(a.created_at).getTime() - startMs) / 60000);
      if (minute < 0) continue;
      const bucket = minuteBuckets.get(minute) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (a.is_correct) bucket.correct += 1;
      minuteBuckets.set(minute, bucket);
    }

    if (session.ended_at) {
      const durationMinutes = (new Date(session.ended_at).getTime() - startMs) / 60000;
      if (durationMinutes > 0) sessionDurations.push(durationMinutes);
    }
  }

  const avgFocusMinutes = sessionDurations.length
    ? Math.round(sessionDurations.reduce((s, v) => s + v, 0) / sessionDurations.length)
    : null;

  const baselineEntries = Array.from(minuteBuckets.entries()).filter(([m]) => m < FATIGUE_BASELINE_WINDOW_MINUTES);
  const baselineTotal = baselineEntries.reduce((s, [, b]) => s + b.total, 0);
  if (baselineTotal < MIN_SAMPLES_FOR_SIGNAL) {
    return { avgFocusMinutes, fatigueMinute: null };
  }
  const baselineAccuracy = baselineEntries.reduce((s, [, b]) => s + b.correct, 0) / baselineTotal;

  let fatigueMinute: number | null = null;
  for (const minute of Array.from(minuteBuckets.keys()).sort((a, b) => a - b)) {
    if (minute < FATIGUE_BASELINE_WINDOW_MINUTES) continue;
    const bucket = minuteBuckets.get(minute)!;
    if (bucket.total < MIN_SAMPLES_PER_BUCKET) continue;
    const accuracy = bucket.correct / bucket.total;
    if (baselineAccuracy - accuracy >= FATIGUE_ACCURACY_DROP_THRESHOLD) {
      fatigueMinute = minute;
      break;
    }
  }

  return { avgFocusMinutes, fatigueMinute };
}

export function computeBehaviorSignals(attempts: AttemptWithDifficulty[], sessions: Session[]): BehaviorSignalsResult {
  const { avgFocusMinutes, fatigueMinute } = computeFocusAndFatigue(attempts, sessions);
  return {
    avgPaceByDifficulty: computeAvgPaceByDifficulty(attempts),
    fatigueMinute,
    avgFocusMinutes,
    timeOfDayPerformance: computeTimeOfDayPerformance(attempts),
    postMissAccuracy: computePostMissAccuracy(attempts),
    calibrationScore: computeCalibrationScore(attempts),
  };
}
