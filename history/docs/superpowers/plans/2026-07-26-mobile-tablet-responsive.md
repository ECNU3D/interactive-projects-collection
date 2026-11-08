# 移动端 / 平板适配实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让《山河岁月》在手机（竖/横屏）与平板（竖/横屏）上布局正确、触控可用，并把 CSS 与 JS 的布局尺寸统一到单一真相源，杜绝断点漂移。

**Architecture:** 五个布局尺寸升为 `:root` 上的 CSS 自定义属性，媒体查询只改变量、`scroll.js` 运行时读取，章节宽度与年表刻度尺因此恒等；四条互不重叠的断点（手机 ≤600px / 平板 601–1024px / 桌面 >1024px / 矮屏 ≤480px 高）承载全部尺度差异；触控能力用 `@media (pointer: coarse)` 而非宽度判断。验证靠新增的 `tools/responsive-check.mjs`——headless Chrome + CDP 真设备模拟，7 尺寸 × 6 视图跑布局断言并归档截图。

**Tech Stack:** 原生 ES5 风格 JS（无构建、无框架，与既有代码一致）、CSS 自定义属性与媒体查询、d3 v7（星图已依赖）、Node 24 + Chrome DevTools Protocol（验证脚本，零第三方依赖）。

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-07-26-mobile-tablet-responsive-design.md`，本计划的一切数值以该文档「断点矩阵」为准。
- 分支：`mobile-responsive`（已创建，spec 已提交在其上）。
- 运行方式：项目必须经 HTTP 访问，`node tools/serve.mjs` 起在 8080；不支持 file://。
- 代码风格：沿用现有写法——IIFE + `var` + ES5 语法，不引入构建步骤、不引入第三方运行时依赖；中文注释解释「为什么」，与既有注释密度一致。
- 「走入历史」（`js/walkin.js`、`vendor/spark*`）本轮不改。
- 每个任务结束必须提交，提交信息用中文、遵循仓库既有前缀（`feat:` / `fix:` / `docs:` / `tools:`）。
- 断言容差统一 ±2px（`.chapter-section` 有 1px 虚线右边框，且存在亚像素舍入）。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `tools/responsive-check.mjs` | 新建 | 验证器：CDP 设备模拟 → 注入断言 → 归档截图 → 汇总退出码。唯一的"测试运行器"。 |
| `css/main.css` | 修改 | 尺寸令牌定义（`:root`）、四条断点、触控热区、顶栏单行、iOS 安全区。 |
| `js/scroll.js` | 修改 | `chapterMinWidth()` 改读 CSS 变量；断点切换重渲染；长卷指针拖拽。 |
| `js/graph.js` | 修改 | 星图进入视图时自动 fit；粗指针下的透明命中圆。 |
| `js/map.js` | 修改 | 舆图双指缩放（接进既有 pointer 状态机）。 |
| `index.html` | 修改 | viewport meta 加 `viewport-fit=cover`；顶栏按钮补短标签 span。 |
| `.gitignore` | 修改 | 忽略 `.responsive-shots/`（截图归档目录）。 |

---

### Task 1: 验证器 `tools/responsive-check.mjs`（建立 red 基线）

本任务先建立"测试"。跑完它必须**失败**，且失败项与 spec 里记录的现存缺陷一一对上——这就是后续任务的 red 基线。

**Files:**
- Create: `tools/responsive-check.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 命令 `node tools/responsive-check.mjs [baseUrl] [outDir]`；退出码 0 = 全绿，1 = 有失败；截图落在 `outDir`（默认 `.responsive-shots/current`）；stdout 每行格式 `[PASS|FAIL] <device>/<view> <assertId> <detail>`，末行 `通过 N 项，失败 M 项`。
- Consumes: 页面全局 `window.SHY_APP.state` / `SHY_SCROLL.render()` / `SHY_SCROLL.openEvent(id)` / `SHY_CHOICE.open(id)` / `SHY_APP.showView(name)` / `SHY_DATA.{events,choices,persons}`（均为既有契约，见 `.superpowers/sdd/shared-interfaces.md`）。

- [ ] **Step 1: 写验证器**

创建 `tools/responsive-check.mjs`：

