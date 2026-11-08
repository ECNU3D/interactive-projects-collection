import { Color } from 'three'
import { MUSEUM_MECHANICAL_PALETTE } from './museumPalette'
import {
  createTeachingGlowMaterial,
  getLinearColorLuminance,
} from './teachingGlow'

describe('HDR teaching glow', () => {
  it('creates a non-tone-mapped teaching overlay above the Bloom threshold', () => {
    const material = createTeachingGlowMaterial('#f0c77c', 3.4)

    expect(material.toneMapped).toBe(false)
    expect(Math.max(material.color.r, material.color.g, material.color.b)).toBeGreaterThan(1)
    expect(getLinearColorLuminance(material.color)).toBeGreaterThan(1)
  })

  it('keeps ordinary mechanical materials inside the LDR range', () => {
    for (const entry of Object.values(MUSEUM_MECHANICAL_PALETTE)) {
      for (const source of [entry.color, entry.emissive]) {
        const color = new Color(source)
        expect(Math.max(color.r, color.g, color.b)).toBeLessThanOrEqual(1)
        expect(getLinearColorLuminance(color)).toBeLessThanOrEqual(1)
      }
    }
  })
})
