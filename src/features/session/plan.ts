// The adapter between the session screen and the planner
// (docs/CONTRACTS.md section 6). The engine's output flows through; this
// file only builds the context the screen hands it.

import {
  buildCustomSession,
  substitutesFor,
  DEFAULT_DUMBBELL_LADDER_G,
  type PlannerContext,
  type SessionPlan,
  type SessionRequest,
  type Substitute,
  type SubstituteInput,
  type History,
} from '../../domain/planner/index'
import { BAR_FLOOR_G } from '../../domain/types'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { localDateKey } from '../../domain/dates'

export function emptyContext(history: History = { sets: [], workouts: [] }, today = localDateKey()): PlannerContext {
  return {
    program: null,
    history,
    equipment: {
      dumbbell_ladder_g: [...DEFAULT_DUMBBELL_LADDER_G],
      stack_step_g: {},
      bar_floor_g: { ...BAR_FLOOR_G },
      machine_ids: [],
    },
    exercises: EXERCISES_BY_ID,
    today,
  }
}

/** Build a session plan through the planner. */
export function planSession(request: SessionRequest, ctx: PlannerContext): SessionPlan {
  return buildCustomSession(request, ctx)
}

/** Substitutes for a busy machine, scored by the planner and filtered to the gym. */
export function substitutes(input: SubstituteInput, ctx: PlannerContext): Substitute[] {
  return substitutesFor(input, ctx)
}
