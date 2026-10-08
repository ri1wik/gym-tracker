// Weight trend maths at the 4-day check-in cadence (PLAN.md section 4).
//
// OWNER: engine-trend-review. Pure: no React, no database, no Date.now().
//
// Rules: one point per reading; Theil-Sen slope on elapsed days over the last
// 28 days gives the rate in percent of body weight per week; an exponentially
// weighted average with an 8-day half-life draws the line; the slope's
// confidence interval comes from the readings' own residuals (floored at the
// scale's resolution, so a collinear series keeps a finite, honest interval)
// and a band verdict is issued only at the full read (7 readings over 24
// days, PLAN.md section 12) and only when that interval sits inside one band
// or wholly beyond the too-fast line. Early directional read after 4
// readings spanning 12 days, never a verdict. Hysteresis: a band changes
// only when the rate crosses the edge by 0.05 points or stays across it for
// two check-ins; too fast and slow down always wait for the second run. The
// screens persist the previous band and candidate (META_KEYS.trendState) and
// feed them back, so the rule carries across sessions.

import type { DateKey } from '../types'
import { dayNumber } from '../dates'
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
  /**
   * The band the interval points at before hysteresis. Equals `band` once a
   * verdict has settled; differs on the first run across an edge. Feed it back
   * as `previous_candidate_band` so the two-run rule can count.
   */
  candidate_band?: TrendBand
  /** Readings in the window used for the slope. */
  window_readings?: number
  /** Days from the first to the last reading in the window. */
  window_span_days?: number
  /** Readings since cycle_start, when given. */
  cycle_readings?: number | null
}

export interface TrendOptions {
  goal: Goal
  /** Days in the slope window. Default 28. */
  window_days?: number
  /** EWMA half-life in days. Default 8. */
  half_life_days?: number
  /** Previous band, for hysteresis. Null on the first evaluation. */
  previous_band?: TrendBand | null
  /** Previous candidate band (TrendState.candidate_band), for the two-run rule. */
  previous_candidate_band?: TrendBand | null
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

/** Lean-gain edges: on track is gaining 0.1 to 0.5 percent per week; above 0.5 reads too fast. */
export const LEAN_GAIN_BANDS = { on_track: { lo: 0.1, hi: 0.5 }, flat: { lo: -0.25, hi: 0.1 } } as const

export const EARLY_READ = { readings: 4, span_days: 12 } as const
export const FULL_READ = { readings: 7, span_days: 24 } as const
export const BAND_VERDICT_EXPECTED_READINGS = 10

/**
 * The scale's resolution in grams. A 0.1 kg scale reports a steady rate as
 * perfectly collinear readings, whose residuals are zero; the slope's
 * standard error is floored at this sigma so the interval never collapses
 * to zero width on four readings.
 */
export const SCALE_RESOLUTION_G = 100

/** Rates inside this dead zone read as direction 'flat'. */
export const DIRECTION_DEAD_ZONE_PCT = 0.1

const VERDICT_BANDS: readonly TrendBand[] = ['on_track', 'flat', 'too_fast', 'gaining', 'slow_down']

/** True for a band the maths has backed (not collecting, not not_yet_precise). */
export function isVerdictBand(band: TrendBand | null | undefined): boolean {
  return band != null && VERDICT_BANDS.includes(band)
}

interface Region {
  band: TrendBand
  lo: number
  hi: number
}

/**
 * The contiguous rate regions for a goal, in percent per week. Loss goals and
 * maintenance share one table: the zone between the too-fast line and the
 * on-track floor counts as on track at its fast end. Lean gain mirrors it:
 * losing weight on a gain goal reads slow_down (the "eat more" verdict).
 */
export function bandRegions(goal: Goal): Region[] {
  if (goal === 'lean_gain') {
    return [
      { band: 'slow_down', lo: -Infinity, hi: LEAN_GAIN_BANDS.flat.lo },
      { band: 'flat', lo: LEAN_GAIN_BANDS.flat.lo, hi: LEAN_GAIN_BANDS.on_track.lo },
      { band: 'on_track', lo: LEAN_GAIN_BANDS.on_track.lo, hi: LEAN_GAIN_BANDS.on_track.hi },
      { band: 'too_fast', lo: LEAN_GAIN_BANDS.on_track.hi, hi: Infinity },
    ]
  }
  return [
    { band: 'slow_down', lo: -Infinity, hi: TREND_BANDS.slow_down_beyond },
    { band: 'too_fast', lo: TREND_BANDS.slow_down_beyond, hi: TREND_BANDS.too_fast_beyond },
    { band: 'on_track', lo: TREND_BANDS.too_fast_beyond, hi: TREND_BANDS.on_track.hi },
    { band: 'flat', lo: TREND_BANDS.flat.lo, hi: TREND_BANDS.flat.hi },
    { band: 'gaining', lo: TREND_BANDS.flat.hi, hi: Infinity },
  ]
}

function regionOf(goal: Goal, band: TrendBand): Region | null {
  return bandRegions(goal).find((r) => r.band === band) ?? null
}

/** Two-sided 97.5 percent Student t quantiles by degrees of freedom (1 to 30), then the normal value. */
const T_975 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
  2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
]

