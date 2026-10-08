import { useLiveQuery } from 'dexie-react-hooks'
import { todayKey } from '../../../domain/dates'
import { loadTrainView, type TrainView } from './data'
import { programDb } from './store'

/** Live read model; undefined while the first read is in flight. */
export function useTrainView(): { view: TrainView | undefined; today: string } {
  const today = todayKey()
  const view = useLiveQuery(() => loadTrainView(programDb(), today), [today])
  return { view, today }
}
