// Row ids. Most rows take a random uuid v4. The day-keyed rows that a phone
// and a laptop can both create offline for the same day take a uuid v5 of
// their natural key, so both devices produce the same id and the second
// upsert merges under last-writer-wins instead of colliding on the unique
// index (docs/SPEC-critic-fixes.md).
//
// OWNER: data-sync. The check-in slice must use weighInId and photoId.

import { v4 as uuidV4, v5 as uuidV5 } from 'uuid'
import type { DateKey, PhotoPose } from '../../domain/types'

/** Fixed namespace for every derived id in this app. Never change it: ids would stop matching. */
export const ID_NAMESPACE = '6f1c2a3e-7b7d-4b6a-9d0e-2f3a4b5c6d7e'

/** A fresh random id for any other row. */
export function newId(): string {
  return uuidV4()
}

/** body_weights: one row per user and day. */
export function weighInId(userId: string, dateKey: DateKey): string {
  return uuidV5(`body_weights:${userId}:${dateKey}`, ID_NAMESPACE)
}

/** photos: one row per user, day and pose. */
export function photoId(userId: string, dateKey: DateKey, pose: PhotoPose): string {
  return uuidV5(`photos:${userId}:${dateKey}:${pose}`, ID_NAMESPACE)
}

/** The outbox keeps one row per (table, row id), so several edits coalesce into the latest payload. */
export function outboxId(table: string, rowId: string): string {
  return `${table}:${rowId}`
}
