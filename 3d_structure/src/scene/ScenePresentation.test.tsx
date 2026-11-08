import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { SceneQualityProfile } from './sceneQuality'
import { ScenePresentation } from './ScenePresentation'

const shadowMockState = vi.hoisted(() => ({
  accumulativeRenders: 0,
}))

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({ invalidate: vi.fn() }),
}))

vi.mock('@react-three/drei', () => ({
  AccumulativeShadows: ({
    children,
    frames,
    limit,
    resolution,
  }: {
    children?: ReactNode
    frames?: number
    limit?: number
    resolution?: number
  }) => {
    shadowMockState.accumulativeRenders += 1
    return (
      <div
        data-testid="accumulative-shadows"
        data-frames={frames}
        data-limit={limit}
        data-resolution={resolution}
      >
        {children}
      </div>
    )
  },
  ContactShadows: ({ frames, resolution }: { frames: number; resolution: number }) => (
    <div
      data-testid="contact-shadows"
      data-frames={frames}
      data-resolution={resolution}
    />
  ),
  Environment: ({
    children,
    frames,
    resolution,
  }: {
    children?: ReactNode
    frames?: number
    resolution?: number
  }) => (
    <div
      data-testid="museum-environment"
      data-frames={frames}
      data-resolution={resolution}
    >
      {children}
    </div>
  ),
  Lightformer: ({ name }: { name?: string }) => (
    <div data-testid="lightformer" data-name={name} />
  ),
  Html: ({
    children,
    pointerEvents,
  }: {
    children?: ReactNode
    pointerEvents?: string
  }) => (
    <div data-testid="podium-html-label" data-pointer-events={pointerEvents}>
      {children}
    </div>
  ),
  RandomizedLight: ({ mapSize }: { mapSize?: number }) => (
    <div data-testid="randomized-shadow-light" data-map-size={mapSize} />
  ),
}))

vi.mock('@react-three/postprocessing', () => ({
  Bloom: ({ luminanceThreshold }: { luminanceThreshold?: number }) => (
    <div data-testid="bloom" data-threshold={luminanceThreshold} />
  ),
  EffectComposer: ({
    children,
    multisampling,
  }: {
    children?: ReactNode
    multisampling?: number
  }) => (
    <div data-testid="effect-composer" data-multisampling={multisampling}>
      {children}
    </div>
  ),
  N8AO: () => <div data-testid="n8ao" />,
  Outline: ({ pulseSpeed }: { pulseSpeed?: number }) => (
    <div data-testid="outline" data-pulse-speed={pulseSpeed} />
  ),
  Selection: ({ children }: { children?: ReactNode }) => (
    <div data-testid="selection-provider">{children}</div>
  ),
  SMAA: () => <div data-testid="smaa" />,
  Vignette: () => <div data-testid="vignette" />,
}))

vi.mock('./SceneSelection', () => ({
  Selection: ({ children }: { children?: ReactNode }) => (
    <div data-testid="selection-provider">{children}</div>
  ),
  useMuseumSelection: () => [],
}))

const DESKTOP_QUALITY: SceneQualityProfile = {
  dpr: [1, 2],
  shadows: true,
  shadowMode: 'accumulative',
  postprocessing: true,
  antialias: false,
  shadowResolution: 512,
  shadowMapSize: 2048,
  shadowFrames: 24,
  environmentResolution: 128,
}

const CONSTRAINED_QUALITY: SceneQualityProfile = {
  dpr: [1, 1.25],
  shadows: false,
  shadowMode: 'contact',
  postprocessing: false,
  antialias: true,
  shadowResolution: 256,
  shadowMapSize: 1024,
  shadowFrames: 8,
  environmentResolution: 64,
}

