import { useParams } from 'react-router-dom'
import { Placeholder } from '../../../components/Placeholder'

// OWNER: ui-library. Route: /train/exercise/:id (an id from exercise-index.ts).

export function ExerciseDetailScreen() {
  const { id } = useParams()
  return <Placeholder title="Exercise" line={`Detail for ${id ?? 'an exercise'}: images, cue, how-to, history. Arrives with the library builder.`} />
}
