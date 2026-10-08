// The active session: the product's heart (PLAN.md section 2). Full screen,
// no tab bar. One exercise card expanded at a time, every set prefilled,
// one tap completes a set with the prefilled values and starts the rest
// timer from a stored end instant, every tap is one row write, the screen
// stays awake, and reopening the app lands back here through the resume
// pill. Route: /session/:id (a workouts row id).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import './session.css'
import { PATHS } from '../../app/paths'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import type { ExerciseIndexEntry, WorkoutSet } from '../../domain/types'
import { AddExerciseSheet } from './AddExerciseSheet'
import { unlockAudio } from './audio'
import { ExerciseCard } from './ExerciseCard'
import { FinishSummary } from './FinishSummary'
import { elapsedLabel, kg } from './fmt'
import { Keypad, type KeypadKind } from './Keypad'
import { exerciseInfo, machineInfo } from './library'
import { loadSummary } from './loadSummary'
import { emptyContext, substitutes } from './plan'
import { detectPr, prLabel, type PrKind } from './pr'
import { isLeftHanded, prefersReducedMotion } from './prefs'
import {
  addSets,
  completeSet,
  discardWorkout,
  finishWorkout,
  getWorkout,
  machineSettingFor,
  plannerHistory,
  previousWorkingSets,
  removeSet,
  restoreSet,
  restoreWorkout,
  setsOf,
  substituteExercise,
  targetsFor,
} from './repo'
import { RestDock } from './RestDock'
import type { RowValues } from './SetRow'
import type { SessionSummary } from './summary'
import { clearRest, startRest, useRestTimer } from './timer'
import { Sheet, ToastStack, type ToastItem } from './ui'
import { useWakeLock } from './wakeLock'
import type { NextCard, SubstituteCard } from './WhatNextSheet'
import { WhatNextSheet } from './WhatNextSheet'
import { setLabel } from './fmt'

type SheetState = { kind: 'next'; after: string | null } | { kind: 'swap'; exerciseId: string } | { kind: 'add' } | { kind: 'finish' } | null

const DEFAULT_SETS_FOR_ADDED = 3

function orderOf(sets: readonly WorkoutSet[]): string[] {
  const out: string[] = []
  for (const s of sets) if (!out.includes(s.exercise_id)) out.push(s.exercise_id)
  return out
}

