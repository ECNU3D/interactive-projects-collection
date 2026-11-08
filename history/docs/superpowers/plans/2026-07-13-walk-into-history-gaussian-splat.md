# 「走入历史」高斯泼溅漫游 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在《山河岁月》现有沉浸抉择界面（`js/choice.js`）新增第四层沉浸——基于 SparkJS 加载高斯泼溅（Gaussian Splatting）`.spz` 模型，玩家可用 WASD + 鼠标/触屏自由走入历史场景，而不只是环视。

**Architecture:** 全项目新增唯一一个 ES module 文件 `js/walkin.js`（挂载 `window.SHY_WALKIN` 桥接普通脚本世界），本地 vendor 化 SparkJS + three.js（浏览器原生 import map，无需打包器），资产按 `assets/world/<choiceId>.spz` 命名约定 + 运行时 `fetch HEAD` 探测存在性（零数据文件维护）。项目运行方式从"双击 file:// 即玩"改为"需本地服务器"（新增零依赖 `tools/serve.mjs`）。

**Tech Stack:** SparkJS 2.1.0（`@sparkjsdev/spark`）、three.js 0.180.0（peer dependency），均本地 vendor 化；浏览器原生 ES module + import map；Node 内置 `http`/`fs` 模块（本地服务器，无第三方包）。

## Global Constraints

- **不再支持/测试 file://**：项目从本功能起需通过本地 http(s) 服务器运行（`node tools/serve.mjs`），不维护双击兼容性。
- **依赖必须本地 vendor 化，禁止 CDN 引用**：延续项目"无外部网络依赖"原则（`vendor/d3.v7.min.js` 先例）。
- **`js/walkin.js` 是全项目唯一允许 ES module 的文件**；其余 `data/*.js`/`js/*.js` 保持现状（普通 `<script>` 全局变量），不重写。
- **资产命名约定**：`assets/world/<choiceId>.spz`；零数据文件维护，运行时 `fetch(url, {method:"HEAD"})` 探测存在性，无文件时功能入口完全不出现（不占位、不置灰）。
- **纯视觉层**："走入历史"不得读写 `state`/计分/`answered`，不得触碰 `SHY_AUDIO`/`SHY_VOICE`/`SHY_BGM`。
- **资源释放**：每次关闭 3D 漫游必须完整 `dispose()` renderer / `SparkRenderer` / `SplatMesh`，反复进出不得导致显存持续增长。
- **静默降级**：WebGL2 不支持 / 文件不存在 / 加载失败，均不得抛出未捕获异常。
- 提交信息用中文，遵循 `feat:/fix:/docs:/data:` 前缀（沿用项目既有约定），每个 Task 结束单独提交。

---

### Task 1: 本地静态文件服务器 + 运行说明

**Files:**
- Create: `tools/serve.mjs`
- Modify: `index.html:1`（顶部新增运行说明注释）

**Interfaces:**
- Produces: `node tools/serve.mjs [port]` 启动一个零依赖静态文件服务器，默认监听 `http://localhost:8080`，以仓库根目录为文档根。后续所有 Task 的验证步骤都依赖它。

- [ ] **Step 1: 写 `tools/serve.mjs`**

```js
#!/usr/bin/env node
// tools/serve.mjs
// 零依赖本地静态文件服务器：项目自「走入历史」功能起需通过 http(s) 运行
// （SparkJS 仅发布 ES module 构建，file:// 协议下 ES module 会被浏览器 CORS 拒绝，
// 见 docs/superpowers/specs/2026-07-13-walk-into-history-gaussian-splat-design.md）。
// 用法：node tools/serve.mjs [port]（默认 8080）

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.argv[2], 10) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".spz": "application/octet-stream",
  ".ply": "application/octet-stream",
  ".splat": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);

  // 防御式路径穿越检查：解析后的绝对路径必须仍在项目根目录之内
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log("《山河岁月》本地服务器已启动：http://localhost:" + PORT);
  console.log("按 Ctrl+C 停止");
});
```

- [ ] **Step 2: 手动验证服务器行为**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
curl -s -o /dev/null -w "index.html: %{http_code}\n" http://localhost:8080/
curl -s -o /dev/null -w "validate.html: %{http_code}\n" http://localhost:8080/validate.html
curl -s -o /dev/null -w "不存在的文件: %{http_code}\n" http://localhost:8080/nope.txt
curl -s -o /dev/null -w "路径穿越: %{http_code}\n" "http://localhost:8080/../../etc/passwd"
kill $SERVER_PID
```

Expected:
```
index.html: 200
validate.html: 200
不存在的文件: 404
路径穿越: 403
```

- [ ] **Step 3: `index.html` 顶部新增运行说明**

Modify `index.html`，在 `<!doctype html>` 之后、`<html lang="zh-CN">` 之前插入：

```html
<!--
  运行说明：本项目需通过本地 HTTP 服务器访问，不再支持双击本文件直接以 file:// 协议打开
  （「走入历史」使用的 SparkJS 仅发布 ES module 构建，file:// 下会被浏览器 CORS 拒绝）。
  启动方式：终端内运行 `node tools/serve.mjs`，然后浏览器打开 http://localhost:8080
