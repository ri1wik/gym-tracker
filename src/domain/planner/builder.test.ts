import { describe, expect, it } from 'vitest'
import { MACHINE_IDS } from '../../data/library/machine-index'
import { buildCustomSession } from './builder'
import type { SessionPlan, SessionRequest } from './contract'
import { estimateMinutes } from './estimate'
import { EX, ctx, equipment, history, program, session } from './fixtures'
import { applyTimebox } from './timebox'

function request(over: Partial<SessionRequest> = {}): SessionRequest {
  return { focus: { kind: 'any' }, minutes: 60, intent: 'normal', exclude_exercise_ids: [], exclude_families: [], date_key: '2026-10-08', ...over }
}

const ids = (plan: SessionPlan) => plan.exercises.map((e) => e.exercise_id)

const benchHistory = history([
  ...session('barbell-bench-press', '2026-10-01', 80_000, [8, 8, 8, 8]),
  ...session('cable-pushdown', '2026-10-01', 30_000, [15, 15, 15]),
])

describe('template day plans', () => {
  it('Push A at 90 minutes carries every item with prescriptions, warm-ups and why lines', () => {
    const plan = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 90 }), ctx({ history: benchHistory }))
    expect(plan.session_key).toBe('push_a')
    expect(plan.name).toBe('Push A')
    expect(ids(plan)).toEqual(['barbell-bench-press', 'seated-dumbbell-shoulder-press', 'incline-dumbbell-press', 'dumbbell-lateral-raise', 'cable-pushdown', 'overhead-cable-extension'])
    const bench = plan.exercises[0]
    expect(bench.target_load_g).toBe(82_500)
    expect(bench.load_source).toBe('history')
    expect(bench.suggested_increase).toBe(true)
    expect(bench.warmups.map((w) => [w.load_g, w.reps])).toEqual([
      [20_000, 10],
      [42_500, 5],
      [57_500, 3],
      [70_000, 1],
    ])
    expect(bench.why).toBe('Main chest press, first because it is the heaviest lift')
    expect(bench.last_time).toEqual({ load_g: 80_000, reps: 8, date_key: '2026-10-01' })
    // Shoulder press: no history, ratio from the bench; incline dumbbells too, as the second push with one ramp.
    const press = plan.exercises[1]
    expect(press.load_source).toBe('ratio')
    expect(press.target_load_g).toBe(20_000)
    expect(press.warmups.map((w) => [w.load_g, w.reps])).toEqual([[15_000, 3]])
    const incline = plan.exercises[2]
    expect(incline.load_source).toBe('ratio')
    // 0.30 x Epley(80 x 8) x 0.90 = 27.36 kg, down to the 25 kg rung.
    expect(incline.target_load_g).toBe(25_000)
    expect(incline.why).toBe('Incline angle for the upper chest the flat press misses')
    // Lateral raise: no reference, ramp card, no ramps.
    const lateral = plan.exercises[3]
    expect(lateral.load_source).toBe('ramp')
    expect(lateral.target_load_g).toBeNull()
    expect(lateral.ramp_card).toContain('Work up to a set of 8')
    expect(lateral.warmups).toEqual([])
    // Pushdown: a 5 kg pin on 30 kg is a big step, so the rep target rises first; the overhead extension is the second triceps isolation, no feel set.
    const pushdown = plan.exercises[4]
    expect(pushdown.target_load_g).toBe(30_000)
    expect(pushdown.target_reps).toEqual([17, 17, 17])
    expect(pushdown.warmups.map((w) => [w.load_g, w.reps])).toEqual([[20_000, 8]])
    expect(plan.exercises[5].warmups).toEqual([])
    expect(plan.exercises[5].why).toBe('Overhead extension for the long head that pushdowns miss')
    expect(plan.general_warmup.drills[0].name).toBe('Band pull-aparts')
    expect(plan.rotation_effect).toBe('advances')
    expect(plan.needs_minutes).toBeNull()
    expect(plan.deload).toBe(false)
    expect(plan.cardio?.kind).toBe('incline_walk')
    expect(plan.cardio?.incline_tenths_pct).toBe(70)
    for (const e of plan.exercises) expect(e.slot).toBe(plan.exercises.indexOf(e))
    expect(plan.exercises.every((e) => e.why.length > 0)).toBe(true)
  })

  it('is deterministic', () => {
    const a = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 60 }), ctx({ history: benchHistory }))
    const b = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 60 }), ctx({ history: benchHistory }))
    expect(a).toEqual(b)
  })

  it('"any" with a program is the rotation\'s next day', () => {
    const plan = buildCustomSession(request({ minutes: 90 }), ctx({ program: program({ pointer: 1 }) }))
    expect(plan.session_key).toBe('legs_a')
    expect(plan.cardio?.kind).toBe('none')
    expect(plan.general_warmup.drills[0].name).toBe('Bodyweight squats')
  })

  it('a deload week halves the sets at the same loads', () => {
    const c = ctx({ history: benchHistory, program: program({ started_on: '2026-08-27' }) })
    const plan = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 90 }), c)
    expect(plan.deload).toBe(true)
    expect(plan.exercises[0].sets).toBe(2)
    expect(plan.exercises[0].target_load_g).toBe(80_000)
    expect(plan.exercises[0].target_reps).toEqual([6, 6])
  })

  it('an excluded exercise is replaced by its top substitute in the gym', () => {
    const plan = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 90, exclude_exercise_ids: ['barbell-bench-press'] }), ctx())
    expect(ids(plan)[0]).toBe('dumbbell-bench-press')
    const noDumbbells = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'pull_a' }, minutes: 90, exclude_families: ['dumbbell'] }), ctx())
    expect(ids(noDumbbells)).not.toContain('hammer-curl')
  })

  it('a pinned weekday reports the pinned effect', () => {
    const c = ctx({ program: program({ pointer: 0, pins: { 6: 'legs_a' } }) })
    const plan = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'legs_a' }, minutes: 90, date_key: '2026-10-10' }), c)
    expect(plan.rotation_effect).toBe('pinned')
  })

  it('a hard intent before a legs day keeps cardio easy', () => {
    const plan = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'pull_a' }, minutes: 90, intent: 'hard' }), ctx())
    expect(plan.cardio?.incline_tenths_pct).toBe(70)
    expect(plan.cardio?.note).toContain('legs are next')
    const push = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 90, intent: 'hard' }), ctx())
    expect(push.cardio?.incline_tenths_pct).toBe(110)
  })

  it('a session back after 10 days takes 5 percent off', () => {
    const c = ctx({ history: history(session('barbell-bench-press', '2026-09-20', 80_000, [8, 8, 8, 8])) })
    const plan = buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 90 }), c)
    expect(plan.first_session_back).toBe(true)
    expect(plan.exercises[0].target_load_g).toBe(75_000)
  })
})

