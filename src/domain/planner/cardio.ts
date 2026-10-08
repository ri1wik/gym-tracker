// Cardio placement rows (PLAN.md 3.4 and the critic fix): an incline walk
// at 6 to 8 percent and 5 km/h after push or pull sessions, 10 to 12
// percent only under the hard intent, nothing hard after legs and never
// hard when legs are next in the rotation.

import { groupOf } from '../muscles'
import type { ExerciseIndexEntry, MuscleGroup, TemplateDay } from '../types'
import type { CardioRow, SessionIntent } from './contract'

export const CARDIO_EASY_MINUTES = 15
export const CARDIO_HARD_MINUTES = 20
/** 7 percent, the middle of the 6 to 8 band, in tenths. */
export const CARDIO_EASY_INCLINE_TENTHS = 70
/** 11 percent, the middle of the 10 to 12 band, in tenths. */
export const CARDIO_HARD_INCLINE_TENTHS = 110
export const CARDIO_SPEED_M_PER_H = 5000

const LEG_GROUPS: readonly MuscleGroup[] = ['quads', 'hamstrings', 'glutes']

export function isLegGroup(g: MuscleGroup): boolean {
  return LEG_GROUPS.includes(g)
}

/** A session is a legs session when any compound in it has a leg primary. */
export function isLegsSession(exercise_ids: readonly string[], exercises: Readonly<Record<string, ExerciseIndexEntry>>): boolean {
  return exercise_ids.some((id) => {
    const ex = exercises[id]
    return ex !== undefined && ex.isCompound && ex.primaryMuscles.some((m) => isLegGroup(groupOf(m)))
  })
}

/** A template day is a legs day when its first item is a leg compound. */
export function isLegsDay(day: TemplateDay, exercises: Readonly<Record<string, ExerciseIndexEntry>>): boolean {
  const first = day.items[0]
  if (!first) return false
  return isLegsSession([first.exercise_id], exercises)
}

export function cardioRowFor(legsToday: boolean, intent: SessionIntent, legsNext: boolean): CardioRow {
  if (legsToday) {
    return { kind: 'none', minutes: 0, incline_tenths_pct: null, speed_m_per_h: null, note: 'No cardio after legs; a 10 min flat walk at most' }
  }
  if (intent === 'hard' && !legsNext) {
    return {
      kind: 'incline_walk',
      minutes: CARDIO_HARD_MINUTES,
      incline_tenths_pct: CARDIO_HARD_INCLINE_TENTHS,
      speed_m_per_h: CARDIO_SPEED_M_PER_H,
      note: 'Hard incline walk, 11 percent at 5 km/h',
    }
  }
  return {
    kind: 'incline_walk',
    minutes: CARDIO_EASY_MINUTES,
    incline_tenths_pct: CARDIO_EASY_INCLINE_TENTHS,
    speed_m_per_h: CARDIO_SPEED_M_PER_H,
    note: intent === 'hard' && legsNext ? 'Kept easy: legs are next in the rotation. 7 percent at 5 km/h' : 'Easy incline walk, 7 percent at 5 km/h',
  }
}
