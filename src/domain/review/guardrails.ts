// Guardrails for everything the review says and every number the engine
// hands a screen (PLAN.md section 6). Tested beside the signals.

import type { Body } from '../calc/targets'
import { calorieFloorKcal, DEFICIT_CAP } from '../calc/targets'

/** Phrases no message may contain, matched case-insensitively. */
export const BANNED_PHRASES: readonly string[] = ['burns fat', 'boosts metabolism', 'detox', 'cures', 'negative', 'failed']

/** Condition names the copy never uses: the review describes numbers, never a diagnosis. */
export const CONDITION_NAMES: readonly string[] = [
  'diabetes',
  'diabetic',
  'obesity',
  'obese',
  'pcos',
  'thyroid',
  'hypertension',
  'anorexia',
  'bulimia',
  'depression',
  'cancer',
  'insulin resistance',
  'metabolic syndrome',
  'anaemia',
  'anemia',
  'osteoporosis',
]

/** The rate target never exceeds 1 percent of body weight per week. */
export const RATE_TARGET_CAP_PCT_PER_WEEK = 1.0

/** Loss faster than this for two check-ins reads slow down, whatever the goal. */
export const SLOW_DOWN_PCT_PER_WEEK = 1.5

/** Logged intake under the floor on this many days triggers a logging check instead of praise. */
export const UNDER_FLOOR_DAYS = 3

export interface CopyProblem {
  text: string
  reason: string
}

function containsPhrase(text: string, phrase: string): boolean {
  const re = new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i')
  return re.test(text)
}

/** The first banned phrase or condition name in the text, or null. */
export function bannedPhraseIn(text: string): string | null {
  for (const p of BANNED_PHRASES) if (containsPhrase(text, p)) return p
  for (const c of CONDITION_NAMES) if (containsPhrase(text, c)) return c
  return null
}

/** True when the text names at least one number (a digit). */
export function namesANumber(text: string): boolean {
  return /\d/.test(text)
}

/**
 * Every problem with one message. Attention copy may not carry an
 * exclamation mark; every message names a number; nothing uses a banned
 * phrase or a condition name; the text ends in a full stop.
 */
export function copyProblems(text: string, attention: boolean): CopyProblem[] {
  const problems: CopyProblem[] = []
  const banned = bannedPhraseIn(text)
  if (banned) problems.push({ text, reason: `banned phrase: ${banned}` })
  if (attention && text.includes('!')) problems.push({ text, reason: 'exclamation mark on an attention item' })
  if (!namesANumber(text)) problems.push({ text, reason: 'names no number' })
  if (!/[.]$/.test(text.trim())) problems.push({ text, reason: 'does not end in a full stop' })
  return problems
}

/** Clamp a rate target in percent per week to the 1 percent cap (loss is negative). */
export function clampRateTarget(ratePctPerWeek: number): number {
  const cap = RATE_TARGET_CAP_PCT_PER_WEEK
  return Math.max(-cap, Math.min(cap, ratePctPerWeek))
}

/** Clamp a deficit fraction to the 25 percent cap; surpluses pass through. */
export function clampDeficit(fraction: number): number {
  return Math.min(fraction, DEFICIT_CAP)
}

/** A calorie target is never under the floor (the larger of BMR and the sex floor). */
export function guardCalorieTarget(target: number, body: Body): { target: number; floored: boolean } {
  const floor = calorieFloorKcal(body)
  return target < floor ? { target: floor, floored: true } : { target, floored: false }
}

/**
 * Days whose logged energy sits under the floor. Three or more mean a
 * logging check, never praise: the record is more likely incomplete than the
 * intake that low.
 */
export function daysUnderFloor(kcalByDay: Readonly<Record<string, number>>, floorKcal: number): string[] {
  return Object.keys(kcalByDay)
    .filter((d) => kcalByDay[d] > 0 && kcalByDay[d] < floorKcal)
    .sort()
}

export function loggingCheckNeeded(kcalByDay: Readonly<Record<string, number>>, floorKcal: number): boolean {
  return daysUnderFloor(kcalByDay, floorKcal).length >= UNDER_FLOOR_DAYS
}
