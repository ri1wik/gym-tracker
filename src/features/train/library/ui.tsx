import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { imageAttrs } from './images'

// OWNER: ui-library. Small shared pieces for the library screens.

/**
 * An image in a box of fixed aspect. A missing file (or no path at all) shows
 * a neutral placeholder of the same size, so a grid never jumps or breaks.
 */
export function ImageBox({
  path,
  alt,
  aspect,
  sizes,
  fallbackLabel,
  eager = false,
  fit = 'cover',
  className = '',
}: {
  path: string | null | undefined
  alt: string
  /** CSS aspect-ratio, for example "4 / 3". */
  aspect: string
  sizes: string
  fallbackLabel?: string
  eager?: boolean
  fit?: 'cover' | 'contain'
  className?: string
}) {
  const [broken, setBroken] = useState<string | null>(null)
  const showImage = path && broken !== path
  return (
    <div
      className={`relative w-full overflow-hidden bg-surface-2 ${className}`}
      style={{ aspectRatio: aspect }}
    >
      {showImage ? (
        <img
          {...imageAttrs(path, sizes)}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setBroken(path)}
          className={`absolute inset-0 h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex items-center justify-center p-2 text-center text-[12px] font-semibold text-ink-3"
        >
          {fallbackLabel ?? ''}
        </div>
      )}
    </div>
  )
}

export function BackButton({ label = 'Back', fallback }: { label?: string; fallback: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        // Opened from a link with nothing behind it? Go to the library instead of leaving the app.
        if (window.history.length > 1) navigate(-1)
        else navigate(fallback)
      }}
      className="-ml-2 inline-flex h-11 items-center gap-1 rounded-control px-2 text-[15px] font-semibold text-ink-2 hover:text-ink-1"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      {label}
    </button>
  )
}

export function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control px-4 text-[15px] font-semibold',
        active ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2 hover:text-ink-1',
      ].join(' ')}
    >
      {children}
      {count !== undefined && <span className="num text-[13px] opacity-80">{count}</span>}
    </button>
  )
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-control border border-line bg-surface-1 pl-4 pr-12 text-ink-1 placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-ink-2"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[17px] font-bold tracking-tight text-ink-1">{children}</h2>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface-1 ${className}`}>{children}</div>
}
