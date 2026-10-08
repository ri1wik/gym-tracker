// The planner contract: every input and output type and every tuning
// constant, in one file with no logic so the implementation modules can
// import it without cycles. src/domain/planner/index.ts re-exports all of
// it next to the functions, so callers keep importing from the index.
//
// OWNER: engine-planner. Types here are the contract with the UI slices and
// are only ever EXTENDED with optional fields.

import type {
  BarType,
  DateKey,
  DeloadState,
  EquipmentFamily,
  ExerciseIndexEntry,
  MovementPattern,
  MuscleGroup,
  Program,
  SetKind,
  Template,
  TemplateDay,
  Weekday,
} from '../types'
import type { TrainingAge } from '../calc/targets'

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Per-user equipment facts the planner rounds against. */
export interface EquipmentProfile {
  /** Per-hand dumbbell rungs in grams, ascending. Default ladder in DEFAULT_DUMBBELL_LADDER_G. */
  dumbbell_ladder_g: number[]
  /** Stack step per exercise id in grams; DEFAULT_STACK_STEP_G when absent. */
  stack_step_g: Record<string, number>
  /** Empty-bar load per bar type in grams; BAR_FLOOR_G from types.ts by default. */
  bar_floor_g: Record<BarType, number>
  /** Machines the active gym has (ids from machine-index.ts). Empty means "assume everything". */
  machine_ids: string[]
}

export const DEFAULT_DUMBBELL_LADDER_G: readonly number[] = [
  1000, 2000, 3000, 4000, 5000, 6000, 7500, 10_000, 12_500, 15_000, 17_500, 20_000, 22_500, 25_000, 27_500, 30_000,
  32_500, 35_000, 37_500, 40_000, 42_500, 45_000, 47_500, 50_000,
]
export const DEFAULT_STACK_STEP_G = 5000
export const BARBELL_INCREMENT_G = 2500
/** Squat, deadlift and hip thrust step by 5 kg once the load is 80 kg or more. */
export const HEAVY_BARBELL_INCREMENT_G = 5000
export const HEAVY_BARBELL_THRESHOLD_G = 80_000
export const WEIGHTED_BODYWEIGHT_INCREMENT_G = 2500
/** If increment / load is above this, raise the rep target by two before jumping. */
export const BIG_STEP_RATIO = 0.1
export const REGRESSION_FACTOR = 0.9
export const FAILURES_BEFORE_REGRESSION = 2
export const RETURN_AFTER_DAYS = 10
export const RETURN_LOAD_FACTOR = 0.95
export const FIRST_TIME_SAFETY_FACTOR = 0.9
/** A custom session advances the rotation only at this coverage of the template day's primary-muscle sets. */
export const ROTATION_COVERAGE_THRESHOLD = 0.7

/** A completed set from history, the only fields the planner reads. */
export interface HistorySet {
  workout_id: string
  exercise_id: string
  kind: SetKind
  reps: number
  load_g: number
  assist_g: number
  /** ISO timestamp. */
  completed_at: string
  /** Day key of the workout, for 48-hour fatigue checks and the return rule. */
  date_key: DateKey
}

export interface HistoryWorkout {
  id: string
  session_key: string
  planned_on: DateKey
  finished_at: string | null
  /** Exercise id actually done, for repeated-substitution learning. */
  substitutions: { from: string; to: string }[]
}

export interface History {
  /** Completed working and warm-up sets, any order. */
  sets: HistorySet[]
  workouts: HistoryWorkout[]
}

export interface ProgramState {
  template: Template
  /** Index of the last completed template day; next is (pointer + 1) mod n. */
  pointer: number
  pins: Partial<Record<Weekday, string>>
  deload: DeloadState
  priority_group: MuscleGroup | null
  started_on: DateKey
  /** Deficit as a fraction of maintenance (0.15 for 15 percent), for the deload cadence. */
  deficit_fraction: number
  training_age: TrainingAge
}

export function programStateFrom(program: Program, template: Template, deficitFraction: number, trainingAge: TrainingAge): ProgramState {
  return {
    template,
    pointer: program.settings.pointer,
    pins: program.settings.pins,
    deload: program.settings.deload,
    priority_group: program.settings.priority_group,
    started_on: program.started_on,
    deficit_fraction: deficitFraction,
    training_age: trainingAge,
  }
}

/** Everything the planner reads besides the request. */
export interface PlannerContext {
  program: ProgramState | null
  history: History
  equipment: EquipmentProfile
  /** The exercise index keyed by id (exercise-index.ts, plus custom exercises). */
  exercises: Readonly<Record<string, ExerciseIndexEntry>>
  /** Today, as a local day key. */
  today: DateKey
}

export type SessionIntent = 'normal' | 'light' | 'hard'
export type SessionMinutes = 30 | 45 | 60 | 75 | 90

export type SessionFocus =
  | { kind: 'groups'; groups: MuscleGroup[] }
  | { kind: 'patterns'; patterns: MovementPattern[] }
  | { kind: 'template_day'; day_key: string }
  | { kind: 'any' }

