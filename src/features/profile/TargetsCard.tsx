// Live targets: calories (the suggestion with an override), protein with its
// grams-per-kg stepper, and the numbers behind them. Shown on onboarding and
// on the You tab; both feed it the same inputs.

import { useState } from 'react'
import { Card, DecimalInput, Field, MiniStepper, labelClass, secondaryButtonClass } from './controls'
import type { LiveTargets } from './liveTargets'

export const DISCLAIMER =
  'General fitness information, not medical advice. See a professional if you are pregnant, under 18, on medication that affects weight, or have a history of disordered eating.'

interface Props {
  targets: LiveTargets | null
  /** Why there are no numbers yet, as an action. */
  missing: string | null
  proteinDgPerKg: number
  onProteinChange: (dg: number) => void
  calorieOverride: string
  onCalorieOverrideChange: (v: string) => void
  onCalorieOverrideCommit?: () => void
  overrideError?: string | null
  title?: string
}

export function TargetsCard({
  targets,
  missing,
  proteinDgPerKg,
  onProteinChange,
  calorieOverride,
  onCalorieOverrideChange,
  onCalorieOverrideCommit,
  overrideError,
  title = 'Your targets',
}: Props) {
  const [ownNumber, setOwnNumber] = useState(calorieOverride.trim() !== '')

  if (!targets) {
    return (
      <Card title={title}>
        <p className="text-[15px] leading-relaxed text-ink-2">{missing ?? 'Fill in the details above to see your targets.'}</p>
      </Card>
    )
  }

  const weekly = Math.abs(targets.weeklyChangeG) / 1000
  const direction = targets.weeklyChangeG < 0 ? 'down' : targets.weeklyChangeG > 0 ? 'up' : 'steady'

  return (
    <Card title={title}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>Calories</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-[40px] font-bold leading-none tracking-tight">{targets.targetKcal}</span>
            <span className="text-[15px] font-semibold text-ink-2">kcal</span>
          </div>
          <div className="mt-1 text-[14px] text-ink-2">{targets.overridden ? 'Your own number' : 'Suggested'}</div>
        </div>
        <div>
          <div className={labelClass}>Protein</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-[40px] font-bold leading-none tracking-tight">{targets.proteinG}</span>
            <span className="text-[15px] font-semibold text-ink-2">g</span>
          </div>
          <div className="mt-1 text-[14px] text-ink-2">
            <span className="num">{(proteinDgPerKg / 10).toFixed(1)}</span> g per kg
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-control bg-surface-2 px-2 py-2">
          <dt className="text-[12px] font-semibold text-ink-3">Basal rate</dt>
          <dd className="num text-[17px] font-bold">{Math.round(targets.bmr)}</dd>
        </div>
        <div className="rounded-control bg-surface-2 px-2 py-2">
          <dt className="text-[12px] font-semibold text-ink-3">Maintenance</dt>
          <dd className="num text-[17px] font-bold">{Math.round(targets.tdee)}</dd>
        </div>
        <div className="rounded-control bg-surface-2 px-2 py-2">
          <dt className="text-[12px] font-semibold text-ink-3">Per week</dt>
          <dd className="num text-[17px] font-bold">
            {direction === 'steady' ? '0.0' : `${direction === 'down' ? '-' : '+'}${weekly.toFixed(2)}`}
            <span className="ml-0.5 text-[12px] font-semibold text-ink-2">kg</span>
          </dd>
        </div>
      </dl>

      {targets.floored && !targets.overridden ? (
        <p className="text-[14px] text-ink-2">
          The suggestion sits at the safe floor for your body, <span className="num">{targets.suggestedKcal}</span> kcal. Add a walk instead of eating less.
        </p>
      ) : null}

      <Field
        label="Protein per kg of body weight"
        hint={
          targets.proteinOnCappedWeight
            ? 'Worked out on a reference weight capped at BMI 30 for your height. Range 1.6 to 2.4.'
            : 'Range 1.6 to 2.4. Protein stays put when calories change.'
        }
      >
        <MiniStepper
          label="Protein per kilogram"
          display={(proteinDgPerKg / 10).toFixed(1)}
          unit="g per kg"
          minusLabel="Lower protein by 0.1 grams per kilogram"
          plusLabel="Raise protein by 0.1 grams per kilogram"
          onMinus={() => onProteinChange(Math.max(16, proteinDgPerKg - 1))}
          onPlus={() => onProteinChange(Math.min(24, proteinDgPerKg + 1))}
        />
      </Field>

      {ownNumber ? (
        <>
          <Field
            label="Your own calorie number"
            error={overrideError}
            hint={`The suggestion is ${targets.suggestedKcal} kcal. Lowest accepted: ${targets.lowestSafeKcal} kcal.`}
          >
            <DecimalInput
              label="Calorie target override in kcal"
              value={calorieOverride}
              onChange={onCalorieOverrideChange}
              onBlur={onCalorieOverrideCommit}
              suffix="kcal"
              inputMode="numeric"
              placeholder={String(targets.suggestedKcal)}
              invalid={Boolean(overrideError)}
            />
          </Field>
          <button
            type="button"
            className="flex h-11 items-center text-[15px]! font-semibold! text-accent-text!"
            onClick={() => {
              onCalorieOverrideChange('')
              setOwnNumber(false)
              onCalorieOverrideCommit?.()
            }}
          >
            Use the suggestion instead
          </button>
        </>
      ) : (
        <button type="button" className={secondaryButtonClass} onClick={() => setOwnNumber(true)}>
          Use my own calorie number
        </button>
      )}

      <p className="text-[13px] leading-relaxed text-ink-2">
        Maintenance is an estimate with a 10 to 15 percent typical error; your weight trend is the correction. {DISCLAIMER}
      </p>
    </Card>
  )
}
