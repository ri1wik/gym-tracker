// Starting the next session: create the workout row and its workout_sets
// rows from the next template day, in one transaction, then point the app at
// it. If a workout is already in progress, that one is returned instead.

import { v4 as uuidv4 } from 'uuid'
import { EXERCISES_BY_ID } from '../../../data/library/exercise-index'
import { META_KEYS, type GymDb } from '../../../data/db'
import {
  programStateFrom,
  type NextSessionResult,
  type PlannerContext,
  type ProgramState,
  type SessionPlan,
} from '../../../domain/planner/index'
import type { DateKey, Program, Workout, WorkoutSet } from '../../../domain/types'
import { equipmentFor, loadHistory, type LoadedHistory } from './history'
import { planForDay, resolveNext, targetFor } from './adapter'
import { deloadSets } from './rotation'
import { templateByKey } from './templates'
import {
  activeUserId,
  deficitFractionOf,
  getActiveGymProfile,
  getActiveProgram,
  getInProgressWorkout,
  getLatestWeighIn,
  getProfile,
  nowIso,
  putRows,
  readSessionMinutes,
} from './store'

export interface StartResult {
  workoutId: string
  /** True when an existing in-progress workout was returned. */
  resumed: boolean
}

type NewSet = Omit<WorkoutSet, 'id' | 'set_index' | 'created_at' | 'updated_at' | 'user_id' | 'workout_id' | 'version' | 'dirty' | 'deleted_at'>

function blankSet(exercise_id: string, kind: 'warmup' | 'working'): NewSet {
  return {
    exercise_id,
    kind,
    target_reps: null,
    target_load_g: null,
    reps: null,
    load_g: null,
    assist_g: 0,
    rpe: null,
    completed_at: null,
    rest_s: null,
    substituted_for: null,
  }
}

/** Set rows from a full planner plan: warm-up ramps first, then working sets. */
export function setsFromPlan(plan: SessionPlan): NewSet[] {
  const out: NewSet[] = []
  const ordered = [...plan.exercises].sort((a, b) => a.slot - b.slot)
  for (const ex of ordered) {
    for (const w of ex.warmups) {
      out.push({
        ...blankSet(ex.exercise_id, 'warmup'),
        target_reps: w.reps,
        target_load_g: w.load_g,
        assist_g: w.assist_g,
        rest_s: w.rest_s,
      })
    }
    for (let i = 0; i < ex.sets; i += 1) {
      out.push({
        ...blankSet(ex.exercise_id, 'working'),
        target_reps: ex.target_reps[i] ?? ex.target_reps[ex.target_reps.length - 1] ?? ex.rep_min,
        target_load_g: ex.target_load_g,
        assist_g: ex.assist_g,
        rest_s: ex.rest_s,
      })
    }
  }
  return out
}

interface Built {
  plan: SessionPlan | null
  sets: NewSet[]
}

async function buildSession(
  db: GymDb,
  program: Program,
  next: NextSessionResult,
  state: ProgramState,
  loaded: LoadedHistory,
  today: DateKey,
): Promise<Built> {
  const profile = await getProfile(db)
  const gym = await getActiveGymProfile(db, profile)
  const equipment = equipmentFor(program, gym)
  const minutes = await readSessionMinutes(db)
  const ctx: PlannerContext = { program: state, history: loaded.history, equipment, exercises: EXERCISES_BY_ID, today }

  const plan = planForDay(next.day, minutes, today, ctx)
  if (plan) return { plan, sets: setsFromPlan(plan) }

  const deload = program.settings.deload.active
  const sets: NewSet[] = []
  for (const item of next.day.items) {
    const count = deload ? deloadSets(item.sets) : item.sets
    const t = targetFor(item, count, loaded.setsByExercise.get(item.exercise_id), {
      equipment,
      deload,
      firstSessionBack: next.first_session_back,
    })
    for (let i = 0; i < count; i += 1) {
      sets.push({
        ...blankSet(item.exercise_id, 'working'),
        target_reps: t.target_reps[i] ?? item.rep_min,
        target_load_g: t.target_load_g,
        assist_g: t.assist_g,
        rest_s: program.settings.rest_s[item.exercise_id] ?? item.rest_s,
      })
    }
  }
  return { plan: null, sets }
}

/** Start (or resume) the next session of the active program. */
export async function startNextSession(db: GymDb, today: DateKey): Promise<StartResult> {
  const live = await getInProgressWorkout(db)
  if (live) return { workoutId: live.id, resumed: true }

  const program = await getActiveProgram(db)
  if (!program) throw new Error('No active program')
  const template = templateByKey(program.template_key)
  if (!template) throw new Error(`Unknown template ${program.template_key}`)

  const profile = await getProfile(db)
  const state = programStateFrom(program, template, deficitFractionOf(profile), profile?.training_age ?? 'intermediate')
  const loaded = await loadHistory(db, today)
  const next = resolveNext(state, loaded.history, today)
  const built = await buildSession(db, program, next, state, loaded, today)

  const stamp = nowIso()
  const userId = activeUserId()
  const weighIn = await getLatestWeighIn(db)
  const workout: Workout = {
    id: uuidv4(),
    user_id: userId,
    program_id: program.id,
    planned_on: today,
    session_key: next.day.key,
    started_at: stamp,
    finished_at: null,
    status: 'in_progress',
    notes: null,
    body_weight_g: weighIn?.weight_g ?? null,
    plan: built.plan,
    created_at: stamp,
    updated_at: stamp,
    version: 1,
    deleted_at: null,
    dirty: 1,
  }
  const rows: WorkoutSet[] = built.sets.map((s, i) => ({
    ...s,
    id: uuidv4(),
    user_id: userId,
    workout_id: workout.id,
    set_index: i,
    created_at: stamp,
    updated_at: stamp,
    version: 1,
    deleted_at: null,
    dirty: 1,
  }))

  await db.transaction('rw', db.workouts, db.workout_sets, db.meta, async () => {
    await putRows(db, 'workouts', [workout])
    await putRows(db, 'workout_sets', rows)
    await db.meta.put({ key: META_KEYS.activeWorkoutId, value: workout.id })
  })
  return { workoutId: workout.id, resumed: false }
}
