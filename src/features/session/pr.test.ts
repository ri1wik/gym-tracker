import { describe, expect, it } from 'vitest'
import { detectPr, estimate1rmG, setBeats } from './pr'

describe('estimate1rmG (fallback Epley while the engine is a stub)', () => {
  it('pins 80 kg x 8 to 101.3 kg and reps 1 to the load', () => {
    expect(estimate1rmG(80_000, 8)).toBe(101_333)
    expect(estimate1rmG(80_000, 1)).toBe(80_000)
    expect(estimate1rmG(80_000, 11)).toBeNull()
  })
})

describe('setBeats', () => {
  it('counts more load at the same or more reps, or more reps at the same load, never e1RM alone', () => {
    expect(setBeats({ load_g: 60_000, reps: 10 }, { load_g: 62_500, reps: 10 })).toBe(true)
    expect(setBeats({ load_g: 60_000, reps: 10 }, { load_g: 60_000, reps: 11 })).toBe(true)
    expect(setBeats({ load_g: 60_000, reps: 10 }, { load_g: 62_500, reps: 8 })).toBe(false)
    expect(setBeats({ load_g: 60_000, reps: 10 }, { load_g: 60_000, reps: 10 })).toBe(false)
  })
})

describe('detectPr', () => {
  const prev = [
    { load_g: 60_000, reps: 8 },
    { load_g: 62_500, reps: 6 },
  ]
  it('labels a first-time record', () => {
    expect(detectPr({ load_g: 40_000, reps: 10 }, [], 'weight')).toBe('first')
  })
  it('weight beats reps beats e1RM', () => {
    expect(detectPr({ load_g: 65_000, reps: 3 }, prev, 'weight')).toBe('weight')
    expect(detectPr({ load_g: 60_000, reps: 9 }, prev, 'weight')).toBe('reps')
    expect(detectPr({ load_g: 61_000, reps: 10 }, prev, 'weight')).toBe('e1rm')
    expect(detectPr({ load_g: 60_000, reps: 8 }, prev, 'weight')).toBeNull()
    expect(detectPr({ load_g: 55_000, reps: 8 }, prev, 'weight')).toBeNull()
    // No earlier set has an estimate (12 reps), so a 10-rep set at the same load is not a record.
    expect(detectPr({ load_g: 25_000, reps: 10 }, [{ load_g: 25_000, reps: 12 }], 'weight')).toBeNull()
  })
  it('gives timed and assisted moves only reps records', () => {
    expect(detectPr({ load_g: 0, reps: 70 }, [{ load_g: 0, reps: 60 }], 'time')).toBe('reps')
    expect(detectPr({ load_g: 0, reps: 50 }, [{ load_g: 0, reps: 60 }], 'time')).toBeNull()
    expect(detectPr({ load_g: 20_000, reps: 8 }, [{ load_g: 15_000, reps: 8 }], 'assisted')).toBeNull()
  })
  it('ignores a zero-rep set', () => {
    expect(detectPr({ load_g: 100_000, reps: 0 }, prev, 'weight')).toBeNull()
  })
})
