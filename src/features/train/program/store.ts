// Dexie access for the program slice, in one file. Every write goes through
// putRows(), so when the sync slice's transactional write() lands the swap is
// one line here. Rows are written with dirty: 1 and version: 1.

import { v4 as uuidv4 } from 'uuid'
import { GUEST_USER_ID, openUserDb, type GymDb } from '../../../data/db'
import { DEFAULT_DUMBBELL_LADDER_G } from '../../../domain/planner/index'
import { targetAdjustment } from '../../../domain/calc/targets'
import type {
  DateKey,
  GymProfile,
  Profile,
  Program,
  ProgramSettings,
  SyncTable,
  Template,
  WeighIn,
  Workout,
} from '../../../domain/types'
import { defaultPins } from './rotation'

/** The signed-in user id once the auth slice lands; the guest database before. */
export function activeUserId(): string {
  return GUEST_USER_ID
}

export function programDb(): GymDb {
  return openUserDb(activeUserId())
}

export const nowIso = (): string => new Date().toISOString()

/** The one write path. Replace the body with the sync slice's write() at integration. */
export async function putRows(db: GymDb, table: SyncTable, rows: object[]): Promise<void> {
  if (rows.length === 0) return
  await db.table(table).bulkPut(rows)
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getProfile(db: GymDb): Promise<Profile | null> {
  const rows = await db.profiles.toArray()
  return rows.find((p) => p.deleted_at === null) ?? null
}

export async function getActiveProgram(db: GymDb): Promise<Program | null> {
  // Booleans are not valid IndexedDB keys, so the active flag is filtered, not indexed.
  const rows = await db.programs.filter((p) => p.active && p.deleted_at === null).toArray()
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return rows[0] ?? null
}

export async function getInProgressWorkout(db: GymDb): Promise<Workout | null> {
  const rows = await db.workouts.where('status').equals('in_progress').toArray()
  const live = rows.filter((w) => w.deleted_at === null && w.finished_at === null)
  live.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
  return live[0] ?? null
}

export async function getWorkouts(db: GymDb): Promise<Workout[]> {
  return db.workouts.filter((w) => w.deleted_at === null).toArray()
}

export async function getActiveGymProfile(db: GymDb, profile: Profile | null): Promise<GymProfile | null> {
  if (!profile?.active_gym_profile_id) return null
  const row = await db.gym_profiles.get(profile.active_gym_profile_id)
  return row && row.deleted_at === null ? row : null
}

/** Latest weigh-in by day key, or null. */
export async function getLatestWeighIn(db: GymDb): Promise<WeighIn | null> {
  const rows = await db.body_weights.filter((r) => r.deleted_at === null).toArray()
  let best: WeighIn | null = null
  for (const r of rows) if (best === null || r.date_key > best.date_key) best = r
  return best
}

// Session length budget lives in the local meta table: ProgramSettings has no
// field for it yet (see the integrator notes).
const MINUTES_KEY = 'program_session_minutes'
export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const
export type SessionMinutesChoice = (typeof SESSION_MINUTES)[number]
export const DEFAULT_SESSION_MINUTES: SessionMinutesChoice = 60

export async function readSessionMinutes(db: GymDb): Promise<SessionMinutesChoice> {
  const row = await db.meta.get(MINUTES_KEY)
  const v = row?.value
  return SESSION_MINUTES.find((m) => m === v) ?? DEFAULT_SESSION_MINUTES
}

export async function writeSessionMinutes(db: GymDb, minutes: SessionMinutesChoice): Promise<void> {
  await db.meta.put({ key: MINUTES_KEY, value: minutes })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Deficit as a fraction of maintenance, never negative (a surplus is no deficit). */
export function deficitFractionOf(profile: Profile | null): number {
  if (!profile) return 0
  return Math.max(0, targetAdjustment(profile.goal, profile.training_age))
}

export function deloadEveryWeeks(profile: Profile | null): number {
  if (!profile) return 6
  return profile.training_age === 'advanced' || deficitFractionOf(profile) >= 0.2 ? 5 : 6
}

export function newProgramSettings(template: Template, profile: Profile | null): ProgramSettings {
  return {
    pointer: -1,
    pins: defaultPins(template),
    deload: { every_weeks: deloadEveryWeeks(profile), week_index: 0, last_deload_on: null, active: false },
    priority_group: null,
    dumbbell_ladder_g: [...DEFAULT_DUMBBELL_LADDER_G],
    stack_step_g: {},
    rest_s: {},
    weekly_sessions_target: template.days_per_week,
    paused: false,
  }
}

/**
 * Make `template` the active program. Any other active program is switched
 * off; its history stays. The new rotation starts at day 1.
 */
export async function createProgram(
  db: GymDb,
  template: Template,
  today: DateKey,
  patch: Partial<ProgramSettings> = {},
): Promise<Program> {
  const profile = await getProfile(db)
  const stamp = nowIso()
  const userId = activeUserId()
  const old = await db.programs.filter((p) => p.active && p.deleted_at === null).toArray()
  const retired = old.map((p) => ({ ...p, active: false, updated_at: stamp, dirty: 1 as const }))
  const row: Program = {
    id: uuidv4(),
    user_id: userId,
    template_key: template.key,
    split: template.split,
    days_per_week: template.days_per_week,
    started_on: today,
    active: true,
    settings: { ...newProgramSettings(template, profile), ...patch },
    created_at: stamp,
    updated_at: stamp,
    version: 1,
    deleted_at: null,
    dirty: 1,
  }
  await db.transaction('rw', db.programs, async () => {
    await putRows(db, 'programs', [...retired, row])
  })
  return row
}

export async function updateProgramSettings(db: GymDb, program: Program, patch: Partial<ProgramSettings>): Promise<Program> {
  const next: Program = {
    ...program,
    settings: { ...program.settings, ...patch },
    updated_at: nowIso(),
    dirty: 1,
  }
  await putRows(db, 'programs', [next])
  return next
}

/**
 * Move the rotation pointer to the template day just completed. The session
 * logger calls this when a workout finishes and the planner says the session
 * advances the rotation; rest days and skips never call it.
 */
export async function advanceProgramPointer(db: GymDb, programId: string, completedIndex: number): Promise<void> {
  const program = await db.programs.get(programId)
  if (!program) return
  await updateProgramSettings(db, program, { pointer: completedIndex })
}