```js
#!/usr/bin/env node
// tools/responsive-check.mjs
// 移动端/平板适配的可复现验证器：headless Chrome + CDP 真设备模拟（Emulation.setDeviceMetricsOverride
// 带 DPR、setTouchEmulationEnabled 带触摸），跨设备尺寸 × 视图跑布局断言并归档截图。
//
// 为什么不用缩放窗口：窗口尺寸不改变 devicePixelRatio、不开启触摸，(pointer: coarse) 媒体查询
// 不会命中，触控热区一类断言必然测不到真实行为。CDP 模拟是唯一能在 headless 下同时改变
// 视口、DPR 与指针类型的手段。CDP 连接方式沿用 tools/selftest-run.mjs 已验证的模式。
//
// 用法：node tools/responsive-check.mjs [baseUrl=http://localhost:8080] [outDir=.responsive-shots/current]
// 退出码：0 = 断言全绿；1 = 有失败或 Chrome 启动失败

import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = (process.argv[2] || "http://localhost:8080").replace(/\/$/, "");
const outDir = path.resolve(process.argv[3] || ".responsive-shots/current");

// portraitPhone 标记参与"首屏可见节点数"断言；touch 标记参与触控热区断言。
const DEVICES = [
  { name: "iphone-se",      width: 375,  height: 667,  dpr: 2, touch: true,  portraitPhone: true },
  { name: "iphone-14",      width: 390,  height: 844,  dpr: 3, touch: true,  portraitPhone: true },
  { name: "iphone-14-land", width: 844,  height: 390,  dpr: 3, touch: true,  portraitPhone: false },
  { name: "ipad-mini",      width: 744,  height: 1133, dpr: 2, touch: true,  portraitPhone: false },
  { name: "ipad-pro",       width: 1024, height: 1366, dpr: 2, touch: true,  portraitPhone: false },
  { name: "ipad-land",      width: 1366, height: 1024, dpr: 2, touch: true,  portraitPhone: false },
  { name: "desktop",        width: 1440, height: 900,  dpr: 2, touch: false, portraitPhone: false }
];

const VIEWS = ["scroll", "card", "graph", "map", "choice", "ending"];

// 页内断言源码：注入后调用 __shyAssert(view, dev) 返回 [{id, ok, detail}]
const ASSERT_SRC = `
function __shyPx(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}
// 命中矩形 = 元素自身矩形，若有向外扩张（负 inset）的绝对定位 ::after 则并入其扩张量
function __shyHitRect(el) {
  var r = el.getBoundingClientRect();
  var w = r.width, h = r.height;
  var cs = getComputedStyle(el, "::after");
  if (cs && cs.content && cs.content !== "none" && cs.position === "absolute") {
    var t = parseFloat(cs.top) || 0, l = parseFloat(cs.left) || 0;
    var b = parseFloat(cs.bottom) || 0, rr = parseFloat(cs.right) || 0;
    if (t < 0 || l < 0 || b < 0 || rr < 0) { w = r.width - l - rr; h = r.height - t - b; }
  }
  return { w: w, h: h };
}
function __shyVisible(el) {
  var r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth &&
         r.bottom > 0 && r.top < window.innerHeight;
}
function __shyAssert(view, dev) {
  var out = [];
  function add(id, ok, detail) { out.push({ id: id, ok: !!ok, detail: detail || "" }); }
  var vw = window.innerWidth, vh = window.innerHeight;

  // A1 文档不得横向溢出（长卷的横向滚动发生在 #scroll-view 内部，不影响文档）
  var over = document.scrollingElement.scrollWidth - vw;
  add("A1-no-page-overflow", over <= 1, "scrollWidth - innerWidth = " + over);

  if (view === "scroll") {
    // A2 每章渲染宽度 == chapterMinWidth() 的 CSS 变量口径
    var unit = __shyPx("--node-w") + __shyPx("--node-gap");
    var base = __shyPx("--title-w") + __shyPx("--timeline-pad") * 2 + __shyPx("--intro-w");
    var worst = 0, worstId = "";
    [].forEach.call(document.querySelectorAll(".chapter-section"), function (s) {
      var expect = base + s.querySelectorAll(".node-wrap").length * unit;
      var d = Math.abs(s.offsetWidth - expect);
      if (d > worst) { worst = d; worstId = s.dataset.chapterId || "?"; }
    });
    add("A2-section-width", worst <= 2, "最大偏差 " + worst.toFixed(1) + "px @" + worstId);

    // A3 刻度尺总宽 == 卷轴总宽
    var track = document.querySelector(".scroll-track");
    var ruler = document.querySelector(".scroll-ruler");
    var rulerW = 0;
    [].forEach.call(ruler ? ruler.children : [], function (seg) { rulerW += seg.offsetWidth; });
    var trackW = track ? track.offsetWidth : 0;
    add("A3-ruler-aligned", Math.abs(rulerW - trackW) <= 2, "刻度尺 " + rulerW + " vs 卷轴 " + trackW);

    // A4a 引言卡不得越过刻度尺顶边
    var rulerTop = ruler ? ruler.getBoundingClientRect().top : vh;
    var bad = 0;
    [].forEach.call(document.querySelectorAll(".chapter-intro-card"), function (c) {
      if (c.getBoundingClientRect().bottom > rulerTop + 1) bad++;
    });
    add("A4a-intro-card-clear", bad === 0, bad + " 张引言卡压穿刻度尺");

    // A4b 节点标签不得与轴线本体相交（只查视口内的，卷外的无意义）
    var river = document.querySelector(".timeline-river");
    var rr = river ? river.getBoundingClientRect() : null;
    var hit = 0;
    if (rr) {
      [].forEach.call(document.querySelectorAll(".node-label"), function (lb) {
        var r = lb.getBoundingClientRect();
        if (r.right < 0 || r.left > vw) return;
        if (r.bottom > rr.top && r.top < rr.bottom) hit++;
      });
    }
    add("A4b-label-clear-axis", hit === 0, hit + " 个标签与轴线相交");

    // A6 手机竖屏首屏可见节点 >= 3
    if (dev.portraitPhone) {
      var vis = 0;
      [].forEach.call(document.querySelectorAll(".node-wrap"), function (w) {
        var r = w.getBoundingClientRect();
        if (r.right > 0 && r.left < vw) vis++;
      });
      add("A6-node-density", vis >= 3, "首屏可见节点 " + vis);
    }
  }

  // A5 粗指针下所有可交互元素命中矩形 >= 44x44
  if (dev.touch) {
    var small = [];
    [".node", "#top-bar-actions button", ".person-chip", ".choice-option", ".card-close"].forEach(function (sel) {
      [].forEach.call(document.querySelectorAll(sel), function (el) {
        if (el.disabled) return;          // 未解锁节点不可交互，不参与
        if (!__shyVisible(el)) return;    // 视口外/隐藏的不参与
        var h = __shyHitRect(el);
        if (h.w < 44 || h.h < 44) small.push(sel + " " + Math.round(h.w) + "x" + Math.round(h.h));
      });
    });
    add("A5-touch-target", small.length === 0,
        small.slice(0, 3).join("; ") + (small.length > 3 ? " …共 " + small.length + " 处" : ""));
  }
  return out;
}
`;

// 各视图的页内准备脚本：统一造一个"已推进 40 个节点、420 分、点亮 30 人"的存档态
function setupScript(view) {
  var common =
    "window.SHY_APP.state.unlockedCount = 40;" +
    "window.SHY_APP.state.total = 420;" +
    "window.SHY_APP.state.litPersons = (window.SHY_DATA.persons || []).slice(0, 30).map(function (p) { return p.id; });" +
    "window.SHY_SCROLL.render();" +
    "window.SHY_APP.refreshHud();";
  if (view === "scroll") return common;
  if (view === "card") return common + "window.SHY_SCROLL.openEvent(window.SHY_DATA.events[0].id);";
  if (view === "choice") return common + "window.SHY_CHOICE.open(window.SHY_DATA.choices[0].id);";
  if (view === "ending") {
    return common +
      "window.SHY_APP.state.finished = true;" +
      "window.SHY_APP.state.unlockedCount = window.SHY_DATA.events.length + 1;" +
      "window.SHY_APP.showView('ending');";
  }
  return common + "window.SHY_APP.showView('" + view + "');";
}

// ------------------------- CDP 连接（同 tools/selftest-run.mjs） -------------------------

const port = 9000 + Math.floor(Math.random() * 1000);
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=" + port,
  "--no-first-run",
  "--user-data-dir=" + path.join(os.tmpdir(), "responsive-chrome-" + port),
  "about:blank"
], { stdio: "ignore" });

function cleanup(code) {
  try { chrome.kill(); } catch (e) { /* 已退出 */ }
  process.exit(code);
}
process.on("SIGINT", () => cleanup(1));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: p }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

let version = null;
for (let i = 0; i < 50; i++) {
  try { version = await getJson("/json/version"); break; } catch (e) { await sleep(200); }
}
if (!version) { console.error("Chrome DevTools 端口未就绪"); cleanup(1); }

const ws = new WebSocket(version.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
function send(method, params, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  }
};
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, sessionId);
await send("Page.enable", {}, sessionId);

async function evaluate(expression, returnByValue) {
  const r = await send("Runtime.evaluate", {
    expression: expression,
    returnByValue: !!returnByValue,
    awaitPromise: false
  }, sessionId);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result ? r.result.value : undefined;
}

async function waitForReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ok = await evaluate(
        "!!(window.SHY_APP && window.SHY_APP.state && window.SHY_SCROLL && document.querySelector('.chapter-section'))",
        true);
      if (ok) return true;
    } catch (e) { /* 导航间隙，继续轮询 */ }
    await sleep(200);
  }
  return false;
}

// ------------------------- 主循环 -------------------------

fs.mkdirSync(outDir, { recursive: true });
let pass = 0, fail = 0;
const failures = [];

for (const dev of DEVICES) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: dev.width, height: dev.height, deviceScaleFactor: dev.dpr, mobile: dev.touch
  }, sessionId);
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: dev.touch, maxTouchPoints: dev.touch ? 5 : 0
  }, sessionId);

  for (const view of VIEWS) {
    await send("Page.navigate", { url: baseUrl + "/index.html" }, sessionId);
    if (!(await waitForReady(15000))) {
      console.log("[FAIL] " + dev.name + "/" + view + " boot 页面未就绪");
      fail++; failures.push(dev.name + "/" + view + " boot");
      continue;
    }
    try {
      await evaluate(setupScript(view));
    } catch (e) {
      console.log("[FAIL] " + dev.name + "/" + view + " setup " + e.message);
      fail++; failures.push(dev.name + "/" + view + " setup");
      continue;
    }
    await sleep(700); // 让力导布局/过渡稳定

    let results;
    try {
      results = await evaluate(ASSERT_SRC + ";__shyAssert(" +
        JSON.stringify(view) + "," + JSON.stringify(dev) + ")", true);
    } catch (e) {
      console.log("[FAIL] " + dev.name + "/" + view + " assert " + e.message);
      fail++; failures.push(dev.name + "/" + view + " assert");
      continue;
    }
    for (const r of results) {
      console.log((r.ok ? "[PASS] " : "[FAIL] ") + dev.name + "/" + view + " " + r.id + " " + r.detail);
      if (r.ok) pass++; else { fail++; failures.push(dev.name + "/" + view + " " + r.id); }
    }

    const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(path.join(outDir, dev.name + "-" + view + ".png"), Buffer.from(shot.data, "base64"));
  }
}

console.log("截图归档：" + outDir);
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
if (fail) console.log("失败清单：" + failures.join(" | "));
cleanup(fail ? 1 : 0);
```

