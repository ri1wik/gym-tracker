// Targets: basal rate, maintenance, calorie and protein targets.
// Pure functions. Canonical units in: grams and millimetres. Out: kcal and grams.
// No React, no database, no network in this module.

export type Sex = 'male' | 'female' | 'unspecified'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'
export type Goal = 'recomp' | 'fat_loss' | 'lean_gain' | 'maintain'
export type TrainingAge = 'beginner' | 'intermediate' | 'advanced'

// The multiplier means total weekly activity INCLUDING training.
export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}

export const PROTEIN_G_PER_KG_DEFAULT = 2.0
export const PROTEIN_G_PER_KG_MIN = 1.6
export const PROTEIN_G_PER_KG_MAX = 2.4
export const DEFICIT_CAP = 0.25
export const KCAL_PER_KG_FAT = 7700
export const CALORIE_FLOOR_FEMALE = 1200
export const CALORIE_FLOOR_MALE = 1500
export const CALORIE_FLOOR_UNSPECIFIED = 1350

export interface Body {
  sex: Sex
  ageYears: number
  heightMm: number
  weightG: number
}

/** Mifflin-St Jeor. 'unspecified' averages the male and female formulas. */
export function bmrKcal(b: Body): number {
  const kg = b.weightG / 1000
  const cm = b.heightMm / 10
  const base = 10 * kg + 6.25 * cm - 5 * b.ageYears
  if (b.sex === 'male') return base + 5
  if (b.sex === 'female') return base - 161
  return base - 78
}

export function tdeeKcal(b: Body, activity: ActivityLevel): number {
  return bmrKcal(b) * ACTIVITY_MULTIPLIER[activity]
}

/** Deficit (positive) or surplus (negative) fraction of maintenance by goal and training age. */
export function targetAdjustment(goal: Goal, trainingAge: TrainingAge): number {
  switch (goal) {
    case 'recomp':
      return trainingAge === 'advanced' ? 0.075 : 0.15
    case 'fat_loss':
      return 0.2
    case 'lean_gain':
      return -0.075
    case 'maintain':
      return 0
  }
}

export function calorieFloorKcal(b: Body): number {
  const floor =
    b.sex === 'male' ? CALORIE_FLOOR_MALE : b.sex === 'female' ? CALORIE_FLOOR_FEMALE : CALORIE_FLOOR_UNSPECIFIED
  return Math.max(bmrKcal(b), floor)
}

export interface CalorieTarget {
  tdee: number
  /** before rounding and floors, for tests and display of the raw number */
  raw: number
  /** rounded to 50 kcal, floored, deficit capped */
  target: number
  floored: boolean
}

export function calorieTarget(b: Body, activity: ActivityLevel, goal: Goal, trainingAge: TrainingAge): CalorieTarget {
  const tdee = tdeeKcal(b, activity)
  const adj = Math.min(targetAdjustment(goal, trainingAge), DEFICIT_CAP)
  const raw = tdee * (1 - adj)
  const floor = calorieFloorKcal(b)
  const floored = raw < floor
  const target = Math.round(Math.max(raw, floor) / 50) * 50
  return { tdee, raw, target, floored }
}

/** Weight at BMI 30 for the height, in grams. Protein is computed on min(actual, this). */
export function bmi30WeightG(heightMm: number): number {
  const m = heightMm / 1000
  return Math.round(30 * m * m * 1000)
}

export function proteinTargetG(b: Body, gPerKg: number = PROTEIN_G_PER_KG_DEFAULT): number {
  const perKg = Math.min(Math.max(gPerKg, PROTEIN_G_PER_KG_MIN), PROTEIN_G_PER_KG_MAX)
  const refG = Math.min(b.weightG, bmi30WeightG(b.heightMm))
  return Math.round((refG / 1000) * perKg)
}

/** Expected weight change per week from a daily energy gap, in grams (negative = loss). Short windows only. */
export function expectedWeeklyChangeG(dailyGapKcal: number): number {
  return Math.round((dailyGapKcal * 7) / KCAL_PER_KG_FAT * 1000)
}
