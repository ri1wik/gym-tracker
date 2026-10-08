// The which-split recommender (PLAN.md 3.3).
//
// First match wins: 30-minute sessions get full body (minimal at 2 days);
// 2 days gets minimal; a beginner gets full body at 3 days or upper/lower at
// 4 or more; 6 days and 60+ minutes gets PPL 6-day; 5 days gets the PPL
// rotation; 4 gets upper/lower; 3 gets full body. Sleep under 6.5 hours
// steps the pick down one tier; a deficit above 20 percent caps at 5 days.
// A priority muscle does not change the split. The output names the reason
// and two alternatives.
//
// Choices where the rules are silent:
//   - 6 days with under 60 minutes matches no 6-day rule and falls to the
//     5-day rotation (the sixth day becomes rest and cardio).
//   - Poor sleep steps down the chain ppl_6, ppl_5, upper_lower_4,
//     full_body_3 and stops there; minimal_2 is only ever chosen by its own
//     rules (2 days, or 30 minutes at 2 days), never by sleep.
//   - Unknown sleep (null) never steps anything down.

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

/** The most training days a deficit above the cap allows. */
export const DEFICIT_DAY_CAP = 5

const SPLIT_LABEL: Record<Split, string> = {
  ppl_6: 'Push/pull/legs, 6 days',
  ppl_5: 'Push/pull/legs, 5-day rotation',
  upper_lower_4: 'Upper/lower, 4 days',
  full_body_3: 'Full body, 3 days',
  minimal_2: 'Minimal, 2 days',
}

const SPLIT_DAYS: Record<Split, number> = {
  ppl_6: 6,
  ppl_5: 5,
  upper_lower_4: 4,
  full_body_3: 3,
  minimal_2: 2,
}

/** What each split gives you, in one clause. */
const SPLIT_BLURB: Record<Split, string> = {
  ppl_6: '14 to 19 weekly sets per muscle, each trained twice, in 60 to 75 minute sessions',
  ppl_5: '13 to 16 weekly sets per muscle with a rest day of margin, in 60 to 75 minute sessions',
  upper_lower_4: '11 to 14 weekly sets per muscle in 60 to 70 minute sessions, any training age',
  full_body_3: '10 to 12 weekly sets per muscle in 50 to 60 minute sessions, the lightest load on recovery',
  minimal_2: '6 to 8 weekly sets per muscle in 45 minute sessions, enough to hold what you have',
}

const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'chest',
  lats: 'lats',
  upper_back: 'upper back',
  front_delts: 'front delts',
  side_delts: 'side delts',
  rear_delts: 'rear delts',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abs: 'abs',
}

/** The first-match rule, before the sleep step-down. `days` is already capped for a deficit. */
function firstMatch(days: number, minutes: number, beginner: boolean): { split: Split; why: string } {
  if (minutes <= 30) {
    if (days <= 2) return { split: 'minimal_2', why: 'you have 2 days and 30 minutes' }
    return { split: 'full_body_3', why: `${days} days of 30 minutes only fit full-body sessions` }
  }
  if (days <= 2) return { split: 'minimal_2', why: 'you have 2 days a week' }
  if (beginner) {
    if (days === 3) return { split: 'full_body_3', why: 'you are new to lifting and have 3 days' }
    return { split: 'upper_lower_4', why: `you are new to lifting and ${days} days is best used as 4 upper/lower sessions` }
  }
  if (days >= 6 && minutes >= 60) return { split: 'ppl_6', why: `you have 6 days and ${minutes} minutes` }
  if (days >= 5) {
    const why = days >= 6 ? `6 days at ${minutes} minutes leaves room for a rest day` : `you have 5 days and ${minutes} minutes`
    return { split: 'ppl_5', why }
  }
  if (days === 4) return { split: 'upper_lower_4', why: `you have 4 days and ${minutes} minutes` }
  return { split: 'full_body_3', why: `you have 3 days and ${minutes} minutes` }
}

/** One tier down the sleep chain; full body and minimal stay put. */
function stepDown(split: Split): Split {
  if (split === 'minimal_2' || split === 'full_body_3') return split
  return TIER_ORDER[TIER_ORDER.indexOf(split) + 1]
}

function alternativesFor(pick: Split, availableDays: number): [SplitAlternative, SplitAlternative] {
  const pickIdx = TIER_ORDER.indexOf(pick)
  const others = TIER_ORDER.filter((s) => s !== pick)
  // Splits that fit the days available come first, nearest tier first; the rest follow.
  const rank = (s: Split) => {
    const fits = SPLIT_DAYS[s] <= availableDays ? 0 : 1
    const dist = Math.abs(TIER_ORDER.indexOf(s) - pickIdx)
    // On a tie in distance prefer the lighter split (the safer suggestion).
    const lighter = TIER_ORDER.indexOf(s) > pickIdx ? 0 : 1
    return fits * 100 + dist * 2 + lighter
  }
  const picked = [...others].sort((a, b) => rank(a) - rank(b)).slice(0, 2)
  const build = (s: Split): SplitAlternative => {
    const more = TIER_ORDER.indexOf(s) < pickIdx
    const needs = SPLIT_DAYS[s] > availableDays ? ` Needs ${SPLIT_DAYS[s]} days a week.` : ''
    return { split: s, tradeoff: `${more ? 'More work' : 'Less work'}: ${SPLIT_BLURB[s]}.${needs}` }
  }
  return [build(picked[0]), build(picked[1])]
}

export function recommendSplit(input: RecommendInput): Recommendation {
  const { minutes, priority, profile, deficit_fraction } = input

  const capped = deficit_fraction > DEFICIT_DAY_CAP_FRACTION && input.days_per_week > DEFICIT_DAY_CAP
  const days = capped ? DEFICIT_DAY_CAP : input.days_per_week

  const base = firstMatch(days, minutes, profile.training_age === 'beginner')

  const poorSleep = profile.sleep_min !== null && profile.sleep_min < SLEEP_STEP_DOWN_MIN
  const split = poorSleep ? stepDown(base.split) : base.split
  const stepped = split !== base.split

  const parts: string[] = [`${SPLIT_LABEL[split]}: ${base.why}.`]
  if (capped) parts.push('A calorie deficit above 20 percent caps training at 5 days to protect recovery.')
  if (stepped) parts.push(`Sleep under 6.5 hours steps this down from ${SPLIT_LABEL[base.split]} so recovery keeps up.`)
  if (priority) {
    const name = GROUP_LABEL[priority]
    parts.push(
      split === 'minimal_2'
        ? `Your ${name} get their main lift first in each session.`
        : `Your ${name} get their main lift first, in the session after a rest day, and a weekly target of 14 to 22 sets.`,
    )
  }

  return {
    split,
    template_key: split,
    reason: parts.join(' '),
    alternatives: alternativesFor(split, days),
  }
}
