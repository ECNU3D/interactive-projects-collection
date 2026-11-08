import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const screenshotDirectory = 'output/playwright/screenshots'

test.beforeAll(() => {
  mkdirSync(screenshotDirectory, { recursive: true })
})

const stageButtons = [
  '整体：观察整体',
  '外部：外部结构',
  '车体：打开车体',
  '动力：动力传递',
  '行走：悬挂与行走',
  '零件：关键零件',
] as const

const parts = [
  '车体外壳',
  '炮塔与旋转环',
  '星形发动机',
  '传动路径',
  '左侧悬挂',
  '右侧悬挂',
  '左侧履带',
  '右侧履带',
  '乘员空间',
  '观察系统',
  '后坐缓冲示意',
] as const

const newExhibits = [
  {
    id: 'x57',
    title: 'NASA X-57 Maxwell',
    canvasName: 'X-57 电动飞机可交互三维结构模型',
    staticName: 'X-57 电动飞机静态结构示意',
    firstStage: '整机：整机概览',
    finalStage: '监测：感知散热',
    part: '锂离子电池组',
    budgetAttribute: 'data-aircraft-render-budget',
  },
  {
    id: 'asr10',
    title: '海上救援结构实验室',
    canvasName: '现代救援船教学复合模型可交互三维结构模型',
    staticName: '现代救援船教学复合模型静态结构示意',
    firstStage: '整艇：整艇概览',
    finalStage: '协作：系统协作',
    part: '人员安置空间',
    budgetAttribute: 'data-vessel-render-budget',
  },
] as const

const firearmExhibits = [
  {
    id: 'm1903',
    title: 'M1903 Springfield',
    canvasName: 'M1903 Springfield 可交互机械循环教学模型',
    staticName: 'M1903 Springfield 静态结构示意',
    savedStepIndex: 1,
  },
  {
    id: 'm1911a1',
    title: 'M1911A1',
    canvasName: 'M1911A1 可交互机械循环教学模型',
    staticName: 'M1911A1 静态结构示意',
    savedStepIndex: 2,
  },
  {
    id: 'm1-garand',
    title: 'M1 Garand',
    canvasName: 'M1 Garand 可交互机械循环教学模型',
    staticName: 'M1 Garand 静态结构示意',
    savedStepIndex: 3,
  },
  {
    id: 'mp5',
    title: 'HK MP5',
    canvasName: 'HK MP5 可交互机械循环教学模型',
    staticName: 'HK MP5 静态结构示意',
    savedStepIndex: 4,
  },
] as const

