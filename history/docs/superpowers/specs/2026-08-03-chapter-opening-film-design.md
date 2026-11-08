# 章引言开篇视频 设计文档

- 日期：2026-08-03
- 状态：已实现并合入 main（2026-08-05）· 自动化验证通过（自检 173 项 / walkin 17 项 / 响应式 115 项）
  · **人工验收未进行即合并**（用户决定）——设计阶段列出的 10 项主观判据一项未验，其中三项风险最高：
  放映中空格暂停时影片画面与声音是否同步冻结、影片播放中按 Esc 是否停止整场放映（而非只关覆盖层）、
  手机端全屏观感与「跳过」按钮是否被刘海遮挡（这一项也是 Safari/iOS 上"起播手势保留"那处修复的实际考场）
- 素材码率升级（2026-08-05，已解决）：ch02–ch15 曾于 2026-08-04 被替换为 5 Mbps 高码率版本（25.4–31.6 MB），
  其中 13 个**超过 EdgeOne Pages 的 25 MB 单文件上限**——与当初把 `.spz` 挡在生产环境外的是同一条限制。
  处置：按 CRF 22 重编码（`libx264 -preset slow -crf 22 -pix_fmt yuv420p`，音频 `aac -b:a 96k -ar 48000 -ac 1`，
  `-movflags +faststart`），15 段全部落在上限之下，余量最小的 ch12 仍剩 6.30 MB。
  校验：体积全过、时长与 `chNN.mp3` 差值 ≤0.031 s（阈值 0.2）、faststart 抽检 5 段均 `moov` 前置、
  SSIM 抽检 0.9909–0.9915。素材总体积 192 MB → 251 MB，码率 1.96 → 约 2.9 Mbps。
  5 Mbps 原件留存于未跟踪的 `productions/finals-hq/`，供将来重转。
  **ch01 未参与本次重编码**：它未被替换过，仍是最初的 1.96 Mbps 版本；对已压过的低码率文件再压一遍只会二次有损。
  代价是 ch01 与其余 14 段的画质基准不同，待其高码率源可用时再按同一参数统一。
- 需求来源：用户直接提出——现在每章开篇只是一段解说配纯文字画面；用户为 15 章各做了一段开篇视频（视频音轨已含该章解说），要求把视频接进去，并且自动放映模式也要支持。

## 1. 背景与素材事实

《山河岁月》当前的章引言是长卷上的一张纸质卡片：竖排章号印章 + 副标题 + 一个 `▶` 按钮（点击播放 `assets/audio/narration/chNN.mp3`）+ `chapter.intro` 全文。画面上没有任何影像。

用户新提供的素材位于 `productions/finals-reference/`，共 15 段：

| 项 | 实测值 |
|---|---|
| 覆盖章节 | ch01–ch15，每章一段 |
| 规格 | 1920×1080，h264 视频 + AAC 音频（96 kHz） |
| 单文件大小 | 11.3–15.8 MB |
| 合计 | 192 MB |
| 时长 | 40.3–50.3 s |
| 现有文件名 | `ch01-opening-layered-final.mp4`；`ch02`–`ch15` 为 `chNN-paper-collage-final.mp4` |

两个决定设计走向的实测结论：

1. **视频时长与现有 `chNN.mp3` 逐章精确吻合**（15 章误差全部 ≤0.1 s）。确认视频音轨就是那段解说，不是另配的音乐——因此接入视频后不应再另外播放 `chNN.mp3`，否则会与视频音轨重叠。
2. **视频自带烧录中文字幕**：标题（如「《青年杂志》创刊：德先生与赛先生」）、年份轴（「1912 · 1915年9月15日 · 1919」）、地名标签（「上海」）。画面是自足的表达，不需要外部文字同步配合。

### 1.1 部署约束（既有决定，本次沿用其判据）

`.gitignore` 中已有一条：

```
# assets/world 里 >25MB 的高斯泼溅场景文件
# 本地保留供开发预览，但不部署到 EdgeOne Pages（单文件 25MB 上限）
assets/world/c*.spz
```

即项目部署到 **EdgeOne Pages，单文件上限 25 MB**。`.spz`（27–66 MB）因此被排除，线上实际没有「走入历史」功能。

本次的 15 段视频**单文件 11.3–15.8 MB，全部低于 25 MB，可以正常部署**。代价是仓库已跟踪体积从 161 MB 增至约 353 MB。用户已确认：入库并部署。

### 1.2 已确认的取舍（用户逐条拍板）

