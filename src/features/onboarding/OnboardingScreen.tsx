import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PATHS } from '../../app/paths'
import { todayKey } from '../../domain/dates'
import { saveWeighIn } from '../checkin/write'
import { Card, Field, TimeInput, primaryButtonClass } from '../profile/controls'
import { currentDb, currentUserId } from '../profile/current'
import { DEFAULT_DRAFT, draftToProfilePatch, evaluateDraft, nextMissing, profileToDraft, type ProfileDraft } from '../profile/draft'
import { formatMinuteOfDay, parseTimeInput } from '../profile/format'
import { ProfileFields } from '../profile/ProfileFields'
import { getReminderMinute, setReminderMinute } from '../profile/reminder'
import { saveProfile, useProfile, useWeighIns } from '../profile/repo'
import { TargetsCard } from '../profile/TargetsCard'
import type { Profile, WeighIn } from '../../domain/types'

export const EXPECTATION_LINE = 'Strength shows in 3 to 4 weeks, the mirror in 8 to 12, the scale is not the scoreboard.'

// One screen: the profile in six short groups, live targets under it, one
// button at the thumb. The same fields are editable later on the You tab.
export function OnboardingScreen() {
  const profile = useProfile()
  const weighIns = useWeighIns()
  if (profile === undefined || weighIns === undefined) return null
  return <OnboardingForm profile={profile} weighIns={weighIns} />
}

function OnboardingForm({ profile, weighIns }: { profile: Profile | null; weighIns: WeighIn[] }) {
  const navigate = useNavigate()
  const today = useMemo(() => todayKey(), [])
  const lastWeight = weighIns.length > 0 ? weighIns[weighIns.length - 1].weight_g : null
  const [draft, setDraft] = useState<ProfileDraft>(() => (profile ? profileToDraft(profile, lastWeight) : DEFAULT_DRAFT))
  const [reminder, setReminder] = useState(() => getReminderMinute())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { check, targets } = useMemo(() => evaluateDraft(draft, today), [draft, today])
  const missing = nextMissing(check, true)

  const patch = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }))

  const start = async () => {
    if (missing || saving || check.parsed.weightG === null) return
    setSaving(true)
    setSaveError(null)
    try {
      const db = currentDb()
      const uid = currentUserId()
      await saveProfile(db, uid, { ...draftToProfilePatch(draft, check.parsed), onboarding_done: true })
      await saveWeighIn(db, uid, { date_key: today, weight_g: check.parsed.weightG, same_conditions: true })
      setReminderMinute(reminder)
      navigate(PATHS.home, { replace: true })
    } catch {
      setSaving(false)
      setSaveError('Could not save on this device. Tap Start again; if it repeats, free some storage and reload.')
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-screen-sm px-4 pt-[max(1rem,env(safe-area-inset-top))] text-ink-1">
      <header className="space-y-3 pb-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Welcome</h1>
        <p className="text-[16px] leading-relaxed text-ink-2">One screen, about a minute. You can change every answer later on the You tab.</p>
        <div className="rounded-card border border-line border-l-[3px] border-l-accent bg-surface-1 p-4">
          <p className="text-[16px] font-semibold leading-snug">{EXPECTATION_LINE}</p>
        </div>
      </header>

      <div className="space-y-3">
        <ProfileFields draft={draft} check={check} today={today} onChange={patch} weightField="input" />

        <Card title="Check-in reminder">
          <Field label="Time of day" hint="A check-in is due every 4 days. After each one you can add the next dates to your calendar at this time.">
            <TimeInput label="Check-in reminder time" minute={reminder} onChange={setReminder} format={formatMinuteOfDay} parse={parseTimeInput} />
          </Field>
        </Card>

        <TargetsCard
          targets={targets}
          missing={missing}
          proteinDgPerKg={draft.proteinDgPerKg}
          onProteinChange={(dg) => patch({ proteinDgPerKg: dg })}
          calorieOverride={draft.calorieOverride}
          onCalorieOverrideChange={(v) => patch({ calorieOverride: v })}
          overrideError={check.problems.calorieOverride}
          title="Suggested targets"
        />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-bg/92 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        {missing ? <p className="mb-2 text-[14px] font-medium text-ink-2">{missing}</p> : null}
        {saveError ? (
          <p role="alert" className="mb-2 text-[14px] font-medium text-rose-text">
            {saveError}
          </p>
        ) : null}
        <button type="button" className={primaryButtonClass} disabled={missing !== null || saving} onClick={start}>
          {saving ? 'Saving' : 'Save and start'}
        </button>
      </div>
    </main>
  )
}
