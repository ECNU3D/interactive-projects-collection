# Visual Quality Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 7 件机械展品升级为“儿童科技馆夜场”体验：3D 模型具有实体重量、清晰光影与可信轮廓，探索室让舞台成为主角，同时保持安全边界、无障碍、静态降级、状态机和全部学习内容不变。

**Architecture:** 先新增共享 `ScenePresentation` 和材质状态解析器，四类动态场景只保留各自相机与模型逻辑；UI 通过 `ExplorerInspector`、`JourneyBar`、`CameraControls` 将 826 行页面拆成受控展示组件；三件大型机械通过纯 Three 几何工厂逐件替换，保持所有 part id、focus point、explode offset 与原理路径接口不变。枪械不增加机械细节，只继承共享渲染、UI、质量和安全提示。

**Tech Stack:** React 19、TypeScript 7、Three 0.185、React Three Fiber 9、Drei 10、`@react-three/postprocessing` 3.0.4、`postprocessing` 6.39.2、Vitest、Playwright、CSS design tokens、Noto Sans SC Variable（OFL-1.1）。

---

## Scope and fixed decisions

- 实施原方案 P0、P1、P2、P3；P4 的 glTF 管线与观察印章明确保持可选，不作为本轮完成门槛。
- 共享 UI、灯光、舞台、质量档位覆盖全部 7 件展品；几何升级只覆盖 `m4`、`x57`、`asr10`。
- 不增加真实武器、航空器或舰艇尺寸、装配公差、弹药、火控、瞄准、操纵或制造信息。
- 不新增或重命名内容 part id，不改 `focusPoint`、`explodeOffset`、6 阶段、11 零件、7 路由与 localStorage key。
- 高质量档开启 Canvas shadows、AccumulativeShadows 与 postprocessing；受限档关闭整条后处理、使用较低 dpr 与低分辨率 ContactShadows。reduced motion 仍可保留静态 AO/Bloom/Vignette，但不得产生持续帧。
- `ScenePresentation` 必须留在动态 scene chunk，静态 fallback 不得提前下载 Three/postprocessing。
- 每个任务严格走 RED → GREEN → REFACTOR，并在规格复审、代码质量复审均通过后进入下一任务。

## File map

New scene foundation:

- `src/scene/ScenePresentation.tsx`: 环境光板、三点光、圆形展台、ContactShadows 与高质量后处理组合。
- `src/scene/partMaterial.ts`: `solid | pending | xray | dimmed` 材质语义和纯 resolver。
- `src/scene/museumPalette.ts`: 与 UI 零件图例一一对应的 8 色物理材质色板与主体/次要/点缀槽。
- `src/scene/proceduralGeometry.ts`: 放样、车削、挤出、扭转叶片、齿圈、窄倒角纯 Three 工厂。
- `src/scene/GeometryInstances.tsx`: 可复用 instancing 容器。
- `src/scene/VesselGeometry.ts`, `AircraftGeometry.ts`, `TankGeometry.ts`: 原创无单位轮廓、预算与几何集合。

New UI components:

- `src/components/ExplorerInspector.tsx`: 桌面折叠玻璃栏 / 手机 bottom sheet。
- `src/components/JourneyBar.tsx`: 组合阶段时间轴与零件导航。
- `src/components/CameraControls.tsx`: 五个相机命令胶囊。

Verification artifacts:

- `tests/e2e/visual-quality.spec.ts`: 7 路由、舞台占比、面板、对比度、稳定帧与截图证据。
- `tests/e2e/geometry-silhouette.spec.ts`: 三件大型机械固定相机轮廓证据。
- `scripts/check-build-budget.mjs`: 字体与动态 chunk 预算。
- `THIRD_PARTY_NOTICES.md`, `public/licenses/noto-sans-sc-OFL-1.1.txt`: 字体许可登记。

---

### Task 1: Dependency and quality policy foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/scene/sceneQuality.ts`
- Modify: `src/scene/sceneSupport.ts`
- Create: `src/scene/sceneQuality.test.ts`
- Modify: `src/scene/sceneSupport.test.ts`
- Create: `scripts/check-build-budget.mjs`

- [ ] **Step 1: Write failing quality and support tests**

