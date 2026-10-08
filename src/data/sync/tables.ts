// One line of config per synced table. Adding a table means adding a row to
// the local schema (architect) and one entry here.
//
// OWNER: data-sync.

import { OWNER_COLUMN, SHARED_TABLES, SYNC_TABLES, type SyncTable } from '../../domain/types'

export interface SyncTableConfig {
  name: SyncTable
  /** Column the pull filters on for owned tables. */
  ownerColumn: 'user_id' | 'id'
  /** Shared catalogue: pulled without an owner filter (RLS still applies). */
  shared: boolean
  /** Unique key the server upsert merges on. */
  onConflict: string
  /** Rows per pull page. */
  pageSize: number
}

const ON_CONFLICT: Partial<Record<SyncTable, string>> = {
  body_weights: 'id',
  photos: 'id',
}

export const SYNC_CONFIG: SyncTableConfig[] = SYNC_TABLES.map((name) => ({
  name,
  ownerColumn: OWNER_COLUMN[name],
  shared: SHARED_TABLES.includes(name),
  onConflict: ON_CONFLICT[name] ?? 'id',
  pageSize: 1000,
}))

export const SYNC_CONFIG_BY_NAME: Record<SyncTable, SyncTableConfig> = Object.fromEntries(
  SYNC_CONFIG.map((c) => [c.name, c]),
) as Record<SyncTable, SyncTableConfig>

/** How far behind the stored cursor a pull starts, so a row committed just before the last pull is not missed. */
export const PULL_OVERLAP_MS = 2 * 60 * 1000

/** Request timeout for every push and pull call. */
export const REQUEST_TIMEOUT_MS = 15_000
