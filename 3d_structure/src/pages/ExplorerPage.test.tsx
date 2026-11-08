import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { exhibits } from '../content/exhibits'
import { m4Parts, m4Steps } from '../content/m4'
import type { PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import { FIREARM_CYCLE_PHASE_DURATION_MS } from '../scene/firearmCycle'
import type { ExhibitSceneLoader } from '../scene/types'
import { ExplorerPage } from './ExplorerPage'

vi.mock('../scene/TankScene', () => ({
  default: ({
    stepIndex,
    mode,
    selectedPartId,
    focusPartId,
    autoplay,
    resetToken,
    cameraCommand,
    onSelect,
  }: {
    stepIndex: number
    mode: ExploreMode
    selectedPartId: PartId | null
    focusPartId?: PartId | null
    autoplay: boolean
    resetToken: number
    cameraCommand?: { token: number; type: string }
    onSelect: (partId: PartId) => void
  }) => (
    <>
      <button
        type="button"
        aria-label="从三维场景选择星形发动机"
        onClick={() => onSelect('engine-module')}
      >
        模拟三维场景
      </button>
      <output data-testid="mock-scene-state">
        {JSON.stringify({
          stepIndex,
          mode,
          selectedPartId,
          autoplay,
          resetToken,
        })}
      </output>
      <output data-testid="mock-camera-command">
        {JSON.stringify(cameraCommand ?? null)}
      </output>
      <output data-testid="mock-focus-part">
        {focusPartId ?? 'none'}
      </output>
    </>
  ),
}))

describe('ExplorerPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves through stages and resets', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    await user.click(
      screen.getByRole('button', { name: '动力：动力传递' }),
    )
    expect(screen.getByText('04 / 06')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '复原模型' }))
    expect(screen.getByText('01 / 06')).toBeVisible()
  })

  it('opens with a guide and lets the learner switch to free exploration', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    expect(screen.getByText('新手导览')).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: '切换到自由探索' }),
    )
    expect(screen.getByText('自由探索已开启')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '打开新手导览' }))
    expect(screen.getByText('新手导览')).toBeVisible()
  })

  it('shows the active stage question exactly once in the guide bubble', () => {
    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    expect(screen.getAllByText(m4Steps[0].question)).toHaveLength(1)
    expect(
      screen.getByRole('heading', { level: 1, name: m4Steps[0].question }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: '拆解步骤' })).queryByText(
        m4Steps[0].question,
      ),
    ).not.toBeInTheDocument()
    expect(
      within(
        screen.getByRole('complementary', { name: '结构知识卡' }),
      ).queryByText(m4Steps[0].question),
    ).not.toBeInTheDocument()
  })

  it('opens the inspector for a scene selection without stealing focus', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} supportsWebGL={() => true} />)

    const toggle = screen.getByRole('button', {
      name: '收起结构观察面板',
    })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('explorer-inspector-panel')).toHaveAttribute(
      'hidden',
    )
    expect(screen.getByTestId('explorer-inspector-panel')).not.toBeVisible()

    const sceneSelection = await screen.findByRole('button', {
      name: '从三维场景选择星形发动机',
    })
    await user.click(sceneSelection)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('explorer-inspector-panel')).not.toHaveAttribute(
      'hidden',
    )
    expect(sceneSelection).toHaveFocus()
    expect(
      screen.getByRole('heading', { level: 2, name: '星形发动机' }),
    ).toBeVisible()
  })

  it('closes the non-persisted inspector when the model resets', async () => {
    const user = userEvent.setup()
    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    expect(
      screen.getByRole('button', { name: '收起结构观察面板' }),
    ).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: '复原模型' }))

    expect(
      screen.getByRole('button', { name: '展开结构观察面板' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('explorer-inspector-panel')).toHaveAttribute(
      'hidden',
    )
  })

  it('starts with the inspector sheet collapsed on a compact viewport', () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(
      window,
      'matchMedia',
    )

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(max-width: 40rem)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })

    try {
      render(<ExplorerPage onExit={vi.fn()} forceStatic />)

      expect(
        screen.getByRole('button', { name: '展开结构观察面板' }),
      ).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('explorer-inspector-panel')).toHaveAttribute(
        'hidden',
      )
      expect(screen.getByRole('main')).toHaveClass(
        'explorer-workspace--inspector-collapsed',
      )
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })

  it('switches the non-persisted sheet state across the compact breakpoint', () => {
    let compactChange:
      | ((event: MediaQueryListEvent) => void)
      | undefined
    const originalMatchMedia = Object.getOwnPropertyDescriptor(
      window,
      'matchMedia',
    )

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => {
          if (query === '(max-width: 40rem)') compactChange = listener
        },
        removeEventListener: vi.fn(),
      })),
    })

    try {
      render(<ExplorerPage onExit={vi.fn()} forceStatic />)
      expect(
        screen.getByRole('button', { name: '收起结构观察面板' }),
      ).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('main')).toHaveClass(
        'explorer-workspace--inspector-expanded',
      )

      act(() => compactChange?.({ matches: true } as MediaQueryListEvent))
      expect(
        screen.getByRole('button', { name: '展开结构观察面板' }),
      ).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByRole('main')).toHaveClass(
        'explorer-workspace--inspector-collapsed',
      )

      act(() => compactChange?.({ matches: false } as MediaQueryListEvent))
      expect(
        screen.getByRole('button', { name: '收起结构观察面板' }),
      ).toHaveAttribute('aria-expanded', 'true')
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })

  it('advances the automatic demonstration by stage and pauses cleanly', async () => {
    vi.useFakeTimers()

    try {
      render(<ExplorerPage onExit={vi.fn()} forceStatic />)

      fireEvent.click(screen.getByRole('button', { name: '自动演示' }))
      expect(screen.getByRole('button', { name: '暂停演示' })).toBeVisible()

      await act(async () => vi.advanceTimersByTimeAsync(2_000))
      expect(screen.getByText('02 / 06')).toBeVisible()

      fireEvent.click(screen.getByRole('button', { name: '暂停演示' }))
      await act(async () => vi.advanceTimersByTimeAsync(4_000))
      expect(screen.getByText('02 / 06')).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the automatic demonstration timer when unmounted', async () => {
    vi.useFakeTimers()

    try {
      const { unmount } = render(
        <ExplorerPage onExit={vi.fn()} forceStatic />,
      )
      const timersBeforeDemo = vi.getTimerCount()
      fireEvent.click(screen.getByRole('button', { name: '自动演示' }))

      expect(vi.getTimerCount()).toBe(timersBeforeDemo + 1)
      unmount()
      expect(vi.getTimerCount()).toBeLessThanOrEqual(timersBeforeDemo)
    } finally {
      vi.useRealTimers()
    }
  })

  it('selects a part and updates the knowledge card', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    const engineButton = screen.getByRole('button', {
      name: '查看星形发动机',
    })
    expect(
      engineButton.querySelector('[data-part-accent-token="--part-oxide"]'),
    ).toBeInTheDocument()
    await user.click(engineButton)

    expect(
      screen.getByRole('heading', { level: 2, name: '星形发动机' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('史实依据'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('简化示意'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('观察问题'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/部分 M4A1 型使用/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/模型用九个圆柱体/),
    ).toBeInTheDocument()
  })

  it('keeps the firearm non-disassembly boundary visible in the default stage and knowledge card', async () => {
    const user = userEvent.setup()

    render(
      <ExplorerPage exhibitId="m1911a1" onExit={vi.fn()} forceStatic />,
    )

    const stage = screen.getByRole('region', {
      name: 'M1911A1结构舞台',
    })
    const knowledgeCard = () =>
      screen.getByRole('complementary', { name: '结构知识卡' })
    const knowledgeSafetyNotice = () =>
      knowledgeCard().querySelector('.knowledge-panel__safety-notice')

    expect(
      within(stage).getByText(/惰性示意弹 \/ 非拆装顺序/),
    ).toBeVisible()
    expect(knowledgeCard()).toHaveTextContent('惰性示意弹 / 非拆装顺序')
    expect(knowledgeCard()).toHaveTextContent(
      exhibits.m1911a1.reconstructionNote,
    )
    expect(knowledgeSafetyNotice()).toBeVisible()
    expect(
      getComputedStyle(knowledgeSafetyNotice() as Element).fontSize,
    ).toBe('1rem')

    await user.click(
      screen.getByRole('button', { name: '查看M1911A1 套筒闭锁体' }),
    )

    expect(knowledgeCard()).toHaveTextContent('惰性示意弹 / 非拆装顺序')
    expect(knowledgeCard()).toHaveTextContent(
      exhibits.m1911a1.reconstructionNote,
    )
    expect(knowledgeSafetyNotice()).toBeVisible()
    expect(
      getComputedStyle(knowledgeSafetyNotice() as Element).fontSize,
    ).toBe('1rem')
  })

  it('narrates the historical fact, simplified principle, and observation question', async () => {
    const user = userEvent.setup()
    const speak = vi.fn()

    class MockSpeechSynthesisUtterance {
      lang = ''

      constructor(readonly text: string) {}
    }

    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      speak,
    })
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance)

    try {
      render(<ExplorerPage onExit={vi.fn()} forceStatic />)
      await user.click(screen.getByRole('button', { name: '查看星形发动机' }))
      await user.click(screen.getByRole('button', { name: '朗读当前知识卡' }))

      const utterance = speak.mock.calls[0]?.[0] as
        | MockSpeechSynthesisUtterance
        | undefined

      expect(utterance?.text).toContain('史实依据')
      expect(utterance?.text).toContain('简化示意')
      expect(utterance?.text).toContain('观察问题')
      expect(utterance?.lang).toBe('zh-CN')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('mounts the lazy scene and routes scene selection to the knowledge card', async () => {
    const user = userEvent.setup()

    render(
      <ExplorerPage onExit={vi.fn()} supportsWebGL={() => true} />,
    )

    const sceneSelection = await screen.findByRole('button', {
      name: '从三维场景选择星形发动机',
    })
    expect(sceneSelection).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'M4 中型坦克静态结构示意' }),
    ).not.toBeInTheDocument()

    await user.click(sceneSelection)

    expect(
      screen.getByRole('heading', { level: 2, name: '星形发动机' }),
    ).toBeInTheDocument()
  })

  it('passes authoritative firearm cycle state to an injected scene', async () => {
    const sceneLoader: ExhibitSceneLoader = async () => ({
      default: ({ exhibitId, autoplay, cycleState }) => (
        <output data-testid="injected-scene-props">
          {JSON.stringify({ exhibitId, autoplay, cycleState })}
        </output>
      ),
    })

    render(
      <ExplorerPage
        exhibitId="m1911a1"
        onExit={vi.fn()}
        supportsWebGL={() => true}
        sceneLoader={sceneLoader}
      />,
    )

    expect(await screen.findByTestId('injected-scene-props')).toHaveTextContent(
      JSON.stringify({
        exhibitId: 'm1911a1',
        autoplay: false,
        cycleState: { phaseIndex: 0, status: 'idle', revision: 0 },
      }),
    )
  })

  it('shares one stable cycle description id with the scene and exact status element', async () => {
    const user = userEvent.setup()
    const sceneLoader: ExhibitSceneLoader = async () => ({
      default: ({ cycleDescriptionId }) => (
        <output data-testid="injected-cycle-description-id">
          {cycleDescriptionId}
        </output>
      ),
    })

    render(
      <ExplorerPage
        exhibitId="m1911a1"
        onExit={vi.fn()}
        supportsWebGL={() => true}
        sceneLoader={sceneLoader}
      />,
    )

    const injectedId = await screen.findByTestId(
      'injected-cycle-description-id',
    )
    await user.click(screen.getByRole('button', { name: '原理模式' }))

    expect(injectedId.textContent).not.toBe('')
    const descriptionId = injectedId.textContent ?? ''
    expect(
      screen.getByText('循环阶段 1 / 6：准备观察。'),
    ).toHaveAttribute('id', descriptionId)

    await user.click(
      screen.getByRole('button', { name: '下一循环阶段' }),
    )

    expect(injectedId).toHaveTextContent(descriptionId)
    expect(
      screen.getByText('循环阶段 2 / 6：抽象能量出现。'),
    ).toHaveAttribute('id', descriptionId)
  })

  it('increments the firearm cycle revision when the main reset is used', async () => {
    const user = userEvent.setup()
    const sceneLoader: ExhibitSceneLoader = async () => ({
      default: ({ cycleState }) => (
        <output data-testid="cycle-revision">
          {JSON.stringify(cycleState)}
        </output>
      ),
    })

    render(
      <ExplorerPage
        exhibitId="m1911a1"
        onExit={vi.fn()}
        supportsWebGL={() => true}
        sceneLoader={sceneLoader}
      />,
    )
    const sceneState = await screen.findByTestId('cycle-revision')
    await user.click(screen.getByRole('button', { name: '原理模式' }))
    await user.click(
      screen.getByRole('button', { name: '播放一次机械循环' }),
    )
    expect(sceneState).toHaveTextContent(
      JSON.stringify({ phaseIndex: 0, status: 'playing', revision: 0 }),
    )

    await user.click(screen.getByRole('button', { name: '复原模型' }))

    expect(sceneState).toHaveTextContent(
      JSON.stringify({ phaseIndex: 0, status: 'idle', revision: 1 }),
    )
  })

  it('renders one firearm control set only in principle mode with exact static labeling', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ExplorerPage exhibitId="m1911a1" onExit={vi.fn()} forceStatic />,
    )
    const stage = screen.getByRole('region', {
      name: 'M1911A1结构舞台',
    })

    expect(
      screen.queryByRole('button', { name: '播放一次机械循环' }),
    ).not.toBeInTheDocument()
    expect(stage).toHaveAttribute('data-cycle-state', 'idle')
    expect(stage).toHaveAttribute('data-cycle-phase', '0')

    await user.click(screen.getByRole('button', { name: '原理模式' }))

    expect(
      screen.getAllByRole('button', { name: '播放一次机械循环' }),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: '播放原理' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('原理动画已暂停。')).not.toBeInTheDocument()
    expect(
      screen.getByText('循环阶段 1 / 6：准备观察。'),
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'M1911A1 静态结构示意' }),
    ).toBeInTheDocument()
    const cycleControls = screen.getByRole('region', {
      name: '机械循环控制',
    })
    const cycleActions = cycleControls.querySelector(
      '.firearm-cycle-controls__actions',
    )
    expect(getComputedStyle(cycleActions as Element).display).toBe('grid')
    expect(
      getComputedStyle(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      ).minHeight,
    ).toBe('44px')
    expect(
      getComputedStyle(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      ).minWidth,
    ).toBe('44px')
    expect(container.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('keeps the firearm mode context in the guide and one primary action across guide states', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ExplorerPage exhibitId="mp5" onExit={vi.fn()} forceStatic />,
    )

    const expectOnlyPrimary = (name: string) => {
      const primaryActions = container.querySelectorAll('.ui-button--primary')
      expect(primaryActions).toHaveLength(1)
      expect(primaryActions[0]).toHaveAccessibleName(name)
    }
    const expectModeContextInGuide = () => {
      const guide = container.querySelector<HTMLElement>('.learning-guide')
      const modeStatus = container.querySelector<HTMLElement>(
        '.explorer-mode-status',
      )
      expect(guide).toContainElement(modeStatus)
    }

    expectOnlyPrimary('我想好了')
    expectModeContextInGuide()

    await user.click(screen.getByRole('button', { name: '原理模式' }))

    const cycleControls = screen.getByRole('region', {
      name: '机械循环控制',
    })
    expect(container.querySelector('.learning-guide')).toContainElement(
      cycleControls,
    )
    expect(
      screen.getByRole('button', { name: '播放一次机械循环' }),
    ).toHaveClass('ui-button--secondary')
    expectOnlyPrimary('我想好了')

    await user.click(screen.getByRole('button', { name: '看提示' }))
    expectOnlyPrimary('我想好了')

    await user.click(screen.getByRole('button', { name: '我想好了' }))
    expectOnlyPrimary('再试一次')

    await user.click(
      screen.getByRole('button', { name: '切换到自由探索' }),
    )
    expectOnlyPrimary('打开新手导览')
    expectModeContextInGuide()
  })

  it('keeps one primary action for non-firearm principle and reduced-motion states', async () => {
    const user = userEvent.setup()
    const originalMatchMedia = Object.getOwnPropertyDescriptor(
      window,
      'matchMedia',
    )

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    })

    try {
      const { container } = render(
        <ExplorerPage exhibitId="m4" onExit={vi.fn()} forceStatic />,
      )
      const expectOnlyPrimary = (name: string) => {
        const primaryActions = container.querySelectorAll(
          '.ui-button--primary',
        )
        expect(primaryActions).toHaveLength(1)
        expect(primaryActions[0]).toHaveAccessibleName(name)
      }

      expectOnlyPrimary('我想好了')
      await user.click(screen.getByRole('button', { name: '原理模式' }))
      expect(screen.getByRole('button', { name: '播放原理' })).toBeDisabled()
      expect(container.querySelector('.learning-guide')).toContainElement(
        screen.getByRole('button', { name: '播放原理' }),
      )
      expectOnlyPrimary('我想好了')

      await user.click(screen.getByRole('button', { name: '我想好了' }))
      expectOnlyPrimary('再试一次')

      await user.click(
        screen.getByRole('button', { name: '切换到自由探索' }),
      )
      expectOnlyPrimary('打开新手导览')
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })

  it('updates the static firearm guide highlight when the main stage changes', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ExplorerPage exhibitId="m1911a1" onExit={vi.fn()} forceStatic />,
    )
    const diagram = () => container.querySelector('.tank-diagram--firearm')

    expect(diagram()).toHaveAttribute('data-firearm-guide-step', '0')
    expect(
      container.querySelector('[data-guide-highlight="true"]'),
    ).toHaveAttribute('data-guide-layer', 'profile')

    await user.click(
      screen.getByRole('button', { name: '闭锁：倾斜闭锁' }),
    )

    expect(diagram()).toHaveAttribute('data-firearm-guide-step', '2')
    expect(
      container.querySelector('[data-guide-highlight="true"]'),
    ).toHaveAttribute('data-guide-layer', 'locking-interface')
  })

  it('plays exactly one six-phase firearm cycle without looping', async () => {
    vi.useFakeTimers()

    try {
      render(
        <ExplorerPage exhibitId="m1911a1" onExit={vi.fn()} forceStatic />,
      )
      fireEvent.click(screen.getByRole('button', { name: '原理模式' }))
      const stage = screen.getByRole('region', {
        name: 'M1911A1结构舞台',
      })
      const timersBeforePlay = vi.getTimerCount()

      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      expect(stage).toHaveAttribute('data-cycle-state', 'playing')
      expect(stage).toHaveAttribute('data-cycle-phase', '0')
      expect(vi.getTimerCount()).toBe(timersBeforePlay + 1)

      for (let phase = 0; phase < 5; phase += 1) {
        await act(async () =>
          vi.advanceTimersByTimeAsync(FIREARM_CYCLE_PHASE_DURATION_MS),
        )
      }
      expect(stage).toHaveAttribute('data-cycle-state', 'playing')
      expect(stage).toHaveAttribute('data-cycle-phase', '5')
      expect(
        screen.getByText(
          '循环阶段 6 / 6：返回并完成单次循环。',
        ),
      ).toBeVisible()

      await act(async () =>
        vi.advanceTimersByTimeAsync(FIREARM_CYCLE_PHASE_DURATION_MS),
      )
      expect(stage).toHaveAttribute('data-cycle-state', 'complete')
      expect(stage).toHaveAttribute('data-cycle-phase', '5')
      expect(
        screen.getByRole('button', { name: '再次播放机械循环' }),
      ).toBeEnabled()
      expect(vi.getTimerCount()).toBe(0)

      await act(async () =>
        vi.advanceTimersByTimeAsync(
          FIREARM_CYCLE_PHASE_DURATION_MS * 2,
        ),
      )
      expect(stage).toHaveAttribute('data-cycle-state', 'complete')
      expect(stage).toHaveAttribute('data-cycle-phase', '5')
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses, resumes, manually steps, and resets a firearm cycle', async () => {
    vi.useFakeTimers()

    try {
      render(
        <ExplorerPage exhibitId="m1911a1" onExit={vi.fn()} forceStatic />,
      )
      fireEvent.click(screen.getByRole('button', { name: '原理模式' }))
      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      await act(async () =>
        vi.advanceTimersByTimeAsync(FIREARM_CYCLE_PHASE_DURATION_MS / 2),
      )

      const stage = screen.getByRole('region', {
        name: 'M1911A1结构舞台',
      })
      fireEvent.click(
        screen.getByRole('button', { name: '暂停机械循环' }),
      )
      expect(stage).toHaveAttribute('data-cycle-state', 'paused')
      expect(stage).toHaveAttribute('data-cycle-phase', '0')
      const timersWhilePaused = vi.getTimerCount()

      await act(async () =>
        vi.advanceTimersByTimeAsync(
          FIREARM_CYCLE_PHASE_DURATION_MS * 2,
        ),
      )
      expect(stage).toHaveAttribute('data-cycle-phase', '0')

      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      expect(vi.getTimerCount()).toBe(timersWhilePaused + 1)
      await act(async () =>
        vi.advanceTimersByTimeAsync(FIREARM_CYCLE_PHASE_DURATION_MS / 2 - 1),
      )
      expect(stage).toHaveAttribute('data-cycle-phase', '0')
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(stage).toHaveAttribute('data-cycle-phase', '1')

      fireEvent.click(
        screen.getByRole('button', { name: '下一循环阶段' }),
      )
      expect(stage).toHaveAttribute('data-cycle-state', 'paused')
      expect(stage).toHaveAttribute('data-cycle-phase', '2')
      expect(vi.getTimerCount()).toBe(timersWhilePaused)

      fireEvent.click(
        screen.getByRole('button', { name: '上一循环阶段' }),
      )
      expect(stage).toHaveAttribute('data-cycle-phase', '1')

      fireEvent.click(
        screen.getByRole('button', { name: '复原循环' }),
      )
      expect(stage).toHaveAttribute('data-cycle-state', 'idle')
      expect(stage).toHaveAttribute('data-cycle-phase', '0')
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the firearm timer on mode, step, exhibit, and unmount changes', async () => {
    vi.useFakeTimers()

    try {
      const { rerender, unmount } = render(
        <ExplorerPage exhibitId="m1911a1" onExit={vi.fn()} forceStatic />,
      )
      act(() => vi.advanceTimersByTime(0))
      const timersAtRest = vi.getTimerCount()
      fireEvent.click(screen.getByRole('button', { name: '原理模式' }))
      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      act(() => vi.advanceTimersByTime(0))
      expect(vi.getTimerCount()).toBe(timersAtRest + 1)

      fireEvent.click(screen.getByRole('button', { name: '透视模式' }))
      act(() => vi.advanceTimersByTime(0))
      expect(vi.getTimerCount()).toBe(timersAtRest)

      fireEvent.click(screen.getByRole('button', { name: '原理模式' }))
      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      fireEvent.click(
        screen.getByRole('button', {
          name: `${exhibits.m1911a1.steps[1].shortLabel}：${exhibits.m1911a1.steps[1].label}`,
        }),
      )
      act(() => vi.advanceTimersByTime(0))
      expect(
        screen.getByRole('region', { name: 'M1911A1结构舞台' }),
      ).toHaveAttribute('data-cycle-state', 'idle')
      expect(vi.getTimerCount()).toBe(timersAtRest)

      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      rerender(
        <ExplorerPage exhibitId="mp5" onExit={vi.fn()} forceStatic />,
      )
      act(() => vi.advanceTimersByTime(0))
      expect(vi.getTimerCount()).toBe(timersAtRest)
      expect(
        screen.getByRole('region', { name: 'HK MP5结构舞台' }),
      ).toHaveAttribute('data-cycle-state', 'idle')

      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      act(() => vi.advanceTimersByTime(0))
      expect(vi.getTimerCount()).toBe(timersAtRest + 1)
      unmount()
      act(() => vi.advanceTimersByTime(0))
      expect(vi.getTimerCount()).toBe(timersAtRest)
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses at the current phase when reduced motion becomes active', () => {
    vi.useFakeTimers()
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined
    const originalMatchMedia = Object.getOwnPropertyDescriptor(
      window,
      'matchMedia',
    )

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => {
          changeListener = listener
        },
        removeEventListener: vi.fn(),
      })),
    })

    try {
      render(
        <ExplorerPage exhibitId="m1911a1" onExit={vi.fn()} forceStatic />,
      )
      act(() => vi.advanceTimersByTime(0))
      fireEvent.click(screen.getByRole('button', { name: '原理模式' }))
      fireEvent.click(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      )
      const stage = screen.getByRole('region', {
        name: 'M1911A1结构舞台',
      })

      act(() => {
        changeListener?.({ matches: true } as MediaQueryListEvent)
        vi.advanceTimersByTime(0)
      })

      expect(stage).toHaveAttribute('data-cycle-state', 'paused')
      expect(stage).toHaveAttribute('data-cycle-phase', '0')
      expect(
        screen.getByRole('button', { name: '播放一次机械循环' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: '下一循环阶段' }),
      ).toBeEnabled()
      expect(
        screen.getByText('已减少动态；可使用上一/下一循环阶段逐步查看。'),
      ).toBeVisible()

      act(() =>
        vi.advanceTimersByTime(FIREARM_CYCLE_PHASE_DURATION_MS * 2),
      )
      expect(stage).toHaveAttribute('data-cycle-phase', '0')
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
      vi.useRealTimers()
    }
  })

  it('offers keyboard-operable rotation, zoom, and selected-part focus', async () => {
    const user = userEvent.setup()

    render(
      <ExplorerPage onExit={vi.fn()} supportsWebGL={() => true} />,
    )

    const controls = await screen.findByRole('group', {
      name: '三维视角控制',
    })
    const command = await screen.findByTestId('mock-camera-command')
    const focus = within(controls).getByRole('button', {
      name: '聚焦已选零件',
    })

    expect(focus).toBeDisabled()

    await user.click(
      within(controls).getByRole('button', { name: '向左旋转视角' }),
    )
    expect(command).toHaveTextContent(
      JSON.stringify({ token: 1, type: 'rotate-left' }),
    )

    await user.click(screen.getByRole('button', { name: '复原模型' }))
    expect(command).toHaveTextContent('null')
    await user.click(
      within(controls).getByRole('button', { name: '向右旋转视角' }),
    )
    expect(command).toHaveTextContent(
      JSON.stringify({ token: 2, type: 'rotate-right' }),
    )

    await user.click(
      within(controls).getByRole('button', { name: '拉近视角' }),
    )
    expect(command).toHaveTextContent(
      JSON.stringify({ token: 3, type: 'zoom-in' }),
    )

    await user.click(
      screen.getByRole('button', { name: '展开结构观察面板' }),
    )
    await user.click(
      screen.getByRole('button', { name: '查看星形发动机' }),
    )
    expect(focus).toBeEnabled()
    expect(screen.getByTestId('mock-focus-part')).toHaveTextContent(
      'engine-module',
    )

    await user.click(focus)
    expect(command).toHaveTextContent(
      JSON.stringify({ token: 4, type: 'focus-selected' }),
    )

    await user.click(
      screen.getByRole('button', { name: '整体：观察整体' }),
    )
    expect(
      screen.queryByRole('heading', { name: '星形发动机' }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('mock-focus-part')).toHaveTextContent(
      'engine-module',
    )

    await user.click(
      screen.getByRole('button', { name: '外部：外部结构' }),
    )
    expect(screen.getByTestId('mock-focus-part')).toHaveTextContent('none')
  })

  it('creates a fresh lazy payload when a rejected scene load is retried', async () => {
    const user = userEvent.setup()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    let attempts = 0
    const sceneLoader = vi.fn(async () => {
      attempts += 1

      if (attempts === 1) {
        throw new Error('scene chunk unavailable')
      }

      return {
        default: () => <p>重试后的三维场景</p>,
      }
    })

    try {
      render(
        <ExplorerPage
          onExit={vi.fn()}
          supportsWebGL={() => true}
          sceneLoader={sceneLoader}
        />,
      )

      expect(
        await screen.findByText('3D 展示暂时不可用'),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('navigation', { name: '拆解步骤' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('complementary', { name: '结构知识卡' }),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '重新尝试' }))

      expect(await screen.findByText('重试后的三维场景')).toBeInTheDocument()
      expect(sceneLoader).toHaveBeenCalledTimes(2)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('keeps the active firearm profile, guide step, and cycle phase in the Explorer fallback', async () => {
    const user = userEvent.setup()
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const sceneLoader = vi.fn(async () => {
      throw new Error('firearm scene unavailable')
    })

    try {
      render(
        <ExplorerPage
          exhibitId="mp5"
          onExit={vi.fn()}
          supportsWebGL={() => true}
          sceneLoader={sceneLoader}
        />,
      )

      expect(
        await screen.findByText('3D 展示暂时不可用'),
      ).toBeInTheDocument()
      const fallbackDiagram = screen.getByRole('img', {
        name: 'HK MP5 静态结构示意',
      })

      expect(
        fallbackDiagram.querySelector('[data-firearm-profile="mp5"]'),
      ).toBeInTheDocument()
      expect(fallbackDiagram).toHaveAttribute(
        'data-firearm-guide-step',
        '0',
      )
      expect(fallbackDiagram).toHaveAttribute('data-firearm-phase', '0')

      await user.click(
        screen.getByRole('button', { name: '能量：惰性能量' }),
      )
      await user.click(screen.getByRole('button', { name: '原理模式' }))
      const nextPhase = screen.getByRole('button', {
        name: '下一循环阶段',
      })
      await user.click(nextPhase)
      await user.click(nextPhase)
      await user.click(nextPhase)
      await user.click(nextPhase)

      expect(fallbackDiagram).toHaveAttribute(
        'data-firearm-guide-step',
        '3',
      )
      expect(fallbackDiagram).toHaveAttribute('data-firearm-phase', '4')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('exposes pressed-state modes and observable principle playback', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    const explode = screen.getByRole('button', { name: '拆解模式' })
    const xray = screen.getByRole('button', { name: '透视模式' })
    const principle = screen.getByRole('button', { name: '原理模式' })

    expect(explode).toHaveAttribute('aria-pressed', 'true')
    expect(xray).toHaveAttribute('aria-pressed', 'false')
    expect(principle).toHaveAttribute('aria-pressed', 'false')

    await user.click(principle)
    expect(principle).toHaveAttribute('aria-pressed', 'true')

    const stage = screen.getByRole('region', {
      name: 'M4 中型坦克结构舞台',
    })
    expect(stage).toHaveAttribute('data-playing', 'false')

    const play = screen.getByRole('button', { name: '播放原理' })
    expect(play).toHaveAttribute('aria-pressed', 'false')

    await user.click(play)
    expect(screen.getByRole('button', { name: '暂停原理' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('正在播放原理动画。')).toBeVisible()
    expect(stage).toHaveAttribute('data-playing', 'true')

    await user.click(screen.getByRole('button', { name: '暂停原理' }))
    expect(screen.getByRole('button', { name: '播放原理' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByText('原理动画已暂停。')).toBeVisible()
    expect(stage).toHaveAttribute('data-playing', 'false')
  })

  it('keeps principle animation off and explains reduced motion', async () => {
    const user = userEvent.setup()
    const originalMatchMedia = Object.getOwnPropertyDescriptor(
      window,
      'matchMedia',
    )

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    })

    try {
      render(<ExplorerPage onExit={vi.fn()} forceStatic />)
      await user.click(screen.getByRole('button', { name: '原理模式' }))

      expect(screen.getByRole('button', { name: '播放原理' })).toBeDisabled()
      expect(screen.getByText(/已减少动态/)).toBeVisible()
      expect(screen.queryByText('正在播放原理动画。')).not.toBeInTheDocument()
      expect(
        screen.getByRole('region', { name: 'M4 中型坦克结构舞台' }),
      ).toHaveAttribute('data-playing', 'false')
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })

  it('reacts to reduced-motion changes and cleans up the media listener', async () => {
    const user = userEvent.setup()
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined
    const addEventListener = vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        changeListener = listener
      },
    )
    const removeEventListener = vi.fn()
    const mediaQuery = {
      matches: false,
      addEventListener,
      removeEventListener,
    }
    const originalMatchMedia = Object.getOwnPropertyDescriptor(
      window,
      'matchMedia',
    )

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mediaQuery),
    })

    try {
      const { unmount } = render(
        <ExplorerPage onExit={vi.fn()} forceStatic />,
      )

      await user.click(screen.getByRole('button', { name: '自动演示' }))
      await user.click(screen.getByRole('button', { name: '原理模式' }))
      await user.click(screen.getByRole('button', { name: '播放原理' }))
      expect(screen.getByRole('button', { name: '暂停演示' })).toBeVisible()
      expect(
        screen.getByRole('region', { name: 'M4 中型坦克结构舞台' }),
      ).toHaveAttribute('data-playing', 'true')

      act(() => {
        changeListener?.({ matches: true } as MediaQueryListEvent)
      })

      expect(screen.getByRole('button', { name: '自动演示' })).toBeDisabled()
      expect(screen.getByRole('button', { name: '播放原理' })).toBeDisabled()
      expect(
        screen.getByRole('region', { name: 'M4 中型坦克结构舞台' }),
      ).toHaveAttribute('data-playing', 'false')

      unmount()
      expect(addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      )
      expect(removeEventListener).toHaveBeenCalledWith(
        'change',
        changeListener,
      )
    } finally {
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia)
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })

  it('shares reset behavior between the button and plain r', async () => {
    const user = userEvent.setup()

    render(
      <ExplorerPage onExit={vi.fn()} supportsWebGL={() => true} />,
    )

    const sceneState = await screen.findByTestId('mock-scene-state')
    expect(sceneState).toHaveTextContent(
      JSON.stringify({
        stepIndex: 0,
        mode: 'explode',
        selectedPartId: null,
        autoplay: false,
        resetToken: 0,
      }),
    )

    const mutateScene = async () => {
      const inspectorToggle = screen.getByRole('button', {
        name: /结构观察面板/,
      })
      if (inspectorToggle.getAttribute('aria-expanded') === 'false') {
        await user.click(inspectorToggle)
      }
      await user.click(screen.getByRole('button', { name: '动力：动力传递' }))
      await user.click(screen.getByRole('button', { name: '查看星形发动机' }))
      await user.click(screen.getByRole('button', { name: '原理模式' }))
      await user.click(screen.getByRole('button', { name: '播放原理' }))
    }

    await mutateScene()
    expect(sceneState).toHaveTextContent(
      JSON.stringify({
        stepIndex: 3,
        mode: 'principle',
        selectedPartId: 'engine-module',
        autoplay: true,
        resetToken: 0,
      }),
    )

    await user.click(screen.getByRole('button', { name: '复原模型' }))
    expect(sceneState).toHaveTextContent(
      JSON.stringify({
        stepIndex: 0,
        mode: 'explode',
        selectedPartId: null,
        autoplay: false,
        resetToken: 1,
      }),
    )

    await mutateScene()
    await user.keyboard('r')
    expect(sceneState).toHaveTextContent(
      JSON.stringify({
        stepIndex: 0,
        mode: 'explode',
        selectedPartId: null,
        autoplay: false,
        resetToken: 2,
      }),
    )
  })

  it('supports keyboard stage navigation', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    await user.keyboard('{ArrowRight}{ArrowRight}')

    expect(screen.getByText('03 / 06')).toBeVisible()
  })

  it('uses plain shortcuts without hijacking modified browser keys', () => {
    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('03 / 06')).toBeVisible()

    fireEvent.keyDown(window, { key: 'r', metaKey: true })
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(window, { key: 'R', shiftKey: true })
    expect(screen.getByText('03 / 06')).toBeVisible()

    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByText('01 / 06')).toBeVisible()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('02 / 06')).toBeVisible()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('01 / 06')).toBeVisible()
  })

  it('exits with Escape and resets with lowercase r', async () => {
    const user = userEvent.setup()
    const onExit = vi.fn()

    render(<ExplorerPage onExit={onExit} forceStatic />)

    await user.keyboard('{ArrowRight}{ArrowRight}r')
    expect(screen.getByText('01 / 06')).toBeVisible()

    await user.keyboard('{Escape}')
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('keeps every part and the static diagram available without WebGL', () => {
    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    for (const part of m4Parts) {
      expect(
        screen.getByRole('button', { name: `查看${part.label}` }),
      ).toBeInTheDocument()
    }

    expect(
      screen.getByRole('img', { name: 'M4 中型坦克静态结构示意' }),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('navigation', { name: '拆解步骤' }),
      ).getAllByRole('button'),
    ).toHaveLength(6)
    expect(
      screen.getByText('已切换到静态学习模式', {
        selector: '[role="status"]',
      }),
    ).toBeVisible()
  })

  it.each([
    ['x57', 'X-57 电动飞机静态结构示意'],
    ['asr10', '现代救援船教学复合模型静态结构示意'],
  ] as const)(
    'drives the %s static explorer entirely from its exhibit definition',
    (exhibitId, diagramLabel) => {
      const exhibit = exhibits[exhibitId]

      render(
        <ExplorerPage
          exhibitId={exhibitId}
          onExit={vi.fn()}
          forceStatic
        />,
      )

      expect(screen.getByText(exhibit.title, { selector: 'strong' })).toBeVisible()
      expect(
        screen.getByRole('region', {
          name: `${exhibit.title}结构舞台`,
        }),
      ).toBeInTheDocument()
      expect(screen.getByRole('img', { name: diagramLabel })).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: exhibit.steps[0].question }),
      ).toBeVisible()

      for (const part of exhibit.parts) {
        expect(
          screen.getByRole('button', { name: `查看${part.label}` }),
        ).toBeInTheDocument()
      }

      const timeline = screen.getByRole('navigation', { name: '拆解步骤' })
      expect(within(timeline).getAllByRole('button')).toHaveLength(
        exhibit.steps.length,
      )
      expect(
        within(timeline).getByRole('button', {
          name: `${exhibit.steps[5].shortLabel}：${exhibit.steps[5].label}`,
        }),
      ).toBeInTheDocument()
    },
  )

  it('uses the selected aircraft part to populate the shared knowledge card', async () => {
    const user = userEvent.setup()
    const exhibit = exhibits.x57
    const part = exhibit.parts[6]

    render(<ExplorerPage exhibitId="x57" onExit={vi.fn()} forceStatic />)

    await user.click(screen.getByRole('button', { name: `查看${part.label}` }))

    expect(
      screen.getByRole('heading', { level: 2, name: part.label }),
    ).toBeVisible()
    expect(screen.getByText(part.historicalFact)).toBeVisible()
    expect(screen.getByText(part.simplifiedPrinciple)).toBeVisible()
    expect(screen.getByText(part.prompt)).toBeVisible()
  })

  it('keeps core learning copy at readable sizes', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    await user.click(screen.getByRole('button', { name: '查看星形发动机' }))
    const fact = screen.getByText(/部分 M4A1 型使用/)
    const timelineLabel = within(
      screen.getByRole('navigation', { name: '拆解步骤' }),
    ).getByText(m4Steps[0].shortLabel)
    await user.click(screen.getByRole('button', { name: '看提示' }))
    const guideHint = screen.getByText(m4Steps[0].hint)

    expect(getComputedStyle(fact).fontSize).toBe('1rem')
    expect(getComputedStyle(timelineLabel).fontSize).toBe('0.75rem')
    expect(getComputedStyle(guideHint).fontSize).toBe('0.8rem')
  })

  it('makes each static display mode observable on the stage', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    const stage = screen.getByRole('region', {
      name: 'M4 中型坦克结构舞台',
    })

    await user.click(screen.getByRole('button', { name: '透视模式' }))
    expect(stage).toHaveAttribute('data-mode', 'xray')
    expect(
      screen.getByText('外壳会变淡，帮助你看清内部空间。'),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: '原理模式' }))
    expect(stage).toHaveAttribute('data-mode', 'principle')
    expect(
      screen.getByText('高亮线索会带你追踪能量怎样流动。'),
    ).toBeVisible()
  })

  it('scrolls to and focuses every rail navigation target', async () => {
    const user = userEvent.setup()

    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    const destinations = [
      {
        buttonName: '前往结构舞台',
        target: screen.getByRole('region', {
          name: 'M4 中型坦克结构舞台',
        }),
      },
      {
        buttonName: '前往结构零件',
        target: screen.getByRole('group', { name: '结构零件' }),
      },
      {
        buttonName: '前往结构知识卡',
        target: screen.getByRole('complementary', { name: '结构知识卡' }),
      },
    ]

    for (const { buttonName, target } of destinations) {
      const scrollIntoView = vi.fn()
      Object.defineProperty(target, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoView,
      })
      const focus = vi.spyOn(target, 'focus')

      await user.click(screen.getByRole('button', { name: buttonName }))

      expect.soft(target).toHaveAttribute('tabindex', '-1')
      expect.soft(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      expect.soft(focus).toHaveBeenCalledWith({ preventScroll: true })
      expect
        .soft(scrollIntoView.mock.invocationCallOrder[0])
        .toBeLessThan(focus.mock.invocationCallOrder[0])
      expect.soft(target).toHaveFocus()
    }

    await user.click(screen.getByRole('button', { name: '查看星形发动机' }))
    const selectedKnowledge = screen.getByRole('complementary', {
      name: '结构知识卡',
    })
    const scrollIntoView = vi.fn()
    Object.defineProperty(selectedKnowledge, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    await user.click(screen.getByRole('button', { name: '前往结构知识卡' }))

    expect(selectedKnowledge).toHaveAttribute('tabindex', '-1')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(selectedKnowledge).toHaveFocus()
  })

  it('opens a collapsed inspector before focusing a rail destination', async () => {
    const user = userEvent.setup()
    render(<ExplorerPage onExit={vi.fn()} forceStatic />)

    await user.click(
      screen.getByRole('button', { name: '收起结构观察面板' }),
    )
    const parts = screen.getByRole('group', {
      name: '结构零件',
      hidden: true,
    })
    const scrollIntoView = vi.fn()
    Object.defineProperty(parts, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    await user.click(screen.getByRole('button', { name: '前往结构零件' }))

    expect(
      screen.getByRole('button', { name: '收起结构观察面板' }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(parts).toHaveFocus()
  })
})
