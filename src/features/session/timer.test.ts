import { beforeEach, describe, expect, it } from 'vitest'
import { adjustRest, clearRest, readRest, remainingS, startRest, REST_KEY } from './timer'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})

describe('rest timer store', () => {
  it('stores an end instant so the remaining time survives a reload', () => {
    startRest('w1', 120, 1_000_000)
    const s = readRest()
    expect(s?.endAt).toBe(1_120_000)
    expect(s?.totalS).toBe(120)
    expect(remainingS(s, 1_000_000)).toBe(120)
    expect(remainingS(s, 1_090_500)).toBe(30)
    expect(remainingS(s, 1_200_000)).toBe(0)
    expect(JSON.parse(localStorage.getItem(REST_KEY) ?? '{}').workoutId).toBe('w1')
  })
  it('shifts the end by 15 s either way and never into the past', () => {
    startRest('w1', 60, 1_000_000)
    adjustRest(15, 1_000_000)
    expect(readRest()?.endAt).toBe(1_075_000)
    expect(readRest()?.totalS).toBe(75)
    adjustRest(-15, 1_000_000)
    adjustRest(-15, 1_000_000)
    adjustRest(-15, 1_050_000)
    expect(readRest()?.endAt).toBe(1_050_000)
  })
  it('skip clears it and a zero rest stores nothing', () => {
    startRest('w1', 60)
    clearRest()
    expect(readRest()).toBeNull()
    startRest('w1', 0)
    expect(readRest()).toBeNull()
  })
})
