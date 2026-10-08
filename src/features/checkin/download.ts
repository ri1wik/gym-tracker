// Hands the browser a calendar file to save. Only called from a button tap.

import type { DateKey } from '../../domain/types'
import { buildCheckinIcs } from './ics'

export function downloadCheckinCalendar(firstDue: DateKey, intervalDays: number, minuteOfDay: number): void {
  const text = buildCheckinIcs({ firstDue, intervalDays, count: 12, minuteOfDay, nowIso: new Date().toISOString() })
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'checkin-reminders.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
