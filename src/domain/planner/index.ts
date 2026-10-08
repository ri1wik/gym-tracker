// The planner: one pure module that turns (program state, history, equipment
// profile, a session request) into a session plan. The rotation's next
// session and "chest and triceps, 45 minutes" are the same function with
// different inputs. No randomness, no clock: identical inputs give identical
// plans and "today" is always a day key argument.
//
// OWNER: engine-planner. The contract (types and constants) lives in
// ./contract.ts and is re-exported here so callers import one module; the
// rules live in one file each:
//   rotation.ts    next session, weekday pin, return rule, 70 percent coverage
//   prescribe.ts   double progression, big-step rep rule, regression, assistance
//   rounding.ts    equipment-aware rounding and increments
//   warmup.ts      general warm-up and ramp sets
//   substitute.ts  busy-equipment substitution scoring
//   first-time.ts  ratio table and the ramp-to-effort card
//   deload.ts      week counter, manual deload, key-lift regression
//   estimate.ts    the session time estimate
//   timebox.ts     the trimmer in its fixed order
//   cardio.ts      cardio placement rows
//   volume.ts      weekly volume projector and guard
//   builder.ts     buildCustomSession, the entry point
//
// Rules: PLAN.md 3.4 to 3.6 and docs/SPEC-programming.md, with the
// corrections in docs/SPEC-critic-fixes.md (assistance as a positive axis,
// bar floors per bar type, degenerate ramps dropped, fill-until-budget
// builder, 85 percent single only at 8 reps or fewer, 92 percent only at 5
// or fewer, cardio at 6 to 8 percent by default).

export * from './contract'
export { nextSession, pointerAfterSession, coverageOfDay, customRotationEffect, primarySetsOfDay, setCountsOf, lastTrainingDay } from './rotation'
export type { SetCount } from './rotation'
export { prescribe } from './prescribe'
export { roundLoad, roundAssist, incrementFor, stackStepFor, barFloorFor, ladderFor } from './rounding'
export { warmupsFor, generalWarmupFor, patternFamilyOf, sameRampFamily, rampRestFor } from './warmup'
export type { PatternFamily } from './warmup'
export { substitutesFor, gymHas } from './substitute'
export { firstTimeLoad, RATIO_TABLE, RAMP_CARD } from './first-time'
export type { RatioRule } from './first-time'
export { deloadStatus, deloadEveryWeeks, deloadWeekIndex, keyLiftIds, weeklyBestEstimates, isRegressing } from './deload'
export { estimateMinutes, planSeconds, exerciseSeconds } from './estimate'
export { applyTimebox, SUPERSET_PAIRS } from './timebox'
export { cardioRowFor, isLegsSession, isLegsDay } from './cardio'
export { projectWeeklySets, volumeGuard, bandFor, defaultExerciseFor } from './volume'
export type { VolumeSuggestion } from './volume'
export { expandFocus, focusName, GROUP_PATTERNS, COMPOUND_PATTERNS, EXERCISE_CAP, compoundCap } from './focus'
export type { PatternSlot } from './focus'
export { buildCustomSession, slotScheme, whyFor, pickForSlot } from './builder'
export type { Slot, SlotRole } from './builder'
