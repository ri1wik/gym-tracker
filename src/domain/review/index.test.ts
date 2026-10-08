import { describe, expect, it } from 'vitest'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import type { CardioSession, FoodLog, MealSlot, Profile, WeighIn, Workout, WorkoutSet } from '../types'
import { addDays } from '../dates'
import { trendState, type TrendBand, type TrendState } from '../calc/trend'
import type { Goal } from '../calc/targets'
import {
  ATTENTION_BADGE,
  DISCLAIMER,
  KEEP_GOING_FOCUS,
  REVIEW_PRIORITY,
  copyProblems,
  reviewInputsHash,
  weeklyReview,
  type ReviewRecords,
  type Signal,
} from './index'
import { cardioSignal, liftsSignal, proteinSignal, sessionsSignal, setsSignal, weightSignal, compareLifts } from './signals'

// ---------------------------------------------------------------------------
// Synthetic fixtures. No real body numbers anywhere.
// ---------------------------------------------------------------------------

const USER = 'u-test'
const WEEK_START = '2026-03-23'
const WEEK_END = addDays(WEEK_START, 7)
const PREV_WEEK = addDays(WEEK_START, -7)

const row = { user_id: USER, created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z', version: 1, deleted_at: null, dirty: 0 as const }

export function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: USER,
    created_at: row.created_at,
    updated_at: row.updated_at,
    version: 1,
    deleted_at: null,
    dirty: 0,
    display_name: 'Test',
    sex: 'male',
    birth_date: '1996-01-01',
    height_mm: 1780,
    activity_level: 'moderate',
    goal: 'recomp',
    training_age: 'intermediate',
    training_days_per_week: 4,
    cardio_target_s: 150 * 60,
    protein_dg_per_kg: 20,
    calorie_override_kcal: null,
    sleep_min: 420,
    week_starts_on: 1,
    review_weekday: 0,
    review_minute_of_day: 18 * 60,
    checkin_interval_days: 4,
    reference_intakes: 'nin',
    active_gym_profile_id: null,
    onboarding_done: true,
    ...over,
  }
}

let seq = 0
const nextId = (p: string) => `${p}-${++seq}`

function workout(planned_on: string, over: Partial<Workout> = {}): Workout {
  return {
    ...row,
    id: nextId('w'),
    program_id: 'p1',
    planned_on,
    session_key: 'push_a',
    started_at: `${planned_on}T18:00:00Z`,
    finished_at: `${planned_on}T19:00:00Z`,
    status: 'finished',
    notes: null,
    body_weight_g: 80_000,
    plan: null,
    ...over,
  }
}

function wset(w: Workout, exercise_id: string, load_g: number, reps: number, over: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    ...row,
    id: nextId('s'),
    workout_id: w.id,
    exercise_id,
    set_index: seq,
    kind: 'working',
    target_reps: reps,
    target_load_g: load_g,
    reps,
    load_g,
    assist_g: 0,
    rpe: null,
    completed_at: `${w.planned_on}T18:${String(seq % 60).padStart(2, '0')}:00Z`,
    rest_s: 90,
    substituted_for: null,
    ...over,
  }
}

function weighIn(date_key: string, weight_g: number, waist_mm: number | null = null): WeighIn {
  return { ...row, id: nextId('bw'), date_key, weight_g, waist_mm, same_conditions: true, note: null }
}

function cardio(date_key: string, kind: CardioSession['kind'], duration_s: number, over: Partial<CardioSession> = {}): CardioSession {
  return {
    ...row,
    id: nextId('c'),
    date_key,
    kind,
    started_at: `${date_key}T07:00:00Z`,
    duration_s,
    distance_m: null,
    speed_m_per_h: null,
    incline_tenths_pct: null,
    effort: 4,
    avg_hr: null,
    run_type: null,
    handrail: false,
    notes: null,
    ...over,
  }
}

function food(date_key: string, meal: MealSlot, grams: number, protein_mg_per_100g: number, kcal_per_100g: number): FoodLog {
  return {
    ...row,
    id: nextId('f'),
    date_key,
    meal,
    food_id: 'food-1',
    recipe_id: null,
    grams,
    n_snapshot: { protein: protein_mg_per_100g, energy_kcal: kcal_per_100g },
    logged_at: `${date_key}T08:00:00Z`,
  }
}

/** A clean losing series over 28 days ending inside the week: on track. */
function onTrackWeighIns(): WeighIn[] {
  const kg = [82.0, 81.8, 81.6, 81.5, 81.2, 81.1, 80.9]
  return kg.map((w, i) => weighIn(addDays(WEEK_END, -1 - 24 + i * 4), Math.round(w * 1000)))
}

