// The check-in reminder time is a per-device convenience (the reminder is a
// calendar file on this device), so it lives in local storage under the app
// prefix. The profile has no column for it.

const KEY = 'gt:checkin-reminder-minute'
export const DEFAULT_REMINDER_MINUTE = 7 * 60

export function getReminderMinute(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) {
      const n = Number(raw)
      if (Number.isInteger(n) && n >= 0 && n < 1440) return n
    }
  } catch {
    // storage can be unavailable; fall through to the default
  }
  return DEFAULT_REMINDER_MINUTE
}

export function setReminderMinute(minute: number): void {
  try {
    localStorage.setItem(KEY, String(minute))
  } catch {
    // ignore
  }
}
