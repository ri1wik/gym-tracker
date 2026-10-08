#!/usr/bin/env node
// Library validator. Run with: node scripts/validate-library.mjs
//
// Loads src/data/library/exercises.json, machines.json and templates.json
// when they exist and fails on: an exercise with an unknown muscle, pattern,
// equipment or machine id; more than two secondaries; a template item that
// references an unknown exercise; a how-to that is not exactly 4 lines;
// mistakes that are not exactly 3; a machine with neither a photo nor the
// placeholder flag; duplicate ids; any em dash or en dash; and any
// structural field in exercises.json or machines.json that disagrees with
// the index (the content builders add prose, never change facts).
//
// The vocabularies come straight from the TypeScript sources (Node strips
// the types at load time; those files use explicit .ts import extensions
// for exactly this reason).

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const LIBRARY_DIR = path.resolve(HERE, '../src/data/library')

const EM_DASH = '—'
const EN_DASH = '–'

const SETUP_LABELS = new Set(['Seat', 'Pad', 'Grip', 'Pin', 'Foot plate', 'Other'])

export async function loadVocab() {
  const types = await import('../src/domain/types.ts')
  const { EXERCISE_INDEX, EXERCISE_COUNT } = await import('../src/data/library/exercise-index.ts')
  const { MACHINE_INDEX } = await import('../src/data/library/machine-index.ts')
  return {
    bodyParts: new Set(types.BODY_PARTS),
    muscles: new Set(types.MUSCLES),
    patterns: new Set(types.MOVEMENT_PATTERNS),
    equipment: new Set(types.EQUIPMENT),
    families: new Set(types.EQUIPMENT_FAMILIES),
    familyOf: types.EQUIPMENT_FAMILY_OF,
    loadTypes: new Set(types.LOAD_TYPES),
    barTypes: new Set(types.BAR_TYPES),
    machineCategories: new Set(types.MACHINE_CATEGORIES),
    splits: new Set(types.SPLITS),
    exerciseIndex: EXERCISE_INDEX,
    exerciseCount: EXERCISE_COUNT,
    machineIndex: MACHINE_INDEX,
  }
}

async function readJsonIfExists(file) {
  if (!existsSync(file)) return null
  const text = await readFile(file, 'utf8')
  return { text, data: JSON.parse(text) }
}

function dashCheck(name, text, errors) {
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line.includes(EM_DASH)) errors.push(`${name}:${i + 1}: em dash`)
    if (line.includes(EN_DASH)) errors.push(`${name}:${i + 1}: en dash`)
  })
}

function duplicateIds(rows, name, errors) {
  const seen = new Set()
  for (const r of rows) {
    if (typeof r.id !== 'string' || r.id === '') errors.push(`${name}: a row has no id`)
    else if (seen.has(r.id)) errors.push(`${name}: duplicate id ${r.id}`)
    seen.add(r.id)
  }
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])
}

/** Structural checks on one exercise entry (index or json). */
function checkExerciseShape(e, vocab, machineIds, where, errors) {
  if (!vocab.bodyParts.has(e.bodyPart)) errors.push(`${where}: unknown body part ${e.bodyPart}`)
  for (const m of e.primaryMuscles ?? []) if (!vocab.muscles.has(m)) errors.push(`${where}: unknown primary muscle ${m}`)
  for (const m of e.secondaryMuscles ?? []) if (!vocab.muscles.has(m)) errors.push(`${where}: unknown secondary muscle ${m}`)
  if (!Array.isArray(e.primaryMuscles) || e.primaryMuscles.length === 0) errors.push(`${where}: needs at least one primary muscle`)
  if ((e.secondaryMuscles ?? []).length > 2) errors.push(`${where}: more than two secondaries`)
  if (!vocab.patterns.has(e.movementPattern)) errors.push(`${where}: unknown pattern ${e.movementPattern}`)
  if (!vocab.equipment.has(e.equipment)) errors.push(`${where}: unknown equipment ${e.equipment}`)
  else if (e.equipmentFamily !== vocab.familyOf[e.equipment]) errors.push(`${where}: equipmentFamily ${e.equipmentFamily} does not match ${e.equipment}`)
  if (!vocab.loadTypes.has(e.loadType)) errors.push(`${where}: unknown load type ${e.loadType}`)
  if (e.machineId !== undefined && !machineIds.has(e.machineId)) errors.push(`${where}: unknown machine id ${e.machineId}`)
  if (e.barType !== undefined && !vocab.barTypes.has(e.barType)) errors.push(`${where}: unknown bar type ${e.barType}`)
  if (vocab.familyOf[e.equipment] === 'barbell' && e.barType === undefined) errors.push(`${where}: barbell move without barType`)
  if (['machine', 'cable', 'smith'].includes(vocab.familyOf[e.equipment]) && e.machineId === undefined) errors.push(`${where}: machine move without machineId`)
  if (e.loadType === 'assisted' && e.equipment !== 'selectorised_machine') errors.push(`${where}: assisted load on non-selectorised equipment`)
}

