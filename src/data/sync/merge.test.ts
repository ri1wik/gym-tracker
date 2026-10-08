import { describe, expect, it } from 'vitest'
import type { Workout } from '../../domain/types'
import { mergeRow } from './merge'

function workout(over: Partial<Workout> = {}): Workout {
  return {
    id: 'w1',
    user_id: 'u1',
    program_id: null,
    planned_on: '2026-10-06',
    session_key: 'push_a',
    started_at: '2026-10-06T06:00:00.000Z',
    finished_at: null,
    status: 'in_progress',
    notes: null,
    body_weight_g: null,
    plan: null,
    created_at: '2026-10-06T06:00:00.000Z',
    updated_at: '2026-10-06T06:00:00.000Z',
    version: 1,
    deleted_at: null,
    dirty: 0,
    ...over,
  }
}

function remoteOf(w: Workout): Omit<Workout, 'dirty'> {
  const { dirty: _d, ...rest } = w
  return rest
}

describe('mergeRow', () => {
  it('takes remote when there is no local row', () => {
    const r = mergeRow<Workout>(undefined, remoteOf(workout({ version: 3, notes: 'remote' })))
    expect(r.choice).toBe('remote')
    expect(r.changed).toBe(true)
    expect(r.row.notes).toBe('remote')
    expect(r.row.dirty).toBe(0)
  })
  it('keeps a dirty local row whatever the remote version', () => {
    const local = workout({ dirty: 1, notes: 'mine', version: 1 })
    const r = mergeRow(local, remoteOf(workout({ version: 9, notes: 'theirs' })))
    expect(r.choice).toBe('local')
    expect(r.changed).toBe(false)
    expect(r.row.notes).toBe('mine')
    expect(r.row.dirty).toBe(1)
  })
  it('takes remote when its version is higher and the local row is clean', () => {
    const local = workout({ version: 2, notes: 'old' })
    const r = mergeRow(local, remoteOf(workout({ version: 3, notes: 'new' })))
    expect(r.choice).toBe('remote')
    expect(r.row.notes).toBe('new')
    expect(r.row.version).toBe(3)
    expect(r.row.dirty).toBe(0)
  })
  it('keeps local when the remote version is equal or lower', () => {
    const local = workout({ version: 3, notes: 'same' })
    expect(mergeRow(local, remoteOf(workout({ version: 3, notes: 'stale' }))).changed).toBe(false)
    expect(mergeRow(local, remoteOf(workout({ version: 2, notes: 'stale' }))).changed).toBe(false)
  })
  it('finished_at is monotone: a stale remote cannot un-finish a local session', () => {
    const local = workout({ version: 2, finished_at: '2026-10-06T07:00:00.000Z', status: 'finished' })
    const r = mergeRow(local, remoteOf(workout({ version: 5, finished_at: null, status: 'in_progress' })))
    expect(r.choice).toBe('remote')
    expect(r.row.finished_at).toBe('2026-10-06T07:00:00.000Z')
  })
  it('finished_at is monotone: a remote finish lands on a dirty local row', () => {
    const local = workout({ dirty: 1, finished_at: null })
    const r = mergeRow(local, remoteOf(workout({ version: 4, finished_at: '2026-10-06T07:30:00.000Z' })))
    expect(r.choice).toBe('local_updated')
    expect(r.changed).toBe(true)
    expect(r.row.finished_at).toBe('2026-10-06T07:30:00.000Z')
    expect(r.row.dirty).toBe(1)
  })
  it('deleted_at is monotone in both directions', () => {
    const deletedLocal = workout({ version: 2, deleted_at: '2026-10-06T08:00:00.000Z' })
    expect(mergeRow(deletedLocal, remoteOf(workout({ version: 6, deleted_at: null }))).row.deleted_at).toBe('2026-10-06T08:00:00.000Z')
    const cleanLocal = workout({ version: 6, deleted_at: null })
    const r = mergeRow(cleanLocal, remoteOf(workout({ version: 2, deleted_at: '2026-10-06T09:00:00.000Z' })))
    expect(r.changed).toBe(true)
    expect(r.row.deleted_at).toBe('2026-10-06T09:00:00.000Z')
    expect(r.row.version).toBe(6)
  })
  it('a non-null finished_at never changes to another value by the monotone rule', () => {
    const local = workout({ version: 1, finished_at: '2026-10-06T07:00:00.000Z' })
    const r = mergeRow(local, remoteOf(workout({ version: 2, finished_at: '2026-10-06T07:05:00.000Z' })))
    expect(r.row.finished_at).toBe('2026-10-06T07:05:00.000Z')
    const r2 = mergeRow(workout({ version: 3, finished_at: '2026-10-06T07:00:00.000Z' }), remoteOf(workout({ version: 2, finished_at: '2026-10-06T07:05:00.000Z' })))
    expect(r2.row.finished_at).toBe('2026-10-06T07:00:00.000Z')
  })
})

describe('mergeRow: status follows a carried finished_at', () => {
  it('a dirty in-progress copy that receives finished_at reads finished', () => {
    const local = workout({ dirty: 1, notes: 'offline edit' })
    const remote = remoteOf(workout({ version: 2, finished_at: '2026-10-06T07:00:00.000Z', status: 'finished' }))
    const r = mergeRow<Workout>(local, remote)
    expect(r.choice).toBe('local_updated')
    expect(r.row.finished_at).toBe('2026-10-06T07:00:00.000Z')
    expect(r.row.status).toBe('finished')
    expect(r.row.notes).toBe('offline edit')
    expect(r.row.dirty).toBe(1)
  })
})
