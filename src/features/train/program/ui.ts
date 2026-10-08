// Class strings shared by the Program screen, the split sheet and Home.
// Semantic tokens only; every tap target is at least 44 px. The trailing !
// on text utilities is deliberate: app.css resets `button { font: inherit;
// color: inherit }` outside any cascade layer, which would otherwise beat
// Tailwind's layered text size, weight and colour on every <button>.

export const PRIMARY_BUTTON =
  'inline-flex h-14 w-full items-center justify-center rounded-control bg-accent px-4 text-[17px]! font-bold! text-on-accent! active:bg-accent-pressed disabled:opacity-60'

export const SECONDARY_BUTTON =
  'inline-flex h-11 items-center justify-center rounded-control bg-surface-3 px-4 text-[15px]! font-semibold! text-ink-1! active:bg-surface-2 disabled:opacity-60'

export const CARD = 'rounded-card border border-line bg-surface-1 p-4'

export function chipClass(selected: boolean): string {
  return [
    'inline-flex h-11 min-w-11 items-center justify-center rounded-control px-3 text-[15px]! font-semibold!',
    selected ? 'bg-accent text-on-accent!' : 'bg-surface-2 text-ink-1!',
  ].join(' ')
}
