import { useState, type ReactNode } from 'react'
import { acceptGuestRows, declineGuestRows, discardGuestRows, useAuth } from '../../app/auth/session'

// OWNER: data-sync. Wraps the router. It is not a wall: guest mode is a
// first-class way to use the app. Its one job after boot is the offer that
// follows a first sign-in: move what the guest logged into the account.

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [moved, setMoved] = useState<number | null>(null)

  if (!auth.ready) return null

  const n = auth.guestRowsToOffer
  return (
    <>
      {children}
      {n !== null ? (
        <div role="dialog" aria-modal="true" aria-labelledby="guest-move-title" className="fixed inset-0 z-40 flex items-end justify-center bg-bg/70 backdrop-blur-sm">
          <div className="w-full max-w-screen-sm rounded-t-sheet border border-line bg-surface-2 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-[5px] w-9 rounded-full bg-surface-3" aria-hidden="true" />
            <h2 id="guest-move-title" className="text-[20px] font-bold leading-tight">
              Move <span className="num">{n}</span> {n === 1 ? 'entry' : 'entries'} into your account?
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              They were logged on this device before you signed in. Moving them puts them in your account and on every device. You can also leave them for now and decide later.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const count = await acceptGuestRows()
                  setMoved(count)
                  setBusy(false)
                }}
                className="h-14 w-full rounded-control bg-accent text-[16px] font-semibold text-on-accent disabled:opacity-60"
              >
                {busy ? 'Moving' : 'Move them'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => declineGuestRows()}
                className="h-12 w-full rounded-control border border-line bg-surface-1 text-[16px] font-semibold text-ink-1"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void discardGuestRows()}
                className="h-11 w-full rounded-control text-[15px] font-semibold text-rose-text"
              >
                Leave them out for good
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {moved !== null ? (
        <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex h-14 max-w-screen-sm items-center gap-3 rounded-control border border-line bg-surface-2 px-4 text-[15px] font-semibold">
          <span className="h-full w-[3px] rounded-full bg-mint" aria-hidden="true" />
          <span>
            Moved <span className="num">{moved}</span> {moved === 1 ? 'entry' : 'entries'} into your account.
          </span>
          <button type="button" onClick={() => setMoved(null)} className="ml-auto h-11 px-2 text-accent-text">
            Done
          </button>
        </div>
      ) : null}
    </>
  )
}
