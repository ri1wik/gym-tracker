// Load prescription by double progression (PLAN.md 3.4).
//
// Reads the last completed session of the exercise. Every set at the top of
// the range adds one increment; a big step (more than 10 percent of the
// load) first raises the rep target by two; any set under the bottom counts
// a failure and two in a row drop the load 10 percent, rounded to real
// plates, with a rep-target cut when the rounding lands back on the same
// load so nothing loops. Assistance is its own positive axis: progression
// removes one stack step, regression adds one.

import { formatKg } from '../units'
import type { PrescribeInput, Prescription } from './contract'
import { BIG_STEP_RATIO, FAILURES_BEFORE_REGRESSION, REGRESSION_FACTOR, RETURN_LOAD_FACTOR } from './contract'
import { bestSetOf, sessionsOf, workingLoadOf } from './history'
import { incrementFor, roundAssist, roundLoad, stackStepFor } from './rounding'

function fill(n: number, value: number): number[] {
  return Array.from({ length: Math.max(0, n) }, () => value)
}

/** Same load: one more rep on the first set that fell short of the top; the rest hold what they did, never under the floor. */
function holdTargets(reps: readonly number[], sets: number, lo: number, hi: number): { targets: number[]; shortSet: number | null } {
  const targets: number[] = []
  let shortSet: number | null = null
  for (let i = 0; i < sets; i++) {
    const r = reps[i]
    if (r === undefined) {
      targets.push(lo)
      continue
    }
    if (r >= hi) {
      targets.push(hi)
    } else if (shortSet === null) {
      shortSet = i
      targets.push(Math.min(hi, Math.max(lo, r + 1)))
    } else {
      targets.push(Math.max(lo, r))
    }
  }
  return { targets, shortSet }
}

