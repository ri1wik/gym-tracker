import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PATHS } from '../../../app/paths'
import { EXERCISES_BY_ID } from '../../../data/library/exercise-index'
import type { MuscleGroup, Program, ProgramSettings, Template, Weekday } from '../../../domain/types'
import type { TrainView } from './data'
import { relativeDayLabel, WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOrder } from './rotation'
import { SplitSheet } from './SplitSheet'
import { startNextSession } from './startSession'
import {
  createProgram,
  programDb,
  SESSION_MINUTES,
  updateProgramSettings,
  writeSessionMinutes,
  type SessionMinutesChoice,
} from './store'
import { daySetCount } from './templates'
import { useTrainView } from './useTrainView'
import { CARD, chipClass, PRIMARY_BUTTON, SECONDARY_BUTTON } from './ui'

// OWNER: ui-program-home. The Program segment of the Train tab: the current
// split, the rotation with the next session highlighted, weekday pins, the
// weekly target and time budget, the deload control, and Change split.

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-2">{children}</h2>
}

export function ProgramScreen() {
  const { view, today } = useTrainView()
  const [sheet, setSheet] = useState(false)

  if (!view) {
    return (
      <div aria-busy="true" className="space-y-4">
        <div className="h-28 animate-pulse rounded-card bg-surface-1" />
        <div className="h-64 animate-pulse rounded-card bg-surface-1" />
      </div>
    )
  }

  async function choose(template: Template, priority: MuscleGroup | null) {
    await createProgram(programDb(), template, today, { priority_group: priority })
    setSheet(false)
  }

  const sheetNode = sheet ? (
    <SplitSheet
      profile={view.profile}
      currentKey={view.program?.template_key ?? null}
      onClose={() => setSheet(false)}
      onChoose={choose}
    />
  ) : null

  if (!view.program || !view.template || !view.next) {
    return (
      <div className="space-y-4">
        <div className={`${CARD} space-y-3`}>
          <p className="text-[22px] font-bold leading-tight">No split yet</p>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Answer three questions and the app picks a rotation for you, or choose one yourself.
          </p>
          <button type="button" className={PRIMARY_BUTTON} onClick={() => setSheet(true)}>
            Choose a split
          </button>
        </div>
        {sheetNode}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SplitHeader view={view} template={view.template} today={today} onChange={() => setSheet(true)} />
      <Rotation view={view} template={view.template} program={view.program} today={today} />
      <Pins view={view} template={view.template} program={view.program} />
      <Targets view={view} program={view.program} />
      <DeloadCard view={view} program={view.program} today={today} />
      {sheetNode}
    </div>
  )
}

function SplitHeader({ view, template, today, onChange }: { view: TrainView; template: Template; today: string; onChange: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function start() {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      const res = await startNextSession(programDb(), today)
      navigate(PATHS.session(res.workoutId))
    } catch {
      setProblem('Could not start the session. Tap Start to try again.')
      setBusy(false)
    }
  }

  const label = view.inProgress ? 'Resume' : `Start ${view.next?.day.name ?? ''}`.trim()
  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Current split</p>
          <p className="mt-1 text-[22px] font-bold leading-tight">{template.name}</p>
          <p className="mt-1 text-[15px] text-ink-2">
            <span className="num">{template.days.length}</span> sessions in the rotation
          </p>
        </div>
        <button type="button" className={`${SECONDARY_BUTTON} shrink-0 whitespace-nowrap`} onClick={onChange}>
          Change split
        </button>
      </div>
      <button type="button" className={PRIMARY_BUTTON} onClick={start} disabled={busy}>
        {label}
      </button>
      {problem ? (
        <p role="status" className="text-[15px] text-rose-text">
          {problem}
        </p>
      ) : null}
    </div>
  )
}

