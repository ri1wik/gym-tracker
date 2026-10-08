// A downloadable calendar file with the next check-in days, so the reminder
// follows "last check-in plus 4 days" instead of a fixed repeating rule that
// drifts the first time one is late (docs/SPEC-critic-fixes.md).

import { addDays, parseDateKey } from '../../domain/dates'
import type { DateKey } from '../../domain/types'

function compactDate(key: DateKey): string {
  const p = parseDateKey(key)
  const m = p.month < 10 ? `0${p.month}` : String(p.month)
  const d = p.day < 10 ? `0${p.day}` : String(p.day)
  return `${p.year}${m}${d}`
}

function compactTime(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60)
  const m = minuteOfDay % 60
  return `${h < 10 ? '0' : ''}${h}${m < 10 ? '0' : ''}${m}00`
}

export interface IcsInput {
  /** First due day. */
  firstDue: DateKey
  intervalDays: number
  /** How many due days to include. */
  count: number
  /** Minutes after midnight, local time. */
  minuteOfDay: number
  /** ISO timestamp of now, for DTSTAMP. */
  nowIso: string
}

export function buildCheckinIcs(i: IcsInput): string {
  const stamp = i.nowIso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const startTime = compactTime(i.minuteOfDay)
  const endTime = compactTime((i.minuteOfDay + 15) % 1440)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Recomp//Check-in reminders//EN', 'CALSCALE:GREGORIAN']
  for (let n = 0; n < i.count; n++) {
    const day = addDays(i.firstDue, n * i.intervalDays)
    const date = compactDate(day)
    lines.push(
      'BEGIN:VEVENT',
      `UID:checkin-${date}@recomp`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${startTime}`,
      `DTEND:${date}T${endTime}`,
      'SUMMARY:Weigh-in and check-in',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Weigh-in and check-in',
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
