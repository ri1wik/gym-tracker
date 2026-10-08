// Typed write helpers, one per entity. Every UI slice writes through these:
// each call puts the row and its outbox entry in ONE Dexie transaction,
// stamps updated_at and dirty, fills user_id from the current user when the
// caller leaves it out, derives the deterministic id for weigh-ins and
// photos, and asks the sync engine to flush soon.
//
// OWNER: data-sync. Reads stay plain Dexie queries on currentDb().

import type {
  CardioSession,
  Favourite,
  Food,
  FoodLog,
  GymProfile,
  MachineSetting,
  OwnedRow,
  Photo,
  Portion,
  Profile,
  Program,
  RowOf,
  SyncTable,
  WeighIn,
  Workout,
  WorkoutSet,
} from '../../domain/types'
import type { GymDb } from '../db'
import { currentDb, currentUserId } from '../sync/current'
import { notifyWrite } from '../sync/engine'
import { newId, photoId, weighInId } from '../sync/ids'
import { enqueueUpload, patchRow, softDeleteRow, writeRow, type Draft, type StampedField } from '../sync/write'

export { currentDb, currentUserId } from '../sync/current'
export { newId, photoId, weighInId } from '../sync/ids'
export type { Draft } from '../sync/write'

/** An owned row as a caller supplies it: id and user_id may be left out. */
export type OwnedDraft<T extends OwnedRow> = Omit<T, StampedField | 'id' | 'user_id'> & Partial<Pick<T, 'id' | 'user_id' | StampedField>>

async function saveOwned<T extends SyncTable>(table: T, draft: OwnedDraft<RowOf<T> & OwnedRow>, id?: string): Promise<RowOf<T>> {
  const db = currentDb()
  const row = {
    ...draft,
    id: id ?? draft.id ?? newId(),
    user_id: draft.user_id ?? currentUserId(),
  } as unknown as Draft<RowOf<T>>
  const saved = await writeRow(db, table, row)
  notifyWrite()
  return saved
}

/** profiles: the id is the user id. */
export async function saveProfile(draft: Omit<Profile, StampedField | 'id'> & Partial<Pick<Profile, 'id' | StampedField>>): Promise<Profile> {
  const row = { ...draft, id: draft.id ?? currentUserId() } as Draft<Profile>
  const saved = await writeRow(currentDb(), 'profiles', row)
  notifyWrite()
  return saved
}

/** body_weights: id derives from (user_id, date_key). */
export function saveWeighIn(draft: OwnedDraft<WeighIn>): Promise<WeighIn> {
  const userId = draft.user_id ?? currentUserId()
  return saveOwned('body_weights', { ...draft, user_id: userId }, weighInId(userId, draft.date_key))
}

/** photos: id derives from (user_id, date_key, pose). */
export function savePhoto(draft: OwnedDraft<Photo>): Promise<Photo> {
  const userId = draft.user_id ?? currentUserId()
  return saveOwned('photos', { ...draft, user_id: userId }, photoId(userId, draft.date_key, draft.pose))
}

/** The storage path of a photo file for the current user. */
export function photoStoragePath(userId: string, dateKey: string, pose: Photo['pose'], thumb = false): string {
  return `${userId}/checkins/${dateKey}/${pose}${thumb ? '_thumb' : ''}.jpg`
}

/**
 * Save a photo row and queue its two files. Order on the wire: file, thumb,
 * then the row's own upsert (uploads sort first in the outbox).
 */
export async function savePhotoWithFiles(draft: OwnedDraft<Photo>, file: Blob, thumb: Blob): Promise<Photo> {
  const db = currentDb()
  const row = await savePhoto(draft)
  await enqueueUpload(db, 'photos', row.id, row.storage_path, file)
  await enqueueUpload(db, 'photos', row.id, row.thumb_path, thumb)
  notifyWrite()
  return row
}

export const saveProgram = (draft: OwnedDraft<Program>) => saveOwned('programs', draft)
export const saveWorkout = (draft: OwnedDraft<Workout>) => saveOwned('workouts', draft)
export const saveWorkoutSet = (draft: OwnedDraft<WorkoutSet>) => saveOwned('workout_sets', draft)
export const saveCardioSession = (draft: OwnedDraft<CardioSession>) => saveOwned('cardio_sessions', draft)
export const saveMachineSetting = (draft: OwnedDraft<MachineSetting>) => saveOwned('machine_settings', draft)
export const saveGymProfile = (draft: OwnedDraft<GymProfile>) => saveOwned('gym_profiles', draft)
export const saveFavourite = (draft: OwnedDraft<Favourite>) => saveOwned('favourites', draft)
export const saveFoodLog = (draft: OwnedDraft<FoodLog>) => saveOwned('food_logs', draft)

/** foods and portions: user-added catalogue rows. user_id is the current user unless the caller says otherwise. */
export async function saveFood(draft: Omit<Food, StampedField | 'id'> & Partial<Pick<Food, 'id' | StampedField>>): Promise<Food> {
  const row = { ...draft, id: draft.id ?? newId() } as Draft<Food>
  const saved = await writeRow(currentDb(), 'foods', row)
  notifyWrite()
  return saved
}

export async function savePortion(draft: Omit<Portion, StampedField | 'id'> & Partial<Pick<Portion, 'id' | StampedField>>): Promise<Portion> {
  const row = { ...draft, id: draft.id ?? newId() } as Draft<Portion>
  const saved = await writeRow(currentDb(), 'portions', row)
  notifyWrite()
  return saved
}

/** Change a few fields of any synced row. */
export async function patch<T extends SyncTable>(table: T, id: string, fields: Partial<Omit<RowOf<T>, 'id' | StampedField>>): Promise<RowOf<T> | null> {
  const row = await patchRow(currentDb(), table, id, fields)
  if (row) notifyWrite()
  return row
}

/** Soft delete any synced row. */
export async function remove<T extends SyncTable>(table: T, id: string): Promise<RowOf<T> | null> {
  const row = await softDeleteRow(currentDb(), table, id)
  if (row) notifyWrite()
  return row
}

/** The same helpers against an explicit database, for tests and the migration. */
export const withDb = {
  write: writeRow,
  patch: patchRow,
  remove: softDeleteRow,
  upload: enqueueUpload,
} satisfies Record<string, (db: GymDb, ...args: never[]) => unknown>
