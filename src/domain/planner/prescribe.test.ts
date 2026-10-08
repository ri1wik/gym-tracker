import { describe, expect, it } from 'vitest'
import { prescribe } from './prescribe'
import type { PrescribeInput } from './contract'
import { EX, equipment, session } from './fixtures'

function input(over: Partial<PrescribeInput>): PrescribeInput {
  return {
    exercise: EX['barbell-bench-press'],
    history: [],
    sets: 3,
    rep_min: 6,
    rep_max: 8,
    equipment: equipment(),
    deload: false,
    first_session_back: false,
    intent: 'normal',
    ...over,
  }
}

describe('double progression', () => {
  it('3 x 80 at [8, 8, 8] in 6 to 8 gives 82.5 with the suggested label', () => {
    const p = prescribe(input({ history: session('barbell-bench-press', '2026-10-05', 80_000, [8, 8, 8]) }))
    expect(p.target_load_g).toBe(82_500)
    expect(p.target_reps).toEqual([6, 6, 6])
    expect(p.load_source).toBe('history')
    expect(p.suggested_increase).toBe(true)
    expect(p.failure_count).toBe(0)
    expect(p.note).toBe('Every set hit 8: up 2.5 kg')
    expect(p.last_time).toEqual({ load_g: 80_000, reps: 8, date_key: '2026-10-05' })
  })

  it('[8, 7, 6] holds 80 and aims 8 on set 2', () => {
    const p = prescribe(input({ history: session('barbell-bench-press', '2026-10-05', 80_000, [8, 7, 6]) }))
    expect(p.target_load_g).toBe(80_000)
    expect(p.target_reps).toEqual([8, 8, 6])
    expect(p.suggested_increase).toBe(false)
    expect(p.note).toBe('Set 2 fell short of 8: same load, aim 8')
  })

  it('[5, 5, 4] twice drops 10 percent to 72.5 and resets the counter', () => {
    const history = [
      ...session('barbell-bench-press', '2026-10-01', 80_000, [5, 5, 4]),
      ...session('barbell-bench-press', '2026-10-05', 80_000, [5, 5, 4]),
    ]
    const p = prescribe(input({ history }))
    expect(p.target_load_g).toBe(72_500)
    expect(p.target_reps).toEqual([6, 6, 6])
    expect(p.failure_count).toBe(0)
  })

  it('one short session only counts a failure and holds the load', () => {
    const p = prescribe(input({ history: session('barbell-bench-press', '2026-10-05', 80_000, [5, 5, 4]) }))
    expect(p.target_load_g).toBe(80_000)
    expect(p.failure_count).toBe(1)
    expect(p.target_reps).toEqual([6, 6, 6])
  })

  it('a failure at a different load does not carry into the streak', () => {
    const history = [
      ...session('barbell-bench-press', '2026-10-01', 77_500, [5, 5, 4]),
      ...session('barbell-bench-press', '2026-10-05', 80_000, [5, 5, 4]),
    ]
    const p = prescribe(input({ history }))
    expect(p.target_load_g).toBe(80_000)
    expect(p.failure_count).toBe(1)
  })

  it('dumbbell 12.5 at the top stays with target hi + 2, then jumps to 15', () => {
    const ex = EX['incline-dumbbell-press']
    const first = prescribe(input({ exercise: ex, rep_min: 8, rep_max: 12, history: session(ex.id, '2026-10-05', 12_500, [12, 12, 12]) }))
    expect(first.target_load_g).toBe(12_500)
    expect(first.target_reps).toEqual([14, 14, 14])
    expect(first.suggested_increase).toBe(false)
    const second = prescribe(input({ exercise: ex, rep_min: 8, rep_max: 12, history: session(ex.id, '2026-10-07', 12_500, [14, 14, 14]) }))
    expect(second.target_load_g).toBe(15_000)
    expect(second.target_reps).toEqual([8, 8, 8])
    expect(second.suggested_increase).toBe(true)
  })

  it('machine 60 kg with a 5 kg step gives 65', () => {
    const ex = EX['machine-chest-press']
    const p = prescribe(input({ exercise: ex, rep_min: 8, rep_max: 12, history: session(ex.id, '2026-10-05', 60_000, [12, 12, 12]) }))
    expect(p.target_load_g).toBe(65_000)
  })

  it('a custom stack step is honoured', () => {
    const ex = EX['machine-chest-press']
    const eq = equipment({ stack_step_g: { 'machine-chest-press': 2500 } })
    const p = prescribe(input({ exercise: ex, equipment: eq, rep_min: 8, rep_max: 12, history: session(ex.id, '2026-10-05', 60_000, [12, 12, 12]) }))
    expect(p.target_load_g).toBe(62_500)
  })

  it('squat above 80 kg steps by 5 kg', () => {
    const ex = EX['back-squat']
    const p = prescribe(input({ exercise: ex, rep_min: 5, rep_max: 8, history: session(ex.id, '2026-10-05', 100_000, [8, 8, 8]) }))
    expect(p.target_load_g).toBe(105_000)
  })

  it('a regression that rounds back to the same load cuts the rep target instead of looping', () => {
    const ex = EX['ez-bar-curl']
    const history = [...session(ex.id, '2026-10-01', 10_000, [7, 6, 5]), ...session(ex.id, '2026-10-05', 10_000, [7, 6, 5])]
    const p = prescribe(input({ exercise: ex, rep_min: 8, rep_max: 12, history }))
    expect(p.target_load_g).toBe(10_000)
    expect(p.target_reps).toEqual([6, 6, 6])
    expect(p.failure_count).toBe(0)
  })

  it('assistance is its own positive axis: progression removes a step, regression adds one', () => {
    const ex = EX['assisted-pull-up']
    const up = prescribe(input({ exercise: ex, rep_min: 6, rep_max: 10, history: session(ex.id, '2026-10-05', 0, [10, 10, 10], { assist_g: 20_000 }) }))
    expect(up.assist_g).toBe(15_000)
    expect(up.target_load_g).toBe(0)
    const history = [
      ...session(ex.id, '2026-10-01', 0, [5, 5, 4], { assist_g: 20_000 }),
      ...session(ex.id, '2026-10-05', 0, [5, 5, 4], { assist_g: 20_000 }),
    ]
    const down = prescribe(input({ exercise: ex, rep_min: 6, rep_max: 10, history }))
    expect(down.assist_g).toBe(25_000)
  })

  it('deload halves the sets at the same load with no progression', () => {
    const p = prescribe(input({ sets: 4, deload: true, history: session('barbell-bench-press', '2026-10-05', 80_000, [8, 8, 8, 8]) }))
    expect(p.target_load_g).toBe(80_000)
    expect(p.target_reps).toEqual([6, 6])
    expect(p.suggested_increase).toBe(false)
  })

  it('first session back takes 5 percent off, rounded to plates', () => {
    const p = prescribe(input({ first_session_back: true, history: session('barbell-bench-press', '2026-09-20', 80_000, [8, 8, 8]) }))
    expect(p.target_load_g).toBe(75_000)
    expect(p.suggested_increase).toBe(false)
  })

  it('light intent keeps the load and aims the bottom of the range', () => {
    const p = prescribe(input({ intent: 'light', history: session('barbell-bench-press', '2026-10-05', 80_000, [8, 8, 8]) }))
    expect(p.target_load_g).toBe(80_000)
    expect(p.target_reps).toEqual([6, 6, 6])
  })

  it('no history gives the ramp source with a null load', () => {
    const p = prescribe(input({}))
    expect(p.target_load_g).toBeNull()
    expect(p.load_source).toBe('ramp')
    expect(p.target_reps).toEqual([6, 6, 6])
    expect(p.last_time).toBeNull()
  })

  it('warm-up rows in the history are ignored', () => {
    const working = session('barbell-bench-press', '2026-10-05', 80_000, [8, 8, 8])
    const warm = session('barbell-bench-press', '2026-10-05', 20_000, [10], { workout_id: working[0].workout_id }).map((s) => ({ ...s, kind: 'warmup' as const }))
    const p = prescribe(input({ history: [...warm, ...working] }))
    expect(p.target_load_g).toBe(82_500)
  })

  it('is deterministic whatever the input order', () => {
    const history = [
      ...session('barbell-bench-press', '2026-10-01', 77_500, [8, 8, 8]),
      ...session('barbell-bench-press', '2026-10-05', 80_000, [8, 7, 6]),
    ]
    const a = prescribe(input({ history }))
    const b = prescribe(input({ history: [...history].reverse() }))
    expect(a).toEqual(b)
  })
})
