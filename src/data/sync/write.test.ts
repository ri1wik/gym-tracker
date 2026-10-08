import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { WeighIn, Workout } from '../../domain/types'
import { deleteUserDb, openUserDb } from '../db'
import { weighInId } from './ids'
import { enqueueUpload, patchRow, softDeleteRow, writeRow, type Draft } from './write'

const U = 'u-write'

afterEach(async () => {
  await deleteUserDb(U)
})

function weighIn(dateKey: string, g: number): Draft<WeighIn> {
  return { id: weighInId(U, dateKey), user_id: U, date_key: dateKey, weight_g: g, waist_mm: null, same_conditions: true, note: null }
}

function workout(id: string): Draft<Workout> {
  return {
    id,
    user_id: U,
    program_id: null,
    planned_on: '2026-10-06',
    session_key: 'push_a',
    started_at: '2026-10-06T06:00:00.000Z',
    finished_at: null,
    status: 'in_progress',
    notes: null,
    body_weight_g: null,
    plan: null,
  }
}

describe('writeRow', () => {
  it('writes the row and exactly one outbox entry, stamped and dirty', async () => {
    const db = openUserDb(U)
    const row = await writeRow(db, 'body_weights', weighIn('2026-10-06', 74_300))
    expect(row.dirty).toBe(1)
    expect(row.version).toBe(1)
    expect(row.deleted_at).toBeNull()
    expect(row.created_at).toBe(row.updated_at)
    const stored = await db.body_weights.get(row.id)
    expect(stored).toEqual(row)
    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ table: 'body_weights', row_id: row.id, op: 'upsert', state: 'pending', attempts: 0 })
    expect(outbox[0].payload).not.toHaveProperty('dirty')
    expect(outbox[0].payload.weight_g).toBe(74_300)
  })
  it('coalesces two writes of the same row into one outbox entry carrying the latest payload', async () => {
    const db = openUserDb(U)
    const first = await writeRow(db, 'body_weights', weighIn('2026-10-06', 74_300))
    const second = await writeRow(db, 'body_weights', weighIn('2026-10-06', 74_100))
    expect(second.updated_at > first.updated_at).toBe(true)
    expect(second.created_at).toBe(first.created_at)
    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].payload.weight_g).toBe(74_100)
    expect(outbox[0].payload.updated_at).toBe(second.updated_at)
  })
  it('keeps the server version of an existing row rather than inventing one', async () => {
    const db = openUserDb(U)
    const row = await writeRow(db, 'workouts', workout('w1'))
    await db.workouts.put({ ...row, version: 7, dirty: 0 })
    const again = await writeRow(db, 'workouts', { ...workout('w1'), notes: 'edited' })
    expect(again.version).toBe(7)
    expect(again.dirty).toBe(1)
  })
  it('row and outbox land together: a failing outbox put rolls the row back', async () => {
    const db = openUserDb(U)
    const bad = { ...weighIn('2026-10-07', 74_000), note: {} as unknown as string }
    // Put a poison outbox row id so the outbox put fails on a key path conflict with a non-string id.
    const spyDb = openUserDb(U)
    const original = spyDb.outbox.put.bind(spyDb.outbox)
    spyDb.outbox.put = (() => Promise.reject(new Error('boom'))) as unknown as typeof spyDb.outbox.put
    await expect(writeRow(spyDb, 'body_weights', bad)).rejects.toThrow('boom')
    spyDb.outbox.put = original
    expect(await db.body_weights.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('patchRow and softDeleteRow', () => {
  it('patch changes fields, re-stamps and queues', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('w2'))
    const patched = await patchRow(db, 'workouts', 'w2', { notes: 'felt strong', status: 'finished', finished_at: '2026-10-06T07:00:00.000Z' })
    expect(patched?.notes).toBe('felt strong')
    expect(patched?.status).toBe('finished')
    expect(await db.outbox.count()).toBe(1)
    expect(await patchRow(db, 'workouts', 'missing', { notes: 'x' })).toBeNull()
  })
  it('soft delete sets deleted_at once and queues the tombstone', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('w3'))
    const gone = await softDeleteRow(db, 'workouts', 'w3')
    expect(gone?.deleted_at).toBeTruthy()
    const again = await softDeleteRow(db, 'workouts', 'w3')
    expect(again?.deleted_at).toBe(gone?.deleted_at)
    expect(await db.workouts.count()).toBe(1)
    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0].payload.deleted_at).toBe(gone?.deleted_at)
  })
  it('enqueueUpload stores the blob with its own outbox id', async () => {
    const db = openUserDb(U)
    await enqueueUpload(db, 'photos', 'p1', `${U}/checkins/2026-10-06/front.jpg`, new Blob(['x'], { type: 'image/jpeg' }))
    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ op: 'upload', table: 'photos', row_id: 'p1', state: 'pending' })
    expect(items[0].payload.content_type).toBe('image/jpeg')
  })
})
