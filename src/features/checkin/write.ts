// The one place this slice writes synced rows. Every write goes through the
// sync layer's transactional writeRow (row plus outbox entry in one Dexie
// transaction) and then asks the engine to flush soon.

import type { GymDb } from '../../data/db'
import { notifyWrite } from '../../data/sync/engine'
import { weighInId } from '../../data/sync/ids'
import { writeRow as syncWriteRow, type Draft } from '../../data/sync/write'
import type { DateKey, RowOf, SyncTable, WeighIn } from '../../domain/types'

export { weighInId }
export type { Draft }

/** Upsert a row locally and queue it for the server. */
export async function writeRow<T extends SyncTable>(db: GymDb, table: T, draft: Draft<RowOf<T>>): Promise<RowOf<T>> {
  const row = await syncWriteRow(db, table, draft)
  notifyWrite()
  return row
}

export interface WeighInInput {
  date_key: DateKey
  weight_g: number
  /** undefined keeps the stored waist for the day; null clears it. */
  waist_mm?: number | null
  same_conditions: boolean
  note?: string | null
}

/** Save the day's weigh-in. A second save on the same day edits the same row. */
export async function saveWeighIn(db: GymDb, userId: string, input: WeighInInput): Promise<WeighIn> {
  const id = weighInId(userId, input.date_key)
  const existing = (await db.body_weights.get(id)) ?? null
  return writeRow(db, 'body_weights', {
    id,
    user_id: userId,
    date_key: input.date_key,
    weight_g: input.weight_g,
    waist_mm: input.waist_mm === undefined ? (existing?.waist_mm ?? null) : input.waist_mm,
    same_conditions: input.same_conditions,
    note: input.note === undefined ? (existing?.note ?? null) : input.note,
  })
}
