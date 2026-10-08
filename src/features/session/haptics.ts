// A tiny helper around navigator.vibrate (docs/SPEC-design-system.md):
// tick 10, confirm 20, success 30/40/30, timerEnd 100/50/100/50/200,
// error 50. Feature-detected (iOS Safari has no vibration even when
// installed, so nothing may rely on it alone) and switchable in the You tab.

import { hapticsEnabled } from './prefs'

export type HapticKind = 'tick' | 'confirm' | 'success' | 'timerEnd' | 'error'

export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 10,
  confirm: 20,
  success: [30, 40, 30],
  timerEnd: [100, 50, 100, 50, 200],
  error: 50,
}

/** True when this device can vibrate at all. */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Vibrate for one of the named moments; a no-op without the API or with haptics switched off. */
export function haptic(kind: HapticKind): void {
  if (!canVibrate() || !hapticsEnabled()) return
  try {
    navigator.vibrate(HAPTIC_PATTERNS[kind])
  } catch {
    // some browsers throw outside a user gesture; the moment still has its visual
  }
}
