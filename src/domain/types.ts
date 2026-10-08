// Shared domain types. One file, imported by every slice.
//
// Rules this file enforces by shape:
// - Canonical integer units in storage: grams, millimetres, metres, seconds,
//   kcal. Display converts (see ./units.ts). The only non-integer scalars are
//   ratios and fractions, and they are named as such.
// - Synced rows use snake_case field names that mirror the server tables in
//   docs/SPEC-cloud.md. Local-only fields are listed in LOCAL_ONLY_FIELDS so the
//   sync layer can strip them before a push.
// - Day keys are local YYYY-MM-DD strings from ./dates.ts, never Date objects.
// - No React, no database, no network in this module.

import type { Sex, ActivityLevel, Goal, TrainingAge } from './calc/targets'
import type { SessionPlan } from './planner/index'

export type { Sex, ActivityLevel, Goal, TrainingAge }

// ---------------------------------------------------------------------------
// Vocabularies. Each `as const` array is the single source of truth in TS;
// src/data/library/vocab.json carries the same lists for the Node validator
// and a test asserts the two never drift.
// ---------------------------------------------------------------------------

/** The 11 browse body parts. */
export const BODY_PARTS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const
export type BodyPart = (typeof BODY_PARTS)[number]

/** The 14 scored muscle groups (the level the volume projector prints). */
export const MUSCLE_GROUPS = [
  'chest',
  'lats',
  'upper_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

/** The 22 mapping muscles exercises are tagged with. */
export const MUSCLES = [
  'upper_chest',
  'chest',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'rotator_cuff',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hip_flexors',
  'hamstrings',
  'glutes',
  'abductors',
  'adductors',
  'calves',
  'tibialis',
  'abs',
] as const
export type Muscle = (typeof MUSCLES)[number]

/** Specific equipment an exercise is performed with. */
export const EQUIPMENT = [
  'barbell',
  'ez_bar',
  'trap_bar',
  'dumbbell',
  'cable',
  'selectorised_machine',
  'plate_loaded_machine',
  'smith_machine',
  'bodyweight',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

/** Coarse family used by substitution scoring and the custom builder. */
export const EQUIPMENT_FAMILIES = ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'bodyweight'] as const
export type EquipmentFamily = (typeof EQUIPMENT_FAMILIES)[number]

export const EQUIPMENT_FAMILY_OF: Record<Equipment, EquipmentFamily> = {
  barbell: 'barbell',
  ez_bar: 'barbell',
  trap_bar: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  selectorised_machine: 'machine',
  plate_loaded_machine: 'machine',
  smith_machine: 'smith',
  bodyweight: 'bodyweight',
}

/**
 * Movement patterns. The first twenty are the list in docs/SPEC-programming.md
 * under auto-substitution. The last six are additions the machine catalogue
 * needs (abductor and adductor machines, wrist work, shrugs, carries and
 * anti-rotation core work); they are listed last so the spec order is kept.
 */
export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'incline_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'hip_thrust',
  'knee_flexion',
  'knee_extension',
  'calf',
  'elbow_flexion',
  'elbow_extension',
  'lateral_raise',
  'rear_delt',
  'trunk_flexion',
  'anti_extension',
  'pullover',
  'fly',
  'hip_abduction',
  'hip_adduction',
  'wrist_flexion',
  'shrug',
  'carry',
  'anti_rotation',
] as const
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

export const LOAD_TYPES = ['weight', 'bodyweight', 'assisted', 'time'] as const
export type LoadType = (typeof LOAD_TYPES)[number]

export const BAR_TYPES = ['olympic', 'ez', 'fixed'] as const
export type BarType = (typeof BAR_TYPES)[number]

/** Empty-bar floors in grams. Fixed bars run 10 to 50 kg by 2.5; the floor is the lightest. */
export const BAR_FLOOR_G: Record<BarType, number> = { olympic: 20_000, ez: 10_000, fixed: 10_000 }

