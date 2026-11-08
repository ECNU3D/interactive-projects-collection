import {
  MUSEUM_ACCENT_KEYS,
  MUSEUM_ACCENT_COLORS,
  MUSEUM_ACCENT_TOKENS,
  MUSEUM_MATERIAL_SLOTS,
} from './museumPalette'

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    )

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

describe('museum palette', () => {
  it('maps eight distinct exhibit accents to matching CSS token names', () => {
    expect(MUSEUM_ACCENT_KEYS).toHaveLength(8)
    expect(new Set(MUSEUM_ACCENT_KEYS).size).toBe(8)
    expect(Object.keys(MUSEUM_ACCENT_TOKENS).sort()).toEqual(
      [...MUSEUM_ACCENT_KEYS].sort(),
    )

    for (const accent of MUSEUM_ACCENT_KEYS) {
      expect(MUSEUM_ACCENT_TOKENS[accent]).toBe(`--part-${accent}`)
    }
  })

  it('keeps every accent AA-readable on the museum ink background', () => {
    for (const accent of MUSEUM_ACCENT_KEYS) {
      expect(
        contrastRatio(MUSEUM_ACCENT_COLORS[accent], '#071411'),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives every material family distinct body, secondary, and detail responses', () => {
    expect(Object.keys(MUSEUM_MATERIAL_SLOTS).sort()).toEqual([
      'brass',
      'castMetal',
      'emissiveOverlay',
      'paintedMetal',
      'rubber',
    ])

    for (const slots of Object.values(MUSEUM_MATERIAL_SLOTS)) {
      const responses = [slots.body, slots.secondary, slots.detail].map(
        ({ metalness, roughness }) => `${metalness}:${roughness}`,
      )

      expect(new Set(responses).size).toBe(3)
    }
  })
})
