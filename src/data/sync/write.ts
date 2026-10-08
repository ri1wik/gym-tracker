// The one local write path. Every mutation of a synced row goes through
// writeRow or softDeleteRow: the row and its outbox entry land in ONE Dexie
// transaction, so a phone killed between the two can never hold a change
// the server will not see (docs/SPEC-critic-fixes.md, atomicity).
//
// OWNER: data-sync. UI slices call the typed helpers in src/data/repo, which
// are thin wrappers over this file.

import type { OutboxItem, RowOf, SyncTable, SyncedRow } from '../../domain/types'
import { LOCAL_ONLY_FIELDS } from '../../domain/types'
import type { GymDb } from '../db'
import { nowIso } from './clock'
import { outboxId } from './ids'

/** Fields the local write stamps; a caller may pass them but never has to. */
export type StampedField = 'created_at' | 'updated_at' | 'version' | 'deleted_at' | 'dirty'

/** A row as a caller supplies it: everything but the stamps, which are optional. */
export type Draft<T extends SyncedRow> = Omit<T, StampedField> & Partial<Pick<T, StampedField>>

/** The row as the outbox carries it: local-only fields stripped. */
export function toPayload(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const f of LOCAL_ONLY_FIELDS) delete out[f]
  return out
}

function outboxEntry(table: SyncTable, row: Record<string, unknown>, stamp: string): OutboxItem {
  return {
    id: outboxId(table, String(row.id)),
    table,
    row_id: String(row.id),
    op: 'upsert',
    payload: toPayload(row),
    created_at: stamp,
    attempts: 0,
    state: 'pending',
    last_error: null,
  }
}

/**
 * Upsert a row locally and queue it for the server, in one transaction.
 * Stamps updated_at, keeps created_at and version from the existing row
 * (version is the server's counter; the client never invents one beyond the
 * initial 1), sets dirty to 1 and coalesces the outbox to one entry per row.
 */
export async function writeRow<T extends SyncTable>(db: GymDb, table: T, draft: Draft<RowOf<T>>): Promise<RowOf<T>> {
  const tbl = db.syncTable(table)
  return db.transaction('rw', [tbl, db.outbox], async () => {
    const existing = await tbl.get(draft.id)
    const stamp = nowIso()
    const row: Record<string, unknown> = {
      ...(existing ?? {}),
      ...draft,
      created_at: draft.created_at ?? existing?.created_at ?? stamp,
      updated_at: stamp,
      version: existing?.version ?? draft.version ?? 1,
      deleted_at: draft.deleted_at ?? existing?.deleted_at ?? null,
      dirty: 1,
    }
    await tbl.put(row)
    await db.outbox.put(outboxEntry(table, row, stamp))
    return row as unknown as RowOf<T>
  })
}

/** Change a few fields of an existing row. Resolves null when the row does not exist. */
export async function patchRow<T extends SyncTable>(
  db: GymDb,
  table: T,
  id: string,
  patch: Partial<Omit<RowOf<T>, 'id' | StampedField>>,
): Promise<RowOf<T> | null> {
  const tbl = db.syncTable(table)
  return db.transaction('rw', [tbl, db.outbox], async () => {
    const existing = await tbl.get(id)
    if (!existing) return null
    const stamp = nowIso()
    const row: Record<string, unknown> = { ...existing, ...patch, id, updated_at: stamp, dirty: 1 }
    await tbl.put(row)
    await db.outbox.put(outboxEntry(table, row, stamp))
    return row as unknown as RowOf<T>
  })
}

/** Soft delete: sets deleted_at so the deletion reaches the other device. Tombstones are never purged. */
export async function softDeleteRow<T extends SyncTable>(db: GymDb, table: T, id: string): Promise<RowOf<T> | null> {
  const tbl = db.syncTable(table)
  return db.transaction('rw', [tbl, db.outbox], async () => {
    const existing = await tbl.get(id)
    if (!existing) return null
    const stamp = nowIso()
    const row: Record<string, unknown> = {
      ...existing,
      deleted_at: existing.deleted_at ?? stamp,
      updated_at: stamp,
      dirty: 1,
    }
    await tbl.put(row)
    await db.outbox.put(outboxEntry(table, row, stamp))
    return row as unknown as RowOf<T>
  })
}

/**
 * Queue a file for the storage bucket. The outbox entry carries the blob in
 * IndexedDB so a check-in in a dead spot still completes. The upload is sent
 * before any upsert of the row that references it (uploads sort first).
 */
export async function enqueueUpload(db: GymDb, table: SyncTable, rowId: string, path: string, blob: Blob): Promise<void> {
  await db.outbox.put({
    id: `upload:${path}`,
    table,
    row_id: rowId,
    op: 'upload',
    payload: { path, content_type: blob.type || 'application/octet-stream' },
    blob,
    created_at: nowIso(),
    attempts: 0,
    state: 'pending',
    last_error: null,
  })
}
