import type { Muscle, MuscleGroup } from '../domain/types'
import { MUSCLE_GROUPS } from '../domain/types'
import { MUSCLE_INFO } from '../domain/muscles'

// OWNER: muscle-map. One original SVG body map (front on the left, back on
// the right) with the 14 scored groups as highlightable regions. Reused on
// exercise detail, machine detail, the session summary (today's heat) and the
// weekly volume view. Imported by ui-library and ui-logger; keep this props
// shape and extend it only.
//
// The artwork lives here as data so the component can toggle classes without
// refetching anything. src/assets/muscle-map.svg is the same figure as a
// standalone file; the test keeps the two identical.

export interface MuscleMapProps {
  mode: 'highlight' | 'heat'
  /** Highlight mode: muscles tagged primary (accent fill). Groups are derived from the muscle table. */
  primary?: readonly Muscle[]
  /** Highlight mode: muscles tagged secondary (soft tint). */
  secondary?: readonly Muscle[]
  /** Heat mode: working sets per group over the window; drawn on a 5-step scale against the 10 to 20 band. */
  heat?: Partial<Record<MuscleGroup, number>>
  /** How to read the heat values: 'sets' (default, 20 sets is full scale) or 'fraction' (0 to 1). */
  heatScale?: 'sets' | 'fraction'
  /** Rendered width in px; the figure keeps its aspect. */
  size?: number
  /** Called with the group when a region is tapped (weekly volume lists the exercises that fed it). */
  onSelect?: (group: MuscleGroup) => void
  className?: string
}

type View = 'front' | 'back'
interface Part {
  view: View
  /** Outline of the viewer's-left half; the right half is its mirror image. */
  d: string
}

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'chest',
  lats: 'lats',
  upper_back: 'upper back',
  front_delts: 'front delts',
  side_delts: 'side delts',
  rear_delts: 'rear delts',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  abs: 'abs',
}

const ARM_UPPER = 'M44 146 Q36 170 38 196 Q48 200 56 192 Q58 168 54 148 Z'
const FOREARM = 'M36 200 Q28 232 26 262 Q36 266 42 260 Q50 232 56 200 Q46 204 36 200 Z'
const SIDE_DELT = 'M40 114 Q30 118 30 136 Q34 146 44 144 Q48 136 52 134 Q42 128 40 114 Z'
const CALF = 'M84 392 Q70 400 68 450 Q68 500 76 522 Q86 524 90 500 Q92 440 90 392 Z'

/** Region artwork, in the order it is painted (later groups sit on top). */
export const REGIONS: Record<MuscleGroup, Part[]> = {
  upper_back: [{ view: 'back', d: 'M98 84 Q80 92 66 100 Q70 118 84 130 Q92 142 98 152 Z' }],
  lats: [{ view: 'back', d: 'M96 156 L84 134 Q64 138 62 162 Q64 192 78 212 Q90 214 96 208 Z' }],
  chest: [{ view: 'front', d: 'M98 108 L66 104 Q52 112 54 132 Q70 148 98 144 Z' }],
  front_delts: [{ view: 'front', d: 'M60 102 Q46 100 40 114 Q42 128 52 134 Q54 118 66 110 Z' }],
  rear_delts: [{ view: 'back', d: 'M64 102 Q46 102 40 118 Q42 130 52 134 Q58 120 68 112 Z' }],
  side_delts: [
    { view: 'front', d: SIDE_DELT },
    { view: 'back', d: SIDE_DELT },
  ],
  biceps: [{ view: 'front', d: ARM_UPPER }],
  triceps: [{ view: 'back', d: ARM_UPPER }],
  forearms: [
    { view: 'front', d: FOREARM },
    { view: 'back', d: FOREARM },
  ],
  abs: [{ view: 'front', d: 'M98 150 L78 150 Q76 192 80 232 Q90 238 98 238 Z' }],
  glutes: [{ view: 'back', d: 'M98 226 Q72 218 62 236 Q60 262 76 278 Q92 280 98 270 Z' }],
  quads: [{ view: 'front', d: 'M98 244 L72 240 Q56 290 62 352 Q70 374 88 374 Q96 340 98 300 Z' }],
  hamstrings: [{ view: 'back', d: 'M98 284 Q76 284 64 292 Q58 332 66 368 Q82 376 92 368 Q98 330 98 284 Z' }],
  calves: [
    { view: 'front', d: CALF },
    { view: 'back', d: CALF },
  ],
}

