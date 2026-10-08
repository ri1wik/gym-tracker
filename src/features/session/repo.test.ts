import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { GUEST_USER_ID, deleteUserDb } from '../../data/db'
import { fixturePlan } from './fixturePlan'
import {
  activeWorkoutId,
  addSets,
  completeSet,
  discardWorkout,
  finishWorkout,
  finishedWorkouts,
  lastCompletedWorkingSet,
  previousWorkingSets,
  recentExerciseIds,
  removeSet,
  restoreSet,
  setsOf,
  startWorkout,
  substituteExercise,
} from './repo'
import { sessionDb } from './write'

afterEach(async () => {
  await deleteUserDb(GUEST_USER_ID)
})

describe('startWorkout', () => {
  it('creates the workout, one row per planned ramp and working set, and points the active meta at it', async () => {
    const id = await startWorkout(fixturePlan())
    expect(await activeWorkoutId()).toBe(id)
    const sets = await setsOf(id)
    const plan = fixturePlan()
    const expected = plan.exercises.reduce((n, e) => n + e.sets + e.warmups.length, 0)
    expect(sets).toHaveLength(expected)
    expect(sets.map((s) => s.set_index)).toEqual(sets.map((_, i) => i))
    expect(sets[0]).toMatchObject({ kind: 'warmup', exercise_id: 'barbell-bench-press', target_load_g: 20_000, target_reps: 10, dirty: 1, version: 1 })
    expect(sets[3]).toMatchObject({ kind: 'working', target_load_g: 60_000, completed_at: null })
    const w = await sessionDb().workouts.get(id)
    expect(w?.status).toBe('in_progress')
    expect(w?.plan?.name).toBe('Push (quick)')
  })
})

describe('completeSet and the last-time label', () => {
  it('writes one row per completion and reads the last completed set from another workout', async () => {
    const w1 = await startWorkout(fixturePlan())
    const sets = await setsOf(w1)
    const working = sets.filter((s) => s.kind === 'working' && s.exercise_id === 'barbell-bench-press')
    await completeSet(working[0], { reps: 8, load_g: 60_000, assist_g: 0 })
    await completeSet(working[1], { reps: 7, load_g: 60_000, assist_g: 0 })
    const rows = await setsOf(w1)
    expect(rows.filter((r) => r.completed_at !== null)).toHaveLength(2)
    // The same workout never feeds its own "last" label.
    expect(await lastCompletedWorkingSet('barbell-bench-press', w1)).toBeNull()
    await finishWorkout(w1)
    expect(await activeWorkoutId()).toBeNull()
    const w2 = await startWorkout(fixturePlan())
    const last = await lastCompletedWorkingSet('barbell-bench-press', w2)
    expect(last?.reps).toBe(7)
    expect(await previousWorkingSets('barbell-bench-press', w2)).toHaveLength(2)
    expect(await recentExerciseIds()).toEqual(['barbell-bench-press'])
    expect((await finishedWorkouts()).map((w) => w.id)).toEqual([w1])
  })
})

describe('remove, restore, add and substitute', () => {
  it('soft-deletes a set, restores it on undo, and appends added sets after the last index', async () => {
    const id = await startWorkout(fixturePlan())
    const before = await setsOf(id)
    const victim = before[before.length - 1]
    await removeSet(victim)
    expect((await setsOf(id)).map((s) => s.id)).not.toContain(victim.id)
    const back = await restoreSet(victim)
    // deleted_at is one-way: the undo re-adds the set as a fresh row in the same slot.
    const after = await setsOf(id)
    expect(after.map((s) => s.id)).not.toContain(victim.id)
    expect(after.map((s) => s.id)).toContain(back.id)
    expect(after.find((s) => s.id === back.id)?.set_index).toBe(victim.set_index)
    const added = await addSets(id, 'cable-pushdown', { count: 1, targetReps: 12, targetLoadG: 25_000, assistG: 0, restS: 75 })
    expect(added[0].set_index).toBe(before.length)
  })
  it('swaps the pending sets of a busy exercise for the substitute and records what was done', async () => {
    const id = await startWorkout(fixturePlan())
    const sets = await setsOf(id)
    const bench = sets.filter((s) => s.exercise_id === 'barbell-bench-press')
    await completeSet(bench[0], { reps: 10, load_g: 20_000, assist_g: 0 })
    await substituteExercise(id, 'barbell-bench-press', 'machine-chest-press')
    const after = await setsOf(id)
    expect(after.filter((s) => s.exercise_id === 'barbell-bench-press')).toHaveLength(1)
    const subs = after.filter((s) => s.exercise_id === 'machine-chest-press')
    expect(subs).toHaveLength(3)
    expect(subs.every((s) => s.substituted_for === 'barbell-bench-press' && s.kind === 'working')).toBe(true)
    // The substitute keeps the slot: its rows sit where the removed sets were, before the next exercise.
    const firstIncline = after.find((s) => s.exercise_id === 'incline-dumbbell-press')!
    expect(subs.every((s) => s.set_index < firstIncline.set_index)).toBe(true)
  })
  it('discard clears the active pointer and hides the workout and its sets from history', async () => {
    const id = await startWorkout(fixturePlan())
    const sets = await setsOf(id)
    const bench = sets.find((s) => s.kind === 'working' && s.exercise_id === 'barbell-bench-press')!
    await completeSet(bench, { reps: 8, load_g: 70_000, assist_g: 0 })
    await discardWorkout(id)
    expect(await activeWorkoutId()).toBeNull()
    expect(await finishedWorkouts()).toEqual([])
    expect(await previousWorkingSets('barbell-bench-press', null)).toEqual([])
  })
})
