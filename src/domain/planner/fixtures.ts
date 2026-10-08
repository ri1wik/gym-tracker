// Synthetic fixtures for the planner tests: a PPL template over real
// exercise ids, an equipment profile, and small history builders. Loads
// and reps here are made up for the tests, not anyone's real numbers.

import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { BAR_FLOOR_G } from '../types'
import type { DateKey, Template, TemplateDay, TemplateItem } from '../types'
import type { EquipmentProfile, History, HistorySet, PlannerContext, ProgramState } from './contract'
import { DEFAULT_DUMBBELL_LADDER_G } from './contract'

export function equipment(over: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
    dumbbell_ladder_g: [...DEFAULT_DUMBBELL_LADDER_G],
    stack_step_g: {},
    bar_floor_g: { ...BAR_FLOOR_G },
    machine_ids: [],
    ...over,
  }
}

function item(exercise_id: string, sets: number, rep_min: number, rep_max: number, rest_s: number, is_key_lift = false): TemplateItem {
  const row: TemplateItem = { exercise_id, sets, rep_min, rep_max, rest_s }
  if (is_key_lift) row.is_key_lift = true
  return row
}

function day(key: string, name: string, items: TemplateItem[], cardio_note: string | null = null): TemplateDay {
  return { key, name, cardio_note, items }
}

export const PPL6: Template = {
  key: 'ppl_6',
  name: 'Push/pull/legs, 6 days',
  split: 'ppl_6',
  days_per_week: 6,
  days: [
    day('push_a', 'Push A', [
      item('barbell-bench-press', 4, 6, 8, 150, true),
      item('seated-dumbbell-shoulder-press', 3, 8, 12, 150),
      item('incline-dumbbell-press', 3, 8, 12, 150),
      item('dumbbell-lateral-raise', 4, 12, 15, 75),
      item('cable-pushdown', 3, 12, 15, 75),
      item('overhead-cable-extension', 3, 10, 15, 75),
    ]),
    day('pull_a', 'Pull A', [
      item('barbell-row', 4, 6, 10, 150, true),
      item('lat-pulldown', 3, 8, 12, 150),
      item('seated-cable-row', 3, 10, 12, 150),
      item('face-pull', 3, 12, 15, 75),
      item('barbell-curl', 3, 8, 12, 75),
      item('hammer-curl', 2, 10, 15, 75),
    ]),
    day('legs_a', 'Legs A', [
      item('back-squat', 4, 5, 8, 180, true),
      item('romanian-deadlift', 3, 8, 10, 150),
      item('leg-press', 3, 10, 12, 150),
      item('seated-leg-curl', 3, 10, 15, 75),
      item('standing-calf-raise', 4, 10, 15, 75),
      item('cable-crunch', 3, 12, 15, 75),
    ]),
    day('push_b', 'Push B', [
      item('overhead-press', 4, 6, 8, 150, true),
      item('incline-barbell-bench-press', 3, 8, 12, 150),
      item('dumbbell-bench-press', 3, 8, 12, 150),
      item('cable-lateral-raise', 4, 12, 15, 75),
      item('skull-crusher', 3, 10, 12, 75),
      item('cable-crossover', 3, 12, 15, 75),
    ]),
    day('pull_b', 'Pull B', [
      item('deadlift', 3, 5, 5, 180, true),
      item('pull-up', 3, 6, 10, 150),
      item('chest-supported-machine-row', 3, 10, 12, 150),
      item('reverse-pec-deck', 3, 12, 15, 75),
      item('incline-dumbbell-curl', 3, 10, 15, 75),
      item('cable-curl', 2, 12, 15, 75),
    ]),
    day('legs_b', 'Legs B', [
      item('romanian-deadlift', 4, 8, 10, 150, true),
      item('hack-squat', 3, 8, 12, 150),
      item('bulgarian-split-squat', 3, 10, 12, 150),
      item('lying-leg-curl', 3, 10, 15, 75),
      item('seated-calf-raise', 4, 12, 15, 75),
      item('hanging-knee-raise', 3, 10, 15, 75),
    ]),
  ],
}

export const MINIMAL2: Template = {
  key: 'minimal_2',
  name: 'Minimal, 2 days',
  split: 'minimal_2',
  days_per_week: 2,
  days: [
    day('full_a', 'Full A', [
      item('back-squat', 3, 5, 8, 180, true),
      item('barbell-bench-press', 3, 6, 10, 150),
      item('barbell-row', 3, 6, 10, 150),
      item('dumbbell-lateral-raise', 3, 12, 15, 75),
    ]),
    day('full_b', 'Full B', [
      item('romanian-deadlift', 3, 8, 10, 150, true),
      item('overhead-press', 3, 6, 10, 150),
      item('lat-pulldown', 3, 8, 12, 150),
      item('cable-pushdown', 3, 12, 15, 75),
    ]),
  ],
}

export function program(over: Partial<ProgramState> = {}): ProgramState {
  return {
    template: PPL6,
    pointer: 0,
    pins: {},
    deload: { every_weeks: 6, week_index: 0, last_deload_on: null, active: false },
    priority_group: null,
    started_on: '2026-09-07',
    deficit_fraction: 0.15,
    training_age: 'intermediate',
    ...over,
  }
}

let counter = 0

/** A session of working sets for one exercise on a day: loads in grams, reps per set. */
export function session(exercise_id: string, date_key: DateKey, load_g: number, reps: number[], opts: { assist_g?: number; workout_id?: string } = {}): HistorySet[] {
  counter += 1
  const workout_id = opts.workout_id ?? `w-${date_key}-${exercise_id}-${counter}`
  return reps.map((r, i) => ({
    workout_id,
    exercise_id,
    kind: 'working' as const,
    reps: r,
    load_g,
    assist_g: opts.assist_g ?? 0,
    completed_at: `${date_key}T18:${String(10 + i).padStart(2, '0')}:00Z`,
    date_key,
  }))
}

export function history(sets: HistorySet[] = [], workouts: History['workouts'] = []): History {
  return { sets, workouts }
}

export function ctx(over: Partial<PlannerContext> = {}): PlannerContext {
  return {
    program: program(),
    history: history(),
    equipment: equipment(),
    exercises: EXERCISES_BY_ID,
    today: '2026-10-08',
    ...over,
  }
}

export const EX = EXERCISES_BY_ID
