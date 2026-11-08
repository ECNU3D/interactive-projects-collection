import { expect, test, type Page } from '@playwright/test'

const firearmExhibits = [
  { id: 'm1903', title: 'M1903 Springfield' },
  { id: 'm1911a1', title: 'M1911A1' },
  { id: 'm1-garand', title: 'M1 Garand' },
  { id: 'mp5', title: 'HK MP5' },
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

async function reachFinalStaticPrincipleState(page: Page) {
  const mainStages = page
    .getByRole('navigation', { name: '拆解步骤' })
    .getByRole('button')
  await expect(mainStages).toHaveCount(6)
  await mainStages.nth(5).click()
  await expect(page.getByText('06 / 06', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '原理模式' }).click()
  await expect(
    page.getByRole('button', { name: '播放一次机械循环' }),
  ).toBeDisabled()

  const nextPhase = page.getByRole('button', { name: '下一循环阶段' })
  for (let phase = 2; phase <= 6; phase += 1) {
    await nextPhase.click()
    await expect(
      page.getByText(new RegExp(`循环阶段 ${phase} / 6：`)),
    ).toBeVisible()
  }
}

test('@tablet firearm static profiles keep a 70/30 stage-inspector contract', async ({
  page,
}) => {
  const browserIssues = watchBrowserHealth(page)
  const profilePixels: Buffer[] = []

  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const exhibit of firearmExhibits) {
    await page.goto(`/#/explore/${exhibit.id}?no-webgl=1`)
    await reachFinalStaticPrincipleState(page)

    const staticDiagram = page.getByRole('img', {
      name: `${exhibit.title} 静态结构示意`,
    })
    const profile = staticDiagram.locator(
      `.firearm-silhouette[data-firearm-profile="${exhibit.id}"]`,
    )
    const stage = page.locator('.explorer-stage')
    const workspace = page.locator('.explorer-workspace')
    const inspector = page.locator('.explorer-inspector')
    const inspectorPanel = page.getByTestId('explorer-inspector-panel')
    const partNavigator = page.getByRole('group', { name: '结构零件' })
    const knowledgePanel = page.getByRole('complementary', {
      name: '结构知识卡',
    })
    const journeyBar = page.locator('.journey-bar')
    const learningGuide = page.locator('.learning-guide')

    await expect(staticDiagram).toBeVisible()
    await expect(profile).toBeVisible()
    await expect(partNavigator).toBeVisible()
    await expect(inspectorPanel).toBeVisible()
    await expect(learningGuide).toBeVisible()

    const firstPart = partNavigator.getByRole('button').first()
    await firstPart.click()
    await expect(firstPart).toHaveAttribute('aria-pressed', 'true')
    await expect(knowledgePanel.locator('h2')).toBeVisible()

    const [
      diagramBox,
      profileBox,
      stageBox,
      workspaceBox,
      inspectorBox,
      navigatorBox,
      knowledgeBox,
      journeyBox,
      learningGuideBox,
    ] = await Promise.all([
      staticDiagram.boundingBox(),
      profile.boundingBox(),
      stage.boundingBox(),
      workspace.boundingBox(),
      inspector.boundingBox(),
      partNavigator.boundingBox(),
      knowledgePanel.boundingBox(),
      journeyBar.boundingBox(),
      learningGuide.boundingBox(),
    ])

    expect(diagramBox).not.toBeNull()
    expect(profileBox).not.toBeNull()
    expect(stageBox).not.toBeNull()
    expect(workspaceBox).not.toBeNull()
    expect(inspectorBox).not.toBeNull()
    expect(navigatorBox).not.toBeNull()
    expect(knowledgeBox).not.toBeNull()
    expect(journeyBox).not.toBeNull()
    expect(learningGuideBox).not.toBeNull()
    expect(profileBox!.width).toBeGreaterThan(240)
    expect(profileBox!.height).toBeGreaterThan(60)
    expect(stageBox!.width / workspaceBox!.width).toBeGreaterThanOrEqual(0.7)
    expect(inspectorBox!.width / workspaceBox!.width).toBeLessThanOrEqual(0.3)
    expect(stageBox!.height / page.viewportSize()!.height).toBeGreaterThanOrEqual(
      0.7,
    )
    expect(
      stageBox!.x + stageBox!.width,
      `${exhibit.id}: stage must not overlap the Inspector`,
    ).toBeLessThanOrEqual(inspectorBox!.x + 1)
    expect(
      stageBox!.y + stageBox!.height,
      `${exhibit.id}: workspace must clear the JourneyBar`,
    ).toBeLessThanOrEqual(journeyBox!.y + 1)
    expect(
      navigatorBox!.y + navigatorBox!.height,
      `${exhibit.id}: parts must stay inside the Inspector and clear the JourneyBar`,
    ).toBeLessThanOrEqual(Math.min(inspectorBox!.y + inspectorBox!.height, journeyBox!.y) + 1)
    expect(knowledgeBox!.y).toBeGreaterThanOrEqual(navigatorBox!.y)
    expect(await knowledgePanel.evaluate((node) => getComputedStyle(node).overflowY)).toBe(
      'auto',
    )

    const partGlyph = knowledgePanel.locator('.part-glyph')
    const sectionIcon = knowledgePanel.locator(
      '.knowledge-panel__section-icon',
    ).first()
    const [glyphBox, iconBox] = await Promise.all([
      partGlyph.boundingBox(),
      sectionIcon.boundingBox(),
    ])
    expect(glyphBox).not.toBeNull()
    expect(iconBox).not.toBeNull()
    expect(glyphBox!.width).toBeLessThanOrEqual(144)
    expect(glyphBox!.height).toBeLessThanOrEqual(72)
    expect(iconBox!.width).toBeLessThanOrEqual(24)
    expect(iconBox!.height).toBeLessThanOrEqual(24)

    profilePixels.push(
      await staticDiagram.screenshot({ animations: 'disabled' }),
    )
  }

  for (let index = 0; index < profilePixels.length; index += 1) {
    expect(profilePixels[index].byteLength).toBeGreaterThan(5_000)
    for (let previous = 0; previous < index; previous += 1) {
      expect(profilePixels[index].equals(profilePixels[previous])).toBe(false)
    }
  }

  expect(browserIssues).toEqual([])
})

