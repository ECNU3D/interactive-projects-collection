import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { m4Steps } from '../content/m4'
import { LearningGuide } from './LearningGuide'

const defaultProps = {
  activeStep: m4Steps[0],
  guided: true,
  demoPlaying: false,
  reducedMotion: false,
  atLastStep: false,
  onGuidedChange: vi.fn(),
  onToggleDemo: vi.fn(),
}

describe('LearningGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers a hint and a no-penalty observation conclusion', async () => {
    const user = userEvent.setup()

    render(<LearningGuide {...defaultProps} />)

    expect(screen.getByText('新手导览')).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 1, name: m4Steps[0].question }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: '看提示' }))
    expect(screen.getByText(m4Steps[0].hint)).toBeVisible()

    await user.click(screen.getByRole('button', { name: '我想好了' }))
    expect(screen.getByText('没有标准答案')).toBeVisible()
    expect(screen.getByText(m4Steps[0].takeaway)).toBeVisible()

    await user.click(screen.getByRole('button', { name: '再试一次' }))
    expect(screen.queryByText(m4Steps[0].takeaway)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '我想好了' })).toBeVisible()
  })

  it('makes free exploration an explicit reversible choice', async () => {
    const user = userEvent.setup()
    const onGuidedChange = vi.fn()
    const { rerender } = render(
      <LearningGuide
        {...defaultProps}
        onGuidedChange={onGuidedChange}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: '切换到自由探索' }),
    )
    expect(onGuidedChange).toHaveBeenCalledWith(false)

    rerender(
      <LearningGuide
        {...defaultProps}
        guided={false}
        onGuidedChange={onGuidedChange}
      />,
    )
    expect(screen.getByText('自由探索已开启')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '打开新手导览' }))
    expect(onGuidedChange).toHaveBeenLastCalledWith(true)
  })

  it('disables continuous demonstration and explains reduced motion', () => {
    render(<LearningGuide {...defaultProps} reducedMotion />)

    expect(screen.getByRole('button', { name: '自动演示' })).toBeDisabled()
    expect(
      screen.getByText(/减少动态已开启，自动演示保持暂停/),
    ).toBeVisible()
  })

  it('resets hint and conclusion when the stage changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<LearningGuide {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '看提示' }))
    await user.click(screen.getByRole('button', { name: '我想好了' }))

    rerender(<LearningGuide {...defaultProps} activeStep={m4Steps[1]} />)

    expect(screen.queryByText(m4Steps[0].hint)).not.toBeInTheDocument()
    expect(screen.queryByText(m4Steps[0].takeaway)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '看提示' })).toBeVisible()
    expect(screen.getByRole('button', { name: '我想好了' })).toBeVisible()
  })

  it('keeps the active question visible during free exploration', () => {
    render(<LearningGuide {...defaultProps} guided={false} />)

    expect(
      screen.getByRole('heading', { level: 1, name: m4Steps[0].question }),
    ).toBeVisible()
  })

  it('announces only the short free-mode status without nesting live regions', () => {
    const { container } = render(
      <LearningGuide
        {...defaultProps}
        guided={false}
        modeControls={
          <p role="status" aria-live="polite">
            拆解模式说明
          </p>
        }
      />,
    )

    const guide = container.querySelector('.learning-guide--free')
    const freeStatus = screen.getByText('自由探索已开启')
    const modeStatus = screen.getByText('拆解模式说明')

    expect(guide).not.toHaveAttribute('aria-live')
    expect(freeStatus).toHaveAttribute('role', 'status')
    expect(freeStatus).toHaveAttribute('aria-live', 'polite')
    expect(freeStatus).toHaveAttribute('aria-atomic', 'true')
    expect(modeStatus).toHaveAttribute('role', 'status')
    expect(modeStatus).toHaveAttribute('aria-live', 'polite')
    expect(freeStatus.closest('[aria-live]')).toBe(freeStatus)
    expect(modeStatus.closest('[aria-live]')).toBe(modeStatus)
  })

  it.each([true, false])(
    'keeps the shared mode context inside the guide bubble when guided is %s',
    (guided) => {
      render(
        <LearningGuide
          {...defaultProps}
          guided={guided}
          modeControls={<p data-testid="shared-mode-context">原理模式说明</p>}
        />,
      )

      expect(screen.getByTestId('shared-mode-context')).toBeVisible()
      expect(
        screen.getByTestId('shared-mode-context').closest(
          '.learning-guide__mode-context',
        ),
      ).toBeInTheDocument()
      expect(screen.getByTestId('shared-mode-context').closest('aside')).toHaveClass(
        'learning-guide',
      )
    },
  )

  it('keeps exactly one primary guide action in every visible state', async () => {
    const user = userEvent.setup()
    const { container, rerender } = render(
      <LearningGuide {...defaultProps} />,
    )

    const expectOnlyPrimary = (name: string) => {
      const primaryActions = container.querySelectorAll(
        '.ui-button--primary:not([hidden])',
      )
      expect(primaryActions).toHaveLength(1)
      expect(primaryActions[0]).toHaveAccessibleName(name)
    }

    expectOnlyPrimary('我想好了')
    expect(
      screen.getByRole('button', { name: '切换到自由探索' }),
    ).toHaveClass('ui-button--ghost')
    expect(screen.getByRole('button', { name: '看提示' })).toHaveClass(
      'ui-button--secondary',
    )

    await user.click(screen.getByRole('button', { name: '我想好了' }))
    expectOnlyPrimary('再试一次')

    rerender(<LearningGuide {...defaultProps} guided={false} />)
    expectOnlyPrimary('打开新手导览')
  })
})
