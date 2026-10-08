import { describe, expect, it } from 'vitest'
import { parseCmToMm, parseDecimal, parseInteger, parseKgToG } from './parse'

describe('parseDecimal', () => {
  it('accepts the four forms the brief names', () => {
    expect(parseDecimal('80,5')).toBe(80.5)
    expect(parseDecimal('80.5')).toBe(80.5)
    expect(parseDecimal(' 80 ')).toBe(80)
    expect(parseDecimal('8e1')).toBe(80)
  })
  it('accepts leading separators, signs and inner spaces', () => {
    expect(parseDecimal('.5')).toBe(0.5)
    expect(parseDecimal(',5')).toBe(0.5)
    expect(parseDecimal('-2')).toBe(-2)
    expect(parseDecimal('1 000')).toBe(1000)
    expect(parseDecimal('80.')).toBe(80)
  })
  it('rejects junk', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('   ')).toBeNull()
    expect(parseDecimal(null)).toBeNull()
    expect(parseDecimal(undefined)).toBeNull()
    expect(parseDecimal('80,5,1')).toBeNull()
    expect(parseDecimal('80.5.1')).toBeNull()
    expect(parseDecimal('80kg')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('Infinity')).toBeNull()
    expect(parseDecimal('0x10')).toBeNull()
  })
})

describe('typed parsers', () => {
  it('kg to grams and cm to mm', () => {
    expect(parseKgToG('82,5')).toBe(82_500)
    expect(parseKgToG('0.1')).toBe(100)
    expect(parseCmToMm('85,5')).toBe(855)
    expect(parseKgToG('x')).toBeNull()
  })
  it('integers only for reps', () => {
    expect(parseInteger('8')).toBe(8)
    expect(parseInteger('8,5')).toBeNull()
    expect(parseInteger('1e1')).toBe(10)
  })
})
