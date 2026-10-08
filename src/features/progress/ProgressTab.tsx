import { Component, Suspense, lazy, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PATHS } from '../../app/paths'
import { todayKey } from '../../domain/dates'
import { Card, labelClass, primaryButtonClass } from '../profile/controls'
import { formatDayShort, kg1 } from '../profile/format'
import { useProfile, useWeighIns } from '../profile/repo'
import { buildStrengthChartData, buildWeightChartData, RANGES, type RangeKey } from './chartData'
import { ConsistencyStrip } from './ConsistencyStrip'
import { weeklyConsistency } from './consistency'
import { useSessionFacts, useStrengthSeries } from './data'
import { readTrend } from './trend'
import { describeTrend } from './trendCopy'

// Recharts is the heaviest dependency in the app and only this tab draws
// charts, so it loads here and nowhere else.
const WeightStrengthCharts = lazy(() => import('./WeightStrengthCharts'))

const NO_READINGS: never[] = []
const WEIGHT_H = 190
const STRENGTH_H = 150

function ChartFrame() {
  // Same height as the chart so nothing shifts when the chunk arrives.
  return <div style={{ height: WEIGHT_H + STRENGTH_H + 4 }} className="rounded-control bg-surface-2/50" aria-hidden="true" />
}

class ChunkBoundary extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false }
  static getDerivedStateFromError() {
    return { broken: true }
  }
  render() {
    if (!this.state.broken) return this.props.children
    return (
      <div className="flex flex-col items-start gap-2 rounded-control bg-surface-2 p-4" style={{ minHeight: WEIGHT_H + STRENGTH_H + 4 }}>
        <p className="text-[15px] text-ink-2">The charts did not load. Reload to try again.</p>
        <button type="button" className="h-11 rounded-control bg-surface-3 px-4 text-[15px]! font-semibold!" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}

export function ProgressTab() {
  const profile = useProfile()
  const weighIns = useWeighIns()
  const facts = useSessionFacts()
  const strengthSeries = useStrengthSeries()
  const [range, setRange] = useState<RangeKey>('12w')
  const today = useMemo(() => todayKey(), [])

  const goal = profile?.goal ?? 'recomp'
  const readings = weighIns ?? NO_READINGS

  const trend = useMemo(
    () => readTrend(readings.map((r) => ({ date_key: r.date_key, weight_g: r.weight_g })), { goal }),
    [readings, goal],
  )
  const trendRead = describeTrend(trend, goal)

  const weightData = useMemo(
    () => buildWeightChartData({ readings, trendPoints: trend.trend_points, range, today }),
    [readings, trend, range, today],
  )
  const strengthData = useMemo(
    () => buildStrengthChartData(strengthSeries ?? null, weightData.xDomain),
    [strengthSeries, weightData.xDomain],
  )

  const target = facts?.programTarget ?? profile?.training_days_per_week ?? 4
  const chips = useMemo(
    () =>
      weeklyConsistency({
        sessionDays: facts?.days ?? [],
        today,
        weekStartsOn: profile?.week_starts_on ?? 1,
        target,
        activeFrom: facts?.programStart ?? null,
      }),
    [facts, today, profile?.week_starts_on, target],
  )

  if (weighIns === undefined || facts === undefined) return null

  const latest = readings[readings.length - 1] ?? null
  const collecting = trendRead.collecting

  return (
    <section className="space-y-4">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Progress</h1>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className={labelClass}>Trend weight</h2>
          <div role="radiogroup" aria-label="Chart range" className="flex rounded-control bg-surface-2 p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={range === r.key}
                onClick={() => setRange(r.key)}
                className={['num min-h-11 min-w-11 rounded-[8px] px-2 text-[14px]! font-semibold!', range === r.key ? 'bg-surface-3 text-ink-1!' : 'text-ink-2!'].join(' ')}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {latest === null ? (
          <div className="space-y-3 py-2">
            <p className="text-[18px] font-semibold leading-snug">No readings yet</p>
            <p className="text-[15px] leading-relaxed text-ink-2">Your first check-in starts the trend line. Weigh in on the check-in day and the chart fills in from there.</p>
            <Link to={PATHS.checkin} className={primaryButtonClass}>
              Log a weigh-in
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="num text-[40px] font-bold leading-none tracking-tight">{kg1(trend.trend_weight_g ?? latest.weight_g)}</span>
                  <span className="text-[15px] font-semibold text-ink-2">kg</span>
                </div>
                <p className="mt-1 text-[14px] text-ink-2">
                  Latest <span className="num font-semibold text-ink-1">{kg1(latest.weight_g)} kg</span>, {formatDayShort(latest.date_key)}
                </p>
              </div>
              {collecting ? (
                <p className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-ink-2">
                  Collecting <span className="num">{Math.min(collecting.count, collecting.expected)}</span> of <span className="num">{collecting.expected}</span>
                </p>
              ) : null}
            </div>

            <ChunkBoundary>
              <Suspense fallback={<ChartFrame />}>
                <WeightStrengthCharts weight={weightData} strength={strengthData} strengthName={strengthSeries?.name ?? null} />
              </Suspense>
            </ChunkBoundary>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-ink-2" aria-hidden="true">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-[var(--chart-1)] opacity-50" /> Reading
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 bg-[var(--chart-1)]" /> Trend
              </span>
              {weightData.waistDomain ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-[var(--chart-2)]" /> Waist, cm
                </span>
              ) : null}
            </div>

            <div className="border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[16px] font-semibold leading-snug">{trendRead.headline}</p>
                {trendRead.tone === 'attention' ? (
                  <span className="shrink-0 rounded-full bg-rose/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-rose-text">Needs attention</span>
                ) : null}
              </div>
              {trendRead.detail ? <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{trendRead.detail}</p> : null}
            </div>
          </>
        )}
      </Card>

      <ConsistencyStrip chips={chips} target={target} />
    </section>
  )
}
