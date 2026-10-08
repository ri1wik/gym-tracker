// The one write path for the logger slice. Every row this slice stores goes
// through writeRow or writeRows, which hand it to the sync layer's
// transactional write (row plus outbox entry in one Dexie transaction) and
// then ask the engine to flush soon.

import type { GymDb } from '../../data/db'
import { currentDb, currentUserId } from '../../data/sync/current'
import { notifyWrite } from '../../data/sync/engine'
import { writeRow as syncWriteRow } from '../../data/sync/write'
import type { RowOf, SyncTable } from '../../domain/types'

/** The signed-in user id, or the guest id before sign-in (the sync layer migrates guest rows). */
export function sessionUserId(): string {
  return currentUserId()
}

export function sessionDb(): GymDb {
  return currentDb()
}

export async function writeRow<T extends SyncTable>(table: T, row: RowOf<T>): Promise<void> {
  await syncWriteRow(sessionDb(), table, row)
  notifyWrite()
}

export async function writeRows<T extends SyncTable>(table: T, rows: RowOf<T>[]): Promise<void> {
  if (rows.length === 0) return
  const db = sessionDb()
  await db.transaction('rw', [db.syncTable(table), db.outbox], async () => {
    for (const row of rows) await syncWriteRow(db, table, row)
  })
  notifyWrite()
}

export async function readMeta<T>(key: string): Promise<T | null> {
  const row = await sessionDb().meta.get(key)
  return row ? (row.value as T) : null
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await sessionDb().meta.put({ key, value })
}
