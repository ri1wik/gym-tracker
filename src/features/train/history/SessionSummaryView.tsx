// A finished session's summary, read-only, reusing the finish screen.

import { useLiveQuery } from 'dexie-react-hooks'
import { FinishSummary } from '../../session/FinishSummary'
import { loadSummary } from '../../session/loadSummary'
import { getWorkout } from '../../session/repo'
import { dateLabelOf } from './format'

export function SessionSummaryView({ workoutId, onBack }: { workoutId: string; onBack: () => void }) {
  const workout = useLiveQuery(() => getWorkout(workoutId), [workoutId])
  const summary = useLiveQuery(() => loadSummary(workoutId), [workoutId])
  return (
    <section className="space-y-3" aria-label="Session summary">
      <button type="button" onClick={onBack} className="flex h-11 items-center gap-1 rounded-control pr-3 text-[15px] font-semibold text-accent-text">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        History
      </button>
      {summary === undefined ? null : summary === null ? (
        <p className="text-[15px] text-ink-2">This session is not on this device.</p>
      ) : (
        <FinishSummary summary={summary} dateLabel={workout ? dateLabelOf(workout.planned_on, workout.started_at) : undefined} />
      )}
    </section>
  )
}
