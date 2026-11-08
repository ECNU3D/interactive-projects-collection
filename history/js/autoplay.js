// js/autoplay.js
// 《山河岁月》自动放映的"导演"：按时间轴编排既有模块，自己不渲染任何游戏内容。
// 提供 window.SHY_AUTOPLAY = { start(opts), promptAndStart(), stop(), togglePause(),
// isRunning(), isPaused(), debugState() }
//
// 沙盒原则：全程不得改动玩家的真实存档——无论放映是从第一幕起完整播放，还是续播
// （start({resume:true})，从玩家当前进度的前沿那一幕起播）。做法是进场时深拷贝快照 +
// 把 SHY_SCORE.saveState 劫持为 no-op，退场时原样还原；续播的沙盒态是另一份独立深拷贝，
// 不能与用于还原的快照共享任何引用。stop() 是所有退出路径（播完 / Esc / 顶栏按钮 /
// 异常兜底）的唯一收敛点，且必须幂等——重复 stop 若把已经是 no-op 的 saveState 当成
// "原函数"再存一次，玩家存档从此永远写不进去。
//
// 消费：SHY_AUTOPLAY_KIT（时基与缓动）、SHY_APP、SHY_SCORE、SHY_SCROLL、SHY_CHOICE、
// SHY_WALKIN、SHY_VOICE、SHY_DATA。除 SHY_AUTOPLAY_KIT 外一律在调用时做存在性检查
// （SHY_WALKIN 来自 ES module，天然 defer，本文件求值时可能尚未挂载）。

