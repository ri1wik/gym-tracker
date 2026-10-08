// Projected weekly working sets from a template rotation.
//
// Sets per week = sum over the rotation's days of (sets x credit), scaled by
// sessions per week over days in the rotation, so the 5-day push/pull/legs
// rotation projects at 5/6 of the 6-day numbers. Credit comes from
// src/domain/muscles.ts: 1.0 per primary, 0.5 per secondary (two at most),
// and a set adds at most 1.0 to any body part or group.
//
// Two levels, because the product prints two tables:
//   - by group (14): the split catalogue and the volume guard;
//   - by body part (11): the weekly review gauge.

import type { BodyPart, ExerciseIndexEntry, MuscleGroup, Template } from '../types'
import { weeklySetsByBodyPart, weeklySetsByGroup, type CountableSet, type MuscleTags } from '../muscles'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'

export interface ProjectionOptions {
  /** Training days per week. Defaults to the template's days_per_week. */
  sessionsPerWeek?: number
  /** Exercise tags by id. Defaults to the shipped index; pass a map to include custom exercises. */
  exercises?: Readonly<Record<string, MuscleTags>>
}

/** One pass of the rotation as completed working sets, ready for the credit functions. */
function rotationSets(template: Template): CountableSet[] {
  const sets: CountableSet[] = []
  for (const day of template.days) {
    for (const item of day.items) {
      for (let i = 0; i < item.sets; i++) {
        sets.push({ exercise_id: item.exercise_id, kind: 'working', completed_at: 'projected' })
      }
    }
  }
  return sets
}

/** Sessions per week over days in the rotation. */
export function rotationScale(template: Template, sessionsPerWeek?: number): number {
  const days = template.days.length
  if (days === 0) return 0
  return (sessionsPerWeek ?? template.days_per_week) / days
}

function scaled<K extends string>(totals: Record<K, number>, factor: number): Record<K, number> {
  const out = {} as Record<K, number>
  for (const k of Object.keys(totals) as K[]) out[k] = totals[k] * factor
  return out
}

function tagsOf(opts: ProjectionOptions | undefined): Readonly<Record<string, MuscleTags>> {
  return opts?.exercises ?? (EXERCISES_BY_ID as Readonly<Record<string, ExerciseIndexEntry>>)
}

/** Projected weekly sets per body part. Halves are kept; round at the call site. */
export function projectWeeklySetsByBodyPart(template: Template, opts?: ProjectionOptions): Record<BodyPart, number> {
  const totals = weeklySetsByBodyPart(rotationSets(template), tagsOf(opts))
  return scaled(totals, rotationScale(template, opts?.sessionsPerWeek))
}

/** Projected weekly sets per scored group (front delts included). Halves are kept. */
export function projectWeeklySetsByGroup(template: Template, opts?: ProjectionOptions): Record<MuscleGroup, number> {
  const totals = weeklySetsByGroup(rotationSets(template), tagsOf(opts))
  return scaled(totals, rotationScale(template, opts?.sessionsPerWeek))
}

/** Round every value to the nearest whole set, for the printed tables. */
export function roundedSets<K extends string>(totals: Record<K, number>): Record<K, number> {
  const out = {} as Record<K, number>
  for (const k of Object.keys(totals) as K[]) out[k] = Math.round(totals[k])
  return out
}
