// Estimated one-rep max by Epley: load x (1 + reps / 30).
//
// OWNER: engine-trend-review. Stub until that slice lands.
//
// Edge rules (docs/SPEC-review-and-screens.md, signal 6): 1 to 10 reps only,
// reps 1 returns the load, bodyweight moves use the day's body weight plus
// added load, assisted moves never get an estimate (so no percentage rule
// can make an assisted set harder by mistake), warm-ups are never passed in.

import type { LoadType } from '../types'

export const E1RM_MAX_REPS = 10

export interface E1rmInput {
  loadType: LoadType
  /** External load in grams (added load for bodyweight moves). */
  load_g: number
  reps: number
  /** Required for bodyweight moves; ignored otherwise. */
  body_weight_g?: number | null
}

/**
 * Estimated 1RM in grams, or null when the estimate is not defined: reps
 * outside 1 to E1RM_MAX_REPS, an assisted or timed load type, or a
 * bodyweight move without a body weight.
 */
export function e1rmG(_input: E1rmInput): number | null {
  throw new Error('not implemented: e1rmG')
}

/** Plain Epley on a weight-loaded set, for charts; same rep rules, null outside them. */
export function epleyG(_load_g: number, _reps: number): number | null {
  throw new Error('not implemented: epleyG')
}

/**
 * Did set B beat set A? More load at the same or more reps, or more reps at
 * the same load (never through the e1RM alone, so 60 x 10 to 62.5 x 8 counts
 * and 60 x 10 to 61 x 9 does not).
 */
export function beats(_a: { load_g: number; reps: number }, _b: { load_g: number; reps: number }): boolean {
  throw new Error('not implemented: beats')
}
