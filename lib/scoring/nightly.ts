/**
 * lib/scoring/nightly.ts
 * Orchestrator for PRD F4's nightly job: recompute behavior_signals and
 * refresh next_review ("forgetting decay") across all skills, for every
 * user with recent activity.
 *
 * PLACEMENT DECISION (flagged per CLAUDE.md working rules, not silently
 * picked): this lives in lib/scoring/ rather than lib/sessions/ because the
 * PRD's own folder-layout comment assigns "prediction, readiness,
 * recalibration" to lib/scoring/ and "session assembler, behavior-signal
 * *rules*" to lib/sessions/ — read as: lib/sessions/index.ts's
 * estimateSessionBudget already *reads* behavior_signals into
 * session-planning rules, while lib/scoring is where cross-cutting
 * recomputation/scoring jobs (like this one, and predictive-score.ts)
 * belong. The route handler (app/api/cron/behavior-signals/route.ts) stays
 * a thin wrapper around this module, mirroring how app/session/page.tsx and
 * app/diagnostic/page.tsx are thin wrappers around lib/sessions.
 *
 * lib/ boundary rule: imports nothing from app/, components/, next, or react.
 * DB access only via lib/db.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { fetchActiveUserIds, fetchAttemptsSince, fetchSessionsSince, upsertBehaviorSignals } from '../db';
import { computeBehaviorSignals } from './behavior-signals';
import { refreshMasteryDecayForUser } from '../mastery';

// Wide enough to give every signal (especially post_miss_accuracy and
// time_of_day_performance, which both need volume) a real sample size,
// without querying unbounded history every night.
const LOOKBACK_DAYS = 30;

export interface NightlyJobResult {
  usersProcessed: number;
  usersFailed: number;
  masteryRowsDecayed: number;
  errors: { userId: string; message: string }[];
}

/**
 * PRD F4: "Nightly job: recompute behavior_signals ...; refresh next_review
 * across all skills." Degrade-never-block (same pattern as F11's AI
 * ceiling): one user's failure is caught, logged, and skipped — it never
 * aborts the run for every other user.
 */
export async function runNightlyBehaviorSignalsJob(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<NightlyJobResult> {
  const sinceIso = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const userIds = await fetchActiveUserIds(supabase, sinceIso);

  let usersProcessed = 0;
  let usersFailed = 0;
  let masteryRowsDecayed = 0;
  const errors: { userId: string; message: string }[] = [];

  for (const userId of userIds) {
    try {
      const [attempts, sessions] = await Promise.all([
        fetchAttemptsSince(supabase, userId, sinceIso),
        fetchSessionsSince(supabase, userId, sinceIso),
      ]);

      const signals = computeBehaviorSignals(attempts, sessions);

      await upsertBehaviorSignals(supabase, {
        user_id: userId,
        avg_pace_by_difficulty: signals.avgPaceByDifficulty,
        fatigue_minute: signals.fatigueMinute,
        avg_focus_minutes: signals.avgFocusMinutes,
        time_of_day_performance: signals.timeOfDayPerformance,
        post_miss_accuracy: signals.postMissAccuracy,
        calibration_score: signals.calibrationScore,
      });

      masteryRowsDecayed += await refreshMasteryDecayForUser(supabase, userId, now);
      usersProcessed += 1;
    } catch (err) {
      usersFailed += 1;
      errors.push({ userId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { usersProcessed, usersFailed, masteryRowsDecayed, errors };
}
