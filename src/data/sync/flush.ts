// Push the outbox. One table at a time, uploads before upserts, several rows
// per request. Every response is classified (./classify.ts): a 2xx clears
// the item and the row's dirty flag in one transaction keyed by the outbox
// id, 401 and 403 refresh the session once and retry, 408, 425, 429, 5xx
// and network errors stop the flush for a backoff, and only 400, 409 and
// 422 dead-letter the item. A batch that comes back dead is retried one row
// at a time so only the bad row is listed.
//
// The caller (engine.ts) guarantees single flight.
//
// OWNER: data-sync.

import type { OutboxItem, SyncTable } from '../../domain/types'
import type { GymDb } from '../db'
import { classifyStatus, describeError, type ResponseClass } from './classify'
import { nowIso } from './clock'
import type { Transport } from './transport'
import { SYNC_CONFIG_BY_NAME } from './tables'

export const PUSH_BATCH_SIZE = 200

/** Fields the server sets through triggers; the client never sends them. */
const SERVER_OWNED = ['version', 'updated_at'] as const

export interface FlushTableResult {
  sent: number
  dead: number
  /** Why the flush stopped early, if it did. */
  stopped: 'backoff' | 'refresh' | null
  error: string | null
}

export interface FlushState {
  /** Whether a refresh has already been spent on this flush. */
  refreshed: boolean
}

function wireRow(payload: Record<string, unknown>): Record<string, unknown> {
  const out = { ...payload }
  for (const f of SERVER_OWNED) delete out[f]
  return out
}

function stampOf(item: OutboxItem): string {
  return typeof item.payload.updated_at === 'string' ? item.payload.updated_at : item.created_at
}

/**
 * Mark a batch in flight and return what will actually go over the wire. The
 * snapshot read at the start of the flush is never written back: each item
 * is re-read inside the transaction, so an edit queued while an earlier
 * batch or an upload was on the wire keeps its newer payload and is sent as
 * it now is. Items that are no longer pending (settled or dead-lettered by a
 * concurrent path) drop out of the batch.
 */
async function markInFlight(db: GymDb, items: OutboxItem[]): Promise<OutboxItem[]> {
  return db.transaction('rw', db.outbox, async () => {
    const live: OutboxItem[] = []
    for (const snapshot of items) {
      const cur = await db.outbox.get(snapshot.id)
      if (!cur || cur.state !== 'pending') continue
      const next: OutboxItem = { ...cur, state: 'in_flight' }
      await db.outbox.put(next)
      live.push(next)
    }
    return live
  })
}

/**
 * Items left in flight by a kill or a thrown error (between the POST and the
 * settle) would otherwise never be read again, because every flush selects
 * pending only. The caller guarantees single flight, so at the start of a
 * flush nothing is genuinely in flight: put them back to pending.
 */
async function resetInFlight(db: GymDb, table: SyncTable): Promise<void> {
  await db.outbox
    .where('state')
    .equals('in_flight')
    .filter((i) => i.table === table)
    .modify({ state: 'pending' })
}

/** Put items back to pending after a retryable failure, counting the attempt. */
async function markRetry(db: GymDb, items: OutboxItem[], error: string): Promise<void> {
  await db.transaction('rw', db.outbox, async () => {
    for (const sent of items) {
      const cur = await db.outbox.get(sent.id)
      if (!cur) continue
      if (cur.state === 'in_flight') await db.outbox.put({ ...cur, state: 'pending', attempts: cur.attempts + 1, last_error: error })
    }
  })
}

async function markDead(db: GymDb, items: OutboxItem[], error: string): Promise<void> {
  await db.transaction('rw', db.outbox, async () => {
    for (const sent of items) {
      const cur = await db.outbox.get(sent.id)
      if (!cur) continue
      // An edit made during the flight gets a fresh try instead of the dead state.
      if (stampOf(cur) !== stampOf(sent)) {
        await db.outbox.put({ ...cur, state: 'pending' })
        continue
      }
      await db.outbox.put({ ...cur, state: 'dead', attempts: cur.attempts + 1, last_error: error })
    }
  })
}

/**
 * On a 2xx: for every item whose payload is still the one we sent, delete the
 * outbox row and clear dirty on the local row, taking the server's version
 * and updated_at. An item edited during the flight stays pending and dirty.
 */
async function settleUpserts(db: GymDb, table: SyncTable, sent: OutboxItem[], returned: unknown): Promise<number> {
  const serverRows = new Map<string, Record<string, unknown>>()
  if (Array.isArray(returned)) {
    for (const r of returned) {
      if (r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string') {
        serverRows.set((r as { id: string }).id, r as Record<string, unknown>)
      }
    }
  }
  const tbl = db.syncTable(table)
  let settled = 0
  await db.transaction('rw', [tbl, db.outbox], async () => {
    for (const item of sent) {
      const cur = await db.outbox.get(item.id)
      if (!cur) continue
      if (stampOf(cur) !== stampOf(item)) {
        await db.outbox.put({ ...cur, state: 'pending' })
        continue
      }
      await db.outbox.delete(item.id)
      settled += 1
      const local = await tbl.get(item.row_id)
      if (!local) continue
      if (local.updated_at !== stampOf(item)) continue
      const server = serverRows.get(item.row_id)
      await tbl.put({
        ...local,
        version: typeof server?.version === 'number' ? server.version : local.version,
        updated_at: typeof server?.updated_at === 'string' ? server.updated_at : local.updated_at,
        dirty: 0,
      })
    }
  })
  return settled
}

