# Firearm Cycle Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four complete, safe, museum-style firearm exhibits with procedural cutaways and one-shot mechanical-cycle visualization while preserving all existing exhibits.

**Architecture:** Register four firearm exhibits in the existing content registry, share one lazily loaded configurable `FirearmScene`, and drive all linkage animation from a deterministic pure `firearmCycle` sampler. `ExplorerPage` owns accessible cycle controls and passes optional cycle state through the generic scene interface; non-firearm scenes ignore it.

**Tech Stack:** React 19, TypeScript, Vite, Three.js, React Three Fiber, Drei, Vitest, React Testing Library, Playwright.

---

## File map

- `src/content/firearms.ts`: four six-stage/eleven-part content contracts and firearm configuration metadata.
- `src/content/types.ts`: firearm category, exhibit IDs, shared part IDs, source IDs, and optional mechanical-cycle metadata.
- `src/content/catalog.ts`, `src/content/exhibits.ts`, `src/content/sources.ts`: seven-exhibit registration and traceable source records.
- `src/scene/firearmCycle.ts`: pure phase sampler for bolt, short-recoil, gas-op-rod, and roller-delay mechanisms.
- `src/scene/firearmConfigs.ts`: per-exhibit geometry proportions, focus points, shell IDs, and motion kind.
- `src/scene/MechanicalPart.tsx`: shared selectable/transparent/damped part wrapper.
- `src/scene/FirearmModel.tsx`, `src/scene/FirearmScene.tsx`: configurable procedural geometry and museum scene.
- `src/components/FirearmCycleControls.tsx`: accessible single-cycle playback and step controls.
- `src/components/TankDiagram.tsx`: firearm static SVG variant selected by exhibit.
- `src/pages/GalleryPage.tsx`, `src/styles/gallery.css`: grouped seven-card museum layout.
- `src/pages/ExplorerPage.tsx`, `src/scene/types.ts`, `src/scene/sceneLoaders.ts`: exhibit-aware scene/cycle integration.
- `tests/e2e/mechanical-atlas.spec.ts`: desktop WebGL and tablet/mobile static journeys for all four firearms.

### Task 1: Register firearm content and safety contracts

**Files:**
- Create: `src/content/firearms.ts`
- Modify: `src/content/types.ts`
- Modify: `src/content/sources.ts`
- Modify: `src/content/exhibits.ts`
- Modify: `src/content/catalog.ts`
- Test: `src/content/content.test.ts`

- [ ] **Step 1: Write the failing seven-exhibit content test**

```ts
import { firearmExhibitIds, firearmPartsByExhibit } from './firearms'

it('registers four safe firearm-cycle exhibits', () => {
  expect(Object.keys(exhibits)).toEqual([
    'm4', 'x57', 'asr10', 'm1903', 'm1911a1', 'm1-garand', 'mp5',
  ])
  expect(firearmExhibitIds).toEqual(['m1903', 'm1911a1', 'm1-garand', 'mp5'])

  for (const id of firearmExhibitIds) {
    expect(exhibits[id].category).toBe('firearm')
    expect(exhibits[id].steps).toHaveLength(6)
    expect(exhibits[id].parts).toHaveLength(11)
    expect(exhibits[id].reconstructionNote).toMatch(/惰性示意|非拆装/)
    expect(firearmPartsByExhibit[id]).toHaveLength(11)
  }
})
```

- [ ] **Step 2: Run the content test and confirm RED**

Run: `npm test -- --run src/content/content.test.ts`

Expected: FAIL because `./firearms` and the four exhibit IDs do not exist.

- [ ] **Step 3: Add the closed types and shared firearm part IDs**

```ts
export type Category = 'tank' | 'aircraft' | 'vessel' | 'firearm'
export const exhibitIds = [
  'm4', 'x57', 'asr10', 'm1903', 'm1911a1', 'm1-garand', 'mp5',
] as const

export type FirearmExhibitId = 'm1903' | 'm1911a1' | 'm1-garand' | 'mp5'

export type FirearmPartId =
  | 'firearm-support-shell'
  | 'firearm-receiver-shell'
  | 'firearm-barrel-chamber'
  | 'firearm-breech-member'
  | 'firearm-lock-delay-system'
  | 'firearm-return-drive-system'
  | 'firearm-input-linkage'
  | 'firearm-feed-module'
  | 'firearm-extraction-path'
  | 'firearm-inert-round-path'
  | 'firearm-cycle-indicator'

export type FirearmCycleKind = 'manual-bolt' | 'short-recoil' | 'gas-op-rod' | 'roller-delay'
```

