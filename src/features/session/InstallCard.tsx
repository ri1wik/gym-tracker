// The install card on the first finish summary (PLAN.md section 2,
// docs/SPEC-retention-priority.md item 4): the honest reason, the native
// prompt where there is one, the Share > Add to Home Screen steps on iOS,
// and one dismissal that is remembered for good. Waits until the first
// workout has synced (or guest mode) before it appears.

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { canPromptInstall, isIos, promptInstall, subscribeInstall } from '../../app/install'
import { isGuest } from '../../data/sync/current'
import { sessionDb } from './write'

export interface InstallCardProps {
  /** Called once, whatever the answer; the caller records the moment. */
  onDone: () => void
}

export function InstallCard({ onDone }: InstallCardProps) {
  const [, bump] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => subscribeInstall(() => bump((n) => n + 1)), [])
  const pending = useLiveQuery(() => sessionDb().outbox.where('state').notEqual('dead').count(), [], undefined)

  const synced = isGuest() || pending === 0
  if (!synced) return null

  const native = canPromptInstall()
  const ios = isIos()

  const install = async () => {
    setBusy(true)
    await promptInstall()
    setBusy(false)
    onDone()
  }

  return (
    <section className="space-y-3 rounded-card border border-accent/40 bg-accent/10 p-4" aria-label="Add to home screen">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-accent-text">Keep your logs safe</p>
        <h2 className="mt-1 text-[20px] font-bold leading-tight">Add Recomp to your home screen</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
          A browser can clear a site's data after <span className="num">7</span> days without a visit. An installed copy keeps your logs, opens full screen and works in the gym with no signal.
        </p>
      </div>
      {ios && !native ? (
        <ol className="num list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-ink-1">
          <li>Tap Share at the bottom of Safari.</li>
          <li>Choose Add to Home Screen.</li>
          <li>Tap Add.</li>
        </ol>
      ) : null}
      <div className="flex flex-col gap-2">
        {native ? (
          <button type="button" disabled={busy} onClick={() => void install()} className="flex h-14 w-full items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent disabled:opacity-60">
            Install
          </button>
        ) : null}
        <button type="button" onClick={onDone} className="flex h-12 w-full items-center justify-center rounded-control bg-surface-2 text-[16px] font-semibold text-ink-1">
          {native ? 'Not now' : 'Got it'}
        </button>
      </div>
    </section>
  )
}
