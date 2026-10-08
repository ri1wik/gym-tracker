import { useParams } from 'react-router-dom'
import { Placeholder } from '../../../components/Placeholder'

// OWNER: ui-library. Route: /train/machine/:id (an id from machine-index.ts).

export function MachineDetailScreen() {
  const { id } = useParams()
  return <Placeholder title="Machine" line={`Detail for ${id ?? 'a machine'}: photo, setup, your saved settings. Arrives with the library builder.`} />
}
