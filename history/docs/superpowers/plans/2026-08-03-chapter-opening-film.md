# 章引言开篇视频 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 15 段章开篇视频接进《山河岁月》：手动点引言卡按钮全屏播放，自动放映的章引言幕改为视频优先、不可用时原样退回现有的「文字 + `chNN.mp3`」。

**Architecture:** 新增 `js/chapterfilm.js` 作为自持的全屏播放模块，契约形制照搬项目已有的 `SHY_WALKIN`（存在性探测 + `open`/`close`/`isOpen` + 返回 Promise 的 `play()`）。`js/scroll.js` 的引言卡与 `js/autoplay.js` 的导演都只经契约调用，不碰播放器内部状态。

**Tech Stack:** 原生 ES5 风格普通 `<script>`、原生 `<video>`、无构建无依赖；测试沿用项目既有的「页内自检页 + `tools/selftest-run.mjs`」。

**设计文档：** `docs/superpowers/specs/2026-08-03-chapter-opening-film-design.md`

## Global Constraints

以下约束来自设计文档与 `.superpowers/sdd/shared-interfaces.md`，**每个任务的要求都隐含包含本节**：

- **禁止 ES module / CDN / 构建步骤**。新 JS 必须是普通 `<script>` + 全局变量的 IIFE，ES5 风格（`var`、`function`）。本项目唯一的 ES module 是既有的 `js/walkin.js`，本次不新增。
- **必须通过本地 HTTP 服务器运行**：`node tools/serve.mjs` → `http://localhost:8080`。
- **部署约束**：EdgeOne Pages 单文件上限 25 MB。本次 15 段视频单文件 11.6–15.8 MB，全部合规，入库并部署。
- **视频音轨即该章解说**（时长与 `chNN.mp3` 逐章吻合，误差 ≤0.1 s）：视频路径成立时**不得**再播 `chNN.mp3`，否则音轨重叠。
- **回退不可删**：现有「文字 + `chNN.mp3`」路径必须完整保留，作为探测失败 / 加载失败 / 超时 / 浏览器不支持时的降级。
- **`play()` 的 Promise 必须恰好 settle 一次**：正常播完 resolve(true)；素材不可用 / 加载失败 / 超时 / 中途被关闭 resolve(false)。少一次会让导演空等到封顶；多一次说明状态机错了。
- **Esc 归属**：手动模式的覆盖层注册 Esc 关闭；**放映模式一律不注册**——放映的 Esc 由 `js/autoplay.js` 的捕获阶段处理器接管（停止整场放映）。两者若都注册捕获阶段 Esc，会重演既有教训：观众第一次按 Esc 关掉的是覆盖层而非停止放映。
- **注释用中文**，解释"为什么"而非"是什么"。
- **提交信息用中文**，前缀 `feat:` / `fix:` / `docs:` / `chore:`，结尾必须是：
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- **提交纪律**：只 `git add <本任务明确创建/修改的文件>`，禁止 `git add -A` / `git add .`（工作区有 1.4 GB 未跟踪的 `.spz` 素材与 `productions/` 制作目录）。

### 全局验证命令

