import { MUSCLE_INFO } from '../../../domain/muscles'
import type { BodyPart, Equipment, Exercise, MachineCategory, Muscle } from '../../../domain/types'
import type { LibraryMachine } from './data'
import type { Searchable } from './search'

// OWNER: ui-library. Display names and the search tags built from them.

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  ez_bar: 'EZ bar',
  trap_bar: 'Trap bar',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  selectorised_machine: 'Machine',
  plate_loaded_machine: 'Plate-loaded machine',
  smith_machine: 'Smith machine',
  bodyweight: 'Bodyweight',
}

export const CATEGORY_LABEL: Record<MachineCategory, string> = {
  'plate-loaded': 'Plate-loaded',
  selectorised: 'Selectorised',
  cable: 'Cable',
  'free-weight': 'Free weights',
  cardio: 'Cardio',
  bodyweight: 'Bodyweight',
}

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
}

export function muscleLabels(muscles: readonly Muscle[]): string[] {
  return muscles.map((m) => MUSCLE_INFO[m].label)
}

export function muscleLine(muscles: readonly Muscle[]): string {
  return muscleLabels(muscles).join(', ')
}

export function exerciseSearchable(e: Exercise): Searchable {
  return {
    name: e.name,
    aliases: e.aliases,
    tags: [BODY_PART_LABEL[e.bodyPart], ...muscleLabels(e.primaryMuscles), EQUIPMENT_LABEL[e.equipment]],
  }
}

export function machineSearchable(m: LibraryMachine, custom: readonly string[] = []): Searchable {
  const parts = [...new Set([...m.primaryMuscles, ...m.secondaryMuscles].map((x) => MUSCLE_INFO[x].bodyPart))]
  return {
    name: m.name,
    aliases: [...m.aliases, ...custom, ...(m.brandNote ? [m.brandNote] : [])],
    tags: [
      CATEGORY_LABEL[m.category],
      ...parts.map((p) => BODY_PART_LABEL[p]),
      ...muscleLabels([...m.primaryMuscles, ...m.secondaryMuscles]),
    ],
  }
}
