import { expect, test, type Locator, type Page } from '@playwright/test'

interface TankBrowserBudget {
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

async function readTankBudget(canvas: Locator) {
  await expect(canvas).toHaveAttribute('data-tank-render-budget', 'pass')
  await expect(canvas).toHaveAttribute('data-tank-draw-calls', /^[1-9]\d*$/)
  await expect(canvas).toHaveAttribute(
    'data-tank-rendered-triangles',
    /^[1-9]\d*$/,
  )

  return canvas.evaluate<TankBrowserBudget, HTMLCanvasElement>((element) => ({
    drawCalls: Number(element.dataset.tankDrawCalls),
    triangles: Number(element.dataset.tankRenderedTriangles),
    instances: Number(element.dataset.tankInstancedDetails),
    status: element.dataset.tankRenderBudget,
  }))
}

test('@desktop tank runtime budgets pass assembled and reduced-motion principle states', async ({
  page,
}) => {
  const consoleErrors = watchConsoleErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/m4')

  const stage = page.getByRole('img', {
    name: 'M4 中型坦克可交互三维结构模型',
  })
  await expect(stage).toBeVisible()
  const canvas = stage.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('button', { name: '自动演示' })).toBeDisabled()
  const assembled = await readTankBudget(canvas)

  expect(assembled.status).toBe('pass')
  expect(assembled.drawCalls).toBeGreaterThan(0)
  expect(assembled.drawCalls).toBeLessThan(60)
  expect(assembled.triangles).toBeGreaterThan(0)
  expect(assembled.triangles).toBeLessThanOrEqual(30_000)
  expect(assembled.instances).toBeGreaterThanOrEqual(100)

  const principleButton = page.getByRole('button', { name: '原理模式' })
  await principleButton.click()
  await expect(principleButton).toHaveAttribute('aria-pressed', 'true')
  const principle = await readTankBudget(canvas)

  expect(principle.drawCalls).toBeLessThan(60)
  expect(principle.triangles).toBeLessThanOrEqual(30_000)
  expect(consoleErrors).toEqual([])
})