async function settleUpload(db: GymDb, item: OutboxItem): Promise<void> {
  await db.outbox.delete(item.id)
}

async function send(
  transport: Transport,
  state: FlushState,
  attempt: () => Promise<{ status: number | null; data: unknown; message: string | null }>,
): Promise<{ cls: ResponseClass; status: number | null; data: unknown; message: string | null }> {
  let res = await attempt()
  let cls = classifyStatus(res.status)
  if (cls === 'refresh' && !state.refreshed) {
    state.refreshed = true
    const ok = await transport.refreshSession()
    if (ok) {
      res = await attempt()
      cls = classifyStatus(res.status)
    }
  }
  return { cls, ...res }
}

/** Push every pending item of one table. */
export async function flushTable(db: GymDb, transport: Transport, table: SyncTable, state: FlushState): Promise<FlushTableResult> {
  const result: FlushTableResult = { sent: 0, dead: 0, stopped: null, error: null }
  const config = SYNC_CONFIG_BY_NAME[table]
  await resetInFlight(db, table)
  const all = (await db.outbox.where('state').equals('pending').toArray())
    .filter((i) => i.table === table)
    .sort((a, b) => (a.op === b.op ? a.created_at.localeCompare(b.created_at) : a.op === 'upload' ? -1 : 1))
  if (all.length === 0) return result

  // Uploads first, one at a time (each is a file).
  for (const snapshot of all.filter((i) => i.op === 'upload')) {
    if (!snapshot.blob) {
      await markDead(db, [snapshot], 'Upload has no file')
      result.dead += 1
      continue
    }
    const [item] = await markInFlight(db, [snapshot])
    if (!item || !item.blob) continue
    const path = String(item.payload.path ?? '')
    const contentType = String(item.payload.content_type ?? 'application/octet-stream')
    const res = await send(transport, state, () => transport.upload(path, item.blob as Blob, contentType))
    if (res.cls === 'ok') {
      await settleUpload(db, item)
      result.sent += 1
      continue
    }
    const error = describeError(res.status, res.message)
    if (res.cls === 'dead') {
      await markDead(db, [item], error)
      result.dead += 1
      continue
    }
    await markRetry(db, [item], error)
    result.stopped = res.cls === 'refresh' ? 'refresh' : 'backoff'
    result.error = error
    return result
  }

  // Upserts in batches.
  const upserts = all.filter((i) => i.op === 'upsert' || i.op === 'delete')
  for (let i = 0; i < upserts.length; i += PUSH_BATCH_SIZE) {
    const batch = await markInFlight(db, upserts.slice(i, i + PUSH_BATCH_SIZE))
    if (batch.length === 0) continue
    const rows = batch.map((b) => wireRow(b.payload))
    const res = await send(transport, state, () => transport.upsert(table, rows, config.onConflict))
    if (res.cls === 'ok') {
      result.sent += await settleUpserts(db, table, batch, res.data)
      continue
    }
    const error = describeError(res.status, res.message)
    if (res.cls === 'dead') {
      if (batch.length === 1) {
        await markDead(db, batch, error)
        result.dead += 1
        continue
      }
      // Isolate the bad rows: one request per item.
      for (const item of batch) {
        const one = await send(transport, state, () => transport.upsert(table, [wireRow(item.payload)], config.onConflict))
        if (one.cls === 'ok') {
          result.sent += await settleUpserts(db, table, [item], one.data)
        } else if (one.cls === 'dead') {
          await markDead(db, [item], describeError(one.status, one.message))
          result.dead += 1
        } else {
          const err = describeError(one.status, one.message)
          await markRetry(db, batch.slice(batch.indexOf(item)), err)
          result.stopped = one.cls === 'refresh' ? 'refresh' : 'backoff'
          result.error = err
          return result
        }
      }
      continue
    }
    await markRetry(db, batch, error)
    result.stopped = res.cls === 'refresh' ? 'refresh' : 'backoff'
    result.error = error
    return result
  }
  return result
}

/** Retry a dead item: back to pending with the attempt counter reset. */
export async function retryDeadItem(db: GymDb, outboxItemId: string): Promise<void> {
  const cur = await db.outbox.get(outboxItemId)
  if (!cur) return
  await db.outbox.put({ ...cur, state: 'pending', attempts: 0, last_error: null })
}

/**
 * Discard a dead item: drop the outbox entry and clear dirty on the row so the
 * next pull may replace the local copy with whatever the server holds. The
 * local row itself stays until then.
 */
export async function discardDeadItem(db: GymDb, outboxItemId: string): Promise<void> {
  const cur = await db.outbox.get(outboxItemId)
  if (!cur) return
  const tbl = db.syncTable(cur.table)
  await db.transaction('rw', [tbl, db.outbox], async () => {
    await db.outbox.delete(cur.id)
    if (cur.op === 'upload') return
    const local = await tbl.get(cur.row_id)
    if (local) await tbl.put({ ...local, dirty: 0, updated_at: local.updated_at ?? nowIso() })
  })
}
