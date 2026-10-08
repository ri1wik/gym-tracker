import { describe, expect, it } from 'vitest'
import { EXERCISE_IDS, EXERCISE_INDEX } from './exercise-index'
import { EXERCISES, buildAliasMap, getExercise } from './exercises'

describe('exercises.json content', () => {
  it('has a record for every id in the index and nothing else', () => {
    expect(EXERCISES).toHaveLength(EXERCISE_IDS.length)
    for (const id of EXERCISE_IDS) expect(getExercise(id), id).toBeDefined()
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length)
  })
  it('copies the structural facts from the index verbatim', () => {
    for (const idx of EXERCISE_INDEX) {
      const e = getExercise(idx.id)!
      for (const [k, v] of Object.entries(idx)) expect(e[k as keyof typeof e], `${idx.id}.${k}`).toEqual(v)
    }
  })
  it('gives every record exactly 4 how-to lines and 3 mistakes, none empty', () => {
    for (const e of EXERCISES) {
      expect(e.howTo, e.id).toHaveLength(4)
      expect(e.mistakes, e.id).toHaveLength(3)
      for (const l of [...e.howTo, ...e.mistakes, e.cue]) expect(l.trim().length, e.id).toBeGreaterThan(0)
    }
  })
  it('has integer prescriptions in the agreed bands', () => {
    for (const e of EXERCISES) {
      expect(Number.isInteger(e.repMin) && Number.isInteger(e.repMax), e.id).toBe(true)
      expect(e.repMax, e.id).toBeGreaterThanOrEqual(e.repMin)
      expect([0, 2000, 2500, 5000], e.id).toContain(e.incrementG)
      expect([75, 150, 180], e.id).toContain(e.restS)
      if (e.media !== null) expect(e.media.source, e.id).toBe('repdb')
      if (e.equipmentFamily === 'bodyweight') expect(e.incrementG, e.id).toBe(0)
      if (e.equipmentFamily === 'dumbbell') expect(e.incrementG, e.id).toBe(2000)
      if (e.isCompound) expect(e.restS, e.id).toBeGreaterThanOrEqual(150)
      else expect(e.restS, e.id).toBe(75)
    }
  })
  it('sets the heavy compounds to 5-8, second compounds to 8-12 and isolation to 10-15', () => {
    for (const id of ['barbell-bench-press', 'barbell-row', 'back-squat', 'overhead-press', 'deadlift', 'romanian-deadlift']) {
      expect([getExercise(id)!.repMin, getExercise(id)!.repMax], id).toEqual([5, 8])
    }
    expect([getExercise('incline-dumbbell-press')!.repMin, getExercise('incline-dumbbell-press')!.repMax]).toEqual([8, 12])
    expect([getExercise('cable-pushdown')!.repMin, getExercise('cable-pushdown')!.repMax]).toEqual([10, 15])
    expect(getExercise('back-squat')!.restS).toBe(180)
    expect(getExercise('deadlift')!.restS).toBe(180)
    expect(getExercise('barbell-bench-press')!.incrementG).toBe(2500)
    expect(getExercise('back-squat')!.incrementG).toBe(5000)
    expect(getExercise('leg-press')!.incrementG).toBe(5000)
  })
  it('keeps aliases unique across the library and finds the common ones', () => {
    const owner = new Map<string, string>()
    for (const e of EXERCISES) {
      for (const n of [e.name, ...e.aliases]) {
        const k = n.toLowerCase()
        if (owner.has(k)) expect(owner.get(k), `${k} belongs to two exercises`).toBe(e.id)
        owner.set(k, e.id)
      }
    }
    const map = buildAliasMap()
    expect(map.get('rdl')).toBe('romanian-deadlift')
    expect(map.get('ohp')).toBe('overhead-press')
    expect(map.get('pulldown')).toBe('lat-pulldown')
    expect(map.get('pec deck')).toBe('pec-deck')
  })
  it('carries no dash punctuation or restricted words in any text', () => {
    const text = JSON.stringify(EXERCISES)
    const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)]
    for (const d of dashes) expect(text.includes(d), `dash U+${d.charCodeAt(0).toString(16)}`).toBe(false)
    expect(text.toLowerCase()).not.toMatch(/negative|failed/)
  })
})
