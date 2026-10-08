// A small synthetic push session typed as the planner's output, for tests
// that need a plan without running the planner. Loads are generic, not
// anyone's numbers. Nothing in the app imports this file.

import type { SessionPlan } from '../../domain/planner/index'

export function fixturePlan(): SessionPlan {
  const ex = (
    exercise_id: string,
    slot: number,
    sets: number,
    rep_min: number,
    rep_max: number,
    target_load_g: number,
    rest_s: number,
    warmups: { label: string; load_g: number; reps: number; rest_s: number }[],
    why: string,
  ) => ({
    exercise_id,
    slot,
    sets,
    rep_min,
    rep_max,
    target_reps: Array.from({ length: sets }, () => rep_min + 2),
    target_load_g,
    assist_g: 0,
    load_source: 'history' as const,
    rest_s,
    warmups: warmups.map((w) => ({ ...w, assist_g: 0 })),
    last_time: null,
    why,
    superset_with: null,
    suggested_increase: false,
  })
  return {
    session_key: 'custom',
    name: 'Push (quick)',
    general_warmup: {
      cardio: '5 min incline walk, 3 percent, 5 km/h',
      minutes: 5,
      drills: [
        { name: 'Band pull-aparts', dose: 'x15' },
        { name: 'Scapular push-ups', dose: 'x10' },
      ],
    },
    exercises: [
      ex('barbell-bench-press', 0, 3, 6, 10, 60_000, 150, [
        { label: 'Bar', load_g: 20_000, reps: 10, rest_s: 45 },
        { label: '60%', load_g: 35_000, reps: 5, rest_s: 45 },
        { label: '80%', load_g: 47_500, reps: 2, rest_s: 60 },
      ], 'Main chest press, first because it is the heaviest lift'),
      ex('incline-dumbbell-press', 1, 3, 8, 12, 20_000, 120, [{ label: '70%', load_g: 15_000, reps: 3, rest_s: 60 }], 'Upper chest from a second angle'),
      ex('dumbbell-lateral-raise', 2, 3, 10, 15, 8000, 75, [{ label: 'Feel set', load_g: 5000, reps: 8, rest_s: 45 }], 'Side delts, the width the press misses'),
      ex('cable-pushdown', 3, 3, 10, 15, 25_000, 75, [], 'Triceps to finish, pushdown for the lateral head'),
    ],
    estimated_minutes: 50,
    rotation_effect: 'holds',
    warnings: [],
    deload: false,
    cardio: null,
    needs_minutes: null,
  }
}
