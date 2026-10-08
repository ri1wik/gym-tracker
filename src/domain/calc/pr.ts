// PR detection per exercise: heaviest load, most reps at a load, best
// estimated 1RM, best single-set volume. One badge per set, the most
// impressive, in that order. First-time records on an exercise with no
// history are labelled first-time rather than PR so later PRs keep meaning.
//
// OWNER: engine-trend-review. Pure. Warm-ups never count; assisted and timed
// moves never earn an e1RM record; an earlier set in the same session counts
// as history for a later one.

import type { LoadType, SetKind } from '../types'
import { e1rmG } from './e1rm'
import { isWorkingCompleted, setVolumeG } from './volume'

export type PrKind = 'load' | 'reps_at_load' | 'e1rm' | 'volume'

/** Most impressive first. */
export const PR_ORDER: readonly PrKind[] = ['load', 'reps_at_load', 'e1rm', 'volume']

export const PR_LABEL: Record<PrKind, string> = {
  load: 'Heaviest load',
  reps_at_load: 'Most reps at this load',
  e1rm: 'Best estimated 1RM',
  volume: 'Best set volume',
}

export interface PrSet {
  id: string
  exercise_id: string
  kind: SetKind
  completed_at: string | null
  reps: number | null
  load_g: number | null
  assist_g?: number
  /** The day's body weight for bodyweight moves, from the workout row. */
  body_weight_g?: number | null
}

export interface PrBests {
  load_g: number
  /** Best reps seen at each load. */
  reps_at_load: Map<number, number>
  e1rm_g: number
  volume_g: number
  sets: number
}

export interface SetPr {
  set_id: string
  exercise_id: string
  /** Every record this set broke. */
  kinds: PrKind[]
  /** The one badge to show, or null when nothing was broken. */
  badge: PrKind | null
  /** True when the exercise had no history before this set: labelled first-time, no badge. */
  first_time: boolean
  e1rm_g: number | null
  volume_g: number | null
}

function metrics(set: PrSet, loadType: LoadType) {
  const load = set.load_g ?? 0
  const reps = set.reps ?? 0
  const e1rm = e1rmG({ loadType, load_g: load, reps, body_weight_g: set.body_weight_g ?? null })
  const volume = setVolumeG(set, loadType, set.body_weight_g ?? null)
  return { load, reps, e1rm, volume }
}

export function emptyBests(): PrBests {
  return { load_g: -Infinity, reps_at_load: new Map(), e1rm_g: -Infinity, volume_g: -Infinity, sets: 0 }
}

/** Fold the countable sets of one exercise into its bests. */
export function foldBests(bests: PrBests, set: PrSet, loadType: LoadType): PrBests {
  if (!isWorkingCompleted(set)) return bests
  const m = metrics(set, loadType)
  bests.sets += 1
  bests.load_g = Math.max(bests.load_g, m.load)
  bests.reps_at_load.set(m.load, Math.max(bests.reps_at_load.get(m.load) ?? -Infinity, m.reps))
  if (m.e1rm !== null) bests.e1rm_g = Math.max(bests.e1rm_g, m.e1rm)
  if (m.volume !== null) bests.volume_g = Math.max(bests.volume_g, m.volume)
  return bests
}

/** Which records a set breaks against the bests so far. */
export function recordsBroken(bests: PrBests, set: PrSet, loadType: LoadType): PrKind[] {
  if (!isWorkingCompleted(set) || bests.sets === 0) return []
  const m = metrics(set, loadType)
  const kinds: PrKind[] = []
  if (m.load > 0 && m.load > bests.load_g) kinds.push('load')
  const prevReps = bests.reps_at_load.get(m.load)
  if (prevReps !== undefined && m.reps > prevReps) kinds.push('reps_at_load')
  if (m.e1rm !== null && m.e1rm > bests.e1rm_g) kinds.push('e1rm')
  if (m.volume !== null && m.volume > bests.volume_g) kinds.push('volume')
  return kinds
}

/** The most impressive of the kinds, by PR_ORDER. */
export function bestBadge(kinds: readonly PrKind[]): PrKind | null {
  for (const k of PR_ORDER) if (kinds.includes(k)) return k
  return null
}

/**
 * PRs for every countable set of a session, each judged against the history
 * plus the session's earlier sets. `history` holds the exercise's previous
 * countable sets (any order); `session` holds this workout's sets in order.
 */
export function sessionPrs(
  history: readonly PrSet[],
  session: readonly PrSet[],
  exercisesById: Readonly<Record<string, { loadType: LoadType }>>,
): SetPr[] {
  const bests = new Map<string, PrBests>()
  const bestsFor = (id: string) => {
    let b = bests.get(id)
    if (!b) {
      b = emptyBests()
      bests.set(id, b)
    }
    return b
  }
  for (const s of history) {
    const ex = exercisesById[s.exercise_id]
    if (!ex) continue
    foldBests(bestsFor(s.exercise_id), s, ex.loadType)
  }
  const out: SetPr[] = []
  for (const s of session) {
    const ex = exercisesById[s.exercise_id]
    if (!ex || !isWorkingCompleted(s)) continue
    const b = bestsFor(s.exercise_id)
    const first = b.sets === 0
    const kinds = recordsBroken(b, s, ex.loadType)
    const m = metrics(s, ex.loadType)
    out.push({
      set_id: s.id,
      exercise_id: s.exercise_id,
      kinds,
      badge: first ? null : bestBadge(kinds),
      first_time: first,
      e1rm_g: m.e1rm,
      volume_g: m.volume,
    })
    foldBests(b, s, ex.loadType)
  }
  return out
}

/** Count of sets that earned a badge, for "3 PRs this session". */
export function prCount(prs: readonly SetPr[]): number {
  return prs.filter((p) => p.badge !== null).length
}
