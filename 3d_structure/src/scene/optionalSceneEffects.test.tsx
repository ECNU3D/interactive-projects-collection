import { render, screen } from '@testing-library/react'
import { loadOptionalSceneEffects } from './optionalSceneEffects'

describe('optional scene effects loader', () => {
  it('preserves the real dynamically imported effects module', async () => {
    const RealEffects = () => <div data-testid="real-effects" />
    const importer = vi.fn().mockResolvedValue({ default: RealEffects })

    const loaded = await loadOptionalSceneEffects(importer)
    render(<loaded.default />)

    expect(importer).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('real-effects')).toBeInTheDocument()
  })

  it('resolves one no-op component when the optional chunk rejects', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('chunk unavailable'))

    const loaded = await loadOptionalSceneEffects(importer)
    const { container, rerender } = render(<loaded.default />)
    rerender(<loaded.default />)

    expect(importer).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })
})