export function SessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const workout = useLiveQuery(() => (id ? getWorkout(id) : Promise.resolve(undefined)), [id])
  const sets = useLiveQuery(() => (id ? setsOf(id) : Promise.resolve([] as WorkoutSet[])), [id])

  const order = useMemo(() => orderOf(sets ?? []), [sets])
  const idsKey = order.join(',')
  const startedAt = workout?.started_at ?? ''
  const previous = useLiveQuery(async () => {
    const out: Record<string, WorkoutSet[]> = {}
    for (const ex of idsKey ? idsKey.split(',') : []) {
      const rows = await previousWorkingSets(ex, id, 80)
      out[ex] = rows.filter((r) => (r.completed_at ?? '') < startedAt)
    }
    return out
  }, [idsKey, id, startedAt])

  // undefined: nothing chosen yet (the first exercise with work left opens); null: all collapsed.
  const [chosenExpanded, setExpandedId] = useState<string | null | undefined>(undefined)
  const [chosenActive, setActiveSetId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, RowValues>>({})
  const [prs, setPrs] = useState<Record<string, PrKind>>({})
  const [poppingId, setPoppingId] = useState<string | null>(null)
  const [keypad, setKeypad] = useState<{ set: WorkoutSet; kind: KeypadKind } | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [subs, setSubs] = useState<SubstituteCard[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [finished, setFinished] = useState<SessionSummary | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const toastId = useRef(0)
  const mirrored = useMemo(() => isLeftHanded(), [])

  const live = workout?.status === 'in_progress'
  useWakeLock(!!live)
  const timer = useRestTimer(id)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const setsByExercise = useMemo(() => {
    const m: Record<string, WorkoutSet[]> = {}
    for (const s of sets ?? []) (m[s.exercise_id] ??= []).push(s)
    return m
  }, [sets])

  // Default expansion: the first exercise with a pending set. Default active
  // row: the first pending set of the expanded exercise. Both derive during
  // render so a tap never waits on an effect.
  const expandedId: string | null =
    chosenExpanded !== undefined ? chosenExpanded : (order.find((ex) => setsByExercise[ex].some((s) => s.completed_at === null)) ?? order[0] ?? null)
  const expandedRows = expandedId ? (setsByExercise[expandedId] ?? []) : []
  const activeSetId: string | null =
    chosenActive && expandedRows.some((s) => s.id === chosenActive) ? chosenActive : (expandedRows.find((s) => s.completed_at === null)?.id ?? null)

  const prevValues = useCallback(
    (ex: string): { lastTime: RowValues | null; prevSets: RowValues[] } => {
      const rows = previous?.[ex] ?? []
      if (rows.length === 0) return { lastTime: null, prevSets: [] }
      const newest = rows[0]
      const lastTime = { load_g: newest.load_g ?? 0, reps: newest.reps ?? 0, assist_g: newest.assist_g }
      const prevSets = rows
        .filter((r) => r.workout_id === newest.workout_id)
        .sort((a, b) => a.set_index - b.set_index)
        .map((r) => ({ load_g: r.load_g ?? 0, reps: r.reps ?? 0, assist_g: r.assist_g }))
      return { lastTime, prevSets }
    },
    [previous],
  )

  /** The numbers a row shows: its draft, its logged values, or the prefill. */
  const values = useMemo(() => {
    const out: Record<string, RowValues> = {}
    for (const ex of order) {
      const rows = setsByExercise[ex]
      const info = exerciseInfo(ex)
      const { lastTime, prevSets } = prevValues(ex)
      let workingIndex = 0
      let carry: RowValues | null = null
      for (const s of rows) {
        if (drafts[s.id]) {
          out[s.id] = drafts[s.id]
        } else if (s.completed_at !== null) {
          out[s.id] = { load_g: s.load_g ?? 0, reps: s.reps ?? 0, assist_g: s.assist_g }
        } else if (s.kind === 'warmup') {
          out[s.id] = { load_g: s.target_load_g ?? 0, reps: s.target_reps ?? 0, assist_g: s.assist_g }
        } else {
          // Load: what you just logged this session, else the plan, else last time.
          // Reps: the plan's per-set target, else last time's.
          const prev = prevSets[workingIndex] ?? lastTime
          out[s.id] = {
            load_g: carry?.load_g ?? s.target_load_g ?? prev?.load_g ?? 0,
            reps: s.target_reps ?? prev?.reps ?? carry?.reps ?? info?.repMin ?? 8,
            assist_g: carry?.assist_g ?? (s.assist_g || (prev?.assist_g ?? 0)),
          }
        }
        if (s.kind === 'working') {
          if (s.completed_at !== null) carry = out[s.id]
          workingIndex += 1
        }
      }
    }
    return out
  }, [order, setsByExercise, drafts, prevValues])

  const pushToast = useCallback((t: Omit<ToastItem, 'id'>, ttl = 4000) => {
    const item: ToastItem = { ...t, id: ++toastId.current }
    setToasts((ts) => [...ts, item])
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== item.id)), ttl)
    return item.id
  }, [])
  const dropToast = useCallback((tid: number) => setToasts((ts) => ts.filter((x) => x.id !== tid)), [])

  const scrollTo = (setId: string) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`set-${setId}`)?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    })
  }

  const complete = async (set: WorkoutSet) => {
    if (!sets) return
    unlockAudio()
    const v = values[set.id]
    const entry = EXERCISES_BY_ID[set.exercise_id]
    const saved = await completeSet(set, v)
    setDrafts((d) => {
      const { [set.id]: _gone, ...rest } = d
      return rest
    })
    setPoppingId(set.id)
    window.setTimeout(() => setPoppingId((p) => (p === set.id ? null : p)), 200)

    if (set.kind === 'working' && entry) {
      const earlier = sets
        .filter((s) => s.exercise_id === set.exercise_id && s.kind === 'working' && s.completed_at !== null && s.id !== set.id && s.set_index < set.set_index)
        .map((s) => ({ load_g: s.load_g ?? 0, reps: s.reps ?? 0 }))
      const older = (previous?.[set.exercise_id] ?? []).map((s) => ({ load_g: s.load_g ?? 0, reps: s.reps ?? 0 }))
      const kind = detectPr({ load_g: saved.load_g ?? 0, reps: saved.reps ?? 0 }, [...older, ...earlier], entry.loadType)
      if (kind) {
        setPrs((p) => ({ ...p, [set.id]: kind }))
        if (kind !== 'first') pushToast({ text: `${prLabel(kind)} · ${entry.name} ${setLabel(entry, saved.load_g ?? 0, saved.reps ?? 0, saved.assist_g)}`, tone: 'mint' })
      }
    }

    const info = exerciseInfo(set.exercise_id)
    startRest(id, set.rest_s ?? info?.restS ?? 90)

    const rows = setsByExercise[set.exercise_id] ?? []
    const nextHere = rows.find((s) => s.completed_at === null && s.id !== set.id && s.set_index > set.set_index) ?? rows.find((s) => s.completed_at === null && s.id !== set.id)
    if (nextHere) {
      setActiveSetId(nextHere.id)
      scrollTo(nextHere.id)
      return
    }
    setActiveSetId(null)
    if (set.kind === 'working') setSheet({ kind: 'next', after: set.exercise_id })
  }

  const tickAllRamps = async (ex: string) => {
    unlockAudio()
    const ramps = (setsByExercise[ex] ?? []).filter((s) => s.kind === 'warmup' && s.completed_at === null)
    let last: WorkoutSet | null = null
    for (const r of ramps) {
      last = await completeSet(r, values[r.id])
    }
    if (last) startRest(id, last.rest_s ?? 60)
    const next = (setsByExercise[ex] ?? []).find((s) => s.kind === 'working' && s.completed_at === null)
    if (next) {
      setActiveSetId(next.id)
      scrollTo(next.id)
    }
  }

  const remove = async (set: WorkoutSet) => {
    await removeSet(set)
    if (activeSetId === set.id) setActiveSetId(null)
    const tid = pushToast(
      {
        text: set.kind === 'warmup' ? 'Ramp removed' : `Set removed`,
        tone: 'ink',
        action: {
          label: 'Undo',
          onPress: () => {
            void restoreSet(set)
            dropToast(tid)
          },
        },
      },
      5000,
    )
  }

  const removeLast = (ex: string) => {
    const rows = setsByExercise[ex] ?? []
    const victim = [...rows].reverse().find((s) => s.completed_at === null) ?? rows[rows.length - 1]
    if (victim) void remove(victim)
  }

  const addSet = async (ex: string) => {
    const rows = setsByExercise[ex] ?? []
    const last = [...rows].reverse().find((s) => s.kind === 'working')
    const v = last ? values[last.id] : null
    const info = exerciseInfo(ex)
    const [row] = await addSets(id, ex, {
      count: 1,
      targetReps: v?.reps ?? info?.repMin ?? null,
      targetLoadG: v?.load_g ?? null,
      assistG: v?.assist_g ?? 0,
      restS: last?.rest_s ?? info?.restS ?? null,
    })
    setActiveSetId(row.id)
  }

  const addExercise = async (ex: string) => {
    setSheet(null)
    const t = await targetsFor(ex, id)
    const rows = await addSets(id, ex, { count: DEFAULT_SETS_FOR_ADDED, ...t })
    setExpandedId(ex)
    setActiveSetId(rows[0]?.id ?? null)
    if (rows[0]) scrollTo(rows[0].id)
  }

  const openSwap = async (ex: string) => {
    setSheet({ kind: 'swap', exerciseId: ex })
    setSubs([])
    const history = await plannerHistory()
    const ctx = emptyContext(history)
    const list = substitutes({ exercise_id: ex, done_today: order, limit: 4 }, ctx)
    setSubs(
      list
        .map((s) => ({ entry: EXERCISES_BY_ID[s.exercise_id], reasons: s.reasons, machine: machineInfo(EXERCISES_BY_ID[s.exercise_id]?.machineId) }))
        .filter((s): s is SubstituteCard => !!s.entry),
    )
  }

  const pickSubstitute = async (to: string) => {
    if (sheet?.kind !== 'swap') return
    const from = sheet.exerciseId
    setSheet(null)
    await substituteExercise(id, from, to)
    setExpandedId(to)
    setActiveSetId(null)
    pushToast({ text: `Swapped to ${EXERCISES_BY_ID[to]?.name ?? to}`, tone: 'ink' })
  }

  const doFinish = async () => {
    setSheet(null)
    clearRest()
    await finishWorkout(id)
    const s = await loadSummary(id)
    setFinished(s)
  }

  const finish = () => {
    const pending = (sets ?? []).filter((s) => s.kind === 'working' && s.completed_at === null).length
    if (pending > 0) setSheet({ kind: 'finish' })
    else void doFinish()
  }

  const discard = async () => {
    setSheet(null)
    clearRest()
    await discardWorkout(id)
    let undone = false
    const tid = pushToast(
      {
        text: 'Session discarded',
        tone: 'rose',
        action: {
          label: 'Undo',
          onPress: () => {
            undone = true
            void restoreWorkout(id)
            dropToast(tid)
          },
        },
      },
      5000,
    )
    window.setTimeout(() => {
      if (!undone) navigate(PATHS.home, { replace: true })
    }, 5000)
  }

  // The next exercise for the sheet: the first with a pending working set, after the one just finished.
  const nextExerciseId = useMemo(() => {
    const after = sheet?.kind === 'next' ? sheet.after : null
    const candidates = order.filter((ex) => ex !== after && (setsByExercise[ex] ?? []).some((s) => s.kind === 'working' && s.completed_at === null))
    const i = after ? order.indexOf(after) : -1
    return candidates.find((ex) => order.indexOf(ex) > i) ?? candidates[0] ?? null
  }, [order, setsByExercise, sheet])
  const nextMachineId = nextExerciseId ? EXERCISES_BY_ID[nextExerciseId]?.machineId : undefined
  const nextSetting = useLiveQuery(() => machineSettingFor(nextMachineId), [nextMachineId])

  const nextCard: NextCard | null = useMemo(() => {
    if (!nextExerciseId) return null
    const entry = EXERCISES_BY_ID[nextExerciseId]
    if (!entry) return null
    const info = exerciseInfo(nextExerciseId)
    const rows = setsByExercise[nextExerciseId] ?? []
    const pending = rows.filter((s) => s.kind === 'working' && s.completed_at === null)
    const planned = workout?.plan?.exercises.find((e) => e.exercise_id === nextExerciseId)
    const repMin = planned?.rep_min ?? info?.repMin ?? 8
    const repMax = planned?.rep_max ?? info?.repMax ?? 12
    const first = pending[0]
    const v = first ? values[first.id] : null
    let loadSuggestion: string
    if (entry.loadType === 'time') loadSuggestion = `${v?.reps ?? 30} s hold`
    else if (entry.loadType === 'assisted') loadSuggestion = v && v.assist_g > 0 ? `${kg(v.assist_g)} assist` : 'Pick an assist that leaves 2 reps'
    else if (entry.loadType === 'bodyweight') loadSuggestion = v && v.load_g > 0 ? `BW + ${kg(v.load_g)}` : 'Bodyweight'
    else if (v && v.load_g > 0) loadSuggestion = kg(v.load_g)
    else loadSuggestion = 'Ramp up to a set of 8 that feels like 2 reps left'
    return {
      entry,
      targetSets: pending.length,
      targetReps: `${pending.length} x ${repMin} to ${repMax}`,
      loadSuggestion,
      machine: machineInfo(entry.machineId),
      setting: nextSetting ?? null,
    }
  }, [nextExerciseId, setsByExercise, workout, values, nextSetting])

  const goNext = () => {
    setSheet(null)
    if (!nextExerciseId) return
    setExpandedId(nextExerciseId)
    const first = (setsByExercise[nextExerciseId] ?? []).find((s) => s.completed_at === null)
    setActiveSetId(first?.id ?? null)
    if (first) scrollTo(first.id)
  }

  const keypadSubmit = (n: number) => {
    if (!keypad) return
    const { set, kind } = keypad
    const entry = EXERCISES_BY_ID[set.exercise_id]
    const cur = values[set.id]
    const next: RowValues =
      kind === 'kg'
        ? entry?.loadType === 'assisted'
          ? { ...cur, assist_g: n }
          : { ...cur, load_g: n }
        : { ...cur, reps: n }
    setDrafts((d) => ({ ...d, [set.id]: next }))
    setKeypad(null)
  }

  // ---------------------------------------------------------------------------

  if (workout === undefined || sets === undefined) {
    return <main className="min-h-dvh bg-bg px-4 pt-[max(1rem,env(safe-area-inset-top))] text-ink-1" aria-busy="true" />
  }
  if (!workout) {
    return (
      <main className="min-h-dvh bg-bg px-4 pt-[max(1rem,env(safe-area-inset-top))] text-ink-1">
        <h1 className="text-[28px] font-bold">No session here</h1>
        <p className="mt-2 text-[15px] text-ink-2">This session id is not on this device.</p>
        <Link to={PATHS.home} className="mt-4 flex h-12 items-center justify-center rounded-control bg-surface-2 text-[16px] font-semibold">
          Home
        </Link>
      </main>
    )
  }

  if (finished) {
    return (
      <main className="min-h-dvh bg-bg text-ink-1">
        <div className="mx-auto w-full max-w-screen-sm px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
          <FinishSummary summary={finished} onDone={() => navigate(PATHS.trainHistory, { replace: true })} onSkip={() => navigate(PATHS.home, { replace: true })} />
        </div>
      </main>
    )
  }

  const elapsed = Math.max(0, (now - Date.parse(workout.started_at)) / 1000)
  const name = workout.plan?.name ?? workout.session_key
  const doneWorking = sets.filter((s) => s.kind === 'working' && s.completed_at !== null).length
  const totalWorking = sets.filter((s) => s.kind === 'working').length
  const dockBottom = timer.state ? 'calc(5rem + env(safe-area-inset-bottom) + 0.5rem)' : 'calc(1rem + env(safe-area-inset-bottom))'

  return (
    <main className="min-h-dvh bg-bg text-ink-1">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-screen-sm items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
          <Link to={PATHS.home} aria-label="Back, session stays live" className="flex h-11 w-11 items-center justify-center rounded-control text-ink-2">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold leading-tight">{name}</h1>
            <p className="num text-[13px] text-ink-2">
              {doneWorking} of {totalWorking} sets
            </p>
          </div>
          <span className="num text-[28px] font-bold tracking-tight" aria-label="Session time">
            {elapsedLabel(elapsed)}
          </span>
          <button type="button" onClick={finish} className="ml-1 flex h-11 items-center justify-center rounded-control bg-accent px-4 text-[15px] font-semibold text-on-accent">
            Finish
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-screen-sm space-y-2 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3">
        {workout.plan?.general_warmup && (
          <p className="num px-1 text-[14px] text-ink-2">
            Warm-up: {workout.plan.general_warmup.cardio}
            {workout.plan.general_warmup.drills.length ? `, then ${workout.plan.general_warmup.drills.map((d) => `${d.name} ${d.dose}`).join(', ')}` : ''}
          </p>
        )}
        {order.map((ex) => {
          const entry: ExerciseIndexEntry | undefined = EXERCISES_BY_ID[ex]
          const info = exerciseInfo(ex)
          if (!entry || !info) return null
          const { lastTime, prevSets } = prevValues(ex)
          const planned = workout.plan?.exercises.find((e) => e.exercise_id === ex)
          return (
            <ExerciseCard
              key={ex}
              entry={entry}
              info={info}
              sets={setsByExercise[ex]}
              expanded={expandedId === ex}
              lastTime={lastTime}
              prevSets={prevSets}
              values={values}
              activeSetId={expandedId === ex ? activeSetId : null}
              prs={prs}
              poppingId={poppingId}
              mirrored={mirrored}
              why={planned?.why ?? null}
              onToggle={() => setExpandedId((cur) => (cur === ex ? null : ex))}
              onSelectSet={(s) => {
                setExpandedId(ex)
                setActiveSetId(s.id)
              }}
              onCompleteSet={(s) => void complete(s)}
              onCopyPrev={(s, v) => setDrafts((d) => ({ ...d, [s.id]: v }))}
              onChange={(s, v) => setDrafts((d) => ({ ...d, [s.id]: v }))}
              onKeypad={(s, kind) => setKeypad({ set: s, kind })}
              onRemoveSet={(s) => void remove(s)}
              onTickAllRamps={() => void tickAllRamps(ex)}
              onAddSet={() => void addSet(ex)}
              onRemoveLastSet={() => removeLast(ex)}
              onBusy={() => void openSwap(ex)}
            />
          )
        })}
        <div className="flex flex-col gap-2 pt-2">
          <button type="button" onClick={() => setSheet({ kind: 'add' })} className="flex h-12 w-full items-center justify-center rounded-control border border-line-strong bg-surface-2 text-[16px] font-semibold">
            + Add exercise
          </button>
          <Link to={PATHS.trainLibrary} className="flex h-11 items-center justify-center text-[15px] font-semibold text-accent-text">
            What is this machine?
          </Link>
        </div>
      </div>

      <RestDock timer={timer} />
      <ToastStack toasts={toasts} bottom={dockBottom} />

      {keypad && (
        <Keypad
          kind={keypad.kind}
          label={keypad.kind === 'kg' ? (EXERCISES_BY_ID[keypad.set.exercise_id]?.loadType === 'assisted' ? 'Assistance' : 'Load') : keypad.kind === 'seconds' ? 'Seconds' : 'Reps'}
          value={keypad.kind === 'kg' ? (EXERCISES_BY_ID[keypad.set.exercise_id]?.loadType === 'assisted' ? values[keypad.set.id].assist_g : values[keypad.set.id].load_g) : values[keypad.set.id].reps}
          onSubmit={keypadSubmit}
          onClose={() => setKeypad(null)}
        />
      )}
      {(sheet?.kind === 'next' || sheet?.kind === 'swap') && (
        <WhatNextSheet
          mode={sheet.kind}
          next={nextCard}
          swapping={sheet.kind === 'swap' ? (EXERCISES_BY_ID[sheet.exerciseId] ?? null) : null}
          substitutes={subs}
          onGo={goNext}
          onBusy={() => nextExerciseId && void openSwap(nextExerciseId)}
          onLater={() => setSheet(null)}
          onPick={(to) => void pickSubstitute(to)}
          onFinish={() => void doFinish()}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'add' && <AddExerciseSheet onPick={(ex) => void addExercise(ex)} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'finish' && (
        <Sheet title="Finish now?" onClose={() => setSheet(null)}>
          <p className="num text-[15px] text-ink-2">
            {totalWorking - doneWorking} working {totalWorking - doneWorking === 1 ? 'set is' : 'sets are'} still open. The summary counts what you logged.
          </p>
          <div className="flex flex-col gap-2 py-4">
            <button type="button" onClick={() => void doFinish()} className="flex h-14 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent">
              Finish
            </button>
            <button type="button" onClick={() => setSheet(null)} className="flex h-12 items-center justify-center rounded-control bg-surface-3 text-[16px] font-semibold">
              Keep going
            </button>
            <button type="button" onClick={() => void discard()} className="flex h-12 items-center justify-center rounded-control text-[15px] font-semibold text-rose-text">
              Discard session
            </button>
          </div>
        </Sheet>
      )}
    </main>
  )
}
