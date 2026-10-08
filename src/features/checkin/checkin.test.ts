import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { GUEST_USER_ID, deleteUserDb, openUserDb } from '../../data/db'
import type { WeighIn } from '../../domain/types'
import { saveProfile, listWeighIns, newProfileBase } from '../profile/repo'
import { buildCheckinIcs } from './ics'
import { buildMiniRead, waistIsDue } from './miniRead'
import { MAX_G, MIN_G, stepKgText } from './weightStep'
import { saveWeighIn, weighInId } from './write'

afterEach(async () => {
  await deleteUserDb(GUEST_USER_ID)
})

function row(date_key: string, weight_g: number, waist_mm: number | null = null): WeighIn {
  return {
    id: `${date_key}`,
    user_id: 'u',
    date_key,
    weight_g,
    waist_mm,
    same_conditions: true,
    note: null,
    created_at: '2026-10-01T07:00:00Z',
    updated_at: '2026-10-01T07:00:00Z',
    version: 1,
    deleted_at: null,
    dirty: 1,
  }
}

describe('weigh-in writes', () => {
  it('writes a dirty version 1 row under the deterministic id', async () => {
    const db = openUserDb(GUEST_USER_ID)
    const saved = await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-08', weight_g: 82_400, same_conditions: true })
    expect(saved.id).toBe(weighInId(GUEST_USER_ID, '2026-10-08'))
    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(saved.dirty).toBe(1)
    expect(saved.version).toBe(1)
    expect(saved.waist_mm).toBeNull()
    expect(saved.user_id).toBe(GUEST_USER_ID)
  })

  it('the id differs by user and by day, and repeats for the same pair', () => {
    expect(weighInId('a', '2026-10-08')).toBe(weighInId('a', '2026-10-08'))
    expect(weighInId('a', '2026-10-08')).not.toBe(weighInId('b', '2026-10-08'))
    expect(weighInId('a', '2026-10-08')).not.toBe(weighInId('a', '2026-10-09'))
  })

  it('a second save on the same day edits the same row and keeps created_at', async () => {
    const db = openUserDb(GUEST_USER_ID)
    const first = await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-08', weight_g: 82_400, waist_mm: 880, same_conditions: true })
    await new Promise((r) => setTimeout(r, 5))
    const second = await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-08', weight_g: 82_000, same_conditions: false })
    expect(second.id).toBe(first.id)
    expect(second.created_at).toBe(first.created_at)
    expect(second.updated_at >= first.updated_at).toBe(true)
    expect(second.weight_g).toBe(82_000)
    // waist left undefined keeps the stored one; null clears it
    expect(second.waist_mm).toBe(880)
    const cleared = await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-08', weight_g: 82_000, waist_mm: null, same_conditions: false })
    expect(cleared.waist_mm).toBeNull()
    expect(await db.body_weights.count()).toBe(1)
  })

  it('lists live weigh-ins oldest first and hides soft deleted ones', async () => {
    const db = openUserDb(GUEST_USER_ID)
    await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-08', weight_g: 82_000, same_conditions: true })
    await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-04', weight_g: 82_400, same_conditions: true })
    const gone = await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-06', weight_g: 99_000, same_conditions: true })
    await db.body_weights.update(gone.id, { deleted_at: '2026-10-07T00:00:00Z' })
    const list = await listWeighIns(db, GUEST_USER_ID)
    expect(list.map((r) => r.date_key)).toEqual(['2026-10-04', '2026-10-08'])
  })

  it('a soft deleted day that is logged again comes back', async () => {
    const db = openUserDb(GUEST_USER_ID)
    const a = await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-08', weight_g: 82_000, same_conditions: true })
    await db.body_weights.update(a.id, { deleted_at: '2026-10-08T09:00:00Z' })
    const b = await saveWeighIn(db, GUEST_USER_ID, { date_key: '2026-10-08', weight_g: 81_900, same_conditions: true })
    expect(b.deleted_at).toBeNull()
  })
})