-->
```

- [ ] **Step 4: Commit**

```bash
git add tools/serve.mjs index.html
git commit -m "feat: 新增零依赖本地静态服务器，更新运行说明（走入历史功能需本地服务器）"
```

---

### Task 2: 本地 vendor 化 SparkJS + three.js

**Files:**
- Create: `vendor/spark.module.min.js`、`vendor/three.module.min.js`、`vendor/three.core.min.js`、`vendor/Pass.js`
- Modify: `index.html`（`<head>` 内新增 import map）

**Interfaces:**
- Produces: 浏览器可通过裸模块名 `"three"` / `"@sparkjsdev/spark"` / `"three/addons/postprocessing/Pass.js"` 解析到本地 vendor 文件，供 Task 3/4 的 `js/walkin.js` 使用。

- [ ] **Step 1: 下载 4 个官方发布文件到 `vendor/`**

```bash
mkdir -p vendor
curl -sL -o vendor/spark.module.min.js "https://sparkjs.dev/releases/spark/2.1.0/spark.module.min.js"
curl -sL -o vendor/three.module.min.js "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js"
curl -sL -o vendor/three.core.min.js "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.min.js"
curl -sL -o vendor/Pass.js "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/postprocessing/Pass.js"
ls -la vendor/spark.module.min.js vendor/three.module.min.js vendor/three.core.min.js vendor/Pass.js
```

Expected sizes（允许 ±5% 浮动，版本发布可能有细微修订）：
```
vendor/spark.module.min.js    ≈ 5,018,702 bytes
vendor/three.module.min.js    ≈   338,908 bytes
vendor/three.core.min.js      ≈   381,124 bytes
vendor/Pass.js                ≈     4,218 bytes
```

若任何文件大小为 0 或下载失败（curl 静默写出空文件），说明 URL 已失效——需要去 https://sparkjs.dev/docs/ 与 https://www.jsdelivr.com/package/npm/three 确认最新版本号后重试，不得跳过校验硬着头皮继续。

- [ ] **Step 2: `index.html` 的 `<head>` 内新增 import map**

在 `<link rel="stylesheet" href="css/main.css">` 之后新增：

```html
<script type="importmap">
{
  "imports": {
    "three": "./vendor/three.module.min.js",
    "three/addons/postprocessing/Pass.js": "./vendor/Pass.js",
    "@sparkjsdev/spark": "./vendor/spark.module.min.js"
  }
}
</script>
```

- [ ] **Step 3: 临时创建 smoke test 页面并验证 import map 生效**

```bash
cat > vendor-smoke-test.html <<'EOF'
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>vendor 依赖自检</title>
<script type="importmap">
{
  "imports": {
    "three": "./vendor/three.module.min.js",
    "three/addons/postprocessing/Pass.js": "./vendor/Pass.js",
    "@sparkjsdev/spark": "./vendor/spark.module.min.js"
  }
}
</script>
</head>
<body><pre id="out">运行中……</pre>
<script type="module">
import * as THREE from "three";
import { SparkRenderer, SplatMesh, SparkControls } from "@sparkjsdev/spark";

var R = { pass: 0, fail: 0, messages: [] };
function ok(cond, msg) { if (cond) R.pass++; else { R.fail++; R.messages.push("✘ " + msg); } }

ok(typeof THREE.Scene === "function", "THREE.Scene 可用");
ok(typeof THREE.PerspectiveCamera === "function", "THREE.PerspectiveCamera 可用");
ok(typeof THREE.WebGLRenderer === "function", "THREE.WebGLRenderer 可用");
ok(typeof SparkRenderer === "function", "SparkRenderer 可用");
ok(typeof SplatMesh === "function", "SplatMesh 可用");
ok(typeof SparkControls === "function", "SparkControls 可用");

document.getElementById("out").textContent =
  "通过 " + R.pass + " 项，失败 " + R.fail + " 项\n" + R.messages.join("\n");
</script>
</body></html>
EOF

node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=8000 --dump-dom "http://localhost:8080/vendor-smoke-test.html" 2>/dev/null \
  | grep -o '通过 [0-9]* 项，失败 [0-9]* 项'
kill $SERVER_PID
```

Expected: `通过 6 项，失败 0 项`

- [ ] **Step 4: 删除临时 smoke test 文件（不提交，功能已由 Task 3/4 的 `walkin-selftest.html` 长期覆盖）**

```bash
rm vendor-smoke-test.html
```

- [ ] **Step 5: Commit**

```bash
git add vendor/spark.module.min.js vendor/three.module.min.js vendor/three.core.min.js vendor/Pass.js index.html
git commit -m "feat: 本地vendor化SparkJS 2.1.0与three.js 0.180.0，新增import map"
```

---

### Task 3: `js/walkin.js` —— WebGL2 能力检测 + 存在性探测

**Files:**
- Create: `js/walkin.js`
- Create: `walkin-selftest.html`
- Modify: `index.html`（body 末尾新增 `<script type="module" src="js/walkin.js">`）
- Rename: `assets/world/Imperial Court in Winter.spz` → `assets/world/c01.spz`

**Interfaces:**
- Produces: `window.SHY_WALKIN = { probeAvailable(choiceId) }`，`probeAvailable` 返回 `Promise<boolean>`（WebGL2 不支持则恒 resolve `false`；否则按内存缓存 / `fetch HEAD` 探测 `assets/world/<choiceId>.spz` 是否存在）。Task 4 会在同一 `window.SHY_WALKIN` 对象上追加 `open`/`close`。

- [ ] **Step 1: 重命名现有模型文件为约定命名**

```bash
git mv "assets/world/Imperial Court in Winter.spz" assets/world/c01.spz
```

- [ ] **Step 2: 写 `js/walkin.js`（本步骤只含探测层，open/close 由 Task 4 补上）**

```js
// js/walkin.js
// 「走入历史」高斯泼溅漫游：全项目唯一一处 ES module（其余 js/*.js 均为普通 <script>），
// 因 SparkJS 仅发布 ES module 构建、file:// 协议下会被浏览器 CORS 拒绝加载 —— 见
// docs/superpowers/specs/2026-07-13-walk-into-history-gaussian-splat-design.md。
// 挂载 window.SHY_WALKIN 作为与 js/choice.js（普通脚本）之间唯一的桥接点。