- [ ] **Step 2: 忽略截图目录**

在 `.gitignore` 末尾追加：

```
# 移动端适配验证器的截图归档（tools/responsive-check.mjs）
.responsive-shots/
```

- [ ] **Step 3: 跑验证器，确认 red 基线**

```bash
node tools/serve.mjs &
node tools/responsive-check.mjs
```

Expected: 退出码 1。失败项必须**至少**包含（与 spec 记录的现存缺陷对应）：
- `iphone-se/scroll A2-section-width`、`iphone-14/scroll A2-section-width`（CSS/JS 尺寸漂移）
- `iphone-se/scroll A3-ruler-aligned`、`iphone-14/scroll A3-ruler-aligned`
- `iphone-14-land/scroll A4a-intro-card-clear`（引言卡压穿刻度尺）
- `iphone-14/scroll A6-node-density`（首屏可见节点 < 3）
- 多处 `A5-touch-target`（节点 22×22、顶栏按钮高度不足 44）

若某条预期失败反而是 PASS，先查断言是否写错（例如选择器打空、元素恰好不在视口内），不要直接放行——red 基线不成立，后面所有 green 都没有意义。

- [ ] **Step 4: 把基线截图另存一份**

```bash
cp -R .responsive-shots/current .responsive-shots/baseline
```

`baseline/desktop-*.png` 是 Task 11 桌面无回归比对的依据。

- [ ] **Step 5: 提交**

```bash
git add tools/responsive-check.mjs .gitignore
git commit -m "tools: 移动端适配验证器（CDP 真设备模拟 + 布局断言 + 截图归档）"
```

---

### Task 2: 布局尺寸令牌化（消除 CSS/JS 双真相源）

**Files:**
- Modify: `css/main.css`（`:root` 变量块、`.chapter-title-block` / `.timeline` / `.timeline-nodes` / `.node-wrap` / `.node` / `.node-label` / `.node-tick` / `.node-thumb-wrap` / `.chapter-intro-card` / `.chapter-title-vertical`）
- Modify: `js/scroll.js:172-180`（常量与 `chapterMinWidth()`）

**Interfaces:**
- Produces: CSS 变量 `--node-w` / `--node-gap` / `--intro-w` / `--title-w` / `--timeline-pad` / `--node-dot` / `--node-thumb` / `--node-label-fs` / `--tick-len` / `--chapter-title-fs`，定义在 `:root`，是 CSS 与 JS 共同的尺寸口径；`chapterMinWidth(nodeCount)` 签名不变，实现改为读变量。
- Consumes: 无（本任务不依赖其他任务）。

- [ ] **Step 1: 在 `:root` 增加尺寸令牌**

在 `css/main.css` 既有 `:root` 块末尾（颜色变量之后）追加：

```css
  /* ---- 长卷布局尺寸令牌 ----
     这十个量同时被 CSS 与 js/scroll.js 的 chapterMinWidth() 消费。媒体查询只改这里的值，
     JS 用 getComputedStyle 读同一份口径，章节宽度与年表刻度尺因此恒等。
     切勿在具体规则里写回字面像素值——那正是断点漂移的来源。 */
  --node-w: 98px;          /* .node-wrap 与 .node-label 宽度 */
  --node-gap: 39px;        /* .timeline-nodes 的 gap */
  --intro-w: 260px;        /* 章引言卡宽度（flex-basis 与 max-width 必须同值，见该规则注释） */
  --title-w: 148px;        /* 章题栏宽度 */
  --timeline-pad: 56px;    /* 时间轴单侧内边距 */
  --node-dot: 22px;        /* 节点圆点直径 */
  --node-thumb: 44px;      /* 已完成节点缩略图直径 */
  --node-label-fs: 11.5px; /* 节点标签字号 */
  --tick-len: 22px;        /* 轴线连向标签的短竖线长度，同时决定标签离轴距离 */
  --chapter-title-fs: 25px;/* 章名竖排字号 */
```

- [ ] **Step 2: 把写死的像素值换成令牌**

逐条替换（只改列出的声明，其余不动）：

```css
.chapter-title-block { flex: 0 0 var(--title-w); }
.chapter-title-vertical { font-size: var(--chapter-title-fs); }
.timeline { padding: 0 var(--timeline-pad); }
.timeline-nodes { gap: var(--node-gap); }
.chapter-intro-card { flex: 0 0 var(--intro-w); max-width: var(--intro-w); }
.node-wrap { width: var(--node-w); }
.node-label { width: var(--node-w); font-size: var(--node-label-fs); }
.node {
  width: var(--node-dot);
  height: var(--node-dot);
  margin: calc(var(--node-dot) / -2) 0 0 calc(var(--node-dot) / -2);
}
.node--choice {
  width: calc(var(--node-dot) - 4px);
  height: calc(var(--node-dot) - 4px);
  margin: calc((var(--node-dot) - 4px) / -2) 0 0 calc((var(--node-dot) - 4px) / -2);
}
.node-thumb-wrap { width: var(--node-thumb); height: var(--node-thumb); }
.node-wrap.label-below .node-tick { top: 50%; height: var(--tick-len); }
.node-wrap.label-above .node-tick { bottom: 50%; height: var(--tick-len); }
.node-wrap.label-below .node-label { top: calc(50% + var(--tick-len)); }
.node-wrap.label-above .node-label { bottom: calc(50% + var(--tick-len)); }
.node-wrap.label-below .node-thumb-wrap { bottom: calc(50% + var(--tick-len)); }
.node-wrap.label-above .node-thumb-wrap { top: calc(50% + var(--tick-len)); }
```

高潮节点（`.node-wrap.node-climax`）的 34px 直径与 26px tick 是刻意的特例，保持字面值不变。

- [ ] **Step 3: `scroll.js` 改读 CSS 变量**

把 `js/scroll.js` 的常量块与 `chapterMinWidth()`（原 172–180 行）整体替换为：

```js
  // 节点密度、引言卡宽度等布局尺寸的唯一真相源是 css/main.css 的 :root 令牌（--node-w 等），
  // 本文件运行时读取而非复制常量——否则媒体查询改了 CSS、这里没改，chapterMinWidth() 立刻失真，
  // 表现为章节末尾凭空多出空白且底部刻度尺与章节区段错位。
  function cssPx(name) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  }

  function chapterMinWidth(nodeCount) {
    return cssPx("--title-w") + cssPx("--timeline-pad") * 2 + cssPx("--intro-w") +
      nodeCount * (cssPx("--node-w") + cssPx("--node-gap"));
  }
```

