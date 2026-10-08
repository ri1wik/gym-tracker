import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PATHS } from '../../../app/paths'
import { MuscleMap } from '../../../components/MuscleMap'
import { dateAtLocalMidnight } from '../../../domain/dates'
import { formatClock, formatKg } from '../../../domain/units'
import type { Exercise, LoadType } from '../../../domain/types'
import { EXERCISES, getExercise, getMachine } from './data'
import { BODY_PART_LABEL, EQUIPMENT_LABEL, muscleLine } from './labels'
import { resolveStartPath } from './startSession'
import { useGym, useLastPerformance, type PerformedSet } from './store'
import { swapList } from './swap'
import { BackButton, Card, ImageBox, SectionTitle } from './ui'
import { ExerciseRow } from './BodyPartBrowse'

// OWNER: ui-library. Route /train/exercise/:id.

const WIDE = '(min-width: 640px) 320px, 100vw'

function ExerciseImages({ exercise }: { exercise: Exercise }) {
  const [which, setWhich] = useState<'start' | 'peak'>('start')
  const media = exercise.media
  const frames = [
    { key: 'start' as const, label: 'Start', path: media?.start },
    { key: 'peak' as const, label: 'Peak', path: media?.peak },
  ]
  return (
    <div className="space-y-2">
      {/* Narrow screens: one image, tap to flip between the two positions. */}
      <button
        type="button"
        onClick={() => setWhich(which === 'start' ? 'peak' : 'start')}
        aria-label={`Showing the ${which} position. Tap to see the ${which === 'start' ? 'peak' : 'start'} position.`}
        className="relative block w-full overflow-hidden rounded-card border border-line sm:hidden"
      >
        {frames.map((f) => (
          <div key={f.key} className={f.key === which ? 'block' : 'hidden'}>
            <ImageBox
              path={f.path}
              alt={`${exercise.name}, ${f.label.toLowerCase()} position`}
              aspect="4 / 3"
              sizes={WIDE}
              fit="contain"
              fallbackLabel="Picture coming soon"
              eager
            />
          </div>
        ))}
        <span className="absolute left-2 top-2 rounded-[6px] bg-bg/85 px-2 py-1 text-[12px] font-bold text-ink-1">
          {which === 'start' ? 'Start' : 'Peak'}
        </span>
        <span className="absolute bottom-2 right-2 rounded-[6px] bg-bg/85 px-2 py-1 text-[12px] font-semibold text-ink-2">
          Tap to flip
        </span>
      </button>

      {/* Wider screens: both side by side. */}
      <div className="hidden grid-cols-2 gap-3 sm:grid">
        {frames.map((f) => (
          <figure key={f.key} className="space-y-1">
            <div className="overflow-hidden rounded-card border border-line">
              <ImageBox
                path={f.path}
                alt={`${exercise.name}, ${f.label.toLowerCase()} position`}
                aspect="4 / 3"
                sizes={WIDE}
                fit="contain"
                fallbackLabel="Picture coming soon"
              />
            </div>
            <figcaption className="text-[13px] font-semibold text-ink-2">{f.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function formatPerformedSet(loadType: LoadType, s: PerformedSet): string {
  if (loadType === 'time') return formatClock(s.reps)
  if (loadType === 'assisted') return `${formatKg(s.assist_g, 1)} kg assist × ${s.reps}`
  if (loadType === 'bodyweight' && s.load_g === 0) return `${s.reps} reps`
  if (loadType === 'bodyweight') return `+${formatKg(s.load_g, 1)} kg × ${s.reps}`
  return `${formatKg(s.load_g, 1)} kg × ${s.reps}`
}

function LastPerformance({ exercise }: { exercise: Exercise }) {
  const last = useLastPerformance(exercise.id)
  if (last === undefined) return null
  return (
    <section aria-labelledby="last-perf" className="space-y-2">
      <SectionTitle>
        <span id="last-perf">Last time</span>
      </SectionTitle>
      {last === null ? (
        <Card className="p-4">
          <p className="text-[15px] text-ink-2">No sets logged yet. Your first working set will show up here.</p>
        </Card>
      ) : (
        <Card className="space-y-3 p-4">
          <p className="num text-[13px] text-ink-2">{dateAtLocalMidnight(last.dateKey).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <ul className="flex flex-wrap gap-2">
            {last.sets.map((s, i) => (
              <li key={i} className="num rounded-control bg-surface-2 px-3 py-2 text-[16px] font-bold text-ink-1">
                {formatPerformedSet(exercise.loadType, s)}
              </li>
            ))}
          </ul>
          <p className="text-[14px] text-ink-2">
            Best set so far: <span className="num font-bold text-ink-1">{formatPerformedSet(exercise.loadType, last.best)}</span>
          </p>
        </Card>
      )}
    </section>
  )
}

function SwapFor({ exercise }: { exercise: Exercise }) {
  const gym = useGym()
  const swap = useMemo(() => swapList(exercise, EXERCISES, gym.machineIds), [exercise, gym.machineIds])
  return (
    <section aria-labelledby="swap-for" className="space-y-2">
      <SectionTitle>
        <span id="swap-for">Swap for</span>
      </SectionTitle>
      {swap.kind === 'none' ? (
        <Card className="p-4">
          <p className="text-[15px] text-ink-2">No other exercise in your gym trains this the same way yet.</p>
        </Card>
      ) : (
        <>
          <p className="text-[14px] text-ink-2">
            {swap.kind === 'pattern'
              ? 'Same movement and muscle, on different equipment.'
              : 'Nothing moves the same way, so these train the same muscle.'}
          </p>
          <ul className="space-y-2">
            {swap.items.map((e) => (
              <ExerciseRow key={e.id} exercise={e} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function ExerciseDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exercise = getExercise(id)
  const [starting, setStarting] = useState(false)

  if (!exercise) {
    return (
      <section className="space-y-4">
        <BackButton fallback={PATHS.trainLibrary} />
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Exercise not found</h1>
        <Card className="space-y-3 p-4">
          <p className="text-[15px] text-ink-2">That exercise is not in the library. It may have been renamed.</p>
          <Link to={PATHS.trainLibrary} className="inline-flex h-11 items-center font-semibold text-accent-text">
            Open the library
          </Link>
        </Card>
      </section>
    )
  }

  const machine = getMachine(exercise.machineId)
  const start = async () => {
    setStarting(true)
    navigate(await resolveStartPath(exercise.id))
  }

  return (
    <article className="space-y-5">
      <BackButton label="Library" fallback={PATHS.trainLibrary} />

      <header className="space-y-1">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">{exercise.name}</h1>
        <p className="text-[15px] text-ink-2">
          {BODY_PART_LABEL[exercise.bodyPart]} · {EQUIPMENT_LABEL[exercise.equipment]}
          {exercise.isUnilateral ? ' · One side at a time' : ''}
        </p>
      </header>

      <ExerciseImages exercise={exercise} />

      {exercise.cue && (
        <Card className="border-accent/40 bg-accent/10 p-4">
          <p className="text-[16px] font-semibold leading-snug text-ink-1">{exercise.cue}</p>
        </Card>
      )}

      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="flex h-13 min-h-13 w-full items-center justify-center rounded-control bg-accent px-4 text-[17px] font-bold text-on-accent hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-70"
      >
        Start this exercise
      </button>

      <section aria-labelledby="muscles" className="space-y-2">
        <SectionTitle>
          <span id="muscles">Muscles worked</span>
        </SectionTitle>
        <Card className="flex items-center gap-4 p-4">
          <MuscleMap mode="highlight" primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} size={96} className="shrink-0 text-ink-3" />
          <dl className="min-w-0 space-y-3 text-[15px]">
            <div>
              <dt className="text-[13px] font-semibold text-accent-text">Main</dt>
              <dd className="text-ink-1">{muscleLine(exercise.primaryMuscles)}</dd>
            </div>
            {exercise.secondaryMuscles.length > 0 && (
              <div>
                <dt className="text-[13px] font-semibold text-ink-2">Helping</dt>
                <dd className="text-ink-1">{muscleLine(exercise.secondaryMuscles)}</dd>
              </div>
            )}
          </dl>
        </Card>
      </section>

      <section aria-labelledby="how-to" className="space-y-2">
        <SectionTitle>
          <span id="how-to">How to do it</span>
        </SectionTitle>
        {exercise.howTo.length > 0 ? (
          <ol className="space-y-2">
            {exercise.howTo.map((line, i) => (
              <li key={i} className="flex gap-3 rounded-card border border-line bg-surface-1 p-3">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[14px] font-bold text-ink-1">
                  {i + 1}
                </span>
                <p className="text-[15px] leading-relaxed text-ink-1">{line}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Card className="p-4">
            <p className="text-[15px] text-ink-2">Step-by-step instructions for this exercise are on the way.</p>
          </Card>
        )}
      </section>

      {exercise.mistakes.length > 0 && (
        <section aria-labelledby="mistakes" className="space-y-2">
          <SectionTitle>
            <span id="mistakes">Common slips</span>
          </SectionTitle>
          <ul className="space-y-2">
            {exercise.mistakes.map((line, i) => (
              <li key={i} className="rounded-card border border-line bg-surface-1 p-3 text-[15px] leading-relaxed text-ink-1">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      <LastPerformance exercise={exercise} />

      {machine && (
        <section aria-labelledby="where" className="space-y-2">
          <SectionTitle>
            <span id="where">Where to find it</span>
          </SectionTitle>
          <Link
            to={PATHS.machine(machine.id)}
            className="flex min-h-16 items-center justify-between gap-3 rounded-card border border-line bg-surface-1 p-3 hover:bg-surface-2"
          >
            <span className="text-[16px] font-semibold text-ink-1">{machine.name}</span>
            <span className="text-[14px] font-semibold text-accent-text">Setup</span>
          </Link>
        </section>
      )}

      <SwapFor exercise={exercise} />
    </article>
  )
}
