/**
 * lib/mastery/dashboard.ts
 * Assembles the student dashboard's data (predicted score, readiness
 * panel, top focus skills, streak/daily-goal figures) from real Supabase
 * state, replacing the Phase 1 hardcoded mock in app/page.tsx.
 *
 * Score prediction follows PRD "Score prediction & readiness": predicted =
 * f(sum(p_mastery * weight)) mapped through a curve anchored to
 * practice-test actuals. Practice test recalibration correction factors
 * are calculated based on the latest entry in practice_tests.
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
  fetchPracticeTests,
  type Skill,
} from '../db';
import { fetchMasteryMap } from './index';
import {
  calculateBaseMastery,
  calculateStrategyMultiplier,
  calculateCorrectionFactor,
  calculateSectionScore,
  type SkillMastery,
} from '../scoring/predictive-score';
import { averagePace } from '../scoring/behavior-signals';

const DEFAULT_P_MASTERY = 0.3;
const CONSISTENCY_TARGET_DAYS_PER_WEEK = 4;

export type StudentSetupState = 'no_diagnostic' | 'diagnostic_incomplete' | 'ready';

export interface ReadinessMetric {
  name: string;
  value: string;
  status: 'Excellent' | 'On Track' | 'Warning';
}

export interface FocusSkill {
  id: string;
  section: Skill['section'];
  name: string;
  priority: string;
}

export interface DashboardData {
  setupState: StudentSetupState;
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
  return skill.weight !== null && (skill.section === 'math' || skill.section === 'rw');
}

function isStrategy(skill: Skill): boolean {
  return skill.weight !== null && skill.section === 'strategy';
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
  const [skills, masteryMap, profile, sessions, attempts, behaviorSignals, practiceTests] = await Promise.all([
    fetchSkills(supabase),
    fetchMasteryMap(supabase, userId),
    fetchUserProfile(supabase, userId),
    fetchRecentSessions(supabase, userId, 60),
    fetchRecentAttempts(supabase, userId, 300),
    fetchBehaviorSignals(supabase, userId),
    fetchPracticeTests(supabase, userId),
  ]);

  const displayName = profile?.display_name || 'there';

  if (masteryMap.size === 0) {
    // No mastery data yet — determine how far setup has progressed.
    const setupState: StudentSetupState = sessions.length > 0 ? 'diagnostic_incomplete' : 'no_diagnostic';
    return {
      setupState,
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

  // Split skills into RW, Math, and Strategy
  const mathSkills = skills.filter((s) => isScoreable(s) && s.section === 'math');
  const rwSkills = skills.filter((s) => isScoreable(s) && s.section === 'rw');
  const strategySkills = skills.filter(isStrategy);

  const mathMasteries: SkillMastery[] = mathSkills.map((s) => ({
    skill_id: s.id,
    mastery_level: masteryMap.get(s.id)?.p_mastery ?? DEFAULT_P_MASTERY,
    weight: s.weight as number,
  }));

  const rwMasteries: SkillMastery[] = rwSkills.map((s) => ({
    skill_id: s.id,
    mastery_level: masteryMap.get(s.id)?.p_mastery ?? DEFAULT_P_MASTERY,
    weight: s.weight as number,
  }));

  const strategyMasteries: SkillMastery[] = strategySkills.map((s) => ({
    skill_id: s.id,
    mastery_level: masteryMap.get(s.id)?.p_mastery ?? DEFAULT_P_MASTERY,
    weight: s.weight as number,
  }));

  const mathBaseMastery = calculateBaseMastery(mathMasteries);
  const rwBaseMastery = calculateBaseMastery(rwMasteries);
  const strategyMastery = calculateBaseMastery(strategyMasteries);

  const currentStrategyMultiplier = calculateStrategyMultiplier(strategyMastery);

  // Default correction factors
  let mathCorrectionFactor = 1.0;
  let rwCorrectionFactor = 1.0;
  let bandWidth = 100;

  const scoreableSkills = skills.filter(isScoreable);
  const totalAttemptsAcrossScoreableSkills = scoreableSkills.reduce(
    (sum, s) => sum + (masteryMap.get(s.id)?.attempts_count ?? 0),
    0
  );

  const now = new Date();

  if (practiceTests && practiceTests.length > 0) {
    const latestTest = practiceTests[0];
    const mathMasteryAtTest = latestTest.domain_breakdown?.math_mastery_at_test ?? mathBaseMastery;
    const rwMasteryAtTest = latestTest.domain_breakdown?.rw_mastery_at_test ?? rwBaseMastery;
    const strategyMasteryAtTest = latestTest.domain_breakdown?.strategy_mastery_at_test ?? strategyMastery;

    const mathStrategyMultiplierAtTest = calculateStrategyMultiplier(strategyMasteryAtTest);
    const rwStrategyMultiplierAtTest = calculateStrategyMultiplier(strategyMasteryAtTest);

    mathCorrectionFactor = calculateCorrectionFactor(
      latestTest.math_score,
      mathMasteryAtTest,
      mathStrategyMultiplierAtTest
    );
    rwCorrectionFactor = calculateCorrectionFactor(
      latestTest.rw_score,
      rwMasteryAtTest,
      rwStrategyMultiplierAtTest
    );

    // Band widens with days since the last test to represent decay/increasing uncertainty
    const daysSinceLastTest = Math.max(
      0,
      (now.getTime() - new Date(latestTest.taken_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    bandWidth = Math.max(30, Math.min(150, 40 + daysSinceLastTest * 2.5));
  } else {
    // Attempt-count-driven fallback
    bandWidth = Math.max(40, Math.min(160, 160 - totalAttemptsAcrossScoreableSkills * 1.5));
  }

  // Calculate calibrated final scores
  const mathScore = calculateSectionScore({
    baseMastery: mathBaseMastery,
    strategyMultiplier: currentStrategyMultiplier,
    correctionFactor: mathCorrectionFactor,
  });

  const rwScore = calculateSectionScore({
    baseMastery: rwBaseMastery,
    strategyMultiplier: currentStrategyMultiplier,
    correctionFactor: rwCorrectionFactor,
  });

  const predictedScore = mathScore + rwScore;

  const rawLow = Math.round((predictedScore - bandWidth / 2) / 10) * 10;
  const rawHigh = Math.round((predictedScore + bandWidth / 2) / 10) * 10;
  const confidenceInterval = `${Math.max(400, Math.min(1600, rawLow))} - ${Math.max(400, Math.min(1600, rawHigh))}`;

  // Average content mastery percentage
  const totalContentWeight = scoreableSkills.reduce((acc, s) => acc + (s.weight as number), 0);
  const weightedContentMastery =
    (mathBaseMastery * mathSkills.reduce((acc, s) => acc + (s.weight as number), 0) +
      rwBaseMastery * rwSkills.reduce((acc, s) => acc + (s.weight as number), 0)) /
    totalContentWeight;

  const contentMasteryPercent = Math.round(weightedContentMastery * 100);

  // Top focus skills: highest point-leverage gaps first (weight * (1 - mastery)).
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
      id: skill.id,
      section: skill.section,
      name: skill.name,
      priority: reviewDue ? 'Review Due' : p < 0.4 ? 'High Point Leverage' : 'High Weight',
    }));

  // Timing & pace: prefer the nightly-computed behavior_signals figure;
  // fall back to a live mean over recent timed attempts when no signal row
  // exists yet.
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

  // Calibration: prefer nightly signals, fallback to live calculation
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
      value: `${contentMasteryPercent}%`,
      status: contentMasteryPercent >= 70 ? 'Excellent' : contentMasteryPercent >= 50 ? 'On Track' : 'Warning',
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
    setupState: 'ready',
    displayName,
    predictedScore,
    confidenceInterval,
    contentMasteryPercent,
    streakDays: computeStreakDays(sessions.filter((s) => s.started_at).map((s) => s.started_at as string)),
    minutesToday: Math.round(minutesToday),
    questionsToday,
    readinessMetrics,
    focusSkills,
  };
}