Extend `ExhibitPartId` with `FirearmPartId`, add the ten approved source IDs from the design spec, add `firearm` to `TankDiagramProps['variant']`, and add `cycleKind?: FirearmCycleKind` to `ExhibitDefinition`.

- [ ] **Step 4: Add the four content definitions and source records**

```ts
export const firearmExhibitIds = [
  'm1903', 'm1911a1', 'm1-garand', 'mp5',
] as const satisfies readonly ExhibitId[]

export const firearmCycleKinds = {
  m1903: 'manual-bolt',
  m1911a1: 'short-recoil',
  'm1-garand': 'gas-op-rod',
  mp5: 'roller-delay',
} as const satisfies Record<(typeof firearmExhibitIds)[number], FirearmCycleKind>

export const firearmContentContract = {
  m1903: {
    title: 'M1903 Springfield',
    subtitle: '手动旋转后拉枪机教学剖面',
    labels: ['木质支撑外形', '机匣外壳', '枪管与膛室示意', '旋转枪机体', '闭锁凸笋概念', '枪机柄', '复进与输入能量模块', '内部供弹区', '抽壳与抛壳路径', '惰性示意弹路径', '机械状态指示'],
    sourceId: 'nps-m1903-history',
  },
  m1911a1: {
    title: 'M1911A1',
    subtitle: '枪管短后坐与倾斜闭锁教学剖面',
    labels: ['握把与框架外形', '套筒外壳', '枪管与膛室示意', '套筒往复组件', '倾斜闭锁概念', '复进簧模块', '输入联动模块', '供弹容器示意', '抽壳与抛壳路径', '惰性示意弹路径', '机械状态指示'],
    sourceId: 'smithsonian-m1911a1',
  },
  'm1-garand': {
    title: 'M1 Garand',
    subtitle: '导气操作杆与旋转枪机教学剖面',
    labels: ['木质支撑外形', '机匣外壳', '枪管与膛室示意', '旋转枪机', '导气取能概念', '长操作杆与复进结构', '输入联动模块', '整体弹夹供弹区', '抽壳与抛壳路径', '惰性示意弹路径', '机械状态指示'],
    sourceId: 'nps-springfield-ww2',
  },
  mp5: {
    title: 'HK MP5',
    subtitle: '滚柱延迟反冲教学剖面',
    labels: ['支撑与握持外形', '机匣外壳', '枪管与膛室示意', '枪机头与后部组件', '滚柱延迟概念', '斜面与复进结构', '输入联动模块', '供弹容器示意', '抽壳与抛壳路径', '惰性示意弹路径', '机械状态指示'],
    sourceId: 'hk-mp5-official',
  },
} as const satisfies Record<FirearmExhibitId, {
  title: string
  subtitle: string
  labels: readonly string[]
  sourceId: SourceId
}>
```

Build each exhibit's six `ExploreStep` entries from the shared IDs `whole`, `exterior`, `hull`, `power`, `running`, `details`; zip the eleven `labels` above with the eleven shared firearm part IDs. Each generated record receives an exhibit-specific fact, simplified principle, prompt, source, accent, and explode offset. Every simplified principle that mentions motion must include “惰性示意” or “非拆装顺序”; content tests must reject empty or duplicated filler prose.

- [ ] **Step 5: Register all four exhibits and catalog entries**

```ts
export const firearmExhibits = Object.fromEntries(
  firearmExhibitIds.map((id) => [id, {
    id,
    category: 'firearm' as const,
    title: firearmContentContract[id].title,
    subtitle: firearmContentContract[id].subtitle,
    diagramVariant: 'firearm' as const,
    modelLabel: `${firearmContentContract[id].title} 可交互机械循环教学模型`,
    reconstructionNote: FIREARM_RECONSTRUCTION_NOTE,
    cycleKind: firearmCycleKinds[id],
    steps: firearmStepsByExhibit[id],
    parts: firearmPartsByExhibit[id],
  }]),
) as Record<FirearmExhibitId, ExhibitDefinition>

const firearmSourceUrls = {
  'nps-m1903-history': 'https://www.nps.gov/spar/learn/historyculture/the-1903-springfield-rifle.htm',
  'nps-m1903-production': 'https://www.nps.gov/spar/learn/historyculture/u-s-springfield-model-1903-production.htm',
  'smithsonian-m1911a1': 'https://americanhistory.si.edu/collections/object/nmah_415704',
  'army-browning-m1911': 'https://www.army.mil/article/15705/arming_the_army_john_m_browning',
  'army-firearm-systems': 'https://asc.army.mil/web/news-perseverance-pays-off/',
  'nps-springfield-ww2': 'https://www.nps.gov/articles/springfieldarmoryww2.htm',
  'nps-m1-variations': 'https://www.nps.gov/spar/learn/historyculture/m1-variations.htm',
  'smithsonian-m1': 'https://www.americanhistory.si.edu/collections/object/nmah_418516',
  'hk-mp5-official': 'https://www.heckler-koch.com/en/Products/Military%20and%20Law%20Enforcement/Submachine%20guns/MP5',
  'hk-roller-delay-history': 'https://hk-usa.com/2019/12/03/heckler-koch-launches-the-new-sp5/',
} as const
```

