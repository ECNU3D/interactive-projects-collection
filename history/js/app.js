// js/app.js
// 《山河岁月》应用外壳：视图切换、HUD、静音、重新开始、关于页。
// 提供 window.SHY_APP = { showView(name), refreshHud(), state }
// 启动顺序：loadState()||newState() → 渲染长卷 → showView('scroll') → 刷新HUD。

(function () {
  "use strict";

  var VIEW_IDS = {
    scroll: "scroll-view",
    choice: "choice-view",
    graph: "graph-view",
    map: "map-view",
    ending: "ending-view",
    about: "about-view"
  };

  var SHY_APP = {
    showView: showView,
    refreshHud: refreshHud,
    restart: doRestart,
    navigateBack: navigateBack,
    showToast: showToast,
    state: null
  };
  window.SHY_APP = SHY_APP;

  var settings = loadSettings();
  var localMuted = !!settings.muted;

  // 导航栈（轻量，单槽）：进入 graph/about 这类"次级"视图时记录来处（{view, eventId?}），
  // 供 navigateBack() 返回时还原上下文（含重开事件卡）。见 shared-interfaces.md 契约增补。
  var navOrigin = null;

  // ------------------------- 工具函数 -------------------------

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function findChapter(chapterId) {
    var chapters = (window.SHY_DATA && window.SHY_DATA.chapters) || [];
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].id === chapterId) return chapters[i];
    }
    return null;
  }

  function loadSettings() {
    try {
      var raw = window.localStorage.getItem("shanhe_settings_v1");
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveSettings(s) {
    try {
      window.localStorage.setItem("shanhe_settings_v1", JSON.stringify(s));
    } catch (e) {
      // file:// 协议下 localStorage 可能受限，静默失败
    }
  }

  function isMuted() {
    if (window.SHY_AUDIO && typeof window.SHY_AUDIO.muted === "boolean") return window.SHY_AUDIO.muted;
    return localMuted;
  }

  function playAudioSafe(name) {
    if (window.SHY_AUDIO && typeof window.SHY_AUDIO.play === "function") {
      window.SHY_AUDIO.play(name);
    }
  }

  // ------------------------- 视图切换 -------------------------

  function currentViewName() {
    var keys = Object.keys(VIEW_IDS);
    for (var i = 0; i < keys.length; i++) {
      var el = document.getElementById(VIEW_IDS[keys[i]]);
      if (el && !el.hidden) return keys[i];
    }
    return "scroll";
  }

  // opts.from：进入 graph/about 时的显式来处 { view, eventId? }（如事件卡人物 chip 跳转）；
  // 省略时若目标是 graph/about 且并非"原地重进"，自动以切换前的视图兜底记为来处，
  // 使 navigateBack() 总能还原——包括终章视图点「人物星图」再返回终章这类未显式传参的场景。
  function showView(name, opts) {
    if (!VIEW_IDS[name]) return;
    opts = opts || {};
    var prev = currentViewName();
    document.dispatchEvent(new CustomEvent("shy:view-changing", { detail: { from: prev, to: name } }));
    if ((name === "graph" || name === "map" || name === "about") && prev !== name) {
      navOrigin = opts.from || { view: prev };
    }
    Object.keys(VIEW_IDS).forEach(function (key) {
      var el = document.getElementById(VIEW_IDS[key]);
      if (el) el.hidden = key !== name;
    });
    // 翻页音效：视图切换即"翻卷"；ending 另有专属终章音效（见 shy:enter-ending 监听），此处不重复播放
    if (name !== "ending") playAudioSafe("page");
    // 后续任务模块防御式调用：本任务阶段这些模块可能尚不存在
    if (name === "graph" && window.SHY_GRAPH && typeof window.SHY_GRAPH.render === "function") {
      window.SHY_GRAPH.render();
    }
    if (name === "map" && window.SHY_MAP && typeof window.SHY_MAP.render === "function") {
      window.SHY_MAP.render(); // 幂等：重复进入会 refresh 并重播进入动效
    }
    if (name === "ending" && window.SHY_ENDING && typeof window.SHY_ENDING.render === "function") {
      window.SHY_ENDING.render();
    }
    if (name === "about") {
      renderAboutView();
    }
  }

  // 返回 navOrigin 记录的来处；若来处携带 eventId（人物 chip 跳转场景）且目标是 scroll，
  // 顺带重开该事件卡（SHY_SCROLL.openEvent 对已解锁节点只读安全，见 shared-interfaces.md）。
  function navigateBack() {
    var origin = navOrigin;
    navOrigin = null;
    var targetView = (origin && origin.view) || "scroll";
    var eventId = origin && origin.eventId;
    showView(targetView);
    if (eventId && targetView === "scroll" && window.SHY_SCROLL && typeof window.SHY_SCROLL.openEvent === "function") {
      window.SHY_SCROLL.openEvent(eventId);
    }
  }

  function toggleView(name) {
    if (currentViewName() === name) {
      navigateBack();
    } else {
      showView(name);
    }
  }

  // 抉择进行中（choice-view 可见）时，顶栏「人物星图/关于/终章」与站标应被阻断——历史抉择
  // 不可跳过作答；静音/重新开始不受此限（见下方 bindTopBar）。
  function isChoiceBlocking() {
    var el = document.getElementById(VIEW_IDS.choice);
    return !!(el && !el.hidden);
  }

  function showToast(msg) {
    var el = document.getElementById("shy-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "shy-toast";
      el.className = "shy-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove("is-visible");
    void el.offsetWidth; // 强制重排，确保连续触发时动画可重放
    el.classList.add("is-visible");
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 1800);
  }

  // ------------------------- HUD -------------------------

  function refreshHud() {
    var hud = document.getElementById("score-hud");
    var state = SHY_APP.state;
    if (!hud || !state) return;

    var total = state.total || 0;
    var title = window.SHY_SCORE ? window.SHY_SCORE.titleForTotal(total) : "";

    var events = (window.SHY_DATA && window.SHY_DATA.events) || [];
    var idx = Math.min(Math.max((state.unlockedCount || 1) - 1, 0), events.length - 1);
    var curEv = idx >= 0 ? events[idx] : null;
    var curChapter = curEv ? findChapter(curEv.chapterId) : null;

    // 章节评级角标：不能用"当前前沿事件所在章"去查 chapterEarned —— scroll.js 的 doUnlock()
    // 是"先对刚结束的章评级，再把前沿推进到下一章"，所以此时 curEv 已经是下一章的事件，
    // 用它的 chapterId 永远查不到刚写入的评级。改用 state.lastGradedChapter 指针追溯"最近一次
    // 被评级的章"；老存档没有这个指针时，退化为取 chapterEarned 里最后写入的一项（对象按插入序遍历）。
    var gradeChapterId = state.lastGradedChapter;
    if (!gradeChapterId && state.chapterEarned) {
      var gradedKeys = Object.keys(state.chapterEarned);
      if (gradedKeys.length) gradeChapterId = gradedKeys[gradedKeys.length - 1];
    }
    var grade = gradeChapterId && state.chapterEarned ? state.chapterEarned[gradeChapterId] : null;
    var gradeChapter = grade ? findChapter(gradeChapterId) : null;

    hud.innerHTML =
      '<span class="hud-total">' + total + " 分</span>" +
      '<span class="hud-title-badge">' + escapeHtml(title) + "</span>" +
      '<span class="hud-chapter-badge">' + escapeHtml(curChapter ? curChapter.title : "") + "</span>" +
      (grade
        ? '<span class="hud-grade-badge" title="' +
          escapeHtml((gradeChapter ? gradeChapter.title : "") + "评级") +
          '"><span class="hud-grade-seal">' + escapeHtml(grade) + "</span></span>"
        : "");

    var muteBtn = document.getElementById("btn-mute");
    if (muteBtn) {
      var muted = isMuted();
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      muteBtn.textContent = muted ? "已静音" : "静音";
    }

    var endingBtn = document.getElementById("btn-ending");
    if (endingBtn) endingBtn.hidden = !state.finished;
  }

  // ------------------------- 顶部操作栏绑定 -------------------------

  function bindMute() {
    var btn = document.getElementById("btn-mute");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = !isMuted();
      if (window.SHY_AUDIO && typeof window.SHY_AUDIO.setMuted === "function") {
        window.SHY_AUDIO.setMuted(next);
      }
      localMuted = next;
      settings.muted = next;
      saveSettings(settings);
      refreshHud();
    });
  }

  // 清空存档并重开：由顶部栏「重新开始」按钮触发，也通过 SHY_APP.restart 导出给
  // js/ending.js「重走长卷」按钮复用，避免同一逻辑在两处重复实现。
  function doRestart() {
    if (window.SHY_AUTOPLAY && window.SHY_AUTOPLAY.isRunning()) window.SHY_AUTOPLAY.stop();
    var confirmed = window.confirm("确定要清空当前存档、重新开始这段山河岁月吗？此操作不可撤销。");
    if (!confirmed) return;
    try {
      window.localStorage.removeItem("shanhe_save_v1");
      window.localStorage.removeItem("shanhe_settings_v1");
    } catch (e) {
      // file:// 协议下 localStorage 可能受限，静默失败
    }
    window.location.reload();
  }

  function bindRestart() {
    var btn = document.getElementById("btn-restart");
    if (!btn) return;
    btn.addEventListener("click", doRestart);
  }

  // 抉择进行中点顶栏「人物星图/舆图/关于/终章」或站标：给出轻提示并放弃本次切换，不打断当前
  // 抉择；静音/重新开始不受限（各自的绑定函数未接入本守卫）。命中即返回 true。
  function guardChoiceInProgress() {
    if (!isChoiceBlocking()) return false;
    showToast("请先完成当前抉择");
    return true;
  }

  // 放映进行中点顶栏「人物星图/舆图/关于/终章」或站标：轻提示并放弃本次切换，不打断放映；
  // 静音与「自动放映」按钮本身不受此限（各自的绑定未接入本守卫），「重新开始」则先停放映
  // 再走原有确认流程——否则会在沙盒态下清空真实存档。命中即返回 true。
  function guardAutoplay() {
    if (!window.SHY_AUTOPLAY || !window.SHY_AUTOPLAY.isRunning()) return false;
    showToast("放映中，按 Esc 退出");
    return true;
  }

  function bindTopBar() {
    bindMute();
    bindRestart();

    var graphBtn = document.getElementById("btn-graph");
    if (graphBtn) graphBtn.addEventListener("click", function () {
      if (guardAutoplay()) return;
      if (guardChoiceInProgress()) return;
      toggleView("graph");
    });

    var mapBtn = document.getElementById("btn-map");
    if (mapBtn) mapBtn.addEventListener("click", function () {
      if (guardAutoplay()) return;
      if (guardChoiceInProgress()) return;
      toggleView("map");
    });

    var aboutBtn = document.getElementById("btn-about");
    if (aboutBtn) aboutBtn.addEventListener("click", function () {
      if (guardAutoplay()) return;
      if (guardChoiceInProgress()) return;
      toggleView("about");
    });

    // 终章回看：通关后（state.finished）才显示，允许随时回访红色终章卷轴
    var endingBtn = document.getElementById("btn-ending");
    if (endingBtn) {
      endingBtn.addEventListener("click", function () {
        if (guardAutoplay()) return;
        if (guardChoiceInProgress()) return;
        if (window.SHY_ENDING && typeof window.SHY_ENDING.render === "function") window.SHY_ENDING.render();
        showView("ending");
      });
    }

    var appTitle = document.getElementById("app-title");
    if (appTitle) {
      appTitle.style.cursor = "pointer";
      appTitle.addEventListener("click", function () {
        if (guardAutoplay()) return;
        if (guardChoiceInProgress()) return;
        showView("scroll");
      });
    }

    var autoplayBtn = document.getElementById("btn-autoplay");
    if (autoplayBtn) {
      autoplayBtn.addEventListener("click", function () {
        if (!window.SHY_AUTOPLAY) return;
        if (window.SHY_AUTOPLAY.isRunning()) {
          // 放映进行中点本按钮 = 停止放映，任何时候都必须放行：放映自己的抉择幕也会让
          // #choice-view 可见，若像其余顶栏按钮那样无条件加 guardChoiceInProgress()，
          // 会在放映走到自己的抉择幕时把「停止放映」也拦下，观众将只能等到该幕结束或按
          // Esc（Esc 走的是 autoplay.js 捕获阶段的独立路径，不受此守卫影响）。
          window.SHY_AUTOPLAY.stop();
          return;
        }
        // 仅对"开始放映"设防：玩家正处于真实抉择（含其中打开的「走入历史」3D 会话——
        // walkin 覆盖层挂在 #choice-view 内，盖不住顶栏，此前点这里能在会话之上开播）时，
        // 与其余顶栏按钮一致，先挡下并提示，不允许在未完成的抉择之上开播。
        if (guardChoiceInProgress()) return;
        window.SHY_AUTOPLAY.promptAndStart();
      });
    }
  }

  // ------------------------- 关于页 -------------------------

  function renderAboutView() {
    var el = document.getElementById("about-view");
    if (!el || el.dataset.rendered === "1") return;
    el.dataset.rendered = "1";
    el.innerHTML =
      '<article class="about-article">' +
      '<button type="button" class="about-btn-back">← 返回</button>' +
      "<h2>关于《山河岁月》</h2>" +
      "<section><h3>数据口径</h3><p>本作品所呈现的历史节点、人物评价与事件表述，均以中学、大学通行的中国近代史教材叙述为基准，只呈现学界公认的主流结论。涉及敏感或存在历史争议的时期与人物，采用教科书「艰辛探索与曲折」的客观口径叙述，力求庄重、克制、功过分明，不作过度引申或猎奇化处理。</p></section>" +
      '<section><h3>图片说明</h3><p>受篇幅与版权所限，当前版本节点、人物图片暂缺，卡片中以"史料图片待补"占位纹样呈现，不影响文字内容的完整性。后续版本中，凡标注「AI 生成想象图」者为人工智能按史料描述生成的场景复原图，不代表真实历史影像；凡采用历史照片者，均会在 assets/images/CREDITS.md 中注明具体来源，确保来源可考、使用合规。</p></section>' +
      "<section><h3>抉择与计分</h3><p>每一处历史抉择均设有唯一正确选项，对应真实的历史走向（历史真实走向说明）；无论选择正确与否，剧情均严格按史实推进，绝不会因玩家的选择而改写——选择只影响个人得分与章节评级，历史本身不可更改。「史海钩沉」等延伸阅读首次展开可获得额外积分，鼓励深入了解史实细节。</p></section>" +
      '<section><h3>致谢</h3><p class="placeholder-hint">谨向治史立言的前辈学人，以及无数为民族独立、人民解放、国家富强而奋斗牺牲的先驱者致以敬意。（致谢名单留待后续版本补全）</p></section>' +
      '<section class="about-restart-row"><h3>重置进度</h3><p>如需清空当前存档、从头体验这段山河岁月，请使用页面右上角的「重新开始」按钮。此操作不可撤销，请谨慎使用。</p></section>' +
      "</article>";

    var backBtn = el.querySelector(".about-btn-back");
    if (backBtn) backBtn.addEventListener("click", navigateBack);
  }

  // ------------------------- 启动 -------------------------

  function newFallbackState() {
    return {
      unlockedCount: 1,
      total: 0,
      combo: 0,
      answered: {},
      readExtra: {},
      litPersons: [],
      chapterEarned: {},
      finished: false
    };
  }

  function init() {
    var loaded = window.SHY_SCORE && typeof window.SHY_SCORE.loadState === "function" ? window.SHY_SCORE.loadState() : null;
    SHY_APP.state =
      loaded || (window.SHY_SCORE && typeof window.SHY_SCORE.newState === "function" ? window.SHY_SCORE.newState() : newFallbackState());

    bindTopBar();

    if (window.SHY_SCROLL && typeof window.SHY_SCROLL.render === "function") {
      window.SHY_SCROLL.render(); // render() 内部会将横向滚动定位到当前节点
    }

    showView("scroll");
    refreshHud();
  }

  // 通关最后一个节点时，doUnlock() 派发本事件的调用栈通常嵌套在 choice.js 的
  // onContinueClick() 内部（末节点仍带抉择的常规情形）：dispatchEvent(shy:choice-done)
  // 同步触发 scroll.js 的 doUnlock() → 派发 shy:enter-ending → 若本监听器同步调用
  // showView('ending')，onContinueClick 紧接着（同一调用栈）执行的 showView('scroll')
  // 会把画面重新拉回长卷，盖掉刚显示的终章。用微任务把本监听器的实际动作推迟到当前调用栈
  // 结束之后，让终章视图"后到者赢"；微任务先于浏览器下一次渲染刷新，用户不会看到长卷闪现。
  document.addEventListener("shy:enter-ending", function () {
    Promise.resolve().then(function () {
      showView("ending");
      playAudioSafe("ending");
      refreshHud();
    });
  });

  init();
})();
