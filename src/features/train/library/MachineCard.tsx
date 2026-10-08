import { Link } from 'react-router-dom'
import { PATHS } from '../../../app/paths'
import type { LibraryMachine } from './data'
import { CATEGORY_LABEL } from './labels'
import { ImageBox } from './ui'

// OWNER: ui-library. One machine tile for the photo grid. A machine with no
// photo yet shows its name and an "Add a photo" prompt in the same box.

export function MachineCard({ machine, inGym }: { machine: LibraryMachine; inGym: boolean }) {
  const hasPhoto = !!machine.photo && !machine.placeholder
  return (
    <li>
      <Link
        to={PATHS.machine(machine.id)}
        className="block overflow-hidden rounded-card border border-line bg-surface-1 hover:bg-surface-2"
      >
        <div className="relative">
          <ImageBox
            path={hasPhoto ? machine.photo?.src : null}
            alt={hasPhoto ? machine.name : `${machine.name}, no photo yet`}
            aspect="4 / 3"
            sizes="(min-width: 640px) 240px, 45vw"
            fallbackLabel="Add a photo"
          />
          {!inGym && (
            <span className="absolute left-2 top-2 rounded-[6px] bg-bg/85 px-2 py-1 text-[12px] font-semibold text-ink-2">
              Not at your gym
            </span>
          )}
        </div>
        <div className="space-y-0.5 p-3">
          <p className="min-h-10 text-[15px] font-semibold leading-5 text-ink-1">{machine.name}</p>
          <p className="truncate text-[13px] text-ink-2">{CATEGORY_LABEL[machine.category]}</p>
        </div>
      </Link>
    </li>
  )
}
