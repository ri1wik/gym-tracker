// OWNER: ui-library. Pure scoring for alias search, shared by the library,
// the equipment grid and the "What is this machine?" finder.

export interface Searchable {
  name: string
  aliases: readonly string[]
  /** Extra words that match with a lower weight: body part, muscle labels, category. */
  tags: readonly string[]
}

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** 0 means no match. Higher is better. */
export function scoreMatch(item: Searchable, query: string): number {
  const q = normalise(query)
  if (!q) return 0
  const name = normalise(item.name)
  const aliases = item.aliases.map(normalise)
  const tags = item.tags.map(normalise)

  if (name === q) return 100
  if (aliases.includes(q)) return 90
  if (name.startsWith(q)) return 80
  if (aliases.some((a) => a.startsWith(q))) return 70
  if (name.includes(q)) return 60
  if (aliases.some((a) => a.includes(q))) return 50

  const tokens = q.split(' ')
  const haystack = [name, ...aliases, ...tags].join(' ')
  if (tokens.every((t) => haystack.includes(t))) {
    // Tokens found in the name or aliases outrank ones found only in tags.
    const core = [name, ...aliases].join(' ')
    return tokens.every((t) => core.includes(t)) ? 40 : 30
  }
  return 0
}

/** Matches best first; ties keep the input order. With an empty query, returns everything in input order. */
export function searchItems<T>(items: readonly T[], query: string, toSearchable: (item: T) => Searchable): T[] {
  if (!normalise(query)) return [...items]
  return items
    .map((item, i) => ({ item, i, s: scoreMatch(toSearchable(item), query) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.item)
}
