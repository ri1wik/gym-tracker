// Route paths as constants so links never carry a typed string. Kept apart
// from routes.tsx so feature screens can import them without a cycle.
//
// OWNER: architect. Add a path here and register it in routes.tsx.

export const PATHS = {
  home: '/',
  onboarding: '/onboarding',
  signin: '/signin',
  train: '/train',
  trainProgram: '/train/program',
  trainLibrary: '/train/library',
  trainHistory: '/train/history',
  exercise: (id: string) => `/train/exercise/${id}`,
  machine: (id: string) => `/train/machine/${id}`,
  session: (id: string) => `/session/${id}`,
  checkin: '/checkin',
  food: '/food',
  progress: '/progress',
  you: '/you',
} as const
