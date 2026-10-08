// The What-next sheet (PLAN.md section 2): opens when the last prescribed
// set of an exercise is done, or on "Machine busy". Shows the next exercise
// with its image slot, the machine with the saved seat and pad, target sets
// and reps and the load suggestion; Go, "Busy, swap" and Later. The swap
// view lists up to four substitutes with pictures; one tap swaps for today.

import type { ExerciseIndexEntry, MachineSetting } from '../../domain/types'
import type { MachineInfo } from './library'
import { ImageSlot, Sheet } from './ui'

export interface NextCard {
  entry: ExerciseIndexEntry
  targetSets: number
  /** "3 x 8 to 10" */
  targetReps: string
  /** "60 kg", "ramp up to a set of 8 that feels like 2 reps left" */
  loadSuggestion: string
  machine: MachineInfo | null
  setting: MachineSetting | null
}

export interface SubstituteCard {
  entry: ExerciseIndexEntry
  reasons: string[]
  machine: MachineInfo | null
}

export interface WhatNextSheetProps {
  mode: 'next' | 'swap'
  /** Null when every exercise is done. */
  next: NextCard | null
  /** The exercise being swapped in swap mode. */
  swapping: ExerciseIndexEntry | null
  substitutes: SubstituteCard[]
  onGo: () => void
  onBusy: () => void
  onLater: () => void
  onPick: (exerciseId: string) => void
  onFinish: () => void
  onClose: () => void
}

function settingLine(s: MachineSetting | null): string | null {
  if (!s) return null
  const parts = [
    s.seat && `seat ${s.seat}`,
    s.pad && `pad ${s.pad}`,
    s.grip && `grip ${s.grip}`,
    s.pin && `pin ${s.pin}`,
    s.foot_plate && `foot plate ${s.foot_plate}`,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : s.note
}

export function WhatNextSheet(p: WhatNextSheetProps) {
  if (p.mode === 'swap') {
    return (
      <Sheet title={`Swap ${p.swapping?.name ?? ''}`} onClose={p.onClose} label="Substitutes">
        {p.substitutes.length === 0 ? (
          <p className="pb-4 text-[15px] text-ink-2">No substitute shares this movement. Add a different exercise instead.</p>
        ) : (
          <ul className="space-y-2 pb-2">
            {p.substitutes.map((s) => (
              <li key={s.entry.id}>
                <button
                  type="button"
                  onClick={() => p.onPick(s.entry.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-card border border-line bg-surface-1 p-3 text-left"
                >
                  <ImageSlot label="img" size={56} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold">{s.entry.name}</span>
                    <span className="block truncate text-[14px] text-ink-2">
                      {s.machine ? `${s.machine.name}` : s.entry.equipment.replace(/_/g, ' ')}
                      {s.reasons.length ? ` · ${s.reasons.join(', ')}` : ''}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold text-accent-text">Use</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    )
  }

  if (!p.next) {
    return (
      <Sheet title="All done" onClose={p.onClose}>
        <p className="text-[15px] text-ink-2">Every exercise is logged. Finish to see the summary, or add one more.</p>
        <div className="flex gap-2 py-4">
          <button type="button" onClick={p.onFinish} className="flex h-14 flex-1 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent">
            Finish
          </button>
          <button type="button" onClick={p.onClose} className="flex h-14 flex-1 items-center justify-center rounded-control bg-surface-3 text-[16px] font-semibold">
            Keep going
          </button>
        </div>
      </Sheet>
    )
  }

  const n = p.next
  const setting = settingLine(n.setting)
  return (
    <Sheet title="Next up" onClose={p.onClose}>
      <div className="flex items-start gap-3">
        <ImageSlot label="img" size={88} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[22px] font-semibold leading-tight">{n.entry.name}</h3>
          {n.machine && (
            <p className="mt-1 text-[14px] text-ink-2">
              {n.machine.name}
              {!n.machine.hasPhoto ? ' (no photo yet)' : ''}
            </p>
          )}
          {setting ? (
            <p className="num text-[14px] font-medium text-ink-1">Your settings: {setting}</p>
          ) : n.machine ? (
            <p className="text-[14px] text-ink-3">No saved settings yet</p>
          ) : null}
        </div>
      </div>
      <dl className="num mt-4 grid grid-cols-2 gap-2 text-[15px]">
        <div className="rounded-control bg-surface-1 p-3">
          <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">Target</dt>
          <dd className="text-[22px] font-bold">{n.targetReps}</dd>
        </div>
        <div className="rounded-control bg-surface-1 p-3">
          <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">Load</dt>
          <dd className={n.loadSuggestion.length > 12 ? 'text-[15px] font-semibold leading-snug' : 'text-[22px] font-bold'}>{n.loadSuggestion}</dd>
        </div>
      </dl>
      <div className="flex gap-2 py-4">
        <button type="button" onClick={p.onGo} className="flex h-14 flex-1 items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent">
          Go
        </button>
        <button type="button" onClick={p.onBusy} className="flex h-14 flex-1 items-center justify-center rounded-control bg-surface-3 text-[16px] font-semibold">
          Busy, swap
        </button>
        <button type="button" onClick={p.onLater} className="flex h-14 min-w-[72px] items-center justify-center rounded-control px-3 text-[16px] font-semibold text-ink-2">
          Later
        </button>
      </div>
    </Sheet>
  )
}
