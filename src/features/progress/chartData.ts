// Series for the weight panel: raw readings, the trend line and waist dots,
// on one numeric day axis that the strength panel shares. Pure, so the
// charts themselves stay thin.

import { dayNumber, keyFromDayNumber } from '../../domain/dates'
import type { DateKey } from '../../domain/types'
import { formatDayMonth } from '../profile/format'

export type RangeKey = '4w' | '12w' | '6m' | 'all'

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: '4w', label: '4w' },
  { key: '12w', label: '12w' },
  { key: '6m', label: '6m' },
  { key: 'all', label: 'All' },
]

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '4w': 28, '12w': 84, '6m': 182 }

export interface ChartPoint {
  /** Day number on the shared axis. */
  x: number
  y: number
  key: DateKey
}

export interface WeightChartInput {
  readings: readonly { date_key: DateKey; weight_g: number; waist_mm: number | null }[]
  trendPoints: readonly { date_key: DateKey; trend_g: number }[]
  range: RangeKey
  today: DateKey
}

export interface WeightChartData {
  raw: ChartPoint[]
  trend: ChartPoint[]
  waist: ChartPoint[]
  xDomain: [number, number]
  xTicks: number[]
  weightDomain: [number, number]
  weightTicks: number[]
  waistDomain: [number, number] | null
  waistTicks: number[]
}

const MIN_SPAN_DAYS = 8

export function xAxisFor(
  firstVisibleDay: number | null,
  today: DateKey,
  range: RangeKey,
  allFirstDay: number | null,
): { domain: [number, number]; ticks: number[] } {
  const end = dayNumber(today)
  let start: number
  if (range === 'all') start = (allFirstDay ?? end) - 2
  else {
    const back = end - RANGE_DAYS[range]
    // Do not stretch an empty past: start two days before the first visible reading.
    start = firstVisibleDay === null ? back : Math.max(back, firstVisibleDay - 2)
  }
  if (end - start < MIN_SPAN_DAYS) start = end - MIN_SPAN_DAYS
  const span = end - start
  const step = Math.max(1, Math.ceil(span / 4))
  // Anchored to today on the right, so the last label is always the current day.
  const ticks: number[] = []
  for (let d = end; d >= start; d -= step) ticks.unshift(d)
  return { domain: [start, end], ticks }
}

/** Round-number ticks inside a domain, at most `maxIntervals` apart-steps across it. */
export function niceTicks(lo: number, hi: number, maxIntervals = 4): number[] {
  const span = hi - lo
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100]
  const step = steps.find((s) => span / s <= maxIntervals) ?? span
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100 + 0)
  return ticks
}

function paddedDomain(values: number[], pad: number, grid: number, minSpan: number): [number, number] {
  let lo = Math.floor((Math.min(...values) - pad) / grid) * grid
  let hi = Math.ceil((Math.max(...values) + pad) / grid) * grid
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = Math.floor((mid - minSpan / 2) / grid) * grid
    hi = lo + minSpan
  }
  return [lo, hi]
}

export function buildWeightChartData(input: WeightChartInput): WeightChartData {
  const sorted = [...input.readings].sort((a, b) => (a.date_key < b.date_key ? -1 : 1))
  const allFirst = sorted.length > 0 ? dayNumber(sorted[0].date_key) : null
  const endDay = dayNumber(input.today)
  const backDay = input.range === 'all' ? -Infinity : endDay - RANGE_DAYS[input.range]
  const visible = sorted.filter((r) => dayNumber(r.date_key) >= backDay)
  const firstVisible = visible.length > 0 ? dayNumber(visible[0].date_key) : null
  const axis = xAxisFor(firstVisible, input.today, input.range, allFirst)

  const inWindow = (key: DateKey) => {
    const d = dayNumber(key)
    return d >= axis.domain[0] && d <= axis.domain[1]
  }
  const raw: ChartPoint[] = visible
    .filter((r) => inWindow(r.date_key))
    .map((r) => ({ x: dayNumber(r.date_key), y: r.weight_g / 1000, key: r.date_key }))
  const trend: ChartPoint[] = input.trendPoints
    .filter((p) => inWindow(p.date_key))
    .map((p) => ({ x: dayNumber(p.date_key), y: p.trend_g / 1000, key: p.date_key }))
  const waist: ChartPoint[] = visible
    .filter((r) => r.waist_mm !== null && inWindow(r.date_key))
    .map((r) => ({ x: dayNumber(r.date_key), y: (r.waist_mm as number) / 10, key: r.date_key }))

  const weightValues = [...raw, ...trend].map((p) => p.y)
  const weightDomain: [number, number] = weightValues.length > 0 ? paddedDomain(weightValues, 0.4, 0.5, 2) : [0, 1]
  const waistDomain: [number, number] | null = waist.length > 0 ? paddedDomain(waist.map((p) => p.y), 1, 1, 4) : null

  return {
    raw,
    trend,
    waist,
    xDomain: axis.domain,
    xTicks: axis.ticks,
    weightDomain,
    weightTicks: niceTicks(weightDomain[0], weightDomain[1]),
    waistDomain,
    waistTicks: waistDomain ? niceTicks(waistDomain[0], waistDomain[1]) : [],
  }
}

/** '8 Oct' for a day number on the shared axis. */
export function formatAxisDay(day: number): string {
  return formatDayMonth(keyFromDayNumber(day))
}

export interface StrengthChartData {
  points: ChartPoint[]
  domain: [number, number]
  ticks: number[]
}

/** The strength series clipped to the shared x window, in kilograms. */
export function buildStrengthChartData(
  series: { points: readonly { date_key: DateKey; e1rm_g: number }[] } | null,
  xDomain: readonly [number, number],
): StrengthChartData {
  const points: ChartPoint[] = (series?.points ?? [])
    .map((p) => ({ x: dayNumber(p.date_key), y: p.e1rm_g / 1000, key: p.date_key }))
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
  const domain: [number, number] = points.length > 0 ? paddedDomain(points.map((p) => p.y), 2.5, 5, 10) : [0, 1]
  return { points, domain, ticks: points.length > 0 ? niceTicks(domain[0], domain[1], 3) : [] }
}
