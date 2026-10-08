import { describe, expect, it } from 'vitest'
import { addDays } from '../dates'
import {
  applyHysteresis,
  candidateBand,
  ewmaPoints,
  kgPerWeek,
  theilSen,
  trendState,
  type TrendBand,
  type WeightReading,
} from './trend'

const DAY0 = '2026-03-01'

function series(points: readonly [number, number][]): WeightReading[] {
  // [day offset, kg]
  return points.map(([d, kg]) => ({ date_key: addDays(DAY0, d), weight_g: Math.round(kg * 1000) }))
}

describe('trend: the worked example', () => {
  it('weekly points 80.0, 79.7, 79.3, 79.0 give about minus 0.34 kg per week, direction down, no verdict before the full read', () => {
    const s = trendState(series([[0, 80.0], [7, 79.7], [14, 79.3], [21, 79.0]]), { goal: 'recomp' })
    expect(kgPerWeek(s)).toBeCloseTo(-0.34, 2)
    expect(s.rate_pct_per_week).toBeCloseTo(-0.43, 1)
    expect(s.precision).toBe('early')
    expect(s.direction).toBe('down')
    // PLAN.md section 12: no band verdict before 7 readings over 24 days.
    expect(s.band).toBe('not_yet_precise')
    expect(s.candidate_band).toBe('not_yet_precise')
    expect(s.readings_needed).toBe(10 - 4)
  })
})

describe('trend: no verdict from four collinear readings', () => {
  it('80.0, 79.7, 79.4, 79.1 every 4 days (0.1 kg scale, steady loss) keeps a finite interval and no band', () => {
    const s = trendState(series([[0, 80.0], [4, 79.7], [8, 79.4], [12, 79.1]]), { goal: 'recomp' })
    expect(s.precision).toBe('early')
    expect(s.direction).toBe('down')
    const [lo, hi] = s.rate_ci_pct_per_week!
    expect(hi - lo).toBeGreaterThan(0)
    expect(Number.isFinite(lo) && Number.isFinite(hi)).toBe(true)
    expect(s.band).toBe('not_yet_precise')
    expect(s.readings_needed).toBe(6)
  })
  it('80.0, 79.5, 79.0, 78.5 every 4 days never yields a too-fast candidate at four readings', () => {
    const s = trendState(series([[0, 80.0], [4, 79.5], [8, 79.0], [12, 78.5]]), { goal: 'recomp' })
    expect(s.precision).toBe('early')
    expect(s.rate_pct_per_week!).toBeLessThan(-1.0)
    expect(s.candidate_band).toBe('not_yet_precise')
    expect(s.band).toBe('not_yet_precise')
  })
  it('the sigma floor gives a collinear full read a finite interval and still a verdict when it fits the band', () => {
    const clean = series([[0, 80.0], [4, 79.8], [8, 79.6], [12, 79.4], [16, 79.2], [20, 79.0], [24, 78.8]])
    const s = trendState(clean, { goal: 'recomp' })
    expect(s.precision).toBe('full')
    const [lo, hi] = s.rate_ci_pct_per_week!
    expect(hi - lo).toBeGreaterThan(0.1)
    expect(s.band).toBe('on_track')
  })
  it('theilSen floors the residual sigma', () => {
    const flat = theilSen([0, 4, 8, 12], [80_000, 79_700, 79_400, 79_100])
    expect(flat.slope_se).toBe(0)
    const floored = theilSen([0, 4, 8, 12], [80_000, 79_700, 79_400, 79_100], 100)
    expect(floored.slope_se).toBeCloseTo(100 / Math.sqrt(80), 6)
  })
})

