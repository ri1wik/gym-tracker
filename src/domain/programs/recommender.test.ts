import { describe, expect, it } from 'vitest'
import type { TrainingAge } from '../calc/targets'
import type { Split } from '../types'
import { TEMPLATES_BY_KEY } from '../../data/library/templates'
import { recommendSplit, TIER_ORDER, type RecommendInput } from './recommender'

function run(over: Partial<Omit<RecommendInput, 'profile'>> & { age?: TrainingAge; sleep_min?: number | null }) {
  const { age = 'intermediate', sleep_min = 450, ...rest } = over
  return recommendSplit({
    days_per_week: 4,
    minutes: 60,
    priority: null,
    deficit_fraction: 0,
    ...rest,
    profile: { training_age: age, sleep_min },
  })
}

describe('first-match rules', () => {
  it('30 minutes gets full body, minimal at 2 days', () => {
    expect(run({ minutes: 30, days_per_week: 5 }).split).toBe('full_body_3')
    expect(run({ minutes: 30, days_per_week: 4 }).split).toBe('full_body_3')
    expect(run({ minutes: 30, days_per_week: 3 }).split).toBe('full_body_3')
    expect(run({ minutes: 30, days_per_week: 2 }).split).toBe('minimal_2')
  })

  it('30 minutes beats the beginner and 6-day rules', () => {
    expect(run({ minutes: 30, days_per_week: 6, age: 'advanced' }).split).toBe('full_body_3')
    expect(run({ minutes: 30, days_per_week: 4, age: 'beginner' }).split).toBe('full_body_3')
  })

  it('2 days gets minimal whatever the training age', () => {
    expect(run({ days_per_week: 2, minutes: 90, age: 'advanced' }).split).toBe('minimal_2')
    expect(run({ days_per_week: 2, minutes: 60, age: 'beginner' }).split).toBe('minimal_2')
  })

  it('a beginner gets full body at 3 days and upper/lower at 4 or more', () => {
    expect(run({ days_per_week: 3, age: 'beginner' }).split).toBe('full_body_3')
    expect(run({ days_per_week: 4, age: 'beginner' }).split).toBe('upper_lower_4')
    expect(run({ days_per_week: 5, age: 'beginner', minutes: 75 }).split).toBe('upper_lower_4')
    expect(run({ days_per_week: 6, age: 'beginner', minutes: 90 }).split).toBe('upper_lower_4')
  })

  it('6 days and 60 or more minutes gets PPL 6-day', () => {
    expect(run({ days_per_week: 6, minutes: 60 }).split).toBe('ppl_6')
    expect(run({ days_per_week: 6, minutes: 90, age: 'advanced' }).split).toBe('ppl_6')
    expect(run({ days_per_week: 6, minutes: 75 }).template_key).toBe('ppl_6')
  })

  it('6 days under 60 minutes falls to the 5-day rotation', () => {
    expect(run({ days_per_week: 6, minutes: 45 }).split).toBe('ppl_5')
  })

  it('5 days gets the rotation, 4 gets upper/lower, 3 gets full body', () => {
    expect(run({ days_per_week: 5, minutes: 60 }).split).toBe('ppl_5')
    expect(run({ days_per_week: 5, minutes: 45 }).split).toBe('ppl_5')
    expect(run({ days_per_week: 4, minutes: 45 }).split).toBe('upper_lower_4')
    expect(run({ days_per_week: 3, minutes: 90 }).split).toBe('full_body_3')
  })

  it('always names a shipped template', () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      for (const minutes of [30, 45, 60, 75, 90] as const) {
        for (const age of ['beginner', 'intermediate', 'advanced'] as const) {
          const r = run({ days_per_week: days, minutes, age })
          expect(TEMPLATES_BY_KEY[r.template_key], `${days}/${minutes}/${age}`).toBeDefined()
          expect(r.template_key).toBe(r.split)
        }
      }
    }
  })
})

