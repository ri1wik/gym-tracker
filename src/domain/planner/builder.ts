// The one planner entry point (PLAN.md 3.4 and 3.6). A template-day focus
// returns that day with prescriptions and warm-ups; a groups, patterns or
// "any" focus builds a custom session by filling slots until the time
// estimate would exceed the budget (never a refusal), then both run the
// time-box trimmer, the 48-hour fatigue guard and cardio placement.

import { diffDays } from '../dates'
import { MUSCLE_INFO, groupOf } from '../muscles'
import type { ExerciseIndexEntry, MovementPattern, MuscleGroup, TemplateDay } from '../types'
import type {
  PlannedExercise,
  PlannerContext,
  SessionIntent,
  SessionMinutes,
  SessionPlan,
  SessionRequest,
} from './contract'
import { cardioRowFor, isLegsDay, isLegsSession } from './cardio'
import { deloadStatus } from './deload'
import { estimateMinutes, planSeconds } from './estimate'
import { firstTimeLoad } from './first-time'
import { EXERCISE_CAP, MAX_ISOLATION_PER_GROUP, MIN_EXERCISES, compoundCap, expandFocus, focusName } from './focus'
import type { PatternSlot } from './focus'
import { historyCount } from './history'
import { prescribe } from './prescribe'
import { customRotationEffect, nextSession } from './rotation'
import type { SetCount } from './rotation'
import { gymHas, substitutesFor } from './substitute'
import { applyTimebox } from './timebox'
import { generalWarmupFor, sameRampFamily, warmupsFor } from './warmup'

export type SlotRole = 'first_compound' | 'compound' | 'isolation'

export interface Slot {
  exercise: ExerciseIndexEntry
  role: SlotRole
  sets: number
  rep_min: number
  rep_max: number
  rest_s: number
}

export const REST_FIRST_COMPOUND_S = 150
export const REST_FIRST_COMPOUND_HEAVY_S = 180
export const REST_COMPOUND_S = 150
export const REST_ISOLATION_S = 75
/** At a 30-minute budget the fill uses compact rests from the start. */
export const REST_COMPOUND_SHORT_S = 90
export const REST_ISOLATION_SHORT_S = 60
export const SHORT_BUDGET_MINUTES: SessionMinutes = 30
/** Days back a primary muscle counts as freshly trained (today and yesterday). */
export const FATIGUE_WINDOW_DAYS = 1

const FAMILY_RANK: Record<string, number> = { barbell: 0, dumbbell: 1, machine: 2, cable: 3, smith: 4, bodyweight: 5 }

function isHeavyBarbell(ex: ExerciseIndexEntry): boolean {
  return ex.equipmentFamily === 'barbell' && (ex.movementPattern === 'squat' || ex.movementPattern === 'hinge')
}

/** Sets, rep range and rest for a custom slot by role and intent. */
export function slotScheme(ex: ExerciseIndexEntry, role: SlotRole, intent: SessionIntent, minutes: SessionMinutes): Omit<Slot, 'exercise' | 'role'> {
  const short = minutes <= SHORT_BUDGET_MINUTES
  if (ex.loadType === 'time') return { sets: 3, rep_min: 30, rep_max: 60, rest_s: short ? REST_ISOLATION_SHORT_S : REST_ISOLATION_S }
  if (role === 'first_compound') {
    const rest = short ? REST_COMPOUND_SHORT_S : isHeavyBarbell(ex) ? REST_FIRST_COMPOUND_HEAVY_S : REST_FIRST_COMPOUND_S
    return intent === 'hard' ? { sets: 4, rep_min: 5, rep_max: 8, rest_s: rest } : { sets: 3, rep_min: 6, rep_max: 10, rest_s: rest }
  }
  if (role === 'compound') return { sets: 3, rep_min: 8, rep_max: 12, rest_s: short ? REST_COMPOUND_SHORT_S : REST_COMPOUND_S }
  return { sets: 3, rep_min: 10, rep_max: 15, rest_s: short ? REST_ISOLATION_SHORT_S : REST_ISOLATION_S }
}

function verbFor(p: MovementPattern): string {
  switch (p) {
    case 'horizontal_push':
    case 'incline_push':
    case 'vertical_push':
      return 'press'
    case 'horizontal_pull':
      return 'row'
    case 'vertical_pull':
      return 'pull'
    case 'squat':
      return 'squat'
    case 'hinge':
      return 'hinge'
    case 'lunge':
      return 'lunge'
    case 'hip_thrust':
      return 'thrust'
    case 'carry':
      return 'carry'
    default:
      return 'lift'
  }
}

