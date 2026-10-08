// Weight trend maths at the 4-day check-in cadence (PLAN.md section 4).
//
// OWNER: engine-trend-review. Stub until that slice lands; the types are the
// contract. Pure: no React, no database, no Date.now().
//
// Rules: one point per reading; Theil-Sen slope on elapsed days over the last
// 28 days gives the rate in percent of body weight per week; an exponentially
// weighted average with an 8-day half-life draws the line; the slope's
// confidence interval comes from the readings' own residuals and a band
// verdict is issued only when that interval sits inside one band or wholly
// beyond the too-fast line. Early directional read after 4 readings spanning
// 12 days. Hysteresis: a band changes only when the rate crosses the edge by
// 0.05 points or stays across it for two check-ins.

import type { DateKey } from '../types'
import type { Goal } from './targets'

export interface WeightReading {
  date_key: DateKey
  weight_g: number
}

export type TrendBand =
  | 'on_track'
  | 'flat'
  | 'too_fast'
  | 'gaining'
  | 'slow_down'
  /** Direction known but the interval straddles a band edge. */
  | 'not_yet_precise'
  /** Fewer than the early-read minimum. */
  | 'collecting'

export type TrendDirection = 'down' | 'flat' | 'up' | 'unknown'

export interface TrendState {
  /** Robust slope in grams per day over the window, or null while collecting. */
  slope_g_per_day: number | null
  /** Percent of body weight per week; negative is loss. Null while collecting. */
  rate_pct_per_week: number | null
  /** 95 percent interval on rate_pct_per_week from the residuals, or null. */
  rate_ci_pct_per_week: [number, number] | null
  band: TrendBand
  direction: TrendDirection
  /** 'early' at 4 readings over 12 days, 'full' at 7 over 24. */
  precision: 'none' | 'early' | 'full'
  readings_count: number
  /** Readings still needed for the next precision step ("6 of 10"). */
  readings_needed: number
  /** Expected readings for a band verdict at this cadence, for the "n of 10" line. */
  readings_expected: number
  /** The EWMA line, one point per reading, in grams. */
  trend_points: { date_key: DateKey; trend_g: number }[]
  /** Latest trend value in grams, or null. */
  trend_weight_g: number | null
  /** Change since the previous reading in grams, or null. */
  delta_since_last_g: number | null
}

export interface TrendOptions {
  goal: Goal
  /** Days in the slope window. Default 28. */
  window_days?: number
  /** EWMA half-life in days. Default 8. */
  half_life_days?: number
  /** Previous band, for hysteresis. Null on the first evaluation. */
  previous_band?: TrendBand | null
  /** Readings in the current cycle, for "n of 7 readings this cycle". */
  cycle_start?: DateKey | null
}

/** Band edges in percent per week (loss is negative). */
export const TREND_BANDS = {
  on_track: { lo: -0.75, hi: -0.25 },
  flat: { lo: -0.25, hi: 0.25 },
  /** Widened flat band on the early read. */
  flat_early: { lo: -0.35, hi: 0.35 },
  too_fast_beyond: -1.0,
  slow_down_beyond: -1.5,
  hysteresis: 0.05,
} as const

export const EARLY_READ = { readings: 4, span_days: 12 } as const
export const FULL_READ = { readings: 7, span_days: 24 } as const
export const BAND_VERDICT_EXPECTED_READINGS = 10

/**
 * The trend state from weigh-ins (body_weights rows, any order, duplicates
 * by date collapsed to the latest). Extra weigh-ins between check-ins count.
 */
export function trendState(_readings: readonly WeightReading[], _options: TrendOptions): TrendState {
  throw new Error('not implemented: trendState')
}
