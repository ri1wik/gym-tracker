// One read model for the Program screen and Home: everything either needs
// about the active program, in a single Dexie pass the screens subscribe to
// with useLiveQuery.

import type { GymDb } from '../../../data/db'
import { nextCheckinKey } from '../../../domain/dates'
import {
  programStateFrom,
  type NextSessionResult,
  type ProgramState,
} from '../../../domain/planner/index'
import type { DateKey, Profile, Program, Template, Weekday, Workout } from '../../../domain/types'
import { resolveDeload, resolveNext, type DeloadView } from './adapter'
import { loadHistory } from './history'
import { lastDoneOn, sessionsThisWeek } from './rotation'
import { templateByKey } from './templates'
import {
  deficitFractionOf,
  getActiveProgram,
  getInProgressWorkout,
  getLatestWeighIn,
  getProfile,
  readSessionMinutes,
  type SessionMinutesChoice,
} from './store'

export interface TrainView {
  profile: Profile | null
  program: Program | null
  template: Template | null
  state: ProgramState | null
  next: NextSessionResult | null
  /** Last finished day per template day key. */
  lastDone: Record<string, DateKey | null>
  deload: DeloadView | null
  minutes: SessionMinutesChoice
  inProgress: Workout | null
  weekCount: number
  weekTarget: number
  weekStartsOn: Weekday
  checkinDue: boolean
}

export const DEFAULT_CHECKIN_INTERVAL_DAYS = 4

export async function loadTrainView(db: GymDb, today: DateKey): Promise<TrainView> {
  const [profile, program, inProgress, minutes] = await Promise.all([
    getProfile(db),
    getActiveProgram(db),
    getInProgressWorkout(db),
    readSessionMinutes(db),
  ])
  const weekStartsOn: Weekday = profile?.week_starts_on ?? 1

  let checkinDue = false
  if (profile?.onboarding_done) {
    const last = await getLatestWeighIn(db)
    const interval = profile.checkin_interval_days > 0 ? profile.checkin_interval_days : DEFAULT_CHECKIN_INTERVAL_DAYS
    checkinDue = last === null || nextCheckinKey(last.date_key, interval) <= today
  }

  const empty: TrainView = {
    profile,
    program,
    template: null,
    state: null,
    next: null,
    lastDone: {},
    deload: null,
    minutes,
    inProgress,
    weekCount: 0,
    weekTarget: 0,
    weekStartsOn,
    checkinDue,
  }
  if (!program) return empty
  const template = templateByKey(program.template_key)
  if (!template) return { ...empty, program }

  const loaded = await loadHistory(db, today)
  const state = programStateFrom(program, template, deficitFractionOf(profile), profile?.training_age ?? 'intermediate')
  const lastDone: Record<string, DateKey | null> = {}
  for (const d of template.days) lastDone[d.key] = lastDoneOn(loaded.workouts, d.key)

  return {
    ...empty,
    program,
    template,
    state,
    next: resolveNext(state, loaded.history, today),
    lastDone,
    deload: resolveDeload(state, loaded.history, today, program.started_on),
    weekCount: sessionsThisWeek(loaded.workouts, today, weekStartsOn),
    weekTarget: program.settings.weekly_sessions_target || template.days_per_week,
  }
}
