// Reads and mutations for the logger, all against the local Dexie copy and
// all writes through ./write.ts. Each set completion is one row write
// (PLAN.md section 2, "every tap is saved").

import { v4 as uuidv4 } from 'uuid'
import Dexie from 'dexie'
import { META_KEYS } from '../../data/db'
import type { DateKey, MachineSetting, Workout, WorkoutSet } from '../../domain/types'
import type { HistorySet, SessionPlan } from '../../domain/planner/index'
import { localDateKey } from '../../domain/dates'
import { readMeta, sessionDb, sessionUserId, writeRow, writeRows } from './write'
import { exerciseInfo } from './library'

function nowIso(): string {
  return new Date().toISOString()
}

function base(id: string) {
  const t = nowIso()
  return { id, user_id: sessionUserId(), created_at: t, updated_at: t, version: 1, deleted_at: null, dirty: 1 as const }
}

// ---------------------------------------------------------------------------
// Active workout pointer
// ---------------------------------------------------------------------------

export { activeWorkoutId, setActiveWorkoutId, getWorkout } from './active'
import { setActiveWorkoutId, getWorkout } from './active'

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Non-deleted sets of a workout in set order. */
export async function setsOf(workoutId: string): Promise<WorkoutSet[]> {
  const rows = await sessionDb().workout_sets.where('workout_id').equals(workoutId).toArray()
  return rows.filter((r) => r.deleted_at === null).sort((a, b) => a.set_index - b.set_index)
}

/** Workout ids that count as history: not discarded, not deleted. */
async function liveWorkoutIds(ids: Iterable<string>): Promise<Set<string>> {
  const rows = await sessionDb().workouts.bulkGet([...new Set(ids)])
  return new Set(rows.filter((w): w is Workout => !!w && w.deleted_at === null && w.status !== 'discarded').map((w) => w.id))
}

/** Completed working sets of an exercise from OTHER, non-discarded workouts, newest first. */
export async function previousWorkingSets(exerciseId: string, excludeWorkoutId: string | null, limit = 400): Promise<WorkoutSet[]> {
  const rows = await sessionDb()
    .workout_sets.where('[exercise_id+completed_at]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray()
  const candidates = rows.filter((r) => r.kind === 'working' && r.deleted_at === null && r.reps !== null && r.workout_id !== excludeWorkoutId)
  const live = await liveWorkoutIds(candidates.map((r) => r.workout_id))
  return candidates.filter((r) => live.has(r.workout_id))
}

export async function lastCompletedWorkingSet(exerciseId: string, excludeWorkoutId: string | null): Promise<WorkoutSet | null> {
  const rows = await previousWorkingSets(exerciseId, excludeWorkoutId, 20)
  return rows[0] ?? null
}

/** Exercise ids by most recent completion, for "recents first" in the picker. */
export async function recentExerciseIds(limit = 12): Promise<string[]> {
  const rows = await sessionDb().workout_sets.orderBy('[exercise_id+completed_at]').reverse().limit(2000).toArray()
  const seen = new Map<string, string>()
  for (const r of rows) {
    if (r.deleted_at !== null || r.completed_at === null) continue
    const prev = seen.get(r.exercise_id)
    if (!prev || prev < r.completed_at) seen.set(r.exercise_id, r.completed_at)
  }
  return [...seen.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, limit)
    .map(([id]) => id)
}

export async function machineSettingFor(machineId: string | undefined): Promise<MachineSetting | null> {
  if (!machineId) return null
  const rows = await sessionDb().machine_settings.where('[user_id+machine_id]').equals([sessionUserId(), machineId]).toArray()
  return rows.find((r) => r.deleted_at === null) ?? null
}

export async function finishedWorkouts(limit = 100): Promise<Workout[]> {
  const rows = await sessionDb().workouts.where('status').equals('finished').toArray()
  return rows
    .filter((w) => w.deleted_at === null)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit)
}

