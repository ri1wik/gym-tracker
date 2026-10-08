import { describe, expect, it } from 'vitest'
import { firstTimeLoad, RAMP_CARD } from './first-time'
import { ctx, equipment, history, session } from './fixtures'

describe('first-time loads', () => {
  const bench85x6 = ctx({ history: history(session('barbell-bench-press', '2026-10-05', 85_000, [6, 6, 6])) })

  it('bench 85 x 6 gives incline dumbbells 27.5 kg per hand', () => {
    const r = firstTimeLoad('incline-dumbbell-press', bench85x6)
    expect(r).toEqual({ target_load_g: 27_500, load_source: 'ratio', from_exercise_id: 'barbell-bench-press', confidence: 'medium', card: null })
  })

  it('a machine chest press always gets the ramp card', () => {
    const r = firstTimeLoad('machine-chest-press', bench85x6)
    expect(r.load_source).toBe('ramp')
    expect(r.target_load_g).toBeNull()
    expect(r.confidence).toBe('low')
    expect(r.card).toBe(RAMP_CARD)
    expect(firstTimeLoad('cable-pushdown', bench85x6).load_source).toBe('ramp')
    expect(firstTimeLoad('smith-machine-squat', bench85x6).load_source).toBe('ramp')
  })

  it('a dumbbell ratio landing between rungs rounds down', () => {
    // 0.35 x 102 x 0.90 = 32.13 kg, between 30 and 32.5: down to 30.
    expect(firstTimeLoad('dumbbell-bench-press', bench85x6).target_load_g).toBe(30_000)
  })

  it('a barbell target rounds down to 2.5 kg and never under the bar', () => {
    // Incline barbell: 0.80 x 102 x 0.90 = 73.44 -> 72.5.
    expect(firstTimeLoad('incline-barbell-bench-press', bench85x6).target_load_g).toBe(72_500)
    const light = ctx({ history: history(session('barbell-bench-press', '2026-10-05', 30_000, [8, 8, 8])) })
    // Barbell curl: 0.30 x 38 x 0.90 = 10.26 -> 10 -> Olympic bar floor 20.
    expect(firstTimeLoad('barbell-curl', light).target_load_g).toBe(20_000)
    // EZ bar curl floors at 10 kg.
    expect(firstTimeLoad('ez-bar-curl', light).target_load_g).toBe(10_000)
  })

  it('a custom bar floor is honoured', () => {
    const light = ctx({
      history: history(session('barbell-bench-press', '2026-10-05', 30_000, [8, 8, 8])),
      equipment: equipment({ bar_floor_g: { olympic: 20_000, ez: 7_500, fixed: 10_000 } }),
    })
    expect(firstTimeLoad('ez-bar-curl', light).target_load_g).toBe(10_000)
  })

  it('no reference lift means the ramp card, even for a barbell move', () => {
    const r = firstTimeLoad('incline-barbell-bench-press', ctx())
    expect(r.load_source).toBe('ramp')
    expect(r.from_exercise_id).toBeNull()
  })

  it('an exercise outside the ratio table gets the ramp card', () => {
    expect(firstTimeLoad('farmers-walk', bench85x6).load_source).toBe('ramp')
  })
})
