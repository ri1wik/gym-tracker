import { describe, expect, it } from 'vitest'
import { emptyContext, planSession, substitutes } from './plan'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'

describe('plan adapter', () => {
  it('builds a session through the planner with a target per set', () => {
    const plan = planSession(
      { focus: { kind: 'any' }, minutes: 45, intent: 'normal', exclude_exercise_ids: [], exclude_families: [], date_key: '2026-10-08' },
      emptyContext(),
    )
    expect(plan.exercises.length).toBeGreaterThan(0)
    for (const ex of plan.exercises) expect(ex.target_reps).toHaveLength(ex.sets)
    expect(plan.needs_minutes).toBeNull()
  })
  it('lists substitutes that share the pattern and a primary muscle, scored and filtered to the gym', () => {
    const ctx = emptyContext()
    const from = EXERCISES_BY_ID['seated-cable-row']
    const r = substitutes({ exercise_id: 'seated-cable-row', done_today: [], limit: 3 }, ctx)
    expect(r.length).toBeGreaterThan(0)
    expect(r.length).toBeLessThanOrEqual(3)
    for (const s of r) {
      const cand = EXERCISES_BY_ID[s.exercise_id]
      expect(cand.movementPattern).toBe(from.movementPattern)
      expect(cand.primaryMuscles.some((m) => from.primaryMuscles.includes(m))).toBe(true)
      expect(s.score).toBeGreaterThan(0)
    }
    ctx.equipment.machine_ids = ['cable-station']
    const gym = substitutes({ exercise_id: 'seated-cable-row', done_today: [], limit: 4 }, ctx)
    for (const s of gym) {
      const m = EXERCISES_BY_ID[s.exercise_id].machineId
      expect(m === undefined || m === null || m === 'cable-station').toBe(true)
    }
  })
})
