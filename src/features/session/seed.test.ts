import { describe, expect, it } from 'vitest'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { needsLoad, seedLoadG } from './seed'

describe('first-time row seeding', () => {
  it('a barbell move starts at its bar, dumbbells at the lowest rung, a stack at one step, never 0', () => {
    expect(seedLoadG(EXERCISES_BY_ID['overhead-press'])).toBe(20_000)
    expect(seedLoadG(EXERCISES_BY_ID['ez-bar-curl'])).toBe(10_000)
    expect(seedLoadG(EXERCISES_BY_ID['incline-dumbbell-press'])).toBe(1000)
    expect(seedLoadG(EXERCISES_BY_ID['machine-chest-press'])).toBe(5000)
    for (const ex of Object.values(EXERCISES_BY_ID)) {
      if (ex.loadType === 'weight') expect(seedLoadG(ex)).toBeGreaterThan(0)
    }
  })
  it('bodyweight, assisted and timed moves seed 0 and never demand a load', () => {
    expect(seedLoadG(EXERCISES_BY_ID['plank'])).toBe(0)
    expect(needsLoad(EXERCISES_BY_ID['plank'], 'working', 0)).toBe(false)
  })
  it('a loaded working set at 0 kg asks for a load; a ramp or a loaded row does not', () => {
    expect(needsLoad(EXERCISES_BY_ID['overhead-press'], 'working', 0)).toBe(true)
    expect(needsLoad(EXERCISES_BY_ID['overhead-press'], 'warmup', 0)).toBe(false)
    expect(needsLoad(EXERCISES_BY_ID['overhead-press'], 'working', 20_000)).toBe(false)
    expect(needsLoad(undefined, 'working', 0)).toBe(false)
  })
})