Spread `firearmExhibits` after the three existing records, create seven catalog cards in the same order as `exhibitIds`, and map every URL above to a `MuseumSource` whose license note states that no external media is reused.

- [ ] **Step 6: Run content tests and the full unit suite**

Run: `npm test -- --run src/content/content.test.ts && npm test -- --run`

Expected: both commands PASS; every registered exhibit has six steps, eleven parts, and valid source IDs.

- [ ] **Step 7: Commit the content contract**

```bash
git add src/content
git commit -m "feat: register firearm cycle exhibits"
```

### Task 2: Build the grouped seven-card gallery and static firearm silhouette

**Files:**
- Modify: `src/pages/GalleryPage.tsx`
- Modify: `src/components/CollectionCard.tsx`
- Modify: `src/components/TankDiagram.tsx`
- Modify: `src/styles/gallery.css`
- Test: `src/pages/GalleryPage.test.tsx`

- [ ] **Step 1: Write failing gallery grouping tests**

```tsx
it('groups seven available exhibits into large-machine and firearm labs', () => {
  render(<GalleryPage onExplore={vi.fn()} />)
  expect(screen.getByRole('heading', { name: '陆海空大型机械' })).toBeVisible()
  expect(screen.getByRole('heading', { name: '发射循环实验室' })).toBeVisible()
  expect(screen.getAllByRole('button', { name: /开始探索/ })).toHaveLength(7)
  expect(screen.getByText('COLLECTION 01—07')).toBeVisible()
})
```

- [ ] **Step 2: Run the gallery test and confirm RED**

Run: `npm test -- --run src/pages/GalleryPage.test.tsx`

Expected: FAIL because the two group headings and four buttons are absent.

- [ ] **Step 3: Render catalog groups without duplicating cards**

```tsx
const collectionGroups = [
  { id: 'large-machines', title: '陆海空大型机械', items: catalog.filter((item) => item.category !== 'firearm') },
  { id: 'firearm-lab', title: '发射循环实验室', items: catalog.filter((item) => item.category === 'firearm') },
] as const
```

Render each group as a labelled section containing its own `.collection-grid`; update the hero edition to `COLLECTION 01—07` and the notebook wording to include “不同机构怎样完成一次机械循环？”.

- [ ] **Step 4: Add a safe side-profile firearm SVG**

```tsx
{variant === 'firearm' && (
  <g className="diagram__assembly diagram__assembly--firearm">
    <path className="diagram__teal" d="M92 164h422l54 24-52 28H315l-42 80H194l30-80H92Z" />
    <path className="diagram__ivory" d="M121 174h372v28H121Z" />
    <path className="diagram__brass" d="M260 170h92v39h-92Z" />
    <path className="diagram__oxide" d="M356 178h113v14H356Z" />
    <path className="diagram__linework" d="M116 188h403M276 174v34M315 208l-48 80" />
  </g>
)}
```

Set the accessible label from the active exhibit instead of a single generic weapon name by adding an optional `label` prop to `TankDiagram`.

- [ ] **Step 5: Replace the three-card-only CSS with grouped grids**

```css
.museum-collection-group + .museum-collection-group { margin-top: clamp(4rem, 8vw, 7rem); }
.collection-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: auto; }
.museum-collection-group--firearm .collection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.collection-card--available { grid-column: auto; grid-row: auto; min-height: 34rem; }
@media (max-width: 64rem) { .collection-grid, .museum-collection-group--firearm .collection-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 47.5rem) { .collection-grid, .museum-collection-group--firearm .collection-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Run gallery tests and build**

Run: `npm test -- --run src/pages/GalleryPage.test.tsx && npm run build`

Expected: PASS with seven available actions and no TypeScript errors.

- [ ] **Step 7: Commit the gallery expansion**

```bash
git add src/pages/GalleryPage.tsx src/components/CollectionCard.tsx src/components/TankDiagram.tsx src/styles/gallery.css src/pages/GalleryPage.test.tsx
git commit -m "feat: group the seven-exhibit gallery"
```

### Task 3: Implement the deterministic firearm-cycle sampler

**Files:**
- Create: `src/scene/firearmCycle.ts`
- Create: `src/scene/firearmCycle.test.ts`

- [ ] **Step 1: Write failing pure motion tests**

```ts
it.each([
  ['manual-bolt', 0],
  ['short-recoil', -0.18],
  ['gas-op-rod', -0.44],
  ['roller-delay', -0.12],
] as const)('samples a distinct %s linkage at extraction', (kind, expectedDriveX) => {
  const sample = sampleFirearmCycle(kind, 4, 1)
  expect(sample.driveX).toBeCloseTo(expectedDriveX)
  expect(sample.caseVisible).toBe(true)
})

