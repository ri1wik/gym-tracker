import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { deleteUserDb, openUserDb } from '../../data/db'
import { weighInId } from '../../data/sync/ids'
import { writeRow } from '../../data/sync/write'
import { backupFileName, buildBackup, importBackup, parseBackup, readLastBackupAt, recordBackup } from './backup'

const A = 'u-backup-a'
const B = 'u-backup-b'

afterEach(async () => {
  await deleteUserDb(A)
  await deleteUserDb(B)
})

describe('backup round trip', () => {
  it('exports every table without local-only fields and imports into another account by row id', async () => {
    const a = openUserDb(A)
    await writeRow(a, 'body_weights', { id: weighInId(A, '2026-10-06'), user_id: A, date_key: '2026-10-06', weight_g: 74_200, waist_mm: null, same_conditions: true, note: null })
    await writeRow(a, 'workouts', { id: 'w-1', user_id: A, program_id: null, planned_on: '2026-10-06', session_key: 'push_a', started_at: '2026-10-06T06:00:00.000Z', finished_at: '2026-10-06T07:00:00.000Z', status: 'finished', notes: null, body_weight_g: null, plan: null })
    const file = await buildBackup(a, A, '2026-10-07T10:00:00.000Z')
    expect(file.app).toBe('recomp')
    expect(file.tables.body_weights).toHaveLength(1)
    expect(file.tables.body_weights?.[0]).not.toHaveProperty('dirty')
    expect(backupFileName(file.exported_at)).toBe('recomp-backup-2026-10-07.json')

    const parsed = parseBackup(JSON.stringify(file))
    const b = openUserDb(B)
    const r = await importBackup(b, B, parsed)
    expect(r).toEqual({ added: 2, updated: 0, skipped: 0 })
    const weigh = await b.body_weights.get(weighInId(B, '2026-10-06'))
    expect(weigh?.user_id).toBe(B)
    expect(weigh?.weight_g).toBe(74_200)
    expect(weigh?.dirty).toBe(1)
    expect((await b.workouts.get('w-1'))?.user_id).toBe(B)
    expect(await b.outbox.count()).toBe(2)

    // A second import of the same file changes nothing.
    const again = await importBackup(b, B, parsed)
    expect(again).toEqual({ added: 0, updated: 0, skipped: 2 })
  })

  it('an older copy never replaces a newer local row; a newer copy does', async () => {
    const b = openUserDb(B)
    const local = await writeRow(b, 'workouts', { id: 'w-2', user_id: B, program_id: null, planned_on: '2026-10-06', session_key: 'push_a', started_at: '2026-10-06T06:00:00.000Z', finished_at: null, status: 'in_progress', notes: 'local', body_weight_g: null, plan: null })
    const older = { ...local, notes: 'older', updated_at: '2020-01-01T00:00:00.000Z' }
    const r1 = await importBackup(b, B, parseBackup(JSON.stringify({ app: 'recomp', format: 1, exported_at: '', user_id: B, tables: { workouts: [older] } })))
    expect(r1.skipped).toBe(1)
    expect((await b.workouts.get('w-2'))?.notes).toBe('local')
    const newer = { ...local, notes: 'newer', updated_at: '2099-01-01T00:00:00.000Z' }
    const r2 = await importBackup(b, B, parseBackup(JSON.stringify({ app: 'recomp', format: 1, exported_at: '', user_id: B, tables: { workouts: [newer] } })))
    expect(r2.updated).toBe(1)
    expect((await b.workouts.get('w-2'))?.notes).toBe('newer')
  })

  it('rejects files that are not backups and skips catalogue rows', async () => {
    expect(() => parseBackup('not json')).toThrow(/not JSON/)
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a Recomp backup/)
    expect(() => parseBackup('{"app":"recomp","format":9,"tables":{}}')).toThrow(/format 9/)
    const b = openUserDb(B)
    const r = await importBackup(b, B, parseBackup(JSON.stringify({ app: 'recomp', format: 1, tables: { foods: [{ id: 'f1', user_id: null, name: 'Dal' }] } })))
    expect(r).toEqual({ added: 0, updated: 0, skipped: 1 })
  })

  it('remembers the last backup', async () => {
    const b = openUserDb(B)
    expect(await readLastBackupAt(b)).toBeNull()
    await recordBackup(b, '2026-10-07T10:00:00.000Z')
    expect(await readLastBackupAt(b)).toBe('2026-10-07T10:00:00.000Z')
  })
})