```bash
# 终端 A：起服务器（整个实施过程保持运行）
node tools/serve.mjs

# 终端 B：跑自检
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望 `通过 N 项，失败 0 项`，且输出中**不得出现 `PAGEERROR:` 行**。

**关于断言计数**：本计划各任务只写"当前总数 + 本任务新增条数"，不写硬性目标数字。实施时报**实际观测值**。**绝不允许为凑数增删或削弱断言。**（当前基线：117 条。）

**已知的既有噪音**：泼溅场景销毁时 `vendor/spark.module.min.js` 偶发一条 `PAGEERROR: Error: No target`（栈全在 vendor 内，`readbackDepth` ← `driveSort`），是第三方清理噪音、间歇出现、不影响任何断言。若遇到，记录但不视为本次回归；不要为它改动代码。

---

## File Structure

| 文件 | 责任 | 状态 |
|---|---|---|
| `assets/video/chapters/chNN.mp4` ×15 | 开篇影片本体，按 id 命名 | 新增（Task 1） |
| `assets/video/chapters/chNN.jpg` ×15 | 封面图，用于引言卡缩略图与 `<video poster>` | 新增（Task 1） |
| `js/chapterfilm.js` | 全屏播放器：探测、覆盖层、播放生命周期。不渲染游戏内容 | 新建（Task 2–3） |
| `js/scroll.js` | 引言卡：按钮改行为、加封面缩略图、加降级探测 | 修改（Task 4） |
| `js/autoplay.js` | 章引言幕改视频优先；暂停与收尾各加一处分发 | 修改（Task 5） |
| `index.html` | 新增一个 `<script>` | 修改（Task 3） |
| `css/main.css` | 覆盖层、跳过按钮、引言卡缩略图 | 修改（Task 3、4） |
| `autoplay-selftest.html` | 逐任务追加断言 | 修改（Task 2–5） |
| `.superpowers/sdd/shared-interfaces.md` | 契约增补（该文件被 gitignore，只写盘不提交） | 修改（Task 6） |
| `docs/superpowers/specs/2026-08-03-chapter-opening-film-design.md` | 回写为实际实现 | 修改（Task 6） |

**为什么探测层与播放器分成两个任务**：探测层有独立的正确性要求（缓存必须真的拦截重复请求、不支持 mp4 时不得发请求），可以脱离播放器单独立测；播放器则是覆盖层 + 五个方法 + Promise 生命周期 + CSS 的一大块。一个审查者完全可能认可正确的探测而否决有泄漏的播放器，反之亦然——这正是应当切开的地方。

---

## Task 1: 素材落位（拷贝、重命名、抽封面图）

**Files:**
- Create: `assets/video/chapters/ch01.mp4` … `ch15.mp4`
- Create: `assets/video/chapters/ch01.jpg` … `ch15.jpg`

**Interfaces:**
- Consumes: 无
- Produces: 后续所有任务依赖的文件名约定 `assets/video/chapters/<chapterId>.mp4` 与 `<chapterId>.jpg`（`chapterId` ∈ `ch01`…`ch15`）

- [ ] **Step 1: 确认源素材齐备且规格符合预期**

```bash
ls productions/finals-reference/*.mp4 | wc -l          # 期望 15
find productions/finals-reference -name '*.mp4' -size +25M | wc -l   # 期望 0（EdgeOne 单文件上限）
```

期望：`15` 与 `0`。若 `-size +25M` 有输出，停下来报告——超限文件不能入库部署。

- [ ] **Step 2: 拷贝并按 id 重命名，同时抽封面图**

源文件名不统一（`ch01-opening-layered-final.mp4`，其余为 `chNN-paper-collage-final.mp4`），`ch$i-*.mp4` 通配可同时匹配两种。**拷贝而非移动**——`productions/` 是制作产物目录，保持原样。

```bash
mkdir -p assets/video/chapters
for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do
  src=$(ls productions/finals-reference/ch$i-*.mp4 | head -1)
  cp "$src" "assets/video/chapters/ch$i.mp4"
  # 封面取片长 40% 处而非首帧：实测 ch01 开头约 3 秒是空白纸面淡入，首帧没有内容。
  # 缩到 1280 宽以控制体积（既当引言卡缩略图，也当 <video poster>）。
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
  t=$(echo "$d * 0.4" | bc)
  ffmpeg -v error -ss "$t" -i "$src" -frames:v 1 -vf scale=1280:-1 -q:v 4 \
    "assets/video/chapters/ch$i.jpg" -y
done
```

- [ ] **Step 3: 校验落位结果**

```bash
echo "mp4: $(ls assets/video/chapters/*.mp4 | wc -l | tr -d ' ')  jpg: $(ls assets/video/chapters/*.jpg | wc -l | tr -d ' ')"
find assets/video/chapters -name '*.mp4' -size +25M | wc -l
# 逐章核对视频时长与既有解说 mp3 吻合（确认没有拷错章）
for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do
  v=$(ffprobe -v error -show_entries format=duration -of csv=p=0 assets/video/chapters/ch$i.mp4)
  a=$(ffprobe -v error -show_entries format=duration -of csv=p=0 assets/audio/narration/ch$i.mp3)
  awk -v v="$v" -v a="$a" -v c="ch$i" 'BEGIN{d=v-a; if(d<0)d=-d; printf "%s 视频%.1fs 解说%.1fs 差%.2fs %s\n", c, v, a, d, (d<=0.2?"OK":"*** 不吻合")}'
done
# 封面图不能是全空白（ch01 首帧是空白纸，抽错会导致这一张接近纯色）
for i in 01 08 15; do
  echo "ch$i 封面 $(stat -f%z assets/video/chapters/ch$i.jpg) bytes"
done
```

期望：`mp4: 15  jpg: 15`、超限计数 `0`、15 行全部 `OK`、三张抽样封面均 > 40000 bytes（纯色 JPEG 会明显更小）。任何一项不符就停下来报告，不要继续。

- [ ] **Step 4: 提交**

```bash
git add assets/video/chapters
git commit -m "$(cat <<'EOF'
chore: 章开篇影片素材落位（15 段 mp4 + 15 张封面图）

从 productions/finals-reference 拷贝并按 id 重命名为 assets/video/chapters/chNN.mp4，
抹平源文件名的不一致（ch01 是 -opening-layered-，其余是 -paper-collage-）。
封面图取片长 40% 处抽帧——ch01 开头约 3 秒是空白纸面淡入，首帧取不到内容。

单文件 11.6–15.8MB 均低于 EdgeOne Pages 的 25MB 上限，可部署（不同于因超限
而被 .gitignore 排除的 assets/world/c*.spz）。已逐章核对视频时长与 chNN.mp3
吻合，确认音轨即该章解说。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 探测层（`js/chapterfilm.js`）

**Files:**
- Create: `js/chapterfilm.js`
- Modify: `autoplay-selftest.html`（追加 Task 2 断言段 + 引入新脚本）

**Interfaces:**
- Consumes: Task 1 的 `assets/video/chapters/<chapterId>.mp4`
- Produces:
  ```js
  window.SHY_CHAPTER_FILM = {
    probeAvailable(chapterId)   // → Promise<boolean>；不支持 mp4 时直接 false 且不发请求；
                                //   结果按 chapterId 缓存，同一会话不重复探测
  };
  ```

- [ ] **Step 1: 在自检页引入新脚本并追加断言（此时必然失败）**

先在 `autoplay-selftest.html` 的脚本序列里，`<script src="js/bgm.js"></script>` 之后、`<script src="js/scroll.js"></script>` 之前插入一行：

```html
<script src="js/chapterfilm.js"></script>
```

然后在文件末尾的 `report();` 之前追加：

```js
// ============ Task 2：开篇影片探测层 ============

var FILM = window.SHY_CHAPTER_FILM;
ok(!!FILM, "window.SHY_CHAPTER_FILM 已挂载");
ok(typeof FILM.probeAvailable === "function", "probeAvailable 是函数");

// 统计 HEAD 请求次数：证明缓存确实拦截了重复探测，而非恰好又拿到相同结果
var filmHeadCount = 0;
var realFetchFilm = window.fetch.bind(window);
window.fetch = function (url, opts) {
  if (opts && opts.method === "HEAD") filmHeadCount++;
  return realFetchFilm(url, opts);
};

var film01 = await FILM.probeAvailable("ch01");
ok(film01 === true, "ch01（已放置影片）探测应为 true，实际 " + film01);

// 用一个永远不会有素材的 id 测"不存在"路径（不硬编码某个真实章：将来 15 章都有素材）
var filmAbsent = await FILM.probeAvailable("ch99");
ok(filmAbsent === false, "ch99（永不放置）探测应为 false，实际 " + filmAbsent);

var filmCountBefore = filmHeadCount;
var film01Again = await FILM.probeAvailable("ch01");
ok(film01Again === true && filmHeadCount === filmCountBefore,
  "ch01 重复探测走缓存：返回 true 且未新发 HEAD 请求（计数 " + filmCountBefore + "→" + filmHeadCount + "）");

var filmAbsentAgain = await FILM.probeAvailable("ch99");
ok(filmAbsentAgain === false && filmHeadCount === filmCountBefore,
  "ch99 的否定结果同样入缓存，不重复探测（计数 " + filmCountBefore + "→" + filmHeadCount + "）");

window.fetch = realFetchFilm;
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：既有 117 项仍通过；Task 2 段因 `js/chapterfilm.js` 返回 404、`window.SHY_CHAPTER_FILM` 为 undefined，在 `FILM.probeAvailable` 处抛 TypeError → 出现 `PAGEERROR:` 且 `#out` 停在「运行中……」或只输出部分结果。

长测试放后台并**自己轮询输出文件直到拿到结果行**——这个 harness 不会在后台命令结束时唤醒你。

- [ ] **Step 3: 创建 `js/chapterfilm.js` 的探测层**

```js
// js/chapterfilm.js
// 《山河岁月》章开篇影片：全屏播放 assets/video/chapters/<chapterId>.mp4。
// 提供 window.SHY_CHAPTER_FILM = { probeAvailable, open, play, close, isOpen, setPaused }
//
// 影片音轨就是该章解说（时长与 assets/audio/narration/chNN.mp3 逐章吻合），因此影片
// 路径成立时不得再播那段 mp3——两者会重叠。素材缺失 / 浏览器不支持 / 加载失败时一律
// 判定不可用，由调用方（引言卡与自动放映）退回原有的「文字 + mp3」路径。
//
// 契约形制照搬 js/walkin.js：能力自持 + 存在性探测 + 返回 Promise 的"播一遍"接口，
// 调用方不碰本模块内部状态。

(function () {
  "use strict";

  var VIDEO_DIR = "assets/video/chapters/";

  // 浏览器能否播 h264/mp4。不支持时直接判定不可用、不发 HEAD 请求——与 js/walkin.js
  // 先做 WebGL2 检测再决定要不要探测 .spz 是同一手法。
  var mp4Supported = (function () {
    try {
      var probe = document.createElement("video");
      return !!(probe.canPlayType && probe.canPlayType('video/mp4; codecs="avc1.42E01E"'));
    } catch (e) {
      return false;
    }
  })();

  var probeCache = new Map(); // chapterId -> boolean，本次会话内缓存，避免重复 HEAD 请求

  function probeAvailable(chapterId) {
    if (!mp4Supported) return Promise.resolve(false);
    if (probeCache.has(chapterId)) return Promise.resolve(probeCache.get(chapterId));
    return fetch(VIDEO_DIR + chapterId + ".mp4", { method: "HEAD" })
      .then(function (res) {
        var available = !!(res && res.ok);
        probeCache.set(chapterId, available);
        return available;
      })
      .catch(function () {
        probeCache.set(chapterId, false);
        return false;
      });
  }

  window.SHY_CHAPTER_FILM = {
    probeAvailable: probeAvailable
  };
})();
```

- [ ] **Step 4: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：0 失败、无 `PAGEERROR:`。报实际总数（应为 117 + 6）。

- [ ] **Step 5: 提交**

```bash
git add js/chapterfilm.js autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 章开篇影片探测层（SHY_CHAPTER_FILM.probeAvailable）

按 assets/video/chapters/<chapterId>.mp4 的文件名约定做 HEAD 探测，结果按
chapterId 缓存，同一会话不重复请求。先做 canPlayType 前置检查——浏览器不支持
h264 时直接判定不可用、不发请求，与 walkin.js 先检测 WebGL2 是同一手法。

纯文件名约定、零清单维护：将来替换某章影片按 chNN.mp4 丢进目录即可。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 全屏播放器（`js/chapterfilm.js` 主体 + CSS）

**Files:**
- Modify: `js/chapterfilm.js`（在 Task 2 的探测层之上补全播放器）
- Modify: `css/main.css`（覆盖层与跳过按钮）
- Modify: `index.html`（新增 `<script>`）
- Modify: `autoplay-selftest.html`（追加 Task 3 断言段）

**Interfaces:**
- Consumes: Task 2 的 `probeAvailable(chapterId)`
- Produces:
  ```js
  window.SHY_CHAPTER_FILM = {
    probeAvailable(chapterId),   // 既有
    open(chapterId),             // 手动：带 controls 与「跳过」按钮，Esc 可关
    play(chapterId),             // → Promise<boolean>；导演用：无 controls，播完自动关闭
                                 //   resolve(true)=播完；false=不可用/失败/超时/中途被关闭
    close(),                     // 幂等
    isOpen(),                    // → boolean
    setPaused(on),               // 冻结/恢复播放
    debugState()                 // 非契约调试接口，仅供自检观测；调用方不得依赖
  };
  ```

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 3：开篇影片全屏播放器 ============

ok(typeof FILM.open === "function" && typeof FILM.play === "function"
   && typeof FILM.close === "function" && typeof FILM.isOpen === "function"
   && typeof FILM.setPaused === "function" && typeof FILM.debugState === "function",
   "SHY_CHAPTER_FILM 六个入口均已导出");

// 无素材：立即 resolve(false)，且不得创建覆盖层
var filmNone = await FILM.play("ch99");
ok(filmNone === false, "无素材的 ch99：play resolve(false)，实际 " + filmNone);
ok(document.querySelector(".chapter-film-overlay") === null, "无素材时不创建覆盖层");
ok(FILM.isOpen() === false, "无素材时 isOpen 为 false");

// 真实播放 ch01：覆盖层出现、<video> 存在、导演模式下无 controls 与「跳过」按钮
var filmPromise = FILM.play("ch01");
var filmOverlay = null;
for (var fi = 0; fi < 300 && !filmOverlay; fi++) {
  await sleep(50);
  filmOverlay = document.querySelector(".chapter-film-overlay");
}
ok(filmOverlay !== null, "play() 创建了全屏覆盖层");
var filmVideo = filmOverlay && filmOverlay.querySelector("video");
ok(!!filmVideo, "覆盖层内有 <video> 元素");
ok(filmVideo && filmVideo.controls === false, "导演模式不渲染原生 controls");
ok(filmOverlay && filmOverlay.querySelector(".chapter-film-skip") === null, "导演模式不渲染「跳过」按钮");

// 等到真的开始播（currentTime 前进），再验暂停冻结
var started = false;
for (var fj = 0; fj < 300 && !started; fj++) {
  await sleep(50);
  started = !!(filmVideo && filmVideo.currentTime > 0.2);
}
ok(started === true, "影片已开始播放（currentTime 前进）");

FILM.setPaused(true);
await sleep(120);
var tA = filmVideo.currentTime;
await sleep(400);
var tB = filmVideo.currentTime;
ok(Math.abs(tB - tA) < 0.05,
   "setPaused(true) 期间 currentTime 冻结（实测 " + tA.toFixed(2) + " → " + tB.toFixed(2) + "）");
FILM.setPaused(false);
await sleep(300);
ok(filmVideo.currentTime > tB, "setPaused(false) 后继续前进（" + tB.toFixed(2) + " → " + filmVideo.currentTime.toFixed(2) + "）");

// 中途 close()：play() 的 Promise 必须以 false 收尾，绝不能永不 settle
FILM.close();
var filmClosed = await filmPromise;
ok(filmClosed === false, "中途 close() 使 play() resolve(false)，实际 " + filmClosed);
ok(document.querySelector(".chapter-film-overlay") === null, "close 后覆盖层已从 DOM 移除");
ok(FILM.isOpen() === false, "close 后 isOpen 为 false");
ok(FILM.debugState() === null, "close 后内部会话已清空");

// 手动模式：渲染 controls 与「跳过」按钮，且焦点被圈在覆盖层内
FILM.open("ch01");
var manualOverlay = null;
for (var fk = 0; fk < 300 && !manualOverlay; fk++) {
  await sleep(50);
  manualOverlay = document.querySelector(".chapter-film-overlay");
}
ok(manualOverlay !== null, "open() 创建了覆盖层");
var skipBtn = manualOverlay && manualOverlay.querySelector(".chapter-film-skip");
ok(!!skipBtn, "手动模式渲染「跳过」按钮");
ok(manualOverlay.querySelector("video").controls === true, "手动模式渲染原生 controls");
ok(manualOverlay.contains(document.activeElement), "打开即把焦点圈进覆盖层");

// 手动模式的 Esc 可关闭（放映模式不注册 Esc，见 Task 5）
document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
await sleep(150);
ok(document.querySelector(".chapter-film-overlay") === null, "手动模式 Esc 关闭覆盖层");

// 反复开关不留残留，且 document 监听器净增为 0
var filmAdds = 0, filmRemoves = 0;
var realAddFilm = document.addEventListener.bind(document);
var realRemoveFilm = document.removeEventListener.bind(document);
document.addEventListener = function (t, l, o) { filmAdds++; return realAddFilm(t, l, o); };
document.removeEventListener = function (t, l, o) { filmRemoves++; return realRemoveFilm(t, l, o); };
var netBefore = filmAdds - filmRemoves;
FILM.open("ch01"); await sleep(300); FILM.close();
FILM.open("ch01"); await sleep(300); FILM.close();
var netAfter = filmAdds - filmRemoves;
document.addEventListener = realAddFilm;
document.removeEventListener = realRemoveFilm;
ok(document.querySelectorAll(".chapter-film-overlay").length === 0 && netAfter === netBefore,
   "反复开关无残留覆盖层，且 document 监听器净增为 0（" + netBefore + " → " + netAfter + "）");
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：Task 1–2 段仍通过；Task 3 段在 `FILM.open is not a function` 处失败/抛错。

- [ ] **Step 3: 在 `js/chapterfilm.js` 补全播放器**

在 `probeAvailable` 之后、`window.SHY_CHAPTER_FILM = {...}` 之前插入：

```js
  var LOAD_TIMEOUT_MS = 30000; // 30s 内没 canplay 就判定失败，与 walkin.js 的加载超时同量级

  // 当前会话；null 表示没有影片在放。异步回调一律用 current !== session 判断
  // "自己是否已被关闭或被新会话取代"（沿用 walkin.js 的会话句柄手法）。
  var current = null;

  function isMuted() {
    return !!(window.SHY_AUDIO && window.SHY_AUDIO.muted);
  }

  // 影片音轨就是解说，压低背景乐的逻辑与 js/narration.js 完全同类，复用同一个内部钩子
  function duck(on) {
    if (window.SHY_BGM && typeof window.SHY_BGM._duck === "function") {
      try {
        window.SHY_BGM._duck(on);
      } catch (e) {
        // 静默降级
      }
    }
  }

  function buildOverlay(isDirector) {
    var overlay = document.createElement("div");
    overlay.className = "chapter-film-overlay";
    overlay.tabIndex = -1; // 导演模式无按钮可聚焦，焦点圈禁以覆盖层自身为落点
    overlay.innerHTML =
      '<video class="chapter-film-video" playsinline preload="auto"></video>' +
      '<div class="chapter-film-loading">正在加载开篇影片…</div>' +
      (isDirector ? "" : '<button type="button" class="chapter-film-skip">跳过</button>');
    document.body.appendChild(overlay);
    return overlay;
  }

  // 唯一的清理路径。中途被关闭时把仍在等待的 play() promise 以 false 收尾——
  // 少这一步，导演会一直 await 到自己的封顶时限才继续，白等一大段。
  function disposeCurrent() {
    if (!current) return;
    var s = current;
    current = null; // 先置空：close() 可能从多处被调（跳过按钮 / Esc / 导演收尾），防重入

    if (s.done) {
      var aborted = s.done;
      s.done = null;
      aborted(false);
    }
    if (s.timeoutHandle) clearTimeout(s.timeoutHandle);
    if (s.onKeydown) document.removeEventListener("keydown", s.onKeydown, true); // 与注册时的捕获阶段配对
    if (s.onFocusIn) document.removeEventListener("focusin", s.onFocusIn);
    if (s.onMuted) document.removeEventListener("shy:muted-changed", s.onMuted);
    if (s.video) {
      try {
        s.video.pause();
        s.video.removeAttribute("src");
        s.video.load(); // 断开解码器与网络请求，避免关掉覆盖层后仍在后台下载
      } catch (e) {
        // 静默降级
      }
    }
    if (s.overlay && s.overlay.parentNode) s.overlay.parentNode.removeChild(s.overlay);
    duck(false);
  }

  function close() {
    disposeCurrent();
  }

  function isOpen() {
    return current !== null;
  }

  function setPaused(on) {
    if (!current || !current.video) return;
    try {
      if (on) {
        current.video.pause();
      } else {
        var p = current.video.play();
        if (p && typeof p.catch === "function") p.catch(function () { /* 静默 */ });
      }
    } catch (e) {
      // 静默降级
    }
  }

  // open() 与 play() 的公共实现。opts.director 决定是否渲染 controls/「跳过」/Esc，
  // opts.done 存在时表示有一个待 settle 的 Promise（导演模式）。
  function start(chapterId, opts) {
    opts = opts || {};
    var isDirector = !!opts.director;
    disposeCurrent(); // 防御式：上一场若因异常路径未关闭，先清理

    var overlay = buildOverlay(isDirector);
    var video = overlay.querySelector(".chapter-film-video");
    var loading = overlay.querySelector(".chapter-film-loading");
    var skipBtn = overlay.querySelector(".chapter-film-skip");

    var session = {
      overlay: overlay, video: video, done: opts.done || null,
      timeoutHandle: null, onKeydown: null, onFocusIn: null, onMuted: null
    };
    current = session;

    // 玩家可能正在听某段解说，与影片音轨会重叠——打开前先停掉
    if (window.SHY_VOICE && typeof window.SHY_VOICE.stop === "function") window.SHY_VOICE.stop();
    duck(true);

    video.poster = VIDEO_DIR + chapterId + ".jpg";
    video.controls = !isDirector;
    video.muted = isMuted();
    video.src = VIDEO_DIR + chapterId + ".mp4";

    // 播放中玩家点静音：画面照放、声音跟随（与 narration.js 收到该事件即停止解说同源）
    session.onMuted = function (e) {
      if (current !== session) return;
      video.muted = !!(e && e.detail && e.detail.muted);
    };
    document.addEventListener("shy:muted-changed", session.onMuted);

    function settle(okFlag) {
      if (current !== session) return; // 已被关闭或被新会话取代
      var cb = session.done;
      session.done = null; // 先摘掉，避免 close() → disposeCurrent 重复 settle
      close();
      if (cb) {
        cb(okFlag);
      } else if (!okFlag && window.SHY_APP && typeof window.SHY_APP.showToast === "function") {
        window.SHY_APP.showToast("开篇影片加载失败");
      }
    }

    video.addEventListener("ended", function () { settle(true); });
    video.addEventListener("error", function () { settle(false); });
    session.timeoutHandle = setTimeout(function () { settle(false); }, LOAD_TIMEOUT_MS);

    video.addEventListener("canplay", function () {
      if (current !== session) return;
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
        session.timeoutHandle = null;
      }
      loading.hidden = true;
      var p = video.play();
      if (p && typeof p.catch === "function") {
        // 自动播放被浏览器拒绝：不能干等，按失败收尾让调用方退回音频路径
        p.catch(function () { settle(false); });
      }
    });

    // 手动模式才有 Esc 与「跳过」。放映模式一律不注册 Esc——放映的 Esc 归
    // js/autoplay.js 的捕获阶段处理器（停止整场放映）；两者都注册会争抢，
    // 观众第一次按 Esc 关掉的将是覆盖层而不是停止放映。
    if (!isDirector) {
      if (skipBtn) skipBtn.addEventListener("click", close);
      session.onKeydown = function (e) {
        if (current !== session) return;
        if (e.key === "Escape" || e.key === "Esc") {
          e.preventDefault();
          e.stopImmediatePropagation();
          close();
        }
      };
      document.addEventListener("keydown", session.onKeydown, true);
    }

    // 焦点圈禁：吞按键不足以杜绝隔层操作——Enter/Space 会由浏览器原生合成 click
    // 激活背后聚焦的按钮，绕过任何冒泡阶段的守卫。因此必须圈禁焦点本身。
    var focusTarget = skipBtn || overlay;
    focusTarget.focus();
    session.onFocusIn = function (e) {
      if (current !== session) return;
      if (overlay.contains(e.target)) return;
      focusTarget.focus();
    };
    document.addEventListener("focusin", session.onFocusIn);
  }

  function open(chapterId) {
    start(chapterId, { director: false });
  }

  // 导演用：resolve(true)=完整播完；false=素材不可用 / 加载失败 / 超时 / 中途被关闭。
  // 调用方据此决定是否退回音频路径，不必自己判断素材是否齐备。
  function play(chapterId) {
    return probeAvailable(chapterId).then(function (available) {
      if (!available) return false;
      return new Promise(function (resolve) {
        start(chapterId, { director: true, done: resolve });
      });
    });
  }

  // 非契约调试接口：仅供 autoplay-selftest.html 观测当前会话（命名与暴露方式沿用
  // js/walkin.js debugState()、js/choice.js debugPano() 的既有先例），调用方不得依赖。
  function debugState() {
    return current;
  }
