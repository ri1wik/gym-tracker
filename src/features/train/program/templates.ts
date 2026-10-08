// Template lookup for the Program screen and Home, over the shipped
// catalogue in src/data/library/templates.ts.

import { SPLITS, type Template } from '../../../domain/types'
import { TEMPLATES, DEFAULT_TEMPLATE_KEY, TEMPLATES_BY_KEY } from '../../../data/library/templates'

export { DEFAULT_TEMPLATE_KEY }

/** The five templates, in the order of SPLITS. */
export const TEMPLATE_LIST: readonly Template[] = (() => {
  const rank = (t: Template) => {
    const i = SPLITS.indexOf(t.split)
    return i < 0 ? SPLITS.length : i
  }
  return [...TEMPLATES].sort((a, b) => rank(a) - rank(b))
})()

export function templateByKey(key: string): Template | null {
  return TEMPLATES_BY_KEY[key] ?? null
}

/** Sets in one pass through a template day. */
export function daySetCount(day: Template['days'][number]): number {
  return day.items.reduce((n, it) => n + it.sets, 0)
}
