// Gather the rows a summary needs and build it. Used by Finish and History.

import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { exerciseInfo } from './library'
import { getWorkout, previousWorkingSets, setsOf } from './repo'
import { buildSummary, type SessionSummary } from './summary'

export async function loadSummary(workoutId: string): Promise<SessionSummary | null> {
  const workout = await getWorkout(workoutId)
  if (!workout) return null
  const sets = await setsOf(workoutId)
  const ids = [...new Set(sets.map((s) => s.exercise_id))]
  const previous: Record<string, { workout_id: string; load_g: number; reps: number; completed_at: string }[]> = {}
  const targets: Record<string, { repMax: number; incrementG: number }> = {}
  for (const id of ids) {
    const rows = await previousWorkingSets(id, workoutId)
    // Only sets completed before this session count as "previous".
    previous[id] = rows
      .filter((r) => (r.completed_at ?? '') < workout.started_at)
      .map((r) => ({ workout_id: r.workout_id, load_g: r.load_g ?? 0, reps: r.reps ?? 0, completed_at: r.completed_at ?? '' }))
    const planned = workout.plan?.exercises.find((e) => e.exercise_id === id)
    const info = exerciseInfo(id)
    targets[id] = { repMax: planned?.rep_max ?? info?.repMax ?? 12, incrementG: info?.incrementG ?? 2500 }
  }
  return buildSummary({ workout, sets, previous, exercises: EXERCISES_BY_ID, targets, now: new Date().toISOString() })
}
