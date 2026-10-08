// Which user and which local database this slice reads and writes.
//
// Integration: the sync builder publishes the same two functions in
// src/data/sync/current.ts. Replace the body of this file with a re-export
// of that module and nothing else in the slice changes.

import { GUEST_USER_ID, openUserDb, type GymDb } from '../../data/db'

/** The signed-in user id, or GUEST_USER_ID before sign-in. */
export function currentUserId(): string {
  return GUEST_USER_ID
}

/** The Dexie database for the current user. */
export function currentDb(): GymDb {
  return openUserDb(currentUserId())
}
