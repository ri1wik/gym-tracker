// The rest timer dock: non-modal, above the tab bar height, 64 px, a 48 px
// ring, the remaining time at 28/800 tabular, minus 15, plus 15 and Skip.
// Reserved space is the caller's job so nothing shifts when it appears.

import { formatClock } from '../../domain/units'
import type { RestTimer } from './timer'

export function RestDock({ timer }: { timer: RestTimer }) {
  if (!timer.state) return null
  const r = 21
  const c = 2 * Math.PI * r
  const dash = c * (1 - timer.progress)
  const announce = timer.remaining === 30 || timer.remaining === 10 ? `${timer.remaining} seconds` : ''
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Rest timer"
    >
      <div className="flex h-16 w-full max-w-screen-sm items-center gap-3 rounded-card border border-line-strong bg-surface-2/92 px-3 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0 -rotate-90">
          <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" className="stroke-surface-3" />
          <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dash} className="stroke-accent" />
        </svg>
        <div className="num min-w-[72px] text-[28px] font-extrabold leading-none tracking-tight">{formatClock(timer.remaining)}</div>
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={timer.minus} aria-label="minus 15 seconds" className="num flex h-11 w-[52px] items-center justify-center rounded-control bg-surface-3 text-[15px] font-semibold">
            -15
          </button>
          <button type="button" onClick={timer.plus} aria-label="plus 15 seconds" className="num flex h-11 w-[52px] items-center justify-center rounded-control bg-surface-3 text-[15px] font-semibold">
            +15
          </button>
          <button type="button" onClick={timer.skip} className="flex h-11 w-[52px] items-center justify-center rounded-control text-[15px] font-semibold text-accent-text">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
