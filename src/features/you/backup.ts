// JSON backup: export every synced table of the current database to one
// dated file, and import such a file back, merging by row id (PLAN.md item 4:
// export always available; docs/SPEC-retention-priority.md item 4: export
// and import visible from day one). Pure apart from the browser download at
// the bottom, so the round trip sits under Vitest on fake-indexeddb.

import type { GymDb } from '../../data/db'
import { META_KEYS } from '../../data/db'
import { photoId, weighInId } from '../../data/sync/ids'
import { writeRow } from '../../data/sync/write'
import { nowIso } from '../../data/sync/clock'
import { notifyWrite } from '../../data/sync/engine'
import { LOCAL_ONLY_FIELDS, OWNER_COLUMN, SHARED_TABLES, SYNC_TABLES, type Photo, type SyncTable, type WeighIn } from '../../domain/types'

export const BACKUP_FORMAT = 1

export interface BackupFile {
  app: 'recomp'
  format: typeof BACKUP_FORMAT
  exported_at: string
  user_id: string
  tables: Partial<Record<SyncTable, Record<string, unknown>[]>>
}

export interface ImportResult {
  added: number
  updated: number
  /** Rows already present with the same or a newer stamp, and catalogue rows that are not the user's. */
  skipped: number
}

/** Every row of every synced table, local-only fields stripped. */
export async function buildBackup(db: GymDb, userId: string, exportedAt = nowIso()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {}
  for (const table of SYNC_TABLES) {
    const rows = await db.syncTable(table).toArray()
    tables[table] = rows.map((r) => {
      const out = { ...r }
      for (const f of LOCAL_ONLY_FIELDS) delete out[f]
      return out
    })
  }
  return { app: 'recomp', format: BACKUP_FORMAT, exported_at: exportedAt, user_id: userId, tables }
}

export function backupFileName(exportedAt: string): string {
  return `recomp-backup-${exportedAt.slice(0, 10)}.json`
}

/** Parse and check a backup file. Throws an Error with a readable message. */
export function parseBackup(text: string): BackupFile {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('This file is not a Recomp backup (not JSON).')
  }
  const v = value as Partial<BackupFile> | null
  if (!v || typeof v !== 'object' || v.app !== 'recomp' || typeof v.tables !== 'object' || v.tables === null) {
    throw new Error('This file is not a Recomp backup.')
  }
  if (v.format !== BACKUP_FORMAT) throw new Error(`This backup uses format ${String(v.format)}; this app reads format ${BACKUP_FORMAT}.`)
  const tables: BackupFile['tables'] = {}
  for (const table of SYNC_TABLES) {
    const rows = (v.tables as Record<string, unknown>)[table]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) throw new Error(`Table ${table} in the backup is not a list.`)
    tables[table] = rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string')
  }
  return { app: 'recomp', format: BACKUP_FORMAT, exported_at: typeof v.exported_at === 'string' ? v.exported_at : '', user_id: typeof v.user_id === 'string' ? v.user_id : '', tables }
}

function stampOf(row: Record<string, unknown> | undefined): string {
  return typeof row?.updated_at === 'string' ? row.updated_at : ''
}

/**
 * Merge a backup into the database as the current user: rows are rewritten
 * to the current owner (ids that derive from the owner are recomputed and
 * references to them followed), a row the database lacks is added, a row
 * with an older stamp is replaced, anything else is left alone. Every write
 * goes through the sync layer's transactional write, so an import into a
 * signed-in account reaches the server on the next flush.
 */
export async function importBackup(db: GymDb, userId: string, file: BackupFile): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 }
  const weighInIds = new Map<string, string>()

  const put = async (table: SyncTable, row: Record<string, unknown>) => {
    const existing = await db.syncTable(table).get(String(row.id))
    if (existing && stampOf(existing) >= stampOf(row)) {
      result.skipped += 1
      return
    }
    const draft = { ...row }
    delete draft.dirty
    delete draft.version
    delete draft.updated_at
    await writeRow(db, table, draft as never)
    if (existing) result.updated += 1
    else result.added += 1
  }

  for (const row of file.tables.profiles ?? []) await put('profiles', { ...row, id: userId })
  for (const row of file.tables.body_weights ?? []) {
    const w = row as unknown as WeighIn
    const id = weighInId(userId, w.date_key)
    weighInIds.set(w.id, id)
    await put('body_weights', { ...row, id, user_id: userId })
  }
  for (const row of file.tables.photos ?? []) {
    const p = row as unknown as Photo
    const id = photoId(userId, p.date_key, p.pose)
    const weighin = p.weighin_id ? (weighInIds.get(p.weighin_id) ?? p.weighin_id) : null
    const rewritePath = (path: string) => (typeof path === 'string' ? path.replace(/^[^/]+\//, `${userId}/`) : path)
    await put('photos', { ...row, id, user_id: userId, weighin_id: weighin, storage_path: rewritePath(p.storage_path), thumb_path: rewritePath(p.thumb_path) })
  }
  for (const table of SYNC_TABLES) {
    if (table === 'profiles' || table === 'body_weights' || table === 'photos') continue
    for (const row of file.tables[table] ?? []) {
      if (SHARED_TABLES.includes(table) && (row.user_id === null || row.user_id === undefined)) {
        // The seeded catalogue arrives through sync, never through a backup.
        result.skipped += 1
        continue
      }
      await put(table, { ...row, [OWNER_COLUMN[table]]: userId })
    }
  }
  if (result.added + result.updated > 0) notifyWrite()
  return result
}

export async function readLastBackupAt(db: GymDb): Promise<string | null> {
  const row = await db.meta.get(META_KEYS.lastBackupAt)
  return typeof row?.value === 'string' ? row.value : null
}

export async function recordBackup(db: GymDb, at: string): Promise<void> {
  await db.meta.put({ key: META_KEYS.lastBackupAt, value: at })
}

/** Hand the browser the file to save. Only called from a button tap. */
export function downloadBackup(file: BackupFile): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(file.exported_at)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