describe('ScenePresentation', () => {
  beforeEach(() => {
    shadowMockState.accumulativeRenders = 0
  })

  it('lights a desktop exhibit as a finite museum presentation', async () => {
    const { container } = render(
      <ScenePresentation
        quality={DESKTOP_QUALITY}
        reducedMotion={false}
        shadowRevision="3:explode:false:0"
        stage={{ floorY: -1.03, radius: 4.8, label: 'X-57' }}
      >
        <div data-testid="exhibit-model" />
      </ScenePresentation>,
    )

    expect(screen.getByTestId('exhibit-model')).toBeInTheDocument()
    expect(screen.getByTestId('selection-provider')).toBeInTheDocument()
    expect(screen.getByTestId('museum-environment')).toHaveAttribute(
      'data-frames',
      '1',
    )
    expect(screen.getByTestId('museum-environment')).toHaveAttribute(
      'data-resolution',
      '128',
    )
    expect(screen.getAllByTestId('lightformer')).toHaveLength(3)
    expect(
      container.querySelector('[name="museum-warm-key-light"]'),
    ).toHaveAttribute('shadow-mapsize-width', '2048')
    expect(
      container.querySelector('[name="museum-cool-rim-light"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="museum-low-fill-light"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="museum-circular-podium"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="podium-brass-scale-ring"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="podium-nameplate-X-57"]'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('podium-html-label')).toHaveTextContent('X-57')
    expect(screen.getByTestId('podium-html-label')).toHaveAttribute(
      'data-pointer-events',
      'none',
    )
    expect(
      container.querySelector('[name="museum-gradient-dome"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[name="museum-static-dust"]'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('accumulative-shadows')).toHaveAttribute(
      'data-frames',
      '24',
    )
    expect(screen.getByTestId('accumulative-shadows')).toHaveAttribute(
      'data-limit',
      '24',
    )
    expect(screen.getByTestId('randomized-shadow-light')).toHaveAttribute(
      'data-map-size',
      '512',
    )
    const composer = await screen.findByTestId('effect-composer')
    const selectionProvider = screen.getByTestId('selection-provider')
    expect(selectionProvider).toContainElement(screen.getByTestId('exhibit-model'))
    expect(selectionProvider).toContainElement(composer)
    expect(composer).toHaveAttribute(
      'data-multisampling',
      '0',
    )
    expect(screen.getByTestId('n8ao')).toBeInTheDocument()
    expect(screen.getByTestId('bloom')).toHaveAttribute('data-threshold', '1')
    expect(screen.getByTestId('outline')).toHaveAttribute(
      'data-pulse-speed',
      '0',
    )
    expect(screen.getByTestId('smaa')).toBeInTheDocument()
    expect(screen.getByTestId('vignette')).toBeInTheDocument()
    expect(container.querySelector('gridhelper')).not.toBeInTheDocument()
    expect(
      container.querySelector(
        'directionallight[data-shadow-map-size], mesh[data-testid], group[data-testid], points[data-testid]',
      ),
    ).not.toBeInTheDocument()
  })

  it('keeps the memoized accumulative layer stable across continuous phase changes', () => {
    const { rerender } = render(
      <ScenePresentation
        quality={DESKTOP_QUALITY}
        reducedMotion={false}
        shadowRevision="5:principle:false:0:1:playing:4"
        shadowFrames={48}
        principleAnimationActive
        stage={{ floorY: -1.5, radius: 4.8, label: 'M1903' }}
      >
        <div />
      </ScenePresentation>,
    )

    expect(screen.getByTestId('accumulative-shadows')).toHaveAttribute(
      'data-frames',
      '1',
    )
    expect(screen.getByTestId('accumulative-shadows')).toHaveAttribute(
      'data-limit',
      '1',
    )
    expect(shadowMockState.accumulativeRenders).toBe(1)

    rerender(
      <ScenePresentation
        quality={DESKTOP_QUALITY}
        reducedMotion={false}
        shadowRevision="5:principle:false:0:2:playing:4"
        shadowFrames={48}
        principleAnimationActive
        stage={{ floorY: -1.5, radius: 4.8, label: 'M1903' }}
      >
        <div />
      </ScenePresentation>,
    )

    expect(shadowMockState.accumulativeRenders).toBe(1)
  })

  it('rerenders the stable layer when a static scene revision changes', () => {
    const { rerender } = render(
      <ScenePresentation
        quality={DESKTOP_QUALITY}
        reducedMotion={false}
        shadowRevision="0:explode:false:0"
        stage={{ floorY: -1.03, radius: 4.8, label: 'X-57' }}
      >
        <div />
      </ScenePresentation>,
    )

    expect(shadowMockState.accumulativeRenders).toBe(1)

    rerender(
      <ScenePresentation
        quality={DESKTOP_QUALITY}
        reducedMotion={false}
        shadowRevision="1:explode:false:0"
        stage={{ floorY: -1.03, radius: 4.8, label: 'X-57' }}
      >
        <div />
      </ScenePresentation>,
    )

    expect(shadowMockState.accumulativeRenders).toBe(2)
  })

  it('keeps constrained devices on a finite low-resolution path', () => {
    const { container } = render(
      <ScenePresentation
        quality={CONSTRAINED_QUALITY}
        reducedMotion={false}
        shadowRevision="0:explode:false:0"
        stage={{ floorY: -1.03, radius: 4.2, label: 'M4' }}
      >
        <div data-testid="constrained-model" />
      </ScenePresentation>,
    )

    expect(screen.getByTestId('constrained-model')).toBeInTheDocument()
    expect(screen.getByTestId('museum-environment')).toHaveAttribute(
      'data-frames',
      '1',
    )
    expect(screen.getByTestId('museum-environment')).toHaveAttribute(
      'data-resolution',
      '64',
    )
    expect(screen.getAllByTestId('lightformer')).toHaveLength(3)
    expect(screen.queryByTestId('effect-composer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('accumulative-shadows')).not.toBeInTheDocument()
    expect(screen.getByTestId('contact-shadows')).toHaveAttribute(
      'data-resolution',
      '256',
    )
    expect(screen.getByTestId('contact-shadows')).toHaveAttribute(
      'data-frames',
      '8',
    )
    expect(container.querySelector('gridhelper')).not.toBeInTheDocument()
    expect(screen.getByTestId('podium-html-label')).toHaveTextContent('M4')
  })

  it('uses a frozen, explicitly abstract water surface for reduced motion', () => {
    render(
      <ScenePresentation
        quality={CONSTRAINED_QUALITY}
        reducedMotion
        principleAnimationActive
        shadowRevision="0:principle:true:0"
        stage={{
          floorY: -0.5,
          radius: 5.2,
          label: '现代救援船教学复合模型',
          variant: 'water',
        }}
      >
        <div />
      </ScenePresentation>,
    )

    expect(
      document.querySelector('[name="抽象水面、非海况模型"]'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('contact-shadows')).toHaveAttribute(
      'data-frames',
      '1',
    )
  })
})
