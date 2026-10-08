import type { Exercise, ExerciseContent, ExerciseIndexEntry, ExerciseMedia, Machine, MachineContent, MachineIndexEntry } from '../../../domain/types'
import { EXERCISE_INDEX } from '../../../data/library/exercise-index'
import { MACHINE_INDEX } from '../../../data/library/machine-index'

// OWNER: ui-library. The one place the library screens read exercises and
// machines. The structural index is always there; prose and media arrive from
// JSON files written by other builders. The globs below resolve to nothing
// when a file is missing, so the screens render with graceful fallbacks until
// the content lands, then pick it up with no code change.

type Json<T> = Record<string, { default: T }>

const exerciseFiles = import.meta.glob('../../../data/library/exercises.json', { eager: true }) as Json<Partial<Exercise>[]>
const machineFiles = import.meta.glob('../../../data/library/machines.json', { eager: true }) as Json<Partial<Machine>[]>
const mediaFiles = import.meta.glob('../../../data/library/media.json', { eager: true }) as Json<Record<string, ExerciseMedia>>

function first<T>(files: Json<T>): T | null {
  const hit = Object.values(files)[0]
  return hit ? hit.default : null
}

/** Machines carry a few optional extras the content builder may add. */
export type LibraryMachine = Machine & { brandNote?: string; exerciseIds?: string[] }

const EXERCISE_FALLBACK: ExerciseContent = {
  aliases: [],
  cue: '',
  howTo: [],
  mistakes: [],
  repMin: 8,
  repMax: 12,
  incrementG: 2500,
  restS: 90,
  media: null,
}

const MACHINE_FALLBACK: MachineContent = {
  aliases: [],
  primaryMuscles: [],
  secondaryMuscles: [],
  setup: [],
  tips: [],
  photo: null,
  placeholder: true,
}

function build(): { exercises: Exercise[]; machines: LibraryMachine[] } {
  const exRows = first(exerciseFiles) ?? []
  const exById = new Map(exRows.map((r) => [r.id, r]))
  const media = first(mediaFiles) ?? {}
  const exercises = EXERCISE_INDEX.map((idx: ExerciseIndexEntry): Exercise => {
    const row = exById.get(idx.id)
    return {
      ...EXERCISE_FALLBACK,
      ...(row ?? {}),
      ...idx,
      media: media[idx.id] ?? row?.media ?? null,
    } as Exercise
  })

  const maRows = first(machineFiles) ?? []
  const maById = new Map(maRows.map((r) => [r.id, r]))
  const machines = MACHINE_INDEX.map((idx: MachineIndexEntry): LibraryMachine => {
    const row = maById.get(idx.id)
    const merged = { ...MACHINE_FALLBACK, ...(row ?? {}), ...idx } as LibraryMachine
    // A machine with no photo is always a placeholder, whatever the JSON says.
    if (!merged.photo) merged.placeholder = true
    return merged
  })
  return { exercises, machines }
}

const built = build()

export const EXERCISES: readonly Exercise[] = built.exercises
export const MACHINES: readonly LibraryMachine[] = built.machines

const exerciseById = new Map(EXERCISES.map((e) => [e.id, e]))
const machineById = new Map(MACHINES.map((m) => [m.id, m]))

export function getExercise(id: string | undefined): Exercise | undefined {
  return id ? exerciseById.get(id) : undefined
}

export function getMachine(id: string | undefined): LibraryMachine | undefined {
  return id ? machineById.get(id) : undefined
}

/** Exercises a machine supports: the ids the machine lists plus every exercise pointing at it. */
export function exercisesForMachine(machine: LibraryMachine): Exercise[] {
  const ids = new Set<string>(machine.exerciseIds ?? [])
  for (const e of EXERCISES) if (e.machineId === machine.id) ids.add(e.id)
  return EXERCISES.filter((e) => ids.has(e.id))
}

/** Body part label for display. */
export function titleCase(slug: string): string {
  const s = slug.replace(/[_-]/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
