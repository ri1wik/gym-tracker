import { useEffect, useMemo, useState } from 'react'
import { MACHINE_CATEGORIES, type MachineCategory } from '../../../domain/types'
import { MACHINES } from './data'
import { CATEGORY_LABEL, machineSearchable } from './labels'
import { MachineCard } from './MachineCard'
import { searchItems } from './search'
import { readPref, useGym, writePref } from './store'
import { Chip, SearchField } from './ui'

// OWNER: ui-library. The "By equipment" segment: photo grid, category chips,
// alias search and the "My gym only" switch.

const GYM_ONLY_KEY = 'gym-only'

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex h-11 items-center gap-3 rounded-control pr-1 text-[15px] font-semibold text-ink-1"
    >
      <span
        aria-hidden="true"
        className={['flex h-7 w-12 items-center rounded-full p-0.5 transition-colors', checked ? 'bg-accent' : 'bg-surface-3'].join(' ')}
      >
        <span className={['h-6 w-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </span>
      {label}
    </button>
  )
}

export function EquipmentBrowse() {
  const gym = useGym()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MachineCategory | 'all'>('all')
  // null until the user chooses: then the default applies (on once a gym profile exists).
  const [gymOnlyChoice, setGymOnlyChoice] = useState<boolean | null>(() => {
    const v = readPref(GYM_ONLY_KEY)
    return v === null ? null : v === '1'
  })
  const gymOnly = gymOnlyChoice ?? gym.hasProfile

  useEffect(() => {
    if (gymOnlyChoice !== null) writePref(GYM_ONLY_KEY, gymOnlyChoice ? '1' : '0')
  }, [gymOnlyChoice])

  const visible = useMemo(() => (gymOnly ? MACHINES.filter((m) => gym.machineIds.has(m.id)) : MACHINES), [gymOnly, gym.machineIds])
  const counts = useMemo(() => {
    const c: Partial<Record<MachineCategory, number>> = {}
    for (const m of visible) c[m.category] = (c[m.category] ?? 0) + 1
    return c
  }, [visible])

  const shown = useMemo(() => {
    const inCategory = category === 'all' ? visible : visible.filter((m) => m.category === category)
    return searchItems(inCategory, query, (m) => machineSearchable(m, gym.customAliases[m.id] ?? []))
  }, [visible, category, query, gym.customAliases])

  return (
    <div className="space-y-4">
      <SearchField value={query} onChange={setQuery} label="Search machines" placeholder="Search by name or nickname" />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Machine type">
        <Chip active={category === 'all'} onClick={() => setCategory('all')} count={visible.length}>
          All
        </Chip>
        {MACHINE_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0 || category === c).map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)} count={counts[c] ?? 0}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Switch checked={gymOnly} onChange={setGymOnlyChoice} label="My gym only" />
        <p className="num text-right text-[13px] text-ink-3">{gym.hasProfile ? gym.name : 'Typical gym'}</p>
      </div>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Machines">
          {shown.map((m) => (
            <MachineCard key={m.id} machine={m} inGym={gym.machineIds.has(m.id)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-line bg-surface-1 p-4 text-[15px] text-ink-2">
          No machine matches. Clear the search
          {gymOnly ? ' or switch off "My gym only"' : ''} to see more.
        </p>
      )}
    </div>
  )
}