var webgl2Supported = (function () {
  try {
    var canvas = document.createElement("canvas");
    return !!(canvas.getContext && canvas.getContext("webgl2"));
  } catch (e) {
    return false;
  }
})();

var probeCache = new Map(); // choiceId -> boolean，本次会话内探测结果缓存，避免重复 HEAD 请求

function probeAvailable(choiceId) {
  if (!webgl2Supported) return Promise.resolve(false);
  if (probeCache.has(choiceId)) return Promise.resolve(probeCache.get(choiceId));
  return fetch("assets/world/" + choiceId + ".spz", { method: "HEAD" })
    .then(function (res) {
      var available = !!(res && res.ok);
      probeCache.set(choiceId, available);
      return available;
    })
    .catch(function () {
      probeCache.set(choiceId, false);
      return false;
    });
}

window.SHY_WALKIN = { probeAvailable: probeAvailable };
```

- [ ] **Step 3: 写 `walkin-selftest.html`**

```html
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>走入历史 自检</title></head>
<body><pre id="out">运行中……</pre>
<div id="choice-view"></div>
<script type="module">
import "./js/walkin.js";

var R = { pass: 0, fail: 0, messages: [] };
function ok(cond, msg) { if (cond) R.pass++; else { R.fail++; R.messages.push("✘ " + msg); } }

// —— 探测层（Task 3） ——
ok(!!window.SHY_WALKIN, "window.SHY_WALKIN 已挂载");
ok(typeof window.SHY_WALKIN.probeAvailable === "function", "probeAvailable 是函数");

var c01 = await window.SHY_WALKIN.probeAvailable("c01");
ok(c01 === true, "c01（已放置模型）探测应为 true，实际 " + c01);

var c02 = await window.SHY_WALKIN.probeAvailable("c02");
ok(c02 === false, "c02（未放置模型）探测应为 false，实际 " + c02);

var c01Again = await window.SHY_WALKIN.probeAvailable("c01");
ok(c01Again === true, "c01 重复探测（走缓存）应仍为 true");

document.getElementById("out").textContent =
  "通过 " + R.pass + " 项，失败 " + R.fail + " 项\n" + R.messages.join("\n");
</script>
</body></html>
```

`<div id="choice-view"></div>` 本 Task 尚用不到，是为 Task 4 的 `open()`/`close()` 测试预先准备的容器（`walkin.js` 的 `buildOverlayDom()` 通过 `document.getElementById("choice-view")` 查找挂载点，找不到会直接返回 `null` 且不创建任何 DOM——若这里不预先放好这个 div，Task 4 的渲染生命周期断言会静默失效而非报错）。

- [ ] **Step 4: `index.html` body 末尾新增模块脚本引用**

在现有 `<script src="js/app.js"></script>` 之后（`</body>` 之前）新增：

```html
<script type="module" src="js/walkin.js"></script>
```

- [ ] **Step 5: 运行自检，验证探测层通过**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=8000 --dump-dom "http://localhost:8080/walkin-selftest.html" 2>/dev/null \
  | grep -o '通过 [0-9]* 项，失败 [0-9]* 项'
kill $SERVER_PID
```

Expected: `通过 5 项，失败 0 项`

> 注（执行中实测修订）：walkin-selftest 的各次 headless 运行**不得带 `--disable-gpu`**——本机（macOS + Chrome headless=new）实测该开关会连带禁用 WebGL2，使 `webgl2Supported` 恒为 false、探测断言必败。仅 validate.html / vendor 冒烟这类不依赖 WebGL 的页面可带可不带。Step 6 的门禁检查特意用 `--disable-webgl2` 模拟不支持场景，属预期失败。

- [ ] **Step 6: 手动验证 WebGL2 能力门禁（Chrome 命令行开关，非自动化断言）**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --disable-webgl2 \
  --virtual-time-budget=8000 --dump-dom "http://localhost:8080/walkin-selftest.html" 2>/dev/null \
  | grep -o '通过 [0-9]* 项，失败 [0-9]* 项'
