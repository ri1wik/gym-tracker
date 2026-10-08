import { parseDateKey } from '../../domain/dates'
import type { DateKey } from '../../domain/types'

/** Whole years between a birth date and a day, from the integer parts of both keys. */
export function ageYearsOn(birth: DateKey, today: DateKey): number {
  const b = parseDateKey(birth)
  const t = parseDateKey(today)
  let years = t.year - b.year
  if (t.month < b.month || (t.month === b.month && t.day < b.day)) years -= 1
  return years
}
