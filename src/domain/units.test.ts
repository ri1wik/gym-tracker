import { describe, expect, it } from 'vitest'
import { cmToMm, formatClock, formatKg, gToKg, kgToG, kmToM, mmToCm, roundToIncrement, roundToLadder } from './units'

describe('conversions', () => {
  it('kg and g', () => {
    expect(kgToG(82.5)).toBe(82_500)
    expect(kgToG(0.1)).toBe(100)
    expect(gToKg(82_500)).toBe(82.5)
  })
  it('cm and mm, km and m', () => {
    expect(cmToMm(85.5)).toBe(855)
    expect(mmToCm(855)).toBe(85.5)
    expect(kmToM(5.25)).toBe(5250)
  })
  it('floating point does not leak into storage', () => {
    expect(kgToG(0.3)).toBe(300)
    expect(kgToG(27.5)).toBe(27_500)
  })
})

describe('roundToIncrement', () => {
  it('nearest with half up', () => {
    expect(roundToIncrement(31_500, 2500)).toBe(32_500)
    expect(roundToIncrement(42_000, 2500)).toBe(42_500)
    expect(roundToIncrement(128_800, 2500)).toBe(130_000)
    expect(roundToIncrement(21_000, 2500)).toBe(20_000)
    expect(roundToIncrement(6250, 2500)).toBe(7500)
  })
  it('down and up', () => {
    expect(roundToIncrement(27_540, 2500, 'down')).toBe(27_500)
    expect(roundToIncrement(27_540, 2500, 'up')).toBe(30_000)
    expect(roundToIncrement(16_200, 2500, 'down')).toBe(15_000)
  })
  it('exact multiples are stable in every direction', () => {
    expect(roundToIncrement(80_000, 2500, 'down')).toBe(80_000)
    expect(roundToIncrement(80_000, 2500, 'up')).toBe(80_000)
  })
})

describe('roundToLadder', () => {
  const ladder = [10_000, 12_500, 15_000, 17_500, 20_000]
  it('nearest with ties to the lower rung', () => {
    expect(roundToLadder(13_750, ladder)).toBe(12_500)
    expect(roundToLadder(14_000, ladder)).toBe(15_000)
    expect(roundToLadder(12_500, ladder)).toBe(12_500)
  })
  it('clamps to the ends', () => {
    expect(roundToLadder(5000, ladder)).toBe(10_000)
    expect(roundToLadder(50_000, ladder)).toBe(20_000)
  })
  it('down and up pick the neighbouring rung', () => {
    expect(roundToLadder(27_540, [25_000, 27_500, 30_000], 'down')).toBe(27_500)
    expect(roundToLadder(14_900, ladder, 'down')).toBe(12_500)
    expect(roundToLadder(12_600, ladder, 'up')).toBe(15_000)
  })
})

describe('formatting', () => {
  it('formatKg trims zeros', () => {
    expect(formatKg(82_500)).toBe('82.5')
    expect(formatKg(80_000)).toBe('80')
    expect(formatKg(27_500, 1)).toBe('27.5')
  })
  it('formatClock pads seconds', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(-3)).toBe('0:00')
  })
})