删除 `NODE_WIDTH` / `NODE_GAP` / `INTRO_CARD_WIDTH` / `CHAPTER_TITLE_WIDTH` / `TIMELINE_PADDING` 五个常量（`grep -n "NODE_WIDTH\|NODE_GAP\|INTRO_CARD_WIDTH\|CHAPTER_TITLE_WIDTH\|TIMELINE_PADDING" js/scroll.js` 必须只剩 0 处引用）。

- [ ] **Step 3b: 章节分隔线改为不占布局宽度**

`.chapter-section` 的 `border-right: 1px dashed var(--c-paper-line)` 会计入布局宽度：`box-sizing: border-box` 下章节内容恰好等于 `min-width` 时，边框把 `offsetWidth` 顶到 `min-width + 1`，15 章累计 15px，而年表刻度尺按 `chapterMinWidth()` 排布不含边框——刻度尺因此比卷轴短 15px，越往右错得越多（Task 1 的 A3 断言在平板/桌面/横屏正是因此报红）。

分隔线是装饰，不该占布局。改为绝对定位伪元素：

```css
.chapter-section {
  /* 删除 border-right: 1px dashed var(--c-paper-line); */
  position: relative; /* 已有，确认保留 */
}

/* 章节分隔虚线：绝对定位而非 border——border 会计入 offsetWidth，使每章比
   chapterMinWidth() 宽 1px，年表刻度尺（按 chapterMinWidth 排布）随之整体错位。 */
.chapter-section::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 0;
  border-right: 1px dashed var(--c-paper-line);
  pointer-events: none;
}
```

改完后 `.chapter-section` 的 `offsetWidth` 应精确等于 `chapterMinWidth(n)`，A2 与 A3 的偏差都归零（不再依赖 ±2px 容差兜底）。

- [ ] **Step 4: 清掉 ≤600px 断点里被令牌取代的声明**

在 `@media (max-width: 600px)` 块中删除这几行（它们的职责已由令牌承担，留着就是新的漂移源）：

```css
  .chapter-title-block { flex-basis: 108px; ... }   /* 只删 flex-basis，padding/gap 保留 */
  .chapter-title-vertical { font-size: 19px; }
  .timeline { padding: 0 24px; }
  .timeline-nodes { gap: 28px; }
  .node-wrap { width: 84px; }
  .node-label { font-size: 10px; width: 84px; }
  .node-thumb-wrap { width: 36px; height: 36px; }
  .chapter-intro-card { flex-basis: 200px; max-width: 200px; ... }  /* 只删这两项，padding/gap 保留 */
```

同时整块删除 `@media (max-width: 400px)`（`.chapter-title-block { flex-basis: 92px }` 与 `.chapter-title-vertical { font-size: 17px }`，均由手机档令牌统一承担）。

- [ ] **Step 5: 跑验证器**

```bash
node tools/responsive-check.mjs
```

Expected: 所有设备的 `A2-section-width` 与 `A3-ruler-aligned` 转为 PASS（此时手机档还没定义令牌值，仍沿用桌面值，但 CSS 与 JS 已同口径，故必然对齐）。`A4a` / `A5` / `A6` 仍应为 FAIL。

- [ ] **Step 6: 提交**

```bash
git add css/main.css js/scroll.js
git commit -m "fix: 长卷布局尺寸令牌化，消除 CSS 与 chapterMinWidth() 的双真相源"
```

---

### Task 3: 断点矩阵（手机压缩 / 平板放大 / 矮屏收容）

**Files:**
- Modify: `css/main.css`（新增三个媒体查询块，改写既有 `@media (max-width: 600px)` 的长卷部分）

**Interfaces:**
- Consumes: Task 2 定义的十个令牌。
- Produces: 手机 ≤600px、平板 601–1024px、矮屏 ≤480px 高三档令牌值。

- [ ] **Step 1: 平板档（601–1024px）**

紧接 `:root` 之后新增：

```css
/* 平板：视口高度充裕，整体放大填充——节点更大更疏、缩略图与字号同步放大。
   与手机档、桌面档互不重叠（601–1024px）。 */
@media (min-width: 601px) and (max-width: 1024px) {
  :root {
    --node-w: 120px;
    --node-gap: 48px;
    --intro-w: 320px;
    --title-w: 172px;
    --timeline-pad: 64px;
    --node-dot: 26px;
    --node-thumb: 64px;
    --node-label-fs: 13px;
    --tick-len: 30px;
    --chapter-title-fs: 30px;
  }
}

/* 平板竖屏：可用高度 1100px+ 时纵向仍显空旷，把标签推得更远、年代水印放大 */
@media (min-width: 601px) and (max-width: 1024px) and (orientation: portrait) {
  :root { --tick-len: 40px; }
  .chapter-year-watermark { font-size: clamp(160px, 22vw, 320px); }
}
```

- [ ] **Step 2: 手机档（≤600px）**

在既有 `@media (max-width: 600px)` 块开头插入令牌覆盖：

```css
  /* 手机：横向压缩以提高节点密度——390px 宽下 (390 − 76 − 32) / (62 + 22) ≈ 3.4 个节点可见 */
  :root {
    --node-w: 62px;
    --node-gap: 22px;
    --intro-w: 168px;
    --title-w: 76px;
    --timeline-pad: 16px;
    --node-dot: 20px;
    --node-thumb: 36px;
    --node-label-fs: 10.5px;
    --tick-len: 20px;
    --chapter-title-fs: 17px;
  }
```

- [ ] **Step 3: 矮屏档（≤480px 高）**

在手机档之后新增（与宽度断点正交，手机横屏与矮桌面窗口都会命中）：

```css
/* 矮屏（手机横屏 844×390 等）：可用高度不足 340px，引言卡整段文字会压穿底部年表刻度尺。
   卡片高度收进可视区并允许内部滚动；缩略图与 tick 同步缩短，保证标签不与轴线打架。 */
@media (max-height: 480px) {
  :root {
    --node-thumb: 32px;
    --tick-len: 14px;
  }
  .chapter-intro-card {
    max-height: calc(100% - 24px);
    overflow-y: auto;
    overscroll-behavior: contain; /* 卡内滚到底不要把卷轴一起带跑 */
  }
  .chapter-intro-text { line-height: 1.65; }
}
```

- [ ] **Step 4: 跑验证器**

```bash
node tools/responsive-check.mjs
```

Expected:
- `iphone-14-land/scroll A4a-intro-card-clear` → PASS
- `iphone-se/scroll A6-node-density`、`iphone-14/scroll A6-node-density` → PASS（可见节点 ≥3）
- 全部 `A2` / `A3` 保持 PASS（令牌变了但两边同源）
- `A4b-label-clear-axis` 全设备 PASS
- `A5-touch-target` 仍 FAIL（Task 5 处理）

若 `A6` 仍不足 3，先看 `iphone-se-scroll.png` 判断是不是引言卡恰好占据首屏——把 `--intro-w` 再收 8px 而不是动 `--node-w`，节点宽度直接影响标签可读性。

- [ ] **Step 5: 提交**

```bash
git add css/main.css
git commit -m "feat: 手机/平板/矮屏三档断点，长卷尺度按视口自适应"
```

---