const STRUCTURAL_FIELDS = ['name', 'bodyPart', 'equipment', 'equipmentFamily', 'movementPattern', 'loadType', 'isCompound', 'isUnilateral', 'barType', 'machineId', 'isRecompPriority']

export function validateIndex(vocab) {
  const errors = []
  const machineIds = new Set(vocab.machineIndex.map((m) => m.id))
  duplicateIds(vocab.exerciseIndex, 'exercise-index', errors)
  duplicateIds(vocab.machineIndex, 'machine-index', errors)
  if (vocab.exerciseIndex.length !== vocab.exerciseCount) errors.push(`exercise-index: expected ${vocab.exerciseCount} exercises, found ${vocab.exerciseIndex.length}`)
  for (const m of vocab.machineIndex) {
    if (!vocab.machineCategories.has(m.category)) errors.push(`machine-index ${m.id}: unknown category ${m.category}`)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id)) errors.push(`machine-index: id ${m.id} is not a kebab slug`)
  }
  const perPart = {}
  const priorityPerPart = {}
  for (const e of vocab.exerciseIndex) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) errors.push(`exercise-index: id ${e.id} is not a kebab slug`)
    checkExerciseShape(e, vocab, machineIds, `exercise-index ${e.id}`, errors)
    perPart[e.bodyPart] = (perPart[e.bodyPart] ?? 0) + 1
    if (e.isRecompPriority) priorityPerPart[e.bodyPart] = (priorityPerPart[e.bodyPart] ?? 0) + 1
  }
  for (const part of vocab.bodyParts) {
    if (!perPart[part]) errors.push(`exercise-index: body part ${part} has no exercises`)
    const p = priorityPerPart[part] ?? 0
    if (p < 2 || p > 3) errors.push(`exercise-index: body part ${part} has ${p} priority exercises, needs 2 or 3`)
  }
  // The audited secondaries.
  const byId = Object.fromEntries(vocab.exerciseIndex.map((e) => [e.id, e]))
  if (byId['back-squat']?.secondaryMuscles.includes('hamstrings')) errors.push('exercise-index: back squat must not credit hamstrings')
  if (byId['overhead-press']?.secondaryMuscles.includes('upper_chest')) errors.push('exercise-index: overhead press must not credit upper chest')
  return errors
}

