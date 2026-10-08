import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { WeighIn } from '../../domain/types'
import { META_KEYS, deleteUserDb, openUserDb } from '../db'
import { weighInId } from './ids'
import { mergePage, pullQuery, pullTable } from './pull'
import { SYNC_CONFIG_BY_NAME } from './tables'
import type { RestResult, Transport } from './transport'
import { writeRow } from './write'

const U = 'u-pull'

afterEach(async () => {
  await deleteUserDb(U)
})

function remoteWeighIn(dateKey: string, g: number, version: number, updatedAt: string): Omit<WeighIn, 'dirty'> {
  return {
    id: weighInId(U, dateKey),
    user_id: U,
    date_key: dateKey,
    weight_g: g,
    waist_mm: null,
    same_conditions: true,
    note: null,
    created_at: '2026-10-01T06:00:00+00:00',
    updated_at: updatedAt,
    version,
    deleted_at: null,
  }
}

function selectTransport(pages: Array<RestResult | ((query: string) => RestResult)>) {
  const queries: string[] = []
  const t: Transport = {
    upsert: async () => ({ status: 200, data: [], message: null }),
    select: async (_table, query) => {
      queries.push(query)
      const head = pages.shift() ?? { status: 200, data: [], message: null }
      return typeof head === 'function' ? head(query) : head
    },
    upload: async () => ({ status: 200, data: null, message: null }),
    refreshSession: async () => true,
  }
  return { t, queries }
}

describe('pullQuery', () => {
  it('filters by owner, orders by updated_at then id, and pages', () => {
    const q = new URLSearchParams(pullQuery(SYNC_CONFIG_BY_NAME.body_weights, U, '2026-10-01T00:00:00.000Z', 1000))
    expect(q.get('user_id')).toBe(`eq.${U}`)
    expect(q.get('updated_at')).toBe('gte.2026-10-01T00:00:00.000Z')
    expect(q.get('order')).toBe('updated_at.asc,id.asc')
    expect(q.get('limit')).toBe('1000')
    expect(q.get('offset')).toBe('1000')
  })
  it('profiles filter on id; shared tables carry no owner filter', () => {
    expect(new URLSearchParams(pullQuery(SYNC_CONFIG_BY_NAME.profiles, U, 'x', 0)).get('id')).toBe(`eq.${U}`)
    const foods = new URLSearchParams(pullQuery(SYNC_CONFIG_BY_NAME.foods, U, 'x', 0))
    expect(foods.has('user_id')).toBe(false)
    expect(foods.has('id')).toBe(false)
  })
})

describe('pullTable', () => {
  it('starts from the epoch, stores rows clean and advances the cursor', async () => {
    const db = openUserDb(U)
    const { t, queries } = selectTransport([
      { status: 200, data: [remoteWeighIn('2026-10-01', 74_900, 1, '2026-10-01T06:00:00+00:00'), remoteWeighIn('2026-10-05', 74_500, 1, '2026-10-05T06:00:00+00:00')], message: null },
    ])
    const r = await pullTable(db, t, SYNC_CONFIG_BY_NAME.body_weights, U, { refreshed: false })
    expect(r).toEqual({ received: 2, stored: 2, stopped: null, error: null })
    expect(new URLSearchParams(queries[0]).get('updated_at')).toBe('gte.1970-01-01T00:00:00.000Z')
    expect(await db.body_weights.count()).toBe(2)
    expect((await db.body_weights.get(weighInId(U, '2026-10-05')))?.dirty).toBe(0)
    expect((await db.meta.get(META_KEYS.cursor('body_weights')))?.value).toBe('2026-10-05T06:00:00+00:00')
  })
  it('the next pull starts two minutes before the cursor', async () => {
    const db = openUserDb(U)
    await db.meta.put({ key: META_KEYS.cursor('body_weights'), value: '2026-10-05T06:00:00.000Z' })
    const { t, queries } = selectTransport([])
    await pullTable(db, t, SYNC_CONFIG_BY_NAME.body_weights, U, { refreshed: false })
    expect(new URLSearchParams(queries[0]).get('updated_at')).toBe('gte.2026-10-05T05:58:00.000Z')
  })
  it('pages until a short page and keeps the greatest updated_at', async () => {
    const db = openUserDb(U)
    const config = { ...SYNC_CONFIG_BY_NAME.body_weights, pageSize: 2 }
    const { t, queries } = selectTransport([
      { status: 200, data: [remoteWeighIn('2026-10-01', 1, 1, '2026-10-01T06:00:00+00:00'), remoteWeighIn('2026-10-02', 1, 1, '2026-10-02T06:00:00+00:00')], message: null },
      { status: 200, data: [remoteWeighIn('2026-10-03', 1, 1, '2026-10-03T06:00:00+00:00')], message: null },
    ])
    const r = await pullTable(db, t, config, U, { refreshed: false })
    expect(r.received).toBe(3)
    expect(queries).toHaveLength(2)
    expect(new URLSearchParams(queries[1]).get('offset')).toBe('2')
    expect((await db.meta.get(META_KEYS.cursor('body_weights')))?.value).toBe('2026-10-03T06:00:00+00:00')
  })
  it('a dirty local row survives the pull; a clean one takes the higher remote version', async () => {
    const db = openUserDb(U)
    const dirty = await writeRow(db, 'body_weights', { id: weighInId(U, '2026-10-01'), user_id: U, date_key: '2026-10-01', weight_g: 70_000, waist_mm: null, same_conditions: true, note: null })
    await db.body_weights.put({ ...(await writeRow(db, 'body_weights', { id: weighInId(U, '2026-10-02'), user_id: U, date_key: '2026-10-02', weight_g: 70_000, waist_mm: null, same_conditions: true, note: null })), dirty: 0, version: 1 })
    const { stored } = await mergePage(db, 'body_weights', [
      remoteWeighIn('2026-10-01', 99_000, 5, '2026-10-01T06:00:00+00:00'),
      remoteWeighIn('2026-10-02', 99_000, 5, '2026-10-02T06:00:00+00:00'),
    ])
    expect(stored).toBe(1)
    expect((await db.body_weights.get(dirty.id))?.weight_g).toBe(70_000)
    expect((await db.body_weights.get(weighInId(U, '2026-10-02')))?.weight_g).toBe(99_000)
  })
  it('a backoff response stops the pull with the error line', async () => {
    const db = openUserDb(U)
    const { t } = selectTransport([{ status: 503, data: null, message: null }])
    const r = await pullTable(db, t, SYNC_CONFIG_BY_NAME.body_weights, U, { refreshed: false })
    expect(r.stopped).toBe('backoff')
    expect(r.error).toBe('HTTP 503')
  })
})
