// OWNER: data-sync. Imported by the You tab (ui-profile-checkin). Shows
// "Synced", "N changes waiting" or the dead-letter line with Retry and
// Discard per item, never a bare count. Keep the props shape; add to it.

export interface SyncStatusProps {
  /** Compact: one line for the You tab list. Full: the dead-letter list. */
  variant?: 'compact' | 'full'
}

export function SyncStatus({ variant = 'compact' }: SyncStatusProps) {
  return (
    <div className="rounded-card border border-line bg-surface-1 p-4" data-variant={variant}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Sync</div>
      <p className="mt-1 text-[15px] text-ink-2">Local only until sign-in arrives.</p>
    </div>
  )
}
