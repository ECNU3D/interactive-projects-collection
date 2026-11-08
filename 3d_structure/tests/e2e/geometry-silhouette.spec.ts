import { expect, test, type Page } from '@playwright/test'

const largeMachines = [
  {
    id: 'm4',
    title: 'M4 中型坦克',
    canvasName: 'M4 中型坦克可交互三维结构模型',
    budgetAttribute: 'data-tank-render-budget',
  },
  {
    id: 'x57',
    title: 'NASA X-57 Maxwell',
    canvasName: 'X-57 电动飞机可交互三维结构模型',
    budgetAttribute: 'data-aircraft-render-budget',
  },
  {
    id: 'asr10',
    title: '海上救援结构实验室',
    canvasName: '现代救援船教学复合模型可交互三维结构模型',
    budgetAttribute: 'data-vessel-render-budget',
  },
] as const

function watchBrowserHealth(page: Page) {
  const issues: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => issues.push(`page: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) issues.push(`http ${response.status()}: ${response.url()}`)
  })
  return issues
}

for (const machine of largeMachines) {
  test(`@desktop ${machine.title} keeps its restored reduced-motion silhouette`, async ({
    page,
  }, testInfo) => {
    test.slow()
    testInfo.snapshotSuffix = ''
    const issues = watchBrowserHealth(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/#/explore/${machine.id}`)

    const canvas = page.getByRole('img', { name: machine.canvasName })
    const renderCanvas = page.locator('.explorer-stage canvas')
    await expect(canvas).toBeVisible()
    await expect(renderCanvas).toBeVisible()
    await expect(renderCanvas).toHaveAttribute(machine.budgetAttribute, 'pass')
    await page.getByRole('button', { name: '复原模型' }).click()
    await expect(page.getByText('01 / 06', { exact: true })).toBeVisible()
    await expect(renderCanvas).toHaveAttribute(machine.budgetAttribute, 'pass')
    await page.addStyleTag({
      content: `
        .learning-guide,
        .explorer-modes,
        .explorer-camera-controls,
        .explorer-static-status {
          visibility: hidden !important;
        }
      `,
    })

    await page.waitForTimeout(500)
    const firstFrame = await renderCanvas.screenshot({
      animations: 'disabled',
    })
    await page.waitForTimeout(350)
    const secondFrame = await renderCanvas.screenshot({
      animations: 'disabled',
    })
    expect(secondFrame.equals(firstFrame)).toBe(true)
    await expect(renderCanvas).toHaveScreenshot(
      `${machine.id}-restored-1440x900.png`,
      {
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
        threshold: 0.08,
      },
    )
    expect(issues).toEqual([])
  })
}
