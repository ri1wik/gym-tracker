// [minus] value [plus] in a 48 px pill with 48 by 48 buttons; the value is
// 22/700 tabular and tappable to open the keypad. Each step changes the
// value synchronously; a held button repeats at 8 per second after 350 ms.

import { useEffect, useRef } from 'react'

export interface StepperProps {
  label: string
  display: string
  onMinus: () => void
  onPlus: () => void
  onTap: () => void
  minusLabel: string
  plusLabel: string
}

function useRepeat(fn: () => void) {
  const timer = useRef<number | null>(null)
  const interval = useRef<number | null>(null)
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  }, [fn])
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    if (interval.current !== null) window.clearInterval(interval.current)
    timer.current = null
    interval.current = null
  }
  const start = () => {
    stop()
    timer.current = window.setTimeout(() => {
      interval.current = window.setInterval(() => latest.current(), 125)
    }, 350)
  }
  useEffect(() => stop, [])
  return { start, stop }
}

export function Stepper({ label, display, onMinus, onPlus, onTap, minusLabel, plusLabel }: StepperProps) {
  const minus = useRepeat(onMinus)
  const plus = useRepeat(onPlus)
  const btn = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[24px] font-semibold leading-none text-ink-1 active:bg-surface-2'
  return (
    <div className="flex h-12 flex-1 items-center rounded-full bg-surface-3" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={minusLabel}
        className={btn}
        onClick={onMinus}
        onPointerDown={minus.start}
        onPointerUp={minus.stop}
        onPointerLeave={minus.stop}
        onPointerCancel={minus.stop}
      >
        <span aria-hidden="true">&minus;</span>
      </button>
      <button type="button" onClick={onTap} aria-label={`${label} ${display}, tap to type`} className="num h-12 min-w-0 flex-1 truncate px-1 text-center text-[22px] font-bold">
        {display}
      </button>
      <button
        type="button"
        aria-label={plusLabel}
        className={btn}
        onClick={onPlus}
        onPointerDown={plus.start}
        onPointerUp={plus.stop}
        onPointerLeave={plus.stop}
        onPointerCancel={plus.stop}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}