| 决策点 | 结论 |
|---|---|
| 呈现方式 | **全屏覆盖层播放**（而非长卷卡片内嵌小窗）——1080p 画面与烧录字幕在小窗里看不清 |
| 手动模式触发 | **只在点击引言卡的按钮时播放**，不在进入新章时自动开幕，不打断玩家 |
| 素材存放 | **入库并部署**，同时**保留**现有「文字 + `chNN.mp3`」作为回退路径 |

### 1.3 非目标

- 不做字幕轨、不做多语言。
- 不做视频清晰度分档／自适应码率。
- 不改动 `chapter.intro` 文案本身。
- 不为视频新增数据文件清单——沿用项目既有的"按 id 约定文件名 + 运行时探测"做法。
- 不触碰 `productions/` 目录（制作产物，保持不入库）。

## 2. 架构选型

**A. 独立全屏播放模块（采纳）**——新增 `js/chapterfilm.js`，挂 `window.SHY_CHAPTER_FILM`，契约形制照搬项目已有的 `SHY_WALKIN`（`probeAvailable` / `open` / `close` / `isOpen`，外加给导演用的 `play()`）。`js/scroll.js` 的引言卡按钮调 `open()`，`js/autoplay.js` 的章引言幕调 `play()`。

**B. 塞进 `js/choice.js` 的现有全屏覆盖层**——可复用它的遮罩与观景模式。但该文件已约 970 行，其状态机（`currentChoice` / `answering` / `alreadyAnsweredEntry`）语义是"抉择"，章引言不是抉择；接进去要么污染这些状态，要么在同一文件里并行维护第二套互不相干的状态，两者都糟。不采纳。

**C. 原生 `<video>.requestFullscreen()`**——最省代码。但 iOS Safari 会接管为原生全屏播放器 UI，无法定制外观、无法在自动放映中响应空格暂停与 Esc 停止，也无法在播放结束时把控制权交回导演。不采纳。

采纳 **A**。理由：与 `SHY_WALKIN` 同构，是项目里已被验证、已被理解的一种模块形状（能力自持 + 存在性探测 + 返回 Promise 的"播一遍"接口）；播放器的全部状态封闭在自己的模块里，`scroll.js` 与 `autoplay.js` 都只经契约调用。

## 3. 素材落位

拷贝（非移动，`productions/` 保持原样）到：

```
assets/video/chapters/ch01.mp4 … ch15.mp4      # 统一按 id 命名，抹平现有文件名的不一致
assets/video/chapters/ch01.jpg … ch15.jpg      # 封面图，用于引言卡缩略图与 <video poster>
```

封面图从视频**片长 40% 处**抽帧，而非首帧——实测 ch01 开头约 3 秒是空白纸面淡入，首帧取不到内容。抽帧方式：

```bash
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
ffmpeg -v error -ss "$(echo "$d * 0.4" | bc)" -i "$src" -frames:v 1 -q:v 4 "assets/video/chapters/chNN.jpg" -y
```

命名沿用项目既有约定（`assets/world/<choiceId>.spz`、`assets/audio/narration/<id>.mp3`、`assets/images/panorama/<choiceId>.jpg`）：**纯文件名约定，零清单维护**。将来补拍或替换某章视频，按 `chNN.mp4` 丢进目录即可，不改任何数据文件或代码。

## 4. `js/chapterfilm.js` 契约

普通 `<script>`（非 module），在 `index.html` 中置于 `js/scroll.js` 之前（`scroll.js` 的引言卡要调用它）。

```js
window.SHY_CHAPTER_FILM = {
  probeAvailable(chapterId),          // → Promise<boolean>；HEAD 探测 assets/video/chapters/<id>.mp4，
                                      //   结果按 chapterId 缓存在模块内，同一会话不重复探测
  open(chapterId),                    // 手动模式：全屏播放，带原生 controls 与右上角「跳过」
  play(chapterId),                    // → Promise<boolean>；导演模式：无 controls，播完自动关闭并 resolve(true)；
                                      //   素材不可用 / 加载失败 / 超时 / 中途被关闭 → resolve(false)
  close(),                            // 幂等
  isOpen(),                           // → boolean
  setPaused(on)                       // 冻结/恢复播放（供放映的空格暂停）
};
```

