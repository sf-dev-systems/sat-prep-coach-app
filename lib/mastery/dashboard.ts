/**
 * lib/mastery/dashboard.ts
 * Assembles the student dashboard's data (predicted score, readiness
 * panel, top focus skills, streak/daily-goal figures) from real Supabase
 * state, replacing the Phase 1 hardcoded mock in app/page.tsx.
 *
 * Score prediction follows PRD "Score prediction & readiness": predicted =
 * f(sum(p_mastery * weight)) mapped through a curve anchored to
 * practice-test actuals. No `practice_tests` rows exist yet in v1 (F7's
 * monthly test-entry flow is a later Phase 2/3 item), so the curve here is
 * a straight 400-1600 linear map with no correction factor applied — that
 * anchor hooks in once /tests exists.
 *
 * Readiness's Timing & Pace / Calibration figures now read the real
 * `behavior_signals` row (populated nightly by lib/scoring/nightly.ts, see
 * app/api/cron/behavior-signals/route.ts) when one exists. A brand-new
 * student has no `behavior_signals` row yet — the nightly job only covers
 * users with `sessions` activity in its lookback window, so day one has
 * nothing to read — so both metrics fall back to the same live-computed
 * proxy from `attempts`/`sessions` this file used before the cron existed
 * (degrade-never-block, same pattern as F11's AI ceiling). Consistency has
 * no `behavior_signals` field and stays computed live from `sessions` either way.
 *
 * lib/ boundary rule: imports nothing from app/, components/, next, or react.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchSkills,
  fetchRecentSessions,
  fetchRecentAttempts,
  fetchUserProfile,
  fetchBehaviorSignals,
  type Skill,
} from '../db';
import { fetchMasteryMap } from './index';
import { calculateBaseMastery, type SkillMastery } from '../scoring/predictive-score';
import { averagePace } from '../scoring/behavior-signals';

const DEFAULT_P_MASTERY = 0.3;
const CONSISTENCY_TARGET_DAYS_PER_WEEK = 4;

export interface ReadinessMetric {
  name: string;
  value: string;
  status: 'Excellent' | 'On Track' | 'Warning';
}

export interface FocusSkill {
  section: Skill['section'];
  name: string;
  priority: string;
}

export interface DashboardData {
  hasData: boolean;
  displayName: string;
  predictedScore: number;
  confidenceInterval: string;
  contentMasteryPercent: number;
  streakDays: number;
  minutesToday: number;
  questionsToday: number;
  readinessMetrics: ReadinessMetric[];
  focusSkills: FocusSkill[];
}

function isScoreable(skill: Skill): boolean {
  // Leaf skills carry a non-null weight; domain/section nodes are null.
  // Strategy skills are tracked in mastery but excluded from score
  // prediction (PRD skill-taxonomy note), so only math/rw count here.
  return skill.weight !== null && (skill.section === 'math' || skill.section === 'rw');
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function computeStreakDays(sessionStartTimes: string[]): number {
  const practicedDays = new Set(sessionStartTimes.map(dayKey));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!practicedDays.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function computeDashboardData(supabase: SupabaseClient, userId: string): Promise<DashboardData> {
  const [skills, masteryMap, profile, sessions, attempts, behaviorSignals] = await Promise.all([
    fetchSkills(supabase),
    fetchMasteryMap(supabase, userId),
    fetchUserProfile(supabase, userId),
    fetchRecentSessions(supabase, userId, 60),
    fetchRecentAttempts(supabase, userId, 300),
    fetchBehaviorSignals(supabase, userId),
  ]);

  const displayName = profile?.display_name || 'there';

  if (masteryMap.size === 0) {
    // No attempts logged yet for this student — nothing to score.
    return {
      hasData: false,
      displayName,
      predictedScore: 0,
      confidenceInterval: '',
      contentMasteryPercent: 0,
      streakDays: 0,
      minutesToday: 0,
      questionsToday: 0,
      readinessMetrics: [],
      focusSkills: [],
    };
  }

  const scoreableSkills = skills.filter(isScoreable);

  const skillMasteries: SkillMastery[] = scoreableSkills.map((s) => ({
    skill_id: s.id,
    mastery_level: masteryMap.get(s.id)?.p_mastery ?? DEFAULT_P_MASTERY,
    weight: s.weight as number,
  }));

  const masteryRatio = calculateBaseMastery(skillMasteries); // 0..1
  const predictedScore = Math.round((400 + masteryRatio * 1200) / 10) * 10;

  const totalAttemptsAcrossScoreableSkills = scoreableSkills.reduce(
    (sum, s) => sum + (masteryMap.get(s.id)?.attempts_count ?? 0),
    0
  );
  // Band widens with fewer attempts logged (more uncertainty), narrows as
  // evidence accumulates — no practice-test recalibration exists yet (F7),
  // so this is attempt-count-driven rather than days-since-last-test.
  const bandWidth = Math.max(40, Math.min(160, 160 - totalAttemptsAcrossScoreableSkills * 1.5));
  const confidenceInterval = `${Math.round((predictedScore - bandWidth / 2) / 10) * 10} - ${
    Math.round((predictedScore + bandWidth / 2) / 10) * 10
  }`;

  // Top focus skills: highest point-leverage gaps first (weight * (1 - mastery)).
  // PRD F1 calls this a "top-5 gap list" on the post-diagnostic dashboard;
  // this is the same "Top Focus Skills" card used day-to-day (F2), so the
  // count is raised uniformly to 5 rather than forking a diagnostic-only view.
  const now = new Date();
  const focusSkills: FocusSkill[] = scoreableSkills
    .map((s) => {
      const m = masteryMap.get(s.id);
      const p = m?.p_mastery ?? DEFAULT_P_MASTERY;
      const gap = (s.weight as number) * (1 - p);
      const reviewDue = m?.next_review ? new Date(m.next_review) <= now : false;
      return { skill: s, gap, p, reviewDue };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5)
    .map(({ skill, p, reviewDue }) => ({
      section: skill.section,
      name: skill.name,
      priority: reviewDue ? 'Review Due' : p < 0.4 ? 'High Point Leverage' : 'High Weight',
    }));

  // Timing & pace: prefer the nightly-computed behavior_signals figure;
  // fall back to a live mean over recent timed attempts when no signal row
  // exists yet (new student, or nightly job hasn't run since first activity).
  const signalPace = averagePace(behaviorSignals?.avg_pace_by_difficulty ?? null);
  const timedAttempts = attempts.filter((a) => a.time_spent_seconds != null);
  const provisionalPace = timedAttempts.length
    ? timedAttempts.reduce((sum, a) => sum + (a.time_spent_seconds as number), 0) / timedAttempts.length
    : null;
  const avgSeconds = signalPace ?? provisionalPace;
  const paceValue = avgSeconds ? `${(avgSeconds / 60).toFixed(1)}m/q` : 'No data yet';
  const paceStatus: ReadinessMetric['status'] = avgSeconds == null ? 'Warning' : avgSeconds <= 90 ? 'On Track' : 'Warning';

  // Consistency: distinct days practiced in the last 7 vs. target.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentSessionDays = new Set(
    sessions.filter((s) => s.started_at && new Date(s.started_at) >= sevenDaysAgo).map((s) => dayKey(s.started_at))
  );
  const daysPracticed = recentSessionDays.size;
  const consistencyStatus: ReadinessMetric['status'] =
    daysPracticed >= CONSISTENCY_TARGET_DAYS_PER_WEEK ? 'Excellent' : daysPracticed >= 2 ? 'On Track' : 'Warning';

  // Calibration: prefer the nightly-computed behavior_signals score; fall
  // back to a live computation over recent attempts (% of confidence-tagged
  // attempts where confidence lines up with correctness) when no signal row
  // exists yet.
  let calibrationPercent: number | null =
    behaviorSignals?.calibration_score != null ? Math.round(behaviorSignals.calibration_score * 100) : null;
  if (calibrationPercent == null) {
    const confidenceTagged = attempts.filter((a) => a.confidence != null && a.is_correct != null);
    const calibrated = confidenceTagged.filter(
      (a) =>
        (a.confidence === 'high' && a.is_correct) ||
        (a.confidence === 'low' && !a.is_correct) ||
        a.confidence === 'medium'
    );
    calibrationPercent = confidenceTagged.length ? Math.round((calibrated.length / confidenceTagged.length) * 100) : null;
  }
  const calibrationStatus: ReadinessMetric['status'] =
    calibrationPercent == null ? 'Warning' : calibrationPercent >= 80 ? 'Excellent' : calibrationPercent >= 60 ? 'On Track' : 'Warning';

  const readinessMetrics: ReadinessMetric[] = [
    {
      name: 'Content Mastery',
      value: `${Math.round(masteryRatio * 100)}%`,
      status: masteryRatio >= 0.7 ? 'Excellent' : masteryRatio >= 0.5 ? 'On Track' : 'Warning',
    },
    { name: 'Timing & Pace', value: paceValue, status: paceStatus },
    { name: 'Consistency', value: `${daysPracticed}/${CONSISTENCY_TARGET_DAYS_PER_WEEK} days`, status: consistencyStatus },
    {
      name: 'Calibration',
      value: calibrationPercent == null ? 'No data yet' : `${calibrationPercent}%`,
      status: calibrationStatus,
    },
  ];

  const todayKey = now.toISOString().slice(0, 10);
  const todaysSessions = sessions.filter((s) => s.started_at && dayKey(s.started_at) === todayKey);
  const questionsToday = todaysSessions.reduce((sum, s) => sum + (s.questions_served || 0), 0);
  const minutesToday = todaysSessions.reduce((sum, s) => {
    if (!s.started_at) return sum;
    const end = s.ended_at ? new Date(s.ended_at) : now;
    const mins = (end.getTime() - new Date(s.started_at).getTime()) / 60000;
    return sum + Math.max(0, mins);
  }, 0);

  return {
    hasData: true,
    displayName,
    predictedScore,
    confidenceInterval,
    contentMasteryPercent: Math.round(masteryRatio * 100),
    streakDays: computeStreakDays(sessions.filter((s) => s.started_at).map((s) => s.started_at as string)),
    minutesToday: Math.round(minutesToday),
    questionsToday,
    readinessMetrics,
    focusSkills,
  };
}
