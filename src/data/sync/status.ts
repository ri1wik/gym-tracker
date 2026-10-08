// A tiny external store for the sync state the You tab shows. Pending and
// dead counts come straight from the outbox through a live query in the
// component; this store holds what the database does not: in-flight,
// online, the last successful sync and the last error line.
//
// OWNER: data-sync.

import { useSyncExternalStore } from 'react'
import type { IsoTimestamp } from '../../domain/types'

export type SyncMode = 'guest' | 'cloud'

export interface SyncState {
  /** guest: no backend or not signed in; cloud: signed in with a backend. */
  mode: SyncMode
  online: boolean
  inFlight: boolean
  lastSyncAt: IsoTimestamp | null
  /** One line about the last problem, cleared on the next success. */
  lastError: string | null
  /** True when the last flush ended on a 401 or 403 that a refresh did not fix. */
  needsSignIn: boolean
}

function initialOnline(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine
}

let state: SyncState = {
  mode: 'guest',
  online: initialOnline(),
  inFlight: false,
  lastSyncAt: null,
  lastError: null,
  needsSignIn: false,
}

const listeners = new Set<() => void>()

export function getSyncState(): SyncState {
  return state
}

export function setSyncState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook over the store. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState)
}
