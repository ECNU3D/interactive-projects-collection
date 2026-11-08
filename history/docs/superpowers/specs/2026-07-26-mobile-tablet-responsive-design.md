# 移动端 / 平板适配设计文档

日期：2026-07-26
状态：已确认（用户逐项决策：竖屏压缩尺度、平板整体放大、四项触控手势全做、3D 本轮不动）

## 背景

《山河岁月》主界面是横向时间长卷（15 章 / 93 事件），另有人物星图、山河舆图、抉择页、事件卡、终章五个视图。项目此前只有 `@media (max-width: 600px)` 与 `≤420px` / `≤400px` 两条补丁式断点，600–1024px（平板）完全落到桌面分支，且从未在真实设备尺寸下验证过。

真实 Chrome 渲染下的现存缺陷（headless 截图实测，2026-07-26）：

| 尺寸 | 现象 |
|---|---|
| 390×844 手机竖屏 | 一屏仅 1–2 个节点；轴线上下各约 300px 空白；顶栏 6 个按钮占两行 |
| 844×390 手机横屏 | 章引言卡文字高度超出可视区，压穿底部年表刻度尺 |
| 820×1180 平板竖屏 | 时间轴是 1180px 高画面里居中的一条细线，上下约 500px 全空 |
| 390×844 人物星图 | 82 个节点挤在 390px 宽内，标签不可读，无任何缩放手段 |
| 390×844 山河舆图 | 可用，但只有单指拖动，无双指缩放 |

另有一条与断点无关但同源的既有缺陷：`scroll.js` 的 `chapterMinWidth()` 用桌面常量（98/39/260/148/112），而 CSS 在 ≤600px 已把它们改成 84/28/200/108/48，两者漂移导致窄窗口下每章节点串结束后多出约 380px 空白、且底部刻度尺与章节区段错位。本次一并根治。

（同日另修的 Safari 空白 bug——`.chapter-intro-card` 缺 `max-width` 致 WebKit 固有宽度虚高——已单独修复，不属本设计范围，但下文的验证脚本会顺带守住该回归。）

## 目标与非目标

目标：手机（竖屏为主、横屏可用）与平板（横竖屏）上，长卷、星图、舆图、抉择页、事件卡、终章六个视图布局正确、触控可操作、无横向溢出、无元素互相穿透。

非目标：

- 「走入历史」三维高斯泼溅（`js/walkin.js`）的移动端适配与性能降级——本轮不动，单独评估。
- 竖向时间轴等交互范式改造——竖屏仍用横向长卷，仅压缩尺度。
- 视觉风格重构——水墨/宣纸体系不变。

## 一、单一真相源：尺寸令牌化

**问题**：布局尺寸同时存在于 CSS（`.node-wrap { width: 98px }` 等）与 JS（`scroll.js` 顶部常量），媒体查询只改前者，`chapterMinWidth()` 立即失真。每加一个断点，错位就多一处。

**方案**：五个量升为 `:root` 上的 CSS 自定义属性，媒体查询只改变量值；`scroll.js` 改为运行时读取。

```css
:root {
  --node-w: 98px;        /* .node-wrap 宽度，同时是 .node-label 宽度 */
  --node-gap: 39px;      /* .timeline-nodes 的 gap */
  --intro-w: 260px;      /* .chapter-intro-card 的 flex-basis 与 max-width（两者必须同值，见 Safari 注释） */
  --title-w: 148px;      /* .chapter-title-block 的 flex-basis */
  --timeline-pad: 56px;  /* .timeline 单侧内边距 */
}
```

`scroll.js`：

```js
function px(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}
function chapterMinWidth(nodeCount) {
  return px("--title-w") + px("--timeline-pad") * 2 + px("--intro-w")
       + nodeCount * (px("--node-w") + px("--node-gap"));
}
```

约束：

- `chapterMinWidth()` 每次调用都实时读取，不缓存——`render()` 与 `buildRuler()` 在同一帧内取到的必然是同一组值，章节宽度与刻度尺段宽因此恒等。
- 视口跨越断点时（旋转屏幕、桌面拖窗口）尺寸变量会变，已渲染的内联 `min-width` 与刻度尺段宽将失真。处理：`window.resize`（去抖 200ms）检测断点是否切换，切换才整卷重渲染 `SHY_SCROLL.render()`，渲染后把滚动位置还原到当前前沿节点。仅断点切换才重渲染，避免手机地址栏收放引发的高频重排。

## 二、断点矩阵

