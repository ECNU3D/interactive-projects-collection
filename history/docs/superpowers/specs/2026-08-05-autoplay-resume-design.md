# 自动放映「从当前进度开始」 设计文档

- 日期：2026-08-05
- 状态：已实现（2026-08-06）· 自动化验证通过 · 人工验收待进行（见 §8，需真人在浏览器里逐项验证弹窗视觉、位置文案、起播观感、手机端安全区、存档安全）
- 需求来源：用户直接提出——自动放映目前只能从第一幕播到通关；希望支持从玩家当前进度接着放，并在点击顶栏「自动放映」时由用户选择走哪一种。

## 1. 背景

自动放映（`js/autoplay.js`）当前的行为：点顶栏按钮 → 若已有进度则弹一个原生 `window.confirm` 征求同意 → 无条件从第一幕开始，沙盒化播完全部 15 章 / 93 幕 / 26 个抉择到通关，约 2 小时 50 分。沙盒机制保证放映期间 `localStorage` 的 `shanhe_save_v1` 逐字节不变，退场时把玩家进度与得分原封还原。

本次新增第二种起点：从玩家当前的前沿事件接着放到结尾。

设计阶段最初曾提供过"托管游玩"（在真实存档上自动推进、正常计分解锁）这一选项并被用户否决；本次确认仍不采用——续播同样在沙盒里，退场后进度与得分原封不动。

### 1.1 已确认的取舍（用户逐条拍板）

| 决策点 | 结论 |
|---|---|
| 是否碰存档 | **仍然沙盒**。续播只是起点不同，退场后进度与得分原封不动，玩家可以先看完再自己玩 |
| 续播起点 | **直接从前沿那一幕起**，不重播所在章的开篇影片／章引言解说 |
| 选择 UI | **项目风格的三按钮小弹窗**（从头放映 / 从当前进度 / 取消），而非原生 `confirm` |

### 1.2 非目标

- 不做"托管游玩"（真实推进存档）。
- 不做从任意章节／任意幕起播的自由选点——只有"从头"与"从当前进度"两种。
- 不改变放映本身的编排（章引言幕、事件幕、抉择幕的两段环绕、暂停与停止）。
- 不改动 `chapter.intro` 文案、素材约定或既有的三层降级。

## 2. 入口与选择

### 2.1 何时弹窗

弹窗只在**存在可续起点**时出现；否则直接从头开播，不打扰玩家。

可续起点的判据是前沿事件下标：

```js
var frontier = (state.unlockedCount || 1) - 1;   // 既定约定：前沿下标 = unlockedCount - 1
var canResume = frontier > 0 && frontier < events.length;
```

- `frontier <= 0`：玩家还停在第一幕，"从当前进度"与"从头"完全等价，弹窗只是徒增一次点击。
- `frontier >= events.length`：玩家已通关（`doUnlock()` 在末幕把 `unlockedCount` 置为 `events.length + 1`），没有可续内容。

这两种情况都直接 `start({ resume: false })`。

注意这与现有的 `hasProgress()` 不是同一个判据：后者把"未解锁新节点但已有得分"（`total > 0`）也算作有进度，用于决定要不要弹原生确认框。`hasProgress()` 随原生确认框一并移除（见 §3）。

### 2.2 弹窗形态

宣纸质感小卡片，居中，遮罩层。三个按钮：

- **从头放映** — 完整播完 15 章约 2 小时 50 分
- **从当前进度** — 从第 N 幕接着放（N 为前沿幕的全局序号，文案里写出实际数字与所在章名）
- **取消**

卡片内写明一句「两种方式都不影响你的存档与得分，退出后进度原样恢复」——这是玩家最可能担心的事，不该让他们靠猜。

