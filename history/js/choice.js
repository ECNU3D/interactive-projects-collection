// js/choice.js
// 《山河岁月》沉浸抉择模式：全屏渲染 scene/question/options，处理作答、计分、
// historyNote 展示，完成后写 state.answered 并派发 shy:choice-done 交还画卷。
// 消费 window.SHY_DATA.choices、window.SHY_SCORE、window.SHY_APP（state/showView/refreshHud）、
// window.SHY_AUDIO（可选）；监听 shy:enter-choice（detail.choiceId），产出 shy:choice-done。
//
// canonical answered 形状（本文件定案，供 scroll.js 等消费方对齐）：
//   state.answered[choiceId] = { firstTryCorrect: boolean, earned: number, tries: number, confirmed: boolean }
//   earned = 本次抉择实际入账的总分（答对 = scoreForAnswer 结果；答错但点"我明白了" = LEARN）。
//   confirmed：计分时先写 false，点击"继续前行"（onContinueClick）才置 true——historyNote 已
//   展示/确认的标记。刷新等场景下重开 confirmed===false 的抉择只回放"已作答"简化视图（不重复
//   计分，见 renderAnsweredReplay），点"继续前行"后才真正置 confirmed=true 并放行 scroll.js 解锁。
//   兼容旧存档：缺失 confirmed 字段的条目（fix 前写入）视为 confirmed=true。