export const MACHINE_CATEGORIES = [
  'plate-loaded',
  'selectorised',
  'cable',
  'free-weight',
  'cardio',
  'bodyweight',
] as const
export type MachineCategory = (typeof MACHINE_CATEGORIES)[number]

export const SPLITS = ['ppl_6', 'ppl_5', 'upper_lower_4', 'full_body_3', 'minimal_2'] as const
export type Split = (typeof SPLITS)[number]

/** 0 = Sunday, 6 = Saturday, matching Date.prototype.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Local calendar day, YYYY-MM-DD, produced only by ./dates.ts. */
export type DateKey = string

/** ISO 8601 timestamp with offset or Z, as the server stores it. */
export type IsoTimestamp = string

// ---------------------------------------------------------------------------
// Library (bundled data, not synced)
// ---------------------------------------------------------------------------

/** Structural facts for one exercise. Owned by the architect; see exercise-index.ts. */
export interface ExerciseIndexEntry {
  /** Stable kebab-case slug. History is keyed by this; never rename. */
  id: string
  name: string
  bodyPart: BodyPart
  primaryMuscles: Muscle[]
  /** At most two. */
  secondaryMuscles: Muscle[]
  equipment: Equipment
  equipmentFamily: EquipmentFamily
  movementPattern: MovementPattern
  loadType: LoadType
  isCompound: boolean
  isUnilateral: boolean
  /** Present for barbell, EZ bar and trap bar moves. */
  barType?: BarType
  /** Present for machine, cable, smith and station moves; an id from machine-index.ts. */
  machineId?: string
  /** Two or three per body part; shown first in the library and seeds "start a session with these". */
  isRecompPriority: boolean
}

/** Prose and prescription defaults added by the content-exercises builder. */
export interface ExerciseContent {
  aliases: string[]
  /** One line, original wording. */
  cue: string
  /** Exactly four lines. */
  howTo: string[]
  /** Exactly three. */
  mistakes: string[]
  repMin: number
  repMax: number
  /** Default load step in grams (2500 barbell, 5000 machine; dumbbells use the ladder). */
  incrementG: number
  restS: number
  media: ExerciseMedia | null
}

export interface ExerciseMedia {
  source: 'repdb' | 'own'
  /** Source-side id, for the media manifest. */
  sourceId: string
  /** Paths relative to the public root, without extension or size suffix. */
  start: string
  peak: string
}

export type Exercise = ExerciseIndexEntry & ExerciseContent

/** Structural facts for one machine or station. Owned by the architect; see machine-index.ts. */
export interface MachineIndexEntry {
  id: string
  /** Plain descriptive name, no brand. */
  name: string
  category: MachineCategory
}

export interface MachineSetupStep {
  label: 'Seat' | 'Pad' | 'Grip' | 'Pin' | 'Foot plate' | 'Other'
  text: string
}

export interface MachinePhoto {
  /** Path relative to the public root, without size suffix. */
  src: string
  width: number
  height: number
  source: 'own' | 'user'
}

/** Prose and photo added by the content-machines and images builders. */
export interface MachineContent {
  /** Optional note on brand-specific differences, for the machine card. */
  brandNote?: string
  /** Exercise ids this machine supports, mirrored from the exercise index links. */
  exerciseIds?: string[]
  aliases: string[]
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  setup: MachineSetupStep[]
  tips: string[]
  photo: MachinePhoto | null
  /** True until the machine is photographed; the card shows an "Add a photo" prompt. */
  placeholder: boolean
}

export type Machine = MachineIndexEntry & MachineContent

export interface TemplateItem {
  exercise_id: string
  sets: number
  rep_min: number
  rep_max: number
  rest_s: number
  /** The first compound of the day; feeds the deload and review key-lift signals. */
  is_key_lift?: boolean
}

export interface TemplateDay {
  /** Stable within the template, for example "push_a". */
  key: string
  name: string
  /** Shown as text, for example "incline walk 15 min after". */
  cardio_note: string | null
  items: TemplateItem[]
}

