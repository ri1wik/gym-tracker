// Small presentational pieces shared by the logger screens: a bottom sheet,
// the check icon, the image placeholder and the toast stack.

import { useEffect, type ReactNode } from 'react'

export function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: ReactNode; label?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        className="gt-sheet relative z-10 max-h-[88dvh] w-full max-w-screen-sm overflow-y-auto rounded-t-sheet border-t border-line-strong bg-surface-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
      >
        <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-surface-3" aria-hidden="true" />
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-[22px] font-semibold leading-tight">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-11 min-w-11 items-center justify-center rounded-control px-3 text-[15px] font-semibold text-ink-2">
            Close
          </button>
        </div>
        <div className="px-4 pt-3">{children}</div>
      </div>
    </div>
  )
}

export function CheckIcon({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  )
}

/** The exercise or machine image slot: a fixed box so nothing shifts when media lands. */
export function ImageSlot({ label, size = 72, className = '' }: { label: string; size?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-control bg-surface-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3 ${className}`}
      style={{ width: size, height: size }}
    >
      {label}
    </div>
  )
}

export interface ToastItem {
  id: number
  text: string
  tone: 'mint' | 'ink' | 'rose'
  action?: { label: string; onPress: () => void }
}

export function ToastStack({ toasts, bottom }: { toasts: ToastItem[]; bottom: string }) {
  if (toasts.length === 0) return null
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center gap-2 px-4" style={{ bottom }}>
      {toasts.slice(-2).map((t) => (
        <div
          key={t.id}
          className={[
            'gt-toast pointer-events-auto flex h-14 w-full max-w-screen-sm items-center gap-3 rounded-card border border-line-strong bg-surface-2 pr-2 pl-0 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]',
          ].join(' ')}
        >
          <span className={['h-full w-[3px] rounded-l-card', t.tone === 'mint' ? 'bg-mint' : t.tone === 'rose' ? 'bg-rose' : 'bg-ink-2'].join(' ')} aria-hidden="true" />
          <span className="num flex-1 text-[15px] font-semibold">{t.text}</span>
          {t.action && (
            <button type="button" onClick={t.action.onPress} className="flex h-11 min-w-11 items-center justify-center rounded-control px-3 text-[15px] font-semibold text-accent-text">
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
