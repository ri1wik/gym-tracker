// Live reads for the Progress tab.

import { useLiveQuery } from 'dexie-react-hooks'
import type { GymDb } from '../../data/db'
import type { DateKey, Program } from '../../domain/types'
import { currentDb, currentUserId } from '../profile/current'
import { loadStrengthSeries, type StrengthSeries } from './strength'

const KEY_MAX = String.fromCharCode(0xffff)

export interface SessionFacts {
  /** planned_on of every finished strength session. */
  days: DateKey[]
  /** Started_on of the active program, if any. */
  programStart: DateKey | null
  /** Weekly sessions target from the program, if any. */
  programTarget: number | null
}

export async function loadSessionFacts(db: GymDb, userId: string): Promise<SessionFacts> {
  const workouts = await db.workouts.where('[user_id+planned_on]').between([userId, ''], [userId, KEY_MAX]).toArray()
  const days = workouts.filter((w) => w.deleted_at === null && w.status === 'finished').map((w) => w.planned_on)
  const programs = await db.programs.toArray()
  const active: Program | undefined = programs.find((p) => p.deleted_at === null && p.active)
  return {
    days,
    programStart: active?.started_on ?? null,
    programTarget: active?.settings?.weekly_sessions_target ?? null,
  }
}

export function useSessionFacts(): SessionFacts | undefined {
  return useLiveQuery(() => loadSessionFacts(currentDb(), currentUserId()), [], undefined)
}

/** `undefined` while loading, `null` when there is nothing to chart yet. */
export function useStrengthSeries(): StrengthSeries | null | undefined {
  return useLiveQuery(() => loadStrengthSeries(currentDb()), [], undefined)
}
