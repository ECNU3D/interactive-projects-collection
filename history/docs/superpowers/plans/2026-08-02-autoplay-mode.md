# 「自动放映」模式 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给《山河岁月》加一个自动放映模式：沙盒式从第一幕播到通关，自动选正确答案，并在每个抉择场景分别 360° 环绕展示全景图与高斯泼溅场景。

**Architecture:** 新增一个"导演"模块 `js/autoplay.js` 按时间轴编排既有模块，自己不渲染任何游戏内容；`js/choice.js` 与 `js/walkin.js` 各自在本领域内新增一个返回 Promise 的"环绕一周"方法；共用的时基与缓动抽到 `js/autoplay-kit.js`。作答与继续一律点真实 DOM 按钮，不复制任何业务逻辑。

**Tech Stack:** 原生 ES5 风格普通 `<script>`（`walkin.js` 除外，它是全项目唯一的 ES module）、无构建、无第三方依赖；测试用项目既有的"页内自检页 + CDP 运行器"组合（`tools/selftest-run.mjs`）。

**设计文档：** `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md`

## Global Constraints

以下约束来自 `.superpowers/sdd/shared-interfaces.md` 与设计文档，**每个任务的要求都隐含包含本节**：

- **禁止 ES module / CDN / 构建步骤**：除既有的 `js/walkin.js` 外，一切新 JS 用普通 `<script>` + 全局变量。本次不新增任何 module。
- **必须通过本地 HTTP 服务器运行**：`node tools/serve.mjs` → `http://localhost:8080`。不再维护 `file://` 兼容。
- **历史不可改变**：放映不得改变任何剧情走向；自动作答只影响沙盒得分。
- **AI 图片标注**：`AI 生成想象图` 角标在放映的环绕段必须保持可见（这正是新增 `.is-autoplay` 类的唯一目的）。
- **存档键**：`shanhe_save_v1`（进度/分数）、`shanhe_settings_v1`（设置）。放映期间前者必须逐字节不变。
- **提交信息用中文**，前缀 `feat:` / `fix:` / `docs:` / `data:` / `chore:` / `tools:`，结尾加：
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- **提交纪律**：只 `git add <本任务明确创建/修改的文件>`，禁止 `git add -A` / `git add .`。
- **注释语言**：中文，解释"为什么"而非"是什么"，与既有文件风格一致。

### 相对设计文档的两处收敛（已确认，Task 8 回写 spec）

1. spec §3.2 列的 `SHY_CHOICE.setAutoplayOrbit(bool)` 并入 `setAutoplayActive(bool)`——因为 `.is-viewing` 只在放映的环绕段被打开，CSS 用 `.is-autoplay.is-viewing` 复合选择器即可精确命中，无需第二个类。同时补上 spec §6.1/§7.3 功能上要求、但未命名的 `setOrbitPaused(bool)`。
2. spec §9 的新建 `tools/autoplay-smoke.mjs` 改为**复用既有 `tools/selftest-run.mjs`**——该运行器已是通用的"轮询 `#out` 里的『通过 N 项，失败 M 项』结果行 + 转发页面未捕获异常"CDP 运行器，只需新增一个自检页 `autoplay-selftest.html`（`walkin-selftest.html` 的同款形制）。少一个几乎重复的 368 行脚本。

### 全局验证命令

```bash
# 终端 A：起服务器（整个实施过程保持运行）
node tools/serve.mjs

# 终端 B：跑自检（每个任务结束前必跑）
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 600
```

期望输出形如 `通过 N 项，失败 0 项`，且**输出中不得出现任何 `PAGEERROR:` 行**（运行器会把页面未捕获异常/未处理 rejection 打成 `PAGEERROR:`）。已知例外：`walkin.js` 已有的 `"Worker terminate"` 窄域拦截会自行 `preventDefault`，不应出现。

---

## File Structure

| 文件 | 责任 | 状态 |
|---|---|---|
| `js/autoplay-kit.js` | 放映公共原语：可暂停/可取消的时钟 + 镜头缓动曲线。被导演与两处镜头实现共用 | 新建（Task 1） |
| `js/autoplay.js` | 导演：沙盒进出、时间轴编排、指示条、键盘与守卫。不渲染游戏内容 | 新建（Task 4–7） |
| `js/choice.js` | 既有沉浸抉择。新增全景环绕契约与放映态开关 | 修改（Task 2、6） |
| `js/walkin.js` | 既有泼溅漫游。新增原地环视模式 | 修改（Task 3） |
| `js/app.js` | 既有应用外壳。新增顶栏按钮绑定、放映守卫、`showToast` 公开化 | 修改（Task 4、7） |
| `index.html` | 新增两个 `<script>` 与顶栏按钮 | 修改（Task 1、4、7） |
| `css/main.css` | 指示条、自动选中高亮、放映态角标覆盖、环视模式的 walkin UI | 修改（Task 2、3、7） |
| `autoplay-selftest.html` | 页内自检页，逐任务追加断言段落；配 `tools/selftest-run.mjs` 运行 | 新建（Task 1），逐任务追加 |
| `.superpowers/sdd/shared-interfaces.md` | 契约增补 | 修改（Task 8） |
| `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md` | 回写为实际实现 | 修改（Task 8） |

**为什么 kit 与 director 分两个文件**：时钟的暂停语义（暂停不能丢失剩余时长）是本功能最容易写错、也最值得单独立测的一块，它不依赖任何游戏状态；缓动曲线要被 `choice.js` 和 `walkin.js` 两处消费，放进导演会造成"镜头实现反向依赖导演"的倒置。两者都是与游戏状态无关的纯函数/纯时基，合成一个约 140 行的工具箱文件，边界干净。

---

## Task 1: 放映公共原语（可暂停时钟 + 镜头缓动）

**Files:**
- Create: `js/autoplay-kit.js`
- Create: `autoplay-selftest.html`
- Modify: `index.html`（新增一行 `<script>`）

**Interfaces:**
- Consumes: 无（纯原生 JS，不依赖任何项目模块）
- Produces:
  ```js
  window.SHY_AUTOPLAY_KIT = {
    createClock(),                     // → clock 实例（见下）
    isCancelledError(err),             // → boolean
    orbitEase(p)                       // p∈[0,1] → [0,1]；两端 12% smoothstep、中段线性；orbitEase(0)===0、orbitEase(1)===1
  };
  // clock 实例：
  //   wait(ms)                          → Promise<void>       可暂停、可取消
  //   waitFor(predicate, opts)          → Promise<boolean>    命中 true / 超时 false；opts = { timeoutMs=180000, intervalMs=100 }
  //   withCap(promise, capMs)           → Promise<any>        promise 先完成则透传其值，超时则 resolve(undefined)
  //   now()                             → number              本时钟的"有效毫秒"累计（暂停期间不增长）
  //   pause() / resume() / isPaused()
  //   cancel() / isCancelled()          cancel 后所有 pending 的 wait/waitFor/withCap 以 CancelledError reject
  ```

- [ ] **Step 1: 建自检页骨架 + 时钟断言（此时必然失败）**

创建 `autoplay-selftest.html`。它镜像 `index.html` 的 DOM 与脚本序列（放映要驱动真实应用），并在**任何项目脚本之前**把 `localStorage` 换成页内内存 shim。

```html
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>自动放映 自检</title>
<link rel="stylesheet" href="css/main.css">
<script type="importmap">
{
  "imports": {
    "three": "./vendor/three.module.min.js",
    "three/addons/postprocessing/Pass.js": "./vendor/Pass.js",
    "@sparkjsdev/spark": "./vendor/spark.module.min.js"
  }
}
</script>
<script>
// 本自检页把 localStorage 换成页内内存 shim。理由：score.js / app.js / choice.js 会真实
// 读写 shanhe_save_v1 与 shanhe_settings_v1，若直落真实存储，人工在日常浏览器 profile 里
// 打开本页就会污染玩家存档（CDP 运行器每次用独立 user-data-dir 不受影响，但本页也支持
// 人工打开）。必须在任何项目脚本之前替换，否则 app.js 的 init() 已经读过真实存档了。
(function () {
  var mem = Object.create(null);
  var shim = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    clear: function () { mem = Object.create(null); },
    key: function (i) { return Object.keys(mem)[i] || null; }
  };
  Object.defineProperty(shim, "length", { get: function () { return Object.keys(mem).length; } });
  Object.defineProperty(window, "localStorage", { configurable: true, get: function () { return shim; } });
})();
</script>
</head>
<body>
<pre id="out" style="position:fixed;left:0;top:0;z-index:99999;background:#fff;color:#000;margin:0;padding:8px;font:12px/1.5 monospace;max-height:60vh;overflow:auto">运行中……</pre>

<header id="top-bar">
  <h1 id="app-title" aria-label="山河岁月"><span class="app-title-text">山河岁月</span></h1>
  <div id="score-hud" aria-live="polite"></div>
  <nav id="top-bar-actions">
    <button id="btn-mute" type="button" aria-pressed="false">静音</button>
    <button id="btn-graph" type="button" aria-label="人物星图"><span class="btn-label-full">人物星图</span><span class="btn-label-short">星图</span></button>
    <button id="btn-map" type="button">舆图</button>
    <button id="btn-ending" type="button" hidden>终章</button>
    <button id="btn-about" type="button">关于</button>
    <button id="btn-restart" type="button" aria-label="重新开始"><span class="btn-label-full">重新开始</span><span class="btn-label-short">重来</span></button>
  </nav>
</header>

<main id="views">
  <div id="scroll-view"></div>
  <div id="choice-view" hidden></div>
  <div id="graph-view" hidden></div>
  <div id="map-view" hidden></div>
  <div id="ending-view" hidden></div>
  <div id="about-view" hidden></div>
</main>

<script src="data/chapters.js"></script>
<script src="data/events.js"></script>
<script src="data/choices.js"></script>
<script src="data/persons.js"></script>
<script src="data/map-geo.js"></script>
<script src="data/map-places.js"></script>
<script src="vendor/d3.v7.min.js"></script>
<script src="js/audio.js"></script>
<script src="js/score.js"></script>
<script src="js/autoplay-kit.js"></script>
<script src="js/narration.js"></script>
<script src="js/bgm.js"></script>
<script src="js/scroll.js"></script>
<script src="js/choice.js"></script>
<script src="js/graph.js"></script>
<script src="js/ending.js"></script>
<script src="js/map.js"></script>
<script src="js/app.js"></script>
<script type="module">
import "./js/walkin.js";

var R = { pass: 0, fail: 0, messages: [] };
function ok(cond, msg) { if (cond) R.pass++; else { R.fail++; R.messages.push("✘ " + msg); } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function report() {
  document.getElementById("out").textContent =
    "通过 " + R.pass + " 项，失败 " + R.fail + " 项\n" + R.messages.join("\n");
}
// 任何段落抛异常都要先把已有结果写出去，否则运行器只能等到超时、拿不到任何诊断信息
window.addEventListener("error", function () { report(); });

// ============ Task 1：localStorage shim 与时钟原语 ============

ok(!(window.localStorage instanceof Storage), "localStorage 已被页内内存 shim 替换（不污染真实存档）");
window.localStorage.setItem("__probe__", "1");
ok(window.localStorage.getItem("__probe__") === "1", "shim 的 setItem/getItem 往返正常");
window.localStorage.removeItem("__probe__");

var KIT = window.SHY_AUTOPLAY_KIT;
ok(!!KIT, "window.SHY_AUTOPLAY_KIT 已挂载");
ok(typeof KIT.createClock === "function" && typeof KIT.orbitEase === "function"
   && typeof KIT.isCancelledError === "function", "kit 三个入口都是函数");

// 缓动曲线：端点精确、单调不减、总位移恰为 1（否则环绕一周会差一截或多转一点）
ok(KIT.orbitEase(0) === 0 && KIT.orbitEase(1) === 1, "orbitEase 端点精确为 0 与 1");
var monotonic = true, prevE = -1;
for (var q = 0; q <= 100; q++) { var e = KIT.orbitEase(q / 100); if (e < prevE - 1e-9) monotonic = false; prevE = e; }
ok(monotonic, "orbitEase 单调不减（镜头不会倒转）");
ok(Math.abs(KIT.orbitEase(0.5) - 0.5) < 1e-6, "orbitEase 在中点为 0.5（两端缓动对称）");

// wait 基本时长
var clk = KIT.createClock();
var t0 = Date.now();
await clk.wait(300);
var dt0 = Date.now() - t0;
ok(dt0 >= 260 && dt0 <= 450, "wait(300) 实测 " + dt0 + "ms");

// 暂停语义（设计文档 §9.1 断言 4）：wait(1000) 开始 200ms 后暂停 2000ms 再继续，
// 总墙钟应 ≈3000ms。≈4000ms 说明恢复时重开了完整时长的定时器（明确禁止的实现），
// ≈1000ms 说明暂停对该等待未生效。
var t1 = Date.now();
var p1 = clk.wait(1000);
setTimeout(function () { clk.pause(); }, 200);
setTimeout(function () { clk.resume(); }, 2200);
await p1;
var dt1 = Date.now() - t1;
ok(dt1 >= 2820 && dt1 <= 3250,
  "暂停 2s 的 wait(1000) 应 ≈3000ms，实测 " + dt1 + "ms（≈4000=恢复时重开完整定时器，≈1000=暂停未生效）");
ok(clk.isPaused() === false, "resume 后 isPaused 为 false");

// waitFor 命中与超时
var flag = false;
setTimeout(function () { flag = true; }, 300);
var hit = await clk.waitFor(function () { return flag; }, { timeoutMs: 3000 });
ok(hit === true, "waitFor 条件命中返回 true");
var miss = await clk.waitFor(function () { return false; }, { timeoutMs: 300 });
ok(miss === false, "waitFor 超时返回 false 而非抛错");
var immediate = await clk.waitFor(function () { return true; }, { timeoutMs: 3000 });
ok(immediate === true, "waitFor 对已成立的条件立即返回 true");

// withCap：永不 settle 的 promise 也不能把放映挂死
var t2 = Date.now();
var capped = await clk.withCap(new Promise(function () {}), 250);
ok(capped === undefined && Date.now() - t2 < 900, "withCap 超时后 resolve(undefined) 而非挂死");
var passthrough = await clk.withCap(Promise.resolve("值"), 5000);
ok(passthrough === "值", "withCap 在 promise 先完成时透传其值");
clk.cancel();

// cancel 令 pending 等待以 CancelledError reject
var clk2 = KIT.createClock();
var rejectedKind = null;
var pending = clk2.wait(5000).then(function () { rejectedKind = "resolved"; },
                                   function (e) { rejectedKind = KIT.isCancelledError(e) ? "cancelled" : "other"; });
clk2.cancel();
await pending;
ok(rejectedKind === "cancelled", "cancel() 令 pending 的 wait 以 CancelledError reject，实际 " + rejectedKind);
ok(clk2.isCancelled() === true, "cancel 后 isCancelled 为 true");

report();
</script>
</body></html>
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/serve.mjs &          # 若尚未运行
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 120
```