test('@mobile compact firearm sheet starts collapsed and clears both bottom rails', async ({
  page,
}) => {
  const browserIssues = watchBrowserHealth(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/mp5?no-webgl=1')

  const toggle = page.getByRole('button', {
    name: '展开结构观察面板',
  })
  const profile = page.locator(
    '.firearm-silhouette[data-firearm-profile="mp5"]',
  )
  const journeyBar = page.locator('.journey-bar')
  const bottomNavigation = page.getByRole('navigation', {
    name: '探索室导航',
  })

  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(profile).toBeVisible()

  const [guideBox, modeStatusBox] = await Promise.all([
    page.locator('.learning-guide').boundingBox(),
    page.locator('.explorer-mode-status').boundingBox(),
  ])
  expect(guideBox).not.toBeNull()
  expect(modeStatusBox).not.toBeNull()
  expect(
    modeStatusBox!.y + modeStatusBox!.height,
    'the current mode must remain visible inside the one guide bubble',
  ).toBeLessThanOrEqual(guideBox!.y + guideBox!.height + 1)

  const undersizedTargets = await page.locator('button:visible, a:visible').evaluateAll(
    (targets) =>
      targets
        .map((target) => {
          const box = target.getBoundingClientRect()
          return {
            name:
              target.getAttribute('aria-label') ??
              target.textContent?.trim() ??
              target.tagName,
            width: box.width,
            height: box.height,
          }
        })
        .filter(({ width, height }) => width < 44 || height < 44),
  )
  expect(undersizedTargets).toEqual([])

  const [profileBox, journeyBox, navigationBox] = await Promise.all([
    profile.boundingBox(),
    journeyBar.boundingBox(),
    bottomNavigation.boundingBox(),
  ])
  expect(profileBox).not.toBeNull()
  expect(journeyBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect(profileBox!.y + profileBox!.height + 8).toBeLessThanOrEqual(
    journeyBox!.y,
  )
  expect(journeyBox!.y + journeyBox!.height).toBeLessThanOrEqual(
    navigationBox!.y + 1,
  )

  await toggle.click()
  const inspector = page.locator('.explorer-inspector')
  const panel = page.getByTestId('explorer-inspector-panel')
  await expect(panel).toBeVisible()
  const [inspectorBox, expandedJourneyBox] = await Promise.all([
    inspector.boundingBox(),
    journeyBar.boundingBox(),
  ])
  expect(inspectorBox).not.toBeNull()
  expect(expandedJourneyBox).not.toBeNull()

  const inspectorShadowBlur = await inspector.evaluate((node) => {
    const pixelValues = getComputedStyle(node).boxShadow
      .match(/-?[\d.]+px/g)
      ?.map((value) => Number.parseFloat(value))
    return pixelValues?.[2] ?? 0
  })
  expect(
    inspectorShadowBlur,
    'the mobile sheet shadow must not black out the guide behind it',
  ).toBeLessThanOrEqual(32)
  expect(inspectorBox!.height).toBeLessThanOrEqual(844 * 0.62 + 1)
  expect(inspectorBox!.y + inspectorBox!.height).toBeLessThanOrEqual(
    expandedJourneyBox!.y + 1,
  )

  const overflowX = await page.locator('html').evaluate(
    (node) => node.scrollWidth - node.clientWidth,
  )
  expect(overflowX).toBeLessThanOrEqual(0)
  expect(browserIssues).toEqual([])
})

test('@tablet firearm guide owns mode controls and keeps one primary action', async ({
  page,
}) => {
  const browserIssues = watchBrowserHealth(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/mp5?no-webgl=1')

  const guide = page.locator('.learning-guide')
  const primaryActions = page.locator('.ui-button--primary:visible')
  const expectOnlyPrimary = async (name: string) => {
    await expect(primaryActions).toHaveCount(1)
    await expect(primaryActions).toHaveAccessibleName(name)
  }

  await expect(guide.locator('.explorer-mode-status')).toBeVisible()
  const guidePointer = await guide.evaluate((node) => {
    const pointer = getComputedStyle(node, '::after')
    return {
      content: pointer.content,
      width: pointer.width,
      height: pointer.height,
      clipPath: pointer.clipPath,
      pointerEvents: pointer.pointerEvents,
    }
  })
  expect(guidePointer.content).not.toBe('none')
  expect(guidePointer.width).not.toBe('auto')
  expect(guidePointer.height).not.toBe('auto')
  expect(guidePointer.clipPath).not.toBe('none')
  expect(guidePointer.pointerEvents).toBe('none')
  await expectOnlyPrimary('我想好了')

  await page.getByRole('button', { name: '原理模式' }).click()
  const cycleControls = guide.getByRole('region', {
    name: '机械循环控制',
  })
  await expect(cycleControls).toBeVisible()
  await expect(
    cycleControls.getByRole('button', { name: '播放一次机械循环' }),
  ).toHaveClass(/ui-button--secondary/)
  await expectOnlyPrimary('我想好了')

  await page.getByRole('button', { name: '看提示' }).click()
  await expectOnlyPrimary('我想好了')

  await page.getByRole('button', { name: '我想好了' }).click()
  await expectOnlyPrimary('再试一次')

  await page.getByRole('button', { name: '切换到自由探索' }).click()
  await expectOnlyPrimary('打开新手导览')
  expect(browserIssues).toEqual([])
})

test('@tablet collapsing the Inspector returns its reserved column to the stage and preserves touch targets', async ({
  page,
}) => {
  const browserIssues = watchBrowserHealth(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/explore/mp5?no-webgl=1')

  const workspace = page.locator('.explorer-workspace')
  const stage = page.locator('.explorer-stage')
  const inspector = page.locator('.explorer-inspector')
  const inspectorPanel = page.getByTestId('explorer-inspector-panel')
  const collapseToggle = page.getByRole('button', {
    name: '收起结构观察面板',
  })

  await expect(inspectorPanel).toBeVisible()

  const [workspaceBox, expandedStageBox, expandedInspectorBox] =
    await Promise.all([
      workspace.boundingBox(),
      stage.boundingBox(),
      inspector.boundingBox(),
    ])
  expect(workspaceBox).not.toBeNull()
  expect(expandedStageBox).not.toBeNull()
  expect(expandedInspectorBox).not.toBeNull()

  await collapseToggle.click()
  await expect(inspectorPanel).toBeHidden()
  await expect(
    page.getByRole('button', { name: '展开结构观察面板' }),
  ).toHaveAttribute('aria-expanded', 'false')
  await expect
    .poll(async () => (await inspector.boundingBox())?.width)
    .toBeLessThanOrEqual(56)

  const [collapsedStageBox, collapsedInspectorBox] = await Promise.all([
    stage.boundingBox(),
    inspector.boundingBox(),
  ])
  expect(collapsedStageBox).not.toBeNull()
  expect(collapsedInspectorBox).not.toBeNull()
  expect(collapsedInspectorBox!.width).toBeLessThanOrEqual(56)
  expect(collapsedStageBox!.width / workspaceBox!.width).toBeGreaterThanOrEqual(
    0.94,
  )
  expect(collapsedStageBox!.width).toBeGreaterThan(
    expandedStageBox!.width + 180,
  )
  expect(
    workspaceBox!.width - collapsedStageBox!.width,
    'collapsed Inspector must not leave an empty 29% tablet column',
  ).toBeLessThanOrEqual(56)

  await page
    .getByRole('button', { name: '展开结构观察面板' })
    .click()
  await expect(inspectorPanel).toBeVisible()
  await expect
    .poll(async () => (await inspector.boundingBox())?.width)
    .toBeGreaterThan(200)

  const [restoredStageBox, restoredInspectorBox] = await Promise.all([
    stage.boundingBox(),
    inspector.boundingBox(),
  ])
  expect(restoredStageBox).not.toBeNull()
  expect(restoredInspectorBox).not.toBeNull()
  expect(
    Math.abs(restoredStageBox!.width - expandedStageBox!.width),
  ).toBeLessThanOrEqual(1)
  expect(restoredInspectorBox!.width / workspaceBox!.width).toBeLessThanOrEqual(
    0.3,
  )

  const undersizedTargets = await page
    .locator('button:visible, a:visible')
    .evaluateAll((targets) =>
      targets
        .map((target) => {
          const box = target.getBoundingClientRect()
          return {
            name:
              target.getAttribute('aria-label') ??
              target.textContent?.trim() ??
              target.tagName,
            width: box.width,
            height: box.height,
          }
        })
        .filter(({ width, height }) => width < 44 || height < 44),
    )
  expect(undersizedTargets).toEqual([])
  expect(browserIssues).toEqual([])
})
