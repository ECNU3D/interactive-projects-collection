# 「自动放映」模式 设计文档

- 日期：2026-08-02
- 状态：已实现并合入 main（2026-08-02）· 自动化验证通过（自检 117 项 / walkin 17 项 / 响应式 115 项）
  · 人工验收已进行一轮，产出两项修改并已落地（抉择幕改为「旁白与环绕并行」、作答后停留由按字数估时的 17.6–29.3 秒改为固定 3.5 秒，见 §1.1 与 §5.2）
  · 验收清单中「全景接缝是否跳变」「泼溅有无露出破面」「暂停时声画是否同步」三项尚未逐一核验
- 需求来源：用户直接提出——为《山河岁月》新增一个自动播放模式，自动播放每一幕、自动选择正确答案，并在每个抉择场景分别 360° 自动环绕展示全景图与高斯泼溅场景。

## 1. 背景与范围

《山河岁月》当前是纯手动推进：玩家点长卷节点 → 读事件卡 → 「继续前行」→ 遇抉择点进全屏沉浸抉择 → 作答 → 「继续前行」→ 解锁下一节点。全作 15 章 / 93 个事件 / 26 个抉择点，每个 id（事件 / 抉择 / 章节）都有对应的预生成解说 mp3（`assets/audio/narration/<id>.mp3`，共 134 段，总时长 7520 秒）。

抉择场景已有四层互斥背景：水墨降级 → 封面 Ken Burns → 360° 环景全景图（26 张 `assets/images/panorama/cNN.jpg`，10px/s 慢速自动漂移 + 可拖拽）→ 高斯泼溅 3D 漫游（`assets/world/cNN.spz`，WASD 自由走动）。

本次新增一个**放映模式**：由程序按时间轴自动走完全程，把上述已有素材串成一部可以躺着看完的"纪录片"。范围只覆盖这一个新功能的接入与为之必需的两条镜头契约；不对已完成的数据、画卷、抉择、人物图谱、舆图、音频做任何重构。

### 1.1 已确认的定位与取舍（用户逐条拍板）

| 决策点 | 结论 |
|---|---|
| 模式定位 | **放映模式**：全程沙盒，不改动真实存档与得分，退出后原封恢复玩家进度；本次（2026-08-02）敲定的默认起点是从第一幕起播完整全程——2026-08-06 续播功能落地后新增了"从玩家当前进度接着放"的第二种起点，同样全程沙盒，详见 `2026-08-05-autoplay-resume-design.md` |
| 停留节奏 | **跟随解说音频**：每幕停留至该幕解说 mp3 播完 + 1.2s 停顿；音频不可用时按正文字数估时 |
| 泼溅镜头轨道 | **原地转身环视**：相机固定在现有 `CAMERA_START` 机位，绕 Y 轴匀速 yaw 满 360° |
| 抉择幕编排 | **旁白与环绕并行**：进抉择幕即刻起步环绕（全景环绕一周 → 泼溅环视一周，环绕期间面板淡出进观景模式），旁白与之同时播放；两者取较长者（`max(narration, orbits)`）后才自动作答——旁白短于环绕（多数情形）则等环绕收尾、面板淡回后旁白早已播完；旁白长于环绕则环绕先收尾、面板淡回，剩余旁白接着在恢复的面板上播完 |
| 章引言幕 | **加**：进新章先滚到该章引言卡、播 `chNN.mp3` |
| 暂停控制 | **加**：空格键 / 指示条按钮暂停与继续 |

预计全场时长 ≈ **2 小时 50 分**（解说 125 分钟 + 26 幕环绕约 18 分钟 + 停顿转场）。

### 1.2 非目标

- 不做倍速播放。
- 不做视频导出 / 录屏。
- 不做"托管模式"——即不会在玩家**真实存档**上自动推进、正常计分解锁；放映始终在沙盒里进行，退出后原样恢复。
  （本节写于 2026-08-02，彼时放映只能从第一幕开始；2026-08-06 续播功能落地后新增了"从玩家当前进度接着放"
  这第二种沙盒起点，但同样不碰真实存档——"托管模式"这一非目标本身没有变，变的只是沙盒的起点，
  详见 `2026-08-05-autoplay-resume-design.md`。）
- 不为缺失的 7 幕 `.spz` 补生成模型（见 §6.3）。
- **不展开事件卡的「史海钩沉」`<details>`**：该段延伸阅读没有对应解说音频，展开后只能靠估时干等；且首次展开会写 `state.readExtra` 并加 10 分，与"放映只走主线"的定位不符。因此放映的理论满分不含 `EXTRA` 加分（见 §9.1）。

## 2. 架构选型

考虑过三种做法：

**A. 纯黑箱导演**——只点真实 DOM、只听自定义事件，一个现有文件都不改。**不可行**：`panoX` / `panoTileW` 是 `choice.js` 的闭包私有变量；`walkin.js` 的 `camera` 在 module 私有作用域内，且渲染循环每帧调用 `controls.update(camera)` 会覆写任何外部写入。两条 360° 镜头轨道从模块外部根本写不进去。

**B. 导演 + 两条镜头契约（采纳）**——新增 `js/autoplay.js` 只负责编排；`choice.js` 与 `walkin.js` 各自在自己的领域内多长出一个能力（"把镜头环绕一周"），对外只暴露一个返回 Promise 的方法。导演不复制任何业务逻辑：作答、继续前行都点真实按钮。

**C. 预生成时间轴 JSON**——把每幕时长与镜头动作量测入库，播放器按时间轴驱动。精确可控且便于将来导出视频，但解说时长会形成"音频文件 + JSON"的双真相源（改一段配音必须重新量测入库），当前需求用不到。YAGNI，不采纳。

采纳 **B**。理由：每个模块只承担自己领域内的职责——全景怎么转是 `choice.js` 的事，泼溅相机怎么转是 `walkin.js` 的事，什么时候转、转多久是导演的事。三者各自可独立理解、独立测试，边界与现有 `SHY_WALKIN` ↔ `SHY_CHOICE` 桥接契约的风格一致。

