import { describe, expect, it } from 'vitest'
import { FALLBACK_TEMPLATES } from './fixtures'
import { EXERCISES_BY_ID } from '../../../data/library/exercise-index'
import {
  defaultPins,
  deloadSets,
  isReturnAfterGap,
  lastDoneOn,
  nextTemplateDay,
  relativeDayLabel,
  sessionsThisWeek,
  trainingWeek,
  weekdayOrder,
  type FinishedLike,
} from './rotation'

const ppl = FALLBACK_TEMPLATES.find((t) => t.key === 'ppl_6')!
const full = FALLBACK_TEMPLATES.find((t) => t.key === 'full_body_3')!

function done(session_key: string, planned_on: string): FinishedLike {
  return { session_key, planned_on, status: 'finished', deleted_at: null }
}

describe('fixtures', () => {
  it('only reference exercises that exist in the index', () => {
    for (const t of FALLBACK_TEMPLATES) {
      for (const d of t.days) for (const it of d.items) expect(EXERCISES_BY_ID[it.exercise_id], it.exercise_id).toBeDefined()
    }
  })
})

describe('nextTemplateDay', () => {
  // 2026-10-07 is a Wednesday.
  it('starts at day one from a fresh pointer of -1', () => {
    expect(nextTemplateDay(ppl, -1, {}, '2026-10-07').day.key).toBe('push_a')
  })
  it('follows the pointer and wraps', () => {
    expect(nextTemplateDay(ppl, 2, {}, '2026-10-07').day.key).toBe('push_b')
    expect(nextTemplateDay(ppl, 5, {}, '2026-10-07').day.key).toBe('push_a')
  })
  it('a weekday pin wins over the pointer, other weekdays ignore it', () => {
    const pins = { 3: 'legs_a' } as const
    const wed = nextTemplateDay(ppl, 0, pins, '2026-10-07')
    expect(wed.day.key).toBe('legs_a')
    expect(wed.pinned).toBe(true)
    const thu = nextTemplateDay(ppl, 0, pins, '2026-10-08')
    expect(thu.day.key).toBe('pull_a')
    expect(thu.pinned).toBe(false)
  })
  it('ignores a pin that names a day the template does not have', () => {
    expect(nextTemplateDay(ppl, 0, { 3: 'gone' }, '2026-10-07').day.key).toBe('pull_a')
  })
})

describe('defaults and labels', () => {
  it('pins fixed splits and leaves PPL to the rotation', () => {
    expect(defaultPins(ppl)).toEqual({})
    expect(defaultPins(full)).toEqual({ 1: 'full_a', 3: 'full_b', 5: 'full_c' })
  })
  it('reads dates relative to today without Date parsing of keys', () => {
    expect(relativeDayLabel('2026-10-08', '2026-10-08')).toBe('today')
    expect(relativeDayLabel('2026-10-07', '2026-10-08')).toBe('yesterday')
    expect(relativeDayLabel('2026-10-06', '2026-10-08')).toBe('Tuesday')
    expect(relativeDayLabel('2026-09-12', '2026-10-08')).toBe('12 Sep')
  })
  it('flags a return after ten days away', () => {
    expect(isReturnAfterGap('2026-09-28', '2026-10-08')).toBe(true)
    expect(isReturnAfterGap('2026-09-29', '2026-10-08')).toBe(false)
    expect(isReturnAfterGap(null, '2026-10-08')).toBe(false)
  })
  it('orders weekdays from the first day of the week', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
  it('halves sets for a deload but never below one', () => {
    expect([4, 3, 2, 1].map(deloadSets)).toEqual([2, 2, 1, 1])
  })
  it('counts training weeks from the last deload or the start', () => {
    const d = { every_weeks: 6, week_index: 0, last_deload_on: null, active: false }
    expect(trainingWeek(d, '2026-10-01', '2026-10-01')).toBe(1)
    expect(trainingWeek(d, '2026-10-01', '2026-10-08')).toBe(2)
    expect(trainingWeek({ ...d, last_deload_on: '2026-10-05' }, '2026-01-01', '2026-10-08')).toBe(1)
  })
})

describe('week counting', () => {
  const rows = [
    done('push_a', '2026-10-05'), // Monday
    done('pull_a', '2026-10-07'),
    done('legs_a', '2026-10-04'), // Sunday before
    { ...done('push_b', '2026-10-06'), status: 'discarded' as const },
    { ...done('push_b', '2026-10-06'), deleted_at: '2026-10-07T00:00:00Z' },
  ]
  it('counts finished sessions in a Monday-start week', () => {
    expect(sessionsThisWeek(rows, '2026-10-08', 1)).toBe(2)
  })
  it('moves the boundary with a Sunday start', () => {
    expect(sessionsThisWeek(rows, '2026-10-08', 0)).toBe(3)
  })
  it('finds the last day a session was done', () => {
    expect(lastDoneOn(rows, 'push_a')).toBe('2026-10-05')
    expect(lastDoneOn(rows, 'push_b')).toBeNull()
  })
})