export interface SessionRequest {
  focus: SessionFocus
  minutes: SessionMinutes
  intent: SessionIntent
  exclude_exercise_ids: string[]
  exclude_families: EquipmentFamily[]
  date_key: DateKey
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface WarmupRamp {
  /** "Bar", "50%", "Feel set". */
  label: string
  load_g: number
  /** Assistance in grams for assisted moves, else 0. */
  assist_g: number
  reps: number
  /** Rest after this ramp: 45 s after x10 and x5, 60 s after x3, x2 and singles. */
  rest_s: number
}

export type LoadSource = 'history' | 'ratio' | 'ramp'

export interface PlannedExercise {
  exercise_id: string
  /** 0-based order in the session. */
  slot: number
  sets: number
  rep_min: number
  rep_max: number
  /** Per-set rep targets after progression (length = sets). */
  target_reps: number[]
  /** Null on the ramp-to-effort protocol (load chosen on the day). */
  target_load_g: number | null
  assist_g: number
  load_source: LoadSource
  rest_s: number
  warmups: WarmupRamp[]
  /** "last: 60 kg x 8" or null on a first time. */
  last_time: { load_g: number; reps: number; date_key: DateKey } | null
  /** One line, templated per slot. */
  why: string
  /** Exercise id this one is supersetted with, when the time-boxer paired them. */
  superset_with: string | null
  /** True when prefilled one increment higher with the "suggested" label (PLAN.md rule 12). */
  suggested_increase: boolean
  /** True for compounds; the time-boxer never removes these. */
  is_compound?: boolean
  /** The ramp-to-effort card text when load_source is 'ramp', else null. */
  ramp_card?: string | null
  /** The prescription note ("Every set hit 8: up 2.5 kg"). */
  note?: string
}

export interface MobilityDrill {
  name: string
  /** "x15", "2 x 20 s", "x6 per side". */
  dose: string
}

export interface GeneralWarmup {
  /** "5 min incline walk, 3 percent, 5 km/h" */
  cardio: string
  minutes: number
  drills: MobilityDrill[]
}

export interface CardioRow {
  kind: 'incline_walk' | 'walk' | 'bike' | 'none'
  minutes: number
  incline_tenths_pct: number | null
  speed_m_per_h: number | null
  note: string
}

export type RotationEffect = 'advances' | 'holds' | 'pinned'

export interface SessionPlan {
  /** Template day key, or 'custom'. */
  session_key: string
  name: string
  general_warmup: GeneralWarmup
  exercises: PlannedExercise[]
  estimated_minutes: number
  rotation_effect: RotationEffect
  /** Fatigue and placement warnings, each one sentence. */
  warnings: string[]
  deload: boolean
  cardio: CardioRow | null
  /** Set when the time-boxer could not fit the budget; the plan is the best it could do. */
  needs_minutes: number | null
  /** True after a 10-day gap: loads were prescribed minus 5 percent. */
  first_session_back?: boolean
  /** Which trimmer steps ran, in order, for the summary line. */
  trim_steps?: string[]
}

export interface NextSessionResult {
  day: TemplateDay
  /** Index of that day in the template. */
  index: number
  rotation_effect: RotationEffect
  /** True after 10 or more days away: loads minus 5 percent, not a deload. */
  first_session_back: boolean
  reason: string
}

export interface Prescription {
  target_load_g: number | null
  assist_g: number
  target_reps: number[]
  load_source: LoadSource
  /** Consecutive sets-below-range count carried at this load. */
  failure_count: number
  suggested_increase: boolean
  /** "Every set hit 8: up 2.5 kg", "Set 2 fell short: same load, aim 8". */
  note: string
  /** The last session's best working set, for the "last: 60 kg x 8" line. */
  last_time?: { load_g: number; reps: number; date_key: DateKey } | null
}

export interface PrescribeInput {
  exercise: ExerciseIndexEntry
  /** Completed sets of this exercise only, warm-ups included (the function filters). */
  history: HistorySet[]
  sets: number
  rep_min: number
  rep_max: number
  equipment: EquipmentProfile
  /** Half the sets, same loads, no progression attempts. */
  deload: boolean
  /** Loads minus 5 percent after a 10-day gap. */
  first_session_back: boolean
  /** Light intent: no progression, effort-7 targets. */
  intent: SessionIntent
}

export interface WarmupInput {
  exercise: ExerciseIndexEntry
  /** The prescribed first working load in grams (after progression). */
  working_load_g: number
  working_assist_g: number
  /** Target reps of working set 1; decides the 85 and 92 percent singles. */
  working_reps: number
  equipment: EquipmentProfile
  /** Another compound of the same pattern came earlier in this session. */
  second_compound_same_pattern: boolean
  /** No isolation for this muscle came earlier in this session. */
  first_isolation_for_muscle: boolean
}

export interface Substitute {
  exercise_id: string
  score: number
  /** Why it scored: "same equipment family", "shares triceps", "has history", "not yet today". */
  reasons: string[]
}

export interface SubstituteInput {
  exercise_id: string
  /** Exercise ids already done or planned today. */
  done_today: string[]
  /** Return at most this many; the sheet shows 3, the library 4. */
  limit: number
}

export interface FirstTimeLoad {
  target_load_g: number | null
  load_source: 'ratio' | 'ramp'
  /** The lift the ratio was taken from, when load_source is 'ratio'. */
  from_exercise_id: string | null
  confidence: 'medium' | 'low'
  /** The ramp card text when load_source is 'ramp'. */
  card: string | null
}

export interface DeloadStatus {
  due: boolean
  reason: 'schedule' | 'regression' | 'manual' | null
  week_index: number
  every_weeks: number
  /** Key lifts whose best weekly e1RM fell three weeks running. */
  regressing_key_lifts: string[]
}