四条断点，互不重叠。现有的 `≤420px` / `≤400px` 两条补丁式断点一并并入手机档令牌（`≤400px` 的 `.chapter-title-block: 92px` 与章名 17px 由 `--title-w` / 章名字号统一承担，不再单列）：

| 令牌 | 手机 ≤600px | 平板 601–1024px | 桌面 >1024px |
|---|---|---|---|
| `--node-w` | 62px | 120px | 98px |
| `--node-gap` | 22px | 48px | 39px |
| `--intro-w` | 168px | 320px | 260px |
| `--title-w` | 76px | 172px | 148px |
| `--timeline-pad` | 16px | 64px | 56px |
| 缩略图 | 36px | 64px | 44px |
| 标签字号 | 10.5px | 13px | 11.5px |
| 节点直径 | 20px | 26px | 22px |
| 章名竖排字号 | 17px | 30px | 25px |

手机竖屏可见节点数校验：390 − 76(章题栏) − 32(轴两侧内边距) = 282px，每节点 62+22 = 84px → **一屏 3.4 个节点**，满足"3–4 个"目标。平板 820 竖屏：820 − 172 − 128 = 520px，每节点 168px → 3.1 个，节点更大更疏，符合"整体放大填充"。

第四条断点 `@media (max-height: 480px)`（手机横屏、矮窗口），与宽度断点正交：

- `.chapter-intro-card { max-height: calc(100% - 24px); overflow-y: auto; }` + 底部渐隐遮罩，修掉压穿刻度尺的问题；
- 缩略图降到 32px、tick 长度 22→14px，保证标签与轴线在 322px 可用高度内不重叠。

平板纵向填充（601–1024px 且 `orientation: portrait`）：tick 长度 22→40px、标签离轴距离同步加大、缩略图 64px 且外移、年代水印字号 `clamp(160px, 22vw, 320px)`，让 1180px 高的画面不再只有中间一条线。

## 三、各视图适配要点

**长卷（scroll-view）**：按上表令牌化 + `touch-action: pan-x`（禁掉竖向橡皮筋，横滑更跟手）。事件卡 modal 手机上维持既有的底部抽屉式（`max-height: 92vh`），改用 `92dvh` 以避开 iOS 地址栏高度跳变。

**人物星图（graph-view）**：`d3.zoom`（`scaleExtent [0.3, 4]`）已在 `buildGraph()` 中绑好，双指缩放/单指平移本已具备——真正缺的是 `.graph-svg` 没有 `touch-action`，触摸手势被浏览器默认行为抢走。补 `touch-action: none` 即可生效。另加：进入视图时按节点包围盒自动 fit 到视口（现在力导布局按 `canvasSize()` 铺开，手机上必然溢出视口）；`pointer: coarse` 时节点半径与命中半径放大；未点亮人物不渲染 "？" 标签（现在满屏噪声）。

**山河舆图（map-view）**：现有 `pointerdown/move/up` 拖拽保留（含 4px 位移阈值——低于阈值不捕获指针，marker 点击才不会被吞）。新增双指缩放：`pointermove` 中维护活动指针表，两指时按指距比缩放、以两指中点为锚，第二指按下时不清除已有拖拽状态。

**抉择页 / 终章 / 关于页**：现有 ≤600px 规则已基本可用，本轮只补触控热区与安全区内边距。

**顶栏**：≤600px 收成单行 48px。**2026-07-28 补充（回写为实际实现，原计划的溢出菜单未采用）**：
实现阶段改为「长/短标签纯 CSS 切换 + 6 按钮单行」——`.btn-label-full`/`.btn-label-short` 一对元素配合
`display:none`/`inline` 按断点切换文案长短，静音/星图/舆图/关于/重新开始/（通关后）终章全部 6 个按钮
始终单行平铺，不收进「⋯」溢出菜单；`@media (pointer: coarse)` 下按钮命中高度另加到 54px。HUD 收窄为
只留总分（隐藏称号 chip 与章名徽标），站标文字「山河岁月」在 ≤600px 无条件收起只留「史」印章方块，
腾出的横向空间记到 HUD 头上。取舍理由（Task 4/5 实测有数据支撑）：多一层「⋯」菜单会让「关于」
「重新开始」这两个操作多绕一步，而实测 6 按钮单行 + 短标签在 iPhone SE（375px）/iPhone 14（390px）
两款主力机型上都能放进一行、不需要横向滚动，直接铺开比藏进菜单更利落；`#top-bar-actions` 仍保留
`overflow-x:auto` 兜底且不隐藏原生滚动条，万一未来出现比当前更挤的组合，玩家至少能看到可以横滑，
不会把入口静默藏在视口外而毫无察觉。移除现有 ≤420px 的换行补丁（被本条取代）。

