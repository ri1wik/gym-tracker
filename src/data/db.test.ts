import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { SYNC_TABLES, OWNER_COLUMN, type WeighIn } from '../domain/types'
import { GUEST_USER_ID, SCHEMA_V1, dbName, deleteUserDb, openUserDb } from './db'

afterEach(async () => {
  await deleteUserDb(GUEST_USER_ID)
  await deleteUserDb('u1')
})

function weighIn(userId: string, dateKey: string, g: number): WeighIn {
  return {
    id: `${userId}:${dateKey}`,
    user_id: userId,
    date_key: dateKey,
    weight_g: g,
    waist_mm: null,
    same_conditions: true,
    note: null,
    created_at: '2026-10-05T07:00:00Z',
    updated_at: '2026-10-05T07:00:00Z',
    version: 1,
    deleted_at: null,
    dirty: 1,
  }
}

describe('schema', () => {
  it('has one table per synced server table plus outbox and meta', () => {
    const db = openUserDb(GUEST_USER_ID)
    const names = db.tables.map((t) => t.name).sort()
    expect(names).toEqual([...SYNC_TABLES, 'outbox', 'meta'].sort())
    expect(db.verno).toBe(1)
  })
  it('indexes the owner and updated_at on every owned table, and updated_at on shared ones', () => {
    for (const t of SYNC_TABLES) {
      const spec = SCHEMA_V1[t]
      if (OWNER_COLUMN[t] === 'id') expect(spec, t).toContain('updated_at')
      else if (t === 'foods' || t === 'portions') expect(spec, t).toContain('updated_at')
      else expect(spec, t).toContain('[user_id+updated_at]')
      expect(spec, t).toContain('dirty')
    }
    for (const t of ['body_weights', 'food_logs', 'cardio_sessions'] as const) expect(SCHEMA_V1[t]).toContain('[user_id+date_key]')
    expect(SCHEMA_V1.workout_sets).toContain('workout_id')
    expect(SCHEMA_V1.workouts).toContain('[user_id+planned_on]')
  })
})

describe('openUserDb', () => {
  it('names the database per user and reuses the instance', () => {
    const a = openUserDb('u1')
    const b = openUserDb('u1')
    expect(a).toBe(b)
    expect(a.name).toBe('gym_u1')
    expect(dbName(GUEST_USER_ID)).toBe('gym_local')
  })
  it('stores and reads a weigh-in through the compound index', async () => {
    const db = openUserDb('u1')
    await db.body_weights.bulkPut([weighIn('u1', '2026-10-01', 80_000), weighIn('u1', '2026-10-05', 79_600)])
    const row = await db.body_weights.where('[user_id+date_key]').equals(['u1', '2026-10-05']).first()
    expect(row?.weight_g).toBe(79_600)
    const dirty = await db.body_weights.where('dirty').equals(1).count()
    expect(dirty).toBe(2)
  })
  it('deleteUserDb removes the data', async () => {
    const db = openUserDb('u1')
    await db.meta.put({ key: 'x', value: 1 })
    await deleteUserDb('u1')
    const fresh = openUserDb('u1')
    expect(await fresh.meta.count()).toBe(0)
  })
})
