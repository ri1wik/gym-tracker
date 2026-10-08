// Timestamps for local stamping. Strictly increasing within a page so two
// writes in the same millisecond still produce distinct updated_at values;
// the flush compares that stamp to detect an edit made while a push was in
// flight.
//
// OWNER: data-sync.

import type { IsoTimestamp } from '../../domain/types'

let last = 0

/** Now as an ISO string, never equal to the previous call's value. */
export function nowIso(): IsoTimestamp {
  let t = Date.now()
  if (t <= last) t = last + 1
  last = t
  return new Date(t).toISOString()
}

/** ISO string of a time `ms` milliseconds before now (used for the pull cursor overlap). */
export function isoMinus(iso: IsoTimestamp, ms: number): IsoTimestamp {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t - ms).toISOString()
}