```

并把文件末尾的导出替换为：

```js
  window.SHY_CHAPTER_FILM = {
    probeAvailable: probeAvailable,
    open: open,
    play: play,
    close: close,
    isOpen: isOpen,
    setPaused: setPaused,
    debugState: debugState
  };
```

- [ ] **Step 4: 在 `index.html` 挂载**

在 `<script src="js/bgm.js"></script>` 之后、`<script src="js/scroll.js"></script>` 之前插入（`scroll.js` 的引言卡要调用它）：

```html
<script src="js/bgm.js"></script>
<script src="js/chapterfilm.js"></script>
<script src="js/scroll.js"></script>
```

- [ ] **Step 5: 加 CSS**

在 `css/main.css` 末尾追加：

```css
/* ---- 章开篇影片全屏覆盖层 ---- */

/* z-index 400：盖住顶栏(20)与事件卡 modal(200)，取全屏观感；低于 .shy-toast(500) 与
   .autoplay-indicator(900)，使放映提示与暂停按钮在影片之上仍可见、仍可点。 */
.chapter-film-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: #0b0806;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chapter-film-video {
  max-width: 100%;
  max-height: 100%;
  background: #000;
}

.chapter-film-loading {
  position: absolute;
  color: var(--c-gold, #c8a24a);
  font-size: 13px;
  letter-spacing: 0.25em;
}

.chapter-film-skip {
  position: absolute;
  top: max(18px, env(safe-area-inset-top));
  right: max(18px, env(safe-area-inset-right));
  min-height: 36px;
  padding: 7px 16px;
  border: 1px solid rgba(200, 162, 74, 0.5);
  border-radius: 999px;
  background: rgba(20, 14, 8, 0.6);
  color: #f0e6d2;
  font: inherit;
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
  backdrop-filter: blur(4px);
}
.chapter-film-skip:hover {
  border-color: var(--c-gold, #c8a24a);
}

@media (max-width: 600px) {
  .chapter-film-skip { font-size: 12px; padding: 6px 13px; }
  .chapter-film-loading { font-size: 12px; }
}
```

- [ ] **Step 6: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：0 失败、无 `PAGEERROR:`。报实际总数（应为上一任务总数 + 19）。

本段会真实加载 12–16 MB 的 mp4 数次，自检耗时相应增加，属正常。

- [ ] **Step 7: 提交**

```bash
git add js/chapterfilm.js css/main.css index.html autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 章开篇影片全屏播放器（open / play / close / setPaused）

open 与 play 共用同一套覆盖层构建与销毁，差异只在是否渲染 controls 与「跳过」、
是否在 ended 时自动关闭、是否有待 settle 的 Promise——与 walkin.js 用 opts.orbit
区分自由漫游与环视是同一手法。

play() 的 Promise 恰好 settle 一次：播完 true；素材不可用 / 加载失败 / 超时 /
自动播放被拒 / 中途被关闭一律 false。中途关闭时由 disposeCurrent 收尾，否则导演
会空等到自己的封顶时限。

Esc 只在手动模式注册——放映的 Esc 归 autoplay.js 的捕获阶段处理器，两者都注册
会争抢，观众第一次按 Esc 关掉的将是覆盖层而非停止放映。

覆盖层 z-index 400：盖住顶栏与事件卡，但低于 toast(500) 与放映指示条(900)。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 长卷引言卡接入（`js/scroll.js`）

**Files:**
- Modify: `js/scroll.js`（`buildIntroCard()`）
- Modify: `css/main.css`（引言卡缩略图）
- Modify: `autoplay-selftest.html`（追加 Task 4 断言段）

**Interfaces:**
- Consumes: `SHY_CHAPTER_FILM.probeAvailable(chapterId)` / `open(chapterId)`（Task 2–3）
- Produces: 引言卡上的 `.chapter-intro-play` 按钮在影片可用时打开影片、不可用时退回播 `chNN.mp3`；影片可用时卡片多一个 `.chapter-intro-thumb-wrap` 缩略图

**⚠️ 与设计文档的一处有意偏离（Task 6 需回写 spec）**：设计文档 §5 写「探测未返回前按钮先按视频路径渲染（乐观），失败再退」。本计划改为**先按音频路径、探测通过后再升级为影片路径**。理由：探测只需几毫秒，而在这个窗口里若玩家恰好点了按钮，音频是一个体面的结果；乐观渲染则会让这一点击走进"加载一个可能不存在的视频 → 报错 → 弹 toast"。降级方向应当偏向安全。

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 4：长卷引言卡接入 ============

// 引言卡由 SHY_SCROLL.render() 构建；此时长卷已渲染过，直接查 DOM。
// 探测是异步的，缩略图与按钮行为的升级要等探测回来。
var introCard = null;
for (var gi = 0; gi < 100 && !introCard; gi++) {
  await sleep(50);
  introCard = document.querySelector('.chapter-section[data-chapter-id="ch01"] .chapter-intro-card');
}
ok(introCard !== null, "ch01 引言卡存在");

var introThumb = null;
for (var gj = 0; gj < 100 && !introThumb; gj++) {
  await sleep(50);
  introThumb = introCard.querySelector(".chapter-intro-thumb");
}
ok(introThumb !== null, "影片可用时引言卡挂上了封面缩略图");
ok(introThumb && introThumb.getAttribute("src") === "assets/video/chapters/ch01.jpg",
   "缩略图指向本章封面图，实际 " + (introThumb && introThumb.getAttribute("src")));

var introBtn = introCard.querySelector(".chapter-intro-play");
ok(!!introBtn, "引言卡的播放按钮存在");
ok(introBtn.getAttribute("aria-label").indexOf("影片") >= 0,
   "影片可用时按钮 aria-label 改为影片语义，实际「" + introBtn.getAttribute("aria-label") + "」");

// 点按钮应打开影片覆盖层，而不是播 mp3
introBtn.click();
var cardOverlay = null;
for (var gk = 0; gk < 200 && !cardOverlay; gk++) {
  await sleep(50);
  cardOverlay = document.querySelector(".chapter-film-overlay");
}
ok(cardOverlay !== null, "点引言卡按钮打开了影片覆盖层");
ok(cardOverlay && cardOverlay.querySelector(".chapter-film-skip") !== null,
   "经引言卡打开的是手动模式（有「跳过」按钮）");
window.SHY_CHAPTER_FILM.close();
await sleep(100);
ok(document.querySelector(".chapter-film-overlay") === null, "关闭后覆盖层已移除");
```

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：Task 1–3 段仍通过；Task 4 段在缩略图断言处失败（当前引言卡没有缩略图，按钮仍绑的是播 mp3）。

- [ ] **Step 3: 改写 `buildIntroCard()`**

把 `js/scroll.js` 中现有的 `buildIntroCard` 整体替换为：

```js
  // 章引言卡：宣纸质感卡片，竖排章号 + 横排 subtitle + intro 全文，作为 timeline-nodes 首个
  // flex 项参与行内布局（随其内容自然居中于河流轴线，天然"跨轴"），填补章首空旷区。
  // 开篇影片可用时，按钮改为打开全屏影片、并挂一张封面缩略图作为"这里有片可看"的提示；
  // 不可用（无素材 / 浏览器不支持 mp4）时按钮退回原有的播 chNN.mp3 解说。
  function buildIntroCard(chapter) {
    var card = document.createElement("div");
    card.className = "chapter-intro-card";
    card.innerHTML =
      '<div class="chapter-intro-seal">' + escapeHtml(CN_NUM[chapter.order - 1] || String(chapter.order)) + "章</div>" +
      '<div class="chapter-intro-body">' +
      '<div class="chapter-intro-head">' +
      '<h3 class="chapter-intro-subtitle">' + escapeHtml(chapter.subtitle || chapter.title) + "</h3>" +
      '<button type="button" class="chapter-intro-play" aria-label="播放本章引言解说" title="播放引言解说">▶</button>' +
      "</div>" +
      '<p class="chapter-intro-text">' + escapeHtml(chapter.intro || "") + "</p>" +
      "</div>";

    // 先按音频路径就绪，探测通过后再升级为影片路径。方向不能反过来：探测只需几毫秒，
    // 但若在这个窗口里乐观地按影片渲染而玩家恰好点了按钮，就会走进"加载一个可能不存在
    // 的视频 → 报错 → 弹 toast"；退回音频则是个体面的结果。
    var useFilm = false;
    var playBtn = card.querySelector(".chapter-intro-play");
    if (playBtn) {
      playBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var film = window.SHY_CHAPTER_FILM;
        if (useFilm && film && typeof film.open === "function") film.open(chapter.id);
        else playVoiceForSafe(chapter.id);
      });
    }

    var film = window.SHY_CHAPTER_FILM;
    if (playBtn && film && typeof film.probeAvailable === "function") {
      film.probeAvailable(chapter.id).then(function (available) {
        if (!available) return;
        useFilm = true;
        playBtn.setAttribute("aria-label", "播放本章开篇影片");
        playBtn.setAttribute("title", "播放开篇影片");

        var thumbWrap = document.createElement("div");
        thumbWrap.className = "chapter-intro-thumb-wrap";
        var thumb = document.createElement("img");
        thumb.className = "chapter-intro-thumb";
        thumb.src = "assets/video/chapters/" + chapter.id + ".jpg";
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.addEventListener("error", function () {
          // 加载失败即整块移除不留破图（沿用 buildNode 里节点缩略图的既有写法）
          if (thumbWrap.parentNode) thumbWrap.parentNode.removeChild(thumbWrap);
        });
        thumbWrap.appendChild(thumb);
        var body = card.querySelector(".chapter-intro-body");
        if (body) card.insertBefore(thumbWrap, body);
      });
    }

    return card;
  }
