import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EXERCISES_BY_ID } from './exercise-index'
import { DEFAULT_TEMPLATE_KEY, TEMPLATES, TEMPLATES_BY_KEY, templateByKey } from './templates'
import { SPLITS } from '../../domain/types'

describe('shipped templates', () => {
  it('has the five splits, one template each, with ppl_6 as the default', () => {
    expect(TEMPLATES.map((t) => t.key)).toEqual([...SPLITS])
    expect(TEMPLATES.map((t) => t.split)).toEqual([...SPLITS])
    expect(DEFAULT_TEMPLATE_KEY).toBe('ppl_6')
    expect(TEMPLATES_BY_KEY.ppl_6.days_per_week).toBe(6)
    expect(templateByKey('nope').key).toBe('ppl_6')
  })

  it('matches the day lists the spec names', () => {
    const days = (k: string) => TEMPLATES_BY_KEY[k].days.map((d) => d.key)
    expect(days('ppl_6')).toEqual(['push_a', 'pull_a', 'legs_a', 'push_b', 'pull_b', 'legs_b'])
    expect(days('ppl_5')).toEqual(days('ppl_6'))
    expect(days('upper_lower_4')).toEqual(['upper_a', 'lower_a', 'upper_b', 'lower_b'])
    expect(days('full_body_3')).toEqual(['full_a', 'full_b', 'full_c'])
    expect(days('minimal_2')).toEqual(['min_a', 'min_b'])
    expect(TEMPLATES.map((t) => t.days_per_week)).toEqual([6, 5, 4, 3, 2])
  })

  it('flags only the 5-day push/pull/legs as a rotation, with the same items as the 6-day', () => {
    expect(TEMPLATES.filter((t) => t.rotation).map((t) => t.key)).toEqual(['ppl_5'])
    expect(TEMPLATES_BY_KEY.ppl_5.days).toEqual(TEMPLATES_BY_KEY.ppl_6.days)
  })

  it('names the focus of each upper/lower day', () => {
    const d = (k: string) => TEMPLATES_BY_KEY.upper_lower_4.days.find((x) => x.key === k)!
    expect(d('lower_a').name).toMatch(/quad/i)
    expect(d('upper_a').name).toMatch(/horizontal/i)
    expect(d('lower_b').name).toMatch(/hinge/i)
    expect(d('upper_b').name).toMatch(/vertical/i)
    expect(d('lower_a').items[0].exercise_id).toBe('back-squat')
    expect(d('lower_b').items[0].exercise_id).toBe('romanian-deadlift')
    expect(d('upper_a').items[0].exercise_id).toBe('barbell-bench-press')
    expect(d('upper_b').items[0].exercise_id).toBe('overhead-press')
  })

  it('references only known exercises, with sane sets, rep ranges and rests', () => {
    for (const t of TEMPLATES) {
      for (const day of t.days) {
        const seen = new Set<string>()
        for (const it of day.items) {
          expect(EXERCISES_BY_ID[it.exercise_id], `${t.key} ${day.key} ${it.exercise_id}`).toBeDefined()
          expect(seen.has(it.exercise_id), `${t.key} ${day.key} repeats ${it.exercise_id}`).toBe(false)
          seen.add(it.exercise_id)
          expect(it.sets).toBeGreaterThanOrEqual(2)
          expect(it.sets).toBeLessThanOrEqual(4)
          expect(it.rep_min).toBeGreaterThanOrEqual(5)
          expect(it.rep_max).toBeGreaterThan(it.rep_min)
          expect(it.rest_s).toBeGreaterThanOrEqual(45)
          expect(it.rest_s).toBeLessThanOrEqual(180)
        }
      }
    }
  })

  it('puts a compound first in every day and flags exactly that one as the key lift', () => {
    for (const t of TEMPLATES) {
      for (const day of t.days) {
        const first = EXERCISES_BY_ID[day.items[0].exercise_id]
        expect(first.isCompound, `${t.key} ${day.key}`).toBe(true)
        const flagged = day.items.filter((i) => i.is_key_lift)
        expect(flagged.map((i) => i.exercise_id)).toEqual([day.items[0].exercise_id])
      }
    }
  })

  it('opens the push/pull/legs days with the key lifts the review reads', () => {
    const first = (k: string) => TEMPLATES_BY_KEY.ppl_6.days.find((d) => d.key === k)!.items[0].exercise_id
    expect(first('push_a')).toBe('barbell-bench-press')
    expect(first('pull_a')).toBe('barbell-row')
    expect(first('legs_a')).toBe('back-squat')
    expect(first('push_b')).toBe('overhead-press')
    expect(first('legs_b')).toBe('romanian-deadlift')
  })

  it('derives pattern_focus from the items, in session order', () => {
    for (const t of TEMPLATES) {
      for (const day of t.days) {
        const expected: string[] = []
        for (const it of day.items) {
          const p = EXERCISES_BY_ID[it.exercise_id].movementPattern
          if (!expected.includes(p)) expected.push(p)
        }
        expect(day.pattern_focus, `${t.key} ${day.key}`).toEqual(expected)
      }
    }
  })

  it('gives every day a cardio note, with nothing hard after legs or lower days', () => {
    for (const t of TEMPLATES) {
      for (const day of t.days) {
        expect(day.cardio_note, `${t.key} ${day.key}`).toBeTruthy()
        if (/^(legs|lower)_/.test(day.key)) expect(day.cardio_note).toMatch(/no hard cardio/i)
      }
    }
  })

  it('keeps assisted work out of the key-lift flag and uses no dash punctuation or model names', () => {
    for (const t of TEMPLATES) {
      for (const day of t.days) {
        for (const it of day.items) {
          if (it.is_key_lift) expect(EXERCISES_BY_ID[it.exercise_id].loadType).not.toBe('assisted')
        }
      }
    }
    const text = readFileSync(fileURLToPath(new URL('./templates.json', import.meta.url)), 'utf8')
    expect(text).not.toContain(String.fromCharCode(0x2014))
    expect(text).not.toContain(String.fromCharCode(0x2013))
  })
})
