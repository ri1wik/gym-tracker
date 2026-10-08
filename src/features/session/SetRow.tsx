// One set row: grid 36 / 64 / 1fr / 1fr / 56 (set, prev, kg, reps, done),
// 56 px tall. A pending row shows last time's numbers in ink-3 so a repeat
// set is one tap on the check; the active row adds the two steppers under
// the grid; a done row is mint-soft with a filled check and shows its PR
// badge in the prev cell, off the number columns. Swipe left reveals
// Remove (the button twin lives in the card footer).

import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { ExerciseIndexEntry, WorkoutSet } from '../../domain/types'
import { stepLoad, TIME_STEP_S } from './increments'
import { loadLabel, repsLabel } from './fmt'
import { formatKg } from '../../domain/units'
import { prLabel, prShortLabel, type PrKind } from './pr'
import { Stepper } from './Stepper'
import { CheckIcon } from './ui'
import type { KeypadKind } from './Keypad'

export interface RowValues {
  load_g: number
  reps: number
  assist_g: number
}

export type RowState = 'pending' | 'active' | 'done'

export interface SetRowProps {
  entry: ExerciseIndexEntry
  set: WorkoutSet
  /** "W" for a ramp, else the working set number. */
  ordinal: string
  prev: RowValues | null
  values: RowValues
  state: RowState
  pr: PrKind | null
  popping: boolean
  mirrored: boolean
  incrementG?: number
  onSelect: () => void
  onComplete: () => void
  onCopyPrev: () => void
  onChange: (v: RowValues) => void
  onKeypad: (kind: KeypadKind) => void
  onRemove: () => void
}

