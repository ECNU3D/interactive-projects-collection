# 自动放映「从当前进度开始」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让自动放映除了「从头播完全程」之外，还能从玩家当前进度接着播到结尾，并在点击顶栏按钮时由用户选择。

**Architecture:** 把"询问用户"的职责从 `start()` 拆到新增的 `promptAndStart()`；`start()` 只认明确的 `opts.resume`。续播时沙盒态改用玩家存档的第二份独立深拷贝，`runTimeline()` 按前沿下标跳过已完成的章与幕。

**Tech Stack:** 原生 ES5 风格普通 `<script>`、无构建无依赖；测试沿用项目既有的「页内自检页 + `tools/selftest-run.mjs`」。

**设计文档：** `docs/superpowers/specs/2026-08-05-autoplay-resume-design.md`

## Global Constraints

以下约束来自设计文档与 `.superpowers/sdd/shared-interfaces.md`，**每个任务的要求都隐含包含本节**：

- **禁止 ES module / CDN / 构建步骤**。ES5 风格（`var`、`function`）；`async`/`await` 已在 `js/autoplay.js` 中使用，可延续。本项目唯一的 ES module 是既有的 `js/walkin.js`。
- **必须通过本地 HTTP 服务器运行**：`node tools/serve.mjs` → `http://localhost:8080`。**不得换用其他服务器**——项目自己的运行器设置了特定 MIME（`.mp4` → `video/mp4`）与 Range 支持，换成 `python3 -m http.server` 会掩盖问题（本项目已因此吃过一次亏）。
- **沙盒不变量**：放映期间 `localStorage` 的 `shanhe_save_v1` 必须**逐字节不变**；`stop()` 必须把玩家还原出沙盒。这是既有不变量，本次不得破坏。
- **续播仍在沙盒内**：不做"托管游玩"，退场后进度与得分原封不动。
- 注释用中文，解释"为什么"而非"是什么"。
- 提交信息用中文，前缀 `feat:` / `fix:` / `docs:`，结尾必须是：
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- **提交纪律**：只 `git add <本任务明确修改的文件>`，禁止 `git add -A` / `git add .`（工作区有 1.4 GB 未跟踪的 `.spz`、`productions/finals-reference/` 与 `productions/finals-hq/`）。

### 全局验证命令

