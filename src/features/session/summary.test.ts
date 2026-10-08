import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutSet } from '../../domain/types'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { buildSummary } from './summary'

function workout(): Workout {
  return {
    id: 'w2',
    user_id: 'local',
    created_at: '2026-10-08T10:00:00Z',
    updated_at: '2026-10-08T10:00:00Z',
    version: 1,
    deleted_at: null,
    dirty: 1,
    program_id: null,
    planned_on: '2026-10-08',
    session_key: 'push_a',
    started_at: '2026-10-08T10:00:00Z',
    finished_at: '2026-10-08T10:52:30Z',
    status: 'finished',
    notes: null,
    body_weight_g: null,
    plan: null,
  }
}

let idx = 0
function set(exercise_id: string, kind: 'warmup' | 'working', reps: number | null, load_g: number | null, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  idx += 1
  return {
    id: `s${idx}`,
    user_id: 'local',
    created_at: '2026-10-08T10:00:00Z',
    updated_at: '2026-10-08T10:00:00Z',
    version: 1,
    deleted_at: null,
    dirty: 1,
    workout_id: 'w2',
    exercise_id,
    set_index: idx,
    kind,
    target_reps: 8,
    target_load_g: load_g,
    reps,
    load_g,
    assist_g: 0,
    rpe: null,
    completed_at: reps === null ? null : `2026-10-08T10:${String(10 + idx).padStart(2, '0')}:00Z`,
    rest_s: 120,
    substituted_for: null,
    ...extra,
  }
}

describe('buildSummary', () => {
  const sets = [
    set('barbell-bench-press', 'warmup', 10, 20_000),
    set('barbell-bench-press', 'working', 8, 62_500),
    set('barbell-bench-press', 'working', 8, 62_500),
    set('barbell-bench-press', 'working', 8, 62_500),
    set('cable-pushdown', 'working', 12, 25_000),
    set('cable-pushdown', 'working', 10, 25_000),
    set('dumbbell-lateral-raise', 'working', 15, 8000),
    set('dumbbell-lateral-raise', 'working', null, null),
    set('incline-dumbbell-press', 'working', 10, 20_000, { deleted_at: '2026-10-08T10:30:00Z' }),
    set('cable-crunch', 'working', null, null),
  ]
  const previous = {
    'barbell-bench-press': [
      { workout_id: 'w1', load_g: 60_000, reps: 8, completed_at: '2026-10-05T10:10:00Z' },
      { workout_id: 'w1', load_g: 60_000, reps: 8, completed_at: '2026-10-05T10:13:00Z' },
      { workout_id: 'w0', load_g: 57_500, reps: 8, completed_at: '2026-10-01T10:13:00Z' },
    ],
    'cable-pushdown': [{ workout_id: 'w1', load_g: 25_000, reps: 12, completed_at: '2026-10-05T10:40:00Z' }],
  }
  const targets = {
    'barbell-bench-press': { repMax: 8, incrementG: 2500 },
    'cable-pushdown': { repMax: 15, incrementG: 5000 },
    'dumbbell-lateral-raise': { repMax: 15, incrementG: 1000 },
  }
  const s = buildSummary({ workout: workout(), sets, previous, exercises: EXERCISES_BY_ID, targets, now: '2026-10-08T11:00:00Z' })

  it('counts duration and sets, warm-ups and deleted rows excluded from working sets', () => {
    expect(s.durationS).toBe(52 * 60 + 30)
    expect(s.workingSets).toBe(6)
    expect(s.totalSets).toBe(7)
  })
  it('credits body parts through the muscle contract (at most 1 per set per part)', () => {
    const chest = s.bodyParts.find((b) => b.part === 'chest')
    const triceps = s.bodyParts.find((b) => b.part === 'triceps')
    const shoulders = s.bodyParts.find((b) => b.part === 'shoulders')
    expect(chest?.sets).toBe(3)
    expect(triceps?.sets).toBe(3.5)
    expect(shoulders?.sets).toBe(1)
    expect(s.bodyParts.find((b) => b.part === 'back')).toBeUndefined()
  })
  it('marks progressed, same and first against the previous session only', () => {
    const by = Object.fromEntries(s.outcomes.map((o) => [o.exercise_id, o]))
    expect(by['barbell-bench-press'].outcome).toBe('progressed')
    expect(by['barbell-bench-press'].previousBest).toEqual({ load_g: 60_000, reps: 8 })
    expect(by['cable-pushdown'].outcome).toBe('same')
    expect(by['dumbbell-lateral-raise'].outcome).toBe('first')
    expect(by['incline-dumbbell-press']).toBeUndefined()
    expect(by['cable-crunch']).toBeUndefined()
  })
  it('flags ready-to-add only when every working set reached the top of the range', () => {
    const by = Object.fromEntries(s.outcomes.map((o) => [o.exercise_id, o]))
    expect(by['barbell-bench-press'].readyToAdd).toBe(true)
    expect(by['barbell-bench-press'].incrementG).toBe(2500)
    expect(by['cable-pushdown'].readyToAdd).toBe(false)
    expect(by['dumbbell-lateral-raise'].readyToAdd).toBe(true)
  })
  it('lists one PR per exercise, the strongest kind', () => {
    expect(s.prs.map((p) => [p.exercise_id, p.kind])).toEqual([
      ['barbell-bench-press', 'weight'],
      ['dumbbell-lateral-raise', 'first'],
    ])
  })
  it('names the session from the plan or the key', () => {
    expect(s.name).toBe('push_a')
  })
})
