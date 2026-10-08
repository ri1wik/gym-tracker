// The backend client. One instance, created lazily, or null when the two
// environment variables are absent: the app then runs in guest mode against
// the local database and never touches the network. The library itself is
// loaded on demand (a separate chunk), so the first paint never carries it
// and a build with no backend never downloads it.
//
// OWNER: data-sync.
//
// Auth options follow docs/SPEC-critic-fixes.md: the library's default is the
// implicit flow, which puts tokens in the URL fragment where the hash router
// would swallow them. PKCE returns ?code=... in the query instead; the boot
// sequence in src/app/auth/session.ts exchanges it before the router mounts
// and then strips it with history.replaceState.

import type { SupabaseClient } from '@supabase/supabase-js'

export const STORAGE_BUCKET = 'photos'

/** Every local storage key is prefixed because ri1wik.github.io hosts other sites on this origin. */
export const AUTH_STORAGE_KEY = 'gt:auth'

export interface CloudEnv {
  url: string
  anonKey: string
}

function readEnv(): CloudEnv | null {
  const env = import.meta.env as Record<string, string | undefined>
  const url = (env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !anonKey) return null
  return { url: url.replace(/\/+$/, ''), anonKey }
}

let cached: SupabaseClient | null | undefined

/** The project URL and publishable key, or null when the app runs without a backend. */
export function cloudEnv(): CloudEnv | null {
  return readEnv()
}

/** True when the build carries a backend URL and key. */
export function hasCloud(): boolean {
  return readEnv() !== null
}

let loading: Promise<SupabaseClient | null> | null = null

/** The shared client, loading the library on first use; null in guest mode. Never rejects. */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (cached !== undefined) return Promise.resolve(cached)
  const env = readEnv()
  if (!env) {
    cached = null
    return Promise.resolve(cached)
  }
  if (!loading) {
    loading = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        cached = createClient(env.url, env.anonKey, {
          auth: {
            flowType: 'pkce',
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true,
            storageKey: AUTH_STORAGE_KEY,
          },
        })
        return cached
      })
      .catch(() => {
        cached = null
        return cached
      })
  }
  return loading
}

/** The client once loadSupabase has resolved it, else null (guest mode, or not loaded yet). */
export function getSupabase(): SupabaseClient | null {
  return cached ?? null
}
