// Tap the number: a sheet with one text input (inputmode decimal, never under
// 16 px) parsed by the shared parser, which accepts a decimal comma.

import { useEffect, useRef, useState } from 'react'
import { parseInteger, parseKgToG } from '../../domain/parse'
import { formatKg } from '../../domain/units'
import { Sheet } from './ui'

export type KeypadKind = 'kg' | 'reps' | 'seconds'

export interface KeypadProps {
  kind: KeypadKind
  label: string
  /** Grams for kg, a count for reps and seconds. */
  value: number
  onSubmit: (value: number) => void
  onClose: () => void
}

export function Keypad({ kind, label, value, onSubmit, onClose }: KeypadProps) {
  const [text, setText] = useState(() => (kind === 'kg' ? formatKg(value) : String(value)))
  const [bad, setBad] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const submit = () => {
    const n = kind === 'kg' ? parseKgToG(text) : parseInteger(text)
    if (n === null || n < 0) {
      setBad(true)
      return
    }
    onSubmit(n)
  }
  const unit = kind === 'kg' ? 'kg' : kind === 'seconds' ? 's' : 'reps'
  return (
    <Sheet title={label} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="sr-only">{label}</span>
          <div className="flex h-14 items-center rounded-control border border-line-strong bg-surface-1 px-4">
            <input
              ref={ref}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={bad || undefined}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setBad(false)
              }}
              className="num h-full min-w-0 flex-1 bg-transparent text-[28px] font-bold outline-none"
            />
            <span className="text-[17px] font-semibold text-ink-2">{unit}</span>
          </div>
        </label>
        {bad && <p className="text-[14px] font-medium text-rose-text">Type a number, for example 62.5 or 62,5.</p>}
        <button type="submit" className="flex h-14 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent">
          Done
        </button>
      </form>
    </Sheet>
  )
}