### Task 4: 顶栏单行收纳与 HUD 精简

现状：≤600px 下 6 个按钮换行占两行（约 90px 高），吃掉手机竖屏近 11% 的可用高度。改为单行——按钮在手机上换用短标签，HUD 只留总分。不引入溢出菜单：短标签已能在 375px 下单行放下，少一个交互状态就少一处出错的地方。

**Files:**
- Modify: `index.html:28-35`（按钮补短标签 span）
- Modify: `css/main.css`（`@media (max-width: 600px)` 顶栏部分；删除 `@media (max-width: 420px)` 整块）

**Interfaces:**
- Consumes: 无。
- Produces: 按钮内 `.btn-label-full` / `.btn-label-short` 两个 span，由媒体查询二选一显示；按钮 id 与 `js/app.js` 的绑定完全不变。

- [ ] **Step 1: `index.html` 按钮补短标签**

把 `<nav id="top-bar-actions">` 内五个按钮改为（`btn-ending` 保持 `hidden`）：

```html
  <button id="btn-mute" type="button" aria-pressed="false">静音</button>
  <button id="btn-graph" type="button" aria-label="人物星图"><span class="btn-label-full">人物星图</span><span class="btn-label-short">星图</span></button>
  <button id="btn-map" type="button">舆图</button>
  <button id="btn-ending" type="button" hidden>终章</button>
  <button id="btn-about" type="button">关于</button>
  <button id="btn-restart" type="button" aria-label="重新开始"><span class="btn-label-full">重新开始</span><span class="btn-label-short">重来</span></button>
```

注意 `js/app.js` 里若有 `btn.textContent = ...` 形式的按钮文案改写（静音态切换），只涉及 `btn-mute`，本改动不触及它——改前先 `grep -n "btn-graph\|btn-restart" js/app.js` 确认没有对这两个按钮的 textContent 赋值；若有，改为只写对应 span。

- [ ] **Step 2: CSS 控制长短标签**

在长卷样式区之外的通用区新增：

```css
/* 顶栏按钮的长/短标签：桌面与平板显示全称，手机显示短称，靠媒体查询二选一，
   不用 JS 改文案——避免与静音态等运行时文案改写互相覆盖 */
.btn-label-short { display: none; }
```

在 `@media (max-width: 600px)` 中：

```css
  .btn-label-full { display: none; }
  .btn-label-short { display: inline; }
  #top-bar { gap: 8px; padding: 6px 10px; height: 48px; }
  #top-bar-actions { gap: 5px; }
  #top-bar-actions button { padding: 6px 8px; font-size: 12px; }
  /* HUD 只留总分：称号与章名在 375px 下必然把按钮挤出屏外 */
  #score-hud { gap: 8px; font-size: 12px; }
  .hud-title-badge, .hud-chapter-badge { display: none; }
```

- [ ] **Step 3: 删除被取代的 ≤420px 补丁**

整块删除 `@media (max-width: 420px)`（`#top-bar { flex-wrap: wrap }` 等三条规则）。它的存在会让顶栏在 375–420px 之间又换回两行，与本任务直接冲突。

- [ ] **Step 4: 跑验证器**

```bash
node tools/responsive-check.mjs
```

Expected: `iphone-se/*` 与 `iphone-14/*` 的 `A1-no-page-overflow` 全部 PASS；人工看 `.responsive-shots/current/iphone-se-scroll.png`，顶栏必须是单行、五个按钮完整可见、不溢出右边缘。

- [ ] **Step 5: 提交**

```bash
git add index.html css/main.css
git commit -m "feat: 手机顶栏收为单行（短标签 + HUD 精简）"
```

---

### Task 5: 触控热区（`pointer: coarse`）

**Files:**
- Modify: `css/main.css`（新增 `@media (pointer: coarse)` 块）

**Interfaces:**
- Consumes: Task 2 的 `--node-dot` 令牌。
- Produces: 无 JS 接口。

- [ ] **Step 1: 增加粗指针热区规则**

```css
/* 触控设备热区：视觉尺寸不变，用向外扩张的 ::after 把命中区撑到 iOS HIG 的 44×44。
   用 (pointer: coarse) 而非宽度断点——平板横屏 1366px 宽同样是手指操作。
   tools/responsive-check.mjs 的 A5 断言按同样口径（负 inset 的绝对定位 ::after）计算命中矩形。 */
@media (pointer: coarse) {
  .node::after,
  #top-bar-actions button::after,
  .person-chip::after,
  .choice-option::after,
  .card-close::after {
    content: "";
    position: absolute;
    z-index: -1;
  }
  .node::after { inset: calc((44px - var(--node-dot)) / -2); border-radius: 50%; }
  #top-bar-actions button { position: relative; }
  #top-bar-actions button::after { inset: -8px -2px; }
  .person-chip { position: relative; }
  .person-chip::after { inset: -6px; }
  .choice-option { position: relative; }
  .choice-option::after { inset: -4px; }
  .card-close { position: relative; }
  .card-close::after { inset: -10px; }
}
```

`.node` 本身已是 `position: absolute`，无需再加 `position: relative`。`z-index: -1` 让扩张区落在按钮背景之下，不遮挡节点本体的视觉与悬停态；因为父级 `.node-wrap` 建立了层叠上下文，`-1` 不会掉到页面背景之后。

- [ ] **Step 2: 跑验证器**

```bash
node tools/responsive-check.mjs
```

Expected: 所有 `touch: true` 设备的 `A5-touch-target` → PASS。若仍报某个选择器不足，按报出的 `选择器 宽x高` 调该条 inset，不要放宽断言阈值。

- [ ] **Step 3: 人工确认桌面未被波及**

```bash
open .responsive-shots/current/desktop-scroll.png
```

桌面档不命中 `pointer: coarse`，截图应与 `.responsive-shots/baseline/desktop-scroll.png` 无差别。

- [ ] **Step 4: 提交**

```bash
git add css/main.css
git commit -m "feat: 触控设备下统一 44×44 点击热区"
```

---

### Task 6: 人物星图的触摸缩放与自动 fit

星图的 `d3.zoom`（`scaleExtent [0.3, 4]`）在 `buildGraph()` 中已绑好，双指缩放本已具备——缺的是 `.graph-svg` 没有 `touch-action`，浏览器默认手势把事件抢走了。另加进入视图时按节点包围盒自动 fit（现在力导布局按 `canvasSize()` 铺开，手机上必然溢出视口），以及粗指针下的透明命中圆与"未点亮不渲染标签"。

**Files:**
- Modify: `css/main.css`（`.graph-svg`、`@media (pointer: coarse)` 内追加）
- Modify: `js/graph.js:196-256`（`buildGraph()` 内新增命中圆与 `simulation.on("end")`）、新增 `fitToViewport()`

**Interfaces:**
- Consumes: 既有模块内变量 `svgSel` / `zoomBehavior` / `nodesData` / `simulation` / `canvasSize()`。
- Produces: 模块内函数 `fitToViewport(animate)`；不改 `window.SHY_GRAPH` 的对外契约（仍是 `{ render, focus }`）。

- [ ] **Step 1: 放行触摸手势**

`css/main.css` 的 `.graph-svg` 规则中追加：

```css
  touch-action: none; /* 缩放/平移交给 d3.zoom；不写则浏览器默认手势会抢走双指事件 */
```

同一文件的 `@media (pointer: coarse)` 块内追加：

