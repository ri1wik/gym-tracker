// History: finished sessions, newest first, each opening its summary in
// place (?w=<id>). A quick-start button lives here until the program screen
// wires the planner, and a resume row shows while a session is live.

import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PATHS } from '../../../app/paths'
import { elapsedLabel } from '../../session/fmt'
import { activeWorkoutId, finishedWorkouts, setsOf } from '../../session/repo'
import { startQuickSession } from '../../session/start'
import { SessionSummaryView } from './SessionSummaryView'
import { dateLabelOf } from './format'

export function HistoryScreen() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const selected = params.get('w')
  const active = useLiveQuery(() => activeWorkoutId(), [])
  const rows = useLiveQuery(async () => {
    const workouts = await finishedWorkouts(100)
    return Promise.all(
      workouts.map(async (w) => {
        const sets = await setsOf(w.id)
        const working = sets.filter((s) => s.kind === 'working' && s.completed_at !== null)
        return {
          workout: w,
          workingSets: working.length,
          exercises: new Set(working.map((s) => s.exercise_id)).size,
          durationS: w.finished_at ? Math.max(0, Math.round((Date.parse(w.finished_at) - Date.parse(w.started_at)) / 1000)) : 0,
        }
      }),
    )
  }, [])

  if (selected) {
    return <SessionSummaryView workoutId={selected} onBack={() => setParams({})} />
  }

  const start = async () => {
    const r = await startQuickSession()
    navigate(PATHS.session(r.id))
  }

  return (
    <section className="space-y-3" aria-label="History">
      {active ? (
        <Link to={PATHS.session(active)} className="flex h-14 items-center justify-between rounded-card border border-line-strong bg-surface-2 px-4 text-[16px] font-semibold">
          <span>Session in progress</span>
          <span className="text-accent-text">Resume</span>
        </Link>
      ) : (
        <button type="button" onClick={() => void start()} className="flex h-14 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent">
          Start a quick session
        </button>
      )}
      {rows === undefined ? null : rows.length === 0 ? (
        <div className="rounded-card border border-line bg-surface-1 p-4">
          <h2 className="text-[17px] font-semibold">No finished sessions yet</h2>
          <p className="mt-1 text-[15px] text-ink-2">Your first finished workout lands here with its summary.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.workout.id}>
              <button
                type="button"
                onClick={() => setParams({ w: r.workout.id })}
                className="flex min-h-14 w-full items-center gap-3 rounded-card border border-line bg-surface-1 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">{r.workout.plan?.name ?? r.workout.session_key}</span>
                  <span className="num block text-[14px] text-ink-2">{dateLabelOf(r.workout.planned_on, r.workout.started_at)}</span>
                </span>
                <span className="num shrink-0 text-right text-[14px] text-ink-2">
                  <span className="block text-[16px] font-semibold text-ink-1">{elapsedLabel(r.durationS)}</span>
                  {r.workingSets} {r.workingSets === 1 ? 'set' : 'sets'} · {r.exercises} {r.exercises === 1 ? 'exercise' : 'exercises'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
