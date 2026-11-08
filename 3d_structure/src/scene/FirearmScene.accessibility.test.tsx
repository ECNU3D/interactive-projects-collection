import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import FirearmScene from './FirearmScene'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children: _children,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    role,
    tabIndex,
    dpr,
    shadows,
    gl,
  }: {
    children?: ReactNode
    'aria-label'?: string
    'aria-describedby'?: string
    role?: string
    tabIndex?: number
    dpr?: [number, number]
    shadows?: boolean
    gl?: { antialias?: boolean }
  }) => (
    <canvas
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      role={role}
      tabIndex={tabIndex}
      data-dpr={dpr?.join(':')}
      data-shadows={shadows}
      data-antialias={gl?.antialias}
    />
  ),
  useFrame: vi.fn(),
  useThree: vi.fn(),
}))

vi.mock('@react-three/drei', () => ({
  ContactShadows: () => null,
  OrbitControls: () => null,
}))

vi.mock('./FirearmModel', () => ({
  FirearmModel: () => null,
}))

describe('FirearmScene canvas accessibility contract', () => {
  it('describes the real Canvas with the shared cycle status id', () => {
    render(
      <FirearmScene
        exhibitId="m1911a1"
        stepIndex={0}
        mode="principle"
        selectedPartId={null}
        autoplay={false}
        reducedMotion={false}
        resetToken={0}
        onSelect={vi.fn()}
        cycleDescriptionId="firearm-cycle-description"
        cycleState={{ phaseIndex: 0, status: 'idle', revision: 0 }}
      />,
    )

    expect(
      screen.getByRole('img', {
        name: 'M1911A1 可交互机械循环教学模型',
      }),
    ).toHaveAttribute('aria-describedby', 'firearm-cycle-description')
    expect(screen.getByRole('img')).toHaveAttribute('data-dpr', '1:2')
    expect(screen.getByRole('img')).toHaveAttribute('data-shadows', 'true')
    expect(screen.getByRole('img')).toHaveAttribute('data-antialias', 'false')
  })
})
