// Time-boxing in the fixed order (PLAN.md 3.4): general warm-up 5 to 3
// minutes, rest cuts (isolation 75 to 60 s, secondary compounds 150 to
// 120 s, the first compound untouched), one set off each isolation (floor
// 2), superset non-competing isolation pairs, drop isolation from the end,
// compounds to 3 sets. Compounds are never removed and ramps never cut.
// When it still does not fit, needs_minutes says how many it needs.

import { groupOf } from '../muscles'
import type { ExerciseIndexEntry, MuscleGroup } from '../types'
import type { PlannedExercise, PlannerContext, SessionMinutes, SessionPlan } from './contract'
import { estimateMinutes, isCompoundPlanned } from './estimate'
import { GENERAL_WARMUP_MINUTES_SHORT } from './warmup'

export const ISOLATION_REST_CUT_S = 60
export const SECONDARY_COMPOUND_REST_CUT_S = 120
export const ISOLATION_SET_FLOOR = 2
export const COMPOUND_SET_FLOOR = 3

/** Non-competing isolation pairs that share one rest. */
export const SUPERSET_PAIRS: readonly [MuscleGroup, MuscleGroup][] = [
  ['biceps', 'triceps'],
  ['side_delts', 'rear_delts'],
  ['calves', 'abs'],
]

function pairs(a: MuscleGroup, b: MuscleGroup): boolean {
  return SUPERSET_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

function primaryGroupOf(pe: PlannedExercise, exercises: Readonly<Record<string, ExerciseIndexEntry>>): MuscleGroup | null {
  const ex = exercises[pe.exercise_id]
  if (!ex || ex.primaryMuscles.length === 0) return null
  return groupOf(ex.primaryMuscles[0])
}

function clone(plan: SessionPlan): SessionPlan {
  return {
    ...plan,
    general_warmup: { ...plan.general_warmup, drills: plan.general_warmup.drills.map((d) => ({ ...d })) },
    exercises: plan.exercises.map((e) => ({ ...e, target_reps: [...e.target_reps], warmups: e.warmups.map((w) => ({ ...w })) })),
    warnings: [...plan.warnings],
    trim_steps: [...(plan.trim_steps ?? [])],
  }
}

function reslot(list: PlannedExercise[]): void {
  list.forEach((e, i) => {
    e.slot = i
  })
}

export function applyTimebox(input: SessionPlan, minutes: SessionMinutes, ctx: PlannerContext): SessionPlan {
  const plan = clone(input)
  const exercises = ctx.exercises
  const steps: string[] = []
  const fits = () => estimateMinutes(plan, exercises) <= minutes
  const compound = (pe: PlannedExercise) => isCompoundPlanned(pe, exercises)
  const firstCompoundId = plan.exercises.find(compound)?.exercise_id ?? null
  const finish = (): SessionPlan => {
    plan.estimated_minutes = estimateMinutes(plan, exercises)
    plan.needs_minutes = plan.estimated_minutes <= minutes ? null : plan.estimated_minutes
    plan.trim_steps = steps
    return plan
  }

  if (fits()) return finish()

  // 1. General warm-up 5 to 3 minutes.
  if (plan.general_warmup.minutes > GENERAL_WARMUP_MINUTES_SHORT) {
    plan.general_warmup.minutes = GENERAL_WARMUP_MINUTES_SHORT
    plan.general_warmup.cardio = `${GENERAL_WARMUP_MINUTES_SHORT} min incline walk, 3 percent, 5 km/h`
    steps.push('general warm-up to 3 min')
    if (fits()) return finish()
  }

  // 2. Rest cuts, the first compound untouched.
  let cutRests = false
  for (const pe of plan.exercises) {
    if (pe.exercise_id === firstCompoundId) continue
    const cap = compound(pe) ? SECONDARY_COMPOUND_REST_CUT_S : ISOLATION_REST_CUT_S
    if (pe.rest_s > cap) {
      pe.rest_s = cap
      cutRests = true
    }
  }
  if (cutRests) {
    steps.push('rests cut')
    if (fits()) return finish()
  }

  // 3. One set off each isolation, from the end, floor 2.
  for (let i = plan.exercises.length - 1; i >= 0; i--) {
    const pe = plan.exercises[i]
    if (compound(pe) || pe.sets <= ISOLATION_SET_FLOOR) continue
    pe.sets -= 1
    pe.target_reps = pe.target_reps.slice(0, pe.sets)
    if (!steps.includes('one set off each isolation')) steps.push('one set off each isolation')
    if (fits()) return finish()
  }

  // 4. Superset non-competing isolation pairs.
  for (let i = 0; i < plan.exercises.length; i++) {
    const a = plan.exercises[i]
    if (compound(a) || a.superset_with !== null) continue
    const ga = primaryGroupOf(a, exercises)
    if (!ga) continue
    for (let j = i + 1; j < plan.exercises.length; j++) {
      const b = plan.exercises[j]
      if (compound(b) || b.superset_with !== null) continue
      const gb = primaryGroupOf(b, exercises)
      if (!gb || !pairs(ga, gb)) continue
      a.superset_with = b.exercise_id
      b.superset_with = a.exercise_id
      if (!steps.includes('isolation pairs supersetted')) steps.push('isolation pairs supersetted')
      if (fits()) return finish()
      break
    }
  }

  // 5. Drop isolation from the end.
  for (let i = plan.exercises.length - 1; i >= 0; i--) {
    const pe = plan.exercises[i]
    if (compound(pe)) continue
    if (pe.superset_with !== null) {
      const partner = plan.exercises.find((p) => p.exercise_id === pe.superset_with)
      if (partner) partner.superset_with = null
    }
    plan.exercises.splice(i, 1)
    reslot(plan.exercises)
    if (!steps.includes('isolation dropped from the end')) steps.push('isolation dropped from the end')
    if (fits()) return finish()
  }

  // 6. Compound sets to 3.
  for (let i = plan.exercises.length - 1; i >= 0; i--) {
    const pe = plan.exercises[i]
    if (!compound(pe) || pe.sets <= COMPOUND_SET_FLOOR) continue
    pe.sets = COMPOUND_SET_FLOOR
    pe.target_reps = pe.target_reps.slice(0, pe.sets)
    if (!steps.includes('compounds to 3 sets')) steps.push('compounds to 3 sets')
    if (fits()) return finish()
  }

  // 7. Still over: say how many minutes it needs.
  return finish()
}