kill $SERVER_PID
```

Expected: 由于 `--disable-webgl2` 强制 `webgl2Supported` 为 `false`，`c01`/`c01Again` 两项断言应变为失败（`probeAvailable` 恒返回 `false`），预期输出类似 `通过 3 项，失败 2 项`——这只是确认"禁用 WebGL2 后探测确实门禁生效"的手工检查，失败数不为 0 属预期，不代表回归，无需修复。

- [ ] **Step 7: Commit**

```bash
git add js/walkin.js walkin-selftest.html index.html assets/world/c01.spz
git status  # 确认 "Imperial Court in Winter.spz" 已被识别为 rename 而非 delete+add
git commit -m "feat: 走入历史——WebGL2能力检测与.spz存在性探测（js/walkin.js探测层）"
```

---

### Task 4: `js/walkin.js` —— 3D 渲染生命周期（open/close）

**Files:**
- Modify: `js/walkin.js`（追加 open/close，依赖 Task 2 的本地 vendor 库）
- Modify: `walkin-selftest.html`（追加渲染生命周期断言）
- Create: `assets/world/broken-test.spz`（200 字节垃圾数据，加载失败路径的测试夹具）

**Interfaces:**
- Consumes: Task 2 的 `three`/`@sparkjsdev/spark` import map，Task 3 的 `probeAvailable`/`webgl2Supported`。
- Produces: `window.SHY_WALKIN` 追加 `open(choiceId)`、`close()`（均为同步接口，内部异步加载/清理自行处理）；非契约性调试接口 `window.SHY_WALKIN.debugState()`（供本文件自身与 selftest 观测当前场景状态，命名/暴露方式与 `js/bgm.js`/`js/narration.js` 既有的非契约调试 getter 先例一致，`choice.js` 不得依赖它）。

- [ ] **Step 1: 创建加载失败测试夹具**

```bash
head -c 200 /dev/urandom > assets/world/broken-test.spz
ls -la assets/world/broken-test.spz
```

- [ ] **Step 2: 在 `js/walkin.js` 顶部追加 import，并在 `window.SHY_WALKIN = ...` 一行之前插入 open/close 实现**

在文件最顶部（`var webgl2Supported = ...` 之前）新增两行：

```js
import * as THREE from "three";
import { SparkRenderer, SplatMesh, SparkControls } from "@sparkjsdev/spark";
```

将文件末尾的：
```js
window.SHY_WALKIN = { probeAvailable: probeAvailable };
```
替换为：

```js
var current = null; // { overlay, renderer, scene, camera, spark, mesh, onResize, onKeydown } | null

function buildOverlayDom() {
  var container = document.getElementById("choice-view");
  if (!container) return null;
  var overlay = document.createElement("div");
  overlay.className = "walkin-overlay";
  overlay.innerHTML =
    '<div class="walkin-canvas-wrap"></div>' +
    '<div class="walkin-progress"><span class="walkin-progress-text">正在加载历史场景…</span></div>' +
    '<div class="walkin-error" hidden><p>该幕漫游素材加载失败，可返回抉择继续游戏。</p>' +
    '<button type="button" class="walkin-error-close">回到抉择</button></div>' +
    '<div class="walkin-hint">WASD 移动 · 鼠标环视 · Esc 返回抉择</div>' +
    '<button type="button" class="walkin-exit">回到抉择</button>';
  container.appendChild(overlay);
  return overlay;
}

function disposeCurrent() {
  if (!current) return;
  if (current.renderer) {
    current.renderer.setAnimationLoop(null);
    current.renderer.dispose();
  }
  if (current.mesh && typeof current.mesh.dispose === "function") current.mesh.dispose();
  if (current.spark && typeof current.spark.dispose === "function") current.spark.dispose();
  if (current.onResize) window.removeEventListener("resize", current.onResize);
  if (current.onKeydown) document.removeEventListener("keydown", current.onKeydown);
  if (current.overlay && current.overlay.parentNode) current.overlay.parentNode.removeChild(current.overlay);
  current = null;
}

function close() {
  disposeCurrent();
}

function open(choiceId) {
  disposeCurrent(); // 防御式：若上一场景未正确关闭，先清理，避免显存泄漏累积

  var overlay = buildOverlayDom();
  if (!overlay) return;

  var canvasWrap = overlay.querySelector(".walkin-canvas-wrap");
  var progressEl = overlay.querySelector(".walkin-progress");
  var progressText = overlay.querySelector(".walkin-progress-text");
  var errorEl = overlay.querySelector(".walkin-error");
  var exitBtn = overlay.querySelector(".walkin-exit");
  var errorCloseBtn = overlay.querySelector(".walkin-error-close");

  var renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  canvasWrap.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
  var spark = new SparkRenderer({ renderer: renderer });
  scene.add(spark);

  var controls = new SparkControls({ canvas: renderer.domElement });

  current = {
    overlay: overlay, renderer: renderer, scene: scene, camera: camera,
    spark: spark, mesh: null, onResize: null, onKeydown: null
  };

  current.onResize = function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", current.onResize);

  current.onKeydown = function (e) {
    if (!current) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      e.stopImmediatePropagation(); // 先于 choice.js 的全局 Escape 处理拦截，见设计文档§5
      close();
    }
  };
  document.addEventListener("keydown", current.onKeydown);

  exitBtn.addEventListener("click", close);
  errorCloseBtn.addEventListener("click", close);

  function showError() {
    if (progressEl) progressEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
  }

  var mesh = new SplatMesh({
    url: "assets/world/" + choiceId + ".spz",
    onProgress: function (event) {
      if (!progressText || !event || !event.lengthComputable) return;
      progressText.textContent = "正在加载历史场景…" + Math.round((event.loaded / event.total) * 100) + "%";
    }
  });
  scene.add(mesh);
  current.mesh = mesh;

  var timedOut = false;
  var timeoutHandle = setTimeout(function () {
    timedOut = true;
    showError();
  }, 30000);

  mesh.initialized
    .then(function () {
      if (timedOut || current === null) return; // 已超时展示错误，或用户已在加载期间关闭
      clearTimeout(timeoutHandle);
      progressEl.hidden = true;
      renderer.setAnimationLoop(function () {
        renderer.render(scene, camera);
        controls.update(camera);
      });
    })
    .catch(function () {
      clearTimeout(timeoutHandle);
      showError();
    });
}

