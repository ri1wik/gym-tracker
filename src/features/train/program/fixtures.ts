// Small synthetic templates used only while src/data/library/templates.json
// is absent (before the content-templates slice merges). Real templates win
// the moment that file exists; see templates.ts.

import type { Template, TemplateDay, TemplateItem } from '../../../domain/types'

function item(exercise_id: string, sets: number, rep_min: number, rep_max: number, rest_s: number, key = false): TemplateItem {
  return key
    ? { exercise_id, sets, rep_min, rep_max, rest_s, is_key_lift: true }
    : { exercise_id, sets, rep_min, rep_max, rest_s }
}

function day(key: string, name: string, items: TemplateItem[]): TemplateDay {
  return { key, name, cardio_note: null, items }
}

const PUSH_A = day('push_a', 'Push A', [
  item('barbell-bench-press', 4, 6, 8, 150, true),
  item('incline-dumbbell-press', 3, 8, 12, 120),
  item('dumbbell-lateral-raise', 3, 12, 15, 60),
  item('cable-pushdown', 3, 10, 15, 60),
])
const PULL_A = day('pull_a', 'Pull A', [
  item('barbell-row', 4, 6, 8, 150, true),
  item('lat-pulldown', 3, 8, 12, 120),
  item('face-pull', 3, 12, 15, 60),
  item('dumbbell-curl', 3, 10, 15, 60),
])
const LEGS_A = day('legs_a', 'Legs A', [
  item('back-squat', 4, 5, 8, 180, true),
  item('romanian-deadlift', 3, 8, 12, 120),
  item('leg-extension', 3, 10, 15, 75),
  item('standing-calf-raise', 3, 10, 15, 60),
])
const PUSH_B = day('push_b', 'Push B', [
  item('overhead-press', 4, 6, 8, 150, true),
  item('machine-chest-press', 3, 8, 12, 120),
  item('cable-lateral-raise', 3, 12, 15, 60),
  item('overhead-cable-extension', 3, 10, 15, 60),
])
const PULL_B = day('pull_b', 'Pull B', [
  item('seated-cable-row', 4, 8, 12, 120, true),
  item('chest-supported-machine-row', 3, 8, 12, 120),
  item('reverse-pec-deck', 3, 12, 15, 60),
  item('hammer-curl', 3, 10, 15, 60),
])
const LEGS_B = day('legs_b', 'Legs B', [
  item('leg-press', 4, 8, 12, 150, true),
  item('lying-leg-curl', 3, 8, 12, 90),
  item('barbell-hip-thrust', 3, 8, 12, 120),
  item('seated-calf-raise', 3, 10, 15, 60),
])
const UPPER_A = day('upper_a', 'Upper A', [
  item('barbell-bench-press', 3, 6, 8, 150, true),
  item('barbell-row', 3, 6, 8, 150),
  item('dumbbell-lateral-raise', 3, 12, 15, 60),
  item('dumbbell-curl', 2, 10, 15, 60),
])
const LOWER_A = day('lower_a', 'Lower A', [
  item('back-squat', 3, 5, 8, 180, true),
  item('romanian-deadlift', 3, 8, 12, 120),
  item('leg-extension', 2, 10, 15, 75),
  item('standing-calf-raise', 3, 10, 15, 60),
])
const UPPER_B = day('upper_b', 'Upper B', [
  item('overhead-press', 3, 6, 8, 150, true),
  item('lat-pulldown', 3, 8, 12, 120),
  item('machine-chest-press', 3, 8, 12, 120),
  item('cable-pushdown', 2, 10, 15, 60),
])
const LOWER_B = day('lower_b', 'Lower B', [
  item('leg-press', 3, 8, 12, 150, true),
  item('lying-leg-curl', 3, 8, 12, 90),
  item('barbell-hip-thrust', 3, 8, 12, 120),
  item('seated-calf-raise', 3, 10, 15, 60),
])
const FULL_A = day('full_a', 'Full body A', [
  item('back-squat', 3, 5, 8, 180, true),
  item('barbell-bench-press', 3, 6, 8, 150),
  item('barbell-row', 3, 6, 8, 150),
  item('plank', 2, 30, 60, 60),
])
const FULL_B = day('full_b', 'Full body B', [
  item('romanian-deadlift', 3, 6, 10, 150, true),
  item('overhead-press', 3, 6, 8, 150),
  item('lat-pulldown', 3, 8, 12, 120),
  item('cable-crunch', 2, 10, 15, 60),
])
const FULL_C = day('full_c', 'Full body C', [
  item('leg-press', 3, 8, 12, 150, true),
  item('incline-dumbbell-press', 3, 8, 12, 120),
  item('seated-cable-row', 3, 8, 12, 120),
  item('dumbbell-curl', 2, 10, 15, 60),
])

export const FALLBACK_TEMPLATES: Template[] = [
  { key: 'ppl_6', name: 'Push, pull, legs, 6 days', split: 'ppl_6', days_per_week: 6, days: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B] },
  { key: 'ppl_5', name: 'Push, pull, legs, 5 day rotation', split: 'ppl_5', days_per_week: 5, days: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B] },
  { key: 'upper_lower_4', name: 'Upper and lower, 4 days', split: 'upper_lower_4', days_per_week: 4, days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] },
  { key: 'full_body_3', name: 'Full body, 3 days', split: 'full_body_3', days_per_week: 3, days: [FULL_A, FULL_B, FULL_C] },
  { key: 'minimal_2', name: 'Minimal, 2 days', split: 'minimal_2', days_per_week: 2, days: [FULL_A, FULL_B] },
]