/** A flat series: 7 readings around 80 kg with tiny scatter. */
function flatWeighIns(waist: [number, number] | null = null): WeighIn[] {
  const kg = [80.0, 80.05, 79.95, 80.0, 80.05, 79.95, 80.0]
  return kg.map((w, i) => weighIn(addDays(WEEK_END, -1 - 24 + i * 4), Math.round(w * 1000), waist ? (i === 0 ? waist[0] : i === 6 ? waist[1] : null) : null))
}

const GOOD_SETS: [string, number, number, number][] = [
  // exercise, sets, load_g, reps
  ['barbell-bench-press', 12, 62_500, 8],
  ['barbell-row', 12, 60_000, 10],
  ['dumbbell-lateral-raise', 10, 10_000, 15],
  ['barbell-curl', 8, 30_000, 12],
  ['cable-pushdown', 8, 25_000, 12],
  ['back-squat', 12, 90_000, 6],
  ['romanian-deadlift', 10, 80_000, 8],
  ['barbell-hip-thrust', 8, 100_000, 10],
  ['standing-calf-raise', 12, 60_000, 12],
]

function spread(workouts: Workout[], plan: [string, number, number, number][]): WorkoutSet[] {
  const out: WorkoutSet[] = []
  plan.forEach(([ex, count, load, reps], i) => {
    for (let k = 0; k < count; k++) out.push(wset(workouts[(i + k) % workouts.length], ex, load, reps))
  })
  return out
}

interface Shape {
  sessions?: number
  planned?: number
  sets?: [string, number, number, number][]
  prevSets?: [string, number, number, number][]
  weighIns?: WeighIn[]
  foodDays?: number
  foodMeals?: number
  kcalPer100?: number
  cardio?: CardioSession[]
  cardioPrev?: CardioSession[]
  goal?: Goal
  over?: Partial<ReviewRecords>
}

function records(shape: Shape = {}): ReviewRecords {
  const sessions = shape.sessions ?? 4
  const workouts = Array.from({ length: sessions }, (_, i) => workout(addDays(WEEK_START, i)))
  const sets = workouts.length ? spread(workouts, shape.sets ?? GOOD_SETS) : []
  const prevWorkouts = Array.from({ length: 4 }, (_, i) => workout(addDays(PREV_WEEK, i)))
  // Last week: six exercises sat 2.5 kg lighter, three (lateral raise, curl, pushdown) were the same.
  const HELD = new Set(['dumbbell-lateral-raise', 'barbell-curl', 'cable-pushdown'])
  const prevPlan = shape.prevSets ?? GOOD_SETS.map(([ex, n, load, reps]) => [ex, n, HELD.has(ex) ? load : load - 2500, reps] as [string, number, number, number])
  const prevSets = spread(prevWorkouts, prevPlan)
  const weighIns = shape.weighIns ?? onTrackWeighIns()
  const foodDays = shape.foodDays ?? 6
  const meals = shape.foodMeals ?? 3
  const kcal = shape.kcalPer100 ?? 400
  const foodLogs: FoodLog[] = []
  for (let d = 0; d < foodDays; d++) {
    const day = addDays(WEEK_START, d)
    const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner']
    // The last logged day drops a meal so one day misses the 90 percent line.
    const count = d === foodDays - 1 ? Math.max(meals - 1, 1) : meals
    for (let m = 0; m < count; m++) foodLogs.push(food(day, slots[m % 3], 250, 25_000, kcal))
  }
  const trend = trendState(
    weighIns.map((w) => ({ date_key: w.date_key, weight_g: w.weight_g })),
    { goal: shape.goal ?? 'recomp' },
  )
  const walk = (d: string, s: number) => cardio(d, 'incline_walk', s, { speed_m_per_h: 5500, incline_tenths_pct: 120 })
  return {
    week_start: WEEK_START,
    week_end: WEEK_END,
    workouts,
    sets,
    sets_4w: [...prevSets, ...sets],
    weigh_ins: weighIns.filter((w) => w.date_key >= WEEK_START && w.date_key < WEEK_END),
    cardio: shape.cardio ?? [walk(addDays(WEEK_START, 1), 45 * 60), walk(addDays(WEEK_START, 4), 45 * 60), cardio(addDays(WEEK_START, 6), 'run_outdoor', 40 * 60, { distance_m: 6000 })],
    cardio_prev_week: shape.cardioPrev ?? [walk(PREV_WEEK, 30 * 60), cardio(addDays(PREV_WEEK, 3), 'run_outdoor', 40 * 60, { distance_m: 5500 })],
    food_logs: foodLogs,
    exercises: EXERCISES_BY_ID,
    trend,
    planned_sessions: shape.planned ?? 4,
    protein_target_g: 160,
    deficit_fraction: 0.15,
    minimal_split: false,
    deload_week: false,
    previous_note: null,
    weigh_ins_4w: weighIns,
    weeks_of_use: 3,
    ...shape.over,
  }
}