it('keeps the manual bolt closed until the manual-action phase', () => {
  expect(sampleFirearmCycle('manual-bolt', 2, 1).breechX).toBe(0)
  expect(sampleFirearmCycle('manual-bolt', 3, 1).breechRotation).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run the sampler tests and confirm RED**

Run: `npm test -- --run src/scene/firearmCycle.test.ts`

Expected: FAIL because `sampleFirearmCycle` is not defined.

- [ ] **Step 3: Implement the six-phase sample contract**

```ts
export const FIREARM_CYCLE_PHASES = ['ready', 'energy', 'projectile', 'unlock', 'extract', 'return'] as const

export interface FirearmCycleSample {
  breechX: number
  breechRotation: number
  barrelX: number
  barrelY: number
  driveX: number
  lockAmount: number
  returnCompression: number
  feedLift: number
  caseX: number
  caseY: number
  caseVisible: boolean
  projectileX: number
  projectileVisible: boolean
  energyAmount: number
}

export function sampleFirearmCycle(
  kind: FirearmCycleKind,
  phaseIndex: number,
  phaseProgress: number,
): FirearmCycleSample
```

Clamp phase to `0..5` and progress to `0..1`. Use small normalized teaching offsets only; do not encode real dimensions, timing, pressure, velocity, angles, or ratios.

- [ ] **Step 4: Implement variant-specific phase branches**

```ts
const driveByKind: Record<FirearmCycleKind, number> = {
  'manual-bolt': 0,
  'short-recoil': -0.18,
  'gas-op-rod': -0.44,
  'roller-delay': -0.12,
}
```

At phase 2 move only the inert projectile. At phase 3 express each mechanism's high-level unlock/delay distinction. At phase 4 move the breech and case substitute. At phase 5 return all moving assemblies while lifting the next inert round substitute.

- [ ] **Step 5: Run sampler tests**

Run: `npm test -- --run src/scene/firearmCycle.test.ts`

Expected: PASS, including clamp/reset and all four variant cases.

- [ ] **Step 6: Commit the cycle engine**

```bash
git add src/scene/firearmCycle.ts src/scene/firearmCycle.test.ts
git commit -m "feat: add deterministic firearm cycle sampler"
```

### Task 4: Generalize scene plumbing and part interaction

**Files:**
- Create: `src/scene/MechanicalPart.tsx`
- Create: `src/scene/MechanicalPart.test.ts`
- Modify: `src/scene/types.ts`
- Modify: `src/pages/ExplorerPage.tsx`
- Modify: `src/components/SceneBoundary.tsx`
- Modify: `src/components/SceneBoundary.test.tsx`
- Modify: `src/scene/sceneQuality.ts`

- [ ] **Step 1: Write failing generic contracts**

```ts
it('makes configured shells click-through in xray and principle modes', () => {
  expect(isMechanicalRaycastDisabled('firearm-receiver-shell', 'xray', new Set(['firearm-receiver-shell']))).toBe(true)
  expect(isMechanicalRaycastDisabled('firearm-breech-member', 'xray', new Set(['firearm-receiver-shell']))).toBe(false)
})
```

Add a `SceneBoundary` test that passes `diagramVariant="firearm"` and `diagramLabel="M1911A1 静态结构示意"`, triggers an error, and expects that exact fallback image name.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- --run src/scene/MechanicalPart.test.ts src/components/SceneBoundary.test.tsx`

Expected: FAIL because the generic wrapper and firearm fallback props do not exist.

- [ ] **Step 3: Add optional cycle state to generic scene props**

```ts
export interface ExhibitCycleState {
  phaseIndex: number
  status: 'idle' | 'playing' | 'paused' | 'complete'
  revision: number
}

export interface ExhibitSceneProps {
  exhibitId: ExhibitId
  stepIndex: number
  mode: ExploreMode
  selectedPartId: ExhibitPartId | null
  focusPartId?: ExhibitPartId | null
  autoplay: boolean
  reducedMotion: boolean
  resetToken: number
  cameraCommand?: CameraCommand
  onSelect: (partId: ExhibitPartId) => void
  onReady?: () => void
  cycleState?: ExhibitCycleState
}
```

Pass `exhibitId` and optional `cycleState` from `ExplorerPage`; update existing scene prop types to accept and ignore the new fields.

- [ ] **Step 4: Extract `MechanicalPart` from aircraft/vessel behavior**

```ts
export function isMechanicalRaycastDisabled(
  partId: ExhibitPartId,
  mode: ExploreMode,
  shellIds: ReadonlySet<ExhibitPartId>,
) {
  return shellIds.has(partId) && (mode === 'xray' || mode === 'principle')
}
```

The component must own material disposal, hover cursor cleanup, damping, selection gesture, shell click-through, and `invalidate()` while motion is unsettled. Replace aircraft and vessel wrappers with thin adapters around it and keep their existing tests green.

- [ ] **Step 5: Make scene fallback exhibit-aware**

```tsx
<TankDiagram
  variant={diagramVariant}
  label={diagramLabel}
  className="scene-fallback__diagram"
/>
```

Change `sceneQuality` selection types from the M4-only `PartId` to `ExhibitPartId`.

- [ ] **Step 6: Run focused and full tests**

Run: `npm test -- --run src/scene src/components/SceneBoundary.test.tsx src/pages/ExplorerPage.test.tsx && npm test -- --run`

Expected: PASS with no aircraft, vessel, or M4 regressions.

- [ ] **Step 7: Commit the scene infrastructure**

```bash
git add src/scene src/pages/ExplorerPage.tsx src/components/SceneBoundary.tsx src/components/SceneBoundary.test.tsx
git commit -m "refactor: share mechanical part interaction"
```

### Task 5: Build the configurable procedural firearm scene

**Files:**
- Create: `src/scene/firearmConfigs.ts`
- Create: `src/scene/firearmConfigs.test.ts`
- Create: `src/scene/FirearmModel.tsx`
- Create: `src/scene/FirearmModel.test.ts`
- Create: `src/scene/FirearmScene.tsx`
- Create: `src/scene/FirearmScene.test.ts`
- Modify: `src/scene/sceneLoaders.ts`
- Modify: `src/scene/sceneLoaders.test.ts`

- [ ] **Step 1: Write failing configuration and loader tests**

```ts
it.each(['m1903', 'm1911a1', 'm1-garand', 'mp5'] as const)('covers all parts for %s', (id) => {
  expect(firearmConfigs[id].partIds).toEqual(firearmPartsByExhibit[id].map((part) => part.id))
  expect(firearmConfigs[id].focusPoints.size).toBe(11)
})

it('shares one firearm scene loader', () => {
  expect(getExhibitSceneLoader('m1903')).toBe(getExhibitSceneLoader('mp5'))
})
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- --run src/scene/firearmConfigs.test.ts src/scene/sceneLoaders.test.ts`

Expected: FAIL because configs and loaders are absent.

- [ ] **Step 3: Define geometry configuration and focus points**

```ts
export interface FirearmConfig {
  id: FirearmExhibitId
  cycleKind: FirearmCycleKind
  profile: 'rifle' | 'pistol' | 'compact'
  proportions: { bodyLength: number; barrelLength: number; supportLength: number }
  partIds: readonly FirearmPartId[]
  shellIds: ReadonlySet<FirearmPartId>
  partTransforms: ReadonlyMap<FirearmPartId, {
    position: readonly [number, number, number]
    rotation: readonly [number, number, number]
    scale: readonly [number, number, number]
  }>
  focusPoints: ReadonlyMap<FirearmPartId, readonly [number, number, number]>
}
```

Use normalized visual proportions that clearly differentiate the four silhouettes without copying real manufacturing dimensions. Every `partTransforms` and `focusPoints` map must contain all eleven shared IDs; the configuration test compares both key sets with `partIds`.

- [ ] **Step 4: Build all eleven selectable procedural groups**

`FirearmModel` must render named groups for every shared firearm part ID using boxes, cylinders, rounded boxes, torus/line paths, springs, and translucent inert-round substitutes. Use `MechanicalPart` for selection and explode/xray motion. Apply `sampleFirearmCycle()` only to the movement groups during principle mode.

```tsx
function FirearmPartGeometry({
  id,
  material,
}: {
  id: FirearmPartId
  material: MeshStandardMaterial
}) {
  switch (id) {
    case 'firearm-support-shell':
      return <mesh material={material}><boxGeometry args={[2.4, 0.42, 0.5]} /></mesh>
    case 'firearm-receiver-shell':
      return <mesh material={material}><boxGeometry args={[2.1, 0.6, 0.52]} /></mesh>
    case 'firearm-barrel-chamber':
      return <mesh rotation={[0, 0, Math.PI / 2]} material={material}><cylinderGeometry args={[0.12, 0.12, 3.2, 16]} /></mesh>
    case 'firearm-breech-member':
      return <mesh material={material}><boxGeometry args={[0.82, 0.38, 0.38]} /></mesh>
    case 'firearm-lock-delay-system':
      return <mesh rotation={[Math.PI / 2, 0, 0]} material={material}><torusGeometry args={[0.22, 0.06, 8, 20]} /></mesh>
    case 'firearm-return-drive-system':
      return <mesh rotation={[0, 0, Math.PI / 2]} material={material}><cylinderGeometry args={[0.07, 0.07, 1.15, 12]} /></mesh>
    case 'firearm-input-linkage':
      return <mesh material={material}><boxGeometry args={[0.5, 0.28, 0.22]} /></mesh>
    case 'firearm-feed-module':
      return <mesh material={material}><boxGeometry args={[0.54, 0.92, 0.42]} /></mesh>
    case 'firearm-extraction-path':
      return <mesh material={material}><boxGeometry args={[1.05, 0.04, 0.04]} /></mesh>
    case 'firearm-inert-round-path':
      return <mesh rotation={[0, 0, Math.PI / 2]} material={material}><capsuleGeometry args={[0.09, 0.36, 6, 12]} /></mesh>
    case 'firearm-cycle-indicator':
      return <mesh material={material}><sphereGeometry args={[0.12, 12, 8]} /></mesh>
  }
}

<group name={`firearm-model-${exhibitId}`} scale={config.profile === 'pistol' ? 1.25 : 0.92}>
  {config.partIds.map((id) => (
    <group
      key={id}
      position={config.partTransforms.get(id)?.position}
      rotation={config.partTransforms.get(id)?.rotation}
      scale={config.partTransforms.get(id)?.scale}
    >
      <MechanicalPart
        definition={partsById[id]}
        shellIds={config.shellIds}
        {...partProps}
      >
        {(material) => <FirearmPartGeometry id={id} material={material} />}
      </MechanicalPart>
    </group>
  ))}
</group>
```

Do not include real fasteners, chamber dimensions, trigger/sear contact surfaces, ammunition internals, sights, or assembly tooling.

- [ ] **Step 5: Build the museum scene and demand-loop behavior**

```tsx
<Canvas
  aria-label={exhibit.modelLabel}
  role="img"
  frameloop={mode === 'principle' && cycleState?.status === 'playing' && !reducedMotion ? 'always' : 'demand'}
  camera={{ position: [6.8, 3.2, 7.6], fov: 36, near: 0.1, far: 80 }}
>
```

Include museum lights, floor, orbit controls, camera commands, focus targets, ready callback, and cursor cleanup matching the existing aircraft/vessel scenes.

- [ ] **Step 6: Register one shared loader for four IDs**

```ts
const loadFirearmScene: ExhibitSceneLoader = () => import('./FirearmScene')

m1903: loadFirearmScene,
m1911a1: loadFirearmScene,
'm1-garand': loadFirearmScene,
mp5: loadFirearmScene,
```

- [ ] **Step 7: Run model, scene, loader, and build checks**

Run: `npm test -- --run src/scene/FirearmModel.test.ts src/scene/FirearmScene.test.ts src/scene/firearmConfigs.test.ts src/scene/sceneLoaders.test.ts && npm run build`

Expected: PASS; build emits one firearm scene chunk plus the shared Three.js chunk.

- [ ] **Step 8: Commit the procedural scene**

```bash
git add src/scene
git commit -m "feat: add configurable firearm scenes"
```

### Task 6: Add accessible single-cycle controls and static fallback

**Files:**
- Create: `src/components/FirearmCycleControls.tsx`
- Create: `src/components/FirearmCycleControls.test.tsx`
- Modify: `src/pages/ExplorerPage.tsx`
- Modify: `src/pages/ExplorerPage.test.tsx`
- Modify: `src/styles/explorer.css`

- [ ] **Step 1: Write failing cycle-control behavior tests**

```tsx
it('plays one cycle, pauses, steps, and completes without looping', async () => {
  vi.useFakeTimers()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<ExplorerPage exhibitId="m1911a1" forceStatic onExit={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: '原理模式' }))
  await user.click(screen.getByRole('button', { name: '播放一次机械循环' }))
  expect(screen.getByText(/循环阶段 1 \/ 6/)).toBeVisible()
  await vi.advanceTimersByTimeAsync(4_800)
  expect(screen.getByText(/循环阶段 6 \/ 6/)).toBeVisible()
  expect(screen.getByRole('button', { name: '再次播放机械循环' })).toBeVisible()
  vi.useRealTimers()
})

