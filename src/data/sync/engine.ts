// The sync loop: syncTable(config) pushes then pulls one table; syncAll
// runs every table from SYNC_CONFIG. Single flight: a second request while
// one runs sets a flag and the loop goes round again when it finishes.
// Triggered on the online event, on visibilitychange to visible, right
// after a write (debounced) and by the Sync now button. Backoff after a
// retryable failure, reset on success.
//
// Nothing here runs in guest mode or without a backend: syncNow returns at
// once, so the app with no env never touches the network and never throws
// offline.
//
// OWNER: data-sync.

import { META_KEYS, openUserDb, type GymDb } from '../db'
import { cloudEnv, loadSupabase } from '../supabase'
import { backoffMs } from './classify'
import { nowIso } from './clock'
import { currentUserId, isGuest, subscribeCurrentUser } from './current'
import { flushTable, type FlushState } from './flush'
import { pullTable } from './pull'
import { setSyncState } from './status'
import { SYNC_CONFIG, type SyncTableConfig } from './tables'
import { transportForClient, type Transport } from './transport'

export type SyncReason = 'boot' | 'online' | 'visible' | 'write' | 'manual' | 'signin' | 'retry'

export interface SyncRunResult {
  ran: boolean
  sent: number
  dead: number
  received: number
  stopped: 'backoff' | 'refresh' | null
  error: string | null
}

let transportOverride: Transport | null = null

/** Tests inject a transport; production builds one over the auth client. */
export function setTransportForTests(t: Transport | null): void {
  transportOverride = t
}

async function resolveTransport(): Promise<Transport | null> {
  if (transportOverride) return transportOverride
  const env = cloudEnv()
  if (!env) return null
  const client = await loadSupabase()
  if (!client) return null
  return transportForClient(client, env)
}

/** Push then pull one table. */
export async function syncTable(
  db: GymDb,
  transport: Transport,
  config: SyncTableConfig,
  userId: string,
  state: FlushState,
): Promise<SyncRunResult> {
  const out: SyncRunResult = { ran: true, sent: 0, dead: 0, received: 0, stopped: null, error: null }
  const pushed = await flushTable(db, transport, config.name, state)
  out.sent += pushed.sent
  out.dead += pushed.dead
  if (pushed.stopped) {
    out.stopped = pushed.stopped
    out.error = pushed.error
    return out
  }
  const pulled = await pullTable(db, transport, config, userId, state)
  out.received += pulled.received
  if (pulled.stopped) {
    out.stopped = pulled.stopped
    out.error = pulled.error
  }
  return out
}

/** Every table in config order, stopping at the first retryable failure. */
export async function syncAll(db: GymDb, transport: Transport, userId: string): Promise<SyncRunResult> {
  const total: SyncRunResult = { ran: true, sent: 0, dead: 0, received: 0, stopped: null, error: null }
  const state: FlushState = { refreshed: false }
  for (const config of SYNC_CONFIG) {
    const r = await syncTable(db, transport, config, userId, state)
    total.sent += r.sent
    total.dead += r.dead
    total.received += r.received
    if (r.stopped) {
      total.stopped = r.stopped
      total.error = r.error
      return total
    }
  }
  return total
}

let running: Promise<SyncRunResult> | null = null
let again = false
let consecutiveFailures = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null

function online(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine
}

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleRetry(): void {
  clearRetry()
  const delay = backoffMs(consecutiveFailures)
  retryTimer = setTimeout(() => {
    retryTimer = null
    void syncNow('retry')
  }, delay)
}

/**
 * Run one sync, or join the one in progress. Resolves when the run that
 * covers this request has finished. Never rejects.
 */
export function syncNow(reason: SyncReason): Promise<SyncRunResult> {
  const idle: SyncRunResult = { ran: false, sent: 0, dead: 0, received: 0, stopped: null, error: null }
  if (isGuest()) return Promise.resolve(idle)
  if (!transportOverride && !cloudEnv()) return Promise.resolve(idle)
  if (!online()) {
    setSyncState({ online: false })
    return Promise.resolve(idle)
  }
  if (running) {
    again = true
    return running
  }
  const userId = currentUserId()
  const db = openUserDb(userId)
  running = (async () => {
    let result = idle
    try {
      const transport = await resolveTransport()
      if (!transport) return idle
      do {
        again = false
        setSyncState({ inFlight: true, online: true })
        result = await syncAll(db, transport, userId)
        if (result.stopped) {
          consecutiveFailures += 1
          setSyncState({ lastError: result.error, needsSignIn: result.stopped === 'refresh' })
          if (result.stopped === 'backoff') scheduleRetry()
          again = false
        } else {
          consecutiveFailures = 0
          clearRetry()
          const at = nowIso()
          await db.meta.put({ key: META_KEYS.lastFlushAt, value: at })
          await db.meta.put({ key: META_KEYS.lastPullAt, value: at })
          setSyncState({ lastSyncAt: at, lastError: null, needsSignIn: false })
        }
      } while (again && currentUserId() === userId)
    } catch (e) {
      consecutiveFailures += 1
      setSyncState({ lastError: e instanceof Error ? e.message : 'Sync stopped' })
      scheduleRetry()
    } finally {
      setSyncState({ inFlight: false })
      running = null
    }
    return result
  })()
  void reason
  return running
}

/** Called after every local write: flush soon, coalescing bursts of writes. */
export function notifyWrite(): void {
  if (isGuest() || !online()) return
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    void syncNow('write')
  }, 400)
}

let started = false

/** Wire the online and visibility triggers once, at boot. Safe without a window (tests). */
export function startSyncTriggers(): void {
  if (started) return
  started = true
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      setSyncState({ online: true })
      void syncNow('online')
    })
    window.addEventListener('offline', () => setSyncState({ online: false }))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncNow('visible')
    })
  }
  subscribeCurrentUser((userId) => {
    consecutiveFailures = 0
    clearRetry()
    setSyncState({ mode: isGuest() ? 'guest' : 'cloud', lastError: null, needsSignIn: false, lastSyncAt: null })
    if (!isGuest()) {
      void openUserDb(userId)
        .meta.get(META_KEYS.lastPullAt)
        .then((row) => {
          if (typeof row?.value === 'string') setSyncState({ lastSyncAt: row.value })
        })
        .catch(() => undefined)
      void syncNow('signin')
    }
  })
}