层级取 **`z-index: 450`**。既有分布：`#top-bar` / `.walkin-overlay` 20、`.modal-backdrop`(事件卡) 200、`.chapter-film-overlay` 400、`.shy-toast` 500、`.autoplay-indicator` 900。450 高于影片覆盖层与事件卡（弹窗须盖住它们），低于 toast（「放映中，按 Esc 退出」这类提示仍应可见）与放映指示条（弹窗出现时放映尚未开始，指示条不存在，但保持这一相对次序可免去将来的意外）。

键盘：`Esc` 关闭弹窗（等同"取消"）；打开即把焦点聚到「从当前进度」按钮上（更可能被选中的那个），焦点圈禁在卡片内。

## 3. 契约调整

把"询问用户"的职责从 `start()` 中拆出：

```js
window.SHY_AUTOPLAY = {
  promptAndStart(),   // 新增。有可续起点则弹窗并按选择调 start()；否则直接 start({resume:false})
  start(opts),        // opts 新增 resume（默认 false）；不再弹任何对话框
  stop(), togglePause(), isRunning(), isPaused(), debugState()   // 不变
};
```

- 顶栏按钮（`js/app.js`）由调 `start()` 改为调 `promptAndStart()`。
- 自检继续直接调 `start()`，天然绕过弹窗——这与现状一致，只是原来靠 `opts.skipConfirm` 绕过原生确认框，今后不再需要。

**`opts.skipConfirm` 随原生确认框一并删除**，连同模块级的 `CONFIRM_TEXT` 与 `hasProgress()`。该参数在 `autoplay-selftest.html` 中原有 **19 处**调用点，已随实现一并清理（保留一个永不生效的参数比清理它更糟——审查会（正确地）判为死参数）。

> **实现回写**：`promptAndStart()` 内部三条分支——"从当前进度"、"从头放映"、以及无可续起点时的直接开播——统一经
> `window.SHY_AUTOPLAY.start(...)` 调用，而不是直接调用闭包内的 `start(...)`（三者写法一致，均不走内部标识符）。
> 原因：`window.SHY_AUTOPLAY = { start: start }` 是模块初始化时把函数**值**拷进新对象的属性；外部（自检）重新
> 赋值 `window.SHY_AUTOPLAY.start` 只是替换那个属性，动不了闭包内的 `start` 标识符本身。若"无可续起点"分支改用
> 闭包内的 `start(...)` 直接调用，自检打的桩会被绕过，那条分支会在自检运行期间真的启动一场放映（`running=true`、
> 沙盒时钟真的跑起来），而不是像其余两个分支一样被记录调用参数的桩截获。三条分支统一走导出对象，写法也更一致。

**关于弹窗内部的章名查找**：渲染「从当前进度」按钮的位置文案（`第 N/93 幕 · 章名`）复用既有的 `chapterTitle(chapterId)`
（`renderIndicator()` 同款查找），未新增一个同构的 `chapterTitleOf()`——两者逐字节相同会构成 DRY 违规，已在实现落地
时合并为一个函数。

## 4. 沙盒起点（本次唯一有正确性风险之处）

`start()` 现在做两件事：`snapshot` 用于退场还原，`app().state` 换成沙盒态。续播模式下沙盒态要基于玩家当前存档，于是二者必须是**两份互相独立的深拷贝**：

```js
      snapshot = JSON.parse(JSON.stringify(app().state));
      savedSaveState = window.SHY_SCORE.saveState;
      window.SHY_SCORE.saveState = function () {};

      // 续播：沙盒态基于玩家当前存档，但必须是与 snapshot 相互独立的另一份深拷贝。
      // 若图省事写成 app().state = snapshot，放映过程中的推进会直接改到我们打算还原
      // 回去的那个对象——退场时"还原"的将是被放映改过的状态，玩家进度被悄悄改写。
      app().state = resume
        ? JSON.parse(JSON.stringify(snapshot))
        : window.SHY_SCORE.newState();
```

（`resume` 是模块级变量，在 `start()` 顶部由 `resume = !!opts.resume;` 赋值，此处读的是那一份，不是直接读 `opts.resume`——与 §5 时间轴起点读取的是同一个变量。）