```

- [ ] **Step 4: 加缩略图 CSS**

在 `css/main.css` 的章引言卡样式区之后追加：

```css
/* 引言卡的开篇影片封面缩略图：只在影片可用时由 JS 插入，作为"这里有片可看"的提示。
   宽度跟随卡片、高度按 16:9 裁切，不撑高卡片本身的既有布局节奏。 */
.chapter-intro-thumb-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin-bottom: 10px;
  overflow: hidden;
  border-radius: 3px;
  border: 1px solid rgba(42, 35, 26, 0.18);
}
.chapter-intro-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* 播放三角的呼应：缩略图右下角一个小角标，暗示可播放 */
.chapter-intro-thumb-wrap::after {
  content: "▶";
  position: absolute;
  right: 6px;
  bottom: 4px;
  font-size: 11px;
  color: rgba(240, 230, 210, 0.9);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
```

- [ ] **Step 5: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：0 失败、无 `PAGEERROR:`。报实际总数（应为上一任务总数 + 8）。

- [ ] **Step 6: 回归响应式检查**

```bash
node tools/responsive-check.mjs
```

引言卡多了一块 16:9 缩略图，会改变长卷章首的高度与布局。**若某条断言失败，先判断是不是真的布局坏了**（引言卡溢出 timeline、手机端章首撑破视口、缩略图把 intro 文字挤出卡片都属真坏，必须改 CSS 修好），而不是放宽断言。报告里写清查到什么、改了什么。

- [ ] **Step 7: 提交**

```bash
git add js/scroll.js css/main.css autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 长卷引言卡接入开篇影片

按钮在影片可用时改为打开全屏影片，并挂一张封面缩略图作为可播放的提示；
探测不通过时原样退回播 chNN.mp3，chapter.intro 文字保留不动。

先按音频路径就绪、探测通过后再升级为影片路径（与设计文档设想的方向相反）：
探测只需几毫秒，但若乐观按影片渲染而玩家恰好在这个窗口点了按钮，会走进
"加载一个可能不存在的视频 → 报错 → 弹 toast"；降级方向应偏向安全。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 自动放映接入（`js/autoplay.js`）

**Files:**
- Modify: `js/autoplay.js`（`playChapterIntro()`、`setOrbitsPaused()` → 重命名、`teardownScene()`、`start()` 的 opts）
- Modify: `autoplay-selftest.html`（追加 Task 5 断言段）

**Interfaces:**
- Consumes: `SHY_CHAPTER_FILM.play/close/setPaused/isOpen`（Task 3）
- Produces: `SHY_AUTOPLAY.start(opts)` 新增 `opts.skipFilm`（省略时随 `debugFast` 同步，与既有的 `opts.skipOrbits` 同款语义）

- [ ] **Step 1: 追加自检断言（此时必然失败）**

在 `autoplay-selftest.html` 的 `report();` 之前追加：

```js
// ============ Task 5：自动放映的章引言幕改走影片 ============

// 打桩记录导演是否为每一章都发起了影片播放。真跑 15 段 45 秒影片不适合放进自检，
// 要验的是编排：是否每章都调了 play、以及不可用时是否退回音频路径。
var filmCalls = [];
var realFilmPlay = window.SHY_CHAPTER_FILM.play;
window.SHY_CHAPTER_FILM.play = function (id) { filmCalls.push(id); return Promise.resolve(true); };

window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true, skipFilm: false });
var filmRunEnded = false;
for (var hi = 0; hi < 3000; hi++) {
  await sleep(100);
  if (!A.isRunning()) { filmRunEnded = true; break; }
}
ok(filmRunEnded === true, "带影片编排的 debugFast 全程放映在 300s 内跑完");
ok(filmCalls.length === 15, "15 章各发起一次开篇影片，实际 " + filmCalls.length + " 次");
ok(filmCalls[0] === "ch01" && filmCalls[14] === "ch15",
   "按章序发起，首末为 ch01/ch15，实际 " + filmCalls[0] + "/" + filmCalls[14]);
ok(A.debugState().lastRun.total === 3290,
   "接入影片后仍是满分 3290，实际 " + A.debugState().lastRun.total);

// 影片不可用时必须退回音频路径，且放映仍能完整走完
filmCalls.length = 0;
window.SHY_CHAPTER_FILM.play = function (id) { filmCalls.push(id); return Promise.resolve(false); };
var voiceCalls = [];
var realPlayFor = window.SHY_VOICE.playFor;
window.SHY_VOICE.playFor = function (id) { voiceCalls.push(id); return realPlayFor.call(window.SHY_VOICE, id); };

window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true, skipFilm: false });
var fbEnded = false;
for (var hj = 0; hj < 3000; hj++) {
  await sleep(100);
  if (!A.isRunning()) { fbEnded = true; break; }
}
window.SHY_VOICE.playFor = realPlayFor;
ok(fbEnded === true, "影片不可用时放映仍能跑完全程");
ok(filmCalls.length === 15, "仍为每章尝试一次影片，实际 " + filmCalls.length);
ok(voiceCalls.filter(function (id) { return /^ch\d\d$/.test(id); }).length === 15,
   "15 章全部退回播章解说 mp3，实际 " +
   voiceCalls.filter(function (id) { return /^ch\d\d$/.test(id); }).length);
ok(A.debugState().lastRun.total === 3290, "降级路径下仍是满分 3290");

// skipFilm 默认随 debugFast 打开时，一次影片都不该发起
filmCalls.length = 0;
window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true });
await sleep(3000);
A.stop();
ok(filmCalls.length === 0, "skipFilm 默认随 debugFast 打开时不发起影片，实际 " + filmCalls.length);

// 暂停要一并冻结影片；停止要关掉覆盖层
// 打桩前先各存一份真实实现，结尾按引用还原——不能靠重新取值，那时拿到的已是桩函数
var realFilmSetPaused = window.SHY_CHAPTER_FILM.setPaused;
var realFilmClose = window.SHY_CHAPTER_FILM.close;
var pausedFlags = [];
var closeCalls = 0;
window.SHY_CHAPTER_FILM.setPaused = function (on) { pausedFlags.push(on); };
window.SHY_CHAPTER_FILM.close = function () { closeCalls++; return realFilmClose.call(window.SHY_CHAPTER_FILM); };
window.SHY_APP.state = window.SHY_SCORE.newState();
A.start({ debugFast: true, skipConfirm: true });
await sleep(300);
A.togglePause();
ok(pausedFlags[pausedFlags.length - 1] === true, "空格暂停时一并冻结影片");
A.togglePause();
ok(pausedFlags[pausedFlags.length - 1] === false, "继续时一并恢复影片");
A.stop();
await sleep(150);
ok(closeCalls > 0, "停止放映时关闭影片覆盖层，实际调用 " + closeCalls + " 次");

window.SHY_CHAPTER_FILM.play = realFilmPlay;
window.SHY_CHAPTER_FILM.close = realFilmClose;
window.SHY_CHAPTER_FILM.setPaused = realFilmSetPaused;
```

**打桩还原要求**：本段替换了 `play` / `close` / `setPaused` 三个方法，结尾必须全部按开头存下的引用还原。后续段落与重跑都依赖真实实现，漏还原任何一个都会让后面的断言测在桩上。

- [ ] **Step 2: 运行自检，确认失败**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：Task 1–4 段仍通过；Task 5 段的 `filmCalls.length === 15` 等断言失败（导演还没调过 `play`）。

- [ ] **Step 3: 加 `skipFilm` 开关**

在 `js/autoplay.js` 的模块级变量区，`var skipOrbits = false;` 之后追加：

```js
  var skipFilm = false;    // 跳过章开篇影片（默认与 debugFast 同步，自检可单独打开）
```

在 `start()` 中 `skipOrbits = opts.skipOrbits == null ? fast : !!opts.skipOrbits;` 之后追加：

```js
    skipFilm = opts.skipFilm == null ? fast : !!opts.skipFilm;
```

- [ ] **Step 4: 改写 `playChapterIntro()`**

把 `js/autoplay.js` 中现有的 `playChapterIntro` 整体替换为：

```js
  // 章引言幕：滚到该章引言卡（主题色由 #scroll-view 既有的 scroll 监听自动同步），
  // 然后优先播开篇影片；影片不可用时原样退回「播 chNN.mp3 + 等解说」。
  // 影片音轨就是该章解说，两者不可同时播——所以是二选一，不是叠加。
  async function playChapterIntro(ch) {
    await scrollToChapterIntro(ch.id);

    var playedFilm = false;
    var film = window.SHY_CHAPTER_FILM;
    if (!skipFilm && film && typeof film.play === "function") {
      // 套 withCap：影片靠浏览器解码推进，标签页切到后台时 ended 事件可能长时间不来，
      // 没有封顶就等于切走标签页把放映挂死（与两段环绕同一理由）。
      playedFilm = (await clock.withCap(film.play(ch.id), HARD_CAP_MS)) === true;
      // 被封顶时 play() 那一侧还没收尾，覆盖层可能仍挂着——补一次幂等的关闭
      if (!playedFilm && typeof film.close === "function") film.close();
    }

    if (!playedFilm) {
      if (window.SHY_VOICE && typeof window.SHY_VOICE.playFor === "function") {
        window.SHY_VOICE.playFor(ch.id);
      }
      await waitNarration(ch.id, ch.intro);
    }

    await clock.wait(dwell(CHAPTER_PAUSE_MS));
  }
```

- [ ] **Step 5: 把 `setOrbitsPaused` 扩为 `setMediaPaused` 并接上影片**

该函数现在还要冻结一段视频，名字必须跟上。把 `js/autoplay.js` 中的 `setOrbitsPaused` 整体替换为：

```js
  // 暂停必须同时冻结四处：时间轴（由 clock 负责）、解说音频、两条镜头轨道、开篇影片。
  // 漏掉任何一处，恢复后画面与声音就对不上了。
  function setMediaPaused(on) {
    if (window.SHY_CHOICE && typeof window.SHY_CHOICE.setOrbitPaused === "function") {
      window.SHY_CHOICE.setOrbitPaused(on);
    }
    if (window.SHY_WALKIN && typeof window.SHY_WALKIN.setOrbitPaused === "function") {
      window.SHY_WALKIN.setOrbitPaused(on);
    }
    if (window.SHY_CHAPTER_FILM && typeof window.SHY_CHAPTER_FILM.setPaused === "function") {
      window.SHY_CHAPTER_FILM.setPaused(on);
    }
  }
```

然后把该文件内**全部**调用点由 `setOrbitsPaused(` 改为 `setMediaPaused(`（`togglePause()` 内两处、`teardownScene()` 内一处）。改完用 `grep -n "setOrbitsPaused" js/autoplay.js` 确认无残留。

- [ ] **Step 6: 在 `teardownScene()` 里关闭影片覆盖层**

在 `js/autoplay.js` 的 `teardownScene()` 中，现有的 `SHY_WALKIN.close()` 那一行之后插入：

```js
    // 放映中途停止时影片可能正在放：覆盖层连同它的焦点圈禁必须一并收掉。
    // 放在 SHY_BGM.leaveChoice() 之后——close() 内部会 _duck(false) 恢复背景乐音量，
    // 而 leaveChoice() 做的是交叉淡入切回 app.mp3，先切轨再恢复音量顺序才对。
    if (window.SHY_CHAPTER_FILM && typeof window.SHY_CHAPTER_FILM.close === "function") {
      window.SHY_CHAPTER_FILM.close();
    }
```

- [ ] **Step 7: 运行自检，确认通过**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
```

期望：0 失败、无 `PAGEERROR:`。报实际总数（应为上一任务总数 + 13）。

若 `lastRun.total` 不等于 3290，**不要改断言**——用 `A.debugState().eventIndex` 查放映停在哪一幕，看是不是影片路径吞掉了某次推进。

- [ ] **Step 8: 提交**

```bash
git add js/autoplay.js autoplay-selftest.html
git commit -m "$(cat <<'EOF'
feat: 自动放映的章引言幕改走开篇影片

滚到引言卡后优先播影片，play() 返回 false（素材不可用 / 加载失败 / 超时 /
中途被关闭）即原样退回「播 chNN.mp3 + 等解说」。影片音轨就是该章解说，二者
不可同时播，所以是二选一而非叠加。

play() 套 withCap：影片靠浏览器解码推进，标签页切到后台时 ended 可能长时间
不来，没有封顶就等于切走标签页把放映挂死。被封顶时补一次幂等 close()。

setOrbitsPaused 改名 setMediaPaused——它现在还要冻结一段视频，名字必须跟上。
新增 opts.skipFilm，省略时随 debugFast 同步（与既有 opts.skipOrbits 同款语义）。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 契约与文档回写 + 全套验证

**Files:**
- Modify: `.superpowers/sdd/shared-interfaces.md`（该目录被 `.gitignore` 排除，**只写盘不提交**）
- Modify: `docs/superpowers/specs/2026-08-03-chapter-opening-film-design.md`
- Modify: `index.html`（顶部注释）

**Interfaces:**
- Consumes: Task 1–5 的全部产出
- Produces: 无代码接口

- [ ] **Step 1: 更新 `.superpowers/sdd/shared-interfaces.md`**

在文末追加：

```markdown
## 契约增补（章开篇影片落地后）

- 脚本加载顺序新增 `js/chapterfilm.js`（在 `js/bgm.js` 之后、`js/scroll.js` 之前）。
- `window.SHY_CHAPTER_FILM = { probeAvailable(chapterId), open(chapterId),
  play(chapterId) → Promise<boolean>, close(), isOpen(), setPaused(on), debugState() }`
  - 素材约定：`assets/video/chapters/<chapterId>.mp4` 与同名 `.jpg` 封面图，纯文件名约定、零清单维护。
  - `play()` 恰好 settle 一次：播完 true；不可用 / 加载失败 / 超时 / 自动播放被拒 / 中途被关闭 false。
  - Esc 只在 `open()`（手动）注册；`play()`（放映）不注册，放映的 Esc 归 `js/autoplay.js` 的捕获阶段处理器。
  - `debugState()` 为非契约调试接口，调用方不得依赖。
- `window.SHY_AUTOPLAY.start(opts)` 增补 `opts.skipFilm`（省略时随 `debugFast` 同步）。
- `js/autoplay.js` 内部的 `setOrbitsPaused` 已改名为 `setMediaPaused`（现在还冻结开篇影片）。
- 影片音轨即该章解说：影片路径成立时不得再播 `assets/audio/narration/chNN.mp3`。
```

（注意：该文件的「提交纪律」一节写着 `Co-Authored-By: Claude Fable 5`，与本仓库全部提交实际使用的 `Claude Opus 5 (1M context)` 不符。那是陈旧文本，不在本任务范围，**保持原样、也不要沿用它**。）

- [ ] **Step 2: 回写设计文档为实际实现**

编辑 `docs/superpowers/specs/2026-08-03-chapter-opening-film-design.md`：

1. 状态字段改为：`已实现（2026-08-03）· 自动化验证通过 · 人工验收待进行`
2. **§5 的探测方向**：把「探测未返回前按钮先按视频路径渲染（乐观），失败再退」改为实际实现的「先按音频路径就绪、探测通过后再升级为影片路径」，并写明理由（探测窗口内的点击应落到体面的结果上，降级方向偏向安全）。
3. **§6 补 `skipFilm`**：说明 `start(opts)` 新增该开关、省略时随 `debugFast` 同步，以及它的存在是为了让自检能在不加载 15 段 12–16 MB 影片的前提下跑完全程编排。
4. **§6 补改名**：`setOrbitsPaused` → `setMediaPaused`。
5. **§6 的 BGM 顺序**：设计阶段写的是"实施时实测确认"。按实际落地写死：`close()` 放在 `SHY_BGM.leaveChoice()` 之后，先切轨再由 `_duck(false)` 恢复音量。若实测发现顺序需要颠倒，按实测结果回写并说明。
6. **§9 补实际断言数**：写明自检套件当前的实际总条数。

- [ ] **Step 3: 更新 `index.html` 顶部注释**

在既有的运行说明注释里补一句：

```
  章开篇影片：assets/video/chapters/chNN.mp4（音轨即该章解说）。长卷引言卡上的 ▶ 全屏播放；
  自动放映的章引言幕优先播影片，素材不可用时退回「文字 + chNN.mp3」。见
  docs/superpowers/specs/2026-08-03-chapter-opening-film-design.md
```

- [ ] **Step 4: 跑完整验证套件**

```bash
node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800
node tools/selftest-run.mjs http://localhost:8080/walkin-selftest.html 300
node tools/responsive-check.mjs
```

三者必须全绿。把三条命令的**实际输出粘进任务报告**，不得只写"通过"。

已知例外：泼溅销毁时 vendor 内部偶发的 `PAGEERROR: Error: No target`（栈全在 `vendor/spark.module.min.js`）属既有第三方噪音，不计入本次回归。

- [ ] **Step 5: 人工验收清单（交给用户，实施者不得代做、不得伪造）**

`node tools/serve.mjs` 后浏览器打开 `http://localhost:8080`：

| # | 验收点 | 判据 |
|---|---|---|
| 1 | 引言卡缩略图 | 15 章引言卡都出现封面缩略图，画面不是空白纸 |
| 2 | 手动播放 | 点 ▶ 全屏播放，画面铺满、烧录字幕清晰，「跳过」可关，Esc 可关 |
| 3 | 音轨 | 影片播放时没有第二路解说重叠 |
| 4 | 背景乐 | 影片期间 BGM 被压低，结束后恢复正常音量 |
| 5 | 静音联动 | 播放中点顶栏静音，画面继续、声音静默 |
| 6 | 放映衔接 | 自动放映中章引言幕直接全屏起片，播完自然回到长卷进入第一幕 |
| 7 | 放映暂停 | 空格暂停时影片画面与声音同时冻结，继续后声画同步 |
| 8 | 放映停止 | 影片播放中按 Esc，整场放映停止且覆盖层消失（不是只关覆盖层） |
| 9 | 手机端 | 手机全屏观感正常，「跳过」按钮不被刘海/圆角遮挡，横竖屏都可用 |
| 10 | 降级 | 临时把 `assets/video/chapters/ch01.mp4` 改名，ch01 引言卡退回播解说、放映也退回音频路径 |

第 7、8 项最可能出问题——它们跨越 `chapterfilm` 与 `autoplay` 两个模块的边界。

- [ ] **Step 6: 提交**

```bash
git add docs/superpowers/specs/2026-08-03-chapter-opening-film-design.md index.html
git commit -m "$(cat <<'EOF'
docs: 回写章开篇影片契约与设计文档为实际实现

探测方向照实回写（先音频后升级影片，而非设计阶段设想的乐观渲染）；补上
skipFilm 开关、setOrbitsPaused→setMediaPaused 改名、BGM 收尾顺序与实际
断言条数。

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
| §1 素材事实（15 段、时长吻合、烧录字幕） | Task 1 Step 3 逐章核对时长 |
| §1.1 部署约束（25 MB 上限） | Task 1 Step 1 与 Step 3 各校验一次 |
| §1.2 三条已确认取舍（全屏 / 只点击播 / 入库+回退） | Task 3（全屏）、Task 4（只点击播）、Task 1 + 全局约束（入库+回退） |
| §1.3 非目标 | 全程未实现；`productions/` 由 Task 1 明确"拷贝而非移动" |
| §2 架构选型 | Task 2–3 建 `js/chapterfilm.js` |
| §3 素材落位与命名 | Task 1 |
| §4 契约六方法 | Task 2（probe）+ Task 3（其余五个 + debugState） |
| §4.1 层级 400 | Task 3 Step 5 CSS，注释写明依据 |
| §4.2 音频（duck / 停解说 / 静音同步） | Task 3 Step 3 的 `duck()`、`SHY_VOICE.stop()`、`onMuted` |
| §4.3 键盘与焦点 | Task 3 Step 3 的 Esc 分支与焦点圈禁 |
| §5 引言卡改动 | Task 4（含一处有意偏离，已在任务内标注并由 Task 6 回写） |
| §6 自动放映改动 | Task 5 |
| §7 三层回退 | Task 2（探测/不支持）、Task 3（超时/error/自动播放被拒/中途关闭）、Task 5（导演退回音频） |
| §8 影响面 | 与 File Structure 表一致 |
| §9 验证 8 条 | Task 2（1–2 条）、Task 3（3–6 条）、Task 5（7–8 条）、Task 6（全套 + 人工验收） |

无遗漏。

**2. 已修正的问题**

- 最初把探测层与播放器合成一个任务，体量过大且两者的正确性关注点不同（缓存是否真拦截 vs. promise 是否恰好 settle 一次）。已拆为 Task 2 / Task 3。
- 最初 `playChapterIntro` 没有 `skipFilm` 开关，会导致 `debugFast` 自检真的加载 15 段 12–16 MB 影片、单次跑成十几分钟；同时也会让影片编排在全量跑里没有任何断言覆盖。已加开关，并在 Task 5 用打桩验证编排与降级两条路径——这正是上一个功能里"`debugFast` 短路掉真实音频路径导致 100% 命中的截断 bug 蒙混过关"的教训。
- 最初漏了 `setOrbitsPaused` 的改名；该函数扩到冻结视频后名字已不准确，审查会（正确地）判为命名失真。已作为 Task 5 Step 5 的显式步骤，并要求 `grep` 确认无残留调用点。
- Task 5 断言段结尾的 `setPaused` 还原写法有缺陷（占位表达式还原不出真实实现），已在该步骤下方显式标注要求实施者先存真实引用再还原，并在报告中说明。

**3. Type consistency**

跨任务引用的名字已逐一核对：`SHY_CHAPTER_FILM.probeAvailable / open / play / close / isOpen / setPaused / debugState`（Task 2–3 定义，Task 4–5 与自检消费）、`VIDEO_DIR` 常量与 `assets/video/chapters/<id>.mp4|jpg` 路径（Task 1 产出，Task 2–4 消费）、`opts.skipFilm`（Task 5 定义与消费）、`setMediaPaused`（Task 5 定义，同文件三处调用点）、`clock.withCap` / `HARD_CAP_MS` / `dwell` / `CHAPTER_PAUSE_MS` / `waitNarration`（`js/autoplay.js` 既有，Task 5 消费）。DOM 选择器 `.chapter-film-overlay` / `.chapter-film-video` / `.chapter-film-skip` / `.chapter-film-loading` / `.chapter-intro-play` / `.chapter-intro-thumb` / `.chapter-intro-thumb-wrap` / `.chapter-intro-body` 均已对照现有源码或本计划的创建处核实。
