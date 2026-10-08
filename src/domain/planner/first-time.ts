// First-time loads (PLAN.md 3.6): the Epley estimate of the related lift's
// best working set in its last session (reps clamped to 10), through the
// ratio table, times 0.90 for safety, rounded down to real plates, used
// directly as the target's working load with no reverse Epley step. That
// is the reading PLAN.md states and the pinned fixture holds: bench 85 x 6
// (Epley 102 kg) gives incline dumbbells 27.5 kg per hand. Machines,
// cables, the Smith machine and bodyweight moves always get the
// ramp-to-effort card instead.

import type { FirstTimeLoad, PlannerContext } from './contract'
import { FIRST_TIME_SAFETY_FACTOR } from './contract'
import { bestSetOf, lastSessionOf } from './history'
import { roundLoad } from './rounding'

export interface RatioRule {
  from: string
  ratio: number
}

/** Target exercise id to the lift it derives from and the ratio of reference loads. */
export const RATIO_TABLE: Readonly<Record<string, RatioRule>> = {
  'incline-barbell-bench-press': { from: 'barbell-bench-press', ratio: 0.8 },
  'close-grip-bench-press': { from: 'barbell-bench-press', ratio: 0.85 },
  'dumbbell-bench-press': { from: 'barbell-bench-press', ratio: 0.35 },
  'incline-dumbbell-press': { from: 'barbell-bench-press', ratio: 0.3 },
  'overhead-press': { from: 'barbell-bench-press', ratio: 0.6 },
  'seated-dumbbell-shoulder-press': { from: 'barbell-bench-press', ratio: 0.22 },
  'front-squat': { from: 'back-squat', ratio: 0.8 },
  'barbell-hip-thrust': { from: 'back-squat', ratio: 1.0 },
  'bulgarian-split-squat': { from: 'back-squat', ratio: 0.2 },
  'goblet-squat': { from: 'back-squat', ratio: 0.25 },
  'romanian-deadlift': { from: 'deadlift', ratio: 0.7 },
  'good-morning': { from: 'deadlift', ratio: 0.35 },
  'dumbbell-romanian-deadlift': { from: 'deadlift', ratio: 0.25 },
  'barbell-row': { from: 'barbell-bench-press', ratio: 0.65 },
  'dumbbell-row': { from: 'barbell-bench-press', ratio: 0.35 },
  'barbell-curl': { from: 'barbell-bench-press', ratio: 0.3 },
  'ez-bar-curl': { from: 'barbell-bench-press', ratio: 0.3 },
  'dumbbell-curl': { from: 'barbell-bench-press', ratio: 0.12 },
  'hammer-curl': { from: 'barbell-bench-press', ratio: 0.12 },
  'incline-dumbbell-curl': { from: 'barbell-bench-press', ratio: 0.1 },
  'skull-crusher': { from: 'barbell-bench-press', ratio: 0.25 },
}

export const RAMP_CARD =
  'Work up to a set of 8 that feels like 2 reps left: start at the floor, 5 reps per step, step up while it feels easy. That set becomes working set 1.'

/** Epley on the best set, reps clamped to 10 so a high-rep reference still gives a number. */
function referenceLoadG(ctx: PlannerContext, exercise_id: string): number | null {
  const session = lastSessionOf(ctx.history.sets, exercise_id)
  if (!session) return null
  const best = bestSetOf(session)
  if (best.assist_g > 0 || best.load_g <= 0) return null
  const reps = Math.min(10, Math.max(1, best.reps))
  return Math.round(best.load_g * (1 + reps / 30))
}

export function firstTimeLoad(exercise_id: string, ctx: PlannerContext): FirstTimeLoad {
  const ex = ctx.exercises[exercise_id]
  const ramp: FirstTimeLoad = { target_load_g: null, load_source: 'ramp', from_exercise_id: null, confidence: 'low', card: RAMP_CARD }
  if (!ex) return ramp
  if (ex.equipmentFamily !== 'barbell' && ex.equipmentFamily !== 'dumbbell') return ramp
  if (ex.loadType !== 'weight') return ramp
  const rule = RATIO_TABLE[exercise_id]
  if (!rule) return ramp
  const ref = referenceLoadG(ctx, rule.from)
  if (ref === null) return ramp
  const raw = ref * rule.ratio * FIRST_TIME_SAFETY_FACTOR
  const load = roundLoad(raw, ex, ctx.equipment, 'down')
  return { target_load_g: load, load_source: 'ratio', from_exercise_id: rule.from, confidence: 'medium', card: null }
}