```ts
expect(getSceneQualityProfile({ viewportWidth: 1440, coarsePointer: false })).toMatchObject({
  dpr: [1, 2], shadows: true, postprocessing: true, antialias: false,
})
expect(getSceneQualityProfile({ viewportWidth: 390, coarsePointer: true })).toMatchObject({
  dpr: [1, 1.25], shadows: false, postprocessing: false, antialias: true,
})
expect(detectSceneSupport(webgl1OnlyCanvas)).toBe(false)
expect(detectSceneSupport(webgl2Canvas)).toBe(true)
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/scene/sceneQuality.test.ts src/scene/sceneSupport.test.ts`

Expected: FAIL because the profile lacks `shadows`, `postprocessing`, `antialias`, and support still accepts WebGL1.

- [ ] **Step 3: Install pinned compatible dependencies**

Run: `npm install --save-exact @react-three/postprocessing@3.0.4 postprocessing@6.39.2 @fontsource-variable/noto-sans-sc@5.2.10`

Expected: `npm ls` resolves one compatible `postprocessing@6.39.2`; `npm audit` reports zero vulnerabilities.

- [ ] **Step 4: Extend `SceneQualityProfile`**

```ts
export interface SceneQualityProfile {
  dpr: [number, number]
  shadows: boolean
  shadowMode: 'contact' | 'accumulative'
  postprocessing: boolean
  antialias: boolean
  shadowMapSize: 1024 | 2048
  shadowFrames: number
  environmentResolution: 64 | 128
}
```

Constrained must disable Canvas shadows/postprocessing, keep one finite 256px ContactShadows pass, and use context antialiasing. Desktop must use dpr 2, Canvas shadows, finite AccumulativeShadows, composer SMAA and a 2048 main shadow map. Update WebGL support to require `webgl2` because Three r185 does not provide a WebGL1 production path.

- [ ] **Step 5: Add build budget script**

`check-build-budget.mjs` must read `dist/assets`, fail when emitted WOFF2 total exceeds 5.25 MiB, when a second CJK family appears, or when any single lazy exhibit chunk exceeds the documented threshold by more than 15%. Add `"check:budget": "node scripts/check-build-budget.mjs"` and make `build` run Vite followed by the budget check.

- [ ] **Step 6: Run GREEN and build**

Run: `npm test -- --run src/scene/sceneQuality.test.ts src/scene/sceneSupport.test.ts && npm run build`

Expected: PASS; budget script prints font total and scene chunk sizes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/check-build-budget.mjs src/scene/sceneQuality.ts src/scene/sceneQuality.test.ts src/scene/sceneSupport.ts src/scene/sceneSupport.test.ts
git commit -m "feat: define adaptive visual quality profiles"
```

---

### Task 2: Solid, pending, X-ray, hover, and selected material semantics

**Files:**
- Create: `src/scene/partMaterial.ts`
- Create: `src/scene/partMaterial.test.ts`
- Create: `src/scene/museumPalette.ts`
- Create: `src/scene/museumPalette.test.ts`
- Modify: `src/scene/MechanicalPart.tsx`
- Modify: `src/scene/MechanicalPart.test.ts`
- Modify: `src/scene/TankPart.tsx`
- Modify: `src/scene/TankPart.test.ts`
- Modify: `src/scene/partMotion.ts`
- Modify: `src/scene/partMotion.test.ts`
- Modify: `src/scene/AircraftPart.tsx`
- Modify: `src/scene/VesselPart.tsx`

- [ ] **Step 1: Write failing resolver tests**

```ts
expect(resolvePartMaterial({ revealed: true, shell: false, mode: 'explode' })).toEqual({
  state: 'solid', opacity: 1, transparent: false, depthWrite: true,
})
expect(resolvePartMaterial({ revealed: false, shell: false, mode: 'explode' }).state).toBe('pending')
expect(resolvePartMaterial({ revealed: true, shell: true, mode: 'xray' })).toMatchObject({
  state: 'xray', transparent: true, depthWrite: false,
})
```

Also assert selected X-ray shells remain X-ray, hover is distinct from selected, and all transitions set `needsUpdate` only when transparency/depth behavior changes.

Add a palette contract asserting eight distinct, AA-compatible accent keys map to the same CSS token names and that body/secondary/detail slots have different metalness/roughness ranges.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/scene/partMaterial.test.ts src/scene/museumPalette.test.ts src/scene/MechanicalPart.test.ts src/scene/TankPart.test.ts src/scene/partMotion.test.ts`

Expected: FAIL because all parts currently default to opacity 0.82–0.84 and transparent true.

