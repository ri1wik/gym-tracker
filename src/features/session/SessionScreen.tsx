import { useParams } from 'react-router-dom'
import { Placeholder } from '../../components/Placeholder'

// OWNER: ui-logger. Route: /session/:id (a workouts row id). Full screen,
// no tab bar: this route sits outside the Shell in src/app/routes.tsx.

export function SessionScreen() {
  const { id } = useParams()
  return (
    <main className="min-h-dvh bg-bg px-4 pt-[max(1rem,env(safe-area-inset-top))] text-ink-1">
      <Placeholder title="Session" line={`Workout ${id ?? ''}: prefilled sets, steppers, warm-up rows, rest timer. Arrives with the logger.`} />
    </main>
  )
}
