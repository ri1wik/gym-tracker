import { NavLink, Outlet } from 'react-router-dom'
import { PATHS } from '../../app/paths'

// OWNER: ui-program-home for the segment bar; the three segments are owned
// by ui-program-home (program), ui-library (library) and ui-logger (history).

const SEGMENTS = [
  { to: PATHS.trainProgram, label: 'Program' },
  { to: PATHS.trainLibrary, label: 'Library' },
  { to: PATHS.trainHistory, label: 'History' },
]

export function TrainTab() {
  return (
    <section className="space-y-4">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Train</h1>
      <nav aria-label="Train sections" className="flex h-11 rounded-control bg-surface-2 p-1">
        {SEGMENTS.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              [
                'flex flex-1 items-center justify-center rounded-[8px] text-[15px] font-semibold',
                isActive ? 'bg-surface-3 text-ink-1' : 'text-ink-2',
              ].join(' ')
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  )
}
