// The six weekly signals (PLAN.md section 6, docs/SPEC-review-and-screens.md).
// Each returns a status, the number, one sentence naming it and one action.
// Thresholds and messages are listed in docs/REVIEW-RULES.md; keep the two
// in step.

import type { BodyPart, CardioSession, FoodLog, MealSlot, WorkoutSet } from '../types'
import { BODY_PARTS } from '../types'
import type { Goal } from '../calc/targets'
import { beats, e1rmG, holdsWithin } from '../calc/e1rm'
import { isWorkingCompleted, weeklySetsByBodyPart } from '../calc/volume'
import { kgPerWeek } from '../calc/trend'
import { fmtCmAbs, fmtPctAbs, fmtSet, labelOf, plural, round1 } from './format'
import { loggingCheckNeeded, daysUnderFloor } from './guardrails'
import type { ProteinFoodOption, ReviewRecords, Signal, SignalCode } from './types'
import { SETS_BAND, SIGNAL_TITLE, UNFLAGGED_PARTS } from './types'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function make(code: SignalCode, s: Omit<Signal, 'code' | 'title' | 'unlock' | 'detail'> & Partial<Signal>): Signal {
  return { code, title: SIGNAL_TITLE[code], unlock: null, detail: null, ...s }
}

export function finishedWorkouts(r: ReviewRecords) {
  return r.workouts.filter((w) => w.status === 'finished' && w.deleted_at === null)
}

function countable(sets: readonly WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => s.deleted_at === null && isWorkingCompleted(s))
}

// ---------------------------------------------------------------------------
// Lifts comparison, shared by signal 6 and the recomposition marker
// ---------------------------------------------------------------------------

export interface LiftComparison {
  exercise_id: string
  name: string
  prev: { load_g: number; reps: number; e1rm_g: number | null }
  curr: { load_g: number; reps: number; e1rm_g: number | null }
  progressed: boolean
  held: boolean
}

function bestSet(sets: readonly WorkoutSet[], loadType: 'weight' | 'bodyweight', bodyWeight: number | null) {
  let best: { load_g: number; reps: number; e1rm_g: number | null } | null = null
  for (const s of sets) {
    const load = s.load_g ?? 0
    const reps = s.reps ?? 0
    const e = e1rmG({ loadType, load_g: load, reps, body_weight_g: bodyWeight })
    const cand = { load_g: load, reps, e1rm_g: e }
    if (!best) {
      best = cand
      continue
    }
    if (e !== null && best.e1rm_g !== null) {
      if (e > best.e1rm_g) best = cand
    } else if (load > best.load_g || (load === best.load_g && reps > best.reps)) {
      best = cand
    }
  }
  return best
}

/** Every exercise logged this week that has a previous session in the 4-week window, compared best set to best set. */
export function compareLifts(r: ReviewRecords): LiftComparison[] {
  const weekWorkoutIds = new Set(r.workouts.map((w) => w.id))
  const weekSetIds = new Set(r.sets.map((s) => s.id))
  const bodyWeightByWorkout = new Map(r.workouts.map((w) => [w.id, w.body_weight_g] as const))
  const thisWeek = countable(r.sets)
  const previous = countable(r.sets_4w).filter((s) => !weekWorkoutIds.has(s.workout_id) && !weekSetIds.has(s.id))

  const byExercise = new Map<string, WorkoutSet[]>()
  for (const s of thisWeek) {
    const list = byExercise.get(s.exercise_id) ?? []
    list.push(s)
    byExercise.set(s.exercise_id, list)
  }
  const out: LiftComparison[] = []
  for (const [exerciseId, sets] of byExercise) {
    const ex = r.exercises[exerciseId]
    if (!ex || ex.loadType === 'assisted' || ex.loadType === 'time') continue
    const prevSets = previous.filter((s) => s.exercise_id === exerciseId)
    if (prevSets.length === 0) continue
    // The most recent previous session: the workout holding the latest completed set.
    let lastWorkout: string | null = null
    let lastStamp = ''
    for (const s of prevSets) {
      const stamp = s.completed_at ?? ''
      if (stamp >= lastStamp) {
        lastStamp = stamp
        lastWorkout = s.workout_id
      }
    }
    const prevBest = bestSet(
      prevSets.filter((s) => s.workout_id === lastWorkout),
      ex.loadType,
      null,
    )
    // This week's best set, with the day's body weight where the workout recorded one.
    const currBest = bestSet(
      sets,
      ex.loadType,
      sets.map((s) => bodyWeightByWorkout.get(s.workout_id) ?? null).find((b) => b != null) ?? null,
    )
    if (!prevBest || !currBest) continue
    const progressed = beats(prevBest, currBest)
    const held = progressed || holdsWithin(prevBest.e1rm_g, currBest.e1rm_g) || (currBest.load_g >= prevBest.load_g * 0.95 && currBest.reps >= prevBest.reps)
    out.push({ exercise_id: exerciseId, name: ex.name, prev: prevBest, curr: currBest, progressed, held })
  }
  return out
}

