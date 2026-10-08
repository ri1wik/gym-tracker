import { META_KEYS } from '../../../data/db'
import { PATHS } from '../../../app/paths'
import { libraryDb } from './store'

// OWNER: ui-library. The bridge from browsing to training. The session
// screen belongs to the logger slice, so this adapter only decides where to
// go: into the active session (the logger inserts the exercise at the current
// position) or into a new ad-hoc one. The contract with the logger:
//   /session/<workout id>?add=<exercise id>   active session, insert the exercise
//   /session/new?add=<exercise id>            no active session, start an ad-hoc one
// Delete this file's guesswork when the logger exposes a start function.

export const NEW_SESSION_ID = 'new'

export function startPath(activeWorkoutId: string | null, exerciseId: string): string {
  const id = activeWorkoutId ?? NEW_SESSION_ID
  return `${PATHS.session(id)}?add=${encodeURIComponent(exerciseId)}`
}

export async function resolveStartPath(exerciseId: string): Promise<string> {
  let active: string | null = null
  try {
    const row = await libraryDb().meta.get(META_KEYS.activeWorkoutId)
    if (typeof row?.value === 'string' && row.value) active = row.value
  } catch {
    active = null
  }
  return startPath(active, exerciseId)
}
