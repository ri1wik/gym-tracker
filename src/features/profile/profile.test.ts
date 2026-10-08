import { describe, expect, it } from 'vitest'
import { ageYearsOn } from './age'
import { birthDateBounds, checkDraft, DEFAULT_DRAFT, draftToProfilePatch, evaluateDraft, nextMissing, profileToDraft, type ProfileDraft } from './draft'
import { formatDayMonth, formatDayShort, formatMinuteOfDay, formatSignedCm, formatSignedKg, kg1, parseTimeInput } from './format'
import { computeLiveTargets, overrideProblem } from './liveTargets'
import { newProfileBase } from './repo'
import type { Profile } from '../../domain/types'

const TODAY = '2026-10-08'

// The plan's worked example: male, 30, 178 cm, 80 kg, moderate activity.
const owner: ProfileDraft = {
  ...DEFAULT_DRAFT,
  sex: 'male',
  birthDate: '1996-10-08',
  heightCm: '178',
  weightKg: '80',
  activity: 'moderate',
  goal: 'recomp',
  trainingAge: 'intermediate',
}

describe('age', () => {
  it('counts whole years from the integer parts', () => {
    expect(ageYearsOn('1996-10-08', '2026-10-08')).toBe(30)
    expect(ageYearsOn('1996-10-09', '2026-10-08')).toBe(29)
    expect(ageYearsOn('1996-11-01', '2026-10-08')).toBe(29)
    expect(ageYearsOn('2000-02-29', '2026-02-28')).toBe(25)
  })
})

describe('live targets', () => {
  it('reproduces the plan worked example', () => {
    const { targets } = evaluateDraft(owner, TODAY)
    expect(targets).not.toBeNull()
    expect(targets!.ageYears).toBe(30)
    expect(targets!.bmr).toBeCloseTo(1767.5, 5)
    expect(targets!.tdee).toBeCloseTo(2739.6, 0)
    expect(targets!.suggestedKcal).toBe(2350)
    expect(targets!.targetKcal).toBe(2350)
    expect(targets!.overridden).toBe(false)
    expect(targets!.proteinG).toBe(160)
    // 411 kcal a day below maintenance is 0.37 kg a week, shown as a loss.
    expect(targets!.weeklyChangeG).toBe(-374)
  })

  it('has no numbers until birth date, height and weight all parse', () => {
    expect(evaluateDraft({ ...owner, heightCm: '' }, TODAY).targets).toBeNull()
    expect(evaluateDraft({ ...owner, weightKg: '8o' }, TODAY).targets).toBeNull()
    expect(evaluateDraft({ ...owner, birthDate: '' }, TODAY).targets).toBeNull()
  })

  it('accepts a decimal comma in height and weight', () => {
    const { targets, check } = evaluateDraft({ ...owner, heightCm: '178,5', weightKg: '80,5' }, TODAY)
    expect(check.parsed.heightMm).toBe(1785)
    expect(check.parsed.weightG).toBe(80_500)
    expect(targets).not.toBeNull()
  })

  it('a valid override replaces the suggestion and moves the expected change', () => {
    const { targets, check } = evaluateDraft({ ...owner, calorieOverride: '2500' }, TODAY)
    expect(check.problems.calorieOverride).toBeUndefined()
    expect(targets!.overridden).toBe(true)
    expect(targets!.targetKcal).toBe(2500)
    expect(targets!.suggestedKcal).toBe(2350)
    expect(targets!.weeklyChangeG).toBeGreaterThan(-374)
  })

  it('refuses an override under the lowest safe number and names it', () => {
    const { targets, check } = evaluateDraft({ ...owner, calorieOverride: '1500' }, TODAY)
    expect(targets!.lowestSafeKcal).toBe(2100)
    expect(check.problems.calorieOverride).toContain('2100')
    expect(check.parsed.calorieOverrideKcal).toBeNull()
    expect(targets!.overridden).toBe(false)
  })

  it('protein follows the grams-per-kg setting and the BMI 30 cap', () => {
    const lighter = evaluateDraft({ ...owner, proteinDgPerKg: 16 }, TODAY).targets!
    expect(lighter.proteinG).toBe(128)
    const heavy = evaluateDraft({ ...owner, heightCm: '170', weightKg: '110' }, TODAY).targets!
    expect(heavy.proteinOnCappedWeight).toBe(true)
    expect(heavy.proteinG).toBe(Math.round(0.001 * 30 * 1.7 * 1.7 * 1000 * 2))
  })

  it('runs the female, unspecified and lean gain branches', () => {
    const f = evaluateDraft({ ...owner, sex: 'female', heightCm: '162', weightKg: '58', birthDate: '1998-03-01' }, TODAY).targets!
    expect(f.bmr).toBeCloseTo(10 * 58 + 6.25 * 162 - 5 * 28 - 161, 5)
    const u = evaluateDraft({ ...owner, sex: 'unspecified' }, TODAY).targets!
    expect(u.bmr).toBeCloseTo(1767.5 - 83, 5)
    const g = evaluateDraft({ ...owner, goal: 'lean_gain' }, TODAY).targets!
    expect(g.targetKcal).toBeGreaterThan(g.tdee)
    expect(g.weeklyChangeG).toBeGreaterThan(0)
  })

  it('overrideProblem rejects absurd numbers without needing targets', () => {
    expect(overrideProblem(100, null)).not.toBeNull()
    expect(overrideProblem(9000, null)).not.toBeNull()
    expect(overrideProblem(2200, null)).toBeNull()
    expect(computeLiveTargets({ sex: 'male', birthDate: null, heightMm: 1780, weightG: 80_000, activity: 'light', goal: 'maintain', trainingAge: 'beginner', proteinDgPerKg: 20, calorieOverrideKcal: null, today: TODAY })).toBeNull()
  })
})