function Rotation({ view, template, program, today }: { view: TrainView; template: Template; program: Program; today: string }) {
  const pinsByDay = new Map<string, Weekday[]>()
  for (const [wd, key] of Object.entries(program.settings.pins)) {
    if (!key) continue
    const list = pinsByDay.get(key) ?? []
    list.push(Number(wd) as Weekday)
    pinsByDay.set(key, list)
  }
  return (
    <section>
      <SectionTitle>Rotation</SectionTitle>
      <ol className="space-y-2">
        {template.days.map((d, i) => {
          const isNext = view.next?.index === i
          const last = view.lastDone[d.key] ?? null
          const pinned = pinsByDay.get(d.key) ?? []
          return (
            <li
              key={d.key}
              className={['rounded-card border', isNext ? 'border-accent bg-accent/10' : 'border-line bg-surface-1'].join(' ')}
            >
              <details>
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                  <span className="num w-6 text-center text-[17px] font-bold text-ink-2">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold">{d.name}</span>
                    <span className="block text-[15px] text-ink-2">
                      {last ? `Last done ${relativeDayLabel(last, today)}` : 'Not done yet'}
                      <span className="mx-1">/</span>
                      <span className="num">{daySetCount(d)}</span> sets
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {isNext ? (
                      <span className="rounded-chip bg-accent px-2 py-0.5 text-[13px] font-bold text-on-accent">Next</span>
                    ) : null}
                    {pinned.length > 0 ? (
                      <span className="text-[13px] font-semibold text-ink-2">
                        {pinned.map((w) => WEEKDAY_SHORT[w]).join(', ')}
                      </span>
                    ) : null}
                  </span>
                </summary>
                <ul className="space-y-1 border-t border-line px-3 py-2">
                  {d.items.map((it) => (
                    <li key={it.exercise_id} className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
                      <span className="min-w-0 truncate">{EXERCISES_BY_ID[it.exercise_id]?.name ?? it.exercise_id}</span>
                      <span className="num shrink-0 text-ink-2">
                        {it.sets} x {it.rep_min}-{it.rep_max}
                      </span>
                    </li>
                  ))}
                  {d.cardio_note ? <li className="pt-1 text-[15px] text-ink-2">{d.cardio_note}</li> : null}
                </ul>
              </details>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Pins({ view, template, program }: { view: TrainView; template: Template; program: Program }) {
  async function setPin(wd: Weekday, key: string) {
    const pins = { ...program.settings.pins }
    if (key === '') delete pins[wd]
    else pins[wd] = key
    await updateProgramSettings(programDb(), program, { pins })
  }
  return (
    <section>
      <SectionTitle>Weekday pins</SectionTitle>
      <div className={`${CARD} space-y-2`}>
        <p className="text-[15px] leading-relaxed text-ink-2">
          A pinned weekday always starts that session. Unpinned days follow the rotation, and rest days never move it.
        </p>
        <ul>
          {weekdayOrder(view.weekStartsOn).map((wd) => (
            <li key={wd} className="flex min-h-12 items-center justify-between gap-3">
              <label htmlFor={`pin-${wd}`} className="text-[17px] font-semibold">
                {WEEKDAY_NAMES[wd]}
              </label>
              <select
                id={`pin-${wd}`}
                value={program.settings.pins[wd] ?? ''}
                onChange={(e) => void setPin(wd, e.target.value)}
                className="h-11 w-44 rounded-control border border-line bg-surface-2 px-3"
              >
                <option value="">Follow rotation</option>
                {template.days.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Targets({ view, program }: { view: TrainView; program: Program }) {
  const target = program.settings.weekly_sessions_target
  async function setTarget(n: number) {
    await updateProgramSettings(programDb(), program, { weekly_sessions_target: Math.min(7, Math.max(1, n)) })
  }
  async function setMinutes(m: SessionMinutesChoice) {
    await writeSessionMinutes(programDb(), m)
  }
  return (
    <section>
      <SectionTitle>Week and time</SectionTitle>
      <div className={`${CARD} space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[17px] font-semibold">Sessions a week</p>
            <p className="text-[15px] text-ink-2">The number Home counts toward.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="One fewer session a week" className={`${SECONDARY_BUTTON} w-11 px-0`} onClick={() => void setTarget(target - 1)}>
              -
            </button>
            <span className="num w-8 text-center text-[22px] font-bold">{target}</span>
            <button type="button" aria-label="One more session a week" className={`${SECONDARY_BUTTON} w-11 px-0`} onClick={() => void setTarget(target + 1)}>
              +
            </button>
          </div>
        </div>
        <div>
          <p className="text-[17px] font-semibold">Time per session</p>
          <p className="mb-2 text-[15px] text-ink-2">The planner trims a session to fit this.</p>
          <div className="flex flex-wrap gap-2">
            {SESSION_MINUTES.map((m) => (
              <button key={m} type="button" aria-pressed={view.minutes === m} className={chipClass(view.minutes === m)} onClick={() => void setMinutes(m)}>
                <span className="num">{m}</span>
                <span className="ml-1">min</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function DeloadCard({ view, program, today }: { view: TrainView; program: Program; today: string }) {
  const d = view.deload
  const active = program.settings.deload.active
  const paused = program.settings.paused

  async function setDeload(patch: Partial<ProgramSettings['deload']>) {
    await updateProgramSettings(programDb(), program, { deload: { ...program.settings.deload, ...patch } })
  }
  async function togglePause() {
    await updateProgramSettings(programDb(), program, { paused: !paused })
  }

  return (
    <section>
      <SectionTitle>Deload</SectionTitle>
      <div className={`${CARD} space-y-3`}>
        {active ? (
          <p className="text-[15px] leading-relaxed text-ink-2">
            Deload week is on: half the sets at the same loads, no new weights. End it any time to go back to normal training.
          </p>
        ) : d ? (
          <p className="text-[15px] leading-relaxed text-ink-2">
            Week <span className="num">{d.week}</span> of <span className="num">{d.everyWeeks}</span> since the last easy week.
            {d.due ? ' A deload week is due: take it now or keep going, your call.' : ''}
          </p>
        ) : null}
        {active ? (
          <button type="button" className={SECONDARY_BUTTON} onClick={() => void setDeload({ active: false, week_index: 0, last_deload_on: today })}>
            End deload week
          </button>
        ) : (
          <button type="button" className={SECONDARY_BUTTON} onClick={() => void setDeload({ active: true })}>
            Deload now
          </button>
        )}
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-[15px] text-ink-2">
            {paused ? 'Paused for travel or a break. Nothing is counted and Home stops prompting.' : 'Away for a while? Pause the program and nothing is counted.'}
          </p>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => void togglePause()}>
            {paused ? 'Resume program' : 'Pause program'}
          </button>
        </div>
      </div>
    </section>
  )
}
