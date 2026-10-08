// Per-device conveniences read by the logger and written by the You tab's
// settings card. Prefixed localStorage keys (this origin hosts other sites);
// every read is wrapped because storage can be blocked or full.

export const LEFT_HANDED_KEY = 'gt:left-handed'
export const HAPTICS_KEY = 'gt:haptics'
export const REST_SOUND_KEY = 'gt:rest-sound'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // storage blocked: the default applies
  }
}

/** Mirror the set row so the done check sits on the left. Off by default. */
export function isLeftHanded(): boolean {
  return read(LEFT_HANDED_KEY) === '1'
}

export function setLeftHanded(on: boolean): void {
  writeFlag(LEFT_HANDED_KEY, on)
}

/** Vibration on the tick, the set-complete and the rest end. On by default where the device has it. */
export function hapticsEnabled(): boolean {
  return read(HAPTICS_KEY) !== '0'
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(HAPTICS_KEY, on ? '1' : '0')
  } catch {
    // storage blocked: the default applies
  }
}

/** The rest-end tone. Off by default (docs/SPEC-design-system.md: an optional beep, off by default). */
export function restSoundEnabled(): boolean {
  return read(REST_SOUND_KEY) === '1'
}

export function setRestSoundEnabled(on: boolean): void {
  writeFlag(REST_SOUND_KEY, on)
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
