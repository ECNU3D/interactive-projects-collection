import { expect, test, type Locator, type Page } from '@playwright/test'

interface AircraftBrowserBudget {
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

async function readAircraftBudget(canvas: Locator) {
  await expect(canvas).toHaveAttribute('data-aircraft-render-budget', 'pass')
  await expect(canvas).toHaveAttribute('data-aircraft-draw-calls', /^[1-9]\d*$/)
  await expect(canvas).toHaveAttribute(
    'data-aircraft-rendered-triangles',
    /^[1-9]\d*$/,
  )

  return canvas.evaluate<AircraftBrowserBudget, HTMLCanvasElement>(
    (element) => ({
      drawCalls: Number(element.dataset.aircraftDrawCalls),
      triangles: Number(element.dataset.aircraftRenderedTriangles),
      instances: Number(element.dataset.aircraftInstancedDetails),
      status: element.dataset.aircraftRenderBudget,
    }),
  )
}

test('@desktop aircraft runtime budgets pass assembled and static principle states', async ({
  page,
}) => {
  const consoleErrors = watchConsoleErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/x57')

  const stage = page.getByRole('img', {
    name: 'X-57 电动飞机可交互三维结构模型',
  })
  await expect(stage).toBeVisible()
  const canvas = stage.locator('canvas')
  await expect(canvas).toBeVisible()
  const assembled = await readAircraftBudget(canvas)

  expect(assembled.status).toBe('pass')
  expect(assembled.drawCalls).toBeLessThan(60)
  expect(assembled.triangles).toBeLessThanOrEqual(24_000)
  expect(assembled.instances).toBeGreaterThanOrEqual(40)

  const principleButton = page.getByRole('button', { name: '原理模式' })
  await principleButton.click()
  await expect(principleButton).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-aircraft-draw-calls')))
    .toBeGreaterThan(assembled.drawCalls)
  const principle = await readAircraftBudget(canvas)

  expect(principle.drawCalls).toBeLessThan(90)
  expect(principle.triangles).toBeLessThanOrEqual(24_000)
  expect(consoleErrors).toEqual([])
})