function labelOf(ex: ExerciseIndexEntry): string {
  const m = ex.primaryMuscles[0]
  return m ? MUSCLE_INFO[m].label.toLowerCase() : ex.bodyPart
}

/** One templated line per slot. */
export function whyFor(ex: ExerciseIndexEntry, role: SlotRole, earlier: readonly ExerciseIndexEntry[], sets: number): string {
  const label = labelOf(ex)
  if (role === 'first_compound') return `Main ${label} ${verbFor(ex.movementPattern)}, first because it is the heaviest lift`
  if (role === 'compound') {
    const earlierPatterns = earlier.map((e) => e.movementPattern)
    if (ex.movementPattern === 'incline_push' && earlierPatterns.includes('horizontal_push')) return 'Incline angle for the upper chest the flat press misses'
    if (ex.movementPattern === 'vertical_pull' && earlierPatterns.includes('horizontal_pull')) return 'Vertical pull for the lats after the row'
    if (ex.movementPattern === 'horizontal_pull' && earlierPatterns.includes('vertical_pull')) return 'Row for the upper back after the vertical pull'
    return `Second ${label} compound from a different angle`
  }
  switch (ex.id) {
    case 'overhead-cable-extension':
      return 'Overhead extension for the long head that pushdowns miss'
    case 'cable-pushdown':
      return 'Pushdown to finish the triceps with the elbows pinned'
    default:
      break
  }
  switch (ex.movementPattern) {
    case 'lateral_raise':
      return 'Lateral raise for the side delts the presses leave short'
    case 'rear_delt':
      return 'Rear delt work to balance the pressing'
    case 'fly':
      return 'Fly to finish the chest with the stretch the press misses'
    default:
      return `${ex.name} to finish the ${label} with ${sets} straight sets`
  }
}

interface Flags {
  deload: boolean
  first_session_back: boolean
  intent: SessionIntent
}

function planExercise(slot: Slot, index: number, earlier: readonly PlannedExercise[], ctx: PlannerContext, flags: Flags): PlannedExercise {
  const ex = slot.exercise
  const p = prescribe({
    exercise: ex,
    history: ctx.history.sets,
    sets: slot.sets,
    rep_min: slot.rep_min,
    rep_max: slot.rep_max,
    equipment: ctx.equipment,
    deload: flags.deload,
    first_session_back: flags.first_session_back,
    intent: flags.intent,
  })
  let target_load_g = p.target_load_g
  let load_source = p.load_source
  let ramp_card: string | null = null
  if (p.load_source === 'ramp') {
    const ft = firstTimeLoad(ex.id, ctx)
    if (ft.load_source === 'ratio') {
      target_load_g = ft.target_load_g
      load_source = 'ratio'
    } else {
      target_load_g = null
      load_source = 'ramp'
      ramp_card = ft.card
    }
  }
  const earlierExercises = earlier.map((e) => ctx.exercises[e.exercise_id]).filter((e): e is ExerciseIndexEntry => e !== undefined)
  const secondCompound = ex.isCompound && earlierExercises.some((e) => e.isCompound && sameRampFamily(e.movementPattern, ex.movementPattern))
  const firstIsolation = !ex.isCompound && !earlierExercises.some((e) => !e.isCompound && e.primaryMuscles.some((m) => ex.primaryMuscles.includes(m)))
  const warmups =
    target_load_g === null
      ? []
      : warmupsFor({
          exercise: ex,
          working_load_g: target_load_g,
          working_assist_g: p.assist_g,
          working_reps: p.target_reps[0] ?? slot.rep_min,
          equipment: ctx.equipment,
          second_compound_same_pattern: secondCompound,
          first_isolation_for_muscle: firstIsolation,
        })
  const sets = p.target_reps.length
  return {
    exercise_id: ex.id,
    slot: index,
    sets,
    rep_min: slot.rep_min,
    rep_max: slot.rep_max,
    target_reps: p.target_reps,
    target_load_g,
    assist_g: p.assist_g,
    load_source,
    rest_s: slot.rest_s,
    warmups,
    last_time: p.last_time ?? null,
    why: whyFor(ex, slot.role, earlierExercises, sets),
    superset_with: null,
    suggested_increase: p.suggested_increase,
    is_compound: ex.isCompound,
    ramp_card,
    note: p.note,
  }
}

