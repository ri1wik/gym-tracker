import { useEffect, useRef, useState } from 'react'
import type { Recommendation } from '../../../domain/programs/recommender'
import type { SessionMinutes } from '../../../domain/planner/index'
import { MUSCLE_GROUPS, type MuscleGroup, type Profile, type Template } from '../../../domain/types'
import { recommend } from './adapter'
import { deficitFractionOf } from './store'
import { TEMPLATE_LIST, templateByKey } from './templates'
import { chipClass, PRIMARY_BUTTON, SECONDARY_BUTTON } from './ui'

// The change-split flow: three questions (days, session length, priority
// muscle), the recommender's pick with its reason and two alternatives, and a
// list of all five splits. While the recommender is a stub the sheet goes
// straight from the questions to the list.

export const GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  lats: 'Lats',
  upper_back: 'Upper back',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Abs',
}

const DAYS = [2, 3, 4, 5, 6] as const
const MINUTES: SessionMinutes[] = [30, 45, 60, 75, 90]

type Step = 'questions' | 'result'

interface Props {
  profile: Profile | null
  currentKey: string | null
  onClose: () => void
  onChoose: (template: Template, priority: MuscleGroup | null) => Promise<void>
}

export function SplitSheet({ profile, currentKey, onClose, onChoose }: Props) {
  const [days, setDays] = useState<(typeof DAYS)[number]>(
    DAYS.find((d) => d === profile?.training_days_per_week) ?? 4,
  )
  const [minutes, setMinutes] = useState<SessionMinutes>(60)
  const [priority, setPriority] = useState<MuscleGroup | null>(null)
  const [step, setStep] = useState<Step>('questions')
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function showSplit() {
    const out = recommend({
      days_per_week: days,
      minutes,
      priority,
      profile: {
        training_age: profile?.training_age ?? 'intermediate',
        sleep_min: profile?.sleep_min ?? null,
      },
      deficit_fraction: deficitFractionOf(profile),
    })
    setRec(out)
    setPicked(out?.template_key ?? TEMPLATE_LIST.find((t) => t.days_per_week === days)?.key ?? null)
    setStep('result')
  }

  async function confirm() {
    const template = picked ? templateByKey(picked) : null
    if (!template || busy) return
    setBusy(true)
    setProblem(null)
    try {
      await onChoose(template, priority)
    } catch {
      setProblem('Could not switch the split. Tap the button to try again.')
      setBusy(false)
    }
  }

  const pickedTemplate = picked ? templateByKey(picked) : null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Change split"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-screen-sm overflow-y-auto rounded-t-sheet bg-surface-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:rounded-sheet"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[22px] font-bold leading-tight">{step === 'questions' ? 'Which split?' : 'Your split'}</h2>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            Close
          </button>
        </div>

        {step === 'questions' ? (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-[15px] font-semibold text-ink-2">How many days a week can you train?</legend>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={days === d}
                    className={`${chipClass(days === d)} num`}
                    onClick={() => setDays(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[15px] font-semibold text-ink-2">How long is a session?</legend>
              <div className="flex flex-wrap gap-2">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={minutes === m}
                    className={chipClass(minutes === m)}
                    onClick={() => setMinutes(m)}
                  >
                    <span className="num">{m}</span>
                    <span className="ml-1">min</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[15px] font-semibold text-ink-2">Any muscle you want to bring up?</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={priority === null} className={chipClass(priority === null)} onClick={() => setPriority(null)}>
                  None
                </button>
                {MUSCLE_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={priority === g}
                    className={chipClass(priority === g)}
                    onClick={() => setPriority(g)}
                  >
                    {GROUP_LABELS[g]}
                  </button>
                ))}
              </div>
            </fieldset>

            <button type="button" className={PRIMARY_BUTTON} onClick={showSplit}>
              Show my split
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rec ? (
              <div className="space-y-2 rounded-card border border-line bg-surface-2 p-4">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-accent-text">Recommended</p>
                <p className="text-[22px] font-bold leading-tight">{templateByKey(rec.template_key)?.name ?? rec.template_key}</p>
                <p className="text-[15px] leading-relaxed text-ink-2">{rec.reason}</p>
                {rec.alternatives.map((alt) => {
                  const t = TEMPLATE_LIST.find((x) => x.split === alt.split)
                  if (!t) return null
                  return (
                    <button
                      key={alt.split}
                      type="button"
                      onClick={() => setPicked(t.key)}
                      aria-pressed={picked === t.key}
                      className="block min-h-11 w-full rounded-control border border-line px-3 py-2 text-left"
                    >
                      <span className="block text-[15px] font-semibold">{t.name}</span>
                      <span className="block text-[15px] text-ink-2">{alt.tradeoff}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-[15px] leading-relaxed text-ink-2">
                Pick the split that fits your week. You can change it again whenever you like; your history stays.
              </p>
            )}

            <div>
              <p className="mb-2 text-[15px] font-semibold text-ink-2">All splits</p>
              <ul className="space-y-2">
                {TEMPLATE_LIST.map((t) => {
                  const on = picked === t.key
                  return (
                    <li key={t.key}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPicked(t.key)}
                        className={[
                          'flex min-h-14 w-full items-center justify-between gap-3 rounded-control border px-3 py-2 text-left',
                          on ? 'border-accent bg-accent/10' : 'border-line bg-surface-2',
                        ].join(' ')}
                      >
                        <span>
                          <span className="block text-[17px] font-semibold">{t.name}</span>
                          <span className="block text-[15px] text-ink-2">
                            <span className="num">{t.days_per_week}</span> days a week
                            {t.key === currentKey ? ', current' : ''}
                          </span>
                        </span>
                        {on ? <span className="text-[15px] font-semibold text-accent-text">Selected</span> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {pickedTemplate ? (
              <p className="text-[15px] text-ink-2">
                Switching starts {pickedTemplate.name} at day <span className="num">1</span>. Your history stays.
              </p>
            ) : null}
            {problem ? (
              <p role="status" className="text-[15px] text-rose-text">
                {problem}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setStep('questions')}>
                Back
              </button>
              <button
                type="button"
                className={`${PRIMARY_BUTTON} flex-1`}
                disabled={!pickedTemplate || busy || pickedTemplate.key === currentKey}
                onClick={confirm}
              >
                {pickedTemplate?.key === currentKey ? 'Already your split' : 'Use this split'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
