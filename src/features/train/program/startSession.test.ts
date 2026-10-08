import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GUEST_USER_ID, deleteUserDb, openUserDb, type GymDb } from '../../../data/db'
import type { Profile, Workout, WorkoutSet } from '../../../domain/types'
import { loadTrainView } from './data'
import { startNextSession } from './startSession'
import { templateByKey } from './templates'
import { deloadSets } from './rotation'
import {
  advanceProgramPointer,
  createProgram,
  getActiveProgram,
  readSessionMinutes,
  updateProgramSettings,
  writeSessionMinutes,
} from './store'

const T = (key: string) => templateByKey(key)!
const TODAY = '2026-10-08' // Thursday

let db: GymDb
beforeEach(() => {
  db = openUserDb(GUEST_USER_ID)
})
afterEach(async () => {
  await deleteUserDb(GUEST_USER_ID)
})

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: GUEST_USER_ID,
    display_name: 'Test',
    sex: 'unspecified',
    birth_date: null,
    height_mm: null,
    activity_level: 'moderate',
    goal: 'recomp',
    training_age: 'intermediate',
    training_days_per_week: 5,
    cardio_target_s: 9000,
    protein_dg_per_kg: 20,
    calorie_override_kcal: null,
    sleep_min: 450,
    week_starts_on: 1,
    review_weekday: 0,
    review_minute_of_day: 1080,
    checkin_interval_days: 4,
    reference_intakes: 'nin',
    active_gym_profile_id: null,
    onboarding_done: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    version: 1,
    deleted_at: null,
    dirty: 0,
    ...over,
  }
}

async function finishedSession(sessionKey: string, plannedOn: string, exercise: string, load: number, reps: number) {
  const stamp = `${plannedOn}T10:00:00Z`
  const w: Workout = {
    id: `w-${sessionKey}-${plannedOn}`,
    user_id: GUEST_USER_ID,
    program_id: null,
    planned_on: plannedOn,
    session_key: sessionKey,
    started_at: stamp,
    finished_at: stamp,
    status: 'finished',
    notes: null,
    body_weight_g: null,
    plan: null,
    created_at: stamp,
    updated_at: stamp,
    version: 1,
    deleted_at: null,
    dirty: 0,
  }
  const s: WorkoutSet = {
    id: `s-${w.id}`,
    user_id: GUEST_USER_ID,
    workout_id: w.id,
    exercise_id: exercise,
    set_index: 0,
    kind: 'working',
    target_reps: reps,
    target_load_g: load,
    reps,
    load_g: load,
    assist_g: 0,
    rpe: null,
    completed_at: stamp,
    rest_s: 150,
    substituted_for: null,
    created_at: stamp,
    updated_at: stamp,
    version: 1,
    deleted_at: null,
    dirty: 0,
  }
  await db.workouts.put(w)
  await db.workout_sets.put(s)
}

describe('programs', () => {
  it('creates an active program at day one and retires the old one', async () => {
    const a = await createProgram(db, T('ppl_6'), TODAY)
    expect(a.settings.pointer).toBe(-1)
    expect(a.settings.pins).toEqual({})
    expect(a.dirty).toBe(1)
    expect(a.version).toBe(1)
    const b = await createProgram(db, T('full_body_3'), TODAY, { priority_group: 'glutes' })
    expect(b.settings.pins).toEqual({ 1: 'full_a', 3: 'full_b', 5: 'full_c' })
    expect(b.settings.weekly_sessions_target).toBe(3)
    expect((await getActiveProgram(db))?.id).toBe(b.id)
    expect((await db.programs.get(a.id))?.active).toBe(false)
  })

  it('deloads every five weeks for advanced lifters and in a deep deficit', async () => {
    await db.profiles.put(profile({ training_age: 'advanced' }))
    expect((await createProgram(db, T('ppl_6'), TODAY)).settings.deload.every_weeks).toBe(5)
    await db.profiles.put(profile({ training_age: 'intermediate', goal: 'fat_loss' }))
    expect((await createProgram(db, T('ppl_6'), TODAY)).settings.deload.every_weeks).toBe(5)
    await db.profiles.put(profile({ training_age: 'intermediate', goal: 'recomp' }))
    expect((await createProgram(db, T('ppl_6'), TODAY)).settings.deload.every_weeks).toBe(6)
  })

  it('stores the time budget in the meta table', async () => {
    expect(await readSessionMinutes(db)).toBe(60)
    await writeSessionMinutes(db, 45)
    expect(await readSessionMinutes(db)).toBe(45)
  })
})

