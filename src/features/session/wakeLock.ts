// Screen Wake Lock while a session is open, re-requested whenever the page
// becomes visible again (the lock is released by the browser on every hide).

import { useEffect } from 'react'

interface SentinelLike {
  release: () => Promise<void>
  addEventListener?: (type: 'release', cb: () => void) => void
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<SentinelLike> } }
    if (!nav.wakeLock) return
    let sentinel: SentinelLike | null = null
    let stopped = false
    const request = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        sentinel = await nav.wakeLock!.request('screen')
      } catch {
        // low battery or a non-secure context; the screen simply dims
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel) void sentinel.release().catch(() => undefined)
    }
  }, [active])
}
