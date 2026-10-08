// The one adapter between this slice and the planner engine. Each function
// calls the real engine and reshapes the answer for the screens; nothing in
// here falls back, the engine's output flows through.

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
  type ProgramState,
  type SessionMinutes,
  type SessionPlan,
} from '../../../domain/planner/index'
import type { DateKey, TemplateDay, TemplateItem } from '../../../domain/types'

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------

export function resolveNext(state: ProgramState, history: History, today: DateKey): NextSessionResult {
  return nextSession(state, history, today)
}

export interface DeloadView {
  /** 1-based week since the last deload. */
  week: number
  everyWeeks: number
  due: boolean
  reason: DeloadStatus['reason']
}

export function resolveDeload(state: ProgramState, history: History, today: DateKey): DeloadView {
  const s = deloadStatus(state, history, today)
  return { week: s.week_index + 1, everyWeeks: s.every_weeks, due: s.due, reason: s.reason }
}

// ---------------------------------------------------------------------------
// Recommender
// ---------------------------------------------------------------------------

export function recommend(input: RecommendInput): Recommendation {
  return recommendSplit(input)
}

// ---------------------------------------------------------------------------
// Session plan
// ---------------------------------------------------------------------------

/** The planner's plan for a template day, or null when it comes back empty. */
export function planForDay(day: TemplateDay, minutes: SessionMinutes, today: DateKey, ctx: PlannerContext): SessionPlan | null {
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
 * Targets for one template item through the prescription rules; an exercise
 * the index does not know falls to the last completed working set, else
 * reps at the bottom of the range with no load.
 */
export function targetFor(
  item: TemplateItem,
  sets: number,
  setsOfExercise: readonly HistorySet[] | undefined,
  opts: { equipment: EquipmentProfile; deload: boolean; firstSessionBack: boolean },
): Target {
  const entry = EXERCISES_BY_ID[item.exercise_id]
  if (entry) {
    const p = prescribe({
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
    const reps = p.target_reps.length === sets ? p.target_reps : Array.from({ length: sets }, () => p.target_reps[0] ?? item.rep_min)
    return { target_reps: reps, target_load_g: p.target_load_g, assist_g: p.assist_g }
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