// Neutral body underneath the regions, drawn per view as the left half and mirrored.
const BASE_HALF = [
  'M100 82 L70 92 Q58 100 58 124 L62 200 Q66 240 62 264 L100 270 Z', // torso
  'M44 100 Q26 106 26 140 L22 262 Q22 284 34 286 Q46 286 46 264 L58 200 Q62 150 60 110 Z', // arm and hand
  'M100 236 L64 244 Q54 300 60 360 L62 400 Q60 470 70 530 L72 562 Q74 582 90 582 L97 572 Q94 480 95 420 Q96 330 98 274 L100 264 Z', // leg and foot
  'M92 66 L92 86 L100 90 L100 66 Z', // neck
]

const HEAD = 'M100 18 Q122 18 122 46 Q122 74 100 74 Q78 74 78 46 Q78 18 100 18 Z'

const VIEW_OFFSET: Record<View, number> = { front: 0, back: 200 }

function halves(view: View): { place: string; mirror: string } {
  const off = VIEW_OFFSET[view]
  return {
    place: off === 0 ? '' : `translate(${off} 0)`,
    mirror: `matrix(-1 0 0 1 ${200 + off} 0)`,
  }
}

/** Token-driven styles; the same text ships inside the standalone SVG file. */
export const MUSCLE_MAP_CSS = `
.mm-svg{--mm-base:var(--surface-2);--mm-none:var(--surface-3);--mm-edge:var(--line-strong);display:block}
.mm-base{fill:var(--mm-base);stroke:var(--mm-edge);stroke-width:1}
.mm-region path{fill:var(--mm-none);stroke:var(--mm-base);stroke-width:1.5;transition:fill .15s}
.mm-region[data-state="primary"] path{fill:var(--accent)}
.mm-region[data-state="secondary"] path{fill:color-mix(in srgb,var(--accent) 15%,var(--mm-none));stroke:color-mix(in srgb,var(--accent) 45%,transparent)}
.mm-region[data-heat="1"] path{fill:color-mix(in srgb,var(--chart-1) 20%,var(--mm-none))}
.mm-region[data-heat="2"] path{fill:color-mix(in srgb,var(--chart-1) 40%,var(--mm-none))}
.mm-region[data-heat="3"] path{fill:color-mix(in srgb,var(--chart-1) 60%,var(--mm-none))}
.mm-region[data-heat="4"] path{fill:color-mix(in srgb,var(--chart-1) 80%,var(--mm-none))}
.mm-region[data-heat="5"] path{fill:var(--chart-1)}
.mm-region[role="button"]{cursor:pointer}
`.trim()

export type RegionState = 'none' | 'primary' | 'secondary'

function Figure({
  states,
  heatSteps,
  onSelect,
}: {
  states?: Partial<Record<MuscleGroup, RegionState>>
  heatSteps?: Partial<Record<MuscleGroup, number>>
  onSelect?: (g: MuscleGroup) => void
}) {
  return (
    <>
      {(['front', 'back'] as const).map((view) => {
        const { place, mirror } = halves(view)
        return (
          <g key={view} data-view={view}>
            <path className="mm-base" d={HEAD} transform={place || undefined} />
            {BASE_HALF.map((d, i) => (
              <g key={i}>
                <path className="mm-base" d={d} transform={place || undefined} />
                <path className="mm-base" d={d} transform={mirror} />
              </g>
            ))}
          </g>
        )
      })}
      {MUSCLE_GROUPS.map((g) => {
        const state = states?.[g] ?? 'none'
        const heat = heatSteps?.[g] ?? 0
        const interactive = onSelect !== undefined
        return (
          <g
            key={g}
            className="mm-region"
            data-group={g}
            data-state={state}
            data-heat={heat > 0 ? heat : undefined}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? GROUP_LABEL[g] : undefined}
            onClick={interactive ? () => onSelect(g) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(g)
                    }
                  }
                : undefined
            }
          >
            {REGIONS[g].map((part, i) => {
              const { place, mirror } = halves(part.view)
              return (
                <g key={i}>
                  <path d={part.d} transform={place || undefined} />
                  <path d={part.d} transform={mirror} />
                </g>
              )
            })}
          </g>
        )
      })}
    </>
  )
}

