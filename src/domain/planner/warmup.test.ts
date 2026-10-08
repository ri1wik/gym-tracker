import { describe, expect, it } from 'vitest'
import type { WarmupInput } from './contract'
import { EX, equipment } from './fixtures'
import { generalWarmupFor, warmupsFor } from './warmup'

function input(over: Partial<WarmupInput>): WarmupInput {
  return {
    exercise: EX['barbell-bench-press'],
    working_load_g: 100_000,
    working_assist_g: 0,
    working_reps: 6,
    equipment: equipment(),
    second_compound_same_pattern: false,
    first_isolation_for_muscle: true,
    ...over,
  }
}

const rows = (ramps: ReturnType<typeof warmupsFor>) => ramps.map((r) => [r.load_g, r.reps])

describe('ramp sets', () => {
  it('bench 100 kg for 6 to 8 gives bar 20 x10, 50 x5, 70 x3, 85 x1 with rests 45, 45, 60, 60', () => {
    const ramps = warmupsFor(input({}))
    expect(rows(ramps)).toEqual([
      [20_000, 10],
      [50_000, 5],
      [70_000, 3],
      [85_000, 1],
    ])
    expect(ramps.map((r) => r.rest_s)).toEqual([45, 45, 60, 60])
    expect(ramps.map((r) => r.label)).toEqual(['Bar', '50%', '70%', '85%'])
  })

  it('bench 100 kg for 10 reps ends at 70 x3 (no heavy single)', () => {
    expect(rows(warmupsFor(input({ working_reps: 10 })))).toEqual([
      [20_000, 10],
      [50_000, 5],
      [70_000, 3],
    ])
  })

  it('squat 140 kg for 5 gives five ramps ending 130 x1', () => {
    const ramps = warmupsFor(input({ exercise: EX['back-squat'], working_load_g: 140_000, working_reps: 5 }))
    expect(rows(ramps)).toEqual([
      [20_000, 10],
      [70_000, 5],
      [100_000, 3],
      [120_000, 1],
      [130_000, 1],
    ])
  })

  it('bench 52.5 kg gives 20 x10, 32.5 x5, 42.5 x2', () => {
    expect(rows(warmupsFor(input({ working_load_g: 52_500, working_reps: 8 })))).toEqual([
      [20_000, 10],
      [32_500, 5],
      [42_500, 2],
    ])
  })

  it('a barbell under 40 kg gets bar x8 and 70 percent x3', () => {
    expect(rows(warmupsFor(input({ working_load_g: 35_000, working_reps: 8 })))).toEqual([
      [20_000, 8],
      [25_000, 3],
    ])
  })

  it('incline dumbbells 30 kg as the second push gives 20 x3', () => {
    const ramps = warmupsFor(input({ exercise: EX['incline-dumbbell-press'], working_load_g: 30_000, working_reps: 8, second_compound_same_pattern: true }))
    expect(rows(ramps)).toEqual([[20_000, 3]])
  })

  it('incline dumbbells 30 kg as the first push gets 50 percent x8 and 75 percent x3 on the ladder', () => {
    const ramps = warmupsFor(input({ exercise: EX['incline-dumbbell-press'], working_load_g: 30_000, working_reps: 8 }))
    expect(rows(ramps)).toEqual([
      [15_000, 8],
      [22_500, 3],
    ])
  })

  it('light dumbbells get one ramp', () => {
    const ramps = warmupsFor(input({ exercise: EX['incline-dumbbell-press'], working_load_g: 12_500, working_reps: 10 }))
    expect(rows(ramps)).toEqual([[6_000, 8]])
  })

  it('lateral raise 10 kg gives 6 x8 as the first isolation and nothing later', () => {
    const ex = EX['dumbbell-lateral-raise']
    expect(rows(warmupsFor(input({ exercise: ex, working_load_g: 10_000, working_reps: 12 })))).toEqual([[6_000, 8]])
    expect(warmupsFor(input({ exercise: ex, working_load_g: 10_000, working_reps: 12, first_isolation_for_muscle: false }))).toEqual([])
  })

  it('degenerate ramps are dropped: a working load at the bar gives no ramps, a 5 kg machine gives none', () => {
    expect(warmupsFor(input({ working_load_g: 20_000, working_reps: 8 }))).toEqual([])
    expect(warmupsFor(input({ exercise: EX['machine-chest-press'], working_load_g: 5_000, working_reps: 10 }))).toEqual([])
  })

  it('a ramp that rounds onto the previous one is dropped', () => {
    const ramps = warmupsFor(input({ exercise: EX['machine-chest-press'], working_load_g: 15_000, working_reps: 10 }))
    expect(rows(ramps)).toEqual([[10_000, 8]])
    const loads = ramps.map((r) => r.load_g)
    expect(new Set(loads).size).toBe(loads.length)
    for (const l of loads) expect(l).toBeLessThan(15_000)
  })

  it('an EZ bar floors at 10 kg', () => {
    const ramps = warmupsFor(input({ exercise: EX['skull-crusher'], working_load_g: 25_000, working_reps: 10, first_isolation_for_muscle: true }))
    expect(rows(ramps)).toEqual([[15_000, 8]])
    const compoundLike = warmupsFor(input({ exercise: EX['ez-bar-curl'], working_load_g: 30_000, working_reps: 10 }))
    for (const r of compoundLike) expect(r.load_g).toBeGreaterThanOrEqual(10_000)
  })

  it('an assisted pull-up ramp never reduces assistance', () => {
    const ramps = warmupsFor(input({ exercise: EX['assisted-pull-up'], working_load_g: 0, working_assist_g: 20_000, working_reps: 8 }))
    expect(ramps.length).toBe(1)
    for (const r of ramps) expect(r.assist_g).toBeGreaterThanOrEqual(20_000)
    expect(ramps[0].assist_g).toBe(30_000)
  })

  it('timed and plain bodyweight moves get no ramps', () => {
    expect(warmupsFor(input({ exercise: EX['plank'], working_load_g: 0, working_reps: 45 }))).toEqual([])
    expect(warmupsFor(input({ exercise: EX['pull-up'], working_load_g: 0, working_reps: 8 }))).toEqual([])
    expect(rows(warmupsFor(input({ exercise: EX['pull-up'], working_load_g: 10_000, working_reps: 6 })))).toEqual([[0, 5]])
  })
})

describe('general warm-up', () => {
  it('is keyed to the first pattern', () => {
    expect(generalWarmupFor('horizontal_push').drills.map((d) => d.name)).toEqual(['Band pull-aparts', 'Scapular push-ups', 'Band dislocates'])
    expect(generalWarmupFor('vertical_pull').drills[0].name).toBe('Dead hang')
    expect(generalWarmupFor('squat').drills[1].dose).toBe('x6 per side')
    expect(generalWarmupFor('hinge').drills[0].name).toBe('Glute bridges')
    expect(generalWarmupFor('horizontal_push').minutes).toBe(5)
    expect(generalWarmupFor('horizontal_push').cardio).toBe('5 min incline walk, 3 percent, 5 km/h')
  })
})
