// React hooks over the current user, for screens that read Dexie directly.
//
// OWNER: data-sync.

import { useSyncExternalStore } from 'react'
import type { GymDb } from '../../data/db'
import { currentDb, currentUserId, subscribeCurrentUser } from '../../data/sync/current'

function subscribe(listener: () => void): () => void {
  return subscribeCurrentUser(() => listener())
}

/** The active user id; re-renders on sign-in and sign-out. */
export function useCurrentUserId(): string {
  return useSyncExternalStore(subscribe, currentUserId, currentUserId)
}

/** The active user's database; re-renders on sign-in and sign-out. */
export function useCurrentDb(): GymDb {
  useCurrentUserId()
  return currentDb()
}
