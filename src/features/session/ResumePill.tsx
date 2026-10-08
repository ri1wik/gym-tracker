// The resume pill: "Resume · Push A · 23:14" docked above the tab bar on
// every screen while a workout is in progress (PLAN.md section 2), and
// "Resume · Push A · rest 0:42" while a rest is running. Mounted once by the
// Shell, which owns the live-workout query and the rest timer.
//
// Boot redirect: when the app is opened outside the session (a cold open at
// #/ with a workout in progress) the first mount routes into the session.
// The decision is made once per page load from the entry hash, not from
// the Shell's first mount: a reload that landed on the session, followed by
// a tap on Back, is user navigation and must stay where the user went.

import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PATHS } from '../../app/paths'
import { formatClock } from '../../domain/units'
import type { Workout } from '../../domain/types'
import { elapsedLabel } from './fmt'
import type { RestTimer } from './timer'

function sessionPath(hash: string): boolean {
  return hash.startsWith('#/session/')
}

/** True when this page load started inside a session, so any later Shell mount is the user leaving it. */
const openedOnSession = typeof window !== 'undefined' && sessionPath(window.location.hash)

let bootRedirectDone = openedOnSession

export interface ResumePillProps {
  /** The active workout row; undefined while the first read is in flight. */
  workout: Workout | null | undefined
  /** The workout when it is in progress, else null. */
  live: Workout | null
  rest: RestTimer
  /** CSS bottom for the pill (the Shell stacks it above the rest dock). */
  bottom: string
}

export function ResumePill({ workout, live, rest, bottom }: ResumePillProps) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (workout === undefined || bootRedirectDone) return
    bootRedirectDone = true
    if (live && !location.pathname.startsWith('/session/')) navigate(PATHS.session(live.id))
  }, [workout, live, location.pathname, navigate])

  if (!live) return null
  const elapsed = Math.max(0, (rest.now - Date.parse(live.started_at)) / 1000)
  const name = live.plan?.name ?? live.session_key
  const resting = rest.running && rest.state?.workoutId === live.id
  return (
    <div className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 lg:justify-start lg:pl-[17rem]" style={{ bottom }}>
      <button
        type="button"
        onClick={() => navigate(PATHS.session(live.id))}
        className="pointer-events-auto flex h-11 max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface-2/92 px-4 text-[15px] font-semibold shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        <span className="truncate">Resume · {name}</span>
        <span className="num shrink-0 text-ink-2">{resting ? `rest ${formatClock(rest.remaining)}` : elapsedLabel(elapsed)}</span>
      </button>
    </div>
  )
}