export interface Template {
  key: string
  name: string
  split: Split
  days_per_week: number
  days: TemplateDay[]
}

// ---------------------------------------------------------------------------
// Synced rows (mirror the server tables)
// ---------------------------------------------------------------------------

/** Columns every synced table carries, plus the local-only dirty flag. */
export interface SyncedRow {
  id: string
  created_at: IsoTimestamp
  /** Set by a server trigger; clients never send it. */
  updated_at: IsoTimestamp
  /** Set by a server trigger; clients never send it. Starts at 1. */
  version: number
  deleted_at: IsoTimestamp | null
  /** Local only: 1 when a change has not reached the server yet. Stored as 0 or 1 so Dexie can index it. */
  dirty: 0 | 1
}

/** Rows owned through user_id. profiles is the exception and uses id. */
export interface OwnedRow extends SyncedRow {
  user_id: string
}

/** Fields the sync layer strips before a push. */
export const LOCAL_ONLY_FIELDS = ['dirty'] as const

export interface Profile extends SyncedRow {
  /** Equals the auth user id; this table has no user_id column. */
  id: string
  display_name: string
  sex: Sex
  /** Local day key. */
  birth_date: DateKey | null
  height_mm: number | null
  activity_level: ActivityLevel
  goal: Goal
  training_age: TrainingAge
  training_days_per_week: number
  /** Weekly cardio target in seconds (default 150 minutes). */
  cardio_target_s: number
  /** Protein target in decigrams per kg (20 = 2.0 g per kg; band 16 to 24). */
  protein_dg_per_kg: number
  /** User override of the suggested calorie target, or null to accept the suggestion. */
  calorie_override_kcal: number | null
  /** Typical sleep in minutes; feeds the recommender step-down. */
  sleep_min: number | null
  /** 0 Sunday to 6 Saturday. */
  week_starts_on: Weekday
  /** Weekday the review runs; default 0 (Sunday). */
  review_weekday: Weekday
  /** Minutes after midnight for the review prompt; default 18 * 60. */
  review_minute_of_day: number
  checkin_interval_days: number
  /** 'nin' for ICMR-NIN 2020, 'dri' for US DRI. */
  reference_intakes: 'nin' | 'dri'
  active_gym_profile_id: string | null
  onboarding_done: boolean
}

/** body_weights. id derives from (user_id, date_key) so two devices merge. */
export interface WeighIn extends OwnedRow {
  date_key: DateKey
  weight_g: number
  waist_mm: number | null
  same_conditions: boolean
  note: string | null
}

export type PhotoPose = 'front' | 'side' | 'back'

/** photos. id derives from (user_id, date_key, pose). */
export interface Photo extends OwnedRow {
  weighin_id: string | null
  date_key: DateKey
  pose: PhotoPose
  /** `${user_id}/checkins/${date_key}/${pose}.jpg` */
  storage_path: string
  /** `${user_id}/checkins/${date_key}/${pose}_thumb.jpg` */
  thumb_path: string
  width: number
  height: number
  bytes: number
  /** Null until the outbox has pushed the file. */
  uploaded_at: IsoTimestamp | null
}

export interface DeloadState {
  /** 6 by default, 5 while the deficit is 20 percent or more or for advanced lifters. */
  every_weeks: number
  /** Weeks since program start or the last deload. */
  week_index: number
  last_deload_on: DateKey | null
  /** True while the current week is a deload week. */
  active: boolean
}

export interface ProgramSettings {
  /** Index of the last completed template day; next session is (pointer + 1) mod n. */
  pointer: number
  /** Weekday to template day key, for example { 6: 'legs_a' }. Default on for fixed splits, off for PPL. */
  pins: Partial<Record<Weekday, string>>
  deload: DeloadState
  priority_group: MuscleGroup | null
  /** Per-hand dumbbell rungs in grams, ascending. */
  dumbbell_ladder_g: number[]
  /** Stack step per exercise id in grams; default 5000 for machines. */
  stack_step_g: Record<string, number>
  /** Rest overrides per exercise id in seconds. */
  rest_s: Record<string, number>
  /** Weekly sessions target shown on Home as "2 of 6". */
  weekly_sessions_target: number
  /** Paused for travel or illness: no prompts, no counters. */
  paused: boolean
}

