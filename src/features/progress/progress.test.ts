import { describe, expect, it } from 'vitest'
import { dayNumber } from '../../domain/dates'
import { BAND_VERDICT_EXPECTED_READINGS, type TrendState } from '../../domain/calc/trend'
import { buildStrengthChartData, buildWeightChartData, niceTicks, xAxisFor } from './chartData'
import { consistencySummary, weeklyConsistency } from './consistency'
import { collapseByDay, collectingTrend, readTrend, smoothingLine } from './trend'
import { describeTrend } from './trendCopy'

const TODAY = '2026-10-08'

describe('trend adapter', () => {
  const readings = [
    { date_key: '2026-09-26', weight_g: 83_000 },
    { date_key: '2026-09-30', weight_g: 82_600 },
    { date_key: '2026-10-04', weight_g: 82_400 },
  ]

  it('falls back to an honest collecting state while the engine is a stub', () => {
    const t = readTrend(readings, { goal: 'recomp' })
    expect(t.band).toBe('collecting')
    expect(t.direction).toBe('unknown')
    expect(t.rate_pct_per_week).toBeNull()
    expect(t.readings_count).toBe(3)
    expect(t.readings_expected).toBe(BAND_VERDICT_EXPECTED_READINGS)
    expect(t.readings_needed).toBe(7)
    expect(t.delta_since_last_g).toBe(-200)
    expect(t.trend_points).toHaveLength(3)
  })

  it('collapses duplicate days to the latest and sorts', () => {
    const c = collapseByDay([
      { date_key: '2026-10-04', weight_g: 82_400 },
      { date_key: '2026-09-30', weight_g: 82_600 },
      { date_key: '2026-10-04', weight_g: 82_200 },
    ])
    expect(c).toEqual([
      { date_key: '2026-09-30', weight_g: 82_600 },
      { date_key: '2026-10-04', weight_g: 82_200 },
    ])
  })

  it('smooths with an 8-day half life over elapsed days', () => {
    const line = smoothingLine([
      { date_key: '2026-10-01', weight_g: 80_000 },
      { date_key: '2026-10-09', weight_g: 82_000 },
    ])
    expect(line[0].trend_g).toBe(80_000)
    // 8 days is exactly one half life: halfway between the old line and the new reading.
    expect(line[1].trend_g).toBe(81_000)
  })

  it('handles no readings', () => {
    const t = collectingTrend([])
    expect(t.readings_count).toBe(0)
    expect(t.trend_weight_g).toBeNull()
    expect(t.delta_since_last_g).toBeNull()
  })
})

describe('trend copy', () => {
  const base: TrendState = {
    slope_g_per_day: null,
    rate_pct_per_week: null,
    rate_ci_pct_per_week: null,
    band: 'collecting',
    direction: 'unknown',
    precision: 'none',
    readings_count: 3,
    readings_needed: 7,
    readings_expected: 10,
    trend_points: [],
    trend_weight_g: null,
    delta_since_last_g: null,
  }
  const verdicts = (['on_track', 'flat', 'too_fast', 'gaining', 'slow_down', 'not_yet_precise', 'collecting'] as const).flatMap((band) =>
    (['recomp', 'fat_loss', 'lean_gain', 'maintain'] as const).map((goal) =>
      describeTrend({ ...base, band, direction: 'down', precision: 'full', rate_pct_per_week: band === 'gaining' ? 0.6 : band === 'slow_down' ? -1.7 : band === 'too_fast' ? -1.2 : -0.4 }, goal),
    ),
  )

  it('shows n of 10 while collecting', () => {
    expect(describeTrend(base, 'recomp').collecting).toEqual({ count: 3, expected: 10 })
    expect(describeTrend({ ...base, readings_count: 0 }, 'recomp').headline).toBe('No readings yet')
  })

  it('reads an imprecise direction as such', () => {
    const r = describeTrend({ ...base, band: 'not_yet_precise', direction: 'down', readings_count: 6 }, 'recomp')
    expect(r.headline).toBe('Direction: down, not yet precise')
    expect(r.collecting).toEqual({ count: 6, expected: 10 })
  })

  it('a flat scale on recomposition reads neutral, never as a problem', () => {
    const r = describeTrend({ ...base, band: 'flat', rate_pct_per_week: 0.05, direction: 'flat', precision: 'full' }, 'recomp')
    expect(r.tone).toBe('neutral')
    expect(r.headline).not.toMatch(/attention/i)
  })

  it('every attention message names a number or a step and ends in an action', () => {
    const attention = verdicts.filter((v) => v.tone === 'attention')
    expect(attention.length).toBeGreaterThan(0)
    for (const v of attention) {
      expect(v.headline.startsWith('Needs attention')).toBe(true)
      expect(v.detail).toMatch(/\d/)
    }
  })

  it('never uses banned words or exclamation marks', () => {
    const banned = [['neg', 'ative'].join(''), ['fai', 'led'].join(''), 'burns fat', 'boosts metabolism', 'detox', 'cures']
    for (const v of verdicts) {
      const text = `${v.headline} ${v.detail ?? ''}`.toLowerCase()
      for (const w of banned) expect(text).not.toContain(w)
      expect(text).not.toContain('!')
    }
  })
})

