import { Color, type ColorRepresentation } from 'three'

export interface TeachingGlowMaterial {
  color: Color
  toneMapped: false
}

export function getLinearColorLuminance(color: Color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
}

/**
 * Creates an HDR-only material fragment for educational overlays.
 * Mechanical materials keep their authored LDR palette and never use this path.
 */
export function createTeachingGlowMaterial(
  baseColor: ColorRepresentation,
  intensity: number,
): TeachingGlowMaterial {
  if (!Number.isFinite(intensity) || intensity <= 1) {
    throw new RangeError('Teaching glow intensity must be finite and above 1')
  }

  return {
    color: new Color(baseColor).multiplyScalar(intensity),
    toneMapped: false,
  }
}