## 3. 模块与契约

### 3.1 新增 `js/autoplay.js`

普通 `<script>`（非 module），在 `index.html` 中置于 `js/app.js` 之后、`js/walkin.js`（module，天然 defer）之前。

```js
window.SHY_AUTOPLAY = {
  promptAndStart(),  // 顶栏入口。有可续起点（前沿下标落在 [1, events.length)）时弹出
                     // 三按钮选择弹窗，按选择调 start({resume})；否则直接 start({resume:false})
  start(opts),      // opts = { debugFast, skipOrbits, skipFilm, resume }（仅供自检与
                     // promptAndStart() 内部调用）：debugFast 把主动停顿压到 20ms（不压
                     // waitFor 的超时上限，见 §5.3）；skipOrbits 跳过两段环绕，skipFilm
                     // 跳过章开篇影片，两者省略时都随 debugFast 同步；resume 为 true 时
                     // 沙盒态基于玩家当前存档的独立深拷贝、时间轴从前沿那一幕起并跳过
                     // 所在章的章引言（详见 2026-08-05-autoplay-resume-design.md）；
                     // start() 本身不再弹任何对话框
  stop(),           // 幂等；正常结束 / Esc / 顶栏按钮 / 异常兜底 共用此出口
  togglePause(),    // 暂停 ⇄ 继续
  isRunning(),      // boolean
  isPaused(),       // boolean
  debugState()      // 非契约：{ running, paused, phase, chapterId, eventIndex, lastRun }，供自检读取
};
```

该模块**不渲染任何游戏内容**，只渲染一条放映指示条（§7.2）。所有游戏画面仍由既有模块产出。

因 `js/walkin.js` 是 ES module（浏览器天然 defer），`window.SHY_WALKIN` 在 `autoplay.js` 求值时可能尚不存在——一律在**调用时**做存在性检查，沿用 `choice.js` 中 `setupWalkin()` 的既有防御写法，不在加载期捕获引用。

### 3.2 `js/choice.js` 新增契约

> **实现回写**：本节按落地代码回写，与最初设计有一处收敛。最初设想 `setAutoplayOrbit(bool)`
> 单独切换一个 `.is-autoplay-orbit` 类；实现时发现 `.is-viewing` 只在环绕（观景）段为真，
> 放映的其余时段不叠加它，因此复合选择器 `.is-autoplay.is-viewing`（用于覆盖 AI 角标隐藏，
> 见 §8）已经能精确圈住"放映且在环绕"这一状态，不需要第二个类。于是把它并入了
> `setAutoplayActive(bool)`——该方法同时承担了设计阶段未提及的另一职责：放映期整场禁用
> 全景拖拽（`onPanoPointerDown` 里 `if (autoplayActive) return;`），避免观众手滑拖拽与
> 镜头轨道打架。`setOrbitPaused` 与非契约的 `debugPano` 也是设计阶段未列出、落地后新增的。

```js
window.SHY_CHOICE.setAutoplayActive(bool)        // 切 .is-autoplay 类 + 放映期整场禁用全景拖拽
window.SHY_CHOICE.setViewMode(bool)              // 现有 enterViewMode / exitViewMode 的公开化
window.SHY_CHOICE.setOrbitPaused(bool)           // 冻结/恢复全景环绕 elapsed 的累加（暂停用）
window.SHY_CHOICE.orbitPanorama({ durationMs })  // → Promise<boolean>
window.SHY_CHOICE.debugPano()                    // 非契约：仅供 autoplay-selftest.html 观测内部量
```

`window.SHY_CHOICE` 已存在（现为 `{ open }`，注释标明是"非强制契约的便利性暴露"）。本次将其提升为正式契约的一部分，已同步更新 `.superpowers/sdd/shared-interfaces.md`。

### 3.3 `js/walkin.js` 新增契约

```js
window.SHY_WALKIN.orbit(choiceId, { durationMs })  // → Promise<boolean>
window.SHY_WALKIN.setOrbitPaused(bool)             // 冻结/恢复环视 yaw 的 elapsed 累加（暂停用）
```

内部把现有 `open(choiceId)` 参数化为 `open(choiceId, opts)`，`opts.orbit = { durationMs, done(ok) }` 存在时走环视渲染循环（§6）。`orbit()` 是 `open()` 之上的薄包装，返回的 Promise 在环视一周完成后 resolve(true) 并自动 `close()`；素材不可用 / 加载失败 / 30s 超时 / 中途被关闭则 resolve(false) 且不阻塞放映。

### 3.4 自动作答不开新契约

导演直接操作真实 DOM：

| 动作 | 选择器 | 归属 |
|---|---|---|
| 事件卡「继续前行」 | `.event-card .btn-continue` | `scroll.js` |
| 抉择选项 | `.choice-option[data-orig-index="<正确项原始下标>"]` | `choice.js` |
| 抉择「继续前行」 | `.choice-btn-continue` | `choice.js` |

选项按钮按 `choiceId` 种子乱序渲染，但每个按钮都带 `data-orig-index` 指回 `choice.options` 的原始下标——导演从数据里找出 `correct === true` 的下标，再按该属性定位按钮即可，与显示顺序无关。

走真实点击而非新开一个 `answer()` 接口，是为了让放映路径与人类路径完全同构：计分、印章动效、`confirmed` 写入、`shy:choice-done` 派发全部由既有代码承担，导演不复制任何一行业务逻辑。

## 4. 沙盒：真实存档零污染

### 4.1 进入

1. `snapshot = JSON.parse(JSON.stringify(SHY_APP.state))`
2. `originalSaveState = SHY_SCORE.saveState`；`SHY_SCORE.saveState = function () {}`
   （`saveState` 是 `SHY_SCORE` 对象上的普通可赋值属性，劫持成立。放映期间所有写盘调用一律落空。）
