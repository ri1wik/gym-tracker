// The rest timer. The end instant is stored, not a countdown, so a locked
// phone, a reload or a tab switch changes nothing (PLAN.md section 2). The
// store lives in localStorage under a prefixed key because this origin hosts
// other sites; the hook below derives the remaining time from it.

import { useCallback, useEffect, useState } from 'react'
import { formatClock } from '../../domain/units'
import { playTimerEnd } from './audio'
import { haptic } from './haptics'
import { restSoundEnabled } from './prefs'

export const REST_KEY = 'gt:rest'
export const REST_STEP_S = 15

export interface RestState {
  workoutId: string
  /** Epoch milliseconds the rest ends at. */
  endAt: number
  /** Seconds the rest was started with (after adjustments), for the ring. */
  totalS: number
  /** Epoch milliseconds the rest started at. */
  startedAt: number
}

type Listener = () => void
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readRest(): RestState | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(REST_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as RestState
    if (typeof v.endAt !== 'number' || typeof v.workoutId !== 'string') return null
    return v
  } catch {
    return null
  }
}

function writeRest(state: RestState | null) {
  const s = storage()
  if (s) {
    try {
      if (state) s.setItem(REST_KEY, JSON.stringify(state))
      else s.removeItem(REST_KEY)
    } catch {
      // storage can be full or blocked; the in-memory listeners still update
    }
  }
  emit()
}

export function startRest(workoutId: string, seconds: number, now = Date.now()): void {
  const total = Math.max(0, Math.round(seconds))
  if (total === 0) {
    writeRest(null)
    return
  }
  writeRest({ workoutId, endAt: now + total * 1000, totalS: total, startedAt: now })
}

/** Shift the end by delta seconds; the total moves with it so the ring stays honest. */
export function adjustRest(deltaS: number, now = Date.now()): void {
  const cur = readRest()
  if (!cur) return
  const endAt = Math.max(now, cur.endAt + deltaS * 1000)
  const totalS = Math.max(1, Math.round((endAt - cur.startedAt) / 1000))
  writeRest({ ...cur, endAt, totalS })
}

export function clearRest(): void {
  writeRest(null)
}

/** Remaining whole seconds, floored at zero. */
export function remainingS(state: RestState | null, now = Date.now()): number {
  if (!state) return 0
  return Math.max(0, Math.ceil((state.endAt - now) / 1000))
}

export interface RestTimer {
  state: RestState | null
  /** The clock the view was computed at (ticks every second even with no rest, for elapsed labels). */
  now: number
  remaining: number
  /** 0 to 1 fraction elapsed, for the ring. */
  progress: number
  running: boolean
  minus: () => void
  plus: () => void
  skip: () => void
}

const BASE_TITLE = 'Recomp'

/**
 * Live view of the stored rest for one workout (null: whichever workout owns
 * the stored rest, for the dock the Shell mounts on every other screen).
 * Ticks four times a second, vibrates once when it reaches zero (plus the
 * opt-in tone), and mirrors the countdown into document.title while running.
 * The end feedback fires once per stored rest whichever screen is open.
 */
export function useRestTimer(workoutId: string | null): RestTimer {
  const [state, setState] = useState<RestState | null>(() => readRest())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const l = () => {
      setState(readRest())
      setNow(Date.now())
    }
    listeners.add(l)
    const onStorage = (e: StorageEvent) => {
      if (e.key === REST_KEY) l()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(l)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const mine = state && (workoutId === null || state.workoutId === workoutId) ? state : null
  const remaining = remainingS(mine, now)
  const running = mine !== null && remaining > 0

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), running ? 250 : 1000)
    return () => window.clearInterval(id)
  }, [running])

  // The tone fires once per stored rest, keyed by its end instant.
  useEffect(() => {
    if (!mine || remaining > 0) return
    const key = `rest-done:${mine.endAt}`
    if (sessionFlag(key)) return
    setSessionFlag(key)
    haptic('timerEnd')
    if (restSoundEnabled()) playTimerEnd()
    const t = window.setTimeout(() => clearRest(), 1500)
    return () => window.clearTimeout(t)
  }, [mine, remaining])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (running) document.title = `${formatClock(remaining)} rest`
    else if (document.title !== BASE_TITLE) document.title = BASE_TITLE
  }, [running, remaining])
  useEffect(
    () => () => {
      if (typeof document !== 'undefined' && document.title !== BASE_TITLE) document.title = BASE_TITLE
    },
    [],
  )

  const minus = useCallback(() => adjustRest(-REST_STEP_S), [])
  const plus = useCallback(() => adjustRest(REST_STEP_S), [])
  const skip = useCallback(() => clearRest(), [])

  const progress = mine && mine.totalS > 0 ? Math.min(1, Math.max(0, 1 - remaining / mine.totalS)) : 0
  return { state: mine, now, remaining, progress, running, minus, plus, skip }
}

const flags = new Set<string>()
function sessionFlag(key: string): boolean {
  return flags.has(key)
}
function setSessionFlag(key: string) {
  flags.add(key)
}