it('uses manual cycle stepping when reduced motion is enabled', async () => {
  const user = userEvent.setup()
  render(
    <FirearmCycleControls
      cycleState={{ phaseIndex: 0, status: 'idle', revision: 0 }}
      reducedMotion
      onPlay={vi.fn()}
      onPause={vi.fn()}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onReset={vi.fn()}
    />,
  )
  expect(screen.getByRole('button', { name: '播放一次机械循环' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '下一循环阶段' }))
  expect(screen.getByRole('button', { name: '下一循环阶段' })).toBeEnabled()
})
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- --run src/components/FirearmCycleControls.test.tsx src/pages/ExplorerPage.test.tsx`

Expected: FAIL because firearm cycle controls are absent.

- [ ] **Step 3: Implement the controlled six-phase state**

```ts
const initialCycleState: ExhibitCycleState = { phaseIndex: 0, status: 'idle', revision: 0 }

function advanceCycle(state: ExhibitCycleState): ExhibitCycleState {
  if (state.phaseIndex >= 5) return { ...state, status: 'complete' }
  return { ...state, phaseIndex: state.phaseIndex + 1 }
}
```

Use one 800ms timer only while status is `playing`; clear it on pause, step change, mode change, reset, exhibit unmount, reduced-motion change, and completion. Increment `revision` when replaying or resetting so the scene can reset phase progress.

- [ ] **Step 4: Render accessible controls only for firearm exhibits in principle mode**

```tsx
{state.mode === 'principle' && (
  exhibit.cycleKind ? (
    <FirearmCycleControls
      cycleState={cycleState}
      reducedMotion={state.reducedMotion}
      onPlay={handleCyclePlay}
      onPause={handleCyclePause}
      onPrevious={handleCyclePrevious}
      onNext={handleCycleNext}
      onReset={handleCycleReset}
    />
  ) : (
    <button
      type="button"
      aria-pressed={state.autoplay}
      disabled={state.reducedMotion}
      onClick={() => dispatch({ type: 'toggle-autoplay' })}
    >
      {state.autoplay ? '暂停原理' : '播放原理'}
    </button>
  )
)}
```

Add `data-cycle-state` and `data-cycle-phase` to the stage and a polite status line with the six approved phase descriptions. For firearm exhibits, replace the generic “原理动画” status text with the mechanical-cycle status so the page never shows two competing playback controls.

- [ ] **Step 5: Connect the static SVG to exhibit title and current phase**

Pass `label={`${exhibit.title} 静态结构示意`}` and firearm phase data to `TankDiagram`. Show a static “惰性示意弹 / 非拆装顺序” legend in firearm fallback mode.

- [ ] **Step 6: Add responsive controls**

```css
.firearm-cycle-controls { display: grid; grid-template-columns: repeat(5, minmax(0, auto)); gap: .5rem; }
.firearm-cycle-controls button { min-width: 44px; min-height: 44px; }
@media (max-width: 47.5rem) { .firearm-cycle-controls { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
```

- [ ] **Step 7: Run focused, full, and build checks**

Run: `npm test -- --run src/components/FirearmCycleControls.test.tsx src/pages/ExplorerPage.test.tsx && npm test -- --run && npm run build`

Expected: PASS; continuous play is unavailable under reduced motion and existing principle controls still work.

- [ ] **Step 8: Commit the cycle UI**

```bash
git add src/components/FirearmCycleControls.tsx src/components/FirearmCycleControls.test.tsx src/pages/ExplorerPage.tsx src/pages/ExplorerPage.test.tsx src/styles/explorer.css src/components/TankDiagram.tsx
git commit -m "feat: add accessible firearm cycle controls"
```

### Task 7: Extend routes, storage, and complete browser journeys

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/experience/storage.test.ts`
- Modify: `tests/e2e/mechanical-atlas.spec.ts`

- [ ] **Step 1: Add failing route and storage-isolation cases**

```ts
it.each([
  ['m1903', 'M1903 Springfield 静态结构示意'],
  ['m1911a1', 'M1911A1 静态结构示意'],
  ['m1-garand', 'M1 Garand 静态结构示意'],
  ['mp5', 'HK MP5 静态结构示意'],
] as const)('opens %s with no-webgl', async (id, label) => {
  window.location.hash = `#/explore/${id}?no-webgl=1`
  render(<App />)
  expect(await screen.findByRole('img', { name: label })).toBeVisible()
})
```

Add storage expectations for four distinct keys and reload behavior.

- [ ] **Step 2: Run app and storage tests and confirm RED**

Run: `npm test -- --run src/app/App.test.tsx src/experience/storage.test.ts`

Expected: FAIL until route labels and storage IDs are fully connected.

- [ ] **Step 3: Fix route/static/storage integration minimally**

Keep the expanded `exhibitIds` as the single route and storage source of truth; do not add a second firearm ID list to either module. Preserve exact hash matching so `#/explore/mp5-extra` remains unsupported.

