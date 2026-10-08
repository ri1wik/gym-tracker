// Per-device conveniences read by the logger. The You tab owns the toggles;
// this slice only reads the prefixed keys.

export const LEFT_HANDED_KEY = 'gt:left-handed'

/** Mirror the set row so the done check sits on the left. */
export function isLeftHanded(): boolean {
  try {
    return localStorage.getItem(LEFT_HANDED_KEY) === '1'
  } catch {
    return false
  }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
