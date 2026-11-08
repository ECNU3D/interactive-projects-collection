import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const evidenceDirectory = 'output/playwright/visual-quality/task11'
const FONT_BUDGET_BYTES = 1.25 * 1024 * 1024
const viewportLabels = {
  desktop: '1440x900',
  tablet: '1024x768',
  mobile: '390x844',
} as const

const exhibits = [
  {
    id: 'm4',
    title: 'M4 中型坦克',
    staticName: 'M4 中型坦克静态结构示意',
    canvasName: 'M4 中型坦克可交互三维结构模型',
    renderBudgetAttribute: 'data-tank-render-budget',
  },
  {
    id: 'x57',
    title: 'NASA X-57 Maxwell',
    staticName: 'X-57 电动飞机静态结构示意',
    canvasName: 'X-57 电动飞机可交互三维结构模型',
    renderBudgetAttribute: 'data-aircraft-render-budget',
  },
  {
    id: 'asr10',
    title: '海上救援结构实验室',
    staticName: '现代救援船教学复合模型静态结构示意',
    canvasName: '现代救援船教学复合模型可交互三维结构模型',
    renderBudgetAttribute: 'data-vessel-render-budget',
  },
  {
    id: 'm1903',
    title: 'M1903 Springfield',
    staticName: 'M1903 Springfield 静态结构示意',
    canvasName: 'M1903 Springfield 可交互机械循环教学模型',
    renderBudgetAttribute: null,
  },
  {
    id: 'm1911a1',
    title: 'M1911A1',
    staticName: 'M1911A1 静态结构示意',
    canvasName: 'M1911A1 可交互机械循环教学模型',
    renderBudgetAttribute: null,
  },
  {
    id: 'm1-garand',
    title: 'M1 Garand',
    staticName: 'M1 Garand 静态结构示意',
    canvasName: 'M1 Garand 可交互机械循环教学模型',
    renderBudgetAttribute: null,
  },
  {
    id: 'mp5',
    title: 'HK MP5',
    staticName: 'HK MP5 静态结构示意',
    canvasName: 'HK MP5 可交互机械循环教学模型',
    renderBudgetAttribute: null,
  },
] as const

test.beforeAll(() => {
  mkdirSync(evidenceDirectory, { recursive: true })
})

