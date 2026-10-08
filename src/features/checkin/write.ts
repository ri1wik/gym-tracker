// The one place this slice writes synced rows.
//
// Integration: the sync builder's transactional writeRow in
// src/data/sync/write.ts has the same shape and also appends the outbox row.
// Replace the body of writeRow below with a call to it, and import weighInId
// from src/data/sync/ids.ts (same namespace and key format, so the ids match
// the ones already written here).

import { v5 as uuidV5 } from 'uuid'
import type { GymDb } from '../../data/db'
import type { DateKey, RowOf, SyncTable, SyncedRow, WeighIn } from '../../domain/types'

/** Fixed namespace for every derived id in this app. Mirrors src/data/sync/ids.ts. */
const ID_NAMESPACE = '6f1c2a3e-7b7d-4b6a-9d0e-2f3a4b5c6d7e'

/** body_weights: one row per user and day, so two devices merge instead of colliding. */
export function weighInId(userId: string, dateKey: DateKey): string {
  return uuidV5(`body_weights:${userId}:${dateKey}`, ID_NAMESPACE)
}

type StampedField = 'created_at' | 'updated_at' | 'version' | 'deleted_at' | 'dirty'

/** A row as a caller supplies it: everything but the stamps, which are optional. */
export type Draft<T extends SyncedRow> = Omit<T, StampedField> & Partial<Pick<T, StampedField>>

/**
 * Upsert a row locally with dirty = 1. Keeps created_at and version from the
 * existing row (version is the server's counter; the client starts it at 1).
 */
export async function writeRow<T extends SyncTable>(db: GymDb, table: T, draft: Draft<RowOf<T>>): Promise<RowOf<T>> {
  const tbl = db.syncTable(table)
  const existing = await tbl.get(draft.id)
  const stamp = new Date().toISOString()
  const row: Record<string, unknown> = {
    ...(existing ?? {}),
    ...draft,
    created_at: draft.created_at ?? existing?.created_at ?? stamp,
    updated_at: stamp,
    version: existing?.version ?? draft.version ?? 1,
    deleted_at: draft.deleted_at !== undefined ? draft.deleted_at : (existing?.deleted_at ?? null),
    dirty: 1,
  }
  await tbl.put(row)
  return row as unknown as RowOf<T>
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
    // A weigh-in that was soft deleted and is logged again comes back to life.
    deleted_at: null,
  })
}
