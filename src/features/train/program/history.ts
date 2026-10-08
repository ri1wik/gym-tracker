// Reads the planner's History and EquipmentProfile out of Dexie.

import type { GymDb } from '../../../data/db'
import { addDays } from '../../../domain/dates'
import {
  DEFAULT_DUMBBELL_LADDER_G,
  type EquipmentProfile,
  type History,
  type HistorySet,
} from '../../../domain/planner/index'
import { BAR_FLOOR_G, type DateKey, type GymProfile, type Program, type Workout, type WorkoutSet } from '../../../domain/types'

/** History window the planner reads. Long enough for the return rule and 3-week trends. */
export const HISTORY_DAYS = 120

export interface LoadedHistory {
  history: History
  workouts: Workout[]
  /** Completed sets by exercise id, newest first. */
  setsByExercise: Map<string, HistorySet[]>
}

export async function loadHistory(db: GymDb, today: DateKey): Promise<LoadedHistory> {
  const since = addDays(today, -HISTORY_DAYS)
  const workouts = await db.workouts.filter((w) => w.deleted_at === null && w.planned_on >= since).toArray()
  const byId = new Map(workouts.map((w) => [w.id, w]))
  const ids = workouts.map((w) => w.id)
  const rows: WorkoutSet[] = ids.length
    ? await db.workout_sets.where('workout_id').anyOf(ids).filter((s) => s.deleted_at === null).toArray()
    : []

  const sets: HistorySet[] = []
  for (const s of rows) {
    if (s.completed_at === null || s.reps === null) continue
    const w = byId.get(s.workout_id)
    if (!w) continue
    sets.push({
      workout_id: s.workout_id,
      exercise_id: s.exercise_id,
      kind: s.kind,
      reps: s.reps,
      load_g: s.load_g ?? 0,
      assist_g: s.assist_g,
      completed_at: s.completed_at,
      date_key: w.planned_on,
    })
  }
  sets.sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1))

  const setsByExercise = new Map<string, HistorySet[]>()
  for (const s of sets) {
    const list = setsByExercise.get(s.exercise_id)
    if (list) list.push(s)
    else setsByExercise.set(s.exercise_id, [s])
  }

  return {
    history: {
      sets,
      workouts: workouts.map((w) => ({
        id: w.id,
        session_key: w.session_key,
        planned_on: w.planned_on,
        finished_at: w.finished_at,
        substitutions: [],
      })),
    },
    workouts,
    setsByExercise,
  }
}

export function equipmentFor(program: Program, gym: GymProfile | null): EquipmentProfile {
  const ladder = program.settings.dumbbell_ladder_g
  return {
    dumbbell_ladder_g: ladder.length > 0 ? [...ladder] : [...DEFAULT_DUMBBELL_LADDER_G],
    stack_step_g: { ...program.settings.stack_step_g },
    bar_floor_g: { ...BAR_FLOOR_G },
    machine_ids: gym ? [...gym.machine_ids] : [],
  }
}