期望：因 `js/autoplay-kit.js` 返回 404、`window.SHY_AUTOPLAY_KIT` 为 undefined，脚本在 `KIT.createClock()` 处抛 TypeError，`#out` 停在「运行中……」→ 运行器超时退出（退出码 1），并打印 `PAGEERROR: TypeError: Cannot read properties of undefined`。

- [ ] **Step 3: 实现 `js/autoplay-kit.js`**

```js
// js/autoplay-kit.js
// 《山河岁月》自动放映的公共原语：可暂停/可取消的时基，以及镜头环绕的缓动曲线。
// 提供 window.SHY_AUTOPLAY_KIT = { createClock(), isCancelledError(err), orbitEase(p) }
//
// 为什么不用裸 setTimeout 做等待：放映要支持"暂停 2 秒再继续，剩余时长不丢"。若用
// clearTimeout + 恢复时重开一个完整时长的定时器，每次暂停都会白等一遍全长；本模块改为
// 维护一条"有效时间轴"（暂停期间不累加），所有等待挂在这条时间轴的到期点上。
//
// 为什么缓动放在这里而不是各自的镜头实现里：js/choice.js（全景平移）与 js/walkin.js
// （泼溅相机 yaw）需要同一条曲线，两处各写一份必然漂移；而让镜头实现去依赖导演
// （js/autoplay.js）又是依赖倒置——镜头是被编排者，不该知道编排者的存在。

(function () {
  "use strict";

  var TICK_MS = 50;
  var EASE_EDGE = 0.12; // 两端各 12% 用于加减速

  function CancelledError() {
    this.name = "AutoplayCancelled";
    this.message = "autoplay cancelled";
  }
  CancelledError.prototype = Object.create(Error.prototype);
  CancelledError.prototype.constructor = CancelledError;

  function isCancelledError(err) {
    return !!err && err.name === "AutoplayCancelled";
  }

  // 位移曲线：速度在 [0, E] 由 0 平滑升到 V、在 [E, 1-E] 恒为 V、在 [1-E, 1] 平滑降回 0。
  // 令总位移恰为 1 可解出 V = 1/(1-E)：两段加减速各贡献 V·E/2，中段贡献 V·(1-2E)。
  // 端点精确（orbitEase(1) === 1）是硬要求——差一点点，全景就转不满一周、接缝会露出来。
  function orbitEase(p) {
    if (!(p > 0)) return 0;
    if (p >= 1) return 1;
    var E = EASE_EDGE;
    var V = 1 / (1 - E);
    if (p < E) {
      var x = p / E;
      // ∫₀ˣ smoothstep(u) du = x³ - x⁴/2，再乘以 E·V 换回真实尺度
      return V * E * (x * x * x - (x * x * x * x) / 2);
    }
    if (p > 1 - E) {
      var y = (1 - p) / E;
      return 1 - V * E * (y * y * y - (y * y * y * y) / 2);
    }
    return V * (E / 2 + (p - E));
  }

  function createClock() {
    var effectiveMs = 0; // 有效时间轴累计（暂停期间不增长）
    var lastTs = Date.now();
    var paused = false;
    var cancelled = false;
    var waiters = []; // { dueAt, resolve, reject }
    var pollers = []; // { predicate, nextPollAt, intervalMs, deadline, resolve, reject }

    var timer = setInterval(tick, TICK_MS);

    function tick() {
      var now = Date.now();
      var delta = now - lastTs;
      lastTs = now;
      if (paused || cancelled) return;
      // 后台标签页的 setInterval 被节流到约 1s：单次 delta 封顶，避免切回前台时一次性
      // 补跑一大段时间轴（连着触发好几个到期点，观感是"哗啦一下连跳几幕"）。
      if (delta > 250) delta = 250;
      effectiveMs += delta;
      fire();
    }

    function fire() {
      var i;
      for (i = waiters.length - 1; i >= 0; i--) {
        if (effectiveMs >= waiters[i].dueAt) waiters.splice(i, 1)[0].resolve();
      }
      for (i = pollers.length - 1; i >= 0; i--) {
        var po = pollers[i];
        if (effectiveMs >= po.nextPollAt) {
          po.nextPollAt = effectiveMs + po.intervalMs;
          var hit = false;
          try { hit = !!po.predicate(); } catch (e) { hit = false; }
          if (hit) { pollers.splice(i, 1); po.resolve(true); continue; }
        }
        if (effectiveMs >= po.deadline) { pollers.splice(i, 1); po.resolve(false); }
      }
    }

    function wait(msArg) {
      if (cancelled) return Promise.reject(new CancelledError());
      var d = Number(msArg) || 0;
      if (d <= 0) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        waiters.push({ dueAt: effectiveMs + d, resolve: resolve, reject: reject });
      });
    }

    function waitFor(predicate, opts) {
      if (cancelled) return Promise.reject(new CancelledError());
      opts = opts || {};
      var timeoutMs = opts.timeoutMs == null ? 180000 : opts.timeoutMs;
      var intervalMs = opts.intervalMs == null ? 100 : opts.intervalMs;
      var immediate = false;
      try { immediate = !!predicate(); } catch (e) { immediate = false; }
      if (immediate) return Promise.resolve(true);
      return new Promise(function (resolve, reject) {
        pollers.push({
          predicate: predicate,
          nextPollAt: effectiveMs + intervalMs,
          intervalMs: intervalMs,
          deadline: effectiveMs + timeoutMs,
          resolve: resolve,
          reject: reject
        });
      });
    }

    // 给任何外部 promise 套一个"有效时间"上限。用途：全景/泼溅的环绕 promise 靠 rAF 推进，
    // 而 rAF 在后台标签页会完全停摆——没有这层封顶，切走标签页就等于把放映永久挂死。
    function withCap(promise, capMs) {
      return Promise.race([
        Promise.resolve(promise),
        wait(capMs).then(function () { return undefined; })
      ]);
    }

    function cancel() {
      if (cancelled) return;
      cancelled = true;
      clearInterval(timer);
      timer = null;
      var pendingWaiters = waiters.splice(0, waiters.length);
      var pendingPollers = pollers.splice(0, pollers.length);
      pendingWaiters.forEach(function (w) { w.reject(new CancelledError()); });
      pendingPollers.forEach(function (po) { po.reject(new CancelledError()); });
    }

    return {
      wait: wait,
      waitFor: waitFor,
      withCap: withCap,
      now: function () { return effectiveMs; },
      pause: function () { paused = true; },
      resume: function () { paused = false; },
      isPaused: function () { return paused; },
      cancel: cancel,
      isCancelled: function () { return cancelled; }
    };
  }

  window.SHY_AUTOPLAY_KIT = {
    createClock: createClock,
    isCancelledError: isCancelledError,
    orbitEase: orbitEase
  };
})();
```

- [ ] **Step 4: 在 `index.html` 挂载 kit**

在 `<script src="js/score.js"></script>` 之后、`<script src="js/narration.js"></script>` 之前插入一行（必须早于 `js/choice.js`，因为 Task 2 起 `choice.js` 要消费 `orbitEase`）：

```html
<script src="js/score.js"></script>
<script src="js/autoplay-kit.js"></script>
<script src="js/narration.js"></script>
```

- [ ] **Step 5: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 120
```

期望：`通过 17 项，失败 0 项`，且无 `PAGEERROR:` 行。

- [ ] **Step 6: 提交**

```bash
git add js/autoplay-kit.js autoplay-selftest.html index.html
git commit -m "$(cat <<'EOF'
feat: 自动放映公共原语（可暂停时钟 + 镜头缓动曲线）

时钟维护一条"有效时间轴"，暂停期间不累加——避免用 clearTimeout + 恢复时
重开完整定时器的写法把剩余时长丢掉。缓动曲线两端各 12% smoothstep、中段
线性，端点精确为 0/1，保证环绕恰好一周不露接缝。

新增 autoplay-selftest.html（配既有 tools/selftest-run.mjs 运行），页内
用内存 shim 顶替 localStorage，人工打开也不会污染真实存档。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 全景 360° 环绕契约（`choice.js`）

**Files:**
- Modify: `js/choice.js`（模块级新增 orbit 子状态；改 `panoTick` / `recomputePanoTileW` / `onPanoPointerDown` / `openChoice`；扩展 `window.SHY_CHOICE`）
- Modify: `css/main.css`（`.is-autoplay` 下的角标覆盖规则）
- Modify: `autoplay-selftest.html`（追加 Task 2 断言段）

**Interfaces:**
- Consumes: `window.SHY_AUTOPLAY_KIT.orbitEase(p)`（Task 1）
- Produces:
  ```js
  window.SHY_CHOICE = {
    open(choiceId),                          // 既有
    setAutoplayActive(on),                   // 放映态总开关：加/去 .is-autoplay 类，并禁用全景拖拽
    setViewMode(on),                         // 观景模式（面板淡出）
    setOrbitPaused(on),                      // 冻结/恢复环绕进度
    orbitPanorama({ durationMs }),           // → Promise<boolean>；true=转满一周，false=当前非环景模式/命中减弱动效偏好
    debugPano()                              // 非契约调试接口：{ panoX, panoTileW, orbiting, autoplayActive }
  };
  ```

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 2：全景 360° 环绕 ============

var C = window.SHY_CHOICE;
ok(typeof C.orbitPanorama === "function" && typeof C.setViewMode === "function"
   && typeof C.setAutoplayActive === "function" && typeof C.setOrbitPaused === "function"
   && typeof C.debugPano === "function", "SHY_CHOICE 四个放映契约方法 + debugPano 均已导出");

// 尚未打开任何抉择（全景层不存在/隐藏）时必须立即 resolve(false)，绝不能挂死
var t3 = Date.now();
var noPano = await C.orbitPanorama({ durationMs: 5000 });
ok(noPano === false && Date.now() - t3 < 500, "未进入环景模式时 orbitPanorama 立即 resolve(false)");

// 打开 c01（有 2:1 全景图），等环景引擎起来
document.dispatchEvent(new CustomEvent("shy:enter-choice", { detail: { choiceId: "c01" } }));
var panoEl = null;
for (var pi = 0; pi < 60 && !panoEl; pi++) {
  await sleep(100);
  var el = document.querySelector(".choice-bg-pano");
  if (el && !el.hidden) panoEl = el;
}
ok(panoEl !== null, "c01 以环景模式启动（.choice-bg-pano 可见）");
ok(C.debugPano().panoTileW > 0, "panoTileW 已算出，实际 " + C.debugPano().panoTileW);

// 环绕一周的位移必须恰为一个平铺宽度——差一截就会看见全景接缝
var st0 = C.debugPano();
var orbited = await C.orbitPanorama({ durationMs: 600 });
var st1 = C.debugPano();
var moved = st1.panoX - st0.panoX;
ok(orbited === true, "环景模式下 orbitPanorama resolve(true)");
ok(Math.abs(moved + st0.panoTileW) < 1.5,
  "环绕一周位移 ≈ -panoTileW（实测 " + moved.toFixed(2) + " vs " + (-st0.panoTileW).toFixed(2) + "）");
ok(C.debugPano().orbiting === false, "环绕结束后 orbiting 复位为 false");

// 暂停：冻结期间位移必须为 0
var pausedOrbit = C.orbitPanorama({ durationMs: 1200 });
await sleep(150);
C.setOrbitPaused(true);
var pa = C.debugPano().panoX;
await sleep(350);
var pb = C.debugPano().panoX;
C.setOrbitPaused(false);
await pausedOrbit;
ok(Math.abs(pb - pa) < 1, "setOrbitPaused(true) 期间环绕位移冻结（实测 " + (pb - pa).toFixed(2) + "px）");

// 放映态：拖拽必须失效，否则观众误触会和镜头轨道打架
C.setAutoplayActive(true);
var ov = document.querySelector(".choice-overlay");
ok(ov.classList.contains("is-autoplay"), "setAutoplayActive(true) 加上 .is-autoplay 类");
var dragBefore = C.debugPano().panoX;
ov.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 300, pointerId: 1, bubbles: true, cancelable: true }));
ov.dispatchEvent(new PointerEvent("pointermove", { clientX: 400, clientY: 300, pointerId: 1, bubbles: true }));
var dragAfter = C.debugPano().panoX;
ov.dispatchEvent(new PointerEvent("pointerup", { clientX: 400, clientY: 300, pointerId: 1, bubbles: true }));
ok(Math.abs(dragAfter - dragBefore) < 5,
  "放映态全景拖拽被禁用（300px 拖拽未产生位移，实测 " + (dragAfter - dragBefore).toFixed(1) + "px）");

// 放映态 + 观景模式下，「AI 生成想象图」角标必须仍然可见（项目硬规则）
C.setViewMode(true);
await sleep(50);
var badge = document.querySelector(".choice-ai-badge");
ok(parseFloat(getComputedStyle(badge).opacity) > 0.5,
  "放映态的观景模式下 AI 角标仍可见（opacity=" + getComputedStyle(badge).opacity + "）");
C.setViewMode(false);
C.setAutoplayActive(false);
await sleep(50);
ok(parseFloat(getComputedStyle(document.querySelector(".choice-ai-badge")).opacity) > 0.5,
  "退出放映态后角标恢复常态可见");
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 180
```

期望：Task 1 的 17 项仍通过，Task 2 段在 `C.orbitPanorama is not a function` 处抛错 → 出现 `PAGEERROR:` 且 `#out` 停在「运行中……」。

- [ ] **Step 3: 在 `js/choice.js` 加入 orbit 子状态与放映开关**

