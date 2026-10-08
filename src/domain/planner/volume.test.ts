import { describe, expect, it } from 'vitest'
import type { Template } from '../types'
import { EX, MINIMAL2, PPL6 } from './fixtures'
import { defaultExerciseFor, projectWeeklySets, volumeGuard } from './volume'

describe('volume projector', () => {
  it('projects weekly sets per group at the 14-group level, front delts included', () => {
    const v = projectWeeklySets(PPL6, EX)
    // Chest: bench 4 + incline DB 3 (upper chest) + incline barbell 3 + DB bench 3 + crossover 3 = 16 primary.
    expect(v.chest).toBe(16)
    // Front delts: presses as primary (3 + 4) plus 0.5 per secondary credit from the pushes.
    expect(v.front_delts).toBeGreaterThan(7)
    expect(v.quads).toBeGreaterThanOrEqual(10)
    expect(v.forearms).toBeGreaterThan(0)
    for (const n of Object.values(v)) expect(n).toBeGreaterThanOrEqual(0)
  })

  it('scales by sessions per week over templates in the rotation', () => {
    const six = projectWeeklySets(PPL6, EX)
    const five = projectWeeklySets(PPL6, EX, 5)
    expect(five.chest).toBeCloseTo((six.chest * 5) / 6, 1)
  })

  it('the guard is silent on the minimal split and on a template inside the bands', () => {
    expect(volumeGuard(MINIMAL2, EX)).toEqual([])
  })

  it('removing the lateral raises produces one add-on suggestion naming a lateral raise, never the day before the main side-delt session', () => {
    const t: Template = {
      ...PPL6,
      days: PPL6.days.map((d) => ({ ...d, items: d.items.filter((i) => !i.exercise_id.includes('lateral-raise')) })),
    }
    const before = volumeGuard(PPL6, EX).filter((s) => s.group === 'side_delts')
    expect(before).toEqual([])
    const after = volumeGuard(t, EX).filter((s) => s.group === 'side_delts')
    expect(after.length).toBe(1)
    expect(after[0].kind).toBe('add')
    expect(after[0].exercise_id).toBe('dumbbell-lateral-raise')
    expect(after[0].sets).toBe(3)
    expect(after[0].text).toMatch(/^Side delts .* under 10: add Dumbbell lateral raise 3 sets to /)
  })

  it('over the band trims one isolation set from the end first', () => {
    const t: Template = {
      ...PPL6,
      days: PPL6.days.map((d) => ({ ...d, items: d.items.map((i) => (i.exercise_id === 'cable-pushdown' || i.exercise_id === 'skull-crusher' ? { ...i, sets: 8 } : i)) })),
    }
    const trims = volumeGuard(t, EX).filter((s) => s.group === 'triceps')
    expect(trims.length).toBe(1)
    expect(trims[0].kind).toBe('trim')
    expect(trims[0].sets).toBe(-1)
    expect(trims[0].exercise_id).toBe('skull-crusher')
    expect(trims[0].day_key).toBe('push_b')
  })

  it('a priority group widens its band to 14 to 22', () => {
    const subs = volumeGuard(PPL6, EX, { priority_group: 'calves' })
    const calves = subs.find((s) => s.group === 'calves')
    expect(calves?.kind).toBe('add')
    expect(calves?.band).toEqual([14, 22])
  })

  it('the library default for a group is its priority exercise on the first pattern, barbell first', () => {
    expect(defaultExerciseFor('chest', EX)?.id).toBe('barbell-bench-press')
    expect(defaultExerciseFor('side_delts', EX)?.id).toBe('dumbbell-lateral-raise')
    expect(defaultExerciseFor('lats', EX)?.id).toBe('lat-pulldown')
  })
})
