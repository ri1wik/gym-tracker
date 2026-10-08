// The one adapter between the screens and the trend engine in
// src/domain/calc/trend.ts. The engine's output flows through unchanged;
// this file exists so every screen keeps one import path.

import { trendState, type TrendOptions, type TrendState, type WeightReading } from '../../domain/calc/trend'

/** The trend state for a set of weigh-ins. */
export function readTrend(readings: readonly WeightReading[], options: TrendOptions): TrendState {
  return trendState(readings, options)
}
