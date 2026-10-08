// The last check-in's band and candidate band, kept in the meta table so the
// hysteresis rules in src/domain/calc/trend.ts (keep the verdict while the
// interval widens, the 0.05 edge rule, the two-run rule) carry across
// sessions. Only a check-in advances the memory; the Progress tab reads it.
// A re-saved check-in on the same day uses the memory from before that day,
// so one day never counts as two runs.

import type { GymDb } from '../../data/db'
import { META_KEYS } from '../../data/db'
import type { TrendBand, TrendState } from '../../domain/calc/trend'
import type { Goal } from '../../domain/calc/targets'
import type { DateKey } from '../../domain/types'

export interface TrendMemory {
  /** The check-in day the memory was written on. */
  date_key: DateKey
  band: TrendBand
  candidate_band: TrendBand | null
  /** What was fed into that check-in, kept so a same-day re-save starts from the same place. */
  previous_band: TrendBand | null
  previous_candidate_band: TrendBand | null
}

export interface PreviousTrend {
  previous_band: TrendBand | null
  previous_candidate_band: TrendBand | null
}

export const NO_PREVIOUS: PreviousTrend = { previous_band: null, previous_candidate_band: null }

function isMemory(v: unknown): v is TrendMemory {
  return !!v && typeof v === 'object' && typeof (v as TrendMemory).date_key === 'string' && typeof (v as TrendMemory).band === 'string'
}

export async function readTrendMemory(db: GymDb, goal: Goal): Promise<TrendMemory | null> {
  try {
    const row = await db.meta.get(META_KEYS.trendState(goal))
    return isMemory(row?.value) ? row.value : null
  } catch {
    return null
  }
}

/** The previous state to feed a read on `dateKey` (today for the Progress tab). */
export function previousFor(memory: TrendMemory | null, dateKey: DateKey): PreviousTrend {
  if (!memory) return NO_PREVIOUS
  if (memory.date_key === dateKey) return { previous_band: memory.previous_band, previous_candidate_band: memory.previous_candidate_band }
  return { previous_band: memory.band, previous_candidate_band: memory.candidate_band }
}

/** Record the state a check-in settled on. */
export async function writeTrendMemory(db: GymDb, goal: Goal, dateKey: DateKey, state: TrendState, fed: PreviousTrend): Promise<void> {
  const memory: TrendMemory = {
    date_key: dateKey,
    band: state.band,
    candidate_band: state.candidate_band ?? null,
    previous_band: fed.previous_band,
    previous_candidate_band: fed.previous_candidate_band,
  }
  await db.meta.put({ key: META_KEYS.trendState(goal), value: memory })
}
