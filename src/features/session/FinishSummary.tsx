// The finish summary (PLAN.md section 2, "Finish"): readable in under five
// seconds and skippable. Reused by the history view, where it is read-only.

import type { ReactNode } from 'react'
import { MuscleMap } from '../../components/MuscleMap'
import type { MuscleGroup } from '../../domain/types'
import { MUSCLE_INFO } from '../../domain/muscles'
import { EXERCISES_BY_ID } from '../../data/library/exercise-index'
import { formatKg } from '../../domain/units'
import { bodyPartLabel, elapsedLabel, setLabel } from './fmt'
import { prLabel } from './pr'
import type { SessionSummary } from './summary'

export interface FinishSummaryProps {
  summary: SessionSummary
  dateLabel?: string
  onDone?: () => void
  onSkip?: () => void
  /** The install card, on the first finished workout only (the session screen decides). */
  install?: ReactNode
}

const OUTCOME_LABEL = { progressed: 'Progressed', same: 'Same', lower: 'Lower', first: 'First time' } as const

export function FinishSummary({ summary: s, dateLabel, onDone, onSkip, install = null }: FinishSummaryProps) {
  // Heat for the map: credit by group from the exercises done, 1 per working set on the primary group.
  const heat: Partial<Record<MuscleGroup, number>> = {}
  for (const o of s.outcomes) {
    const entry = EXERCISES_BY_ID[o.exercise_id]
    if (!entry) continue
    for (const m of entry.primaryMuscles) {
      const g = MUSCLE_INFO[m].group
      heat[g] = (heat[g] ?? 0) + o.workingSets
    }
  }
  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{s.name}</h1>
          {dateLabel && <p className="num text-[14px] text-ink-2">{dateLabel}</p>}
        </div>
        {onSkip && (
          <button type="button" onClick={onSkip} className="flex h-11 items-center rounded-control px-3 text-[15px] font-semibold text-ink-2">
            Skip
          </button>
        )}
      </header>

      <dl className="num grid grid-cols-3 gap-2">
        <div className="rounded-card border border-line bg-surface-1 p-3">
          <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">Duration</dt>
          <dd className="text-[22px] font-bold">{elapsedLabel(s.durationS)}</dd>
        </div>
        <div className="rounded-card border border-line bg-surface-1 p-3">
          <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">Sets</dt>
          <dd className="text-[22px] font-bold">{s.workingSets}</dd>
        </div>
        <div className="rounded-card border border-line bg-surface-1 p-3">
          <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">PRs</dt>
          <dd className="text-[22px] font-bold">{s.prs.length}</dd>
        </div>
      </dl>

      <section className="flex items-center gap-3 rounded-card border border-line bg-surface-1 p-3" aria-label="Body parts worked">
        <MuscleMap mode="heat" heat={heat} size={72} />
        <ul className="num flex flex-1 flex-wrap gap-1.5">
          {s.bodyParts.length === 0 && <li className="text-[14px] text-ink-2">No working sets logged.</li>}
          {s.bodyParts.map((b) => (
            <li key={b.part} className="rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-semibold">
              {bodyPartLabel(b.part)} {b.sets}
            </li>
          ))}
        </ul>
      </section>

      {s.prs.length > 0 && (
        <ul className="space-y-1" aria-label="Records">
          {s.prs.map((p) => {
            const entry = EXERCISES_BY_ID[p.exercise_id]
            return (
              <li key={p.exercise_id} className="num flex items-center gap-2 rounded-card border border-mint/30 bg-mint/15 px-3 py-2 text-[15px] font-semibold">
                <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-mint">{prLabel(p.kind)}</span>
                <span className="truncate">
                  {p.name}
                  {entry ? ` ${setLabel(entry, p.load_g, p.reps)}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <ul className="space-y-1" aria-label="Per exercise">
        {s.outcomes.map((o) => {
          const entry = EXERCISES_BY_ID[o.exercise_id]
          const tone = o.outcome === 'progressed' ? 'text-mint-text' : o.outcome === 'lower' ? 'text-rose-text' : 'text-ink-2'
          return (
            <li key={o.exercise_id} className="rounded-card border border-line bg-surface-1 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{o.name}</span>
                <span className={`text-[13px] font-semibold ${tone}`}>{OUTCOME_LABEL[o.outcome]}</span>
              </div>
              <div className="num flex flex-wrap gap-x-3 text-[14px] text-ink-2">
                {o.best && entry && <span>best {setLabel(entry, o.best.load_g, o.best.reps)}</span>}
                {o.previousBest && entry && <span>last {setLabel(entry, o.previousBest.load_g, o.previousBest.reps)}</span>}
                {o.readyToAdd && entry && entry.loadType !== 'assisted' && <span className="text-accent-text">ready: add {formatKg(o.incrementG)} kg next time</span>}
                {o.readyToAdd && entry && entry.loadType === 'assisted' && <span className="text-accent-text">ready: one step less assistance next time</span>}
              </div>
            </li>
          )
        })}
      </ul>

      {install}

      {onDone && (
        <button type="button" onClick={onDone} className="flex h-14 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent">
          Done
        </button>
      )}
    </div>
  )
}
