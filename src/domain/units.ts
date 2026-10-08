// Unit helpers. Storage is integers in grams, millimetres, metres and
// seconds; these convert for display and parse display values back.

export const G_PER_KG = 1000
export const MM_PER_CM = 10
export const M_PER_KM = 1000

export function kgToG(kg: number): number {
  return Math.round(kg * G_PER_KG)
}

export function gToKg(g: number): number {
  return g / G_PER_KG
}

export function cmToMm(cm: number): number {
  return Math.round(cm * MM_PER_CM)
}

export function mmToCm(mm: number): number {
  return mm / MM_PER_CM
}

export function kmToM(km: number): number {
  return Math.round(km * M_PER_KM)
}

export function mToKm(m: number): number {
  return m / M_PER_KM
}

export function minToS(min: number): number {
  return Math.round(min * 60)
}

export function sToMin(s: number): number {
  return s / 60
}

export type RoundingDirection = 'nearest' | 'down' | 'up'

/**
 * Round a value to a multiple of `increment`. 'nearest' rounds half up;
 * the caller decides direction (progressions nearest, first-time estimates
 * down). An increment of 0 or less returns the value unchanged.
 */
export function roundToIncrement(value: number, increment: number, direction: RoundingDirection = 'nearest'): number {
  if (increment <= 0) return value
  const q = value / increment
  let n: number
  if (direction === 'down') n = Math.floor(q + 1e-9)
  else if (direction === 'up') n = Math.ceil(q - 1e-9)
  else n = Math.floor(q + 0.5)
  return n * increment
}

/**
 * Snap a value to the nearest rung of an ascending ladder (for dumbbells).
 * Ties go to the lower rung. Below the first rung returns the first rung;
 * above the last returns the last. 'down' and 'up' pick the neighbouring rung.
 */
export function roundToLadder(value: number, ladder: readonly number[], direction: RoundingDirection = 'nearest'): number {
  if (ladder.length === 0) return value
  const sorted = [...ladder].sort((a, b) => a - b)
  if (value <= sorted[0]) return sorted[0]
  if (value >= sorted[sorted.length - 1]) return sorted[sorted.length - 1]
  let lo = sorted[0]
  let hi = sorted[sorted.length - 1]
  for (const r of sorted) {
    if (r <= value) lo = r
    if (r >= value) {
      hi = r
      break
    }
  }
  if (lo === hi) return lo
  if (direction === 'down') return lo
  if (direction === 'up') return hi
  return value - lo <= hi - value ? lo : hi
}

/** Format grams as kilograms with up to `decimals` places, trailing zeros trimmed, for display with the .num class. */
export function formatKg(g: number, decimals = 2): string {
  const kg = gToKg(g)
  const s = kg.toFixed(decimals)
  return s.replace(/\.?0+$/, '')
}

export function formatKm(m: number, decimals = 2): string {
  return mToKm(m).toFixed(decimals).replace(/\.?0+$/, '')
}

export function formatCm(mm: number, decimals = 1): string {
  return mmToCm(mm).toFixed(decimals).replace(/\.?0+$/, '')
}

/** mm:ss for a rest timer or session clock. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r < 10 ? '0' : ''}${r}`
}