这是整个沙盒机制要防的那类事故的一个新入口，必须有断言钉住（见 §6）。

其余进场步骤（劫持 `saveState`、`SHY_SCROLL.render()`、`refreshHud()`、`showView("scroll")`）与失败回滚逻辑均不变。退场路径（`stop()` → `restoreRealState()`）完全不变——它只认 `snapshot`，不关心沙盒态从哪来。

## 5. 时间轴起点

`runTimeline()` 当前从第 0 章第 0 幕开始，逐章逐幕推进。续播时按前沿下标跳过已完成的部分：

```js
  async function runTimeline() {
    var chapters = chaptersSorted();
    var allEvents = (data().events) || [];

    // 续播：跳到前沿那一幕。整章都在其之前的章直接跳过；所在章内跳过该幕之前的事件，
    // 并跳过该章的章引言（玩家已经历过这一章的开篇，用户明确选择"直接从第 N 幕起"）。
    // 其后各章一切照常，包括章引言。
    // resume 是模块级变量，与既有的 fast / skipOrbits / skipFilm 并列，在 start() 中
    // 由 opts.resume 赋值（`resume = !!opts.resume;`）；此处读的是那一份。
    var startIdx = resume ? Math.max(0, (app().state.unlockedCount || 1) - 1) : 0;

    for (var ci = 0; ci < chapters.length; ci++) {
      var ch = chapters[ci];
      var chEvents = eventsOfChapter(ch.id);
      if (!chEvents.length) continue;

      var lastIdx = allEvents.indexOf(chEvents[chEvents.length - 1]);
      if (lastIdx < startIdx) continue;            // 整章都在起点之前

      progress.chapterId = ch.id;
      var firstIdx = allEvents.indexOf(chEvents[0]);
      if (firstIdx >= startIdx) {                  // 该章此前从未播过：章引言照常。
                                                     // 涵盖两种情况——整章都在起点之后（firstIdx > startIdx），
                                                     // 或起点正好等于该章第一幕（firstIdx === startIdx，
                                                     // 即玩家还没看过这一章的任何内容，理应播引言）
        progress.phase = "intro";
        renderIndicator();
        await playChapterIntro(ch);
      }
      // firstIdx < startIdx：起点落在该章中段（真正的"起点所在章"）——跳过章引言

      for (var ei = 0; ei < chEvents.length; ei++) {
        var idx = allEvents.indexOf(chEvents[ei]);
        if (idx < startIdx) continue;              // 该幕之前的事件跳过
        progress.phase = "event";
        progress.eventIndex = idx;
        renderIndicator();
        await playEvent(chEvents[ei]);
      }
    }
    progress.phase = "ending";
    renderIndicator();
    await clock.wait(dwell(ENDING_HOLD_MS));
  }
```

**依赖的既有事实**：`SHY_DATA.events` 是 93 条，其按章分组顺序与 `SHY_DATA.chapters` 按 `order` 排序一致（每章事件在 `events` 数组中连续），因此"整章都在起点之前"可以只比较该章末事件的下标。这一点在自动放映功能实施时已核实过。

**起点即末幕的情形**：`frontier === events.length - 1` 时只播最后一幕，随后照常触发 `shy:enter-ending`。§2.1 的 `canResume` 判据允许这种情况，是合理的——玩家确实只剩一幕没看。

**起点恰好是某章第一幕的边界（`firstIdx === startIdx`）**：这种情况归入"该章此前从未播过"，会播放章引言——玩家确实还没看过这一章的任何内容。代码行为经走查正确，但当前断言套件（§6）没有专门覆盖这一边界；现有测试用的前沿（第 45 个下标，落在第 8 章「民初乱局与新文化运动」中段）落在章内部而非章首，不会触发这条分支。

## 6. 验证

沿用项目既有的「页内自检页 + `tools/selftest-run.mjs`」组合，在 `autoplay-selftest.html` 追加一段，断言：

