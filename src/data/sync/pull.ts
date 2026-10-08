// Pull one table since its cursor. The cursor is the greatest updated_at
// stored so far, kept in the meta table; every pull starts two minutes
// before it so a row committed just before the previous pull is never
// missed (the merge makes re-reading harmless). Pages of pageSize rows,
// ordered by updated_at then id. Each page is merged in one transaction.
//
// OWNER: data-sync.

import type { SyncedRow } from '../../domain/types'
import { META_KEYS, type GymDb } from '../db'
import { classifyStatus, describeError, type ResponseClass } from './classify'
import { isoMinus } from './clock'
import { mergeRow } from './merge'
import { PULL_OVERLAP_MS, type SyncTableConfig } from './tables'
import type { Transport } from './transport'

export const EPOCH_ISO = '1970-01-01T00:00:00.000Z'

export interface PullTableResult {
  received: number
  stored: number
  stopped: 'backoff' | 'refresh' | null
  error: string | null
}

export function pullQuery(config: SyncTableConfig, userId: string, since: string, offset: number): string {
  const params = new URLSearchParams()
  params.set('select', '*')
  if (!config.shared) params.set(config.ownerColumn, `eq.${userId}`)
  params.set('updated_at', `gte.${since}`)
  params.set('order', 'updated_at.asc,id.asc')
  params.set('limit', String(config.pageSize))
  params.set('offset', String(offset))
  return params.toString()
}

async function readCursor(db: GymDb, table: SyncTableConfig['name']): Promise<string | null> {
  const row = await db.meta.get(META_KEYS.cursor(table))
  return typeof row?.value === 'string' ? row.value : null
}

/** Merge one page of remote rows into the local table. Returns how many rows changed and the greatest updated_at seen. */
export async function mergePage(db: GymDb, table: SyncTableConfig['name'], rows: unknown[]): Promise<{ stored: number; maxUpdatedAt: string | null }> {
  const tbl = db.syncTable(table)
  let stored = 0
  let maxUpdatedAt: string | null = null
  await db.transaction('rw', [tbl, db.meta], async () => {
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') continue
      const remote = raw as Record<string, unknown>
      if (typeof remote.id !== 'string') continue
      const local = (await tbl.get(remote.id)) as SyncedRow | undefined
      const merged = mergeRow<SyncedRow>(local, remote as unknown as Omit<SyncedRow, 'dirty'>)
      if (merged.changed) {
        await tbl.put(merged.row as unknown as Record<string, unknown>)
        stored += 1
      }
      const ts = typeof remote.updated_at === 'string' ? remote.updated_at : null
      if (ts && (!maxUpdatedAt || ts > maxUpdatedAt)) maxUpdatedAt = ts
    }
    if (maxUpdatedAt) {
      const prev = await readCursor(db, table)
      if (!prev || maxUpdatedAt > prev) await db.meta.put({ key: META_KEYS.cursor(table), value: maxUpdatedAt })
    }
  })
  return { stored, maxUpdatedAt }
}

export async function pullTable(
  db: GymDb,
  transport: Transport,
  config: SyncTableConfig,
  userId: string,
  state: { refreshed: boolean },
): Promise<PullTableResult> {
  const result: PullTableResult = { received: 0, stored: 0, stopped: null, error: null }
  const cursor = await readCursor(db, config.name)
  const since = cursor ? isoMinus(cursor, PULL_OVERLAP_MS) : EPOCH_ISO
  let offset = 0
  for (;;) {
    const query = pullQuery(config, userId, since, offset)
    let res = await transport.select(config.name, query)
    let cls: ResponseClass = classifyStatus(res.status)
    if (cls === 'refresh' && !state.refreshed) {
      state.refreshed = true
      if (await transport.refreshSession()) {
        res = await transport.select(config.name, query)
        cls = classifyStatus(res.status)
      }
    }
    if (cls !== 'ok') {
      result.stopped = cls === 'refresh' ? 'refresh' : 'backoff'
      result.error = describeError(res.status, res.message)
      return result
    }
    const rows = Array.isArray(res.data) ? res.data : []
    result.received += rows.length
    const page = await mergePage(db, config.name, rows)
    result.stored += page.stored
    if (rows.length < config.pageSize) return result
    offset += rows.length
  }
}
