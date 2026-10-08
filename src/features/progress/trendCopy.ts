// Words for a trend state. Neutral where the maths is not precise yet, one
// concrete action wherever something needs attention, no judgement words,
// no exclamation marks.

import type { Goal } from '../../domain/calc/targets'
import type { TrendState } from '../../domain/calc/trend'

export type TrendTone = 'neutral' | 'positive' | 'attention'

export interface TrendRead {
  headline: string
  /** The action or the explanation under the headline. */
  detail: string | null
  tone: TrendTone
  /** Set while readings are still being collected: "n of 10". */
  collecting: { count: number; expected: number } | null
}

function pct(rate: number): string {
  return `${Math.abs(rate).toFixed(1)}%`
}

function dirWord(rate: number): 'down' | 'up' {
  return rate < 0 ? 'down' : 'up'
}

export function describeTrend(t: TrendState, goal: Goal): TrendRead {
  const progress = { count: t.readings_count, expected: t.readings_expected }
  const rate = t.rate_pct_per_week

  if (t.band === 'collecting') {
    return {
      headline: t.readings_count === 0 ? 'No readings yet' : 'Collecting readings',
      detail:
        t.readings_count === 0
          ? 'Log your first weigh-in to start the trend.'
          : 'A direction shows after 4 readings over 12 days. Keep weighing in every 4 days.',
      tone: 'neutral',
      collecting: progress,
    }
  }

  if (t.band === 'not_yet_precise' || rate === null) {
    const dir = t.direction === 'unknown' ? 'not clear' : t.direction
    return {
      headline: `Direction: ${dir}, not yet precise`,
      detail: 'A verdict needs more readings. Weigh in on the check-in day and any extra mornings you like.',
      tone: 'neutral',
      collecting: progress,
    }
  }

  switch (t.band) {
    case 'on_track':
      return {
        headline: `${dirWord(rate) === 'down' ? 'Down' : 'Up'} ${pct(rate)} a week, inside the on-track band`,
        detail: 'Keep intake and training exactly where they are.',
        tone: 'positive',
        collecting: null,
      }
    case 'flat':
      if (goal === 'recomp') {
        return {
          headline: 'Scale flat, which fits recomposition',
          detail: 'Look at strength and waist before changing anything.',
          tone: 'neutral',
          collecting: null,
        }
      }
      if (goal === 'maintain') {
        return { headline: 'Holding steady', detail: 'Keep intake where it is.', tone: 'positive', collecting: null }
      }
      return {
        headline: 'Needs attention: the trend is flat',
        detail:
          goal === 'lean_gain'
            ? 'Add about 100 kcal a day and re-check at the next two check-ins.'
            : 'Take about 100 kcal off a day or add one 25-minute incline walk, then re-check in two weeks.',
        tone: 'attention',
        collecting: null,
      }
    case 'too_fast':
      return {
        headline: `Needs attention: down ${pct(rate)} a week`,
        detail: 'That is faster than muscle can be protected. Add 150 to 250 kcal a day and keep protein where it is.',
        tone: 'attention',
        collecting: null,
      }
    case 'slow_down':
      return {
        headline: `Needs attention: down ${pct(rate)} a week`,
        detail: 'That is well past a safe pace. Add about 250 kcal a day this week and re-check at the next check-in.',
        tone: 'attention',
        collecting: null,
      }
    case 'gaining':
      if (goal === 'lean_gain') {
        return {
          headline: `Up ${pct(rate)} a week`,
          detail: 'That fits a lean gain. Keep protein at target.',
          tone: 'positive',
          collecting: null,
        }
      }
      return {
        headline: `Needs attention: up ${pct(rate)} a week`,
        detail: 'If this is not the plan, take about 100 kcal off a day and re-check at the next check-in.',
        tone: 'attention',
        collecting: null,
      }
    default:
      return { headline: 'Collecting readings', detail: null, tone: 'neutral', collecting: progress }
  }
}
