import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PATHS } from '../../app/paths'
import { signInWithGoogle, useAuth } from '../../app/auth/session'
import { GUEST_USER_ID } from '../../data/db'

// OWNER: data-sync. Full-screen route outside the Shell. Google by redirect
// (never a popup: popups fail inside installed apps). Guest mode is one tap
// away because the app must work with no account at all.

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="currentColor" opacity=".9" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="currentColor" opacity=".7" />
      <path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" fill="currentColor" opacity=".5" />
      <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" fill="currentColor" opacity=".6" />
    </svg>
  )
}

export function SignInScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const signedIn = auth.userId !== GUEST_USER_ID

  const start = async () => {
    setBusy(true)
    await signInWithGoogle()
    // On success the browser leaves this page; only a problem lands here.
    setBusy(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col justify-end gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex-1" />
      <header className="space-y-2">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Your data, on every device</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Sign in once and your phone and laptop show the same sessions, check-ins and food. The app keeps working in a gym with no signal and catches up when you are back online.
        </p>
      </header>

      {signedIn ? (
        <div className="space-y-3">
          <div className="rounded-card border border-line bg-surface-1 p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Signed in</div>
            <p className="mt-1 text-[17px] font-semibold">{auth.email ?? auth.displayName ?? 'Your account'}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(PATHS.home, { replace: true })}
            className="h-14 w-full rounded-control bg-accent text-[16px] font-semibold text-on-accent"
          >
            Continue
          </button>
        </div>
      ) : auth.configured ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-control bg-accent text-[16px] font-semibold text-on-accent disabled:opacity-60"
          >
            <GoogleMark />
            {busy ? 'Opening Google' : 'Sign in with Google'}
          </button>
          {auth.error ? (
            <div className="rounded-card border border-line bg-surface-1 p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-rose-text">Needs attention</div>
              <p className="mt-1 text-[15px] text-ink-2">{auth.error}</p>
              <p className="mt-1 text-[14px] text-ink-2">Try again, or continue without an account and sign in later from the You tab.</p>
            </div>
          ) : null}
          <Link
            to={PATHS.home}
            className="flex h-12 w-full items-center justify-center rounded-control border border-line bg-surface-2 text-[16px] font-semibold text-ink-1"
          >
            Continue without an account
          </Link>
          <p className="text-[13px] leading-relaxed text-ink-3">
            Without an account everything stays on this device. When you sign in later the app offers to move it across.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-card border border-line bg-surface-1 p-4">
            <p className="text-[15px] leading-relaxed text-ink-2">
              This build has no cloud account set up, so everything stays on this device. The owner adds the backend keys to turn sign-in on.
            </p>
          </div>
          <Link
            to={PATHS.home}
            className="flex h-14 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent"
          >
            Continue
          </Link>
        </div>
      )}
    </main>
  )
}
