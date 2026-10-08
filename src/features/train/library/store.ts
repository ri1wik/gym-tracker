import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import { GUEST_USER_ID, openUserDb, type GymDb } from '../../../data/db'
import { DEFAULT_GYM_MACHINE_IDS } from '../../../data/library/machine-index'
import { localDateKey } from '../../../domain/dates'
import type { DateKey, GymProfile, MachineSetting, WorkoutSet } from '../../../domain/types'

// OWNER: ui-library. Every Dexie read and write the library screens make goes
// through this file. `libraryDb` is the single place that names the user; at
// integration it takes the signed-in id. Writes go through `putRow`, the one
// line the sync slice's transactional write() replaces.

export function libraryDb(): GymDb {
  return openUserDb(GUEST_USER_ID)
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Replace with the sync slice's write() (row plus outbox in one transaction) at integration. */
async function putRow<T extends { id: string }>(table: 'machine_settings', row: T): Promise<void> {
  await libraryDb().table(table).put(row)
}

// ---------------------------------------------------------------------------
// Gym profile (which machines the user's gym has)
// ---------------------------------------------------------------------------

export interface GymView {
  /** True once a gym profile row exists locally. */
  hasProfile: boolean
  name: string
  machineIds: ReadonlySet<string>
  /** Nicknames people use, machine id to names; merged into search. */
  customAliases: Readonly<Record<string, string[]>>
  /** False while the first read is in flight. */
  ready: boolean
}

const ALL_MACHINES: GymView = {
  hasProfile: false,
  name: 'Anytime Fitness (typical)',
  machineIds: new Set(DEFAULT_GYM_MACHINE_IDS),
  customAliases: {},
  ready: false,
}

function pickProfile(rows: GymProfile[]): GymProfile | undefined {
  return rows.filter((r) => !r.deleted_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
}

export function useGym(): GymView {
  const view = useLiveQuery(async (): Promise<GymView> => {
    try {
      const profile = pickProfile(await libraryDb().gym_profiles.toArray())
      if (!profile) return { ...ALL_MACHINES, ready: true }
      return {
        hasProfile: true,
        name: profile.name,
        machineIds: new Set(profile.machine_ids),
        customAliases: profile.custom_aliases ?? {},
        ready: true,
      }
    } catch {
      return { ...ALL_MACHINES, ready: true }
    }
  }, [])
  return view ?? ALL_MACHINES
}

// ---------------------------------------------------------------------------
// Per-viewer preferences kept in localStorage (never state that must sync)
// ---------------------------------------------------------------------------

const PREF_PREFIX = 'gym.library.'

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(PREF_PREFIX + key)
  } catch {
    return null
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREF_PREFIX + key, value)
  } catch {
    /* private window or blocked storage: the choice just does not persist */
  }
}

// ---------------------------------------------------------------------------
// Machine settings (seat 4, pad 2)
// ---------------------------------------------------------------------------

export type SettingField = 'seat' | 'pad' | 'grip' | 'pin' | 'foot_plate' | 'note'

export const SETTING_FIELD_OF_LABEL = {
  Seat: 'seat',
  Pad: 'pad',
  Grip: 'grip',
  Pin: 'pin',
  'Foot plate': 'foot_plate',
  Other: 'note',
} as const satisfies Record<string, SettingField>

async function currentSetting(machineId: string): Promise<MachineSetting | null> {
  const db = libraryDb()
  const rows = await db.machine_settings.where('[user_id+machine_id]').equals([db.userId, machineId]).toArray()
  return rows.filter((r) => !r.deleted_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
}

export function useMachineSetting(machineId: string): MachineSetting | null | undefined {
  // undefined while loading, null when the user has saved nothing yet.
  return useLiveQuery(() => currentSetting(machineId), [machineId])
}

/** Reads the row again at write time, so two quick edits never create two rows. */
export async function saveMachineSetting(machineId: string, field: SettingField, value: string): Promise<void> {
  const existing = await currentSetting(machineId)
  const clean = value.trim()
  const stored = clean === '' ? null : clean
  const now = nowIso()
  if (existing) {
    if ((existing[field] ?? null) === stored) return
    await putRow('machine_settings', { ...existing, [field]: stored, updated_at: now, dirty: 1 as const })
    return
  }
  if (stored === null) return
  const row: MachineSetting = {
    id: uuid(),
    user_id: libraryDb().userId,
    machine_id: machineId,
    gym_profile_id: null,
    seat: null,
    pad: null,
    grip: null,
    pin: null,
    foot_plate: null,
    note: null,
    created_at: now,
    updated_at: now,
    version: 1,
    deleted_at: null,
    dirty: 1,
    [field]: stored,
  }
  await putRow('machine_settings', row)
}

// ---------------------------------------------------------------------------
// Last performance
// ---------------------------------------------------------------------------

export interface PerformedSet {
  reps: number
  load_g: number
  assist_g: number
}

export interface LastPerformance {
  dateKey: DateKey
  sets: PerformedSet[]
  /** Heaviest working set ever logged for this exercise, ties broken by reps. */
  best: PerformedSet
}

function toPerformed(s: WorkoutSet): PerformedSet {
  return { reps: s.reps ?? 0, load_g: s.load_g ?? 0, assist_g: s.assist_g ?? 0 }
}

function heavier(a: PerformedSet, b: PerformedSet): boolean {
  return a.load_g > b.load_g || (a.load_g === b.load_g && a.reps > b.reps)
}

/** Pure part of the query, so it can be tested without a database. */
export function summarisePerformance(
  sets: readonly WorkoutSet[],
  dateOfWorkout: (workoutId: string, completedAt: string) => DateKey,
): LastPerformance | null {
  const done = sets
    .filter((s) => s.kind === 'working' && !s.deleted_at && s.completed_at && s.reps !== null && s.reps > 0)
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  if (done.length === 0) return null
  const latest = done[0]
  const sameSession = done.filter((s) => s.workout_id === latest.workout_id).sort((a, b) => a.set_index - b.set_index)
  const performed = done.map(toPerformed)
  const best = performed.reduce((top, cur) => (heavier(cur, top) ? cur : top))
  return {
    dateKey: dateOfWorkout(latest.workout_id, latest.completed_at ?? ''),
    sets: sameSession.map(toPerformed),
    best,
  }
}

export function useLastPerformance(exerciseId: string): LastPerformance | null | undefined {
  return useLiveQuery(async () => {
    const db = libraryDb()
    const rows = await db.workout_sets
      .where('[exercise_id+completed_at]')
      .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
      .filter((s) => s.user_id === db.userId)
      .toArray()
    const workouts = await db.workouts.bulkGet([...new Set(rows.map((r) => r.workout_id))])
    const planned = new Map<string, DateKey>()
    for (const w of workouts) if (w) planned.set(w.id, w.planned_on)
    return summarisePerformance(rows, (workoutId, completedAt) => planned.get(workoutId) ?? localDateKey(new Date(completedAt)))
  }, [exerciseId])
}