3. `SHY_APP.state = SHY_SCORE.newState()`
4. `SHY_SCROLL.render()` → `SHY_APP.refreshHud()` → `SHY_APP.showView("scroll")`

`shanhe_settings_v1` 不在劫持范围内：放映期间唯一会写它的是 `choice.js` 的 `panoHintShown` 与静音开关，两者都是无害的设置项，写入即写入。

### 4.2 退出（唯一出口）

`stop()` 是所有退出路径（播完 / Esc / 顶栏按钮 / 未捕获异常兜底）的唯一收敛点，且幂等：

1. 置 `cancelled = true`，唤醒并作废所有 pending 的等待（§5.3）
2. `SHY_VOICE.stop()`；`SHY_WALKIN.close()`；两条镜头轨道各自的 `setOrbitPaused(false)` 复位（避免下一轮放映一开场就卡在暂停态）；`SHY_CHOICE.setViewMode(false)`；`SHY_CHOICE.setAutoplayActive(false)`；关闭事件卡 modal（派发 `shy:view-changing` 到非 scroll 视图即可，或直接点 `.card-close`）
3. `SHY_SCORE.saveState = originalSaveState`；`SHY_APP.state = snapshot`
4. `SHY_SCROLL.render()` → `SHY_APP.refreshHud()` → `SHY_APP.showView("scroll")`
5. 移除指示条与全局按键监听；toast「放映结束，已恢复原有进度」

### 4.3 通关与终章

放映走完最后一幕时，`scroll.js` 的 `doUnlock()` 会照常置 `state.finished = true` 并派发 `shy:enter-ending`，`app.js` 切到终章视图。终章展示的是**沙盒里的满分成绩**——这正是"自动全对通关"应有的观感，符合预期，不做特殊处理。

> **实现回写**：设计阶段设想终章"停留至终章解说播完（或兜底 20s）"，但 134 段预生成解说
> mp3 精确对应 93 个事件 + 26 个抉择 + 15 章引言（`93+26+15=134`），**没有一段是给终章的**，
> `js/narration.js` 也没有 `ending` 这个 id 可播。实际 `runTimeline()` 在事件循环结束后只是
> `await clock.wait(dwell(ENDING_HOLD_MS))`——一次不依赖任何解说播放状态的固定 20s 停留（`ENDING_HOLD_MS`），
> 随后进入 `finishNaturally()` 调用 `stop()` 还原。终章视图切换本身自带一次「翻卷」音效（`playAudioSafe("ending")`），
> 那是既有的 SFX 提示音，不是解说旁白，因此没有可供"播完"的东西。

注意 `state.finished` 还控制顶栏「终章」按钮的可见性（`refreshHud()` 中 `endingBtn.hidden = !state.finished`）——`stop()` 里的 `refreshHud()` 会按还原后的快照重新计算，玩家若本来没通关，按钮会正确地重新隐藏。

## 5. 时间轴（导演脚本）

### 5.1 顶层结构

```
for each chapter ch (按 order 升序):
  ── 章引言幕 ──
    滚动 #scroll-view 使该章 .chapter-intro-card 居中（主题色由既有 scroll 监听自动同步）
    SHY_VOICE.playFor(ch.id)
    await 解说播完
    await 停顿 1.2s

  for each event ev in ch (按数据顺序):
    ── 事件幕 ──
      SHY_SCROLL.openEvent(ev.id)        // 卡片打开，内部自动 playVoiceFor(ev.id)
      await 解说播完
      await 停顿 1.2s
      点击 .btn-continue                 // = hideModal() + SHY_SCROLL.advance()
      if (ev.choiceId) await 抉择幕(ev.choiceId)
      await 停顿 0.9s                    // 等长卷平滑滚动到下一节点落位

最后一幕 → shy:enter-ending → 终章停留 → stop()
```

**滚动到章引言卡不需要新契约**：`#scroll-view` 上已绑定 `bindThemeSync()` 的 scroll 监听，导演改 `scrollLeft` 会自动触发 `syncThemeToScroll()` 完成主题色切换。导演只需按 `.chapter-section[data-chapter-id="<id>"] .chapter-intro-card` 的 `getBoundingClientRect()` 计算目标 `scrollLeft` 并平滑滚过去。

**章引言与事件幕的顺序前提**：进入第 N 章的引言幕时，上一章末事件的 `doUnlock()` 已把前沿推进到本章第一个事件（本章事件仍未解锁，但引言卡只是长卷上的静态卡片，滚过去纯属视觉动作，不触碰任何锁态）。

### 5.2 抉择幕

`advance()` 已同步派发 `shy:enter-choice`，`choice.js` 的 `openChoice()` 随即开场并调用 `playVoiceForSafe(choice.id)`——导演接手时旁白已在播。

> **实现回写**：以下步骤按落地代码（`js/autoplay.js` 的 `playChoice()` / `runOrbits()` /
> `confirmAndContinue()`）重新编号，与最初设计有四处出入：① `setAutoplayActive(true)` 在
> **进入本函数时立即调用**，早于旁白与环绕开始，而不是等旁白播完之后才切；② 该状态贯穿
> 放映全程直到 `stop()` 才在 `teardownScene()` 里统一复位为 `false`，不是每个抉择各自
> 开关一次；③ **旁白与环绕由串行改为并行**（用户实跑验收后要求的行为变更）：最初实现是
> 等旁白播完才进观景模式、再顺序跑两段环绕，人工验收时反馈"旁白 39.5–76.3s、两段环绕
> 合计约 48s，多数场景旁白比环绕短，串行编排会让观众在环绕结束、面板淡回之后还要再等一段
> 早就放完的旁白"——改为进抉择幕即让"等旁白播完"与 `runOrbits()` 并发执行，作答时机取两者
> 中较长者（`max(narration, orbits)`）；④ 第 6 步的作答后阅读停留从"按 `historyNote`
> 字数估时"（`max(6000, 字数 × 180)`，实测 26 条落在 17.6–29.3s）改为固定常量
> `NOTE_READ_MS = 3500`——用户实跑后反馈原时长"感觉像卡住了，不知道要不要手动点"。轮询
> 上限也从设计阶段设想的 10s 改为实测的 20s（`WAIT_OPTIONS_MS` / `WAIT_ACTION_MS`）。

