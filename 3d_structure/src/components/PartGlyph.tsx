import type { CSSProperties } from 'react'
import type { PartDefinition } from '../content/types'
import { MUSEUM_ACCENT_TOKENS } from '../scene/museumPalette'

export interface PartGlyphProps {
  system: string
  accent: PartDefinition['accent']
}

type AbstractStudy = 'flow' | 'lens' | 'frame'

function getAbstractStudy(system: string): AbstractStudy {
  if (/观察|导航|驾驶|监测|座舱/.test(system)) return 'lens'
  if (/动力|推进|传动|发动|电气|循环/.test(system)) return 'flow'
  return 'frame'
}

function GlyphStudy({ study }: { study: AbstractStudy }) {
  if (study === 'lens') {
    return (
      <>
        <circle cx="75" cy="39" r="21" />
        <circle cx="75" cy="39" r="8" />
        <path d="M-8 58C18 27 41 20 66 29M84 48c21 12 41 13 65-2" />
        <line x1="75" y1="7" x2="75" y2="16" />
      </>
    )
  }

  if (study === 'flow') {
    return (
      <>
        <path d="M-10 51C24 51 29 18 60 18s32 39 64 39 34-24 54-24" />
        <circle cx="60" cy="18" r="7" />
        <circle cx="124" cy="57" r="10" />
        <path d="m27 45 8 6-8 6M91 50l8 7-9 5" />
      </>
    )
  }

  return (
    <>
      <path d="M-10 58 31 14l39 44 39-37 49 37" />
      <path d="M18 58V38h101v20M48 25v33M91 34v24" />
      <circle cx="31" cy="14" r="5" />
      <circle cx="109" cy="21" r="5" />
    </>
  )
}

export function PartGlyph({ system, accent }: PartGlyphProps) {
  const accentToken = MUSEUM_ACCENT_TOKENS[accent]
  const study = getAbstractStudy(system)
  const style = {
    '--part-glyph-accent': `var(${accentToken})`,
    color: `var(${accentToken})`,
  } as CSSProperties

  return (
    <svg
      className="part-glyph"
      data-testid="knowledge-part-glyph"
      data-accent={accent}
      data-accent-token={accentToken}
      data-study={study}
      style={style}
      viewBox="0 0 144 72"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g
        className="part-glyph__field"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.65"
        opacity="0.18"
      >
        <path d="M0 12H144M0 36H144M0 60H144M24 0V72M72 0V72M120 0V72" />
      </g>
      <g
        className="part-glyph__study"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <GlyphStudy study={study} />
      </g>
    </svg>
  )
}
