// OWNER: data-sync. Imported by the You tab (ui-profile-checkin). Shows the
// signed-in account, sign out (which deletes the local database), export
// and delete account. Keep the export name; add props as needed.

export function AccountSection() {
  return (
    <div className="rounded-card border border-line bg-surface-1 p-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Account</div>
      <p className="mt-1 text-[15px] text-ink-2">Sign in with Google arrives with the sync builder.</p>
    </div>
  )
}