```
1. SHY_CHOICE.setAutoplayActive(true)   // 加 .is-autoplay 类 + 整场禁用全景拖拽；
     贯穿放映全程，直到 stop() 才复位，不是每个抉择各自切一次
2. 旁白与环绕并行起步：Promise.allSettled([ 等 cNN.mp3 旁白播完, runOrbits(choiceId) ])
     · runOrbits 自己管观景模式的进出，不需要导演另外调用 setViewMode：一开场即
       SHY_CHOICE.setViewMode(true)（面板 / 提示淡出，遮罩变浅，进入观景模式），
       命中 prefers-reduced-motion 时改为静态展示 6s、跳过以下两段环绕（见 §7.4）；否则
       依次 await SHY_CHOICE.orbitPanorama({ durationMs: 24000 })（全景 360° 整一周；
       途中被 stopPano() 打断则 resolve(false)）、if (泼溅可用) await
       SHY_WALKIN.orbit(choiceId, { durationMs: 24000 })（原地转身 360°；提前关闭 / 加载
       失败 / 30s 超时同样 resolve(false)；两条轨道各自再套一层导演侧的
       clock.withCap(…, 180000) 兜底），finally 里无条件 SHY_CHOICE.setViewMode(false)
       （环绕结束/被打断/跳过时都一样）让面板淡回
     · 旁白与上述环绕同时播放：面板处于观景模式的这段时间旁白仍在画外音继续
     · 作答时机取两者中较长者——旁白短于环绕（多数情形），环绕结束、面板淡回后旁白早已
       播完；旁白长于环绕，环绕先收尾、面板淡回，剩余旁白接着在恢复的面板上播完
     · 两个 await 都可能被 Esc 触发的 clock.cancel() 以 CancelledError 拒绝：用
       Promise.allSettled 而非 Promise.all 收集两者的结果——需要的语义是「两者中只要有
       一个被取消就优先抛出取消」，而 all() 只暴露最先 reject 的那一个原因、看不到另一
       个的结局，实现不了这条优先级规则（不是为了避免未处理 rejection：Promise.all 对
       每一项都会同步挂处理器，不会有遗漏）；两者都 settle 后，若其中有取消则优先重新
       抛出取消（让异常沿用 start() 里既有的"isCancelledError 则静默返回"处理），否则
       抛出先出现的非取消异常
3. await 选项按钮出现（choice.js 早已 reveal，通常已就绪；轮询上限 20s）
4. 给正确选项加 .is-auto-picking 描边高亮 800ms → .click()
5. await .choice-btn-continue 出现
      （答对路径：印章 → 900ms → historyNote 卷轴展开 → 继续前行按钮）
6. await 停留 3500ms（NOTE_READ_MS，用户验收后定），供阅读历史真实走向
7. 点击 .choice-btn-continue → shy:choice-done → doUnlock
```

第 4 步的 `.is-auto-picking` 是新增的一个纯装饰类（描边呼吸 800ms），目的是让观众看清"是这一项被选中了"，而不是选项凭空跳到已作答态。

第 5 步只等「继续前行」不等「我明白了」：放映永远选正确项，`handleWrong()` / `showLearnButton()` 路径在放映中不可达。但为防数据异常（某抉择无 `correct === true` 项）导致死等，第 3 步找不到正确项时记录一条 `console.warn` 并直接点第一个选项，第 5 步同时监听 `.choice-btn-learn` 与 `.choice-btn-continue`，命中前者则先点它再等后者。

### 5.3 等待原语

> **实现回写**：落地时没有做成一个统一签名 `waitCancellable({...})` 的单一函数，而是
> `js/autoplay-kit.js`（见 §6.4）的 `createClock()` 暴露三个各自独立的原语，"等解说播完"
> 不是第三个原语而是导演自己在这三者之上组合出的 `waitNarration()`（见 §5.4）。

```js
clock.wait(ms)                                   // 定时等待
clock.waitFor(predicate, { timeoutMs, intervalMs })  // 轮询条件（如"按钮出现"），resolve(true/false)
clock.withCap(promise, capMs)                    // 给任意 promise 套一个"有效时间"上限，超时 resolve(undefined)
```

三者共同的语义：
- **可取消**：`stop()` 调用 `clock.cancel()` 后，所有 pending 的 `wait`/`waitFor` 立即以 `CancelledError` reject（导演主时间轴 `runTimeline().then(..., err => { if (isCancelledError(err)) return; ... })` 捕获后静默返回，不冒泡）
- **可暂停**：内部维护一条"有效时间轴"（`effectiveMs`）而非依赖 `setTimeout` 的绝对到期时刻；暂停时停止累加、恢复时接着累加。**不能用简单的 `clearTimeout` + 恢复时重开一个完整时长的定时器**——那会让恢复后的剩余时长丢失、每次暂停都白等一次全长
- **硬上限**：`waitFor` 的默认 `timeoutMs` 即为 180000（`HARD_CAP_MS`）；导演对环绕类等待另外显式套 `withCap(…, HARD_CAP_MS)`，任何单次等待最长 180s，超时即视为完成并继续，绝不卡死整场放映

### 5.4 等解说播完的具体实现

`SHY_VOICE.current` 是当前播放的 `<audio>` 元素（无播放时为 `null`）。

