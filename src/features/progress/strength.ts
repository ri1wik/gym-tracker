// The strength panel's data: the estimated one-rep max of the most-trained
// key lift, one point per session day. With no logged key-lift sets this
// resolves to null and the panel shows its empty state.

import type { GymDb } from '../../data/db'
import { epleyG } from '../../domain/calc/e1rm'
import { localDateKey } from '../../domain/dates'
import type { DateKey } from '../../domain/types'
import { EXERCISES_BY_ID, KEY_LIFT_IDS } from '../../data/library/exercise-index'

export interface StrengthSeries {
  exerciseId: string
  name: string
  points: { date_key: DateKey; e1rm_g: number }[]
}

const KEY_MAX = String.fromCharCode(0xffff)

export async function loadStrengthSeries(db: GymDb): Promise<StrengthSeries | null> {
  let best: { id: string; sets: { load_g: number; reps: number; at: string }[] } | null = null
  for (const id of KEY_LIFT_IDS) {
    const rows = await db.workout_sets.where('[exercise_id+completed_at]').between([id, ''], [id, KEY_MAX]).toArray()
    const sets = rows
      .filter((s) => s.deleted_at === null && s.kind === 'working' && s.completed_at !== null && s.reps !== null && (s.load_g ?? 0) > 0)
      .map((s) => ({ load_g: s.load_g as number, reps: s.reps as number, at: s.completed_at as string }))
    if (sets.length > 0 && (best === null || sets.length > best.sets.length)) best = { id, sets }
  }
  if (!best) return null

  const perDay = new Map<DateKey, number>()
  for (const s of best.sets) {
    const e = epleyG(s.load_g, s.reps)
    if (e === null) continue
    const day = localDateKey(new Date(s.at))
    perDay.set(day, Math.max(perDay.get(day) ?? 0, e))
  }
  const points = [...perDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date_key, e1rm_g]) => ({ date_key, e1rm_g }))
  if (points.length === 0) return null
  return { exerciseId: best.id, name: EXERCISES_BY_ID[best.id]?.name ?? best.id, points }
}
