// Exercise search for the add-exercise sheet: name, aliases and body part,
// recents first (docs/SPEC-retention-priority.md, "exercise search quality").
// Pure: the sheet passes the entries and the recent ids.

export interface SearchEntry {
  id: string
  name: string
  bodyPart: string
  aliases: readonly string[]
}

export interface SearchResult extends SearchEntry {
  recent: boolean
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Lower is better; null means no match. */
function scoreEntry(e: SearchEntry, q: string): number | null {
  const name = norm(e.name)
  const aliases = e.aliases.map(norm)
  const part = norm(e.bodyPart)
  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length === 0) return 0
  let best: number | null = null
  const consider = (text: string, base: number) => {
    if (text === q) best = Math.min(best ?? 99, base)
    else if (text.startsWith(q)) best = Math.min(best ?? 99, base + 1)
    else if (text.split(' ').some((w) => w.startsWith(q))) best = Math.min(best ?? 99, base + 2)
    else if (tokens.every((t) => text.includes(t))) best = Math.min(best ?? 99, base + 3)
  }
  for (const a of aliases) consider(a, 0)
  consider(name, 0)
  consider(part, 10)
  return best
}

/**
 * An empty query lists recents first, then the library in the order given.
 * A query ranks exact alias or name matches first, then prefix and word
 * matches; among equal scores recents come first, then the given order.
 */
export function searchExercises(query: string, entries: readonly SearchEntry[], recentIds: readonly string[]): SearchResult[] {
  const q = norm(query)
  const recentRank = new Map(recentIds.map((id, i) => [id, i]))
  const scored: { r: SearchResult; score: number; order: number }[] = []
  entries.forEach((e, order) => {
    const score = q === '' ? 0 : scoreEntry(e, q)
    if (score === null) return
    scored.push({ r: { ...e, recent: recentRank.has(e.id) }, score, order })
  })
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    const ra = recentRank.get(a.r.id) ?? Number.MAX_SAFE_INTEGER
    const rb = recentRank.get(b.r.id) ?? Number.MAX_SAFE_INTEGER
    if (ra !== rb) return ra - rb
    return a.order - b.order
  })
  return scored.map((s) => s.r)
}
