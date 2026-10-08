import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStoredTheme, setTheme, type Theme } from '../../app/theme'
import { PATHS } from '../../app/paths'
import { todayKey } from '../../domain/dates'
import type { Profile, WeighIn } from '../../domain/types'
import { AccountSection } from '../auth/AccountSection'
import { currentDb, currentUserId } from '../profile/current'
import { Card, Field, MiniStepper, Segmented, TimeInput, cardClass, labelClass, primaryButtonClass } from '../profile/controls'
import { draftToProfilePatch, evaluateDraft, profileToDraft, type ProfileDraft } from '../profile/draft'
import { WEEKDAYS_LONG, formatDayShort, formatMinuteOfDay, kg1, parseTimeInput } from '../profile/format'
import { ProfileFields } from '../profile/ProfileFields'
import { getReminderMinute, setReminderMinute } from '../profile/reminder'
import { saveProfile, useProfile, useWeighIns } from '../profile/repo'
import { TargetsCard } from '../profile/TargetsCard'
import { SyncStatus } from '../sync/SyncStatus'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

export function YouTab() {
  const profile = useProfile()
  const weighIns = useWeighIns()
  if (profile === undefined || weighIns === undefined) return null
  return (
    <section className="space-y-4">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">You</h1>
      {profile === null || !profile.onboarding_done ? <SetupCard /> : <ProfileSection key={profile.id} profile={profile} weighIns={weighIns} />}
      <ThemeCard />
      <SyncStatus variant="compact" />
      <AccountSection />
      <Credits />
    </section>
  )
}

function SetupCard() {
  return (
    <Card title="Profile">
      <p className="text-[15px] leading-relaxed text-ink-2">Set up your profile to see your calorie and protein targets. It takes about a minute.</p>
      <Link to={PATHS.onboarding} className={primaryButtonClass}>
        Set up my profile
      </Link>
    </Card>
  )
}

function ProfileSection({ profile, weighIns }: { profile: Profile; weighIns: WeighIn[] }) {
  const today = useMemo(() => todayKey(), [])
  const latest = weighIns[weighIns.length - 1] ?? null
  const [draft, setDraft] = useState<ProfileDraft>(() => profileToDraft(profile, latest?.weight_g ?? null))
  const [name, setName] = useState(profile.display_name)
  const [reminder, setReminder] = useState(() => getReminderMinute())

  const { check, targets } = useMemo(() => evaluateDraft(draft, today), [draft, today])

  const save = (next: ProfileDraft) => {
    const e = evaluateDraft(next, today)
    // Only write what parses; a half-typed height never reaches the row.
    const patch = draftToProfilePatch(next, e.check.parsed)
    if (!e.check.parsed.birthDate) delete patch.birth_date
    if (!e.check.parsed.heightMm) delete patch.height_mm
    if (e.check.problems.calorieOverride) delete patch.calorie_override_kcal
    void saveProfile(currentDb(), currentUserId(), patch)
  }

  const patchDraft = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }))

  return (
    <>
      <Card title="Profile">
        <Field label="Name" hint="Shown to you only.">
          <input
            type="text"
            aria-label="Name"
            autoComplete="given-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveProfile(currentDb(), currentUserId(), { display_name: name.trim() })}
            className="h-12 w-full rounded-control border border-line-strong bg-surface-2 px-3 text-[18px]! font-semibold! text-ink-1!"
          />
        </Field>
        <div className="rounded-control bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold">Weight</div>
              <div className="text-[14px] text-ink-2">{latest ? `${formatDayShort(latest.date_key)} check-in` : 'No reading yet'}</div>
            </div>
            {latest ? (
              <span className="num text-[22px] font-bold">
                {kg1(latest.weight_g)} <span className="text-[15px] font-semibold text-ink-2">kg</span>
              </span>
            ) : null}
          </div>
          <Link to={PATHS.checkin} className="mt-1 flex h-11 items-center text-[15px] font-semibold text-accent-text">
            {latest ? 'Log a check-in' : 'Log your first weigh-in'}
          </Link>
        </div>
      </Card>

      <ProfileFields draft={draft} check={check} today={today} onChange={patchDraft} onCommit={save} weightField="none" />

      <TargetsCard
        targets={targets}
        missing={latest ? 'Add your birth date and height above to see targets.' : 'Log your first weigh-in to see targets.'}
        proteinDgPerKg={draft.proteinDgPerKg}
        onProteinChange={(dg) => {
          patchDraft({ proteinDgPerKg: dg })
          save({ ...draft, proteinDgPerKg: dg })
        }}
        calorieOverride={draft.calorieOverride}
        onCalorieOverrideChange={(v) => patchDraft({ calorieOverride: v })}
        onCalorieOverrideCommit={() => save(draft)}
        overrideError={check.problems.calorieOverride}
      />

      <MoreSettings profile={profile} reminder={reminder} onReminder={(m) => { setReminder(m); setReminderMinute(m) }} />
    </>
  )
}

const REFERENCE_OPTIONS = [
  { value: 'nin' as const, label: 'ICMR-NIN' },
  { value: 'dri' as const, label: 'US DRI' },
]

