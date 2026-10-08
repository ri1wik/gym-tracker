// The muscle contract. Written and tested before the library ships, because
// the weekly volume gauge is only as honest as this map.
//
// 22 mapping muscles roll up to 14 scored groups and 11 browse body parts.
// A working set adds 1.0 to each primary muscle and 0.5 to each secondary
// (two secondaries at most), and at most 1.0 to any body part: the body part
// takes the MAX over its muscles, never the sum, so a barbell row tagged
// upper_back and lats counts one back set, not two. Warm-ups are excluded.
// Lower back, front delts, rotator cuff, hip flexors and tibialis earn no
// body-part credit; they stay on the map so exercises can still be tagged
// honestly and the muscle map can highlight them.

import type { BodyPart, Muscle, MuscleGroup, SetKind } from './types'
import { BODY_PARTS, MUSCLES, MUSCLE_GROUPS } from './types'

/** The two tag arrays the credit rules read; readonly so fixtures can be `as const`. */
export interface MuscleTags {
  primaryMuscles: readonly Muscle[]
  secondaryMuscles: readonly Muscle[]
}

export interface MuscleInfo {
  group: MuscleGroup
  bodyPart: BodyPart
  /** False for the five muscles that earn no body-part credit. */
  credits: boolean
  /** Credit at the 14-group level. Only front delts differ: they are a printed group but earn no body-part credit. */
  groupCredits: boolean
  label: string
}

export const MUSCLE_INFO: Record<Muscle, MuscleInfo> = {
  upper_chest: { group: 'chest', bodyPart: 'chest', credits: true, groupCredits: true, label: 'Upper chest' },
  chest: { group: 'chest', bodyPart: 'chest', credits: true, groupCredits: true, label: 'Chest' },
  lats: { group: 'lats', bodyPart: 'back', credits: true, groupCredits: true, label: 'Lats' },
  upper_back: { group: 'upper_back', bodyPart: 'back', credits: true, groupCredits: true, label: 'Upper back' },
  traps: { group: 'upper_back', bodyPart: 'back', credits: true, groupCredits: true, label: 'Traps' },
  lower_back: { group: 'upper_back', bodyPart: 'back', credits: false, groupCredits: false, label: 'Lower back' },
  front_delts: { group: 'front_delts', bodyPart: 'shoulders', credits: false, groupCredits: true, label: 'Front delts' },
  side_delts: { group: 'side_delts', bodyPart: 'shoulders', credits: true, groupCredits: true, label: 'Side delts' },
  rear_delts: { group: 'rear_delts', bodyPart: 'shoulders', credits: true, groupCredits: true, label: 'Rear delts' },
  rotator_cuff: { group: 'rear_delts', bodyPart: 'shoulders', credits: false, groupCredits: false, label: 'Rotator cuff' },
  biceps: { group: 'biceps', bodyPart: 'biceps', credits: true, groupCredits: true, label: 'Biceps' },
  triceps: { group: 'triceps', bodyPart: 'triceps', credits: true, groupCredits: true, label: 'Triceps' },
  forearms: { group: 'forearms', bodyPart: 'forearms', credits: true, groupCredits: true, label: 'Forearms' },
  quads: { group: 'quads', bodyPart: 'quads', credits: true, groupCredits: true, label: 'Quads' },
  hip_flexors: { group: 'quads', bodyPart: 'quads', credits: false, groupCredits: false, label: 'Hip flexors' },
  hamstrings: { group: 'hamstrings', bodyPart: 'hamstrings', credits: true, groupCredits: true, label: 'Hamstrings' },
  glutes: { group: 'glutes', bodyPart: 'glutes', credits: true, groupCredits: true, label: 'Glutes' },
  abductors: { group: 'glutes', bodyPart: 'glutes', credits: true, groupCredits: true, label: 'Hip abductors' },
  adductors: { group: 'glutes', bodyPart: 'glutes', credits: true, groupCredits: true, label: 'Adductors' },
  calves: { group: 'calves', bodyPart: 'calves', credits: true, groupCredits: true, label: 'Calves' },
  tibialis: { group: 'calves', bodyPart: 'calves', credits: false, groupCredits: false, label: 'Tibialis' },
  abs: { group: 'abs', bodyPart: 'core', credits: true, groupCredits: true, label: 'Abs' },
}

/** Muscles that never earn body-part credit, for display ("not counted"). */
export const NO_CREDIT_MUSCLES: readonly Muscle[] = MUSCLES.filter((m) => !MUSCLE_INFO[m].credits)

export const PRIMARY_CREDIT = 1.0
export const SECONDARY_CREDIT = 0.5
export const MAX_SECONDARIES = 2

/** Body parts shown but never flagged by the review (PLAN.md section 6, signal 3). */
export const UNFLAGGED_BODY_PARTS: readonly BodyPart[] = ['forearms', 'core']

