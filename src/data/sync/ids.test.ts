import { describe, expect, it } from 'vitest'
import { newId, outboxId, photoId, weighInId } from './ids'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('deterministic ids', () => {
  it('body_weights: same user and day give the same id on every device', () => {
    const a = weighInId('user-a', '2026-10-06')
    const b = weighInId('user-a', '2026-10-06')
    expect(a).toBe(b)
    expect(a).toMatch(UUID)
    expect(a.charAt(14)).toBe('5')
  })
  it('body_weights: another day or another user gives another id', () => {
    expect(weighInId('user-a', '2026-10-06')).not.toBe(weighInId('user-a', '2026-10-07'))
    expect(weighInId('user-a', '2026-10-06')).not.toBe(weighInId('user-b', '2026-10-06'))
  })
  it('photos: user, day and pose', () => {
    const front = photoId('user-a', '2026-10-06', 'front')
    expect(front).toBe(photoId('user-a', '2026-10-06', 'front'))
    expect(front).not.toBe(photoId('user-a', '2026-10-06', 'side'))
    expect(front).not.toBe(weighInId('user-a', '2026-10-06'))
    expect(front).toMatch(UUID)
  })
  it('pins the derivation so a change would be caught', () => {
    expect(weighInId('11111111-1111-4111-8111-111111111111', '2026-01-01')).toBe('540b5db4-fbde-58cc-a68d-c372a4c2bfef')
  })
  it('random ids are v4 and distinct', () => {
    const a = newId()
    expect(a).toMatch(UUID)
    expect(a.charAt(14)).toBe('4')
    expect(a).not.toBe(newId())
  })
  it('outbox ids coalesce by table and row', () => {
    expect(outboxId('workouts', 'x')).toBe('workouts:x')
  })
})
