// Display helpers for day keys and clock times. They work on the integer
// parts of a key (see src/domain/dates.ts) and never build a Date from the
// string.

import { parseDateKey, weekdayOf } from '../../domain/dates'
import type { DateKey, Weekday } from '../../domain/types'

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function weekdayShort(w: Weekday): string {
  return WEEKDAYS_SHORT[w]
}

/** '12 Oct' */
export function formatDayMonth(key: DateKey): string {
  const p = parseDateKey(key)
  return `${p.day} ${MONTHS_SHORT[p.month - 1]}`
}

/** 'Sat 12 Oct' */
export function formatDayShort(key: DateKey): string {
  return `${WEEKDAYS_SHORT[weekdayOf(key)]} ${formatDayMonth(key)}`
}

/** 'Oct 2026' style label for a month tick. */
export function formatMonthYear(key: DateKey): string {
  const p = parseDateKey(key)
  return `${MONTHS_SHORT[p.month - 1]} ${p.year}`
}

/** 420 -> '07:00' */
export function formatMinuteOfDay(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const r = m % 60
  return `${h < 10 ? '0' : ''}${h}:${r < 10 ? '0' : ''}${r}`
}

/** '07:30' -> 450, or null for anything that is not a 24-hour time. */
export function parseTimeInput(raw: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Signed kilogram change with one decimal: '+0.4', '-0.4', '0.0'. Input in grams. */
export function formatSignedKg(g: number): string {
  const kg = Math.round(g / 100) / 10
  if (kg === 0) return '0.0'
  return `${kg > 0 ? '+' : '-'}${Math.abs(kg).toFixed(1)}`
}

/** Signed centimetre change with one decimal. Input in millimetres. */
export function formatSignedCm(mm: number): string {
  const cm = Math.round(mm) / 10
  if (cm === 0) return '0.0'
  return `${cm > 0 ? '+' : '-'}${Math.abs(cm).toFixed(1)}`
}

/** Kilograms with exactly one decimal, from grams. */
export function kg1(g: number): string {
  return (g / 1000).toFixed(1)
}
