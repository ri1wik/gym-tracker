// Live targets for the profile screens: the pure calc module's numbers put
// into the shape the UI prints. Everything here is a suggestion the person
// accepts or overrides; nothing is applied on its own.

import {
  DEFICIT_CAP,
  bmi30WeightG,
  bmrKcal,
  calorieFloorKcal,
  calorieTarget,
  expectedWeeklyChangeG,
  proteinTargetG,
  tdeeKcal,
  type ActivityLevel,
  type Body,
  type Goal,
  type Sex,
  type TrainingAge,
} from '../../domain/calc/targets'
import type { DateKey } from '../../domain/types'
import { ageYearsOn } from './age'

export interface TargetInputs {
  sex: Sex
  birthDate: DateKey | null
  heightMm: number | null
  weightG: number | null
  activity: ActivityLevel
  goal: Goal
  trainingAge: TrainingAge
  /** Decigrams per kg: 20 is 2.0 g per kg. */
  proteinDgPerKg: number
  calorieOverrideKcal: number | null
  today: DateKey
}

export interface LiveTargets {
  ageYears: number
  bmr: number
  tdee: number
  /** The suggestion, rounded to 50 and floored. */
  suggestedKcal: number
  floored: boolean
  /** The lowest number the app accepts as an override for this body. */
  lowestSafeKcal: number
  /** Override when set, otherwise the suggestion. */
  targetKcal: number
  overridden: boolean
  proteinG: number
  /** True when the protein number is computed on the BMI 30 weight rather than the scale weight. */
  proteinOnCappedWeight: boolean
  /** Expected change in grams per week at the target (below zero is loss). */
  weeklyChangeG: number
}

/** Null until sex, birth date, height and weight are all usable. */
export function computeLiveTargets(i: TargetInputs): LiveTargets | null {
  if (!i.birthDate || !i.heightMm || !i.weightG) return null
  const ageYears = ageYearsOn(i.birthDate, i.today)
  if (ageYears < 0) return null
  const body: Body = { sex: i.sex, ageYears, heightMm: i.heightMm, weightG: i.weightG }
  const bmr = bmrKcal(body)
  const tdee = tdeeKcal(body, i.activity)
  const cal = calorieTarget(body, i.activity, i.goal, i.trainingAge)
  const lowestSafeKcal = Math.ceil(Math.max(calorieFloorKcal(body), tdee * (1 - DEFICIT_CAP)) / 50) * 50
  const overridden = i.calorieOverrideKcal !== null
  const targetKcal = i.calorieOverrideKcal ?? cal.target
  // Before rounding and floors when the suggestion is in force, so the plan's
  // worked example (a 411 kcal gap, 0.37 kg a week) reads exactly.
  const effective = overridden ? targetKcal : cal.floored ? cal.target : cal.raw
  const weeklyChangeG = expectedWeeklyChangeG(effective - tdee)
  const perKg = i.proteinDgPerKg / 10
  return {
    ageYears,
    bmr,
    tdee,
    suggestedKcal: cal.target,
    floored: cal.floored,
    lowestSafeKcal,
    targetKcal,
    overridden,
    proteinG: proteinTargetG(body, perKg),
    proteinOnCappedWeight: i.weightG > bmi30WeightG(i.heightMm),
    weeklyChangeG,
  }
}

/** Is an override acceptable? Returns a one-line fix when it is not. */
export function overrideProblem(kcal: number, t: Pick<LiveTargets, 'lowestSafeKcal'> | null): string | null {
  if (!Number.isInteger(kcal) || kcal < 800 || kcal > 6000) return 'Use a whole number between 800 and 6000 kcal.'
  if (t && kcal < t.lowestSafeKcal) {
    return `That is under the lowest safe number for you, ${t.lowestSafeKcal} kcal. Pick ${t.lowestSafeKcal} or more, or use the suggestion.`
  }
  return null
}