```css
  /* 未点亮人物在手机上是满屏"？"噪声，隐藏之；点亮者的标签保留 */
  .graph-node-label.is-blurred { display: none; }
```

- [ ] **Step 2: 加透明命中圆**

在 `js/graph.js` 的 `buildGraph()` 中，`nodeSel.append("circle").attr("class", "graph-node-circle")` **之前**插入：

```js
    // 触控设备上节点半径（未点亮 4px / 点亮 9px）远小于手指精度，插一个透明大圆扩大命中区。
    // 只在粗指针下加：桌面上 22px 命中圆会与相邻节点重叠，反而更难点中目标节点。
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      nodeSel.append("circle")
        .attr("class", "graph-node-hit")
        .attr("r", 22)
        .attr("fill", "transparent");
    }
```

- [ ] **Step 3: 实现 `fitToViewport()`**

在 `js/graph.js` 的 `canvasSize()` 之后新增：

```js
  // 力导布局按 canvasSize() 铺开，视口一小（手机 390×700）节点必然溢出到视口外。
  // 布局收敛后按节点包围盒算一次缩放平移，把整张星图装进视口。
  function fitToViewport(animate) {
    if (!zoomBehavior || !svgSel || !nodesData.length) return;
    var size = canvasSize();
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodesData.forEach(function (n) {
      if (typeof n.x !== "number" || typeof n.y !== "number") return;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });
    if (!isFinite(minX)) return; // tick 尚未跑过，坐标未初始化
    var pad = 44;
    var w = Math.max(maxX - minX, 1);
    var h = Math.max(maxY - minY, 1);
    var k = Math.min((size.w - pad * 2) / w, (size.h - pad * 2) / h);
    k = Math.max(0.3, Math.min(4, k)); // 与 zoomBehavior 的 scaleExtent 保持一致
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var t = window.d3.zoomIdentity.translate(size.w / 2 - cx * k, size.h / 2 - cy * k).scale(k);
    var sel = animate ? svgSel.transition().duration(500).ease(window.d3.easeCubicOut) : svgSel;
    sel.call(zoomBehavior.transform, t);
  }
```

- [ ] **Step 4: 布局收敛后自动 fit**

在 `buildGraph()` 中给 simulation 追加 end 回调——紧跟既有的 `.on("tick", onTick);` 之后：

```js
    // 力导收敛（alpha < alphaMin）后自动 fit 一次。放在 end 而非 render()：render() 触发时
    // 节点坐标还没算出来，此时 fit 会按初始重叠坐标缩放，结果是所有节点挤成一点。
    simulation.on("end", function () { fitToViewport(false); });
```

- [ ] **Step 5: 跑验证器 + 人工看图**

```bash
node tools/responsive-check.mjs
open .responsive-shots/current/iphone-14-graph.png .responsive-shots/current/ipad-mini-graph.png
```

Expected: `A1` / `A5` 在 graph 视图全 PASS；截图里星图应整体收进视口（不再有节点被裁在边缘外），未点亮节点不带"？"标签。

- [ ] **Step 6: 提交**

```bash
git add css/main.css js/graph.js
git commit -m "feat: 星图放行触摸手势、布局收敛后自动 fit、粗指针命中圆"
```

---

### Task 7: 舆图双指缩放

舆图已有单指拖拽（`pointerdown/move/up`，含 4px 位移阈值——低于阈值不捕获指针，marker 的 click 才不会被吞）与滚轮缩放。本任务接入双指捏合，锚点取两指中点，公式与滚轮缩放一致。

**Files:**
- Modify: `js/map.js:449-500`（`bindPanZoom()`）

**Interfaces:**
- Consumes: 既有模块内变量 `view` / `drag` / `suppressClick` / `MIN_SCALE` / `MAX_SCALE`，函数 `toSvgPoint()` / `applyTransform()`。
- Produces: 无对外接口变化。

- [ ] **Step 1: 在 `bindPanZoom()` 内加双指状态**

在 `function bindPanZoom() { var svg = els.svg;` 之后插入：

```js
    // 活动指针表：双指捏合需要同时知道两个触点的位置。单指路径完全不受影响。
    var pointers = new Map();
    var pinch = null;

    function pinchDistance() {
      var pts = [];
      pointers.forEach(function (p) { pts.push(p); });
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    function pinchMidpoint() {
      var pts = [];
      pointers.forEach(function (p) { pts.push(p); });
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
```

- [ ] **Step 2: pointerdown 里登记指针并起手捏合**

把既有 `svg.addEventListener("pointerdown", ...)` 的回调体改为：

```js
      if (e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        // 第二指落下：转入捏合，终止单指拖拽（但不清 suppressClick——捏合结束同样要抑制 click）
        drag = null;
        pinch = { startDist: pinchDistance(), startScale: view.s };
        return;
      }
      // 注意：不能在此处 setPointerCapture——捕获会把随后的 click 重定向到 svg，
      // marker 的点击（打开事件卡）将永远收不到。改为首次真正拖动时才捕获（见 pointermove）。
      drag = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, moved: false };
```

- [ ] **Step 3: pointermove 里优先处理捏合**

在既有 `svg.addEventListener("pointermove", ...)` 回调体**最开头**插入：

```js
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        var dist = pinchDistance();
        if (!dist || !pinch.startDist) return;
        var mid = pinchMidpoint();
        var pt = toSvgPoint(mid.x, mid.y);
        var old = view.s;
        var next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.startScale * (dist / pinch.startDist)));
        if (next !== old) {
          // 以两指中点为锚：中点下的图面点保持不动（与滚轮缩放同一公式）
          view.tx = pt.x - (pt.x - view.tx) * (next / old);
          view.ty = pt.y - (pt.y - view.ty) * (next / old);
          view.s = next;
          applyTransform(false);
        }
        suppressClick = true;
        return;
      }
```

- [ ] **Step 4: 抬指时清理**

把既有 `endDrag` 改为：

```js
    var endDrag = function (e) {
      if (e && e.pointerId != null) pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if ((drag && drag.moved) || suppressClick) {
        suppressClick = true;
        setTimeout(function () {
          suppressClick = false;
        }, 60);
      }
      drag = null;
    };
```

- [ ] **Step 5: 手工验证捏合与点击互不干扰**

起服务后在 Chrome 打开 `http://localhost:8080`，DevTools 切设备模拟（iPhone 14），进「舆图」：

1. 双指捏合（DevTools 里按住 Shift + 拖动模拟）→ 地图应以中点为锚缩放，右下「复位」按钮出现；
2. 轻点任一朱砂 marker → 事件卡必须正常打开（验证 `suppressClick` 没有误吞点击）；
3. 单指拖动 → 平移正常，拖动结束后紧接着的 click 被抑制、不误开事件卡。

三条都通过才算过。

- [ ] **Step 6: 跑验证器 + 提交**

```bash
node tools/responsive-check.mjs
git add js/map.js
git commit -m "feat: 舆图双指捏合缩放（锚点取两指中点，不干扰 marker 点击）"
```

---

### Task 8: 长卷指针拖拽与 `touch-action`

**触摸端保留原生横向滚动**（有惯性，体验优于手写动量），只用 `touch-action: pan-x` 明确轴向；**指针拖拽补给鼠标/触控笔**，让桌面与平板触控笔也能按住拖动卷轴。这与 spec 里"长卷横向拖拽"的意图一致，但把触摸交还给系统——手写惯性不可能比原生更跟手。

