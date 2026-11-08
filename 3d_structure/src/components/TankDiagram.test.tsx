import { render, screen } from '@testing-library/react'
import { TankDiagram } from './TankDiagram'

describe('TankDiagram', () => {
  it('gives the firearm placeholder a safe accessible label', () => {
    render(<TankDiagram variant="firearm" />)

    expect(
      screen.getByRole('img', {
        name: '枪械机械循环教学模型静态结构示意',
      }),
    ).toBeInTheDocument()
  })

  it('uses an explicit accessible label instead of the variant default', () => {
    render(
      <TankDiagram
        label="M1903 机械循环抽象侧视教学模型"
        variant="firearm"
      />,
    )

    expect(
      screen.getByRole('img', {
        name: 'M1903 机械循环抽象侧视教学模型',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('img', {
        name: '枪械机械循环教学模型静态结构示意',
      }),
    ).not.toBeInTheDocument()
  })

  it('renders the firearm teaching silhouette as authored abstract layers', () => {
    const { container } = render(<TankDiagram variant="firearm" />)

    expect(
      container.querySelector('.diagram__assembly--firearm'),
    ).toBeInTheDocument()
    expect(container.querySelector('.diagram__cutaway')).toBeInTheDocument()
    expect(
      container.querySelector('.diagram__moving-block'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('.diagram__energy-path'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('.diagram__inert-substitute'),
    ).toBeInTheDocument()
  })

  it('shows the inert substitute inside the barrel path at phase two', () => {
    const { container } = render(
      <TankDiagram firearmPhase={2} variant="firearm" />,
    )

    const diagram = container.querySelector('svg')
    const inertSubstitute = container.querySelector(
      '.diagram__inert-substitute',
    )
    const extractionSubstitute = container.querySelector(
      '.diagram__extraction-substitute',
    )

    expect(diagram).toHaveAttribute('data-firearm-phase', '2')
    expect(inertSubstitute).toHaveAttribute('opacity', '1')
    expect(inertSubstitute).toHaveAttribute('transform', 'translate(22 -34)')
    expect(extractionSubstitute).toHaveAttribute('opacity', '0')
  })

  it('distinguishes extraction and return phases without leaving the muzzle', () => {
    const { container, rerender } = render(
      <TankDiagram firearmPhase={4} variant="firearm" />,
    )

    const movingBlock = () =>
      container.querySelector('.diagram__moving-block')
    const extractionSubstitute = () =>
      container.querySelector('.diagram__extraction-substitute')

    expect(movingBlock()).toHaveAttribute('transform', 'translate(-54 0)')
    expect(extractionSubstitute()).toHaveAttribute('opacity', '1')
    expect(extractionSubstitute()).toHaveAttribute(
      'transform',
      'translate(-46 -18)',
    )

    rerender(<TankDiagram firearmPhase={5} variant="firearm" />)

    expect(container.querySelector('svg')).toHaveAttribute(
      'data-firearm-phase',
      '5',
    )
    expect(movingBlock()).toHaveAttribute('transform', 'translate(0 0)')
    expect(extractionSubstitute()).toHaveAttribute('opacity', '0')
  })

  it.each([
    [0, 'profile'],
    [1, 'support'],
    [2, 'locking-interface'],
    [3, 'inert-event'],
    [4, 'return-path'],
    [5, 'review-linework'],
  ] as const)(
    'gives guide step %i its own visible %s highlight independently of cycle phase',
    (firearmGuideStep, expectedLayer) => {
      const { container } = render(
        <TankDiagram
          firearmGuideStep={firearmGuideStep}
          firearmPhase={0}
          variant="firearm"
        />,
      )

      expect(container.querySelector('svg')).toHaveAttribute(
        'data-firearm-guide-step',
        String(firearmGuideStep),
      )
      expect(
        container.querySelector('[data-guide-highlight="true"]'),
      ).toHaveAttribute('data-guide-layer', expectedLayer)
    },
  )

  it('keeps decorative diagrams out of the accessibility tree', () => {
    const { container } = render(
      <TankDiagram
        decorative
        label="不应暴露的标签"
        variant="firearm"
      />,
    )

    const diagram = container.querySelector('svg')

    expect(diagram).toHaveAttribute('aria-hidden', 'true')
    expect(diagram).not.toHaveAttribute('aria-labelledby')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('title')).not.toBeInTheDocument()
  })
})
