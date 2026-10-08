import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { deleteUserDb, openUserDb } from '../../data/db'
import { addDays } from '../../domain/dates'
import type { TrendBand } from '../../domain/calc/trend'
import type { DateKey } from '../../domain/types'
import { buildMiniRead } from '../checkin/miniRead'
import { previousFor, readTrendMemory, writeTrendMemory } from './trendMemory'

const U = 'u-trend-memory'

afterEach(async () => {
  await deleteUserDb(U)
})

// Ten synthetic check-ins every 4 days: seven flat readings settle as flat
// at the full read, then a water spike and a dip widen the interval past
// the flat band while the point rate stays inside it. A stateless read
// drops the headline to not yet precise at check-ins 9 and 10; with the
// memory fed back the earned verdict holds (trend.ts applyHysteresis).
const WEIGHTS = [78000, 78050, 77950, 78020, 77980, 78030, 77990, 78700, 77300, 78010]
const START: DateKey = '2026-09-01'

function readings(k: number) {
  return WEIGHTS.slice(0, k).map((weight_g, i) => ({
    id: `r${i}`,
    user_id: U,
    date_key: addDays(START, i * 4),
    weight_g,
    waist_mm: null,
    same_conditions: true,
    note: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    version: 1,
    deleted_at: null,
    dirty: 0 as const,
  }))
}

describe('trend memory across check-ins', () => {
  it('a settled band never reverts to not yet precise once the memory is fed back', async () => {
    const db = openUserDb(U)
    const stateful: TrendBand[] = []
    const stateless: TrendBand[] = []
    for (let k = 7; k <= WEIGHTS.length; k++) {
      const rows = readings(k)
      const today = rows[rows.length - 1].date_key
      stateless.push(buildMiniRead({ readings: rows, dateKey: today, goal: 'recomp', intervalDays: 4 })!.trend.band)
      const memory = previousFor(await readTrendMemory(db, 'recomp'), today)
      const read = buildMiniRead({ readings: rows, dateKey: today, goal: 'recomp', intervalDays: 4, memory })!
      await writeTrendMemory(db, 'recomp', today, read.trend, memory)
      stateful.push(read.trend.band)
    }
    expect(stateless).toEqual(['flat', 'flat', 'not_yet_precise', 'not_yet_precise'])
    expect(stateful).toEqual(['flat', 'flat', 'flat', 'flat'])
  })

  it('a re-saved check-in on the same day starts from the memory before that day', async () => {
    const db = openUserDb(U)
    const rows = readings(9)
    const today = rows[rows.length - 1].date_key
    const fed = { previous_band: 'flat' as const, previous_candidate_band: 'flat' as const }
    const read = buildMiniRead({ readings: rows, dateKey: today, goal: 'recomp', intervalDays: 4, memory: fed })!
    await writeTrendMemory(db, 'recomp', today, read.trend, fed)
    const again = previousFor(await readTrendMemory(db, 'recomp'), today)
    expect(again).toEqual(fed)
    const tomorrow = previousFor(await readTrendMemory(db, 'recomp'), addDays(today, 1))
    expect(tomorrow).toEqual({ previous_band: read.trend.band, previous_candidate_band: read.trend.candidate_band ?? null })
  })

  it('no memory means no previous state', async () => {
    const db = openUserDb(U)
    expect(previousFor(await readTrendMemory(db, 'recomp'), START)).toEqual({ previous_band: null, previous_candidate_band: null })
  })
})