describe('draft checks', () => {
  it('flags each bad field with a line that says what to enter', () => {
    const { problems } = checkDraft({ ...owner, heightCm: '17', weightKg: '800', birthDate: '2020-01-01' }, TODAY, null)
    expect(problems.heightCm).toContain('120 and 230')
    expect(problems.weightKg).toContain('30 and 300')
    expect(problems.birthDate).toContain('14')
  })

  it('the date picker bounds stay inside the accepted ages', () => {
    const b = birthDateBounds(TODAY)
    expect(ageYearsOn(b.max, TODAY)).toBeGreaterThanOrEqual(14)
    expect(ageYearsOn(b.min, TODAY)).toBeLessThanOrEqual(100)
  })

  it('names the next missing thing as an action', () => {
    const empty = checkDraft(DEFAULT_DRAFT, TODAY, null)
    expect(nextMissing(empty, true)).toBe('Add your birth date to continue.')
    const noWeight = checkDraft({ ...owner, weightKg: '' }, TODAY, null)
    expect(nextMissing(noWeight, true)).toBe('Add your weight to continue.')
    expect(nextMissing(noWeight, false)).toBeNull()
    expect(nextMissing(checkDraft(owner, TODAY, null), true)).toBeNull()
  })

  it('round trips a profile through a draft', () => {
    const base = newProfileBase('u1')
    const profile: Profile = {
      ...base,
      sex: 'female',
      birth_date: '1998-03-01',
      height_mm: 1625,
      goal: 'lean_gain',
      calorie_override_kcal: 2300,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
      version: 1,
      deleted_at: null,
      dirty: 1,
    }
    const draft = profileToDraft(profile, 58_400)
    expect(draft.heightCm).toBe('162.5')
    expect(draft.weightKg).toBe('58.4')
    const { check } = evaluateDraft(draft, TODAY)
    const patch = draftToProfilePatch(draft, check.parsed)
    expect(patch.height_mm).toBe(1625)
    expect(patch.birth_date).toBe('1998-03-01')
    expect(patch.goal).toBe('lean_gain')
    expect(patch.calorie_override_kcal).toBe(2300)
  })

  it('new profiles default to the documented values', () => {
    const p = newProfileBase('u1')
    expect(p.cardio_target_s).toBe(9000)
    expect(p.protein_dg_per_kg).toBe(20)
    expect(p.review_weekday).toBe(0)
    expect(p.review_minute_of_day).toBe(1080)
    expect(p.checkin_interval_days).toBe(4)
    expect(p.onboarding_done).toBe(false)
  })
})

describe('format', () => {
  it('formats day keys from their parts', () => {
    expect(formatDayMonth('2026-10-08')).toBe('8 Oct')
    expect(formatDayShort('2026-10-08')).toBe('Thu 8 Oct')
    expect(formatDayShort('2026-12-31')).toBe('Thu 31 Dec')
  })
  it('formats and parses clock times', () => {
    expect(formatMinuteOfDay(420)).toBe('07:00')
    expect(formatMinuteOfDay(1080)).toBe('18:00')
    expect(parseTimeInput('07:30')).toBe(450)
    expect(parseTimeInput('24:00')).toBeNull()
    expect(parseTimeInput('7:5')).toBeNull()
  })
  it('signs changes with one decimal', () => {
    expect(formatSignedKg(400)).toBe('+0.4')
    expect(formatSignedKg(-400)).toBe('-0.4')
    expect(formatSignedKg(20)).toBe('0.0')
    expect(formatSignedCm(-10)).toBe('-1.0')
    expect(kg1(82_400)).toBe('82.4')
  })
})