function watchBrowserHealth(page: Page) {
  const issues: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push(`console: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => issues.push(`page: ${error.message}`))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`http ${response.status()}: ${response.url()}`)
    }
  })

  return issues
}

async function selectVisibleCanvasPart(page: Page, canvas: Locator) {
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()

  if (!box) return false

  const candidates = [
    [0.5, 0.5],
    [0.5, 0.58],
    [0.42, 0.58],
    [0.58, 0.58],
    [0.42, 0.66],
    [0.58, 0.66],
    [0.34, 0.58],
    [0.66, 0.58],
  ] as const

  for (const [xRatio, yRatio] of candidates) {
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio)
    if ((await page.locator('#knowledge-panel h2').count()) > 0) return true
  }

  return false
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))

  expect(metrics.documentWidth).toBe(metrics.viewportWidth)
}

async function expectAllVisibleButtonsMeetTouchTarget(page: Page) {
  const undersizedButtons = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          (rect.width < 44 || rect.height < 44)
        )
      })
      .map((element) => ({
        label:
          element.getAttribute('aria-label') ?? element.textContent?.trim(),
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })),
  )

  expect(undersizedButtons).toEqual([])
}

async function walkAllMainStages(page: Page) {
  const timeline = page.getByRole('navigation', { name: '拆解步骤' })
  const buttons = timeline.getByRole('button')
  await expect(buttons).toHaveCount(6)

  for (let index = 0; index < 6; index += 1) {
    await buttons.nth(index).click()
    await expect(
      page.getByText(`${String(index + 1).padStart(2, '0')} / 06`, {
        exact: true,
      }),
    ).toBeVisible()
  }
}

async function selectFinalPart(page: Page) {
  const partButtons = page
    .getByRole('group', { name: '结构零件' })
    .getByRole('button')
  await expect(partButtons).toHaveCount(11)
  const finalPart = partButtons.nth(10)
  const accessibleName = await finalPart.getAttribute('aria-label')
  expect(accessibleName).toBeTruthy()
  await finalPart.click()
  await expect(page.locator('#knowledge-panel h2')).toBeVisible()
}

async function stepFirearmCycleToEnd(page: Page) {
  const nextButton = page.getByRole('button', { name: '下一循环阶段' })

  for (let phase = 2; phase <= 6; phase += 1) {
    await nextButton.click()
    await expect(
      page.getByText(new RegExp(`循环阶段 ${phase} / 6：`)),
    ).toBeVisible()
  }
}

async function pauseFirearmCycleAtPhase(
  page: Page,
  stage: Locator,
  phaseIndex: number,
) {
  const pauseButton = page.getByRole('button', { name: '暂停机械循环' })
  await expect(pauseButton).toBeVisible()

  await stage.evaluate((element, targetPhaseIndex) => {
    let observer: MutationObserver | undefined

    const schedulePauseAtTarget = () => {
      if (
        element.getAttribute('data-cycle-phase') !==
        String(targetPhaseIndex)
      ) {
        return false
      }

      const button = [...document.querySelectorAll('button')].find(
        (candidate) => candidate.textContent?.trim() === '暂停机械循环',
      )
      if (!(button instanceof HTMLButtonElement)) return false

      let frameRendered = false
      let delayElapsed = false
      const pauseWhenReady = () => {
        if (frameRendered && delayElapsed) button.click()
      }
      requestAnimationFrame(() => {
        frameRendered = true
        pauseWhenReady()
      })
      window.setTimeout(() => {
        delayElapsed = true
        pauseWhenReady()
      }, 120)
      return true
    }

    if (schedulePauseAtTarget()) return

    observer = new MutationObserver(() => {
      if (schedulePauseAtTarget()) observer?.disconnect()
    })
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['data-cycle-phase'],
    })
  }, phaseIndex)
}

test('@desktop desktop WebGL learning flow changes real pixels and stays error free', async ({
  page,
}, testInfo) => {
  test.slow()
  const browserIssues = watchBrowserHealth(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /拆开机械.*看见原理/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'M4 中型坦克' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'NASA X-57 Maxwell' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '海上救援结构实验室' })).toBeVisible()
  await testInfo.attach('gallery-1440x900', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  await page.getByRole('button', { name: '开始探索 M4 中型坦克' }).click()
  await expect(
    page.getByRole('region', { name: 'M4 中型坦克结构舞台' }),
  ).toBeVisible()
  await expect(page.locator('h1')).toBeFocused()

  const canvas = page.getByRole('img', {
    name: 'M4 中型坦克可交互三维结构模型',
  })
  await expect(canvas).toBeVisible()
  const cameraControls = page.getByRole('group', {
    name: '三维视角控制',
  })
  await expect(cameraControls).toBeVisible()
  await expect(
    cameraControls.getByRole('button', { name: '聚焦已选零件' }),
  ).toBeDisabled()
  await page.waitForTimeout(800)
  const wholeCanvas = await canvas.screenshot()
  expect(wholeCanvas.byteLength).toBeGreaterThan(20_000)

  for (const [index, buttonName] of stageButtons.entries()) {
    await page.getByRole('button', { name: buttonName }).click()
    await expect(
      page.getByText(`${String(index + 1).padStart(2, '0')} / 06`, {
        exact: true,
      }),
    ).toBeVisible()
  }
  await page.waitForTimeout(800)
  const explodedCanvas = await canvas.screenshot()
  expect(explodedCanvas.equals(wholeCanvas)).toBe(false)
  await testInfo.attach('exploded-stage-1440x900', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })

  for (const label of parts) {
    await page.getByRole('button', { name: `查看${label}` }).click()
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
  }

  await page.waitForTimeout(500)
  const cameraBefore = await canvas.screenshot()
  await cameraControls.getByRole('button', { name: '向左旋转视角' }).click()
  await page.waitForTimeout(350)
  const cameraAfter = await canvas.screenshot()
  expect(cameraAfter.equals(cameraBefore)).toBe(false)
  await cameraControls.getByRole('button', { name: '向右旋转视角' }).click()
  await cameraControls.getByRole('button', { name: '拉近视角' }).click()
  await cameraControls.getByRole('button', { name: '拉远视角' }).click()
  await cameraControls.getByRole('button', { name: '聚焦已选零件' }).click()

  await page.getByRole('button', { name: '透视模式' }).click()
  await expect(page.getByRole('button', { name: '透视模式' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: '动力：动力传递' }).click()
  await page.getByRole('button', { name: '查看星形发动机' }).click()
  await page.getByRole('button', { name: '原理模式' }).click()
  await page.waitForTimeout(650)
  await page.getByRole('button', { name: '动力：动力传递' }).click()
  await expect(
    page.getByRole('heading', { name: '星形发动机', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText('选择一个发光标记')).toBeVisible()
  const principleCanvasBox = await canvas.boundingBox()
  expect(principleCanvasBox).not.toBeNull()
  if (principleCanvasBox) {
    await page.mouse.click(
      principleCanvasBox.x + principleCanvasBox.width / 2,
      principleCanvasBox.y + principleCanvasBox.height / 2,
    )
  }
  await expect(
    page.getByRole('heading', { name: '星形发动机', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '播放原理' }).click()
  await expect(page.getByText('正在播放原理动画。')).toBeVisible()
  await page.getByRole('button', { name: '暂停原理' }).click()
  await expect(page.getByText('原理动画已暂停。')).toBeVisible()
  await page.getByRole('button', { name: '拆解模式' }).click()

  await page.getByRole('button', { name: '查看后坐缓冲示意' }).click()
  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  if (canvasBox) {
    const startX = canvasBox.x + canvasBox.width / 2
    const startY = canvasBox.y + canvasBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 150, startY - 30, { steps: 12 })
    await page.mouse.up()
  }
  await expect(
    page.getByRole('heading', { name: '后坐缓冲示意', exact: true }),
  ).toBeVisible()

  await page.keyboard.press('r')
  await expect(page.getByText('01 / 06', { exact: true })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('03 / 06', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '动力：动力传递' }).click()
  await page.reload()
  await expect(page.getByText('04 / 06', { exact: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: /拆开机械.*看见原理/ })).toBeVisible()
  await expect(page.locator('h1')).toBeFocused()

  expect(browserIssues).toEqual([])
})

for (const exhibit of newExhibits) {
  test(`@desktop ${exhibit.title} WebGL visual journey changes pixels and stays error free`, async ({
    page,
  }) => {
    test.slow()
    const browserIssues = watchBrowserHealth(page)

    await page.goto('/')
    await page
      .getByRole('button', { name: `开始探索 ${exhibit.title}` })
      .click()
    await expect(
      page.getByRole('region', { name: `${exhibit.title}结构舞台` }),
    ).toBeVisible()
    expect(page.url()).toContain(`#/explore/${exhibit.id}`)
    await expect(page.locator('h1')).toBeFocused()

    const exhibitCanvas = page.getByRole('img', { name: exhibit.canvasName })
    await expect(exhibitCanvas).toBeVisible()
    const renderCanvas = page.locator('.explorer-stage canvas')
    await expect(renderCanvas).toBeVisible()
    await expect(renderCanvas).toHaveAttribute(exhibit.budgetAttribute, 'pass')
    await page.waitForTimeout(900)
    const assembled = await exhibitCanvas.screenshot()
    expect(assembled.byteLength).toBeGreaterThan(20_000)

    expect(await selectVisibleCanvasPart(page, exhibitCanvas)).toBe(true)

    await page.getByRole('button', { name: '透视模式' }).click()
    await page.getByRole('button', { name: exhibit.firstStage }).click()
    expect(await selectVisibleCanvasPart(page, exhibitCanvas)).toBe(true)
    await page.getByRole('button', { name: '拆解模式' }).click()

    await page.getByRole('button', { name: exhibit.finalStage }).click()
    await page.waitForTimeout(700)
    const exploded = await exhibitCanvas.screenshot()
    expect(exploded.equals(assembled)).toBe(false)

    await page.getByRole('button', { name: `查看${exhibit.part}` }).click()
    await expect(
      page.getByRole('heading', { name: exhibit.part, exact: true }),
    ).toBeVisible()
    const focusBefore = await exhibitCanvas.screenshot()
    await page
      .getByRole('group', { name: '三维视角控制' })
      .getByRole('button', { name: '聚焦已选零件' })
      .click()
    await page.waitForTimeout(800)
    const focusAfter = await exhibitCanvas.screenshot()
    expect(focusAfter.equals(focusBefore)).toBe(false)

    await page.getByRole('button', { name: '透视模式' }).click()
    await expect(page.getByRole('button', { name: '透视模式' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: '原理模式' }).click()
    await page.getByRole('button', { name: '播放原理' }).click()
    await expect(page.getByText('正在播放原理动画。')).toBeVisible()
    await page.waitForTimeout(150)
    const principleFrameA = await exhibitCanvas.screenshot()
    await page.waitForTimeout(250)
    const principleFrameB = await exhibitCanvas.screenshot()
    expect(principleFrameB.equals(principleFrameA)).toBe(false)
    await page.getByRole('button', { name: '暂停原理' }).click()
    await page.waitForTimeout(900)
    const pausedFrameA = await exhibitCanvas.screenshot()
    await page.waitForTimeout(250)
    const pausedFrameB = await exhibitCanvas.screenshot()
    expect(pausedFrameB.equals(pausedFrameA)).toBe(true)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByRole('button', { name: '播放原理' })).toBeDisabled()

    await page.screenshot({
      path: `${screenshotDirectory}/${exhibit.id}-desktop-principle-1440x900.png`,
      fullPage: true,
    })

    await page.emulateMedia({ reducedMotion: 'no-preference' })

    await page.reload()
    await expect(page.getByText('06 / 06', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '复原模型' }).click()
    await expect(page.getByText('01 / 06', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '返回藏品大厅' }).click()
    await expect(
      page.getByRole('heading', { name: /拆开机械.*看见原理/ }),
    ).toBeVisible()
    expect(browserIssues).toEqual([])
  })
}

