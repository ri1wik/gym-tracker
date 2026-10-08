// Set and session volume, and the body parts a session worked.
//
// OWNER: engine-trend-review. Pure. Warm-ups and uncompleted rows never
// count; the per-body-part credit rule lives in ../muscles.ts and is only
// re-exported here so callers have one import for everything volume.

import type { BodyPart, LoadType, SetKind } from '../types'
import type { MuscleTags } from '../muscles'
import { weeklySetsByBodyPart, weeklySetsByGroup } from '../muscles'

export { weeklySetsByBodyPart, weeklySetsByGroup }

export interface VolumeSet {
  exercise_id: string
  kind: SetKind
  completed_at: string | null
  reps: number | null
  /** External load in grams. 0 for plain bodyweight. */
  load_g: number | null
  /** Assistance in grams, as its own positive number. 0 when not assisted. */
  assist_g?: number
}

export interface VolumeExercise extends MuscleTags {
  loadType: LoadType
}

/** True for a row the volume, PR and review rules may read. */
export function isWorkingCompleted(s: { kind: SetKind; completed_at: string | null; reps?: number | null }): boolean {
  return s.kind === 'working' && s.completed_at !== null && (s.reps == null || s.reps > 0)
}

/**
 * Volume of one set in gram-reps: load x reps for weight moves, (body weight
 * plus load) x reps for bodyweight moves, (body weight minus assistance) x
 * reps for assisted moves, null for timed moves or when the body weight a
 * rule needs is missing.
 */
export function setVolumeG(set: VolumeSet, loadType: LoadType, body_weight_g: number | null = null): number | null {
  if (!isWorkingCompleted(set) || set.reps == null) return null
  const load = set.load_g ?? 0
  switch (loadType) {
    case 'weight':
      return load * set.reps
    case 'bodyweight':
      if (body_weight_g == null) return null
      return (body_weight_g + load) * set.reps
    case 'assisted':
      if (body_weight_g == null) return null
      return Math.max(body_weight_g - (set.assist_g ?? 0), 0) * set.reps
    case 'time':
      return null
  }
}

/** Total session volume in gram-reps over the countable sets. Unknown exercises are skipped. */
export function workoutVolumeG(
  sets: readonly VolumeSet[],
  exercisesById: Readonly<Record<string, VolumeExercise>>,
  body_weight_g: number | null = null,
): number {
  let total = 0
  for (const s of sets) {
    const ex = exercisesById[s.exercise_id]
    if (!ex) continue
    total += setVolumeG(s, ex.loadType, body_weight_g) ?? 0
  }
  return total
}

/** Working sets completed, warm-ups excluded. */
export function workingSetCount(sets: readonly VolumeSet[]): number {
  return sets.filter(isWorkingCompleted).length
}

/** Body parts with at least one full set of credit, in BODY_PARTS order. */
export function bodyPartsWorked(
  sets: readonly VolumeSet[],
  exercisesById: Readonly<Record<string, MuscleTags>>,
): BodyPart[] {
  const totals = weeklySetsByBodyPart(sets, exercisesById)
  return (Object.keys(totals) as BodyPart[]).filter((p) => totals[p] >= 1)
}
