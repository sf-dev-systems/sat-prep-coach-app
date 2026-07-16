/**
 * Predictive Engine: Mastery Calculation and Score Calibration
 * Reference: 00 SYSTEM/docs/SYSTEM_ARCHITECTURE.md
 * Formulas:
 *   Mb = Σ (Mastery_i * Weight_i) / Σ Weight_i
 *   μ_strategy = 0.90 + 0.15 * M_strat
 *   S_section, adjusted = max(200, min(800, 200 + (600 * Mb * μ_strategy)))
 *   C_section = (A_section - 200) / (600 * M_section, actual)
 *   S_section, recalibrated = max(200, min(800, 200 + (600 * Mb * μ_strategy * C_section)))
 */

export interface SkillMastery {
  skill_id: string;
  mastery_level: number; // 0.0 to 1.0
  weight: number;
}

/**
 * Calculates base weighted mastery for a given set of leaf skills.
 */
export function calculateBaseMastery(skills: SkillMastery[]): number {
  const weightedSum = skills.reduce((acc, skill) => {
    return acc + (skill.mastery_level * skill.weight);
  }, 0);

  const totalWeight = skills.reduce((acc, skill) => acc + skill.weight, 0);
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Strategy acts as a dampener (0.9x) or amplifier (up to 1.05x) based on strategy skills mastery.
 * μ_strategy = 0.90 + 0.15 * M_strat
 */
export function calculateStrategyMultiplier(strategyMastery: number): number {
  return 0.90 + (strategyMastery * 0.15);
}

/**
 * Calculates the correction factor (recalibration scale factor) C_section based on an official practice test.
 * C_section = (A_section - 200) / (600 * M_section, actual * μ_strategy, actual)
 * Note: We default to 1.0 if there's no actual test, or if base mastery is 0 to avoid division by zero.
 */
export function calculateCorrectionFactor(
  actualScore: number,
  baseMasteryAtTest: number,
  strategyMultiplierAtTest = 1.0
): number {
  const denominator = 600 * baseMasteryAtTest * strategyMultiplierAtTest;
  if (denominator <= 0) return 1.0;
  
  const factor = (actualScore - 200) / denominator;
  // Clamp correction factor to reasonable bounds [0.5, 1.5] to prevent anomalous jumps
  return Math.max(0.5, Math.min(1.5, factor));
}

/**
 * Calculates final adjusted and calibrated section score (Math or RW), bounded between [200, 800].
 */
export function calculateSectionScore({
  baseMastery,
  strategyMultiplier = 1.0,
  correctionFactor = 1.0
}: {
  baseMastery: number;
  strategyMultiplier?: number;
  correctionFactor?: number;
}): number {
  const rawScore = 200 + (600 * baseMastery * strategyMultiplier * correctionFactor);
  const rounded = Math.round(rawScore / 10) * 10;
  return Math.max(200, Math.min(800, rounded));
}
