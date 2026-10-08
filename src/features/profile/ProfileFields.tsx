// The body, goal and schedule fields, shared by onboarding (one screen, one
// draft) and the You tab (the same fields, saved as they change).

import type { ActivityLevel, Goal, Sex, TrainingAge, Weekday } from '../../domain/types'
import { birthDateBounds, type DraftCheck, type ProfileDraft } from './draft'
import { Card, ChoiceGrid, DecimalInput, Field, Segmented, inputClass } from './controls'
import { weekdayShort } from './format'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Not stated' },
]

const ACTIVITY_OPTIONS: { value: ActivityLevel; title: string; hint: string }[] = [
  { value: 'sedentary', title: 'Sedentary', hint: 'Desk job, little training' },
  { value: 'light', title: 'Light', hint: 'On your feet some, 1 to 3 sessions' },
  { value: 'moderate', title: 'Moderate', hint: 'Desk job plus 3 to 5 sessions' },
  { value: 'active', title: 'Active', hint: 'Physical job plus regular training' },
]

const GOAL_OPTIONS: { value: Goal; title: string; hint: string }[] = [
  { value: 'recomp', title: 'Recomposition', hint: 'Lose fat, keep and build muscle' },
  { value: 'fat_loss', title: 'Fat loss', hint: 'A steady deficit, strength held' },
  { value: 'lean_gain', title: 'Lean gain', hint: 'A small surplus to build' },
  { value: 'maintain', title: 'Maintain', hint: 'Hold weight, keep training' },
]

const TRAINING_AGE_OPTIONS: { value: TrainingAge; label: string }[] = [
  { value: 'beginner', label: 'Under 1 yr' },
  { value: 'intermediate', label: '1 to 3 yrs' },
  { value: 'advanced', label: '3+ yrs' },
]

const DAYS_OPTIONS = [2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))

const WEEKDAY_OPTIONS = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((w) => ({ value: w, label: weekdayShort(w) }))

export interface ProfileFieldsProps {
  draft: ProfileDraft
  check: DraftCheck
  today: string
  onChange: (patch: Partial<ProfileDraft>) => void
  /** Called when a discrete choice changes or a typed field loses focus. The You tab saves here. */
  onCommit?: (next: ProfileDraft) => void
  /** Onboarding asks for today's weight; the You tab shows it from the last check-in instead. */
  weightField: 'input' | 'none'
}

export function ProfileFields({ draft, check, today, onChange, onCommit, weightField }: ProfileFieldsProps) {
  const bounds = birthDateBounds(today)
  const choose = <K extends keyof ProfileDraft>(key: K) => (value: ProfileDraft[K]) => {
    onChange({ [key]: value } as Partial<ProfileDraft>)
    onCommit?.({ ...draft, [key]: value })
  }
  const blur = () => onCommit?.(draft)

  return (
    <>
      <Card title="About you">
        <Field label="Sex" hint="Used only in the basal rate formula. Not stated averages the two formulas.">
          <Segmented label="Sex" value={draft.sex} options={SEX_OPTIONS} onChange={choose('sex')} />
        </Field>
        <Field label="Birth date" error={check.problems.birthDate}>
          <input
            type="date"
            aria-label="Birth date"
            value={draft.birthDate}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => onChange({ birthDate: e.target.value })}
            onBlur={blur}
            className={`${inputClass} appearance-none`}
          />
        </Field>
        <Field label="Height" error={check.problems.heightCm}>
          <DecimalInput
            label="Height in centimetres"
            value={draft.heightCm}
            onChange={(v) => onChange({ heightCm: v })}
            onBlur={blur}
            suffix="cm"
            placeholder="170"
            invalid={Boolean(check.problems.heightCm)}
          />
        </Field>
        {weightField === 'input' ? (
          <Field label="Weight today" hint="Your first check-in. Morning, before food, is best." error={check.problems.weightKg}>
            <DecimalInput
              label="Weight in kilograms"
              value={draft.weightKg}
              onChange={(v) => onChange({ weightKg: v })}
              onBlur={blur}
              suffix="kg"
              placeholder="70.0"
              invalid={Boolean(check.problems.weightKg)}
            />
          </Field>
        ) : null}
      </Card>

      <Card title="Activity">
        <p className="text-[14px] text-ink-2">Count your whole week, training included.</p>
        <ChoiceGrid label="Activity level" value={draft.activity} options={ACTIVITY_OPTIONS} onChange={choose('activity')} />
      </Card>

      <Card title="Goal">
        <ChoiceGrid label="Goal" value={draft.goal} options={GOAL_OPTIONS} onChange={choose('goal')} />
        <Field label="Training experience">
          <Segmented label="Training experience" value={draft.trainingAge} options={TRAINING_AGE_OPTIONS} onChange={choose('trainingAge')} />
        </Field>
      </Card>

      <Card title="Your week">
        <Field label="Training days per week">
          <Segmented label="Training days per week" value={draft.daysPerWeek} options={DAYS_OPTIONS} onChange={choose('daysPerWeek')} />
        </Field>
        <Field label="Weekly review day" hint="Your numbers are read together once a week, on this day.">
          <Segmented label="Weekly review day" value={draft.reviewWeekday} options={WEEKDAY_OPTIONS} onChange={choose('reviewWeekday')} />
        </Field>
      </Card>
    </>
  )
}
