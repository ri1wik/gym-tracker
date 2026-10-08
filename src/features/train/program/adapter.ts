// The one adapter between this slice and the engine stubs. Each function
// calls the real engine; while that engine still throws 'not implemented' it
// returns a small local answer typed as the contract's output. At
// integration, delete the catch and the engine's output flows through.

import { EXERCISES_BY_ID } from '../../../data/library/exercise-index'
import type { Recommendation, RecommendInput } from '../../../domain/programs/recommender'
import { recommendSplit } from '../../../domain/programs/recommender'
import {
  buildCustomSession,
  deloadStatus,
  nextSession,
  prescribe,
  type DeloadStatus,
  type EquipmentProfile,
  type History,
  type HistorySet,
  type NextSessionResult,
  type PlannerContext,
  type Prescription,
  type ProgramState,
  type SessionMinutes,
  type SessionPlan,
} from '../../../domain/planner/index'
import type { DateKey, TemplateDay, TemplateItem } from '../../../domain/types'
import { trainingWeek, isReturnAfterGap, lastFinishedOn, nextTemplateDay } from './rotation'

export function isNotImplemented(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('not implemented')
}

function attempt<T>(real: () => T, fallback: () => T): T {
  try {
    return real()
  } catch (e) {
    if (!isNotImplemented(e)) console.warn('planner call fell back after an error', e)
    return fallback()
  }
}

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------

export function resolveNext(state: ProgramState, history: History, today: DateKey): NextSessionResult {
  return attempt(
    () => nextSession(state, history, today),
    () => {
      const next = nextTemplateDay(state.template, state.pointer, state.pins, today)
      const back = isReturnAfterGap(lastFinishedOn(history.workouts.map((w) => ({ ...w, status: w.finished_at ? 'finished' : 'in_progress', deleted_at: null }))), today)
      return {
        day: next.day,
        index: next.index,
        rotation_effect: next.pinned ? 'pinned' : 'advances',
        first_session_back: back,
        reason: next.pinned ? 'Pinned to this weekday.' : 'Next in the rotation.',
      }
    },
  )
}

export interface DeloadView {
  /** 1-based week since the last deload. */
  week: number
  everyWeeks: number
  due: boolean
  reason: DeloadStatus['reason']
}

export function resolveDeload(state: ProgramState, history: History, today: DateKey, startedOn: DateKey): DeloadView {
  return attempt(
    (): DeloadView => {
      const s = deloadStatus(state, history, today)
      return { week: s.week_index + 1, everyWeeks: s.every_weeks, due: s.due, reason: s.reason }
    },
    (): DeloadView => {
      const week = trainingWeek(state.deload, startedOn, today)
      const due = !state.deload.active && week > state.deload.every_weeks
      return { week, everyWeeks: state.deload.every_weeks, due, reason: due ? 'schedule' : null }
    },
  )
}

// ---------------------------------------------------------------------------
// Recommender
// ---------------------------------------------------------------------------

/** The recommendation, or null while the engine is a stub (the UI then shows the five-split list). */
export function recommend(input: RecommendInput): Recommendation | null {
  try {
    return recommendSplit(input)
  } catch (e) {
    if (!isNotImplemented(e)) console.warn('recommender fell back after an error', e)
    return null
  }
}

// ---------------------------------------------------------------------------
// Session plan
// ---------------------------------------------------------------------------

export function planForDay(
  day: TemplateDay,
  minutes: SessionMinutes,
  today: DateKey,
  ctx: PlannerContext,
): SessionPlan | null {
  try {
    const plan = buildCustomSession(
      {
        focus: { kind: 'template_day', day_key: day.key },
        minutes,
        intent: 'normal',
        exclude_exercise_ids: [],
        exclude_families: [],
        date_key: today,
      },
      ctx,
    )
    return plan.exercises.length > 0 ? plan : null
  } catch (e) {
    if (!isNotImplemented(e)) console.warn('session plan fell back after an error', e)
    return null
  }
}

export interface Target {
  target_reps: number[]
  target_load_g: number | null
  assist_g: number
}

/** The last completed working set of an exercise, newest first input. */
export function lastWorkingSet(sets: readonly HistorySet[] | undefined): HistorySet | null {
  if (!sets) return null
  for (const s of sets) if (s.kind === 'working') return s
  return null
}

/**
 * Targets for one template item: the planner's prescription when it works,
 * else the last completed working set of that exercise, else nothing
 * (reps at the bottom of the range, no load).
 */
export function targetFor(
  item: TemplateItem,
  sets: number,
  setsOfExercise: readonly HistorySet[] | undefined,
  opts: { equipment: EquipmentProfile; deload: boolean; firstSessionBack: boolean },
): Target {
  const entry = EXERCISES_BY_ID[item.exercise_id]
  if (entry) {
    let p: Prescription | null = null
    try {
      p = prescribe({
        exercise: entry,
        history: [...(setsOfExercise ?? [])],
        sets,
        rep_min: item.rep_min,
        rep_max: item.rep_max,
        equipment: opts.equipment,
        deload: opts.deload,
        first_session_back: opts.firstSessionBack,
        intent: 'normal',
      })
    } catch (e) {
      if (!isNotImplemented(e)) console.warn('prescription fell back after an error', e)
    }
    if (p) {
      const reps = p.target_reps.length === sets ? p.target_reps : Array.from({ length: sets }, () => p.target_reps[0] ?? item.rep_min)
      return { target_reps: reps, target_load_g: p.target_load_g, assist_g: p.assist_g }
    }
  }
  const last = lastWorkingSet(setsOfExercise)
  if (last) {
    return {
      target_reps: Array.from({ length: sets }, () => Math.min(Math.max(last.reps, item.rep_min), item.rep_max)),
      target_load_g: last.load_g,
      assist_g: last.assist_g,
    }
  }
  return { target_reps: Array.from({ length: sets }, () => item.rep_min), target_load_g: null, assist_g: 0 }
}
