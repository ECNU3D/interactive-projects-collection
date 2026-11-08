import { render, screen } from '@testing-library/react'
import { MUSEUM_ACCENT_TOKENS } from '../scene/museumPalette'
import { PartGlyph } from './PartGlyph'

describe('PartGlyph', () => {
  it('renders a decorative abstract study using the canonical accent token', () => {
    render(<PartGlyph system="动力系统" accent="teal" />)

    const glyph = screen.getByTestId('knowledge-part-glyph')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    expect(glyph).toHaveAttribute('data-accent', 'teal')
    expect(glyph).toHaveAttribute(
      'data-accent-token',
      MUSEUM_ACCENT_TOKENS.teal,
    )
    expect(glyph).toHaveStyle({
      '--part-glyph-accent': `var(${MUSEUM_ACCENT_TOKENS.teal})`,
    })
    expect(glyph).not.toHaveAttribute('role', 'img')
    expect(glyph.querySelectorAll('path, circle, line')).not.toHaveLength(0)
  })

  it('varies only the abstract study family for different systems', () => {
    const { rerender } = render(
      <PartGlyph system="动力系统" accent="brass" />,
    )
    const glyph = screen.getByTestId('knowledge-part-glyph')
    const firstStudy = glyph.getAttribute('data-study')

    rerender(<PartGlyph system="观察系统" accent="brass" />)
    expect(glyph.getAttribute('data-study')).not.toBe(firstStudy)
  })
})