export function tQuantile975(df: number): number {
  if (df < 1) return Infinity
  if (df > T_975.length) return 1.96
  return T_975[df - 1]
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median of nothing')
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface TheilSenFit {
  /** Grams per day. */
  slope: number
  /** Grams at day 0 of the x values passed in. */
  intercept: number
  /** Standard error of the slope from the residuals, grams per day. */
  slope_se: number
  /** 95 percent interval on the slope. */
  slope_ci: [number, number]
  residuals: number[]
}

/**
 * Theil-Sen: the median of all pairwise slopes, intercept as the median of
 * (y minus slope times x). The slope's standard error comes from the fit's
 * own residuals with the usual least-squares formula, which is what the gate
 * needs: a noisy series widens the interval, a clean one narrows it, and the
 * residual sigma never drops under `sigmaFloor` (the measurement resolution),
 * so a collinear series keeps a finite interval. Needs at least three points
 * with two distinct x values; two points give a slope with an infinite
 * interval.
 */
export function theilSen(xs: readonly number[], ys: readonly number[], sigmaFloor = 0): TheilSenFit {
  const n = xs.length
  if (n !== ys.length || n < 2) throw new Error('theilSen needs at least two points')
  const slopes: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (xs[j] === xs[i]) continue
      slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]))
    }
  }
  if (slopes.length === 0) throw new Error('theilSen needs two distinct x values')
  const slope = median(slopes)
  const intercept = median(xs.map((x, i) => ys[i] - slope * x))
  const residuals = xs.map((x, i) => ys[i] - (intercept + slope * x))
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const sxx = xs.reduce((a, x) => a + (x - xMean) * (x - xMean), 0)
  const df = n - 2
  let se = Infinity
  if (df > 0 && sxx > 0) {
    const rss = residuals.reduce((a, r) => a + r * r, 0)
    const variance = Math.max(rss / df, sigmaFloor * sigmaFloor)
    se = Math.sqrt(variance / sxx)
  }
  const t = tQuantile975(df)
  const half = Number.isFinite(se) ? t * se : Infinity
  return { slope, intercept, slope_se: se, slope_ci: [slope - half, slope + half], residuals }
}

/** EWMA on irregular spacing: the weight of a new reading is 1 minus 0.5 to the power of (days elapsed over the half-life). */
export function ewmaPoints(
  readings: readonly { date_key: DateKey; weight_g: number; day: number }[],
  halfLifeDays: number,
): { date_key: DateKey; trend_g: number }[] {
  const out: { date_key: DateKey; trend_g: number }[] = []
  let level: number | null = null
  let lastDay = 0
  for (const r of readings) {
    if (level === null) {
      level = r.weight_g
    } else {
      const dt = Math.max(r.day - lastDay, 0)
      const alpha = 1 - Math.pow(0.5, dt / halfLifeDays)
      level = level + alpha * (r.weight_g - level)
    }
    lastDay = r.day
    out.push({ date_key: r.date_key, trend_g: Math.round(level) })
  }
  return out
}

/** One reading per day (the last one passed wins), sorted by day. */
export function normaliseReadings(readings: readonly WeightReading[]): { date_key: DateKey; weight_g: number; day: number }[] {
  const byDay = new Map<DateKey, number>()
  for (const r of readings) {
    if (!Number.isFinite(r.weight_g) || r.weight_g <= 0) continue
    byDay.set(r.date_key, r.weight_g)
  }
  return [...byDay.entries()]
    .map(([date_key, weight_g]) => ({ date_key, weight_g, day: dayNumber(date_key) }))
    .sort((a, b) => a.day - b.day)
}

function directionOf(rate: number): TrendDirection {
  if (rate <= -DIRECTION_DEAD_ZONE_PCT) return 'down'
  if (rate >= DIRECTION_DEAD_ZONE_PCT) return 'up'
  return 'flat'
}

/**
 * The band the interval points at, before hysteresis: the one region that
 * holds the whole interval, too_fast or slow_down when the interval is wholly
 * beyond the too-fast line, else not_yet_precise.
 */
export function candidateBand(goal: Goal, ci: [number, number]): TrendBand {
  const [lo, hi] = ci
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 'not_yet_precise'
  if (goal !== 'lean_gain' && hi < TREND_BANDS.too_fast_beyond) {
    return hi < TREND_BANDS.slow_down_beyond ? 'slow_down' : 'too_fast'
  }
  for (const r of bandRegions(goal)) {
    if (lo >= r.lo && hi <= r.hi) return r.band
  }
  return 'not_yet_precise'
}