function excluded(ex: ExerciseIndexEntry, request: SessionRequest, ctx: PlannerContext): boolean {
  return request.exclude_exercise_ids.includes(ex.id) || request.exclude_families.includes(ex.equipmentFamily) || !gymHas(ex, ctx.equipment)
}

function programIds(ctx: PlannerContext): Set<string> {
  const out = new Set<string>()
  if (!ctx.program) return out
  for (const day of ctx.program.template.days) for (const item of day.items) out.add(item.exercise_id)
  return out
}

/** The exercise for a pattern slot: the program's pick first, then the most history, then the library default (priority, barbell first), ties by id. */
export function pickForSlot(slot: PatternSlot, taken: ReadonlySet<string>, request: SessionRequest, ctx: PlannerContext, inProgram: ReadonlySet<string>): ExerciseIndexEntry | null {
  const cands = Object.values(ctx.exercises).filter(
    (e) =>
      e.movementPattern === slot.pattern &&
      e.isCompound === slot.compound &&
      !taken.has(e.id) &&
      !excluded(e, request, ctx) &&
      (slot.group === null || e.primaryMuscles.some((m) => groupOf(m) === slot.group)),
  )
  if (cands.length === 0) return null
  cands.sort(
    (a, b) =>
      Number(inProgram.has(b.id)) - Number(inProgram.has(a.id)) ||
      historyCount(ctx.history.sets, b.id) - historyCount(ctx.history.sets, a.id) ||
      Number(a.loadType === 'assisted') - Number(b.loadType === 'assisted') ||
      Number(b.isRecompPriority) - Number(a.isRecompPriority) ||
      FAMILY_RANK[a.equipmentFamily] - FAMILY_RANK[b.equipmentFamily] ||
      (a.id < b.id ? -1 : 1),
  )
  return cands[0]
}

function templateSlots(day: TemplateDay, request: SessionRequest, ctx: PlannerContext): Slot[] {
  const out: Slot[] = []
  const taken = new Set<string>()
  let seenCompound = false
  for (const item of day.items) {
    let ex = ctx.exercises[item.exercise_id]
    if (!ex) continue
    if (excluded(ex, request, ctx) || taken.has(ex.id)) {
      const subs = substitutesFor({ exercise_id: ex.id, done_today: [...taken], limit: 10 }, ctx)
      const alt = subs.map((s) => ctx.exercises[s.exercise_id]).find((e) => e !== undefined && !excluded(e, request, ctx) && !taken.has(e.id))
      if (!alt) continue
      ex = alt
    }
    taken.add(ex.id)
    let role: SlotRole = 'isolation'
    if (ex.isCompound) {
      role = seenCompound ? 'compound' : 'first_compound'
      seenCompound = true
    }
    out.push({ exercise: ex, role, sets: item.sets, rep_min: item.rep_min, rep_max: item.rep_max, rest_s: item.rest_s })
  }
  return out
}

