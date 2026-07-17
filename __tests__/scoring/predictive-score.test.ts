import { describe, it, expect } from 'vitest'
import {
  calculateBaseMastery,
  calculateStrategyMultiplier,
  calculateSectionScore,
  calculateCorrectionFactor,
  type SkillMastery,
} from '../../lib/scoring/predictive-score'

// Scenario 1 from v1.5 PRD Section 10:
// Math: weighted mastery ~0.55 across algebra/geometry mix
// RW:   weighted mastery ~0.62
// Strategy mastery: 0.70  →  μ_strategy = 0.90 + 0.15*0.70 = 1.005
// No practice test → correction factors default to 1.0
// Math score = max(200, min(800, round(200 + 600*0.55*1.005, -1))) = 530
// RW score   = max(200, min(800, round(200 + 600*0.62*1.005, -1))) = 570  (≈ 570–580 range)
// Composite ≈ 1100

describe('calculateBaseMastery', () => {
  it('computes weighted average correctly', () => {
    const skills: SkillMastery[] = [
      { skill_id: 'a', mastery_level: 0.6, weight: 10 },
      { skill_id: 'b', mastery_level: 0.4, weight: 10 },
    ]
    expect(calculateBaseMastery(skills)).toBeCloseTo(0.5)
  })

  it('returns 0 for empty skill list', () => {
    expect(calculateBaseMastery([])).toBe(0)
  })
})

describe('calculateStrategyMultiplier', () => {
  it('returns 0.90 when strategy mastery is 0', () => {
    expect(calculateStrategyMultiplier(0)).toBeCloseTo(0.9)
  })

  it('returns 1.05 when strategy mastery is 1.0', () => {
    expect(calculateStrategyMultiplier(1.0)).toBeCloseTo(1.05)
  })
})

describe('calculateCorrectionFactor', () => {
  it('returns 1.0 when denominator is zero', () => {
    expect(calculateCorrectionFactor(500, 0, 1.0)).toBe(1.0)
  })

  it('clamps to [0.5, 1.5]', () => {
    // Extremely high actual score relative to mastery → would exceed 1.5
    expect(calculateCorrectionFactor(800, 0.01, 1.0)).toBe(1.5)
    // Extremely low actual score → would be below 0.5
    expect(calculateCorrectionFactor(200, 0.99, 1.0)).toBe(0.5)
  })
})

describe('calculateSectionScore — Scenario 1 (no practice test)', () => {
  it('Math section produces a score in reasonable range for 0.55 mastery', () => {
    const score = calculateSectionScore({
      baseMastery: 0.55,
      strategyMultiplier: 1.005,
      correctionFactor: 1.0,
    })
    expect(score).toBeGreaterThanOrEqual(200)
    expect(score).toBeLessThanOrEqual(800)
    // 200 + 600*0.55*1.005 ≈ 531.65 → rounds to 530
    expect(score).toBe(530)
  })

  it('RW section produces a score in reasonable range for 0.62 mastery', () => {
    const score = calculateSectionScore({
      baseMastery: 0.62,
      strategyMultiplier: 1.005,
      correctionFactor: 1.0,
    })
    expect(score).toBeGreaterThanOrEqual(200)
    expect(score).toBeLessThanOrEqual(800)
    // 200 + 600*0.62*1.005 ≈ 573.86 → rounds to 570
    expect(score).toBe(570)
  })

  it('section score is always between 200 and 800', () => {
    for (const mastery of [0, 0.1, 0.5, 0.9, 1.0]) {
      const score = calculateSectionScore({ baseMastery: mastery })
      expect(score).toBeGreaterThanOrEqual(200)
      expect(score).toBeLessThanOrEqual(800)
    }
  })
})
