// The which-split recommender (PLAN.md 3.3).
//
// OWNER: engine-planner.
//
// First match wins: 30-minute sessions get full body (minimal at 2 days);
// 2 days gets minimal; a beginner gets full body at 3 days or upper/lower at
// 4 or more; 6 days and 60+ minutes gets PPL 6-day; 5 days gets the PPL
// rotation; 4 gets upper/lower; 3 gets full body. Sleep under 6.5 hours
// steps the pick down one tier; a deficit above 20 percent caps at 5 days.
// A priority muscle does not change the split. The output names the reason
// and two alternatives.

import type { MuscleGroup, Profile, Split } from '../types'
import type { SessionMinutes } from '../planner/index'

export interface RecommendInput {
  days_per_week: 2 | 3 | 4 | 5 | 6
  minutes: SessionMinutes
  priority: MuscleGroup | null
  profile: Pick<Profile, 'training_age' | 'sleep_min'>
  /** Deficit as a fraction of maintenance. */
  deficit_fraction: number
}

export interface SplitAlternative {
  split: Split
  /** One-line trade-off. */
  tradeoff: string
}

export interface Recommendation {
  split: Split
  /** Template key to start, for example 'ppl_6'. */
  template_key: string
  reason: string
  alternatives: [SplitAlternative, SplitAlternative]
}

/** The step-down order for poor sleep. */
export const TIER_ORDER: readonly Split[] = ['ppl_6', 'ppl_5', 'upper_lower_4', 'full_body_3', 'minimal_2']
export const SLEEP_STEP_DOWN_MIN = 390
export const DEFICIT_DAY_CAP_FRACTION = 0.2

const SPLIT_NAME: Record<Split, string> = {
  ppl_6: 'Push/pull/legs, 6 days',
  ppl_5: 'Push/pull/legs, 5-day rotation',
  upper_lower_4: 'Upper/lower, 4 days',
  full_body_3: 'Full body, 3 days',
  minimal_2: 'Minimal, 2 days',
}

const TRADEOFF: Record<Split, string> = {
  ppl_6: 'Most volume per muscle, needs 6 days and 7 hours of sleep',
  ppl_5: 'Same sessions rolled over 5 days, each muscle 1.67 times a week',
  upper_lower_4: 'Four sessions, every muscle twice a week, fits a first year',
  full_body_3: 'Three sessions of 50 to 60 minutes, easiest to recover from',
  minimal_2: 'Two sessions, 6 to 8 sets per muscle, for travel and exam weeks',
}

function label(g: MuscleGroup): string {
  return g.replace(/_/g, ' ')
}

export function recommendSplit(input: RecommendInput): Recommendation {
  const { minutes, priority, profile } = input
  let days: number = input.days_per_week
  const notes: string[] = []
  if (input.deficit_fraction > DEFICIT_DAY_CAP_FRACTION && days > 5) {
    days = 5
    notes.push('a deficit above 20 percent caps training at 5 days')
  }
  const beginner = profile.training_age === 'beginner'

  let split: Split
  let why: string
  if (minutes <= 30) {
    split = days <= 2 ? 'minimal_2' : 'full_body_3'
    why = `30-minute sessions suit ${split === 'minimal_2' ? 'two short full-body days' : 'three full-body sessions'}`
  } else if (days <= 2) {
    split = 'minimal_2'
    why = 'you have 2 days, so two full-body sessions 72 hours apart'
  } else if (beginner) {
    split = days === 3 ? 'full_body_3' : 'upper_lower_4'
    why = days === 3 ? 'a first year of training does best on three full-body sessions' : 'a first year of training does best on upper/lower, every muscle twice a week'
  } else if (days >= 6 && minutes >= 60) {
    split = 'ppl_6'
    why = `you have 6 days and ${minutes} minutes`
  } else if (days >= 5) {
    split = 'ppl_5'
    why = `you have ${days} days and ${minutes} minutes`
  } else if (days === 4) {
    split = 'upper_lower_4'
    why = `you have 4 days and ${minutes} minutes`
  } else {
    split = 'full_body_3'
    why = `you have 3 days and ${minutes} minutes`
  }

  const sleep = profile.sleep_min
  if (sleep !== null && sleep < SLEEP_STEP_DOWN_MIN) {
    const i = TIER_ORDER.indexOf(split)
    if (i >= 0 && i < TIER_ORDER.length - 1) {
      split = TIER_ORDER[i + 1]
      notes.push('sleep under 6.5 hours steps the pick down one tier')
    }
  }

  let reason = `${SPLIT_NAME[split]}: ${why}`
  if (notes.length > 0) reason += `; ${notes.join('; ')}`
  if (priority) reason += `; ${label(priority)} go first in their session and get 2 to 4 extra sets`

  const i = TIER_ORDER.indexOf(split)
  const neighbours = [TIER_ORDER[i + 1], TIER_ORDER[i - 1], TIER_ORDER[i + 2], TIER_ORDER[i - 2]].filter((s): s is Split => s !== undefined)
  const alternatives: [SplitAlternative, SplitAlternative] = [
    { split: neighbours[0], tradeoff: TRADEOFF[neighbours[0]] },
    { split: neighbours[1], tradeoff: TRADEOFF[neighbours[1]] },
  ]
  return { split, template_key: split, reason, alternatives }
}
