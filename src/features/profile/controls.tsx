// Small form controls shared by onboarding, the You tab and the check-in.
// Every control is 44 px or taller, every input is 16 px or larger, every
// number wears .num.

import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

export const labelClass = 'text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3'
export const cardClass = 'rounded-card border border-line bg-surface-1 p-4'
export const inputClass =
  'num h-12 w-full rounded-control border border-line-strong bg-surface-2 px-3 text-[18px]! font-semibold! text-ink-1! placeholder:text-ink-3'
export const primaryButtonClass =
  'flex h-14 w-full items-center justify-center rounded-control bg-accent px-4 text-[17px]! font-semibold! text-on-accent! active:bg-accent-pressed disabled:bg-surface-3 disabled:text-ink-3!'
export const secondaryButtonClass =
  'flex h-12 w-full items-center justify-center rounded-control border border-line-strong bg-surface-2 px-4 text-[16px]! font-semibold! text-ink-1! active:bg-surface-3'
export const ghostButtonClass =
  'flex h-11 items-center justify-center rounded-control px-3 text-[15px]! font-semibold! text-accent-text!'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`${cardClass} ${className}`}>
      {title ? <h2 className={labelClass}>{title}</h2> : null}
      <div className={title ? 'mt-3 space-y-4' : 'space-y-4'}>{children}</div>
    </section>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[15px] font-semibold text-ink-1">{label}</div>
      {children}
      {error ? (
        <p role="alert" className="text-[14px] font-medium text-rose-text">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[14px] text-ink-2">{hint}</p>
      ) : null}
    </div>
  )
}

interface SegmentedProps<T extends string | number> {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-control bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={[
              'num min-h-11 flex-1 rounded-[8px] px-1 text-[15px]! font-semibold!',
              active ? 'bg-surface-3 text-ink-1!' : 'text-ink-2!',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

interface ChoiceGridProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T; title: string; hint: string }[]
  onChange: (v: T) => void
}

/** Two-column cards with a title and a one-line hint. */
export function ChoiceGrid<T extends string>({ label, value, options, onChange }: ChoiceGridProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={[
              'min-h-[76px] rounded-control border px-3 py-2 text-left',
              active ? 'border-accent bg-accent/15' : 'border-line bg-surface-2',
            ].join(' ')}
          >
            <span className={['block text-[15px] font-semibold', active ? 'text-accent-text' : 'text-ink-1'].join(' ')}>{o.title}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{o.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

interface TextInputProps {
  id?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  /** Unit shown inside the field on the right, for example "cm". */
  suffix?: string
  label: string
  invalid?: boolean
  inputMode?: 'decimal' | 'numeric' | 'text'
}

/** type="text" inputmode="decimal": parsed by the shared parser, which accepts a decimal comma. */
export function DecimalInput({ id, value, onChange, onBlur, placeholder, suffix, label, invalid, inputMode = 'decimal' }: TextInputProps) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={[inputClass, suffix ? 'pr-12' : '', invalid ? 'border-rose' : ''].join(' ')}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[15px] font-semibold text-ink-2">{suffix}</span>
      ) : null}
    </div>
  )
}

/** Repeats a step while a button is held: first step at once, repeats after 350 ms at 8 a second. */
function useHoldRepeat(step: () => void) {
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    if (interval.current) clearInterval(interval.current)
    timer.current = null
    interval.current = null
  }
  useEffect(() => stop, [])

  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) return
      stepRef.current()
      stop()
      timer.current = setTimeout(() => {
        interval.current = setInterval(() => stepRef.current(), 125)
      }, 350)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // Keyboard activation arrives as a click with no pointer (detail 0).
    onClick: (e: ReactMouseEvent) => {
      if (e.detail === 0) stepRef.current()
    },
  }
}

export function StepButton({ label, onStep, children, size = 'md' }: { label: string; onStep: () => void; children: ReactNode; size?: 'md' | 'lg' }) {
  const handlers = useHoldRepeat(onStep)
  return (
    <button
      type="button"
      aria-label={label}
      {...handlers}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        'flex shrink-0 select-none items-center justify-center rounded-full bg-surface-3 text-ink-1 active:bg-line-strong',
        size === 'lg' ? 'size-14' : 'size-12',
      ].join(' ')}
    >
      <span className={size === 'lg' ? 'text-[28px] font-bold leading-none' : 'text-[24px] font-bold leading-none'}>{children}</span>
    </button>
  )
}

/** [minus] value unit [plus] for small whole-step settings (protein per kg, hours, minutes). */
export function MiniStepper({
  label,
  display,
  unit,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
}: {
  label: string
  display: string
  unit?: string
  onMinus: () => void
  onPlus: () => void
  minusLabel: string
  plusLabel: string
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between gap-3">
      <StepButton label={minusLabel} onStep={onMinus}>
        <span aria-hidden="true">-</span>
      </StepButton>
      <div className="text-center">
        <span className="num text-[26px] font-bold leading-none">{display}</span>
        {unit ? <span className="ml-1 text-[15px] font-semibold text-ink-2">{unit}</span> : null}
      </div>
      <StepButton label={plusLabel} onStep={onPlus}>
        <span aria-hidden="true">+</span>
      </StepButton>
    </div>
  )
}

/** A native time field (24-hour value), 16 px text. */
export function TimeInput({ label, minute, onChange, format, parse }: { label: string; minute: number; onChange: (m: number) => void; format: (m: number) => string; parse: (s: string) => number | null }) {
  const id = useId()
  return (
    <input
      id={id}
      type="time"
      aria-label={label}
      value={format(minute)}
      onChange={(e) => {
        const m = parse(e.target.value)
        if (m !== null) onChange(m)
      }}
      className={inputClass}
    />
  )
}
