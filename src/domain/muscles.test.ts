import { describe, expect, it } from 'vitest'
import { BODY_PARTS, MUSCLES, MUSCLE_GROUPS } from './types'
import {
  MUSCLE_INFO,
  NO_CREDIT_MUSCLES,
  musclesOfBodyPart,
  setCreditByBodyPart,
  setCreditByMuscle,
  weeklySetsByBodyPart,
  weeklySetsByGroup,
  type CountableSet,
} from './muscles'

const EX = {
  'barbell-row': { primaryMuscles: ['upper_back', 'lats'], secondaryMuscles: ['rear_delts', 'biceps'] },
  'barbell-bench-press': { primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'] },
  deadlift: { primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['lower_back', 'upper_back'] },
  'pec-deck': { primaryMuscles: ['chest'], secondaryMuscles: ['front_delts'] },
  'overhead-press': { primaryMuscles: ['front_delts'], secondaryMuscles: ['triceps', 'side_delts'] },
  'three-secondaries': { primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'adductors', 'hamstrings'] },
} as const

function working(exercise_id: string, n: number): CountableSet[] {
  return Array.from({ length: n }, () => ({ exercise_id, kind: 'working' as const, completed_at: '2026-10-05T10:00:00Z' }))
}

describe('muscle table', () => {
  it('has 22 muscles, 14 groups and 11 body parts', () => {
    expect(MUSCLES).toHaveLength(22)
    expect(MUSCLE_GROUPS).toHaveLength(14)
    expect(BODY_PARTS).toHaveLength(11)
    expect(Object.keys(MUSCLE_INFO).sort()).toEqual([...MUSCLES].sort())
  })
  it('every group and body part has at least one muscle', () => {
    for (const p of BODY_PARTS) expect(musclesOfBodyPart(p).length).toBeGreaterThan(0)
    for (const g of MUSCLE_GROUPS) expect(MUSCLES.some((m) => MUSCLE_INFO[m].group === g)).toBe(true)
  })
  it('exactly the five named muscles earn no credit', () => {
    expect([...NO_CREDIT_MUSCLES].sort()).toEqual(['front_delts', 'hip_flexors', 'lower_back', 'rotator_cuff', 'tibialis'])
  })
})

describe('set credit', () => {
  it('1.0 per primary and 0.5 per secondary', () => {
    expect(setCreditByMuscle(EX['barbell-row'])).toEqual({ upper_back: 1, lats: 1, rear_delts: 0.5, biceps: 0.5 })
  })
  it('caps secondaries at two', () => {
    expect(setCreditByMuscle(EX['three-secondaries'])).toEqual({ quads: 1, glutes: 0.5, adductors: 0.5 })
  })
  it('drops no-credit muscles', () => {
    expect(setCreditByMuscle(EX.deadlift)).toEqual({ hamstrings: 1, glutes: 1, upper_back: 0.5 })
    expect(setCreditByMuscle(EX['overhead-press'])).toEqual({ triceps: 0.5, side_delts: 0.5 })
  })
  it('a body part takes the max over its muscles, never the sum', () => {
    expect(setCreditByBodyPart(EX['barbell-row'])).toEqual({ back: 1, shoulders: 0.5, biceps: 0.5 })
  })
})

describe('weeklySetsByBodyPart', () => {
  it('the double-count trap: 4 barbell rows give back 4, not 8', () => {
    const totals = weeklySetsByBodyPart(working('barbell-row', 4), EX)
    expect(totals.back).toBe(4)
    expect(totals.shoulders).toBe(2)
    expect(totals.biceps).toBe(2)
    expect(totals.chest).toBe(0)
  })
  it('excludes warm-ups and uncompleted sets', () => {
    const sets: CountableSet[] = [
      { exercise_id: 'barbell-bench-press', kind: 'warmup', completed_at: '2026-10-05T10:00:00Z' },
      { exercise_id: 'barbell-bench-press', kind: 'warmup', completed_at: '2026-10-05T10:01:00Z' },
      { exercise_id: 'barbell-bench-press', kind: 'working', completed_at: null },
      ...working('barbell-bench-press', 3),
    ]
    expect(weeklySetsByBodyPart(sets, EX).chest).toBe(3)
  })
  it('front delts never credit shoulders; the overhead press credits shoulders through side delts only', () => {
    const t = weeklySetsByBodyPart(working('overhead-press', 4), EX)
    expect(t.shoulders).toBe(2)
    expect(t.triceps).toBe(2)
  })
  it('a deadlift credits back only 0.5 through upper back, never through lower back', () => {
    const t = weeklySetsByBodyPart(working('deadlift', 2), EX)
    expect(t.back).toBe(1)
    expect(t.hamstrings).toBe(2)
    expect(t.glutes).toBe(2)
  })
  it('skips sets whose exercise is unknown and returns every body part', () => {
    const t = weeklySetsByBodyPart(working('ghost', 3), EX)
    expect(Object.keys(t).sort()).toEqual([...BODY_PARTS].sort())
    expect(Object.values(t).every((v) => v === 0)).toBe(true)
  })
})

describe('weeklySetsByGroup', () => {
  it('counts front delts at the group level but not lower back', () => {
    const t = weeklySetsByGroup([...working('overhead-press', 2), ...working('deadlift', 2)], EX)
    expect(t.front_delts).toBe(2)
    expect(t.upper_back).toBe(1)
    expect(t.hamstrings).toBe(2)
    expect(t.chest).toBe(0)
  })
})
