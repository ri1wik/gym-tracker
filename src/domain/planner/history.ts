// History readers shared by the prescription, first-time and deload rules.
// Only completed working sets count; warm-ups are filtered here once.

import type { HistorySet } from './contract'

/** One session's working sets of one exercise, in completion order. */
export interface SessionSets {
  workout_id: string
  date_key: string
  /** The latest completed_at in the session, for ordering. */
  last_at: string
  sets: HistorySet[]
}

export function workingSetsOf(history: readonly HistorySet[], exercise_id: string): HistorySet[] {
  return history.filter((s) => s.exercise_id === exercise_id && s.kind === 'working' && s.reps > 0)
}

/**
 * Working sets of one exercise grouped by workout, latest session last.
 * Sessions order by their latest completed_at; ties by workout id so the
 * result never depends on input order.
 */
export function sessionsOf(history: readonly HistorySet[], exercise_id: string): SessionSets[] {
  const byWorkout = new Map<string, SessionSets>()
  for (const s of workingSetsOf(history, exercise_id)) {
    let g = byWorkout.get(s.workout_id)
    if (!g) {
      g = { workout_id: s.workout_id, date_key: s.date_key, last_at: s.completed_at, sets: [] }
      byWorkout.set(s.workout_id, g)
    }
    g.sets.push(s)
    if (s.completed_at > g.last_at) g.last_at = s.completed_at
    if (s.date_key > g.date_key) g.date_key = s.date_key
  }
  const out = [...byWorkout.values()]
  for (const g of out) g.sets.sort((a, b) => (a.completed_at < b.completed_at ? -1 : a.completed_at > b.completed_at ? 1 : 0))
  out.sort((a, b) => (a.last_at < b.last_at ? -1 : a.last_at > b.last_at ? 1 : a.workout_id < b.workout_id ? -1 : 1))
  return out
}

export function lastSessionOf(history: readonly HistorySet[], exercise_id: string): SessionSets | null {
  const all = sessionsOf(history, exercise_id)
  return all.length > 0 ? all[all.length - 1] : null
}

/** The heaviest set of a session, then the most reps at that load. */
export function bestSetOf(session: SessionSets): HistorySet {
  let best = session.sets[0]
  for (const s of session.sets) {
    if (s.load_g > best.load_g || (s.load_g === best.load_g && s.reps > best.reps)) best = s
  }
  return best
}

/** The working load of a session: the load of its first working set. */
export function workingLoadOf(session: SessionSets): { load_g: number; assist_g: number } {
  const first = session.sets[0]
  return { load_g: first.load_g, assist_g: first.assist_g }
}

/** Number of completed working sets of an exercise, for "most history" ordering. */
export function historyCount(history: readonly HistorySet[], exercise_id: string): number {
  return workingSetsOf(history, exercise_id).length
}

/** Plain Epley in grams; null outside 1 to 10 reps. Key lifts are weight-loaded, so no body weight is needed. */
export function epleyEstimateG(load_g: number, reps: number): number | null {
  if (!Number.isFinite(reps) || reps < 1 || reps > 10) return null
  if (reps === 1) return load_g
  return Math.round(load_g * (1 + reps / 30))
}
