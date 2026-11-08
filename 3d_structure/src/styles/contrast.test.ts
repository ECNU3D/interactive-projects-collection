import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MUSEUM_ACCENT_COLORS,
  MUSEUM_ACCENT_TOKENS,
} from '../scene/museumPalette'
import { contrastRatio, meetsWcagContrast } from './contrast'

const tokenSource = readFileSync(
  resolve(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
)

function token(name: string) {
  const match = tokenSource.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))

  if (!match) {
    throw new Error(`Missing solid color token: ${name}`)
  }

  return match[1]
}

it('calculates WCAG relative-luminance contrast without browser rendering', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
  expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.478, 2)
})

it('keeps gallery body and muted copy at AA contrast on every surface', () => {
  const page = token('--surface-page')
  const panel = token('--surface-panel')

  for (const foreground of [
    token('--text-primary'),
    token('--text-secondary'),
    token('--text-muted'),
  ]) {
    expect(meetsWcagContrast(foreground, page, 'normal')).toBe(true)
    expect(meetsWcagContrast(foreground, panel, 'normal')).toBe(true)
  }
})

it('keeps canonical 3D accents unchanged and readable on the page field', () => {
  const page = token('--surface-page')

  for (const [accent, tokenName] of Object.entries(MUSEUM_ACCENT_TOKENS)) {
    expect(token(tokenName)).toBe(
      MUSEUM_ACCENT_COLORS[accent as keyof typeof MUSEUM_ACCENT_COLORS],
    )
    expect(meetsWcagContrast(token(tokenName), page, 'normal')).toBe(true)
  }
})

it('requires three-to-one contrast for large display type', () => {
  expect(meetsWcagContrast('#777777', '#ffffff', 'large')).toBe(true)
  expect(meetsWcagContrast('#999999', '#ffffff', 'large')).toBe(false)
})