describe('trend: the 4-day cadence fixture', () => {
  const early = series([[0, 82.0], [4, 81.8], [8, 81.6], [12, 81.5]])
  const later = series([[16, 81.2], [20, 81.1], [24, 80.9]])

  it('four readings over 12 days give an early directional read, not a band verdict', () => {
    const s = trendState(early, { goal: 'recomp' })
    expect(s.precision).toBe('early')
    expect(s.direction).toBe('down')
    expect(s.band).toBe('not_yet_precise')
    expect(s.rate_ci_pct_per_week).not.toBeNull()
    const [lo, hi] = s.rate_ci_pct_per_week!
    expect(lo).toBeLessThan(-0.25)
    expect(hi).toBeGreaterThan(-0.25)
    expect(s.readings_needed).toBe(10 - 4)
    expect(s.readings_expected).toBe(10)
  })

  it('three readings, or four inside 12 days, are still collecting', () => {
    expect(trendState(early.slice(0, 3), { goal: 'recomp' }).band).toBe('collecting')
    const tight = series([[0, 82.0], [3, 81.8], [6, 81.6], [9, 81.5]])
    const s = trendState(tight, { goal: 'recomp' })
    expect(s.band).toBe('collecting')
    expect(s.precision).toBe('none')
    expect(s.rate_pct_per_week).toBeNull()
    expect(s.trend_points).toHaveLength(4)
  })

  it('seven clean readings over 24 days give a verdict because the interval fits inside on track', () => {
    const s = trendState([...early, ...later], { goal: 'recomp' })
    expect(s.precision).toBe('full')
    const [lo, hi] = s.rate_ci_pct_per_week!
    expect(lo).toBeGreaterThanOrEqual(-1.0)
    expect(hi).toBeLessThanOrEqual(-0.25)
    expect(s.band).toBe('on_track')
    expect(s.candidate_band).toBe('on_track')
  })

  it('a noisy series with the same spacing never gets a band verdict', () => {
    const noisy = series([[0, 82.0], [4, 81.1], [8, 82.3], [12, 80.9], [16, 81.9], [20, 80.8], [24, 81.6]])
    const s = trendState(noisy, { goal: 'recomp' })
    expect(s.precision).toBe('full')
    expect(s.band).toBe('not_yet_precise')
    const [lo, hi] = s.rate_ci_pct_per_week!
    expect(hi - lo).toBeGreaterThan(0.5)
  })

  it('extra weigh-ins between check-ins count and duplicates by date collapse to the latest', () => {
    const extra = [...early, ...later, { date_key: addDays(DAY0, 24), weight_g: 80_950 }, { date_key: addDays(DAY0, 22), weight_g: 81_000 }]
    const s = trendState(extra, { goal: 'recomp' })
    expect(s.readings_count).toBe(8)
    expect(s.trend_points[s.trend_points.length - 1].date_key).toBe(addDays(DAY0, 24))
    expect(s.delta_since_last_g).toBe(80_950 - 81_000)
  })

  it('a reading older than the window is drawn but not fitted', () => {
    const old = [{ date_key: addDays(DAY0, -40), weight_g: 90_000 }, ...early, ...later]
    const s = trendState(old, { goal: 'recomp' })
    expect(s.trend_points).toHaveLength(8)
    expect(s.window_readings).toBe(7)
    expect(s.band).toBe('on_track')
  })
})

describe('trend: too fast and slow down', () => {
  it('a clean drop past 1 percent per week reads too fast only on the second run', () => {
    const fast = series([[0, 80.0], [4, 79.5], [8, 79.0], [12, 78.5], [16, 78.0], [20, 77.5], [24, 77.0]])
    const first = trendState(fast, { goal: 'recomp' })
    expect(first.candidate_band).toBe('too_fast')
    expect(first.band).toBe('not_yet_precise')
    const second = trendState(fast, { goal: 'recomp', previous_band: first.band, previous_candidate_band: first.candidate_band })
    expect(second.band).toBe('too_fast')
  })

  it('loss past 1.5 percent per week reads slow down whatever the goal', () => {
    const steep = series([[0, 80.0], [4, 79.2], [8, 78.4], [12, 77.6], [16, 76.8], [20, 76.0], [24, 75.2]])
    for (const goal of ['recomp', 'fat_loss', 'maintain', 'lean_gain'] as const) {
      const first = trendState(steep, { goal })
      expect(first.candidate_band).toBe('slow_down')
      const second = trendState(steep, { goal, previous_band: first.band, previous_candidate_band: first.candidate_band })
      expect(second.band).toBe('slow_down')
    }
  })

  it('lean gain reads on track between 0.1 and 0.5 up and too fast above', () => {
    const gain = series([[0, 70.0], [4, 70.1], [8, 70.2], [12, 70.3], [16, 70.4], [20, 70.5], [24, 70.6]])
    expect(trendState(gain, { goal: 'lean_gain' }).band).toBe('on_track')
    expect(candidateBand('lean_gain', [0.6, 0.9])).toBe('too_fast')
    expect(candidateBand('lean_gain', [-0.6, -0.3])).toBe('slow_down')
    expect(candidateBand('recomp', [-0.6, -0.3])).toBe('on_track')
    expect(candidateBand('recomp', [-0.9, -0.3])).toBe('on_track')
    expect(candidateBand('recomp', [-0.3, -0.2])).toBe('not_yet_precise')
    expect(candidateBand('recomp', [-1.4, -1.1])).toBe('too_fast')
    expect(candidateBand('recomp', [-1.8, -1.2])).toBe('too_fast')
    expect(candidateBand('recomp', [-2.0, -1.6])).toBe('slow_down')
    expect(candidateBand('recomp', [0.3, 0.6])).toBe('gaining')
  })
})