export interface Program extends OwnedRow {
  template_key: string
  split: Split
  days_per_week: number
  started_on: DateKey
  active: boolean
  settings: ProgramSettings
}

export type WorkoutStatus = 'in_progress' | 'finished' | 'discarded'

export interface Workout extends OwnedRow {
  program_id: string | null
  planned_on: DateKey
  /** Template day key, or 'custom'. */
  session_key: string
  started_at: IsoTimestamp
  /** One-way: once set it is never cleared by a stale copy. */
  finished_at: IsoTimestamp | null
  status: WorkoutStatus
  notes: string | null
  /** Body weight snapshot for bodyweight-load exercises, or null. */
  body_weight_g: number | null
  /** The plan the session started from, kept for resume and the summary. */
  plan: SessionPlan | null
}

export type SetKind = 'warmup' | 'working'

export interface WorkoutSet extends OwnedRow {
  workout_id: string
  exercise_id: string
  /** Order within the workout, warm-ups included. */
  set_index: number
  kind: SetKind
  target_reps: number | null
  target_load_g: number | null
  /** Null until completed. Seconds for time-loaded exercises. */
  reps: number | null
  /** External load in grams. 0 for plain bodyweight. */
  load_g: number | null
  /** Assistance in grams, as its own positive number. 0 when not assisted. */
  assist_g: number
  /** 6 to 10, only on the ramp-to-effort protocol. */
  rpe: number | null
  completed_at: IsoTimestamp | null
  rest_s: number | null
  /** The planned exercise this set replaced, when the user swapped. */
  substituted_for: string | null
}

export type CardioKind = 'run_outdoor' | 'run_treadmill' | 'incline_walk' | 'other'
export type RunType = 'easy' | 'long' | 'tempo' | 'intervals'

export interface CardioSession extends OwnedRow {
  date_key: DateKey
  kind: CardioKind
  started_at: IsoTimestamp
  duration_s: number
  distance_m: number | null
  /** Metres per hour (5.5 km/h = 5500). */
  speed_m_per_h: number | null
  /** Tenths of a percent (12 percent = 120). */
  incline_tenths_pct: number | null
  /** 1 to 10. */
  effort: number | null
  avg_hr: number | null
  run_type: RunType | null
  handrail: boolean
  notes: string | null
}

export interface MachineSetting extends OwnedRow {
  machine_id: string
  gym_profile_id: string | null
  seat: string | null
  pad: string | null
  grip: string | null
  pin: string | null
  foot_plate: string | null
  note: string | null
}

export interface GymProfile extends OwnedRow {
  name: string
  /** Ids from machine-index.ts. */
  machine_ids: string[]
  /** Machine id to the nicknames people in this gym use. */
  custom_aliases: Record<string, string[]>
  /** Share code friends type to join. */
  join_code: string | null
}

// ---------------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------------

/** The 29 panel nutrients plus iodine as a separate estimated row. */
export const NUTRIENT_IDS = [
  'energy_kcal',
  'protein',
  'carbs',
  'fat',
  'fibre',
  'sugar',
  'sat_fat',
  'vit_a_rae',
  'vit_c',
  'vit_d',
  'vit_e',
  'vit_k',
  'b1',
  'b2',
  'b3',
  'b5',
  'b6',
  'b9_dfe',
  'b12',
  'calcium',
  'iron',
  'magnesium',
  'phosphorus',
  'potassium',
  'sodium',
  'zinc',
  'copper',
  'manganese',
  'selenium',
  'iodine',
] as const
export type NutrientId = (typeof NUTRIENT_IDS)[number]