// 非契约性调试接口：仅供 walkin-selftest.html 观测当前场景状态，choice.js 不得依赖它
// （命名/暴露方式沿用 js/bgm.js、js/narration.js 既有的非契约调试 getter 先例）。
function debugState() {
  return current;
}

window.SHY_WALKIN = { probeAvailable: probeAvailable, open: open, close: close, debugState: debugState };
```

- [ ] **Step 3: 在 `walkin-selftest.html` 中，将末尾的输出块替换为渲染生命周期断言 + 输出块**

将文件末尾的：
```html
document.getElementById("out").textContent =
  "通过 " + R.pass + " 项，失败 " + R.fail + " 项\n" + R.messages.join("\n");
</script>
```
替换为：

```html
// —— 渲染生命周期（Task 4） ——
async function waitInitialized(timeoutMs) {
  var start = performance.now();
  while (performance.now() - start < timeoutMs) {
    var st = window.SHY_WALKIN.debugState();
    if (st && st.mesh && st.mesh.isInitialized) return true;
    await new Promise(function (r) { setTimeout(r, 200); });
  }
  return false;
}
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

window.SHY_WALKIN.open("c01");
ok(window.SHY_WALKIN.debugState() !== null, "open后debugState非空");
ok(document.querySelector(".walkin-overlay canvas") !== null, "canvas已插入DOM");

var loaded = await waitInitialized(30000);
ok(loaded === true, "c01.spz 在30秒内完成加载(isInitialized)");

window.SHY_WALKIN.close();
ok(window.SHY_WALKIN.debugState() === null, "close后debugState为null");
ok(document.querySelector(".walkin-overlay") === null, "close后overlay已从DOM移除");

// 反复开关不留残留canvas/overlay（显存释放的行为侧证据，真实显存占用需人工用浏览器任务管理器复核）
window.SHY_WALKIN.open("c01");
await waitInitialized(30000);
window.SHY_WALKIN.close();
window.SHY_WALKIN.open("c01");
await waitInitialized(30000);
window.SHY_WALKIN.close();
ok(document.querySelectorAll(".walkin-overlay").length === 0, "多次开关后无残留overlay");

// 加载失败路径（损坏文件，直接调用open绕过probe，验证错误提示而非崩溃）
window.SHY_WALKIN.open("broken-test");
await sleep(3000);
var errVisible = document.querySelector(".walkin-error") && !document.querySelector(".walkin-error").hidden;
ok(errVisible === true, "损坏文件应展示错误提示而非崩溃");
window.SHY_WALKIN.close();

document.getElementById("out").textContent =
  "通过 " + R.pass + " 项，失败 " + R.fail + " 项\n" + R.messages.join("\n");
</script>
```

- [ ] **Step 4: 运行自检**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=60000 --dump-dom "http://localhost:8080/walkin-selftest.html" 2>/dev/null \
  | grep -o '通过 [0-9]* 项，失败 [0-9]* 项'
kill $SERVER_PID
```

Expected: `通过 12 项，失败 0 项`（5项来自Task3探测层 + 7项本Task新增；若因本机 GPU/驱动限制 headless Chrome 无法完成真实渲染，至少 probe 相关5项与"加载失败"路径相关断言应通过；若 `isInitialized` 相关断言超时失败，改用非 headless 的真实 Chrome 窗口重跑本步骤确认）。

- [ ] **Step 5: Commit**

```bash
git add js/walkin.js walkin-selftest.html assets/world/broken-test.spz
git commit -m "feat: 走入历史——3D渲染生命周期(open/close)，含加载失败与显存释放校验"
```

---

### Task 5: 接入 `js/choice.js` + `css/main.css`

**Files:**
- Modify: `js/choice.js`
- Modify: `css/main.css`
- Modify: `walkin-selftest.html`（追加集成断言）

**Interfaces:**
- Consumes: `window.SHY_WALKIN.probeAvailable`/`open`（Task 3/4）。
- Produces: 抉择界面右上角新增「走入历史」按钮，探测通过才显示；点击调用 `SHY_WALKIN.open(currentChoice.id)`。

- [ ] **Step 1: `js/choice.js` —— `ensureOverlay()` 的 innerHTML 新增按钮**