describe('trend: hysteresis', () => {
  it('a rate walking from minus 0.20 to minus 0.28 and back never flips a flat verdict', () => {
    let band: TrendBand = 'flat'
    let candidate: TrendBand = 'flat'
    const walk: [number, TrendBand][] = [
      [-0.2, 'flat'],
      [-0.28, 'on_track'],
      [-0.2, 'flat'],
      [-0.29, 'on_track'],
      [-0.21, 'flat'],
    ]
    for (const [rate, cand] of walk) {
      band = applyHysteresis('recomp', cand, rate, band, candidate)
      candidate = cand
      expect(band).toBe('flat')
    }
  })

  it('crossing the edge by more than 0.05 points flips at once', () => {
    expect(applyHysteresis('recomp', 'on_track', -0.32, 'flat', 'flat')).toBe('on_track')
    expect(applyHysteresis('recomp', 'flat', -0.18, 'on_track', 'on_track')).toBe('flat')
  })

  it('staying across the edge for two runs flips', () => {
    expect(applyHysteresis('recomp', 'on_track', -0.28, 'flat', 'flat')).toBe('flat')
    expect(applyHysteresis('recomp', 'on_track', -0.28, 'flat', 'on_track')).toBe('on_track')
  })

  it('a widened interval keeps an earned verdict while the rate still sits inside its band', () => {
    expect(applyHysteresis('recomp', 'not_yet_precise', -0.4, 'on_track', 'on_track')).toBe('on_track')
    expect(applyHysteresis('recomp', 'not_yet_precise', -0.1, 'on_track', 'on_track')).toBe('not_yet_precise')
  })

  it('the first verdict needs no hysteresis', () => {
    expect(applyHysteresis('recomp', 'on_track', -0.4, null, null)).toBe('on_track')
    expect(applyHysteresis('recomp', 'flat', 0.0, 'not_yet_precise', 'not_yet_precise')).toBe('flat')
  })

  it('previous_band flows through trendState', () => {
    const clean = series([[0, 82.0], [4, 81.8], [8, 81.6], [12, 81.5], [16, 81.2], [20, 81.1], [24, 80.9]])
    const s = trendState(clean, { goal: 'recomp', previous_band: 'flat', previous_candidate_band: 'flat' })
    // The interval sits inside on track and the rate is more than 0.05 past the flat edge.
    expect(s.band).toBe('on_track')
  })
})

describe('trend: building blocks', () => {
  it('Theil-Sen is the median of pairwise slopes and shrugs off one outlier', () => {
    const fit = theilSen([0, 1, 2, 3, 4], [10, 11, 12, 13, 14])
    expect(fit.slope).toBeCloseTo(1, 9)
    expect(fit.intercept).toBeCloseTo(10, 9)
    const outlier = theilSen([0, 1, 2, 3, 4, 5, 6], [10, 11, 12, 30, 14, 15, 16])
    expect(outlier.slope).toBeCloseTo(1, 9)
    expect(outlier.slope_ci[0]).toBeLessThan(1)
    expect(outlier.slope_ci[1]).toBeGreaterThan(1)
  })

  it('the EWMA halves the remaining gap every 8 days', () => {
    const pts = ewmaPoints(
      [
        { date_key: 'a', weight_g: 80_000, day: 0 },
        { date_key: 'b', weight_g: 78_000, day: 8 },
        { date_key: 'c', weight_g: 78_000, day: 16 },
      ],
      8,
    )
    expect(pts.map((p) => p.trend_g)).toEqual([80_000, 79_000, 78_500])
  })

  it('an empty series is collecting with nothing to draw', () => {
    const s = trendState([], { goal: 'recomp' })
    expect(s.band).toBe('collecting')
    expect(s.readings_count).toBe(0)
    expect(s.readings_needed).toBe(4)
    expect(s.trend_weight_g).toBeNull()
  })

  it('cycle readings count from cycle_start', () => {
    const s = trendState(series([[0, 80.0], [4, 79.8], [8, 79.7]]), { goal: 'recomp', cycle_start: addDays(DAY0, 4) })
    expect(s.cycle_readings).toBe(2)
  })
})
