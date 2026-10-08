import { lazy, Suspense, type ComponentType } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import { PATHS } from './paths'
import { Shell } from './Shell'
import { HomeTab } from '../features/home/HomeTab'
import { TrainTab } from '../features/train/TrainTab'
import { ProgramScreen } from '../features/train/program/ProgramScreen'

// A hash router needs no redirect tricks on GitHub Pages and keeps deep
// links working before the service worker is installed.
//
// Home, the Shell and the Program screen are in the first chunk; every
// other screen loads on first visit (and is precached by the service
// worker, so the gym with no signal still opens them). This keeps the first
// paint under the 200 KB budget and the charts off every route but Progress.
//
// OWNER: architect. Every path below is registered here once; UI builders
// own the component files, never this tree. Paths live in ./paths.ts.

function screen<P extends object>(load: () => Promise<Record<string, unknown>>, name: string) {
  const L = lazy(async () => {
    const mod = await load()
    return { default: mod[name] as ComponentType<P> }
  })
  return function Screen(props: P) {
    return (
      <Suspense fallback={<div aria-busy="true" className="min-h-dvh bg-bg" />}>
        <L {...props} />
      </Suspense>
    )
  }
}

const LibraryScreen = screen(() => import('../features/train/library/LibraryScreen'), 'LibraryScreen')
const ExerciseDetailScreen = screen(() => import('../features/train/library/ExerciseDetailScreen'), 'ExerciseDetailScreen')
const MachineDetailScreen = screen(() => import('../features/train/library/MachineDetailScreen'), 'MachineDetailScreen')
const HistoryScreen = screen(() => import('../features/train/history/HistoryScreen'), 'HistoryScreen')
const FoodTab = screen(() => import('../features/food/FoodTab'), 'FoodTab')
const ProgressTab = screen(() => import('../features/progress/ProgressTab'), 'ProgressTab')
const YouTab = screen(() => import('../features/you/YouTab'), 'YouTab')
const OnboardingScreen = screen(() => import('../features/onboarding/OnboardingScreen'), 'OnboardingScreen')
const SignInScreen = screen(() => import('../features/auth/SignInScreen'), 'SignInScreen')
const SessionScreen = screen(() => import('../features/session/SessionScreen'), 'SessionScreen')
const CheckinScreen = screen(() => import('../features/checkin/CheckinScreen'), 'CheckinScreen')

export const router = createHashRouter([
  // Full-screen flows without the tab bar.
  { path: PATHS.onboarding, element: <OnboardingScreen /> },
  { path: PATHS.signin, element: <SignInScreen /> },
  { path: '/session/:id', element: <SessionScreen /> },
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <HomeTab /> },
      {
        path: 'train',
        element: <TrainTab />,
        children: [
          { index: true, element: <Navigate to={PATHS.trainProgram} replace /> },
          { path: 'program', element: <ProgramScreen /> },
          { path: 'library', element: <LibraryScreen /> },
          { path: 'history', element: <HistoryScreen /> },
        ],
      },
      { path: 'train/exercise/:id', element: <ExerciseDetailScreen /> },
      { path: 'train/machine/:id', element: <MachineDetailScreen /> },
      { path: 'checkin', element: <CheckinScreen /> },
      { path: 'food', element: <FoodTab /> },
      { path: 'progress', element: <ProgressTab /> },
      { path: 'you', element: <YouTab /> },
    ],
  },
])