1. 触发点之后开始轮询，最多 600ms 内抓取 `SHY_VOICE.current`
2. 抓到 → `audio.addEventListener("ended" / "error", ...)`。**必须用 `addEventListener` 而非 `audio.onended = ...`**：`narration.js` 的 `playFor()` 自己用 `addEventListener` 注册了清理逻辑，而 `stop()` 会赋值 `audio.onended = null`——用属性赋值既可能被 `stop()` 抹掉，也无法与既有监听共存。**在读 `audio.duration` 之前，先轮询等它变为有限正数（最多 3s）**——`new Audio()` 同一 tick 内 `duration` 恒为 `NaN`，元数据要等解码器读到文件头才有；等到后才用 `audio.duration + 2s` 作兜底超时封顶（见下方"实现变更"）
3. 抓不到（静音 / mp3 缺失 / 浏览器拒绝自动播放）→ 回退按该幕正文字数估时：`clamp(字数 × 220ms, 4000, 90000)`。取字段：事件用 `summary`，抉择用 `scene`，章节用 `intro`
4. 暂停时同步 `audio.pause()`，恢复时 `audio.play()`

**实现变更（修复一处会截断每一幕的严重 bug）**：设计阶段设想"抓到 `SHY_VOICE.current` 后立即读
`audio.duration + 2s` 作封顶"，但没意识到 `new Audio()` 同一 tick 内 `audio.duration` 恒为
`NaN`——`waitNarration` 抓到 `current` 与开始等待是同一时刻，若不先等一下元数据，`isFinite`
分支永远走不到，封顶会静默退化成 `estimateMs(文本) + 2s`，而这又撞上了下一条"上限过低"的
问题，两者叠加的结果是**每一幕解说都会被从中间截断**，134 段解说全部命中（实测时长
39.5–76.3s，全部长于旧钳位 25s）。落地版本先 `waitFor(() => isFinite(audio.duration) &&
audio.duration > 0, { timeoutMs: 3000 })` 等到元数据可用，再计算封顶；这一等待用真实挂钟
（不套 `debugFast` 的压缩），因为它等的是一个必然很快到达的浏览器内部状态，不是"刻意停顿"。

**实现变更（较设计阶段抬高上限）**：`estimateMs` 的钳位上限从设计阶段设想的 25000ms 抬高到了
**90000ms**。原因：134 段解说实测时长为 39.5–76.3 秒，而多数场景正文（事件 `summary` 199–298
字、章引言 `intro` 150–200 字、抉择 `scene` 181–234 字）按 220ms/字换算后本就超过 25000ms——
若保留原上限，静音 / 音频缺失路径下几乎每一幕都会被这个估时钳位本身截断，而不是真的按文本
长度配速，与"跟随解说节奏"的设计初衷相悖。抬高后，静音 / 无音频路径下单幕停留最长可达约
65–90 秒（按文本长度浮动），不再是统一的 25 秒封顶。这是刻意的行为变更而非缺陷：静音时观众
仍在看画面，按解说长度配速才不会把画面赶过去，原 25s 上限偏快。真正防止整场卡死的仍是与此
独立的 §5.3 硬上限 `HARD_CAP_MS`（180000ms），不受这次调整影响。

**浏览器自动播放策略**：放映由用户点击顶栏按钮启动，天然带用户手势，`Audio.play()` 不会被拒；这与 `bgm.js` 现有的"首次手势解锁"机制一致。

**放映中途静音**：`audio.js` 的 `setMuted()` 会派发 `shy:muted-changed`，`narration.js` 收到后立即 `stop()`，`SHY_VOICE.current` 变 `null`、`ended` 也不会派发——不处理的话导演会一直等到 `withCap` 的封顶时限才推进。

> **实现回写**：设计阶段设想静音后"改按字数估时的剩余时长继续走"，即还会再等一段按文本长度折算的时间。**实际代码不是这样**：`makeAudioEndWaiter` 把 `shy:muted-changed` 与 `ended`/`error` 挂在同一个 `done()` 收尾函数上（`js/autoplay.js` 的 `makeAudioEndWaiter`），命中任何一个都让 `waiter.promise` 立即 resolve。也就是说静音这一刻，本幕解说的等待**当场结束**，导演立即推进到下一步停顿——不是切到一段新的估时等待，是直接判定"本段播完"。

## 6. 两条镜头轨道

### 6.1 全景 360° 环绕（`choice.js`）

现有引擎的状态：`panoX` 是 `background-position-x`（负向左移），`panoTileW = 容器高 × 宽高比` 是单幅平铺宽度，`panoTick()` 是常驻 RAF，`applyPanoPos()` 用 `panoX % panoTileW` 取模落位。**位移整一个 `panoTileW` 即等于环绕 360° 一周。**

新增 orbit 子状态：

```js
panoOrbit = { fromX, delta: -panoTileW, elapsed: 0, durationMs, resolve }
```

- `panoTick()` 中若 `panoOrbit` 激活：累加 `elapsed`（暂停时不累加），`panoX = fromX + delta × ease(elapsed / durationMs)`，跳过环境漂移分支
- `ease`：两端各 12% 用 smoothstep、中段线性——起步与收尾不生硬，中段保持匀速环视
- orbit 期间 `onPanoPointerDown` 直接返回（拖拽在放映期整场禁用，见 §7.3），避免用户拖拽与镜头轨道打架
- 进度到 1 → `resolve(true)`，清空 `panoOrbit`，交还环境漂移
- `refs.bgPano.hidden` 为真（水墨降级或 Ken Burns 封面模式）→ **立即 `resolve(false)`**，导演跳过本段
- **转屏 / 视口变化**：`recomputePanoTileW()` 已绑在 `resize` 上。orbit 进行中 `panoTileW` 变化时按当前进度 `p` 重投影，但**保持 `elapsed` / `durationMs` 完全不变**（总时长不变，不按 `p` 重标定）：`delta` 直接换成新平铺宽度的整值 `-newTileW`，再把 `fromX` 平移到「`fromX + delta × ease(p)` 恰好等于当前 `panoX`」的位置——这样画面在切换的瞬间不跳变，且从这一刻起剩余行程自动等于新宽度的 `(1 - ease(p))` 倍。需要说明的是，跨越一次转屏之后，从环绕**起点**算起的累计位移是新旧平铺宽度按转屏发生时的 `ease(p)` 加权混合（记转屏时 `e = ease(p)`，累计位移为 `-(tileW_old × e + tileW_new × (1 - e))`），并不等于新宽度的一整周——代码保证的是"不跳变"与"剩余行程按新宽度折算"，不是"总位移恰好一周"；转屏本就是罕见事件，此处不做额外补偿
- **中途打断**：环绕途中被 `stopPano()` 打断（抉择被切换 / 关闭），仍在等待的 promise 以 `resolve(false)` 收尾，而不是放任导演一直 `await` 到 `withCap` 的封顶时限才继续

