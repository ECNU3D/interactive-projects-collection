import { describe, expect, it } from 'vitest'
import { m4Parts, m4Steps } from '../content/m4'
import { MechanicalPart } from './MechanicalPart'
import * as tankPartModule from './TankPart'

type PaintedMetalPalette = Record<
  'brass' | 'oxide' | 'teal',
  {
    metalness: number
    roughness: number
  }
>

const { PART_MATERIAL_PALETTE } = tankPartModule as typeof tankPartModule & {
  PART_MATERIAL_PALETTE?: PaintedMetalPalette
}

const { TankPart } = tankPartModule

describe('PART_MATERIAL_PALETTE', () => {
  it('keeps every accent inside the painted-metal lighting envelope', () => {
    expect(PART_MATERIAL_PALETTE).toBeDefined()

    for (const material of Object.values(PART_MATERIAL_PALETTE ?? {})) {
      expect(material.metalness).toBeLessThanOrEqual(0.42)
      expect(material.roughness).toBeGreaterThanOrEqual(0.48)
    }
  })
})

describe('TankPart', () => {
  it('delegates the M4 contract and exact render-prop identity to MechanicalPart', () => {
    const definition = m4Parts.find(
      (part) => part.id === 'hull-shell',
    )!
    const children = vi.fn()
    const onSelect = vi.fn()
    const element = TankPart({
      definition,
      stepIndex: 4,
      mode: 'xray',
      selected: true,
      reducedMotion: false,
      onSelect,
      children,
    })
    const props = element.props as Record<string, unknown>

    expect(element.type).toBe(MechanicalPart)
    expect(props).toMatchObject({
      definition,
      stepIndex: 4,
      mode: 'xray',
      selected: true,
      reducedMotion: false,
      onSelect,
      steps: m4Steps,
      name: 'tank-part-hull-shell',
      materialPalette: PART_MATERIAL_PALETTE,
    })
    expect(props.children).toBe(children)
    expect(props.shellIds).toBeInstanceOf(Set)
    expect(props.shellIds).toEqual(
      new Set(['hull-shell', 'turret-shell']),
    )
    expect(props.teachingVolumeIds).toEqual(new Set(['crew-space']))
  })
})
