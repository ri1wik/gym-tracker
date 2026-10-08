import { describe, expect, it } from 'vitest'
import {
  bannedPhraseIn,
  clampDeficit,
  clampRateTarget,
  copyProblems,
  daysUnderFloor,
  guardCalorieTarget,
  loggingCheckNeeded,
} from './guardrails'
import { stableHash, stableStringify } from './hash'

describe('guardrails: copy', () => {
  it('finds banned phrases and condition names whatever the case', () => {
    expect(bannedPhraseIn('This Burns Fat fast.')).toBe('burns fat')
    expect(bannedPhraseIn('A detox week.')).toBe('detox')
    expect(bannedPhraseIn('Good for Diabetes.')).toBe('diabetes')
    expect(bannedPhraseIn('Protein hit 5 of 6 days.')).toBeNull()
  })
  it('does not match inside another word', () => {
    expect(bannedPhraseIn('The negatives of a set.')).toBeNull()
    expect(bannedPhraseIn('A negative number.')).toBe('negative')
  })
  it('lists every problem with a message', () => {
    const reasons = copyProblems('Great work!', true).map((p) => p.reason)
    expect(reasons).toContain('exclamation mark on an attention item')
    expect(reasons).toContain('names no number')
    expect(copyProblems('Great work!', false).map((p) => p.reason)).not.toContain('exclamation mark on an attention item')
    expect(copyProblems('4 of 4 sessions', false).map((p) => p.reason)).toEqual(['does not end in a full stop'])
    expect(copyProblems('4 of 4 sessions.', true)).toEqual([])
  })
})

describe('guardrails: numbers', () => {
  it('the rate target never exceeds 1 percent per week either way', () => {
    expect(clampRateTarget(-1.4)).toBe(-1)
    expect(clampRateTarget(-0.5)).toBe(-0.5)
    expect(clampRateTarget(1.2)).toBe(1)
  })
  it('the deficit never exceeds 25 percent; a surplus passes', () => {
    expect(clampDeficit(0.3)).toBe(0.25)
    expect(clampDeficit(0.15)).toBe(0.15)
    expect(clampDeficit(-0.1)).toBe(-0.1)
  })
  it('a calorie target is floored at the larger of BMR and the sex floor', () => {
    const female = { sex: 'female' as const, ageYears: 30, heightMm: 1650, weightG: 60_000 }
    expect(guardCalorieTarget(1100, female)).toEqual({ target: 1320.25, floored: true })
    expect(guardCalorieTarget(1800, female)).toEqual({ target: 1800, floored: false })
    const male = { sex: 'male' as const, ageYears: 30, heightMm: 1780, weightG: 80_000 }
    expect(guardCalorieTarget(1400, male)).toEqual({ target: 1767.5, floored: true })
  })
  it('three or more logged days under the floor need a logging check', () => {
    const days = { '2026-03-23': 1200, '2026-03-24': 1900, '2026-03-25': 1100, '2026-03-26': 1300, '2026-03-27': 0 }
    expect(daysUnderFloor(days, 1500)).toEqual(['2026-03-23', '2026-03-25', '2026-03-26'])
    expect(loggingCheckNeeded(days, 1500)).toBe(true)
    expect(loggingCheckNeeded({ '2026-03-23': 1200, '2026-03-24': 1100 }, 1500)).toBe(false)
  })
})

describe('hash', () => {
  it('sorts keys and drops undefined so equal content hashes equal', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe('{"a":[1,{"d":2}],"b":1}')
    expect(stableHash({ b: 1, a: 2 })).toBe(stableHash({ a: 2, b: 1 }))
    expect(stableHash({ a: 2 })).not.toBe(stableHash({ a: 3 }))
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]))
  })
})
