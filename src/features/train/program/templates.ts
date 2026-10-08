// Template lookup for the Program screen and Home. The real catalogue is
// src/data/library/templates.json (content-templates slice). The glob below
// resolves to nothing while that file is absent, and the synthetic fixture
// stands in; once the file lands the fixture is never used.

import { SPLITS, type Template } from '../../../domain/types'
import { FALLBACK_TEMPLATES } from './fixtures'

const files = import.meta.glob<Template[]>('../../../data/library/templates.json', { eager: true, import: 'default' })

function isTemplate(t: unknown): t is Template {
  if (typeof t !== 'object' || t === null) return false
  const o = t as Partial<Template>
  return typeof o.key === 'string' && typeof o.name === 'string' && Array.isArray(o.days) && o.days.length > 0
}

function load(): Template[] {
  const raw = Object.values(files)[0]
  if (Array.isArray(raw)) {
    const good = raw.filter(isTemplate)
    if (good.length > 0) return good
  }
  return FALLBACK_TEMPLATES
}

/** The five templates, in the order of SPLITS where present. */
export const TEMPLATE_LIST: readonly Template[] = (() => {
  const all = load()
  const rank = (t: Template) => {
    const i = SPLITS.indexOf(t.split)
    return i < 0 ? SPLITS.length : i
  }
  return [...all].sort((a, b) => rank(a) - rank(b))
})()

export const DEFAULT_TEMPLATE_KEY = 'ppl_6'

export function templateByKey(key: string): Template | null {
  return TEMPLATE_LIST.find((t) => t.key === key) ?? null
}

/** Sets in one pass through a template day. */
export function daySetCount(day: Template['days'][number]): number {
  return day.items.reduce((n, it) => n + it.sets, 0)
}