// ---------------------------------------------------------------------------
// Signal 1: weight trend
// ---------------------------------------------------------------------------

export const FLAT_GRACE_WEEKS: Record<Goal, number> = { recomp: 4, fat_loss: 2, maintain: 99, lean_gain: 2 }
export const WAIST_MARKER_MM = 5
export const MARKER_MAX_RATE_PCT = 0.5

/** Waist change in millimetres over the readings passed (last minus first), or null without two readings. */
export function waistChangeMm(weighIns: readonly { date_key: string; waist_mm: number | null }[]): number | null {
  const withWaist = weighIns.filter((w) => w.waist_mm != null).sort((a, b) => (a.date_key < b.date_key ? -1 : a.date_key > b.date_key ? 1 : 0))
  if (withWaist.length < 2) return null
  const first = withWaist[0]
  const last = withWaist[withWaist.length - 1]
  if (first.date_key === last.date_key) return null
  return (last.waist_mm as number) - (first.waist_mm as number)
}

export interface RecompMarker {
  fires: boolean
  waist_change_mm: number | null
  lifts_progressed: number
  lifts_comparable: number
}

/**
 * The recomposition marker: a flat or slightly rising scale with the waist
 * down 0.5 cm or more, or at least half of the comparable lifts up, in the
 * same four weeks.
 */
export function recompositionMarker(r: ReviewRecords, lifts: readonly LiftComparison[]): RecompMarker {
  const t = r.trend
  const waist = waistChangeMm(r.weigh_ins_4w ?? r.weigh_ins)
  const progressed = lifts.filter((l) => l.progressed).length
  const comparable = lifts.length
  const flatOrSlightlyUp =
    (t.band === 'flat' || t.band === 'gaining') && t.rate_pct_per_week !== null && t.rate_pct_per_week < MARKER_MAX_RATE_PCT
  const waistDown = waist !== null && waist <= -WAIST_MARKER_MM
  const liftsUp = comparable >= 2 && progressed * 2 >= comparable
  return { fires: flatOrSlightlyUp && (waistDown || liftsUp), waist_change_mm: waist, lifts_progressed: progressed, lifts_comparable: comparable }
}

function goalBandName(goal: Goal): string {
  return goal === 'fat_loss' ? 'fat-loss' : goal === 'lean_gain' ? 'lean-gain' : goal === 'maintain' ? 'maintenance' : 'recomposition'
}

