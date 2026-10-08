// Per-exercise load steps for the steppers (PLAN.md 3.4): barbell 2.5 kg,
// the squat, deadlift and hip thrust 5 kg from 80 kg, dumbbells one rung of
// the ladder, machines and cables one stack step, weighted bodyweight 2.5 kg,
// assistance one stack step on its own positive axis.

import type { ExerciseIndexEntry } from '../../domain/types'
import {
  BARBELL_INCREMENT_G,
  DEFAULT_DUMBBELL_LADDER_G,
  HEAVY_BARBELL_INCREMENT_G,
  HEAVY_BARBELL_THRESHOLD_G,
  WEIGHTED_BODYWEIGHT_INCREMENT_G,
} from '../../domain/planner/index'

/** Lifts that step by 5 kg once the load is 80 kg or more. */
export const HEAVY_LIFT_IDS: readonly string[] = ['back-squat', 'front-squat', 'deadlift', 'trap-bar-deadlift', 'barbell-hip-thrust']

export interface StepOptions {
  /** incrementG from exercises.json, when the content slice has shipped it. */
  incrementG?: number
  ladder?: readonly number[]
}

/** The step in grams the plus button adds at this load. */
export function incrementFor(entry: ExerciseIndexEntry, loadG: number, opts: StepOptions = {}): number {
  if (entry.loadType === 'assisted') return opts.incrementG ?? 5000
  switch (entry.equipmentFamily) {
    case 'barbell':
    case 'smith': {
      if (HEAVY_LIFT_IDS.includes(entry.id) && loadG >= HEAVY_BARBELL_THRESHOLD_G) return HEAVY_BARBELL_INCREMENT_G
      return opts.incrementG ?? BARBELL_INCREMENT_G
    }
    case 'dumbbell':
      return 0 // ladder
    case 'bodyweight':
      return opts.incrementG ?? WEIGHTED_BODYWEIGHT_INCREMENT_G
    default:
      return opts.incrementG ?? 5000
  }
}

/** The load after one stepper tap. Never below zero; dumbbells walk the ladder. */
export function stepLoad(entry: ExerciseIndexEntry, loadG: number, dir: 1 | -1, opts: StepOptions = {}): number {
  if (entry.equipmentFamily === 'dumbbell' && entry.loadType === 'weight') {
    const sorted = [...(opts.ladder ?? DEFAULT_DUMBBELL_LADDER_G)].sort((a, b) => a - b)
    if (dir > 0) return sorted.find((r) => r > loadG) ?? sorted[sorted.length - 1]
    const below = sorted.filter((r) => r < loadG)
    return below.length > 0 ? below[below.length - 1] : sorted[0]
  }
  const step = incrementFor(entry, dir < 0 ? Math.max(0, loadG - 1) : loadG, opts)
  const next = loadG + dir * step
  return Math.max(0, next)
}

/** Seconds step for time-loaded moves (planks). */
export const TIME_STEP_S = 5
