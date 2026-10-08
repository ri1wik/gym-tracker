// The merge rule, as one pure function so it sits under Vitest with no
// database. Called once per remote row during a pull.
//
// Rules (PLAN.md section 7.2, docs/SPEC-critic-fixes.md):
// 1. No local row: take remote.
// 2. Local is dirty: keep local; the flush will resolve it.
// 3. Otherwise take remote when its version is higher.
// 4. finished_at and deleted_at are monotone: a non-null value on either side
//    survives whichever side wins, so a stale copy can never un-finish a
//    session or resurrect a deleted row. When finished_at is carried onto a
//    workout the status column follows it. The pull (./pull.ts) writes the
//    carried fields into the dirty row's outbox payload as well, so the push
//    side keeps the same promise; the server trigger is the last belt.
//
// OWNER: data-sync.

import type { SyncedRow } from '../../domain/types'

export type MergeChoice = 'remote' | 'local' | 'local_updated'

export interface MergeResult<T extends SyncedRow> {
  /** The row to store locally. */
  row: T
  /** Which side won, or local with a monotone field carried over from remote. */
  choice: MergeChoice
  /** True when the stored row differs from the local row (so the caller writes it). */
  changed: boolean
}

const MONOTONE_FIELDS = ['finished_at', 'deleted_at'] as const

/** Copy a non-null monotone value from `from` onto `onto` when `onto` lacks it. Returns whether anything changed. */
function carryMonotone(onto: object, from: object): boolean {
  let changed = false
  const target = onto as unknown as Record<string, unknown>
  const source = from as unknown as Record<string, unknown>
  for (const f of MONOTONE_FIELDS) {
    if (!(f in source) && !(f in target)) continue
    const theirs = source[f]
    const mine = target[f]
    if ((mine === null || mine === undefined) && theirs !== null && theirs !== undefined) {
      target[f] = theirs
      changed = true
      // A finished session is finished: the status column follows finished_at.
      if (f === 'finished_at' && source.status === 'finished' && target.status === 'in_progress') target.status = 'finished'
    }
  }
  return changed
}

/**
 * Decide what the local row becomes after seeing `remote`. `remote` is the
 * server row with no dirty flag; the result always carries dirty so it can be
 * stored as is.
 */
export function mergeRow<T extends SyncedRow>(local: T | undefined, remote: Omit<T, 'dirty'>): MergeResult<T> {
  if (!local) {
    return { row: { ...(remote as T), dirty: 0 }, choice: 'remote', changed: true }
  }
  if (local.dirty === 1) {
    const row = { ...local }
    const carried = carryMonotone(row, remote)
    return { row, choice: carried ? 'local_updated' : 'local', changed: carried }
  }
  if (remote.version > local.version) {
    const row = { ...(remote as T), dirty: 0 as const }
    carryMonotone(row, local)
    return { row, choice: 'remote', changed: true }
  }
  const row = { ...local }
  const carried = carryMonotone(row, remote)
  return { row, choice: carried ? 'local_updated' : 'local', changed: carried }
}
