export const MUSEUM_ACCENT_KEYS = [
  'brass',
  'oxide',
  'teal',
  'cobalt',
  'amber',
  'coral',
  'graphite',
  'ivory',
] as const

export type MuseumAccentKey = (typeof MUSEUM_ACCENT_KEYS)[number]

export const MUSEUM_ACCENT_TOKENS = {
  brass: '--part-brass',
  oxide: '--part-oxide',
  teal: '--part-teal',
  cobalt: '--part-cobalt',
  amber: '--part-amber',
  coral: '--part-coral',
  graphite: '--part-graphite',
  ivory: '--part-ivory',
} as const satisfies Record<MuseumAccentKey, `--part-${MuseumAccentKey}`>

export const MUSEUM_ACCENT_COLORS = {
  brass: '#a27c3f',
  oxide: '#c36d50',
  teal: '#4f9992',
  cobalt: '#668ccb',
  amber: '#c18a35',
  coral: '#cf7568',
  graphite: '#7d888f',
  ivory: '#d8ceb5',
} as const satisfies Record<MuseumAccentKey, string>

export interface MuseumMaterialSurface {
  metalness: number
  roughness: number
}

export interface MuseumMaterialSlots {
  body: MuseumMaterialSurface
  secondary: MuseumMaterialSurface
  detail: MuseumMaterialSurface
}

export type MuseumMaterialFamily =
  | 'castMetal'
  | 'paintedMetal'
  | 'rubber'
  | 'brass'
  | 'emissiveOverlay'

export const MUSEUM_MATERIAL_SLOTS = {
  castMetal: {
    body: { metalness: 0.58, roughness: 0.5 },
    secondary: { metalness: 0.48, roughness: 0.6 },
    detail: { metalness: 0.68, roughness: 0.38 },
  },
  paintedMetal: {
    body: { metalness: 0.34, roughness: 0.52 },
    secondary: { metalness: 0.26, roughness: 0.62 },
    detail: { metalness: 0.42, roughness: 0.48 },
  },
  rubber: {
    body: { metalness: 0.02, roughness: 0.82 },
    secondary: { metalness: 0.01, roughness: 0.9 },
    detail: { metalness: 0.04, roughness: 0.72 },
  },
  brass: {
    body: { metalness: 0.72, roughness: 0.38 },
    secondary: { metalness: 0.62, roughness: 0.46 },
    detail: { metalness: 0.82, roughness: 0.28 },
  },
  emissiveOverlay: {
    body: { metalness: 0.12, roughness: 0.32 },
    secondary: { metalness: 0.06, roughness: 0.42 },
    detail: { metalness: 0.18, roughness: 0.24 },
  },
} as const satisfies Record<MuseumMaterialFamily, MuseumMaterialSlots>

export const MUSEUM_MECHANICAL_PALETTE = {
  brass: {
    color: MUSEUM_ACCENT_COLORS.brass,
    emissive: '#624315',
    metalness: 0.42,
    roughness: 0.48,
  },
  oxide: {
    color: MUSEUM_ACCENT_COLORS.oxide,
    emissive: '#5c2416',
    metalness: 0.3,
    roughness: 0.56,
  },
  teal: {
    color: MUSEUM_ACCENT_COLORS.teal,
    emissive: '#164944',
    metalness: 0.34,
    roughness: 0.5,
  },
} as const
