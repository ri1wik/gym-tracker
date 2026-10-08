import { describe, expect, it } from 'vitest'
import { emptyContext, fallbackSubstitutes, fixturePlan, planSession, substitutes } from './plan'

describe('plan adapter', () => {
  it('returns the fixture while buildCustomSession is a stub', () => {
    const plan = planSession(
      { focus: { kind: 'any' }, minutes: 45, intent: 'normal', exclude_exercise_ids: [], exclude_families: [], date_key: '2026-10-08' },
      emptyContext(),
    )
    expect(plan.exercises.length).toBeGreaterThan(0)
    expect(plan.exercises[0].target_reps).toHaveLength(plan.exercises[0].sets)
    expect(fixturePlan().name).toBe('Push (quick)')
  })
  it('scores substitutes by the spec: pattern and primary shared, +3 family, +2 per secondary, +1 history, +1 not today', () => {
    const ctx = emptyContext({
      sets: [{ workout_id: 'w', exercise_id: 'chest-supported-machine-row', kind: 'working', reps: 10, load_g: 40_000, assist_g: 0, completed_at: '2026-10-01T10:00:00Z', date_key: '2026-10-01' }],
      workouts: [],
    })
    const r = fallbackSubstitutes({ exercise_id: 'seated-cable-row', done_today: [], limit: 3 }, ctx)
    expect(r.map((s) => s.exercise_id)).toEqual(['single-arm-cable-row', 'chest-supported-machine-row', 'barbell-row'])
    expect(r[0].score).toBe(3 + 2 + 2 + 1)
    expect(r[1].score).toBe(2 + 2 + 1 + 1)
    expect(r[2].score).toBe(2 + 1)
    expect(r[1].reasons).toContain('has history')
    expect(substitutes({ exercise_id: 'seated-cable-row', done_today: [], limit: 3 }, emptyContext())[0].exercise_id).toBe('single-arm-cable-row')
  })
  it('filters to the gym when machine ids are set and returns nothing for an unknown id', () => {
    const ctx = emptyContext()
    ctx.equipment.machine_ids = ['cable-station']
    const r = fallbackSubstitutes({ exercise_id: 'seated-cable-row', done_today: [], limit: 4 }, ctx)
    expect(r.every((s) => s.exercise_id.includes('cable') || s.exercise_id === 'dumbbell-row' || s.exercise_id === 'barbell-row')).toBe(true)
    expect(fallbackSubstitutes({ exercise_id: 'nope', done_today: [], limit: 3 }, ctx)).toEqual([])
  })
})
