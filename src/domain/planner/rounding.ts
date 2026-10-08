// Equipment-aware rounding and increments. Every load the planner prints
// passes through here, so a barbell never reads 31.5 kg and a dumbbell
// never lands between two rungs.

import type { ExerciseIndexEntry } from '../types'
import { BAR_FLOOR_G } from '../types'
import type { RoundingDirection } from '../units'
import { roundToIncrement, roundToLadder } from '../units'
import type { EquipmentProfile } from './contract'
import {
  BARBELL_INCREMENT_G,
  DEFAULT_DUMBBELL_LADDER_G,
  DEFAULT_STACK_STEP_G,
  HEAVY_BARBELL_INCREMENT_G,
  HEAVY_BARBELL_THRESHOLD_G,
  WEIGHTED_BODYWEIGHT_INCREMENT_G,
} from './contract'

/** The patterns whose barbell loads step by 5 kg once they reach 80 kg. */
const HEAVY_BARBELL_PATTERNS = new Set(['squat', 'hinge', 'hip_thrust'])

export function isBarbellFamily(ex: ExerciseIndexEntry): boolean {
  return ex.equipmentFamily === 'barbell'
}

export function isStackFamily(ex: ExerciseIndexEntry): boolean {
  return ex.equipmentFamily === 'machine' || ex.equipmentFamily === 'cable' || ex.equipmentFamily === 'smith'
}

export function stackStepFor(ex: ExerciseIndexEntry, equipment: EquipmentProfile): number {
  const step = equipment.stack_step_g[ex.id]
  if (step && step > 0) return step
  if (ex.equipmentFamily === 'smith') return BARBELL_INCREMENT_G
  return DEFAULT_STACK_STEP_G
}

export function ladderFor(equipment: EquipmentProfile): readonly number[] {
  return equipment.dumbbell_ladder_g.length > 0 ? equipment.dumbbell_ladder_g : DEFAULT_DUMBBELL_LADDER_G
}

export function barFloorFor(ex: ExerciseIndexEntry, equipment: EquipmentProfile): number {
  const type = ex.barType ?? 'olympic'
  return equipment.bar_floor_g[type] ?? BAR_FLOOR_G[type]
}

/**
 * The increment for one progression step at a given load, in grams. On the
 * dumbbell ladder it is the distance to the next rung (0 at the top).
 */
export function incrementFor(ex: ExerciseIndexEntry, load_g: number, equipment: EquipmentProfile): number {
  if (ex.loadType === 'assisted') return stackStepFor(ex, equipment)
  if (ex.loadType === 'bodyweight') return WEIGHTED_BODYWEIGHT_INCREMENT_G
  if (ex.loadType === 'time') return 0
  switch (ex.equipmentFamily) {
    case 'barbell':
      return HEAVY_BARBELL_PATTERNS.has(ex.movementPattern) && load_g >= HEAVY_BARBELL_THRESHOLD_G
        ? HEAVY_BARBELL_INCREMENT_G
        : BARBELL_INCREMENT_G
    case 'dumbbell': {
      const ladder = [...ladderFor(equipment)].sort((a, b) => a - b)
      const next = ladder.find((r) => r > load_g)
      return next === undefined ? 0 : next - load_g
    }
    case 'bodyweight':
      return WEIGHTED_BODYWEIGHT_INCREMENT_G
    default:
      return stackStepFor(ex, equipment)
  }
}

/**
 * Round a load to what the equipment can hold. Barbells round to their own
 * increment at that load and never go below the bar; dumbbells snap to the
 * ladder; stacks round to their step. Loads never go below zero.
 */
export function roundLoad(
  grams: number,
  ex: ExerciseIndexEntry,
  equipment: EquipmentProfile,
  direction: RoundingDirection = 'nearest',
): number {
  const value = Math.max(0, grams)
  if (ex.loadType === 'time') return Math.round(value)
  if (ex.loadType === 'assisted') return roundToIncrement(value, stackStepFor(ex, equipment), direction)
  if (ex.loadType === 'bodyweight') return roundToIncrement(value, WEIGHTED_BODYWEIGHT_INCREMENT_G, direction)
  switch (ex.equipmentFamily) {
    case 'barbell': {
      const inc = incrementFor(ex, value, equipment)
      return Math.max(barFloorFor(ex, equipment), roundToIncrement(value, inc, direction))
    }
    case 'dumbbell':
      return roundToLadder(value, ladderFor(equipment), direction)
    case 'bodyweight':
      return roundToIncrement(value, WEIGHTED_BODYWEIGHT_INCREMENT_G, direction)
    default:
      return roundToIncrement(value, stackStepFor(ex, equipment), direction)
  }
}

/** Assistance rounds to the stack step; it never goes below zero. */
export function roundAssist(grams: number, ex: ExerciseIndexEntry, equipment: EquipmentProfile, direction: RoundingDirection = 'nearest'): number {
  return Math.max(0, roundToIncrement(Math.max(0, grams), stackStepFor(ex, equipment), direction))
}
