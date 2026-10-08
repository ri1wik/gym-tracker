// Start a session from a plan. The program screen calls this with the
// planner's output and navigates to PATHS.session(id); the history screen
// uses it for a quick session built through the plan adapter.

import { localDateKey } from '../../domain/dates'
import type { SessionPlan, SessionRequest } from '../../domain/planner/index'
import { emptyContext, planSession } from './plan'
import { activeWorkoutId, plannerHistory, startWorkout, type StartOptions } from './repo'

export interface StartResult {
  id: string
  /** True when an in-progress session already existed and was returned instead. */
  resumed: boolean
}

/** Start from a ready plan, or return the session already in progress. */
export async function startSession(plan: SessionPlan, opts: StartOptions = {}): Promise<StartResult> {
  const active = await activeWorkoutId()
  if (active) return { id: active, resumed: true }
  const id = await startWorkout(plan, opts)
  return { id, resumed: false }
}

/** Build a plan through the planner and start it. */
export async function startQuickSession(request?: Partial<SessionRequest>): Promise<StartResult> {
  const active = await activeWorkoutId()
  if (active) return { id: active, resumed: true }
  const history = await plannerHistory()
  const ctx = emptyContext(history)
  const plan = planSession(
    {
      focus: { kind: 'any' },
      minutes: 60,
      intent: 'normal',
      exclude_exercise_ids: [],
      exclude_families: [],
      date_key: localDateKey(),
      ...request,
    },
    ctx,
  )
  return startSession(plan)
}