**触控热区**：`@media (pointer: coarse)` 下，节点 `.node`、顶栏按钮、人物 chip、抉择选项用伪元素把命中区撑到 ≥44×44px（`content:""; position:absolute; inset:-Npx`），不改变视觉尺寸。

**iOS 细节**：`index.html` 的 viewport meta 加 `viewport-fit=cover`；顶栏与刻度尺加 `env(safe-area-inset-*)` 内边距；全屏高度改用 `100dvh`（`100vh` 作降级）。虽以 Chrome 为测试主力，这三条是纯增量且零风险。

## 四、验证

新增 `tools/responsive-check.mjs`，沿用 `tools/selftest-run.mjs` 已验证的 CDP 模式（headless=new + `/json/version` 轮询 + WebSocket），但用 `Emulation.setDeviceMetricsOverride`（含 DPR 与 `Emulation.setTouchEmulationEnabled`）做真设备模拟，而非缩放窗口。

设备矩阵（7）：iPhone SE 375×667、iPhone 14 390×844、iPhone 14 横屏 844×390、iPad mini 744×1133、iPad Pro 竖 1024×1366、iPad 横 1366×1024、桌面 1440×900。
视图矩阵（6）：长卷、事件卡、星图、舆图、抉择页、终章。

自动断言：

1. 无横向溢出：每个视图 `scrollingElement.scrollWidth <= innerWidth + 1`（长卷容器自身的横向滚动除外，单独白名单）
2. CSS/JS 一致：每个 `.chapter-section` 的 `offsetWidth` 等于 `chapterMinWidth(n)`（±2px）
3. 刻度尺对齐：刻度尺总宽 == `.scroll-track` 总宽（±2px）
4. 无穿透：`.chapter-intro-card` 底边 ≤ `.scroll-ruler` 顶边；节点标签矩形与轴线矩形不相交
5. 触控热区：粗指针下 `.node`、`#top-bar-actions button`、`.person-chip`、`.choice-option`、`.card-close`
   这五类可交互元素命中矩形 ≥44×44px（**2026-07-28 回写为实际覆盖范围**：原计划写的是笼统的
   "所有可交互元素"，实现阶段只对这五个选择器做了命中矩形断言，不是真的覆盖了页面上每一个可交互
   元素——下面「已知缺口」是这条断言范围之外、实测确认未达标的一处）
6. 密度：手机竖屏首屏可见 `.node-wrap` ≥3

同时把每个组合的截图归档到临时目录供人工核对。验收标准：7×6 组合上述断言全绿，且桌面 1440×900 的渲染与改动前逐像素无回归（长卷/星图/舆图各取一张对比）。

**已知缺口（2026-07-28 复审记录，本轮不实现，留给下一轮）**：山河舆图（map-view）的事件 marker
完全没有触控热区扩张，不在上面断言 5 的五个选择器覆盖范围内。marker 是 SVG 图形（`.map-marker` /
`.map-marker-shape`），在 iPhone 14 (390×844) 上屏幕直径实测只有约 4.3px，即使把地图捏合缩放到
`d3.zoom` 允许的最大倍数，命中直径也只有约 17px，远低于 44×44 的门槛。人物星图对同类问题的做法是
在 `buildGraph()` 里插入透明的命中圆 `<circle class="graph-node-hit" r="22">`（`js/graph.js`，仅
`pointer: coarse` 下存在），山河舆图尚未做等价处理——`js/map.js` 不在本轮允许改动的文件范围内
（见执行任务说明），这里如实记录缺口，不在本轮动手实现。

## 风险

- **令牌化触及 `render()` 主路径**：`chapterMinWidth()` 是长卷与刻度尺的共同依赖，读错变量会让整卷错位。缓解：断言 2、3 直接覆盖该风险，且改动前后桌面截图对比必须无回归。
- **舆图双指缩放与既有拖拽状态机耦合**：第二指按下时若误清 `drag` 状态会导致 marker 点击被吞。缓解：单独构造双指用例，并回归"轻点 marker 打开事件卡"路径。
- **`resize` 重渲染丢失阅读位置**：重渲染后必须恢复到原前沿节点。缓解：重渲染路径复用既有 `scrollToCurrentNode(false)`。