在文件顶部的环景状态变量区（`var prefersReducedMotion = ...` 之后）追加：

```js
  // 放映模式：环绕子状态与总开关。环绕进行中 panoTick 只推进 panoOrbit，不叠加环境漂移。
  var panoOrbit = null;        // { fromX, delta, elapsed, durationMs, resolve } | null
  var orbitPaused = false;     // 放映暂停时冻结环绕进度（画面停住，不是继续转）
  var autoplayActive = false;  // 放映期整场为 true：禁用全景拖拽，并给 overlay 加 .is-autoplay
```

- [ ] **Step 4: 改写 `panoTick`，让环绕优先于环境漂移**

把现有 `panoTick` 整体替换为：

```js
  function panoTick(ts) {
    panoRAF = window.requestAnimationFrame(panoTick);
    if (!panoLastTs) {
      panoLastTs = ts;
      return;
    }
    var dt = (ts - panoLastTs) / 1000;
    panoLastTs = ts;
    if (dt > 0.1) dt = 0.1; // 后台标签页恢复时避免跳变

    if (panoOrbit) {
      // 放映环绕进行中：完全接管位置，不叠加 10px/s 的环境漂移（两者叠加会让"转满一周"
      // 多转出一小截，正好落在全景接缝上）
      if (!orbitPaused) {
        panoOrbit.elapsed += dt * 1000;
        var p = Math.min(panoOrbit.elapsed / panoOrbit.durationMs, 1);
        panoX = panoOrbit.fromX + panoOrbit.delta * window.SHY_AUTOPLAY_KIT.orbitEase(p);
        applyPanoPos();
        if (p >= 1) {
          var settle = panoOrbit.resolve;
          panoOrbit = null;
          settle(true);
        }
      }
      return;
    }

    if (!panoDragging && !panoPausedByDrag && !prefersReducedMotion) {
      panoX -= PANO_SPEED * dt;
      applyPanoPos();
    }
  }
```

- [ ] **Step 5: 让 `recomputePanoTileW` 在环绕中做重投影**

把现有 `recomputePanoTileW` 整体替换为：

```js
  function recomputePanoTileW() {
    if (!refs || !refs.bgPano || refs.bgPano.hidden || !panoAspect) return;
    var h = refs.bgPano.clientHeight || 0;
    var next = h * panoAspect;
    if (panoOrbit && panoTileW && next !== panoTileW) {
      // 环绕途中转屏/改窗口：平铺宽度变了，剩余行程必须按新宽度折算。以"当前进度"为界
      // 重投影——保持 elapsed / durationMs 不变（总时长不变），只把 fromX 挪到能让
      // fromX + delta×eased 恰好等于当前 panoX 的位置，于是画面不跳、结束时仍是整一周。
      var p = Math.min(panoOrbit.elapsed / panoOrbit.durationMs, 1);
      var eased = window.SHY_AUTOPLAY_KIT.orbitEase(p);
      panoOrbit.delta = -next;
      panoOrbit.fromX = panoX - panoOrbit.delta * eased;
    }
    panoTileW = next;
  }
```

- [ ] **Step 6: 放映期禁用拖拽 + `stopPano` 收尾未完成的环绕**

在 `onPanoPointerDown` 函数体第一行插入：

```js
  function onPanoPointerDown(e) {
    if (autoplayActive) return; // 放映期由镜头轨道全权控制，人工拖拽会与之打架
    if (!refs || !refs.bgPano || refs.bgPano.hidden) return;
```

在 `stopPano` 函数体开头（`if (panoRAF) {` 之前）插入，避免抉择切换时留下永不 settle 的 promise：

```js
  function stopPano() {
    if (panoOrbit) {
      // 抉择被切换/关闭时全景引擎停摆：把仍在等待的环绕 promise 以 false 收尾，
      // 否则导演会一直 await 到 withCap 的封顶时限才继续，白等一大段。
      var aborted = panoOrbit.resolve;
      panoOrbit = null;
      aborted(false);
    }
    orbitPaused = false;
```

- [ ] **Step 7: 新增四个契约方法与调试接口，并在 `openChoice` 里补挂 `.is-autoplay`**

在 `openChoice` 中 `if (!overlayEl) return;` 之后插入一行（`setAutoplayActive` 可能在 overlay 尚未创建时就被调用过，此处补挂）：

```js
    overlayEl.classList.toggle("is-autoplay", autoplayActive);
```

在文件末尾把 `window.SHY_CHOICE = { open: openChoice };` 替换为：

```js
  // ------------------------- 自动放映契约（js/autoplay.js 消费） -------------------------

  function setAutoplayActive(on) {
    autoplayActive = !!on;
    if (overlayEl) overlayEl.classList.toggle("is-autoplay", autoplayActive);
    if (!autoplayActive) orbitPaused = false;
  }

  function setViewMode(on) {
    if (on) enterViewMode(); else exitViewMode();
  }

  function setOrbitPaused(on) {
    orbitPaused = !!on;
  }

  // 把全景背景匀速环绕整一周（位移恰为一个平铺宽度 = 360°）。
  // resolve(true) = 转满一周；resolve(false) = 当前不是环景模式（水墨降级 / 封面 Ken Burns）
  // 或命中减弱动效偏好，调用方据此跳过本段。
  function orbitPanorama(opts) {
    var durationMs = (opts && opts.durationMs) || 24000;
    if (!refs || !refs.bgPano || refs.bgPano.hidden || !panoTileW) return Promise.resolve(false);
    if (prefersReducedMotion) return Promise.resolve(false);
    if (panoOrbit) {
      var prev = panoOrbit;
      panoOrbit = null;
      prev.resolve(false); // 防御：上一轮环绕未收尾就又发起了新的一轮
    }
    return new Promise(function (resolve) {
      panoOrbit = {
        fromX: panoX,
        delta: -panoTileW,
        elapsed: 0,
        durationMs: durationMs,
        resolve: resolve
      };
    });
  }

  // 非契约调试接口：仅供 autoplay-selftest.html 观测环景引擎内部量（命名与暴露方式沿用
  // js/walkin.js debugState()、js/bgm.js 的既有先例），js/autoplay.js 不得依赖它。
  function debugPano() {
    return {
      panoX: panoX,
      panoTileW: panoTileW,
      orbiting: panoOrbit !== null,
      autoplayActive: autoplayActive
    };
  }

  window.SHY_CHOICE = {
    open: openChoice,
    setAutoplayActive: setAutoplayActive,
    setViewMode: setViewMode,
    setOrbitPaused: setOrbitPaused,
    orbitPanorama: orbitPanorama,
    debugPano: debugPano
  };
```

- [ ] **Step 8: 加 CSS——放映态下保住 AI 角标**

在 `css/main.css` 的 `.choice-overlay.is-viewing .choice-bg-shade { opacity: 0.08; }` 规则之后追加：

```css
/* 放映模式的环绕段：is-viewing 会把 AI 角标一并淡出，但环绕恰恰是全景最抢眼的时刻，
   按项目硬规则（AI 生成图必须标注）此时角标必须可见。用 .is-autoplay.is-viewing 复合
   选择器（特异度 0,3,1）覆盖上面那条 .is-viewing 规则（0,2,1）。 */
.choice-overlay.is-autoplay.is-viewing .choice-ai-badge {
  opacity: 1;
  pointer-events: none;
}
```

- [ ] **Step 9: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 180
```

期望：`通过 28 项，失败 0 项`，无 `PAGEERROR:` 行。

- [ ] **Step 10: 提交**

```bash
git add js/choice.js css/main.css autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 全景 360° 环绕契约（SHY_CHOICE.orbitPanorama）

环绕位移恰为一个平铺宽度（=360°），由 orbitEase 保证端点精确，转满一周
不露接缝。环绕期间接管 panoX，不叠加 10px/s 环境漂移。转屏改变平铺宽度
时按当前进度重投影，画面不跳、总时长不变。

放映态（.is-autoplay）禁用全景拖拽，并覆盖 is-viewing 对 AI 角标的隐藏
——环绕正是全景最抢眼的时刻，标注必须可见。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 高斯泼溅原地环视（`walkin.js`）

**Files:**
- Modify: `js/walkin.js`（`open` 参数化、环视渲染循环、`orbit()` 包装、`setOrbitPaused`、焦点圈禁目标）
- Modify: `css/main.css`（环视模式下的覆盖层 UI）
- Modify: `autoplay-selftest.html`（追加 Task 3 断言段）

**Interfaces:**
- Consumes: `window.SHY_AUTOPLAY_KIT.orbitEase(p)`（Task 1）
- Produces:
  ```js
  window.SHY_WALKIN = {
    probeAvailable(choiceId), open(choiceId, opts), close(), isOpen(), debugState(),  // 既有（open 新增可选 opts）
    orbit(choiceId, { durationMs }),   // → Promise<boolean>；true=转满一周并已自动关闭，false=无模型/不支持 WebGL2
    setOrbitPaused(on)                 // 冻结/恢复 yaw 推进（画面继续渲染，只是不转）
  };
  // open 的 opts.orbit = { durationMs, done(ok) }：环视模式；省略即原有自由漫游行为
  ```

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 3：高斯泼溅原地环视 ============

var W = window.SHY_WALKIN;
ok(typeof W.orbit === "function" && typeof W.setOrbitPaused === "function",
   "SHY_WALKIN.orbit / setOrbitPaused 已导出");

// 无模型的抉择：立即 resolve(false)，且不得创建覆盖层（c99 是约定的"永不放置模型"的 id）
var noModel = await W.orbit("c99", { durationMs: 500 });
ok(noModel === false, "无模型的 c99：orbit resolve(false)，实际 " + noModel);
ok(document.querySelector(".walkin-overlay") === null, "无模型时不创建覆盖层");

// c01 有模型：真实加载并环视。.spz 约 49MB，本机 HTTP 下加载数秒，给足超时。
var yaws = [];
var uiChecked = false, exitHiddenInOrbit = false, hintTextInOrbit = "";
var orbitPromise = W.orbit("c01", { durationMs: 4000 });
for (var wi = 0; wi < 400; wi++) {
  await sleep(50);
  var st = W.debugState();
  if (!st) { if (yaws.length) break; else continue; }
  if (!uiChecked && st.overlay) {
    uiChecked = true;
    exitHiddenInOrbit = st.overlay.querySelector(".walkin-exit").hidden === true;
    hintTextInOrbit = st.overlay.querySelector(".walkin-hint").textContent;
  }
  if (st.camera && st.mesh && st.mesh.isInitialized) yaws.push(st.camera.rotation.y);
}
var orbitOk = await orbitPromise;

ok(orbitOk === true, "c01 环视 resolve(true)，实际 " + orbitOk);
ok(W.isOpen() === false, "环视结束后自动关闭（isOpen 为 false）");
ok(document.querySelector(".walkin-overlay") === null, "环视结束后覆盖层已从 DOM 移除");
ok(exitHiddenInOrbit === true, "环视模式下「回到抉择」按钮不渲染");
ok(hintTextInOrbit.indexOf("自动环视") >= 0, "环视模式下提示文案改为「自动环视中」，实际「" + hintTextInOrbit + "」");
ok(yaws.length > 3, "环视过程中采到多帧 camera.rotation.y（实际 " + yaws.length + " 帧）");
var monotoneYaw = yaws.every(function (y, i) { return i === 0 || y <= yaws[i - 1] + 1e-6; });
ok(monotoneYaw, "yaw 单调递减（镜头只朝一个方向转，不来回摆）");
ok(yaws.length > 3 && yaws[yaws.length - 1] < -Math.PI,
   "环视转过半圈以上（末次采样 yaw=" + (yaws[yaws.length - 1] || 0).toFixed(3) + "，应 < -3.14）");

// 常规漫游模式不受影响：仍有「回到抉择」按钮与 WASD 提示
W.open("c01");
await sleep(300);
var normalOverlay = document.querySelector(".walkin-overlay");
ok(normalOverlay && normalOverlay.querySelector(".walkin-exit").hidden === false,
   "常规漫游模式仍渲染「回到抉择」按钮");
ok(normalOverlay && normalOverlay.querySelector(".walkin-hint").textContent.indexOf("WASD") >= 0,
   "常规漫游模式仍显示 WASD 提示");
