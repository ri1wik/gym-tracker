// Rotation pointer with the optional weekday pin, the return rule and the
// 70 percent coverage rule for custom sessions (PLAN.md 3.4).

import { diffDays, weekdayOf } from '../dates'
import type { DateKey, ExerciseIndexEntry, Muscle, TemplateDay } from '../types'
import type { History, HistorySet, NextSessionResult, ProgramState, RotationEffect } from './contract'
import { RETURN_AFTER_DAYS, ROTATION_COVERAGE_THRESHOLD } from './contract'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** The latest day a session was finished or a set completed, or null with no history. */
export function lastTrainingDay(history: History): DateKey | null {
  let last: DateKey | null = null
  for (const w of history.workouts) {
    if (w.finished_at === null) continue
    if (last === null || w.planned_on > last) last = w.planned_on
  }
  for (const s of history.sets) {
    if (last === null || s.date_key > last) last = s.date_key
  }
  return last
}

export function nextSession(program: ProgramState, history: History, today: DateKey): NextSessionResult {
  const days = program.template.days
  const n = days.length
  if (n === 0) throw new Error(`template ${program.template.key} has no days`)
  const weekday = weekdayOf(today)
  const pinKey = program.pins[weekday]
  const pinnedIndex = pinKey ? days.findIndex((d) => d.key === pinKey) : -1

  let index: number
  let rotation_effect: RotationEffect
  if (pinnedIndex >= 0) {
    index = pinnedIndex
    rotation_effect = 'pinned'
  } else {
    index = (((program.pointer + 1) % n) + n) % n
    rotation_effect = 'advances'
  }
  const day = days[index]

  const last = lastTrainingDay(history)
  const gap = last === null ? 0 : diffDays(last, today)
  const first_session_back = last !== null && gap >= RETURN_AFTER_DAYS

  const lastDay = days[((program.pointer % n) + n) % n]
  let reason =
    rotation_effect === 'pinned'
      ? `${WEEKDAY_NAMES[weekday]} is pinned to ${day.name}`
      : `Next after ${lastDay.name}`
  if (first_session_back) reason += `; first session back after ${gap} days, loads minus 5 percent`

  return { day, index, rotation_effect, first_session_back, reason }
}

/** Where the pointer lands after a session with this key and effect. */
export function pointerAfterSession(program: ProgramState, session_key: string, effect: RotationEffect): number {
  const days = program.template.days
  const n = days.length
  const index = days.findIndex((d) => d.key === session_key)
  if (index >= 0) return index
  if (effect === 'advances') return (((program.pointer + 1) % n) + n) % n
  return program.pointer
}

export interface SetCount {
  exercise_id: string
  sets: number
}

/** Sets per primary muscle a template day prescribes. */
export function primarySetsOfDay(day: TemplateDay, exercises: Readonly<Record<string, ExerciseIndexEntry>>): Partial<Record<Muscle, number>> {
  return primarySetsOf(day.items.map((i) => ({ exercise_id: i.exercise_id, sets: i.sets })), exercises)
}

export function primarySetsOf(counts: readonly SetCount[], exercises: Readonly<Record<string, ExerciseIndexEntry>>): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {}
  for (const c of counts) {
    const ex = exercises[c.exercise_id]
    if (!ex) continue
    for (const m of ex.primaryMuscles) out[m] = (out[m] ?? 0) + c.sets
  }
  return out
}

/** Working sets of a history slice aggregated per exercise, for the coverage rule. */
export function setCountsOf(sets: readonly HistorySet[]): SetCount[] {
  const map = new Map<string, number>()
  for (const s of sets) {
    if (s.kind !== 'working') continue
    map.set(s.exercise_id, (map.get(s.exercise_id) ?? 0) + 1)
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([exercise_id, n]) => ({ exercise_id, sets: n }))
}

/**
 * Fraction of the template day's primary-muscle sets a session covers:
 * per muscle, the sets done up to the sets prescribed, over the total.
 */
export function coverageOfDay(day: TemplateDay, counts: readonly SetCount[], exercises: Readonly<Record<string, ExerciseIndexEntry>>): number {
  const need = primarySetsOfDay(day, exercises)
  const have = primarySetsOf(counts, exercises)
  let total = 0
  let covered = 0
  for (const [m, n] of Object.entries(need) as [Muscle, number][]) {
    total += n
    covered += Math.min(n, have[m] ?? 0)
  }
  return total === 0 ? 0 : covered / total
}

/** A custom session advances the rotation only at 70 percent coverage of the next template day. */
export function customRotationEffect(day: TemplateDay, counts: readonly SetCount[], exercises: Readonly<Record<string, ExerciseIndexEntry>>): RotationEffect {
  return coverageOfDay(day, counts, exercises) >= ROTATION_COVERAGE_THRESHOLD ? 'advances' : 'holds'
}