/** Integers per 100 g: kcal for energy, mg for the six macros, mcg for every vitamin and mineral. Null means unknown. */
export type NutrientPanel = Partial<Record<NutrientId, number | null>>

export type FoodSource = 'usda' | 'off' | 'label' | 'recipe' | 'user'
export type PanelFlag = 'full' | 'partial' | 'macros'
export type PortionState = 'raw' | 'cooked' | 'as_served'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** foods. user_id is null for the seeded catalogue; those rows are read-only. */
export interface Food extends SyncedRow {
  user_id: string | null
  source: FoodSource
  source_id: string | null
  name: string
  name_alt: string[]
  brand: string | null
  panel: PanelFlag
  /** Food id whose vitamins and minerals fill this row's nulls, flagged estimated. */
  micro_from: string | null
  n: NutrientPanel
  nearest_generic: boolean
  licence: string | null
  is_public: boolean
}

export interface Portion extends SyncedRow {
  user_id: string | null
  food_id: string
  label: string
  grams: number
  state: PortionState
  is_default: boolean
}

export interface Favourite extends OwnedRow {
  food_id: string
  portion_id: string | null
  last_grams: number
  use_count: number
  last_used_at: IsoTimestamp
}

export interface FoodLog extends OwnedRow {
  date_key: DateKey
  meal: MealSlot
  food_id: string | null
  recipe_id: string | null
  grams: number
  /** Nutrients for this row at log time, so later edits never rewrite history. */
  n_snapshot: NutrientPanel
  logged_at: IsoTimestamp
}

// ---------------------------------------------------------------------------
// Sync bookkeeping (local only)
// ---------------------------------------------------------------------------

export const SYNC_TABLES = [
  'profiles',
  'body_weights',
  'photos',
  'programs',
  'workouts',
  'workout_sets',
  'cardio_sessions',
  'machine_settings',
  'gym_profiles',
  'foods',
  'portions',
  'favourites',
  'food_logs',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

/** Which column names the owner for the pull filter. profiles uses its id. */
export const OWNER_COLUMN: Record<SyncTable, 'user_id' | 'id'> = {
  profiles: 'id',
  body_weights: 'user_id',
  photos: 'user_id',
  programs: 'user_id',
  workouts: 'user_id',
  workout_sets: 'user_id',
  cardio_sessions: 'user_id',
  machine_settings: 'user_id',
  gym_profiles: 'user_id',
  foods: 'user_id',
  portions: 'user_id',
  favourites: 'user_id',
  food_logs: 'user_id',
}

/** Tables pulled without an owner filter (the shared catalogue). */
export const SHARED_TABLES: readonly SyncTable[] = ['foods', 'portions']

export type OutboxOp = 'upsert' | 'delete' | 'upload'
export type OutboxState = 'pending' | 'in_flight' | 'dead'

export interface OutboxItem {
  id: string
  table: SyncTable
  row_id: string
  op: OutboxOp
  /** The row as it should reach the server, local-only fields stripped. For 'upload', the blob lives in `blob`. */
  payload: Record<string, unknown>
  blob?: Blob
  created_at: IsoTimestamp
  attempts: number
  state: OutboxState
  /** Last response classification, for the dead-letter line. */
  last_error: string | null
}

export interface MetaRow {
  key: string
  value: unknown
}

export type RowOf<T extends SyncTable> = T extends 'profiles'
  ? Profile
  : T extends 'body_weights'
    ? WeighIn
    : T extends 'photos'
      ? Photo
      : T extends 'programs'
        ? Program
        : T extends 'workouts'
          ? Workout
          : T extends 'workout_sets'
            ? WorkoutSet
            : T extends 'cardio_sessions'
              ? CardioSession
              : T extends 'machine_settings'
                ? MachineSetting
                : T extends 'gym_profiles'
                  ? GymProfile
                  : T extends 'foods'
                    ? Food
                    : T extends 'portions'
                      ? Portion
                      : T extends 'favourites'
                        ? Favourite
                        : FoodLog
