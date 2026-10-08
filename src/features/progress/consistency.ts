// Consistency in weeks only: the last twelve weeks as hit, partial or off
// against the weekly target. No streaks, no counters of missed days.

import { addDays, weekStart } from '../../domain/dates'
import type { DateKey, Weekday } from '../../domain/types'

export type WeekState = 'hit' | 'partial' | 'off' | 'before'

export interface WeekChip {
  /** First day of the week. */
  start: DateKey
  count: number
  state: WeekState
  isCurrent: boolean
}

export interface ConsistencyInput {
  /** The planned_on key of every finished strength session. */
  sessionDays: readonly DateKey[]
  today: DateKey
  weekStartsOn: Weekday
  /** Sessions per week that count as a hit. */
  target: number
  weeks?: number
  /** Earliest day the person could have trained (program start); older weeks read "before". */
  activeFrom?: DateKey | null
}

export function weeklyConsistency(i: ConsistencyInput): WeekChip[] {
  const weeks = i.weeks ?? 12
  const target = Math.max(1, i.target)
  const counts = new Map<DateKey, number>()
  for (const d of i.sessionDays) {
    const ws = weekStart(d, i.weekStartsOn)
    counts.set(ws, (counts.get(ws) ?? 0) + 1)
  }
  let first: DateKey | null = i.activeFrom ?? null
  for (const d of i.sessionDays) if (first === null || d < first) first = d
  const firstWeek = first === null ? null : weekStart(first, i.weekStartsOn)

  const currentStart = weekStart(i.today, i.weekStartsOn)
  const chips: WeekChip[] = []
  for (let n = weeks - 1; n >= 0; n--) {
    const start = addDays(currentStart, -7 * n)
    const count = counts.get(start) ?? 0
    const isCurrent = n === 0
    let state: WeekState
    if (firstWeek === null || start < firstWeek) state = 'before'
    else if (count >= target) state = 'hit'
    else if (count > 0) state = 'partial'
    else state = 'off'
    chips.push({ start, count, state, isCurrent })
  }
  return chips
}

/** "Target met in 5 of 9 weeks": finished weeks with data, plus the current week once it is a hit. */
export function consistencySummary(chips: readonly WeekChip[]): { met: number; of: number } {
  let met = 0
  let of = 0
  for (const c of chips) {
    if (c.state === 'before') continue
    if (c.isCurrent && c.state !== 'hit') continue
    of += 1
    if (c.state === 'hit') met += 1
  }
  return { met, of }
}
