// What the program learns from a finished session: the rotation pointer
// moves to the template day just completed (a custom session advances it
// only when it covered enough of the next day, which the planner decided
// when the plan was built and stored on the workout).

import type { GymDb } from '../../../data/db'
import { pointerAfterSession, programStateFrom } from '../../../domain/planner/index'
import type { Workout } from '../../../domain/types'
import { templateByKey } from './templates'
import { deficitFractionOf, getProfile, updateProgramSettings } from './store'

/** Advance the active program after `workout` finished. Safe to call for any workout; does nothing for one outside a program. */
export async function recordFinishedSession(db: GymDb, workout: Workout): Promise<void> {
  if (!workout.program_id) return
  const program = await db.programs.get(workout.program_id)
  if (!program || program.deleted_at !== null) return
  const template = templateByKey(program.template_key)
  if (!template) return
  const profile = await getProfile(db)
  const state = programStateFrom(program, template, deficitFractionOf(profile), profile?.training_age ?? 'intermediate')
  const effect = workout.plan?.rotation_effect ?? 'advances'
  const pointer = pointerAfterSession(state, workout.session_key, effect)
  if (pointer === program.settings.pointer) return
  await updateProgramSettings(db, program, { pointer })
}
