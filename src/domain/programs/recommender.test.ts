import { describe, expect, it } from 'vitest'
import type { RecommendInput } from './recommender'
import { recommendSplit } from './recommender'

function input(over: Partial<RecommendInput> = {}): RecommendInput {
  return { days_per_week: 6, minutes: 60, priority: null, profile: { training_age: 'intermediate', sleep_min: 450 }, deficit_fraction: 0.15, ...over }
}

describe('recommender', () => {
  it('first match wins down the rule list', () => {
    expect(recommendSplit(input({ minutes: 30 })).split).toBe('full_body_3')
    expect(recommendSplit(input({ minutes: 30, days_per_week: 2 })).split).toBe('minimal_2')
    expect(recommendSplit(input({ days_per_week: 2 })).split).toBe('minimal_2')
    expect(recommendSplit(input({ days_per_week: 3, profile: { training_age: 'beginner', sleep_min: 450 } })).split).toBe('full_body_3')
    expect(recommendSplit(input({ days_per_week: 5, profile: { training_age: 'beginner', sleep_min: 450 } })).split).toBe('upper_lower_4')
    expect(recommendSplit(input()).split).toBe('ppl_6')
    expect(recommendSplit(input({ minutes: 45 })).split).toBe('ppl_5')
    expect(recommendSplit(input({ days_per_week: 5 })).split).toBe('ppl_5')
    expect(recommendSplit(input({ days_per_week: 4 })).split).toBe('upper_lower_4')
    expect(recommendSplit(input({ days_per_week: 3 })).split).toBe('full_body_3')
  })

  it('short sleep steps down one tier and a deep deficit caps at 5 days', () => {
    expect(recommendSplit(input({ profile: { training_age: 'intermediate', sleep_min: 360 } })).split).toBe('ppl_5')
    expect(recommendSplit(input({ days_per_week: 3, profile: { training_age: 'intermediate', sleep_min: 360 } })).split).toBe('minimal_2')
    const deep = recommendSplit(input({ deficit_fraction: 0.25 }))
    expect(deep.split).toBe('ppl_5')
    expect(deep.reason).toContain('caps training at 5 days')
  })

  it('a priority muscle does not change the split and is named in the reason', () => {
    const r = recommendSplit(input({ priority: 'side_delts' }))
    expect(r.split).toBe('ppl_6')
    expect(r.template_key).toBe('ppl_6')
    expect(r.reason).toBe('Push/pull/legs, 6 days: you have 6 days and 60 minutes; side delts go first in their session and get 2 to 4 extra sets')
  })

  it('names two alternatives with trade-offs', () => {
    const r = recommendSplit(input({ days_per_week: 4 }))
    expect(r.alternatives.map((a) => a.split)).toEqual(['full_body_3', 'ppl_5'])
    for (const a of r.alternatives) expect(a.tradeoff.length).toBeGreaterThan(0)
    const top = recommendSplit(input())
    expect(top.alternatives.map((a) => a.split)).toEqual(['ppl_5', 'upper_lower_4'])
  })
})
