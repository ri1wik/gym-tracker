import { describe, expect, it } from 'vitest'
import { BODY_PARTS, EQUIPMENT_FAMILY_OF } from '../../domain/types'
import { MUSCLE_INFO } from '../../domain/muscles'
import { EXERCISE_COUNT, EXERCISE_IDS, EXERCISE_INDEX, EXERCISES_BY_ID, KEY_LIFT_IDS } from './exercise-index'
import { MACHINES_BY_ID, MACHINE_INDEX } from './machine-index'

describe('exercise index', () => {
  it('has exactly 85 exercises with unique kebab ids', () => {
    expect(EXERCISE_INDEX).toHaveLength(EXERCISE_COUNT)
    expect(EXERCISE_COUNT).toBe(85)
    expect(new Set(EXERCISE_IDS).size).toBe(85)
    for (const id of EXERCISE_IDS) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
  it('covers all 11 body parts with 2 or 3 priority exercises each', () => {
    for (const part of BODY_PARTS) {
      const rows = EXERCISE_INDEX.filter((e) => e.bodyPart === part)
      expect(rows.length, part).toBeGreaterThan(0)
      const priority = rows.filter((e) => e.isRecompPriority).length
      expect(priority, `${part} priority`).toBeGreaterThanOrEqual(2)
      expect(priority, `${part} priority`).toBeLessThanOrEqual(3)
    }
  })
  it('every primary muscle sits in the exercise body part, or the move is a hinge or carry filed where people look for it', () => {
    for (const e of EXERCISE_INDEX) {
      expect(e.primaryMuscles.length, e.id).toBeGreaterThan(0)
      expect(e.secondaryMuscles.length, e.id).toBeLessThanOrEqual(2)
      expect(e.equipmentFamily, e.id).toBe(EQUIPMENT_FAMILY_OF[e.equipment])
      const partsOfPrimaries = e.primaryMuscles.map((m) => MUSCLE_INFO[m].bodyPart)
      const filedElsewhere = ['deadlift', 'trap-bar-deadlift']
      if (!filedElsewhere.includes(e.id)) expect(partsOfPrimaries, e.id).toContain(e.bodyPart)
    }
  })
  it('machine ids resolve and barbell moves carry a bar type', () => {
    for (const e of EXERCISE_INDEX) {
      if (e.machineId) expect(MACHINES_BY_ID[e.machineId], `${e.id} -> ${e.machineId}`).toBeDefined()
      if (e.equipmentFamily === 'barbell') expect(e.barType, e.id).toBeDefined()
      if (['machine', 'cable', 'smith'].includes(e.equipmentFamily)) expect(e.machineId, e.id).toBeDefined()
    }
  })
  it('the audited secondaries hold', () => {
    expect(EXERCISES_BY_ID['back-squat'].secondaryMuscles).not.toContain('hamstrings')
    expect(EXERCISES_BY_ID['overhead-press'].secondaryMuscles).not.toContain('upper_chest')
    expect(EXERCISES_BY_ID['trap-bar-deadlift'].secondaryMuscles.length).toBeLessThanOrEqual(2)
    expect(EXERCISES_BY_ID['barbell-row'].primaryMuscles).toEqual(['upper_back', 'lats'])
  })
  it('assisted moves use the assisted machine and time moves exist for the plank', () => {
    for (const e of EXERCISE_INDEX.filter((x) => x.loadType === 'assisted')) expect(e.machineId).toBe('assisted-pull-up-dip')
    expect(EXERCISES_BY_ID.plank.loadType).toBe('time')
  })
  it('key lifts are compounds in the index', () => {
    for (const id of KEY_LIFT_IDS) expect(EXERCISES_BY_ID[id]?.isCompound, id).toBe(true)
  })
  it('the substitution fixture has its three candidates with one pattern and primary', () => {
    const ids = ['seated-cable-row', 'single-arm-cable-row', 'chest-supported-machine-row']
    for (const id of ids) {
      expect(EXERCISES_BY_ID[id].movementPattern).toBe('horizontal_pull')
      expect(EXERCISES_BY_ID[id].primaryMuscles).toEqual(['upper_back'])
    }
  })
})

describe('machine index', () => {
  it('has about 40 unique machines in known categories', () => {
    expect(MACHINE_INDEX.length).toBeGreaterThanOrEqual(38)
    expect(MACHINE_INDEX.length).toBeLessThanOrEqual(50)
    expect(new Set(MACHINE_INDEX.map((m) => m.id)).size).toBe(MACHINE_INDEX.length)
  })
  it('every non-cardio machine supports at least one exercise', () => {
    const used = new Set(EXERCISE_INDEX.map((e) => e.machineId).filter(Boolean))
    for (const m of MACHINE_INDEX) {
      if (m.category === 'cardio') continue
      expect(used.has(m.id), m.id).toBe(true)
    }
  })
})