export function validateExercisesJson(rows, vocab, text) {
  const errors = []
  if (!Array.isArray(rows)) return ['exercises.json: must be an array']
  dashCheck('exercises.json', text, errors)
  duplicateIds(rows, 'exercises.json', errors)
  const machineIds = new Set(vocab.machineIndex.map((m) => m.id))
  const index = Object.fromEntries(vocab.exerciseIndex.map((e) => [e.id, e]))
  const seen = new Set()
  for (const e of rows) {
    const where = `exercises.json ${e.id}`
    seen.add(e.id)
    const idx = index[e.id]
    if (!idx) {
      errors.push(`${where}: not in exercise-index.ts`)
      continue
    }
    checkExerciseShape(e, vocab, machineIds, where, errors)
    for (const f of STRUCTURAL_FIELDS) {
      if (e[f] !== idx[f]) errors.push(`${where}: ${f} differs from the index (${JSON.stringify(e[f])} vs ${JSON.stringify(idx[f])})`)
    }
    if (!sameArray(e.primaryMuscles, idx.primaryMuscles)) errors.push(`${where}: primaryMuscles differ from the index`)
    if (!sameArray(e.secondaryMuscles, idx.secondaryMuscles)) errors.push(`${where}: secondaryMuscles differ from the index`)
    if (!Array.isArray(e.aliases)) errors.push(`${where}: aliases must be an array`)
    if (typeof e.cue !== 'string' || e.cue.trim() === '') errors.push(`${where}: cue missing`)
    if (!Array.isArray(e.howTo) || e.howTo.length !== 4) errors.push(`${where}: how-to must be exactly 4 lines`)
    else if (e.howTo.some((l) => typeof l !== 'string' || l.trim() === '')) errors.push(`${where}: how-to has an empty line`)
    if (!Array.isArray(e.mistakes) || e.mistakes.length !== 3) errors.push(`${where}: mistakes must be exactly 3`)
    else if (e.mistakes.some((l) => typeof l !== 'string' || l.trim() === '')) errors.push(`${where}: mistakes has an empty line`)
    if (!Number.isInteger(e.repMin) || !Number.isInteger(e.repMax) || e.repMin < 1 || e.repMax < e.repMin) errors.push(`${where}: bad rep range`)
    if (!Number.isInteger(e.incrementG) || e.incrementG < 0) errors.push(`${where}: incrementG must be a non-negative integer of grams`)
    if (!Number.isInteger(e.restS) || e.restS < 0) errors.push(`${where}: restS must be a non-negative integer of seconds`)
    if (e.media !== null && e.media !== undefined) {
      const m = e.media
      if (!['repdb', 'own'].includes(m.source)) errors.push(`${where}: media source must be repdb or own`)
      for (const k of ['sourceId', 'start', 'peak']) if (typeof m[k] !== 'string' || m[k] === '') errors.push(`${where}: media.${k} missing`)
    }
  }
  for (const e of vocab.exerciseIndex) if (!seen.has(e.id)) errors.push(`exercises.json: missing ${e.id} from the index`)
  return errors
}

export function validateMachinesJson(rows, vocab, text) {
  const errors = []
  if (!Array.isArray(rows)) return ['machines.json: must be an array']
  dashCheck('machines.json', text, errors)
  duplicateIds(rows, 'machines.json', errors)
  const index = Object.fromEntries(vocab.machineIndex.map((m) => [m.id, m]))
  const seen = new Set()
  for (const m of rows) {
    const where = `machines.json ${m.id}`
    seen.add(m.id)
    const idx = index[m.id]
    if (!idx) {
      errors.push(`${where}: not in machine-index.ts`)
      continue
    }
    if (m.name !== idx.name) errors.push(`${where}: name differs from the index`)
    if (m.category !== idx.category) errors.push(`${where}: category differs from the index`)
    if (!Array.isArray(m.aliases)) errors.push(`${where}: aliases must be an array`)
    for (const mu of m.primaryMuscles ?? []) if (!vocab.muscles.has(mu)) errors.push(`${where}: unknown primary muscle ${mu}`)
    for (const mu of m.secondaryMuscles ?? []) if (!vocab.muscles.has(mu)) errors.push(`${where}: unknown secondary muscle ${mu}`)
    if (!Array.isArray(m.setup)) errors.push(`${where}: setup must be an array`)
    else for (const s of m.setup) if (!SETUP_LABELS.has(s.label) || typeof s.text !== 'string' || s.text.trim() === '') errors.push(`${where}: bad setup step ${JSON.stringify(s)}`)
    if (!Array.isArray(m.tips)) errors.push(`${where}: tips must be an array`)
    const hasPhoto = m.photo !== null && m.photo !== undefined
    if (!hasPhoto && m.placeholder !== true) errors.push(`${where}: neither photo nor placeholder flag`)
    if (hasPhoto) {
      const p = m.photo
      if (typeof p.src !== 'string' || !Number.isInteger(p.width) || !Number.isInteger(p.height) || !['own', 'user'].includes(p.source)) errors.push(`${where}: bad photo record`)
    }
  }
  for (const m of vocab.machineIndex) if (!seen.has(m.id)) errors.push(`machines.json: missing ${m.id} from the index`)
  return errors
}

