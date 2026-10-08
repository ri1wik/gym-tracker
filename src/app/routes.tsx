import { createHashRouter } from 'react-router-dom'
import { Shell } from './Shell'
import { HomeTab } from '../features/home/HomeTab'
import { TrainTab } from '../features/train/TrainTab'
import { FoodTab } from '../features/food/FoodTab'
import { ProgressTab } from '../features/progress/ProgressTab'
import { YouTab } from '../features/you/YouTab'

// A hash router needs no redirect tricks on GitHub Pages and keeps deep
// links working before the service worker is installed.
export const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <HomeTab /> },
      { path: 'train', element: <TrainTab /> },
      { path: 'food', element: <FoodTab /> },
      { path: 'progress', element: <ProgressTab /> },
      { path: 'you', element: <YouTab /> },
    ],
  },
])
