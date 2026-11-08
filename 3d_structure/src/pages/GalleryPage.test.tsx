import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MUSEUM_ACCENT_TOKENS } from '../scene/museumPalette'
import { GalleryPage } from './GalleryPage'

const tokenSource = readFileSync(
  resolve(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
)

it('groups all seven available exhibits and lets learners start each one', async () => {
  const user = userEvent.setup()
  const onExplore = vi.fn()

  render(<GalleryPage onExplore={onExplore} />)

  const entries = [
    ['开始探索 M4 中型坦克', 'm4'],
    ['开始探索 NASA X-57 Maxwell', 'x57'],
    ['开始探索 海上救援结构实验室', 'asr10'],
    ['开始探索 M1903 Springfield', 'm1903'],
    ['开始探索 M1911A1', 'm1911a1'],
    ['开始探索 M1 Garand', 'm1-garand'],
    ['开始探索 HK MP5', 'mp5'],
  ] as const

  const largeMachines = screen.getByRole('region', {
    name: '陆海空大型机械',
  })
  const firearmLab = screen.getByRole('region', {
    name: '发射循环实验室',
  })

  expect(screen.getByText('COLLECTION 01—07')).toBeVisible()
  expect(within(largeMachines).getAllByRole('article')).toHaveLength(3)
  expect(within(firearmLab).getAllByRole('article')).toHaveLength(4)
  expect(screen.getAllByRole('button', { name: /开始探索/ })).toHaveLength(7)
  expect(screen.queryByText('即将开放')).not.toBeInTheDocument()

  for (const [index, [name, exhibitId]] of entries.entries()) {
    const group = within(index < 3 ? largeMachines : firearmLab)

    expect(group.getByRole('heading', { name: name.replace('开始探索 ', '') }))
      .toBeInTheDocument()
    await user.click(group.getByRole('button', { name }))
    expect(onExplore).toHaveBeenLastCalledWith(exhibitId)
  }

  expect(
    screen.getAllByText(/ARCHIVE \/ 0[1-7]/).map((label) => label.textContent),
  ).toEqual([
    'ARCHIVE / 01',
    'ARCHIVE / 02',
    'ARCHIVE / 03',
    'ARCHIVE / 04',
    'ARCHIVE / 05',
    'ARCHIVE / 06',
    'ARCHIVE / 07',
  ])
})

it('links the top navigation to the accessibility guidance', () => {
  render(<GalleryPage onExplore={vi.fn()} />)

  expect(
    screen.getByRole('link', { name: '无障碍与操作' }),
  ).toHaveAttribute('href', '#accessibility')
  expect(
    screen.getByRole('complementary', { name: '无障碍与操作说明' }),
  ).toHaveAttribute('id', 'accessibility')
})

it('describes general public sources without presenting M4 as the sole reference', () => {
  render(<GalleryPage onExplore={vi.fn()} />)

  const footer = screen.getByRole('contentinfo')

  expect(footer).toHaveTextContent('公开史料与公共机构资料')
  expect(
    within(footer).getByRole('link', { name: 'NASA X-57 公开项目资料 ↗' }),
  ).toHaveAttribute('href', 'https://www.nasa.gov/x-57-maxwell/')
  expect(footer).not.toHaveTextContent('M4 切面参考资料')
})

it('presents three semantic learning questions without weapon guidance', () => {
  render(<GalleryPage onExplore={vi.fn()} />)

  const notebook = screen.getByRole('region', {
    name: '今天可以带走的三个问题',
  })
  const questions = within(notebook).getByRole('list', {
    name: '三个观察问题',
  })

  expect(within(questions).getAllByRole('listitem')).toHaveLength(3)
  expect(
    within(questions).getByText(
      '一台机械的外壳与内部结构，分别在承担什么任务？',
    ),
  ).toBeInTheDocument()
  expect(
    within(questions).getByText(
      '动力或能量从哪里出发，又经过哪些结构产生运动？',
    ),
  ).toBeInTheDocument()
  expect(
    within(questions).getByText(
      '不同机制如何让各自的结构完成一次机械循环？',
    ),
  ).toBeInTheDocument()
  expect(notebook).not.toHaveTextContent(/武器|射击|瞄准/)
})

it('explains every supported interaction without automatic audio', () => {
  render(<GalleryPage onExplore={vi.fn()} />)

  const guidance = screen.getByRole('complementary', {
    name: '无障碍与操作说明',
  })

  expect(guidance).toHaveTextContent('键盘')
  expect(guidance).toHaveTextContent('触控')
  expect(guidance).toHaveTextContent('减少动态')
  expect(guidance).toHaveTextContent(/知识卡.*主动朗读/)
  expect(guidance).toHaveTextContent('不会自动播放声音')
})

it('publishes the complete museum token contract while retaining legacy aliases', () => {
  const requiredTokens = [
    '--surface-page',
    '--surface-panel',
    '--surface-raised',
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--border-subtle',
    '--status-success',
    '--status-info',
    '--status-warning',
    '--status-danger',
    ...Object.values(MUSEUM_ACCENT_TOKENS),
    ...Array.from({ length: 8 }, (_, index) => `--part-accent-${index + 1}`),
    ...Array.from({ length: 10 }, (_, index) => `--space-${index + 1}`),
    '--radius-xs',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--radius-pill',
    '--shadow-sm',
    '--shadow-panel',
    '--shadow-spotlight',
    '--shadow-focus',
    '--duration-fast',
    '--duration-base',
    '--duration-slow',
    '--ease-museum',
    '--z-base',
    '--z-stage',
    '--z-overlay',
    '--z-modal',
    '--ink-950',
    '--ivory-100',
    '--brass',
    '--oxide',
    '--teal',
  ]

  for (const name of requiredTokens) {
    expect(tokenSource).toContain(`${name}:`)
  }

  expect(tokenSource).toContain('"Noto Sans SC Variable"')
})

it('maps every 3D museum accent to the same canonical CSS token', () => {
  for (const tokenName of Object.values(MUSEUM_ACCENT_TOKENS)) {
    expect(tokenSource).toMatch(new RegExp(`${tokenName}:\\s*#[0-9a-f]{6}`, 'i'))
  }

  expect(tokenSource).toContain('--part-accent-1: var(--part-brass)')
  expect(tokenSource).toContain('--part-accent-8: var(--part-ivory)')
})

it('keeps the large-machine wings aligned to the land, air, and sea accents', () => {
  const galleryStyles = readFileSync(
    resolve(process.cwd(), 'src/styles/gallery.css'),
    'utf8',
  )

  expect(galleryStyles).toMatch(
    /\.collection-card--tank\s*{[^}]*--card-accent:\s*var\(--part-oxide\)[^}]*--card-glow:\s*rgb\(195 109 80 \/ 24%\)[^}]*}/,
  )
  expect(galleryStyles).toMatch(
    /\.collection-card--aircraft\s*{[^}]*--card-accent:\s*var\(--part-teal\)[^}]*--card-glow:\s*rgb\(79 153 146 \/ 24%\)[^}]*}/,
  )
  expect(galleryStyles).toMatch(
    /\.collection-card--vessel\s*{[^}]*--card-accent:\s*var\(--part-brass\)[^}]*--card-glow:\s*rgb\(162 124 63 \/ 24%\)[^}]*}/,
  )
})