```bash
# 终端 A：起服务器（整个实施过程保持运行）
node tools/serve.mjs

# 终端 B：跑自检
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望 `通过 N 项，失败 0 项`，且不得出现 `PAGEERROR:` 行。

**关于断言计数**：本计划各任务只写"当前总数 + 本任务新增条数"，不写硬性目标数字。实施时报**实际观测值**。**绝不允许为凑数增删或削弱断言。**（当前基线：**173** 条。）

**已知既有噪音**：泼溅场景销毁时 `vendor/spark.module.min.js` 偶发一条 `PAGEERROR: Error: No target`（栈全在 vendor 内），间歇出现、不影响任何断言。遇到记录但不视为回归，不要为它改动代码。

---

## File Structure

| 文件 | 责任 | 状态 |
|---|---|---|
| `js/autoplay.js` | 导演。本次改三处：`start()` 的开关与沙盒起点、`runTimeline()` 的起点跳过、新增 `promptAndStart()` 与弹窗 DOM | 修改（Task 1–3） |
| `js/app.js` | 顶栏按钮由 `start()` 改调 `promptAndStart()` | 修改（Task 3） |
| `css/main.css` | 弹窗样式 | 修改（Task 3） |
| `autoplay-selftest.html` | 清理 19 处 `skipConfirm`；逐任务追加断言 | 修改（Task 1–3） |
| `.superpowers/sdd/shared-interfaces.md` | 契约增补（被 gitignore，只写盘不提交） | 修改（Task 4） |
| `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md` | 回写 `start()` 契约变化与新增的 `promptAndStart()` | 修改（Task 4） |
| `docs/superpowers/specs/2026-08-05-autoplay-resume-design.md` | 回写为实际实现 | 修改（Task 4） |

**为什么按"沙盒起点 / 时间轴起点 / 入口弹窗"分三个任务**：三者的正确性关注点完全不同——第一个是数据安全（两份拷贝是否真的独立），第二个是编排逻辑（跳过范围是否精确），第三个是 UI 与交互（弹窗、焦点、按钮接线）。一个审查者完全可能认可正确的跳过逻辑而否决有数据风险的拷贝写法，反之亦然。

---

## Task 1: 沙盒起点与 `skipConfirm` 清理

**Files:**
- Modify: `js/autoplay.js`（模块级开关、`start()` 的签名与沙盒态、删除 `CONFIRM_TEXT`/`hasProgress()`）
- Modify: `autoplay-selftest.html`（清理 19 处 `skipConfirm`；追加 Task 1 断言段）

**Interfaces:**
- Consumes: 无（`js/autoplay.js` 既有内部结构）
- Produces:
  ```js
  window.SHY_AUTOPLAY.start(opts)
  // opts = { debugFast, skipOrbits, skipFilm, resume }
  //   resume: true  → 沙盒态基于玩家当前存档的独立深拷贝
  //   resume: false（默认）→ 沙盒态为 SHY_SCORE.newState()
  // 不再接受 opts.skipConfirm；start() 不再弹任何对话框
  ```

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 1：续播的沙盒起点 ============

// 造一个"玩家已推进到第 46 幕、且有得分"的真实存档
function makeResumeState() {
  return {
    unlockedCount: 46, total: 1234, combo: 3,
    answered: { c01: { firstTryCorrect: true, earned: 100, tries: 1, confirmed: true } },
    readExtra: { e0101: true }, litPersons: ["p_linzexu"],
    chapterEarned: { ch01: "甲", ch02: "乙" }, lastGradedChapter: "ch02", finished: false
  };
}

window.SHY_APP.state = makeResumeState();
window.SHY_SCORE.saveState(window.SHY_APP.state);
var rawBeforeResume = window.localStorage.getItem("shanhe_save_v1");
var stateBeforeResume = JSON.stringify(window.SHY_APP.state);

// resume:true —— 沙盒态应当继承玩家进度，而不是从零开始
A.start({ debugFast: true, resume: true });
ok(A.isRunning() === true, "resume 模式可以启动");
ok(window.SHY_APP.state.unlockedCount === 46,
   "续播沙盒态继承玩家的 unlockedCount，实际 " + window.SHY_APP.state.unlockedCount);
ok(window.SHY_APP.state.total === 1234,
   "续播沙盒态继承玩家的 total，实际 " + window.SHY_APP.state.total);

// 本次唯一的新失败模式：沙盒态与"用于还原的快照"必须是两份互相独立的深拷贝。
// 若实现写成 app().state = snapshot，下面这行改动会直接改到打算还原回去的那个对象，
// 退场时"还原"的将是被放映改过的状态——玩家进度被悄悄改写。
window.SHY_APP.state.total = 999999;
window.SHY_APP.state.unlockedCount = 99;
A.stop();
ok(JSON.stringify(window.SHY_APP.state) === stateBeforeResume,
   "改动续播沙盒态不影响退场还原（两份拷贝相互独立）");
ok(window.SHY_APP.state.total === 1234,
   "退场后 total 仍是启动前的 1234，实际 " + window.SHY_APP.state.total);
ok(window.localStorage.getItem("shanhe_save_v1") === rawBeforeResume,
   "续播全程 localStorage 逐字节未变");

// resume:false（默认）仍是全新状态，不受本次改动影响
window.SHY_APP.state = makeResumeState();
A.start({ debugFast: true });
ok(window.SHY_APP.state.unlockedCount === 1 && window.SHY_APP.state.total === 0,
   "resume 省略时仍为全新沙盒态（unlockedCount=" + window.SHY_APP.state.unlockedCount +
   " total=" + window.SHY_APP.state.total + "）");
A.stop();
ok(window.SHY_APP.state.total === 1234, "从头模式退场后同样原样还原");
```

- [ ] **Step 2: 清理 19 处 `skipConfirm`**

`autoplay-selftest.html` 中所有 `A.start({...})` 调用都带着 `skipConfirm: true`。该参数即将失去意义（`start()` 不再弹对话框），必须一并删除。

逐处把 `skipConfirm: true, ` 或 `, skipConfirm: true` 从对象字面量中移除，**不要改动同一对象里的其他属性**。改完核对：

```bash
grep -c "skipConfirm" autoplay-selftest.html js/autoplay.js
```

期望两个文件都是 `0`。

- [ ] **Step 3: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：既有 173 项仍通过（`skipConfirm` 只是被忽略的多余参数，删掉不改变任何既有断言的语义）；Task 1 段的续播断言失败——`start()` 还不认识 `opts.resume`，沙盒态仍是 `newState()`，`unlockedCount` 会是 1 而非 46。

长测试放后台并**自己轮询输出文件直到拿到结果行**——这个 harness 不会在后台命令结束时唤醒你。

- [ ] **Step 4: 加模块级 `resume` 开关**

在 `js/autoplay.js` 的模块级变量区，`var skipFilm = false;` 那一行之后追加：

```js
  var resume = false;      // 续播：沙盒态基于玩家当前存档而非全新状态，时间轴从前沿那一幕起
```

- [ ] **Step 5: 改写 `start()` 的开关赋值与沙盒态**

把 `start()` 中 `skipFilm = opts.skipFilm == null ? fast : !!opts.skipFilm;` 之后补一行：

```js
    resume = !!opts.resume;
```

再把 try 块里的沙盒态赋值由

```js
      app().state = window.SHY_SCORE.newState();
```

替换为

```js
      // 续播：沙盒态基于玩家当前存档，但必须是与 snapshot 相互独立的**另一份**深拷贝。
      // 若图省事写成 app().state = snapshot，放映过程中的推进会直接改到我们打算还原
      // 回去的那个对象——退场时"还原"的将是被放映改过的状态，玩家进度被悄悄改写。
      // 这正是整个沙盒机制要防的那类事故。
      app().state = resume
        ? JSON.parse(JSON.stringify(snapshot))
        : window.SHY_SCORE.newState();
```

- [ ] **Step 6: 删除原生确认框及其配套**

