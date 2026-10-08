// Inline PR detection at the point of logging (docs/SPEC-retention-priority.md
// item 5): one badge per set, the most impressive of weight, reps and e1RM,
// through the e1RM engine in src/domain/calc/e1rm.

import { beats, epleyG } from '../../domain/calc/e1rm'
import type { LoadType } from '../../domain/types'

export type PrKind = 'first' | 'weight' | 'reps' | 'e1rm'

export interface SetValues {
  load_g: number
  reps: number
}

/** Epley estimate in grams; null outside 1 to 10 reps. */
export function estimate1rmG(load_g: number, reps: number): number | null {
  return epleyG(load_g, reps)
}

/**
 * Did b beat a: more reps at the same load, or a full increment step up with
 * at most two reps fewer (the engine's rule). Pass the exercise's increment
 * so machine stacks are judged on their own step.
 */
export function setBeats(a: SetValues, b: SetValues, step_g?: number): boolean {
  return beats(a, b, step_g)
}

/**
 * The badge for a just-completed working set against every earlier completed
 * working set of the exercise (other sessions and earlier sets today).
 * Assisted and timed moves only earn a first-time or reps badge.
 */
export function detectPr(set: SetValues, previous: readonly SetValues[], loadType: LoadType): PrKind | null {
  if (set.reps <= 0) return null
  if (previous.length === 0) return 'first'
  const loadMatters = loadType === 'weight' || loadType === 'bodyweight'
  if (loadMatters) {
    const bestLoad = Math.max(...previous.map((p) => p.load_g))
    if (set.load_g > bestLoad) return 'weight'
  }
  const sameLoad = previous.filter((p) => p.load_g === set.load_g)
  if (sameLoad.length > 0 && set.reps > Math.max(...sameLoad.map((p) => p.reps))) return 'reps'
  if (loadType === 'time' || loadType === 'assisted') return null
  const mine = estimate1rmG(set.load_g, set.reps)
  if (mine === null) return null
  // Only against earlier sets that have an estimate themselves; a 12-rep
  // history set has none, and beating nothing is not a record.
  const bestPrev = Math.max(0, ...previous.map((p) => estimate1rmG(p.load_g, p.reps) ?? 0))
  return bestPrev > 0 && mine > bestPrev ? 'e1rm' : null
}

/** The badge text that fits the 64 px prev cell of a done row; prLabel stays the accessible name and the toast line. */
export function prShortLabel(kind: PrKind): string {
  switch (kind) {
    case 'first':
      return 'First'
    case 'weight':
      return 'PR kg'
    case 'reps':
      return 'PR reps'
    case 'e1rm':
      return 'PR 1RM'
  }
}

export function prLabel(kind: PrKind): string {
  switch (kind) {
    case 'first':
      return 'First time'
    case 'weight':
      return 'PR weight'
    case 'reps':
      return 'PR reps'
    case 'e1rm':
      return 'PR e1RM'
  }
}
