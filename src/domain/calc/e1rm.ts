// Estimated one-rep max by Epley: load x (1 + reps / 30).
//
// OWNER: engine-trend-review.
//
// Edge rules (docs/SPEC-review-and-screens.md, signal 6): 1 to 10 reps only,
// reps 1 returns the load, bodyweight moves use the day's body weight plus
// added load, assisted moves never get an estimate (so no percentage rule
// can make an assisted set harder by mistake), warm-ups are never passed in.

import type { LoadType } from '../types'

export const E1RM_MAX_REPS = 10

/** A load step that counts as "added weight" when reps drop (2.5 kg, the barbell increment). */
export const BEATS_MIN_STEP_G = 2500
/** Reps a set may lose and still count as progress when the load went up by a full step. */
export const BEATS_MAX_REP_DROP = 2

export interface E1rmInput {
  loadType: LoadType
  /** External load in grams (added load for bodyweight moves). */
  load_g: number
  reps: number
  /** Required for bodyweight moves; ignored otherwise. */
  body_weight_g?: number | null
}

function repsInRange(reps: number): boolean {
  return Number.isFinite(reps) && reps >= 1 && reps <= E1RM_MAX_REPS
}

/**
 * Estimated 1RM in grams, or null when the estimate is not defined: reps
 * outside 1 to E1RM_MAX_REPS, an assisted or timed load type, or a
 * bodyweight move without a body weight.
 */
export function e1rmG(input: E1rmInput): number | null {
  if (input.loadType === 'assisted' || input.loadType === 'time') return null
  if (!repsInRange(input.reps)) return null
  if (input.loadType === 'bodyweight') {
    const bw = input.body_weight_g
    if (bw == null || !Number.isFinite(bw) || bw <= 0) return null
    return epleyG(bw + input.load_g, input.reps)
  }
  return epleyG(input.load_g, input.reps)
}

/** Plain Epley on a weight-loaded set, for charts; same rep rules, null outside them. */
export function epleyG(load_g: number, reps: number): number | null {
  if (!Number.isFinite(load_g) || load_g < 0) return null
  if (!repsInRange(reps)) return null
  if (reps === 1) return Math.round(load_g)
  return Math.round(load_g * (1 + reps / 30))
}

/**
 * Did set B beat set A? More load at the same or more reps, or more reps at
 * the same load; also more load by a full step (2.5 kg) with at most two reps
 * fewer, which is double progression moving up the range. Never through the
 * e1RM alone, so 60 x 10 to 62.5 x 8 counts and 60 x 10 to 61 x 9 does not.
 */
export function beats(
  a: { load_g: number; reps: number },
  b: { load_g: number; reps: number },
  step_g: number = BEATS_MIN_STEP_G,
): boolean {
  if (b.load_g > a.load_g && b.reps >= a.reps) return true
  if (b.load_g === a.load_g && b.reps > a.reps) return true
  if (b.load_g - a.load_g >= step_g && b.reps >= a.reps - BEATS_MAX_REP_DROP && b.reps >= 1) return true
  return false
}

/** Did set B hold set A within the tolerance by estimated 1RM (the deficit-hold rule, default 5 percent)? */
export function holdsWithin(a_e1rm_g: number | null, b_e1rm_g: number | null, tolerance: number = 0.05): boolean {
  if (a_e1rm_g === null || b_e1rm_g === null || a_e1rm_g <= 0) return false
  return b_e1rm_g >= a_e1rm_g * (1 - tolerance)
}
