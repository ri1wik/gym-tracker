// The install moment (PLAN.md section 2: the install banner appears once,
// after the first finished workout, never before). Android fires
// beforeinstallprompt early in the page load, so it is captured here from
// main.tsx and replayed when the card asks for it; iOS has no prompt API and
// gets the Share > Add to Home Screen steps instead. Standalone detection
// hides the card for good once the app is installed.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

/** Call once at boot, before React mounts, so the event is never missed. */
export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True when the app runs as an installed copy (home screen icon). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    // no matchMedia: fall through
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** True when the native prompt is available (Android Chrome and friends). */
export function canPromptInstall(): boolean {
  return deferred !== null
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** Show the native prompt once. Resolves what the user chose, or 'unavailable'. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred
  if (!e) return 'unavailable'
  deferred = null
  try {
    await e.prompt()
    const { outcome } = await e.userChoice
    return outcome
  } catch {
    return 'dismissed'
  } finally {
    emit()
  }
}

let persistAsked = false

/**
 * Ask the browser to keep this origin's storage (never evict IndexedDB under
 * pressure). Called after the first saved workout; harmless to repeat, so a
 * module flag keeps it to one request per page load. Never rejects.
 */
export function requestPersistentStorage(): void {
  if (persistAsked || typeof navigator === 'undefined') return
  persistAsked = true
  try {
    const storage = navigator.storage
    if (storage && typeof storage.persist === 'function') void storage.persist().catch(() => undefined)
  } catch {
    // not available: nothing to do
  }
}
