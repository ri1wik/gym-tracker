// Day keys. A day key is the LOCAL calendar date as 'YYYY-MM-DD'. Every
// helper here works on the integer parts of that string, so no helper ever
// does `new Date('YYYY-MM-DD')` (which parses as UTC midnight and shifts a day
// in any zone west of Greenwich) and none divides milliseconds by 86400000
// (which miscounts across a DST change).

import type { DateKey, Weekday } from './types'

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export interface DateParts {
  year: number
  /** 1 to 12 */
  month: number
  /** 1 to 31 */
  day: number
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function isDateKey(s: unknown): s is DateKey {
  if (typeof s !== 'string' || !KEY_RE.test(s)) return false
  const { year, month, day } = parseDateKey(s)
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= daysInMonth(year, month)
}

export function parseDateKey(key: DateKey): DateParts {
  const m = KEY_RE.exec(key)
  if (!m) throw new Error(`not a day key: ${key}`)
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
}

export function formatDateKey(p: DateParts): DateKey {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one. Month is 1-based here,
  // so `month` as the 0-based argument already means "next month".
  return new Date(year, month, 0).getDate()
}

/**
 * The local day key of a Date (or now). This is the ONLY place a Date turns
 * into a key. It reads the local components, so 00:30 on a Monday is Monday
 * even when UTC still says Sunday.
 */
export function localDateKey(date: Date = new Date()): DateKey {
  return formatDateKey({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })
}

/**
 * Days since 1970-01-01 in a proleptic Gregorian calendar, computed from the
 * integer parts only. Pure arithmetic, no Date, no zone.
 */
export function dayNumber(key: DateKey): number {
  const { year, month, day } = parseDateKey(key)
  // Howard Hinnant's days_from_civil.
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor((y >= 0 ? y : y - 399) / 400)
  const yoe = y - era * 400
  const mp = (month + 9) % 12
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Inverse of dayNumber. */
export function keyFromDayNumber(z: number): DateKey {
  // Howard Hinnant's civil_from_days.
  z += 719468
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return formatDateKey({ year: m <= 2 ? y + 1 : y, month: m, day: d })
}

/** key plus n calendar days (n may be negative). */
export function addDays(key: DateKey, n: number): DateKey {
  if (!Number.isInteger(n)) throw new Error(`addDays needs an integer, got ${n}`)
  return keyFromDayNumber(dayNumber(key) + n)
}

/** Calendar days from keyA to keyB (positive when keyB is later). */
export function diffDays(keyA: DateKey, keyB: DateKey): number {
  return dayNumber(keyB) - dayNumber(keyA)
}

/** Weekday of a key, 0 Sunday to 6 Saturday. 1970-01-01 was a Thursday (4). */
export function weekdayOf(key: DateKey): Weekday {
  const w = (((dayNumber(key) + 4) % 7) + 7) % 7
  return w as Weekday
}

/** The key of the week's first day (on or before key) for a week that starts on weekStartsOn. */
export function weekStart(key: DateKey, weekStartsOn: Weekday): DateKey {
  const back = (weekdayOf(key) - weekStartsOn + 7) % 7
  return addDays(key, -back)
}

/**
 * ISO 8601 week key, 'YYYY-Www', weeks starting Monday, week 1 holds the
 * first Thursday. Used for grouping only; the review uses weekStart().
 */
export function isoWeekKey(key: DateKey): string {
  const dn = dayNumber(key)
  // ISO weekday: Monday 1 to Sunday 7.
  const isoWd = ((weekdayOf(key) + 6) % 7) + 1
  // The Thursday of this ISO week decides the ISO year.
  const thursday = keyFromDayNumber(dn - isoWd + 4)
  const isoYear = parseDateKey(thursday).year
  const jan1 = dayNumber(formatDateKey({ year: isoYear, month: 1, day: 1 }))
  const week = Math.floor((dayNumber(thursday) - jan1) / 7) + 1
  return `${isoYear}-W${pad2(week)}`
}

/** Today's key as of a given instant, in the machine's zone. Thin alias kept for readable call sites. */
export function todayKey(now: Date = new Date()): DateKey {
  return localDateKey(now)
}

/** The next check-in day: last check-in plus the interval. */
export function nextCheckinKey(lastCheckin: DateKey, intervalDays: number): DateKey {
  return addDays(lastCheckin, intervalDays)
}

/** Local midnight of a key as a Date, built from components (never from the string). */
export function dateAtLocalMidnight(key: DateKey): Date {
  const { year, month, day } = parseDateKey(key)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}
