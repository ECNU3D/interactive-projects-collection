import { expect, test, type Locator, type Page } from '@playwright/test'

interface VesselBrowserBudget {
  drawCalls: number
  triangles: number
  instances: number
  status: string | undefined
}

function watchConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function expectVesselBudgetPass(canvas: Locator) {
  await expect(canvas).toHaveAttribute('data-vessel-render-budget', 'pass')
  await expect(canvas).toHaveAttribute('data-vessel-draw-calls', /^[1-9]\d*$/)
  await expect(canvas).toHaveAttribute(
    'data-vessel-rendered-triangles',
    /^[1-9]\d*$/,
  )

  const budget = await canvas.evaluate<VesselBrowserBudget, HTMLCanvasElement>(
    (element) => ({
      drawCalls: Number(element.dataset.vesselDrawCalls),
      triangles: Number(element.dataset.vesselRenderedTriangles),
      instances: Number(element.dataset.vesselInstancedDetails),
      status: element.dataset.vesselRenderBudget,
    }),
  )

  expect(budget.status).toBe('pass')
  expect(budget.drawCalls).toBeGreaterThan(0)
  expect(budget.drawCalls).toBeLessThanOrEqual(48)
  expect(budget.triangles).toBeGreaterThan(0)
  expect(budget.triangles).toBeLessThanOrEqual(18_000)
  expect(budget.instances).toBeGreaterThan(0)
  return budget
}

test('@desktop vessel runtime budgets pass assembled and static principle states', async ({
  page,
}) => {
  const consoleErrors = watchConsoleErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/asr10')

  const stage = page.getByRole('img', {
    name: '现代救援船教学复合模型可交互三维结构模型',
  })
  await expect(stage).toBeVisible()
  const canvas = stage.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('button', { name: '自动演示' })).toBeDisabled()
  await expect(
    page.getByText(/减少动态已开启，自动演示保持暂停/),
  ).toBeVisible()
  const assembled = await expectVesselBudgetPass(canvas)

  const principleButton = page.getByRole('button', { name: '原理模式' })
  await principleButton.click()
  await expect(principleButton).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-vessel-draw-calls')))
    .toBeGreaterThan(assembled.drawCalls)
  await expectVesselBudgetPass(canvas)

  expect(consoleErrors).toEqual([])
})
