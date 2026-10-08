// Stepping and limits for the check-in weight field.

import { parseKgToG } from '../../domain/parse'

export const MIN_G = 30_000
export const MAX_G = 300_000
export const STEP_G = 100
/** Where the first-ever reading starts when a button is pressed on an empty field. */
export const START_G = 70_000

/** One step of 0.1 kg from a typed value, clamped to the allowed range. */
export function stepKgText(text: string, deltaG: number): string {
  const current = parseKgToG(text) ?? START_G
  const next = Math.min(MAX_G, Math.max(MIN_G, Math.round(current / STEP_G) * STEP_G + deltaG))
  return (next / 1000).toFixed(1)
}
