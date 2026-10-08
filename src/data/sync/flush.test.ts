import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Workout } from '../../domain/types'
import { deleteUserDb, openUserDb } from '../db'
import { discardDeadItem, flushTable, retryDeadItem } from './flush'
import type { RestResult, Transport } from './transport'
import { writeRow, type Draft } from './write'

const U = 'u-flush'

afterEach(async () => {
  await deleteUserDb(U)
})

function workout(id: string, over: Partial<Workout> = {}): Draft<Workout> {
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
    ...over,
  }
}

interface Call {
  kind: 'upsert' | 'select' | 'upload' | 'refresh'
  table?: string
  rows?: Record<string, unknown>[]
  path?: string
}

/** A transport that answers from a script of results, recording every call. */
function fakeTransport(script: Array<RestResult | ((call: Call) => RestResult | Promise<RestResult>)>, refreshOk = true) {
  const calls: Call[] = []
  const next = async (call: Call): Promise<RestResult> => {
    calls.push(call)
    const head = script.shift()
    if (!head) return { status: 200, data: call.rows?.map((r) => ({ ...r, version: 2, updated_at: '2026-10-06T06:10:00.000+00:00' })) ?? [], message: null }
    return typeof head === 'function' ? head(call) : head
  }
  const t: Transport = {
    upsert: async (table, rows) => next({ kind: 'upsert', table, rows }),
    select: async (table) => next({ kind: 'select', table }),
    upload: async (path) => next({ kind: 'upload', path }),
    refreshSession: async () => {
      calls.push({ kind: 'refresh' })
      return refreshOk
    },
  }
  return { t, calls }
}