for (const exhibit of firearmExhibits) {
  test(`@desktop ${exhibit.title} WebGL journey animates once and pauses exactly`, async ({
    page,
  }) => {
    test.slow()
    const browserIssues = watchBrowserHealth(page)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: '发射循环实验室' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: `开始探索 ${exhibit.title}` })
      .click()

    await expect(
      page.getByRole('region', { name: `${exhibit.title}结构舞台` }),
    ).toBeVisible()
    expect(page.url()).toContain(`#/explore/${exhibit.id}`)
    await expect(page.locator('h1')).toBeFocused()
    await expect(page.getByText('01 / 06', { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    const canvas = page.getByRole('img', { name: exhibit.canvasName })
    await expect(canvas).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: '拆解步骤' }).getByRole('button'),
    ).toHaveCount(6)
    await expect(
      page.getByRole('group', { name: '结构零件' }).getByRole('button'),
    ).toHaveCount(11)
    await page.waitForTimeout(900)
    const assembled = await canvas.screenshot()
    expect(assembled.byteLength).toBeGreaterThan(20_000)

    expect(await selectVisibleCanvasPart(page, canvas)).toBe(true)
    await expect(page.locator('#knowledge-panel h2')).toBeVisible()

    await walkAllMainStages(page)
    await page.waitForTimeout(850)
    const exploded = await canvas.screenshot()
    expect(exploded.equals(assembled)).toBe(false)

    await page.getByRole('button', { name: '透视模式' }).click()
    await expect(page.getByRole('button', { name: '透视模式' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.waitForTimeout(500)
    const xray = await canvas.screenshot()
    expect(xray.equals(exploded)).toBe(false)

    await selectFinalPart(page)
    const focusBefore = await canvas.screenshot()
    await page
      .getByRole('group', { name: '三维视角控制' })
      .getByRole('button', { name: '聚焦已选零件' })
      .click()
    await page.waitForTimeout(850)
    const focusAfter = await canvas.screenshot()
    expect(focusAfter.equals(focusBefore)).toBe(false)

    await page.getByRole('button', { name: '原理模式' }).click()
    const stage = page.getByRole('region', {
      name: `${exhibit.title}结构舞台`,
    })
    await expect(stage).toHaveAttribute('data-cycle-state', 'idle')
    await expect(stage).toHaveAttribute('data-cycle-phase', '0')
    await expect(canvas).toHaveAttribute('aria-describedby', /.+/)
    await expect(
      page.getByText(/循环阶段 1 \/ 6：准备观察。/),
    ).toBeVisible()
    const idleFrame = await canvas.screenshot()

    await pauseFirearmCycleAtPhase(page, stage, 1)
    await page.getByRole('button', { name: '播放一次机械循环' }).click()
    await expect(stage).toHaveAttribute('data-cycle-state', 'paused')
    await expect(stage).toHaveAttribute('data-cycle-phase', '1')
    await expect(
      page.getByText(/循环阶段 2 \/ 6：抽象能量出现。/),
    ).toBeVisible()
    const pausedFrameA = await canvas.screenshot()
    expect(pausedFrameA.equals(idleFrame)).toBe(false)
    await page.waitForTimeout(300)
    const pausedFrameB = await canvas.screenshot()
    expect(pausedFrameB.equals(pausedFrameA)).toBe(true)

    await page.getByRole('button', { name: '播放一次机械循环' }).click()
    await expect
      .poll(
        async () => ({
          state: await stage.getAttribute('data-cycle-state'),
          phase: await stage.getAttribute('data-cycle-phase'),
        }),
        {
          timeout: 30_000,
          message: `${exhibit.title} should complete one UI-timed cycle at phase 5`,
        },
      )
      .toEqual({ state: 'complete', phase: '5' })
    await expect(stage).toHaveAttribute('data-cycle-state', 'complete')
    await expect(stage).toHaveAttribute('data-cycle-phase', '5')
    await expect(
      page.getByText(/循环阶段 6 \/ 6：返回并完成单次循环。/),
    ).toBeVisible()
    await page.waitForTimeout(1_050)
    await expect(stage).toHaveAttribute('data-cycle-state', 'complete')
    await expect(stage).toHaveAttribute('data-cycle-phase', '5')

    await page.getByRole('button', { name: '复原循环' }).click()
    await expect(stage).toHaveAttribute('data-cycle-state', 'idle')
    await expect(stage).toHaveAttribute('data-cycle-phase', '0')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(
      page.getByRole('button', { name: '播放一次机械循环' }),
    ).toBeDisabled()
    await expect(page.getByText(/已减少动态/)).toBeVisible()
    await stepFirearmCycleToEnd(page)
    await expect(stage).toHaveAttribute('data-cycle-state', 'paused')
    await expect(stage).toHaveAttribute('data-cycle-phase', '5')
    await page.screenshot({
      path: `${screenshotDirectory}/${exhibit.id}-desktop-principle-1440x900.png`,
    })

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const timeline = page.getByRole('navigation', { name: '拆解步骤' })
    const savedProgressLabel = `${String(exhibit.savedStepIndex + 1).padStart(2, '0')} / 06`
    await timeline.getByRole('button').nth(exhibit.savedStepIndex).click()
    await expect(page.getByText(savedProgressLabel, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(savedProgressLabel, { exact: true })).toBeVisible()
    expect(browserIssues).toEqual([])
  })
}

test('@desktop firearm fallback persists four independent progress records', async ({
  page,
}) => {
  const browserIssues = watchBrowserHealth(page)

  for (const exhibit of firearmExhibits) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await expect(page.getByRole('img', { name: exhibit.staticName })).toBeVisible()

    const savedProgressLabel = `${String(exhibit.savedStepIndex + 1).padStart(2, '0')} / 06`
    await page
      .getByRole('navigation', { name: '拆解步骤' })
      .getByRole('button')
      .nth(exhibit.savedStepIndex)
      .click()
    await expect(page.getByText(savedProgressLabel, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(savedProgressLabel, { exact: true })).toBeVisible()
  }

  for (const exhibit of firearmExhibits) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await expect(
      page.getByText(
        `${String(exhibit.savedStepIndex + 1).padStart(2, '0')} / 06`,
        { exact: true },
      ),
    ).toBeVisible()
  }

  await page.goto('/#/explore/m1903?no-webgl=1')
  await page.getByRole('button', { name: '复原模型' }).click()
  await expect(page.getByText('01 / 06', { exact: true })).toBeVisible()

  for (const exhibit of firearmExhibits.slice(1)) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await expect(
      page.getByText(
        `${String(exhibit.savedStepIndex + 1).padStart(2, '0')} / 06`,
        { exact: true },
      ),
    ).toBeVisible()
  }

  const storedProgressAfterSingleReset = await page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          localStorage.getItem(`mechanical-atlas-progress:${id}`),
        ]),
      ),
    firearmExhibits.map(({ id }) => id),
  )
  expect(storedProgressAfterSingleReset).toEqual({
    m1903: JSON.stringify({ stepIndex: 0 }),
    m1911a1: JSON.stringify({ stepIndex: 2 }),
    'm1-garand': JSON.stringify({ stepIndex: 3 }),
    mp5: JSON.stringify({ stepIndex: 4 }),
  })
  expect(browserIssues).toEqual([])
})

