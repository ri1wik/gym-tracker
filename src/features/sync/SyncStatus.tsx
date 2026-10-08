import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../../app/auth/session'
import { GUEST_USER_ID } from '../../data/db'
import { currentDb } from '../../data/sync/current'
import { syncNow } from '../../data/sync/engine'
import { discardDeadItem, retryDeadItem } from '../../data/sync/flush'
import { useSyncState } from '../../data/sync/status'
import type { OutboxItem } from '../../domain/types'

// OWNER: data-sync. Imported by the You tab (ui-profile-checkin). Shows
// "Synced", "N changes waiting" or the dead-letter list with Retry and
// Discard per item, never a bare count. Keep the props shape; add to it.

export interface SyncStatusProps {
  /** Compact: one line for the You tab list. Full: the dead-letter list. */
  variant?: 'compact' | 'full'
}

const TABLE_LABEL: Record<string, string> = {
  profiles: 'Profile',
  body_weights: 'Weigh-in',
  photos: 'Photo',
  programs: 'Program',
  workouts: 'Session',
  workout_sets: 'Set',
  cardio_sessions: 'Cardio',
  machine_settings: 'Machine setting',
  gym_profiles: 'Gym profile',
  foods: 'Food',
  portions: 'Portion',
  favourites: 'Favourite',
  food_logs: 'Food log',
}

function itemLabel(item: OutboxItem): string {
  const base = TABLE_LABEL[item.table] ?? item.table
  if (item.op === 'upload') return `${base} file`
  const key = typeof item.payload.date_key === 'string' ? item.payload.date_key : null
  return key ? `${base} ${key}` : base
}

/** "just now", "4 min ago", "2 h ago", "3 d ago". Numbers wear .num. */
function Ago({ iso, now }: { iso: string; now: number }) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return <>just now</>
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return <>just now</>
  const m = Math.round(s / 60)
  if (m < 60) return (<><span className="num">{m}</span> min ago</>)
  const h = Math.round(m / 60)
  if (h < 48) return (<><span className="num">{h}</span> h ago</>)
  const d = Math.round(h / 24)
  return (<><span className="num">{d}</span> d ago</>)
}

export function SyncStatus({ variant = 'compact' }: SyncStatusProps) {
  const auth = useAuth()
  const sync = useSyncState()
  const signedIn = auth.userId !== GUEST_USER_ID
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const counts = useLiveQuery(
    async () => {
      const db = currentDb()
      const pending = await db.outbox.where('state').anyOf(['pending', 'in_flight']).count()
      const dead = await db.outbox.where('state').equals('dead').toArray()
      return { pending, dead }
    },
    [auth.userId],
    { pending: 0, dead: [] as OutboxItem[] },
  )
  const pending = counts?.pending ?? 0
  const dead = counts?.dead ?? []

  let line: React.ReactNode
  if (!auth.configured) line = 'Local only. This build has no cloud account.'
  else if (!signedIn) line = 'Local only. Sign in to keep this on every device.'
  else if (sync.needsSignIn) line = 'Needs attention: the session expired. Sign in again to resume syncing.'
  else if (dead.length > 0)
    line = (
      <>
        Needs attention: <span className="num">{dead.length}</span> {dead.length === 1 ? 'change' : 'changes'} could not sync. Retry or discard each one below.
      </>
    )
  else if (sync.inFlight) line = 'Syncing'
  else if (!sync.online && pending > 0)
    line = (
      <>
        Offline. <span className="num">{pending}</span> {pending === 1 ? 'change' : 'changes'} waiting for a connection.
      </>
    )
  else if (!sync.online) line = 'Offline. Everything is saved on this device.'
  else if (pending > 0)
    line = (
      <>
        <span className="num">{pending}</span> {pending === 1 ? 'change' : 'changes'} waiting.
      </>
    )
  else if (sync.lastSyncAt)
    line = (
      <>
        Synced <Ago iso={sync.lastSyncAt} now={now} />.
      </>
    )
  else line = 'Signed in. The first sync runs when you are online.'

  const attention = (signedIn && (dead.length > 0 || sync.needsSignIn)) || false

  return (
    <div className="rounded-card border border-line bg-surface-1 p-4" data-variant={variant}>
      <div className="flex items-center justify-between gap-3">
        <div className={`text-[12px] font-semibold uppercase tracking-[0.06em] ${attention ? 'text-rose-text' : 'text-ink-3'}`}>Sync</div>
        {signedIn && auth.configured ? (
          <button
            type="button"
            disabled={sync.inFlight || !sync.online}
            onClick={() => void syncNow('manual')}
            className="h-11 rounded-control px-3 text-[15px] font-semibold text-accent-text disabled:opacity-50"
          >
            Sync now
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{line}</p>
      {signedIn && sync.lastError && dead.length === 0 && !sync.needsSignIn ? (
        <p className="mt-1 text-[13px] text-ink-3">Last try: {sync.lastError}. It retries on its own.</p>
      ) : null}

      {variant === 'full' && dead.length > 0 ? (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {dead.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{itemLabel(item)}</div>
                <div className="truncate text-[13px] text-ink-3">{item.last_error ?? 'Rejected by the server'}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await retryDeadItem(currentDb(), item.id)
                  void syncNow('retry')
                }}
                className="h-11 rounded-control px-3 text-[15px] font-semibold text-accent-text"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => void discardDeadItem(currentDb(), item.id)}
                className="h-11 rounded-control px-3 text-[15px] font-semibold text-rose-text"
              >
                Discard
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
