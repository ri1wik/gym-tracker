import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { GUEST_USER_ID, dbName, deleteUserDb, openUserDb } from '../db'
import { photoId, weighInId } from './ids'
import { countGuestRows, migrateGuestRows } from './migrate-guest'
import { writeRow } from './write'

const U = '22222222-2222-4222-8222-222222222222'

afterEach(async () => {
  await deleteUserDb(GUEST_USER_ID)
  await deleteUserDb(U)
})

describe('guest migration', () => {
  it('counts nothing without creating the guest database', async () => {
    expect(await countGuestRows()).toBe(0)
    expect(await Dexie.exists(dbName(GUEST_USER_ID))).toBe(false)
  })
  it('moves rows to the account, recomputes derived ids, follows references and drops the guest database', async () => {
    const guest = openUserDb(GUEST_USER_ID)
    const w = await writeRow(guest, 'body_weights', { id: weighInId(GUEST_USER_ID, '2026-10-06'), user_id: GUEST_USER_ID, date_key: '2026-10-06', weight_g: 74_200, waist_mm: null, same_conditions: true, note: null })
    await writeRow(guest, 'photos', {
      id: photoId(GUEST_USER_ID, '2026-10-06', 'front'),
      user_id: GUEST_USER_ID,
      weighin_id: w.id,
      date_key: '2026-10-06',
      pose: 'front',
      storage_path: `${GUEST_USER_ID}/checkins/2026-10-06/front.jpg`,
      thumb_path: `${GUEST_USER_ID}/checkins/2026-10-06/front_thumb.jpg`,
      width: 1080,
      height: 1440,
      bytes: 10,
      uploaded_at: null,
    })
    await writeRow(guest, 'workouts', { id: 'w-1', user_id: GUEST_USER_ID, program_id: null, planned_on: '2026-10-06', session_key: 'push_a', started_at: '2026-10-06T06:00:00.000Z', finished_at: null, status: 'in_progress', notes: null, body_weight_g: null, plan: null })
    expect(await countGuestRows()).toBe(3)

    const moved = await migrateGuestRows(U)
    expect(moved).toBe(3)
    const dst = openUserDb(U)
    const weigh = await dst.body_weights.get(weighInId(U, '2026-10-06'))
    expect(weigh?.user_id).toBe(U)
    expect(weigh?.dirty).toBe(1)
    const photo = await dst.photos.get(photoId(U, '2026-10-06', 'front'))
    expect(photo?.weighin_id).toBe(weighInId(U, '2026-10-06'))
    expect(photo?.storage_path).toBe(`${U}/checkins/2026-10-06/front.jpg`)
    expect((await dst.workouts.get('w-1'))?.user_id).toBe(U)
    expect(await dst.outbox.count()).toBe(3)
    expect(await Dexie.exists(dbName(GUEST_USER_ID))).toBe(false)
  })
})

describe('guest migration: the account profile wins', () => {
  const profile = (id: string) => ({
    id,
    display_name: 'Guest',
    sex: 'unspecified' as const,
    birth_date: null,
    height_mm: null,
    activity_level: 'light' as const,
    goal: 'recomp' as const,
    training_age: 'beginner' as const,
    training_days_per_week: 4,
    cardio_target_s: 9000,
    protein_dg_per_kg: 20,
    calorie_override_kcal: null,
    sleep_min: null,
    week_starts_on: 1 as const,
    review_weekday: 0 as const,
    review_minute_of_day: 1080,
    checkin_interval_days: 4,
    reference_intakes: 'nin' as const,
    active_gym_profile_id: null,
    onboarding_done: true,
  })
  it('a profile already pulled for the account is not overwritten by the guest profile', async () => {
    const dst = openUserDb(U)
    const { mergePage } = await import('./pull')
    await mergePage(dst, 'profiles', [
      { ...profile(U), display_name: 'Account', goal: 'lean_gain', calorie_override_kcal: 2600, week_starts_on: 0, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000+00:00', version: 7, deleted_at: null },
    ])
    const guest = openUserDb(GUEST_USER_ID)
    await writeRow(guest, 'profiles', profile(GUEST_USER_ID))
    await writeRow(guest, 'workouts', { id: 'w-2', user_id: GUEST_USER_ID, program_id: null, planned_on: '2026-10-06', session_key: 'push_a', started_at: '2026-10-06T06:00:00.000Z', finished_at: null, status: 'in_progress', notes: null, body_weight_g: null, plan: null })

    const moved = await migrateGuestRows(U)
    expect(moved).toBe(1)
    const after = await dst.profiles.get(U)
    expect(after?.display_name).toBe('Account')
    expect(after?.goal).toBe('lean_gain')
    expect(after?.calorie_override_kcal).toBe(2600)
    expect(after?.dirty).toBe(0)
    expect(await dst.outbox.get(`profiles:${U}`)).toBeUndefined()
  })
  it('a brand-new account (trigger default profile, version 1, onboarding not done) takes the guest profile', async () => {
    const dst = openUserDb(U)
    const { mergePage } = await import('./pull')
    await mergePage(dst, 'profiles', [
      { ...profile(U), display_name: '', onboarding_done: false, created_at: '2026-10-06T00:00:00.000Z', updated_at: '2026-10-06T00:00:00.000+00:00', version: 1, deleted_at: null },
    ])
    const guest = openUserDb(GUEST_USER_ID)
    await writeRow(guest, 'profiles', profile(GUEST_USER_ID))
    await migrateGuestRows(U)
    const after = await dst.profiles.get(U)
    expect(after?.display_name).toBe('Guest')
    expect(after?.onboarding_done).toBe(true)
    expect(after?.dirty).toBe(1)
  })
})

describe('guest rows are offered to one account only', () => {
  const A = '11111111-1111-4111-8111-111111111111'
  const B = '44444444-4444-4444-8444-444444444444'
  afterEach(async () => {
    await deleteUserDb(A)
    await deleteUserDb(B)
  })
  it('the first account offered keeps the offer; a different account on the same device is offered nothing', async () => {
    const { guestRowsToOffer } = await import('./migrate-guest')
    const guest = openUserDb(GUEST_USER_ID)
    await writeRow(guest, 'body_weights', { id: weighInId(GUEST_USER_ID, '2026-10-07'), user_id: GUEST_USER_ID, date_key: '2026-10-07', weight_g: 70_000, waist_mm: null, same_conditions: true, note: null })
    expect(await guestRowsToOffer(A)).toBe(1)
    // A says "Not now" and signs out; B signs in next.
    expect(await guestRowsToOffer(B)).toBe(0)
    // A comes back and is offered them again.
    expect(await guestRowsToOffer(A)).toBe(1)
  })
})
