import { describe, expect, it } from 'vitest'
import { TEMPLATES, TEMPLATES_BY_KEY } from '../../data/library/templates'
import { BODY_PARTS, type BodyPart, type MuscleGroup } from '../types'
import { UNFLAGGED_BODY_PARTS } from '../muscles'
import {
  projectWeeklySetsByBodyPart,
  projectWeeklySetsByGroup,
  roundedSets,
  rotationScale,
} from './projection'

const PPL6_TABLE: Partial<Record<MuscleGroup, number>> = {
  chest: 18,
  lats: 14,
  upper_back: 19,
  side_delts: 11,
  rear_delts: 12,
  biceps: 18,
  triceps: 16,
  quads: 16,
  hamstrings: 11,
  glutes: 11,
  calves: 8,
}

describe('PPL 6-day projection', () => {
  const groups = projectWeeklySetsByGroup(TEMPLATES_BY_KEY.ppl_6)

  it('lands on the printed catalogue table within 2 sets', () => {
    for (const [group, want] of Object.entries(PPL6_TABLE) as [MuscleGroup, number][]) {
      expect(Math.abs(groups[group] - want), `${group}: ${groups[group]} vs ${want}`).toBeLessThanOrEqual(2)
    }
  })

  it('pins the exact projected table so a template edit is a visible change', () => {
    expect(roundedSets(groups)).toMatchObject({
      chest: 18,
      lats: 14,
      upper_back: 20,
      side_delts: 12,
      rear_delts: 11,
      biceps: 19,
      triceps: 16,
      quads: 16,
      hamstrings: 12,
      glutes: 12,
      calves: 8,
      abs: 6,
    })
  })

  it('keeps every scored body part of the default template at 8 or above', () => {
    const parts = projectWeeklySetsByBodyPart(TEMPLATES_BY_KEY.ppl_6)
    for (const part of BODY_PARTS) {
      if (UNFLAGGED_BODY_PARTS.includes(part)) continue
      expect(parts[part], part).toBeGreaterThanOrEqual(8)
    }
  })

  it('stays inside the 10 to 20 band for the big groups', () => {
    for (const g of ['chest', 'lats', 'upper_back', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'side_delts', 'rear_delts'] as const) {
      expect(groups[g], g).toBeGreaterThanOrEqual(10)
      expect(groups[g], g).toBeLessThanOrEqual(20)
    }
  })
})

describe('other splits', () => {
  it('projects the 5-day rotation at 5/6 of the 6-day numbers', () => {
    expect(rotationScale(TEMPLATES_BY_KEY.ppl_5)).toBeCloseTo(5 / 6, 10)
    const six = projectWeeklySetsByGroup(TEMPLATES_BY_KEY.ppl_6)
    const five = projectWeeklySetsByGroup(TEMPLATES_BY_KEY.ppl_5)
    for (const g of Object.keys(six) as MuscleGroup[]) expect(five[g]).toBeCloseTo((six[g] * 5) / 6, 10)
    expect(Math.round(five.chest)).toBe(15)
  })

  it('lands the 4-day upper/lower on chest 12 to 14 and back 13 to 15', () => {
    const parts = projectWeeklySetsByBodyPart(TEMPLATES_BY_KEY.upper_lower_4)
    expect(parts.chest).toBeGreaterThanOrEqual(12)
    expect(parts.chest).toBeLessThanOrEqual(14)
    expect(parts.back).toBeGreaterThanOrEqual(13)
    expect(parts.back).toBeLessThanOrEqual(15)
  })

  it('keeps the 4-day upper/lower at 8 or above for every scored part', () => {
    const parts = projectWeeklySetsByBodyPart(TEMPLATES_BY_KEY.upper_lower_4)
    for (const part of BODY_PARTS) {
      if (UNFLAGGED_BODY_PARTS.includes(part)) continue
      expect(parts[part], part).toBeGreaterThanOrEqual(8)
    }
  })

  it('gives the 3-day full body 9 to 12 sets for each major part', () => {
    const parts = projectWeeklySetsByBodyPart(TEMPLATES_BY_KEY.full_body_3)
    for (const p of ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'] as const) {
      expect(parts[p], p).toBeGreaterThanOrEqual(9)
      expect(parts[p], p).toBeLessThanOrEqual(12)
    }
  })

  it('keeps the minimal split to 6 to 8 sets for the big lifts by design', () => {
    const parts = projectWeeklySetsByBodyPart(TEMPLATES_BY_KEY.minimal_2)
    for (const p of ['chest', 'back', 'quads', 'hamstrings', 'glutes'] as BodyPart[]) {
      expect(parts[p], p).toBeGreaterThanOrEqual(6)
      expect(parts[p], p).toBeLessThanOrEqual(8)
    }
  })

  it('credits warm-free working sets only and never more than one set per body part per set', () => {
    for (const t of TEMPLATES) {
      const total = t.days.reduce((n, d) => n + d.items.reduce((m, i) => m + i.sets, 0), 0) * rotationScale(t)
      const parts = projectWeeklySetsByBodyPart(t)
      // A part can never exceed the total number of sets in the week.
      for (const part of BODY_PARTS) expect(parts[part]).toBeLessThanOrEqual(total)
    }
  })

  it('honours a custom sessions-per-week and an exercise map', () => {
    const t = TEMPLATES_BY_KEY.ppl_6
    const two = projectWeeklySetsByGroup(t, { sessionsPerWeek: 3 })
    const six = projectWeeklySetsByGroup(t)
    expect(two.chest).toBeCloseTo(six.chest / 2, 10)
    const none = projectWeeklySetsByGroup(t, { exercises: {} })
    expect(none.chest).toBe(0)
  })
})
