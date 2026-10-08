// The load a first-time row starts from when nothing else gives one: the
// bar for a barbell move, the lowest rung for dumbbells, one stack step for
// a machine or cable. Never 0, so a one-tap complete can never log "0 kg x
// 5" and seed the next session's prev column with it.

import { DEFAULT_DUMBBELL_LADDER_G, DEFAULT_STACK_STEP_G } from '../../domain/planner/index'
import { BAR_FLOOR_G, type ExerciseIndexEntry } from '../../domain/types'

export function seedLoadG(entry: ExerciseIndexEntry | undefined): number {
  if (!entry || entry.loadType !== 'weight') return 0
  switch (entry.equipmentFamily) {
    case 'barbell':
      return BAR_FLOOR_G[entry.barType ?? 'olympic']
    case 'dumbbell':
      return DEFAULT_DUMBBELL_LADDER_G[0]
    case 'machine':
    case 'cable':
    case 'smith':
      return DEFAULT_STACK_STEP_G
    default:
      return 0
  }
}

/** A working set of a loaded exercise at 0 kg needs a load before it can be logged. */
export function needsLoad(entry: ExerciseIndexEntry | undefined, kind: 'warmup' | 'working', load_g: number): boolean {
  return !!entry && entry.loadType === 'weight' && kind === 'working' && load_g <= 0
}