- [ ] **Step 3: Implement the pure material resolver**

```ts
export type PartMaterialState = 'solid' | 'pending' | 'xray' | 'dimmed'

export interface ResolvedPartMaterial {
  state: PartMaterialState
  opacity: number
  transparent: boolean
  depthWrite: boolean
  saturation: number
}
```

Use opaque `solid`, low-saturation wax `pending`, dedicated low-opacity shell `xray`, and readable `dimmed`. Selection/hover may change emissive, scale and Outline selection, but never override the state.

Define `MuseumMaterialSlots` with body/secondary/detail values for cast metal, painted metal, rubber, brass and emissive teaching overlays. Geometry components may opt into 2–3 slots, but the parent Part retains selection/explode ownership.

- [ ] **Step 4: Make `MechanicalPart` own hover and material transitions**

Add internal hover state, `data-part-material`, Select registration, demand-safe invalidation until motion/material values settle, and one-time disposal. Remove Aircraft/Vessel wrapper `depthWrite` overrides.

- [ ] **Step 5: Delegate `TankPart` to `MechanicalPart`**

Preserve the public TankPart prop contract and M4-specific palette/focus behavior while deleting its duplicate damping/material lifecycle. Ensure Tank can later use `frameloop="demand"` without freezing.

- [ ] **Step 6: Run GREEN and focused model tests**

Run: `npm test -- --run src/scene/partMaterial.test.ts src/scene/museumPalette.test.ts src/scene/MechanicalPart.test.ts src/scene/TankPart.test.ts src/scene/partMotion.test.ts src/scene/AircraftModel.test.ts src/scene/VesselModel.test.ts src/scene/FirearmModel.test.ts`