export function SetRow(p: SetRowProps) {
  const { entry, set, values, state } = p
  const [swiped, setSwiped] = useState(false)
  const startX = useRef<number | null>(null)
  const moved = useRef(false)
  const isTime = entry.loadType === 'time'
  const isAssisted = entry.loadType === 'assisted'
  const warm = set.kind === 'warmup'

  const onPointerDown = (e: PointerEvent) => {
    startX.current = e.clientX
    moved.current = false
  }
  const onPointerMove = (e: PointerEvent) => {
    if (startX.current !== null && Math.abs(e.clientX - startX.current) > 10) moved.current = true
  }
  const onPointerUp = (e: PointerEvent) => {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (dx < -40) setSwiped(true)
    else if (dx > 40) setSwiped(false)
  }
  /** A drag ends in a click on the row; that click must not select, open or reset anything. */
  const swallow = useRef(false)
  const onClickCapture = (e: MouseEvent) => {
    if (moved.current) {
      moved.current = false
      swallow.current = true
      e.stopPropagation()
      e.preventDefault()
    }
  }

  const loadText = loadLabel(entry, values.load_g, values.assist_g)
  const repsText = repsLabel(entry, values.reps)
  const prevText = p.prev ? `${isTime ? '' : `${loadLabel(entry, p.prev.load_g, p.prev.assist_g)} x `}${repsLabel(entry, p.prev.reps)}` : null

  const rowTone =
    state === 'done'
      ? 'bg-mint/15 border-mint/30'
      : state === 'active'
        ? 'bg-surface-2 border-line-strong'
        : warm
          ? 'bg-surface-1 border-line opacity-70'
          : 'bg-surface-1 border-line'
  const numTone = state === 'pending' ? 'text-ink-3' : 'text-ink-1'

  const cols = p.mirrored ? 'grid-cols-[56px_1fr_1fr_64px_36px]' : 'grid-cols-[36px_64px_1fr_1fr_56px]'

  const check = (
    <button
      type="button"
      aria-label={state === 'done' ? `Set ${p.ordinal} done, tap to edit` : `Complete set ${p.ordinal}`}
      aria-pressed={state === 'done'}
      onClick={(e) => {
        e.stopPropagation()
        if (state === 'done') p.onSelect()
        else p.onComplete()
      }}
      className={[
        'flex h-14 w-14 items-center justify-center self-center rounded-control',
        state === 'done' ? 'text-on-mint' : 'text-ink-2',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-9 w-9 items-center justify-center rounded-full border-2',
          state === 'done' ? 'border-mint bg-mint' : 'border-line-strong',
          p.popping ? 'gt-pop' : '',
        ].join(' ')}
      >
        {state === 'done' && <CheckIcon size={22} />}
      </span>
    </button>
  )

  const ordinalCell = (
    <span
      className={[
        'num flex h-14 items-center justify-center text-[15px] font-semibold',
        state === 'done' ? 'text-mint-text' : warm ? 'text-ink-3' : 'text-ink-2',
      ].join(' ')}
    >
      {p.ordinal}
    </span>
  )

  // A done row no longer needs its prev column, so the PR badge takes that
  // cell and never covers the kg or reps figures read mid-set.
  const prevCell =
    state === 'done' && p.pr ? (
      <span className="flex h-14 items-center justify-center px-0.5" aria-label={prLabel(p.pr)}>
        <span className="gt-pr max-w-full truncate rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-bold uppercase text-on-mint">{prShortLabel(p.pr)}</span>
      </span>
    ) : (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (p.prev) p.onCopyPrev()
        }}
        aria-label={prevText ? `Previous ${prevText}, tap to copy` : 'No previous set'}
        className="num flex h-14 items-center justify-center truncate px-1 text-[14px] font-medium text-ink-3"
      >
        {prevText ?? (warm ? 'ramp' : 'new')}
      </button>
    )

  const loadCell = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (isTime) return
        p.onSelect()
        p.onKeypad('kg')
      }}
      aria-label={isTime ? 'Timed hold' : `${isAssisted ? 'Assistance' : 'Load'} ${loadText}, tap to type`}
      className={`num flex h-14 items-center justify-center truncate px-1 text-[22px] font-bold ${numTone}`}
    >
      {loadText}
    </button>
  )

  const repsCell = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        p.onSelect()
        p.onKeypad(isTime ? 'seconds' : 'reps')
      }}
      aria-label={`${isTime ? 'Seconds' : 'Reps'} ${repsText}, tap to type`}
      className={`num flex h-14 items-center justify-center truncate px-1 text-[22px] font-bold ${numTone}`}
    >
      {repsText}
    </button>
  )

  return (
    <div className="relative overflow-hidden rounded-[12px]" id={`set-${set.id}`}>
      <button
        type="button"
        tabIndex={swiped ? 0 : -1}
        aria-hidden={!swiped}
        onClick={() => {
          setSwiped(false)
          p.onRemove()
        }}
        className={`absolute inset-y-0 right-0 flex w-[72px] items-center justify-center rounded-control text-[15px] font-semibold text-rose-text ${swiped ? '' : 'invisible'}`}
      >
        Remove
      </button>
      <div
        className={`gt-row relative rounded-[12px] border ${rowTone}`}
        data-swiped={swiped ? '1' : '0'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startX.current = null
        }}
        onClickCapture={onClickCapture}
        onClick={() => {
          if (swallow.current) {
            swallow.current = false
            return
          }
          if (swiped) setSwiped(false)
          else if (state !== 'active') p.onSelect()
        }}
      >
        <div className={`grid ${cols} items-stretch`}>
          {p.mirrored ? (
            <>
              {check}
              {repsCell}
              {loadCell}
              {prevCell}
              {ordinalCell}
            </>
          ) : (
            <>
              {ordinalCell}
              {prevCell}
              {loadCell}
              {repsCell}
              {check}
            </>
          )}
        </div>
        {state === 'active' && (
          <div className="flex gap-2 px-2 pb-2" onClick={(e) => e.stopPropagation()}>
            {!isTime && (
              <Stepper
                label={isAssisted ? 'Assistance' : entry.loadType === 'bodyweight' ? 'Added load' : 'Load'}
                display={isAssisted ? `-${formatKg(values.assist_g)}` : entry.loadType === 'bodyweight' ? `+${formatKg(values.load_g)}` : formatKg(values.load_g)}
                minusLabel={isAssisted ? 'less assistance' : 'minus one step'}
                plusLabel={isAssisted ? 'more assistance' : 'plus one step'}
                onMinus={() =>
                  isAssisted
                    ? p.onChange({ ...values, assist_g: stepLoad(entry, values.assist_g, -1, { incrementG: p.incrementG }) })
                    : p.onChange({ ...values, load_g: stepLoad(entry, values.load_g, -1, { incrementG: p.incrementG }) })
                }
                onPlus={() =>
                  isAssisted
                    ? p.onChange({ ...values, assist_g: stepLoad(entry, values.assist_g, 1, { incrementG: p.incrementG }) })
                    : p.onChange({ ...values, load_g: stepLoad(entry, values.load_g, 1, { incrementG: p.incrementG }) })
                }
                onTap={() => p.onKeypad('kg')}
              />
            )}
            <Stepper
              label={isTime ? 'Seconds' : 'Reps'}
              display={isTime ? `${values.reps} s` : String(values.reps)}
              minusLabel={isTime ? 'minus 5 seconds' : 'minus one rep'}
              plusLabel={isTime ? 'plus 5 seconds' : 'plus one rep'}
              onMinus={() => p.onChange({ ...values, reps: Math.max(0, values.reps - (isTime ? TIME_STEP_S : 1)) })}
              onPlus={() => p.onChange({ ...values, reps: values.reps + (isTime ? TIME_STEP_S : 1) })}
              onTap={() => p.onKeypad(isTime ? 'seconds' : 'reps')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
