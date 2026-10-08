import { RouterProvider } from 'react-router-dom'
import { router } from './app/routes'
import { AuthGate } from './features/auth/AuthGate'

export function App() {
  return (
    <AuthGate>
      <RouterProvider router={router} />
    </AuthGate>
  )
}
