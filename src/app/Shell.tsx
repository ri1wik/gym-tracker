import { createContext, useContext, type CSSProperties } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { TabIcon, type TabKey } from './TabIcon'
import { activeWorkoutId, getWorkout } from '../features/session/active'
import { ResumePill } from '../features/session/ResumePill'
import { RestDock, REST_DOCK_HEIGHT_REM } from '../features/session/RestDock'
import { useRestTimer } from '../features/session/timer'

const TABS: { to: string; key: TabKey; label: string; end?: boolean }[] = [
  { to: '/', key: 'home', label: 'Home', end: true },
  { to: '/train', key: 'train', label: 'Train' },
  { to: '/food', key: 'food', label: 'Food' },
  { to: '/progress', key: 'progress', label: 'Progress' },
  { to: '/you', key: 'you', label: 'You' },
]

/** The tab bar's height plus the safe area, the base every fixed element above it stacks on. */
export const TAB_BAR_BOTTOM = 'calc(3.5rem + env(safe-area-inset-bottom))'
const PILL_REM = 2.75
const GAP_REM = 0.5

/**
 * Rem of chrome stacked above the tab bar right now (the rest dock, the
 * resume pill), so a screen's own bottom action can sit above it instead of
 * under it.
 */
const DockOffsetContext = createContext(0)

export function useDockOffsetRem(): number {
  return useContext(DockOffsetContext)
}

export function Shell() {
  // The live session and the stored rest are read here, once, so the resume
  // pill and the rest dock exist on every screen under the Shell: leaving the
  // session mid-rest keeps the countdown, the title mirror and the end
  // feedback (one hook instance drives them).
  const workout = useLiveQuery(async () => {
    const id = await activeWorkoutId()
    return id ? ((await getWorkout(id)) ?? null) : null
  }, [])
  const live = workout && workout.status === 'in_progress' ? workout : null
  const timer = useRestTimer(null)

  const dockRem = timer.state ? REST_DOCK_HEIGHT_REM + GAP_REM : 0
  const pillRem = live ? PILL_REM + GAP_REM : 0
  const dockBottom = `calc(${TAB_BAR_BOTTOM} + ${GAP_REM}rem)`
  const pillBottom = `calc(${TAB_BAR_BOTTOM} + ${GAP_REM}rem + ${dockRem}rem)`

  return (
    <DockOffsetContext.Provider value={dockRem + pillRem}>
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
        <main
          className="mx-auto w-full max-w-screen-sm px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem+var(--gt-dock))] pt-[max(1rem,env(safe-area-inset-top))] lg:max-w-4xl lg:px-8 lg:pb-[calc(2rem+var(--gt-dock))]"
          style={{ '--gt-dock': `${dockRem + pillRem}rem` } as CSSProperties}
        >
          <Outlet />
        </main>
        <ResumePill workout={workout} live={live} rest={timer} bottom={pillBottom} />
        <RestDock timer={timer} bottom={dockBottom} />
      </div>
    </DockOffsetContext.Provider>
  )
}
