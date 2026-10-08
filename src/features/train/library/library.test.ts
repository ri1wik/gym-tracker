import { describe, expect, it } from 'vitest'
import { EXERCISES, MACHINES, exercisesForMachine, getExercise } from './data'
import { normalise, scoreMatch, searchItems } from './search'
import { swapCandidates, swapList } from './swap'
import { summarisePerformance } from './store'
import { DEFAULT_GYM_MACHINE_IDS } from '../../../data/library/machine-index'

describe('search', () => {
  const items = [
    { name: 'Lat pulldown', aliases: ['pulldown', 'lat pull'], tags: ['back'] },
    { name: 'Pec deck', aliases: ['butterfly', 'chest fly machine'], tags: ['chest'] },
    { name: 'Leg press', aliases: ['sled press'], tags: ['quads'] },
  ]
  it('normalises case, punctuation and accents', () => {
    expect(normalise('  Lat-Pull  DOWN!')).toBe('lat pull down')
  })
  it('ranks exact, alias, prefix and tag matches in that order', () => {
    expect(scoreMatch(items[0], 'lat pulldown')).toBe(100)
    expect(scoreMatch(items[0], 'pulldown')).toBe(90)
    expect(scoreMatch(items[0], 'lat')).toBe(80)
    expect(scoreMatch(items[0], 'back')).toBe(30)
    expect(scoreMatch(items[0], 'zzz')).toBe(0)
  })
  it('finds by alias and by body part, and keeps order for an empty query', () => {
    expect(searchItems(items, 'butterfly', (x) => x)[0].name).toBe('Pec deck')
    expect(searchItems(items, 'quads', (x) => x).map((x) => x.name)).toEqual(['Leg press'])
    expect(searchItems(items, '', (x) => x)).toHaveLength(3)
  })
})

describe('library data', () => {
  it('always has 85 exercises and 45 machines, with or without the content files', () => {
    expect(EXERCISES).toHaveLength(85)
    expect(MACHINES).toHaveLength(45)
    for (const e of EXERCISES) {
      expect(Array.isArray(e.howTo), e.id).toBe(true)
      expect(Array.isArray(e.aliases), e.id).toBe(true)
    }
    for (const m of MACHINES) if (!m.photo) expect(m.placeholder, m.id).toBe(true)
  })
  it('every machine in the index is reachable from at least its own exercises or stands alone', () => {
    const withExercises = MACHINES.filter((m) => exercisesForMachine(m).length > 0)
    expect(withExercises.length).toBeGreaterThan(20)
  })
})

describe('swap candidates', () => {
  const gym = new Set(DEFAULT_GYM_MACHINE_IDS)
  it('every exercise has a substitute somewhere in the default gym, or is a known lone move', () => {
    const lone = EXERCISES.filter((e) => swapCandidates(e, EXERCISES, gym).length === 0).map((e) => e.id)
    expect(lone.length).toBeLessThan(25)
  })
  it('a move with no pattern twin falls back to the same muscle, so no page shows an empty list', () => {
    for (const e of EXERCISES) expect(swapList(e, EXERCISES, gym).kind, e.id).not.toBe('none')
    const ext = getExercise('leg-extension')!
    expect(swapList(ext, EXERCISES, gym).kind).toBe('muscle')
  })
  it('keeps the pattern, shares a primary muscle and never offers the same machine', () => {
    const bench = getExercise('barbell-bench-press')!
    const list = swapCandidates(bench, EXERCISES, gym)
    expect(list.length).toBeGreaterThan(0)
    for (const c of list) {
      expect(c.id).not.toBe(bench.id)
      expect(c.movementPattern).toBe(bench.movementPattern)
      expect(c.primaryMuscles.some((m) => bench.primaryMuscles.includes(m))).toBe(true)
      expect(c.machineId === bench.machineId).toBe(false)
    }
  })
  it('drops candidates whose machine the gym lacks', () => {
    const bench = getExercise('barbell-bench-press')!
    const noMachines = new Set<string>()
    for (const c of swapCandidates(bench, EXERCISES, noMachines)) expect(c.machineId).toBeUndefined()
  })
})

describe('last performance', () => {
  const base = { user_id: 'u', created_at: '', updated_at: '', version: 1, deleted_at: null, dirty: 0 as const, exercise_id: 'x', kind: 'working' as const, target_reps: null, target_load_g: null, assist_g: 0, rpe: null, rest_s: null, substituted_for: null }
  const set = (id: string, workout: string, idx: number, load: number, reps: number | null, at: string | null, kind: 'working' | 'warmup' = 'working') =>
    ({ ...base, id, workout_id: workout, set_index: idx, load_g: load, reps, completed_at: at, kind })
  it('returns the newest session, ignores warm-ups, unfinished and deleted sets, and finds the best set', () => {
    const sets = [
      set('a', 'w1', 0, 60000, 8, '2026-09-01T10:00:00Z'),
      set('b', 'w2', 1, 70000, 6, '2026-09-08T10:05:00Z'),
      set('c', 'w2', 0, 40000, 10, '2026-09-08T10:00:00Z', 'warmup'),
      set('d', 'w2', 2, 70000, 7, '2026-09-08T10:09:00Z'),
      set('e', 'w2', 3, 80000, null, null),
      { ...set('f', 'w2', 4, 90000, 5, '2026-09-08T10:12:00Z'), deleted_at: '2026-09-09T00:00:00Z' },
    ]
    const out = summarisePerformance(sets, (w) => (w === 'w2' ? '2026-09-08' : '2026-09-01'))!
    expect(out.dateKey).toBe('2026-09-08')
    expect(out.sets.map((s) => s.reps)).toEqual([6, 7])
    expect(out.best).toEqual({ reps: 7, load_g: 70000, assist_g: 0 })
  })
  it('is null when nothing was finished', () => {
    expect(summarisePerformance([set('a', 'w1', 0, 1000, null, null)], () => '2026-09-01')).toBeNull()
  })
})