W.close();
ok(document.querySelector(".walkin-overlay") === null, "常规漫游 close 后覆盖层已移除");
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 300
```

期望：Task 1–2 的 28 项仍通过，Task 3 段在 `W.orbit is not a function` 处抛错。

- [ ] **Step 3: `open()` 参数化并加入环视渲染循环**

在 `js/walkin.js` 模块级变量区（`var sparkDisposedAt = 0;` 之后）追加：

```js
var orbitPaused = false; // 放映暂停时冻结 yaw 推进：画面继续渲染，只是镜头停住
```

把 `function open(choiceId) {` 的签名改为 `function open(choiceId, opts) {`，并在 `var overlay = buildOverlayDom();` 之后插入：

```js
  // opts.orbit = { durationMs, done(ok) }：自动放映的原地环视模式。省略即原有自由漫游。
  var orbitCfg = (opts && opts.orbit) || null;
```

在 `exitBtn.addEventListener("click", close);` 之前插入环视模式的 UI 差异：

```js
  if (orbitCfg) {
    // 环视是"放映片段"而不是"可操作场景"：藏掉退出按钮与操作提示，改成一行状态文案。
    // 退出统一由放映指示条与 Esc 负责（js/autoplay.js 在捕获阶段接管）。
    overlay.classList.add("walkin-overlay--orbit");
    exitBtn.hidden = true;
    overlay.querySelector(".walkin-hint").textContent = "自动环视中";
    overlay.tabIndex = -1;
  }
```

把焦点圈禁那两处（`exitBtn.focus();` 与 `current.onFocusIn` 内的 `exitBtn.focus();`）替换为按模式选目标——环视模式下退出按钮已隐藏，无法聚焦：

```js
  // 焦点圈禁：吞按键不足以杜绝隔层操作（Enter/Space 会由浏览器原生合成 click 激活背后
  // 聚焦的按钮，完全绕过冒泡阶段的键盘守卫），必须圈禁焦点本身。环视模式下退出按钮已
  // 隐藏、不可聚焦，改以覆盖层自身（tabindex=-1）为落点。
  var focusTarget = orbitCfg ? overlay : exitBtn;
  focusTarget.focus();
  current.onFocusIn = function (e) {
    if (!current || current !== session) return;
    if (current.overlay.contains(e.target)) return;
    focusTarget.focus();
  };
  document.addEventListener("focusin", current.onFocusIn);
```

把 `mesh.initialized.then(...)` 里启动渲染循环的那段替换为：

```js
  mesh.initialized
    .then(function () {
      // current !== session：本会话已被关闭或被新会话取代（用户加载期间关闭又重开时，
      // current 非 null 但已是新会话，绝不能在已 dispose 的旧 renderer 上重启渲染循环）
      if (timedOut || current !== session) return;
      clearTimeout(session.timeoutHandle);
      progressEl.hidden = true;

      if (orbitCfg) {
        // 原地转身环视：相机钉在 CAMERA_START 机位只转不动。.spz 是从单一视点重建的，
        // 相机一旦沿圆周公转就会跑出重建体积、露出空洞与破面，且每一幕都得单独调半径。
        var orbitElapsed = 0;
        var orbitLastTs = 0;
        camera.rotation.order = "YXZ";
        renderer.setAnimationLoop(function (ts) {
          if (current !== session) return;
          if (!orbitLastTs) orbitLastTs = ts;
          var dtMs = ts - orbitLastTs;
          orbitLastTs = ts;
          if (dtMs > 100) dtMs = 100;
          if (!orbitPaused) orbitElapsed += dtMs;
          var p = Math.min(orbitElapsed / orbitCfg.durationMs, 1);
          camera.rotation.x = 0;
          camera.rotation.z = 0;
          camera.rotation.y = -2 * Math.PI * window.SHY_AUTOPLAY_KIT.orbitEase(p);
          renderer.render(scene, camera);
          if (p >= 1) {
            var settle = orbitCfg.done;
            orbitCfg = null;
            close();
            settle(true);
          }
        });
        return;
      }

      renderer.setAnimationLoop(function () {
        renderer.render(scene, camera);
        controls.update(camera);
      });
    })
    .catch(function () {
      if (current !== session) return; // 会话已关闭：超时定时器已由 disposeCurrent 清理，UI 已移除
      clearTimeout(session.timeoutHandle);
      showError();
    });
```

- [ ] **Step 4: 环视会话被提前关闭时必须收尾 promise**

在 `disposeCurrent()` 中，`if (!current) return;` 之后插入：

```js
  if (current.orbitDone) {
    // 环视途中被 close()/新会话顶掉（Esc 停止放映、切抉择等）：把仍在等待的 promise
    // 以 false 收尾，否则导演会一直 await 到封顶时限才继续，白等一大段。
    var abortedOrbit = current.orbitDone;
    current.orbitDone = null;
    abortedOrbit(false);
  }
```

相应地，在 `open()` 中构造 `current = { ... }` 的对象字面量里补一个字段（并在环视正常收尾处先清空它，避免重复 settle）：

```js
  current = {
    overlay: overlay, renderer: renderer, scene: scene, camera: camera,
    spark: spark, mesh: null, onResize: null, onKeydown: null, onFocusIn: null,
    timeoutHandle: null, orbitDone: orbitCfg ? orbitCfg.done : null
  };
```

并把上一步渲染循环里的正常收尾改为先摘掉 `orbitDone` 再 `close()`：

```js
          if (p >= 1) {
            var settle = orbitCfg.done;
            orbitCfg = null;
            session.orbitDone = null; // 先摘掉，避免 close() → disposeCurrent 重复 settle
            close();
            settle(true);
          }
```

超时与加载失败路径也要收尾：把 `showError()` 改为

```js
  function showError() {
    if (progressEl) progressEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    if (orbitCfg) {
      // 环视模式下加载失败：不给观众留一个需要手动点掉的错误框，直接收尾跳过本段
      var failed = orbitCfg.done;
      orbitCfg = null;
      if (session) session.orbitDone = null;
      close();
      failed(false);
    }
  }
```

- [ ] **Step 5: 导出 `orbit()` 与 `setOrbitPaused()`**

把文件末尾的导出行替换为：

```js
// 自动放映契约：把泼溅场景原地转满一周后自动关闭。
// resolve(true) = 转满一周；resolve(false) = 无模型 / 不支持 WebGL2 / 加载失败 / 中途被关闭。
// 调用方据此决定跳过本段，不必自己判断素材是否齐备。
function orbit(choiceId, opts) {
  var durationMs = (opts && opts.durationMs) || 24000;
  return probeAvailable(choiceId).then(function (available) {
    if (!available) return false;
    return new Promise(function (resolve) {
      open(choiceId, { orbit: { durationMs: durationMs, done: resolve } });
    });
  });
}

function setOrbitPaused(on) {
  orbitPaused = !!on;
}

window.SHY_WALKIN = {
  probeAvailable: probeAvailable,
  open: open,
  close: close,
  isOpen: isOpen,
  debugState: debugState,
  orbit: orbit,
  setOrbitPaused: setOrbitPaused
};
```

- [ ] **Step 6: 加 CSS——环视模式的提示条样式**

在 `css/main.css` 的 walkin 相关规则区末尾追加：

```css
/* 环视模式：提示条从"操作说明"降格为"状态指示"，居中偏下、更克制，不喧宾夺主 */
.walkin-overlay--orbit .walkin-hint {
  left: 50%;
  right: auto;
  transform: translateX(-50%);
  letter-spacing: 0.2em;
  opacity: 0.5;
}
```

- [ ] **Step 7: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 300
```

期望：`通过 40 项，失败 0 项`，无 `PAGEERROR:` 行。

- [ ] **Step 8: 回归既有 walkin 自检，确认没打破自由漫游**

```bash
node tools/selftest-run.mjs http://localhost:8080/walkin-selftest.html 180
```

期望：与本任务开始前同样的 `通过 N 项，失败 0 项`（该页覆盖探测缓存、加载生命周期、监听器净增为 0、焦点圈禁、Esc 关闭、choice.js 集成等）。

- [ ] **Step 9: 提交**

```bash
git add js/walkin.js css/main.css autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 高斯泼溅原地环视（SHY_WALKIN.orbit）

相机钉在 CAMERA_START 机位绕 Y 轴转满 360° 后自动关闭。选原地转身而非
绕中心公转：.spz 是单一视点重建的，公转会跑出重建体积露空洞，且 19 幕
各需单独调半径与高度。

环视模式藏掉「回到抉择」与 WASD 提示，焦点圈禁改以覆盖层自身为落点；
中途被关闭 / 加载失败 / 超时一律把 promise 以 false 收尾，不让导演空等。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 导演骨架与沙盒进出

**Files:**
- Create: `js/autoplay.js`
- Modify: `js/app.js`（导出 `showToast`）
- Modify: `index.html`（新增 `<script src="js/autoplay.js">`）
- Modify: `autoplay-selftest.html`（追加 Task 4 断言段）

**Interfaces:**
- Consumes: `SHY_AUTOPLAY_KIT.createClock/isCancelledError`（Task 1）；`SHY_APP.state/showView/refreshHud/showToast`；`SHY_SCORE.newState/saveState`；`SHY_SCROLL.render`；`SHY_CHOICE.setAutoplayActive/setViewMode`（Task 2）；`SHY_WALKIN.close`（既有）
- Produces:
  ```js
  window.SHY_APP.showToast(msg);      // app.js 既有私有 showToast 的公开化
  window.SHY_AUTOPLAY = {
    start(opts),        // opts = { debugFast:false, skipOrbits:<默认同 debugFast>, skipConfirm:false } → boolean 是否真的启动了
    stop(),             // 幂等
    togglePause(),
    isRunning(), isPaused(),
    debugState()        // 非契约：{ running, paused, phase, chapterId, eventIndex, lastRun }
                        // lastRun = { total, chapterEarned, finished, view } —— stop() 还原真实存档之前对沙盒终态的快照
  };
  ```

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 4：沙盒进出 ============

ok(typeof window.SHY_APP.showToast === "function", "SHY_APP.showToast 已导出");
var A = window.SHY_AUTOPLAY;
ok(!!A && typeof A.start === "function" && typeof A.stop === "function"
   && typeof A.togglePause === "function" && typeof A.isRunning === "function"
   && typeof A.isPaused === "function" && typeof A.debugState === "function",
   "SHY_AUTOPLAY 六个入口均已导出");

// 造一个"玩家已有进度"的真实存档，证明放映全程不碰它
window.SHY_APP.state = {
  unlockedCount: 5, total: 777, combo: 2,
  answered: { c01: { firstTryCorrect: true, earned: 100, tries: 1, confirmed: true } },
  readExtra: { e0101: true }, litPersons: ["p_linzexu"],
  chapterEarned: { ch01: "甲" }, lastGradedChapter: "ch01", finished: false
};
window.SHY_SCORE.saveState(window.SHY_APP.state);
var rawBefore = window.localStorage.getItem("shanhe_save_v1");
var stateBefore = JSON.stringify(window.SHY_APP.state);
var saveFnBefore = window.SHY_SCORE.saveState;

var started = A.start({ debugFast: true, skipConfirm: true });
ok(started === true, "start() 返回 true");
ok(A.isRunning() === true, "start 后 isRunning 为 true");
ok(window.SHY_APP.state.unlockedCount === 1 && window.SHY_APP.state.total === 0,
   "沙盒 state 被替换为全新状态（unlockedCount=" + window.SHY_APP.state.unlockedCount +
   " total=" + window.SHY_APP.state.total + "）");
ok(window.SHY_SCORE.saveState !== saveFnBefore, "saveState 已被劫持为 no-op");

// 重复 start 必须无效，否则会用沙盒 state 覆盖掉快照，真实存档一去不返
var restarted = A.start({ debugFast: true, skipConfirm: true });
ok(restarted === false, "放映进行中重复 start() 返回 false 且不重置快照");

// 放映期任何写盘调用都必须落空
window.SHY_APP.state.total = 9999;
window.SHY_SCORE.saveState(window.SHY_APP.state);
ok(window.localStorage.getItem("shanhe_save_v1") === rawBefore, "放映期 saveState 调用不写盘");

A.stop();
ok(A.isRunning() === false, "stop 后 isRunning 为 false");
ok(window.SHY_SCORE.saveState === saveFnBefore, "stop 后 saveState 已还原为原函数");
ok(JSON.stringify(window.SHY_APP.state) === stateBefore, "stop 后 state 与启动前快照深度相等");
ok(window.localStorage.getItem("shanhe_save_v1") === rawBefore, "stop 后 localStorage 逐字节未变");

// 重复 stop 必须幂等：若不加守卫，第二次 stop 会把已经是 no-op 的 saveState 当作"原函数"存下来，
// 从此真实存档永远写不进去——这类静默损坏最难排查，必须有断言钉住。
A.stop();
ok(window.SHY_SCORE.saveState === saveFnBefore, "重复 stop() 幂等，不会把 no-op 误当原函数保存");
ok(JSON.stringify(window.SHY_APP.state) === stateBefore, "重复 stop() 不破坏已还原的 state");
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 300
```

期望：Task 1–3 的 40 项仍通过，Task 4 段在 `SHY_APP.showToast is not a function` 处失败/抛错。

- [ ] **Step 3: 在 `js/app.js` 导出 `showToast`**

把 `js/app.js` 顶部的 `SHY_APP` 字面量补一个字段：

```js
  var SHY_APP = {
    showView: showView,
    refreshHud: refreshHud,
    restart: doRestart,
    navigateBack: navigateBack,
    showToast: showToast,
    state: null
  };
```

（`showToast` 已在本文件内定义，此处只是把既有实现公开给 `js/autoplay.js` 复用，避免第二份 toast DOM 实现。）

- [ ] **Step 4: 创建 `js/autoplay.js` 骨架**

```js
// js/autoplay.js
// 《山河岁月》自动放映的"导演"：按时间轴编排既有模块，自己不渲染任何游戏内容。
// 提供 window.SHY_AUTOPLAY = { start(opts), stop(), togglePause(), isRunning(), isPaused(), debugState() }
//
// 沙盒原则：放映从第一幕起完整播放，全程不得改动玩家的真实存档。做法是进场时深拷贝
// 快照 + 把 SHY_SCORE.saveState 劫持为 no-op，退场时原样还原。stop() 是所有退出路径
// （播完 / Esc / 顶栏按钮 / 异常兜底）的唯一收敛点，且必须幂等——重复 stop 若把已经是
// no-op 的 saveState 当成"原函数"再存一次，玩家存档从此永远写不进去。
//
// 消费：SHY_AUTOPLAY_KIT（时基与缓动）、SHY_APP、SHY_SCORE、SHY_SCROLL、SHY_CHOICE、
// SHY_WALKIN、SHY_VOICE、SHY_DATA。除 SHY_AUTOPLAY_KIT 外一律在调用时做存在性检查
// （SHY_WALKIN 来自 ES module，天然 defer，本文件求值时可能尚未挂载）。

(function () {
  "use strict";

  var CONFIRM_TEXT =
    "自动放映将从第一幕开始完整播放（约 2 小时 50 分），全程不影响你当前的存档与得分。" +
    "退出后进度原样恢复。开始放映？";

  var running = false;
  var fast = false;        // debugFast：把主动停顿压到 20ms（仅供自检，不改 waitFor 的超时上限）
  var skipOrbits = false;  // 跳过两段环绕（默认与 debugFast 同步，自检可单独打开）
  var clock = null;
  var snapshot = null;
  var savedSaveState = null;
  var currentAudio = null; // 当前正在等待的解说 <audio>，供暂停/恢复
  var lastRun = null;      // stop() 还原之前对沙盒终态的快照，供自检读取
  var progress = { phase: "idle", chapterId: null, eventIndex: -1 };

  // ------------------------- 安全调用工具 -------------------------

  function kit() { return window.SHY_AUTOPLAY_KIT; }
  function app() { return window.SHY_APP; }
  function data() { return window.SHY_DATA || {}; }

  function toast(msg) {
    if (app() && typeof app().showToast === "function") app().showToast(msg);
  }

  // 主动停顿的时长闸门：debugFast 下压到 20ms。注意只压"刻意的停留"，绝不压 waitFor 的
  // 超时上限——choice.js 自己的旁白淡入（约 1.95s）与 historyNote 展开（900ms）是真实
  // 挂钟，超时上限若一并压掉，自检会在按钮还没出现时就判超时。
  function dwell(v) {
    return fast ? Math.min(v, 20) : v;
  }

  function currentViewName() {
    var ids = { scroll: "scroll-view", choice: "choice-view", graph: "graph-view",
                map: "map-view", ending: "ending-view", about: "about-view" };
    var keys = Object.keys(ids);
    for (var i = 0; i < keys.length; i++) {
      var el = document.getElementById(ids[keys[i]]);
      if (el && !el.hidden) return keys[i];
    }
    return "scroll";
  }

  function hasProgress() {
    var st = app() && app().state;
    return !!(st && ((st.unlockedCount || 1) > 1 || (st.total || 0) > 0));
  }

  // ------------------------- 进场 / 退场 -------------------------

  function start(opts) {
    if (running) return false;
    opts = opts || {};
    if (!opts.skipConfirm && hasProgress() && !window.confirm(CONFIRM_TEXT)) return false;
    if (!window.SHY_SCORE || !window.SHY_SCROLL || !app() || !app().state) return false;

    running = true;
    fast = !!opts.debugFast;
    skipOrbits = opts.skipOrbits == null ? fast : !!opts.skipOrbits;
    lastRun = null;
    progress = { phase: "starting", chapterId: null, eventIndex: -1 };
    clock = kit().createClock();

    snapshot = JSON.parse(JSON.stringify(app().state));
    savedSaveState = window.SHY_SCORE.saveState;
    window.SHY_SCORE.saveState = function () {};

    app().state = window.SHY_SCORE.newState();
    window.SHY_SCROLL.render();
    app().refreshHud();
    app().showView("scroll");

    runTimeline().then(finishNaturally, function (err) {
      if (kit().isCancelledError(err)) return; // stop() 主动取消，属正常路径
      // 时间轴出意外不能把玩家的存档扣在沙盒里：先记日志，再走统一退场还原
      if (window.console && console.error) console.error("[autoplay] 时间轴异常", err);
      stop();
    });
    return true;
  }

  // Task 5 填充真正的时间轴；骨架阶段是一个可被 cancel 打断的空转，
  // 用于先把沙盒进出与退场还原这条最要紧的路径立住。
  function runTimeline() {
    return clock.wait(600000);
  }

  function finishNaturally() {
    if (!running) return;
    stop();
  }

  function stop() {
    if (!running) return;
    running = false;
    progress = { phase: "idle", chapterId: null, eventIndex: -1 };

    if (clock) clock.cancel();
    clock = null;

    // 记录沙盒终态（还原之前），供自检核对"确实跑到了满分通关"
    if (app() && app().state) {
      lastRun = {
        total: app().state.total || 0,
        chapterEarned: JSON.parse(JSON.stringify(app().state.chapterEarned || {})),
        finished: !!app().state.finished,
        view: currentViewName()
      };
    }

    teardownScene();

    if (savedSaveState) {
      window.SHY_SCORE.saveState = savedSaveState;
      savedSaveState = null;
    }
    if (snapshot) {
      app().state = snapshot;
      snapshot = null;
    }
    if (window.SHY_SCROLL) window.SHY_SCROLL.render();
    if (app()) {
      app().refreshHud();
      app().showView("scroll");
    }
    toast("放映结束，已恢复原有进度");
  }

  // 把画面从"放映中"的任何中间态收干净：解说、3D 覆盖层、观景模式、事件卡。
  function teardownScene() {
    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) { /* 忽略 */ }
      currentAudio = null;
    }
    if (window.SHY_VOICE && typeof window.SHY_VOICE.stop === "function") window.SHY_VOICE.stop();
    if (window.SHY_WALKIN && typeof window.SHY_WALKIN.close === "function") window.SHY_WALKIN.close();
    if (window.SHY_CHOICE) {
      if (typeof window.SHY_CHOICE.setViewMode === "function") window.SHY_CHOICE.setViewMode(false);
      if (typeof window.SHY_CHOICE.setOrbitPaused === "function") window.SHY_CHOICE.setOrbitPaused(false);
      if (typeof window.SHY_CHOICE.setAutoplayActive === "function") window.SHY_CHOICE.setAutoplayActive(false);
    }
    var closeBtn = document.querySelector(".modal-backdrop.is-open .card-close");
    if (closeBtn) closeBtn.click();
  }

  // ------------------------- 暂停 -------------------------

  function togglePause() {
    if (!running || !clock) return;
    if (clock.isPaused()) {
      clock.resume();
      if (currentAudio) { try { currentAudio.play(); } catch (e) { /* 忽略 */ } }
      setOrbitsPaused(false);
    } else {
      clock.pause();
      if (currentAudio) { try { currentAudio.pause(); } catch (e) { /* 忽略 */ } }
      setOrbitsPaused(true);
    }
  }

  // 暂停必须同时冻结三处：时间轴、解说音频、两条镜头轨道。漏掉任何一处，
  // 恢复后画面与声音就对不上了。
  function setOrbitsPaused(on) {
    if (window.SHY_CHOICE && typeof window.SHY_CHOICE.setOrbitPaused === "function") {
      window.SHY_CHOICE.setOrbitPaused(on);
    }
    if (window.SHY_WALKIN && typeof window.SHY_WALKIN.setOrbitPaused === "function") {
      window.SHY_WALKIN.setOrbitPaused(on);
    }
  }

  window.SHY_AUTOPLAY = {
    start: start,
    stop: stop,
    togglePause: togglePause,
    isRunning: function () { return running; },
    isPaused: function () { return !!(clock && clock.isPaused()); },
    debugState: function () {
      return {
        running: running,
        paused: !!(clock && clock.isPaused()),
        phase: progress.phase,
        chapterId: progress.chapterId,
        eventIndex: progress.eventIndex,
        lastRun: lastRun
      };
    }
  };
})();
```

- [ ] **Step 5: 在 `index.html` 挂载导演**

在 `<script src="js/app.js"></script>` 之后、`<script type="module" src="js/walkin.js"></script>` 之前插入：

```html
<script src="js/app.js"></script>
<script src="js/autoplay.js"></script>
<script type="module" src="js/walkin.js"></script>
```

同时在 `autoplay-selftest.html` 里做同样的插入（该页镜像 index.html 的脚本序列）。

- [ ] **Step 6: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 300
```

期望：`通过 54 项，失败 0 项`，无 `PAGEERROR:` 行。

- [ ] **Step 7: 提交**

```bash
git add js/autoplay.js js/app.js index.html autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 自动放映导演骨架与沙盒进出

进场深拷贝快照 + 劫持 SHY_SCORE.saveState 为 no-op，退场原样还原。
stop() 是所有退出路径的唯一收敛点且幂等——重复 stop 若把已是 no-op 的
saveState 当作原函数再存一次，玩家存档从此永远写不进去，故加断言钉住。

时间轴异常也走统一退场，不把存档扣在沙盒里。app.js 的 showToast 公开化
供导演复用，避免第二份 toast DOM 实现。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 时间轴主循环（章引言幕 + 事件幕 + 自动作答）

**Files:**
- Modify: `js/autoplay.js`（替换 `runTimeline` 空转，新增各幕实现与解说等待）
- Modify: `css/main.css`（`.choice-option.is-auto-picking` 高亮）
- Modify: `autoplay-selftest.html`（追加 Task 5 断言段）

**Interfaces:**
- Consumes: Task 4 的全部内部状态；`SHY_SCROLL.openEvent/advance`；`SHY_VOICE.playFor/current`；`SHY_DATA.chapters/events/choices`
- Produces: `SHY_AUTOPLAY.debugState().lastRun = { total, chapterEarned, finished, view }`（Task 4 已定义结构，本任务开始真正被填满）

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 5：全程时间轴 ============

window.SHY_APP.state = window.SHY_SCORE.newState();
window.SHY_SCORE.saveState(window.SHY_APP.state);
var raw5 = window.localStorage.getItem("shanhe_save_v1");
var snap5 = JSON.stringify(window.SHY_APP.state);

A.start({ debugFast: true, skipConfirm: true });
var ended5 = false;
for (var k5 = 0; k5 < 3000; k5++) {          // 最长 300s
  await sleep(100);
  if (!A.isRunning()) { ended5 = true; break; }
}
ok(ended5 === true, "debugFast 全程放映在 300s 内自行跑完并停止");

var lr = A.debugState().lastRun;
ok(!!lr, "stop 前记录了沙盒终态 lastRun");
ok(lr && lr.finished === true, "放映走到通关（沙盒 state.finished 为 true）");
ok(lr && lr.view === "ending", "终态停在 ending 视图，实际 " + (lr && lr.view));
ok(lr && lr.total === 3290,
   "满分 3290（26 抉择全首答正确 + 连击倍率，不含史海钩沉），实际 " + (lr && lr.total));
var gradeKeys = lr ? Object.keys(lr.chapterEarned) : [];
ok(gradeKeys.length === 15 && gradeKeys.every(function (k) { return lr.chapterEarned[k] === "甲"; }),
   "15 章全部评为甲，实际 " + gradeKeys.length + " 章 / " +
   gradeKeys.map(function (k) { return lr.chapterEarned[k]; }).join(""));

ok(JSON.stringify(window.SHY_APP.state) === snap5, "全程跑完后真实 state 原样还原");
ok(window.localStorage.getItem("shanhe_save_v1") === raw5, "全程跑完后 localStorage 逐字节未变");

// 中途 stop 也要能干净退场，不留下 3D 覆盖层与观景态
A.start({ debugFast: true, skipConfirm: true });
await sleep(1500);
A.stop();
await sleep(200);
ok(document.querySelector(".walkin-overlay") === null, "中途 stop 后无残留 3D 覆盖层");
ok(document.querySelector(".choice-overlay.is-viewing") === null, "中途 stop 后观景模式已退出");
ok(document.querySelector(".modal-backdrop.is-open") === null, "中途 stop 后事件卡已关闭");
ok(JSON.stringify(window.SHY_APP.state) === snap5, "中途 stop 后真实 state 原样还原");
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 600
```

期望：Task 1–4 的 54 项仍通过；Task 5 段第一条即失败（`runTimeline` 仍是 600s 空转，300s 内不会自行结束）。

- [ ] **Step 3: 加常量与查找工具**

在 `js/autoplay.js` 的常量区（`var CONFIRM_TEXT = ...` 之后）追加：

```js
  var CHAPTER_PAUSE_MS = 1200;     // 章引言播完后的停顿
  var SCROLL_SETTLE_MS = 700;      // 平滑滚动到章引言卡的落位时间
  var EVENT_PAUSE_MS = 1200;       // 事件卡解说播完后的停顿
  var AFTER_ADVANCE_MS = 900;      // 长卷滚到下一节点的落位时间
  var PICK_HIGHLIGHT_MS = 800;     // 正确选项高亮多久再点下去
  var NOTE_READ_MIN_MS = 6000;     // 历史真实走向的最短阅读停留
  var NOTE_READ_PER_CHAR_MS = 180; // 每字增加的阅读停留
  var ENDING_HOLD_MS = 20000;      // 终章停留
  var HARD_CAP_MS = 180000;        // 任何单次等待的硬上限，绝不卡死整场

  // waitFor 的超时上限（真实挂钟，debugFast 下也不压缩）：choice.js 自己的旁白逐句淡入
  // 约 1.95s、historyNote 展开 900ms 都是真实定时器，压掉超时会在按钮还没出现时误判。
  var WAIT_OPTIONS_MS = 20000;
  var WAIT_ACTION_MS = 20000;
```

在工具函数区追加：

```js
  function chaptersSorted() {
    return ((data().chapters) || []).slice().sort(function (a, b) { return a.order - b.order; });
  }

  function eventsOfChapter(chapterId) {
    return ((data().events) || []).filter(function (e) { return e.chapterId === chapterId; });
  }

  function findChoice(choiceId) {
    var list = (data().choices) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === choiceId) return list[i];
    }
    return null;
  }

  function cssEscapeId(id) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(id);
    return String(id).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  // 解说缺席（静音 / mp3 缺失 / 浏览器拒绝自动播放）时的兜底停留：按正文字数估时
  function estimateMs(text) {
    var n = String(text || "").length;
    return Math.max(4000, Math.min(25000, n * 220));
  }