找到：
```js
      '<div class="choice-ai-badge">AI 生成想象图</div>' +
      '<div class="choice-pano-hint" hidden><span class="choice-pano-hint-arrow">‹</span>拖动环视<span class="choice-pano-hint-arrow">›</span></div>' +
      '<div class="choice-inkblot" hidden></div>' +
      '<div class="choice-seal" hidden><span>史</span><span>笔</span><span>如</span><span>铁</span></div>' +
      '<button type="button" class="choice-viewmode-toggle">凭栏远眺</button>' +
      '<button type="button" class="choice-viewmode-exit">回到抉择</button>' +
```
替换为：
```js
      '<div class="choice-ai-badge">AI 生成想象图</div>' +
      '<div class="choice-pano-hint" hidden><span class="choice-pano-hint-arrow">‹</span>拖动环视<span class="choice-pano-hint-arrow">›</span></div>' +
      '<div class="choice-inkblot" hidden></div>' +
      '<div class="choice-seal" hidden><span>史</span><span>笔</span><span>如</span><span>铁</span></div>' +
      '<button type="button" class="choice-walkin-toggle" hidden>走入历史</button>' +
      '<button type="button" class="choice-viewmode-toggle">凭栏远眺</button>' +
      '<button type="button" class="choice-viewmode-exit">回到抉择</button>' +
```

- [ ] **Step 2: `refs` 对象新增引用**

找到：
```js
      viewModeToggle: overlayEl.querySelector(".choice-viewmode-toggle"),
      viewModeExit: overlayEl.querySelector(".choice-viewmode-exit")
    };
```
替换为：
```js
      viewModeToggle: overlayEl.querySelector(".choice-viewmode-toggle"),
      viewModeExit: overlayEl.querySelector(".choice-viewmode-exit"),
      walkinToggle: overlayEl.querySelector(".choice-walkin-toggle")
    };
```

- [ ] **Step 3: 事件绑定新增一行**

找到：
```js
    refs.viewModeToggle.addEventListener("click", enterViewMode);
    refs.viewModeExit.addEventListener("click", exitViewMode);
    refs.voiceReplay.addEventListener("click", replayVoiceSafe);
  }
```
替换为：
```js
    refs.viewModeToggle.addEventListener("click", enterViewMode);
    refs.viewModeExit.addEventListener("click", exitViewMode);
    refs.voiceReplay.addEventListener("click", replayVoiceSafe);
    refs.walkinToggle.addEventListener("click", onWalkinToggleClick);
  }
```

- [ ] **Step 4: 新增 `setupWalkin`/`onWalkinToggleClick` 函数**

找到（`setupKindTag` 函数定义）：
```js
  function setupKindTag(choice) {
    refs.kindTag.textContent = KIND_LABEL[choice.kind] || "";
  }
```
替换为：
```js
  function setupKindTag(choice) {
    refs.kindTag.textContent = KIND_LABEL[choice.kind] || "";
  }

  // ------------------------- 走入历史：高斯泼溅3D漫游入口（js/walkin.js 桥接，可选依赖） -------------------------

  function setupWalkin(choice) {
    refs.walkinToggle.hidden = true; // 默认隐藏，异步探测通过才显示
    if (!window.SHY_WALKIN || typeof window.SHY_WALKIN.probeAvailable !== "function") return;
    window.SHY_WALKIN.probeAvailable(choice.id).then(function (available) {
      if (currentChoice !== choice) return; // 探测返回前已切换/关闭抉择，防御式丢弃过期结果
      refs.walkinToggle.hidden = !available;
    });
  }

  function onWalkinToggleClick() {
    if (window.SHY_WALKIN && typeof window.SHY_WALKIN.open === "function" && currentChoice) {
      window.SHY_WALKIN.open(currentChoice.id);
    }
  }
```

- [ ] **Step 5: `openChoice()` 内调用 `setupWalkin`**

找到：
```js
    resetDynamicContent();
    setupBackground(choice);
    setupKindTag(choice);
    showView("choice");
```
替换为：
```js
    resetDynamicContent();
    setupBackground(choice);
    setupWalkin(choice);
    setupKindTag(choice);
    showView("choice");
```

- [ ] **Step 6: `css/main.css` 新增样式**

在 `.choice-viewmode-toggle,` / `.choice-viewmode-exit {` 规则块（约第1235行）之前插入：