test('@tablet tablet fallback preserves the learning path and screenshot evidence', async ({
  page,
}, testInfo) => {
  const browserIssues = watchBrowserHealth(page)

  await page.goto('/#/explore/m4?no-webgl=1')
  await expect(
    page.getByRole('img', { name: 'M4 中型坦克静态结构示意' }),
  ).toBeVisible()
  await expect(page.getByText('已切换到静态学习模式')).toBeVisible()
  await expect(page.getByRole('navigation', { name: '拆解步骤' })).toBeVisible()
  await expect(
    page.locator('[aria-label="结构零件"]').getByRole('button'),
  ).toHaveCount(11)
  const screenshot = await page.screenshot()
  expect(screenshot.byteLength).toBeGreaterThan(30_000)
  await testInfo.attach('fallback-1024x768', {
    body: screenshot,
    contentType: 'image/png',
  })

  for (const exhibit of newExhibits) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await expect(
      page.getByRole('img', { name: exhibit.staticName }),
    ).toBeVisible()
    await expect(
      page.getByRole('group', { name: '结构零件' }).getByRole('button'),
    ).toHaveCount(11)
    await page.waitForTimeout(900)
    await page.screenshot({
      path: `${screenshotDirectory}/${exhibit.id}-tablet-static-1024x768.png`,
    })
  }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const exhibit of firearmExhibits) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await expect(page.getByRole('img', { name: exhibit.staticName })).toBeVisible()
    await expect(page.getByRole('img', { name: exhibit.canvasName })).toHaveCount(0)
    await walkAllMainStages(page)
    await selectFinalPart(page)
    await page.getByRole('button', { name: '原理模式' }).click()
    await expect(
      page.getByRole('button', { name: '播放一次机械循环' }),
    ).toBeDisabled()
    await stepFirearmCycleToEnd(page)
    await expectNoHorizontalOverflow(page)
    await expectAllVisibleButtonsMeetTouchTarget(page)
    await page.screenshot({
      path: `${screenshotDirectory}/${exhibit.id}-tablet-static-1024x768.png`,
    })
  }
  expect(browserIssues).toEqual([])
})