```

- [ ] **Step 4: 实现解说等待**

在 `js/autoplay.js` 中追加：

```js
  // ------------------------- 等解说播完 -------------------------

  // SHY_VOICE.current 是当前播放的 <audio>（无播放时为 null）。必须用 addEventListener
  // 而不是 audio.onended：narration.js 的 playFor() 自己用 addEventListener 挂了清理逻辑，
  // 而它的 stop() 会执行 audio.onended = null —— 用属性赋值既可能被抹掉，也无法共存。
  function makeAudioEndWaiter(audio) {
    var settled = false;
    var resolveFn = null;
    function done() {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", done);
      audio.removeEventListener("error", done);
      document.removeEventListener("shy:muted-changed", done);
      if (resolveFn) resolveFn();
    }
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);
    // 放映中途静音：narration.js 收到本事件会立即 stop()，audio 被 pause 但不会派发
    // ended —— 不监听这条，导演会一直等到封顶时限。
    document.addEventListener("shy:muted-changed", done);
    return {
      promise: new Promise(function (resolve) { if (settled) resolve(); else resolveFn = resolve; }),
      cleanup: done
    };
  }

  function waitNarration(id, fallbackText) {
    if (fast) return clock.wait(20);
    return clock
      .waitFor(function () { return !!(window.SHY_VOICE && window.SHY_VOICE.current); },
               { timeoutMs: 600, intervalMs: 50 })
      .then(function (got) {
        if (!got) return clock.wait(estimateMs(fallbackText));
        var audio = window.SHY_VOICE.current;
        currentAudio = audio;
        var waiter = makeAudioEndWaiter(audio);
        var byDuration = isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1000 + 2000
          : estimateMs(fallbackText) + 2000;
        return clock.withCap(waiter.promise, Math.min(HARD_CAP_MS, byDuration)).then(function () {
          waiter.cleanup();
          currentAudio = null;
        });
      });
  }