describe('step-down modifiers', () => {
  it('sleep under 6.5 hours steps down one tier', () => {
    expect(run({ days_per_week: 6, sleep_min: 380 }).split).toBe('ppl_5')
    expect(run({ days_per_week: 5, sleep_min: 380 }).split).toBe('upper_lower_4')
    expect(run({ days_per_week: 4, sleep_min: 380 }).split).toBe('full_body_3')
  })

  it('exactly 6.5 hours or unknown sleep does not step down', () => {
    expect(run({ days_per_week: 6, sleep_min: 390 }).split).toBe('ppl_6')
    expect(run({ days_per_week: 6, sleep_min: null }).split).toBe('ppl_6')
  })

  it('full body and minimal are the floor for poor sleep', () => {
    expect(run({ days_per_week: 3, sleep_min: 300 }).split).toBe('full_body_3')
    expect(run({ days_per_week: 2, sleep_min: 300 }).split).toBe('minimal_2')
    expect(run({ minutes: 30, days_per_week: 4, sleep_min: 300 }).split).toBe('full_body_3')
  })

  it('a deficit above 20 percent caps at 5 days', () => {
    expect(run({ days_per_week: 6, deficit_fraction: 0.25 }).split).toBe('ppl_5')
    expect(run({ days_per_week: 5, deficit_fraction: 0.25 }).split).toBe('ppl_5')
    expect(run({ days_per_week: 4, deficit_fraction: 0.25 }).split).toBe('upper_lower_4')
  })

  it('a deficit of exactly 20 percent does not cap', () => {
    expect(run({ days_per_week: 6, deficit_fraction: 0.2 }).split).toBe('ppl_6')
  })

  it('stacks: a deep deficit and poor sleep on 6 days land on upper/lower', () => {
    const r = run({ days_per_week: 6, deficit_fraction: 0.3, sleep_min: 360 })
    expect(r.split).toBe('upper_lower_4')
    expect(r.reason).toContain('20 percent')
    expect(r.reason).toContain('6.5 hours')
  })
})

describe('priority muscle', () => {
  it('never changes the split', () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      const plain = run({ days_per_week: days })
      const prio = run({ days_per_week: days, priority: 'side_delts' })
      expect(prio.split).toBe(plain.split)
      expect(prio.alternatives.map((a) => a.split)).toEqual(plain.alternatives.map((a) => a.split))
    }
  })

  it('is named in the reason with its main-lift-first behaviour and the 14 to 22 band', () => {
    const r = run({ days_per_week: 5, priority: 'side_delts' })
    expect(r.reason).toContain('side delts')
    expect(r.reason).toContain('main lift first')
    expect(r.reason).toContain('14 to 22')
    expect(run({ days_per_week: 5 }).reason).not.toContain('14 to 22')
  })

  it('does not promise a band on the minimal split', () => {
    const r = run({ days_per_week: 2, priority: 'chest' })
    expect(r.reason).toContain('chest')
    expect(r.reason).not.toContain('14 to 22')
  })
})

describe('reason and alternatives', () => {
  it('states the inputs in the reason', () => {
    const r = run({ days_per_week: 5, minutes: 60 })
    expect(r.reason).toBe('Push/pull/legs, 5-day rotation: you have 5 days and 60 minutes.')
  })

  it('offers two different alternatives, never the pick, each with a one-line trade-off', () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      for (const age of ['beginner', 'advanced'] as const) {
        const r = run({ days_per_week: days, age })
        const [a, b] = r.alternatives
        expect(a.split).not.toBe(r.split)
        expect(b.split).not.toBe(r.split)
        expect(a.split).not.toBe(b.split)
        for (const alt of r.alternatives) {
          expect(TIER_ORDER).toContain(alt.split)
          expect(alt.tradeoff.length).toBeGreaterThan(20)
          expect(alt.tradeoff).not.toContain('\n')
        }
      }
    }
  })

  it('prefers splits that fit the days available, nearest tier first', () => {
    const six = run({ days_per_week: 6 }).alternatives.map((a) => a.split)
    expect(six).toEqual(['ppl_5', 'upper_lower_4'] satisfies Split[])
    const four = run({ days_per_week: 4 }).alternatives.map((a) => a.split)
    expect(four).toEqual(['full_body_3', 'minimal_2'] satisfies Split[])
  })

  it('says when an alternative needs more days than the user has', () => {
    const r = run({ days_per_week: 3 })
    expect(r.split).toBe('full_body_3')
    const withDays = r.alternatives.filter((a) => a.tradeoff.includes('Needs'))
    expect(withDays).toHaveLength(1)
    expect(withDays[0].split).toBe('upper_lower_4')
    expect(withDays[0].tradeoff).toContain('Needs 4 days a week.')
  })

  it('uses no dash punctuation in any string', () => {
    const dashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)]
    for (const days of [2, 3, 4, 5, 6] as const) {
      const r = run({ days_per_week: days, priority: 'quads', deficit_fraction: 0.3, sleep_min: 300 })
      const text = [r.reason, ...r.alternatives.map((a) => a.tradeoff)].join(' ')
      for (const d of dashes) expect(text).not.toContain(d)
    }
  })
})