it('keeps the gallery entry point independent from Explorer and Three modules', () => {
  const gallerySource = readFileSync(
    resolve(process.cwd(), 'src/pages/GalleryPage.tsx'),
    'utf8',
  )
  const cardSource = readFileSync(
    resolve(process.cwd(), 'src/components/CollectionCard.tsx'),
    'utf8',
  )

  expect(`${gallerySource}\n${cardSource}`).not.toMatch(
    /(?:from\s+['"][^'"]*(?:Explorer|three|@react-three)|import\s*\([^)]*(?:Explorer|three|@react-three))/i,
  )
})

it('registers the variable Chinese UI font and preserves reduced-motion and touch contracts', () => {
  const mainSource = readFileSync(
    resolve(process.cwd(), 'src/main.tsx'),
    'utf8',
  )
  const galleryStyles = readFileSync(
    resolve(process.cwd(), 'src/styles/gallery.css'),
    'utf8',
  )
  const globalStyles = readFileSync(
    resolve(process.cwd(), 'src/styles/global.css'),
    'utf8',
  )

  expect(mainSource).toContain(
    "import '@fontsource-variable/noto-sans-sc/wght.css'",
  )
  expect(galleryStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  expect(galleryStyles).toMatch(/\.collection-card__diagram[\s\S]*?transition:\s*none/)
  expect(galleryStyles).toMatch(/min-(?:height|block-size):\s*44px/)
  expect(galleryStyles).toMatch(
    /\.museum-hero h1:focus-visible\s*{[^}]*outline:\s*0[^}]*}/,
  )
  expect(globalStyles).not.toContain('font-variation-settings')
})

it('keeps an exact copy of the packaged OFL text and records the font provenance', () => {
  const packagedLicense = readFileSync(
    resolve(
      process.cwd(),
      'node_modules/@fontsource-variable/noto-sans-sc/LICENSE',
    ),
    'utf8',
  )
  const variableWeightCss = readFileSync(
    resolve(
      process.cwd(),
      'node_modules/@fontsource-variable/noto-sans-sc/wght.css',
    ),
    'utf8',
  )
  const publicLicense = readFileSync(
    resolve(process.cwd(), 'public/licenses/noto-sans-sc-OFL-1.1.txt'),
    'utf8',
  )
  const notices = readFileSync(
    resolve(process.cwd(), 'THIRD_PARTY_NOTICES.md'),
    'utf8',
  )
  const fontFaces = variableWeightCss.match(/@font-face/g) ?? []

  expect(publicLicense).toBe(packagedLicense)
  expect(fontFaces.length).toBeGreaterThan(1)
  expect(variableWeightCss.match(/font-display:\s*swap/g)).toHaveLength(
    fontFaces.length,
  )
  expect(notices).toContain('@fontsource-variable/noto-sans-sc 5.2.10')
  expect(notices).toContain('OFL-1.1')
  expect(notices).toContain('2026-07-15')
})
