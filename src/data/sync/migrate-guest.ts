// Move what a guest logged into the account on first sign-in. Every row is
// rewritten to the new owner (ids that derive from the owner are recomputed
// and references to them followed), written through the transactional
// write so every row lands in the outbox, and the guest database is deleted
// once the copy is complete.
//
// OWNER: data-sync.

import Dexie from 'dexie'
import type { Photo, SyncTable, WeighIn } from '../../domain/types'
import { SYNC_TABLES } from '../../domain/types'
import { GUEST_USER_ID, dbName, deleteUserDb, openUserDb, type GymDb } from '../db'
import { photoId, weighInId } from './ids'
import { writeRow } from './write'

/** Rows in the guest database, without creating it when it does not exist. */
export async function countGuestRows(): Promise<number> {
  try {
    if (!(await Dexie.exists(dbName(GUEST_USER_ID)))) return 0
    const db = openUserDb(GUEST_USER_ID)
    let n = 0
    for (const t of SYNC_TABLES) n += await db.syncTable(t).count()
    return n
  } catch {
    return 0
  }
}

/** Copy every guest row into the user's database and delete the guest database. Returns rows moved. */
export async function migrateGuestRows(userId: string): Promise<number> {
  const src = openUserDb(GUEST_USER_ID)
  const dst = openUserDb(userId)
  let moved = 0
  const weighInIds = new Map<string, string>()

  const copy = async (table: SyncTable, rewrite: (row: Record<string, unknown>) => Record<string, unknown> | null) => {
    const rows = await src.syncTable(table).toArray()
    for (const row of rows) {
      const next = rewrite({ ...row })
      if (!next) continue
      delete next.dirty
      delete next.version
      delete next.updated_at
      await writeRow(dst, table, next as never)
      moved += 1
    }
  }

  await copy('profiles', (r) => {
    // Only the guest's own profile moves, as the account's profile; an account profile already pulled wins.
    if (r.id !== GUEST_USER_ID) return null
    return { ...r, id: userId }
  })
  await copy('body_weights', (r) => {
    const w = r as unknown as WeighIn
    const id = weighInId(userId, w.date_key)
    weighInIds.set(w.id, id)
    return { ...r, id, user_id: userId }
  })
  await copy('photos', (r) => {
    const p = r as unknown as Photo
    const id = photoId(userId, p.date_key, p.pose)
    const weighin = p.weighin_id ? (weighInIds.get(p.weighin_id) ?? p.weighin_id) : null
    const rewritePath = (path: string) => path.replace(new RegExp(`^${GUEST_USER_ID}/`), `${userId}/`)
    return { ...r, id, user_id: userId, weighin_id: weighin, storage_path: rewritePath(p.storage_path), thumb_path: rewritePath(p.thumb_path) }
  })
  for (const table of SYNC_TABLES) {
    if (table === 'profiles' || table === 'body_weights' || table === 'photos') continue
    await copy(table, (r) => {
      if (table === 'foods' || table === 'portions') {
        // Catalogue rows are shared; only the guest's own additions move.
        if (r.user_id === null || r.user_id === undefined) return null
      }
      return { ...r, user_id: userId }
    })
  }
  // Pending uploads carry their blobs across so a photo taken as a guest still reaches the bucket.
  const uploads = await src.outbox.where('[table+row_id]').between(['photos', Dexie.minKey], ['photos', Dexie.maxKey]).toArray()
  for (const u of uploads) {
    if (u.op !== 'upload' || !u.blob) continue
    const path = String(u.payload.path ?? '').replace(new RegExp(`^${GUEST_USER_ID}/`), `${userId}/`)
    await dst.outbox.put({ ...u, id: `upload:${path}`, payload: { ...u.payload, path }, state: 'pending', attempts: 0, last_error: null })
  }
  await deleteUserDb(GUEST_USER_ID)
  return moved
}

/** The database the migration writes into, exposed for tests. */
export function targetDb(userId: string): GymDb {
  return openUserDb(userId)
}