`open()` 与 `play()` 共用同一套覆盖层构建与销毁逻辑，差异只在：是否渲染 controls 与「跳过」按钮、是否在 `ended` 时自动关闭、以及是否有一个待 settle 的 Promise。这与 `js/walkin.js` 里 `open(choiceId, opts)` 用 `opts.orbit` 区分自由漫游与环视模式是同一手法。

实际导出的对象比上面这份契约多一个键：`debugState()`，返回当前会话对象（无会话时为 `null`）。这是非契约调试接口，命名与暴露方式沿用 `js/walkin.js` 的 `debugState()`、`js/choice.js` 的 `debugPano()` 先例，仅供 `autoplay-selftest.html` 内部观测用，调用方不得依赖；因此不列入上面的契约签名，同上述两个既有先例的处理方式一致。

### 4.1 覆盖层与层级

覆盖层 `position: fixed; inset: 0; z-index: 400`，挂在 `document.body` 下。层级依据（实测当前分布）：

| 元素 | z-index | 与本覆盖层的关系 |
|---|---|---|
| `#top-bar` / `.walkin-overlay` | 20 | 被覆盖（全屏观感需要盖住顶栏） |
| `.modal-backdrop`（事件卡） | 200 | 被覆盖 |
| **`.chapter-film-overlay`** | **400** | — |
| `.shy-toast` | 500 | 在其之上（「放映中，按 Esc 退出」等提示仍可见） |
| `.autoplay-indicator` | 900 | 在其之上（放映指示条与暂停按钮仍可见可点） |

### 4.2 音频

播放期间调 `window.SHY_BGM._duck(true)` 把背景乐压到 0.08，结束/关闭时 `_duck(false)` 恢复。这是 `js/narration.js` 已在用的既有做法（`SHY_BGM._duck` 是非契约但已导出的内部钩子）——本视频的音轨就是该章解说，与解说走同一套压低逻辑是正确的类比。

同时，打开覆盖层前先 `SHY_VOICE.stop()`：玩家可能正在听某段解说，不能与视频音轨重叠。

静音状态：读 `SHY_AUDIO.muted`，为真时把 `<video>.muted = true`（画面照放，声音静默），并监听 `shy:muted-changed` 同步。

### 4.3 键盘与焦点

- `Esc` → 关闭覆盖层（手动模式）。**放映模式下不注册**——放映的 Esc 由 `js/autoplay.js` 的捕获阶段处理器接管（停止整场放映），`chapterfilm` 若也注册捕获阶段 Esc 会与之争抢，重演 Task 7 审查发现的「walkin 的 Esc 注册更早，观众第一次 Esc 关掉的是漫游而非停止放映」那个问题。
- 焦点圈禁：打开即聚焦「跳过」按钮（手动）或覆盖层自身 `tabindex="-1"`（放映，无按钮），此后落到覆盖层外的聚焦立即拉回。沿用 `js/walkin.js` 的既有做法与其理由（Enter/Space 会由浏览器原生合成 click 激活背后聚焦的按钮，绕过任何冒泡阶段的键盘守卫）。

## 5. 长卷引言卡的改动（`js/scroll.js`）

`buildIntroCard()` 的结构基本不变，三处调整：

1. `▶` 按钮的 `aria-label` / `title` 改为「播放本章开篇影片」，点击改调 `SHY_CHAPTER_FILM.open(chapter.id)`。
2. 卡片新增一张封面缩略图（`assets/video/chapters/<id>.jpg`），作为"这里有影片可看"的可见提示；加载失败即整块移除不留破图（沿用 `buildNode()` 里节点缩略图的既有写法）。
3. **降级**：`buildIntroCard` 内异步 `probeAvailable(chapter.id)`。**实际实现与设计阶段的设想方向相反**：按钮先按音频路径就绪渲染（`useFilm = false`，点击即 `playVoiceForSafe(chapter.id)`），探测通过后再升级为影片路径（`useFilm = true`，同时补上封面缩略图、`aria-label` 改「播放本章开篇影片」）；探测不通过则维持音频路径原样，不做任何视觉改动。理由：`probeAvailable` 只需几毫秒，但若按乐观方向先渲染视频路径，玩家恰好在这个窗口内点击，就会走进「加载一个可能不存在的视频 → 报错 → 弹 toast」这条体验最差的路；先就绪音频、探测通过再升级，任何时刻点击都落在一个已经可用的路径上——降级方向应偏向安全，而不是让偶发的时序窗口决定用户看到的是正常播放还是一次报错。这与 `js/choice.js` 中「走入历史」按钮默认隐藏、探测通过才显示的做法同属"先给安全默认值、探测通过再增强"的思路，只是此处按钮**总要存在**（无论播视频还是播音频），增强的是按钮的行为而非按钮的可见性。

