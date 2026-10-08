import { useState } from 'react'
import { BodyPartBrowse } from './BodyPartBrowse'
import { EquipmentBrowse } from './EquipmentBrowse'
import { MachineFinder } from './MachineFinder'
import { readPref, writePref } from './store'

// OWNER: ui-library. Route /train/library, rendered inside the Train
// segment bar. Two views: By body part and By equipment, plus the full-screen
// "What is this machine?" search.

type View = 'body' | 'equipment'

const VIEWS: { key: View; label: string }[] = [
  { key: 'body', label: 'By body part' },
  { key: 'equipment', label: 'By equipment' },
]

export function LibraryScreen() {
  const [view, setView] = useState<View>(() => (readPref('view') === 'equipment' ? 'equipment' : 'body'))
  const [finderOpen, setFinderOpen] = useState(false)

  const choose = (v: View) => {
    setView(v)
    writePref('view', v)
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Library view" className="flex rounded-control bg-surface-2 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => choose(v.key)}
            className={[
              'flex h-11 flex-1 items-center justify-center rounded-[8px] text-[15px] font-semibold',
              view === v.key ? 'bg-surface-3 text-ink-1' : 'text-ink-2',
            ].join(' ')}
          >
            {v.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setFinderOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-control border border-line bg-surface-1 text-[15px] font-semibold text-accent-text hover:bg-surface-2"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        What is this machine?
      </button>

      {view === 'body' ? <BodyPartBrowse /> : <EquipmentBrowse />}

      {finderOpen && <MachineFinder onClose={() => setFinderOpen(false)} />}
    </div>
  )
}
