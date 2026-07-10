/**
 * Predictive Engine: Mastery Calculation
 * Reference: 00 SYSTEM/docs/SYSTEM_ARCHITECTURE.md
 * Formula: Mb = Σ (Mastery_i * Weight_i)
 */

export interface SkillMastery {
  skill_id: string;
  mastery_level: number; // 0.0 to 1.0
  weight: number;
}

export function calculateBaseMastery(skills: SkillMastery[]): number {
  const weightedSum = skills.reduce((acc, skill) => {
    return acc + (skill.mastery_level * skill.weight);
  }, 0);

  const totalWeight = skills.reduce((acc, skill) => acc + skill.weight, 0);
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function applyStrategyMultiplier(baseMastery: number, strategyMastery: number): number {
  // Strategy acts as a dampener (0.9x) or amplifier (1.1x)
  const multiplier = 0.9 + (strategyMastery * 0.2); 
  return baseMastery * multiplier;
}