(function () {
  "use strict";

  var ORDINALS = ["甲", "乙", "丙", "丁", "戊", "己"];
  var KIND_LABEL = { roleplay: "代入情境", insight: "史识判断" };

  var overlayEl = null;
  var refs = null;
  var currentChoice = null;
  var answering = false; // 是否仍在等待用户点选选项
  var alreadyAnsweredEntry = null; // 若本次打开时该抉择已作答过（含未确认的已计分条目），防御式避免重复计分
  var narrationRevealTimer = null; // 旁白逐句淡入结束后，延时展示问题/选项的定时器
  var historyNoteRevealTimer = null; // 答对后延时展开 historyNote 卷轴的定时器
  var sentenceTimers = [];

  // 360° 环景背景（2:1 等距全景，左右无缝）：拖拽环视 + 缓慢自动环绕
  var PANO_SPEED = 10; // 自动环绕速度 px/s，庄重缓慢
  var PANO_MIN_ASPECT = 1.9; // 宽高比 ≥1.9 视为环景图，否则退回 cover+KenBurns
  var panoRAF = null;
  var panoLastTs = 0;
  var panoX = 0; // 当前 backgroundPosition-x（负向为向左环绕）
  var panoAspect = 0;
  var panoTileW = 0; // 单幅平铺宽度 = 容器高 × 宽高比（repeat-x 取模用）
  var panoDragging = false;
  var panoDragStartX = 0;
  var panoDragStartPos = 0;
  var panoResumeTimer = null; // 拖拽松手 2s 后恢复自动环绕
  var panoPausedByDrag = false;
  var panoHintTimer = null;
  var prefersReducedMotion =
    !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // 放映模式：环绕子状态与总开关。环绕进行中 panoTick 只推进 panoOrbit，不叠加环境漂移。
  var panoOrbit = null;        // { fromX, delta, elapsed, durationMs, resolve } | null
  var orbitPaused = false;     // 放映暂停时冻结环绕进度（画面停住，不是继续转）
  var autoplayActive = false;  // 放映期整场为 true：禁用全景拖拽，并给 overlay 加 .is-autoplay

  // ------------------------- 工具函数 -------------------------

  function choicesList() {
    return (window.SHY_DATA && window.SHY_DATA.choices) || [];
  }

  function getState() {
    return (window.SHY_APP && window.SHY_APP.state) || null;
  }

  function findChoice(id) {
    var list = choicesList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function saveStateSafe(state) {
    if (window.SHY_SCORE && typeof window.SHY_SCORE.saveState === "function") {
      window.SHY_SCORE.saveState(state);
    }
  }

  function refreshHudSafe() {
    if (window.SHY_APP && typeof window.SHY_APP.refreshHud === "function") {
      window.SHY_APP.refreshHud();
    }
  }

  function playAudio(name) {
    if (window.SHY_AUDIO && typeof window.SHY_AUDIO.play === "function") {
      window.SHY_AUDIO.play(name);
    }
  }

  // 语音解说（js/narration.js，可选依赖——文件缺失/脚本未加载时静默降级）
  function playVoiceForSafe(id) {
    if (window.SHY_VOICE && typeof window.SHY_VOICE.playFor === "function") {
      window.SHY_VOICE.playFor(id);
    }
  }

  function stopVoiceSafe() {
    if (window.SHY_VOICE && typeof window.SHY_VOICE.stop === "function") {
      window.SHY_VOICE.stop();
    }
  }

  function replayVoiceSafe() {
    if (window.SHY_VOICE && typeof window.SHY_VOICE.replay === "function") {
      window.SHY_VOICE.replay();
    }
  }

  function showView(name) {
    if (window.SHY_APP && typeof window.SHY_APP.showView === "function") {
      window.SHY_APP.showView(name);
    }
  }

  function clearTimers() {
    if (narrationRevealTimer) {
      clearTimeout(narrationRevealTimer);
      narrationRevealTimer = null;
    }
    if (historyNoteRevealTimer) {
      clearTimeout(historyNoteRevealTimer);
      historyNoteRevealTimer = null;
    }
    sentenceTimers.forEach(function (t) {
      clearTimeout(t);
    });
    sentenceTimers = [];
  }

  // 种子随机：choiceId 各字符码加权之和作种子 —— 同一抉择每次进入顺序一致，
  // 不同抉择（不同 id）种子大概率不同，从而乱序结果不同，防止"永远选第二个"。
  function seedFromId(id) {
    var seed = 0;
    var s = String(id || "");
    for (var i = 0; i < s.length; i++) seed += s.charCodeAt(i) * (i + 1);
    return seed || 1;
  }

  // mulberry32：小巧的确定性 PRNG，同一 seed 恒定产出同一序列
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffleIndices(count, seed) {
    var rand = mulberry32(seed);
    var indices = [];
    for (var i = 0; i < count; i++) indices.push(i);
    for (var j = indices.length - 1; j > 0; j--) {
      var k = Math.floor(rand() * (j + 1));
      var tmp = indices[j];
      indices[j] = indices[k];
      indices[k] = tmp;
    }
    return indices;
  }

  // 按句号/叹号/问号切句（保留标点），用于旁白逐句淡入
  function splitSentences(text) {
    var raw = String(text || "");
    var parts = raw.match(/[^。！？]+[。！？]?/g);
    if (!parts) return raw ? [raw] : [];
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p) out.push(p);
    }
    return out.length ? out : raw ? [raw] : [];
  }

  // ------------------------- DOM 骨架（惰性构建一次，跨多次抉择复用） -------------------------

  function ensureOverlay() {
    if (overlayEl) return;
    var container = document.getElementById("choice-view");
    if (!container) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "choice-overlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.setAttribute("aria-label", "历史抉择");

    overlayEl.innerHTML =
      '<div class="choice-bg">' +
      '<img class="choice-bg-img choice-kenburns" alt="" aria-hidden="true" hidden>' +
      '<div class="choice-bg-fallback choice-kenburns" aria-hidden="true"><span class="choice-bg-fallback-seal">鉴</span></div>' +
      '<div class="choice-bg-pano" aria-hidden="true" hidden></div>' +
      '<div class="choice-bg-shade"></div>' +
      "</div>" +
      '<div class="choice-ai-badge">AI 生成想象图</div>' +
      '<div class="choice-pano-hint" hidden><span class="choice-pano-hint-arrow">‹</span>拖动环视<span class="choice-pano-hint-arrow">›</span></div>' +
      '<div class="choice-inkblot" hidden></div>' +
      '<div class="choice-seal" hidden><span>史</span><span>笔</span><span>如</span><span>铁</span></div>' +
      '<button type="button" class="choice-walkin-toggle" hidden>走入历史</button>' +
      '<button type="button" class="choice-viewmode-toggle">凭栏远眺</button>' +
      '<button type="button" class="choice-viewmode-exit">回到抉择</button>' +
      '<div class="choice-panel">' +
      '<div class="choice-panel-rod" aria-hidden="true"></div>' +
      '<div class="choice-kind-tag"></div>' +
      '<button type="button" class="choice-voice-replay" aria-label="重播旁白解说" title="重播旁白解说">⟲ 重听旁白</button>' +
      '<div class="choice-scene"></div>' +
      '<div class="choice-question" hidden></div>' +
      '<div class="choice-options" hidden></div>' +
      '<div class="choice-feedback" hidden>' +
      '<div class="choice-feedback-block choice-feedback-selected">' +
      '<h4 class="choice-feedback-label"></h4>' +
      '<p class="choice-feedback-text"></p>' +
      "</div>" +
      '<div class="choice-feedback-block choice-feedback-correct" hidden>' +
      '<h4 class="choice-feedback-label">历史正确抉择</h4>' +
      '<p class="choice-feedback-correct-option"></p>' +
      '<p class="choice-feedback-correct-text"></p>' +
      "</div>" +
      "</div>" +
      '<div class="choice-historynote" hidden>' +
      '<div class="choice-historynote-inner">' +
      '<h4 class="choice-historynote-title">历史真实走向</h4>' +
      '<p class="choice-historynote-text"></p>' +
      "</div>" +
      "</div>" +
      '<div class="choice-actions"></div>' +
      "</div>";

    container.appendChild(overlayEl);

    refs = {
      bgImg: overlayEl.querySelector(".choice-bg-img"),
      bgFallback: overlayEl.querySelector(".choice-bg-fallback"),
      bgPano: overlayEl.querySelector(".choice-bg-pano"),
      panoHint: overlayEl.querySelector(".choice-pano-hint"),
      kindTag: overlayEl.querySelector(".choice-kind-tag"),
      voiceReplay: overlayEl.querySelector(".choice-voice-replay"),
      scene: overlayEl.querySelector(".choice-scene"),
      question: overlayEl.querySelector(".choice-question"),
      options: overlayEl.querySelector(".choice-options"),
      feedback: overlayEl.querySelector(".choice-feedback"),
      feedbackSelectedBlock: overlayEl.querySelector(".choice-feedback-selected"),
      feedbackSelectedLabel: overlayEl.querySelector(".choice-feedback-selected .choice-feedback-label"),
      feedbackSelectedText: overlayEl.querySelector(".choice-feedback-selected .choice-feedback-text"),
      feedbackCorrectBlock: overlayEl.querySelector(".choice-feedback-correct"),
      feedbackCorrectOption: overlayEl.querySelector(".choice-feedback-correct-option"),
      feedbackCorrectText: overlayEl.querySelector(".choice-feedback-correct-text"),
      historyNote: overlayEl.querySelector(".choice-historynote"),
      historyNoteText: overlayEl.querySelector(".choice-historynote-text"),
      actions: overlayEl.querySelector(".choice-actions"),
      seal: overlayEl.querySelector(".choice-seal"),
      inkblot: overlayEl.querySelector(".choice-inkblot"),
      viewModeToggle: overlayEl.querySelector(".choice-viewmode-toggle"),
      viewModeExit: overlayEl.querySelector(".choice-viewmode-exit"),
      walkinToggle: overlayEl.querySelector(".choice-walkin-toggle")
    };

    document.addEventListener("keydown", onKeydown);

    // 环景拖拽：绑在 overlay 上，命中面板/按钮等交互内容时不启动拖拽
    overlayEl.addEventListener("pointerdown", onPanoPointerDown);
    overlayEl.addEventListener("pointermove", onPanoPointerMove);
    overlayEl.addEventListener("pointerup", onPanoPointerUp);
    overlayEl.addEventListener("pointercancel", onPanoPointerUp);
    window.addEventListener("resize", recomputePanoTileW);

    refs.viewModeToggle.addEventListener("click", enterViewMode);
    refs.viewModeExit.addEventListener("click", exitViewMode);
    refs.voiceReplay.addEventListener("click", replayVoiceSafe);
    refs.walkinToggle.addEventListener("click", onWalkinToggleClick);
  }

  // ------------------------- 观景模式：面板/问题/反馈/角标淡出，只留全景可拖拽环视 -------------------------
  // 纯视觉层切换（overlay 加/减 is-viewing 类），不触碰 state/计分，答题进度与已展示的
  // 反馈内容在退出观景模式后原样保留（DOM 内容本身未被清空或重渲染）。

  function isViewMode() {
    return !!(overlayEl && overlayEl.classList.contains("is-viewing"));
  }

  function enterViewMode() {
    if (!overlayEl) return;
    overlayEl.classList.add("is-viewing");
  }

  function exitViewMode() {
    if (!overlayEl) return;
    overlayEl.classList.remove("is-viewing");
  }

  // ------------------------- 键盘可达：Esc 不可跳过，Enter 确认 -------------------------

  function onKeydown(e) {
    // 走入历史3D漫游打开期间，抉择面板的全部键盘捷径失效（Esc由walkin自身capture阶段拦截）：
    // 不透明覆盖层背后不得发生任何用户不可见的状态变更（纯视觉层约束）
    if (window.SHY_WALKIN && typeof window.SHY_WALKIN.isOpen === "function" && window.SHY_WALKIN.isOpen()) return;
    var view = document.getElementById("choice-view");
    if (!overlayEl || !view || view.hidden) return; // 抉择视图未展示时不拦截全局按键
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      e.stopPropagation();
      if (isViewMode()) {
        // 观景模式下 Esc = 回到抉择（退出观景），但抉择本身仍不可跳过/关闭
        exitViewMode();
        return;
      }
      // 历史不可改变：抉择必须作答，Esc 不得跳过/关闭
      return;
    }
    if (e.key === "Enter") {
      var btn = refs.actions.querySelector("button");
      if (btn && !btn.disabled) {
        e.preventDefault();
        btn.click();
      }
    }
  }

  // ------------------------- 打开抉择 -------------------------

  function openChoice(choiceId) {
    var choice = findChoice(choiceId);
    if (!choice) return;
    ensureOverlay();
    if (!overlayEl) return;
    overlayEl.classList.toggle("is-autoplay", autoplayActive);

    currentChoice = choice;
    var state = getState();
    alreadyAnsweredEntry = (state && state.answered && state.answered[choice.id]) || null;

    // 防御性收尾：若上一场漫游会话因异常路径遗留未关闭，打开新抉择时先行销毁（无会话时为 no-op）
    if (window.SHY_WALKIN && typeof window.SHY_WALKIN.close === "function") window.SHY_WALKIN.close();
    resetDynamicContent();
    setupBackground(choice);
    setupWalkin(choice);
    setupKindTag(choice);
    showView("choice");
    playVoiceForSafe(choice.id); // 进入抉择即播放本抉择旁白解说（含回顾视图，文件缺失静默降级）

    if (alreadyAnsweredEntry && alreadyAnsweredEntry.confirmed === false) {
      // 已计分但玩家在点"继续前行"前离开/刷新：不重放旁白与选项、不重复计分（本分支下
      // handleCorrect/handleWrong/onLearnClick 均不会被调用），直接展示简化回顾视图。
      renderAnsweredReplay(choice, alreadyAnsweredEntry);
      return;
    }

    renderSceneAndSchedule(choice);
  }

  // 已计分但未确认（confirmed===false）时重开抉择的简化回顾视图：跳过旁白逐句淡入与选项
  // 渲染，直接展示"已作答"摘要 + 历史正确抉择及其 feedback + historyNote，仍需点击
  // "继续前行"（onContinueClick）才置 confirmed=true 并放行 scroll.js 解锁下一节点。
  function renderAnsweredReplay(choice, entry) {
    var options = choice.options || [];
    var correctOpt = null;
    for (var i = 0; i < options.length; i++) {
      if (options[i].correct) {
        correctOpt = options[i];
        break;
      }
    }

    refs.question.textContent = choice.question || "";
    refs.question.hidden = false;
    window.requestAnimationFrame(function () {
      refs.question.classList.add("is-visible");
    });

    refs.feedback.hidden = false;
    refs.feedbackSelectedBlock.classList.add(entry.firstTryCorrect ? "is-correct" : "is-wrong");
    refs.feedbackSelectedLabel.textContent = entry.firstTryCorrect
      ? "此抉择已作答 · 史笔如铁（已得 " + (entry.earned || 0) + " 分）"
      : entry.earned
        ? "此抉择已作答（我明白了 · 已得 " + entry.earned + " 分）"
        : "此抉择已作答（已见正确答案）";
    refs.feedbackSelectedText.textContent = "刷新或重新进入：以下为历史正确抉择回顾，查阅后请继续前行。";
    refs.feedbackCorrectBlock.hidden = false;
    refs.feedbackCorrectOption.textContent = (correctOpt && correctOpt.text) || "";
    refs.feedbackCorrectText.textContent = (correctOpt && correctOpt.feedback) || "";
    window.requestAnimationFrame(function () {
      refs.feedback.classList.add("is-open");
    });

    revealHistoryNote();
  }

  function resetDynamicContent() {
    clearTimers();
    answering = false;
    exitViewMode(); // 每次新开抉择都从常态面板开始，不沿用上一次的观景态

    refs.scene.innerHTML = "";

    refs.question.textContent = "";
    refs.question.hidden = true;
    refs.question.classList.remove("is-visible");

    refs.options.innerHTML = "";
    refs.options.hidden = true;
    refs.options.classList.remove("is-visible");

    refs.feedback.hidden = true;
    refs.feedback.classList.remove("is-open");
    refs.feedbackSelectedBlock.classList.remove("is-correct", "is-wrong");
    refs.feedbackCorrectBlock.hidden = true;

    refs.historyNote.hidden = true;
    refs.historyNote.classList.remove("is-open");
    refs.historyNoteText.textContent = "";

    refs.actions.innerHTML = "";

    refs.seal.hidden = true;
    refs.seal.classList.remove("is-show", "is-recede");
    refs.inkblot.hidden = true;
    refs.inkblot.classList.remove("is-show");
  }

  function setupBackground(choice) {
    var img = refs.bgImg;
    var fallback = refs.bgFallback;
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
    img.hidden = true;
    stopPano();
    fallback.hidden = false; // 默认先显示水墨降级背景，图片探测成功后再切换，避免破图闪现
    if (!choice.panorama) return;

    // 用探测 Image 读取宽高比：≥1.9 视为 2:1 等距环景 → 环绕模式；
    // 否则退回原 cover+KenBurns 模式；加载失败保持水墨降级。三模式互斥。
    var probe = new Image();
    probe.onload = function () {
      if (currentChoice !== choice) return; // 探测返回前已切换/关闭抉择
      var aspect = probe.naturalHeight > 0 ? probe.naturalWidth / probe.naturalHeight : 0;
      if (aspect >= PANO_MIN_ASPECT) {
        startPano(choice.panorama, aspect);
      } else {
        img.src = choice.panorama;
        img.hidden = false;
        fallback.hidden = true;
      }
    };
    probe.onerror = function () {
      // 保持水墨降级背景
    };
    probe.src = choice.panorama;
  }

  // ------------------------- 360° 环景引擎 -------------------------

  function readSettingsSafe() {
    try {
      var raw = localStorage.getItem("shanhe_settings_v1");
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function writeSettingsSafe(patch) {
    try {
      var obj = readSettingsSafe();
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) obj[k] = patch[k];
      }
      localStorage.setItem("shanhe_settings_v1", JSON.stringify(obj));
    } catch (e) {
      // localStorage 不可用（file:// 受限等）：提示会每次展示，可接受
    }
  }

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

  function applyPanoPos() {
    if (!panoTileW) return;
    refs.bgPano.style.backgroundPosition = (panoX % panoTileW) + "px 50%";
  }

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

  function startPano(url, aspect) {
    refs.bgImg.hidden = true;
    refs.bgFallback.hidden = true;
    panoAspect = aspect;
    panoX = 0;
    refs.bgPano.style.backgroundImage = 'url("' + String(url).replace(/"/g, "%22") + '")';
    refs.bgPano.hidden = false;
    recomputePanoTileW();
    applyPanoPos();
    panoLastTs = 0;
    if (!panoRAF) panoRAF = window.requestAnimationFrame(panoTick);
    maybeShowPanoHint();
  }

  function stopPano() {
    if (panoOrbit) {
      // 抉择被切换/关闭时全景引擎停摆：把仍在等待的环绕 promise 以 false 收尾，
      // 否则导演会一直 await 到 withCap 的封顶时限才继续，白等一大段。
      var aborted = panoOrbit.resolve;
      panoOrbit = null;
      aborted(false);
    }
    orbitPaused = false;
    if (panoRAF) {
      window.cancelAnimationFrame(panoRAF);
      panoRAF = null;
    }
    panoLastTs = 0;
    panoDragging = false;
    panoPausedByDrag = false;
    if (panoResumeTimer) {
      clearTimeout(panoResumeTimer);
      panoResumeTimer = null;
    }
    if (panoHintTimer) {
      clearTimeout(panoHintTimer);
      panoHintTimer = null;
    }
    if (refs && refs.bgPano) refs.bgPano.hidden = true;
    if (refs && refs.panoHint) {
      refs.panoHint.classList.remove("is-visible");
      refs.panoHint.hidden = true;
    }
    if (overlayEl) overlayEl.classList.remove("is-pano-dragging");
  }

  function maybeShowPanoHint() {
    if (autoplayActive) return; // 放映期拖拽已禁用，既不该展示这个操作提示，也不该消耗掉玩家的一次性首见标记
    if (readSettingsSafe().panoHintShown) return;
    writeSettingsSafe({ panoHintShown: true });
    refs.panoHint.hidden = false;
    window.requestAnimationFrame(function () {
      refs.panoHint.classList.add("is-visible");
    });
    panoHintTimer = setTimeout(function () {
      refs.panoHint.classList.remove("is-visible");
      panoHintTimer = setTimeout(function () {
        if (refs && refs.panoHint) refs.panoHint.hidden = true;
      }, 700);
    }, 3000);
  }

  function onPanoPointerDown(e) {
    if (autoplayActive) return; // 放映期由镜头轨道全权控制，人工拖拽会与之打架
    if (!refs || !refs.bgPano || refs.bgPano.hidden) return;
    if (e.target && e.target.closest && e.target.closest(".choice-panel, .choice-actions, button, .choice-ai-badge")) return;
    panoDragging = true;
    panoPausedByDrag = true;
    panoDragStartX = e.clientX;
    panoDragStartPos = panoX;
    if (panoResumeTimer) {
      clearTimeout(panoResumeTimer);
      panoResumeTimer = null;
    }
    overlayEl.classList.add("is-pano-dragging");
    if (overlayEl.setPointerCapture && e.pointerId != null) {
      try { overlayEl.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }
    e.preventDefault();
  }

  function onPanoPointerMove(e) {
    if (!panoDragging) return;
    panoX = panoDragStartPos + (e.clientX - panoDragStartX);
    applyPanoPos();
  }

  function onPanoPointerUp() {
    if (!panoDragging) return;
    panoDragging = false;
    overlayEl.classList.remove("is-pano-dragging");
    if (panoResumeTimer) clearTimeout(panoResumeTimer);
    panoResumeTimer = setTimeout(function () {
      panoPausedByDrag = false;
      panoResumeTimer = null;
    }, 2000);
  }

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

  // ------------------------- 旁白逐句淡入 → 问题/选项浮现 -------------------------

  function renderSceneAndSchedule(choice) {
    var sentences = splitSentences(choice.scene);
    var spans = [];
    sentences.forEach(function (sentence) {
      var span = document.createElement("span");
      span.className = "choice-scene-sentence";
      span.textContent = sentence;
      refs.scene.appendChild(span);
      spans.push(span);
    });

    var stepDelay = spans.length ? Math.min(160, 1400 / spans.length) : 0;
    spans.forEach(function (span, i) {
      var delay = Math.min(i * stepDelay, 1400);
      var t = setTimeout(function () {
        span.classList.add("is-visible");
      }, delay);
      sentenceTimers.push(t);
    });

    var lastDelay = spans.length ? Math.min((spans.length - 1) * stepDelay, 1400) : 0;
    narrationRevealTimer = setTimeout(function () {
      revealQuestionAndOptions(choice);
    }, lastDelay + 550);
  }

  function revealQuestionAndOptions(choice) {
    refs.question.textContent = choice.question || "";
    refs.question.hidden = false;
    renderOptions(choice);
    refs.options.hidden = false;
    window.requestAnimationFrame(function () {
      refs.question.classList.add("is-visible");
      refs.options.classList.add("is-visible");
    });
    answering = true;
  }

  function renderOptions(choice) {
    refs.options.innerHTML = "";
    var options = choice.options || [];
    var order = seededShuffleIndices(options.length, seedFromId(choice.id));
    order.forEach(function (origIndex, displayPos) {
      var opt = options[origIndex];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-option";
      btn.dataset.origIndex = String(origIndex);
      btn.innerHTML =
        '<span class="choice-option-ordinal">' +
        escapeHtml(ORDINALS[displayPos] || String(displayPos + 1)) +
        "</span>" +
        '<span class="choice-option-text">' +
        escapeHtml(opt.text) +
        "</span>";
      btn.addEventListener("click", function () {
        handleOptionClick(origIndex);
      });
      refs.options.appendChild(btn);
    });
  }

  // ------------------------- 作答逻辑 -------------------------

  function handleOptionClick(origIndex) {
    if (!answering || !currentChoice) return;
    answering = false;

    var options = currentChoice.options || [];
    var chosen = options[origIndex];
    var correctIndex = -1;
    for (var i = 0; i < options.length; i++) {
      if (options[i].correct) {
        correctIndex = i;
        break;
      }
    }
    var isCorrect = !!(chosen && chosen.correct);

    var btns = refs.options.querySelectorAll(".choice-option");
    for (var b = 0; b < btns.length; b++) {
      var btn = btns[b];
      btn.disabled = true;
      var oi = parseInt(btn.dataset.origIndex, 10);
      if (oi === origIndex) btn.classList.add("is-selected");
      if (oi === correctIndex) btn.classList.add("is-correct-answer");
      if (!isCorrect && oi === origIndex) btn.classList.add("is-wrong-answer");
    }

    if (isCorrect) {
      handleCorrect(chosen);
    } else {
      handleWrong(chosen, options[correctIndex]);
    }
  }

  function handleCorrect(chosen) {
    var state = getState();
    var earned = alreadyAnsweredEntry ? alreadyAnsweredEntry.earned || 0 : 0;

    if (!alreadyAnsweredEntry) {
      var combo = state ? state.combo || 0 : 0;
      earned = window.SHY_SCORE ? window.SHY_SCORE.scoreForAnswer(true, combo) : 0;
      if (state) {
        state.total = (state.total || 0) + earned;
        state.combo = combo + 1;
        state.answered = state.answered || {};
        state.answered[currentChoice.id] = { firstTryCorrect: true, earned: earned, tries: 1, confirmed: false };
        saveStateSafe(state);
        refreshHudSafe();
      }
    }

    playAudio("correct");
    showSeal();

    refs.feedback.hidden = false;
    refs.feedbackSelectedBlock.classList.add("is-correct");
    refs.feedbackSelectedLabel.textContent = "史笔如铁 · 你的抉择与历史同向（+" + earned + "）";
    refs.feedbackSelectedText.textContent = (chosen && chosen.feedback) || "";
    refs.feedbackCorrectBlock.hidden = true;
    window.requestAnimationFrame(function () {
      refs.feedback.classList.add("is-open");
    });

    historyNoteRevealTimer = setTimeout(function () {
      revealHistoryNote();
    }, 900);
  }

  function handleWrong(chosen, correctOpt) {
    var state = getState();
    if (state && !alreadyAnsweredEntry) {
      state.combo = 0;
      // 立即写入"已尝试"条目（earned:0, confirmed:false）：正确答案即将展示，若玩家此刻
      // 刷新，重开将进入回顾视图而非重新作答——堵住"偷看正确答案后刷新重答满分"的窗口。
      // 随后点击"我明白了"时 onLearnClick 会以 earned:20 覆盖本条目（其守卫读的是
      // openChoice 时快照的 alreadyAnsweredEntry，本会话内仍为 null，不受影响）。
      state.answered = state.answered || {};
      state.answered[currentChoice.id] = { firstTryCorrect: false, earned: 0, tries: 1, confirmed: false };
      saveStateSafe(state);
      refreshHudSafe();
    }

    playAudio("wrong");
    showInkBlot();

    refs.feedback.hidden = false;
    refs.feedbackSelectedBlock.classList.add("is-wrong");
    refs.feedbackSelectedLabel.textContent = "你的选择 · 为何不妥";
    refs.feedbackSelectedText.textContent = (chosen && chosen.feedback) || "";
    refs.feedbackCorrectBlock.hidden = false;
    refs.feedbackCorrectOption.textContent = (correctOpt && correctOpt.text) || "";
    refs.feedbackCorrectText.textContent = (correctOpt && correctOpt.feedback) || "";
    window.requestAnimationFrame(function () {
      refs.feedback.classList.add("is-open");
    });

    showLearnButton();
  }

  function showSeal() {
    refs.seal.hidden = false;
    refs.seal.classList.remove("is-show", "is-recede");
    void refs.seal.offsetWidth; // 强制重排，确保重复触发（先答错另一题再答对）时动画可重放
    refs.seal.classList.add("is-show");
    // 停留片刻后化入背景，避免历史真实走向卷轴展开、面板增高时与印章重叠
    var sealEl = refs.seal;
    var t = setTimeout(function () {
      if (sealEl) sealEl.classList.add("is-recede");
    }, 1500);
    sentenceTimers.push(t);
  }

  function showInkBlot() {
    refs.inkblot.hidden = false;
    refs.inkblot.classList.remove("is-show");
    void refs.inkblot.offsetWidth;
    refs.inkblot.classList.add("is-show");
  }

  function showLearnButton() {
    refs.actions.innerHTML = "";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn choice-btn-learn";
    btn.textContent = "我明白了";
    btn.addEventListener("click", onLearnClick);
    refs.actions.appendChild(btn);
    btn.focus();
  }

  function onLearnClick() {
    var state = getState();
    var earned = alreadyAnsweredEntry ? alreadyAnsweredEntry.earned || 0 : 0;
    if (!alreadyAnsweredEntry && state && currentChoice) {
      earned = window.SHY_SCORE ? window.SHY_SCORE.LEARN : 20;
      state.total = (state.total || 0) + earned;
      state.answered = state.answered || {};
      state.answered[currentChoice.id] = { firstTryCorrect: false, earned: earned, tries: 1, confirmed: false };
      saveStateSafe(state);
      refreshHudSafe();
    }
    refs.feedbackSelectedLabel.textContent = "你的选择 · 为何不妥（我明白了 · +" + earned + "）";
    revealHistoryNote();
  }

  // ------------------------- 历史真实走向卷轴 → 继续前行 -------------------------

  function revealHistoryNote() {
    if (!currentChoice) return;
    refs.historyNoteText.textContent = currentChoice.historyNote || "";
    refs.historyNote.hidden = false;
    window.requestAnimationFrame(function () {
      refs.historyNote.classList.add("is-open");
    });
    showContinueButton();
  }

  function showContinueButton() {
    refs.actions.innerHTML = "";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn choice-btn-continue";
    btn.textContent = "继续前行";
    btn.addEventListener("click", onContinueClick);
    refs.actions.appendChild(btn);
    btn.focus();
  }

  function onContinueClick() {
    var doneChoiceId = currentChoice ? currentChoice.id : null;
    var state = getState();
    if (doneChoiceId && state && state.answered && state.answered[doneChoiceId]) {
      // historyNote 已展示/确认：置 confirmed=true 并持久化，刷新后重开不再回放简化视图，
      // scroll.js 的重入判断（isChoiceConfirmed）据此放行解锁。
      state.answered[doneChoiceId].confirmed = true;
      saveStateSafe(state);
    }
    currentChoice = null;
    alreadyAnsweredEntry = null;
    stopPano();
    stopVoiceSafe(); // 继续前行 = 离开本抉择，停止旁白解说（BGM 淡回全局由 js/bgm.js 监听 shy:choice-done 处理）
    document.dispatchEvent(new CustomEvent("shy:choice-done", { detail: { choiceId: doneChoiceId } }));
    showView("scroll");
  }

  // ------------------------- 事件监听 -------------------------

  document.addEventListener("shy:enter-choice", function (e) {
    var id = e && e.detail && e.detail.choiceId;
    if (!id) return;
    openChoice(id);
  });

  // ------------------------- 自动放映契约（js/autoplay.js 消费） -------------------------

  function setAutoplayActive(on) {
    autoplayActive = !!on;
    if (overlayEl) overlayEl.classList.toggle("is-autoplay", autoplayActive);
    if (!autoplayActive) {
      orbitPaused = false;
      // 放映退场时若正停在抉择幕，全景引擎不会有人来关：panoTick 会对一个已隐藏的元素
      // 持续写 backgroundPosition。这里顺带收干净（stopPano 幂等，且会以 false 收尾在途环绕）。
      stopPano();
    }
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
})();