function watchBrowserHealth(page: Page) {
  const issues: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => issues.push(`page: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`http ${response.status()}: ${response.url()}`)
    }
  })

  return issues
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(0)
}

async function expectTouchTargets(locator: Locator) {
  const undersized = await locator.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
      })
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width < 44 || rect.height < 44
      })
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          label: element.getAttribute('aria-label') ?? element.textContent?.trim(),
          width: rect.width,
          height: rect.height,
        }
      }),
  )

  expect(undersized).toEqual([])
}

async function fontResourceMetrics(page: Page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => /\.woff2(?:$|\?)/.test(entry.name))
      .reduce(
        (metrics, entry) => {
          const resource = entry as PerformanceResourceTiming
          return {
            count: metrics.count + 1,
            bytes:
              metrics.bytes +
              (resource.transferSize || resource.decodedBodySize),
          }
        },
        { count: 0, bytes: 0 },
      ),
  )
}

async function pixelDifferenceRatio(
  page: Page,
  before: Buffer,
  after: Buffer,
) {
  return page.evaluate(
    async ({ beforeBase64, afterBase64 }) => {
      const decode = async (base64: string) => {
        const response = await fetch(`data:image/png;base64,${base64}`)
        return createImageBitmap(await response.blob())
      }
      const [beforeImage, afterImage] = await Promise.all([
        decode(beforeBase64),
        decode(afterBase64),
      ])
      if (
        beforeImage.width !== afterImage.width ||
        beforeImage.height !== afterImage.height
      ) {
        const dimensions = {
          before: [beforeImage.width, beforeImage.height],
          after: [afterImage.width, afterImage.height],
        }
        beforeImage.close()
        afterImage.close()
        throw new Error(
          `Pixel comparison requires equal dimensions: ${JSON.stringify(dimensions)}`,
        )
      }

      const canvas = document.createElement('canvas')
      canvas.width = beforeImage.width
      canvas.height = beforeImage.height
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.drawImage(beforeImage, 0, 0)
      const beforePixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(afterImage, 0, 0)
      const afterPixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      beforeImage.close()
      afterImage.close()

      let changed = 0
      for (let offset = 0; offset < beforePixels.length; offset += 4) {
        const channelDelta =
          Math.abs(beforePixels[offset] - afterPixels[offset]) +
          Math.abs(beforePixels[offset + 1] - afterPixels[offset + 1]) +
          Math.abs(beforePixels[offset + 2] - afterPixels[offset + 2]) +
          Math.abs(beforePixels[offset + 3] - afterPixels[offset + 3])
        if (channelDelta >= 24) changed += 1
      }

      return changed / (canvas.width * canvas.height)
    },
    {
      beforeBase64: before.toString('base64'),
      afterBase64: after.toString('base64'),
    },
  )
}

async function expectMeaningfulPixelChange(
  page: Page,
  before: Buffer,
  after: Buffer,
  minimumRatio = 0.003,
) {
  expect(await pixelDifferenceRatio(page, before, after)).toBeGreaterThanOrEqual(
    minimumRatio,
  )
}

const canvasHitCandidates = [
  [0.5, 0.5],
  [0.5, 0.58],
  [0.42, 0.58],
  [0.58, 0.58],
  [0.42, 0.66],
  [0.58, 0.66],
  [0.34, 0.58],
  [0.66, 0.58],
] as const

async function selectVisibleCanvasPart(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return false

  for (const [xRatio, yRatio] of canvasHitCandidates) {
    await page.mouse.move(
      box.x + box.width * xRatio,
      box.y + box.height * yRatio,
    )
    await expect
      .poll(() => page.evaluate(() => document.body.style.cursor), {
        timeout: 750,
      })
      .toBe('pointer')
      .catch(() => undefined)
    if (
      (await page.evaluate(() => document.body.style.cursor)) !== 'pointer'
    ) {
      continue
    }

    await page.mouse.click(
      box.x + box.width * xRatio,
      box.y + box.height * yRatio,
    )
    const knowledgeHeading = page.locator('#knowledge-panel h2')
    if (
      await knowledgeHeading
        .waitFor({ state: 'visible', timeout: 1_500 })
        .then(() => true)
        .catch(() => false)
    ) {
      return true
    }
  }

  return false
}

async function expectMechanicalPartHoverChangesPixels(
  page: Page,
  canvas: Locator,
) {
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  await page.mouse.move(1, 1)
  await page.waitForTimeout(150)
  const before = await canvas.screenshot({ animations: 'disabled' })

  for (const [xRatio, yRatio] of canvasHitCandidates) {
    await page.mouse.move(
      box.x + box.width * xRatio,
      box.y + box.height * yRatio,
    )
    await page.waitForTimeout(220)
    if (
      (await page.evaluate(() => document.body.style.cursor)) !== 'pointer'
    ) {
      continue
    }

    const hovered = await canvas.screenshot({ animations: 'disabled' })
    if ((await pixelDifferenceRatio(page, before, hovered)) >= 0.001) {
      return
    }
  }

  throw new Error('No visible M4 MechanicalPart hover changed enough canvas pixels')
}

async function expectExplorerContracts(
  page: Page,
  exhibit: (typeof exhibits)[number],
  useStaticFallback: boolean,
) {
  await page.goto(
    `/#/explore/${exhibit.id}${useStaticFallback ? '?no-webgl=1' : ''}`,
  )
  const stage = page.getByRole('region', { name: `${exhibit.title}结构舞台` })
  await expect(stage).toBeVisible()
  if (useStaticFallback) {
    await expect(page.getByRole('img', { name: exhibit.staticName })).toBeVisible()
  } else {
    const renderCanvas = page.locator('.explorer-stage canvas')
    await expect(renderCanvas).toBeVisible()
    await expect(page.getByRole('img', { name: exhibit.canvasName })).toBeVisible()
    if (exhibit.renderBudgetAttribute) {
      await expect(renderCanvas).toHaveAttribute(
        exhibit.renderBudgetAttribute,
        'pass',
      )
    } else {
      expect(
        (await renderCanvas.screenshot({ animations: 'disabled' })).byteLength,
      ).toBeGreaterThan(5_000)
    }
    await page.waitForTimeout(450)
  }
  await expect(page.locator('.learning-guide')).toHaveCount(1)
  await expect(page.locator('.journey-bar')).toHaveCount(1)
  const timeline = page.getByRole('navigation', { name: '拆解步骤' })
  await expect(timeline).toBeVisible()
  await expect(timeline.getByRole('button')).toHaveCount(6)
  const expandInspector = page.getByRole('button', { name: '展开结构观察面板' })
  if (await expandInspector.isVisible()) await expandInspector.click()
  const parts = page.getByRole('group', { name: '结构零件' })
  await expect(parts).toBeVisible()
  await expect(parts.getByRole('button')).toHaveCount(11)
  await expect(page.getByRole('complementary', { name: '结构知识卡' })).toContainText(
    exhibit.id === 'm4' || exhibit.id === 'x57' || exhibit.id === 'asr10'
      ? '教育性重建 · 非工程图纸'
      : '惰性示意弹 / 非拆装顺序',
  )
}