**Files:**
- Modify: `css/main.css`（`#scroll-view`）
- Modify: `js/scroll.js`（新增 `bindDragScroll()`，在 `render()` 中调用）

**Interfaces:**
- Consumes: `#scroll-view` 容器。
- Produces: 模块内函数 `bindDragScroll(container)`；容器上新增 class `is-drag-scrolling`（仅用于光标样式）。

- [ ] **Step 1: 声明触摸轴向**

`#scroll-view` 规则中追加：

```css
  touch-action: pan-x; /* 触摸横向滚动交给系统（带惯性）；纵向不需要，明确禁掉省得误触 */
  cursor: grab;
```

并新增：

```css
#scroll-view.is-drag-scrolling { cursor: grabbing; scroll-behavior: auto; }
```

- [ ] **Step 2: 实现指针拖拽**

在 `js/scroll.js` 的 `bindThemeSync()` 之后新增：

```js
  // 鼠标/触控笔按住拖动卷轴。触摸不走这里——CSS 的 touch-action: pan-x 已把触摸横滑交给系统，
  // 系统滚动带惯性，手写动量只会更差。4px 阈值前不捕获指针，保证轻点节点仍能正常触发 click。
  function bindDragScroll(container) {
    var st = null;
    var suppressClick = false;

    container.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      st = { x: e.clientX, left: container.scrollLeft, pointerId: e.pointerId, moved: false };
    });

    container.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.pointerId) return;
      var dx = e.clientX - st.x;
      if (!st.moved && Math.abs(dx) < 4) return;
      if (!st.moved) {
        st.moved = true;
        container.classList.add("is-drag-scrolling");
        try {
          container.setPointerCapture(st.pointerId);
        } catch (err) {
          // 某些环境不支持指针捕获，降级为按住有效
        }
      }
      container.scrollLeft = st.left - dx;
    });

    var end = function () {
      if (st && st.moved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 60);
      }
      st = null;
      container.classList.remove("is-drag-scrolling");
    };
    container.addEventListener("pointerup", end);
    container.addEventListener("pointercancel", end);

    // 捕获阶段拦截：拖拽刚结束时的那次 click 不应打开节点事件卡
    container.addEventListener("click", function (e) {
      if (!suppressClick) return;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  }
```

- [ ] **Step 3: 在 `render()` 中绑定（且只绑一次）**

`render()` 里 `bindThemeSync(container)` 这行的处理要一并修正：容器元素在多次 `render()` 之间是复用的，每次 render 都 `addEventListener` 会累积监听器。改为：

```js
    if (!container.dataset.shyBound) {
      container.dataset.shyBound = "1";
      bindThemeSync(container);
      bindDragScroll(container);
    }
```

（原先无条件调用 `bindThemeSync(container)` 的那一行删掉。）

- [ ] **Step 4: 手工验证**

Chrome 打开 `http://localhost:8080`：
1. 鼠标在卷轴空白处按住左右拖 → 卷轴跟随移动；
2. 轻点某个已解锁节点 → 事件卡正常打开；
3. 按住拖动后在节点上松手 → 事件卡**不**打开。

- [ ] **Step 5: 跑验证器 + 提交**

```bash
node tools/responsive-check.mjs
git add css/main.css js/scroll.js
git commit -m "feat: 长卷指针拖拽滚动与 touch-action 轴向声明"
```

---

### Task 9: iOS 视口细节（`dvh` / 安全区 / `viewport-fit`）

以 Chrome 为测试主力，但这三条是纯增量、零回归风险，且是 iOS Safari 上唯一会导致"底部内容被地址栏吃掉"的成因。

**Files:**
- Modify: `index.html:10`（viewport meta）
- Modify: `css/main.css`（`html, body` 高度；`#top-bar`、`.scroll-ruler`、`.event-card` 安全区）

- [ ] **Step 1: viewport meta**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- [ ] **Step 2: 动态视口高度**

`html, body { height: 100%; }` 之后追加：

```css
/* iOS Safari 的地址栏收放会改变可视高度，100% / 100vh 都按"地址栏收起"的大视口算，
   导致底部年表刻度尺被地址栏盖住。100dvh 跟随实际可视高度；不支持的浏览器落回上一条声明。 */
body { height: 100dvh; }
```

- [ ] **Step 3: 安全区内边距**

```css
#top-bar {
  padding-left: max(22px, env(safe-area-inset-left));
  padding-right: max(22px, env(safe-area-inset-right));
}
.scroll-ruler { bottom: env(safe-area-inset-bottom, 0px); }
.event-card { padding-bottom: env(safe-area-inset-bottom, 0px); }
```

`@media (max-width: 600px)` 中的顶栏内边距同步改为 `padding-left: max(10px, env(safe-area-inset-left))` / `padding-right: max(10px, env(safe-area-inset-right))`（Task 4 写的是 `padding: 6px 10px`，此处拆成四向写法）。

- [ ] **Step 4: 跑验证器 + 提交**

```bash
node tools/responsive-check.mjs
```

Expected: 全部断言维持 Task 8 后的状态（本任务不应改变任何断言结果——`env()` 在非刘海设备上为 0）。若 `A3` 或 `A4a` 翻红，说明 `.scroll-ruler` 的 `bottom` 改动影响了刻度尺位置，回退该条单独排查。

```bash
git add index.html css/main.css
git commit -m "feat: iOS 视口适配（dvh、安全区内边距、viewport-fit）"
```

---

### Task 10: 断点切换时重渲染长卷

视口跨越断点（旋转手机、平板分屏、桌面拖窗口）后，令牌值变了，但已渲染的章节内联 `min-width` 与刻度尺段宽仍是旧值 → 立即错位。监听 resize，仅在断点档位真的变化时整卷重渲染。

**Files:**
- Modify: `js/scroll.js`（新增 `currentBreakpoint()` / `bindBreakpointReflow()`，在 `render()` 中记录档位）

**Interfaces:**
- Consumes: `render()`（末尾已调用 `scrollToCurrentNode(false)`，重渲染后阅读位置自动回到当前前沿节点）。
- Produces: 模块内变量 `lastBreakpoint`，函数 `currentBreakpoint()` 返回 `"phone" | "tablet" | "desktop"`。

- [ ] **Step 1: 实现断点侦测与重渲染**

在 `js/scroll.js` 的 `chapterMinWidth()` 之后新增：

```js
  // 断点档位（与 css/main.css 的媒体查询边界严格对应，改一处必须改另一处）
  var lastBreakpoint = null;

  function currentBreakpoint() {
    var w = window.innerWidth;
    if (w <= 600) return "phone";
    if (w <= 1024) return "tablet";
    return "desktop";
  }

  // 跨断点后令牌值变了，已渲染的章节内联 min-width 与刻度尺段宽还是旧值，必须整卷重渲染。
  // 只在档位真的变化时重渲染：手机地址栏收放会高频触发 resize，每次都重排整卷会明显卡顿。
  function bindBreakpointReflow() {
    var timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (currentBreakpoint() === lastBreakpoint) return;
        render(); // render() 末尾的 scrollToCurrentNode(false) 会把阅读位置带回当前前沿节点
      }, 200);
    });
  }
```

- [ ] **Step 2: 在 `render()` 中记录档位并绑定**

`render()` 内，把 Task 8 引入的一次性绑定块扩充为：