test('@mobile mobile fallback keeps reduced motion, narration, and geometry', async ({
  page,
}, testInfo) => {
  const browserIssues = watchBrowserHealth(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    class TestUtterance {
      text: string
      lang = ''

      constructor(text: string) {
        this.text = text
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: TestUtterance,
    })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: TestUtterance) {
          ;(window as typeof window & { __spokenText?: string }).__spokenText =
            utterance.text
        },
      },
    })
  })

  await page.goto('/#/explore/m4?no-webgl=1')
  await expect(
    page.getByRole('img', { name: 'M4 中型坦克静态结构示意' }),
  ).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'M4 中型坦克可交互三维结构模型' }),
  ).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '拆解步骤' })).toBeVisible()
  const inspectorToggle = page.getByRole('button', {
    name: '展开结构观察面板',
  })
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false')
  await inspectorToggle.click()
  await expect(
    page.getByRole('button', { name: '收起结构观察面板' }),
  ).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('explorer-inspector-panel')).toBeVisible()
  await expect(page.getByRole('group', { name: '结构零件' }).getByRole('button')).toHaveCount(
    11,
  )

  await page.getByRole('button', { name: '原理模式' }).click()
  await expect(page.getByRole('button', { name: '播放原理' })).toBeDisabled()
  await expect(page.getByText(/已减少动态/)).toBeVisible()

  await page.getByRole('button', { name: '查看星形发动机' }).click()
  await expect(page.getByRole('heading', { name: '星形发动机', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '朗读当前知识卡' }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __spokenText?: string }).__spokenText ?? '',
      ),
    )
    .toContain('发动机')

  await page.getByRole('button', { name: '前往结构舞台' }).click()
  const stageHeadingBox = await page
    .getByRole('heading', { level: 1 })
    .boundingBox()
  expect(stageHeadingBox?.y).toBeGreaterThanOrEqual(58)

  const viewportMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    undersizedButtons: [...document.querySelectorAll('button')]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
      })
      .map((element) => ({
        label: element.getAttribute('aria-label') ?? element.textContent?.trim(),
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      })),
  }))
  expect(viewportMetrics.documentWidth).toBe(viewportMetrics.viewportWidth)
  expect(viewportMetrics.undersizedButtons).toEqual([])
  await testInfo.attach('mobile-stage-390x844', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })

  for (const exhibit of newExhibits) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await expect(page.getByRole('img', { name: exhibit.staticName })).toBeVisible()
    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      undersizedButtons: [...document.querySelectorAll('button')]
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
        })
        .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim()),
    }))
    expect(metrics.documentWidth).toBe(metrics.viewportWidth)
    expect(metrics.undersizedButtons).toEqual([])
    await page.waitForTimeout(900)
    await page.screenshot({
      path: `${screenshotDirectory}/${exhibit.id}-mobile-static-390x844.png`,
    })
  }

  for (const exhibit of firearmExhibits) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await expect(page.getByRole('img', { name: exhibit.staticName })).toBeVisible()
    await expect(page.getByRole('img', { name: exhibit.canvasName })).toHaveCount(0)
    await page.getByRole('button', { name: '展开结构观察面板' }).click()
    await expect(page.getByTestId('explorer-inspector-panel')).toBeVisible()
    await walkAllMainStages(page)
    await selectFinalPart(page)
    await page.getByRole('button', { name: '收起结构观察面板' }).click()
    await expect(
      page.getByRole('button', { name: '展开结构观察面板' }),
    ).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('button', { name: '原理模式' }).click()
    await expect(
      page.getByRole('button', { name: '播放一次机械循环' }),
    ).toBeDisabled()
    await stepFirearmCycleToEnd(page)
    await expectNoHorizontalOverflow(page)
    await expectAllVisibleButtonsMeetTouchTarget(page)
    await page.screenshot({
      path: `${screenshotDirectory}/${exhibit.id}-mobile-static-390x844.png`,
    })
  }
  expect(browserIssues).toEqual([])
})
