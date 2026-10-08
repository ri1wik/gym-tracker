// The review contract. index.ts re-exports everything here so UI slices keep
// importing from '../domain/review/index'. Fields added by the engine beyond
// the architect's stub are optional and marked as such.

import type { BodyPart, CardioSession, DateKey, FoodLog, WeighIn, Workout, WorkoutSet, ExerciseIndexEntry } from '../types'
import type { TrendState } from '../calc/trend'

export type SignalCode = 'weight_trend' | 'sessions' | 'sets_by_body_part' | 'protein' | 'cardio' | 'lifts'

export type SignalStatus = 'positive' | 'neutral' | 'attention' | 'to_unlock'

export interface Signal {
  code: SignalCode
  status: SignalStatus
  /** The headline number as text with its unit, for example "4 of 4" or "0.4%". */
  number: string
  /** One sentence naming the number. */
  sentence: string
  /** One concrete action. Required on attention items; may repeat the sentence's advice on positives. */
  action: string
  /** For to_unlock: what is still needed, for example "log 2 more days". */
  unlock: string | null
  /** Per-body-part detail for sets_by_body_part, per-exercise detail for lifts. */
  detail: Record<string, number> | null
  /** Short title for the card, for example "Weight trend". Optional extension. */
  title?: string
}

/** A food from the user's own list the protein signal may name. */
export interface ProteinFoodOption {
  name: string
  /** Protein in milligrams per 100 g, as the foods panel stores it. */
  protein_mg_per_100g: number
  /** The portion the user usually logs, in grams. */
  portion_g: number
}

/** Everything the review reads, already cut to the window by the caller. */
export interface ReviewRecords {
  week_start: DateKey
  /** Exclusive. */
  week_end: DateKey
  workouts: Workout[]
  sets: WorkoutSet[]
  /** Four weeks of sets for the lifts and deficit-hold rules. */
  sets_4w: WorkoutSet[]
  weigh_ins: WeighIn[]
  cardio: CardioSession[]
  cardio_prev_week: CardioSession[]
  food_logs: FoodLog[]
  exercises: Readonly<Record<string, ExerciseIndexEntry>>
  /** Trend state computed by trendState() on the same weigh-ins. */
  trend: TrendState
  /** Sessions planned this week from the program. */
  planned_sessions: number
  /** Protein target in grams for the week's days. */
  protein_target_g: number
  /** Deficit fraction for the 8-set floor and deficit-hold framing. */
  deficit_fraction: number
  /** True while the minimal split is active: band 6 to 12 and the guard is silent. */
  minimal_split: boolean
  /** Deload week reads as a neutral row. */
  deload_week: boolean
  /** The user's free-text line from last week, quoted back. */
  previous_note: string | null

  // Optional extensions (engine-trend-review). Absent means "unknown", and
  // every rule that reads one degrades to the plain form of its message.

  /** Four weeks of weigh-ins, for the waist part of the recomposition marker. Falls back to weigh_ins. */
  weigh_ins_4w?: WeighIn[]
  /** Consecutive flat weeks on the trend including this one; a flat week reads neutral until the fourth. */
  flat_weeks?: number
  /** Sessions done and planned in the previous weeks, most recent first, up to three, for the 4-week line. */
  sessions_prev_weeks?: { done: number; planned: number }[]
  /** Weeks since the first logged record; cardio speaks from the second. */
  weeks_of_use?: number
  /** The user's own protein foods, most used first. */
  foods?: ProteinFoodOption[]
  /** Calorie floor for the logging check; null or absent skips it. */
  calorie_floor_kcal?: number | null
  /** Share of comparable lifts that progressed last week, for the "second week running" rule. */
  lifts_prev_week_ratio?: number | null
  /** Last week's sets per body part, for "under the floor for 2 weeks". */
  sets_prev_week?: Partial<Record<BodyPart, number>>
}

export interface WeeklyReview {
  week_start: DateKey
  /** Hash of the inputs so the stored row recomputes when any record changes. */
  inputs_hash: string
  signals: Signal[]
  /** At most three. */
  positives: Signal[]
  /** At most three; the badge reads "Needs attention". */
  attention: Signal[]
  /** One line: the top attention item's action, or "Keep doing exactly this." */
  focus: string
  /** Rows still collecting, each with the exact count needed. */
  to_unlock: Signal[]
  /** "3 sessions, 2 check-ins, 5 days of food." */
  basis: string
  previous_note: string | null
  /** The share-sheet text. */
  share_text: string
  disclaimer: string
  /** Set when logged intake sat under the floor on 3 or more days; the protein row is never positive then. Optional extension. */
  logging_check?: string | null
  /** Neutral rows, for screens that list every signal. Optional extension. */
  neutral?: Signal[]
}

export const REVIEW_PRIORITY: readonly SignalCode[] = ['protein', 'sessions', 'weight_trend', 'lifts', 'sets_by_body_part', 'cardio']

export const SETS_BAND = { lo: 10, hi: 20, deficit_floor: 8, minimal_lo: 6, minimal_hi: 12, priority_lo: 14, priority_hi: 22 } as const

/** Body parts shown but never flagged. */
export const UNFLAGGED_PARTS: readonly BodyPart[] = ['forearms', 'core']

export const DISCLAIMER =
  'General fitness information, not medical advice. See a professional if pregnant, under 18, on medication that affects weight, or with a history of disordered eating.'

export const SIGNAL_TITLE: Record<SignalCode, string> = {
  weight_trend: 'Weight trend',
  sessions: 'Sessions',
  sets_by_body_part: 'Sets per body part',
  protein: 'Protein',
  cardio: 'Cardio',
  lifts: 'Lifts',
}

/** The badge text for attention items. The UI never says "negative" or "failed". */
export const ATTENTION_BADGE = 'Needs attention'
export const POSITIVE_BADGE = 'Positive'
export const KEEP_GOING_FOCUS = 'Keep doing exactly this.'
export const MAX_POSITIVES = 3
export const MAX_ATTENTION = 3
