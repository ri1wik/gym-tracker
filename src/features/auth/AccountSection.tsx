import { useState } from 'react'
import { deleteAccount, signInWithGoogle, signOut, useAuth } from '../../app/auth/session'
import { GUEST_USER_ID } from '../../data/db'

// OWNER: data-sync. Imported by the You tab (ui-profile-checkin). Shows the
// signed-in account, sign out (which deletes the local database) and the
// two-step delete account. Keep the export name; add props as needed.

export function AccountSection() {
  const auth = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'out' | 'delete' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const signedIn = auth.userId !== GUEST_USER_ID

  return (
    <div className="rounded-card border border-line bg-surface-1 p-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Account</div>

      {!auth.configured ? (
        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
          This build runs without a cloud account. Everything stays on this device.
        </p>
      ) : !signedIn ? (
        <div className="mt-2 space-y-3">
          <p className="text-[15px] leading-relaxed text-ink-2">
            Not signed in. Sign in to keep your data in your own account and on every device.
          </p>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="h-12 w-full rounded-control bg-accent text-[16px] font-semibold text-on-accent"
          >
            Sign in with Google
          </button>
          {auth.error ? <p className="text-[14px] text-rose-text">{auth.error}</p> : null}
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-[17px] font-semibold">{auth.email ?? auth.displayName ?? 'Signed in'}</p>
          <p className="text-[13px] leading-relaxed text-ink-3">
            Only you can open your rows and photos from the app. The developer can see them through the project dashboard.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('out')
              await signOut()
              setBusy(null)
            }}
            className="h-12 w-full rounded-control border border-line bg-surface-2 text-[16px] font-semibold text-ink-1 disabled:opacity-60"
          >
            {busy === 'out' ? 'Signing out' : 'Sign out of this device'}
          </button>

          {!confirming ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setConfirming(true)}
              className="h-11 w-full rounded-control text-[15px] font-semibold text-rose-text"
            >
              Delete account
            </button>
          ) : (
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-rose-text">Delete account</div>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
                This removes your account, every entry and every photo from the cloud and from this device. There is no undo.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setConfirming(false)
                    setProblem(null)
                  }}
                  className="h-12 flex-1 rounded-control border border-line bg-surface-1 text-[16px] font-semibold text-ink-1"
                >
                  Keep my account
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('delete')
                    const err = await deleteAccount()
                    setProblem(err)
                    setBusy(null)
                    if (!err) setConfirming(false)
                  }}
                  className="h-12 flex-1 rounded-control bg-rose text-[16px] font-semibold text-on-accent disabled:opacity-60"
                >
                  {busy === 'delete' ? 'Deleting' : 'Delete everything'}
                </button>
              </div>
              {problem ? (
                <p className="mt-3 text-[14px] text-ink-2">
                  Needs attention: {problem} Check the connection and try again.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
