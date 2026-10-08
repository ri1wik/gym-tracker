import { NavLink, Outlet } from 'react-router-dom'
import { TabIcon, type TabKey } from './TabIcon'
import { ResumePill } from '../features/session/ResumePill'

const TABS: { to: string; key: TabKey; label: string; end?: boolean }[] = [
  { to: '/', key: 'home', label: 'Home', end: true },
  { to: '/train', key: 'train', label: 'Train' },
  { to: '/food', key: 'food', label: 'Food' },
  { to: '/progress', key: 'progress', label: 'Progress' },
  { to: '/you', key: 'you', label: 'You' },
]

export function Shell() {
  return (
    <div className="min-h-dvh bg-bg text-ink-1 lg:flex">
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface-1/92 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:static lg:h-dvh lg:w-60 lg:border-t-0 lg:border-r lg:pb-0"
      >
        <ul className="mx-auto flex h-14 max-w-screen-sm items-stretch lg:mx-0 lg:h-auto lg:max-w-none lg:flex-col lg:gap-1 lg:p-3">
          {TABS.map((t) => (
            <li key={t.key} className="flex-1 lg:flex-none">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  [
                    'flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold',
                    'lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-control lg:px-3 lg:text-[15px]',
                    isActive ? 'text-accent-text lg:bg-accent/15' : 'text-ink-2 hover:text-ink-1',
                  ].join(' ')
                }
              >
                <TabIcon name={t.key} />
                <span>{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto w-full max-w-screen-sm px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] pt-[max(1rem,env(safe-area-inset-top))] lg:max-w-4xl lg:px-8 lg:pb-8">
        <Outlet />
      </main>
      <ResumePill />
    </div>
  )
}