```css
/* ---- 9.1c 走入历史：高斯泼溅3D漫游（js/walkin.js 独立创建/销毁的DOM，与choice.js overlay分离） ---- */

.choice-walkin-toggle {
  position: absolute;
  top: 18px;
  right: 150px;
  z-index: 8;
  padding: 8px 18px;
  font-size: 12.5px;
  letter-spacing: 0.25em;
  color: rgba(253, 246, 232, 0.92);
  background: rgba(20, 14, 8, 0.4);
  border: 1px solid rgba(227, 192, 122, 0.5);
  border-radius: 999px;
  backdrop-filter: blur(3px);
  transition: opacity 320ms var(--ease-standard), background 220ms ease;
}
.choice-walkin-toggle:hover { background: rgba(20, 14, 8, 0.6); border-color: var(--c-gold); }
.choice-overlay.is-viewing .choice-walkin-toggle {
  opacity: 0;
  pointer-events: none;
}

.walkin-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #000;
}
.walkin-canvas-wrap { position: absolute; inset: 0; }
.walkin-canvas-wrap canvas { display: block; width: 100%; height: 100%; }

.walkin-progress {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: rgba(253, 246, 232, 0.92);
  font-size: 14px;
  letter-spacing: 0.15em;
  text-align: center;
}

.walkin-error {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-width: 320px;
  text-align: center;
  color: rgba(253, 246, 232, 0.92);
  font-size: 14px;
  line-height: 1.6;
}
.walkin-error button {
  margin-top: 14px;
  padding: 8px 20px;
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: rgba(253, 246, 232, 0.92);
  background: rgba(20, 14, 8, 0.5);
  border: 1px solid rgba(227, 192, 122, 0.5);
  border-radius: 999px;
}

.walkin-hint {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  color: rgba(253, 246, 232, 0.75);
  font-size: 12px;
  letter-spacing: 0.15em;
}

.walkin-exit {
  position: absolute;
  top: 18px;
  right: 18px;
  padding: 8px 18px;
  font-size: 12.5px;
  letter-spacing: 0.25em;
  color: rgba(253, 246, 232, 0.92);
  background: rgba(20, 14, 8, 0.4);
  border: 1px solid rgba(227, 192, 122, 0.5);
  border-radius: 999px;
  backdrop-filter: blur(3px);
}
.walkin-exit:hover { background: rgba(20, 14, 8, 0.6); border-color: var(--c-gold); }
```

在 375px 响应式媒体查询块（`@media (max-width: 600px) { ... .choice-viewmode-exit { ... } }`，约第1634-1645行）内、`}` 收尾之前新增：

```css
  .choice-walkin-toggle { top: 46px; right: 10px; padding: 6px 12px; font-size: 11px; letter-spacing: 0.15em; }
  .walkin-exit { top: 10px; right: 10px; padding: 6px 12px; font-size: 11px; letter-spacing: 0.15em; }
  .walkin-hint { bottom: 14px; font-size: 10.5px; }
```

在 `@media (prefers-reduced-motion: reduce) { ... }` 块（约第1647-1653行）内新增一行：

```css
  .choice-walkin-toggle { transition: opacity 1ms linear; }
```

- [ ] **Step 7: `walkin-selftest.html` 追加集成断言**

先在 `<div id="choice-view"></div>` 之后、现有 `<script type="module">` 标签之前插入 6 行普通 `<script src>`（`choice.js` 依赖 `SHY_DATA.choices`/`SHY_SCORE` 才能正常工作，`#choice-view` 容器已在 Task 3 建好）：

```html
<script src="data/chapters.js"></script>
<script src="data/events.js"></script>
<script src="data/choices.js"></script>
<script src="data/persons.js"></script>
<script src="js/score.js"></script>
<script src="js/choice.js"></script>
```

分类脚本（classic `<script src>`）在文档解析期间会立即同步执行；而已存在的 `<script type="module">` 无论出现在文档中的什么位置，其执行都会推迟到整个文档解析完毕之后——因此不需要开第二个 `<script type="module">`，也不需要重新声明 `sleep`/`waitInitialized`/`ok`/`R`，直接在同一个既有的模块脚本里继续往下写就行，它执行时上面这 6 个 classic script 早已跑完。

将现有 `<script type="module">` 内末尾的：
```js
document.getElementById("out").textContent =
  "通过 " + R.pass + " 项，失败 " + R.fail + " 项\n" + R.messages.join("\n");
```
替换为：

```js
// —— choice.js 集成（Task 5） ——
document.dispatchEvent(new CustomEvent("shy:enter-choice", { detail: { choiceId: "c01" } }));
await sleep(500); // 等待 setupWalkin 的异步 probeAvailable().then() 完成
var walkinBtn = document.querySelector(".choice-walkin-toggle");
ok(walkinBtn !== null, ".choice-walkin-toggle 按钮已渲染");
ok(walkinBtn.hidden === false, "c01有模型，按钮应可见");

document.dispatchEvent(new CustomEvent("shy:enter-choice", { detail: { choiceId: "c02" } }));
await sleep(500);
ok(walkinBtn.hidden === true, "c02无模型，按钮应隐藏");

document.dispatchEvent(new CustomEvent("shy:enter-choice", { detail: { choiceId: "c01" } }));
await sleep(500);
walkinBtn.click();
var opened = await waitInitialized(30000);
ok(opened === true, "点击按钮后调用SHY_WALKIN.open并完成加载");
ok(document.querySelector(".walkin-overlay canvas") !== null, "点击按钮后3D漫游canvas已插入DOM");
window.SHY_WALKIN.close();

document.getElementById("out").textContent =
  "通过 " + R.pass + " 项，失败 " + R.fail + " 项\n" + R.messages.join("\n");
```

（`sleep`/`waitInitialized`/`ok`/`R` 均复用 Task 3/4 已在同一模块脚本顶层声明的定义，无需重复。）