describe('profile writes', () => {
  it('creates the row with defaults, then merges patches', async () => {
    const db = openUserDb(GUEST_USER_ID)
    const a = await saveProfile(db, GUEST_USER_ID, { sex: 'male', height_mm: 1780, onboarding_done: true })
    expect(a.id).toBe(GUEST_USER_ID)
    expect(a.dirty).toBe(1)
    expect(a.version).toBe(1)
    expect(a.cardio_target_s).toBe(9000)
    const b = await saveProfile(db, GUEST_USER_ID, { goal: 'lean_gain' })
    expect(b.sex).toBe('male')
    expect(b.height_mm).toBe(1780)
    expect(b.goal).toBe('lean_gain')
    expect(b.created_at).toBe(a.created_at)
    expect(await db.profiles.count()).toBe(1)
  })

  it('keeps the base shape in step with the Profile type', () => {
    const p = newProfileBase('x')
    expect(Object.keys(p)).toContain('onboarding_done')
  })
})

describe('weight stepping', () => {
  it('moves in exact 0.1 kg steps without float drift', () => {
    let t = '82.0'
    for (let i = 0; i < 7; i++) t = stepKgText(t, 100)
    expect(t).toBe('82.7')
    for (let i = 0; i < 3; i++) t = stepKgText(t, -100)
    expect(t).toBe('82.4')
  })
  it('accepts a decimal comma and clamps at the limits', () => {
    expect(stepKgText('82,4', 100)).toBe('82.5')
    expect(stepKgText(String(MAX_G / 1000), 100)).toBe('300.0')
    expect(stepKgText(String(MIN_G / 1000), -100)).toBe('30.0')
  })
  it('starts from a sensible value when the field is empty', () => {
    expect(stepKgText('', 100)).toBe('70.1')
  })
})

describe('mini read', () => {
  const readings = [row('2026-09-28', 83_000, 900), row('2026-10-02', 82_600), row('2026-10-06', 82_400, 890)]

  it('gives the change since the previous reading and the next due day', () => {
    const m = buildMiniRead({ readings, dateKey: '2026-10-06', goal: 'recomp', intervalDays: 4 })!
    expect(m.deltaG).toBe(-200)
    expect(m.previous).toEqual({ date_key: '2026-10-02', weight_g: 82_600 })
    expect(m.nextCheckin).toBe('2026-10-10')
    expect(m.waistDeltaMm).toBe(-10)
  })

  it('reads a first reading as first, with no change and no verdict', () => {
    const m = buildMiniRead({ readings: [row('2026-10-06', 82_400)], dateKey: '2026-10-06', goal: 'recomp', intervalDays: 4 })!
    expect(m.deltaG).toBeNull()
    expect(m.previous).toBeNull()
    expect(m.trendRead.collecting).toEqual({ count: 1, expected: 10 })
    expect(m.trend.band).toBe('collecting')
  })

  it('returns null when today has no reading, and ignores soft deleted rows', () => {
    expect(buildMiniRead({ readings, dateKey: '2026-10-07', goal: 'recomp', intervalDays: 4 })).toBeNull()
    const withDeleted = [...readings, { ...row('2026-10-07', 70_000), deleted_at: '2026-10-07T10:00:00Z' }]
    expect(buildMiniRead({ readings: withDeleted, dateKey: '2026-10-07', goal: 'recomp', intervalDays: 4 })).toBeNull()
  })

  it('follows the profile interval', () => {
    const m = buildMiniRead({ readings, dateKey: '2026-10-06', goal: 'recomp', intervalDays: 7 })!
    expect(m.nextCheckin).toBe('2026-10-13')
  })

  it('opens the waist field when the last waist is a week old or missing', () => {
    expect(waistIsDue([], '2026-10-06')).toBe(true)
    expect(waistIsDue(readings, '2026-10-08')).toBe(false)
    expect(waistIsDue(readings, '2026-10-13')).toBe(true)
    expect(waistIsDue([row('2026-10-02', 82_600)], '2026-10-06')).toBe(true)
  })
})

describe('calendar file', () => {
  const ics = buildCheckinIcs({ firstDue: '2026-10-10', intervalDays: 4, count: 12, minuteOfDay: 450, nowIso: '2026-10-08T09:30:15.123Z' })

  it('holds 12 events, one every interval, at the reminder time', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(12)
    expect(ics).toContain('DTSTART:20261010T073000')
    expect(ics).toContain('DTSTART:20261014T073000')
    expect(ics).toContain('DTSTART:20261123T073000')
    expect(ics).toContain('DTSTAMP:20261008T093015Z')
  })
  it('is a well-formed calendar with CRLF line ends and an alarm per event', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(12)
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true)
  })
})