describe('startNextSession', () => {
  it('writes a workout and its rows from the next template day', async () => {
    await createProgram(db, T('ppl_6'), TODAY)
    const res = await startNextSession(db, TODAY)
    expect(res.resumed).toBe(false)
    const w = await db.workouts.get(res.workoutId)
    expect(w?.session_key).toBe('push_a')
    expect(w?.status).toBe('in_progress')
    expect(w?.planned_on).toBe(TODAY)
    expect(w?.dirty).toBe(1)
    const sets = await db.workout_sets.where('workout_id').equals(res.workoutId).sortBy('set_index')
    expect(sets.map((s) => s.set_index)).toEqual(sets.map((_, i) => i))
    expect(sets.every((s) => s.reps === null && s.completed_at === null && s.dirty === 1)).toBe(true)
    // No history: no ramps (nothing to ramp to) and no load; reps start at the bottom of the range.
    const day = T('ppl_6').days[0]
    const working = sets.filter((s) => s.kind === 'working')
    expect(sets.every((s) => s.kind === 'working')).toBe(true)
    expect(working[0]).toMatchObject({ exercise_id: day.items[0].exercise_id, target_reps: day.items[0].rep_min, target_load_g: null, rest_s: day.items[0].rest_s })
    expect(new Set(working.map((s) => s.exercise_id))).toEqual(new Set(day.items.map((i) => i.exercise_id)))
    expect(w?.plan?.session_key).toBe('push_a')
    expect((await db.meta.get('active_workout_id'))?.value).toBe(res.workoutId)
    // Every row went through the sync layer: one outbox entry per row.
    expect(await db.outbox.count()).toBe(1 + 1 + sets.length)
  })

  it('prefills load and reps from the last completed set of that exercise', async () => {
    await createProgram(db, T('ppl_6'), TODAY)
    await finishedSession('push_a', '2026-10-01', 'barbell-bench-press', 62_500, 7)
    const res = await startNextSession(db, TODAY)
    const sets = await db.workout_sets.where('workout_id').equals(res.workoutId).sortBy('set_index')
    const bench = sets.filter((s) => s.exercise_id === 'barbell-bench-press')
    const ramps = bench.filter((s) => s.kind === 'warmup')
    const working = bench.filter((s) => s.kind === 'working')
    // Barbell at 62.5 kg: bar x10, 50 percent x5, 70 percent x3, then the 85 percent single (working reps 8 or fewer).
    expect(ramps.map((s) => [s.target_load_g, s.target_reps])).toEqual([
      [20_000, 10],
      [32_500, 5],
      [45_000, 3],
      [52_500, 1],
    ])
    // 7 of 6 to 8 last time: same load, one more rep on the set that fell short, the rest from the bottom.
    expect(working[0]).toMatchObject({ target_load_g: 62_500, target_reps: 8 })
    expect(working.slice(1).every((s) => s.target_load_g === 62_500 && s.target_reps === 6)).toBe(true)
    // The incline dumbbells take their first-time load from the bench through the ratio table.
    const incline = sets.find((s) => s.exercise_id === 'incline-dumbbell-press' && s.kind === 'working')
    expect(incline?.target_load_g).toBe(20_000)
  })

  it('returns the live workout instead of starting a second one', async () => {
    await createProgram(db, T('ppl_6'), TODAY)
    const first = await startNextSession(db, TODAY)
    const again = await startNextSession(db, TODAY)
    expect(again).toEqual({ workoutId: first.workoutId, resumed: true })
    expect(await db.workouts.count()).toBe(1)
  })

  it('halves the sets in a deload week', async () => {
    const p = await createProgram(db, T('ppl_6'), TODAY)
    await updateProgramSettings(db, p, { deload: { ...p.settings.deload, active: true } })
    const res = await startNextSession(db, TODAY)
    const sets = await db.workout_sets.where('workout_id').equals(res.workoutId).toArray()
    const day = T('ppl_6').days[0]
    for (const item of day.items) {
      expect(sets.filter((s) => s.exercise_id === item.exercise_id && s.kind === 'working')).toHaveLength(deloadSets(item.sets))
    }
    expect((await db.workouts.get(res.workoutId))?.plan?.deload).toBe(true)
  })

  it('honours a weekday pin', async () => {
    const p = await createProgram(db, T('ppl_6'), TODAY)
    await updateProgramSettings(db, p, { pins: { 4: 'legs_a' } }) // Thursday
    const res = await startNextSession(db, TODAY)
    expect((await db.workouts.get(res.workoutId))?.session_key).toBe('legs_a')
  })

  it('moves to the next day after the logger advances the pointer', async () => {
    const p = await createProgram(db, T('ppl_6'), TODAY)
    await advanceProgramPointer(db, p.id, 0)
    const view = await loadTrainView(db, TODAY)
    expect(view.next?.day.key).toBe('pull_a')
  })
})

describe('loadTrainView', () => {
  it('has no program before one is chosen', async () => {
    const v = await loadTrainView(db, TODAY)
    expect(v.program).toBeNull()
    expect(v.next).toBeNull()
  })

  it('counts the week, finds the last done day and flags a check-in', async () => {
    await db.profiles.put(profile())
    await createProgram(db, T('ppl_6'), TODAY)
    await finishedSession('push_a', '2026-10-05', 'barbell-bench-press', 60_000, 8)
    await finishedSession('pull_a', '2026-10-06', 'barbell-row', 60_000, 8)
    const v = await loadTrainView(db, TODAY)
    expect(v.weekCount).toBe(2)
    expect(v.weekTarget).toBe(6)
    expect(v.lastDone.push_a).toBe('2026-10-05')
    expect(v.lastDone.legs_a).toBeNull()
    expect(v.checkinDue).toBe(true)
  })

  it('is not due when a weigh-in is inside the interval', async () => {
    await db.profiles.put(profile())
    await db.body_weights.put({
      id: 'b1',
      user_id: GUEST_USER_ID,
      date_key: '2026-10-06',
      weight_g: 70_000,
      waist_mm: null,
      same_conditions: true,
      note: null,
      created_at: '2026-10-06T07:00:00Z',
      updated_at: '2026-10-06T07:00:00Z',
      version: 1,
      deleted_at: null,
      dirty: 0,
    })
    await createProgram(db, T('ppl_6'), TODAY)
    expect((await loadTrainView(db, TODAY)).checkinDue).toBe(false)
    expect((await loadTrainView(db, '2026-10-10')).checkinDue).toBe(true)
  })

  it('reports the in-progress workout', async () => {
    await createProgram(db, T('ppl_6'), TODAY)
    const res = await startNextSession(db, TODAY)
    expect((await loadTrainView(db, TODAY)).inProgress?.id).toBe(res.workoutId)
  })
})
