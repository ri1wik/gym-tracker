import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PATHS } from '../../../app/paths'
import { BODY_PARTS } from '../../../domain/types'
import { MACHINES } from './data'
import { BODY_PART_LABEL, CATEGORY_LABEL, machineSearchable, muscleLine } from './labels'
import { searchItems } from './search'
import { useGym } from './store'
import { Chip, ImageBox, SearchField } from './ui'

// OWNER: ui-library. "What is this machine?": a full-screen search by name,
// nickname or body part. Also meant for the session screen (import and render
// it with an onClose); every result links to the machine detail.

export function MachineFinder({ onClose }: { onClose: () => void }) {
  const gym = useGym()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const results = useMemo(
    () => searchItems(MACHINES, query, (m) => machineSearchable(m, gym.customAliases[m.id] ?? [])),
    [query, gym.customAliases],
  )
  const searching = query.trim() !== ''

  return (
    <div role="dialog" aria-modal="true" aria-label="What is this machine?" className="fixed inset-0 z-30 flex flex-col bg-bg">
      <header className="mx-auto flex w-full max-w-screen-sm items-center gap-2 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <h1 className="flex-1 text-[22px] font-bold tracking-tight text-ink-1">What is this machine?</h1>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 items-center rounded-control bg-surface-2 px-4 text-[15px] font-semibold text-ink-1"
        >
          Close
        </button>
      </header>
      <div className="mx-auto w-full max-w-screen-sm space-y-3 px-4 pb-2">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search machines"
          placeholder="Name, nickname or body part"
          autoFocus
        />
        {!searching && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Start with a body part">
            {BODY_PARTS.map((p) => (
              <Chip key={p} active={false} onClick={() => setQuery(BODY_PART_LABEL[p])}>
                {BODY_PART_LABEL[p]}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-screen-sm px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {searching && results.length === 0 ? (
            <p className="rounded-card border border-line bg-surface-1 p-4 text-[15px] text-ink-2">
              Nothing by that name. Try the body part it works (like &quot;legs&quot; or &quot;back&quot;) or part of the name.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Machines">
              {results.map((m) => {
                const inGym = gym.machineIds.has(m.id)
                const hasPhoto = !!m.photo && !m.placeholder
                return (
                  <li key={m.id}>
                    <Link
                      to={PATHS.machine(m.id)}
                      className="flex min-h-20 items-center gap-3 rounded-card border border-line bg-surface-1 p-2 pr-3 hover:bg-surface-2"
                    >
                      <div className="w-20 shrink-0 overflow-hidden rounded-control">
                        <ImageBox
                          path={hasPhoto ? m.photo?.src : null}
                          alt=""
                          aspect="4 / 3"
                          sizes="80px"
                          fallbackLabel=""
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-semibold leading-5 text-ink-1">{m.name}</p>
                        <p className="truncate text-[13px] text-ink-2">
                          {CATEGORY_LABEL[m.category]}
                          {m.primaryMuscles.length > 0 ? ` · ${muscleLine(m.primaryMuscles)}` : ''}
                        </p>
                        {!inGym && <p className="text-[12px] font-semibold text-ink-3">Not at your gym</p>}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