describe('weight chart data', () => {
  const readings = [
    { date_key: '2026-09-04', weight_g: 84_000, waist_mm: 900 },
    { date_key: '2026-09-12', weight_g: 83_400, waist_mm: null },
    { date_key: '2026-09-20', weight_g: 83_000, waist_mm: 890 },
    { date_key: '2026-10-04', weight_g: 82_400, waist_mm: null },
  ]
  const trendPoints = readings.map((r) => ({ date_key: r.date_key, trend_g: r.weight_g - 100 }))

  it('puts readings, trend and waist on one day-number axis in kg and cm', () => {
    const d = buildWeightChartData({ readings, trendPoints, range: '12w', today: TODAY })
    expect(d.raw.map((p) => p.y)).toEqual([84, 83.4, 83, 82.4])
    expect(d.trend[0].y).toBe(83.9)
    expect(d.waist.map((p) => p.y)).toEqual([90, 89])
    expect(d.raw[0].x).toBe(dayNumber('2026-09-04'))
    expect(d.xDomain[1]).toBe(dayNumber(TODAY))
  })

  it('starts the window just before the first reading instead of stretching an empty past', () => {
    const d = buildWeightChartData({ readings, trendPoints, range: '12w', today: TODAY })
    expect(d.xDomain[0]).toBe(dayNumber('2026-09-04') - 2)
    expect(d.xTicks[d.xTicks.length - 1]).toBe(d.xDomain[1])
    expect(d.xTicks).toEqual([...d.xTicks].sort((a, b) => a - b))
    expect(d.xTicks.every((t) => t >= d.xDomain[0] && t <= d.xDomain[1])).toBe(true)
  })

  it('the 4 week window drops older readings', () => {
    const d = buildWeightChartData({ readings, trendPoints, range: '4w', today: TODAY })
    expect(d.raw.map((p) => p.key)).toEqual(['2026-09-12', '2026-09-20', '2026-10-04'])
  })

  it('pads the weight domain and keeps a minimum span', () => {
    const d = buildWeightChartData({ readings, trendPoints, range: 'all', today: TODAY })
    expect(d.weightDomain[0]).toBeLessThanOrEqual(82.3)
    expect(d.weightDomain[1]).toBeGreaterThanOrEqual(84)
    const flat = buildWeightChartData({ readings: [{ date_key: '2026-10-04', weight_g: 80_000, waist_mm: null }], trendPoints: [], range: '12w', today: TODAY })
    expect(flat.weightDomain[1] - flat.weightDomain[0]).toBeGreaterThanOrEqual(2)
    expect(flat.waistDomain).toBeNull()
  })

  it('an empty history still yields a usable axis', () => {
    const d = buildWeightChartData({ readings: [], trendPoints: [], range: '12w', today: TODAY })
    expect(d.raw).toEqual([])
    expect(d.xDomain[1] - d.xDomain[0]).toBe(84)
  })

  it('never makes an axis shorter than a week', () => {
    const a = xAxisFor(dayNumber(TODAY), TODAY, '12w', dayNumber(TODAY))
    expect(a.domain[1] - a.domain[0]).toBeGreaterThanOrEqual(8)
  })

  it('the strength panel shares the window and falls back to an empty domain', () => {
    const d = buildWeightChartData({ readings, trendPoints, range: '12w', today: TODAY })
    const empty = buildStrengthChartData(null, d.xDomain)
    expect(empty.points).toEqual([])
    const s = buildStrengthChartData({ points: [{ date_key: '2026-09-20', e1rm_g: 100_000 }, { date_key: '2025-01-01', e1rm_g: 50_000 }] }, d.xDomain)
    expect(s.points).toHaveLength(1)
    expect(s.points[0].y).toBe(100)
    expect(s.domain[0]).toBeLessThan(100)
    expect(s.domain[1]).toBeGreaterThan(100)
  })
})