export function prescribe(input: PrescribeInput): Prescription {
  const { exercise, equipment } = input
  const lo = input.rep_min
  const hi = input.rep_max
  const sets = input.deload ? Math.ceil(input.sets / 2) : input.sets
  const sessions = sessionsOf(input.history, exercise.id)
  const last = sessions.length > 0 ? sessions[sessions.length - 1] : null

  if (!last) {
    return {
      target_load_g: null,
      assist_g: 0,
      target_reps: fill(sets, lo),
      load_source: 'ramp',
      failure_count: 0,
      suggested_increase: false,
      note: 'First time: work up to a set that feels like two reps left',
      last_time: null,
    }
  }

  const { load_g: L, assist_g: A } = workingLoadOf(last)
  const best = bestSetOf(last)
  const last_time = { load_g: best.load_g, reps: best.reps, date_key: last.date_key }
  const reps = last.sets.map((s) => s.reps)
  const assisted = exercise.loadType === 'assisted'
  const timed = exercise.loadType === 'time'
  const unit = timed ? 's' : ''

  // Consecutive sessions at this load with a set under the floor, latest first.
  let streak = 0
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i]
    const w = workingLoadOf(s)
    if (w.load_g !== L || w.assist_g !== A) break
    if (s.sets.some((x) => x.reps < lo)) streak++
    else break
  }

  const base = { assist_g: A, load_source: 'history' as const, failure_count: streak, suggested_increase: false, last_time }

  if (input.deload) {
    return { ...base, target_load_g: L, target_reps: fill(sets, lo), note: 'Deload: same load, half the sets, no progression' }
  }

  if (input.first_session_back) {
    if (assisted) {
      const assist = roundAssist(A + stackStepFor(exercise, equipment), exercise, equipment)
      return { ...base, target_load_g: L, assist_g: assist, target_reps: fill(sets, lo), note: 'First session back: one step more assistance' }
    }
    const load = timed ? L : roundLoad(L * RETURN_LOAD_FACTOR, exercise, equipment, 'nearest')
    return { ...base, target_load_g: load, target_reps: fill(sets, lo), note: 'First session back: loads minus 5 percent, no progression' }
  }

  if (input.intent === 'light') {
    return { ...base, target_load_g: L, target_reps: fill(sets, lo), note: 'Light session: same load, stop two reps short' }
  }

  const allTop = reps.length > 0 && reps.every((r) => r >= hi)
  const anyShort = reps.some((r) => r < lo)

  if (allTop) {
    if (timed) {
      return { ...base, target_load_g: L, failure_count: 0, target_reps: fill(sets, hi + 5), note: `Every set held ${hi} s: aim ${hi + 5} s` }
    }
    if (assisted) {
      if (A <= 0) {
        return { ...base, target_load_g: L, failure_count: 0, target_reps: fill(sets, hi), note: `Every set hit ${hi} with no assistance: try the unassisted version` }
      }
      const step = stackStepFor(exercise, equipment)
      const assist = roundAssist(A - step, exercise, equipment)
      return {
        ...base,
        target_load_g: L,
        assist_g: assist,
        failure_count: 0,
        suggested_increase: true,
        target_reps: fill(sets, lo),
        note: `Every set hit ${hi}: ${formatKg(A - assist)} kg less assistance`,
      }
    }
    const inc = incrementFor(exercise, L, equipment)
    if (inc <= 0) {
      return { ...base, target_load_g: L, failure_count: 0, target_reps: fill(sets, hi + 2), note: `Top of the ladder: same load, aim ${hi + 2}` }
    }
    const next = roundLoad(L + inc, exercise, equipment, 'nearest')
    const bigStep = L <= 0 || inc / L > BIG_STEP_RATIO
    if (bigStep) {
      const raised = hi + 2
      if (!reps.every((r) => r >= raised)) {
        return {
          ...base,
          target_load_g: L,
          failure_count: 0,
          target_reps: fill(sets, raised),
          note: `Every set hit ${hi}: aim ${raised} before the jump to ${formatKg(next)} kg`,
        }
      }
      return {
        ...base,
        target_load_g: next,
        failure_count: 0,
        suggested_increase: true,
        target_reps: fill(sets, lo),
        note: `Every set hit ${raised}: up to ${formatKg(next)} kg`,
      }
    }
    return {
      ...base,
      target_load_g: next,
      failure_count: 0,
      suggested_increase: true,
      target_reps: fill(sets, lo),
      note: `Every set hit ${hi}: up ${formatKg(next - L)} kg`,
    }
  }

  if (anyShort && streak >= FAILURES_BEFORE_REGRESSION) {
    if (assisted) {
      const assist = roundAssist(A + stackStepFor(exercise, equipment), exercise, equipment)
      return { ...base, target_load_g: L, assist_g: assist, failure_count: 0, target_reps: fill(sets, lo), note: 'Two sessions short: one step more assistance' }
    }
    if (timed) {
      const target = Math.max(5, lo - 5)
      return { ...base, target_load_g: L, failure_count: 0, target_reps: fill(sets, target), note: `Two sessions short: aim ${target} s` }
    }
    const lower = roundLoad(L * REGRESSION_FACTOR, exercise, equipment, 'nearest')
    if (lower === L) {
      const target = Math.max(1, lo - 2)
      return {
        ...base,
        target_load_g: L,
        failure_count: 0,
        target_reps: fill(sets, target),
        note: `Same load (the plates round back to it): aim ${target}, or pick a variation`,
      }
    }
    return { ...base, target_load_g: lower, failure_count: 0, target_reps: fill(sets, lo), note: `Two sessions short: down to ${formatKg(lower)} kg` }
  }

  const { targets, shortSet } = holdTargets(reps, sets, lo, hi)
  const aim = shortSet === null ? hi : targets[shortSet]
  const which = shortSet === null ? 'A set' : `Set ${shortSet + 1}`
  return {
    ...base,
    target_load_g: L,
    target_reps: targets,
    note: `${which} fell short of ${hi}${unit}: same load, aim ${aim}${unit}`,
  }
}