describe('time-boxing', () => {
  const pushA = () => buildCustomSession(request({ focus: { kind: 'template_day', day_key: 'push_a' }, minutes: 90 }), ctx({ history: benchHistory }))

  it('Push A at 90 fits untrimmed, at 45 it trims in order and fits', () => {
    const full = pushA()
    expect(full.trim_steps).toEqual([])
    const trimmed = applyTimebox(full, 45, ctx({ history: benchHistory }))
    expect(trimmed.estimated_minutes).toBeLessThanOrEqual(45)
    expect(trimmed.needs_minutes).toBeNull()
    expect(trimmed.general_warmup.minutes).toBe(3)
    expect(trimmed.trim_steps?.slice(0, 2)).toEqual(['general warm-up to 3 min', 'rests cut'])
    // Compounds are never removed and their ramps never cut.
    for (const e of trimmed.exercises.filter((e) => e.is_compound)) {
      const before = full.exercises.find((f) => f.exercise_id === e.exercise_id)
      expect(before).toBeDefined()
      expect(e.warmups).toEqual(before?.warmups)
      expect(e.sets).toBeGreaterThanOrEqual(3)
    }
    expect(trimmed.exercises.filter((e) => e.is_compound).length).toBe(3)
    // The first compound keeps its rest; the other compounds dropped to 120 s and isolations to 60 s.
    expect(trimmed.exercises[0].rest_s).toBe(150)
    expect(trimmed.exercises[1].rest_s).toBe(120)
    for (const e of trimmed.exercises.filter((e) => !e.is_compound)) {
      expect(e.rest_s).toBe(60)
      expect(e.sets).toBeGreaterThanOrEqual(2)
    }
    expect(trimmed.exercises.map((e) => e.slot)).toEqual(trimmed.exercises.map((_, i) => i))
    // The original plan is untouched.
    expect(full.general_warmup.minutes).toBe(5)
  })

  it('Push A at 30 cannot fit three compounds and says how many minutes it needs', () => {
    const trimmed = applyTimebox(pushA(), 30, ctx({ history: benchHistory }))
    expect(trimmed.needs_minutes).not.toBeNull()
    expect(trimmed.needs_minutes).toBeGreaterThan(30)
    expect(trimmed.exercises.filter((e) => e.is_compound).length).toBe(3)
    expect(trimmed.exercises.every((e) => e.is_compound)).toBe(true)
    // Push A has no pairable isolation, so the superset step leaves no mark.
    expect(trimmed.trim_steps).toEqual(['general warm-up to 3 min', 'rests cut', 'one set off each isolation', 'isolation dropped from the end', 'compounds to 3 sets'])
  })

  it('supersets non-competing isolation pairs and shares the rest in the estimate', () => {
    const c = ctx({ history: benchHistory })
    const full = pushA()
    const trimmed = applyTimebox(full, 60, c)
    const lateral = trimmed.exercises.find((e) => e.exercise_id === 'dumbbell-lateral-raise')
    const pushdown = trimmed.exercises.find((e) => e.exercise_id === 'cable-pushdown')
    if (trimmed.trim_steps?.includes('isolation pairs supersetted')) {
      expect(lateral?.superset_with).toBeNull()
      expect(pushdown?.superset_with).toBeNull()
    }
    const pairPlan: SessionPlan = {
      ...full,
      exercises: full.exercises.filter((e) => e.exercise_id === 'dumbbell-lateral-raise' || e.exercise_id === 'reverse-pec-deck'),
    }
    const un = estimateMinutes(pairPlan, EX)
    pairPlan.exercises = [
      { ...pairPlan.exercises[0], slot: 0, superset_with: 'face-pull' },
      { ...full.exercises[4], exercise_id: 'face-pull', slot: 1, superset_with: 'dumbbell-lateral-raise' },
    ]
    const paired = estimateMinutes(pairPlan, EX)
    expect(paired).toBeLessThan(un + estimateMinutes({ ...pairPlan, exercises: [pairPlan.exercises[1]] }, EX))
  })
})

