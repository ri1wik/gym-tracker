// The shared numeric parser for every text input with inputmode="decimal".
// Accepts a decimal comma (Indian and European keyboards), surrounding
// whitespace and exponent notation. Returns null for anything else so a UI
// can keep the previous value instead of writing NaN.

const DECIMAL_RE = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/

/**
 * Parse '80,5', '80.5', ' 80 ', '8e1', '.5' and '-2' to a finite number.
 * Returns null on an empty string, more than one separator, or any letter
 * other than an exponent.
 */
export function parseDecimal(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim().replace(/\s+/g, '')
  if (s === '') return null
  if (!DECIMAL_RE.test(s)) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Parse a display kilogram string straight to grams, or null. */
export function parseKgToG(raw: string | null | undefined): number | null {
  const n = parseDecimal(raw)
  return n === null ? null : Math.round(n * 1000)
}

/** Parse a display centimetre string straight to millimetres, or null. */
export function parseCmToMm(raw: string | null | undefined): number | null {
  const n = parseDecimal(raw)
  return n === null ? null : Math.round(n * 10)
}

/** Parse a whole number (reps, minutes, seconds). Rejects fractions. */
export function parseInteger(raw: string | null | undefined): number | null {
  const n = parseDecimal(raw)
  if (n === null || !Number.isInteger(n)) return null
  return n
}
