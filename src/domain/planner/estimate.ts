// Session time estimate (docs/SPEC-programming.md, time-boxing): general
// warm-up plus, per exercise, ramps (reps x 3 s plus the ramp rest), sets
// times (set time plus rest) and a 90 s transition. The second half of a
// superset pair shares the first half's rest and transition.

import type { ExerciseIndexEntry } from '../types'
import type { PlannedExercise, SessionPlan } from './contract'

export const SET_SECONDS_ISOLATION = 40
export const SET_SECONDS_COMPOUND = 45
export const RAMP_REP_SECONDS = 3
export const TRANSITION_SECONDS = 90

export function isCompoundPlanned(pe: PlannedExercise, exercises: Readonly<Record<string, ExerciseIndexEntry>>): boolean {
  if (pe.is_compound !== undefined) return pe.is_compound
  return exercises[pe.exercise_id]?.isCompound ?? false
}

/** True when this exercise is the later half of a superset pair in the plan. */
export function isSupersetSecond(pe: PlannedExercise, all: readonly PlannedExercise[]): boolean {
  if (pe.superset_with === null) return false
  const partner = all.find((p) => p.exercise_id === pe.superset_with)
  return partner !== undefined && partner.slot < pe.slot
}

export function exerciseSeconds(pe: PlannedExercise, compound: boolean, supersetSecond: boolean): number {
  let s = 0
  for (const r of pe.warmups) s += r.reps * RAMP_REP_SECONDS + r.rest_s
  const setTime = compound ? SET_SECONDS_COMPOUND : SET_SECONDS_ISOLATION
  if (supersetSecond) {
    s += pe.sets * setTime
  } else {
    s += pe.sets * (setTime + pe.rest_s) + TRANSITION_SECONDS
  }
  return s
}

export function planSeconds(
  general_minutes: number,
  exercisesPlanned: readonly PlannedExercise[],
  exercises: Readonly<Record<string, ExerciseIndexEntry>>,
): number {
  let s = general_minutes * 60
  for (const pe of exercisesPlanned) {
    s += exerciseSeconds(pe, isCompoundPlanned(pe, exercises), isSupersetSecond(pe, exercisesPlanned))
  }
  return s
}

export function estimateMinutes(plan: Pick<SessionPlan, 'general_warmup' | 'exercises'>, exercises: Readonly<Record<string, ExerciseIndexEntry>>): number {
  return Math.ceil(planSeconds(plan.general_warmup.minutes, plan.exercises, exercises) / 60)
}