### 6.2 泼溅原地环视（`walkin.js`）

把 `open(choiceId)` 参数化为 `open(choiceId, opts)`。`opts.orbit` 存在时的差异：

| 方面 | 常规漫游 | 环视模式 |
|---|---|---|
| 渲染循环 | `renderer.render(); controls.update(camera)` | `renderer.render()`；不调 `controls.update()`，改为按进度写 `camera.rotation.y` |
| 相机 | `CAMERA_START[choiceId] \|\| CAMERA_START.default` 起始（两种模式共用同一行赋值，无分支），之后由 WASD 自由移动 | 起始机位相同，全程钉住只转不动 |
| 覆盖层 UI | 「回到抉择」按钮 + `WASD 移动 · Q/E 降升 · 鼠标环视 · Esc 返回抉择` 提示 | 隐去两者，改显一行「自动环视中」 |
| 退出 | 点按钮 / Esc | 转满一周自动 `close()` |

角度写法：

```js
camera.rotation.order = "YXZ";
camera.rotation.y = -2 * Math.PI * ease(elapsed / durationMs);
```

`ease` 与全景同款（两端 smoothstep、中段线性）。起始 yaw 为 0，与现有相机初始朝 `-z` 一致；一周结束时 `rotation.y` 回到 `-2π`，等价于起点。

`ensureSharedControls()` 仍照常调用（单例惰性创建，跨会话不重复挂监听器）——只是环视模式下不调用它的 `update()`，因此 SparkControls 内部那 6 个 document/window 监听器即便捕获到按键也不会移动相机。

**中途打断 / 加载失败 / 超时**：环视被提前关闭（`close()` 或被新会话顶掉）、`.spz` 加载失败、或 30s 超时未完成，`orbit()` 返回的 promise 同样以 `resolve(false)` 收尾；三种情况导演都不需要区分，一律视为"跳过本段，继续时间轴"，不会一直等到导演侧的封顶时限。

**隐藏退出按钮对既有焦点圈禁的连带影响**：`open()` 原有的焦点圈禁把焦点钉在「回到抉择」按钮（`exitBtn`）上——任何试图落到覆盖层之外的聚焦都会被拉回该按钮。环视模式把 `exitBtn.hidden = true` 之后，该按钮不再可聚焦，圈禁就失去了落点，因此环视模式下改把覆盖层自身设为圈禁目标（`overlay.tabIndex = -1`，`focusTarget = overlay`）；常规漫游模式的落点不变，仍是 `exitBtn`。

**为什么是原地转身而不是绕中心公转**：`.spz` 是从单一视点重建的高斯泼溅场景，重建体积之外没有数据。相机若沿半径 R 的圆周公转，很容易转出体积、露出空洞与破面，且 19 幕各自需要单独调半径与高度。原地 yaw 360° 永远在体积内部，零逐幕调参，观感稳定，且"站在历史现场转一圈环视四周"本身就是这个功能想要的叙事。

**暂停**：保持 `setAnimationLoop` 继续渲染（画面不黑），只停止 `elapsed` 累加（角度冻结）。

### 6.3 素材覆盖情况

| 抉择 | 全景图 | 泼溅模型 | 放映行为 |
|---|---|---|---|
| c01–c09、c11–c20（19 幕） | 有 | 有 | 全景环绕 + 泼溅环视 |
| c10、c21–c26（7 幕） | 有 | **无** | 只做全景环绕，跳过泼溅段 |

判定沿用现有 `SHY_WALKIN.probeAvailable(choiceId)`（WebGL2 检测 + `.spz` HEAD 探测 + 会话内缓存），不引入任何清单文件。将来补齐 `.spz` 丢进 `assets/world/` 即自动生效，放映代码无需改动。

不支持 WebGL2 的设备：`probeAvailable` 全部返回 false，放映退化为纯全景环绕，仍可完整看完。

### 6.4 实现补充：公共原语（`js/autoplay-kit.js`）

> 本节是设计阶段完全没有的内容，落地时才发现需要独立出来，一并补入文档。

两条镜头轨道共用的可暂停时基（`createClock()`）与位移缓动曲线（`orbitEase(p)`）没有落在
导演 `js/autoplay.js`，也没有各自写在 `js/choice.js` / `js/walkin.js` 里，而是独立成
`window.SHY_AUTOPLAY_KIT`（`js/autoplay-kit.js`）。理由两条：

- **时基值得单独测试**：可暂停、可取消、暂停期间"有效时间轴"不丢失剩余时长（§5.3）——这是
  整个放映功能里最容易写错的一块逻辑。朴素实现用 `clearTimeout` + 恢复时重开一个完整时长的
  定时器，每次暂停都会让恢复后的等待白等一遍全长。独立成模块后可以脱离整场两小时五十分钟的
  放映单独跑回归（Task 1 的自检即完全不依赖导演或任何镜头模块）。
- **缓动曲线被两个互不相识的模块共用**：`js/choice.js`（全景背景位移）与 `js/walkin.js`
  （泼溅相机 yaw）都要用同一条"两端 12% smoothstep、中段线性、端点精确为 0 与 1"的曲线，
  两处各写一份必然逐渐漂移。若把它放进导演，两条镜头轨道的实现就得反过来依赖自己的编排者
  才能拿到曲线——这是依赖倒置：镜头是被编排的一方，不该知道编排它的模块存在。独立成
  `js/autoplay-kit.js` 后，导演与两条镜头轨道都只是这份公共原语的平等消费者。

