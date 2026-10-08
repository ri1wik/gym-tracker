// One exercise in the session: collapsed to a name and a progress count, or
// expanded to warm-up ramps (greyed, "Tick all ramps"), working rows, the
// "last: 60 kg x 8" label and the footer actions. One card is expanded at a
// time; the screen owns that state.

import type { ExerciseIndexEntry, WorkoutSet } from '../../domain/types'
import { setLabel } from './fmt'
import type { KeypadKind } from './Keypad'
import type { ExerciseInfo } from './library'
import type { PrKind } from './pr'
import { SetRow, type RowValues } from './SetRow'
import { exerciseName } from './library'

export interface ExerciseCardProps {
  entry: ExerciseIndexEntry
  info: ExerciseInfo
  sets: WorkoutSet[]
  expanded: boolean
  lastTime: RowValues | null
  /** Previous session's working sets in order, for the prev column. */
  prevSets: RowValues[]
  values: Record<string, RowValues>
  activeSetId: string | null
  prs: Record<string, PrKind>
  poppingId: string | null
  mirrored: boolean
  why: string | null
  onToggle: () => void
  onSelectSet: (s: WorkoutSet) => void
  onCompleteSet: (s: WorkoutSet) => void
  onCopyPrev: (s: WorkoutSet, v: RowValues) => void
  onChange: (s: WorkoutSet, v: RowValues) => void
  onKeypad: (s: WorkoutSet, kind: KeypadKind) => void
  onRemoveSet: (s: WorkoutSet) => void
  onTickAllRamps: () => void
  onAddSet: () => void
  onRemoveLastSet: () => void
  onBusy: () => void
}

export function ExerciseCard(p: ExerciseCardProps) {
  const warmups = p.sets.filter((s) => s.kind === 'warmup')
  const working = p.sets.filter((s) => s.kind === 'working')
  const doneWorking = working.filter((s) => s.completed_at !== null).length
  const pendingRamps = warmups.filter((s) => s.completed_at === null).length
  const replaced = p.sets.find((s) => s.substituted_for)?.substituted_for ?? null
  const allDone = working.length > 0 && doneWorking === working.length

  const stateOf = (s: WorkoutSet) => (s.id === p.activeSetId ? 'active' : s.completed_at !== null ? 'done' : 'pending')

  const row = (s: WorkoutSet, ordinal: string, prev: RowValues | null) => (
    <SetRow
      key={s.id}
      entry={p.entry}
      set={s}
      ordinal={ordinal}
      prev={prev}
      values={p.values[s.id] ?? { load_g: 0, reps: 0, assist_g: 0 }}
      state={stateOf(s)}
      pr={p.prs[s.id] ?? null}
      popping={p.poppingId === s.id}
      mirrored={p.mirrored}
      incrementG={p.info.incrementG}
      onSelect={() => p.onSelectSet(s)}
      onComplete={() => p.onCompleteSet(s)}
      onCopyPrev={() => prev && p.onCopyPrev(s, prev)}
      onChange={(v) => p.onChange(s, v)}
      onKeypad={(k) => p.onKeypad(s, k)}
      onRemove={() => p.onRemoveSet(s)}
    />
  )

  return (
    <section className={`rounded-card border bg-surface-1 ${p.expanded ? 'border-line-strong' : 'border-line'}`} aria-label={p.entry.name}>
      <button
        type="button"
        onClick={p.onToggle}
        aria-expanded={p.expanded}
        aria-label={`${p.entry.name}, ${doneWorking} of ${working.length} sets done`}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold leading-tight">{p.entry.name}</span>
          <span className="num block text-[14px] font-medium text-ink-2">
            {p.lastTime ? `last: ${setLabel(p.entry, p.lastTime.load_g, p.lastTime.reps, p.lastTime.assist_g)}` : 'first time'}
            {replaced ? ` · replaces ${exerciseName(replaced)}` : ''}
          </span>
        </span>
        <span className={`num shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${allDone ? 'bg-mint/15 text-mint-text' : 'bg-surface-2 text-ink-2'}`}>
          {doneWorking} of {working.length}
        </span>
      </button>
      {p.expanded && (
        <div className="space-y-2 px-2 pb-2">
          {p.why && <p className="px-2 text-[14px] leading-snug text-ink-2">{p.why}</p>}
          {warmups.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">Warm-up</span>
                {pendingRamps > 0 && (
                  <button type="button" onClick={p.onTickAllRamps} className="flex h-11 items-center rounded-control px-2 text-[15px] font-semibold text-accent-text">
                    Tick all ramps
                  </button>
                )}
              </div>
              {warmups.map((s) => row(s, 'W', null))}
            </div>
          )}
          <div className="space-y-1">
            <div className="grid grid-cols-[36px_64px_1fr_1fr_56px] px-0 text-[12px] font-semibold uppercase tracking-wider text-ink-3">
              <span className="text-center">Set</span>
              <span className="text-center">Prev</span>
              <span className="text-center">{p.entry.loadType === 'assisted' ? 'Assist' : p.entry.loadType === 'time' ? '' : 'kg'}</span>
              <span className="text-center">{p.entry.loadType === 'time' ? 'Sec' : 'Reps'}</span>
              <span className="text-center">Done</span>
            </div>
            {working.map((s, i) => row(s, String(i + 1), p.prevSets[i] ?? p.prevSets[p.prevSets.length - 1] ?? null))}
          </div>
          <div className="flex items-center gap-1 pt-1">
            <button type="button" onClick={p.onAddSet} className="flex h-11 items-center whitespace-nowrap rounded-control px-2 text-[15px] font-semibold text-accent-text">
              + Add set
            </button>
            <button type="button" onClick={p.onRemoveLastSet} disabled={p.sets.length === 0} aria-label="Remove last set" className="flex h-11 items-center whitespace-nowrap rounded-control px-2 text-[15px] font-semibold text-ink-2 disabled:opacity-40">
              Remove
            </button>
            <button type="button" onClick={p.onBusy} className="ml-auto flex h-11 items-center whitespace-nowrap rounded-control px-2 text-[15px] font-semibold text-ink-2">
              Machine busy
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
