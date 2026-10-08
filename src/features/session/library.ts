// Exercise and machine prose for the session screen. The content slices ship
// exercises.json and machines.json; this module reads them when present and
// falls back to defaults derived from the index so the screen renders in a
// tree where the JSON has not landed yet. import.meta.glob resolves to an
// empty record when the file is absent, which is the whole trick.

import type { Exercise, ExerciseIndexEntry, Machine } from '../../domain/types'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { MACHINES_BY_ID } from '../../data/library/machine-index'

const exerciseFiles = import.meta.glob('../../data/library/exercises.json', { eager: true, import: 'default' })
const machineFiles = import.meta.glob('../../data/library/machines.json', { eager: true, import: 'default' })

function firstValue<T>(files: Record<string, unknown>): T | null {
  const v = Object.values(files)[0]
  return (v as T | undefined) ?? null
}

const exerciseRows: Record<string, Exercise> = Object.fromEntries(
  (firstValue<Exercise[]>(exerciseFiles) ?? []).map((e) => [e.id, e]),
)
const machineRows: Record<string, Machine> = Object.fromEntries(
  (firstValue<Machine[]>(machineFiles) ?? []).map((m) => [m.id, m]),
)

/** True when the content slice's exercises.json is in the tree. */
export const HAS_EXERCISE_CONTENT = Object.keys(exerciseRows).length > 0

/** Common nicknames used only while exercises.json is absent; the content slice owns the real list. */
const FALLBACK_ALIASES: Record<string, string[]> = {
  'barbell-bench-press': ['bench', 'flat bench'],
  'overhead-press': ['OHP', 'military press'],
  'lat-pulldown': ['pulldown'],
  'romanian-deadlift': ['RDL'],
  'dumbbell-romanian-deadlift': ['DB RDL'],
  'back-squat': ['squat'],
  'seated-cable-row': ['cable row'],
  'cable-pushdown': ['pushdown', 'tricep pushdown'],
  'dumbbell-lateral-raise': ['side raise', 'lateral raise'],
  'barbell-hip-thrust': ['hip thrust'],
}

/** The prescription defaults the screen needs for one exercise. */
export interface ExerciseInfo {
  entry: ExerciseIndexEntry
  aliases: string[]
  repMin: number
  repMax: number
  /** Default load step in grams; dumbbells use the ladder instead. */
  incrementG: number
  restS: number
  cue: string | null
  hasMedia: boolean
}

function defaultIncrementG(entry: ExerciseIndexEntry): number {
  switch (entry.equipmentFamily) {
    case 'barbell':
    case 'smith':
      return 2500
    case 'dumbbell':
      return 1000
    case 'bodyweight':
      return 2500
    default:
      return 5000
  }
}

export function exerciseInfo(id: string): ExerciseInfo | null {
  const entry = EXERCISES_BY_ID[id]
  if (!entry) return null
  const row = exerciseRows[id]
  if (row) {
    return {
      entry,
      aliases: row.aliases ?? [],
      repMin: row.repMin,
      repMax: row.repMax,
      incrementG: row.incrementG,
      restS: row.restS,
      cue: row.cue ?? null,
      hasMedia: row.media !== null,
    }
  }
  const compound = entry.isCompound
  return {
    entry,
    aliases: FALLBACK_ALIASES[id] ?? [],
    repMin: compound ? 6 : 10,
    repMax: compound ? 10 : 15,
    incrementG: defaultIncrementG(entry),
    restS: compound ? 150 : 90,
    cue: null,
    hasMedia: false,
  }
}

/** The start-pose illustration path (without size suffix) when the content ships one. */
export function exerciseImagePath(id: string): string | null {
  const media = exerciseRows[id]?.media
  return media && typeof media.start === 'string' ? media.start : null
}

export function exerciseName(id: string): string {
  return EXERCISES_BY_ID[id]?.name ?? id
}

export interface MachineInfo {
  id: string
  name: string
  hasPhoto: boolean
  setup: { label: string; text: string }[]
}

export function machineInfo(id: string | undefined): MachineInfo | null {
  if (!id) return null
  const entry = MACHINES_BY_ID[id]
  if (!entry) return null
  const row = machineRows[id]
  return {
    id,
    name: entry.name,
    hasPhoto: !!row?.photo,
    setup: row?.setup ?? [],
  }
}