```ts
export const supportedExhibitIds = exhibitIds

const progressKey = (exhibitId: ExhibitId) =>
  `mechanical-atlas-progress:${exhibitId}`

const isExhibitId = (value: string): value is ExhibitId =>
  exhibitIds.some((exhibitId) => exhibitId === value)
```

- [ ] **Step 4: Add desktop firearm WebGL E2E table**

```ts
const firearmExhibits = [
  { id: 'm1903', title: 'M1903 Springfield' },
  { id: 'm1911a1', title: 'M1911A1' },
  { id: 'm1-garand', title: 'M1 Garand' },
  { id: 'mp5', title: 'HK MP5' },
] as const
```

For every entry: enter from gallery, assert Canvas label, click a visible hotspot, switch explode/xray/principle, play and observe phase increase plus changing pixels, pause and compare identical frames, complete without looping, focus a part, reload progress, reset, and return to gallery. Keep browser console/page/http issue collection at zero.

- [ ] **Step 5: Add tablet/mobile static and reduced-motion journeys**

At 1024×768 and 390×844, visit each firearm with `?no-webgl=1`, traverse all six stages, select the final part, step through all six cycle phases under reduced motion, assert no page horizontal overflow, and save screenshots named `<id>-tablet-static-1024x768.png` and `<id>-mobile-static-390x844.png`.