for (const project of ['desktop', 'tablet', 'mobile'] as const) {
  test(`@${project} captures Gallery and all seven safe exhibit routes`, async ({
    page,
  }) => {
    test.slow()
    const galleryIssues = watchBrowserHealth(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /拆开机械.*看见原理/ })).toBeVisible()
    await page.screenshot({
      path: `${evidenceDirectory}/gallery-${project}-${viewportLabels[project]}.png`,
      fullPage: true,
    })

    for (const exhibit of exhibits) {
      const exhibitPage =
        project === 'desktop' ? await page.context().newPage() : page
      const exhibitIssues =
        exhibitPage === page ? galleryIssues : watchBrowserHealth(exhibitPage)
      await exhibitPage.emulateMedia({ reducedMotion: 'reduce' })
      await expectExplorerContracts(
        exhibitPage,
        exhibit,
        project !== 'desktop',
      )
      await expectNoHorizontalOverflow(exhibitPage)
      await exhibitPage.screenshot({
        path: `${evidenceDirectory}/${exhibit.id}-${project}-${viewportLabels[project]}.png`,
        fullPage: true,
      })
      expect(exhibitIssues).toEqual([])
      if (exhibitPage !== page) await exhibitPage.close()
    }

    expect(galleryIssues).toEqual([])
  })
}

test('@desktop desktop stage owns at least 70% of the workspace and viewport height', async ({
  page,
}) => {
  await page.goto('/#/explore/m4?no-webgl=1')
  const [stage, workspace] = await Promise.all([
    page.locator('.explorer-stage').boundingBox(),
    page.locator('.explorer-workspace').boundingBox(),
  ])

  expect(stage).not.toBeNull()
  expect(workspace).not.toBeNull()
  expect(stage!.width / workspace!.width).toBeGreaterThanOrEqual(0.7)
  expect(stage!.height / 900).toBeGreaterThanOrEqual(0.7)
})