- [ ] **Step 8: 运行完整自检**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
node tools/selftest-run.mjs "http://localhost:8080/walkin-selftest.html" 180
kill $SERVER_PID
```

Expected: `通过 17 项，失败 0 项`（5项探测层 + 7项渲染生命周期 + 5项choice.js集成），且无 `PAGEERROR:` 行。

> 注（Task 4 实测修订）：SparkJS 的 .spz 解码走真实 Web Worker，Chrome 虚拟时钟不等 Worker，`--virtual-time-budget --dump-dom` 无法跑完本自检；改用 `tools/selftest-run.mjs`（真实挂钟 CDP 轮询，同时把页面未捕获异常/未处理 rejection 转发为 `PAGEERROR:` 行）。另：walkin-selftest.html 自带与 index.html 相同的 import map（walkin.js 有裸模块 import，缺 map 则整页断言归零）。

- [ ] **Step 9: 手动视觉验收**

```bash
node tools/serve.mjs 8080
```
浏览器打开 `http://localhost:8080`，正常玩到第1章第2个节点（e0102，触发 c01），确认：
- 抉择面板右上角出现「走入历史」按钮（与「凭栏远眺」并排，不重叠）；
- 点击后全屏进入冬日养心殿场景，WASD 可移动，鼠标可环视；
- 「回到抉择」按钮与 Esc 键均可退出，返回后抉择面板状态未受影响（未作答的仍可作答）；
- 用浏览器任务管理器（`chrome://system` 或系统活动监视器）反复进出 5 次，内存无持续攀升。

- [ ] **Step 10: Commit**

```bash
git add js/choice.js css/main.css walkin-selftest.html
git commit -m "feat: 走入历史接入沉浸抉择界面（choice.js按钮+样式）"
```

---

### Task 6: 端到端回归验收

**Files:** 无新增/修改文件（除非验收发现问题需要修复）

- [ ] **Step 1: 数据自检不受影响**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=8000 --dump-dom "http://localhost:8080/validate.html" 2>/dev/null \
  | grep -o '通过 [0-9]* 项，失败 [0-9]* 项'
kill $SERVER_PID
```

Expected: `通过 1156 项，失败 0 项`（与本功能实现前完全一致，因为本功能未修改任何 `data/*.js`）。

- [ ] **Step 2: `walkin-selftest.html` 全绿**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
node tools/selftest-run.mjs "http://localhost:8080/walkin-selftest.html" 180
kill $SERVER_PID
```

Expected: `通过 17 项，失败 0 项`（5项探测层 + 7项渲染生命周期 + 5项choice.js集成），退出码 0，无 `PAGEERROR:` 行

- [ ] **Step 3: 资产命名核查——除 c01 外其余 25 幕均无模型（占位状态符合预期）**

```bash
ls assets/world/*.spz
```

Expected: 仅 `assets/world/c01.spz` 与测试夹具 `assets/world/broken-test.spz` 两个文件；c02–c26（`data/choices.js` 实际共26个choiceId，命名为c01–c26）均不存在，对应按钮在游戏中应保持不可见——用户后续放入 `c02.spz`、`c03.spz` 等文件即可逐幕解锁，无需改动任何代码。

- [ ] **Step 4: console 无未捕获异常复核**

```bash
node tools/serve.mjs 8080 &
SERVER_PID=$!
sleep 1
node tools/selftest-run.mjs "http://localhost:8080/walkin-selftest.html" 180 | grep "PAGEERROR"
kill $SERVER_PID
```

Expected: 无输出（`selftest-run.mjs` 会把页面每一个未捕获异常/未处理 rejection 打成 `PAGEERROR:` 行；grep 应一无所获）。

- [ ] **Step 5: 若以上任一步骤失败，修复后重新执行本 Task 全部步骤，再提交**

```bash
git add -A
git commit -m "fix: 走入历史功能集成验收修复"
```

若全部步骤一次通过，无需本次提交（Task 1-5 的提交已覆盖全部改动）。

---

## Self-Review 记录

1. **Spec 覆盖**：运行方式变更+本地服务器（Task 1）✓；本地vendor化+import map（Task 2）✓；资产命名约定+存在性探测（Task 3）✓；能力检测WebGL2（Task 3 Step 6手工验证）✓；渲染生命周期+加载失败处理+资源释放（Task 4）✓；choice.js集成+按钮显隐+样式（Task 5）✓；不触碰音频/计分状态（Task 5的setupWalkin/onWalkinToggleClick均未涉及state/SHY_AUDIO/SHY_VOICE/SHY_BGM）✓；Esc键优先级与choice.js既有Escape处理的交互说明（Task 4 Step 2代码注释+设计文档§5）✓；测试与验收（Task 3/4/5的walkin-selftest.html递增 + Task 6端到端回归）✓；YAGNI清单（不做碰撞检测、不做多幕预加载、不做file://降级提示）未引入✓。
2. **占位符扫描**：全部步骤含完整代码，无TBD/待补/"类似Task N"引用。
3. **类型一致性**：`window.SHY_WALKIN`的方法签名`probeAvailable(choiceId): Promise<boolean>`、`open(choiceId): void`、`close(): void`、`debugState(): object|null`在Task 3/4/5三处出现均一致；`.choice-walkin-toggle`/`.walkin-overlay`等CSS类名在Task 4(walkin.js生成的DOM)与Task 5(main.css样式规则)之间完全对应；`walkin-selftest.html`中`sleep`/`waitInitialized`/`ok`/`R`在Task 5因多个`<script type="module">`模块作用域隔离需要重新声明的问题已在Step 7显式说明，避免执行者踩坑。
