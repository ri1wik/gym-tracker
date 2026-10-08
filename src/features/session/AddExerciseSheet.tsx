// Add an exercise mid-session: a sticky search field, aliases and body part
// matched, recents first, the whole library below, grouped as the search
// returns it. One tap adds three working sets prefilled from history.

import { useEffect, useMemo, useState } from 'react'
import { EXERCISE_INDEX } from '../../data/library/exercise-index'
import { exerciseInfo } from './library'
import { recentExerciseIds } from './repo'
import { searchExercises, type SearchEntry } from './search'
import { Sheet } from './ui'
import { bodyPartLabel } from './fmt'

export interface AddExerciseSheetProps {
  onPick: (exerciseId: string) => void
  onClose: () => void
}

const ENTRIES: SearchEntry[] = EXERCISE_INDEX.map((e) => ({
  id: e.id,
  name: e.name,
  bodyPart: e.bodyPart,
  aliases: exerciseInfo(e.id)?.aliases ?? [],
}))

export function AddExerciseSheet({ onPick, onClose }: AddExerciseSheetProps) {
  const [q, setQ] = useState('')
  const [recents, setRecents] = useState<string[]>([])
  useEffect(() => {
    let live = true
    recentExerciseIds(12).then((ids) => {
      if (live) setRecents(ids)
    })
    return () => {
      live = false
    }
  }, [])
  const results = useMemo(() => searchExercises(q, ENTRIES, recents), [q, recents])
  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <div className="sticky top-0 z-10 bg-surface-2 pb-2">
        <input
          type="search"
          inputMode="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, nickname or body part"
          aria-label="Search exercises"
          className="h-12 w-full rounded-control border border-line-strong bg-surface-1 px-4 text-[16px] outline-none placeholder:text-ink-3"
        />
      </div>
      {results.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-ink-2">Nothing matches. Try a body part, like "back".</p>
      ) : (
        <ul className="space-y-1 pb-2">
          {results.slice(0, 60).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onPick(r.id)} className="flex min-h-12 w-full items-center gap-3 rounded-control px-2 text-left active:bg-surface-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{r.name}</span>
                  <span className="block truncate text-[13px] text-ink-2">
                    {bodyPartLabel(r.bodyPart)}
                    {r.aliases.length ? ` · ${r.aliases.join(', ')}` : ''}
                  </span>
                </span>
                {r.recent && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">recent</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
