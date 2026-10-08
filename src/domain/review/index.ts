// The weekly review: a pure function of the records in the window and the
// profile (PLAN.md section 6).
//
// OWNER: engine-trend-review.
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

import type { Profile } from '../types'
import { stableHash } from './hash'
import { plural } from './format'
import { cardioSignal, compareLifts, finishedWorkouts, foodTotals, liftsSignal, proteinSignal, sessionsSignal, setsSignal, weightSignal } from './signals'
import type { ReviewRecords, Signal, SignalCode, WeeklyReview } from './types'
import { ATTENTION_BADGE, DISCLAIMER, KEEP_GOING_FOCUS, MAX_ATTENTION, MAX_POSITIVES, REVIEW_PRIORITY } from './types'

export type { Signal, SignalCode, SignalStatus, ReviewRecords, WeeklyReview, ProteinFoodOption } from './types'
export {
  REVIEW_PRIORITY,
  SETS_BAND,
  UNFLAGGED_PARTS,
  DISCLAIMER,
  SIGNAL_TITLE,
  ATTENTION_BADGE,
  POSITIVE_BADGE,
  KEEP_GOING_FOCUS,
  MAX_POSITIVES,
  MAX_ATTENTION,
} from './types'
export { BANNED_PHRASES, CONDITION_NAMES, copyProblems, bannedPhraseIn } from './guardrails'
export { recompositionMarker, compareLifts, waistChangeMm } from './signals'
export type { LiftComparison, RecompMarker } from './signals'

function sortByPriority(signals: Signal[]): Signal[] {
  const rank = (c: SignalCode) => REVIEW_PRIORITY.indexOf(c)
  return [...signals].sort((a, b) => rank(a.code) - rank(b.code))
}

/** "3 sessions, 2 check-ins, 5 days of food." */
export function reviewBasis(records: ReviewRecords): string {
  const sessions = finishedWorkouts(records).length
  const checkins = new Set(records.weigh_ins.filter((w) => w.deleted_at === null).map((w) => w.date_key)).size
  const foodDays = foodTotals(records.food_logs).days.length
  return `${sessions} ${plural(sessions, 'session')}, ${checkins} ${plural(checkins, 'check-in')}, ${foodDays} ${plural(foodDays, 'day')} of food.`
}

function shareText(review: WeeklyReview): string {
  const lines: string[] = [`Week of ${review.week_start}`, review.basis]
  for (const s of review.positives) lines.push(`+ ${s.sentence}`)
  for (const s of review.attention) lines.push(`${ATTENTION_BADGE}: ${s.sentence} ${s.action}`)
  lines.push(`Focus: ${review.focus}`)
  if (review.previous_note) lines.push(`Last week I wrote: ${review.previous_note}`)
  return lines.join('\n')
}

/** The weekly review from the records in the window. Pure and deterministic. */
export function weeklyReview(records: ReviewRecords, profile: Profile): WeeklyReview {
  const lifts = compareLifts(records)
  const protein = proteinSignal(records)
  const all: Signal[] = sortByPriority([
    protein.signal,
    sessionsSignal(records),
    weightSignal(records, profile.goal, records.protein_target_g, lifts),
    liftsSignal(records, lifts, records.protein_target_g),
    setsSignal(records),
    cardioSignal(records, profile.cardio_target_s),
  ])

  const positives = all.filter((s) => s.status === 'positive').slice(0, MAX_POSITIVES)
  const attention = all.filter((s) => s.status === 'attention').slice(0, MAX_ATTENTION)
  const neutral = all.filter((s) => s.status === 'neutral')
  const to_unlock = all.filter((s) => s.status === 'to_unlock')
  const focus = attention.length > 0 ? attention[0].action : KEEP_GOING_FOCUS

  const review: WeeklyReview = {
    week_start: records.week_start,
    inputs_hash: reviewInputsHash(records),
    signals: all,
    positives,
    attention,
    focus,
    to_unlock,
    basis: reviewBasis(records),
    previous_note: records.previous_note,
    share_text: '',
    disclaimer: DISCLAIMER,
    logging_check: protein.logging_check,
    neutral,
  }
  review.share_text = shareText(review)
  return review
}

/** A stable hash of the records, so an edited past set recomputes the stored review. */
export function reviewInputsHash(records: ReviewRecords): string {
  // The library and the trend are derived or bundled; everything else is the user's data.
  const { exercises: _exercises, trend: _trend, ...rest } = records
  return stableHash(rest)
}