- [ ] **Step 6: Run focused tests and Playwright**

Run: `npm test -- --run src/app/App.test.tsx src/experience/storage.test.ts && npm run test:e2e`

Expected: unit tests PASS and Playwright desktop/tablet/mobile projects all PASS with zero browser issues.

- [ ] **Step 7: Commit the browser journeys**

```bash
git add src/app/App.test.tsx src/experience/storage.test.ts tests/e2e/mechanical-atlas.spec.ts
git commit -m "test: verify firearm exhibit journeys"
```

### Task 8: Documentation, visual audit, independent review, and completion

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README to match the safe shipped behavior**

```md
- 四件枪械展品使用惰性示意弹和抽象能量脉冲解释单次机械循环。
- 不提供真实弹药内部、尺寸公差、拆装、射击、排障、改装、弹道或杀伤信息。
- 连续播放默认关闭，每次只运行一个循环；减少动态模式使用逐阶段查看。
```

Document all seven routes, the shared firearm scene architecture, source boundaries, and commands for unit/E2E verification.

- [ ] **Step 2: Run fresh final verification**

Run: `npm test -- --run && npm run build && npm run test:e2e`

Expected: all Vitest files/tests pass, TypeScript and Vite build pass, all Playwright projects pass, and browser issue arrays are empty.

