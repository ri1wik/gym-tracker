import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PATHS } from '../../app/paths'
import { todayKey } from '../../domain/dates'
import { parseKgToG, parseCmToMm } from '../../domain/parse'
import type { Goal, Profile, WeighIn } from '../../domain/types'
import { Card, DecimalInput, Field, StepButton, ghostButtonClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../profile/controls'
import { currentDb, currentUserId } from '../profile/current'
import { formatDayShort, formatSignedCm, formatSignedKg, kg1 } from '../profile/format'
import { getReminderMinute } from '../profile/reminder'
import { useProfile, useWeighIns } from '../profile/repo'
import { downloadCheckinCalendar } from './download'
import { buildMiniRead, waistIsDue, type MiniRead } from './miniRead'
import { saveWeighIn } from './write'
import { MAX_G, MIN_G, STEP_G, stepKgText } from './weightStep'

type Step = 'weight' | 'photos' | 'read'

export function CheckinScreen() {
  const profile = useProfile()
  const weighIns = useWeighIns()
  if (profile === undefined || weighIns === undefined) return null
  return <CheckinFlow profile={profile} weighIns={weighIns} />
}

function CheckinFlow({ profile, weighIns }: { profile: Profile | null; weighIns: WeighIn[] }) {
  const navigate = useNavigate()
  const today = useMemo(() => todayKey(), [])
  const goal: Goal = profile?.goal ?? 'recomp'
  const interval = profile?.checkin_interval_days ?? 4

  const todays = weighIns.find((w) => w.date_key === today) ?? null
  const earlier = weighIns.filter((w) => w.date_key < today)
  const last = earlier[earlier.length - 1] ?? null
  const seed = todays ?? last
  const lastWaist = [...weighIns].reverse().find((w) => w.waist_mm !== null) ?? null
  const waistDue = useMemo(() => waistIsDue(weighIns, today), [weighIns, today])

  const [step, setStep] = useState<Step>('weight')
  const [weightText, setWeightText] = useState(seed ? kg1(seed.weight_g) : '')
  const [sameConditions, setSameConditions] = useState(todays?.same_conditions ?? true)
  const [waistOpen, setWaistOpen] = useState(waistDue || todays?.waist_mm != null)
  const [waistText, setWaistText] = useState(todays?.waist_mm != null ? String(todays.waist_mm / 10) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mini, setMini] = useState<MiniRead | null>(null)

  const weightG = parseKgToG(weightText)
  const weightOk = weightG !== null && weightG >= MIN_G && weightG <= MAX_G
  const waistMm = waistOpen && waistText.trim() !== '' ? parseCmToMm(waistText) : null
  const waistOk = !waistOpen || waistText.trim() === '' || (waistMm !== null && waistMm >= 400 && waistMm <= 2000)

  const save = async () => {
    if (!weightOk || !waistOk || saving || weightG === null) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveWeighIn(currentDb(), currentUserId(), {
        date_key: today,
        weight_g: Math.round(weightG / STEP_G) * STEP_G,
        waist_mm: waistOpen ? waistMm : undefined,
        same_conditions: sameConditions,
      })
      const readings = [...weighIns.filter((w) => w.date_key !== today), saved]
      setMini(buildMiniRead({ readings, dateKey: today, goal, intervalDays: interval }))
      setStep('photos')
    } catch {
      setError('Could not save on this device. Tap Save again; if it repeats, free some storage and reload.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Check-in</h1>
          <span className="text-[14px] font-semibold text-ink-2">
            Step <span className="num">{step === 'weight' ? 1 : step === 'photos' ? 2 : 3}</span> of <span className="num">3</span>
          </span>
        </div>
        <p className="text-[15px] text-ink-2">{formatDayShort(today)}</p>
      </header>

      {step === 'weight' ? (
        <>
          <Card>
            <div className={labelClass}>Weight</div>
            <div className="flex items-center justify-between gap-2">
              <StepButton size="lg" label="Lower weight by 0.1 kilograms" onStep={() => setWeightText((t) => stepKgText(t, -STEP_G))}>
                <span aria-hidden="true">-</span>
              </StepButton>
              <label className="flex min-w-0 flex-1 flex-col items-center">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="Weight in kilograms"
                  aria-invalid={weightText !== '' && !weightOk ? true : undefined}
                  placeholder="0.0"
                  value={weightText}
                  onChange={(e) => setWeightText(e.target.value)}
                  onBlur={() => {
                    if (weightOk) setWeightText(kg1(Math.round((weightG as number) / STEP_G) * STEP_G))
                  }}
                  className="num h-16 w-full min-w-0 rounded-control bg-transparent text-center text-[56px]! font-extrabold! leading-none! tracking-tight text-ink-1! placeholder:text-ink-3"
                />
                <span className="text-[15px] font-semibold text-ink-2">kg</span>
              </label>
              <StepButton size="lg" label="Raise weight by 0.1 kilograms" onStep={() => setWeightText((t) => stepKgText(t, STEP_G))}>
                <span aria-hidden="true">+</span>
              </StepButton>
            </div>
            {weightText !== '' && !weightOk ? (
              <p role="alert" className="text-[14px] font-medium text-rose-text">
                Enter your weight in kg, between 30 and 300.
              </p>
            ) : last && !todays ? (
              <p className="text-[14px] text-ink-2">
                Last reading <span className="num font-semibold text-ink-1">{kg1(last.weight_g)} kg</span> on {formatDayShort(last.date_key)}
              </p>
            ) : todays ? (
              <p className="text-[14px] text-ink-2">Today is already logged. Saving again updates it.</p>
            ) : (
              <p className="text-[14px] text-ink-2">Type your weight, or use the buttons to move in 0.1 kg steps.</p>
            )}
          </Card>

          <button
            type="button"
            role="switch"
            aria-checked={sameConditions}
            onClick={() => setSameConditions((v) => !v)}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-card border border-line bg-surface-1 px-4 py-2 text-left"
          >
            <span>
              <span className="block text-[16px] font-semibold">Same conditions</span>
              <span className="block text-[14px] text-ink-2">Morning, after the toilet, before food, same scale</span>
            </span>
            <span
              aria-hidden="true"
              className={['flex h-8 w-14 shrink-0 items-center rounded-full p-1', sameConditions ? 'bg-accent' : 'bg-surface-3'].join(' ')}
            >
              <span className={['size-6 rounded-full transition-transform', sameConditions ? 'translate-x-6 bg-on-accent' : 'bg-ink-2'].join(' ')} />
            </span>
          </button>

          {waistOpen ? (
            <Card>
              <Field
                label="Waist (optional)"
                hint={lastWaist?.waist_mm != null ? `Last waist ${formatCm1(lastWaist.waist_mm)} cm on ${formatDayShort(lastWaist.date_key)}. At the navel, relaxed, after breathing out.` : 'At the navel, relaxed, after breathing out.'}
                error={!waistOk ? 'Enter your waist in cm, between 40 and 200, or clear the field.' : null}
              >
                <DecimalInput label="Waist in centimetres" value={waistText} onChange={setWaistText} suffix="cm" placeholder={lastWaist?.waist_mm != null ? formatCm1(lastWaist.waist_mm) : '80.0'} invalid={!waistOk} />
              </Field>
            </Card>
          ) : (
            <button type="button" className={secondaryButtonClass} onClick={() => setWaistOpen(true)}>
              Add waist (optional)
            </button>
          )}

          {error ? (
            <p role="alert" className="text-[14px] font-medium text-rose-text">
              {error}
            </p>
          ) : null}
          <button type="button" className={primaryButtonClass} disabled={!weightOk || !waistOk || saving} onClick={save}>
            {saving ? 'Saving' : 'Save weight'}
          </button>
        </>
      ) : null}

      {step === 'photos' ? (
        <>
          <Card>
            <h2 className="text-[20px] font-semibold leading-snug">Photos arrive in the next update</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">
              Front and side photos, with a ghost of your last one to match your stance, will join this step. Your weight is saved; there is nothing to do here yet.
            </p>
          </Card>
          <button type="button" className={primaryButtonClass} onClick={() => setStep('read')}>
            Skip photos
          </button>
        </>
      ) : null}

      {step === 'read' && mini ? <MiniReadView mini={mini} interval={interval} onDone={() => navigate(PATHS.home)} /> : null}
    </section>
  )
}

function formatCm1(mm: number): string {
  return (mm / 10).toFixed(1)
}

function MiniReadView({ mini, interval, onDone }: { mini: MiniRead; interval: number; onDone: () => void }) {
  const t = mini.trendRead
  const collecting = t.collecting
  const shown = collecting ? Math.min(collecting.count, collecting.expected) : 0
  const pct = collecting ? Math.round((shown / collecting.expected) * 100) : 0
  return (
    <>
      <Card>
        <div className={labelClass}>Since your last reading</div>
        {mini.deltaG !== null && mini.previous ? (
          <div className="flex items-baseline gap-2">
            <span className="num text-[56px] font-extrabold leading-none tracking-tight">{formatSignedKg(mini.deltaG)}</span>
            <span className="text-[17px] font-semibold text-ink-2">kg</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="num text-[56px] font-extrabold leading-none tracking-tight">{kg1(mini.weightG)}</span>
            <span className="text-[17px] font-semibold text-ink-2">kg</span>
          </div>
        )}
        <p className="text-[15px] text-ink-2">
          {mini.previous ? (
            <>
              Now <span className="num font-semibold text-ink-1">{kg1(mini.weightG)} kg</span>, was <span className="num">{kg1(mini.previous.weight_g)} kg</span> on {formatDayShort(mini.previous.date_key)}
            </>
          ) : (
            'Your first reading. The next one, in a few days, gives the first change.'
          )}
        </p>
        {mini.waistDeltaMm !== null ? (
          <p className="text-[15px] text-ink-2">
            Waist <span className="num font-semibold text-ink-1">{formatSignedCm(mini.waistDeltaMm)} cm</span> since your last waist reading
          </p>
        ) : null}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className={labelClass}>Trend</div>
          {t.tone === 'attention' ? (
            <span className="rounded-full bg-rose/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-rose-text">Needs attention</span>
          ) : t.tone === 'positive' ? (
            <span className="rounded-full bg-mint/15 px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-mint-text">On plan</span>
          ) : null}
        </div>
        <p className="text-[18px] font-semibold leading-snug">{t.headline}</p>
        {t.detail ? <p className="text-[15px] leading-relaxed text-ink-2">{t.detail}</p> : null}
        {collecting ? (
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${shown} of ${collecting.expected} readings`}>
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[14px] font-semibold text-ink-2">
              Collecting: <span className="num">{shown}</span> of <span className="num">{collecting.expected}</span> readings
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className={labelClass}>Next check-in</div>
        <p className="num text-[28px] font-bold leading-tight">{formatDayShort(mini.nextCheckin)}</p>
        <p className="text-[14px] text-ink-2">
          In <span className="num">{interval}</span> days. Mornings, same conditions.
        </p>
        <button type="button" className={secondaryButtonClass} onClick={() => downloadCheckinCalendar(mini.nextCheckin, interval, getReminderMinute())}>
          Add reminders to my calendar
        </button>
      </Card>

      <button type="button" className={primaryButtonClass} onClick={onDone}>
        Done
      </button>
      <div className="flex justify-center">
        <Link to={PATHS.progress} className={ghostButtonClass}>
          See progress
        </Link>
      </div>
    </>
  )
}
