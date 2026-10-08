// Typed loader for the full exercise records in exercises.json.
//
// The structural facts come from exercise-index.ts and are copied verbatim
// into the json; this module only adds typing and lookups.

import type { Exercise } from '../../domain/types'
import raw from './exercises.json'

export const EXERCISES: readonly Exercise[] = raw as unknown as Exercise[]

export const EXERCISES_FULL_BY_ID: Readonly<Record<string, Exercise>> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
)

/** One full record by id, or undefined for an unknown id. */
export function getExercise(id: string): Exercise | undefined {
  return EXERCISES_FULL_BY_ID[id]
}

/** Lower-cased names and aliases mapped to the exercise id, for search. */
export function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of EXERCISES) {
    map.set(e.name.toLowerCase(), e.id)
    for (const a of e.aliases) map.set(a.toLowerCase(), e.id)
  }
  return map
}
