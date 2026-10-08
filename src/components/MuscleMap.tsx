import type { Muscle, MuscleGroup } from '../domain/types'

// OWNER: muscle-map. One original SVG body map (front and back, the 14
// scored groups as regions) reused on exercise detail, machine detail, the
// session summary (today's heat) and the weekly volume view. Imported by
// ui-library and ui-logger; keep this props shape and extend it only.

export interface MuscleMapProps {
  mode: 'highlight' | 'heat'
  /** Highlight mode: muscles tagged primary (accent fill). Groups are derived from the muscle table. */
  primary?: readonly Muscle[]
  /** Highlight mode: muscles tagged secondary (soft tint). */
  secondary?: readonly Muscle[]
  /** Heat mode: working sets per group over the window; drawn on a 5-step scale against the 10 to 20 band. */
  heat?: Partial<Record<MuscleGroup, number>>
  /** Rendered width in px; the figure keeps its aspect. */
  size?: number
  /** Called with the group when a region is tapped (weekly volume lists the exercises that fed it). */
  onSelect?: (group: MuscleGroup) => void
  className?: string
}

export function MuscleMap({ mode, size = 160, className }: MuscleMapProps) {
  return (
    <svg
      role="img"
      aria-label={mode === 'heat' ? 'Muscle map, sets this week' : 'Muscle map'}
      viewBox="0 0 400 600"
      width={size}
      height={size * 1.5}
      className={className}
      data-mode={mode}
    >
      <rect x="0" y="0" width="400" height="600" fill="none" stroke="currentColor" strokeOpacity="0.14" />
      <text x="200" y="300" textAnchor="middle" fill="currentColor" fillOpacity="0.5" fontSize="20">
        Muscle map
      </text>
    </svg>
  )
}
