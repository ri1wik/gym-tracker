// Reads and writes of the profile row and the body-weight rows that the
// profile screens need. Reads are live queries on the local database, so a
// screen never waits on the network and never shows a spinner.

import { useLiveQuery } from 'dexie-react-hooks'
import type { GymDb } from '../../data/db'
import type { Profile, WeighIn } from '../../domain/types'
import { writeRow } from '../checkin/write'
import { currentDb, currentUserId } from './current'

/** Weekly cardio target default: 150 minutes. */
export const DEFAULT_CARDIO_TARGET_S = 150 * 60
/** Review prompt default: 18:00. */
export const DEFAULT_REVIEW_MINUTE = 18 * 60

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'version' | 'dirty'>>

export function newProfileBase(id: string): Omit<Profile, 'created_at' | 'updated_at' | 'version' | 'dirty' | 'deleted_at'> {
  return {
    id,
    display_name: '',
    sex: 'unspecified',
    birth_date: null,
    height_mm: null,
    activity_level: 'moderate',
    goal: 'recomp',
    training_age: 'beginner',
    training_days_per_week: 4,
    cardio_target_s: DEFAULT_CARDIO_TARGET_S,
    protein_dg_per_kg: 20,
    calorie_override_kcal: null,
    sleep_min: null,
    week_starts_on: 1,
    review_weekday: 0,
    review_minute_of_day: DEFAULT_REVIEW_MINUTE,
    checkin_interval_days: 4,
    reference_intakes: 'nin',
    active_gym_profile_id: null,
    onboarding_done: false,
  }
}

/** Merge a patch into the stored profile (or a fresh one) and save it. */
export async function saveProfile(db: GymDb, id: string, patch: ProfilePatch): Promise<Profile> {
  const existing = await db.profiles.get(id)
  const base = existing ?? newProfileBase(id)
  return writeRow(db, 'profiles', { ...base, ...patch, id })
}

/** The profile, `null` when none is saved yet, `undefined` for the first frame. */
export function useProfile(): Profile | null | undefined {
  return useLiveQuery(() => currentDb().profiles.get(currentUserId()).then((p) => p ?? null), [], undefined)
}

/** Every live weigh-in for the user, oldest first, `undefined` for the first frame. */
export function useWeighIns(): WeighIn[] | undefined {
  return useLiveQuery(() => listWeighIns(currentDb(), currentUserId()), [], undefined)
}

/** Sorts after every day key, for an index range scan. */
const KEY_MAX = String.fromCharCode(0xffff)

export async function listWeighIns(db: GymDb, userId: string): Promise<WeighIn[]> {
  const rows = await db.body_weights
    .where('[user_id+date_key]')
    .between([userId, ''], [userId, KEY_MAX])
    .toArray()
  return rows.filter((r) => r.deleted_at === null)
}

/** Has this person finished setup? `undefined` while the first read is in flight. */
export function useOnboardingDone(): boolean | undefined {
  const p = useProfile()
  if (p === undefined) return undefined
  return p?.onboarding_done === true
}
