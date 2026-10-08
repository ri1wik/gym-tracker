// Response classes for the flush (docs/SPEC-critic-fixes.md, dead-lettering).
//
// - ok: 2xx, the item is done.
// - refresh: 401 or 403, refresh the session once and retry the same item.
// - backoff: 408, 425, 429, 5xx and network errors (no response at all),
//   stop this flush and try again later with exponential backoff.
// - dead: 400, 409 and 422 only. The row itself is wrong (validation, RLS
//   on a bad owner, a constraint). Listed individually with Retry and Discard,
//   never a bare count.
//
// Anything else (404 from a missing table, 405, 413 and so on) is treated
// as backoff too: it is never the user's data at fault, so it must not be
// dead-lettered, and it will surface in the status line as the last error.
//
// OWNER: data-sync.

export type ResponseClass = 'ok' | 'refresh' | 'backoff' | 'dead'

export function classifyStatus(status: number | null): ResponseClass {
  if (status === null || status === 0) return 'backoff'
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401 || status === 403) return 'refresh'
  if (status === 400 || status === 409 || status === 422) return 'dead'
  if (status === 408 || status === 425 || status === 429) return 'backoff'
  if (status >= 500) return 'backoff'
  return 'backoff'
}

/** Milliseconds to wait before the next flush after `attempt` consecutive backoffs (1-based). Capped at five minutes. */
export function backoffMs(attempt: number): number {
  const base = 2000
  const cap = 5 * 60 * 1000
  const n = Math.max(1, Math.min(attempt, 20))
  return Math.min(cap, base * 2 ** (n - 1))
}

/** One line for last_error and the status screen. */
export function describeError(status: number | null, message: string | null | undefined): string {
  const head = status === null || status === 0 ? 'No connection' : `HTTP ${status}`
  const tail = (message ?? '').trim()
  return tail ? `${head}: ${tail.slice(0, 160)}` : head
}