```

- [ ] **Step 5: 实现时间轴主循环**

把 Task 4 里那个空转的 `runTimeline` 替换为：

```js
  // ------------------------- 时间轴 -------------------------

  async function runTimeline() {
    var chapters = chaptersSorted();
    var allEvents = (data().events) || [];
    for (var ci = 0; ci < chapters.length; ci++) {
      var ch = chapters[ci];
      var chEvents = eventsOfChapter(ch.id);
      if (!chEvents.length) continue;

      progress.chapterId = ch.id;
      progress.phase = "intro";
      await playChapterIntro(ch);

      for (var ei = 0; ei < chEvents.length; ei++) {
        progress.phase = "event";
        progress.eventIndex = allEvents.indexOf(chEvents[ei]);
        await playEvent(chEvents[ei]);
      }
    }
    progress.phase = "ending";
    await clock.wait(dwell(ENDING_HOLD_MS));
  }

  // 章引言幕：滚到该章引言卡（#scroll-view 上既有的 scroll 监听会顺带把主题色切过去，
  // 不需要额外契约），播章解说，停顿。
  async function playChapterIntro(ch) {
    await scrollToChapterIntro(ch.id);
    if (window.SHY_VOICE && typeof window.SHY_VOICE.playFor === "function") {
      window.SHY_VOICE.playFor(ch.id);
    }
    await waitNarration(ch.id, ch.intro);
    await clock.wait(dwell(CHAPTER_PAUSE_MS));
  }

  function scrollToChapterIntro(chapterId) {
    var container = document.getElementById("scroll-view");
    var card = document.querySelector(
      '.chapter-section[data-chapter-id="' + cssEscapeId(chapterId) + '"] .chapter-intro-card');
    if (!container || !card) return clock.wait(0);
    var cRect = container.getBoundingClientRect();
    var kRect = card.getBoundingClientRect();
    var left = container.scrollLeft + (kRect.left - cRect.left) - container.clientWidth / 2 + kRect.width / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    return clock.wait(dwell(SCROLL_SETTLE_MS));
  }

  // 事件幕：开卡（内部自动播 ev.id 解说）→ 等解说 → 停顿 → 点「继续前行」。
  // 带抉择的事件由 advance() 同步派发 shy:enter-choice，随即转入抉择幕。
  async function playEvent(ev) {
    window.SHY_SCROLL.openEvent(ev.id);
    await waitNarration(ev.id, ev.summary);
    await clock.wait(dwell(EVENT_PAUSE_MS));

    var btn = document.querySelector(".modal-backdrop.is-open .btn-continue");
    if (btn) btn.click();
    else window.SHY_SCROLL.advance(); // 兜底：卡片未按前沿态渲染时直接推进

    if (ev.choiceId) {
      progress.phase = "choice";
      await playChoice(ev.choiceId);
      progress.phase = "event";
    }
    await clock.wait(dwell(AFTER_ADVANCE_MS));
  }

  // 抉择幕。进入本函数时 choice.js 的 openChoice 已同步开场并在播 cNN.mp3 旁白。
  async function playChoice(choiceId) {
    var choice = findChoice(choiceId);
    if (window.SHY_CHOICE && typeof window.SHY_CHOICE.setAutoplayActive === "function") {
      window.SHY_CHOICE.setAutoplayActive(true);
    }
    await waitNarration(choiceId, choice ? choice.scene : "");
    await runOrbits(choiceId);           // Task 6 填充；骨架阶段为 no-op
    await pickCorrectOption(choice);
    await confirmAndContinue(choice);
  }

  function runOrbits() {
    return clock.wait(0);
  }

  async function pickCorrectOption(choice) {
    var options = (choice && choice.options) || [];
    var correctIdx = -1;
    for (var i = 0; i < options.length; i++) {
      if (options[i].correct) { correctIdx = i; break; }
    }
    if (correctIdx < 0) {
      // 数据异常（某抉择没有 correct 项）：不让放映死等，退化为选第一项并留下日志。
      // 正常数据下不可达——26 个抉择均有唯一正确项。
      if (window.console && console.warn) {
        console.warn("[autoplay] 抉择 " + (choice && choice.id) + " 无 correct 选项，退化为选第一项");
      }
      correctIdx = 0;
    }
    var sel = '.choice-option[data-orig-index="' + correctIdx + '"]';
    var appeared = await clock.waitFor(function () {
      var b = document.querySelector(sel);
      return !!(b && !b.disabled);
    }, { timeoutMs: WAIT_OPTIONS_MS });
    var btn = document.querySelector(sel);
    if (!appeared || !btn) return;

    // 先高亮再点：否则观众只会看到选项凭空跳到已作答态，看不清"选的是哪一项"
    btn.classList.add("is-auto-picking");
    await clock.wait(dwell(PICK_HIGHLIGHT_MS));
    btn.classList.remove("is-auto-picking");
    btn.click();
  }

  async function confirmAndContinue(choice) {
    // 放映永远选正确项，正常只会出现「继续前行」；仍兼容「我明白了」以防数据异常
    // 走进了答错分支，避免整场卡在这里。
    await clock.waitFor(function () {
      return !!document.querySelector(".choice-btn-learn, .choice-btn-continue");
    }, { timeoutMs: WAIT_ACTION_MS });

    var learn = document.querySelector(".choice-btn-learn");
    if (learn) {
      learn.click();
      await clock.waitFor(function () {
        return !!document.querySelector(".choice-btn-continue");
      }, { timeoutMs: WAIT_ACTION_MS });
    }

    var note = (choice && choice.historyNote) || "";
    await clock.wait(dwell(Math.max(NOTE_READ_MIN_MS, note.length * NOTE_READ_PER_CHAR_MS)));

    var cont = document.querySelector(".choice-btn-continue");
    if (cont) cont.click();
    else window.SHY_SCROLL.advance(); // 兜底：按钮意外缺席时直接推进，不停摆
  }
```

注意 `runTimeline` 等改为 `async function`，与 Task 4 中 `start()` 里 `runTimeline().then(...)` 的用法兼容（async 函数返回 Promise）。

- [ ] **Step 6: 加自动选中的高亮样式**

在 `css/main.css` 的抉择选项样式区（`.choice-option` 相关规则之后）追加：

```css
/* 自动放映选中正确项前的短暂高亮：让观众看清"选的是哪一项"，而不是选项凭空跳到已答态。
   只做描边呼吸，不改布局，避免面板在放映中抖动。 */
.choice-option.is-auto-picking {
  border-color: var(--c-gold);
  box-shadow: 0 0 0 2px rgba(198, 160, 74, 0.55), 0 0 18px rgba(198, 160, 74, 0.35);
  animation: autoPickPulse 0.8s ease-in-out;
}
@keyframes autoPickPulse {
  0%   { box-shadow: 0 0 0 0 rgba(198, 160, 74, 0.0), 0 0 0 rgba(198, 160, 74, 0.0); }
  50%  { box-shadow: 0 0 0 3px rgba(198, 160, 74, 0.7), 0 0 22px rgba(198, 160, 74, 0.5); }
  100% { box-shadow: 0 0 0 2px rgba(198, 160, 74, 0.55), 0 0 18px rgba(198, 160, 74, 0.35); }
}
@media (prefers-reduced-motion: reduce) {
  .choice-option.is-auto-picking { animation: none; }
}
```

- [ ] **Step 7: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 600
```

期望：`通过 67 项，失败 0 项`，无 `PAGEERROR:` 行。

若 `lr.total` 不等于 3290，先核对是否有抉择被跳过（`debugState().eventIndex` 停在哪）或某次 `pickCorrectOption` 超时；不要直接把断言改成实测值。

- [ ] **Step 8: 提交**

```bash
git add js/autoplay.js css/main.css autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 自动放映时间轴（章引言幕 + 事件幕 + 自动作答）

按章循环：滚到引言卡播章解说，再逐幕开事件卡、等解说播完、点继续前行；
带抉择的事件转入抉择幕，高亮正确项 800ms 后点下去，等历史真实走向展开、
按字数留足阅读时间再继续。

等解说用 addEventListener 而非 audio.onended（narration.js 的 stop() 会
把该属性置 null）；并监听 shy:muted-changed——中途静音时 audio 被 pause
但不派发 ended，不监听就会一直等到封顶时限。

debugFast 只压主动停顿，不压 waitFor 的超时上限：choice.js 自己的旁白
淡入与 historyNote 展开是真实挂钟，压掉会在按钮还没出现时误判超时。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 抉择幕插入两段环绕

**Files:**
- Modify: `js/autoplay.js`（实现 `runOrbits`）
- Modify: `autoplay-selftest.html`（追加 Task 6 断言段）

**Interfaces:**
- Consumes: `SHY_CHOICE.orbitPanorama/setViewMode`（Task 2）、`SHY_WALKIN.orbit`（Task 3）、Task 5 的 `playChoice`
- Produces: 无新增对外接口；`start(opts)` 的 `opts.skipOrbits` 开始起作用

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 6：抉择幕的两段环绕 ============

// 用打桩记录编排顺序与参数：真跑 26 幕 × 48s 环绕不适合放进自检，
// 要验的是"导演是否按正确顺序、正确参数、正确的观景态开关调用了它们"。
var calls = [];
var realPano = window.SHY_CHOICE.orbitPanorama;
var realViewMode = window.SHY_CHOICE.setViewMode;
var realWalkinOrbit = window.SHY_WALKIN.orbit;
window.SHY_CHOICE.orbitPanorama = function (o) { calls.push("pano:" + o.durationMs); return Promise.resolve(true); };
window.SHY_CHOICE.setViewMode = function (on) { calls.push("view:" + (on ? "on" : "off")); return realViewMode(on); };
window.SHY_WALKIN.orbit = function (id, o) { calls.push("splat:" + id + ":" + o.durationMs); return Promise.resolve(true); };

window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true, skipOrbits: false });
var ended6 = false;
for (var k6 = 0; k6 < 3000; k6++) {
  await sleep(100);
  if (!A.isRunning()) { ended6 = true; break; }
}
ok(ended6 === true, "带环绕编排的 debugFast 全程放映在 300s 内跑完");

ok(calls.slice(0, 4).join(" | ") === "view:on | pano:24000 | splat:c01:24000 | view:off",
   "首个抉择幕的编排为 观景on → 全景24s → 泼溅24s → 观景off，实际 " + calls.slice(0, 4).join(" | "));
ok(calls.filter(function (c) { return c.indexOf("pano:") === 0; }).length === 26,
   "26 个抉择幕各调用一次全景环绕，实际 " + calls.filter(function (c) { return c.indexOf("pano:") === 0; }).length);
ok(calls.filter(function (c) { return c.indexOf("splat:") === 0; }).length === 26,
   "26 个抉择幕各调用一次泼溅环视（无模型的由 orbit 内部 resolve(false)），实际 " +
   calls.filter(function (c) { return c.indexOf("splat:") === 0; }).length);
ok(calls.filter(function (c) { return c === "view:on"; }).length === 26 &&
   calls.filter(function (c) { return c === "view:off"; }).length === 26,
   "观景模式 26 开 26 关，收支平衡");
ok(A.debugState().lastRun.total === 3290, "插入环绕后仍是满分 3290，实际 " + A.debugState().lastRun.total);

// skipOrbits（自检默认随 debugFast 打开）时一次环绕都不该发起
calls.length = 0;
window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true });
await sleep(3000);
A.stop();
ok(calls.length === 0, "skipOrbits 默认随 debugFast 打开时不发起任何环绕，实际 " + calls.length + " 次");

// 减弱动效偏好：跳过两段环绕，改为观景态静态停留（不调 orbitPanorama、不调 walkin.orbit）
calls.length = 0;
var realMatchMedia = window.matchMedia;
window.matchMedia = function (q) {
  if (/prefers-reduced-motion/.test(q)) return { matches: true, media: q, addEventListener: function () {}, removeEventListener: function () {} };
  return realMatchMedia.call(window, q);
};
window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true, skipOrbits: false });
for (var k7 = 0; k7 < 600 && calls.indexOf("view:off") < 0; k7++) await sleep(50);
A.stop();
window.matchMedia = realMatchMedia;
ok(calls.indexOf("view:on") >= 0 && calls.indexOf("view:off") >= 0,
   "减弱动效下仍进出观景模式（做静态展示）");
ok(calls.filter(function (c) { return c.indexOf("pano:") === 0 || c.indexOf("splat:") === 0; }).length === 0,
   "减弱动效下不发起任何环绕，实际 " +
   calls.filter(function (c) { return c.indexOf("pano:") === 0 || c.indexOf("splat:") === 0; }).length + " 次");

window.SHY_CHOICE.orbitPanorama = realPano;
window.SHY_CHOICE.setViewMode = realViewMode;
window.SHY_WALKIN.orbit = realWalkinOrbit;
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 900
```

期望：Task 1–5 的 67 项仍通过；Task 6 的编排断言全部失败（`runOrbits` 仍是 no-op，`calls` 为空）。

- [ ] **Step 3: 加常量**

在 `js/autoplay.js` 常量区追加：

```js
  var PANO_ORBIT_MS = 24000;   // 全景转满一周
  var SPLAT_ORBIT_MS = 24000;  // 泼溅原地转满一周
  var REDUCED_HOLD_MS = 6000;  // 命中减弱动效偏好时，改为静态展示的停留
```

- [ ] **Step 4: 实现 `runOrbits`**

把 Task 5 里的占位 `runOrbits` 替换为：

```js
  // 命中减弱动效偏好时不做匀速环绕——24 秒的持续旋转正是前庭敏感用户最需要避免的运动。
  // 每次调用时读取而非启动时缓存：用户可能在放映途中改系统设置。
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // 抉择幕的纯净环绕段：面板淡出 → 全景转满一周 → 泼溅原地转满一周 → 面板淡回。
  // 两段环绕都套 withCap：它们靠 rAF 推进，而 rAF 在后台标签页完全停摆，
  // 没有封顶就等于切走标签页把放映永久挂死。
  async function runOrbits(choiceId) {
    if (skipOrbits) return;
    var C = window.SHY_CHOICE;
    if (!C || typeof C.setViewMode !== "function") return;

    C.setViewMode(true);
    try {
      if (prefersReducedMotion()) {
        await clock.wait(dwell(REDUCED_HOLD_MS));
        return;
      }
      if (typeof C.orbitPanorama === "function") {
        await clock.withCap(C.orbitPanorama({ durationMs: PANO_ORBIT_MS }), HARD_CAP_MS);
      }
      var W = window.SHY_WALKIN;
      if (W && typeof W.orbit === "function") {
        // 无 .spz 的 7 幕（c10、c21–c26）由 orbit 内部 resolve(false) 直接跳过，
        // 导演不必自己维护"哪几幕有模型"的清单。
        await clock.withCap(W.orbit(choiceId, { durationMs: SPLAT_ORBIT_MS }), HARD_CAP_MS);
      }
    } finally {
      // 无论环绕正常结束、被封顶、还是被 cancel 打断，面板都必须淡回来，
      // 否则观众会停在一个没有任何文字的全景上，或 stop() 后残留观景态。
      C.setViewMode(false);
    }
  }
```

