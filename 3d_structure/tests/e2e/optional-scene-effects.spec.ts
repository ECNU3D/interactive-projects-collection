import { expect, test } from '@playwright/test'

test('@desktop optional scene effects failure preserves the core 3D exhibit', async ({
  page,
}) => {
  let effectsRequests = 0
  const uncaughtErrors: string[] = []
  page.on('pageerror', (error) => uncaughtErrors.push(error.message))
  await page.route(/\/assets\/SceneEffects-[^/]+\.js$/, async (route) => {
    effectsRequests += 1
    await route.abort('failed')
  })

  await page.goto('/#/explore/x57')
  const canvas = page.getByRole('img', {
    name: 'X-57 电动飞机可交互三维结构模型',
  })

  await expect.poll(() => effectsRequests).toBe(1)
  await expect(canvas).toBeVisible()
  await expect(
    page.getByRole('group', { name: '三维视角控制' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect((await canvas.screenshot()).byteLength).toBeGreaterThan(20_000)

  await page.waitForTimeout(500)
  expect(effectsRequests).toBe(1)
  expect(uncaughtErrors).toEqual([])
})
