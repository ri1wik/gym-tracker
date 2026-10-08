import { describe, expect, it } from 'vitest'
import { bestBadge, prCount, sessionPrs, type PrSet } from './pr'
import { bodyPartsWorked, setVolumeG, workingSetCount, workoutVolumeG } from './volume'

const EX = {
  bench: { loadType: 'weight' as const, primaryMuscles: ['chest' as const], secondaryMuscles: ['triceps' as const, 'front_delts' as const] },
  pullup: { loadType: 'bodyweight' as const, primaryMuscles: ['lats' as const], secondaryMuscles: ['biceps' as const] },
  assisted_dip: { loadType: 'assisted' as const, primaryMuscles: ['triceps' as const], secondaryMuscles: [] },
  plank: { loadType: 'time' as const, primaryMuscles: ['abs' as const], secondaryMuscles: [] },
}

let n = 0
function set(exercise_id: string, load_g: number, reps: number, extra: Partial<PrSet> = {}): PrSet {
  n += 1
  return { id: `s${n}`, exercise_id, kind: 'working', completed_at: `2026-03-0${(n % 9) + 1}T10:00:00Z`, reps, load_g, assist_g: 0, ...extra }
}

describe('pr: detection', () => {
  const history = [set('bench', 60_000, 10), set('bench', 62_500, 6), set('bench', 55_000, 12)]

  it('heaviest load is the most impressive badge', () => {
    const prs = sessionPrs(history, [set('bench', 65_000, 5)], EX)
    expect(prs[0].kinds).toEqual(['load'])
    expect(prs[0].badge).toBe('load')
  })
  it('most reps at a load needs a prior set at that load', () => {
    const prs = sessionPrs(history, [set('bench', 60_000, 11)], EX)
    // 11 reps sits above the Epley range, so no e1RM record can ride along.
    expect(prs[0].kinds).toEqual(['reps_at_load'])
    expect(prs[0].badge).toBe('reps_at_load')
    const none = sessionPrs(history, [set('bench', 61_000, 6)], EX)
    expect(none[0].kinds).toEqual([])
    expect(none[0].badge).toBeNull()
  })
  it('best e1RM and best set volume are badges of their own', () => {
    // 62.5 x 5: no new load, fewer reps at that load, 72.9 kg e1RM under the 80 kg best, 312.5 kg volume under 660: nothing.
    const nothing = sessionPrs(history, [set('bench', 62_500, 5)], EX)
    expect(nothing[0].kinds).toEqual([])
    // 61 x 10: a load never seen, 81.3 kg e1RM over 80, volume 610 under 660: e1RM alone.
    const e1rm = sessionPrs(history, [set('bench', 61_000, 10)], EX)
    expect(e1rm[0].kinds).toEqual(['e1rm'])
    expect(e1rm[0].badge).toBe('e1rm')
    const volume = sessionPrs(history, [set('bench', 55_000, 13)], EX)
    expect(volume[0].kinds).toEqual(['reps_at_load', 'volume'])
    expect(volume[0].badge).toBe('reps_at_load')
  })
  it('one badge per set, the most impressive, and an earlier set in the session counts as history', () => {
    const prs = sessionPrs(history, [set('bench', 65_000, 8), set('bench', 65_000, 9), set('bench', 65_000, 9)], EX)
    expect(prs.map((p) => p.badge)).toEqual(['load', 'reps_at_load', null])
    expect(prCount(prs)).toBe(2)
  })
  it('first-time records carry no badge', () => {
    const prs = sessionPrs([], [set('bench', 40_000, 10), set('bench', 42_500, 8)], EX)
    expect(prs[0].first_time).toBe(true)
    expect(prs[0].badge).toBeNull()
    expect(prs[1].first_time).toBe(false)
    expect(prs[1].badge).toBe('load')
  })
  it('warm-ups never count, as history or as candidates', () => {
    const warm = set('bench', 85_000, 1, { kind: 'warmup' })
    const prs = sessionPrs([...history, warm], [set('bench', 70_000, 3), set('bench', 90_000, 1, { kind: 'warmup' })], EX)
    expect(prs).toHaveLength(1)
    expect(prs[0].badge).toBe('load')
  })
  it('bodyweight moves use the day body weight for e1RM and volume', () => {
    const prev = [set('pullup', 0, 8, { body_weight_g: 80_000 })]
    const prs = sessionPrs(prev, [set('pullup', 0, 9, { body_weight_g: 79_000 })], EX)
    expect(prs[0].kinds).toEqual(['reps_at_load', 'e1rm', 'volume'])
    expect(prs[0].e1rm_g).toBe(Math.round(79_000 * (1 + 9 / 30)))
  })
  it('assisted moves earn load and reps records but never an e1RM', () => {
    const prev = [set('assisted_dip', 0, 8, { assist_g: 20_000, body_weight_g: 80_000 })]
    const prs = sessionPrs(prev, [set('assisted_dip', 0, 10, { assist_g: 20_000, body_weight_g: 80_000 })], EX)
    expect(prs[0].e1rm_g).toBeNull()
    expect(prs[0].kinds).toContain('reps_at_load')
    expect(prs[0].kinds).not.toContain('e1rm')
  })
  it('bestBadge follows load, reps, e1RM, volume', () => {
    expect(bestBadge(['volume', 'e1rm'])).toBe('e1rm')
    expect(bestBadge(['volume', 'load'])).toBe('load')
    expect(bestBadge([])).toBeNull()
  })
})

describe('volume', () => {
  it('set volume by load type', () => {
    expect(setVolumeG(set('bench', 60_000, 10), 'weight')).toBe(600_000)
    expect(setVolumeG(set('pullup', 5_000, 8), 'bodyweight', 80_000)).toBe(680_000)
    expect(setVolumeG(set('pullup', 5_000, 8), 'bodyweight', null)).toBeNull()
    expect(setVolumeG(set('assisted_dip', 0, 8, { assist_g: 20_000 }), 'assisted', 80_000)).toBe(480_000)
    expect(setVolumeG(set('plank', 0, 45), 'time')).toBeNull()
    expect(setVolumeG(set('bench', 60_000, 10, { kind: 'warmup' }), 'weight')).toBeNull()
    expect(setVolumeG(set('bench', 60_000, 10, { completed_at: null }), 'weight')).toBeNull()
  })
  it('workout volume sums the countable sets and skips unknown exercises', () => {
    const sets = [set('bench', 60_000, 10), set('bench', 60_000, 10, { kind: 'warmup' }), set('ghost', 10_000, 10), set('pullup', 0, 8)]
    expect(workoutVolumeG(sets, EX, 80_000)).toBe(600_000 + 640_000)
    expect(workingSetCount(sets)).toBe(3)
  })
  it('body parts worked need a full set of credit', () => {
    const sets = [set('bench', 60_000, 10), set('pullup', 0, 8)]
    expect(bodyPartsWorked(sets, EX)).toEqual(['chest', 'back'])
    expect(bodyPartsWorked([set('bench', 60_000, 10)], EX)).toEqual(['chest'])
  })
})
