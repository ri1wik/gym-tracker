import { describe, expect, it } from 'vitest'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { incrementFor, stepLoad } from './increments'

describe('incrementFor', () => {
  it('steps a barbell by 2.5 kg and the heavy lifts by 5 kg from 80 kg', () => {
    expect(incrementFor(EXERCISES_BY_ID['barbell-bench-press'], 60_000)).toBe(2500)
    expect(incrementFor(EXERCISES_BY_ID['back-squat'], 60_000)).toBe(2500)
    // The content's 5 kg step for the squat applies only from 80 kg.
    expect(incrementFor(EXERCISES_BY_ID['back-squat'], 60_000, { incrementG: 5000 })).toBe(2500)
    expect(incrementFor(EXERCISES_BY_ID['back-squat'], 80_000, { incrementG: 5000 })).toBe(5000)
    expect(incrementFor(EXERCISES_BY_ID['back-squat'], 80_000)).toBe(5000)
    expect(incrementFor(EXERCISES_BY_ID['deadlift'], 100_000)).toBe(5000)
  })
  it('steps machines by one stack step and honours a content increment', () => {
    expect(incrementFor(EXERCISES_BY_ID['lat-pulldown'], 40_000)).toBe(5000)
    expect(incrementFor(EXERCISES_BY_ID['lat-pulldown'], 40_000, { incrementG: 2500 })).toBe(2500)
  })
})

describe('stepLoad', () => {
  it('walks the dumbbell ladder one rung at a time', () => {
    const db = EXERCISES_BY_ID['incline-dumbbell-press']
    expect(stepLoad(db, 20_000, 1)).toBe(22_500)
    expect(stepLoad(db, 20_000, -1)).toBe(17_500)
    expect(stepLoad(db, 7500, 1)).toBe(10_000)
    expect(stepLoad(db, 1000, -1)).toBe(1000)
    expect(stepLoad(db, 50_000, 1)).toBe(50_000)
    expect(stepLoad(db, 21_000, 1)).toBe(22_500)
    expect(stepLoad(db, 21_000, -1)).toBe(20_000)
  })
  it('never goes below zero and crosses the heavy threshold both ways', () => {
    const squat = EXERCISES_BY_ID['back-squat']
    expect(stepLoad(squat, 77_500, 1)).toBe(80_000)
    expect(stepLoad(squat, 80_000, 1)).toBe(85_000)
    expect(stepLoad(squat, 80_000, -1)).toBe(77_500)
    expect(stepLoad(EXERCISES_BY_ID['cable-pushdown'], 0, -1)).toBe(0)
  })
  it('steps weighted bodyweight by 2.5 kg and assistance by a stack step', () => {
    expect(stepLoad(EXERCISES_BY_ID['pull-up'], 0, 1)).toBe(2500)
    expect(stepLoad(EXERCISES_BY_ID['assisted-pull-up'], 20_000, -1)).toBe(15_000)
  })
})