这也是脚本加载顺序里 `js/autoplay-kit.js` 必须早于 `js/choice.js` 的原因（见 §8）：
`choice.js` 的 `panoTick()` 在环绕子状态里直接调用 `window.SHY_AUTOPLAY_KIT.orbitEase`。

## 7. 交互设计

### 7.1 入口

顶栏 `#top-bar-actions` 在「舆图」与「终章」之间新增：

```html
<button id="btn-autoplay" type="button" aria-pressed="false">
  <span class="btn-label-full">自动放映</span><span class="btn-label-short">放映</span>
</button>
```

短标签沿用手机端顶栏既有的 `.btn-label-full` / `.btn-label-short` 双标签机制。放映中文案切为「停止放映」/「停止」，`aria-pressed="true"`。

> **实现回写（2026-08-06 续播功能落地）**：本节最初设计的"启动前弹一次 `window.confirm`"
> 已被替换。点击按钮走 `promptAndStart()`：若玩家存在可续起点（前沿下标落在
> `[1, events.length)` 内），弹出项目风格的三按钮小卡片（从头放映 / 从当前进度 / 取消），
> 按选择以 `start({resume: true|false})` 起播；若无可续起点（全新存档或已通关），不弹窗，
> 直接 `start({resume: false})`。`opts.skipConfirm` 与原生 `window.confirm` 一并移除。
> 弹窗形态、判据与验收细节见 `2026-08-05-autoplay-resume-design.md` §2。

### 7.2 放映指示条

固定在视口右下角（`position: fixed`，`bottom` 计入 `env(safe-area-inset-bottom)`，与项目既有安全区处理一致），`role="status"`：

```
● 放映中 · 第三章 · 第 17/93 幕  ｜  ⏸ 暂停  ｜  Esc 退出
```

计数器 `N/93` 只统计**事件幕**；章引言幕不占序号，播放引言时该段显示为 `第三章 · 引言`。

暂停时首段变为 `⏸ 已暂停 · 空格继续`，红点停止呼吸动画。指示条 z-index 高于 `.walkin-overlay`，保证泼溅环视段仍可见、仍可点暂停。

### 7.3 键盘与守卫

| 按键 / 操作 | 放映期行为 |
|---|---|
| `Esc` | 停止放映。导演在 **capture 阶段**注册监听（与 `walkin.js` 的 Esc 同款技巧），必然先于 `choice.js` 冒泡阶段的"抉择不可跳过"拦截，也先于 `walkin.js` 自己的捕获阶段 Esc（后者在 `open()` 时注册，导演在 `start()` 时注册且更早，同为捕获阶段按注册顺序触发）。导演处理后 `stopImmediatePropagation()` |
| `空格` | 暂停 ⇄ 继续。同样 capture 阶段拦截并阻止默认滚动 |
| `Enter` | 吞掉。`choice.js` 的 `onKeydown` 会把 Enter 映射为"点击 actions 里的按钮"，放映期误按会打乱时间轴 |
| 顶栏 星图 / 舆图 / 关于 / 终章 | toast「放映中，按 Esc 退出」并放弃切换。复用现有 `guardChoiceInProgress()` 的模式，新增一个同构的 `guardAutoplay()`，串在各按钮 handler 最前 |
| 顶栏 重新开始 | **不经 `guardAutoplay()`、不弹 toast**：`doRestart()` 直接先 `SHY_AUTOPLAY.stop()` 退出沙盒（还原真实存档），再走原有的清空确认流程——若也走 toast-并放弃，会让"重新开始"在放映中完全按不动 |
| 顶栏 静音 | 不受限。静音后解说停播，等待原语改按字数估时继续走（§5.4） |
| 顶栏 站标（`#app-title`） | 同样被 `guardAutoplay()` 拦截 |
| 全景拖拽 | 整场禁用。`onPanoPointerDown` 在放映期直接返回 |
| 事件卡 / 抉择面板上的鼠标点击 | 不打断放映（避免误触毁掉两小时的进度），也不产生额外效果——放映期这些按钮的点击由导演驱动，人工重复点击最多是提前触发一次同样的动作 |

### 7.4 `prefers-reduced-motion`

`choice.js` 已有该偏好的读取（命中时全景环境漂移停摆）。放映模式下命中该偏好：**跳过两段环绕**，改为全景静态展示 6s（不做泼溅段）。诚实降级，不硬转——对前庭敏感用户，24s 的匀速环绕正是最需要避免的运动。

### 7.5 视图切换的兜底

`app.js` 的 `showView()` 会派发 `shy:view-changing`。导演监听该事件：若放映期间视图被切到时间轴预期之外的目标（例如某个未被守卫拦住的路径），立即 `stop()` 优雅退出而非放任时间轴在错误视图上空转。

## 8. 影响面

| 文件 | 改动性质 |
|---|---|
| `js/autoplay-kit.js` | 新增（公共原语：可暂停/可取消时基 + 环绕缓动曲线，见 §6.4） |
| `js/autoplay.js` | 新增（导演） |
| `js/choice.js` | 新增 orbit 子状态与四个契约方法（`setAutoplayActive` / `setViewMode` / `setOrbitPaused` / `orbitPanorama`，另加非契约 `debugPano`）；`onPanoPointerDown` 加放映期短路 |
| `js/walkin.js` | `open()` 参数化 + 环视渲染循环 + `orbit()` 包装 + `setOrbitPaused` |
| `js/app.js` | 顶栏按钮与绑定、`guardAutoplay()`、放映期守卫串接、`showToast` 由私有函数公开为 `SHY_APP.showToast` |
| `index.html` | 新增顶栏按钮、`<script src="js/autoplay-kit.js">`、`<script src="js/autoplay.js">` |
| `css/main.css` | 指示条、`.is-auto-picking`、`.is-autoplay`（保留 AI 角标）、环视模式的 walkin UI 变体 |
| `.superpowers/sdd/shared-interfaces.md` | 契约增补：`SHY_AUTOPLAY_KIT`、`SHY_AUTOPLAY`、`SHY_CHOICE` 四方法、`SHY_WALKIN.orbit` |
| `autoplay-selftest.html` | 新增自检页；**不新建独立测试脚本**，复用既有 `tools/selftest-run.mjs` 运行（见 §9.1） |

