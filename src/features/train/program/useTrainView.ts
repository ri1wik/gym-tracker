import { useLiveQuery } from 'dexie-react-hooks'
import { todayKey } from '../../../domain/dates'
import { loadTrainView, type TrainView } from './data'
import { programDb } from './store'

// The last view read, keyed by database and day, so a second mount (a tab
// switch back to Home or Program) renders synchronously from memory with no
// skeleton frame; the live query then refreshes it.
let cache: { key: string; view: TrainView } | null = null

/** Live read model; undefined while the very first read of this page load is in flight. */
export function useTrainView(): { view: TrainView | undefined; today: string } {
  const today = todayKey()
  const db = programDb()
  const key = `${db.userId}:${today}`
  const view = useLiveQuery(
    async () => {
      const v = await loadTrainView(db, today)
      cache = { key, view: v }
      return v
    },
    [key],
    cache?.key === key ? cache.view : undefined,
  )
  return { view, today }
}
