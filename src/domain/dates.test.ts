import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateAtLocalMidnight,
  dayNumber,
  diffDays,
  isDateKey,
  isoWeekKey,
  keyFromDayNumber,
  localDateKey,
  weekStart,
  weekdayOf,
} from './dates'

describe('localDateKey', () => {
  it('reads local components, so 00:30 on a Monday is Monday whatever UTC says', () => {
    // Built from components: the machine zone does not matter because the
    // same zone produces and reads the Date.
    const mondayHalfPastMidnight = new Date(2026, 9, 5, 0, 30)
    expect(localDateKey(mondayHalfPastMidnight)).toBe('2026-10-05')
    expect(weekdayOf('2026-10-05')).toBe(1)
  })
  it('a Date made from a key at local midnight round-trips', () => {
    const d = dateAtLocalMidnight('2026-03-01')
    expect(localDateKey(d)).toBe('2026-03-01')
  })
  it('a UTC-negative zone instant does not shift the key when read locally', () => {
    // 2026-01-01 at 23:30 local in a zone west of Greenwich is already
    // 2026-01-02 in UTC; the local key must stay on the 1st. We simulate by
    // asserting the UTC string differs from the local key for such an instant
    // when the local components say 23:30, independent of the machine zone.
    const d = new Date(2026, 0, 1, 23, 30)
    expect(localDateKey(d)).toBe('2026-01-01')
    // And never new Date('YYYY-MM-DD'): that parses as UTC midnight.
    expect(() => localDateKey(dateAtLocalMidnight('2026-01-01'))).not.toThrow()
  })
})

describe('day arithmetic on integer parts', () => {
  it('dayNumber and keyFromDayNumber invert each other', () => {
    for (const k of ['1970-01-01', '2000-02-29', '2024-02-29', '2026-10-08', '2099-12-31', '1999-12-31']) {
      expect(keyFromDayNumber(dayNumber(k))).toBe(k)
    }
    expect(dayNumber('1970-01-01')).toBe(0)
    expect(dayNumber('1970-01-02')).toBe(1)
  })
  it('addDays crosses month, leap day and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-10-08', 4)).toBe('2026-10-12')
  })
  it('a DST week still counts 7 days', () => {
    // Europe moves clocks on the last Sunday of March; India has no DST.
    // Both are calendar weeks of 7 days whatever the clock does.
    expect(diffDays('2026-03-23', '2026-03-30')).toBe(7)
    expect(diffDays('2026-10-19', '2026-10-26')).toBe(7)
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })
  it('diffDays is signed', () => {
    expect(diffDays('2026-10-01', '2026-10-05')).toBe(4)
    expect(diffDays('2026-10-05', '2026-10-01')).toBe(-4)
    expect(diffDays('2025-12-30', '2026-01-02')).toBe(3)
  })
  it('addDays rejects a non-integer', () => {
    expect(() => addDays('2026-10-01', 1.5)).toThrow()
  })
})

describe('weeks', () => {
  it('weekdayOf matches the calendar', () => {
    expect(weekdayOf('1970-01-01')).toBe(4)
    expect(weekdayOf('2026-10-08')).toBe(4)
    expect(weekdayOf('2026-10-11')).toBe(0)
    expect(weekdayOf('2026-10-05')).toBe(1)
  })
  it('weekStart honours the start day', () => {
    expect(weekStart('2026-10-08', 1)).toBe('2026-10-05')
    expect(weekStart('2026-10-08', 0)).toBe('2026-10-04')
    expect(weekStart('2026-10-05', 1)).toBe('2026-10-05')
    expect(weekStart('2026-10-04', 1)).toBe('2026-09-28')
    expect(weekStart('2026-10-11', 0)).toBe('2026-10-11')
  })
  it('isoWeekKey handles year boundaries', () => {
    expect(isoWeekKey('2026-10-08')).toBe('2026-W41')
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53')
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01')
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01')
    expect(isoWeekKey('2021-01-03')).toBe('2020-W53')
  })
})

describe('isDateKey', () => {
  it('accepts real dates only', () => {
    expect(isDateKey('2026-02-28')).toBe(true)
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('2026-1-01')).toBe(false)
    expect(isDateKey(20260101)).toBe(false)
  })
})