/** Planner-shaped history for the substitution scorer and the summary. */
export async function plannerHistory(): Promise<{ sets: HistorySet[]; workouts: { id: string; session_key: string; planned_on: DateKey; finished_at: string | null; substitutions: { from: string; to: string }[] }[] }> {
  const db = sessionDb()
  const workouts = (await db.workouts.toArray()).filter((w) => w.deleted_at === null && w.status !== 'discarded')
  const byId = new Map(workouts.map((w) => [w.id, w]))
  const sets = (await db.workout_sets.toArray()).filter((s) => s.deleted_at === null && s.completed_at !== null && s.reps !== null && byId.has(s.workout_id))
  return {
    sets: sets.map((s) => ({
      workout_id: s.workout_id,
      exercise_id: s.exercise_id,
      kind: s.kind,
      reps: s.reps ?? 0,
      load_g: s.load_g ?? 0,
      assist_g: s.assist_g,
      completed_at: s.completed_at ?? '',
      date_key: byId.get(s.workout_id)?.planned_on ?? localDateKey(),
    })),
    workouts: workouts.map((w) => ({
      id: w.id,
      session_key: w.session_key,
      planned_on: w.planned_on,
      finished_at: w.finished_at,
      substitutions: [],
    })),
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface StartOptions {
  programId?: string | null
  bodyWeightG?: number | null
}

/**
 * Create the workout row and every planned set row (warm-ups labelled W above
 * the working sets), point the active-workout meta at it and return the id.
 */
export async function startWorkout(plan: SessionPlan, opts: StartOptions = {}): Promise<string> {
  const id = uuidv4()
  const workout: Workout = {
    ...base(id),
    program_id: opts.programId ?? null,
    planned_on: localDateKey(),
    session_key: plan.session_key,
    started_at: nowIso(),
    finished_at: null,
    status: 'in_progress',
    notes: null,
    body_weight_g: opts.bodyWeightG ?? null,
    plan,
  }
  const sets: WorkoutSet[] = []
  let index = 0
  for (const pe of plan.exercises) {
    for (const w of pe.warmups) {
      sets.push({
        ...base(uuidv4()),
        workout_id: id,
        exercise_id: pe.exercise_id,
        set_index: index++,
        kind: 'warmup',
        target_reps: w.reps,
        target_load_g: w.load_g,
        reps: null,
        load_g: null,
        assist_g: w.assist_g,
        rpe: null,
        completed_at: null,
        rest_s: w.rest_s,
        substituted_for: null,
      })
    }
    for (let i = 0; i < pe.sets; i++) {
      sets.push({
        ...base(uuidv4()),
        workout_id: id,
        exercise_id: pe.exercise_id,
        set_index: index++,
        kind: 'working',
        target_reps: pe.target_reps[i] ?? pe.rep_min,
        target_load_g: pe.target_load_g,
        reps: null,
        load_g: null,
        assist_g: pe.assist_g,
        rpe: null,
        completed_at: null,
        rest_s: pe.rest_s,
        substituted_for: null,
      })
    }
  }
  await writeRow('workouts', workout)
  await writeRows('workout_sets', sets)
  await setActiveWorkoutId(id)
  return id
}

export interface CompleteValues {
  reps: number
  load_g: number
  assist_g: number
}

/** One row write per completed set. */
export async function completeSet(set: WorkoutSet, v: CompleteValues): Promise<WorkoutSet> {
  const row: WorkoutSet = {
    ...set,
    reps: v.reps,
    load_g: v.load_g,
    assist_g: v.assist_g,
    completed_at: nowIso(),
    updated_at: nowIso(),
  }
  await writeRow('workout_sets', row)
  return row
}

/** Put a done row back to pending so it can be re-logged. */
export async function uncompleteSet(set: WorkoutSet): Promise<void> {
  await writeRow('workout_sets', { ...set, reps: null, load_g: null, completed_at: null, updated_at: nowIso() })
}

export async function removeSet(set: WorkoutSet): Promise<void> {
  await writeRow('workout_sets', { ...set, deleted_at: nowIso(), updated_at: nowIso() })
}

/**
 * Undo a removal. deleted_at is one-way in the sync layer (a tombstone never
 * comes back), so the set returns as a fresh row with the same values and
 * the same slot; the tombstone stays behind.
 */
export async function restoreSet(set: WorkoutSet): Promise<WorkoutSet> {
  const t = nowIso()
  const row: WorkoutSet = { ...set, id: uuidv4(), created_at: t, updated_at: t, version: 1, deleted_at: null, dirty: 1 }
  await writeRow('workout_sets', row)
  return row
}

async function nextSetIndex(workoutId: string): Promise<number> {
  const rows = await sessionDb().workout_sets.where('workout_id').equals(workoutId).toArray()
  return rows.reduce((m, r) => Math.max(m, r.set_index + 1), 0)
}

export interface AddSetsOptions {
  count: number
  targetReps: number | null
  targetLoadG: number | null
  assistG: number
  restS: number | null
  substitutedFor?: string | null
  /** Set indices to take over (a swap keeps its slot in the session); extras append. */
  reuseIndices?: number[]
}

/** Append pending working sets for an exercise (add set, add exercise, swap). */
export async function addSets(workoutId: string, exerciseId: string, o: AddSetsOptions): Promise<WorkoutSet[]> {
  let index = await nextSetIndex(workoutId)
  const rows: WorkoutSet[] = []
  for (let i = 0; i < o.count; i++) {
    rows.push({
      ...base(uuidv4()),
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_index: o.reuseIndices?.[i] ?? index++,
      kind: 'working',
      target_reps: o.targetReps,
      target_load_g: o.targetLoadG,
      reps: null,
      load_g: null,
      assist_g: o.assistG,
      rpe: null,
      completed_at: null,
      rest_s: o.restS,
      substituted_for: o.substitutedFor ?? null,
    })
  }
  await writeRows('workout_sets', rows)
  return rows
}

/** Targets for a freshly added exercise: its last completed set, else nothing. */
export async function targetsFor(exerciseId: string, workoutId: string): Promise<{ targetReps: number | null; targetLoadG: number | null; assistG: number; restS: number | null }> {
  const info = exerciseInfo(exerciseId)
  const last = await lastCompletedWorkingSet(exerciseId, workoutId)
  return {
    targetReps: last?.reps ?? info?.repMin ?? null,
    targetLoadG: last?.load_g ?? null,
    assistG: last?.assist_g ?? 0,
    restS: info?.restS ?? null,
  }
}

/**
 * Machine busy: the pending sets of `from` are removed and the same number of
 * working sets for `to` appended with substituted_for set, so the log records
 * what was actually done and the original keeps its history untouched.
 */
export async function substituteExercise(workoutId: string, from: string, to: string): Promise<void> {
  const sets = await setsOf(workoutId)
  const pending = sets.filter((s) => s.exercise_id === from && s.completed_at === null)
  const pendingWorking = pending.filter((s) => s.kind === 'working')
  const t = nowIso()
  await writeRows(
    'workout_sets',
    pending.map((s) => ({ ...s, deleted_at: t, updated_at: t })),
  )
  const targets = await targetsFor(to, workoutId)
  await addSets(workoutId, to, {
    count: Math.max(1, pendingWorking.length),
    ...targets,
    substitutedFor: from,
    reuseIndices: pendingWorking.map((s) => s.set_index),
  })
}

export async function finishWorkout(id: string): Promise<Workout | null> {
  const w = await getWorkout(id)
  if (!w) return null
  const t = nowIso()
  const row: Workout = { ...w, finished_at: w.finished_at ?? t, status: 'finished', updated_at: t }
  await writeRow('workouts', row)
  const active = await readMeta<string>(META_KEYS.activeWorkoutId)
  if (active === id) await setActiveWorkoutId(null)
  return row
}

/**
 * Discard a session: the status flips so every reader drops it at once, and
 * the tombstone comes later through tombstoneDiscarded, once the undo window
 * has passed (deleted_at is one-way in the sync layer).
 */
export async function discardWorkout(id: string): Promise<void> {
  const w = await getWorkout(id)
  if (!w) return
  await writeRow('workouts', { ...w, status: 'discarded', updated_at: nowIso() })
  const active = await readMeta<string>(META_KEYS.activeWorkoutId)
  if (active === id) await setActiveWorkoutId(null)
}

/** Reverse a discard within the undo window. */
export async function restoreWorkout(id: string): Promise<void> {
  const w = await getWorkout(id)
  if (!w || w.status !== 'discarded') return
  await writeRow('workouts', { ...w, status: 'in_progress', updated_at: nowIso() })
  await setActiveWorkoutId(id)
}

/** After the undo window: soft delete a discarded session and its rows so the deletion reaches the other device. */
export async function tombstoneDiscarded(id: string): Promise<void> {
  const w = await getWorkout(id)
  if (!w || w.status !== 'discarded' || w.deleted_at !== null) return
  const t = nowIso()
  const rows = (await sessionDb().workout_sets.where('workout_id').equals(id).toArray()).filter((r) => r.deleted_at === null)
  await writeRows(
    'workout_sets',
    rows.map((r) => ({ ...r, deleted_at: t, updated_at: t })),
  )
  await writeRow('workouts', { ...w, deleted_at: t, updated_at: t })
}
