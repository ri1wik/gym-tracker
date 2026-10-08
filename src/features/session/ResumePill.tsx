// The resume pill: "Resume · Push A · 23:14" docked above the tab bar on
// every screen while a workout is in progress (PLAN.md section 2). Mounted
// once by the Shell. On the first mount of an app load it also routes to
// the in-progress session, so reopening the app lands back in the workout.

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { PATHS } from '../../app/paths'
import { elapsedLabel } from './fmt'
import { activeWorkoutId, getWorkout } from './repo'

let bootRedirectDone = false

export function ResumePill() {
  const navigate = useNavigate()
  const location = useLocation()
  const workout = useLiveQuery(async () => {
    const id = await activeWorkoutId()
    return id ? ((await getWorkout(id)) ?? null) : null
  }, [])
  const [now, setNow] = useState(() => Date.now())

  const live = workout && workout.status === 'in_progress' ? workout : null

  useEffect(() => {
    if (!live) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [live])

  useEffect(() => {
    if (workout === undefined || bootRedirectDone) return
    bootRedirectDone = true
    if (live && !location.pathname.startsWith('/session/')) navigate(PATHS.session(live.id))
  }, [workout, live, location.pathname, navigate])

  if (!live) return null
  const elapsed = Math.max(0, (now - Date.parse(live.started_at)) / 1000)
  const name = live.plan?.name ?? live.session_key
  return (
    <div className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 lg:justify-start lg:pl-[17rem]" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}>
      <button
        type="button"
        onClick={() => navigate(PATHS.session(live.id))}
        className="pointer-events-auto flex h-11 max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface-2/92 px-4 text-[15px] font-semibold shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        <span className="truncate">Resume · {name}</span>
        <span className="num shrink-0 text-ink-2">{elapsedLabel(elapsed)}</span>
      </button>
    </div>
  )
}
