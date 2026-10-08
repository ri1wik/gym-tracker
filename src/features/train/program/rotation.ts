// Pure rotation helpers for the Program screen and Home: which template day
// is next, how a date reads, how many sessions count this week. No database,
// no React. Day keys only ever go through ../../../domain/dates.

import { addDays, diffDays, parseDateKey, weekdayOf, weekStart } from '../../../domain/dates'
import type { DateKey, DeloadState, Template, TemplateDay, Weekday, Workout } from '../../../domain/types'

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** A gap of this many days or more makes the next session a "back after a break" one (PLAN.md 3.4). */
export const RETURN_GAP_DAYS = 10

export interface NextDay {
  index: number
  day: TemplateDay
  /** True when a weekday pin chose it. */
  pinned: boolean
}

/**
 * The next template day: the pin for today's weekday if there is one, else
 * the day after the last completed one. Rest days and skips never move the
 * pointer, so this is a pure function of (pointer, pins, today).
 */
export function nextTemplateDay(
  template: Template,
  pointer: number,
  pins: Partial<Record<Weekday, string>>,
  today: DateKey,
): NextDay {
  const n = template.days.length
  if (n === 0) throw new Error(`template ${template.key} has no days`)
  const pinKey = pins[weekdayOf(today)]
  if (pinKey) {
    const at = template.days.findIndex((d) => d.key === pinKey)
    if (at >= 0) return { index: at, day: template.days[at]!, pinned: true }
  }
  const index = (((pointer + 1) % n) + n) % n
  return { index, day: template.days[index]!, pinned: false }
}

export function isReturnAfterGap(lastFinished: DateKey | null, today: DateKey): boolean {
  return lastFinished !== null && diffDays(lastFinished, today) >= RETURN_GAP_DAYS
}

/** 'Tuesday' within the last week, 'today', 'yesterday', else '12 Sep'. */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const gap = diffDays(key, today)
  if (gap === 0) return 'today'
  if (gap === 1) return 'yesterday'
  if (gap > 1 && gap < 7) return WEEKDAY_NAMES[weekdayOf(key)]!
  const { month, day } = parseDateKey(key)
  return `${day} ${MONTH_SHORT[month - 1]}`
}

export interface FinishedLike {
  session_key: string
  planned_on: DateKey
  status: Workout['status']
  deleted_at: string | null
}

export function isFinished(w: FinishedLike): boolean {
  return w.status === 'finished' && w.deleted_at === null
}

/** Latest finished workout day for a session key, or null. */
export function lastDoneOn(workouts: readonly FinishedLike[], sessionKey: string): DateKey | null {
  let best: DateKey | null = null
  for (const w of workouts) {
    if (!isFinished(w) || w.session_key !== sessionKey) continue
    if (best === null || w.planned_on > best) best = w.planned_on
  }
  return best
}

export function lastFinishedOn(workouts: readonly FinishedLike[]): DateKey | null {
  let best: DateKey | null = null
  for (const w of workouts) {
    if (!isFinished(w)) continue
    if (best === null || w.planned_on > best) best = w.planned_on
  }
  return best
}

/** Finished sessions whose day falls in the week that holds `today`. */
export function sessionsThisWeek(workouts: readonly FinishedLike[], today: DateKey, weekStartsOn: Weekday): number {
  const first = weekStart(today, weekStartsOn)
  const last = addDays(first, 6)
  let n = 0
  for (const w of workouts) {
    if (isFinished(w) && w.planned_on >= first && w.planned_on <= last) n += 1
  }
  return n
}

/**
 * Starting weekday pins. On for fixed splits (upper/lower, full body,
 * minimal), off for the PPL rotations, as PLAN.md 3.4 says. The days land on
 * a spread of weekdays in template order; the user edits them on the Program
 * screen.
 */
export function defaultPins(template: Template): Partial<Record<Weekday, string>> {
  const spread: Record<string, Weekday[]> = {
    upper_lower_4: [1, 2, 4, 5],
    full_body_3: [1, 3, 5],
    minimal_2: [1, 4],
  }
  const slots = spread[template.split]
  if (!slots) return {}
  const pins: Partial<Record<Weekday, string>> = {}
  template.days.forEach((d, i) => {
    const wd = slots[i]
    if (wd !== undefined) pins[wd] = d.key
  })
  return pins
}

/** Weekdays for the pin editor, starting on the user's first day of the week. */
export function weekdayOrder(weekStartsOn: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, i) => ((weekStartsOn + i) % 7) as Weekday)
}

/** 1-based training week since the last deload (or the program start). */
export function trainingWeek(deload: DeloadState, startedOn: DateKey, today: DateKey): number {
  const base = deload.last_deload_on ?? startedOn
  const gap = Math.max(0, diffDays(base, today))
  return Math.floor(gap / 7) + 1
}

/** Set count under a deload: half the sets, at least one. */
export function deloadSets(sets: number): number {
  return Math.max(1, Math.ceil(sets / 2))
}