`chapter.intro` 文字**保留不动**：视频是开篇，文字是可随时回读的底本，两者不互斥。

## 6. 自动放映的改动（`js/autoplay.js`）

`playChapterIntro()` 由：

```
滚到引言卡 → SHY_VOICE.playFor(ch.id) → 等解说播完 → 停顿 1.2s
```

改为：

```
滚到引言卡（保留——主题色靠 #scroll-view 既有的 scroll 监听自动同步）
  ↓
if (SHY_CHAPTER_FILM 可用 && await play(ch.id) === true)
    → 影片播完
else
    → 退回 SHY_VOICE.playFor(ch.id) + 等解说播完   ← 现有逻辑原样保留
  ↓
停顿 1.2s
```

要点：

- `play()` 返回 `false` 即视为"这一章没有影片"，导演立刻走回音频路径。**不重试、不额外等待**。
- `play()` 的 Promise 套 `clock.withCap(..., HARD_CAP_MS)`：视频靠浏览器解码推进，标签页切到后台时 `ended` 事件可能长时间不来；没有封顶就等于切走标签页把放映挂死。这与两段环绕的处理一致。封顶触发时 `film.play()` 那一侧还没收尾、覆盖层可能仍挂着，`playChapterIntro` 会补一次幂等的 `SHY_CHAPTER_FILM.close()`。
- **`skipFilm` 开关**：`SHY_AUTOPLAY.start(opts)` 新增 `opts.skipFilm`，省略时随 `opts.debugFast` 同步（与既有的 `opts.skipOrbits` 同款语义）。它的存在是为了让自检能在不加载 15 段 12–16 MB 影片的前提下跑完全程编排——`debugFast` 自检若不短路掉影片，单次全量跑会因真实解码 15 段视频而拖到十几分钟，且影片一旦接管播放，`waitNarration` 的真实音频分支就再也测不到（两处既有的 `debugFast:false` 回归段落因此额外加了 `skipFilm: true`，见 §9）。
- **暂停**：`togglePause()` 同时调 `SHY_CHAPTER_FILM.setPaused(on)`，与既有的 `SHY_CHOICE.setOrbitPaused` / `SHY_WALKIN.setOrbitPaused` 并列，收进原 `setOrbitsPaused()` 分发函数——该函数已连带改名为 **`setMediaPaused`**：它原本只冻结两条镜头轨道（环景/环视），现在还要冻结一段视频，`setOrbitsPaused` 这个名字已不能准确描述它做的事。
- **停止**：`teardownScene()` 调 `SHY_CHAPTER_FILM.close()`，与既有的 `SHY_WALKIN.close()` 并列。**先后顺序已按实测落地**：`SHY_CHAPTER_FILM.close()` 放在 `SHY_BGM.leaveChoice()` **之后**——`leaveChoice()` 负责把音轨交叉淡入切回 `app.mp3`，`close()` 内部随后调 `_duck(false)` 把（此时已经是 `app.mp3` 的）背景乐音量从压低状态恢复正常；顺序反过来会变成先恢复音量、再被 `leaveChoice()` 的交叉淡入盖过一次，多一次不必要的音量抖动。

**全场时长不变**：视频时长与 `chNN.mp3` 同源同长，章引言幕仍是 15 × 约 45 秒 ≈ 11 分钟，全场仍约 2 小时 50 分。

## 7. 回退与错误处理

三层降级，任何一层触发都退回「文字 + `chNN.mp3`」，导演绝不因视频停摆：

| 情形 | 行为 |
|---|---|
| `probeAvailable` 返回 false（404 / 网络错误） | 引言卡按钮退回播音频；导演走音频路径 |
| 浏览器不支持 h264 播放（`canPlayType('video/mp4; codecs="avc1"')` 为空） | 同上，探测阶段即判定不可用，不发 HEAD 请求 |
| 加载超时（30 s 内未 `canplay`） | 关闭覆盖层；手动模式弹 toast「影片加载失败」；放映模式 `resolve(false)` 走音频路径 |
| 播放中 `error` 事件 | 同上 |
| 中途被 `close()`（Esc / 跳过 / 放映停止） | `play()` 的 Promise `resolve(false)`，**必须收尾**，否则导演会一直等到封顶时限 |

