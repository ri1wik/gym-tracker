import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  loadVocab,
  validateExercisesJson,
  validateIndex,
  validateLibrary,
  validateMachinesJson,
  validateTemplatesJson,
} from '../../../scripts/validate-library.mjs'
import { EXERCISE_INDEX } from './exercise-index'
import { MACHINE_INDEX } from './machine-index'

const vocab = await loadVocab()

function fullExercise(id: string) {
  const e = EXERCISE_INDEX.find((x) => x.id === id)!
  return {
    ...e,
    aliases: [],
    cue: 'A cue.',
    howTo: ['one', 'two', 'three', 'four'],
    mistakes: ['a', 'b', 'c'],
    repMin: 8,
    repMax: 12,
    incrementG: 2500,
    restS: 90,
    media: null,
  }
}

function everyExercise() {
  return EXERCISE_INDEX.map((e) => fullExercise(e.id))
}

function everyMachine() {
  return MACHINE_INDEX.map((m) => ({ ...m, aliases: [], primaryMuscles: [], secondaryMuscles: [], setup: [], tips: [], photo: null, placeholder: true }))
}

describe('validator on whatever files exist', () => {
  it('passes on the committed library', async () => {
    const { errors } = await validateLibrary()
    expect(errors).toEqual([])
  })
  it('runs from the command line with the same result', () => {
    const script = fileURLToPath(new URL('../../../scripts/validate-library.mjs', import.meta.url))
    const out = execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    expect(out).toContain('library ok')
  })
})

describe('index rules', () => {
  it('the committed index is clean', () => {
    expect(validateIndex(vocab)).toEqual([])
  })
  it('rejects an unknown muscle, a third secondary and an unknown machine', () => {
    const bad = {
      ...vocab,
      exerciseIndex: [
        { ...EXERCISE_INDEX[0], primaryMuscles: ['pecs'] },
        { ...EXERCISE_INDEX[1], secondaryMuscles: ['triceps', 'front_delts', 'abs'] },
        { ...EXERCISE_INDEX[2], machineId: 'nope' },
        ...EXERCISE_INDEX.slice(3),
      ],
    }
    const errors = validateIndex(bad)
    expect(errors.some((e: string) => e.includes('unknown primary muscle pecs'))).toBe(true)
    expect(errors.some((e: string) => e.includes('more than two secondaries'))).toBe(true)
    expect(errors.some((e: string) => e.includes('unknown machine id nope'))).toBe(true)
  })
  it('rejects a duplicate id and a wrong count', () => {
    const errors = validateIndex({ ...vocab, exerciseIndex: [...EXERCISE_INDEX, EXERCISE_INDEX[0]] })
    expect(errors.some((e: string) => e.includes('duplicate id'))).toBe(true)
    expect(errors.some((e: string) => e.includes('expected 85'))).toBe(true)
  })
})

describe('exercises.json rules', () => {
  it('accepts a complete content file', () => {
    const rows = everyExercise()
    expect(validateExercisesJson(rows, vocab, JSON.stringify(rows))).toEqual([])
  })
  it('rejects a how-to that is not 4 lines and mistakes that are not 3', () => {
    const rows = everyExercise()
    rows[0].howTo = ['one', 'two', 'three']
    rows[1].mistakes = ['a', 'b']
    const errors = validateExercisesJson(rows, vocab, JSON.stringify(rows))
    expect(errors).toContain(`exercises.json ${rows[0].id}: how-to must be exactly 4 lines`)
    expect(errors).toContain(`exercises.json ${rows[1].id}: mistakes must be exactly 3`)
  })
  it('rejects a structural field changed away from the index', () => {
    const rows = everyExercise()
    rows[0].bodyPart = 'back'
    rows[1].secondaryMuscles = ['abs']
    const errors = validateExercisesJson(rows, vocab, JSON.stringify(rows))
    expect(errors.some((e: string) => e.includes('bodyPart differs from the index'))).toBe(true)
    expect(errors.some((e: string) => e.includes('secondaryMuscles differ from the index'))).toBe(true)
  })
  it('rejects a missing exercise, an unknown one and an em dash', () => {
    const rows = everyExercise().slice(1)
    rows.push({ ...fullExercise('plank'), id: 'ghost' })
    const text = JSON.stringify(rows, null, 1).replace('"one"', `"one ${String.fromCharCode(0x2014)} two"`)
    const errors = validateExercisesJson(JSON.parse(text), vocab, text)
    expect(errors.some((e: string) => e.includes('missing barbell-bench-press'))).toBe(true)
    expect(errors.some((e: string) => e.includes('ghost: not in exercise-index'))).toBe(true)
    expect(errors.some((e: string) => e.includes('em dash'))).toBe(true)
  })
})

describe('machines.json rules', () => {
  it('accepts placeholders', () => {
    const rows = everyMachine()
    expect(validateMachinesJson(rows, vocab, JSON.stringify(rows))).toEqual([])
  })
  it('rejects a machine with neither photo nor placeholder and a bad setup label', () => {
    const rows = everyMachine()
    rows[0].placeholder = false
    rows[1].setup = [{ label: 'Seat height', text: 'x' }] as never
    const errors = validateMachinesJson(rows, vocab, JSON.stringify(rows))
    expect(errors).toContain(`machines.json ${rows[0].id}: neither photo nor placeholder flag`)
    expect(errors.some((e: string) => e.includes('bad setup step'))).toBe(true)
  })
})

describe('templates.json rules', () => {
  const ok = [
    {
      key: 'full_body_3',
      name: 'Full body',
      split: 'full_body_3',
      days_per_week: 3,
      days: [
        { key: 'a', name: 'A', cardio_note: null, items: [{ exercise_id: 'back-squat', sets: 3, rep_min: 6, rep_max: 10, rest_s: 150 }] },
      ],
    },
  ]
  it('accepts a template that references known exercises', () => {
    expect(validateTemplatesJson(ok, vocab, JSON.stringify(ok))).toEqual([])
  })
  it('rejects an unknown exercise and an unknown split', () => {
    const bad = JSON.parse(JSON.stringify(ok))
    bad[0].days[0].items[0].exercise_id = 'leg-day'
    bad[0].split = 'bro'
    const errors = validateTemplatesJson(bad, vocab, JSON.stringify(bad))
    expect(errors.some((e: string) => e.includes('unknown exercise leg-day'))).toBe(true)
    expect(errors.some((e: string) => e.includes('unknown split bro'))).toBe(true)
  })
})