function fakeTrend(band: TrendBand, rate: number | null, over: Partial<TrendState> = {}): TrendState {
  return {
    slope_g_per_day: rate === null ? null : (rate / 100) * 80_000 / 7,
    rate_pct_per_week: rate,
    rate_ci_pct_per_week: rate === null ? null : [rate - 0.1, rate + 0.1],
    band,
    direction: rate === null ? 'unknown' : rate <= -0.1 ? 'down' : rate >= 0.1 ? 'up' : 'flat',
    precision: rate === null ? 'none' : 'full',
    readings_count: rate === null ? 2 : 7,
    readings_needed: rate === null ? 2 : band === 'not_yet_precise' ? 3 : 0,
    readings_expected: 10,
    trend_points: [],
    trend_weight_g: 80_000,
    delta_since_last_g: -100,
    candidate_band: band,
    window_readings: rate === null ? 2 : 7,
    ...over,
  }
}

function messagesOf(s: Signal): { text: string; attention: boolean }[] {
  const attention = s.status === 'attention'
  const out = [
    { text: s.sentence, attention },
    { text: s.action, attention },
  ]
  if (s.unlock) out.push({ text: s.unlock, attention })
  return out
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

describe('weekly review: a good week', () => {
  const r = records()
  const review = weeklyReview(r, profile())

  it('every signal speaks and all six are positive', () => {
    expect(review.signals.map((s) => s.code)).toEqual(REVIEW_PRIORITY)
    expect(review.signals.every((s) => s.status === 'positive')).toBe(true)
  })
  it('positives are capped at three in priority order', () => {
    expect(review.positives.map((s) => s.code)).toEqual(['protein', 'sessions', 'weight_trend'])
    expect(review.attention).toEqual([])
    expect(review.to_unlock).toEqual([])
    expect(review.focus).toBe(KEEP_GOING_FOCUS)
  })
  it('names its basis and carries the disclaimer', () => {
    expect(review.basis).toBe('4 sessions, 2 check-ins, 6 days of food.')
    expect(review.disclaimer).toBe(DISCLAIMER)
    expect(review.share_text).toContain('Focus: ')
    expect(review.logging_check).toBeNull()
  })
  it('weight reads on track inside the recomposition band', () => {
    const w = review.signals.find((s) => s.code === 'weight_trend')!
    expect(w.sentence).toMatch(/^Trend down 0\.\d% per week, inside the recomposition band\.$/)
  })
  it('sets lists every part inside the 10 to 20 band', () => {
    const s = review.signals.find((s) => s.code === 'sets_by_body_part')!
    expect(s.sentence).toContain('every part in the 10 to 20 band')
    expect(s.detail!.chest).toBe(12)
    expect(s.detail!.glutes).toBe(19)
    expect(s.detail!.shoulders).toBe(16)
  })
  it('lifts names the first exercise that beat last session', () => {
    const l = review.signals.find((s) => s.code === 'lifts')!
    expect(l.number).toBe('6 of 9')
    expect(l.sentence).toContain('Barbell bench press 60 x 8 to 62.5 x 8')
  })
  it('cardio reports vertical metres against last week', () => {
    const c = review.signals.find((s) => s.code === 'cardio')!
    expect(c.sentence).toBe('3 sessions, 130 minutes; incline walking climbed 990 vertical metres against 330 last week.')
  })
})

describe('weekly review: a rough week', () => {
  const fast = [82.0, 81.5, 81.0, 80.5, 80.0, 79.5, 79.0].map((w, i) => weighIn(addDays(WEEK_END, -1 - 24 + i * 4), Math.round(w * 1000)))
  const r = records({
    sessions: 2,
    // Every lift more than 5 percent under last week, hamstrings and glutes untrained.
    sets: [
      ['barbell-bench-press', 12, 50_000, 8],
      ['barbell-row', 12, 50_000, 10],
      ['dumbbell-lateral-raise', 10, 7_500, 15],
      ['barbell-curl', 8, 25_000, 12],
      ['cable-pushdown', 8, 20_000, 12],
      ['back-squat', 4, 80_000, 6],
      ['standing-calf-raise', 12, 50_000, 12],
    ],
    prevSets: GOOD_SETS,
    weighIns: fast,
    foodDays: 5,
    foodMeals: 2,
    cardio: [cardio(WEEK_START, 'incline_walk', 20 * 60)],
    over: { lifts_prev_week_ratio: 0.1, trend: { ...fakeTrend('too_fast', -1.2) } },
  })
  const review = weeklyReview(r, profile())

  it('flags everything but shows at most three attention items in priority order', () => {
    expect(review.signals.filter((s) => s.status === 'attention').length).toBeGreaterThanOrEqual(5)
    expect(review.attention.map((s) => s.code)).toEqual(['protein', 'sessions', 'weight_trend'])
    expect(review.positives).toEqual([])
  })
  it('takes the focus from the top attention item', () => {
    expect(review.focus).toBe(review.attention[0].action)
    expect(review.focus).toMatch(/^Biggest gap is/)
  })
  it('never uses an exclamation mark or a banned word on attention items', () => {
    for (const s of review.attention) {
      for (const m of messagesOf(s)) expect(copyProblems(m.text, true)).toEqual([])
    }
    expect(review.share_text).toContain(ATTENTION_BADGE)
    expect(review.share_text.toLowerCase()).not.toContain('negative')
    expect(review.share_text.toLowerCase()).not.toContain('failed')
  })
  it('the sets row names the lowest part and a slot to add', () => {
    const s = review.signals.find((s) => s.code === 'sets_by_body_part')!
    expect(s.status).toBe('attention')
    expect(s.sentence).toMatch(/^Hamstrings 0 sets, under the 8-set floor and \d more parts under it\.$/)
    expect(s.action).toBe('Add one RDL or leg curl slot; 3 sets twice a week is enough to start.')
  })
  it('the lifts row says the week matched the last one, with no run count', () => {
    const l = review.signals.find((s) => s.code === 'lifts')!
    expect(l.status).toBe('attention')
    expect(l.sentence).toMatch(/ Same as last week\.$/)
    expect(l.sentence).not.toMatch(/running/)
  })
})

describe('weekly review: week one', () => {
  const r = records({
    sessions: 2,
    foodDays: 2,
    weighIns: [weighIn(WEEK_START, 80_000)],
    over: { sets_4w: [], weeks_of_use: 1 },
  })
  const review = weeklyReview(r, profile())

  it('to-unlock rows list the exact count still needed and never sit under attention', () => {
    const unlock = Object.fromEntries(review.to_unlock.map((s) => [s.code, s.unlock]))
    expect(unlock.protein).toBe('Log 2 more days of food this week to unlock the protein signal.')
    expect(unlock.lifts).toBe('Log 4 more exercises with a previous session to unlock the lifts signal.')
    expect(unlock.weight_trend).toBe('Weigh in 3 more times to unlock the trend signal.')
    expect(unlock.cardio).toBe('Log 1 more week to unlock the cardio signal.')
    expect(review.attention.map((s) => s.code)).not.toContain('protein')
    expect(review.attention.map((s) => s.code)).not.toContain('lifts')
  })
  it('sessions and sets already speak', () => {
    const codes = Object.fromEntries(review.signals.map((s) => [s.code, s.status]))
    expect(codes.sessions).toBe('attention')
    expect(codes.sets_by_body_part).not.toBe('to_unlock')
  })
})

describe('weekly review: the inputs hash', () => {
  it('is stable for equal records and changes when a past set is edited', () => {
    seq = 1000
    const a = records()
    seq = 1000
    const b = records()
    expect(reviewInputsHash(a)).toBe(reviewInputsHash(b))
    expect(reviewInputsHash(a)).toMatch(/^[0-9a-f]{16}$/)
    const edited: ReviewRecords = { ...b, sets_4w: b.sets_4w.map((s, i) => (i === 0 ? { ...s, reps: (s.reps ?? 0) + 1 } : s)) }
    expect(reviewInputsHash(edited)).not.toBe(reviewInputsHash(a))
  })
  it('ignores the bundled library and the derived trend', () => {
    const a = records()
    const b: ReviewRecords = { ...a, trend: fakeTrend('flat', 0), exercises: {} }
    expect(reviewInputsHash(a)).toBe(reviewInputsHash(b))
  })
  it('is deterministic across calls', () => {
    const r = records()
    expect(weeklyReview(r, profile())).toEqual(weeklyReview(r, profile()))
  })
})

// ---------------------------------------------------------------------------
// Signal rules
// ---------------------------------------------------------------------------

describe('signal 1: weight trend', () => {
  it('the recomposition marker turns a flat scale into a positive', () => {
    const r = records({ weighIns: flatWeighIns([850, 838]), over: { flat_weeks: 3 } })
    const w = weightSignal(r, 'recomp', 160, compareLifts(r))
    expect(r.trend.band).toBe('flat')
    expect(w.status).toBe('positive')
    expect(w.sentence).toBe('Scale flat for 3 weeks, but waist is down 1.2 cm and 6 of 9 lifts went up. That is recomposition working.')
  })
  it('lifts alone fire the marker when half or more progressed', () => {
    const r = records({ weighIns: flatWeighIns() })
    const w = weightSignal(r, 'recomp', 160, compareLifts(r))
    expect(w.status).toBe('positive')
    expect(w.sentence).toContain('6 of 9 lifts went up')
  })
  it('a flat week without the marker reads neutral for the first four flat weeks, then needs attention', () => {
    const base = records({ weighIns: flatWeighIns(), prevSets: GOOD_SETS })
    const early = weightSignal({ ...base, flat_weeks: 2 }, 'recomp', 160, compareLifts(base))
    expect(early.status).toBe('neutral')
    expect(early.sentence).toContain('flat week 2 of 4')
    const late = weightSignal({ ...base, flat_weeks: 4 }, 'recomp', 160, compareLifts(base))
    expect(late.status).toBe('attention')
    expect(late.action).toBe('Drop 100 to 150 kcal a day or add one 25-minute incline walk, then re-check in 2 weeks.')
  })
  it('not yet precise reads the direction and the n of 10 count', () => {
    const r = records({ over: { trend: fakeTrend('not_yet_precise', -0.3, { window_readings: 6, readings_needed: 4 }) } })
    const w = weightSignal(r, 'recomp', 160, [])
    expect(w.status).toBe('neutral')
    expect(w.number).toBe('6 of 10')
    expect(w.sentence).toBe('Direction: down, not yet precise, 6 of 10 readings (about 0.3% per week so far).')
    expect(w.action).toBe('Keep weighing in; 4 more readings sharpen the verdict.')
  })
  it('too fast and slow down name the kcal to add and the protein to keep', () => {
    const r = records({ over: { trend: fakeTrend('too_fast', -1.2) } })
    const w = weightSignal(r, 'recomp', 160, [])
    expect(w.status).toBe('attention')
    expect(w.sentence).toBe('Dropping 1.2% per week, faster than muscle can be protected.')
    expect(w.action).toBe('Add 150 to 250 kcal a day, keep protein at 160 g and keep lifting heavy.')
    const s = weightSignal({ ...r, trend: fakeTrend('slow_down', -1.7) }, 'lean_gain', 150, [])
    expect(s.status).toBe('attention')
    expect(s.action).toContain('150 g')
  })
  it('collecting lists the exact count', () => {
    const w = weightSignal(records({ over: { trend: fakeTrend('collecting', null) } }), 'recomp', 160, [])
    expect(w.status).toBe('to_unlock')
    expect(w.unlock).toBe('Weigh in 2 more times to unlock the trend signal.')
  })
})

describe('signal 2: sessions', () => {
  it('speaks from week one and never counts a run of weeks', () => {
    const r = records({ over: { sessions_prev_weeks: [{ done: 4, planned: 4 }, { done: 4, planned: 4 }, { done: 2, planned: 4 }] } })
    const s = sessionsSignal(r)
    expect(s.status).toBe('positive')
    expect(s.sentence).toBe('4 of 4 sessions. Same as last week.')
    expect(s.detail).toEqual({ done: 4, planned: 4, done_4w: 14, planned_4w: 16 })
    const first = sessionsSignal(records({ over: { sessions_prev_weeks: [{ done: 2, planned: 4 }] } }))
    expect(first.sentence).toBe('4 of 4 sessions.')
  })
  it('70 to 89 percent is neutral, under 70 needs attention, zero names the week and not the gap', () => {
    const mid = sessionsSignal(records({ sessions: 3 }))
    expect(mid.status).toBe('neutral')
    expect(mid.action).toBe('Keep the same 2 training days next week.')
    expect(mid.action).not.toMatch(/missed/)
    const low = sessionsSignal(records({ sessions: 2 }))
    expect(low.status).toBe('attention')
    expect(low.action).toBe('Consistency beats the perfect programme; pick the 2 days you never miss and protect them.')
    const none = sessionsSignal(records({ sessions: 0 }))
    expect(none.sentence).toBe('0 of 4 sessions this week.')
    expect(none.action).toBe('Start the shortest template today.')
  })
  it('a deload week reads neutral', () => {
    const s = sessionsSignal(records({ sessions: 3, planned: 3, over: { deload_week: true } }))
    expect(s.status).toBe('neutral')
    expect(s.sentence).toBe('Deload week: 3 of 3 lighter sessions done.')
  })
})

describe('signal 3: sets per body part', () => {
  it('needs two logged sessions', () => {
    const s = setsSignal(records({ sessions: 1 }))
    expect(s.status).toBe('to_unlock')
    expect(s.unlock).toBe('Log 1 more session this week to unlock the sets signal.')
  })
  it('uses the 8-set floor in a deficit and 10 outside it', () => {
    const plan = GOOD_SETS.map(([ex, n, l, r]) => (ex === 'barbell-curl' ? [ex, 3, l, r] : [ex, n, l, r]) as [string, number, number, number])
    const deficit = setsSignal(records({ sets: plan }))
    // Biceps: 3 own sets plus 6 half credits from rows = 9, above the 8 floor.
    expect(deficit.status).toBe('positive')
    const maintenance = setsSignal(records({ sets: plan, over: { deficit_fraction: 0 } }))
    expect(maintenance.status).toBe('attention')
    expect(maintenance.sentence).toBe('Biceps 9 sets, under the 10-set floor.')
    expect(maintenance.action).toBe('Add one curl slot; 3 sets twice a week is enough to start.')
  })
  it('flags a part above 20 sets', () => {
    const plan = GOOD_SETS.map(([ex, n, l, r]) => (ex === 'barbell-bench-press' ? [ex, 26, l, r] : [ex, n, l, r]) as [string, number, number, number])
    const s = setsSignal(records({ sets: plan }))
    expect(s.status).toBe('attention')
    expect(s.sentence).toBe('Chest 26 sets, above the 20-set band.')
    expect(s.action).toBe('More is not working; drop to 18 and push the reps.')
  })
  it('forearms and core are shown but never flagged', () => {
    const s = setsSignal(records())
    expect(s.detail!.forearms).toBe(4)
    expect(s.detail!.core).toBe(0)
    expect(s.status).toBe('positive')
  })
  it('the minimal split runs a 6 to 12 band and the guard is silent', () => {
    const plan: [string, number, number, number][] = GOOD_SETS.map(([ex, , l, r]) => [ex, 7, l, r])
    const s = setsSignal(records({ sets: plan, over: { minimal_split: true } }))
    expect(s.status).not.toBe('attention')
    expect(s.sentence).toContain('6 to 12 band by design')
    const thin: [string, number, number, number][] = GOOD_SETS.map(([ex, , l, r]) => [ex, 2, l, r])
    expect(setsSignal(records({ sets: thin, over: { minimal_split: true } })).status).toBe('neutral')
  })
  it('says for 2 weeks when last week was under the floor too', () => {
    const plan: [string, number, number, number][] = GOOD_SETS.map(([ex, n, l, r]) => (ex === 'romanian-deadlift' ? [ex, 2, l, r] : [ex, n, l, r]))
    const s = setsSignal(records({ sets: plan, over: { sets_prev_week: { hamstrings: 4 } } }))
    expect(s.sentence).toBe('Hamstrings 6 sets, under the 8-set floor for 2 weeks.')
  })
})

describe('signal 4: protein', () => {
  it('needs four logged days and names the exact count', () => {
    const p = proteinSignal(records({ foodDays: 3 }))
    expect(p.signal.status).toBe('to_unlock')
    expect(p.signal.unlock).toBe('Log 1 more day of food this week to unlock the protein signal.')
  })
  it('70 percent of days hit is positive with the average named', () => {
    const p = proteinSignal(records())
    expect(p.signal.status).toBe('positive')
    expect(p.signal.sentence).toBe('Protein hit 5 of 6 days, average 177 g against 160 g.')
  })
  it('under half names the slot with the biggest gap and a food from the user list', () => {
    const r = records({ foodMeals: 2, over: { foods: [{ name: 'Greek yogurt', protein_mg_per_100g: 10_000, portion_g: 200 }] } })
    const p = proteinSignal(r)
    expect(p.signal.status).toBe('attention')
    expect(p.signal.sentence).toMatch(/^Protein hit [01] of 6 days, average \d+ g against 160 g\.$/)
    expect(p.signal.action).toMatch(/^Biggest gap is dinner at \d+ g: \d+ g Greek yogurt takes it to \d+ g\.$/)
  })
  it('falls back to the reference list without the user foods', () => {
    const p = proteinSignal(records({ foodMeals: 2 }))
    expect(p.signal.action).toContain('250 g Greek yogurt, 4 eggs or 150 g paneer')
  })
  it('logged intake under the floor on three or more days is a logging check, never praise', () => {
    const p = proteinSignal(records({ kcalPer100: 100, over: { calorie_floor_kcal: 1500 } }))
    expect(p.logging_check).toBe('Logged intake sat under the 1500 kcal floor on 6 days. Check that every meal was logged before reading the calorie line.')
    expect(p.signal.status).toBe('neutral')
    const fine = proteinSignal(records({ over: { calorie_floor_kcal: 1500 } }))
    expect(fine.logging_check).toBeNull()
    expect(fine.signal.status).toBe('positive')
  })
})

describe('signal 5: cardio', () => {
  it('speaks from the second week of use', () => {
    const c = cardioSignal(records({ over: { weeks_of_use: 1 } }), 150 * 60)
    expect(c.status).toBe('to_unlock')
    expect(c.unlock).toBe('Log 1 more week to unlock the cardio signal.')
  })
  it('under 60 percent of target counts the walks that close it', () => {
    const c = cardioSignal(records({ cardio: [cardio(WEEK_START, 'incline_walk', 40 * 60)] }), 150 * 60)
    expect(c.status).toBe('attention')
    expect(c.sentence).toBe('40 of 150 minutes.')
    expect(c.action).toBe('5 25-minute incline walks after lifting cover the rest.')
  })
  it('over twice the target or 300 minutes pulls back', () => {
    const lots = [1, 2, 3, 4, 5, 6].map((d) => cardio(addDays(WEEK_START, d), 'run_outdoor', 55 * 60, { effort: d <= 3 ? 9 : 4 }))
    const c = cardioSignal(records({ cardio: lots }), 150 * 60)
    expect(c.status).toBe('attention')
    expect(c.sentence).toBe('330 minutes against a 150-minute target with 3 hard sessions.')
    expect(c.action).toBe('Pull back toward 180 minutes and keep one hard session.')
  })
  it('a running km jump above 15 percent is a caution, not an attention item', () => {
    const c = cardioSignal(
      records({
        cardio: [cardio(WEEK_START, 'run_outdoor', 70 * 60, { distance_m: 13_000 }), cardio(addDays(WEEK_START, 3), 'incline_walk', 60 * 60)],
        cardioPrev: [cardio(PREV_WEEK, 'run_outdoor', 60 * 60, { distance_m: 10_000 })],
      }),
      150 * 60,
    )
    expect(c.status).toBe('neutral')
    expect(c.sentence).toBe('Running km up 30% in one week (13 km against 10 km).')
    expect(c.action).toBe('Hold next week level to protect the knees and the leg sessions.')
  })
  it('vertical metres use speed, time and incline (5.5 km/h at 12 percent for 30 minutes is 330 m)', () => {
    const c = cardioSignal(
      records({ cardio: [cardio(WEEK_START, 'incline_walk', 30 * 60, { speed_m_per_h: 5500, incline_tenths_pct: 120 })], cardioPrev: [] }),
      30 * 60,
    )
    expect(c.detail!.vertical_m).toBe(330)
  })
  it('a zero target falls back to 150 minutes', () => {
    const c = cardioSignal(records(), 0)
    expect(c.detail!.target_min).toBe(150)
  })
})

describe('signal 6: lifts', () => {
  it('needs four comparable exercises; assisted and timed moves never compare', () => {
    const plan: [string, number, number, number][] = [
      ['barbell-bench-press', 3, 60_000, 8],
      ['assisted-pull-up', 3, 0, 8],
      ['plank', 3, 0, 45],
      ['barbell-row', 3, 60_000, 8],
      ['back-squat', 3, 90_000, 6],
    ]
    const r = records({ sets: plan, prevSets: plan })
    const l = liftsSignal(r, compareLifts(r), 160)
    expect(l.status).toBe('to_unlock')
    expect(l.unlock).toBe('Log 1 more exercise with a previous session to unlock the lifts signal.')
  })
  it('a deficit week where lifts held is framed as the muscle you kept', () => {
    const r = records({ prevSets: GOOD_SETS })
    const l = liftsSignal(r, compareLifts(r), 160)
    expect(l.status).toBe('positive')
    expect(l.sentence).toMatch(/^Lifts held within 5% on 9 of 9 exercises while the trend fell 0\.\d kg this week\.$/)
    expect(l.action).toBe('That is the muscle you kept; keep protein at 160 g.')
  })
  it('under 25 percent once is neutral, twice running needs attention', () => {
    const lower = GOOD_SETS.map(([ex, n, l, r]) => [ex, n, l - 5000, r] as [string, number, number, number])
    const r = records({ sets: lower, prevSets: GOOD_SETS, over: { deficit_fraction: 0 } })
    const once = liftsSignal(r, compareLifts(r), 160)
    expect(once.status).toBe('neutral')
    expect(once.sentence).toBe('0 of 9 exercises progressed this week.')
    const twice = liftsSignal({ ...r, lifts_prev_week_ratio: 0.2 }, compareLifts(r), 160)
    expect(twice.status).toBe('attention')
  })
  it('compares against the most recent previous session only', () => {
    const r = records()
    const older = workout(addDays(PREV_WEEK, -7))
    r.sets_4w = [wset(older, 'barbell-bench-press', 70_000, 8), ...r.sets_4w]
    const bench = compareLifts(r).find((l) => l.exercise_id === 'barbell-bench-press')!
    expect(bench.prev.load_g).toBe(60_000)
    expect(bench.progressed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Copy guardrails over every message the engine can produce
// ---------------------------------------------------------------------------

describe('guardrails: every message passes the banned-phrase check', () => {
  const bands: TrendBand[] = ['on_track', 'flat', 'too_fast', 'gaining', 'slow_down', 'not_yet_precise', 'collecting']
  const goals: Goal[] = ['recomp', 'fat_loss', 'lean_gain', 'maintain']
  const signals: Signal[] = []

  const scenarios: ReviewRecords[] = [
    records(),
    records({ sessions: 2, foodDays: 2, weighIns: [weighIn(WEEK_START, 80_000)], over: { sets_4w: [], weeks_of_use: 1 } }),
    records({ sessions: 0, foodDays: 5, foodMeals: 2, cardio: [], over: { trend: fakeTrend('too_fast', -1.2), lifts_prev_week_ratio: 0 } }),
    records({ sessions: 3, over: { deload_week: true, minimal_split: true } }),
    records({
      sets: GOOD_SETS.map(([ex, n, l, r]) => [ex, n, l - 10_000, r] as [string, number, number, number]),
      prevSets: GOOD_SETS,
      over: { deficit_fraction: 0, lifts_prev_week_ratio: 0, sets_prev_week: { hamstrings: 2 } },
    }),
    records({ sets: GOOD_SETS.map(([ex, n, l, r]) => [ex, ex === 'romanian-deadlift' ? 2 : ex === 'barbell-bench-press' ? 24 : n, l, r] as [string, number, number, number]) }),
    records({ sets: GOOD_SETS.map(([ex, n, l, r]) => [ex, ex === 'barbell-bench-press' ? 24 : n, l, r] as [string, number, number, number]) }),
    records({ weighIns: flatWeighIns([850, 838]), over: { flat_weeks: 4 } }),
    records({ weighIns: flatWeighIns(), prevSets: GOOD_SETS, over: { flat_weeks: 4, calorie_floor_kcal: 1500 }, kcalPer100: 100 }),
    records({ cardio: [1, 2, 3, 4, 5, 6].map((d) => cardio(addDays(WEEK_START, d), 'run_outdoor', 55 * 60, { effort: 9 }))}),
    records({
      cardio: [cardio(WEEK_START, 'run_outdoor', 70 * 60, { distance_m: 13_000 }), cardio(addDays(WEEK_START, 3), 'incline_walk', 60 * 60)],
      cardioPrev: [cardio(PREV_WEEK, 'run_outdoor', 60 * 60, { distance_m: 10_000 })],
    }),
    records({ cardio: [cardio(WEEK_START, 'incline_walk', 100 * 60)], cardioPrev: [] }),
  ]
  for (const r of scenarios) {
    for (const goal of goals) signals.push(...weeklyReview(r, profile({ goal })).signals)
    for (const goal of goals) {
      for (const band of bands) {
        const rate = band === 'collecting' ? null : band === 'slow_down' ? -1.7 : band === 'too_fast' ? (goal === 'lean_gain' ? 0.8 : -1.2) : band === 'gaining' ? 0.4 : band === 'flat' ? 0.05 : goal === 'lean_gain' ? 0.3 : -0.4
        signals.push(weightSignal({ ...r, trend: fakeTrend(band, rate), flat_weeks: 1 }, goal, 160, compareLifts(r)))
        signals.push(weightSignal({ ...r, trend: fakeTrend(band, rate), flat_weeks: 5 }, goal, 160, []))
      }
    }
  }

  it('covers every signal and status', () => {
    const seen = new Set(signals.map((s) => `${s.code}:${s.status}`))
    for (const code of REVIEW_PRIORITY) {
      for (const status of ['positive', 'neutral', 'attention', 'to_unlock']) {
        // Sessions speaks from week one and never collects.
        if (code === 'sessions' && status === 'to_unlock') continue
        expect(seen.has(`${code}:${status}`), `${code}:${status}`).toBe(true)
      }
    }
  })
  it('no banned phrase, no condition name, no exclamation on attention, a number in every sentence, a full stop at the end', () => {
    for (const s of signals) {
      for (const m of messagesOf(s)) expect(copyProblems(m.text, m.attention).filter((p) => p.reason !== 'names no number'), m.text).toEqual([])
      expect(copyProblems(s.sentence, false), s.sentence).toEqual([])
      expect(s.action.length).toBeGreaterThan(0)
      if (s.status === 'to_unlock') expect(s.unlock).toMatch(/\d/)
      if (s.status === 'attention') expect(s.action).toMatch(/\.$/)
    }
  })
  it('the disclaimer itself passes', () => {
    expect(copyProblems(DISCLAIMER, true).filter((p) => p.reason !== 'names no number')).toEqual([])
  })
})
