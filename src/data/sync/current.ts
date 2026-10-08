// Which user the app is working as right now, and therefore which local
// database every read and write goes to. Before sign-in (and whenever the
// build carries no backend) this is GUEST_USER_ID and the database is
// gym_local. The auth store in src/app/auth/session.ts switches it on
// sign-in and sign-out; everything else only reads it.
//
// OWNER: data-sync. UI slices call currentDb() instead of openUserDb(...)
// so a sign-in moves them to the right database without a code change.

import { GUEST_USER_ID, openUserDb, type GymDb } from '../db'

type Listener = (userId: string) => void

let userId: string = GUEST_USER_ID
const listeners = new Set<Listener>()

/** The signed-in user id, or GUEST_USER_ID. */
export function currentUserId(): string {
  return userId
}

/** True while no account is signed in. */
export function isGuest(): boolean {
  return userId === GUEST_USER_ID
}

/** The Dexie database for the current user. */
export function currentDb(): GymDb {
  return openUserDb(userId)
}

/** Switch the active user. Only the auth store calls this. */
export function setCurrentUserId(next: string): void {
  if (next === userId) return
  userId = next
  for (const l of listeners) l(next)
}

/** Be told when the active user changes. Returns the unsubscribe function. */
export function subscribeCurrentUser(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
