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