**`.is-autoplay` 的作用**：现有 `.is-viewing` 规则会把 `.choice-ai-badge` 一并淡出。`.is-viewing`
只在观景（环绕）段为真，放映的其余时段不会叠加它——因此不需要单独一个 `.is-autoplay-orbit`
类：复合选择器 `.choice-overlay.is-autoplay.is-viewing .choice-ai-badge` 比基础规则
`.choice-overlay.is-viewing .choice-ai-badge` 多一个类选择器（两条选择器全由类选择器构成，
不含任何元素/标签选择器）——四个类 vs 三个类，特异度更高，足以盖过基础规则对
`.choice-ai-badge` 的隐藏，让 AI 角标在环绕全程可见，符合项目硬规则（AI 生成图必须标注）。

## 9. 验证

### 9.1 自动化验证：复用既有 `tools/selftest-run.mjs`

> **实现回写**：未新建 `tools/autoplay-smoke.mjs`。测试落在新页面 `autoplay-selftest.html`，
> 与既有 `walkin-selftest.html` 同形制——单页内联脚本，断言结果写进页面 `<pre id="out">` 的
> `textContent`；既有的 `tools/selftest-run.mjs` 用真实挂钟通过 CDP 轮询这段文本直至出现
> 「通过 N 项，失败 M 项」，不需要再写一个专门的冒烟脚本。

```
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

页面在任何项目脚本加载前，用页内内存对象顶替 `window.localStorage`（`Object.defineProperty`
覆写 getter），因此人工在浏览器里直接打开这个页面自检也不会污染真实的 `shanhe_save_v1`
存档（CDP 运行器本身另用独立 `user-data-dir`，双重保险）。

本功能落地时套件共 **117 条断言**，全绿、无 `PAGEERROR:`。覆盖点包括（不完全列举）：

> **实现回写（2026-08-06 续播功能落地后）**：`autoplay-selftest.html` 是持续追加的单页自检，
> 断言总数会随后续功能增长——续播功能落地后已增至 **208 条**（同样全绿、无 `PAGEERROR:`），
> 详见 `2026-08-05-autoplay-resume-design.md` §6。下文列出的仍是本功能自己的覆盖点。

1. 终态进入 `ending` 视图，且沙盒 `state.total === 3290`——26 个抉择全部首答正确的理论值：连击倍率按 `SHY_SCORE.comboMultiplier`（0–1→1.0、2→1.1、3→1.2、≥4→1.3）逐次累进，即 `100 + 100 + 110 + 120 + 22 × 130 = 3290`；不含史海钩沉加分（放映不展开 `details`，见 §1.2）。同时断言 `state.chapterEarned` 的 15 章全为「甲」
2. `stop()` 之后 `SHY_APP.state` 与启动前快照**深度相等**，且 `localStorage.shanhe_save_v1` 的字符串与启动前逐字节一致
3. 全程无未捕获异常、无 `unhandledrejection`（`walkin.js` 已有的 `"Worker terminate"` 窄域拦截不计）——`tools/selftest-run.mjs` 订阅 CDP 的异常事件兜底，任何未捕获异常都会体现为运行器输出里的 `PAGEERROR:` 行
4. 暂停语义：对时基的一次 `wait(1000)`，开始后 200ms 暂停、停 2000ms 后继续，实测墙钟耗时应 ≈ 3000ms（容差 ±150ms）。若为 ≈ 4000ms 说明恢复时重开了完整时长的定时器（§5.3 明确禁止的实现），若为 ≈ 1000ms 说明暂停对该等待未生效
5. 真实音频路径（非 `debugFast` 短路）：`waitNarration` 在等到 `audio.duration` 可用之前不会提前推进，且 `ended`/`error`/`shy:muted-changed` 监听器在 settle 前后净增为 0（§5.4 的 `estimateMs` 上限抬高正是从这条路径的排查中发现的，见该节）

### 9.2 镜头轨道单点断言

> **实现回写**：以下三条同样落在 `autoplay-selftest.html`（计入 §9.1 的 117 条），不是独立断言文件。具体参数与判据按实际写法回写，与设计阶段设想的数值有出入。

1. `SHY_CHOICE.orbitPanorama({durationMs: 600})` resolve 后，`panoX` 相对起点位移 ≈ `-panoTileW`（容差 1.5px）
2. `SHY_WALKIN.orbit("c01", {durationMs: 4000})` resolve 后，`SHY_WALKIN.isOpen() === false`；过程中以 50ms 间隔采样 `camera.rotation.y`，断言采到多帧、yaw 单调递减（只朝一个方向转，不来回摆）、且末次采样 `< -π`（已转过半圈以上）——不对 resolve 那一帧做精确到 `-2π` 的容差比对，因为采样间隔无法保证恰好命中 resolve 前最后一帧
3. 对约定的"永不放置模型" id `c99`（而非真实抉择 `c10`——用合成 id 避免这条断言的有效性系于"c10 将来会不会补模型"这类无关的数据变化）：`SHY_WALKIN.orbit("c99")` resolve(false) 且不创建覆盖层

### 9.3 人工验收

`node tools/serve.mjs` 后浏览器实跑，重点看三处观感：章引言幕的主题色切换是否顺滑、全景环绕接泼溅环视的衔接是否突兀、自动选中正确项的 800ms 高亮是否看得清。
