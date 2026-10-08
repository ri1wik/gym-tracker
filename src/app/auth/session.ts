// The auth store. bootAuth() runs before the router mounts: it asks the
// client for the session (which performs the PKCE code exchange when the
// page was opened from the Google redirect), strips ?code= from the URL so
// the hash route stays clean, and sets the current user. After that the
// client's own listener keeps the store current.
//
// Guest mode: no backend in the build, or nobody signed in. Everything works
// against gym_local; the sync engine stays idle.
//
// OWNER: data-sync.

import { useSyncExternalStore } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { GUEST_USER_ID, deleteUserDb, openUserDb } from '../../data/db'
import { STORAGE_BUCKET, hasCloud, loadSupabase } from '../../data/supabase'
import { currentUserId, setCurrentUserId } from '../../data/sync/current'
import { countGuestRows, migrateGuestRows } from '../../data/sync/migrate-guest'
import { syncNow } from '../../data/sync/engine'
import { setSyncState } from '../../data/sync/status'

export interface AuthState {
  /** False until bootAuth has finished. */
  ready: boolean
  /** True when the build carries a backend URL and key. */
  configured: boolean
  /** GUEST_USER_ID or the signed-in user id. */
  userId: string
  email: string | null
  displayName: string | null
  /** Rows found in the guest database after a sign-in, offered for moving. Null when there is nothing to offer. */
  guestRowsToOffer: number | null
  /** The last sign-in problem, for the sign-in screen. */
  error: string | null
}

let state: AuthState = {
  ready: false,
  configured: false,
  userId: GUEST_USER_ID,
  email: null,
  displayName: null,
  guestRowsToOffer: null,
  error: null,
}

const listeners = new Set<() => void>()

function set(patch: Partial<AuthState>): void {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function getAuthState(): AuthState {
  return state
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState)
}

export function isSignedIn(): boolean {
  return state.userId !== GUEST_USER_ID
}

/** The URL Google sends the browser back to: the app's own base, in this origin. */
export function redirectUrl(): string {
  const base = (import.meta.env.BASE_URL as string | undefined) ?? '/'
  return `${window.location.origin}${base}`
}

/** Remove ?code=, ?error= and friends from the address bar, keeping the hash route. */
export function stripAuthQuery(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const keys = ['code', 'error', 'error_code', 'error_description', 'state']
  let touched = false
  for (const k of keys) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k)
      touched = true
    }
  }
  if (!touched) return
  const search = url.searchParams.toString()
  const clean = `${url.pathname}${search ? `?${search}` : ''}${url.hash || '#/'}`
  window.history.replaceState(window.history.state, '', clean)
}

function readAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URL(window.location.href).searchParams
  const desc = params.get('error_description') ?? params.get('error')
  return desc ? desc.replace(/\+/g, ' ') : null
}

async function applySession(session: Session | null): Promise<void> {
  const nextId = session?.user?.id ?? GUEST_USER_ID
  const prevId = currentUserId()
  const meta = (session?.user?.user_metadata ?? {}) as Record<string, unknown>
  const displayName = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : null
  set({ userId: nextId, email: session?.user?.email ?? null, displayName })
  if (nextId !== prevId) {
    setCurrentUserId(nextId)
    if (nextId !== GUEST_USER_ID) {
      const guestRows = await countGuestRows()
      set({ guestRowsToOffer: guestRows > 0 ? guestRows : null })
    }
  }
}

/**
 * Boot: resolve the session before the router mounts. Never rejects; with
 * no backend it marks the store ready in guest mode.
 */
export async function bootAuth(): Promise<void> {
  const configured = hasCloud()
  set({ configured })
  setSyncState({ mode: 'guest' })
  const client = await loadSupabase()
  if (!client) {
    set({ ready: true })
    return
  }
  const urlError = readAuthErrorFromUrl()
  try {
    const { data, error } = await client.auth.getSession()
    if (error) set({ error: error.message })
    await applySession(data.session)
  } catch (e) {
    set({ error: e instanceof Error ? e.message : 'Could not read the session' })
  }
  if (urlError) set({ error: urlError })
  stripAuthQuery()
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      void applySession(null)
      return
    }
    if (session) void applySession(session)
  })
  setSyncState({ mode: isSignedIn() ? 'cloud' : 'guest' })
  set({ ready: true })
}

/** Google sign-in by redirect, always through the account picker. */
export async function signInWithGoogle(): Promise<void> {
  const client = await loadSupabase()
  if (!client) {
    set({ error: 'This build has no cloud account set up.' })
    return
  }
  set({ error: null })
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl(),
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) set({ error: error.message })
  } catch (e) {
    set({ error: e instanceof Error ? e.message : 'Sign-in did not start' })
  }
}

/** Sign out and wipe this user's local database. */
export async function signOut(): Promise<void> {
  const client = await loadSupabase()
  const userId = currentUserId()
  try {
    await client?.auth.signOut({ scope: 'local' })
  } catch {
    // Offline sign-out still clears the local session below.
  }
  await applySession(null)
  if (userId !== GUEST_USER_ID) {
    try {
      await deleteUserDb(userId)
    } catch {
      // A blocked delete (another tab holds the database) is retried on the next sign-out.
    }
  }
  set({ guestRowsToOffer: null })
}

async function removeOwnFiles(client: SupabaseClient, userId: string): Promise<void> {
  const bucket = client.storage.from(STORAGE_BUCKET)
  const db = openUserDb(userId)
  const paths = new Set<string>()
  try {
    const photos = await db.photos.toArray()
    for (const p of photos) {
      paths.add(p.storage_path)
      paths.add(p.thumb_path)
    }
  } catch {
    // The local table may be empty; the listing below still finds remote files.
  }
  const walk = async (prefix: string, depth: number): Promise<void> => {
    if (depth > 4) return
    const { data } = await bucket.list(prefix, { limit: 1000 })
    for (const entry of data ?? []) {
      const full = `${prefix}/${entry.name}`
      if (entry.id) paths.add(full)
      else await walk(full, depth + 1)
    }
  }
  await walk(userId, 0)
  const list = [...paths]
  for (let i = 0; i < list.length; i += 100) await bucket.remove(list.slice(i, i + 100))
}

/**
 * Delete the account: own files first (RLS allows the own prefix), then the
 * delete_my_account RPC which removes the auth user and cascades every
 * table, then the local database. Resolves an error line or null.
 */
export async function deleteAccount(): Promise<string | null> {
  const client = await loadSupabase()
  const userId = currentUserId()
  if (!client || userId === GUEST_USER_ID) return 'Not signed in.'
  try {
    await removeOwnFiles(client, userId)
    const { error } = await client.rpc('delete_my_account')
    if (error) return error.message
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not reach the server.'
  }
  await signOut()
  return null
}

/** Accept the offer: move guest rows into the account and push them. */
export async function acceptGuestRows(): Promise<number> {
  const userId = currentUserId()
  if (userId === GUEST_USER_ID) return 0
  const moved = await migrateGuestRows(userId)
  set({ guestRowsToOffer: null })
  void syncNow('signin')
  return moved
}

/** Decline the offer for now: the guest database stays and is offered again next sign-in. */
export function declineGuestRows(): void {
  set({ guestRowsToOffer: null })
}

/** Decline for good: drop the guest database. */
export async function discardGuestRows(): Promise<void> {
  set({ guestRowsToOffer: null })
  try {
    await deleteUserDb(GUEST_USER_ID)
  } catch {
    // ignore
  }
}
