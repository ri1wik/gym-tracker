// Warm-up generator (PLAN.md 3.5): the general warm-up keyed to the first
// pattern and ramp sets from the prescribed first working load, rounded to
// real plates, with degenerate ramps dropped.

import type { MovementPattern } from '../types'
import type { GeneralWarmup, MobilityDrill, WarmupInput, WarmupRamp } from './contract'
import { barFloorFor, roundAssist, roundLoad } from './rounding'

export const GENERAL_WARMUP_MINUTES = 5
export const GENERAL_WARMUP_MINUTES_SHORT = 3
export const RAMP_REST_SHORT_S = 45
export const RAMP_REST_LONG_S = 60
/** Dumbbells at or under this per hand get one ramp only. */
export const LIGHT_DUMBBELL_G = 12_500
/** Working loads at or above this get the full barbell ramp. */
export const BARBELL_HEAVY_G = 60_000
export const BARBELL_MID_G = 40_000
/** The 85 percent single only when the working reps are at most this. */
export const SINGLE_85_MAX_REPS = 8
/** The 92 percent single only when the working reps are at most this. */
export const SINGLE_92_MAX_REPS = 5
/** Assisted ramps use this much more assistance than the working set. */
export const ASSIST_RAMP_FACTOR = 1.5

export type PatternFamily = 'push' | 'vertical_push' | 'pull' | 'squat' | 'hinge' | 'other'

/** Coarser than the pattern: incline dumbbells after the bench press share a family, a row after the bench does not. */
export function patternFamilyOf(p: MovementPattern): PatternFamily {
  switch (p) {
    case 'horizontal_push':
    case 'incline_push':
      return 'push'
    case 'vertical_push':
      return 'vertical_push'
    case 'horizontal_pull':
    case 'vertical_pull':
    case 'pullover':
      return 'pull'
    case 'squat':
    case 'lunge':
    case 'knee_extension':
      return 'squat'
    case 'hinge':
    case 'hip_thrust':
    case 'knee_flexion':
      return 'hinge'
    default:
      return 'other'
  }
}

/** Push and vertical push ramp as one family for the "second compound" rule. */
export function sameRampFamily(a: MovementPattern, b: MovementPattern): boolean {
  const fa = patternFamilyOf(a)
  const fb = patternFamilyOf(b)
  const push = (f: PatternFamily) => f === 'push' || f === 'vertical_push'
  if (push(fa) && push(fb)) return true
  return fa !== 'other' && fa === fb
}

const DRILLS: Record<PatternFamily, MobilityDrill[]> = {
  push: [
    { name: 'Band pull-aparts', dose: 'x15' },
    { name: 'Scapular push-ups', dose: 'x10' },
    { name: 'Band dislocates', dose: 'x10' },
  ],
  vertical_push: [
    { name: 'Band pull-aparts', dose: 'x15' },
    { name: 'Wall slides', dose: 'x10' },
    { name: 'Band dislocates', dose: 'x10' },
  ],
  pull: [
    { name: 'Dead hang', dose: '2 x 20 s' },
    { name: 'Scapular pull-ups', dose: 'x8' },
    { name: 'Cat-cow', dose: 'x8' },
  ],
  squat: [
    { name: 'Bodyweight squats', dose: 'x10' },
    { name: '90/90 hip switches', dose: 'x6 per side' },
    { name: 'Ankle rocks', dose: 'x10 per side' },
  ],
  hinge: [
    { name: 'Glute bridges', dose: 'x12' },
    { name: 'Dowel hinge', dose: 'x10' },
    { name: 'Cat-cow', dose: 'x8' },
  ],
  other: [
    { name: 'Band pull-aparts', dose: 'x15' },
    { name: 'Arm circles', dose: 'x10 per side' },
  ],
}

export function generalWarmupFor(firstPattern: MovementPattern | null, minutes: number = GENERAL_WARMUP_MINUTES): GeneralWarmup {
  const family = firstPattern ? patternFamilyOf(firstPattern) : 'other'
  return {
    cardio: `${minutes} min incline walk, 3 percent, 5 km/h`,
    minutes,
    drills: DRILLS[family].map((d) => ({ ...d })),
  }
}

export function rampRestFor(reps: number): number {
  return reps >= 5 ? RAMP_REST_SHORT_S : RAMP_REST_LONG_S
}

function ramp(label: string, load_g: number, reps: number, assist_g = 0): WarmupRamp {
  return { label, load_g, assist_g, reps, rest_s: rampRestFor(reps) }
}

/**
 * Ramp sets for one exercise. Rules: barbell at 60 kg or more gets bar x10,
 * 50 percent x5, 70 percent x3, then 85 percent x1 only at 8 working reps or
 * fewer and 92 percent x1 only at 5 or fewer; 40 to 60 kg gets bar x10, 60
 * percent x5, 80 percent x2; under 40 gets bar x8, 70 percent x3. Dumbbell
 * and machine compounds get 50 percent x8 and 75 percent x3 (one ramp for
 * light dumbbells). A second compound of the same family gets one 70
 * percent x3. The first isolation for a muscle gets a 60 percent x8 feel
 * set. Any ramp that rounds to at or below the previous ramp, or to at or
 * above the working load, is dropped. Assisted ramps only ever add assistance.
 */
export function warmupsFor(input: WarmupInput): WarmupRamp[] {
  const { exercise: ex, equipment, working_reps } = input
  const W = input.working_load_g

  if (ex.loadType === 'time') return []

  if (ex.loadType === 'assisted') {
    if (!ex.isCompound) return []
    const assist = roundAssist(input.working_assist_g * ASSIST_RAMP_FACTOR, ex, equipment, 'up')
    if (assist <= input.working_assist_g) return []
    return [ramp('More assist', 0, 5, assist)]
  }

  if (ex.loadType === 'bodyweight') {
    if (!ex.isCompound || W <= 0) return []
    return [ramp('Bodyweight', 0, 5)]
  }

  const at = (pct: number) => roundLoad(W * pct, ex, equipment, 'nearest')
  let ramps: WarmupRamp[]

  if (!ex.isCompound) {
    if (!input.first_isolation_for_muscle) return []
    ramps = [ramp('Feel set', at(0.6), 8)]
  } else if (input.second_compound_same_pattern) {
    ramps = [ramp('70%', at(0.7), 3)]
  } else if (ex.equipmentFamily === 'barbell') {
    const bar = barFloorFor(ex, equipment)
    if (W >= BARBELL_HEAVY_G) {
      ramps = [ramp('Bar', bar, 10), ramp('50%', at(0.5), 5), ramp('70%', at(0.7), 3)]
      if (working_reps <= SINGLE_85_MAX_REPS) ramps.push(ramp('85%', at(0.85), 1))
      if (working_reps <= SINGLE_92_MAX_REPS) ramps.push(ramp('92%', at(0.92), 1))
    } else if (W >= BARBELL_MID_G) {
      ramps = [ramp('Bar', bar, 10), ramp('60%', at(0.6), 5), ramp('80%', at(0.8), 2)]
    } else {
      ramps = [ramp('Bar', bar, 8), ramp('70%', at(0.7), 3)]
    }
  } else {
    const light = ex.equipmentFamily === 'dumbbell' && W <= LIGHT_DUMBBELL_G
    ramps = light ? [ramp('50%', at(0.5), 8)] : [ramp('50%', at(0.5), 8), ramp('75%', at(0.75), 3)]
  }

  const out: WarmupRamp[] = []
  let prev = 0
  for (const r of ramps) {
    if (r.load_g <= prev || r.load_g >= W) continue
    out.push(r)
    prev = r.load_g
  }
  return out
}