export function bodyPartOf(muscle: Muscle): BodyPart {
  return MUSCLE_INFO[muscle].bodyPart
}

export function groupOf(muscle: Muscle): MuscleGroup {
  return MUSCLE_INFO[muscle].group
}

export function musclesOfBodyPart(part: BodyPart): Muscle[] {
  return MUSCLES.filter((m) => MUSCLE_INFO[m].bodyPart === part)
}

export function musclesOfGroup(group: MuscleGroup): Muscle[] {
  return MUSCLES.filter((m) => MUSCLE_INFO[m].group === group)
}

export function emptyBodyPartTotals(): Record<BodyPart, number> {
  const out = {} as Record<BodyPart, number>
  for (const p of BODY_PARTS) out[p] = 0
  return out
}

/**
 * Per-muscle credit for ONE working set of an exercise: 1.0 per primary, 0.5
 * per secondary (first two only). Muscles that earn no credit are omitted.
 */
export function setCreditByMuscle(ex: MuscleTags): Partial<Record<Muscle, number>> {
  const credit: Partial<Record<Muscle, number>> = {}
  for (const m of ex.primaryMuscles) {
    if (!MUSCLE_INFO[m].credits) continue
    credit[m] = Math.max(credit[m] ?? 0, PRIMARY_CREDIT)
  }
  for (const m of ex.secondaryMuscles.slice(0, MAX_SECONDARIES)) {
    if (!MUSCLE_INFO[m].credits) continue
    credit[m] = Math.max(credit[m] ?? 0, SECONDARY_CREDIT)
  }
  return credit
}

/**
 * Per-body-part credit for ONE working set: the max over that part's muscles,
 * so a set can never add more than 1.0 to any body part.
 */
export function setCreditByBodyPart(ex: MuscleTags): Partial<Record<BodyPart, number>> {
  const byMuscle = setCreditByMuscle(ex)
  const out: Partial<Record<BodyPart, number>> = {}
  for (const [m, v] of Object.entries(byMuscle) as [Muscle, number][]) {
    const part = MUSCLE_INFO[m].bodyPart
    out[part] = Math.max(out[part] ?? 0, v)
  }
  return out
}

/** The minimum a set needs to be counted. Warm-ups never count; uncompleted rows never count. */
export interface CountableSet {
  exercise_id: string
  kind: SetKind
  completed_at: string | null
}

/**
 * Working sets per body part over whatever sets are passed (the caller picks
 * the window). Warm-ups and uncompleted sets are excluded. Sets whose exercise
 * is unknown (a deleted custom exercise) are skipped, never thrown on.
 */
export function weeklySetsByBodyPart(
  sets: readonly CountableSet[],
  exercisesById: Readonly<Record<string, MuscleTags>>,
): Record<BodyPart, number> {
  const totals = emptyBodyPartTotals()
  for (const s of sets) {
    if (s.kind !== 'working' || s.completed_at === null) continue
    const ex = exercisesById[s.exercise_id]
    if (!ex) continue
    const credit = setCreditByBodyPart(ex)
    for (const [part, v] of Object.entries(credit) as [BodyPart, number][]) {
      totals[part] += v
    }
  }
  return totals
}

/**
 * Working sets per scored group, same credit rule, max over the group's
 * muscles. This is the level the planner's volume projector prints
 * (docs/SPEC-programming.md split catalogue). Front delts count here because
 * the group exists in that table; they still earn no body-part credit above.
 */
export function weeklySetsByGroup(
  sets: readonly CountableSet[],
  exercisesById: Readonly<Record<string, MuscleTags>>,
): Record<MuscleGroup, number> {
  const totals = {} as Record<MuscleGroup, number>
  for (const g of MUSCLE_GROUPS) totals[g] = 0
  for (const s of sets) {
    if (s.kind !== 'working' || s.completed_at === null) continue
    const ex = exercisesById[s.exercise_id]
    if (!ex) continue
    const credit: Partial<Record<MuscleGroup, number>> = {}
    for (const m of ex.primaryMuscles) {
      if (!MUSCLE_INFO[m].groupCredits) continue
      const g = MUSCLE_INFO[m].group
      credit[g] = Math.max(credit[g] ?? 0, PRIMARY_CREDIT)
    }
    for (const m of ex.secondaryMuscles.slice(0, MAX_SECONDARIES)) {
      if (!MUSCLE_INFO[m].groupCredits) continue
      const g = MUSCLE_INFO[m].group
      credit[g] = Math.max(credit[g] ?? 0, SECONDARY_CREDIT)
    }
    for (const [g, v] of Object.entries(credit) as [MuscleGroup, number][]) {
      totals[g] = (totals[g] ?? 0) + v
    }
  }
  return totals
}