export function validateTemplatesJson(rows, vocab, text) {
  const errors = []
  if (!Array.isArray(rows)) return ['templates.json: must be an array']
  dashCheck('templates.json', text, errors)
  const exerciseIds = new Set(vocab.exerciseIndex.map((e) => e.id))
  const keys = new Set()
  for (const t of rows) {
    const where = `templates.json ${t.key}`
    if (typeof t.key !== 'string' || t.key === '') errors.push('templates.json: a template has no key')
    else if (keys.has(t.key)) errors.push(`templates.json: duplicate key ${t.key}`)
    keys.add(t.key)
    if (!vocab.splits.has(t.split)) errors.push(`${where}: unknown split ${t.split}`)
    if (!Number.isInteger(t.days_per_week) || t.days_per_week < 2 || t.days_per_week > 6) errors.push(`${where}: days_per_week must be 2 to 6`)
    if (!Array.isArray(t.days) || t.days.length === 0) {
      errors.push(`${where}: needs days`)
      continue
    }
    const dayKeys = new Set()
    for (const d of t.days) {
      const dw = `${where} day ${d.key}`
      if (typeof d.key !== 'string' || d.key === '') errors.push(`${where}: a day has no key`)
      else if (dayKeys.has(d.key)) errors.push(`${where}: duplicate day key ${d.key}`)
      dayKeys.add(d.key)
      if (!Array.isArray(d.items) || d.items.length === 0) {
        errors.push(`${dw}: needs items`)
        continue
      }
      for (const it of d.items) {
        if (!exerciseIds.has(it.exercise_id)) errors.push(`${dw}: unknown exercise ${it.exercise_id}`)
        if (!Number.isInteger(it.sets) || it.sets < 1) errors.push(`${dw} ${it.exercise_id}: sets must be a positive integer`)
        if (!Number.isInteger(it.rep_min) || !Number.isInteger(it.rep_max) || it.rep_min < 1 || it.rep_max < it.rep_min) errors.push(`${dw} ${it.exercise_id}: bad rep range`)
        if (!Number.isInteger(it.rest_s) || it.rest_s < 0) errors.push(`${dw} ${it.exercise_id}: rest_s must be seconds`)
      }
    }
  }
  return errors
}

/**
 * Validate whatever files exist under `dir`. Returns the list of errors;
 * empty means the library is sound. `found` lists which files were checked.
 */
export async function validateLibrary(dir = LIBRARY_DIR) {
  const vocab = await loadVocab()
  const errors = validateIndex(vocab)
  const found = []
  const exercises = await readJsonIfExists(path.join(dir, 'exercises.json'))
  if (exercises) {
    found.push('exercises.json')
    errors.push(...validateExercisesJson(exercises.data, vocab, exercises.text))
  }
  const machines = await readJsonIfExists(path.join(dir, 'machines.json'))
  if (machines) {
    found.push('machines.json')
    errors.push(...validateMachinesJson(machines.data, vocab, machines.text))
  }
  const templates = await readJsonIfExists(path.join(dir, 'templates.json'))
  if (templates) {
    found.push('templates.json')
    errors.push(...validateTemplatesJson(templates.data, vocab, templates.text))
  }
  return { errors, found }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const { errors, found } = await validateLibrary()
  const checked = found.length ? found.join(', ') : 'no json files yet'
  if (errors.length) {
    console.error(`library: ${errors.length} problem(s) (checked index plus ${checked})`)
    for (const e of errors) console.error(`  ${e}`)
    process.exit(1)
  }
  console.log(`library ok: index plus ${checked}`)
}
