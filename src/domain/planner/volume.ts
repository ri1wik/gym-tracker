// Volume projector and guard (PLAN.md 3.4): projected weekly sets per
// scored group from the rotation, printed at the 14-group level through
// weeklySetsByGroup. Under the band suggests one add-on exercise placed
// where it fits; over the band trims isolation sets first, compounds last.
// Suggestions only: nothing here edits a template.

import { groupOf, weeklySetsByGroup } from '../muscles'
import type { CountableSet } from '../muscles'
import type { ExerciseIndexEntry, MuscleGroup, Template } from '../types'
import { MUSCLE_GROUPS } from '../types'
import { GROUP_PATTERNS } from './focus'

export const VOLUME_BAND_DEFAULT: readonly [number, number] = [10, 20]
export const VOLUME_BAND_PRIORITY: readonly [number, number] = [14, 22]
export const VOLUME_BAND_SMALL: readonly [number, number] = [6, 12]
export const VOLUME_BAND_MINIMAL: readonly [number, number] = [6, 12]
export const ADD_ON_SETS = 3
export const TRIM_FLOOR_SETS = 2

/** Groups the guard watches; forearms are unscored and front delts come from pressing. */
const GUARDED: readonly MuscleGroup[] = ['chest', 'lats', 'upper_back', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs']
const SMALL: readonly MuscleGroup[] = ['calves', 'abs']

function countableSetsOf(template: Template): CountableSet[] {
  const out: CountableSet[] = []
  for (const day of template.days) {
    for (const item of day.items) {
      for (let i = 0; i < item.sets; i++) out.push({ exercise_id: item.exercise_id, kind: 'working', completed_at: day.key })
    }
  }
  return out
}

/** Projected weekly sets per group: the rotation's total times sessions per week over templates in the rotation. */
export function projectWeeklySets(
  template: Template,
  exercises: Readonly<Record<string, ExerciseIndexEntry>>,
  sessionsPerWeek: number = template.days_per_week,
): Record<MuscleGroup, number> {
  const totals = weeklySetsByGroup(countableSetsOf(template), exercises)
  const n = template.days.length
  const factor = n === 0 ? 0 : sessionsPerWeek / n
  const out = {} as Record<MuscleGroup, number>
  for (const g of MUSCLE_GROUPS) out[g] = Math.round(totals[g] * factor * 10) / 10
  return out
}

export function bandFor(group: MuscleGroup, template: Template, priority: MuscleGroup | null): readonly [number, number] {
  if (template.split === 'minimal_2') return VOLUME_BAND_MINIMAL
  if (priority === group) return VOLUME_BAND_PRIORITY
  if (SMALL.includes(group)) return VOLUME_BAND_SMALL
  return VOLUME_BAND_DEFAULT
}

export interface VolumeSuggestion {
  kind: 'add' | 'trim'
  group: MuscleGroup
  projected: number
  band: readonly [number, number]
  /** The add-on exercise, or the exercise losing a set. */
  exercise_id: string
  day_key: string
  /** Sets to add (above zero) or take off (below zero). */
  sets: number
  text: string
}

function groupCreditOfDay(template: Template, dayIndex: number, group: MuscleGroup, exercises: Readonly<Record<string, ExerciseIndexEntry>>): number {
  const day = template.days[dayIndex]
  const sets: CountableSet[] = []
  for (const item of day.items) for (let i = 0; i < item.sets; i++) sets.push({ exercise_id: item.exercise_id, kind: 'working', completed_at: day.key })
  return weeklySetsByGroup(sets, exercises)[group]
}

function daySets(template: Template, dayIndex: number): number {
  return template.days[dayIndex].items.reduce((n, i) => n + i.sets, 0)
}

/** The library default for a group's first pattern: priority first, then barbell, dumbbell, machine, cable, smith, bodyweight, then id. */
export function defaultExerciseFor(group: MuscleGroup, exercises: Readonly<Record<string, ExerciseIndexEntry>>): ExerciseIndexEntry | null {
  const patterns = GROUP_PATTERNS[group]
  const familyRank: Record<string, number> = { barbell: 0, dumbbell: 1, machine: 2, cable: 3, smith: 4, bodyweight: 5 }
  for (const pattern of patterns) {
    const cands = Object.values(exercises)
      .filter((e) => e.movementPattern === pattern && e.primaryMuscles.some((m) => groupOf(m) === group) && e.loadType !== 'assisted')
      .sort(
        (a, b) =>
          Number(b.isRecompPriority) - Number(a.isRecompPriority) ||
          familyRank[a.equipmentFamily] - familyRank[b.equipmentFamily] ||
          (a.id < b.id ? -1 : 1),
      )
    if (cands.length > 0) return cands[0]
  }
  return null
}

/**
 * The guard's suggestions, one per group outside its band. Silent on the
 * minimal split (6 to 8 sets by design). Deterministic: ties go to the
 * earlier day and the lower exercise id.
 */
export function volumeGuard(
  template: Template,
  exercises: Readonly<Record<string, ExerciseIndexEntry>>,
  opts: { priority_group: MuscleGroup | null; sessionsPerWeek?: number } = { priority_group: null },
): VolumeSuggestion[] {
  if (template.split === 'minimal_2') return []
  const projected = projectWeeklySets(template, exercises, opts.sessionsPerWeek ?? template.days_per_week)
  const n = template.days.length
  if (n === 0) return []
  const out: VolumeSuggestion[] = []

  for (const group of GUARDED) {
    const band = bandFor(group, template, opts.priority_group)
    const value = projected[group]
    if (value < band[0]) {
      const ex = defaultExerciseFor(group, exercises)
      if (!ex) continue
      // The day with the most credit for the group is its main session; never the day before it.
      let main = 0
      for (let i = 1; i < n; i++) if (groupCreditOfDay(template, i, group, exercises) > groupCreditOfDay(template, main, group, exercises)) main = i
      const dayBefore = (main - 1 + n) % n
      let pick = -1
      for (let i = 0; i < n; i++) {
        if (n > 1 && i === dayBefore) continue
        if (groupCreditOfDay(template, i, group, exercises) + ADD_ON_SETS > band[1]) continue
        if (pick === -1 || daySets(template, i) < daySets(template, pick)) pick = i
      }
      if (pick === -1) pick = main
      const day = template.days[pick]
      out.push({
        kind: 'add',
        group,
        projected: value,
        band,
        exercise_id: ex.id,
        day_key: day.key,
        sets: ADD_ON_SETS,
        text: `${labelOf(group)} ${value} sets, under ${band[0]}: add ${ex.name} ${ADD_ON_SETS} sets to ${day.name}`,
      })
    } else if (value > band[1]) {
      // Trim one set from the last isolation for the group, from the end of the last day; compounds only when every isolation is at the floor.
      let found: { day_key: string; day_name: string; exercise_id: string; name: string } | null = null
      const pass = (wantCompound: boolean) => {
        for (let d = n - 1; d >= 0 && !found; d--) {
          const day = template.days[d]
          for (let i = day.items.length - 1; i >= 0; i--) {
            const item = day.items[i]
            const ex = exercises[item.exercise_id]
            if (!ex || ex.isCompound !== wantCompound) continue
            if (!ex.primaryMuscles.some((m) => groupOf(m) === group)) continue
            if (item.sets <= TRIM_FLOOR_SETS) continue
            found = { day_key: day.key, day_name: day.name, exercise_id: ex.id, name: ex.name }
            break
          }
        }
      }
      pass(false)
      if (!found) pass(true)
      if (!found) continue
      const f: { day_key: string; day_name: string; exercise_id: string; name: string } = found
      out.push({
        kind: 'trim',
        group,
        projected: value,
        band,
        exercise_id: f.exercise_id,
        day_key: f.day_key,
        sets: -1,
        text: `${labelOf(group)} ${value} sets, over ${band[1]}: one set off ${f.name} in ${f.day_name}`,
      })
    }
  }
  return out
}

function labelOf(group: MuscleGroup): string {
  const text = group.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