(function () {
  "use strict";

  var CHAPTER_PAUSE_MS = 1200;     // 章引言播完后的停顿
  var SCROLL_SETTLE_MS = 700;      // 平滑滚动到章引言卡的落位时间
  var EVENT_PAUSE_MS = 1200;       // 事件卡解说播完后的停顿
  var AFTER_ADVANCE_MS = 900;      // 长卷滚到下一节点的落位时间
  var PICK_HIGHLIGHT_MS = 800;     // 正确选项高亮多久再点下去
  var NOTE_READ_MS = 3500;         // 作答后「历史真实走向」的停留（用户验收后定：原先按字数估时长达 17.6–29.3s，观感像卡住）
  var ENDING_HOLD_MS = 20000;      // 终章停留
  var HARD_CAP_MS = 180000;        // 任何单次等待的硬上限，绝不卡死整场
  var PANO_ORBIT_MS = 24000;   // 全景转满一周
  var SPLAT_ORBIT_MS = 24000;  // 泼溅原地转满一周
  var REDUCED_HOLD_MS = 6000;  // 命中减弱动效偏好时，改为静态展示的停留

  // waitFor 的超时上限（真实挂钟，debugFast 下也不压缩）：choice.js 自己的旁白逐句淡入
  // 约 1.95s、historyNote 展开 900ms 都是真实定时器，压掉超时会在按钮还没出现时误判。
  var WAIT_OPTIONS_MS = 20000;
  var WAIT_ACTION_MS = 20000;

  var running = false;
  var fast = false;        // debugFast：把主动停顿压到 20ms（仅供自检，不改 waitFor 的超时上限）
  var skipOrbits = false;  // 跳过两段环绕（默认与 debugFast 同步，自检可单独打开）
  var skipFilm = false;    // 跳过章开篇影片（默认与 debugFast 同步，自检可单独打开）
  var resume = false;      // 续播：沙盒态基于玩家当前存档而非全新状态，时间轴从前沿那一幕起
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

  function escapeHtmlSafe(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // 解说缺席（静音 / mp3 缺失 / 浏览器拒绝自动播放）时的兜底停留：按正文字数估时。
  // 上限须高于实测最长的一段解说（76.3s），否则元数据拿不到时这个兜底本身就是个
  // 截断器；真正的防挂死靠 HARD_CAP_MS（180s），不靠这个估值封顶。
  function estimateMs(text) {
    var n = String(text || "").length;
    return Math.max(4000, Math.min(90000, n * 220));
  }

  // ------------------------- 进场 / 退场 -------------------------

  // 把真实存档的两处劫持（saveState 函数引用、state 对象引用）原样还原。start() 的失败
  // 回滚与 stop() 的正常退场共用这一份逻辑，避免两处"半还原"实现各写一次、逐渐漂移。
  // 只做数据层面的复原，不涉及 UI/视图——调用方各自决定还原后是否要重渲染/切视图。
  function restoreRealState() {
    if (savedSaveState) {
      window.SHY_SCORE.saveState = savedSaveState;
      savedSaveState = null;
    }
    if (snapshot) {
      app().state = snapshot;
      snapshot = null;
    }
  }

  function start(opts) {
    if (running) return false;
    opts = opts || {};
    if (!window.SHY_SCORE || !window.SHY_SCROLL || !app() || !app().state) return false;

    running = true;
    fast = !!opts.debugFast;
    skipOrbits = opts.skipOrbits == null ? fast : !!opts.skipOrbits;
    skipFilm = opts.skipFilm == null ? fast : !!opts.skipFilm;
    resume = !!opts.resume;
    lastRun = null;
    progress = { phase: "starting", chapterId: null, eventIndex: -1 };
    clock = kit().createClock();

    // 快照/劫持/换态/首帧渲染是同一个原子操作：任何一步同步抛出都不能留下半开状态——
    // 否则 saveState 可能永久停在 no-op、state 可能已经是沙盒副本、且 77 行创建的 clock
    // 若不显式 cancel 就是一个永不停止的 50ms 定时器（Task 1 遗留的隐患）。失败时统一回滚。
    try {
      snapshot = JSON.parse(JSON.stringify(app().state));
      savedSaveState = window.SHY_SCORE.saveState;
      window.SHY_SCORE.saveState = function () {};

      // 续播：沙盒态基于玩家当前存档，但必须是与 snapshot 相互独立的**另一份**深拷贝。
      // 若图省事写成 app().state = snapshot，放映过程中的推进会直接改到我们打算还原
      // 回去的那个对象——退场时"还原"的将是被放映改过的状态，玩家进度被悄悄改写。
      // 这正是整个沙盒机制要防的那类事故。
      app().state = resume
        ? JSON.parse(JSON.stringify(snapshot))
        : window.SHY_SCORE.newState();
      window.SHY_SCROLL.render();
      app().refreshHud();
      app().showView("scroll");
    } catch (e) {
      if (window.console && console.error) console.error("[autoplay] 进场异常", e);
      restoreRealState();
      if (clock) clock.cancel();
      clock = null;
      running = false;
      progress = { phase: "idle", chapterId: null, eventIndex: -1 };
      return false;
    }

    runTimeline().then(finishNaturally, function (err) {
      if (kit().isCancelledError(err)) return; // stop() 主动取消，属正常路径
      // 时间轴出意外不能把玩家的存档扣在沙盒里：先记日志，再走统一退场还原
      if (window.console && console.error) console.error("[autoplay] 时间轴异常", err);
      stop();
    });

    mountIndicator();
    bindKeys();
    syncButton();
    return true;
  }

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

  async function waitNarration(id, fallbackText) {
    if (fast) return clock.wait(20);
    var got = await clock.waitFor(
      function () { return !!(window.SHY_VOICE && window.SHY_VOICE.current); },
      { timeoutMs: 600, intervalMs: 50 });
    if (!got) return clock.wait(estimateMs(fallbackText));

    var audio = window.SHY_VOICE.current;
    currentAudio = audio;
    var waiter = makeAudioEndWaiter(audio);

    // 从这里开始 waiter 已经挂上了监听，往下任何一个 await 被 stop() 取消（clock.cancel()
    // 会把 pending 的 waitFor/wait 都以 CancelledError reject 掉）都必须摘监听，否则每提前
    // 退场一次就在 document 上多漏一个 shy:muted-changed。故整段收在同一个 try/finally 里，
    // 不能只包住最后的 withCap——最初实现漏了包住下面这段元数据等待，是同一类问题。
    try {
      // audio.duration 在 new Audio() 的同一 tick 里恒为 NaN——元数据要等解码器读到文件头
      // 才有。不先等这一下，下面的 isFinite 分支就是死代码，封顶永远退化成 estimateMs 的
      // 钳位值，而实测全部解说都长于该钳位值，等于每一幕都被从中间切断。timeoutMs 是真实
      // 挂钟且不套 dwell()——这不是"刻意停顿"，是等一个必然很快到达的浏览器内部状态。
      await clock.waitFor(function () {
        return isFinite(audio.duration) && audio.duration > 0;
      }, { timeoutMs: 3000, intervalMs: 50 });

      var byDuration = isFinite(audio.duration) && audio.duration > 0
        ? audio.duration * 1000 + 2000
        : estimateMs(fallbackText) + 2000;

      await clock.withCap(waiter.promise, Math.min(HARD_CAP_MS, byDuration));
    } finally {
      waiter.cleanup();
      currentAudio = null;
    }
  }

  // ------------------------- 时间轴 -------------------------

  async function runTimeline() {
    var chapters = chaptersSorted();
    var allEvents = (data().events) || [];

    // 续播：跳到前沿那一幕。整章都在其之前的章直接跳过；所在章内跳过该幕之前的事件，
    // 并跳过该章的章引言——玩家已经历过这一章的开篇，用户明确选择"直接从第 N 幕起"。
    // 其后各章一切照常，包括章引言。
    // 依赖既有事实：events 按章分组的顺序与 chapters 按 order 排序一致（每章事件在
    // events 数组中连续），因此"整章都在起点之前"只需比较该章末事件的下标。
    // 与弹窗用的是同一个判据函数，避免"从哪开始"出现两个各自为政的定义。
    // resumeFrontier() 在已通关/还在第一幕时返回 -1，此时退回从头播。
    var frontier = resume ? resumeFrontier() : -1;
    var startIdx = frontier > 0 ? frontier : 0;

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
  //
  // 旁白与环绕并行（验收后改）：环绕一进场就起步（runOrbits 自己管 setViewMode 的开关，
  // 这里不重复调用），旁白与之同时播放；作答时机取两者中较长者——旁白短于环绕，环绕结束
  // 时（面板经 runOrbits 的 finally 淡回）旁白早已播完；旁白长于环绕，环绕先结束、面板
  // 淡回，剩余旁白接着在恢复的面板上播完。用 Promise.allSettled 而非 Promise.all：需要的
  // 语义是「两者中只要有一个是被取消的，就优先把 CancelledError 抛出去」，而 Promise.all
  // 只暴露最先 reject 的那一个原因，看不到另一个的结局，实现不了这条优先级规则。（注意不是
  // 为了避免未处理 rejection——Promise.all 在 PerformPromiseAll 里会对数组每一项都同步挂上
  // .then(resolveElement, reject)，所有输入都有处理器，不会漏。已实测确认。）优先抛取消是
  // 为了让异常沿用 start() 里既有的「isCancelledError 则静默返回」处理，不冒泡成陌生错误。
  async function playChoice(choiceId) {
    var choice = findChoice(choiceId);
    if (window.SHY_CHOICE && typeof window.SHY_CHOICE.setAutoplayActive === "function") {
      window.SHY_CHOICE.setAutoplayActive(true);
    }
    var settled = await Promise.allSettled([
      waitNarration(choiceId, choice ? choice.scene : ""),
      runOrbits(choiceId)
    ]);
    var rejected = settled.filter(function (r) { return r.status === "rejected"; });
    if (rejected.length) {
      var cancelled = rejected.filter(function (r) { return kit().isCancelledError(r.reason); });
      throw cancelled.length ? cancelled[0].reason : rejected[0].reason;
    }
    await pickCorrectOption(choice);
    await confirmAndContinue(choice);
  }

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
      // 环视被 withCap 封顶（典型：环绕途中切到后台标签页，rAF 停摆）时，orbit 的 promise
      // 不会走到它自己的收尾逻辑，覆盖层会连同 Esc 劫持与焦点圈禁一直挂到下一次 openChoice。
      // 这里补一次幂等的 close()：正常路径上 current 已为 null，是空操作。
      if (window.SHY_WALKIN && typeof window.SHY_WALKIN.close === "function") window.SHY_WALKIN.close();
    }
  }

  async function pickCorrectOption(choice) {
    // 已作答未确认的抉择（玩家答完题、没点「继续前行」就离开）重进时，choice.js 走的是
    // renderAnsweredReplay 回顾视图：它根本不渲染选项，只给一个「继续前行」。若仍按常规
    // 轮询选项，会白等满 WAIT_OPTIONS_MS（20s，且不受 debugFast 压缩）才放弃——在一个
    // 以无人值守观看为目的的功能里，那是 20 秒可见的死气。
    if (document.querySelector(".choice-btn-continue")) return;

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

    await clock.wait(dwell(NOTE_READ_MS));

    var cont = document.querySelector(".choice-btn-continue");
    if (cont) cont.click();
    else window.SHY_SCROLL.advance(); // 兜底：按钮意外缺席时直接推进，不停摆
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

    try {
      teardownScene();
    } catch (e) {
      // 收尾期的异常（如 WebGL 上下文丢失导致 renderer.dispose() 抛）绝不能阻断下面的还原：
      // 一旦还原被跳过，saveState 永远停在 no-op、state 永远是沙盒副本——玩家的真实进度
      // 既回不来、也再也写不进去。这与"重复 stop 不加守卫"是同一类静默永久损坏，只是
      // 这次是走异常路径触发，所以还原必须放进 finally、无条件执行。
      if (window.console && console.error) console.error("[autoplay] 收尾异常", e);
    } finally {
      restoreRealState();
    }

    // 存档已经无条件还原完毕；下面只是收尾画面与提示，即便失败也不再造成数据损坏。但仍
    // 用 try/catch 兜底——否则一次渲染异常会让画面停在沙盒最后一帧，且 toast 提示也不会
    // 弹出，玩家会误以为放映还没结束。toast 本身放在 try 外面，确保无论渲染是否成功都会提示。
    try {
      if (window.SHY_SCROLL) window.SHY_SCROLL.render();
      if (app()) {
        app().refreshHud();
        app().showView("scroll");
      }
    } catch (e) {
      if (window.console && console.error) console.error("[autoplay] 收尾渲染异常", e);
    }
    toast("放映结束，已恢复原有进度");

    unmountIndicator();
    unbindKeys();
    syncButton();
  }

  // 把画面从"放映中"的任何中间态收干净：解说、3D 覆盖层、观景模式、事件卡。
  function teardownScene() {
    closePrompt();
    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) { /* 忽略 */ }
      currentAudio = null;
    }
    if (window.SHY_VOICE && typeof window.SHY_VOICE.stop === "function") window.SHY_VOICE.stop();
    // 放映会把 BGM 切到抉择曲/终章曲，但 bgm.js 只在 shy:choice-done（唯一来源是玩家点
    // 「继续前行」）时才回落到 app.mp3。放映走的是自己的收尾路径，不经过那个事件，
    // 因此必须显式让 BGM 回到常态——否则放映一结束，终章曲会一直盖在玩家未通关的长卷上。
    if (window.SHY_BGM && typeof window.SHY_BGM.leaveChoice === "function") window.SHY_BGM.leaveChoice();
    if (window.SHY_WALKIN && typeof window.SHY_WALKIN.close === "function") window.SHY_WALKIN.close();
    // 放映中途停止时影片可能正在放：覆盖层连同它的焦点圈禁必须一并收掉。
    // 放在 SHY_BGM.leaveChoice() 之后——close() 内部会 _duck(false) 恢复背景乐音量，
    // 而 leaveChoice() 做的是交叉淡入切回 app.mp3，先切轨再恢复音量顺序才对。
    if (window.SHY_CHAPTER_FILM && typeof window.SHY_CHAPTER_FILM.close === "function") {
      window.SHY_CHAPTER_FILM.close();
    }
    // SHY_CHOICE 与 SHY_WALKIN 的 orbitPaused 都是模块级标记，各自的 open()/close() 都不会
    // 重置它（Task 3 审查已指出 SHY_WALKIN 这一半）：若在环视/环景暂停中收尾，下一轮放映的
    // 新 orbit() 会一开始就卡在暂停态、永远转不完。复用 togglePause 那份 setMediaPaused(on)，
    // 避免两处 SHY_CHOICE/SHY_WALKIN 守卫检查各写一份、逐渐漂移。
    setMediaPaused(false);
    if (window.SHY_CHOICE) {
      if (typeof window.SHY_CHOICE.setViewMode === "function") window.SHY_CHOICE.setViewMode(false);
      if (typeof window.SHY_CHOICE.setAutoplayActive === "function") window.SHY_CHOICE.setAutoplayActive(false);
    }
    var closeBtn = document.querySelector(".modal-backdrop.is-open .card-close");
    if (closeBtn) closeBtn.click();
  }

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

  function closePrompt() {
    var hadPrompt = !!promptEl; // teardownScene() 每次 stop() 都会防御式调用本函数；
    // 没开过弹窗时不做任何事，否则每一场放映收尾都会把焦点从玩家原本停留处抢到顶栏按钮上
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
    if (hadPrompt) {
      // 弹窗把焦点圈禁在卡片内；关闭后若不主动交还，焦点会掉到 <body>，键盘/屏幕阅读器
      // 用户下一次 Tab 会从页面最前头开始，体验倒退于打开弹窗之前。
      var trigger = document.getElementById("btn-autoplay");
      if (trigger) trigger.focus();
    }
  }

  function promptAndStart() {
    if (running) return;
    closePrompt(); // 防御式：上一次若因异常路径未关闭，先清理

    var frontier = resumeFrontier();
    if (frontier < 0) {
      // 经导出对象调用，与下面两个按钮处理器一致——自检会把 window.SHY_AUTOPLAY.start
      // 换成记录调用参数的桩来验证"无可续起点时直接开播"，若这里改用闭包内的 start
      // 直接调用，桩就绕过去了，断言测不出真实行为。
      window.SHY_AUTOPLAY.start({ resume: false });
      return;
    }

    var events = (data().events) || [];
    var ev = events[frontier];
    var where = "第 " + (frontier + 1) + "/" + events.length + " 幕 · " +
      chapterTitle(ev && ev.chapterId); // 复用既有函数（下方 renderIndicator 同款查找），避免逐字重复的第二份实现漏同步

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

  // ------------------------- 暂停 -------------------------

  function togglePause() {
    if (!running || !clock) return;
    if (clock.isPaused()) {
      clock.resume();
      if (currentAudio) { try { currentAudio.play(); } catch (e) { /* 忽略 */ } }
      setMediaPaused(false);
    } else {
      clock.pause();
      if (currentAudio) { try { currentAudio.pause(); } catch (e) { /* 忽略 */ } }
      setMediaPaused(true);
    }
    renderIndicator();
  }

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

  window.SHY_AUTOPLAY = {
    start: start,
    promptAndStart: promptAndStart,
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
