// A stable hash of the review inputs. Keys are sorted so two objects with the
// same content hash the same whatever their insertion order; two 32-bit
// FNV-1a passes with different seeds give a 16-hex-character digest.

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return value === undefined ? 'null' : JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value instanceof Map) return stableStringify([...value.entries()])
  if (value instanceof Set) return stableStringify([...value.values()])
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function fnv1a32(text: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function stableHash(value: unknown): string {
  const text = stableStringify(value)
  const a = fnv1a32(text, 0x811c9dc5).toString(16).padStart(8, '0')
  const b = fnv1a32(text, 0x9747b28c).toString(16).padStart(8, '0')
  return a + b
}
