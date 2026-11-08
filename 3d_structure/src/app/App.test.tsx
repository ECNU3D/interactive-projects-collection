import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const originalHash = window.location.hash

afterEach(() => {
  cleanup()
  window.location.hash = originalHash
})

it('opens the M4 explorer after its gallery action is selected', async () => {
  const user = userEvent.setup()
  window.location.hash = ''
  render(<App />)

  expect(
    screen.getByRole('heading', { name: /拆开机械.*看见原理/ }),
  ).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: '开始探索 M4 中型坦克' }),
  )

  expect(
    await screen.findByRole('region', { name: 'M4 中型坦克结构舞台' }),
  ).toBeInTheDocument()
  expect(window.location.hash).toBe('#/explore/m4')
})

it('opens the M4 explorer when the exact route includes query options', async () => {
  window.location.hash = '#/explore/m4?no-webgl=1'
  render(<App />)

  expect(
    await screen.findByRole('img', {
      name: 'M4 中型坦克静态结构示意',
    }),
  ).toBeInTheDocument()
})

it.each([
  ['x57', 'X-57 电动飞机静态结构示意'],
  ['asr10', '现代救援船教学复合模型静态结构示意'],
] as const)(
  'opens the %s explorer with the shared no-webgl query option',
  async (exhibitId, diagramLabel) => {
    window.location.hash = `#/explore/${exhibitId}?no-webgl=1`
    render(<App />)

    expect(
      await screen.findByRole('img', { name: diagramLabel }),
    ).toBeInTheDocument()
  },
)

it.each([
  ['m1903', 'M1903 Springfield 静态结构示意'],
  ['m1911a1', 'M1911A1 静态结构示意'],
  ['m1-garand', 'M1 Garand 静态结构示意'],
  ['mp5', 'HK MP5 静态结构示意'],
] as const)(
  'opens the %s firearm explorer with the shared no-webgl query option',
  async (exhibitId, diagramLabel) => {
    window.location.hash = `#/explore/${exhibitId}?no-webgl=1`
    render(<App />)

    expect(
      await screen.findByRole('img', { name: diagramLabel }),
    ).toBeInTheDocument()
  },
)

it('passes the active exhibit id and remounts explorer state between exhibits', async () => {
  const user = userEvent.setup()

  function ExplorerStub({ exhibitId }: { exhibitId: string }) {
    const [count, setCount] = useState(0)

    return (
      <main>
        <h1>{exhibitId} 探索室</h1>
        <output aria-label="页内计数">{count}</output>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          增加计数
        </button>
      </main>
    )
  }

  const loadExplorerPage = vi.fn().mockResolvedValue({ default: ExplorerStub })

  window.location.hash = '#/explore/x57'
  render(<App loadExplorerPage={loadExplorerPage} />)

  expect(
    await screen.findByRole('heading', { name: 'x57 探索室' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '增加计数' }))
  expect(screen.getByRole('status', { name: '页内计数' })).toHaveTextContent('1')

  window.location.hash = '#/explore/asr10'
  window.dispatchEvent(new HashChangeEvent('hashchange'))

  expect(
    await screen.findByRole('heading', { name: 'asr10 探索室' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '页内计数' })).toHaveTextContent('0')
})

