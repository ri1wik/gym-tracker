// Typed loader for the five shipped programmes (templates.json).
//
// The rows satisfy the shared Template type and add two optional-to-read
// fields the programme screens use: `rotation` on the template (true when the
// same days are rolled over a shorter week, as in the 5-day push/pull/legs)
// and `pattern_focus` on each day (the movement patterns the day trains, in
// session order).

import type { MovementPattern, Template, TemplateDay } from '../../domain/types'
import raw from './templates.json'

export interface TemplateDayFull extends TemplateDay {
  /** The distinct movement patterns of the day's items, in session order. */
  pattern_focus: MovementPattern[]
}

export interface TemplateFull extends Template {
  /** True when the days roll over a week shorter than the rotation (ppl_5). */
  rotation: boolean
  days: TemplateDayFull[]
}

export const TEMPLATES: readonly TemplateFull[] = raw as unknown as TemplateFull[]

export const TEMPLATES_BY_KEY: Readonly<Record<string, TemplateFull>> = Object.fromEntries(
  TEMPLATES.map((t) => [t.key, t]),
)

export const DEFAULT_TEMPLATE_KEY = 'ppl_6'

/** The template for a key, or the default when the key is unknown. */
export function templateByKey(key: string): TemplateFull {
  return TEMPLATES_BY_KEY[key] ?? TEMPLATES_BY_KEY[DEFAULT_TEMPLATE_KEY]
}
