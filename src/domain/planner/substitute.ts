// Substitution when a machine is busy (PLAN.md 3.4): candidates share the
// movement pattern and a primary muscle, filtered to the gym's machines,
// scored +3 same equipment family, +2 per shared secondary (two at most),
// +1 has history, +1 not already done today; ties by exercise id.

import { MUSCLE_INFO } from '../muscles'
import type { ExerciseIndexEntry } from '../types'
import type { EquipmentProfile, PlannerContext, Substitute, SubstituteInput } from './contract'
import { historyCount } from './history'

export const SCORE_SAME_FAMILY = 3
export const SCORE_PER_SHARED_SECONDARY = 2
export const SHARED_SECONDARY_CAP = 2
export const SCORE_HAS_HISTORY = 1
export const SCORE_NOT_DONE_TODAY = 1

/** True when the gym profile has the machine the exercise needs (an empty profile means everything). */
export function gymHas(ex: ExerciseIndexEntry, equipment: EquipmentProfile): boolean {
  if (equipment.machine_ids.length === 0) return true
  if (!ex.machineId) return true
  return equipment.machine_ids.includes(ex.machineId)
}

export function sharesPrimary(a: ExerciseIndexEntry, b: ExerciseIndexEntry): boolean {
  return a.primaryMuscles.some((m) => b.primaryMuscles.includes(m))
}

export function substitutesFor(input: SubstituteInput, ctx: PlannerContext): Substitute[] {
  const source = ctx.exercises[input.exercise_id]
  if (!source) return []
  const done = new Set(input.done_today)
  const out: Substitute[] = []
  for (const cand of Object.values(ctx.exercises)) {
    if (cand.id === source.id) continue
    if (cand.movementPattern !== source.movementPattern) continue
    if (!sharesPrimary(cand, source)) continue
    if (!gymHas(cand, ctx.equipment)) continue
    let score = 0
    const reasons: string[] = []
    if (cand.equipmentFamily === source.equipmentFamily) {
      score += SCORE_SAME_FAMILY
      reasons.push('same equipment family')
    }
    const shared = cand.secondaryMuscles.filter((m) => source.secondaryMuscles.includes(m)).slice(0, SHARED_SECONDARY_CAP)
    for (const m of shared) {
      score += SCORE_PER_SHARED_SECONDARY
      reasons.push(`shares ${MUSCLE_INFO[m].label.toLowerCase()}`)
    }
    if (historyCount(ctx.history.sets, cand.id) > 0) {
      score += SCORE_HAS_HISTORY
      reasons.push('has history')
    }
    if (!done.has(cand.id)) {
      score += SCORE_NOT_DONE_TODAY
      reasons.push('not yet today')
    }
    out.push({ exercise_id: cand.id, score, reasons })
  }
  out.sort((a, b) => b.score - a.score || (a.exercise_id < b.exercise_id ? -1 : 1))
  return out.slice(0, Math.max(0, input.limit))
}
