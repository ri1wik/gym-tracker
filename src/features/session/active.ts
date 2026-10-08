// The in-progress session pointer, kept apart from the rest of the repo so
// the resume pill (mounted in the Shell on every screen) pulls none of the
// session screen's code or the exercise content into the first paint.

import { META_KEYS } from '../../data/db'
import type { Workout } from '../../domain/types'
import { readMeta, sessionDb, writeMeta } from './write'

/** Read-only (it runs inside live queries): a pointer at a finished or discarded workout reads as none. */
export async function activeWorkoutId(): Promise<string | null> {
  const id = await readMeta<string>(META_KEYS.activeWorkoutId)
  if (!id) return null
  const w = await sessionDb().workouts.get(id)
  if (!w || w.status !== 'in_progress' || w.deleted_at !== null) return null
  return id
}

export async function setActiveWorkoutId(id: string | null): Promise<void> {
  await writeMeta(META_KEYS.activeWorkoutId, id)
}

export async function getWorkout(id: string): Promise<Workout | undefined> {
  return sessionDb().workouts.get(id)
}