删除 `start()` 中这一行：

```js
    if (!opts.skipConfirm && hasProgress() && !window.confirm(CONFIRM_TEXT)) return false;
```

删除模块级的 `CONFIRM_TEXT` 常量（在文件顶部常量区，以 `var CONFIRM_TEXT =` 开头的多行字符串）与 `hasProgress()` 函数（约 77 行起的整个函数体）。

删完核对无残留引用：

```bash
grep -n "CONFIRM_TEXT\|hasProgress\|skipConfirm" js/autoplay.js
```

期望：无输出。

- [ ] **Step 7: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：0 失败、无 `PAGEERROR:`。报实际总数（应为 173 + 8）。

- [ ] **Step 8: 提交**

```bash
git add js/autoplay.js autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 自动放映支持 resume 起点，移除原生确认框

start() 新增 opts.resume：为真时沙盒态基于玩家当前存档，而非 newState()。
关键是它必须是与还原用 snapshot 相互独立的第二份深拷贝——写成 state =
snapshot 的话，放映中的推进会改到打算还原回去的那个对象，玩家进度被悄悄
改写，正是沙盒机制要防的那类事故。已加断言钉住。

同时移除 start() 里的 window.confirm 及其配套的 CONFIRM_TEXT / hasProgress，
询问用户的职责将移交给后续任务新增的 promptAndStart()。opts.skipConfirm
随之失去意义，连同自检里 19 处调用点一并清理——留一个永不生效的参数比
清理它更糟。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 时间轴起点跳过

**Files:**
- Modify: `js/autoplay.js`（`runTimeline()`）
- Modify: `autoplay-selftest.html`（追加 Task 2 断言段）

**Interfaces:**
- Consumes: Task 1 的模块级 `resume` 变量
- Produces: 无新增对外接口；`runTimeline()` 在 `resume` 为真时从前沿那一幕起

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 2：续播的时间轴起点 ============

// 打桩记录实际播了哪些幕与哪些章引言。真跑不适合放进自检，要验的是跳过范围是否精确。
var playedEvents = [];
var playedIntros = [];
var realOpenEvent = window.SHY_SCROLL.openEvent;
var realFilmPlay = window.SHY_CHAPTER_FILM.play;
var realVoicePlayFor = window.SHY_VOICE.playFor;
window.SHY_SCROLL.openEvent = function (id) { playedEvents.push(id); return realOpenEvent.call(window.SHY_SCROLL, id); };
// 章引言幕会播影片或退回音频，两条路都记：影片打桩返回 false 迫使走音频路径，
// 音频路径的 playFor(ch.id) 即"这一章播了引言"的判据。
window.SHY_CHAPTER_FILM.play = function () { return Promise.resolve(false); };
window.SHY_VOICE.playFor = function (id) {
  if (/^ch\d\d$/.test(id)) playedIntros.push(id);
  return realVoicePlayFor.call(window.SHY_VOICE, id);
};

var allEvents = window.SHY_DATA.events;
var resumeFrontier = 45;              // 前沿下标 45 → unlockedCount 46 → 第 46 幕
window.SHY_APP.state = makeResumeState();   // unlockedCount = 46，见 Task 1
A.start({ debugFast: true, resume: true });
var resumeEnded = false;
for (var ri = 0; ri < 3000; ri++) {
  await sleep(100);
  if (!A.isRunning()) { resumeEnded = true; break; }
}
window.SHY_SCROLL.openEvent = realOpenEvent;
window.SHY_CHAPTER_FILM.play = realFilmPlay;
window.SHY_VOICE.playFor = realVoicePlayFor;

ok(resumeEnded === true, "续播在 300s 内跑完");
ok(playedEvents[0] === allEvents[resumeFrontier].id,
   "首个播出的幕是前沿那一幕（期望 " + allEvents[resumeFrontier].id + "，实际 " + playedEvents[0] + "）");
ok(playedEvents.length === allEvents.length - resumeFrontier,
   "播出的幕数 = 93 − 45 = 48，实际 " + playedEvents.length);

var playedBefore = playedEvents.filter(function (id) {
  return allEvents.findIndex(function (e) { return e.id === id; }) < resumeFrontier;
});
ok(playedBefore.length === 0,
   "起点之前的幕一次都没播，实际漏播 " + playedBefore.length + " 幕：" + playedBefore.join(","));

// 起点所在章不播引言；其后各章照常播
var frontierChapterId = allEvents[resumeFrontier].chapterId;
ok(playedIntros.indexOf(frontierChapterId) === -1,
   "起点所在章（" + frontierChapterId + "）未播章引言");
var chaptersAfter = window.SHY_DATA.chapters.slice().sort(function (a, b) { return a.order - b.order; })
  .filter(function (c) {
    var first = allEvents.findIndex(function (e) { return e.chapterId === c.id; });
    return first >= resumeFrontier;
  });
ok(playedIntros.length === chaptersAfter.length,
   "其后各章章引言全播（期望 " + chaptersAfter.length + "，实际 " + playedIntros.length + "）");

// resume:false 不受影响：15 章引言全播、93 幕全播
playedEvents.length = 0; playedIntros.length = 0;
window.SHY_SCROLL.openEvent = function (id) { playedEvents.push(id); return realOpenEvent.call(window.SHY_SCROLL, id); };
window.SHY_CHAPTER_FILM.play = function () { return Promise.resolve(false); };
window.SHY_VOICE.playFor = function (id) {
  if (/^ch\d\d$/.test(id)) playedIntros.push(id);
  return realVoicePlayFor.call(window.SHY_VOICE, id);
};
window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true });
var fullEnded = false;
for (var rj = 0; rj < 3000; rj++) {
  await sleep(100);
  if (!A.isRunning()) { fullEnded = true; break; }
}
window.SHY_SCROLL.openEvent = realOpenEvent;
window.SHY_CHAPTER_FILM.play = realFilmPlay;
window.SHY_VOICE.playFor = realVoicePlayFor;

ok(fullEnded === true, "从头放映仍能跑完全程");
ok(playedEvents.length === 93, "从头模式播满 93 幕，实际 " + playedEvents.length);
ok(playedIntros.length === 15, "从头模式播满 15 章引言，实际 " + playedIntros.length);
ok(A.debugState().lastRun.total === 3290,
   "从头模式仍是满分 3290，实际 " + A.debugState().lastRun.total);
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：Task 1 段仍通过；Task 2 的续播断言失败——`runTimeline()` 还是从第 0 幕开始，`playedEvents[0]` 会是 `e0101` 而非第 46 幕，`playedEvents.length` 会是 93 而非 48。

长测试放后台并**自己轮询输出文件直到拿到结果行**。

- [ ] **Step 3: 改写 `runTimeline()`**

把 `js/autoplay.js` 中现有的 `runTimeline` 整体替换为：

```js
  async function runTimeline() {
    var chapters = chaptersSorted();
    var allEvents = (data().events) || [];

    // 续播：跳到前沿那一幕。整章都在其之前的章直接跳过；所在章内跳过该幕之前的事件，
    // 并跳过该章的章引言——玩家已经历过这一章的开篇，用户明确选择"直接从第 N 幕起"。
    // 其后各章一切照常，包括章引言。
    // 依赖既有事实：events 按章分组的顺序与 chapters 按 order 排序一致（每章事件在
    // events 数组中连续），因此"整章都在起点之前"只需比较该章末事件的下标。
    var startIdx = resume ? Math.max(0, (app().state.unlockedCount || 1) - 1) : 0;

    for (var ci = 0; ci < chapters.length; ci++) {
      var ch = chapters[ci];
      var chEvents = eventsOfChapter(ch.id);
      if (!chEvents.length) continue;

      var lastIdx = allEvents.indexOf(chEvents[chEvents.length - 1]);
      if (lastIdx < startIdx) continue;

      progress.chapterId = ch.id;
      var firstIdx = allEvents.indexOf(chEvents[0]);
      if (firstIdx >= startIdx) {
        progress.phase = "intro";
        renderIndicator();
        await playChapterIntro(ch);
      }

      for (var ei = 0; ei < chEvents.length; ei++) {
        var idx = allEvents.indexOf(chEvents[ei]);
        if (idx < startIdx) continue;
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

- [ ] **Step 4: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：0 失败、无 `PAGEERROR:`。报实际总数（应为上一任务总数 + 10）。

若续播的幕数不是 48，**不要改断言**——用 `A.debugState().eventIndex` 查跳过范围算错在哪一侧。

- [ ] **Step 5: 提交**

```bash
git add js/autoplay.js autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 续播时间轴从前沿那一幕起

整章都在起点之前的章直接跳过；所在章内跳过该幕之前的事件，并跳过该章的
章引言（玩家已经历过这一章的开篇）。其后各章一切照常。

"整章都在起点之前"只比较该章末事件的下标，依据是既有事实：events 按章
分组的顺序与 chapters 按 order 排序一致，每章事件在数组中连续。

断言同时钉住 resume:false 不受影响——15 章引言全播、93 幕全播、满分 3290。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 入口弹窗

**Files:**
- Modify: `js/autoplay.js`（新增 `promptAndStart()` 与弹窗 DOM）
- Modify: `js/app.js`（顶栏按钮改调 `promptAndStart()`）
- Modify: `css/main.css`（弹窗样式）
- Modify: `autoplay-selftest.html`（追加 Task 3 断言段）

**Interfaces:**
- Consumes: Task 1 的 `start(opts)` 与 `opts.resume`
- Produces:
  ```js
  window.SHY_AUTOPLAY.promptAndStart()
  // 有可续起点则弹窗，按选择调 start({resume:bool})；否则直接 start({resume:false})
  ```
  DOM 契约：`.autoplay-prompt-backdrop`、`.autoplay-prompt-fresh`、`.autoplay-prompt-resume`、`.autoplay-prompt-cancel`

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 3：入口弹窗 ============

var apBtn2 = document.getElementById("btn-autoplay");
ok(typeof A.promptAndStart === "function", "SHY_AUTOPLAY.promptAndStart 已导出");

// 有可续起点：点按钮应弹窗，且不立即开播
window.SHY_APP.state = makeResumeState();
apBtn2.click();
await sleep(150);
var prompt1 = document.querySelector(".autoplay-prompt-backdrop");
ok(prompt1 !== null, "有可续起点时点顶栏按钮弹出选择框");
ok(A.isRunning() === false, "弹窗出现时尚未开播");
ok(prompt1.querySelector(".autoplay-prompt-resume") !== null
   && prompt1.querySelector(".autoplay-prompt-fresh") !== null
   && prompt1.querySelector(".autoplay-prompt-cancel") !== null,
   "三个按钮齐备");
ok(prompt1.contains(document.activeElement), "打开即把焦点圈进弹窗");

// 取消：不开播，弹窗关闭
prompt1.querySelector(".autoplay-prompt-cancel").click();
await sleep(150);
ok(document.querySelector(".autoplay-prompt-backdrop") === null, "点取消关闭弹窗");
ok(A.isRunning() === false, "点取消不开播");

// Esc 等同取消
apBtn2.click();
await sleep(150);
ok(document.querySelector(".autoplay-prompt-backdrop") !== null, "再次弹窗");
document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
await sleep(150);
ok(document.querySelector(".autoplay-prompt-backdrop") === null, "Esc 关闭弹窗");
ok(A.isRunning() === false, "Esc 不开播");

// 从当前进度：以 resume:true 起播
var promptResumeCalls = [];
var realStart = A.start;
window.SHY_AUTOPLAY.start = function (opts) { promptResumeCalls.push(!!(opts && opts.resume)); return false; };
apBtn2.click();
await sleep(150);
document.querySelector(".autoplay-prompt-resume").click();
await sleep(150);
ok(promptResumeCalls.length === 1 && promptResumeCalls[0] === true,
   "点「从当前进度」以 resume:true 调 start，实际 " + JSON.stringify(promptResumeCalls));
ok(document.querySelector(".autoplay-prompt-backdrop") === null, "选择后弹窗关闭");

// 从头放映：以 resume:false 起播
promptResumeCalls.length = 0;
apBtn2.click();
await sleep(150);
document.querySelector(".autoplay-prompt-fresh").click();
await sleep(150);
ok(promptResumeCalls.length === 1 && promptResumeCalls[0] === false,
   "点「从头放映」以 resume:false 调 start，实际 " + JSON.stringify(promptResumeCalls));

// 无可续起点（全新存档）：不弹窗，直接从头开播
promptResumeCalls.length = 0;
window.SHY_APP.state = window.SHY_SCORE.newState();
apBtn2.click();
await sleep(150);
ok(document.querySelector(".autoplay-prompt-backdrop") === null, "全新存档不弹窗");
ok(promptResumeCalls.length === 1 && promptResumeCalls[0] === false,
   "全新存档直接以 resume:false 开播，实际 " + JSON.stringify(promptResumeCalls));

// 已通关：同样不弹窗
promptResumeCalls.length = 0;
var finishedState = window.SHY_SCORE.newState();
finishedState.unlockedCount = window.SHY_DATA.events.length + 1;
finishedState.finished = true;
window.SHY_APP.state = finishedState;
apBtn2.click();
await sleep(150);
ok(document.querySelector(".autoplay-prompt-backdrop") === null, "已通关不弹窗");
ok(promptResumeCalls.length === 1 && promptResumeCalls[0] === false,
   "已通关直接以 resume:false 开播，实际 " + JSON.stringify(promptResumeCalls));

window.SHY_AUTOPLAY.start = realStart;
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：Task 1–2 段仍通过；Task 3 段在 `A.promptAndStart is not a function` 处失败。

长测试放后台并**自己轮询输出文件直到拿到结果行**。

- [ ] **Step 3: 在 `js/autoplay.js` 加弹窗与 `promptAndStart()`**

在 `js/autoplay.js` 的指示条相关函数（`mountIndicator` / `unmountIndicator`）之后追加：

```js
  // ------------------------- 入口弹窗 -------------------------

  var promptEl = null;
  var promptOnKeydown = null;
  var promptOnFocusIn = null;

  // 可续起点的判据是前沿下标落在 [1, events.length) 内：
  //   frontier <= 0        玩家还在第一幕，"从当前进度"与"从头"等价，弹窗只是多一次点击
  //   frontier >= 总幕数    已通关（doUnlock 在末幕把 unlockedCount 置为 length+1），无可续内容
  // 这与既有的 hasProgress()（已删除）不是同一判据——后者把"没解锁新节点但有得分"也算
  // 有进度，那种情况下弹窗的两个选项其实完全等价。
  function resumeFrontier() {
    var st = app() && app().state;
    var total = ((data().events) || []).length;
    if (!st || !total) return -1;
    var frontier = (st.unlockedCount || 1) - 1;
    return frontier > 0 && frontier < total ? frontier : -1;
  }

  function chapterTitleOf(chapterId) {
    var list = (data().chapters) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === chapterId) return list[i].title;
    }
    return "";
  }

  function closePrompt() {
    if (promptOnKeydown) {
      document.removeEventListener("keydown", promptOnKeydown, true); // 与注册时的捕获阶段配对
      promptOnKeydown = null;
    }
    if (promptOnFocusIn) {
      document.removeEventListener("focusin", promptOnFocusIn);
      promptOnFocusIn = null;
    }
    if (promptEl && promptEl.parentNode) promptEl.parentNode.removeChild(promptEl);
    promptEl = null;
  }

  function promptAndStart() {
    if (running) return;
    closePrompt(); // 防御式：上一次若因异常路径未关闭，先清理

    var frontier = resumeFrontier();
    if (frontier < 0) {
      start({ resume: false });
      return;
    }

    var events = (data().events) || [];
    var ev = events[frontier];
    var where = "第 " + (frontier + 1) + "/" + events.length + " 幕 · " +
      chapterTitleOf(ev && ev.chapterId);

    promptEl = document.createElement("div");
    promptEl.className = "autoplay-prompt-backdrop";
    promptEl.setAttribute("role", "dialog");
    promptEl.setAttribute("aria-modal", "true");
    promptEl.setAttribute("aria-label", "选择放映方式");
    promptEl.innerHTML =
      '<div class="autoplay-prompt-card">' +
      '<h3 class="autoplay-prompt-title">自动放映</h3>' +
      '<p class="autoplay-prompt-note">两种方式都不影响你的存档与得分，退出后进度原样恢复。</p>' +
      '<button type="button" class="autoplay-prompt-resume">从当前进度<span class="autoplay-prompt-sub">' +
      escapeHtmlSafe(where) + "</span></button>" +
      '<button type="button" class="autoplay-prompt-fresh">从头放映<span class="autoplay-prompt-sub">' +
      "完整播完 15 章，约 2 小时 50 分</span></button>" +
      '<button type="button" class="autoplay-prompt-cancel">取消</button>' +
      "</div>";
    document.body.appendChild(promptEl);

    promptEl.querySelector(".autoplay-prompt-resume").addEventListener("click", function () {
      closePrompt();
      window.SHY_AUTOPLAY.start({ resume: true });
    });
    promptEl.querySelector(".autoplay-prompt-fresh").addEventListener("click", function () {
      closePrompt();
      window.SHY_AUTOPLAY.start({ resume: false });
    });
    promptEl.querySelector(".autoplay-prompt-cancel").addEventListener("click", closePrompt);

    // 捕获阶段注册：与放映期的 Esc（停止整场）走的是不同时机——此刻 running 为 false，
    // onKeydownCapture 会早退，两者不会争抢。
    promptOnKeydown = function (e) {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        e.stopImmediatePropagation();
        closePrompt();
      }
    };
    document.addEventListener("keydown", promptOnKeydown, true);

    // 焦点圈禁：默认聚到「从当前进度」——玩家点开这个弹窗时更可能想接着看
    var focusTarget = promptEl.querySelector(".autoplay-prompt-resume");
    focusTarget.focus();
    promptOnFocusIn = function (e) {
      if (!promptEl) return;
      if (promptEl.contains(e.target)) return;
      focusTarget.focus();
    };
    document.addEventListener("focusin", promptOnFocusIn);
  }
