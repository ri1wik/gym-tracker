// The local copy: one Dexie database per user, one table per synced server
// table (same names, same snake_case columns, plus the local-only dirty
// flag), an outbox of pending pushes and a meta table for cursors.
//
// OWNER: data-sync for everything beyond the schema. This file is the schema
// only; sync helpers (write-with-outbox, flush, pull, merge) live under
// src/data/sync/ and are the sync builder's.
//
// Rules: the UI reads only from this database and never awaits the network
// on the Train screen. The database name is per user (gym_<user id>) and the
// whole database is deleted on sign-out, so a friend signing in on your
// laptop sees nothing of yours. Before sign-in the GUEST_USER_ID database is
// used; the sync builder migrates its rows on first sign-in.

import Dexie, { type Table } from 'dexie'
import type {
  CardioSession,
  Favourite,
  Food,
  FoodLog,
  GymProfile,
  MachineSetting,
  MetaRow,
  OutboxItem,
  Photo,
  Portion,
  Profile,
  Program,
  SyncTable,
  WeighIn,
  Workout,
  WorkoutSet,
} from '../domain/types'

/** The owner id used before sign-in. */
export const GUEST_USER_ID = 'local'

/** Every local storage name is prefixed because ri1wik.github.io hosts other sites on this origin. */
export const DB_PREFIX = 'gym_'

export const DB_VERSION = 1

export function dbName(userId: string): string {
  return `${DB_PREFIX}${userId}`
}

/**
 * Version 1 schema. The first entry is the primary key; `[a+b]` is a
 * compound index. Indexes follow docs/SPEC-cloud.md: (user_id, updated_at)
 * on every owned table for the pull cursor, (user_id, date_key) on the
 * day-keyed tables, workout_id on workout_sets, (user_id, planned_on) on
 * workouts, plus dirty on every synced table so the flush can find work.
 */
export const SCHEMA_V1: Record<SyncTable | 'outbox' | 'meta', string> = {
  profiles: 'id, updated_at, dirty',
  body_weights: 'id, user_id, [user_id+updated_at], [user_id+date_key], dirty',
  photos: 'id, user_id, [user_id+updated_at], [user_id+date_key], weighin_id, dirty',
  programs: 'id, user_id, [user_id+updated_at], active, dirty',
  workouts: 'id, user_id, [user_id+updated_at], [user_id+planned_on], program_id, status, started_at, dirty',
  workout_sets: 'id, user_id, [user_id+updated_at], workout_id, [exercise_id+completed_at], dirty',
  cardio_sessions: 'id, user_id, [user_id+updated_at], [user_id+date_key], dirty',
  machine_settings: 'id, user_id, [user_id+updated_at], machine_id, [user_id+machine_id], dirty',
  gym_profiles: 'id, user_id, [user_id+updated_at], dirty',
  foods: 'id, user_id, updated_at, source, name, dirty',
  portions: 'id, updated_at, food_id, dirty',
  favourites: 'id, user_id, [user_id+updated_at], food_id, use_count, dirty',
  food_logs: 'id, user_id, [user_id+updated_at], [user_id+date_key], dirty',
  outbox: 'id, state, [table+row_id], created_at',
  meta: 'key',
}

export class GymDb extends Dexie {
  declare profiles: Table<Profile, string>
  declare body_weights: Table<WeighIn, string>
  declare photos: Table<Photo, string>
  declare programs: Table<Program, string>
  declare workouts: Table<Workout, string>
  declare workout_sets: Table<WorkoutSet, string>
  declare cardio_sessions: Table<CardioSession, string>
  declare machine_settings: Table<MachineSetting, string>
  declare gym_profiles: Table<GymProfile, string>
  declare foods: Table<Food, string>
  declare portions: Table<Portion, string>
  declare favourites: Table<Favourite, string>
  declare food_logs: Table<FoodLog, string>
  declare outbox: Table<OutboxItem, string>
  declare meta: Table<MetaRow, string>

  readonly userId: string

  constructor(userId: string) {
    super(dbName(userId))
    this.userId = userId
    this.version(DB_VERSION).stores(SCHEMA_V1)
  }

  /** The Dexie table for a synced server table name. */
  syncTable<T extends SyncTable>(name: T): Table<Record<string, unknown>, string> {
    return this.table(name) as Table<Record<string, unknown>, string>
  }
}

const open = new Map<string, GymDb>()

/**
 * The database for a user, created on first call and shared after. Dexie
 * opens it lazily on the first query. Use GUEST_USER_ID before sign-in.
 */
export function openUserDb(userId: string): GymDb {
  let db = open.get(userId)
  if (!db) {
    db = new GymDb(userId)
    open.set(userId, db)
  }
  return db
}

/** Close and delete a user's database (sign-out, delete account). */
export async function deleteUserDb(userId: string): Promise<void> {
  const db = open.get(userId)
  if (db) {
    db.close()
    open.delete(userId)
  }
  await Dexie.delete(dbName(userId))
}

/** Meta keys the sync layer uses; listed here so two slices never pick the same string. */
export const META_KEYS = {
  /** Per-table pull cursor: `cursor:<table>` holds the last updated_at pulled. */
  cursor: (table: SyncTable) => `cursor:${table}`,
  seedVersion: 'seed_version',
  lastFlushAt: 'last_flush_at',
  lastPullAt: 'last_pull_at',
  installPromptSeenAt: 'install_prompt_seen_at',
  activeWorkoutId: 'active_workout_id',
} as const