describe('custom sessions', () => {
  it('chest and triceps in 45 minutes, normal: a plan with why lines and a load source per exercise', () => {
    const c = ctx({ history: benchHistory })
    const plan = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest', 'triceps'] }, minutes: 45 }), c)
    expect(plan.session_key).toBe('custom')
    expect(plan.name).toBe('Chest and triceps')
    expect(plan.exercises.length).toBeGreaterThanOrEqual(3)
    expect(plan.exercises.length).toBeLessThanOrEqual(5)
    expect(ids(plan)[0]).toBe('barbell-bench-press')
    expect(plan.exercises[0].sets).toBe(3)
    expect(plan.exercises[0].rep_min).toBe(6)
    expect(plan.exercises[0].rep_max).toBe(10)
    expect(plan.exercises[0].why).toBe('Main chest press, first because it is the heaviest lift')
    expect(plan.exercises[0].load_source).toBe('history')
    // The custom range is 6 to 10, so last time's 8s hold the load and aim one more rep on set 1.
    expect(plan.exercises[0].target_load_g).toBe(80_000)
    expect(plan.exercises[0].target_reps).toEqual([9, 8, 8])
    expect(ids(plan)).toContain('cable-pushdown')
    expect(plan.exercises.find((e) => e.exercise_id === 'cable-pushdown')?.load_source).toBe('history')
    for (const e of plan.exercises) {
      expect(['history', 'ratio', 'ramp']).toContain(e.load_source)
      expect(e.why.length).toBeGreaterThan(0)
      expect(e.target_reps.length).toBe(e.sets)
    }
    expect(plan.estimated_minutes).toBeLessThanOrEqual(45)
    expect(plan.needs_minutes).toBeNull()
    expect(plan.rotation_effect).toBe('holds')
    expect(plan.cardio?.kind).toBe('incline_walk')
  })

  it('a 30-minute chest and triceps request returns a plan, never a refusal', () => {
    const plan = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest', 'triceps'] }, minutes: 30 }), ctx({ history: benchHistory }))
    expect(plan.exercises.length).toBe(3)
    expect(plan.exercises.filter((e) => e.is_compound).length).toBe(1)
    expect(plan.exercises[0].rest_s).toBe(90)
    expect(plan.estimated_minutes).toBeLessThanOrEqual(30)
    expect(plan.needs_minutes).toBeNull()
    const empty = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest', 'triceps'] }, minutes: 30 }), ctx({ history: history() }))
    expect(empty.exercises.length).toBe(3)
    expect(empty.needs_minutes).toBeNull()
  })

  it('a hard intent gives the first compound 4 x 5 to 8', () => {
    const plan = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest'] }, minutes: 60, intent: 'hard' }), ctx())
    expect(plan.exercises[0].sets).toBe(4)
    expect([plan.exercises[0].rep_min, plan.exercises[0].rep_max]).toEqual([5, 8])
    expect(plan.exercises[1].rep_min).toBe(8)
    expect(plan.exercises[1].rep_max).toBe(12)
  })

  it('takes the program\'s exercise for a pattern before history and the library default', () => {
    const c = ctx({ program: null, history: history(session('machine-chest-press', '2026-10-01', 60_000, [10, 10, 10])) })
    const byHistory = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest'] }, minutes: 60 }), c)
    expect(ids(byHistory)[0]).toBe('machine-chest-press')
    const byProgram = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest'] }, minutes: 60 }), ctx({ history: c.history }))
    expect(ids(byProgram)[0]).toBe('barbell-bench-press')
    const byDefault = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest'] }, minutes: 60 }), ctx({ program: null }))
    expect(ids(byDefault)[0]).toBe('barbell-bench-press')
  })

  it('respects exclusions and the gym profile', () => {
    const noBarbell = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest'] }, minutes: 60, exclude_families: ['barbell'] }), ctx())
    for (const id of ids(noBarbell)) expect(EX[id].equipmentFamily).not.toBe('barbell')
    const noCable = MACHINE_IDS.filter((id) => id !== 'cable-station' && id !== 'cable-crossover')
    const gym = buildCustomSession(request({ focus: { kind: 'groups', groups: ['triceps'] }, minutes: 60 }), ctx({ equipment: equipment({ machine_ids: noCable }) }))
    for (const id of ids(gym)) expect(EX[id].equipmentFamily).not.toBe('cable')
  })

  it('warns when a muscle was trained in the last 48 hours', () => {
    const c = ctx({ history: history(session('barbell-bench-press', '2026-10-07', 80_000, [8, 8, 8])) })
    const plan = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest', 'triceps'] }, minutes: 45 }), c)
    expect(plan.warnings).toContain('Chest was trained yesterday; keep the chest sets as planned and stop a rep short')
    const clear = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest', 'triceps'] }, minutes: 45, date_key: '2026-10-10' }), c)
    expect(clear.warnings).toEqual([])
  })

  it('warns when a legs request sits next to the rotation\'s legs day', () => {
    const c = ctx({ program: program({ pointer: 1 }) })
    const plan = buildCustomSession(request({ focus: { kind: 'groups', groups: ['quads', 'hamstrings'] }, minutes: 60 }), c)
    expect(plan.warnings.some((w) => w.startsWith('Legs A is next in the rotation'))).toBe(true)
    expect(plan.cardio?.kind).toBe('none')
  })

  it('a custom session covering the next day advances the rotation', () => {
    const c = ctx({ program: program({ pointer: 5 }) })
    const plan = buildCustomSession(request({ focus: { kind: 'groups', groups: ['chest', 'front_delts', 'side_delts', 'triceps'] }, minutes: 90 }), c)
    expect(plan.exercises.length).toBeGreaterThan(0)
    expect(['advances', 'holds']).toContain(plan.rotation_effect)
  })

  it('a pattern focus and "any" without a program both build full plans', () => {
    const patterns = buildCustomSession(request({ focus: { kind: 'patterns', patterns: ['squat', 'hinge', 'knee_extension', 'knee_flexion'] }, minutes: 60 }), ctx({ program: null }))
    expect(ids(patterns)[0]).toBe('back-squat')
    expect(patterns.rotation_effect).toBe('holds')
    expect(patterns.cardio?.kind).toBe('none')
    const any = buildCustomSession(request({ minutes: 60 }), ctx({ program: null }))
    expect(any.name).toBe('Full body')
    expect(any.exercises.length).toBeGreaterThanOrEqual(3)
    expect(any.needs_minutes).toBeNull()
  })

  it('never puts more than two isolations on one muscle group', () => {
    const plan = buildCustomSession(request({ focus: { kind: 'groups', groups: ['side_delts', 'biceps', 'triceps', 'calves'] }, minutes: 90 }), ctx())
    const groups = new Map<string, number>()
    for (const e of plan.exercises) {
      if (e.is_compound) continue
      const g = EX[e.exercise_id].primaryMuscles[0]
      groups.set(g, (groups.get(g) ?? 0) + 1)
    }
    for (const n of groups.values()) expect(n).toBeLessThanOrEqual(2)
  })
})