describe('flushTable', () => {
  it('sends pending rows without version and updated_at, then clears dirty and the outbox', async () => {
    const db = openUserDb(U)
    const row = await writeRow(db, 'workouts', workout('w1'))
    const { t, calls } = fakeTransport([])
    const r = await flushTable(db, t, 'workouts', { refreshed: false })
    expect(r).toEqual({ sent: 1, dead: 0, stopped: null, error: null })
    expect(calls).toHaveLength(1)
    const sent = calls[0].rows?.[0]
    expect(sent).toBeDefined()
    expect(sent).not.toHaveProperty('version')
    expect(sent).not.toHaveProperty('updated_at')
    expect(sent).not.toHaveProperty('dirty')
    expect(sent?.id).toBe('w1')
    const stored = await db.workouts.get('w1')
    expect(stored?.dirty).toBe(0)
    expect(stored?.version).toBe(2)
    expect(stored?.updated_at).toBe('2026-10-06T06:10:00.000+00:00')
    expect(stored?.updated_at).not.toBe(row.updated_at)
    expect(await db.outbox.count()).toBe(0)
  })
  it('an edit during the flight keeps the row dirty and the item pending', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('w1'))
    const { t } = fakeTransport([
      (call) => {
        // Simulate a concurrent edit: the test cannot interleave inside the awaited call, so it rewrites after the send is captured.
        void writeRow(db, 'workouts', workout('w1', { notes: 'edited mid flight' }))
        return { status: 200, data: call.rows, message: null }
      },
    ])
    await flushTable(db, t, 'workouts', { refreshed: false })
    const stored = await db.workouts.get('w1')
    expect(stored?.notes).toBe('edited mid flight')
    expect(stored?.dirty).toBe(1)
    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0].state).toBe('pending')
  })
  it('401 refreshes once and retries the same batch', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('w1'))
    const { t, calls } = fakeTransport([{ status: 401, data: null, message: 'JWT expired' }])
    const r = await flushTable(db, t, 'workouts', { refreshed: false })
    expect(r.sent).toBe(1)
    expect(calls.map((c) => c.kind)).toEqual(['upsert', 'refresh', 'upsert'])
  })
  it('a second 401 after the refresh stops the flush and leaves the item pending', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('w1'))
    const { t } = fakeTransport([
      { status: 401, data: null, message: 'JWT expired' },
      { status: 401, data: null, message: 'JWT expired' },
    ])
    const r = await flushTable(db, t, 'workouts', { refreshed: false })
    expect(r.stopped).toBe('refresh')
    const items = await db.outbox.toArray()
    expect(items[0].state).toBe('pending')
    expect(items[0].attempts).toBe(1)
    expect((await db.workouts.get('w1'))?.dirty).toBe(1)
  })
  it('429, 5xx and no response back off: the item stays pending with the error noted', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('w1'))
    for (const res of [
      { status: 429, data: null, message: 'slow down' },
      { status: 503, data: null, message: null },
      { status: null, data: null, message: 'Timed out' },
    ]) {
      const { t, calls } = fakeTransport([res])
      const r = await flushTable(db, t, 'workouts', { refreshed: false })
      expect(r.stopped).toBe('backoff')
      expect(calls).toHaveLength(1)
      const item = (await db.outbox.toArray())[0]
      expect(item.state).toBe('pending')
      expect(item.last_error).toContain(res.status ? `HTTP ${res.status}` : 'No connection')
    }
    expect((await db.outbox.toArray())[0].attempts).toBe(3)
  })
  it('422 dead-letters the item, and a batch is split to find the bad row', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('good'))
    await writeRow(db, 'workouts', workout('bad'))
    const { t, calls } = fakeTransport([
      { status: 422, data: null, message: 'check constraint' },
      (call) => (call.rows?.[0]?.id === 'bad' ? { status: 422, data: null, message: 'check constraint' } : { status: 201, data: call.rows, message: null }),
      (call) => (call.rows?.[0]?.id === 'bad' ? { status: 422, data: null, message: 'check constraint' } : { status: 201, data: call.rows, message: null }),
    ])
    const r = await flushTable(db, t, 'workouts', { refreshed: false })
    expect(r).toMatchObject({ sent: 1, dead: 1, stopped: null })
    expect(calls).toHaveLength(3)
    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ row_id: 'bad', state: 'dead' })
    expect(items[0].last_error).toBe('HTTP 422: check constraint')
    expect((await db.workouts.get('good'))?.dirty).toBe(0)
    expect((await db.workouts.get('bad'))?.dirty).toBe(1)
  })
  it('retry puts a dead item back; discard drops it and clears dirty so a pull can replace the row', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workouts', workout('bad'))
    const { t } = fakeTransport([{ status: 400, data: null, message: 'bad request' }])
    await flushTable(db, t, 'workouts', { refreshed: false })
    const dead = (await db.outbox.toArray())[0]
    expect(dead.state).toBe('dead')
    await retryDeadItem(db, dead.id)
    expect((await db.outbox.get(dead.id))?.state).toBe('pending')
    await discardDeadItem(db, dead.id)
    expect(await db.outbox.count()).toBe(0)
    expect((await db.workouts.get('bad'))?.dirty).toBe(0)
  })
  it('uploads go before the row upsert and carry the file', async () => {
    const db = openUserDb(U)
    const { enqueueUpload } = await import('./write')
    await writeRow(db, 'photos', {
      id: 'p1',
      user_id: U,
      weighin_id: null,
      date_key: '2026-10-06',
      pose: 'front',
      storage_path: `${U}/checkins/2026-10-06/front.jpg`,
      thumb_path: `${U}/checkins/2026-10-06/front_thumb.jpg`,
      width: 1080,
      height: 1440,
      bytes: 3,
      uploaded_at: null,
    })
    await enqueueUpload(db, 'photos', 'p1', `${U}/checkins/2026-10-06/front.jpg`, new Blob(['abc'], { type: 'image/jpeg' }))
    const { t, calls } = fakeTransport([{ status: 200, data: { Key: 'x' }, message: null }])
    const r = await flushTable(db, t, 'photos', { refreshed: false })
    expect(r.sent).toBe(2)
    expect(calls.map((c) => c.kind)).toEqual(['upload', 'upsert'])
    expect(calls[0].path).toBe(`${U}/checkins/2026-10-06/front.jpg`)
    expect(await db.outbox.count()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Review regressions: items stuck in flight, edits during an earlier batch,
// and the push side of the monotone rule.
// ---------------------------------------------------------------------------

import type { WorkoutSet } from '../../domain/types'
import { PUSH_BATCH_SIZE } from './flush'
import { mergePage } from './pull'

function set(id: string, over: Partial<WorkoutSet> = {}): Draft<WorkoutSet> {
  return {
    id,
    user_id: U,
    workout_id: 'w1',
    exercise_id: 'barbell-bench-press',
    set_index: 0,
    kind: 'working',
    target_reps: 8,
    target_load_g: 60_000,
    reps: 8,
    load_g: 60_000,
    assist_g: 0,
    rpe: null,
    completed_at: '2026-10-06T06:05:00.000Z',
    rest_s: 150,
    substituted_for: null,
    ...over,
  }
}

describe('flushTable: items left in flight by a kill are retried', () => {
  it('a set whose push was interrupted (state in_flight) goes back to pending and is sent by the next flush', async () => {
    const db = openUserDb(U)
    await writeRow(db, 'workout_sets', set('s1'))
    const item = await db.outbox.get('workout_sets:s1')
    expect(item).toBeDefined()
    await db.outbox.put({ ...item!, state: 'in_flight' })

    const { t, calls } = fakeTransport([])
    const r = await flushTable(db, t, 'workout_sets', { refreshed: false })
    expect(calls).toHaveLength(1)
    expect(r.sent).toBe(1)
    expect(await db.outbox.get('workout_sets:s1')).toBeUndefined()
    expect((await db.workout_sets.get('s1'))?.dirty).toBe(0)
  })
})

describe('flushTable: an edit made while an earlier batch is on the wire', () => {
  it('is sent as it now is; nothing is overwritten with the stale snapshot', async () => {
    const db = openUserDb(U)
    const n = PUSH_BATCH_SIZE + 1
    for (let i = 0; i < n; i++) await writeRow(db, 'workout_sets', set(`s${String(i).padStart(3, '0')}`, { set_index: i }))
    const victim = `s${String(n - 1).padStart(3, '0')}`
    let edited = false
    const { t, calls } = fakeTransport([
      async (call) => {
        if (!edited && !call.rows?.some((r) => r.id === victim)) {
          edited = true
          await writeRow(db, 'workout_sets', set(victim, { set_index: n - 1, reps: 12 }))
        }
        return { status: 200, data: call.rows?.map((r) => ({ ...r, version: 2, updated_at: '2026-10-06T06:10:00.000+00:00' })) ?? [], message: null }
      },
      async (call) => ({ status: 200, data: call.rows?.map((r) => ({ ...r, version: 2, updated_at: '2026-10-06T06:10:00.000+00:00' })) ?? [], message: null }),
    ])
    const r = await flushTable(db, t, 'workout_sets', { refreshed: false })
    expect(r.dead).toBe(0)
    expect(r.stopped).toBeNull()
    const sentVictim = calls.flatMap((c) => c.rows ?? []).filter((row) => row.id === victim)
    expect(sentVictim.map((row) => row.reps)).toEqual([12])
    const local = await db.workout_sets.get(victim)
    expect(local?.reps).toBe(12)
    expect(local?.dirty).toBe(0)
    expect(await db.outbox.get(`workout_sets:${victim}`)).toBeUndefined()
  })
})

describe('flushTable: finished_at and deleted_at are monotone on the push side too', () => {
  const stamp = '2026-10-06T06:00:00.000+00:00'
  it('a dirty local copy pushes the finished_at the pull carried onto it, and status finished', async () => {
    const db = openUserDb(U)
    await mergePage(db, 'workouts', [{ ...workout('w1'), created_at: stamp, updated_at: stamp, version: 1, deleted_at: null }])
    await writeRow(db, 'workouts', workout('w1', { notes: 'felt strong' }))
    const finished = '2026-10-06T07:00:00.000+00:00'
    await mergePage(db, 'workouts', [
      { ...workout('w1', { finished_at: finished, status: 'finished' }), created_at: stamp, updated_at: finished, version: 2, deleted_at: null },
    ])
    const local = await db.workouts.get('w1')
    expect(local?.finished_at).toBe(finished)
    expect(local?.status).toBe('finished')
    expect(local?.notes).toBe('felt strong')
    expect(local?.dirty).toBe(1)

    const { t, calls } = fakeTransport([])
    const r = await flushTable(db, t, 'workouts', { refreshed: false })
    expect(r.sent).toBe(1)
    const wire = calls[0].rows?.[0]
    expect(wire?.finished_at).toBe(finished)
    expect(wire?.status).toBe('finished')
    expect(wire?.notes).toBe('felt strong')
    expect((await db.workouts.get('w1'))?.dirty).toBe(0)
  })
  it('a dirty local copy pushes the server tombstone, never deleted_at null', async () => {
    const db = openUserDb(U)
    await mergePage(db, 'workouts', [{ ...workout('w2'), created_at: stamp, updated_at: stamp, version: 1, deleted_at: null }])
    await writeRow(db, 'workouts', workout('w2', { notes: 'edited offline' }))
    const gone = '2026-10-06T07:30:00.000+00:00'
    await mergePage(db, 'workouts', [{ ...workout('w2'), created_at: stamp, updated_at: gone, version: 2, deleted_at: gone }])
    const { t, calls } = fakeTransport([])
    await flushTable(db, t, 'workouts', { refreshed: false })
    expect(calls[0].rows?.[0].deleted_at).toBe(gone)
  })
})
