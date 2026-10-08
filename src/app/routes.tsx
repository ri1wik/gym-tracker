import { createHashRouter, Navigate } from 'react-router-dom'
import { PATHS } from './paths'
import { Shell } from './Shell'
import { HomeTab } from '../features/home/HomeTab'
import { TrainTab } from '../features/train/TrainTab'
import { ProgramScreen } from '../features/train/program/ProgramScreen'
import { LibraryScreen } from '../features/train/library/LibraryScreen'
import { ExerciseDetailScreen } from '../features/train/library/ExerciseDetailScreen'
import { MachineDetailScreen } from '../features/train/library/MachineDetailScreen'
import { HistoryScreen } from '../features/train/history/HistoryScreen'
import { FoodTab } from '../features/food/FoodTab'
import { ProgressTab } from '../features/progress/ProgressTab'
import { YouTab } from '../features/you/YouTab'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { SignInScreen } from '../features/auth/SignInScreen'
import { SessionScreen } from '../features/session/SessionScreen'
import { CheckinScreen } from '../features/checkin/CheckinScreen'

// A hash router needs no redirect tricks on GitHub Pages and keeps deep
// links working before the service worker is installed.
//
// OWNER: architect. Every path below is registered here once; UI builders
// own the component files, never this tree. Paths live in ./paths.ts.

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