最后一条是 `js/walkin.js` 在 Task 3 审查中被抓出的同一类缺陷（环视被提前关闭时 promise 永不 settle），此处从设计阶段就写死。

## 8. 影响面

| 文件 | 改动性质 |
|---|---|
| `js/chapterfilm.js` | 新建（全屏播放器） |
| `js/scroll.js` | 引言卡：按钮改行为、加封面缩略图、加降级探测 |
| `js/autoplay.js` | `playChapterIntro()` 改走视频优先；`togglePause()` / `teardownScene()` 各加一处分发 |
| `index.html` | 新增一个 `<script>` |
| `css/main.css` | 覆盖层、跳过按钮、引言卡缩略图 |
| `autoplay-selftest.html` | 追加断言段 |
| `assets/video/chapters/*` | 新增 15 段 mp4 + 15 张封面图 |
| `.superpowers/sdd/shared-interfaces.md` | 契约增补 |

## 9. 验证

沿用项目既有的「页内自检页 + `tools/selftest-run.mjs`」组合，在 `autoplay-selftest.html` 追加一段，断言：

1. `SHY_CHAPTER_FILM` 六个入口均已导出
2. `probeAvailable("ch01")` 为 true；`probeAvailable("ch99")`（约定永不存在）为 false；重复探测走缓存不再发 HEAD 请求（计数验证，手法沿用 `walkin-selftest.html`）
3. `play("ch99")` resolve(false) 且**不创建覆盖层**
4. `play("ch01")` 真实播放：覆盖层出现、`<video>` 元素存在、结束后自动关闭且 `isOpen()` 为 false
5. `setPaused(true)` 期间 `<video>.currentTime` 冻结（采样两次比对）
6. 播放中 `close()` 使 `play()` 的 Promise resolve(false) 且不挂起
7. 放映集成：`debugFast` 全程跑通后 `lastRun.total === 3290`、15 章全甲、真实存档逐字节还原（既有断言不得因本次改动失效）
8. 降级路径：**实际实现打桩的是 `SHY_CHAPTER_FILM.play` 恒 `resolve(false)`**（而非设计阶段设想的打桩 `probeAvailable`）——`play()` 恒假才是"这一章最终判定没有影片"的那个真实决策点，直接打这里比分别打桩 `probeAvailable` 更贴近 `playChapterIntro` 实际读的信号。放映仍能完整走完章引言幕、15 章全部退回播 `chNN.mp3`。

第 4 条会真实加载一段 12–16 MB 的 mp4，自检耗时相应增加；`play("ch01")` 的断言用一个短的 `HARD_CAP` 避免拖长套件。

**实施中额外确认的两个事实（设计阶段未写）**：

- `tools/selftest-run.mjs` 启动 Chrome 时新增了 `--autoplay-policy=no-user-gesture-required`。该运行器全程只用 `Page.navigate` + `Runtime.evaluate` 驱动页面，从不派发受信任的（trusted）用户手势，页面永远拿不到 sticky user activation；没有这个 flag，未静音的 `<video>.play()` 会被 Chrome 自动播放策略拒绝（`NotAllowedError`），在第 4 条断言首次真实播放时实测复现。加上这个 flag 是让测试环境贴近生产（生产里玩家点「▶」或放映走到该幕都是真实手势），不是放宽测试、偏离生产行为。
- 两处既有的 `debugFast:false` 回归段落（真实音频路径回归、旁白与环绕并行性）额外加了 `skipFilm: true`。原因：`ch01.mp4` 真实落地后，若不加这个开关，`playChapterIntro` 会让影片接管播放，这两段测的对象（`waitNarration` 的真实音频分支、旁白与环绕的并行时序）永远进不去、回归网自动失效。这两段原本要防的截断 bug，其短路点是 `waitNarration` 内部的 `if (fast)`——只认 `fast`、与 `skipFilm` 无关，所以加 `skipFilm: true` 是把回归网救回来，不是重蹈"用某个开关意外短路真实分支"的覆辙。

**`autoplay-selftest.html` 当前实际总断言数：166 条**（`node tools/selftest-run.mjs http://localhost:8080/autoplay-selftest.html 1800` 实测输出「通过 166 项，失败 0 项」；较接入影片前的 154 条净增 12 条，与本节 1–8 的断言分组吻合）。

人工验收（自动化无法判断，留给用户）：影片全屏观感、与长卷的转场是否生硬、放映中空格暂停时画面与声音是否同步冻结、手机端全屏是否正常（含安全区与横竖屏）。
