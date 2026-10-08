import type { EquipmentFamily, Exercise } from '../../../domain/types'

// OWNER: ui-library. "Swap for" on the exercise detail: the same movement
// pattern and a shared primary muscle, filtered to the machines the gym has,
// ranked by how close the equipment feels. The planner owns the in-session
// substitution; this list is the browse-time version and reads only the
// library, so it works before the planner lands.

const SIMILARITY: Partial<Record<EquipmentFamily, Partial<Record<EquipmentFamily, number>>>> = {
  barbell: { smith: 0.8, dumbbell: 0.7, machine: 0.5, cable: 0.4, bodyweight: 0.3 },
  smith: { barbell: 0.8, machine: 0.6, dumbbell: 0.5, cable: 0.4, bodyweight: 0.3 },
  dumbbell: { barbell: 0.7, cable: 0.5, smith: 0.5, machine: 0.5, bodyweight: 0.4 },
  cable: { machine: 0.6, dumbbell: 0.5, barbell: 0.4, smith: 0.4, bodyweight: 0.3 },
  machine: { smith: 0.6, cable: 0.6, dumbbell: 0.5, barbell: 0.5, bodyweight: 0.3 },
  bodyweight: { dumbbell: 0.4, barbell: 0.3, cable: 0.3, machine: 0.3, smith: 0.3 },
}

export function equipmentSimilarity(a: EquipmentFamily, b: EquipmentFamily): number {
  if (a === b) return 1
  return SIMILARITY[a]?.[b] ?? 0.2
}

export function sharesPrimary(a: Exercise, b: Exercise): boolean {
  return a.primaryMuscles.some((m) => b.primaryMuscles.includes(m))
}

/**
 * Candidates for a swap, best first.
 * - same movement pattern and at least one shared primary muscle;
 * - never the exercise itself, and never another exercise on the same machine
 *   (the usual reason to swap is that the machine is taken);
 * - when `gymMachineIds` is given, a candidate that needs a machine must be in it;
 * - different equipment ranks first, then closer equipment, then same load type,
 *   then compound over isolation to match, then the priority exercises.
 */
export function swapCandidates(
  target: Exercise,
  all: readonly Exercise[],
  gymMachineIds: ReadonlySet<string> | null,
  limit = 6,
): Exercise[] {
  const rank = (c: Exercise): number => {
    let s = equipmentSimilarity(target.equipmentFamily, c.equipmentFamily)
    if (c.equipment !== target.equipment) s += 1
    if (c.loadType === target.loadType) s += 0.3
    if (c.isCompound === target.isCompound) s += 0.2
    if (c.isRecompPriority) s += 0.1
    return s
  }
  return all
    .filter((c) => c.id !== target.id)
    .filter((c) => c.movementPattern === target.movementPattern && sharesPrimary(target, c))
    .filter((c) => !(target.machineId && c.machineId === target.machineId))
    .filter((c) => !c.machineId || !gymMachineIds || gymMachineIds.has(c.machineId))
    .map((c) => ({ c, s: rank(c) }))
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((r) => r.c)
}

export interface SwapList {
  /** 'pattern' is the full rule; 'muscle' is the fallback for moves with no pattern twin. */
  kind: 'pattern' | 'muscle' | 'none'
  items: Exercise[]
}

/** The strict list, or, for a move that has no pattern twin, other moves that train the same muscle, then the same body part. */
export function swapList(target: Exercise, all: readonly Exercise[], gymMachineIds: ReadonlySet<string> | null, limit = 6): SwapList {
  const strict = swapCandidates(target, all, gymMachineIds, limit)
  if (strict.length > 0) return { kind: 'pattern', items: strict }
  const sameMuscle = (c: Exercise): boolean => sharesPrimary(target, c) || c.secondaryMuscles.some((m) => target.primaryMuscles.includes(m))
  const items = all
    .filter((c) => c.id !== target.id && (sameMuscle(c) || c.bodyPart === target.bodyPart))
    .filter((c) => !(target.machineId && c.machineId === target.machineId))
    .filter((c) => !c.machineId || !gymMachineIds || gymMachineIds.has(c.machineId))
    .sort((a, b) => Number(sameMuscle(b)) - Number(sameMuscle(a)) || Number(b.isRecompPriority) - Number(a.isRecompPriority) || a.name.localeCompare(b.name))
    .slice(0, limit)
  return items.length > 0 ? { kind: 'muscle', items } : { kind: 'none', items: [] }
}
