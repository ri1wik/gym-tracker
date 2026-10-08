export type Theme = 'auto' | 'dark' | 'light'

// Every local storage key is prefixed because ri1wik.github.io hosts other
// sites on the same origin.
const KEY = 'gt:theme'

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light' || v === 'auto') return v
  } catch {
    // storage can be unavailable in private windows; fall through
  }
  return 'auto'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // ignore
  }
  applyTheme(theme)
}

export function applyStoredTheme() {
  applyTheme(getStoredTheme())
}