```

**注意**：上面用到的 `escapeHtmlSafe` 在 `js/autoplay.js` 中尚不存在。章名来自 `data/chapters.js`（受控数据，非用户输入），但拼进 `innerHTML` 仍应转义——在同一文件的工具函数区补一个：

```js
  function escapeHtmlSafe(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
```

并把 `promptAndStart` 加进文件末尾的导出对象：

```js
    promptAndStart: promptAndStart,
```

`stop()` 的 `teardownScene()` 中追加一行，保证异常路径下弹窗不残留：

```js
    closePrompt();
```

- [ ] **Step 4: 顶栏按钮改调 `promptAndStart()`**

在 `js/app.js` 的 `#btn-autoplay` 点击处理器中，把

```js
        window.SHY_AUTOPLAY.start();
```

替换为

```js
        window.SHY_AUTOPLAY.promptAndStart();
```

其余逻辑（放映中点按钮即停止、`guardChoiceInProgress()` 只对"开始放映"设防）保持不变。

- [ ] **Step 5: 加弹窗样式**

在 `css/main.css` 末尾追加：

```css
/* ---- 自动放映入口弹窗 ---- */

/* z-index 450：高于章开篇影片覆盖层(400)与事件卡(200)，低于 toast(500) 与放映指示条(900)。
   弹窗出现时放映尚未开始、指示条不存在，但保持这一相对次序可免去将来的意外。 */
.autoplay-prompt-backdrop {
  position: fixed;
  inset: 0;
  z-index: 450;
  background: rgba(20, 14, 8, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
           max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  backdrop-filter: blur(3px);
}

.autoplay-prompt-card {
  width: min(360px, 100%);
  padding: 22px 22px 18px;
  border-radius: 4px;
  background: var(--c-bg, #f4ead6);
  border: 1px solid rgba(42, 35, 26, 0.28);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
  color: var(--c-ink, #2a231a);
}

.autoplay-prompt-title {
  margin: 0 0 8px;
  font-size: 17px;
  letter-spacing: 0.12em;
}

.autoplay-prompt-note {
  margin: 0 0 16px;
  font-size: 12.5px;
  line-height: 1.7;
  opacity: 0.75;
}

.autoplay-prompt-card button {
  display: block;
  width: 100%;
  margin-bottom: 9px;
  padding: 11px 14px;
  border-radius: 3px;
  border: 1px solid rgba(42, 35, 26, 0.3);
  background: rgba(255, 255, 255, 0.45);
  color: inherit;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  min-height: 44px; /* 触控热区，与项目既有的 44×44 约定一致 */
}
.autoplay-prompt-card button:hover { border-color: var(--c-gold, #c8a24a); }

/* 「从当前进度」是更可能被选中的那个，给它主按钮的分量 */
.autoplay-prompt-resume {
  border-color: var(--c-gold, #c8a24a) !important;
  background: rgba(200, 162, 74, 0.16) !important;
}

.autoplay-prompt-sub {
  display: block;
  margin-top: 3px;
  font-size: 11.5px;
  opacity: 0.66;
}

.autoplay-prompt-cancel {
  margin-bottom: 0 !important;
  text-align: center !important;
  opacity: 0.7;
}

@media (max-width: 600px) {
  .autoplay-prompt-card { padding: 18px 16px 14px; }
  .autoplay-prompt-title { font-size: 16px; }
}
```

- [ ] **Step 6: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：0 失败、无 `PAGEERROR:`。报实际总数（应为上一任务总数 + 18）。

- [ ] **Step 7: 回归响应式检查**

```bash
node tools/responsive-check.mjs
```

弹窗是按需创建的，静态页面上不存在，该套件不会进入放映，因此预期不受影响、仍为 115/115。若有失败，说明改动意外影响了静态布局，须查明而非放宽断言。

- [ ] **Step 8: 提交**

```bash
git add js/autoplay.js js/app.js css/main.css autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 自动放映入口弹窗（从头 / 从当前进度 / 取消）

顶栏按钮改调 promptAndStart()：有可续起点时弹项目风格的三按钮卡片，并写明
两种方式都不影响存档；无可续起点（还在第一幕 / 已通关）时不弹窗，直接从头
开播——那种情况下两个选项完全等价，弹窗只是多一次点击。

「从当前进度」按钮上写出实际位置（第 N/93 幕 · 章名），默认聚焦于它。
Esc 等同取消。焦点圈禁在卡片内。z-index 450：高于影片覆盖层与事件卡，
低于 toast 与放映指示条。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 契约与文档回写

**Files:**
- Modify: `.superpowers/sdd/shared-interfaces.md`（被 `.gitignore` 排除，只写盘不提交）
- Modify: `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md`
- Modify: `docs/superpowers/specs/2026-08-05-autoplay-resume-design.md`

**Interfaces:**
- Consumes: Task 1–3 的全部产出
- Produces: 无代码接口

- [ ] **Step 1: 更新 `.superpowers/sdd/shared-interfaces.md`**

在文末追加：

```markdown
## 契约增补（自动放映续播落地后）

- `window.SHY_AUTOPLAY.start(opts)`：`opts = { debugFast, skipOrbits, skipFilm, resume }`。
  `resume: true` 时沙盒态基于玩家当前存档的**独立深拷贝**（不是 snapshot 本身），
  时间轴从前沿那一幕起、跳过所在章的章引言；`resume` 省略或为 false 时行为与原先一致。
  **`opts.skipConfirm` 已移除**，`start()` 不再弹任何对话框。
- `window.SHY_AUTOPLAY.promptAndStart()`：新增。有可续起点（前沿下标落在 `[1, events.length)`）
  时弹出选择弹窗，按选择调 `start({resume})`；否则直接 `start({resume:false})`。
  顶栏 `#btn-autoplay` 走这个入口，自检直接调 `start()` 绕过弹窗。
- DOM 契约：`.autoplay-prompt-backdrop` / `.autoplay-prompt-resume` / `.autoplay-prompt-fresh`
  / `.autoplay-prompt-cancel`，`z-index: 450`。
```

- [ ] **Step 2: 回写自动放映设计文档**

编辑 `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md`：

1. §3.1 的 `SHY_AUTOPLAY` 契约块：删去 `skipConfirm`，加上 `resume`，并新增 `promptAndStart()` 一行及其说明。
2. §7.1「入口」一节：原文描述的是"启动前若玩家已有进度，弹一次 `window.confirm`"。改为描述新的三按钮弹窗，并说明无可续起点时不弹。
3. 通读全文，若还有别处提到 `skipConfirm` 或原生确认框，一并改准确。

- [ ] **Step 3: 回写本次设计文档**

编辑 `docs/superpowers/specs/2026-08-05-autoplay-resume-design.md`：

1. 状态字段改为：`已实现（2026-08-06）· 自动化验证通过 · 人工验收待进行`
2. §6 补上自检套件的**实际**总条数（自己数或从测试输出读，不要照抄任何文档里的数字）
3. 通读全文，把任何与落地实现不符之处改准确

- [ ] **Step 4: 跑完整验证套件**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
node tools/selftest-run.mjs http://localhost:8080/walkin-selftest.html 300
node tools/responsive-check.mjs
```

三者必须全绿。把三条命令的**实际输出粘进任务报告**，不得只写"通过"。

跑之前先确认服务器身份（项目自己的服务器不发 `Server:` 头）：

```bash
curl -sI http://localhost:8080/index.html | grep -i "^server:" || echo "无 Server 头 → 项目自己的 serve.mjs"
```

若看到 `SimpleHTTP/Python`，说明有人起了 Python，须换回 `node tools/serve.mjs` 再测。

- [ ] **Step 5: 人工验收清单（交给用户，实施者不得代做、不得伪造）**

| # | 验收点 | 判据 |
|---|---|---|
| 1 | 弹窗视觉 | 与游戏整体宣纸风格协调，三个按钮主次清楚 |
| 2 | 位置文案 | 「从当前进度」上写的"第 N/93 幕 · 章名"与玩家实际所在位置相符 |
| 3 | 起播观感 | 从中段起播时开场是否突兀（这是"不重播章引言"这一决定的实际检验） |
| 4 | 手机端 | 弹窗不被安全区/刘海影响，三个按钮都易点中 |
| 5 | 存档安全 | 续播退出后进度与得分确实原封不动 |

- [ ] **Step 6: 提交**

```bash
git add docs/superpowers/specs/2026-08-02-autoplay-mode-design.md docs/superpowers/specs/2026-08-05-autoplay-resume-design.md
git commit -m "$(cat <<'EOF'
docs: 回写自动放映续播的契约与设计文档

autoplay 设计文档的 SHY_AUTOPLAY 契约块去掉 skipConfirm、加上 resume 与
promptAndStart()，§7.1 入口一节改为描述三按钮弹窗。本次设计文档状态字段
与实际断言条数照实回写。

shared-interfaces.md 的契约增补已写盘（该目录被 gitignore，不入库）。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage**

| Spec 章节 | 落在哪个任务 |
|---|---|
| §1.1 三条取舍（沙盒 / 前沿起点 / 三按钮弹窗） | Task 1（沙盒）、Task 2（起点）、Task 3（弹窗） |
| §1.2 非目标 | 全程未实现托管游玩、未做自由选点 |
| §2.1 何时弹窗（`canResume` 判据） | Task 3 的 `resumeFrontier()` |
| §2.2 弹窗形态、z-index 450、Esc、焦点 | Task 3 Step 3 与 Step 5 |
| §3 契约调整（`promptAndStart` / 删 `skipConfirm`） | Task 1（删）、Task 3（增） |
| §4 沙盒起点两份独立深拷贝 | Task 1 Step 5，断言在 Step 1 |
| §5 时间轴起点跳过 | Task 2 |
| §6 验证 10 条 | Task 1（1–2 条）、Task 2（3–6 条）、Task 3（7–9 条）、Task 4 Step 4（第 10 条回归） |
| §7 影响面 | 与 File Structure 表一致 |
| §8 人工验收 5 项 | Task 4 Step 5 |

无遗漏。

**2. 已修正的问题**

- 最初把弹窗与 `promptAndStart()` 放进 Task 1，与沙盒起点混在一起。两者的正确性关注点完全不同（数据安全 vs. UI 交互），一个审查者可能认可其一而否决另一，故拆开。
- Task 3 的弹窗 HTML 用 `innerHTML` 拼入章名，最初没有转义。章名来自受控数据不是用户输入，但仍应转义——`js/autoplay.js` 中没有现成的 `escapeHtml`，已在 Step 3 补上函数定义，避免实现者引用一个不存在的工具。
- Task 3 最初漏了 `teardownScene()` 里的 `closePrompt()`。弹窗虽在 `start()` 前就该关掉，但异常路径下可能残留，收尾处补一次幂等清理。
- Task 2 的断言最初用 `SHY_VOICE.playFor` 判断"这一章播了引言"，但章引言幕会优先播影片、影片成功时不会调 `playFor`。已在断言里把 `SHY_CHAPTER_FILM.play` 打桩成返回 `false`，迫使走音频路径，使这个判据成立。

**3. Type consistency**

跨任务引用的名字已逐一核对：模块级 `resume`（Task 1 声明，Task 2 读取）、`start(opts)` 的 `opts.resume`（Task 1 定义，Task 3 与自检消费）、`promptAndStart()`（Task 3 定义，`js/app.js` 与自检消费）、`resumeFrontier()` / `closePrompt()` / `escapeHtmlSafe()` / `chapterTitleOf()`（均在 Task 3 Step 3 内定义与使用）、`makeResumeState()`（Task 1 断言段定义，Task 2 断言段复用——两段同在 `autoplay-selftest.html` 的同一个 `<script type="module">` 顶层作用域内，可直接引用）。DOM 选择器 `.autoplay-prompt-backdrop` / `.autoplay-prompt-resume` / `.autoplay-prompt-fresh` / `.autoplay-prompt-cancel` 在 Task 3 的创建处与断言处一致。既有部件 `chaptersSorted` / `eventsOfChapter` / `playChapterIntro` / `playEvent` / `renderIndicator` / `dwell` / `ENDING_HOLD_MS` / `progress` 均已对照 `js/autoplay.js` 现有源码核实。
