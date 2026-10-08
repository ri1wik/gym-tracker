import { describe, expect, it } from 'vitest'
import { MACHINE_IDS } from '../../data/library/machine-index'
import { ctx, equipment, history, session } from './fixtures'
import { substitutesFor } from './substitute'

describe('substitution', () => {
  it('a busy seated cable row with no history ranks the single-arm cable row first, then the chest-supported row, then the barbell row', () => {
    const subs = substitutesFor({ exercise_id: 'seated-cable-row', done_today: [], limit: 3 }, ctx())
    expect(subs.map((s) => s.exercise_id)).toEqual(['single-arm-cable-row', 'chest-supported-machine-row', 'barbell-row'])
    expect(subs.map((s) => s.score)).toEqual([8, 5, 3])
    expect(subs[0].reasons).toEqual(['same equipment family', 'shares lats', 'shares biceps', 'not yet today'])
  })

  it('history and "already done today" move the ranking', () => {
    const c = ctx({ history: history(session('chest-supported-machine-row', '2026-10-01', 50_000, [10, 10, 10])) })
    const subs = substitutesFor({ exercise_id: 'seated-cable-row', done_today: ['single-arm-cable-row'], limit: 3 }, c)
    expect(subs.map((s) => s.exercise_id)).toEqual(['single-arm-cable-row', 'chest-supported-machine-row', 'barbell-row'])
    expect(subs.map((s) => s.score)).toEqual([7, 6, 3])
  })

  it('filters to the gym profile and respects the limit', () => {
    const withoutCable = MACHINE_IDS.filter((id) => id !== 'cable-station')
    const subs = substitutesFor({ exercise_id: 'seated-cable-row', done_today: [], limit: 2 }, ctx({ equipment: equipment({ machine_ids: withoutCable }) }))
    expect(subs.map((s) => s.exercise_id)).toEqual(['chest-supported-machine-row', 'barbell-row'])
  })

  it('candidates must share the pattern and a primary muscle', () => {
    const subs = substitutesFor({ exercise_id: 'barbell-bench-press', done_today: [], limit: 10 }, ctx())
    for (const s of subs) {
      expect(['dumbbell-bench-press', 'machine-chest-press', 'plate-loaded-chest-press', 'push-up']).toContain(s.exercise_id)
    }
    expect(subs.map((s) => s.exercise_id)).not.toContain('dip')
    expect(subs.map((s) => s.exercise_id)).not.toContain('incline-barbell-bench-press')
  })

  it('returns nothing for an unknown exercise', () => {
    expect(substitutesFor({ exercise_id: 'nope', done_today: [], limit: 3 }, ctx())).toEqual([])
  })
})