export function buildCustomSession(request: SessionRequest, ctx: PlannerContext): SessionPlan {
  const program = ctx.program
  const next = program ? nextSession(program, ctx.history, request.date_key) : null
  const dl = program ? deloadStatus(program, ctx.history, request.date_key) : null
  const flags: Flags = { deload: dl?.due ?? false, first_session_back: next?.first_session_back ?? false, intent: request.intent }
  const budgetSeconds = request.minutes * 60

  // Which template day, if any, this request resolves to.
  let day: TemplateDay | null = null
  let dayIndex = -1
  const focus = request.focus
  if (program && focus.kind === 'template_day') {
    dayIndex = program.template.days.findIndex((d) => d.key === focus.day_key)
    if (dayIndex >= 0) day = program.template.days[dayIndex]
  } else if (program && next && focus.kind === 'any') {
    day = next.day
    dayIndex = next.index
  }

  const planned: PlannedExercise[] = []
  let session_key = 'custom'
  let name = focusName(request.focus)
  const generalMinutes = 5

  if (day) {
    session_key = day.key
    name = day.name
    const slots = templateSlots(day, request, ctx)
    for (const slot of slots) planned.push(planExercise(slot, planned.length, planned, ctx, flags))
  } else {
    const patternSlots = expandFocus(request.focus)
    const cap = EXERCISE_CAP[request.minutes]
    const ccap = compoundCap(request.minutes)
    const taken = new Set<string>()
    const isoCount = new Map<MuscleGroup, number>()
    const inProgram = programIds(ctx)
    let compounds = 0
    let over = false
    const ordered = [...patternSlots.filter((s) => s.compound), ...patternSlots.filter((s) => !s.compound)]
    for (const ps of ordered) {
      if (over || planned.length >= cap) break
      if (ps.compound && compounds >= ccap) continue
      const ex = pickForSlot(ps, taken, request, ctx, inProgram)
      if (!ex) continue
      const group = ex.primaryMuscles[0] ? groupOf(ex.primaryMuscles[0]) : null
      if (!ps.compound && group !== null && (isoCount.get(group) ?? 0) >= MAX_ISOLATION_PER_GROUP) continue
      const role: SlotRole = ps.compound ? (compounds === 0 ? 'first_compound' : 'compound') : 'isolation'
      const slot: Slot = { exercise: ex, role, ...slotScheme(ex, role, request.intent, request.minutes) }
      const pe = planExercise(slot, planned.length, planned, ctx, flags)
      const seconds = planSeconds(generalMinutes, [...planned, pe], ctx.exercises)
      if (seconds > budgetSeconds && planned.length >= MIN_EXERCISES) {
        over = true
        break
      }
      planned.push(pe)
      taken.add(ex.id)
      if (ps.compound) compounds++
      else if (group !== null) isoCount.set(group, (isoCount.get(group) ?? 0) + 1)
    }
  }

  const firstPattern = planned.length > 0 ? (ctx.exercises[planned[0].exercise_id]?.movementPattern ?? null) : null
  let plan: SessionPlan = {
    session_key,
    name,
    general_warmup: generalWarmupFor(firstPattern, generalMinutes),
    exercises: planned,
    estimated_minutes: 0,
    rotation_effect: 'holds',
    warnings: [],
    deload: flags.deload,
    cardio: null,
    needs_minutes: null,
    first_session_back: flags.first_session_back,
    trim_steps: [],
  }
  plan.estimated_minutes = estimateMinutes(plan, ctx.exercises)
  plan = applyTimebox(plan, request.minutes, ctx)

  // Rotation effect.
  if (day && next) {
    plan.rotation_effect = next.index === dayIndex ? next.rotation_effect : 'advances'
  } else if (next) {
    const counts: SetCount[] = plan.exercises.map((e) => ({ exercise_id: e.exercise_id, sets: e.sets }))
    plan.rotation_effect = customRotationEffect(next.day, counts, ctx.exercises)
  }

  // Fatigue guard: primaries trained today or yesterday.
  const recent = new Set<MuscleGroup>()
  const recentWhen = new Map<MuscleGroup, number>()
  for (const s of ctx.history.sets) {
    if (s.kind !== 'working') continue
    const back = diffDays(s.date_key, request.date_key)
    if (back < 0 || back > FATIGUE_WINDOW_DAYS) continue
    const ex = ctx.exercises[s.exercise_id]
    if (!ex) continue
    for (const m of ex.primaryMuscles) {
      const g = groupOf(m)
      recent.add(g)
      recentWhen.set(g, Math.min(back, recentWhen.get(g) ?? back))
    }
  }
  const warned = new Set<MuscleGroup>()
  for (const pe of plan.exercises) {
    const ex = ctx.exercises[pe.exercise_id]
    if (!ex) continue
    for (const m of ex.primaryMuscles) {
      const g = groupOf(m)
      if (!recent.has(g) || warned.has(g)) continue
      warned.add(g)
      const label = g.replace(/_/g, ' ')
      const when = (recentWhen.get(g) ?? 1) === 0 ? 'today' : 'yesterday'
      plan.warnings.push(`${label.charAt(0).toUpperCase()}${label.slice(1)} was trained ${when}; keep the ${label} sets as planned and stop a rep short`)
    }
  }

  const legsToday = isLegsSession(
    plan.exercises.map((e) => e.exercise_id),
    ctx.exercises,
  )
  let legsNext = false
  if (program && next) {
    const days = program.template.days
    const after = day ? days[(dayIndex + 1) % days.length] : plan.rotation_effect === 'advances' ? days[(next.index + 1) % days.length] : next.day
    legsNext = isLegsDay(after, ctx.exercises)
    if (!day && legsToday && isLegsDay(next.day, ctx.exercises)) {
      plan.warnings.push(`${next.day.name} is next in the rotation; a legs session today lands the day before it. Shift the rotation or keep today light`)
    }
  }
  plan.cardio = cardioRowFor(legsToday, request.intent, legsNext)
  return plan
}