it('retries a failed explorer import with a new lazy load attempt', async () => {
  const user = userEvent.setup()
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  const RecoveredExplorer = ({ onExit }: { onExit: () => void }) => (
    <main>
      <h1>探索室已恢复</h1>
      <button type="button" onClick={onExit}>
        返回藏品大厅
      </button>
    </main>
  )
  const loadExplorerPage = vi
    .fn()
    .mockRejectedValueOnce(new Error('chunk unavailable'))
    .mockResolvedValue({ default: RecoveredExplorer })

  try {
    window.location.hash = '#/explore/m4'
    render(<App loadExplorerPage={loadExplorerPage} />)

    expect(
      await screen.findByRole('heading', { name: '探索室加载失败' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重新尝试' }))

    expect(
      await screen.findByRole('heading', { name: '探索室已恢复' }),
    ).toBeInTheDocument()
    expect(loadExplorerPage).toHaveBeenCalledTimes(2)
  } finally {
    consoleError.mockRestore()
  }
})

it('returns to the gallery from an explorer route load failure', async () => {
  const user = userEvent.setup()
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  const loadExplorerPage = vi
    .fn()
    .mockRejectedValue(new Error('chunk unavailable'))

  try {
    window.location.hash = '#/explore/m4'
    render(<App loadExplorerPage={loadExplorerPage} />)

    expect(
      await screen.findByRole('heading', { name: '探索室加载失败' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回藏品大厅' }))

    expect(window.location.hash).toBe('#/')
    expect(
      await screen.findByRole('heading', { name: /拆开机械.*看见原理/ }),
    ).toBeInTheDocument()
  } finally {
    consoleError.mockRestore()
  }
})

it('focuses the explorer heading after the hash route content appears', async () => {
  const user = userEvent.setup()
  const ExplorerStub = ({ onExit }: { onExit: () => void }) => (
    <main>
      <h1>M4 探索室</h1>
      <button type="button" onClick={onExit}>
        返回藏品大厅
      </button>
    </main>
  )
  const loadExplorerPage = vi
    .fn()
    .mockResolvedValue({ default: ExplorerStub })

  window.location.hash = ''
  render(<App loadExplorerPage={loadExplorerPage} />)

  await user.click(
    screen.getByRole('button', { name: '开始探索 M4 中型坦克' }),
  )

  const explorerHeading = await screen.findByRole('heading', {
    name: 'M4 探索室',
  })
  await waitFor(() => expect(explorerHeading).toHaveFocus())
})

it('keeps the programmatically focused Explorer question visually quiet', async () => {
  window.location.hash = '#/explore/mp5?no-webgl=1'
  render(<App />)

  const explorerQuestion = await screen.findByRole('heading', {
    level: 1,
    name: /管状机匣、支承外形与供给模块怎样构成 MP5 的标准轮廓/,
  })

  await waitFor(() => expect(explorerQuestion).toHaveFocus())
  expect(explorerQuestion).toHaveAttribute('tabindex', '-1')
  expect(getComputedStyle(explorerQuestion).outlineStyle).toBe('none')
  expect(getComputedStyle(explorerQuestion).boxShadow).toBe('none')
})

it('focuses the gallery heading after leaving the explorer hash route', async () => {
  const user = userEvent.setup()
  const ExplorerStub = ({ onExit }: { onExit: () => void }) => (
    <main>
      <h1>M4 探索室</h1>
      <button type="button" onClick={onExit}>
        返回藏品大厅
      </button>
    </main>
  )
  const loadExplorerPage = vi
    .fn()
    .mockResolvedValue({ default: ExplorerStub })

  window.location.hash = '#/explore/m4'
  render(<App loadExplorerPage={loadExplorerPage} />)

  await user.click(
    await screen.findByRole('button', { name: '返回藏品大厅' }),
  )

  const galleryHeading = await screen.findByRole('heading', {
    name: /拆开机械.*看见原理/,
  })
  await waitFor(() => expect(galleryHeading).toHaveFocus())
})

it('does not move focus again during updates inside the current route', async () => {
  const user = userEvent.setup()

  function InteractiveExplorer() {
    const [noteVisible, setNoteVisible] = useState(false)

    return (
      <main>
        <h1>M4 探索室</h1>
        <button type="button" onClick={() => setNoteVisible(true)}>
          显示页内说明
        </button>
        {noteVisible && <p>新的页内说明</p>}
      </main>
    )
  }

  const loadExplorerPage = vi
    .fn()
    .mockResolvedValue({ default: InteractiveExplorer })

  window.location.hash = '#/explore/m4'
  render(<App loadExplorerPage={loadExplorerPage} />)

  const explorerHeading = await screen.findByRole('heading', {
    name: 'M4 探索室',
  })
  await waitFor(() => expect(explorerHeading).toHaveFocus())

  const updateButton = screen.getByRole('button', { name: '显示页内说明' })
  await user.click(updateButton)

  expect(screen.getByText('新的页内说明')).toBeInTheDocument()
  expect(updateButton).toHaveFocus()
})

it('keeps the explorer route while using its section navigation', async () => {
  const user = userEvent.setup()
  window.location.hash = '#/explore/m4?no-webgl=1'
  render(<App />)

  await user.click(
    await screen.findByRole('button', { name: '前往结构零件' }),
  )

  expect(window.location.hash).toBe('#/explore/m4?no-webgl=1')
  expect(
    screen.getByRole('region', { name: 'M4 中型坦克结构舞台' }),
  ).toBeInTheDocument()
})

it.each([
  '#/explore/m4junk',
  '#/explore/x57-mod-iv',
  '#/explore/asr10/engine',
  '#/explore/m1903-springfield',
  '#/explore/m1911a1-modern',
  '#/explore/m1-garand/sniper',
  '#/explore/hk-mp5',
  '#/explore/unknown',
])(
  'keeps unsupported route %s on the gallery',
  (hash) => {
    window.location.hash = hash
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /拆开机械.*看见原理/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText('正在打开结构探索室…')).not.toBeInTheDocument()
  },
)
