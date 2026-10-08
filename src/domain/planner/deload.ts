// Deload by week counter (PLAN.md 3.4): every 6th week, 5th for an advanced
// lifter or a deficit of 20 percent or more, a manual "deload now" through
// the active flag, and the key-lift regression trigger (two key lifts whose
// best weekly estimate fell three weeks running). Low attendance is not a
// trigger; the return rule covers it.

import { addDays, diffDays, weekStart } from '../dates'
import type { DateKey } from '../types'
import type { DeloadStatus, History, ProgramState } from './contract'
import { epleyEstimateG } from './history'

export const DELOAD_EVERY_WEEKS = 6
export const DELOAD_EVERY_WEEKS_DEFICIT = 5
export const DELOAD_DEFICIT_FRACTION = 0.2
export const REGRESSION_WEEKS = 3
export const REGRESSING_LIFTS_FOR_DELOAD = 2
/** Weeks start on Monday for the key-lift series. */
const SERIES_WEEK_START = 1

export function deloadEveryWeeks(program: ProgramState): number {
  const stored = program.deload.every_weeks > 0 ? program.deload.every_weeks : DELOAD_EVERY_WEEKS
  const cap = program.training_age === 'advanced' || program.deficit_fraction >= DELOAD_DEFICIT_FRACTION ? DELOAD_EVERY_WEEKS_DEFICIT : DELOAD_EVERY_WEEKS
  return Math.min(stored, cap)
}

/** Weeks since the last deload (or program start), counted from the dates so no counter has to be ticked. */
export function deloadWeekIndex(program: ProgramState, today: DateKey): number {
  const anchor = program.deload.last_deload_on ?? program.started_on
  const days = diffDays(anchor, today)
  if (days < 0) return 0
  return Math.floor(days / 7)
}

/** Key lift ids of a template: the flagged items, else the first item of each day. */
export function keyLiftIds(program: ProgramState): string[] {
  const out: string[] = []
  for (const day of program.template.days) {
    const flagged = day.items.filter((i) => i.is_key_lift)
    const picks = flagged.length > 0 ? flagged : day.items.slice(0, 1)
    for (const item of picks) if (!out.includes(item.exercise_id)) out.push(item.exercise_id)
  }
  return out
}

/** Best Epley estimate per week (week key is the Monday), warm-ups and assisted sets excluded. */
export function weeklyBestEstimates(history: History, exercise_id: string, today: DateKey): { week: DateKey; best_g: number }[] {
  const todayWeek = weekStart(today, SERIES_WEEK_START)
  const byWeek = new Map<DateKey, number>()
  for (const s of history.sets) {
    if (s.exercise_id !== exercise_id || s.kind !== 'working' || s.assist_g > 0) continue
    const est = epleyEstimateG(s.load_g, s.reps)
    if (est === null) continue
    const week = weekStart(s.date_key, SERIES_WEEK_START)
    if (week > todayWeek) continue
    byWeek.set(week, Math.max(byWeek.get(week) ?? 0, est))
  }
  return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([week, best_g]) => ({ week, best_g }))
}

/** True when the last REGRESSION_WEEKS + 1 weeks are consecutive and strictly falling. */
export function isRegressing(series: { week: DateKey; best_g: number }[]): boolean {
  const need = REGRESSION_WEEKS + 1
  if (series.length < need) return false
  const tail = series.slice(-need)
  for (let i = 1; i < tail.length; i++) {
    if (addDays(tail[i - 1].week, 7) !== tail[i].week) return false
    if (tail[i].best_g >= tail[i - 1].best_g) return false
  }
  return true
}

export function deloadStatus(program: ProgramState, history: History, today: DateKey): DeloadStatus {
  const every_weeks = deloadEveryWeeks(program)
  const week_index = deloadWeekIndex(program, today)
  const regressing_key_lifts = keyLiftIds(program).filter((id) => isRegressing(weeklyBestEstimates(history, id, today)))

  const schedule = week_index >= every_weeks
  const regression = regressing_key_lifts.length >= REGRESSING_LIFTS_FOR_DELOAD
  const base = { week_index, every_weeks, regressing_key_lifts }

  if (program.deload.active) {
    return { ...base, due: true, reason: schedule ? 'schedule' : regression ? 'regression' : 'manual' }
  }
  if (schedule) return { ...base, due: true, reason: 'schedule' }
  if (regression) return { ...base, due: true, reason: 'regression' }
  return { ...base, due: false, reason: null }
}
