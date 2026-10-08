// The two-line read shown right after a check-in: the change since the last
// reading, what the trend says and when the next check-in is due.

import type { Goal } from '../../domain/calc/targets'
import type { TrendState } from '../../domain/calc/trend'
import { diffDays, nextCheckinKey } from '../../domain/dates'
import type { DateKey, WeighIn } from '../../domain/types'
import { readTrend } from '../progress/trend'
import { describeTrend, type TrendRead } from '../progress/trendCopy'

export interface MiniRead {
  date_key: DateKey
  weightG: number
  previous: { date_key: DateKey; weight_g: number } | null
  /** Change since the previous reading, in grams, or null on the first reading. */
  deltaG: number | null
  /** Waist now minus the last recorded waist, in millimetres, or null. */
  waistDeltaMm: number | null
  trend: TrendState
  trendRead: TrendRead
  nextCheckin: DateKey
}

export interface MiniReadInput {
  readings: readonly WeighIn[]
  /** The day of the check-in just saved. */
  dateKey: DateKey
  goal: Goal
  intervalDays: number
}

export function buildMiniRead({ readings, dateKey, goal, intervalDays }: MiniReadInput): MiniRead | null {
  const live = readings.filter((r) => r.deleted_at === null).sort((a, b) => (a.date_key < b.date_key ? -1 : 1))
  const current = live.find((r) => r.date_key === dateKey)
  if (!current) return null
  const earlier = live.filter((r) => r.date_key < dateKey)
  const previous = earlier[earlier.length - 1] ?? null
  const lastWaist = [...earlier].reverse().find((r) => r.waist_mm !== null) ?? null
  const trend = readTrend(
    live.map((r) => ({ date_key: r.date_key, weight_g: r.weight_g })),
    { goal },
  )
  return {
    date_key: dateKey,
    weightG: current.weight_g,
    previous: previous ? { date_key: previous.date_key, weight_g: previous.weight_g } : null,
    deltaG: previous ? current.weight_g - previous.weight_g : null,
    waistDeltaMm: current.waist_mm !== null && lastWaist?.waist_mm != null ? current.waist_mm - lastWaist.waist_mm : null,
    trend,
    trendRead: describeTrend(trend, goal),
    nextCheckin: nextCheckinKey(dateKey, intervalDays),
  }
}

/** Should the waist field open by default? Every second check-in or so: when the last waist is a week old or missing. */
export function waistIsDue(readings: readonly WeighIn[], today: DateKey): boolean {
  const withWaist = readings.filter((r) => r.deleted_at === null && r.waist_mm !== null && r.date_key !== today)
  const last = withWaist[withWaist.length - 1]
  if (!last) return true
  return diffDays(last.date_key, today) >= 7
}