/** The figure with default (unlit) state, as markup for the standalone SVG file. */
export function standaloneFigure() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" className="mm-svg">
      <style>{MUSCLE_MAP_CSS}</style>
      <Figure />
    </svg>
  )
}

/** Map a heat value to a step 0 to 5. */
export function heatStep(value: number, scale: 'sets' | 'fraction' = 'sets'): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  const frac = scale === 'sets' ? value / 20 : value
  return Math.min(5, Math.max(1, Math.ceil(frac * 5)))
}

function list(items: string[]): string {
  return items.join(', ')
}

function describe(
  mode: 'highlight' | 'heat',
  primary: readonly Muscle[],
  secondary: readonly Muscle[],
  heatSteps: Partial<Record<MuscleGroup, number>>,
): string {
  if (mode === 'heat') {
    const worked = MUSCLE_GROUPS.filter((g) => (heatSteps[g] ?? 0) > 0)
      .sort((a, b) => (heatSteps[b] ?? 0) - (heatSteps[a] ?? 0))
      .slice(0, 3)
      .map((g) => GROUP_LABEL[g])
    return worked.length > 0 ? `Most worked: ${list(worked)}.` : 'No sets logged yet.'
  }
  const pri = [...new Set(primary.map((m) => MUSCLE_INFO[m].label.toLowerCase()))]
  const sec = [...new Set(secondary.map((m) => MUSCLE_INFO[m].label.toLowerCase()))].filter(
    (l) => !pri.includes(l),
  )
  const parts: string[] = []
  if (pri.length > 0) parts.push(`Primary: ${list(pri)}.`)
  if (sec.length > 0) parts.push(`Secondary: ${list(sec)}.`)
  return parts.length > 0 ? parts.join(' ') : 'No muscles highlighted.'
}

export function MuscleMap({
  mode,
  primary = [],
  secondary = [],
  heat = {},
  heatScale = 'sets',
  size = 160,
  onSelect,
  className,
}: MuscleMapProps) {
  const states: Partial<Record<MuscleGroup, RegionState>> = {}
  const heatSteps: Partial<Record<MuscleGroup, number>> = {}
  if (mode === 'highlight') {
    for (const m of secondary) states[MUSCLE_INFO[m].group] = 'secondary'
    for (const m of primary) states[MUSCLE_INFO[m].group] = 'primary'
  } else {
    for (const g of MUSCLE_GROUPS) {
      const step = heatStep(heat[g] ?? 0, heatScale)
      if (step > 0) heatSteps[g] = step
    }
  }
  const text = describe(mode, primary, secondary, heatSteps)

  return (
    <figure className={className} style={{ margin: 0, width: size }} data-mode={mode}>
      <svg
        className="mm-svg"
        viewBox="0 0 400 600"
        width={size}
        height={size * 1.5}
        role={onSelect ? 'group' : 'img'}
        aria-label={mode === 'heat' ? 'Muscle map, sets this week' : 'Muscle map'}
      >
        <style>{MUSCLE_MAP_CSS}</style>
        <Figure states={states} heatSteps={heatSteps} onSelect={onSelect} />
      </svg>
      <figcaption
        className="text-ink-2"
        style={{ fontSize: 12, lineHeight: 1.35, marginTop: 4, textAlign: 'center' }}
      >
        {text}
      </figcaption>
    </figure>
  )
}
