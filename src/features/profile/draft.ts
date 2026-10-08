// The editable profile as the screens hold it: strings for typed fields,
// parsed and range-checked on demand. Onboarding keeps one draft in state;
// the You tab builds one from the saved profile.

import { formatDateKey, isDateKey, parseDateKey } from '../../domain/dates'
import { parseCmToMm, parseInteger, parseKgToG } from '../../domain/parse'
import type { ActivityLevel, DateKey, Goal, Profile, Sex, TrainingAge, Weekday } from '../../domain/types'
import { ageYearsOn } from './age'
import { computeLiveTargets, overrideProblem, type LiveTargets } from './liveTargets'

export interface ProfileDraft {
  sex: Sex
  birthDate: string
  heightCm: string
  weightKg: string
  activity: ActivityLevel
  goal: Goal
  trainingAge: TrainingAge
  daysPerWeek: number
  reviewWeekday: Weekday
  /** Empty string means "use the suggestion". */
  calorieOverride: string
  proteinDgPerKg: number
}

export const MIN_AGE = 14
export const MAX_AGE = 100
export const HEIGHT_MM_RANGE = [1200, 2300] as const
export const WEIGHT_G_RANGE = [30_000, 300_000] as const

export const DEFAULT_DRAFT: ProfileDraft = {
  sex: 'unspecified',
  birthDate: '',
  heightCm: '',
  weightKg: '',
  activity: 'moderate',
  goal: 'recomp',
  trainingAge: 'beginner',
  daysPerWeek: 4,
  reviewWeekday: 0,
  calorieOverride: '',
  proteinDgPerKg: 20,
}

export interface ParsedDraft {
  birthDate: DateKey | null
  heightMm: number | null
  weightG: number | null
  calorieOverrideKcal: number | null
}

export type DraftField = 'sex' | 'birthDate' | 'heightCm' | 'weightKg' | 'calorieOverride'

export interface DraftCheck {
  parsed: ParsedDraft
  /** One concrete line per field that blocks saving. */
  problems: Partial<Record<DraftField, string>>
}

/** The newest birth date the form accepts and the oldest, as day keys. */
export function birthDateBounds(today: DateKey): { min: DateKey; max: DateKey } {
  const t = parseDateKey(today)
  return {
    min: formatDateKey({ year: t.year - MAX_AGE, month: t.month, day: 1 }),
    max: formatDateKey({ year: t.year - MIN_AGE, month: t.month, day: Math.min(t.day, 28) }),
  }
}

export function checkDraft(d: ProfileDraft, today: DateKey, targets: Pick<LiveTargets, 'lowestSafeKcal'> | null): DraftCheck {
  const problems: DraftCheck['problems'] = {}

  let birthDate: DateKey | null = null
  if (d.birthDate.trim() !== '') {
    if (!isDateKey(d.birthDate)) problems.birthDate = 'Enter your birth date as day, month and year.'
    else {
      const age = ageYearsOn(d.birthDate, today)
      if (age < MIN_AGE) problems.birthDate = `This app is for ages ${MIN_AGE} and up. Check the year.`
      else if (age > MAX_AGE) problems.birthDate = 'Check the year of your birth date.'
      else birthDate = d.birthDate
    }
  }

  let heightMm: number | null = null
  if (d.heightCm.trim() !== '') {
    const mm = parseCmToMm(d.heightCm)
    if (mm === null || mm < HEIGHT_MM_RANGE[0] || mm > HEIGHT_MM_RANGE[1]) problems.heightCm = 'Enter your height in cm, between 120 and 230.'
    else heightMm = mm
  }

  let weightG: number | null = null
  if (d.weightKg.trim() !== '') {
    const g = parseKgToG(d.weightKg)
    if (g === null || g < WEIGHT_G_RANGE[0] || g > WEIGHT_G_RANGE[1]) problems.weightKg = 'Enter your weight in kg, between 30 and 300.'
    else weightG = g
  }

  let calorieOverrideKcal: number | null = null
  if (d.calorieOverride.trim() !== '') {
    const kcal = parseInteger(d.calorieOverride)
    const problem = kcal === null ? 'Use a whole number between 800 and 6000 kcal.' : overrideProblem(kcal, targets)
    if (problem) problems.calorieOverride = problem
    else calorieOverrideKcal = kcal
  }

  return { parsed: { birthDate, heightMm, weightG, calorieOverrideKcal }, problems }
}

/** What the primary button needs before it can save: the first missing item, as an action. */
export function nextMissing(check: DraftCheck, needWeight: boolean): string | null {
  if (check.problems.birthDate || !check.parsed.birthDate) return 'Add your birth date to continue.'
  if (check.problems.heightCm || !check.parsed.heightMm) return 'Add your height to continue.'
  if (needWeight && (check.problems.weightKg || !check.parsed.weightG)) return 'Add your weight to continue.'
  if (check.problems.calorieOverride) return check.problems.calorieOverride
  return null
}

/** The profile columns a draft decides. Everything else on the row is left alone. */
export function draftToProfilePatch(d: ProfileDraft, parsed: ParsedDraft): Partial<Profile> {
  return {
    sex: d.sex,
    birth_date: parsed.birthDate,
    height_mm: parsed.heightMm,
    activity_level: d.activity,
    goal: d.goal,
    training_age: d.trainingAge,
    training_days_per_week: d.daysPerWeek,
    review_weekday: d.reviewWeekday,
    calorie_override_kcal: parsed.calorieOverrideKcal,
    protein_dg_per_kg: d.proteinDgPerKg,
  }
}

export function profileToDraft(p: Profile, weightG: number | null): ProfileDraft {
  return {
    sex: p.sex,
    birthDate: p.birth_date ?? '',
    heightCm: p.height_mm === null ? '' : String(p.height_mm / 10),
    weightKg: weightG === null ? '' : String(weightG / 1000),
    activity: p.activity_level,
    goal: p.goal,
    trainingAge: p.training_age,
    daysPerWeek: p.training_days_per_week,
    reviewWeekday: p.review_weekday,
    calorieOverride: p.calorie_override_kcal === null ? '' : String(p.calorie_override_kcal),
    proteinDgPerKg: p.protein_dg_per_kg,
  }
}

export interface DraftEvaluation {
  check: DraftCheck
  targets: LiveTargets | null
}

/**
 * Parse a draft and compute its live targets. The override is checked
 * against the lowest safe number, which needs the targets, so the targets
 * are first computed without it.
 */
export function evaluateDraft(d: ProfileDraft, today: DateKey): DraftEvaluation {
  const first = checkDraft(d, today, null)
  const inputs = {
    sex: d.sex,
    birthDate: first.parsed.birthDate,
    heightMm: first.parsed.heightMm,
    weightG: first.parsed.weightG,
    activity: d.activity,
    goal: d.goal,
    trainingAge: d.trainingAge,
    proteinDgPerKg: d.proteinDgPerKg,
    today,
  }
  const base = computeLiveTargets({ ...inputs, calorieOverrideKcal: null })
  const check = checkDraft(d, today, base)
  const targets = computeLiveTargets({ ...inputs, calorieOverrideKcal: check.parsed.calorieOverrideKcal })
  return { check, targets }
}
