import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS } from '../domain/types'
import { MuscleMap, heatStep, standaloneFigure } from './MuscleMap'

const svgPath = fileURLToPath(new URL('../assets/muscle-map.svg', import.meta.url))
const standalone = renderToStaticMarkup(standaloneFigure()) + '\n'
if (process.env.UPDATE_MUSCLE_SVG === '1') writeFileSync(svgPath, standalone)

describe('MuscleMap', () => {
  const html = renderToStaticMarkup(createElement(MuscleMap, { mode: 'highlight' }))

  it('has a region for every muscle group, in the component and in the svg file', () => {
    const file = readFileSync(svgPath, 'utf8')
    for (const g of MUSCLE_GROUPS) {
      expect(html).toContain(`data-group="${g}"`)
      expect(file).toContain(`data-group="${g}"`)
    }
  })

  it('keeps the standalone svg file identical to the component artwork', () => {
    expect(readFileSync(svgPath, 'utf8')).toBe(standalone)
  })

  it('draws symmetrical pairs inside one group', () => {
    const chest = html.match(/<g class="mm-region" data-group="chest"[^>]*>(.*?)<\/g><\/g>/)
    expect(chest?.[1].match(/<path/g)).toHaveLength(2)
  })

  it('marks primary and secondary groups and describes them', () => {
    const out = renderToStaticMarkup(
      createElement(MuscleMap, { mode: 'highlight', primary: ['lats'], secondary: ['biceps', 'rear_delts'] }),
    )
    expect(out).toContain('data-group="lats" data-state="primary"')
    expect(out).toContain('data-group="biceps" data-state="secondary"')
    expect(out).toContain('Primary: lats. Secondary: biceps, rear delts.')
  })

  it('scales heat to five steps', () => {
    expect(heatStep(0)).toBe(0)
    expect(heatStep(1)).toBe(1)
    expect(heatStep(10)).toBe(3)
    expect(heatStep(20)).toBe(5)
    expect(heatStep(40)).toBe(5)
    expect(heatStep(0.5, 'fraction')).toBe(3)
    const out = renderToStaticMarkup(createElement(MuscleMap, { mode: 'heat', heat: { quads: 20 } }))
    expect(out).toContain('data-heat="5"')
    expect(out).toContain('Most worked: quads.')
  })
})