```
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

实测结果：**通过 208 项，失败 0 项**，无 `PAGEERROR:`。基线是本次续播工作开始前的 173 条（2026-08-02
自动放映首发时为 117 条，其后章开篇影片功能追加到 173 条），续播共新增 **35 条**（沙盒起点 8 条、时间轴
起点跳过 10 条、入口弹窗 17 条）。另跑 `node tools/selftest-run.mjs http://localhost:8080/walkin-selftest.html 300`
（17/17）与 `node tools/responsive-check.mjs`（115/115）确认无回归，三者均无 `PAGEERROR:`。

**沙盒独立性（本次唯一的新失败模式，必须钉住）**
1. 以 `resume: true` 起播后，`app().state` 与内部 `snapshot` 不是同一个对象——改动沙盒态不会影响退场还原的结果。构造：起播后直接改 `app().state.total`，`stop()` 后断言真实 `state.total` 仍是启动前的值。
2. 续播全程跑完后，真实 `state` 与启动前快照深度相等，`localStorage.shanhe_save_v1` 逐字节不变。

**时间轴起点**
3. 造一个前沿在第 8 章（民初乱局与新文化运动）中段的存档，`resume: true` 起播，断言首个 `playEvent` 的 `eventIndex` 等于前沿下标。
4. 断言起点之前的幕一次都没播（用 `SHY_SCROLL.openEvent` 打桩计次，比对被调用的 id 集合）。
5. 断言起点所在章**未播**章引言，而其后各章**播了**章引言。判据不是直接数 `SHY_CHAPTER_FILM.play` 的调用次数——
   章引言幕优先播影片、影片成功时根本不会调 `SHY_VOICE.playFor`，若仍以 `playFor` 计次判断"播了引言"会漏判。
   实现改为把 `SHY_CHAPTER_FILM.play` 打桩成恒定 `resolve(false)`，强制走音频退回路径，再用 `SHY_VOICE.playFor`
   计次、比对章 id 序列，使这个判据成立。
6. `resume: false` 时行为与现状完全一致（15 章章引言全播、93 幕全播、满分 3290）——防止本次改动影响从头放映。

**弹窗**
7. 有可续起点时点顶栏按钮：弹窗出现且**未**立即开播。
8. 点「从当前进度」→ 以 `resume: true` 起播；点「从头放映」→ 以 `resume: false` 起播；点「取消」与按 `Esc` → 不开播且弹窗关闭。
9. 无可续起点（全新存档 / 已通关）时点按钮：**不弹窗**，直接从头开播。

**回归**
10. 既有断言全部保持通过；`skipConfirm` 的 19 处调用点清理后，相关断言的语义不得改变。

## 7. 影响面

| 文件 | 改动性质 |
|---|---|
| `js/autoplay.js` | `start()` 加 `resume`、去 `skipConfirm`/`CONFIRM_TEXT`/`hasProgress`；新增 `promptAndStart()` 与弹窗 DOM；`runTimeline()` 加起点跳过 |
| `js/app.js` | 顶栏按钮由 `start()` 改调 `promptAndStart()` |
| `css/main.css` | 弹窗样式（`z-index: 450`、安全区、手机断点） |
| `autoplay-selftest.html` | 清理 19 处 `skipConfirm`；追加本次断言段 |
| `.superpowers/sdd/shared-interfaces.md` | 契约增补（该文件被 gitignore，只写盘不提交） |
| `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md` | 回写 `start()` 契约变化与新增的 `promptAndStart()` |

## 8. 人工验收

自动化无法判断的部分，留给用户实跑：

1. 弹窗的视觉与游戏整体风格是否协调，三个按钮的主次是否清楚
2. 「从当前进度」按钮上写出的"第 N 幕 · 某某章"是否与玩家实际所在位置相符
3. 从中段起播时开场是否突兀（这是"不重播章引言"这一决定的实际检验）
4. 手机端弹窗是否被安全区／刘海影响，三个按钮是否都易于点中
5. 退出后进度与得分确实原封不动
