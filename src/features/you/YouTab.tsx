import { getStoredTheme, setTheme, type Theme } from '../../app/theme'
import { useState } from 'react'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

export function YouTab() {
  const [theme, setLocal] = useState<Theme>(() => getStoredTheme())
  return (
    <section className="space-y-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">You</h1>
      <div className="rounded-card border border-line bg-surface-1 p-4">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Theme</div>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => {
            const active = theme === t.value
            return (
              <button
                key={t.value}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setTheme(t.value)
                  setLocal(t.value)
                }}
                className={[
                  'h-11 flex-1 rounded-control border text-[15px] font-semibold',
                  active ? 'border-accent bg-accent/15 text-accent-text' : 'border-line bg-surface-2 text-ink-2',
                ].join(' ')}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <p className="text-[14px] leading-relaxed text-ink-2">
        Profile, targets, sign-in, sync status and export arrive with the next milestones.
      </p>
      <p className="text-[12px] text-ink-3">
        Exercise data by <a className="underline" href="https://repdb.co">RepDB (repdb.co)</a>. Food composition data from USDA FoodData Central.
      </p>
    </section>
  )
}