export function weightSignal(r: ReviewRecords, goal: Goal, proteinTargetG: number, lifts: readonly LiftComparison[]): Signal {
  const code: SignalCode = 'weight_trend'
  const t = r.trend
  const protein = `${proteinTargetG} g`

  if (t.band === 'collecting' || t.rate_pct_per_week === null) {
    const n = t.readings_count
    const need = Math.max(t.readings_needed, 1)
    return make(code, {
      status: 'to_unlock',
      number: `${n} of 4`,
      sentence: `Collecting: ${n} of 4 weigh-ins; the trend verdict starts once 4 readings span 12 days.`,
      action: 'Weigh in on your next check-in morning, same conditions.',
      unlock: `Weigh in ${need} more ${plural(need, 'time')} to unlock the trend signal.`,
    })
  }

  const rate = t.rate_pct_per_week
  const pct = fmtPctAbs(rate)
  const n = t.window_readings ?? t.readings_count
  const expected = t.readings_expected

  if (t.band === 'not_yet_precise') {
    const need = Math.max(t.readings_needed, 1)
    const dir = t.direction === 'unknown' ? 'flat' : t.direction
    return make(code, {
      status: 'neutral',
      number: `${n} of ${expected}`,
      sentence: `Direction: ${dir}, not yet precise, ${n} of ${expected} readings (about ${pct} per week so far).`,
      action: `Keep weighing in; ${need} more ${plural(need, 'reading')} sharpen the verdict.`,
      detail: { readings: n, expected },
    })
  }

  const marker = recompositionMarker(r, lifts)
  const flatWeeks = Math.max(r.flat_weeks ?? 1, 1)
  if (marker.fires && goal !== 'lean_gain') {
    const parts: string[] = []
    if (marker.waist_change_mm !== null && marker.waist_change_mm <= -WAIST_MARKER_MM) parts.push(`waist is down ${fmtCmAbs(marker.waist_change_mm)}`)
    if (marker.lifts_comparable >= 2 && marker.lifts_progressed * 2 >= marker.lifts_comparable)
      parts.push(`${marker.lifts_progressed} of ${marker.lifts_comparable} lifts went up`)
    return make(code, {
      status: 'positive',
      number: `${fmtPctAbs(rate)} flat`,
      sentence: `Scale flat for ${flatWeeks} ${plural(flatWeeks, 'week')}, but ${parts.join(' and ')}. That is recomposition working.`,
      action: 'Change nothing for the next 2 weeks; keep intake and the program as they are.',
      detail: { waist_change_mm: marker.waist_change_mm ?? 0, lifts_progressed: marker.lifts_progressed, lifts_comparable: marker.lifts_comparable },
    })
  }

  const detail = { rate_pct_per_week: round1(rate * 100) / 100, readings: n }

  if (goal === 'lean_gain') {
    switch (t.band) {
      case 'on_track':
        return make(code, { status: 'positive', number: `+${pct}`, sentence: `Trend up ${pct} per week, inside the lean-gain band.`, action: 'Keep intake where it is and weigh in 2 more times this week.', detail })
      case 'flat':
        return make(code, { status: 'neutral', number: `${pct} flat`, sentence: `Scale flat at ${pct} per week on a lean-gain goal.`, action: 'Add 100 to 150 kcal a day, mostly carbohydrate around training.', detail })
      case 'too_fast':
      case 'gaining':
        return make(code, { status: 'attention', number: `+${pct}`, sentence: `Trend up ${pct} per week, faster than muscle can be built.`, action: `Drop 100 to 150 kcal a day and keep protein at ${protein}.`, detail })
      case 'slow_down':
        return make(code, { status: 'attention', number: `-${pct}`, sentence: `Scale down ${pct} per week on a lean-gain goal.`, action: `Add 150 to 250 kcal a day and keep protein at ${protein}.`, detail })
      default:
        break
    }
  }

  switch (t.band) {
    case 'slow_down':
      return make(code, { status: 'attention', number: `-${pct}`, sentence: `Dropping ${pct} per week, past the 1.5% slow-down line.`, action: `Slow down: add 200 to 300 kcal a day and keep protein at ${protein}.`, detail })
    case 'too_fast':
      return make(code, { status: 'attention', number: `-${pct}`, sentence: `Dropping ${pct} per week, faster than muscle can be protected.`, action: `Add 150 to 250 kcal a day, keep protein at ${protein} and keep lifting heavy.`, detail })
    case 'on_track':
      if (goal === 'maintain') {
        return make(code, { status: 'neutral', number: `-${pct}`, sentence: `Trend down ${pct} per week on a maintenance goal.`, action: 'Add 100 to 150 kcal a day if the drop continues for 2 more weeks.', detail })
      }
      return make(code, { status: 'positive', number: `-${pct}`, sentence: `Trend down ${pct} per week, inside the ${goalBandName(goal)} band.`, action: 'Keep intake where it is and weigh in 2 more times this week.', detail })
    case 'gaining':
      return make(code, { status: 'attention', number: `+${pct}`, sentence: `Trend up ${pct} per week on a ${goalBandName(goal)} goal.`, action: 'Drop 100 to 150 kcal a day and re-check in 2 weeks.', detail })
    case 'flat':
    default: {
      if (goal === 'maintain') {
        return make(code, { status: 'positive', number: `${pct} flat`, sentence: `Trend within 0.25% per week: weight is holding.`, action: 'Keep intake where it is for another 4 weeks.', detail })
      }
      const grace = FLAT_GRACE_WEEKS[goal]
      if (flatWeeks >= grace) {
        return make(code, {
          status: 'attention',
          number: `${pct} flat`,
          sentence: `Scale and lifts flat for ${flatWeeks} weeks.`,
          action: 'Drop 100 to 150 kcal a day or add one 25-minute incline walk, then re-check in 2 weeks.',
          detail: { ...detail, flat_weeks: flatWeeks },
        })
      }
      return make(code, {
        status: 'neutral',
        number: `${pct} flat`,
        sentence: `Scale flat at ${pct} per week, flat week ${flatWeeks} of ${grace} before a change is due.`,
        action: 'Hold intake and log your waist at the next check-in.',
        detail: { ...detail, flat_weeks: flatWeeks },
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Signal 2: sessions
// ---------------------------------------------------------------------------

export function sessionsSignal(r: ReviewRecords): Signal {
  const code: SignalCode = 'sessions'
  const done = finishedWorkouts(r).length
  const planned = r.planned_sessions
  const prev = r.sessions_prev_weeks ?? []
  const done4 = done + prev.reduce((a, w) => a + w.done, 0)
  const planned4 = planned + prev.reduce((a, w) => a + w.planned, 0)
  const detail = { done, planned, done_4w: done4, planned_4w: planned4 }

  if (r.deload_week) {
    return make(code, { status: 'neutral', number: `${done} of ${planned}`, sentence: `Deload week: ${done} of ${planned} lighter sessions done.`, action: 'Keep loads easy this week and return to full sets next week.', detail })
  }
  if (done === 0) {
    // No missed-day numbers anywhere (PLAN.md section 9): the week's tally, never the length of the gap.
    return make(code, { status: 'attention', number: `0 of ${planned}`, sentence: `0 of ${planned} sessions this week.`, action: 'Start the shortest template today.', detail })
  }
  if (planned <= 0) {
    return make(code, { status: 'neutral', number: `${done}`, sentence: `${done} ${plural(done, 'session')} this week with no weekly target set.`, action: 'Pick a template so next week has a target to count against.', detail })
  }
  const ratio = done / planned
  if (ratio >= 0.9) {
    // No run counts (docs/SPEC-retention-priority.md): a week that matches the one before says so, and nothing more.
    const last = prev[0]
    const tail = last && last.planned > 0 && last.done / last.planned >= 0.9 ? ' Same as last week.' : ''
    return make(code, { status: 'positive', number: `${done} of ${planned}`, sentence: `${done} of ${planned} sessions.${tail}`, action: 'Keep the same training days next week.', detail })
  }
  if (ratio >= 0.7) {
    const keep = Math.min(done, 2)
    return make(code, { status: 'neutral', number: `${done} of ${planned}`, sentence: `${done} of ${planned} sessions.`, action: `Keep the same ${keep === 1 ? 'training day' : `${keep} training days`} next week.`, detail })
  }
  const keep = Math.min(planned, 2)
  return make(code, {
    status: 'attention',
    number: `${done} of ${planned}`,
    sentence: `${done} of ${planned} sessions.`,
    action: `Consistency beats the perfect programme; pick the ${keep} ${plural(keep, 'day')} you never miss and protect ${keep === 1 ? 'it' : 'them'}.`,
    detail,
  })
}

// ---------------------------------------------------------------------------
// Signal 3: working sets per body part
// ---------------------------------------------------------------------------

export const SETS_MIN_SESSIONS = 2

const ADD_SLOT: Record<BodyPart, string> = {
  chest: 'incline dumbbell press',
  back: 'lat pulldown or row',
  shoulders: 'lateral raise',
  biceps: 'curl',
  triceps: 'pushdown',
  forearms: 'wrist curl',
  quads: 'leg press or squat',
  hamstrings: 'RDL or leg curl',
  glutes: 'hip thrust',
  calves: 'calf raise',
  core: 'cable crunch',
}

export function setsBand(r: ReviewRecords): { lo: number; hi: number; floor: number } {
  if (r.minimal_split) return { lo: SETS_BAND.minimal_lo, hi: SETS_BAND.minimal_hi, floor: SETS_BAND.minimal_lo }
  const floor = r.deficit_fraction > 0 ? SETS_BAND.deficit_floor : SETS_BAND.lo
  return { lo: SETS_BAND.lo, hi: SETS_BAND.hi, floor }
}

export function setsSignal(r: ReviewRecords): Signal {
  const code: SignalCode = 'sets_by_body_part'
  const sessions = finishedWorkouts(r).length
  const totals = weeklySetsByBodyPart(
    r.sets.filter((s) => s.deleted_at === null),
    r.exercises,
  )
  const detail: Record<string, number> = {}
  for (const p of BODY_PARTS) detail[p] = totals[p]

  if (sessions < SETS_MIN_SESSIONS) {
    const need = SETS_MIN_SESSIONS - sessions
    return make(code, {
      status: 'to_unlock',
      number: `${sessions} of ${SETS_MIN_SESSIONS} sessions`,
      sentence: `Sets per body part unlocks after ${SETS_MIN_SESSIONS} logged sessions in the week; ${sessions} so far.`,
      action: 'Log your next session to unlock this row.',
      unlock: `Log ${need} more ${plural(need, 'session')} this week to unlock the sets signal.`,
      detail,
    })
  }

  const band = setsBand(r)
  const flaggable = BODY_PARTS.filter((p) => !UNFLAGGED_PARTS.includes(p))
  const listing = flaggable.map((p) => `${labelOf(p)} ${Math.round(totals[p])}`).join(', ')
  const lows = flaggable.filter((p) => totals[p] < band.floor).sort((a, b) => totals[a] - totals[b])
  const highs = flaggable.filter((p) => totals[p] > band.hi).sort((a, b) => totals[b] - totals[a])

  if (r.minimal_split) {
    const inBand = lows.length === 0 && highs.length === 0
    return make(code, {
      status: inBand ? 'positive' : 'neutral',
      number: `${band.lo} to ${band.hi}`,
      sentence: `${listing}: the minimal split runs a ${band.lo} to ${band.hi} band by design.`,
      action: inBand ? 'Keep the 2 full-body sessions 72 hours apart.' : 'Keep the 2 full-body sessions; volume returns with the full split.',
      detail,
    })
  }

  if (lows.length > 0) {
    const p = lows[0]
    const sets = Math.round(totals[p])
    const prev = r.sets_prev_week?.[p]
    const twoWeeks = prev != null && prev < band.floor ? ' for 2 weeks' : ''
    const more = lows.length > 1 ? ` and ${lows.length - 1} more ${plural(lows.length - 1, 'part')} under it` : ''
    return make(code, {
      status: 'attention',
      number: `${labelOf(p)} ${sets}`,
      sentence: `${labelOf(p)} ${sets} ${plural(sets, 'set')}, under the ${band.floor}-set floor${twoWeeks}${more}.`,
      action: `Add one ${ADD_SLOT[p]} slot; 3 sets twice a week is enough to start.`,
      detail,
    })
  }
  if (highs.length > 0) {
    const p = highs[0]
    const sets = Math.round(totals[p])
    return make(code, {
      status: 'attention',
      number: `${labelOf(p)} ${sets}`,
      sentence: `${labelOf(p)} ${sets} sets, above the ${band.hi}-set band.`,
      action: `More is not working; drop to ${band.hi - 2} and push the reps.`,
      detail,
    })
  }
  return make(code, {
    status: 'positive',
    number: `${band.lo} to ${band.hi}`,
    sentence: `${listing}: every part in the ${band.lo} to ${band.hi} band.`,
    action: 'Keep this spread next week.',
    detail,
  })
}

// ---------------------------------------------------------------------------
// Signal 4: protein days hit
// ---------------------------------------------------------------------------

export const PROTEIN_MIN_DAYS = 4
export const PROTEIN_HIT_SHARE = 0.9
const SLOT_SHARE: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.3, dinner: 0.3, snack: 0.15 }
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** Grams of protein and kcal per day and per slot from the logs' frozen panels. */
export function foodTotals(logs: readonly FoodLog[]) {
  const proteinByDay: Record<string, number> = {}
  const kcalByDay: Record<string, number> = {}
  const proteinBySlot: Record<MealSlot, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
  for (const l of logs) {
    if (l.deleted_at !== null) continue
    const factor = l.grams / 100
    const proteinG = ((l.n_snapshot.protein ?? 0) * factor) / 1000
    const kcal = (l.n_snapshot.energy_kcal ?? 0) * factor
    proteinByDay[l.date_key] = (proteinByDay[l.date_key] ?? 0) + proteinG
    kcalByDay[l.date_key] = (kcalByDay[l.date_key] ?? 0) + kcal
    proteinBySlot[l.meal] += proteinG
  }
  return { proteinByDay, kcalByDay, proteinBySlot, days: Object.keys(proteinByDay).sort() }
}

function suggestFood(gapG: number, foods: readonly ProteinFoodOption[] | undefined): { text: string; addsG: number } {
  const own = (foods ?? []).find((f) => f.protein_mg_per_100g > 0)
  if (own) {
    const perG = own.protein_mg_per_100g / 100000
    let grams = Math.ceil(gapG / perG / 10) * 10
    grams = Math.max(Math.min(grams, own.portion_g * 3, 400), Math.min(own.portion_g, 50))
    return { text: `${grams} g ${own.name}`, addsG: Math.round(grams * perG) }
  }
  return { text: '250 g Greek yogurt, 4 eggs or 150 g paneer', addsG: 25 }
}

export function proteinSignal(r: ReviewRecords): { signal: Signal; logging_check: string | null } {
  const code: SignalCode = 'protein'
  const target = r.protein_target_g
  const totals = foodTotals(r.food_logs)
  const logged = totals.days.length

  if (logged < PROTEIN_MIN_DAYS) {
    const need = PROTEIN_MIN_DAYS - logged
    return {
      signal: make(code, {
        status: 'to_unlock',
        number: `${logged} of ${PROTEIN_MIN_DAYS} days`,
        sentence: `Protein unlocks at ${PROTEIN_MIN_DAYS} logged days; ${logged} logged so far.`,
        action: 'Log tomorrow from breakfast on to move the count.',
        unlock: `Log ${need} more ${plural(need, 'day')} of food this week to unlock the protein signal.`,
      }),
      logging_check: null,
    }
  }

  const hit = totals.days.filter((d) => totals.proteinByDay[d] >= PROTEIN_HIT_SHARE * target).length
  const avg = Math.round(totals.days.reduce((a, d) => a + totals.proteinByDay[d], 0) / logged)
  const ratio = hit / logged

  // Slot with the biggest average gap against its share of the target.
  let worst: MealSlot = 'breakfast'
  let worstGap = -Infinity
  for (const slot of SLOTS) {
    const slotAvg = totals.proteinBySlot[slot] / logged
    const gap = SLOT_SHARE[slot] * target - slotAvg
    if (gap > worstGap) {
      worstGap = gap
      worst = slot
    }
  }
  const slotAvg = Math.round(totals.proteinBySlot[worst] / logged)
  const food = suggestFood(Math.max(worstGap, 10), r.foods)
  const gapAction = `Biggest gap is ${worst} at ${slotAvg} g: ${food.text} takes it to ${slotAvg + food.addsG} g.`

  const floor = r.calorie_floor_kcal ?? null
  const underDays = floor ? daysUnderFloor(totals.kcalByDay, floor).length : 0
  const check = floor && loggingCheckNeeded(totals.kcalByDay, floor)
    ? `Logged intake sat under the ${floor} kcal floor on ${underDays} days. Check that every meal was logged before reading the calorie line.`
    : null

  const sentence = `Protein hit ${hit} of ${logged} days, average ${avg} g against ${target} g.`
  const detail = { hit, logged, average_g: avg, target_g: target }
  let signal: Signal
  if (ratio >= 0.7 && !check) {
    signal = make(code, { status: 'positive', number: `${hit} of ${logged}`, sentence, action: 'Keep the same meals next week.', detail })
  } else if (ratio >= 0.5 || (ratio >= 0.7 && check)) {
    signal = make(code, { status: 'neutral', number: `${hit} of ${logged}`, sentence, action: gapAction, detail })
  } else {
    signal = make(code, { status: 'attention', number: `${hit} of ${logged}`, sentence, action: gapAction, detail })
  }
  return { signal, logging_check: check }
}

// ---------------------------------------------------------------------------
// Signal 5: cardio minutes
// ---------------------------------------------------------------------------

export const CARDIO_DEFAULT_TARGET_S = 150 * 60
export const CARDIO_KM_JUMP = 0.15
export const CARDIO_MAX_MIN = 300

export function cardioTotals(sessions: readonly CardioSession[]) {
  let seconds = 0
  let runM = 0
  let vertical = 0
  let hard = 0
  let count = 0
  for (const c of sessions) {
    if (c.deleted_at !== null) continue
    count += 1
    seconds += c.duration_s
    if ((c.kind === 'run_outdoor' || c.kind === 'run_treadmill') && c.distance_m) runM += c.distance_m
    if (c.speed_m_per_h && c.incline_tenths_pct) {
      vertical += ((c.speed_m_per_h * c.duration_s) / 3600) * (c.incline_tenths_pct / 1000)
    }
    if ((c.effort ?? 0) >= 8 || c.run_type === 'tempo' || c.run_type === 'intervals') hard += 1
  }
  return { minutes: Math.round(seconds / 60), run_km: round1(runM / 1000), vertical_m: Math.round(vertical), hard, sessions: count }
}

export function cardioSignal(r: ReviewRecords, cardioTargetS: number): Signal {
  const code: SignalCode = 'cardio'
  if (r.weeks_of_use != null && r.weeks_of_use < 2) {
    return make(code, {
      status: 'to_unlock',
      number: `week ${Math.max(r.weeks_of_use, 1)} of 2`,
      sentence: `Cardio speaks from the second week of use; this is week ${Math.max(r.weeks_of_use, 1)}.`,
      action: 'Log each cardio session as you do it.',
      unlock: 'Log 1 more week to unlock the cardio signal.',
    })
  }
  const target = Math.round((cardioTargetS > 0 ? cardioTargetS : CARDIO_DEFAULT_TARGET_S) / 60)
  const now = cardioTotals(r.cardio)
  const prev = cardioTotals(r.cardio_prev_week)
  const detail = { minutes: now.minutes, target_min: target, sessions: now.sessions, run_km: now.run_km, vertical_m: now.vertical_m, prev_run_km: prev.run_km, prev_vertical_m: prev.vertical_m }
  const ratio = now.minutes / target

  if (ratio > 2 || now.minutes > CARDIO_MAX_MIN) {
    const hardNote = now.hard > 0 ? ` with ${now.hard} hard ${plural(now.hard, 'session')}` : ''
    return make(code, {
      status: 'attention',
      number: `${now.minutes} min`,
      sentence: `${now.minutes} minutes against a ${target}-minute target${hardNote}.`,
      action: `Pull back toward ${Math.round(target * 1.2)} minutes and keep one hard session.`,
      detail,
    })
  }
  if (ratio < 0.6) {
    const walks = Math.max(Math.ceil((target - now.minutes) / 25), 1)
    return make(code, {
      status: 'attention',
      number: `${now.minutes} of ${target}`,
      sentence: `${now.minutes} of ${target} minutes.`,
      action: `${walks} 25-minute incline ${plural(walks, 'walk')} after lifting ${walks === 1 ? 'covers' : 'cover'} the rest.`,
      detail,
    })
  }
  if (prev.run_km > 0 && now.run_km > prev.run_km * (1 + CARDIO_KM_JUMP)) {
    const jump = Math.round(((now.run_km - prev.run_km) / prev.run_km) * 100)
    return make(code, {
      status: 'neutral',
      number: `+${jump}% km`,
      sentence: `Running km up ${jump}% in one week (${now.run_km} km against ${prev.run_km} km).`,
      action: 'Hold next week level to protect the knees and the leg sessions.',
      detail,
    })
  }
  if (ratio < 0.8) {
    const walks = Math.max(Math.ceil((target - now.minutes) / 25), 1)
    return make(code, {
      status: 'neutral',
      number: `${now.minutes} of ${target}`,
      sentence: `${now.minutes} of ${target} minutes.`,
      action: `${walks === 1 ? 'One' : walks} more 25-minute incline ${plural(walks, 'walk')} ${walks === 1 ? 'closes' : 'close'} the gap.`,
      detail,
    })
  }
  const vertical =
    now.vertical_m > 0
      ? `; incline walking climbed ${now.vertical_m} vertical metres${prev.vertical_m > 0 ? ` against ${prev.vertical_m} last week` : ''}`
      : now.run_km > 0
        ? `; ${now.run_km} km of running`
        : ''
  return make(code, {
    status: 'positive',
    number: `${now.minutes} min`,
    sentence: `${now.sessions} ${plural(now.sessions, 'session')}, ${now.minutes} minutes${vertical}.`,
    action: 'Keep this dose next week.',
    detail,
  })
}

// ---------------------------------------------------------------------------
// Signal 6: lifts progressed
// ---------------------------------------------------------------------------

export const LIFTS_MIN_COMPARABLE = 4

export function liftsSignal(r: ReviewRecords, lifts: readonly LiftComparison[], proteinTargetG: number): Signal {
  const code: SignalCode = 'lifts'
  const n = lifts.length
  const detail: Record<string, number> = {}
  for (const l of lifts) detail[l.exercise_id] = l.progressed ? 1 : l.held ? 0 : -1

  if (n < LIFTS_MIN_COMPARABLE) {
    const need = LIFTS_MIN_COMPARABLE - n
    return make(code, {
      status: 'to_unlock',
      number: `${n} of ${LIFTS_MIN_COMPARABLE} exercises`,
      sentence: `Lifts unlocks at ${LIFTS_MIN_COMPARABLE} exercises with a previous session; ${n} so far.`,
      action: "Repeat last session's exercises so there is something to compare.",
      unlock: `Log ${need} more ${plural(need, 'exercise')} with a previous session to unlock the lifts signal.`,
      detail,
    })
  }

  const progressed = lifts.filter((l) => l.progressed)
  const held = lifts.filter((l) => l.held)
  const p = progressed.length
  const ratio = p / n

  if (ratio >= 0.5) {
    const ex = progressed[0]
    return make(code, {
      status: 'positive',
      number: `${p} of ${n}`,
      sentence: `${p} of ${n} exercises beat last session (${ex.name} ${fmtSet(ex.prev.load_g, ex.prev.reps)} to ${fmtSet(ex.curr.load_g, ex.curr.reps)}).`,
      action: 'Keep adding weight when every set hits the top of the range.',
      detail,
    })
  }
  if (r.deficit_fraction > 0 && r.trend.direction === 'down' && held.length * 4 >= n * 3) {
    const kg = kgPerWeek(r.trend)
    const fell = kg !== null && kg < 0 ? ` while the trend fell ${Math.abs(kg).toFixed(1)} kg this week` : ' while the scale trended down'
    return make(code, {
      status: 'positive',
      number: `${held.length} of ${n} held`,
      sentence: `Lifts held within 5% on ${held.length} of ${n} exercises${fell}.`,
      action: `That is the muscle you kept; keep protein at ${proteinTargetG} g.`,
      detail,
    })
  }
  if (ratio < 0.25) {
    const prevLow = r.lifts_prev_week_ratio != null && r.lifts_prev_week_ratio < 0.25
    if (prevLow) {
      return make(code, {
        status: 'attention',
        number: `${p} of ${n}`,
        sentence: `${p} of ${n} exercises progressed. Same as last week.`,
        action: 'Use the ready-to-add-weight hint on each card and check the protein row; if protein is fine, take a lighter week.',
        detail,
      })
    }
    return make(code, {
      status: 'neutral',
      number: `${p} of ${n}`,
      sentence: `${p} of ${n} exercises progressed this week.`,
      action: 'Use the ready-to-add-weight hint on each card and check the protein row.',
      detail,
    })
  }
  return make(code, {
    status: 'neutral',
    number: `${p} of ${n}`,
    sentence: `${p} of ${n} exercises beat last session.`,
    action: 'Push the reps on the ones that held; add weight when every set hits the top of the range.',
    detail,
  })
}
