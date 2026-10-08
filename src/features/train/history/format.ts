// Date labels for history rows from a day key and a start time. The key is
// split by the shared helper, never parsed by Date.

import { parseDateKey, weekdayOf } from '../../../domain/dates'
import type { DateKey } from '../../../domain/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Thu 8 Oct, 10:02" */
export function dateLabelOf(key: DateKey, startedAt: string): string {
  const { month, day } = parseDateKey(key)
  const d = new Date(startedAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${DAYS[weekdayOf(key)]} ${day} ${MONTHS[month - 1]}, ${hh}:${mm}`
}
