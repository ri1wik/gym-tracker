import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PATHS } from '../../../app/paths'
import { BODY_PARTS, type BodyPart, type Exercise } from '../../../domain/types'
import { EXERCISES } from './data'
import { BODY_PART_LABEL, EQUIPMENT_LABEL, exerciseSearchable, muscleLine } from './labels'
import { searchItems } from './search'
import { Chip, ImageBox, SearchField, SectionTitle } from './ui'

// OWNER: ui-library. The "By body part" segment: priority exercises first in
// every group, alias search across all 85.

export function priorityFirst(list: readonly Exercise[]): Exercise[] {
  return [...list].sort((a, b) => Number(b.isRecompPriority) - Number(a.isRecompPriority) || a.name.localeCompare(b.name))
}

export function ExerciseRow({ exercise }: { exercise: Exercise }) {
  return (
    <li>
      <Link
        to={PATHS.exercise(exercise.id)}
        className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-surface-1 p-2 pr-3 hover:bg-surface-2"
      >
        <div className="w-14 shrink-0 overflow-hidden rounded-control">
          <ImageBox
            path={exercise.media?.start}
            alt=""
            aspect="1 / 1"
            sizes="56px"
            fallbackLabel=""
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] font-semibold leading-5 text-ink-1">{exercise.name}</p>
          <p className="truncate text-[13px] text-ink-2">
            {EQUIPMENT_LABEL[exercise.equipment]}
            {exercise.primaryMuscles.length > 0 ? ` · ${muscleLine(exercise.primaryMuscles)}` : ''}
          </p>
        </div>
        {exercise.isRecompPriority && (
          <span className="shrink-0 rounded-[6px] bg-accent/15 px-2 py-1 text-[12px] font-bold text-accent-text">Priority</span>
        )}
      </Link>
    </li>
  )
}

export function BodyPartBrowse() {
  const [query, setQuery] = useState('')
  const [part, setPart] = useState<BodyPart | 'all'>('all')

  const results = useMemo(() => searchItems(EXERCISES, query, exerciseSearchable), [query])
  const searching = query.trim() !== ''

  const groups = useMemo(
    () =>
      BODY_PARTS.filter((p) => part === 'all' || p === part).map((p) => ({
        part: p,
        items: priorityFirst(EXERCISES.filter((e) => e.bodyPart === p)),
      })),
    [part],
  )

  return (
    <div className="space-y-4">
      <SearchField value={query} onChange={setQuery} label="Search exercises" placeholder="Search by name, nickname or muscle" />

      {!searching && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Body part">
          <Chip active={part === 'all'} onClick={() => setPart('all')}>
            All
          </Chip>
          {BODY_PARTS.map((p) => (
            <Chip key={p} active={part === p} onClick={() => setPart(p)}>
              {BODY_PART_LABEL[p]}
            </Chip>
          ))}
        </div>
      )}

      {searching ? (
        results.length > 0 ? (
          <section aria-label="Search results" className="space-y-2">
            <p className="text-[13px] text-ink-2">
              <span className="num">{results.length}</span> {results.length === 1 ? 'exercise' : 'exercises'}
            </p>
            <ul className="space-y-2">
              {results.map((e) => (
                <ExerciseRow key={e.id} exercise={e} />
              ))}
            </ul>
          </section>
        ) : (
          <p className="rounded-card border border-line bg-surface-1 p-4 text-[15px] text-ink-2">
            Nothing matches that yet. Try the muscle (like &quot;chest&quot;) or a shorter word.
          </p>
        )
      ) : (
        groups.map((g) => (
          <section key={g.part} aria-labelledby={`bp-${g.part}`} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <SectionTitle>
                <span id={`bp-${g.part}`}>{BODY_PART_LABEL[g.part]}</span>
              </SectionTitle>
              <span className="num text-[13px] text-ink-3">{g.items.length}</span>
            </div>
            <ul className="space-y-2">
              {g.items.map((e) => (
                <ExerciseRow key={e.id} exercise={e} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
