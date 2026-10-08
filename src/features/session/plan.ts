// The adapter between the session screen and the planner stubs
// (docs/CONTRACTS.md section 6). While a stub throws 'not implemented' the
// adapter returns a small synthetic fixture typed as the contract's output;
// at integration the catch blocks go and the real engine flows through.

import {
  buildCustomSession,
  substitutesFor,
  DEFAULT_DUMBBELL_LADDER_G,
  type PlannerContext,
  type SessionPlan,
  type SessionRequest,
  type Substitute,
  type SubstituteInput,
  type History,
} from '../../domain/planner/index'
import { BAR_FLOOR_G, type ExerciseIndexEntry } from '../../domain/types'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { localDateKey } from '../../domain/dates'

function isNotImplemented(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('not implemented')
}

export function emptyContext(history: History = { sets: [], workouts: [] }, today = localDateKey()): PlannerContext {
  return {
    program: null,
    history,
    equipment: {
      dumbbell_ladder_g: [...DEFAULT_DUMBBELL_LADDER_G],
      stack_step_g: {},
      bar_floor_g: { ...BAR_FLOOR_G },
      machine_ids: [],
    },
    exercises: EXERCISES_BY_ID,
    today,
  }
}

/** A synthetic push day used while buildCustomSession is a stub. Loads are generic, not anyone's numbers. */
export function fixturePlan(): SessionPlan {
  const ex = (
    exercise_id: string,
    slot: number,
    sets: number,
    rep_min: number,
    rep_max: number,
    target_load_g: number,
    rest_s: number,
    warmups: { label: string; load_g: number; reps: number; rest_s: number }[],
    why: string,
  ) => ({
    exercise_id,
    slot,
    sets,
    rep_min,
    rep_max,
    target_reps: Array.from({ length: sets }, () => rep_min + 2),
    target_load_g,
    assist_g: 0,
    load_source: 'history' as const,
    rest_s,
    warmups: warmups.map((w) => ({ ...w, assist_g: 0 })),
    last_time: null,
    why,
    superset_with: null,
    suggested_increase: false,
  })
  return {
    session_key: 'custom',
    name: 'Push (quick)',
    general_warmup: {
      cardio: '5 min incline walk, 3 percent, 5 km/h',
      minutes: 5,
      drills: [
        { name: 'Band pull-aparts', dose: 'x15' },
        { name: 'Scapular push-ups', dose: 'x10' },
      ],
    },
    exercises: [
      ex('barbell-bench-press', 0, 3, 6, 10, 60_000, 150, [
        { label: 'Bar', load_g: 20_000, reps: 10, rest_s: 45 },
        { label: '60%', load_g: 35_000, reps: 5, rest_s: 45 },
        { label: '80%', load_g: 47_500, reps: 2, rest_s: 60 },
      ], 'Main chest press, first because it is the heaviest lift'),
      ex('incline-dumbbell-press', 1, 3, 8, 12, 20_000, 120, [{ label: '70%', load_g: 15_000, reps: 3, rest_s: 60 }], 'Upper chest from a second angle'),
      ex('dumbbell-lateral-raise', 2, 3, 10, 15, 8000, 75, [{ label: 'Feel set', load_g: 5000, reps: 8, rest_s: 45 }], 'Side delts, the width the press misses'),
      ex('cable-pushdown', 3, 3, 10, 15, 25_000, 75, [], 'Triceps to finish, pushdown for the lateral head'),
    ],
    estimated_minutes: 50,
    rotation_effect: 'holds',
    warnings: [],
    deload: false,
    cardio: null,
    needs_minutes: null,
  }
}

/** Build a session plan through the planner, or the fixture while the stub throws. */
export function planSession(request: SessionRequest, ctx: PlannerContext): SessionPlan {
  try {
    return buildCustomSession(request, ctx)
  } catch (e) {
    if (!isNotImplemented(e)) throw e
    return fixturePlan()
  }
}

/**
 * Substitutes through the planner, or the spec's scorer over the exercise
 * index while the stub throws: same pattern and primary muscle, +3 same
 * family, +2 per shared secondary (cap 2), +1 has history, +1 not done today.
 */
export function substitutes(input: SubstituteInput, ctx: PlannerContext): Substitute[] {
  try {
    return substitutesFor(input, ctx)
  } catch (e) {
    if (!isNotImplemented(e)) throw e
    return fallbackSubstitutes(input, ctx)
  }
}

export function fallbackSubstitutes(input: SubstituteInput, ctx: PlannerContext): Substitute[] {
  const from = ctx.exercises[input.exercise_id]
  if (!from) return []
  const historyIds = new Set(ctx.history.sets.map((s) => s.exercise_id))
  const gym = new Set(ctx.equipment.machine_ids)
  const out: Substitute[] = []
  for (const cand of Object.values(ctx.exercises) as ExerciseIndexEntry[]) {
    if (cand.id === from.id) continue
    if (cand.movementPattern !== from.movementPattern) continue
    if (!cand.primaryMuscles.some((m) => from.primaryMuscles.includes(m))) continue
    if (gym.size > 0 && cand.machineId && !gym.has(cand.machineId)) continue
    let score = 0
    const reasons: string[] = []
    if (cand.equipmentFamily === from.equipmentFamily) {
      score += 3
      reasons.push('same equipment family')
    }
    const shared = cand.secondaryMuscles.filter((m) => from.secondaryMuscles.includes(m)).slice(0, 2)
    for (const m of shared) {
      score += 2
      reasons.push(`shares ${m.replace(/_/g, ' ')}`)
    }
    if (historyIds.has(cand.id)) {
      score += 1
      reasons.push('has history')
    }
    if (!input.done_today.includes(cand.id)) {
      score += 1
      reasons.push('not yet today')
    }
    out.push({ exercise_id: cand.id, score, reasons })
  }
  out.sort((a, b) => b.score - a.score || a.exercise_id.localeCompare(b.exercise_id))
  return out.slice(0, input.limit)
}