Expected: PASS; existing cycle substitute opacity tests remain unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/scene/partMaterial.ts src/scene/partMaterial.test.ts src/scene/museumPalette.ts src/scene/museumPalette.test.ts src/scene/MechanicalPart.tsx src/scene/MechanicalPart.test.ts src/scene/TankPart.tsx src/scene/TankPart.test.ts src/scene/partMotion.ts src/scene/partMotion.test.ts src/scene/AircraftPart.tsx src/scene/VesselPart.tsx
git commit -m "feat: give mechanical parts physical material states"
```

---

### Task 3: Shared museum lighting, podium, shadows, and postprocessing

**Files:**
- Create: `src/scene/ScenePresentation.tsx`
- Create: `src/scene/ScenePresentation.test.tsx`
- Modify: `src/scene/sceneSupport.ts`
- Modify: `src/scene/TankScene.tsx`
- Modify: `src/scene/AircraftScene.tsx`
- Modify: `src/scene/VesselScene.tsx`
- Modify: `src/scene/FirearmScene.tsx`
- Modify: corresponding `*Scene.test.ts` and `FirearmScene.accessibility.test.tsx`

- [ ] **Step 1: Write failing presentation tests**

Mock Drei/postprocessing and assert desktop renders Environment with procedural Lightformers, warm key/cool rim/fill lights, circular podium, AccumulativeShadows, N8AO, Bloom, Outline, SMAA and Vignette. Assert constrained renders finite low-resolution ContactShadows without composer and never renders `gridHelper`.

```tsx
expect(screen.getByTestId('museum-podium')).toBeInTheDocument()
expect(screen.getByTestId('effect-composer')).toHaveAttribute('data-multisampling', '0')
expect(screen.queryByTestId('grid-helper')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/scene/ScenePresentation.test.tsx src/scene/TankScene.test.ts src/scene/AircraftScene.test.ts src/scene/VesselScene.test.ts src/scene/FirearmScene.test.ts`

Expected: FAIL because scenes repeat grid/light/contact-shadow implementations and Canvas lacks shadows.

- [ ] **Step 3: Implement `ScenePresentation`**

```tsx
<Environment frames={1} resolution={quality.environmentResolution}>
  <Lightformer form="rect" color="#f5dba2" intensity={4} />
  <Lightformer form="rect" color="#70c7ba" intensity={2} />
</Environment>
```

Add a matte circular stage with brass scale ring/nameplate, backside gradient dome, static dust points, warm key + cyan rim + low fill. High quality adds finite AccumulativeShadows and the effect chain; constrained uses one finite ContactShadows pass. Outline pulse speed is zero; Bloom threshold is 1 and only HDR emissive teaching overlays glow.

- [ ] **Step 4: Wire all four Scenes**

Each Canvas must receive profile `dpr`, `shadows`, and `gl.antialias`. Preserve scene-specific cameras and accessibility labels. Make Tank use the same demand/always rules as the other static scenes. Preserve Firearm cycle-aware frameloop and do not let shared materials control projectile/case refs.

- [ ] **Step 5: Add vessel abstract water variant**

Use a small procedural shader surface with frozen time under reduced-motion and demand-safe invalidation only while principle animation is active. Keep the content label “抽象水面、非海况模型”.

- [ ] **Step 6: Run GREEN, full scene tests, and build**

Run: `npm test -- --run src/scene && npm run build`

Expected: PASS; dynamic scene chunks contain the presentation code while Gallery/static fallback chunks do not.

- [ ] **Step 7: Commit**

```bash
git add src/scene/ScenePresentation.tsx src/scene/ScenePresentation.test.tsx src/scene/*Scene.tsx src/scene/*Scene.test.ts src/scene/FirearmScene.accessibility.test.tsx
git commit -m "feat: light every exhibit like a museum treasure"
```

---

### Task 4: Design tokens, type, contrast, and gallery spotlight

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: `src/styles/gallery.css`
- Modify: `src/components/CollectionCard.tsx`
- Create: `src/components/CollectionCard.test.tsx`
- Modify: `src/pages/GalleryPage.test.tsx`
- Create: `public/licenses/noto-sans-sc-OFL-1.1.txt`
- Create: `THIRD_PARTY_NOTICES.md`

- [ ] **Step 1: Write failing token/card tests**

Assert required token names exist, CollectionCard updates `--spotlight-x/y` on pointer move and resets on leave, seven accessible entry names remain unchanged, and reduced-motion/focus paths do not depend on pointer events.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/components/CollectionCard.test.tsx src/pages/GalleryPage.test.tsx`

Expected: FAIL because spotlight behavior and tokens do not exist.

- [ ] **Step 3: Expand tokens without deleting legacy aliases**

Define semantic surfaces/text/border/status/part colors, `--space-1…10`, `--radius-xs…pill`, `--shadow-sm/panel/spotlight/focus`, `--duration-fast/base/slow`, easing, and z-index layers. Use Noto Sans SC Variable for UI body and retain the museum serif stack for display titles.

- [ ] **Step 4: Register font and license**

Import only Noto Sans SC variable weight CSS in `main.tsx`, keep `font-display: swap`, copy the official OFL text, and record package version/source/license/retrieval date in `THIRD_PARTY_NOTICES.md` and README.

- [ ] **Step 5: Redesign Gallery around the existing semantic markup**

Use solid hero lettering with restrained glow, AA-compliant text opacity, auto-fit grids for 3+4 cards, land/air/sea/firearm accent differentiation, pointer-driven radial spotlight and fixed-center keyboard spotlight. Do not change `GalleryPage.tsx` grouping or import any Explorer/Three module.

- [ ] **Step 6: Verify contrast, reduced motion, and build budget**

Run: `npm test -- --run src/components/CollectionCard.test.tsx src/pages/GalleryPage.test.tsx && npm run build`

Expected: PASS; no small text below 4.5:1 in scripted contrast checks; font budget passes.

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/styles/tokens.css src/styles/global.css src/styles/gallery.css src/components/CollectionCard.tsx src/components/CollectionCard.test.tsx src/pages/GalleryPage.test.tsx public/licenses/noto-sans-sc-OFL-1.1.txt THIRD_PARTY_NOTICES.md README.md
git commit -m "style: open the museum for younger explorers"
```

---

### Task 5: Stage-first Explorer composition

**Files:**
- Create: `src/components/ExplorerInspector.tsx`
- Create: `src/components/ExplorerInspector.test.tsx`
- Create: `src/components/JourneyBar.tsx`
- Create: `src/components/JourneyBar.test.tsx`
- Create: `src/components/CameraControls.tsx`
- Create: `src/components/CameraControls.test.tsx`
- Create: `src/components/PartGlyph.tsx`
- Create: `src/components/PartGlyph.test.tsx`
- Modify: `src/pages/ExplorerPage.tsx`
- Modify: `src/pages/ExplorerPage.test.tsx`
- Modify: `src/components/LearningGuide.tsx`
- Modify: `src/components/LearningGuide.test.tsx`
- Modify: `src/components/StageTimeline.tsx`
- Modify: `src/components/PartNavigator.tsx`
- Modify: `src/components/KnowledgePanel.tsx`
- Create: `src/components/KnowledgePanel.test.tsx`

- [ ] **Step 1: Write failing component contracts**

```tsx
expect(toggle).toHaveAttribute('aria-expanded', 'false')
expect(panel).toHaveAttribute('hidden')
expect(screen.getByRole('navigation', { name: '拆解步骤' })).toBeInTheDocument()
expect(screen.getByRole('group', { name: '结构零件' })).toBeInTheDocument()
expect(screen.getAllByRole('button', { name: /视角|旋转|拉近|拉远|聚焦/ })).toHaveLength(5)
expect(screen.getByTestId('knowledge-part-glyph')).toHaveAttribute('data-accent', selected.accent)
```

Explorer tests must prove one visible stage question, selecting a part opens Inspector without stealing focus, reset closes it, and rail links still scroll then focus stable IDs.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/components/ExplorerInspector.test.tsx src/components/JourneyBar.test.tsx src/components/CameraControls.test.tsx src/components/KnowledgePanel.test.tsx src/pages/ExplorerPage.test.tsx`

Expected: FAIL because the new components and contracts do not exist.

- [ ] **Step 3: Implement controlled UI components**

`ExplorerInspector` receives `expanded`, `onExpandedChange`, `children`; `JourneyBar` composes existing timeline/navigator roles; `CameraControls` emits the existing five command types and keeps focus-selected disabled without selection. `PartGlyph` renders a safe abstract cropped line study based on system/accent (not a miniature manufacturable drawing) and is decorative inside the labelled knowledge card.

- [ ] **Step 4: Recompose ExplorerPage**

Keep all state/timers/commands in ExplorerPage. Add non-persisted inspector state. Move the single LearningGuide bubble over the stage, move KnowledgePanel and part list into Inspector, remove the duplicate stage question and separate footer, and render one JourneyBar. Preserve every stage data attribute, safety notice, cycle description link and static fallback.

- [ ] **Step 5: Simplify child components without changing behavior**

StageTimeline shows number/short label only; LearningGuide owns the one question and existing hint/conclusion semantics; KnowledgePanel removes its empty duplicate question, adds PartGlyph plus icon/color-band separation for “史实依据 / 简化示意 / 观察问题”, and retains heading order, source, speech and firearm safety notice.

- [ ] **Step 6: Run GREEN and the complete component suite**

Run: `npm test -- --run src/components src/pages/ExplorerPage.test.tsx`

Expected: PASS; exact roles/names/IDs and all timer lifecycle tests remain green.

- [ ] **Step 7: Commit**

```bash
git add src/components/ExplorerInspector* src/components/JourneyBar* src/components/CameraControls* src/components/PartGlyph* src/components/KnowledgePanel* src/components/LearningGuide* src/components/StageTimeline.tsx src/components/PartNavigator.tsx src/pages/ExplorerPage.tsx src/pages/ExplorerPage.test.tsx
git commit -m "feat: make the exhibit stage the visual anchor"
```

---

### Task 6: Explorer visual system, responsive sheet, and motion choreography

**Files:**
- Modify: `src/styles/explorer.css`
- Modify: `src/styles/global.css`
- Modify: `src/components/FirearmCycleControls.tsx`
- Modify: `src/components/SpeechButton.tsx`
- Modify: `src/components/SceneBoundary.tsx`
- Modify: `src/components/RouteBoundary.tsx`
- Modify: relevant component tests
- Modify: `tests/e2e/firearm-static-clearance.spec.ts`

- [ ] **Step 1: Write failing responsive and class contract tests**

Assert button hierarchy classes, one primary action per guide state, Inspector sheet toggle, Glass fallback class, and stable live-region/error behavior. Rewrite the old tablet “sidebar below stage” E2E expectation to the new inspector/stage clearance contract.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/components src/pages/ExplorerPage.test.tsx`

Expected: FAIL for new class/hierarchy/sheet contracts.

- [ ] **Step 3: Replace fixed chrome with a stage-first grid**

Desktop/1024: compact topbar/rail, stage at least 70% of workspace width and viewport height, Inspector max 30% when open. Guide bubble is the only instructional overlay; modes become segmented control; camera is a lower-right pill; JourneyBar is one rounded glass rail.

- [ ] **Step 4: Implement mobile bottom sheet**

At 390px, Inspector is fixed above the 58px navigation, collapsed by default, max `62dvh`, independently scrollable, 44px minimum touch targets, no horizontal overflow, and at least 8px clearance from static firearm profiles/JourneyBar.

- [ ] **Step 5: Apply global button hierarchy and motion tokens**

Primary brass solid (one visible per state), secondary outline, tertiary/ghost text. Add hover lift and press return, one orchestrated entry sequence, stage-step highlight transitions, and disable all nonessential transforms under `prefers-reduced-motion`. Add forced-colors and no-backdrop-filter fallbacks.

- [ ] **Step 6: Verify focused UI and accessibility tests**

Run: `npm test -- --run src/components src/pages/ExplorerPage.test.tsx && npx playwright test tests/e2e/firearm-static-clearance.spec.ts`

Expected: PASS at tablet; no overlap or hidden safety notice.

- [ ] **Step 7: Commit**

```bash
git add src/styles/explorer.css src/styles/global.css src/components/FirearmCycleControls.tsx src/components/SpeechButton.tsx src/components/SceneBoundary.tsx src/components/RouteBoundary.tsx src/components/*.test.tsx tests/e2e/firearm-static-clearance.spec.ts
git commit -m "style: unify the explorer journey and guide voice"
```

---

### Task 7: Procedural geometry toolkit and interface freeze

**Files:**
- Create: `src/scene/proceduralGeometry.ts`
- Create: `src/scene/proceduralGeometry.test.ts`
- Create: `src/scene/GeometryInstances.tsx`
- Modify: `src/scene/TankModel.test.ts`
- Modify: `src/scene/AircraftModel.test.ts`
- Modify: `src/scene/VesselModel.test.ts`
- Modify: `src/scene/TankScene.test.ts`

- [ ] **Step 1: Freeze existing interfaces in failing/expanded tests**

Hard-code current full focus point and explode offset maps rather than deriving expected values from production constants. Assert exact 11-part parity, six stages, mirrored engines/motors/shafts and assembled focus world targets.

- [ ] **Step 2: Write failing geometry factory tests**

```ts
expectGeometryFinite(createClosedLoftGeometry(validSections))
expect(() => createClosedLoftGeometry(mismatchedSections)).toThrow()
expect(countRadialBlades(createTwistedRadialAssembly(stations, 3))).toBe(3)
expect(radialRadii(createRadialToothPrism(options))).toContainBothRootAndTip()
```

Also reject zero-area triangles, assert finite bounds/sphere, main/bevel normals, exact 120° blade spacing, and explicit dispose.

- [ ] **Step 3: Run RED**

Run: `npm test -- --run src/scene/proceduralGeometry.test.ts src/scene/TankModel.test.ts src/scene/AircraftModel.test.ts src/scene/VesselModel.test.ts src/scene/TankScene.test.ts`

Expected: FAIL because geometry helpers do not exist and interface expectations are not fully locked.

- [ ] **Step 4: Implement bounded pure Three helpers**

Export `createClosedLoftGeometry`, `createRevolvedProfileGeometry`, `createExtrudedProfileGeometry`, `createTwistedRadialAssembly`, `createRadialToothPrism`, `createChamferedBoxGeometry`. Use low segment counts, compute normals/bounds, and never encode real-world dimensions or named airfoils/propeller pitches.

- [ ] **Step 5: Extract reusable instancing**

Move the current Tank instance transform pattern into `GeometryInstances.tsx` without changing instance matrices or selection ownership.

- [ ] **Step 6: Run GREEN and commit**

Run: `npm test -- --run src/scene/proceduralGeometry.test.ts src/scene/TankModel.test.ts src/scene/AircraftModel.test.ts src/scene/VesselModel.test.ts src/scene/TankScene.test.ts`

```bash
git add src/scene/proceduralGeometry* src/scene/GeometryInstances.tsx src/scene/*Model.test.ts src/scene/TankScene.test.ts
git commit -m "feat: add safe procedural silhouette tools"
```

---

### Task 8: Vessel geometry upgrade

**Files:**
- Create: `src/scene/VesselGeometry.ts`
- Modify: `src/scene/VesselModel.tsx`
- Modify: `src/scene/VesselModel.test.ts`

- [ ] **Step 1: Write failing vessel silhouette and budget tests**

Assert midship width exceeds bow/stern, end sheer sits above middle deck edge, chine lies between deck and keel, bounds remain inside the current camera envelope, propeller has three twisted blades, every focus/explode/part id is unchanged, and base draw-call geometry count stays below the documented budget.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/scene/VesselModel.test.ts`

Expected: FAIL against the sphere/cone hull and box propeller.

- [ ] **Step 3: Replace hull and propeller**

Use 8–9 original unitless loft sections to create sheer/chine; use one merged three-blade assembly at each existing propeller pivot. Keep all model positions, principle paths and SpinGroup/reduced-motion behavior.

- [ ] **Step 4: Add credibility details inside existing parts**

Use narrow chamfers for deck/cabin, instanced rail posts, continuous rails, window frames, hatch coamings, rub rail and mast lights. No real hull lines, displacement data, pump layout or manufacturable propeller pitch.

- [ ] **Step 5: Run GREEN, full vessel tests, build, and commit**

Run: `npm test -- --run src/scene/VesselModel.test.ts src/scene/VesselScene.test.ts && npm run build`

```bash
git add src/scene/VesselGeometry.ts src/scene/VesselModel.tsx src/scene/VesselModel.test.ts
git commit -m "feat: sculpt the rescue vessel silhouette"
```

---

### Task 9: Aircraft geometry upgrade

**Files:**
- Create: `src/scene/AircraftGeometry.ts`
- Modify: `src/scene/AircraftModel.tsx`
- Modify: `src/scene/AircraftModel.test.ts`

- [ ] **Step 1: Write failing aircraft silhouette, symmetry, and budget tests**

Assert lathed fuselage closes at both ends, wing profile has nonzero thickness and conservative high aspect ratio, tail is behind main wing, gear contacts are non-collinear, exactly 12 mirrored high-lift and 2 mirrored tip nacelles remain, and triangle/draw-call budgets are bounded.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/scene/AircraftModel.test.ts`

Expected: FAIL against cylinder/cones, flat box wings and per-motor primitive stacks.

- [ ] **Step 3: Replace fuselage, lifting surfaces, and nacelles**

Use an original 9–12 point revolved profile aligned to X; use unnamed rounded profile extrusion for tapered/anhedral geometry; instance the 12 high-lift nacelles and merge each rotor blade assembly. Preserve every existing motor position and phase.

- [ ] **Step 4: Refine tail and landing gear**

Add beveled swept tail surfaces and generic fork/wheel layers at the current contacts. Do not add real X-57 airfoil coordinates, chord/installation angles, propeller pitch, battery internals or control mechanisms.

- [ ] **Step 5: Run GREEN, full aircraft tests, build, and commit**

Run: `npm test -- --run src/scene/AircraftModel.test.ts src/scene/AircraftScene.test.ts && npm run build`

```bash
git add src/scene/AircraftGeometry.ts src/scene/AircraftModel.tsx src/scene/AircraftModel.test.ts
git commit -m "feat: give the electric aircraft a credible airframe"
```

---

### Task 10: Tank geometry upgrade

**Files:**
- Create: `src/scene/TankGeometry.ts`
- Modify: `src/scene/TankModel.tsx`
- Modify: `src/scene/TankModel.test.ts`
- Modify: `src/scene/TankScene.test.ts`

- [ ] **Step 1: Write failing tank silhouette and running-gear tests**

Assert hull has multiple large crease normals and sloped faces, turret profile expands then contracts, road-wheel positions/count and 44 track links per side remain, generic drive wheel alternates root/tip radii, hubs are distinct layers, focus/part/explode contracts remain exact, and geometry budgets are bounded.

- [ ] **Step 2: Run RED**

Run: `npm test -- --run src/scene/TankModel.test.ts src/scene/TankScene.test.ts`

Expected: FAIL against box hull, simple 14-sided turret and plain wheels.

- [ ] **Step 3: Replace hull and turret**

Use original closed loft sections for lower hull, side plates, deck and sloped front/rear; use a low-segment revolved/elliptical turret with narrow bevels. Keep conceptual exterior barrel in the existing turret part and never add breech, rifling, ammunition or fire-control detail.

- [ ] **Step 4: Upgrade running gear and exterior credibility**

Add generic non-real tooth rhythm to the existing drive-wheel location, shared road-wheel rims/hubs, simplified idler spokes and narrow bevels on bogie/periscope housings. Do not change track pitch, wheel coordinates or part groups.

- [ ] **Step 5: Run GREEN, full tank tests, build, and commit**

Run: `npm test -- --run src/scene/TankModel.test.ts src/scene/TankScene.test.ts src/scene/TankPart.test.ts && npm run build`

```bash
git add src/scene/TankGeometry.ts src/scene/TankModel.tsx src/scene/TankModel.test.ts src/scene/TankScene.test.ts
git commit -m "feat: refine the tank exterior silhouette"
```

---

### Task 11: Full browser QA, visual review, performance, documentation

**Files:**
- Create: `tests/e2e/visual-quality.spec.ts`
- Create: `tests/e2e/geometry-silhouette.spec.ts`
- Modify: `tests/e2e/mechanical-atlas.spec.ts`
- Modify: `tests/e2e/firearm-static-clearance.spec.ts`
- Modify: `README.md`
- Modify: `THIRD_PARTY_NOTICES.md`

- [ ] **Step 1: Write browser contracts before final CSS tuning**

At 1440×900, 1024×768, 390×844 assert:

- stage/workspace width and stage/viewport height are at least 70% on desktop/tablet;
- one guide bubble, one JourneyBar, semantic timeline and parts remain;
- Inspector expands/collapses and expands after part selection;
- mobile sheet stays above bottom nav, max 62dvh, no horizontal overflow, visible targets at least 44×44;
- seven routes load, no console/page/http errors, safety notes remain visible;
- constrained path has no composer/shadow path; reduced-motion/static/paused screenshots are pixel-stable;
- hover/selected/xray/principle states create meaningful pixel changes;
- Gallery and Explorer each request no more than 1.25 MiB of font resources.

- [ ] **Step 2: Add canonical visual evidence**

Capture Gallery plus M4/X57/ASR10 and four firearm routes at the three target viewports. `geometry-silhouette.spec.ts` uses fixed restored cameras and reduced motion for three large-machine canvas crops. Use deterministic geometry tests as the primary guard and screenshots as integration evidence.

- [ ] **Step 3: Run focused E2E RED/GREEN loop**

Run: `npx playwright test tests/e2e/visual-quality.spec.ts tests/e2e/geometry-silhouette.spec.ts`

Expected: PASS after only evidence-backed CSS/scene adjustments; do not weaken geometric clearance or accessibility thresholds to hide failures.

- [ ] **Step 4: Run full fresh verification**

```bash
npm test -- --run
npm run build
npm run test:e2e
git diff --check
```

Expected: all tests pass, build budget passes, Playwright has zero failures, and worktree has only intentional tracked changes.

- [ ] **Step 5: Perform screenshot-by-screenshot design review**

Use the design-review skill and actual browser screenshots. Fix every High/Medium finding and all polish blockers; re-run affected tests and recapture evidence after every fix. Explicitly score stage prominence, treasure materiality, single guide voice, child readability, responsiveness, reduced motion, and AI-slop patterns.

- [ ] **Step 6: Update documentation**

README must describe adaptive quality profiles, procedural lighting, postprocessing low-end fallback, shared material states, stage-first UI, programmatic geometry boundaries, font/resource licenses, build budgets, and exact local commands.

- [ ] **Step 7: Final independent reviews and commit**

Run independent full spec compliance, code quality, safety, visual and E2E reviews. Fix and re-review until 0 Critical / 0 Important / 0 unresolved visual blocker.

```bash
git add tests/e2e README.md THIRD_PARTY_NOTICES.md
git commit -m "test: verify the visual quality upgrade end to end"
```

---

## Completion checklist

- [ ] 7 exhibits retain all routes, 6 stages, 11 parts and isolated progress.
- [ ] All normal mechanical parts are opaque; only pending/X-ray teaching states use transparency.
- [ ] Desktop high quality has environment reflection, shadows, AO, selective bloom, outline, SMAA and vignette; constrained has a tested low-cost fallback.
- [ ] No continuous frames remain when reduced motion/static/paused says the scene is still.
- [ ] Explorer stage meets 70% targets and has one guide voice, one journey rail, one primary action.
- [ ] Gallery and Explorer pass AA contrast and 44px touch contracts.
- [ ] Vessel, aircraft and tank silhouettes improve while part/focus/explode and safety contracts remain exact.
- [ ] Font/resource licenses and bundle budgets are documented and enforced.
- [ ] Full unit, build, Playwright, screenshot review and independent reviews pass on the final HEAD.