- [ ] **Step 3: Inspect the actual screenshots**

Open every new desktop/tablet/mobile screenshot with the image viewer. Confirm: no clipped text, overlap, blank Canvas, obvious geometry collision, horizontal overflow, undersized controls, low contrast, muzzle-facing-view, combat HUD, or realistic ammunition interior.

- [ ] **Step 4: Run independent spec compliance review**

Provide the reviewer the design spec, implementation plan, and complete feature diff from `9aef383`. Require explicit findings for missing requirements, unsafe overreach, incorrect historical claims, and unrequested features. Fix every reported Critical or Important issue, then re-run the focused test and request re-review.

- [ ] **Step 5: Run independent code quality review**

Review the final diff for type safety, render-loop performance, geometry/material disposal, stale timers, event cleanup, duplicate scene logic, inaccessible controls, brittle E2E selectors, and source traceability. Fix all Important issues and request re-review until approved.

- [ ] **Step 6: Re-run final verification after review fixes**

Run: `npm test -- --run && npm run build && npm run test:e2e && git diff --check && git status --short`

Expected: all commands pass; diff check is clean; only intentional tracked changes remain.

- [ ] **Step 7: Commit documentation and final review fixes**

```bash
git add README.md docs src tests playwright.config.ts
git commit -m "docs: document firearm cycle laboratory"
```

- [ ] **Step 8: Finish the development branch**

Use `superpowers:finishing-a-development-branch`: present verified integration options, merge to `main` only with the user's existing authorization, rerun the full verification on `main`, and remove the feature worktree/branch after the merge succeeds.
