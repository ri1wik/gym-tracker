import { describe, expect, it } from 'vitest'
import {
  bmrKcal,
  calorieTarget,
  expectedWeeklyChangeG,
  proteinTargetG,
  tdeeKcal,
  type Body,
} from './targets'

// Worked example pinned by the plan (exact computed values, not prose roundings).
const owner: Body = { sex: 'male', ageYears: 30, heightMm: 1780, weightG: 80_000 }

describe('targets: worked example', () => {
  it('BMR by Mifflin-St Jeor is 1767.5', () => {
    expect(bmrKcal(owner)).toBeCloseTo(1767.5, 5)
  })
  it('maintenance at moderate activity is about 2740', () => {
    expect(tdeeKcal(owner, 'moderate')).toBeCloseTo(2739.625, 3)
  })
  it('recomp target is 2329 before rounding and 2350 after', () => {
    const t = calorieTarget(owner, 'moderate', 'recomp', 'intermediate')
    expect(t.raw).toBeCloseTo(2328.68, 1)
    expect(t.target).toBe(2350)
    expect(t.floored).toBe(false)
  })
  it('protein at 2.0 g per kg is 160 g', () => {
    expect(proteinTargetG(owner)).toBe(160)
  })
  it('expected loss at a 411 kcal daily gap is about 0.37 kg per week', () => {
    expect(expectedWeeklyChangeG(-411)).toBe(-374)
  })
})

describe('targets: other branches', () => {
  const female: Body = { sex: 'female', ageYears: 28, heightMm: 1620, weightG: 58_000 }
  it('female formula subtracts 161', () => {
    expect(bmrKcal(female)).toBeCloseTo(10 * 58 + 6.25 * 162 - 5 * 28 - 161, 5)
  })
  it('unspecified sex averages the two formulas', () => {
    const u: Body = { ...owner, sex: 'unspecified' }
    expect(bmrKcal(u)).toBeCloseTo(bmrKcal(owner) - 83, 5)
  })
  it('lean gain is a surplus', () => {
    const t = calorieTarget(owner, 'moderate', 'lean_gain', 'intermediate')
    expect(t.target).toBeGreaterThan(t.tdee)
  })
  it('advanced recomp uses the small deficit', () => {
    const a = calorieTarget(owner, 'moderate', 'recomp', 'advanced')
    const i = calorieTarget(owner, 'moderate', 'recomp', 'intermediate')
    expect(a.target).toBeGreaterThan(i.target)
  })
  it('the floor holds for a small sedentary person on fat loss', () => {
    const small: Body = { sex: 'female', ageYears: 45, heightMm: 1500, weightG: 45_000 }
    const t = calorieTarget(small, 'sedentary', 'fat_loss', 'beginner')
    expect(t.target).toBeGreaterThanOrEqual(1200)
    expect(t.floored).toBe(true)
  })
  it('protein is computed on the BMI 30 weight for a heavier person', () => {
    const heavy: Body = { sex: 'male', ageYears: 35, heightMm: 1700, weightG: 110_000 }
    // 30 * 1.7^2 = 86.7 kg, times 2.0 = 173 g, not 220 g
    expect(proteinTargetG(heavy)).toBe(173)
  })
  it('protein per kg is clamped to the allowed range', () => {
    expect(proteinTargetG(owner, 3.5)).toBe(192)
    expect(proteinTargetG(owner, 1.0)).toBe(128)
  })
})