/** Bands that only ever settle on the second consecutive run. */
const TWO_RUN_BANDS: readonly TrendBand[] = ['too_fast', 'slow_down']

/**
 * Apply hysteresis: from a settled verdict the band moves only when the rate
 * sits more than 0.05 points past the old band's edge, or when the same new
 * band has been the candidate for two runs. Too fast and slow down always
 * need the second run, whatever the goal.
 */
export function applyHysteresis(
  goal: Goal,
  candidate: TrendBand,
  rate: number,
  previousBand: TrendBand | null | undefined,
  previousCandidate: TrendBand | null | undefined,
): TrendBand {
  const prev = previousBand ?? null
  const secondRun = previousCandidate === candidate
  if (TWO_RUN_BANDS.includes(candidate)) {
    if (secondRun || prev === candidate) return candidate
    return isVerdictBand(prev) ? (prev as TrendBand) : 'not_yet_precise'
  }
  if (!isVerdictBand(prev)) return candidate
  if (candidate === prev) return candidate
  const region = regionOf(goal, prev as TrendBand)
  if (candidate === 'not_yet_precise' || candidate === 'collecting') {
    // The interval widened. Keep the earned verdict while the point rate still sits in its band.
    if (region && rate >= region.lo && rate <= region.hi) return prev as TrendBand
    return candidate
  }
  if (secondRun) return candidate
  if (!region) return candidate
  const beyond = Math.max(region.lo - rate, rate - region.hi, 0)
  return beyond > TREND_BANDS.hysteresis + 1e-9 ? candidate : (prev as TrendBand)
}

/**
 * The trend state from weigh-ins (body_weights rows, any order, duplicates
 * by date collapsed to the latest). Extra weigh-ins between check-ins count.
 */
export function trendState(readings: readonly WeightReading[], options: TrendOptions): TrendState {
  const windowDays = options.window_days ?? 28
  const halfLife = options.half_life_days ?? 8
  const all = normaliseReadings(readings)
  const points = ewmaPoints(all, halfLife)
  const latest = all.length ? all[all.length - 1] : null
  const trendWeight = points.length ? points[points.length - 1].trend_g : null
  const delta = all.length >= 2 ? latest!.weight_g - all[all.length - 2].weight_g : null
  const cycleReadings =
    options.cycle_start != null ? all.filter((r) => r.day >= dayNumber(options.cycle_start!)).length : null

  const base: TrendState = {
    slope_g_per_day: null,
    rate_pct_per_week: null,
    rate_ci_pct_per_week: null,
    band: 'collecting',
    direction: 'unknown',
    precision: 'none',
    readings_count: all.length,
    readings_needed: Math.max(EARLY_READ.readings - all.length, 1),
    readings_expected: BAND_VERDICT_EXPECTED_READINGS,
    trend_points: points,
    trend_weight_g: trendWeight,
    delta_since_last_g: delta,
    candidate_band: 'collecting',
    window_readings: 0,
    window_span_days: 0,
    cycle_readings: cycleReadings,
  }
  if (!latest) return base

  const window = all.filter((r) => latest.day - r.day <= windowDays)
  const span = window.length ? window[window.length - 1].day - window[0].day : 0
  base.window_readings = window.length
  base.window_span_days = span

  const full = window.length >= FULL_READ.readings && span >= FULL_READ.span_days
  const early = window.length >= EARLY_READ.readings && span >= EARLY_READ.span_days
  if (!early) {
    base.readings_needed = Math.max(EARLY_READ.readings - window.length, 1)
    return base
  }

  const x0 = window[0].day
  const fit = theilSen(
    window.map((r) => r.day - x0),
    window.map((r) => r.weight_g),
    SCALE_RESOLUTION_G,
  )
  const reference = trendWeight ?? latest.weight_g
  const toPct = (gPerDay: number) => (gPerDay * 7 * 100) / reference
  const rate = toPct(fit.slope)
  const ci: [number, number] = [toPct(fit.slope_ci[0]), toPct(fit.slope_ci[1])]
  // No verdict before the full read: the early read gives a direction only.
  const candidate = full ? candidateBand(options.goal, ci) : 'not_yet_precise'
  const band = applyHysteresis(options.goal, candidate, rate, options.previous_band, options.previous_candidate_band)
  const settled = isVerdictBand(band)

  return {
    ...base,
    slope_g_per_day: fit.slope,
    rate_pct_per_week: rate,
    rate_ci_pct_per_week: ci,
    band,
    direction: directionOf(rate),
    precision: full ? 'full' : 'early',
    readings_needed: settled ? 0 : Math.max(BAND_VERDICT_EXPECTED_READINGS - window.length, 1),
    candidate_band: candidate,
  }
}

/** Kilograms per week implied by a state, for copy ("minus 0.34 kg per week"). */
export function kgPerWeek(state: TrendState): number | null {
  return state.slope_g_per_day === null ? null : (state.slope_g_per_day * 7) / 1000
}