```js
    lastBreakpoint = currentBreakpoint();
    if (!container.dataset.shyBound) {
      container.dataset.shyBound = "1";
      bindThemeSync(container);
      bindDragScroll(container);
      bindBreakpointReflow();
    }
```

- [ ] **Step 3: 手工验证**

Chrome 打开 `http://localhost:8080`，把窗口从 1400px 缓慢拖窄到 500px 再拖回：

1. 越过 1024 与 600 两条线时，卷轴应重渲染且节点密度随之变化；
2. 重渲染后当前前沿节点仍在视口中央附近（不应跳回卷首）；
3. 在同一档位内拖动（例如 800→900px）不应触发重渲染——可临时在 `render()` 里 `console.log("render")` 数次数，确认只在跨线时打印。验证完删掉这行 log。

- [ ] **Step 4: 跑验证器 + 提交**

```bash
node tools/responsive-check.mjs
git add js/scroll.js
git commit -m "feat: 跨断点时重渲染长卷并保持阅读位置"
```

---

### Task 11: 全矩阵收尾与桌面无回归比对

**Files:**
- Modify: `tools/responsive-check.mjs`（新增 `--baseline` 截图差异比对）

**Interfaces:**
- Consumes: `.responsive-shots/baseline/`（Task 1 Step 4 存下的改动前截图）。
- Produces: 命令行开关 `--baseline <dir>`，对同名截图算像素差异比例，>0.1% 记为 FAIL。

- [ ] **Step 1: 加截图差异比对**

在 `tools/responsive-check.mjs` 主循环**之后**、汇总输出之前插入：

```js
// --baseline <dir>：与基线截图逐像素比对。PNG 解码借页面自己的 canvas 完成（Node 侧零依赖）：
// 两张图都经本地 HTTP 服务器同源加载，canvas 不会被跨源污染，getImageData 可读。
const baselineIdx = process.argv.indexOf("--baseline");
if (baselineIdx > -1) {
  const baseDir = path.resolve(process.argv[baselineIdx + 1] || ".responsive-shots/baseline");
  const relCur = path.relative(process.cwd(), outDir);
  const relBase = path.relative(process.cwd(), baseDir);
  for (const dev of DEVICES) {
    for (const view of VIEWS) {
      const file = dev.name + "-" + view + ".png";
      if (!fs.existsSync(path.join(baseDir, file))) continue;
      await send("Page.navigate", { url: baseUrl + "/index.html" }, sessionId);
      await sleep(300);
      const ratio = await evaluate(`(async function () {
        function load(src) {
          return new Promise(function (res, rej) {
            var im = new Image();
            im.onload = function () { res(im); };
            im.onerror = rej;
            im.src = src;
          });
        }
        var a = await load(${JSON.stringify("/" + relBase + "/" + file)});
        var b = await load(${JSON.stringify("/" + relCur + "/" + file)});
        if (a.width !== b.width || a.height !== b.height) return -1;
        var ca = document.createElement("canvas"); ca.width = a.width; ca.height = a.height;
        var cb = document.createElement("canvas"); cb.width = b.width; cb.height = b.height;
        ca.getContext("2d").drawImage(a, 0, 0);
        cb.getContext("2d").drawImage(b, 0, 0);
        var da = ca.getContext("2d").getImageData(0, 0, a.width, a.height).data;
        var db = cb.getContext("2d").getImageData(0, 0, b.width, b.height).data;
        var diff = 0;
        for (var i = 0; i < da.length; i += 4) {
          if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i+1] - db[i+1]) > 8 || Math.abs(da[i+2] - db[i+2]) > 8) diff++;
        }
        return diff / (da.length / 4);
      })()`, true, true);
      const ok = ratio >= 0 && ratio < 0.001;
      console.log((ok ? "[PASS] " : "[FAIL] ") + "baseline " + file + " 差异 " +
        (ratio < 0 ? "尺寸不一致" : (ratio * 100).toFixed(3) + "%"));
      if (ok) pass++; else { fail++; failures.push("baseline " + file); }
    }
  }
}
```

`evaluate()` 需支持 `awaitPromise`——把其签名改为 `evaluate(expression, returnByValue, awaitPromise)` 并把 `awaitPromise: false` 改为 `awaitPromise: !!awaitPromise`。

比对只对 `desktop-*` 有意义（其余设备的布局本来就该变），运行时用 `--baseline` 配合只保留 desktop 基线的目录，或接受其余设备必然 FAIL 并只看 desktop 行。

- [ ] **Step 2: 只保留桌面基线并跑全量**

```bash
mkdir -p .responsive-shots/baseline-desktop
cp .responsive-shots/baseline/desktop-*.png .responsive-shots/baseline-desktop/
node tools/responsive-check.mjs http://localhost:8080 .responsive-shots/current --baseline .responsive-shots/baseline-desktop
```

Expected: 退出码 0——7 设备 × 6 视图的 A1–A6 全 PASS，且 6 张 `desktop-*` 与基线差异 <0.1%。

- [ ] **Step 3: 人工过一遍关键截图**

```bash
open .responsive-shots/current/iphone-14-scroll.png \
     .responsive-shots/current/iphone-14-land-scroll.png \
     .responsive-shots/current/ipad-mini-scroll.png \
     .responsive-shots/current/iphone-14-graph.png
```

逐张确认：顶栏单行不溢出；引言卡不压刻度尺；平板节点明显更大更疏、上下留白被 tick/缩略图/水印填充；星图整体在视口内。

- [ ] **Step 4: 提交**

```bash
git add tools/responsive-check.mjs
git commit -m "tools: 验证器支持与基线截图逐像素比对"
```

---

## Self-Review

**Spec 覆盖核对：**

| spec 章节 | 对应任务 |
|---|---|
| 一、单一真相源：尺寸令牌化 | Task 2 |
| 一、跨断点重渲染（去抖 200ms） | Task 10 |
| 二、断点矩阵（手机/平板/桌面/矮屏） | Task 3 |
| 二、平板纵向填充 | Task 3 Step 1 |
| 三、长卷 `touch-action` 与事件卡 dvh | Task 8、Task 9 |
| 三、人物星图 touch-action / fit / 标签 | Task 6 |
| 三、山河舆图双指缩放 | Task 7 |
| 三、顶栏收单行、HUD 精简 | Task 4 |
| 三、触控热区 ≥44px | Task 5 |
| 三、iOS viewport-fit / dvh / safe-area | Task 9 |
| 四、CDP 验证矩阵与六条断言 | Task 1、Task 11 |

**与 spec 的两处偏离（已在对应任务中说明理由）：**

1. 顶栏未做「⋯」溢出菜单，改用长/短标签二选一——375px 下短标签已能单行放下，少一个交互状态少一处出错点。
2. 长卷"单指拖拽"在触摸端交还给系统原生滚动（`touch-action: pan-x`），指针拖拽只补给鼠标/触控笔——手写动量不可能比原生惯性更跟手。

**类型/命名一致性：** `chapterMinWidth(nodeCount)` 签名跨 Task 2 与 Task 1 断言口径一致（`--title-w + --timeline-pad*2 + --intro-w + n*(--node-w + --node-gap)`）；`fitToViewport(animate)`、`currentBreakpoint()`、`bindDragScroll(container)`、`bindBreakpointReflow()` 各只在一处定义、在计划中命名前后一致；`suppressClick` 在 `js/map.js`（既有）与 `js/scroll.js`（Task 8 新增，函数内私有）中同名但作用域互不相干，不会冲突。
