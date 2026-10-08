// Focus expansion for the custom session builder (PLAN.md 3.6): a fixed
// table from muscle group to patterns, interleaved across groups in the
// order given, plus the exercise-count caps per budget.

import type { MovementPattern, MuscleGroup } from '../types'
import type { SessionFocus, SessionMinutes } from './contract'

/** Patterns per group, in the order slots are filled. A repeated pattern means two slots. */
export const GROUP_PATTERNS: Record<MuscleGroup, readonly MovementPattern[]> = {
  chest: ['horizontal_push', 'incline_push', 'fly'],
  lats: ['vertical_pull', 'horizontal_pull', 'pullover'],
  upper_back: ['horizontal_pull', 'vertical_pull', 'rear_delt'],
  front_delts: ['vertical_push'],
  side_delts: ['lateral_raise', 'lateral_raise'],
  rear_delts: ['rear_delt', 'rear_delt'],
  biceps: ['elbow_flexion', 'elbow_flexion'],
  triceps: ['elbow_extension', 'elbow_extension'],
  forearms: ['wrist_flexion', 'carry'],
  quads: ['squat', 'lunge', 'knee_extension'],
  hamstrings: ['hinge', 'knee_flexion'],
  glutes: ['hip_thrust', 'hinge', 'hip_abduction'],
  calves: ['calf', 'calf'],
  abs: ['anti_extension', 'trunk_flexion'],
}

/** The default list for an "any" request without a program: a full-body session. */
export const ANY_PATTERNS: readonly MovementPattern[] = [
  'squat',
  'horizontal_push',
  'horizontal_pull',
  'hinge',
  'vertical_push',
  'vertical_pull',
  'lateral_raise',
  'elbow_flexion',
  'elbow_extension',
  'trunk_flexion',
]

export const COMPOUND_PATTERNS: readonly MovementPattern[] = [
  'horizontal_push',
  'incline_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'hip_thrust',
  'carry',
]

export function isCompoundPattern(p: MovementPattern): boolean {
  return COMPOUND_PATTERNS.includes(p)
}

/** Exercise count cap per budget; the fill-until-budget rule decides the real count. */
export const EXERCISE_CAP: Record<SessionMinutes, number> = { 30: 3, 45: 5, 60: 6, 75: 7, 90: 8 }
export const MAX_COMPOUNDS = 3
/** The smallest custom plan: one compound and two isolations, never a refusal. */
export const MIN_EXERCISES = 3
export const MAX_ISOLATION_PER_GROUP = 2

/** Compounds per budget: one at 30 minutes (so two isolations always fit), else min(3, minutes / 15). */
export function compoundCap(minutes: SessionMinutes): number {
  if (minutes <= 30) return 1
  return Math.min(MAX_COMPOUNDS, Math.floor(minutes / 15))
}

export interface PatternSlot {
  pattern: MovementPattern
  /** The group that asked for this pattern, or null for pattern and any focuses. */
  group: MuscleGroup | null
  compound: boolean
}

/** Expand a groups or patterns focus into ordered pattern slots, interleaving groups in the order given. */
export function expandFocus(focus: SessionFocus): PatternSlot[] {
  if (focus.kind === 'patterns') {
    return focus.patterns.map((pattern) => ({ pattern, group: null, compound: isCompoundPattern(pattern) }))
  }
  if (focus.kind === 'groups') {
    const lists = focus.groups.map((g) => GROUP_PATTERNS[g] ?? [])
    const out: PatternSlot[] = []
    const longest = Math.max(0, ...lists.map((l) => l.length))
    for (let i = 0; i < longest; i++) {
      for (let g = 0; g < lists.length; g++) {
        const pattern = lists[g][i]
        if (pattern) out.push({ pattern, group: focus.groups[g], compound: isCompoundPattern(pattern) })
      }
    }
    return out
  }
  return ANY_PATTERNS.map((pattern) => ({ pattern, group: null, compound: isCompoundPattern(pattern) }))
}

export function focusName(focus: SessionFocus): string {
  if (focus.kind === 'groups' && focus.groups.length > 0) {
    const labels = focus.groups.map((g) => g.replace(/_/g, ' '))
    const text = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  if (focus.kind === 'patterns') return 'Custom session'
  return 'Full body'
}
