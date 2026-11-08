# Mechanical Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, child-friendly 3D mechanical museum web app with a complete six-step M4-style tank exploration and expandable aircraft/ship catalog previews.

**Architecture:** The React application separates museum content, deterministic experience state, DOM interface, and Three.js scene rendering. A reducer is the single source of truth for step, mode, selection, and load status; the 3D scene consumes stable part definitions, while a complete DOM/SVG fallback preserves the learning path without WebGL.

**Tech Stack:** Vite 8, React 19, TypeScript 7, Three.js, React Three Fiber, Drei, Vitest, React Testing Library, Playwright CLI.

---

## Planned file map

```text
index.html                         Vite document shell and metadata
package.json                       scripts and pinned dependency ranges
tsconfig.json                      strict TypeScript configuration
vite.config.ts                     Vite + Vitest configuration
src/main.tsx                       application bootstrap
src/app/App.tsx                    hash-route composition and lazy explorer loading
src/content/types.ts               content contracts and stable IDs
src/content/sources.ts             curated source registry
src/content/m4.ts                  steps and M4 educational part definitions
src/content/catalog.ts             tank/aircraft/vessel catalog data
src/experience/state.ts            pure reducer and initial state
src/experience/storage.ts          guarded local progress persistence
src/components/TankDiagram.tsx     SVG static/fallback structure diagram
src/components/StageTimeline.tsx   six-step navigation
src/components/KnowledgePanel.tsx  selected-part learning card and sources
src/components/PartNavigator.tsx   keyboard/touch alternative to 3D picking
src/components/SceneBoundary.tsx   loading/error/WebGL gate
src/pages/GalleryPage.tsx          museum catalog landing page
src/pages/ExplorerPage.tsx         reducer-driven explorer layout
src/scene/partMotion.ts            pure explode/opacity calculations
src/scene/TankPart.tsx             shared selectable mesh wrapper
src/scene/TankModel.tsx            procedural grouped tank geometry
src/scene/TankScene.tsx            canvas, camera, lights, controls, hotspots
src/styles/*.css                   Night Museum tokens, gallery, explorer, responsive rules
src/**/*.test.ts(x)                unit and component regression tests
README.md                          operation, controls, sources, license notes
```

## Task 1: Scaffold the strict React/Vite test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`

- [x] **Step 1: Create package and compiler configuration**

Create `package.json`:

```json
{
  "name": "mechanical-atlas",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.6.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "three": "^0.185.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.185.1",
    "@vitejs/plugin-react": "^6.0.3",
    "jsdom": "^29.1.1",
    "typescript": "^7.0.2",
    "vite": "^8.1.4",
    "vitest": "^4.1.10"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

- [x] **Step 2: Write the first failing smoke test**

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

it('introduces the mechanical museum', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: '拆开机械，看见原理' })).toBeInTheDocument()
})
```

- [x] **Step 3: Install and verify RED**

Run:

```bash
npm install
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `src/app/App.tsx` does not exist.

- [x] **Step 4: Implement the smallest bootable app**

```tsx
// src/app/App.tsx
export function App() {
  return <main><h1>拆开机械，看见原理</h1></main>
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/tokens.css'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
```

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="theme-color" content="#071817" /><meta name="description" content="面向少年探索者的 3D 机械结构博物馆" /><title>机械星球 · 3D 结构博物馆</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
```

```css
/* src/styles/tokens.css */
:root {
  --ink-950:#061514; --ink-900:#0a201e; --ink-800:#12312e;
  --ivory-100:#f4ead4; --ivory-300:#d9c8a3; --muted:#8fa39c;
  --brass:#d9ba72; --oxide:#d9794c; --teal:#70aa9e;
  --line:rgb(229 208 159 / 14%);
  --display:"Iowan Old Style","Songti SC",serif;
  --body:"Avenir Next","PingFang SC",sans-serif;
}
```

```css
/* src/styles/global.css */
*{box-sizing:border-box} html{color-scheme:dark;background:var(--ink-950)}
body{margin:0;min-width:320px;min-height:100vh;color:var(--ivory-100);background:var(--ink-950);font-family:var(--body)}
button,a{font:inherit}button{color:inherit}:focus-visible{outline:3px solid var(--brass);outline-offset:3px}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
```

- [x] **Step 5: Verify GREEN and build**

Run `npm test -- src/app/App.test.tsx && npm run build`.

Expected: 1 test passes and Vite creates `dist/` without TypeScript errors.

- [x] **Step 6: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src
git commit -m "chore: scaffold mechanical atlas app"
```

## Task 2: Define traceable museum content before UI work

**Files:**
- Create: `src/content/types.ts`
- Create: `src/content/sources.ts`
- Create: `src/content/m4.ts`
- Create: `src/content/catalog.ts`
- Create: `src/content/content.test.ts`

- [x] **Step 1: Write content integrity tests**

```ts
// src/content/content.test.ts
import { catalog } from './catalog'
import { m4Parts, m4Steps } from './m4'
import { sources } from './sources'

it('offers one complete exhibit and two previews', () => {
  expect(catalog.map((item) => item.category)).toEqual(['tank','aircraft','vessel'])
  expect(catalog.filter((item) => item.status === 'available')).toHaveLength(1)
})

it('defines six ordered stages and traceable parts', () => {
  expect(m4Steps.map((step) => step.id)).toEqual(['whole','exterior','hull','power','running','details'])
  const sourceIds = new Set(sources.map((source) => source.id))
  const stepIds = new Set(m4Steps.map((step) => step.id))
  expect(m4Parts.length).toBeGreaterThanOrEqual(9)
  for (const part of m4Parts) {
    expect(part.summary.length).toBeGreaterThan(20)
    expect(part.prompt.length).toBeGreaterThan(10)
    expect(sourceIds.has(part.sourceId)).toBe(true)
    expect(stepIds.has(part.stepId)).toBe(true)
    expect(part.explodeOffset).toHaveLength(3)
  }
})
```

- [x] **Step 2: Run the test and verify RED**

Run `npm test -- src/content/content.test.ts`.

Expected: FAIL because content modules do not exist.

- [x] **Step 3: Implement stable types and source registry**

```ts
// src/content/types.ts
export const stepIds = ['whole','exterior','hull','power','running','details'] as const
export type StepId = typeof stepIds[number]
export type Category = 'tank'|'aircraft'|'vessel'
export type PartId = 'hull-shell'|'turret-shell'|'engine-module'|'transmission-path'|'suspension-left'|'suspension-right'|'track-left'|'track-right'|'crew-space'|'observation-system'|'recoil-concept'
export interface MuseumSource { id:string; title:string; organization:string; url:string; licenseNote:string }
export interface ExploreStep { id:StepId; index:number; label:string; shortLabel:string; question:string }
export interface PartDefinition { id:PartId; label:string; englishLabel:string; system:string; stepId:StepId; summary:string; prompt:string; sourceId:string; accent:'brass'|'oxide'|'teal'; explodeOffset:readonly[number,number,number]; dimAfterStep?:number }
export interface CatalogItem { id:string; category:Category; eyebrow:string; title:string; subtitle:string; description:string; status:'available'|'preview'; silhouette:Category; facts:readonly string[] }
```

```ts
// src/content/sources.ts
import type { MuseumSource } from './types'
export const sources:readonly MuseumSource[] = [
  {id:'m4-cutaway',title:'M4A4 cutaway drawing',organization:'Wikimedia Commons / U.S. Government',url:'https://commons.wikimedia.org/wiki/File:M4A4_cutaway.png',licenseNote:'Public-domain historical reference; the model is an educational reconstruction.'},
  {id:'smithsonian-open',title:'Smithsonian Open Access',organization:'Smithsonian Institution',url:'https://www.si.edu/openaccess/faq',licenseNote:'Open-access research and future 3D asset reference.'},
  {id:'nasa-3d',title:'NASA 3D Resources',organization:'NASA',url:'https://science.nasa.gov/3d-resources/',licenseNote:'Aircraft research; NASA media and identity rules still apply.'},
  {id:'maritime-cc0',title:'Scottish Maritime Museum CC0 collection',organization:'Scottish Maritime Museum',url:'https://sketchfab.com/ScottishMaritimeMuseum/collections/scottish-maritime-museum-cc0-b367fa03fcea40279a5470eea7872709',licenseNote:'CC0 maritime research; audit individual assets before bundling.'}
] as const
```

- [x] **Step 4: Implement all six steps and eleven part cards**

Create `src/content/m4.ts` using the exact IDs above. Each of the eleven parts must include child-readable Chinese `summary` and `prompt`, source `m4-cutaway`, a functional accent, and these offsets:

```ts
import type { ExploreStep, PartDefinition, PartId } from './types'

export const m4Steps = [
  {id:'whole',index:0,label:'观察整体',shortLabel:'整体',question:'哪些形状帮助这台机械跨过不平整地面？'},
  {id:'exterior',index:1,label:'外部结构',shortLabel:'外部',question:'车体、炮塔和履带分别承担什么任务？'},
  {id:'hull',index:2,label:'打开车体',shortLabel:'车体',question:'有限空间里，乘员与机械怎样分区？'},
  {id:'power',index:3,label:'动力传递',shortLabel:'动力',question:'旋转怎样从发动机一路到达驱动轮？'},
  {id:'running',index:4,label:'悬挂与行走',shortLabel:'行走',question:'为什么履带不是直接固定在车体上？'},
  {id:'details',index:5,label:'关键零件',shortLabel:'零件',question:'观察、缓冲和支撑系统如何协同？'}
] as const satisfies readonly ExploreStep[]

const offsets:Record<PartId,readonly[number,number,number]> = {
  'hull-shell':[0,.35,0], 'turret-shell':[0,1.4,0], 'engine-module':[-1.1,.25,0],
  'transmission-path':[0,-.45,0], 'suspension-left':[0,0,1.1], 'suspension-right':[0,0,-1.1],
  'track-left':[0,-.2,1.65], 'track-right':[0,-.2,-1.65], 'crew-space':[.2,.7,0],
  'observation-system':[.55,1.05,.45], 'recoil-concept':[1.15,.95,0]
}

export const m4Parts: readonly PartDefinition[] = [
  {id:'hull-shell',label:'车体外壳',englishLabel:'Hull shell',system:'承载与防护',stepId:'exterior',summary:'车体像一只坚固的盒子，把动力、传动与乘员空间组织在同一副承载结构中。',prompt:'为什么动力舱附近需要更多通风空间？',sourceId:'m4-cutaway',accent:'brass',explodeOffset:offsets['hull-shell'],dimAfterStep:3},
  {id:'turret-shell',label:'炮塔与旋转环',englishLabel:'Turret and ring',system:'旋转平台',stepId:'exterior',summary:'炮塔安装在大直径旋转环上，使上部观察平台能够改变方向。模型只解释空间关系。',prompt:'如果旋转环太小，内部空间会怎样变化？',sourceId:'m4-cutaway',accent:'brass',explodeOffset:offsets['turret-shell']},
  {id:'engine-module',label:'星形发动机',englishLabel:'Radial engine',system:'动力系统',stepId:'power',summary:'发动机把燃料中的能量转成旋转运动，再交给传动系统。抽象气缸排列帮助理解能量来源。',prompt:'气缸围成一圈，对缩短发动机长度有什么帮助？',sourceId:'m4-cutaway',accent:'oxide',explodeOffset:offsets['engine-module']},
  {id:'transmission-path',label:'传动路径',englishLabel:'Transmission path',system:'动力系统',stepId:'power',summary:'传动系统调整旋转的速度与方向，并把动力送到驱动轮。发光路径只表示能量流向。',prompt:'动力从后部到驱动轮，要经过怎样的车内路径？',sourceId:'m4-cutaway',accent:'oxide',explodeOffset:offsets['transmission-path']},
  {id:'suspension-left',label:'左侧悬挂',englishLabel:'Left suspension',system:'行走系统',stepId:'running',summary:'悬挂允许负重轮上下移动，减少起伏直接传给车体的冲击，多个单元共同分担重量。',prompt:'如果轮子不能上下移动，越过凸起时会怎样？',sourceId:'m4-cutaway',accent:'teal',explodeOffset:offsets['suspension-left']},
  {id:'suspension-right',label:'右侧悬挂',englishLabel:'Right suspension',system:'行走系统',stepId:'running',summary:'左右悬挂分别贴合地形，使履带尽量保持接触。模型把成组轮架做成观察模块。',prompt:'为什么左右两侧需要独立响应地面变化？',sourceId:'m4-cutaway',accent:'teal',explodeOffset:offsets['suspension-right']},
  {id:'track-left',label:'左侧履带',englishLabel:'Left track',system:'行走系统',stepId:'running',summary:'许多履带板首尾连接成连续接触面，把整车重量分散到更大范围的地面。',prompt:'接触面积变大时，松软地面承受的平均压力怎样变化？',sourceId:'m4-cutaway',accent:'teal',explodeOffset:offsets['track-left']},
  {id:'track-right',label:'右侧履带',englishLabel:'Right track',system:'行走系统',stepId:'running',summary:'驱动轮拉动履带循环移动，负重轮在履带铺成的路径上前进，形成连续行走关系。',prompt:'履带运动时，哪一段相对地面最接近静止？',sourceId:'m4-cutaway',accent:'teal',explodeOffset:offsets['track-right']},
  {id:'crew-space',label:'乘员空间',englishLabel:'Crew space',system:'内部布局',stepId:'hull',summary:'半透明体积展示人在机械之间需要的活动空间，帮助理解大型车辆内部为何仍然紧凑。',prompt:'哪些机械结构最容易占用人的转身空间？',sourceId:'m4-cutaway',accent:'teal',explodeOffset:offsets['crew-space']},
  {id:'observation-system',label:'观察系统',englishLabel:'Observation system',system:'观察与协作',stepId:'details',summary:'观察装置让乘员在受保护的位置了解外部方向。发光线只表示视线关系。',prompt:'为什么需要朝向不同方向的多个观察位置？',sourceId:'m4-cutaway',accent:'brass',explodeOffset:offsets['observation-system']},
  {id:'recoil-concept',label:'后坐缓冲示意',englishLabel:'Recoil damping concept',system:'缓冲结构',stepId:'details',summary:'简化滑动组件只说明快速运动被缓冲并平稳复位的机械概念，不展示构造参数。',prompt:'把一次猛烈运动延长到更长时间，峰值冲击通常怎样变化？',sourceId:'m4-cutaway',accent:'oxide',explodeOffset:offsets['recoil-concept']}
]
```

Content safety rule: describe energy, support, observation, space, and damping only; include no dimensions, tolerances, ammunition internals, fire-control data, manufacturing, modification, or operating instructions.

- [x] **Step 5: Implement catalog previews**

```ts
// src/content/catalog.ts
import type { CatalogItem } from './types'
export const catalog:readonly CatalogItem[] = [
  {id:'m4',category:'tank',eyebrow:'ARMORED SYSTEM · 1942',title:'M4 中型坦克',subtitle:'从动力舱到履带',description:'沿六个观察阶段，理解承载、动力、传动和行走系统如何共同工作。',status:'available',silhouette:'tank',facts:['11 个结构热点','6 段拆解导览','约 12 分钟']},
  {id:'x57',category:'aircraft',eyebrow:'ELECTRIC AIRCRAFT · PREVIEW',title:'X-57 电动飞机',subtitle:'机翼上的能量实验',description:'后续将依据 NASA 开放资料解释分布式电推进与机翼关系。',status:'preview',silhouette:'aircraft',facts:['NASA 资料路线','开放资产研究中']},
  {id:'asr10',category:'vessel',eyebrow:'RESCUE CRAFT · PREVIEW',title:'ASR-10 救援艇',subtitle:'船体里的系统协作',description:'后续将依据海事博物馆 CC0 资料解释船体、动力与舵系。',status:'preview',silhouette:'vessel',facts:['CC0 资料路线','开放资产研究中']}
] as const
```

- [x] **Step 6: Verify and commit content**

Run `npm test -- src/content/content.test.ts`.

Expected: 2 tests pass.

```bash
git add src/content
git commit -m "feat: add traceable museum content"
```

## Task 3: Build deterministic exploration state and persistence

**Files:**
- Create: `src/experience/state.ts`
- Create: `src/experience/state.test.ts`
- Create: `src/experience/storage.ts`
- Create: `src/experience/storage.test.ts`

- [x] **Step 1: Write state and storage tests**

```ts
// src/experience/state.test.ts
import { createInitialState, experienceReducer } from './state'
it('clamps navigation and resets', () => {
  let state=createInitialState(false)
  for(let i=0;i<8;i+=1) state=experienceReducer(state,{type:'next-step'})
  expect(state.stepIndex).toBe(5)
  state=experienceReducer(state,{type:'select-part',partId:'engine-module'})
  expect(experienceReducer(state,{type:'reset'})).toEqual(createInitialState(false))
})
it('does not autoplay under reduced motion', () => {
  expect(experienceReducer(createInitialState(true),{type:'toggle-autoplay'}).autoplay).toBe(false)
})
```

```ts
// src/experience/storage.test.ts
import { loadProgress, saveProgress } from './storage'
beforeEach(()=>localStorage.clear())
it('recovers from corrupt progress',()=>{localStorage.setItem('mechanical-atlas-progress','{broken');expect(loadProgress()).toBe(0)})
it('stores only valid steps',()=>{saveProgress(4);expect(loadProgress()).toBe(4);localStorage.setItem('mechanical-atlas-progress',JSON.stringify({stepIndex:99}));expect(loadProgress()).toBe(0)})
```

- [x] **Step 2: Run and verify RED**

Run `npm test -- src/experience`.

Expected: FAIL because state/storage modules do not exist.

- [x] **Step 3: Implement reducer and guarded storage**

```ts
// src/experience/state.ts
import type { PartId } from '../content/types'
export type ExploreMode='explode'|'xray'|'principle'
export interface ExperienceState { stepIndex:number; selectedPartId:PartId|null; mode:ExploreMode; autoplay:boolean; reducedMotion:boolean; sceneStatus:'loading'|'ready'|'error' }
export type ExperienceAction={type:'go-to-step';stepIndex:number}|{type:'next-step'}|{type:'previous-step'}|{type:'select-part';partId:PartId}|{type:'set-mode';mode:ExploreMode}|{type:'toggle-autoplay'}|{type:'scene-status';status:ExperienceState['sceneStatus']}|{type:'reset'}
const clamp=(value:number)=>Math.max(0,Math.min(5,value))
export const createInitialState=(reducedMotion:boolean,stepIndex=0):ExperienceState=>({stepIndex:clamp(stepIndex),selectedPartId:null,mode:'explode',autoplay:false,reducedMotion,sceneStatus:'loading'})
export function experienceReducer(state:ExperienceState,action:ExperienceAction):ExperienceState {
  switch(action.type){
    case'go-to-step':return{...state,stepIndex:clamp(action.stepIndex),selectedPartId:null}
    case'next-step':return{...state,stepIndex:clamp(state.stepIndex+1),selectedPartId:null}
    case'previous-step':return{...state,stepIndex:clamp(state.stepIndex-1),selectedPartId:null}
    case'select-part':return{...state,selectedPartId:action.partId}
    case'set-mode':return{...state,mode:action.mode,autoplay:false}
    case'toggle-autoplay':return state.reducedMotion?state:{...state,autoplay:!state.autoplay}
    case'scene-status':return{...state,sceneStatus:action.status}
    case'reset':return createInitialState(state.reducedMotion)
  }
}
```

```ts
// src/experience/storage.ts
const key='mechanical-atlas-progress'
export function loadProgress(){try{const value=JSON.parse(localStorage.getItem(key)??'null') as {stepIndex?:unknown}|null;return typeof value?.stepIndex==='number'&&Number.isInteger(value.stepIndex)&&value.stepIndex>=0&&value.stepIndex<=5?value.stepIndex:0}catch{return 0}}
export function saveProgress(stepIndex:number){if(Number.isInteger(stepIndex)&&stepIndex>=0&&stepIndex<=5)localStorage.setItem(key,JSON.stringify({stepIndex}))}
```

- [x] **Step 4: Verify GREEN and commit**

Run `npm test -- src/experience`.

Expected: 4 tests pass.

```bash
git add src/experience
git commit -m "feat: add deterministic exploration state"
```

## Task 4: Build the museum gallery and URL navigation

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Create: `src/components/BrandMark.tsx`
- Create: `src/components/CollectionCard.tsx`
- Create: `src/components/TankDiagram.tsx`
- Create: `src/pages/GalleryPage.tsx`
- Create: `src/pages/GalleryPage.test.tsx`
- Create: `src/styles/gallery.css`

- [x] **Step 1: Write gallery and route tests**

```tsx
// src/pages/GalleryPage.test.tsx
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {GalleryPage} from './GalleryPage'
it('opens the available collection and leaves previews disabled',async()=>{
  const onExplore=vi.fn();render(<GalleryPage onExplore={onExplore}/>)
  expect(screen.getAllByText('即将开放')).toHaveLength(2)
  await userEvent.click(screen.getByRole('button',{name:'开始探索 M4 中型坦克'}))
  expect(onExplore).toHaveBeenCalledWith('m4')
})
```

```tsx
// replace src/app/App.test.tsx
import {act,render,screen} from '@testing-library/react'
import {App} from './App'
it('responds to the explorer hash route',async()=>{
  window.location.hash='';render(<App/>)
  expect(screen.getByRole('heading',{name:/拆开机械.*看见原理/})).toBeInTheDocument()
  await act(async()=>{window.location.hash='#/explore/m4';window.dispatchEvent(new HashChangeEvent('hashchange'))})
  expect(await screen.findByText('正在打开结构探索室…')).toBeInTheDocument()
})
```

- [x] **Step 2: Run and verify RED**

Run `npm test -- src/pages/GalleryPage.test.tsx src/app/App.test.tsx`.

Expected: FAIL because gallery components and routing are missing.

- [x] **Step 3: Implement brand, cards, and gallery composition**

```tsx
// src/components/BrandMark.tsx
export function BrandMark(){return <span className="brand-mark" aria-label="机械星球"><span aria-hidden="true">构</span><b>机械星球</b></span>}
```

```tsx
// src/components/CollectionCard.tsx
import type {CatalogItem} from '../content/types'
import {TankDiagram} from './TankDiagram'
export function CollectionCard({item,onExplore}:{item:CatalogItem;onExplore:(id:string)=>void}){return <article className={`collection-card collection-card--${item.category}`}><div className="collection-card__visual"><TankDiagram variant={item.silhouette} decorative/></div><p className="eyebrow">{item.eyebrow}</p><h2>{item.title}</h2><p className="collection-card__subtitle">{item.subtitle}</p><p>{item.description}</p><ul>{item.facts.map(fact=><li key={fact}>{fact}</li>)}</ul>{item.status==='available'?<button className="primary-button" onClick={()=>onExplore(item.id)} aria-label={`开始探索 ${item.title}`}>开始探索 <span aria-hidden="true">→</span></button>:<span className="preview-label">即将开放</span>}</article>}
```

```tsx
// src/pages/GalleryPage.tsx
import {catalog} from '../content/catalog'
import {BrandMark} from '../components/BrandMark'
import {CollectionCard} from '../components/CollectionCard'
import '../styles/gallery.css'
export function GalleryPage({onExplore}:{onExplore:(id:string)=>void}){return <main className="gallery-page"><header className="gallery-nav"><BrandMark/><a href="#collections">浏览藏品</a></header><section className="gallery-hero"><p className="eyebrow">A MUSEUM OF INNER WORKINGS</p><h1>拆开机械，<br/>看见原理</h1><p>从整体到零件，用双手探索大型机械如何一起工作。</p><a className="hero-link" href="#collections">开始今天的观察 ↓</a></section><section className="collection-grid" id="collections" aria-label="藏品分类">{catalog.map(item=><CollectionCard key={item.id} item={item} onExplore={onExplore}/>)}</section><footer><span>公开史料 · 教育性重建</span><a href="https://commons.wikimedia.org/wiki/File:M4A4_cutaway.png" target="_blank" rel="noreferrer">查看首版史料来源</a></footer></main>}
```

Implement `TankDiagram.tsx` as a project-authored semantic SVG accepting:

```ts
interface TankDiagramProps { variant:'tank'|'aircraft'|'vessel'; decorative?:boolean; className?:string }
```

Use separate `<g>` silhouettes for all three variants. When `decorative` is false, use `role="img"`, `aria-label="M4 中型坦克静态结构示意"`, and a `<title>`.

- [x] **Step 4: Implement hash routing and lazy placeholder**

```tsx
// src/app/App.tsx
import {useEffect,useState} from 'react'
import {GalleryPage} from '../pages/GalleryPage'
const readRoute=()=>window.location.hash.startsWith('#/explore/m4')?'explorer':'gallery'
export function App(){const[route,setRoute]=useState(readRoute);useEffect(()=>{const listener=()=>setRoute(readRoute());window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener)},[]);if(route==='explorer')return <main className="route-loading" aria-live="polite">正在打开结构探索室…</main>;return <GalleryPage onExplore={()=>{window.location.hash='#/explore/m4'}}/>}
```

- [x] **Step 5: Style the Night Museum gallery**

Create `gallery.css` with exact behaviors: layered deep-green radial/grid background; 72–84 px display headline on desktop; asymmetric cards with the M4 card spanning two columns; brass hairlines; oxide hover accent; 44 px controls; single-column below 760 px. Do not use remote images, purple gradients, or generic dashboard chrome.

- [x] **Step 6: Verify and commit**

Run `npm test -- src/pages/GalleryPage.test.tsx src/app/App.test.tsx && npm run build`.

Expected: both test files pass and the build succeeds.

```bash
git add src/app src/components src/pages src/styles/gallery.css
git commit -m "feat: build night museum gallery"
```

## Task 5: Build the reducer-driven explorer DOM before WebGL

**Files:**
- Create: `src/components/StageTimeline.tsx`
- Create: `src/components/KnowledgePanel.tsx`
- Create: `src/components/PartNavigator.tsx`
- Create: `src/components/SpeechButton.tsx`
- Create: `src/pages/ExplorerPage.tsx`
- Create: `src/pages/ExplorerPage.test.tsx`
- Create: `src/styles/explorer.css`
- Modify: `src/app/App.tsx`

- [x] **Step 1: Write explorer behavior tests**

```tsx
// src/pages/ExplorerPage.test.tsx
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {ExplorerPage} from './ExplorerPage'
describe('ExplorerPage',()=>{
  it('moves through stages and resets',async()=>{const user=userEvent.setup();render(<ExplorerPage onExit={vi.fn()} forceStatic/>);await user.click(screen.getByRole('button',{name:'动力：动力传递'}));expect(screen.getByText('04 / 06')).toBeInTheDocument();await user.click(screen.getByRole('button',{name:'复原模型'}));expect(screen.getByText('01 / 06')).toBeInTheDocument()})
  it('selects a part and updates the knowledge card',async()=>{render(<ExplorerPage onExit={vi.fn()} forceStatic/>);await userEvent.click(screen.getByRole('button',{name:'查看星形发动机'}));expect(screen.getByRole('heading',{name:'星形发动机'})).toBeInTheDocument();expect(screen.getByText(/发动机把燃料中的能量转成旋转运动/)).toBeInTheDocument()})
  it('supports keyboard stage navigation',async()=>{render(<ExplorerPage onExit={vi.fn()} forceStatic/>);await userEvent.keyboard('{ArrowRight}{ArrowRight}');expect(screen.getByText('03 / 06')).toBeInTheDocument()})
})
```

- [x] **Step 2: Run and verify RED**

Run `npm test -- src/pages/ExplorerPage.test.tsx`.

Expected: FAIL because explorer components are missing.

- [x] **Step 3: Implement timeline and alternate part navigation**

```tsx
// src/components/StageTimeline.tsx
import {m4Steps} from '../content/m4'
export function StageTimeline({current,onChange}:{current:number;onChange:(index:number)=>void}){return <nav className="stage-timeline" aria-label="拆解步骤"><div className="stage-timeline__meta"><b>拆解进度</b><span>{String(current+1).padStart(2,'0')} / 06</span></div><ol>{m4Steps.map(step=><li key={step.id}><button aria-current={current===step.index?'step':undefined} aria-label={`${step.shortLabel}：${step.label}`} onClick={()=>onChange(step.index)}><span>{String(step.index+1).padStart(2,'0')}</span>{step.shortLabel}<small>{step.question}</small></button></li>)}</ol></nav>}
```

```tsx
// src/components/PartNavigator.tsx
import {m4Parts} from '../content/m4'
import type {PartId} from '../content/types'
export function PartNavigator({selected,onSelect}:{selected:PartId|null;onSelect:(id:PartId)=>void}){return <div className="part-navigator" aria-label="结构零件">{m4Parts.map((part,index)=><button key={part.id} aria-pressed={selected===part.id} aria-label={`查看${part.label}`} onClick={()=>onSelect(part.id)}><span>{String(index+1).padStart(2,'0')}</span>{part.label}</button>)}</div>}
```

- [x] **Step 4: Implement knowledge card and speech control**

`KnowledgePanel` receives `PartDefinition | null` and the active `ExploreStep`. With no selection, render the stage question and “选择一个发光标记”. With a selection, render one `h2`, system tag, English label, summary, prompt, and the matching `sources` link plus “教育性重建 · 非工程图纸”.

```tsx
// src/components/SpeechButton.tsx
export function SpeechButton({text}:{text:string}){const supported='speechSynthesis'in window&&'SpeechSynthesisUtterance'in window;const speak=()=>{window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';window.speechSynthesis.speak(utterance)};return <button type="button" className="quiet-button" disabled={!supported} aria-label={supported?'朗读当前知识卡':'当前浏览器不支持朗读'} onClick={speak}>朗读内容</button>}
```

- [x] **Step 5: Compose `ExplorerPage` with a static stage**

Use this public contract:

```ts
export interface ExplorerPageProps { onExit:()=>void; forceStatic?:boolean }
```

The page owns `useReducer(experienceReducer, ...)`, initializes from `loadProgress()`, persists `stepIndex`, and listens for ArrowLeft, ArrowRight, Escape, and `r`. Render left rail, top breadcrumb, three `aria-pressed` mode buttons, central `TankDiagram`, `PartNavigator`, `KnowledgePanel`, and `StageTimeline`. Changing steps clears selection. Add a visually hidden `aria-live="polite"` announcement.

- [x] **Step 6: Mount explorer lazily in `App`**

```tsx
const ExplorerPage=lazy(()=>import('../pages/ExplorerPage').then(module=>({default:module.ExplorerPage})))
```

Render it in `Suspense` with “正在打开结构探索室…”. `onExit` sets the hash to `#/`.

- [x] **Step 7: Style the approved explorer layout**

Create `explorer.css`: 78 px rail, 78 px top bar, flexible stage, 340 px knowledge panel, 132 px timeline, technical grid and museum spotlight. Below 1050 px stack the panel below the stage. Below 640 px move navigation to a 58 px bottom bar, make step/part controls horizontally scrollable, and show the knowledge card as a non-obscuring bottom sheet. All targets are at least 44 × 44 px.

- [x] **Step 8: Verify and commit**

Run `npm test -- src/pages/ExplorerPage.test.tsx && npm run build`.

Expected: 3 tests pass and build succeeds.

```bash
git add src/app src/components src/pages src/styles/explorer.css
git commit -m "feat: add accessible structure explorer"
```

## Task 6: Add motion rules and the procedural 3D tank

**Files:**
- Create: `src/scene/partMotion.ts`
- Create: `src/scene/partMotion.test.ts`
- Create: `src/scene/TankPart.tsx`
- Create: `src/scene/TankModel.tsx`
- Create: `src/scene/TankScene.tsx`
- Modify: `src/pages/ExplorerPage.tsx`

- [x] **Step 1: Write pure motion tests**

```ts
// src/scene/partMotion.test.ts
import {getPartMotion} from './partMotion'
import {m4Parts} from '../content/m4'
const engine=m4Parts.find(part=>part.id==='engine-module')!
const hull=m4Parts.find(part=>part.id==='hull-shell')!
it('keeps future parts in place',()=>expect(getPartMotion(engine,1,'explode',false).position).toEqual([0,0,0]))
it('moves revealed parts along authored vectors',()=>expect(getPartMotion(engine,3,'explode',false).position).toEqual(engine.explodeOffset))
it('dims outer shells in xray but not selected shells',()=>{expect(getPartMotion(hull,4,'xray',false).opacity).toBeLessThan(.3);expect(getPartMotion(hull,4,'xray',true).opacity).toBeGreaterThan(.7)})
```

- [x] **Step 2: Run and verify RED**

Run `npm test -- src/scene/partMotion.test.ts`.

Expected: FAIL because `getPartMotion` is missing.

- [x] **Step 3: Implement deterministic motion output**

```ts
// src/scene/partMotion.ts
import {m4Steps} from '../content/m4'
import type {PartDefinition} from '../content/types'
import type {ExploreMode} from '../experience/state'
export interface PartMotion { position:readonly[number,number,number]; opacity:number; scale:number; emissiveIntensity:number }
export function getPartMotion(part:PartDefinition,stepIndex:number,mode:ExploreMode,selected:boolean):PartMotion{const reveal=m4Steps.find(step=>step.id===part.stepId)!.index;const shown=stepIndex>=reveal;const position=shown&&mode==='explode'?part.explodeOffset:[0,0,0] as const;const shell=mode==='xray'&&(part.id==='hull-shell'||part.id==='turret-shell');return{position,opacity:selected ? .94 : shell ? .18 : shown ? .82 : .48,scale:selected ? 1.035 : 1,emissiveIntensity:selected ? .42 : .05}}
```

- [x] **Step 4: Implement shared `TankPart` behavior**

`TankPart` accepts `definition`, `stepIndex`, `mode`, `selected`, `reducedMotion`, `onSelect`, and children. It uses `useFrame` to lerp group position/scale and shared material opacity toward `getPartMotion`; reduced-motion assigns targets immediately. Pointer handlers stop propagation, set cursor on hover, and select by stable `PartId`. Never allocate geometries or materials inside `useFrame`.

- [x] **Step 5: Build named procedural geometry groups**

In `TankModel.tsx`, build and wrap these groups: beveled lower/upper hull; low-sided turret and concept-only exterior barrel; nine-cylinder radial engine; shaft and housing transmission; three bogie groups per side; instanced wheels and track links; translucent crew-space volumes; three periscope housings and sight lines; two-cylinder damping concept. Reuse geometries/materials and keep draw calls under roughly 120. No exact dimensions, firing controls, or ammunition structure.

- [x] **Step 6: Compose the canvas**

```tsx
<Canvas dpr={[1,1.6]} camera={{position:[7.8,4.8,8.6],fov:34}} gl={{antialias:true,alpha:true,powerPreference:'high-performance'}}>
  <color attach="background" args={['#0a201e']}/><ambientLight intensity={.9}/>
  <directionalLight position={[5,8,6]} intensity={2.4} color="#f3d9a0"/>
  <pointLight position={[-5,2,-4]} intensity={10} distance={14} color="#4f9a8e"/>
  <TankModel {...props}/><ContactShadows opacity={.34} scale={15} blur={2.4} far={8}/>
  <OrbitControls makeDefault enablePan={false} minDistance={6.5} maxDistance={13} minPolarAngle={.65} maxPolarAngle={1.52}/>
</Canvas>
```

- [x] **Step 7: Mount lazy 3D without removing DOM alternatives**

Lazy-load `TankScene` inside the stage. Keep `PartNavigator` visible for keyboard/touch. Use `forceStatic` or a hash query containing `no-webgl=1` to render `TankDiagram`; otherwise render the canvas. Pass reducer state and stable selection callbacks to both render paths.

- [x] **Step 8: Verify and commit**

Run `npm test -- src/scene/partMotion.test.ts && npm test && npm run build`.

Expected: all tests pass, build succeeds, and Three.js appears only in the explorer lazy chunk.

```bash
git add src/scene src/pages/ExplorerPage.tsx
git commit -m "feat: add procedural explodable tank scene"
```

## Task 7: Add failure handling, narration, and principle mode

**Files:**
- Create: `src/components/SceneBoundary.tsx`
- Create: `src/components/SceneBoundary.test.tsx`
- Modify: `src/components/SpeechButton.tsx`
- Modify: `src/pages/ExplorerPage.tsx`
- Modify: `src/pages/ExplorerPage.test.tsx`
- Modify: `src/scene/TankModel.tsx`

- [x] **Step 1: Write fallback and mode tests**

Add to `ExplorerPage.test.tsx`:

```tsx
it('keeps the complete path when WebGL is forced off',()=>{render(<ExplorerPage onExit={vi.fn()} forceStatic/>);expect(screen.getByRole('img',{name:'M4 中型坦克静态结构示意'})).toBeInTheDocument();expect(screen.getByRole('navigation',{name:'拆解步骤'})).toBeInTheDocument();expect(screen.getByLabelText('结构零件')).toBeInTheDocument()})
it('exposes three pressed-state modes',async()=>{render(<ExplorerPage onExit={vi.fn()} forceStatic/>);const button=screen.getByRole('button',{name:'透视模式'});await userEvent.click(button);expect(button).toHaveAttribute('aria-pressed','true')})
```

Create `SceneBoundary.test.tsx` with a child that throws `new Error('scene failed')`. Expect “3D 展示暂时不可用”, buttons “重新尝试” and “返回藏品大厅”, plus the fallback diagram.

- [x] **Step 2: Run and verify RED**

Run `npm test -- src/components/SceneBoundary.test.tsx src/pages/ExplorerPage.test.tsx`.

Expected: FAIL because the error boundary and complete fallback semantics are missing.

- [x] **Step 3: Implement a resettable scene boundary**

Create a class component with this state and public contract:

```ts
interface Props { children:ReactNode; onExit:()=>void; fallback:ReactNode }
interface State { failed:boolean; retryKey:number }
```

Use `getDerivedStateFromError`. On error, retain the full outer explorer UI and replace only the scene with the fallback, explanation, retry, and exit buttons. Retry clears `failed` and increments `retryKey`, which is applied as the child key.

- [x] **Step 4: Finish mode and reduced-motion behavior**

Implement exactly:

- `explode`: authored offsets apply at/after each part stage.
- `xray`: hull and turret become translucent while internal parts stay readable.
- `principle`: engine hub rotates slowly, transmission path pulses, suspension alternates subtly, and recoil concept performs a short damped translation.
- Pause stops all principle-mode animation.
- Reduced-motion disables autoplay and makes transforms immediate.
- Reset restores step 0, explode mode, no selection, and default camera through a `resetToken`.

All mode buttons use `aria-pressed`; state changes are announced in the existing live region.

- [x] **Step 5: Verify and commit resilience work**

Run `npm test && npm run build`.

Expected: all tests pass; forced-static mode exposes six stages and eleven part buttons.

```bash
git add src/components src/pages src/scene
git commit -m "feat: add resilient learning fallbacks"
```

## Task 8: Complete responsive Night Museum polish

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`
- Modify: `src/styles/gallery.css`
- Modify: `src/styles/explorer.css`
- Modify: `src/pages/GalleryPage.tsx`
- Modify: `src/pages/ExplorerPage.tsx`
- Modify: `src/components/KnowledgePanel.tsx`

- [x] **Step 1: Complete semantic interaction styles first**

Cover `:hover`, `:active`, `:focus-visible`, `[aria-current="step"]`, `[aria-pressed="true"]`, `.is-loading`, and `.is-error`. Body-sized metadata must not use opacity below 0.62. Focus and text contrast target WCAG AA. Every primary control keeps a 44 × 44 px hit area.

- [x] **Step 2: Implement the approved atmosphere**

Add one orchestrated entry sequence: brand, eyebrow, hero headline, then cards/model. Use a masked 40 px grid, radial museum spotlight, brass hairlines, restrained CSS grain, low-reflection metal, and oxide current-target highlight. Do not add remote fonts/images, crosshairs, combat HUD elements, purple gradients, or scattered decorative animations.

- [x] **Step 3: Lock responsive layouts to target viewports**

Implement and manually inspect these rules:

```text
1440 × 900: full 78 px rail, 340 px knowledge panel, six uninterrupted steps.
1024 × 768: 64 px rail, 300 px panel, at least 470 px stage height, shortened stage labels.
390 × 844: bottom nav, upper-half stage, horizontal part/step controls, readable knowledge sheet, zero body overflow.
```

- [x] **Step 4: Make provenance visible**

Gallery footer and each knowledge card expose a real source link in a new tab with “教育性重建 · 非工程图纸”. Preview cards name NASA and Scottish Maritime Museum as research routes without copying institutional logos or runtime assets.

- [x] **Step 5: Verify and commit polish**

Run `npm test && npm run build`.

Expected: all tests and build pass.

```bash
git add src
git commit -m "feat: polish night museum experience"
```

## Task 9: Run Playwright end-to-end and screenshot inspection

**Files:**
- Create during QA only: `output/playwright/` artifacts (already gitignored)
- Modify: only source files implicated by reproduced defects

- [x] **Step 1: Verify the CLI prerequisite**

```bash
command -v npx >/dev/null 2>&1
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" --help
```

Expected: `npx` exists and the wrapper prints CLI help.

- [x] **Step 2: Start the real app**

Run `npm run build`, then start `npm run dev -- --host 127.0.0.1` in a persistent terminal. Use the printed local URL, normally `http://127.0.0.1:5173`.

- [x] **Step 3: Execute the desktop learning flow**

Using fresh Playwright snapshots after every significant change:

1. Open gallery at 1440 × 900.
2. Confirm “拆开机械，看见原理”, “M4 中型坦克”, “X-57 电动飞机”, and “ASR-10 救援艇”.
3. Click “开始探索 M4 中型坦克”.
4. Confirm scene/fallback, six-step timeline, mode controls, and absence of page error text.
5. Choose stage 4 “动力”, then “星形发动机”; confirm matching card and source.
6. Exercise xray, principle, pause, and explode.
7. Press `r`; confirm `01 / 06`.
8. Navigate twice using `ArrowRight` only.
9. Capture `output/playwright/gallery-desktop.png`, `explorer-whole-desktop.png`, and `explorer-power-desktop.png`.

- [x] **Step 4: Execute fallback and mobile flows**

1. Open `#/explore/m4?no-webgl=1`; verify static diagram, six stages, eleven parts, and sources.
2. Switch to 390 × 844; reopen gallery/explorer; assert document width equals viewport width and all primary controls remain visible.
3. Capture `output/playwright/gallery-mobile.png`, `explorer-mobile.png`, and `explorer-fallback.png`.

- [x] **Step 5: Inspect every PNG as an image**

Open each artifact with the image viewer. Check hierarchy, model scale, text wrapping, clipping, contrast, control size, card density, grid alignment, mobile overflow, and model intersections at whole/power stages. Record issues before editing.

- [x] **Step 6: Fix verified defects one at a time**

For each defect: reproduce; identify root source/CSS rule; add a unit/component regression test when practical; patch the smallest file; rerun the relevant test; replay the exact Playwright step; capture an after image. Do not hide runtime errors or weaken assertions.

- [x] **Step 7: Inspect console and chunks**

Confirm no uncaught errors, React warnings, WebGL shader errors, failed network requests, or duplicate accessible names. Run `npm run build`; record chunks and confirm Three.js remains lazy-loaded.

- [x] **Step 8: Commit QA fixes if any**

```bash
git add src
git commit -m "fix: resolve end-to-end visual defects"
```

Do not create an empty commit if no source defect was found.

## Task 10: Document operation and perform final verification

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/plans/2026-07-11-mechanical-atlas-implementation.md` only to check completed steps

- [x] **Step 1: Write the README**

Document product purpose and safety boundary; install/dev/test/build commands; mouse/touch and keyboard controls; forced fallback URL; module boundaries; source links; the project-authored nature of the procedural model; public-domain/CC0 research routes; and the rule that future assets require individual license audits.

- [x] **Step 2: Run clean final verification**

```bash
npm test
npm run build
git status --short
```

Expected: all tests pass; build succeeds; only README and plan checkbox changes remain before the docs commit.

- [x] **Step 3: Commit documentation**

```bash
git add README.md docs/superpowers/plans/2026-07-11-mechanical-atlas-implementation.md
git commit -m "docs: explain mechanical atlas operation"
```

- [x] **Step 4: Audit the branch**

```bash
git status --short
git log --oneline --decorate -12
npm test
npm run build
```

Expected: clean worktree; all tests pass; build succeeds; scoped commits cover content, state, gallery, explorer, 3D, resilience, polish, optional QA fixes, and docs.

## Plan self-review checklist

- Spec coverage: catalog (Task 4), six-step explorer (Task 5), procedural 3D (Task 6), modes/fallback/accessibility (Task 7), responsive Night Museum system (Task 8), Playwright/screenshots (Task 9), and sources/docs (Task 10).
- Safety boundary: content is constrained in Task 2 and documented again in Task 10.
- Type consistency: `StepId`, `PartId`, `PartDefinition`, `ExploreMode`, `ExperienceState`, and `getPartMotion` are defined once and reused.
- Runtime dependencies: source content is local and traceable; no external 3D/image service is required.
- No unresolved implementation choice remains.
