// The network edge of the sync layer: plain fetch against the REST and
// storage endpoints, with the status code exposed so the flush can classify
// it, and an AbortController timeout on every call (a hung request on gym
// Wi-Fi must never block the queue). Tests inject a fake transport.
//
// OWNER: data-sync.

import type { SupabaseClient } from '@supabase/supabase-js'
import { STORAGE_BUCKET, type CloudEnv } from '../supabase'
import { REQUEST_TIMEOUT_MS } from './tables'

export interface RestResult {
  /** HTTP status, or null when no response arrived (offline, DNS, timeout). */
  status: number | null
  data: unknown
  message: string | null
}

export interface Transport {
  upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<RestResult>
  /** `query` is the PostgREST query string without the leading question mark. */
  select(table: string, query: string): Promise<RestResult>
  upload(path: string, blob: Blob, contentType: string): Promise<RestResult>
  /** Refresh the access token. Resolves false when that is impossible (offline, signed out). */
  refreshSession(): Promise<boolean>
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export interface TransportDeps {
  env: CloudEnv
  getToken: () => Promise<string | null>
  refresh: () => Promise<boolean>
  fetchImpl?: FetchLike
  timeoutMs?: number
}

async function readBody(res: Response): Promise<{ data: unknown; message: string | null }> {
  const text = await res.text().catch(() => '')
  if (!text) return { data: null, message: null }
  try {
    const data: unknown = JSON.parse(text)
    const msg =
      data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : null
    return { data, message: res.ok ? null : (msg ?? text.slice(0, 200)) }
  } catch {
    return { data: null, message: res.ok ? null : text.slice(0, 200) }
  }
}

export function createTransport(deps: TransportDeps): Transport {
  const fetchImpl: FetchLike = deps.fetchImpl ?? ((input, init) => fetch(input, init))
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS
  const base = deps.env.url

  async function call(url: string, init: RequestInit, extraHeaders: Record<string, string>): Promise<RestResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const token = await deps.getToken()
      const headers: Record<string, string> = {
        apikey: deps.env.anonKey,
        Authorization: `Bearer ${token ?? deps.env.anonKey}`,
        ...extraHeaders,
      }
      const res = await fetchImpl(url, { ...init, headers, signal: controller.signal })
      const body = await readBody(res)
      return { status: res.status, data: body.data, message: body.message }
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      return { status: null, data: null, message: aborted ? 'Timed out' : e instanceof Error ? e.message : 'No connection' }
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    upsert(table, rows, onConflict) {
      return call(
        `${base}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
        { method: 'POST', body: JSON.stringify(rows) },
        { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      )
    },
    select(table, query) {
      return call(`${base}/rest/v1/${table}?${query}`, { method: 'GET' }, { Accept: 'application/json' })
    },
    upload(path, blob, contentType) {
      const encoded = path.split('/').map(encodeURIComponent).join('/')
      return call(
        `${base}/storage/v1/object/${STORAGE_BUCKET}/${encoded}`,
        { method: 'POST', body: blob },
        { 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': '3600' },
      )
    },
    refreshSession: deps.refresh,
  }
}

/** The production transport over the auth client's session. */
export function transportForClient(client: SupabaseClient, env: CloudEnv): Transport {
  return createTransport({
    env,
    getToken: async () => {
      try {
        const { data } = await client.auth.getSession()
        return data.session?.access_token ?? null
      } catch {
        return null
      }
    },
    refresh: async () => {
      try {
        const { data, error } = await client.auth.refreshSession()
        return !error && !!data.session
      } catch {
        return false
      }
    },
  })
}
