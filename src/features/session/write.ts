// The one write path for the logger slice. Every row this slice stores goes
// through writeRow or writeRows with dirty: 1, so the sync slice's
// transactional write() (src/data/sync/write.ts) can replace the body of
// these two functions in one line at integration.

import { GUEST_USER_ID, openUserDb, type GymDb } from '../../data/db'
import type { RowOf, SyncTable } from '../../domain/types'

/** Before sign-in every row is owned by the guest id; the sync slice migrates it. */
export function sessionUserId(): string {
  return GUEST_USER_ID
}

export function sessionDb(): GymDb {
  return openUserDb(sessionUserId())
}

export async function writeRow<T extends SyncTable>(table: T, row: RowOf<T>): Promise<void> {
  await sessionDb()
    .syncTable(table)
    .put({ ...(row as unknown as Record<string, unknown>), dirty: 1 })
}

export async function writeRows<T extends SyncTable>(table: T, rows: RowOf<T>[]): Promise<void> {
  if (rows.length === 0) return
  await sessionDb()
    .syncTable(table)
    .bulkPut(rows.map((r) => ({ ...(r as unknown as Record<string, unknown>), dirty: 1 })))
}

export async function readMeta<T>(key: string): Promise<T | null> {
  const row = await sessionDb().meta.get(key)
  return row ? (row.value as T) : null
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await sessionDb().meta.put({ key, value })
}
