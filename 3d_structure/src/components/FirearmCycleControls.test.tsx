import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ExhibitCycleState } from '../scene/types'
import { FirearmCycleControls } from './FirearmCycleControls'

const handlers = {
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onReset: vi.fn(),
}

function renderControls(
  cycleState: ExhibitCycleState = {
    phaseIndex: 0,
    status: 'idle',
    revision: 0,
  },
  reducedMotion = false,
) {
  return render(
    <FirearmCycleControls
      cycleDescriptionId="firearm-cycle-description"
      cycleState={cycleState}
      reducedMotion={reducedMotion}
      {...handlers}
    />,
  )
}

describe('FirearmCycleControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes five accessible controls and the exact polite phase status', () => {
    renderControls()

    expect(
      screen.getByRole('button', { name: '播放一次机械循环' }),
    ).not.toHaveAttribute('aria-pressed')
    expect(
      screen.getByRole('button', { name: '暂停机械循环' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '上一循环阶段' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '下一循环阶段' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: '复原循环' }),
    ).toBeEnabled()
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(
      screen.getByRole('button', { name: '播放一次机械循环' }),
    ).toHaveClass('ui-button--secondary')
    expect(document.querySelectorAll('.ui-button--primary')).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: '上一循环阶段' }),
    ).toHaveClass('ui-button--secondary')
    expect(screen.getByRole('button', { name: '复原循环' })).toHaveClass(
      'ui-button--ghost',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      '循环阶段 1 / 6：准备观察。',
    )
    expect(screen.getByRole('status')).toHaveAttribute(
      'id',
      'firearm-cycle-description',
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true')
  })

  it('shows the exact inert-demonstration safety note', () => {
    renderControls()

    expect(
      screen.getByText('惰性示意弹 / 非拆装顺序'),
    ).toBeVisible()
  })

  it('uses replay labeling and disables forward stepping at completion', () => {
    renderControls({ phaseIndex: 5, status: 'complete', revision: 2 })

    expect(
      screen.getByRole('button', { name: '再次播放机械循环' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: '下一循环阶段' }),
    ).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      '循环阶段 6 / 6：返回并完成单次循环。',
    )
  })

  it('disables continuous play for reduced motion but keeps manual stepping', async () => {
    const user = userEvent.setup()
    renderControls(
      { phaseIndex: 2, status: 'paused', revision: 1 },
      true,
    )

    expect(
      screen.getByRole('button', { name: '播放一次机械循环' }),
    ).toBeDisabled()
    expect(
      screen.getByText('已减少动态；可使用上一/下一循环阶段逐步查看。'),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: '上一循环阶段' }),
    )
    await user.click(
      screen.getByRole('button', { name: '下一循环阶段' }),
    )

    expect(handlers.onPrevious).toHaveBeenCalledTimes(1)
    expect(handlers.onNext).toHaveBeenCalledTimes(1)
  })
})
