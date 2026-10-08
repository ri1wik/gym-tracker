// The two stacked chart panels: weight (raw dots, trend line, waist dots) on
// top, estimated one-rep max below, on ONE numeric day axis with the same
// margins, so a vertical line through both is the same day. Loaded lazily by
// the Progress tab only; nothing else in the app imports recharts.

import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDayShort } from '../profile/format'
import { formatAxisDay, type ChartPoint, type StrengthChartData, type WeightChartData } from './chartData'
import { keyFromDayNumber } from '../../domain/dates'

const Y_AXIS_W = 44
const WEIGHT_H = 190
const STRENGTH_H = 150

const tickStyle = { fill: 'var(--ink-2)', fontSize: 11, fontWeight: 600, className: 'num' } as const

interface Props {
  weight: WeightChartData
  strength: StrengthChartData
  strengthName: string | null
}

interface TipPayload {
  payload?: ChartPoint
  name?: string | number
}

function Tip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  const entry = active && payload && payload.length > 0 ? payload[0] : undefined
  const p = entry?.payload
  if (!entry || !p) return null
  const name = String(entry.name ?? '')
  return (
    <div className="rounded-control border border-line-strong bg-surface-2 px-3 py-2 text-[13px] shadow-lg">
      <div className="font-semibold text-ink-2">{formatDayShort(keyFromDayNumber(p.x))}</div>
      <div className="num text-[16px] font-bold text-ink-1">
        {p.y.toFixed(1)} {name === 'Waist' ? 'cm' : 'kg'}
      </div>
      <div className="text-ink-2">{name}</div>
    </div>
  )
}

function dot(radius: number, fillOpacity: number, color: string) {
  return function Dot(props: { cx?: number; cy?: number }) {
    if (props.cx === undefined || props.cy === undefined) return <g />
    return <circle cx={props.cx} cy={props.cy} r={radius} fill={color} fillOpacity={fillOpacity} />
  }
}

export default function WeightStrengthCharts({ weight, strength, strengthName }: Props) {
  const hasWaist = weight.waistDomain !== null
  const rightW = hasWaist ? Y_AXIS_W : 8
  const manyPoints = weight.xDomain[1] - weight.xDomain[0] > 45
  const rawDot = dot(manyPoints ? 1.8 : 2.8, manyPoints ? 0.28 : 0.45, 'var(--chart-1)')
  const waistDot = dot(3.4, 0.9, 'var(--chart-2)')
  const strengthDot = dot(3, 0.9, 'var(--chart-1)')
  const margin = { top: 8, right: 0, bottom: 8, left: 0 }

  return (
    <div>
      <div style={{ height: WEIGHT_H }} data-testid="weight-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={margin}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis type="number" dataKey="x" domain={weight.xDomain} ticks={weight.xTicks} hide allowDataOverflow />
            <YAxis
              yAxisId="w"
              dataKey="y"
              type="number"
              width={Y_AXIS_W}
              domain={weight.weightDomain}
              ticks={weight.weightTicks}
              interval={0}
              tick={tickStyle}
              tickFormatter={(v: number) => v.toFixed(1)}
              axisLine={false}
              tickLine={false}
              allowDataOverflow
            />
            {hasWaist && weight.waistDomain ? (
              <YAxis
                yAxisId="c"
                dataKey="y"
                type="number"
                orientation="right"
                width={Y_AXIS_W}
                domain={weight.waistDomain}
                ticks={weight.waistTicks}
                interval={0}
                tick={{ ...tickStyle, fill: 'var(--chart-2)' }}
                tickFormatter={(v: number) => v.toFixed(0)}
                axisLine={false}
                tickLine={false}
                allowDataOverflow
              />
            ) : null}
            <Tooltip cursor={false} content={<Tip />} />
            <Scatter yAxisId="w" data={weight.raw} shape={rawDot} isAnimationActive={false} name="Weigh-in" />
            {weight.trend.length > 0 ? (
              <Line
                yAxisId="w"
                data={weight.trend}
                dataKey="y"
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--surface-1)', strokeWidth: 2, fill: 'var(--chart-1)' }}
                isAnimationActive={false}
                tooltipType="none"
                name="Trend"
              />
            ) : null}
            {hasWaist ? <Scatter yAxisId="c" data={weight.waist} shape={waistDot} isAnimationActive={false} name="Waist" /> : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="relative mt-1" style={{ height: STRENGTH_H }} data-testid="strength-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ ...margin, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              type="number"
              dataKey="x"
              domain={weight.xDomain}
              ticks={weight.xTicks}
              tick={tickStyle}
              tickFormatter={formatAxisDay}
              axisLine={{ stroke: 'var(--line-strong)' }}
              tickLine={false}
              allowDataOverflow
              interval={0}
              padding={{ left: 0, right: 0 }}
            />
            <YAxis
              yAxisId="s"
              dataKey="y"
              type="number"
              width={Y_AXIS_W}
              domain={strength.domain}
              ticks={strength.ticks}
              interval={0}
              tick={strength.points.length > 0 ? tickStyle : false}
              tickFormatter={(v: number) => v.toFixed(0)}
              axisLine={false}
              tickLine={false}
              allowDataOverflow
            />
            {/* Reserve the same right-hand space as the weight panel so both plot areas line up. */}
            <YAxis yAxisId="pad" orientation="right" width={rightW} tick={false} axisLine={false} tickLine={false} />
            <Tooltip cursor={false} content={<Tip />} />
            {strength.points.length > 0 ? (
              <Line
                yAxisId="s"
                data={strength.points}
                dataKey="y"
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={strengthDot}
                isAnimationActive={false}
                name="Estimated 1 rep max"
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
        {strength.points.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[110px] items-center justify-center px-8 text-center">
            <p className="text-[14px] font-medium text-ink-2">
              {strengthName ?? 'Strength'} appears here after your first logged sessions, on the same dates as the weight above.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
