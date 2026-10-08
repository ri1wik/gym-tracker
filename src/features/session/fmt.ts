// Display helpers for the logger. Storage is grams and seconds; these
// produce the strings the rows show. Every string lands in a .num element.

import type { ExerciseIndexEntry } from '../../domain/types'
import { formatClock, formatKg } from '../../domain/units'

export function kg(g: number): string {
  return `${formatKg(g)} kg`
}

/** The load column for one set of an exercise. */
export function loadLabel(entry: ExerciseIndexEntry, load_g: number, assist_g: number): string {
  switch (entry.loadType) {
    case 'bodyweight':
      return load_g > 0 ? `BW +${formatKg(load_g)}` : 'BW'
    case 'assisted':
      return `-${formatKg(assist_g)} kg`
    case 'time':
      return 'hold'
    default:
      return formatKg(load_g)
  }
}

/** The reps column: reps, or seconds for a timed hold. */
export function repsLabel(entry: ExerciseIndexEntry, reps: number): string {
  return entry.loadType === 'time' ? `${reps} s` : String(reps)
}

/** "60 kg x 8", "BW x 10", "-15 kg x 8", "45 s". */
export function setLabel(entry: ExerciseIndexEntry, load_g: number, reps: number, assist_g = 0): string {
  if (entry.loadType === 'time') return `${reps} s`
  if (entry.loadType === 'bodyweight') return `${loadLabel(entry, load_g, assist_g)} x ${reps}`
  if (entry.loadType === 'assisted') return `${loadLabel(entry, load_g, assist_g)} x ${reps}`
  return `${formatKg(load_g)} kg x ${reps}`
}

/** h:mm:ss past the hour, mm:ss under it. */
export function elapsedLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 3600) return formatClock(s)
  const h = Math.floor(s / 3600)
  return `${h}:${formatClock(s % 3600).padStart(5, '0')}`
}

export function bodyPartLabel(part: string): string {
  return part.charAt(0).toUpperCase() + part.slice(1)
}