- [ ] **Step 5: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 900
```

期望：`通过 76 项，失败 0 项`，无 `PAGEERROR:` 行。

- [ ] **Step 6: 提交**

```bash
git add js/autoplay.js autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 抉择幕插入全景环绕与泼溅环视两段

旁白播完后进观景模式，全景转满一周 → 泼溅原地转满一周 → 面板淡回作答。
无 .spz 的 7 幕由 SHY_WALKIN.orbit 内部 resolve(false) 自动跳过，导演不
维护素材清单。

两段环绕都套 withCap：它们靠 rAF 推进，rAF 在后台标签页完全停摆，没有
封顶就等于切走标签页把放映永久挂死。观景模式的退出放在 finally，保证
被封顶或被 cancel 打断时面板也一定淡回来。

命中减弱动效偏好时跳过环绕改为静态停留——24 秒持续旋转正是前庭敏感用户
最该避免的运动。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 放映外壳（顶栏入口、指示条、键盘、守卫、暂停）

**Files:**
- Modify: `index.html`（顶栏新增 `#btn-autoplay`）
- Modify: `js/app.js`（绑定按钮、`guardAutoplay()` 串入各顶栏 handler）
- Modify: `js/autoplay.js`（指示条渲染、捕获阶段键盘、`shy:view-changing` 兜底、按钮态同步）
- Modify: `css/main.css`（指示条样式）
- Modify: `autoplay-selftest.html`（同步顶栏 DOM；追加 Task 7 断言段）

**Interfaces:**
- Consumes: Task 4–6 的 `SHY_AUTOPLAY` 全部内部状态
- Produces: DOM 契约 `#btn-autoplay`、`.autoplay-indicator`（含 `.autoplay-indicator-pause` 按钮）

- [ ] **Step 1: 追加自检断言（此时必然失败）**

先在 `autoplay-selftest.html` 的顶栏 `<nav id="top-bar-actions">` 里、`btn-map` 与 `btn-ending` 之间插入按钮（与 index.html 保持一致）：

```html
    <button id="btn-map" type="button">舆图</button>
    <button id="btn-autoplay" type="button" aria-pressed="false"><span class="btn-label-full">自动放映</span><span class="btn-label-short">放映</span></button>
    <button id="btn-ending" type="button" hidden>终章</button>
```

然后在 `report();` 之前追加：

```js
// ============ Task 7：放映外壳 ============

var apBtn = document.getElementById("btn-autoplay");
ok(!!apBtn, "顶栏「自动放映」按钮存在");

window.SHY_APP.state = window.SHY_SCORE.newState();
apBtn.click();
await sleep(100);
ok(A.isRunning() === true, "点顶栏按钮即开始放映（无进度时不弹确认框）");
ok(apBtn.getAttribute("aria-pressed") === "true", "放映中 aria-pressed=true");
ok(apBtn.textContent.indexOf("停止") >= 0, "放映中按钮文案切为停止，实际「" + apBtn.textContent + "」");
var indicator = document.querySelector(".autoplay-indicator");
ok(!!indicator, "放映指示条已渲染");
ok(indicator.textContent.indexOf("Esc") >= 0, "指示条含 Esc 退出提示");

// 空格暂停 / 继续
document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
await sleep(60);
ok(A.isPaused() === true, "空格键暂停");
ok(document.querySelector(".autoplay-indicator").textContent.indexOf("已暂停") >= 0, "指示条显示已暂停");
document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
await sleep(60);
ok(A.isPaused() === false, "再按空格继续");

// 顶栏守卫：星图/舆图/关于/重开被拦截，静音不受限
document.getElementById("btn-graph").click();
await sleep(60);
ok(document.getElementById("graph-view").hidden === true, "放映期点「人物星图」被守卫拦截，不切视图");
ok(A.isRunning() === true, "被守卫拦截不影响放映继续");
document.getElementById("btn-map").click();
await sleep(60);
ok(document.getElementById("map-view").hidden === true, "放映期点「舆图」被守卫拦截");
document.getElementById("btn-about").click();
await sleep(60);
ok(document.getElementById("about-view").hidden === true, "放映期点「关于」被守卫拦截");
document.getElementById("btn-mute").click();
await sleep(60);
ok(A.isRunning() === true, "静音不受守卫限制，也不打断放映");
document.getElementById("btn-mute").click();

// Esc 停止（捕获阶段注册，必须先于 choice.js 的「抉择不可跳过」拦截）
document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
await sleep(150);
ok(A.isRunning() === false, "Esc 停止放映");
ok(document.querySelector(".autoplay-indicator") === null, "停止后指示条已移除");
ok(apBtn.getAttribute("aria-pressed") === "false", "停止后 aria-pressed 复位");

// 抉择进行中按 Esc 也必须能停：choice.js 会吞掉冒泡阶段的 Escape，
// 导演若不在捕获阶段接管，放映就再也停不下来。
window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true });
var inChoice = false;
for (var k8 = 0; k8 < 600; k8++) {
  await sleep(50);
  if (document.getElementById("choice-view").hidden === false) { inChoice = true; break; }
}
ok(inChoice === true, "放映在 30s 内进入了抉择视图");
document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
await sleep(150);
ok(A.isRunning() === false, "抉择进行中按 Esc 仍能停止放映（捕获阶段优先于 choice.js）");

// 放映中点顶栏按钮 = 停止放映
window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true });
await sleep(100);
apBtn.click();
await sleep(150);
ok(A.isRunning() === false, "放映中再点顶栏按钮即停止");
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 900
```

期望：Task 1–6 的 76 项仍通过；Task 7 段从 `顶栏「自动放映」按钮存在` 之后开始失败（按钮已在自检页加了，但没人绑定它）。

- [ ] **Step 3: `index.html` 加顶栏按钮**

在 `<button id="btn-map" ...>` 与 `<button id="btn-ending" ...>` 之间插入：

```html
    <button id="btn-map" type="button">舆图</button>
    <button id="btn-autoplay" type="button" aria-pressed="false"><span class="btn-label-full">自动放映</span><span class="btn-label-short">放映</span></button>
    <button id="btn-ending" type="button" hidden>终章</button>
```

- [ ] **Step 4: `js/app.js` 绑定按钮与放映守卫**

在 `guardChoiceInProgress()` 之后新增同构的守卫：

```js
  // 放映进行中点顶栏「人物星图/舆图/关于/终章」或站标：轻提示并放弃本次切换，不打断放映；
  // 静音与「自动放映」按钮本身不受此限（各自的绑定未接入本守卫），「重新开始」则先停放映
  // 再走原有确认流程——否则会在沙盒态下清空真实存档。命中即返回 true。
  function guardAutoplay() {
    if (!window.SHY_AUTOPLAY || !window.SHY_AUTOPLAY.isRunning()) return false;
    showToast("放映中，按 Esc 退出");
    return true;
  }
```

在 `bindTopBar()` 内，把四处 `if (guardChoiceInProgress()) return;` 各自改为两行：

```js
      if (guardAutoplay()) return;
      if (guardChoiceInProgress()) return;
```

需要改的是 `graphBtn`、`mapBtn`、`aboutBtn`、`endingBtn` 四个 handler，以及 `appTitle` 的 click handler。

在 `doRestart()` 开头插入（重开必须先退出沙盒，否则会拿沙盒 state 当真实存档清空）：

```js
  function doRestart() {
    if (window.SHY_AUTOPLAY && window.SHY_AUTOPLAY.isRunning()) window.SHY_AUTOPLAY.stop();
    var confirmed = window.confirm("确定要清空当前存档、重新开始这段山河岁月吗？此操作不可撤销。");
```

在 `bindTopBar()` 末尾追加放映按钮的绑定：

```js
    var autoplayBtn = document.getElementById("btn-autoplay");
    if (autoplayBtn) {
      autoplayBtn.addEventListener("click", function () {
        if (!window.SHY_AUTOPLAY) return;
        if (window.SHY_AUTOPLAY.isRunning()) window.SHY_AUTOPLAY.stop();
        else window.SHY_AUTOPLAY.start();
      });
    }
```

- [ ] **Step 5: `js/autoplay.js` 加指示条、键盘接管与按钮态同步**

在文件内追加（并在 `start()` 末尾调用 `mountIndicator()`、`bindKeys()`、`syncButton()`；在 `stop()` 末尾调用 `unmountIndicator()`、`unbindKeys()`、`syncButton()`）：

```js
  // ------------------------- 指示条 -------------------------

  var indicatorEl = null;

  function mountIndicator() {
    if (indicatorEl) return;
    indicatorEl = document.createElement("div");
    indicatorEl.className = "autoplay-indicator";
    indicatorEl.setAttribute("role", "status");
    indicatorEl.innerHTML =
      '<span class="autoplay-indicator-dot" aria-hidden="true"></span>' +
      '<span class="autoplay-indicator-text"></span>' +
      '<button type="button" class="autoplay-indicator-pause"></button>' +
      '<span class="autoplay-indicator-esc">Esc 退出</span>';
    indicatorEl.querySelector(".autoplay-indicator-pause").addEventListener("click", togglePause);
    document.body.appendChild(indicatorEl);
    renderIndicator();
  }

  function unmountIndicator() {
    if (indicatorEl && indicatorEl.parentNode) indicatorEl.parentNode.removeChild(indicatorEl);
    indicatorEl = null;
  }

  function chapterTitle(chapterId) {
    var list = (data().chapters) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === chapterId) return list[i].title;
    }
    return "";
  }

  function renderIndicator() {
    if (!indicatorEl) return;
    var paused = !!(clock && clock.isPaused());
    var textEl = indicatorEl.querySelector(".autoplay-indicator-text");
    var pauseBtn = indicatorEl.querySelector(".autoplay-indicator-pause");
    var total = ((data().events) || []).length;

    if (paused) {
      textEl.textContent = "已暂停 · 空格继续";
    } else if (progress.phase === "intro") {
      textEl.textContent = chapterTitle(progress.chapterId) + " · 引言";
    } else if (progress.phase === "ending") {
      textEl.textContent = "终章";
    } else {
      textEl.textContent =
        chapterTitle(progress.chapterId) + " · 第 " + (progress.eventIndex + 1) + "/" + total + " 幕";
    }
    pauseBtn.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    indicatorEl.classList.toggle("is-paused", paused);
  }

  function syncButton() {
    var btn = document.getElementById("btn-autoplay");
    if (!btn) return;
    btn.setAttribute("aria-pressed", running ? "true" : "false");
    var full = btn.querySelector(".btn-label-full");
    var short = btn.querySelector(".btn-label-short");
    if (full) full.textContent = running ? "停止放映" : "自动放映";
    if (short) short.textContent = running ? "停止" : "放映";
  }

  // ------------------------- 键盘接管 -------------------------

  // 必须注册在捕获阶段：choice.js 的 Escape 处理是冒泡阶段的"抉择不可跳过"拦截，
  // 若导演也用冒泡阶段，抉择进行中就再也停不下放映了。捕获阶段先于任何冒泡处理，
  // 与注册顺序无关；stopImmediatePropagation 阻断后续传播。这与 walkin.js 的
  // Esc 用的是同一个技巧。
  function onKeydownCapture(e) {
    if (!running) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      e.stopImmediatePropagation();
      stop();
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      e.stopImmediatePropagation();
      togglePause();
      return;
    }
    if (e.key === "Enter") {
      // choice.js 把 Enter 映射为"点击 actions 里的按钮"，放映期误按会打乱时间轴
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function bindKeys() {
    document.addEventListener("keydown", onKeydownCapture, true);
    document.addEventListener("shy:view-changing", onViewChanging);
  }

  function unbindKeys() {
    document.removeEventListener("keydown", onKeydownCapture, true);
    document.removeEventListener("shy:view-changing", onViewChanging);
  }

  // 视图被切到时间轴预期之外的目标（某条未被守卫覆盖的路径）：优雅退场，
  // 而不是放任时间轴在错误的视图上空转。
  function onViewChanging(e) {
    if (!running) return;
    var to = e && e.detail && e.detail.to;
    if (to === "graph" || to === "map" || to === "about") stop();
  }
```

同时在 `runTimeline` 的三处 `progress.phase = ...` 赋值之后各补一行 `renderIndicator();`，在 `togglePause()` 末尾补一行 `renderIndicator();`。

- [ ] **Step 6: 加指示条样式**

在 `css/main.css` 末尾追加：

```css
/* ---- 自动放映指示条 ---- */

.autoplay-indicator {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 900; /* 高于 .walkin-overlay，泼溅环视段仍可见、仍可点暂停 */
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(20, 14, 8, 0.78);
  border: 1px solid rgba(198, 160, 74, 0.45);
  color: #f0e6d2;
  font-size: 13px;
  letter-spacing: 0.05em;
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}

.autoplay-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-vermilion, #a33c22);
  animation: autoplayDotPulse 1.8s ease-in-out infinite;
}
.autoplay-indicator.is-paused .autoplay-indicator-dot {
  background: var(--c-gold, #c6a04a);
  animation: none;
}
@keyframes autoplayDotPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.25; }
}

.autoplay-indicator-pause {
  background: transparent;
  border: 1px solid rgba(198, 160, 74, 0.5);
  border-radius: 999px;
  color: inherit;
  font: inherit;
  padding: 3px 10px;
  cursor: pointer;
  min-height: 28px;
}
.autoplay-indicator-pause:hover { border-color: var(--c-gold, #c6a04a); }

.autoplay-indicator-esc { opacity: 0.6; font-size: 12px; }

@media (prefers-reduced-motion: reduce) {
  .autoplay-indicator-dot { animation: none; }
}

@media (max-width: 600px) {
  .autoplay-indicator { left: max(12px, env(safe-area-inset-left)); right: max(12px, env(safe-area-inset-right)); justify-content: center; font-size: 12px; }
  .autoplay-indicator-esc { display: none; }
}
```

