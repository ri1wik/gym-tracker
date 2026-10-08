import { describe, expect, it } from 'vitest'
import { searchExercises, type SearchEntry } from './search'

const entries: SearchEntry[] = [
  { id: 'barbell-bench-press', name: 'Barbell bench press', bodyPart: 'chest', aliases: ['bench'] },
  { id: 'lat-pulldown', name: 'Lat pulldown', bodyPart: 'back', aliases: ['pulldown'] },
  { id: 'romanian-deadlift', name: 'Romanian deadlift', bodyPart: 'hamstrings', aliases: ['RDL'] },
  { id: 'deadlift', name: 'Deadlift', bodyPart: 'back', aliases: [] },
  { id: 'straight-arm-pulldown', name: 'Straight-arm pulldown', bodyPart: 'back', aliases: [] },
]

describe('searchExercises', () => {
  it('lists recents first on an empty query, then the rest in library order', () => {
    const r = searchExercises('', entries, ['deadlift', 'lat-pulldown'])
    expect(r.map((e) => e.id)).toEqual(['deadlift', 'lat-pulldown', 'barbell-bench-press', 'romanian-deadlift', 'straight-arm-pulldown'])
    expect(r[0].recent).toBe(true)
    expect(r[2].recent).toBe(false)
  })
  it('finds by alias, case-insensitively', () => {
    expect(searchExercises('rdl', entries, []).map((e) => e.id)).toEqual(['romanian-deadlift'])
    expect(searchExercises('Bench', entries, [])[0].id).toBe('barbell-bench-press')
  })
  it('ranks an exact alias above a word match and recents above the rest at equal score', () => {
    const r = searchExercises('pulldown', entries, ['straight-arm-pulldown'])
    expect(r.map((e) => e.id)).toEqual(['lat-pulldown', 'straight-arm-pulldown'])
    const r2 = searchExercises('deadlift', entries, ['romanian-deadlift'])
    expect(r2[0].id).toBe('deadlift')
    expect(r2[1].id).toBe('romanian-deadlift')
  })
  it('matches a body part behind the name matches', () => {
    const r = searchExercises('back', entries, [])
    expect(r.map((e) => e.id)).toEqual(['lat-pulldown', 'deadlift', 'straight-arm-pulldown'])
  })
  it('returns nothing for a query that matches nothing', () => {
    expect(searchExercises('zzz', entries, [])).toEqual([])
  })
})