describe('round-number ticks', () => {
  it('keeps ticks inside the domain, ascending, at a round step', () => {
    expect(niceTicks(81.5, 85)).toEqual([82, 83, 84, 85])
    expect(niceTicks(86, 92)).toEqual([86, 88, 90, 92])
    expect(niceTicks(0, 1)).toEqual([0, 0.5, 1])
  })
  it('the weight chart carries its own ticks inside each domain', () => {
    const d = buildWeightChartData({ readings: [{ date_key: '2026-10-04', weight_g: 82_400, waist_mm: 880 }], trendPoints: [], range: '12w', today: TODAY })
    for (const t of d.weightTicks) expect(t >= d.weightDomain[0] && t <= d.weightDomain[1]).toBe(true)
    expect(d.weightTicks.length).toBeGreaterThanOrEqual(2)
    expect(d.waistTicks.length).toBeGreaterThanOrEqual(2)
  })
})

describe('weekly consistency', () => {
  // 2026-10-08 is a Thursday; with Monday weeks the current week starts 2026-10-05.
  const days = ['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-30', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']

  it('builds twelve chips ending with the current week', () => {
    const chips = weeklyConsistency({ sessionDays: days, today: TODAY, weekStartsOn: 1, target: 3 })
    expect(chips).toHaveLength(12)
    expect(chips[11].start).toBe('2026-10-05')
    expect(chips[11].isCurrent).toBe(true)
    expect(chips[0].start).toBe('2026-07-20')
  })

  it('classifies hit, partial, off and before', () => {
    const chips = weeklyConsistency({ sessionDays: days, today: TODAY, weekStartsOn: 1, target: 3 })
    const by = Object.fromEntries(chips.map((c) => [c.start, c]))
    expect(by['2026-09-14'].count).toBe(3)
    expect(by['2026-09-14'].state).toBe('hit')
    expect(by['2026-09-21'].state).toBe('partial')
    expect(by['2026-09-28'].state).toBe('partial')
    expect(by['2026-10-05'].count).toBe(4)
    expect(by['2026-10-05'].state).toBe('hit')
    expect(by['2026-07-20'].state).toBe('before')
    expect(by['2026-09-07'].state).toBe('before')
  })

  it('a week without sessions after the first one is off, not a reset', () => {
    const chips = weeklyConsistency({ sessionDays: ['2026-09-01', '2026-09-30'], today: TODAY, weekStartsOn: 1, target: 3 })
    const by = Object.fromEntries(chips.map((c) => [c.start, c.state]))
    expect(by['2026-09-14']).toBe('off')
    expect(by['2026-09-07']).toBe('off')
  })

  it('respects the week start day', () => {
    const sun = weeklyConsistency({ sessionDays: ['2026-10-04'], today: TODAY, weekStartsOn: 0, target: 1 })
    expect(sun[11].start).toBe('2026-10-04')
    expect(sun[11].state).toBe('hit')
    const mon = weeklyConsistency({ sessionDays: ['2026-10-04'], today: TODAY, weekStartsOn: 1, target: 1 })
    expect(mon[11].state).toBe('off')
    expect(mon[10].state).toBe('hit')
  })

  it('the program start makes earlier-than-first-session weeks count as off', () => {
    const chips = weeklyConsistency({ sessionDays: ['2026-10-06'], today: TODAY, weekStartsOn: 1, target: 3, activeFrom: '2026-09-14' })
    const by = Object.fromEntries(chips.map((c) => [c.start, c.state]))
    expect(by['2026-09-14']).toBe('off')
    expect(by['2026-09-07']).toBe('before')
  })

  it('summarises finished weeks and counts the current week only once it is a hit', () => {
    const chips = weeklyConsistency({ sessionDays: days, today: TODAY, weekStartsOn: 1, target: 3 })
    expect(consistencySummary(chips)).toEqual({ met: 2, of: 4 })
    const partialNow = weeklyConsistency({ sessionDays: ['2026-09-14', '2026-10-06'], today: TODAY, weekStartsOn: 1, target: 3 })
    expect(consistencySummary(partialNow)).toEqual({ met: 0, of: 3 })
    expect(consistencySummary(weeklyConsistency({ sessionDays: [], today: TODAY, weekStartsOn: 1, target: 3 }))).toEqual({ met: 0, of: 0 })
  })
})
