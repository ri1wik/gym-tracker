import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PATHS } from '../../../app/paths'
import { MuscleMap } from '../../../components/MuscleMap'
import type { MachineSetting } from '../../../domain/types'
import { exercisesForMachine, getMachine, type LibraryMachine } from './data'
import { imageUrl } from './images'
import { CATEGORY_LABEL, muscleLine } from './labels'
import { resolveStartPath } from './startSession'
import { SETTING_FIELD_OF_LABEL, saveMachineSetting, useGym, useMachineSetting, type SettingField } from './store'
import { BackButton, Card, ImageBox, SectionTitle } from './ui'

// OWNER: ui-library. Route /train/machine/:id.

function Hero({ machine }: { machine: LibraryMachine }) {
  const [open, setOpen] = useState(false)
  const hasPhoto = !!machine.photo && !machine.placeholder

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!hasPhoto) {
    return (
      <div className="overflow-hidden rounded-card border border-line">
        <ImageBox path={null} alt={`${machine.name}, no photo yet`} aspect="4 / 3" sizes="100vw" fallbackLabel="Add a photo" />
      </div>
    )
  }
  const src = machine.photo!.src
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open the photo of ${machine.name} full screen`}
        className="block w-full overflow-hidden rounded-card border border-line"
      >
        <ImageBox path={src} alt={machine.name} aspect="4 / 3" sizes="(min-width: 640px) 640px, 100vw" eager fallbackLabel={machine.name} />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={machine.name} className="fixed inset-0 z-30 flex flex-col bg-bg">
          <div className="flex justify-end px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button type="button" onClick={() => setOpen(false)} className="flex h-11 items-center rounded-control bg-surface-2 px-4 text-[15px] font-semibold">
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 p-2">
            <img src={imageUrl(src, 512)} alt={machine.name} className="h-full w-full object-contain" />
          </div>
        </div>
      )}
    </>
  )
}

function SettingInput({
  machineId,
  saved,
  field,
  label,
}: {
  machineId: string
  saved: MachineSetting | null | undefined
  field: SettingField
  label: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const stored = saved?.[field] ?? ''
  const id = `setting-${machineId}-${field}`

  const commit = async () => {
    if (draft === null) return
    await saveMachineSetting(machineId, field, draft)
    setDraft(null)
    setJustSaved(true)
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center justify-between text-[13px] font-semibold text-ink-2">
        <span>Your {label.toLowerCase()} setting</span>
        <span aria-live="polite" className="text-mint-text">
          {justSaved && draft === null ? 'Saved' : ''}
        </span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        enterKeyHint="done"
        placeholder={field === 'note' ? 'For example: pin 7, 2 plates' : 'For example: 4'}
        value={draft ?? stored}
        onChange={(e) => {
          setDraft(e.target.value)
          setJustSaved(false)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="h-12 w-full rounded-control border border-line bg-surface-2 px-3 text-ink-1 placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
    </div>
  )
}

function SetupChecklist({ machine }: { machine: LibraryMachine }) {
  const saved = useMachineSetting(machine.id)
  // One input per label: the first step with that label carries it.
  const seen = new Set<SettingField>()
  return (
    <section aria-labelledby="setup" className="space-y-2">
      <SectionTitle>
        <span id="setup">Set it up</span>
      </SectionTitle>
      {machine.setup.length === 0 ? (
        <Card className="p-4">
          <p className="text-[15px] text-ink-2">Setup steps for this machine are on the way. You can still save your own note below.</p>
        </Card>
      ) : (
        <ol className="space-y-2">
          {machine.setup.map((step, i) => {
            const field = SETTING_FIELD_OF_LABEL[step.label]
            const showInput = !seen.has(field)
            seen.add(field)
            return (
              <li key={i} className="space-y-3 rounded-card border border-line bg-surface-1 p-3">
                <div className="flex gap-3">
                  <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[14px] font-bold text-ink-1">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-accent-text">{step.label}</p>
                    <p className="text-[15px] leading-relaxed text-ink-1">{step.text}</p>
                  </div>
                </div>
                {showInput && <SettingInput machineId={machine.id} saved={saved} field={field} label={step.label} />}
              </li>
            )
          })}
        </ol>
      )}
      {!machine.setup.some((s) => s.label === 'Other') && (
        <Card className="p-3">
          <SettingInput machineId={machine.id} saved={saved} field="note" label="Note" />
        </Card>
      )}
    </section>
  )
}

function SupportedExercises({ machine }: { machine: LibraryMachine }) {
  const navigate = useNavigate()
  const list = exercisesForMachine(machine)
  if (list.length === 0) return null
  return (
    <section aria-labelledby="supported" className="space-y-2">
      <SectionTitle>
        <span id="supported">Exercises on this machine</span>
      </SectionTitle>
      <ul className="space-y-2">
        {list.map((e) => (
          <li key={e.id} className="flex items-center gap-2 rounded-card border border-line bg-surface-1 p-2">
            <Link to={PATHS.exercise(e.id)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3">
              <div className="w-14 shrink-0 overflow-hidden rounded-control">
                <ImageBox path={e.media?.start} alt="" aspect="1 / 1" sizes="56px" fit="contain" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[16px] font-semibold leading-5 text-ink-1">{e.name}</p>
                <p className="truncate text-[13px] text-ink-2">{muscleLine(e.primaryMuscles)}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={async () => navigate(await resolveStartPath(e.id))}
              className="h-11 shrink-0 rounded-control bg-accent px-4 text-[15px] font-bold text-on-accent hover:bg-accent-hover active:bg-accent-pressed"
            >
              Start this
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function MachineDetailScreen() {
  const { id } = useParams()
  const machine = getMachine(id)
  const gym = useGym()

  if (!machine) {
    return (
      <section className="space-y-4">
        <BackButton fallback={PATHS.trainLibrary} />
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Machine not found</h1>
        <Card className="space-y-3 p-4">
          <p className="text-[15px] text-ink-2">That machine is not in the guide. Try the search on the library page.</p>
          <Link to={PATHS.trainLibrary} className="inline-flex h-11 items-center font-semibold text-accent-text">
            Open the library
          </Link>
        </Card>
      </section>
    )
  }

  const inGym = gym.machineIds.has(machine.id)

  return (
    <article className="space-y-5">
      <BackButton label="Library" fallback={PATHS.trainLibrary} />

      <header className="space-y-1">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{machine.name}</h1>
        <p className="text-[15px] text-ink-2">
          {machine.brandNote ?? CATEGORY_LABEL[machine.category]}
          {!inGym ? ' · Not at your gym' : ''}
        </p>
        {machine.aliases.length > 0 && (
          <p className="text-[13px] text-ink-3">Also called: {machine.aliases.join(', ')}</p>
        )}
      </header>

      <Hero machine={machine} />

      {(machine.primaryMuscles.length > 0 || machine.secondaryMuscles.length > 0) && (
        <section aria-labelledby="muscles" className="space-y-2">
          <SectionTitle>
            <span id="muscles">What it works</span>
          </SectionTitle>
          <Card className="flex items-center gap-4 p-4">
            <MuscleMap mode="highlight" primary={machine.primaryMuscles} secondary={machine.secondaryMuscles} size={96} className="shrink-0 text-ink-3" />
            <dl className="min-w-0 space-y-3 text-[15px]">
              <div>
                <dt className="text-[13px] font-semibold text-accent-text">Main</dt>
                <dd className="text-ink-1">{muscleLine(machine.primaryMuscles) || 'Whole body'}</dd>
              </div>
              {machine.secondaryMuscles.length > 0 && (
                <div>
                  <dt className="text-[13px] font-semibold text-ink-2">Helping</dt>
                  <dd className="text-ink-1">{muscleLine(machine.secondaryMuscles)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </section>
      )}

      <SetupChecklist machine={machine} />
      <SupportedExercises machine={machine} />

      {machine.tips.length > 0 && (
        <section aria-labelledby="tips" className="space-y-2">
          <SectionTitle>
            <span id="tips">Tips</span>
          </SectionTitle>
          <ul className="space-y-2">
            {machine.tips.map((t, i) => (
              <li key={i} className="rounded-card border border-line bg-surface-1 p-3 text-[15px] leading-relaxed text-ink-1">
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
