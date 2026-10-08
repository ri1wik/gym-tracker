import { describe, expect, it } from 'vitest'
import { dateLabelOf } from './format'

describe('dateLabelOf', () => {
  it('names the weekday and month from the day key and the clock from the start time', () => {
    const d = new Date(2026, 9, 8, 10, 2)
    expect(dateLabelOf('2026-10-08', d.toISOString())).toBe('Thu 8 Oct, 10:02')
  })
})