- [ ] **Step 7: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 900
```

期望：`通过 96 项，失败 0 项`，无 `PAGEERROR:` 行。

- [ ] **Step 8: 回归既有自检**

```bash
node tools/selftest-run.mjs http://localhost:8080/walkin-selftest.html 180
node tools/responsive-check.mjs
```

期望：两者与实施前同样全绿（`responsive-check.mjs` 会因顶栏多了一颗按钮而改变布局，重点核对手机档顶栏是否仍为单行、总分是否仍可读；若断言因按钮数量变化而失败，按该脚本既有约定更新断言并在提交信息中说明）。

- [ ] **Step 9: 提交**

```bash
git add index.html js/app.js js/autoplay.js css/main.css autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 放映外壳（顶栏入口、指示条、键盘、守卫、暂停）

Esc 与空格在捕获阶段接管：choice.js 的 Escape 是冒泡阶段的「抉择不可
跳过」拦截，导演若也用冒泡阶段，抉择进行中就再也停不下放映。Enter 一并
吞掉——choice.js 把它映射为点击 actions 按钮，误按会打乱时间轴。

顶栏星图/舆图/关于/终章/站标放映期弹提示不切视图；静音不受限；重新开始
先停放映再确认，否则会拿沙盒 state 当真实存档清空。指示条 z-index 高于
walkin 覆盖层，泼溅环视段仍可见、仍可点暂停。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 契约与文档回写 + 人工验收

**Files:**
- Modify: `.superpowers/sdd/shared-interfaces.md`
- Modify: `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md`
- Modify: `index.html`（脚本序列注释）

**Interfaces:**
- Consumes: Task 1–7 的全部产出
- Produces: 无代码接口，只有文档

- [ ] **Step 1: 更新 `.superpowers/sdd/shared-interfaces.md`**

在文末追加一节：

```markdown
## 契约增补（自动放映落地后）

- 脚本加载顺序新增两项：`js/autoplay-kit.js`（在 `js/score.js` 之后、`js/narration.js` 之前，
  须早于 `js/choice.js`）、`js/autoplay.js`（在 `js/app.js` 之后）。
- `window.SHY_AUTOPLAY_KIT = { createClock(), isCancelledError(err), orbitEase(p) }`
  - clock 实例：`wait(ms)` / `waitFor(predicate, {timeoutMs,intervalMs})` / `withCap(promise, capMs)` /
    `now()` / `pause()` / `resume()` / `isPaused()` / `cancel()` / `isCancelled()`。
    暂停维持"有效时间轴"语义：剩余时长不丢，不得用 clearTimeout + 重开完整定时器实现。
  - `orbitEase(p)`：两端 12% smoothstep、中段线性，端点精确为 0 与 1（环绕必须恰好一周）。
- `window.SHY_AUTOPLAY = { start(opts), stop(), togglePause(), isRunning(), isPaused(), debugState() }`
  - `opts = { debugFast, skipOrbits, skipConfirm }`；`debugState()` 为非契约调试接口。
  - 沙盒不变量：放映期间 `localStorage.shanhe_save_v1` 必须逐字节不变；`stop()` 幂等。
- `window.SHY_CHOICE` 由"便利性暴露"提升为正式契约：
  `{ open(choiceId), setAutoplayActive(on), setViewMode(on), setOrbitPaused(on),
     orbitPanorama({durationMs}) → Promise<boolean>, debugPano() }`（`debugPano` 非契约）。
- `window.SHY_WALKIN` 增补：`orbit(choiceId, {durationMs}) → Promise<boolean>`、`setOrbitPaused(on)`；
  `open(choiceId, opts)` 新增可选第二参 `opts.orbit = { durationMs, done(ok) }`。
- `window.SHY_APP` 增补：`showToast(msg)`（原为 app.js 私有，公开供 autoplay.js 复用）。
- 放映进行中（`SHY_AUTOPLAY.isRunning()`）顶栏「人物星图/舆图/关于/终章」与站标点击被
  `guardAutoplay()` 拦截并弹提示；静音不受限；「重新开始」先 `stop()` 退出沙盒再走确认流程。
- 自检页 `autoplay-selftest.html` 配既有 `tools/selftest-run.mjs` 运行（形制同
  `walkin-selftest.html`），页内以内存 shim 顶替 `localStorage`，人工打开不污染真实存档。
```

- [ ] **Step 2: 回写设计文档为实际实现**

编辑 `docs/superpowers/specs/2026-08-02-autoplay-mode-design.md`：

1. 文件头「状态」改为 `已实现（2026-08-02）`。
2. §3.2：把 `SHY_CHOICE.setAutoplayOrbit(bool)` 一行替换为
   `SHY_CHOICE.setAutoplayActive(bool)`（说明它同时承担 `.is-autoplay` 类与拖拽禁用），
   并补 `SHY_CHOICE.setOrbitPaused(bool)`、`SHY_CHOICE.debugPano()`。
3. §7.4 上方新增一段「实现补充：公共原语」，说明时基与缓动实际落在 `js/autoplay-kit.js`，
   以及为何不放进导演（依赖倒置）。
4. §8 影响面表格：把 `tools/autoplay-smoke.mjs` 一行替换为 `autoplay-selftest.html`
   （复用既有 `tools/selftest-run.mjs`），并新增 `js/autoplay-kit.js` 一行。
5. §9.1 标题与首段改为复用 `tools/selftest-run.mjs` 的说法，命令写成
   `node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 900`。
6. §6.1 补一句：环绕途中被 `stopPano()` 打断时以 `resolve(false)` 收尾；
   §6.2 补一句：环视被提前关闭 / 加载失败 / 超时一律 `resolve(false)`。

- [ ] **Step 3: 更新 `index.html` 顶部注释**

把顶部运行说明注释补一句放映模式的存在：

```html
<!--
  运行说明：本项目需通过本地 HTTP 服务器访问，不再支持双击本文件直接以 file:// 协议打开
  （「走入历史」使用的 SparkJS 仅发布 ES module 构建，file:// 下会被浏览器 CORS 拒绝）。
  启动方式：终端内运行 `node tools/serve.mjs`，然后浏览器打开 http://localhost:8080

  顶栏「自动放映」：沙盒式从第一幕播到通关（约 2 小时 50 分），自动作答并在每个抉择场景
  环绕展示全景图与高斯泼溅场景；全程不改动存档，Esc 退出、空格暂停。见
  docs/superpowers/specs/2026-08-02-autoplay-mode-design.md
-->
```

- [ ] **Step 4: 跑完整自检套件**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 900
node tools/selftest-run.mjs http://localhost:8080/walkin-selftest.html 180
node tools/responsive-check.mjs
```

三者必须全绿且无 `PAGEERROR:` 行。把三条命令的实际输出粘进任务报告，不得只写"通过"。

- [ ] **Step 5: 人工验收**

`node tools/serve.mjs` 后浏览器打开 `http://localhost:8080`，点顶栏「自动放映」，逐项确认：

| # | 验收点 | 判据 |
|---|---|---|
| 1 | 章引言幕 | 长卷滚到引言卡、主题色随之切换、播章解说，不生硬跳变 |
| 2 | 事件幕节奏 | 卡片开→解说播完→停顿→自动继续，停顿不显得赶或拖 |
| 3 | 全景环绕 | 面板淡出后匀速转满一周回到起点，接缝处看不出跳变，起收不生硬 |
| 4 | AI 角标 | 环绕全程「AI 生成想象图」角标可见 |
| 5 | 泼溅环视 | 加载进度条→原地转一周→自动关闭，全程不露空洞/破面 |
| 6 | 无模型幕 | 播到 c10 或 c21–c26 时只做全景环绕，不出现加载失败提示 |
| 7 | 自动选中 | 正确选项的金色描边看得清，随后才跳到已作答态 |
| 8 | 阅读停留 | 历史真实走向卷轴展开后留足阅读时间再继续 |
| 9 | 暂停 | 空格暂停时画面、镜头、解说同时停住；继续后声画同步 |
| 10 | 退出还原 | Esc 退出后回到长卷，分数/进度/章节评级与放映前完全一致 |

至少完整看完前两章再判定 1–4、7–10；第 5、6 项各挑一幕验证。

- [ ] **Step 6: 提交**

```bash
git add .superpowers/sdd/shared-interfaces.md docs/superpowers/specs/2026-08-02-autoplay-mode-design.md index.html
git commit -m "$(cat <<'EOF'
docs: 回写自动放映契约与设计文档为实际实现

shared-interfaces.md 增补 SHY_AUTOPLAY_KIT / SHY_AUTOPLAY / SHY_CHOICE
提升为正式契约 / SHY_WALKIN.orbit / SHY_APP.showToast / 放映期顶栏守卫
与新的脚本加载顺序。

设计文档两处收敛照实回写：setAutoplayOrbit 并入 setAutoplayActive；
新建 tools/autoplay-smoke.mjs 改为复用既有 tools/selftest-run.mjs +
新增 autoplay-selftest.html。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage**

| Spec 章节 | 落在哪个任务 |
|---|---|
| §1.1 放映模式定位 / 跟随解说 / 原地转身 / 旁白并行 / 章引言 / 暂停 | Task 4（沙盒）、5（节奏与章引言）、3（原地转身）、6（编排）、7（暂停） |
| §1.2 非目标（不倍速/不导出/不托管/不补模型/不展开史海钩沉） | 全程未实现，Task 5 的满分断言 3290 正是"不展开史海钩沉"的钉子 |
| §3.1 `js/autoplay.js` 与调用时存在性检查 | Task 4 |
| §3.2 `SHY_CHOICE` 契约 | Task 2（含已声明的收敛） |
| §3.3 `SHY_WALKIN.orbit` | Task 3 |
| §3.4 自动作答点真实 DOM | Task 5 `pickCorrectOption` / `confirmAndContinue` |
| §4.1–4.2 沙盒进出与唯一出口 | Task 4 |
| §4.3 通关与终章、`finished` 对顶栏按钮的影响 | Task 5（`lastRun.view === "ending"`）、Task 4（`stop()` 里的 `refreshHud`） |
| §5.1 顶层结构与"滚动不需新契约" | Task 5 `runTimeline` / `scrollToChapterIntro` |
| §5.2 抉择幕十步 | Task 5（1、6–10）+ Task 6（2–5） |
| §5.3 等待原语三语义 | Task 1（含明确禁止 clearTimeout 重开的断言） |
| §5.4 等解说四条 | Task 5 `waitNarration` / `makeAudioEndWaiter` |
| §6.1 全景环绕含转屏重投影 | Task 2 |
| §6.2 泼溅环视含暂停 | Task 3 + Task 4 `setOrbitsPaused` |
| §6.3 素材覆盖与 WebGL2 降级 | Task 3（`probeAvailable` 前置）+ Task 6（`resolve(false)` 即跳过） |
| §7.1 入口与确认框 | Task 4（`CONFIRM_TEXT`）+ Task 7（按钮） |
| §7.2 指示条 + 计数只统计事件幕 | Task 7 `renderIndicator` |
| §7.3 键盘与守卫全表 | Task 7 |
| §7.4 `prefers-reduced-motion` | Task 6 `runOrbits` |
| §7.5 `shy:view-changing` 兜底 | Task 7 `onViewChanging` |
| §9.1 四条断言 | Task 5（1、2）、Task 8 Step 4（3：无 PAGEERROR）、Task 1（4：暂停语义） |
| §9.2 三条镜头断言 | Task 2（全景位移）、Task 3（isOpen/yaw/无模型不建覆盖层） |
| §9.3 人工验收 | Task 8 Step 5 |

无遗漏。

**2. 已修正的问题**

- 最初把 `dwell()` 一并套在 `waitFor` 的超时上限上，会让 debugFast 下的选项等待在 20ms 就超时（choice.js 的旁白淡入约 1.95s 是真实挂钟）。已拆成 `dwell()` 只压主动停顿、`WAIT_OPTIONS_MS` / `WAIT_ACTION_MS` 保持真实值，并在 Task 5 Step 3 的注释里写明原因。
- `walkin.js` 环视被提前关闭时 promise 永不 settle。已加 `current.orbitDone` 字段与 `disposeCurrent()` 里的收尾（Task 3 Step 4）。同理 `choice.js` 的 `stopPano()` 收尾（Task 2 Step 6）。
- 环视模式下 `exitBtn.hidden = true` 会让既有的 `exitBtn.focus()` 焦点圈禁失效。已改为按模式选 `focusTarget`，环视时以 `overlay`（`tabindex="-1"`）为落点（Task 3 Step 3）。
- `stop()` 重复调用会把已是 no-op 的 `saveState` 当作原函数存下来，永久损坏存档。已在 `stop()` 首行加 `if (!running) return;` 并用专门断言钉住（Task 4）。

**3. Type consistency**

跨任务引用的名字已逐一核对一致：`SHY_AUTOPLAY_KIT.orbitEase`（Task 1 定义，Task 2/3 消费）、`clock.withCap`（Task 1 定义，Task 5/6 消费）、`SHY_CHOICE.setViewMode` / `setOrbitPaused` / `setAutoplayActive` / `orbitPanorama` / `debugPano`（Task 2 定义，Task 4/6 与自检消费）、`SHY_WALKIN.orbit` / `setOrbitPaused`（Task 3 定义，Task 4/6 消费）、`SHY_APP.showToast`（Task 4 定义，Task 7 的 `guardAutoplay` 消费）、`debugState().lastRun`（Task 4 定义结构，Task 5/6 断言消费）、`progress.phase` 取值 `idle|starting|intro|event|choice|ending`（Task 4/5 写，Task 7 `renderIndicator` 读）。DOM 选择器 `.btn-continue` / `.choice-option[data-orig-index]` / `.choice-btn-learn` / `.choice-btn-continue` / `.chapter-intro-card` / `.walkin-exit` / `.walkin-hint` 均已对照现有源码核实。