const WEEK_START_OPTIONS = [
  { value: 1 as const, label: 'Monday' },
  { value: 0 as const, label: 'Sunday' },
  { value: 6 as const, label: 'Saturday' },
]

function MoreSettings({ profile, reminder, onReminder }: { profile: Profile; reminder: number; onReminder: (m: number) => void }) {
  const [cardioMin, setCardioMin] = useState(Math.round(profile.cardio_target_s / 60))
  const [sleepMin, setSleepMin] = useState<number | null>(profile.sleep_min)
  const [weekStart, setWeekStart] = useState(profile.week_starts_on)
  const [reference, setReference] = useState(profile.reference_intakes)
  const [reviewMinute, setReviewMinute] = useState(profile.review_minute_of_day)

  const commit = (patch: Parameters<typeof saveProfile>[2]) => void saveProfile(currentDb(), currentUserId(), patch)
  const sleepDisplay = sleepMin === null ? 'Not set' : `${Math.floor(sleepMin / 60)}h ${String(sleepMin % 60).padStart(2, '0')}`

  return (
    <Card title="Schedule and settings">
      <Field label="Weekly review time" hint={`The review runs on ${WEEKDAYS_LONG[profile.review_weekday]}s. Change the day above.`}>
        <TimeInput
          label="Weekly review time"
          minute={reviewMinute}
          onChange={(m) => {
            setReviewMinute(m)
            commit({ review_minute_of_day: m })
          }}
          format={formatMinuteOfDay}
          parse={parseTimeInput}
        />
      </Field>
      <Field label="Check-in reminder time" hint="Used for the calendar file offered after each check-in. Stored on this device.">
        <TimeInput label="Check-in reminder time" minute={reminder} onChange={onReminder} format={formatMinuteOfDay} parse={parseTimeInput} />
      </Field>
      <Field label="Week starts on">
        <Segmented
          label="Week starts on"
          value={weekStart}
          options={WEEK_START_OPTIONS}
          onChange={(v) => {
            setWeekStart(v)
            commit({ week_starts_on: v })
          }}
        />
      </Field>
      <Field label="Weekly cardio target" hint="Minutes of running and incline walking. 150 is the default; 90 to 300 is the usual band.">
        <MiniStepper
          label="Weekly cardio minutes"
          display={String(cardioMin)}
          unit="min"
          minusLabel="Lower the cardio target by 15 minutes"
          plusLabel="Raise the cardio target by 15 minutes"
          onMinus={() => {
            const v = Math.max(30, cardioMin - 15)
            setCardioMin(v)
            commit({ cardio_target_s: v * 60 })
          }}
          onPlus={() => {
            const v = Math.min(420, cardioMin + 15)
            setCardioMin(v)
            commit({ cardio_target_s: v * 60 })
          }}
        />
      </Field>
      <Field label="Typical sleep" hint="Short sleep makes the planner ease volume. Leave it unset if you would rather not say.">
        <MiniStepper
          label="Typical sleep"
          display={sleepDisplay}
          minusLabel="Lower typical sleep by 15 minutes"
          plusLabel="Raise typical sleep by 15 minutes"
          onMinus={() => {
            const v = Math.max(240, (sleepMin ?? 420) - 15)
            setSleepMin(v)
            commit({ sleep_min: v })
          }}
          onPlus={() => {
            const v = Math.min(660, (sleepMin ?? 420) + 15)
            setSleepMin(v)
            commit({ sleep_min: v })
          }}
        />
      </Field>
      <Field label="Nutrient reference values" hint="Which daily intakes the food panel compares against.">
        <Segmented
          label="Nutrient reference values"
          value={reference}
          options={REFERENCE_OPTIONS}
          onChange={(v) => {
            setReference(v)
            commit({ reference_intakes: v })
          }}
        />
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-control bg-surface-2 px-3 py-3">
        <span className="text-[15px] font-semibold">Units</span>
        <span className="text-[15px] text-ink-2">Kilograms, centimetres, kilometres</span>
      </div>
    </Card>
  )
}

function ThemeCard() {
  const [theme, setLocal] = useState<Theme>(() => getStoredTheme())
  return (
    <div className={cardClass}>
      <div className={labelClass}>Theme</div>
      <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const active = theme === t.value
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setTheme(t.value)
                setLocal(t.value)
              }}
              className={[
                'h-11 flex-1 rounded-control border text-[15px]! font-semibold!',
                active ? 'border-accent bg-accent/15 text-accent-text!' : 'border-line bg-surface-2 text-ink-2!',
              ].join(' ')}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Credits() {
  return (
    <div className="space-y-2 pb-2">
      <p className="text-[13px] leading-relaxed text-ink-2">
        General fitness information, not medical advice. See a professional if you are pregnant, under 18, on medication that affects weight, or have a history of disordered eating.
      </p>
      <p className="text-[13px] leading-relaxed text-ink-2">
        Exercise illustrations by{' '}
        <a className="underline" href="https://repdb.co" rel="noreferrer">
          RepDB (repdb.co)
        </a>
        . Food composition data from USDA FoodData Central.
      </p>
    </div>
  )
}
