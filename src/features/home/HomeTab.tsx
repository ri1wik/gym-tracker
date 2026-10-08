import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { PATHS } from '../../app/paths'
import { relativeDayLabel } from '../train/program/rotation'
import { startNextSession } from '../train/program/startSession'
import { programDb } from '../train/program/store'
import { useTrainView } from '../train/program/useTrainView'
import { PRIMARY_BUTTON } from '../train/program/ui'
import { useOnboardingDone } from '../profile/repo'

// OWNER: ui-program-home. Home is one card: the next session, one Start
// button and one number. On a check-in day the number slot reads "Check-in
// due". While a workout is in progress the card becomes Resume.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`
}

function Elapsed({ since }: { since: string }) {
  const start = Date.parse(since)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return <span className="num">{formatElapsed(now - start)}</span>
}

export function HomeTab() {
  const { view, today } = useTrainView()
  const onboarded = useOnboardingDone()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // A first run lands on the one-screen profile before anything else.
  if (onboarded === false) return <Navigate to={PATHS.onboarding} replace />

  async function start() {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      const res = await startNextSession(programDb(), today)
      navigate(PATHS.session(res.workoutId))
    } catch {
      setProblem('Could not start the session. Tap Start to try again.')
      setBusy(false)
    }
  }

  if (!view) {
    return (
      <section aria-busy="true" className="space-y-4">
        <h1 className="sr-only">Home</h1>
        <div className="h-64 animate-pulse rounded-card border border-line bg-surface-1" />
      </section>
    )
  }

  if (!view.program || !view.template || !view.next) {
    return (
      <section className="space-y-4">
        <h1 className="sr-only">Home</h1>
        <div className="space-y-4 rounded-card border border-line bg-surface-1 p-5">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Get started</p>
            <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight">Pick your split</p>
            <p className="mt-1 text-[15px] text-ink-2">Three questions and your first session is ready.</p>
          </div>
          <Link to={PATHS.trainProgram} className={PRIMARY_BUTTON}>
            Choose a split
          </Link>
        </div>
      </section>
    )
  }

  const { inProgress, next, template, program } = view
  const resumeName =
    inProgress?.plan?.name ?? template.days.find((d) => d.key === inProgress?.session_key)?.name ?? 'your session'
  const lastDone = view.lastDone[next.day.key] ?? null
  const paused = program.settings.paused

  return (
    <section className="space-y-4">
      <h1 className="sr-only">Home</h1>
      <div className="space-y-5 rounded-card border border-line bg-surface-1 p-5">
        <div>
          {inProgress ? (
            <>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-accent-text">In progress</p>
              <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{resumeName}</p>
              <p className="mt-1 text-[15px] text-ink-2">
                Running <Elapsed since={inProgress.started_at} />
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Next</p>
              <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{next.day.name}</p>
              <p className="mt-1 text-[15px] text-ink-2">
                {lastDone ? `Last done ${relativeDayLabel(lastDone, today)}` : 'Not done yet'}
              </p>
              {next.first_session_back ? (
                <p className="mt-2 text-[15px] text-ink-2">
                  Back after a break: loads start <span className="num">5</span> percent lighter.
                </p>
              ) : null}
              {program.settings.deload.active ? (
                <p className="mt-2 text-[15px] text-ink-2">Deload week: half the sets, same loads.</p>
              ) : null}
            </>
          )}
        </div>

        <button type="button" className={PRIMARY_BUTTON} onClick={start} disabled={busy}>
          {inProgress ? 'Resume' : 'Start'}
        </button>
        {problem ? (
          <p role="status" className="text-[15px] text-rose-text">
            {problem}
          </p>
        ) : null}

        <div className="border-t border-line pt-4">
          {paused ? (
            <p className="text-[15px] text-ink-2">Program paused. Nothing is counted until you resume it.</p>
          ) : view.checkinDue ? (
            <Link to={PATHS.checkin} className="flex min-h-11 items-center justify-between gap-3">
              <span>
                <span className="block text-[22px] font-bold leading-tight text-accent-text">Check-in due</span>
                <span className="block text-[15px] text-ink-2">
                  About <span className="num">2</span> minutes
                </span>
              </span>
              <span aria-hidden className="text-[22px] text-ink-3">
                {'>'}
              </span>
            </Link>
          ) : (
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Sessions this week</p>
              <p className="mt-1">
                <span className="num text-[40px] font-bold leading-none">{view.weekCount}</span>
                <span className="ml-2 text-[17px] text-ink-2">
                  of <span className="num">{view.weekTarget}</span>
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
