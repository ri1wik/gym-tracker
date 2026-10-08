// Number formatting for review copy. Display units only; storage stays in
// grams, millimetres, metres and seconds.

/** "0.4%" from a signed percent, magnitude only (the sentence says down or up). */
export function fmtPctAbs(pct: number, digits: number = 1): string {
  return `${Math.abs(pct).toFixed(digits)}%`
}

export function fmtSignedPct(pct: number, digits: number = 1): string {
  const s = pct.toFixed(digits)
  return pct > 0 ? `+${s}%` : `${s}%`
}

/** "62.5 kg" from grams; drops a trailing .0. */
export function fmtKg(g: number): string {
  const kg = g / 1000
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(kg * 10 === Math.round(kg * 10) ? 1 : 2)
  return `${s} kg`
}

/** "1.0 cm" from millimetres, magnitude only. */
export function fmtCmAbs(mm: number): string {
  return `${(Math.abs(mm) / 10).toFixed(1)} cm`
}

/** "62.5 x 8" for a set. */
export function fmtSet(load_g: number, reps: number): string {
  const kg = load_g / 1000
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(kg * 10 === Math.round(kg * 10) ? 1 : 2)
  return `${s} x ${reps}`
}

export function plural(n: number, one: string, many: string = `${one}s`): string {
  return n === 1 ? one : many
}

/** "chest" to "Chest", "upper_back" to "Upper back". */
export function labelOf(key: string): string {
  const words = key.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
