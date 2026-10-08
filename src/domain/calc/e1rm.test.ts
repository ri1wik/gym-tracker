import { describe, expect, it } from 'vitest'
import { beats, e1rmG, epleyG, holdsWithin, E1RM_MAX_REPS } from './e1rm'

describe('e1rm: Epley edge rules', () => {
  it('80 kg x 8 gives 101.3 kg', () => {
    expect(epleyG(80_000, 8)).toBe(101_333)
    expect(e1rmG({ loadType: 'weight', load_g: 80_000, reps: 8 })).toBe(101_333)
  })
  it('reps 1 returns the load itself', () => {
    expect(epleyG(100_000, 1)).toBe(100_000)
    expect(e1rmG({ loadType: 'weight', load_g: 100_000, reps: 1 })).toBe(100_000)
  })
  it('reps above 10 return null, as do 0 and negative reps', () => {
    expect(E1RM_MAX_REPS).toBe(10)
    expect(epleyG(60_000, 11)).toBeNull()
    expect(epleyG(60_000, 15)).toBeNull()
    expect(epleyG(60_000, 0)).toBeNull()
    expect(epleyG(60_000, -3)).toBeNull()
    expect(epleyG(60_000, 10)).toBe(80_000)
  })
  it('bodyweight moves use the day body weight plus added load', () => {
    expect(e1rmG({ loadType: 'bodyweight', load_g: 10_000, reps: 5, body_weight_g: 80_000 })).toBe(105_000)
    expect(e1rmG({ loadType: 'bodyweight', load_g: 0, reps: 8, body_weight_g: null })).toBeNull()
    expect(e1rmG({ loadType: 'bodyweight', load_g: 0, reps: 8 })).toBeNull()
  })
  it('assisted and timed moves never get an estimate', () => {
    expect(e1rmG({ loadType: 'assisted', load_g: 0, reps: 8, body_weight_g: 80_000 })).toBeNull()
    expect(e1rmG({ loadType: 'time', load_g: 0, reps: 45, body_weight_g: 80_000 })).toBeNull()
  })
  it('rejects a negative or non-finite load', () => {
    expect(epleyG(-5, 5)).toBeNull()
    expect(epleyG(Number.NaN, 5)).toBeNull()
  })
})

describe('e1rm: beats', () => {
  const a = { load_g: 60_000, reps: 10 }
  it('more load at the same or more reps', () => {
    expect(beats(a, { load_g: 62_500, reps: 10 })).toBe(true)
    expect(beats(a, { load_g: 62_500, reps: 11 })).toBe(true)
  })
  it('more reps at the same load', () => {
    expect(beats(a, { load_g: 60_000, reps: 11 })).toBe(true)
    expect(beats(a, { load_g: 60_000, reps: 10 })).toBe(false)
  })
  it('a full step up with at most two reps fewer counts; a sub-step bump does not', () => {
    expect(beats(a, { load_g: 62_500, reps: 8 })).toBe(true)
    expect(beats(a, { load_g: 61_000, reps: 9 })).toBe(false)
    expect(beats(a, { load_g: 62_500, reps: 7 })).toBe(false)
    expect(beats(a, { load_g: 65_000, reps: 5 }, 5000)).toBe(false)
    expect(beats(a, { load_g: 65_000, reps: 8 }, 5000)).toBe(true)
  })
  it('never through the e1RM alone', () => {
    // 61 x 9 has a higher Epley than 62.5 x 8 and still does not count.
    expect(epleyG(61_000, 9)! > epleyG(62_500, 8)!).toBe(true)
    expect(beats(a, { load_g: 61_000, reps: 9 })).toBe(false)
  })
  it('lower never beats', () => {
    expect(beats(a, { load_g: 57_500, reps: 12 })).toBe(false)
  })
})

describe('e1rm: holdsWithin', () => {
  it('within 5 percent holds, below does not, null never', () => {
    expect(holdsWithin(100_000, 95_000)).toBe(true)
    expect(holdsWithin(100_000, 94_999)).toBe(false)
    expect(holdsWithin(null, 95_000)).toBe(false)
    expect(holdsWithin(100_000, null)).toBe(false)
  })
})
