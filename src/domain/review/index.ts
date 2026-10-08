// The weekly review: a pure function of the records in the window and the
// profile (PLAN.md section 6).
//
// OWNER: engine-trend-review. Stub until that slice lands; the types are the
// contract.
//
// Six signals, each positive, neutral, attention or to_unlock, with the
// number, one sentence and one action. At most three positives and three
// attention items in priority order (protein, sessions, weight trend, lifts,
// sets per body part, cardio), one focus from the top attention item or
// "keep doing exactly this". To-unlock rows list the exact count needed and
// never sit under attention. Copy never says "negative" or "failed"; the
// badge reads "Needs attention". No exclamation marks on attention items.
// Banned phrases: burns fat, boosts metabolism, detox, cures, any condition
// name. Every message names a number and ends in one action.

import type { BodyPart, CardioSession, DateKey, FoodLog, Profile, WeighIn, Workout, WorkoutSet, ExerciseIndexEntry } from '../types'
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
}

export const REVIEW_PRIORITY: readonly SignalCode[] = ['protein', 'sessions', 'weight_trend', 'lifts', 'sets_by_body_part', 'cardio']

export const SETS_BAND = { lo: 10, hi: 20, deficit_floor: 8, minimal_lo: 6, minimal_hi: 12, priority_lo: 14, priority_hi: 22 } as const

/** Body parts shown but never flagged. */
export const UNFLAGGED_PARTS: readonly BodyPart[] = ['forearms', 'core']

export const DISCLAIMER =
  'General fitness information, not medical advice. See a professional if pregnant, under 18, on medication that affects weight, or with a history of disordered eating.'

export const BANNED_PHRASES: readonly string[] = ['burns fat', 'boosts metabolism', 'detox', 'cures', 'negative', 'failed']

/** The weekly review from the records in the window. Pure and deterministic. */
export function weeklyReview(_records: ReviewRecords, _profile: Profile): WeeklyReview {
  throw new Error('not implemented: weeklyReview')
}

/** A stable hash of the records, so an edited past set recomputes the stored review. */
export function reviewInputsHash(_records: ReviewRecords): string {
  throw new Error('not implemented: reviewInputsHash')
}
