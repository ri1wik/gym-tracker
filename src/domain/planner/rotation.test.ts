import { describe, expect, it } from 'vitest'
import type { TemplateDay } from '../types'
import { EX, history, program, session } from './fixtures'
import { coverageOfDay, customRotationEffect, nextSession, pointerAfterSession, setCountsOf } from './rotation'

describe('rotation', () => {
  it('after Pull A comes Legs A, whatever the weekday', () => {
    // 2026-10-08 is a Thursday.
    const r = nextSession(program({ pointer: 1 }), history(), '2026-10-08')
    expect(r.day.key).toBe('legs_a')
    expect(r.index).toBe(2)
    expect(r.rotation_effect).toBe('advances')
    expect(r.first_session_back).toBe(false)
    expect(r.reason).toBe('Next after Pull A')
  })

  it('wraps from Legs B back to Push A', () => {
    expect(nextSession(program({ pointer: 5 }), history(), '2026-10-08').day.key).toBe('push_a')
  })

  it('a pinned Saturday offers Legs A after a Push A, and Push B follows it', () => {
    const p = program({ pointer: 0, pins: { 6: 'legs_a' } })
    // 2026-10-10 is a Saturday.
    const sat = nextSession(p, history(), '2026-10-10')
    expect(sat.day.key).toBe('legs_a')
    expect(sat.rotation_effect).toBe('pinned')
    expect(sat.reason).toBe('Saturday is pinned to Legs A')
    const pointer = pointerAfterSession(p, 'legs_a', 'pinned')
    expect(pointer).toBe(2)
    expect(nextSession(program({ ...p, pointer }), history(), '2026-10-12').day.key).toBe('push_b')
  })

  it('a pin to an unknown day key is ignored', () => {
    const r = nextSession(program({ pointer: 0, pins: { 6: 'nope' } }), history(), '2026-10-10')
    expect(r.day.key).toBe('pull_a')
    expect(r.rotation_effect).toBe('advances')
  })

  it('ten or more days away flags the first session back without changing the day', () => {
    const h = history(session('barbell-bench-press', '2026-09-27', 80_000, [8, 8, 8]), [
      { id: 'w1', session_key: 'push_a', planned_on: '2026-09-27', finished_at: '2026-09-27T19:00:00Z', substitutions: [] },
    ])
    const r = nextSession(program({ pointer: 0 }), h, '2026-10-08')
    expect(r.day.key).toBe('pull_a')
    expect(r.first_session_back).toBe(true)
    expect(r.reason).toBe('Next after Push A; first session back after 11 days, loads minus 5 percent')
    expect(nextSession(program({ pointer: 0 }), h, '2026-10-06').first_session_back).toBe(false)
  })

  it('a custom session holds the pointer below 70 percent coverage and advances at or above it', () => {
    const push: TemplateDay = {
      key: 'push',
      name: 'Push',
      cardio_note: null,
      items: [
        { exercise_id: 'barbell-bench-press', sets: 4, rep_min: 6, rep_max: 8, rest_s: 150 },
        { exercise_id: 'overhead-press', sets: 3, rep_min: 8, rep_max: 12, rest_s: 150 },
        { exercise_id: 'dumbbell-lateral-raise', sets: 3, rep_min: 12, rep_max: 15, rest_s: 75 },
        { exercise_id: 'cable-pushdown', sets: 3, rep_min: 12, rep_max: 15, rest_s: 75 },
        { exercise_id: 'overhead-cable-extension', sets: 3, rep_min: 10, rep_max: 15, rest_s: 75 },
      ],
    }
    // Chest and triceps: 4 chest sets and 6 triceps sets of the day's 16 primary sets, 62.5 percent.
    const chestTriceps = [
      { exercise_id: 'barbell-bench-press', sets: 4 },
      { exercise_id: 'cable-pushdown', sets: 3 },
      { exercise_id: 'overhead-cable-extension', sets: 3 },
    ]
    expect(coverageOfDay(push, chestTriceps, EX)).toBeCloseTo(0.625, 5)
    expect(customRotationEffect(push, chestTriceps, EX)).toBe('holds')
    // Extra sets of a muscle never count past what the day prescribes.
    const stacked = [{ exercise_id: 'barbell-bench-press', sets: 12 }]
    expect(coverageOfDay(push, stacked, EX)).toBeCloseTo(0.25, 5)
    const enough = [...chestTriceps, { exercise_id: 'seated-dumbbell-shoulder-press', sets: 2 }]
    expect(coverageOfDay(push, enough, EX)).toBeCloseTo(0.75, 5)
    expect(customRotationEffect(push, enough, EX)).toBe('advances')
    expect(pointerAfterSession(program({ pointer: 0 }), 'custom', 'holds')).toBe(0)
    expect(pointerAfterSession(program({ pointer: 0 }), 'custom', 'advances')).toBe(1)
  })

  it('aggregates working sets per exercise for the coverage rule', () => {
    const sets = [...session('barbell-bench-press', '2026-10-08', 80_000, [8, 8, 8]), ...session('cable-pushdown', '2026-10-08', 30_000, [12, 12])]
    expect(setCountsOf(sets)).toEqual([
      { exercise_id: 'barbell-bench-press', sets: 3 },
      { exercise_id: 'cable-pushdown', sets: 2 },
    ])
  })
})
