// The which-split recommender (PLAN.md 3.3).
//
// OWNER: engine-planner. Stub until that slice lands.
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

export function recommendSplit(_input: RecommendInput): Recommendation {
  throw new Error('not implemented: recommendSplit')
}