test('@tablet tablet stage owns at least 70% and Inspector selection reopens the panel', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/m4')
  const renderCanvas = page.locator('.explorer-stage canvas')
  await expect(renderCanvas).toBeVisible()
  await expect(renderCanvas).toHaveAttribute('data-tank-render-budget', 'pass')
  const [stage, workspace] = await Promise.all([
    page.locator('.explorer-stage').boundingBox(),
    page.locator('.explorer-workspace').boundingBox(),
  ])
  expect(stage).not.toBeNull()
  expect(workspace).not.toBeNull()
  expect(stage!.width / workspace!.width).toBeGreaterThanOrEqual(0.7)
  expect(stage!.height / 768).toBeGreaterThanOrEqual(0.7)

  await page.getByRole('button', { name: '收起结构观察面板' }).click()
  await expect(page.getByTestId('explorer-inspector-panel')).toBeHidden()
  expect(await selectVisibleCanvasPart(page, renderCanvas)).toBe(true)
  await expect(page.getByTestId('explorer-inspector-panel')).toBeVisible()
  await expect(page.locator('#knowledge-panel h2')).toBeVisible()
  await expect(page.getByRole('button', { name: '收起结构观察面板' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

test('@mobile mobile sheet clears navigation, stays under 62dvh, and preserves 44px controls', async ({
  page,
}) => {
  await page.goto('/#/explore/mp5?no-webgl=1')
  await page.getByRole('button', { name: '展开结构观察面板' }).click()
  await expect(page.getByTestId('explorer-inspector-panel')).toBeVisible()
  await page.getByRole('group', { name: '结构零件' }).getByRole('button').first().click()
  await expect(page.locator('.knowledge-panel__source')).toBeVisible()
  const inspector = page.locator('.explorer-inspector')
  const rail = page.locator('.explorer-rail')
  const [sheetBox, railBox] = await Promise.all([
    inspector.boundingBox(),
    rail.boundingBox(),
  ])

  expect(sheetBox).not.toBeNull()
  expect(railBox).not.toBeNull()
  expect(sheetBox!.height).toBeLessThanOrEqual(844 * 0.62 + 1)
  expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(railBox!.y)
  await expectNoHorizontalOverflow(page)
  await expectTouchTargets(page.locator('button:visible, a[href]:visible'))
})

test('@mobile constrained WebGL advertises the low-cost no-composer/no-canvas-shadow path', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/m4?no-webgl=1')
  const staticDiagram = page.getByRole('img', {
    name: 'M4 中型坦克静态结构示意',
  })
  await expect(staticDiagram).toBeVisible()
  const staticA = await staticDiagram.screenshot()
  await page.waitForTimeout(250)
  const staticB = await staticDiagram.screenshot()
  expect(staticB.equals(staticA)).toBe(true)

  await page.goto('/#/explore/m4')
  const canvas = page.getByRole('img', {
    name: 'M4 中型坦克可交互三维结构模型',
  })
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-scene-profile', 'constrained')
  await expect(canvas).toHaveAttribute('data-canvas-shadows', 'off')
  await expect(canvas).toHaveAttribute('data-postprocessing', 'off')
  await expect(canvas).toHaveAttribute('data-shadow-mode', 'contact')
  const expensiveEffects = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /SceneEffects/i.test(name)),
  )
  expect(expensiveEffects).toEqual([])
})

test('@tablet reduced-motion scene, selected, xray, and principle states are stable and distinct', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/m4')
  const canvas = page.getByRole('img', {
    name: 'M4 中型坦克可交互三维结构模型',
  })
  const renderCanvas = page.locator('.explorer-stage canvas')
  await expect(renderCanvas).toBeVisible()
  await expect(renderCanvas).toHaveAttribute(
    'data-tank-render-budget',
    'pass',
  )
  await page.waitForTimeout(350)
  const assembledA = await canvas.screenshot()
  await page.waitForTimeout(350)
  const assembledB = await canvas.screenshot()
  expect(assembledB.equals(assembledA)).toBe(true)

  await page.getByRole('group', { name: '结构零件' }).getByRole('button').first().click()
  await page.waitForTimeout(350)
  const selected = await canvas.screenshot()
  await expectMeaningfulPixelChange(page, assembledA, selected)

  await page.getByRole('button', { name: '透视模式' }).click()
  await page.waitForTimeout(350)
  const xray = await canvas.screenshot()
  await expectMeaningfulPixelChange(page, selected, xray)

  await page.getByRole('button', { name: '原理模式' }).click()
  await expect(page.getByRole('button', { name: '播放原理' })).toBeDisabled()
  await page.waitForTimeout(350)
  const principleA = await canvas.screenshot()
  await page.waitForTimeout(350)
  const principleB = await canvas.screenshot()
  await expectMeaningfulPixelChange(page, xray, principleA)
  expect(principleB.equals(principleA)).toBe(true)
})

test('@desktop Gallery and Explorer each transfer at most 1.25MiB of fonts and real 3D hover changes pixels', async ({
  browser,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string
  const galleryContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const galleryPage = await galleryContext.newPage()
  await galleryPage.goto('/')
  await galleryPage.waitForLoadState('networkidle')
  const galleryFonts = await fontResourceMetrics(galleryPage)
  expect(galleryFonts.count).toBeGreaterThan(0)
  expect(galleryFonts.bytes).toBeGreaterThan(0)
  expect(galleryFonts.bytes).toBeLessThanOrEqual(FONT_BUDGET_BYTES)

  const card = galleryPage.locator('.collection-card').first()
  const cardBefore = await card.screenshot()
  await card.hover({ position: { x: 30, y: 30 } })
  const cardAfter = await card.screenshot()
  await expectMeaningfulPixelChange(galleryPage, cardBefore, cardAfter, 0.001)
  await galleryContext.close()

  const explorerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const explorerPage = await explorerContext.newPage()
  await explorerPage.goto('/#/explore/m4')
  const renderCanvas = explorerPage.locator('.explorer-stage canvas')
  await expect(renderCanvas).toBeVisible()
  await expect(renderCanvas).toHaveAttribute('data-tank-render-budget', 'pass')
  await explorerPage.waitForLoadState('networkidle')
  const explorerFonts = await fontResourceMetrics(explorerPage)
  expect(explorerFonts.count).toBeGreaterThan(0)
  expect(explorerFonts.bytes).toBeGreaterThan(0)
  expect(explorerFonts.bytes).toBeLessThanOrEqual(FONT_BUDGET_BYTES)
  await expectMechanicalPartHoverChangesPixels(explorerPage, renderCanvas)
  await explorerContext.close()
})
