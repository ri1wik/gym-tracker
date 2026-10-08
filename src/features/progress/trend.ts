// The one adapter between the screens and the trend engine in
// src/domain/calc/trend.ts.
//
// While the engine throws "not implemented", this returns a collecting-state
// TrendState built from the real readings: honest counts, the change since
// the last reading and the smoothing line (exponential average, 8-day half
// life, as the plan defines it), but never a band verdict. Integration: delete
// the catch and the fallback; the engine's output flows through unchanged.

import { diffDays } from '../../domain/dates'
import {
  BAND_VERDICT_EXPECTED_READINGS,
  trendState,
  type TrendOptions,
  type TrendState,
  type WeightReading,
} from '../../domain/calc/trend'

const HALF_LIFE_DAYS = 8

function isNotImplemented(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('not implemented')
}

/** One reading per day (the last one wins), oldest first. */
export function collapseByDay(readings: readonly WeightReading[]): WeightReading[] {
  const byDay = new Map<string, WeightReading>()
  for (const r of readings) byDay.set(r.date_key, r)
  return [...byDay.values()].sort((a, b) => (a.date_key < b.date_key ? -1 : a.date_key > b.date_key ? 1 : 0))
}

/** Exponentially weighted line over elapsed days. */
export function smoothingLine(sorted: readonly WeightReading[], halfLifeDays = HALF_LIFE_DAYS): { date_key: string; trend_g: number }[] {
  const out: { date_key: string; trend_g: number }[] = []
  let prev: number | null = null
  let prevKey: string | null = null
  for (const r of sorted) {
    if (prev === null || prevKey === null) {
      prev = r.weight_g
    } else {
      const dt = Math.max(1, diffDays(prevKey, r.date_key))
      const keep = Math.pow(0.5, dt / halfLifeDays)
      prev = prev * keep + r.weight_g * (1 - keep)
    }
    prevKey = r.date_key
    out.push({ date_key: r.date_key, trend_g: Math.round(prev) })
  }
  return out
}

export function collectingTrend(readings: readonly WeightReading[]): TrendState {
  const sorted = collapseByDay(readings)
  const n = sorted.length
  const points = smoothingLine(sorted)
  const last = sorted[n - 1]
  const before = sorted[n - 2]
  return {
    slope_g_per_day: null,
    rate_pct_per_week: null,
    rate_ci_pct_per_week: null,
    band: 'collecting',
    direction: 'unknown',
    precision: 'none',
    readings_count: n,
    readings_needed: Math.max(0, BAND_VERDICT_EXPECTED_READINGS - n),
    readings_expected: BAND_VERDICT_EXPECTED_READINGS,
    trend_points: points,
    trend_weight_g: points.length > 0 ? points[points.length - 1].trend_g : null,
    delta_since_last_g: last && before ? last.weight_g - before.weight_g : null,
  }
}

/** The trend state for a set of weigh-ins, from the engine when it exists. */
export function readTrend(readings: readonly WeightReading[], options: TrendOptions): TrendState {
  try {
    return trendState(readings, options)
  } catch (e) {
    if (isNotImplemented(e)) return collectingTrend(readings)
    throw e
  }
}
