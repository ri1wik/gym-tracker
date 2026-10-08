// The finish summary (PLAN.md section 2, "Finish"): duration, sets, body
// parts worked through the muscle contract, progressed / same / lower per
// exercise against the previous session, PRs, and the ready-to-add-weight
// hints. Pure: the screen gathers the rows and passes them in.

import type { BodyPart, ExerciseIndexEntry, Workout, WorkoutSet } from '../../domain/types'
import { weeklySetsByBodyPart } from '../../domain/muscles'
import { detectPr, setBeats, type PrKind, type SetValues } from './pr'

export type Outcome = 'progressed' | 'same' | 'lower' | 'first'

export interface ExerciseOutcome {
  exercise_id: string
  name: string
  outcome: Outcome
  /** Best working set this session, by load then reps. */
  best: SetValues | null
  /** Best working set of the previous session with this exercise. */
  previousBest: SetValues | null
  workingSets: number
  /** Every working set reached the top of the rep range: add one increment next time. */
  readyToAdd: boolean
  incrementG: number
}

export interface SummaryPr {
  exercise_id: string
  name: string
  kind: PrKind
  load_g: number
  reps: number
}

export interface SessionSummary {
  name: string
  durationS: number
  workingSets: number
  totalSets: number
  bodyParts: { part: BodyPart; sets: number }[]
  outcomes: ExerciseOutcome[]
  prs: SummaryPr[]
}

export interface SummaryInput {
  workout: Workout
  /** Every non-deleted set of the workout, any order. */
  sets: readonly WorkoutSet[]
  /** Completed working sets from OTHER workouts per exercise id, each with its workout id and completion time. */
  previous: Readonly<Record<string, readonly { workout_id: string; load_g: number; reps: number; completed_at: string }[]>>
  exercises: Readonly<Record<string, ExerciseIndexEntry>>
  /** Rep-range top and increment per exercise id, from the plan or the library. */
  targets: Readonly<Record<string, { repMax: number; incrementG: number }>>
  /** Clock used when finished_at is null. */
  now: string
}

export function bestOf(sets: readonly SetValues[]): SetValues | null {
  let best: SetValues | null = null
  for (const s of sets) {
    if (best === null || s.load_g > best.load_g || (s.load_g === best.load_g && s.reps > best.reps)) best = s
  }
  return best
}

function secondsBetween(a: string, b: string): number {
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000))
}

function orderedExerciseIds(sets: readonly WorkoutSet[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [...sets].sort((x, y) => x.set_index - y.set_index)) {
    if (!seen.has(s.exercise_id)) {
      seen.add(s.exercise_id)
      out.push(s.exercise_id)
    }
  }
  return out
}

export function buildSummary(input: SummaryInput): SessionSummary {
  const { workout, sets, previous, exercises, targets } = input
  const live = sets.filter((s) => s.deleted_at === null)
  const done = live.filter((s) => s.completed_at !== null && s.reps !== null)
  const working = done.filter((s) => s.kind === 'working')
  const totals = weeklySetsByBodyPart(done, exercises)
  const bodyParts = (Object.entries(totals) as [BodyPart, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([part, n]) => ({ part, sets: Math.round(n * 10) / 10 }))

  const outcomes: ExerciseOutcome[] = []
  const prs: SummaryPr[] = []
  for (const id of orderedExerciseIds(live)) {
    const entry = exercises[id]
    const name = entry?.name ?? id
    const mine = working
      .filter((s) => s.exercise_id === id)
      .sort((a, b) => a.set_index - b.set_index)
      .map((s) => ({ load_g: s.load_g ?? 0, reps: s.reps ?? 0 }))
    // An exercise with no logged working set is not part of the summary.
    if (mine.length === 0) continue
    const prev = previous[id] ?? []
    const best = bestOf(mine)
    // The previous session is the most recent other workout that logged this exercise.
    let previousBest: SetValues | null = null
    if (prev.length > 0) {
      const latest = [...prev].sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0]
      previousBest = bestOf(prev.filter((p) => p.workout_id === latest.workout_id).map((p) => ({ load_g: p.load_g, reps: p.reps })))
    }
    let outcome: Outcome = 'first'
    if (best && previousBest) {
      if (setBeats(previousBest, best)) outcome = 'progressed'
      else if (setBeats(best, previousBest)) outcome = 'lower'
      else outcome = 'same'
    } else if (best && prev.length === 0) outcome = 'first'
    else if (best) outcome = 'same'
    const t = targets[id] ?? { repMax: 12, incrementG: 2500 }
    const readyToAdd = mine.length > 0 && mine.every((s) => s.reps >= t.repMax) && entry?.loadType !== 'time'
    outcomes.push({ exercise_id: id, name, outcome, best, previousBest, workingSets: mine.length, readyToAdd, incrementG: t.incrementG })

    if (entry) {
      // Replay the session so each set competes with the ones before it; one badge per exercise in the summary.
      const history: SetValues[] = prev.map((p) => ({ load_g: p.load_g, reps: p.reps }))
      let top: SummaryPr | null = null
      const rank: Record<PrKind, number> = { first: 1, reps: 2, e1rm: 3, weight: 4 }
      for (const s of mine) {
        const kind = detectPr(s, history, entry.loadType)
        if (kind && (top === null || rank[kind] > rank[top.kind])) top = { exercise_id: id, name, kind, load_g: s.load_g, reps: s.reps }
        history.push(s)
      }
      if (top) prs.push(top)
    }
  }

  return {
    name: workout.plan?.name ?? workout.session_key,
    durationS: secondsBetween(workout.started_at, workout.finished_at ?? input.now),
    workingSets: working.length,
    totalSets: done.length,
    bodyParts,
    outcomes,
    prs,
  }
}
