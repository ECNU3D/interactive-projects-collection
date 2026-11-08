// js/scroll.js
// 《山河岁月》横向长卷渲染与节点推进。
// 提供 window.SHY_SCROLL = { render(), openEvent(eventId), advance() }
// 消费 window.SHY_DATA.*、window.SHY_SCORE.*、window.SHY_APP.state（由 app.js 先行赋值）。
// 产出自定义事件 shy:enter-choice / shy:enter-ending；监听 shy:choice-done。

(function () {
  "use strict";

  var CN_NUM = ["一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五"];

  var modalBackdrop = null;
  var modalRefs = null;
  var pendingChoiceIdx = null; // advance() 派发抉择后，等待 shy:choice-done 时暂存的事件全局序号

  // ------------------------- 工具函数 -------------------------

  function eventsList() {
    return (window.SHY_DATA && window.SHY_DATA.events) || [];
  }

  function chaptersList() {
    return (window.SHY_DATA && window.SHY_DATA.chapters) || [];
  }

  function getState() {
    return (window.SHY_APP && window.SHY_APP.state) || null;
  }

  function indexOfEvent(id) {
    var evs = eventsList();
    for (var i = 0; i < evs.length; i++) {
      if (evs[i].id === id) return i;
    }
    return -1;
  }

  function chapterById(id) {
    var chs = chaptersList();
    for (var i = 0; i < chs.length; i++) {
      if (chs[i].id === id) return chs[i];
    }
    return null;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function cssEscapeId(id) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(id);
    return String(id).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  // 判断 answered 条目是否已"确认"（玩家已看到 historyNote 并点了"继续前行"，见 choice.js
  // onContinueClick）。未作答（entry 为空）视为未确认；旧存档条目（本 fix 之前写入，无
  // confirmed 字段）视为已确认，避免被误判为"未完成"而回拉、重复阻塞 advance()。
  function isChoiceConfirmed(entry) {
    if (!entry) return false;
    return entry.confirmed !== false;
  }

  function scoreFromAnsweredEntry(entry) {
    // canonical 形状（Task 11 choice.js 定案，fix 后增补 confirmed 字段）：
    //   { firstTryCorrect: boolean, earned: number, tries: number, confirmed: boolean }
    // 仍防御式兼容纯数字 / {score} 等旧/异常写法，避免历史存档或异常数据导致评级崩溃。
    // 本函数只读取 earned，与 confirmed 无关（confirmed 的判断见 isChoiceConfirmed()）。
    if (entry == null) return 0;
    if (typeof entry === "number") return entry;
    if (typeof entry === "object") {
      if (typeof entry.earned === "number") return entry.earned;
      if (typeof entry.score === "number") return entry.score;
    }
    return 0;
  }

  function refreshHudSafe() {
    if (window.SHY_APP && typeof window.SHY_APP.refreshHud === "function") {
      window.SHY_APP.refreshHud();
    }
  }

  function saveStateSafe(state) {
    if (window.SHY_SCORE && typeof window.SHY_SCORE.saveState === "function") {
      window.SHY_SCORE.saveState(state);
    }
  }

  function playAudioSafe(name) {
    if (window.SHY_AUDIO && typeof window.SHY_AUDIO.play === "function") {
      window.SHY_AUDIO.play(name);
    }
  }

  // 语音解说（js/narration.js，可选依赖——文件缺失/脚本未加载时静默降级，不影响卷轴主流程）
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

  // 山河舆图（js/map.js，可选依赖）：解锁推进后同步重绘 marker 层与足迹线；未加载时静默跳过
  function refreshMapSafe() {
    if (window.SHY_MAP && typeof window.SHY_MAP.refresh === "function") {
      window.SHY_MAP.refresh();
    }
  }

  // ------------------------- 主题色注入 -------------------------

  function setTheme(chapter) {
    if (!chapter || !chapter.theme) return;
    var root = document.documentElement.style;
    root.setProperty("--c-primary", chapter.theme.primary);
    root.setProperty("--c-bg", chapter.theme.bg);
    root.setProperty("--c-accent", chapter.theme.accent);
  }

  function bindThemeSync(container) {
    var ticking = false;
    container.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          syncThemeToScroll(container);
          ticking = false;
        });
      },
      { passive: true }
    );
  }

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

  function syncThemeToScroll(container) {
    var sections = container.querySelectorAll(".chapter-section");
    if (!sections.length) return;
    var containerRect = container.getBoundingClientRect();
    var viewportCenter = containerRect.left + container.clientWidth / 2;
    var closest = null;
    var closestDist = Infinity;
    sections.forEach(function (sec) {
      var rect = sec.getBoundingClientRect();
      var center = rect.left + rect.width / 2;
      var dist = Math.abs(center - viewportCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = sec;
      }
    });
    if (closest) setTheme(chapterById(closest.dataset.chapterId));
  }

  // ------------------------- 长卷渲染 -------------------------

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

  function render() {
    var container = document.getElementById("scroll-view");
    if (!container) return;
    var events = eventsList();
    var chapters = chaptersList();
    if (!events.length || !chapters.length) return;

    container.innerHTML = "";
    var track = document.createElement("div");
    track.className = "scroll-track";

    var byChapter = {};
    events.forEach(function (e, idx) {
      (byChapter[e.chapterId] = byChapter[e.chapterId] || []).push({ ev: e, idx: idx });
    });

    var sortedChapters = chapters.slice().sort(function (a, b) {
      return a.order - b.order;
    });
    sortedChapters.forEach(function (ch) {
      track.appendChild(buildChapterSection(ch, byChapter[ch.id] || []));
    });
    track.appendChild(buildRuler(sortedChapters, byChapter));

    container.appendChild(track);
    ensureModal();
    applyNodeStates();

    lastBreakpoint = currentBreakpoint();
    if (!container.dataset.shyBound) {
      container.dataset.shyBound = "1";
      bindThemeSync(container);
      bindDragScroll(container);
      bindBreakpointReflow();
    }

    scrollToCurrentNode(false);
  }

  function buildChapterSection(chapter, list) {
    var section = document.createElement("section");
    section.className = "chapter-section";
    section.dataset.chapterId = chapter.id;
    section.style.minWidth = chapterMinWidth(list.length) + "px";

    var watermark = document.createElement("div");
    watermark.className = "chapter-year-watermark";
    watermark.setAttribute("aria-hidden", "true");
    watermark.textContent = chapter.startYear + "—" + chapter.endYear;
    section.appendChild(watermark);

    var titleBlock = document.createElement("div");
    titleBlock.className = "chapter-title-block";
    titleBlock.innerHTML =
      '<div class="chapter-seal">' + escapeHtml(CN_NUM[chapter.order - 1] || String(chapter.order)) + "</div>" +
      '<h2 class="chapter-title-vertical">' + escapeHtml(chapter.title) + "</h2>" +
      '<p class="chapter-subtitle-vertical">' + escapeHtml(chapter.subtitle || "") + "</p>" +
      '<p class="chapter-years">' + chapter.startYear + "—" + chapter.endYear + "</p>" +
      '<div class="chapter-grade-seal" hidden></div>';
    section.appendChild(titleBlock);

    var timeline = document.createElement("div");
    timeline.className = "timeline";

    var river = document.createElement("div");
    river.className = "timeline-river";
    timeline.appendChild(river);

    var nodesWrap = document.createElement("div");
    nodesWrap.className = "timeline-nodes";
    nodesWrap.appendChild(buildIntroCard(chapter));
    list.forEach(function (item, i) {
      nodesWrap.appendChild(buildNode(item.ev, item.idx, i));
    });
    timeline.appendChild(nodesWrap);

    section.appendChild(timeline);
    return section;
  }

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
        // 必须插进 .chapter-intro-body 内部而不是当 card 的兄弟：card 是 display:flex 横向
        // 排列，插成兄弟会让 width:100% 变成 flex-basis 与印章、正文三方竞争，缩略图被压成
        // 十几像素宽的细条（实测桌面 20×11px、手机 9×5px）。body 是普通 block、纵向流，
        // 放进去才能按 16:9 正常铺开。位置选在 head 之后：副标题与 ▶ 按钮先立住，缩略图
        // 紧贴按钮下方作为"有片可看"的线索，再接引言正文。
        var body = card.querySelector(".chapter-intro-body");
        var head = card.querySelector(".chapter-intro-head");
        if (body && head && head.nextSibling) body.insertBefore(thumbWrap, head.nextSibling);
        else if (body) body.appendChild(thumbWrap);
      }).catch(function () {
        // probeAvailable 目前保证不 reject（js/chapterfilm.js 内部吞掉探测失败），但那是
        // 跨文件的隐性契约；这里补一层兜底，避免万一违约时抛出未处理的 rejection。
      });
    }

    return card;
  }

  function buildNode(ev, globalIdx, posInChapter) {
    var wrap = document.createElement("div");
    wrap.className = "node-wrap " + (posInChapter % 2 === 0 ? "label-below" : "label-above");
    if (ev.id === "e1401") wrap.classList.add("node-climax");
    wrap.dataset.eventId = ev.id;
    wrap.dataset.globalIndex = String(globalIdx);

    // 细短垂直连接线（tick）：从轴线本体连向标签，标签本身与轴线保持≥16px间距（见CSS）。
    var tick = document.createElement("span");
    tick.className = "node-tick";
    wrap.appendChild(tick);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "node " + (ev.choiceId ? "node--choice" : "node--circle");
    btn.setAttribute("aria-label", ev.title + (ev.dateText ? "（" + ev.dateText + "）" : ""));
    btn.addEventListener("click", function () {
      openEvent(ev.id);
    });
    wrap.appendChild(btn);

    var label = document.createElement("span");
    label.className = "node-label";
    label.innerHTML =
      escapeHtml(ev.title) + '<span class="node-label-date">' + escapeHtml(ev.dateText || "") + "</span>";
    wrap.appendChild(label);

    // 已完成节点若该事件有配图：节点旁44px圆形小缩略图，置于与标签相对的一侧（label-below→
    // 缩略图在上，label-above→缩略图在下），避免与标签同侧挤占；可见性由 applyNodeStates()
    // 依据 node--done 状态经 .node-wrap--done 切换，懒加载，加载失败即整块移除不留破图。
    // 视频事件（image 为 .mp4/.webm）缩略图改用 imagePoster 封面图。
    if (ev.image) {
      var thumbWrap = document.createElement("span");
      thumbWrap.className = "node-thumb-wrap";
      var thumb = document.createElement("img");
      thumb.className = "node-thumb";
      thumb.src = ev.imagePoster || ev.image;
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.addEventListener("error", function () {
        if (thumbWrap.parentNode) thumbWrap.parentNode.removeChild(thumbWrap);
      });
      thumbWrap.appendChild(thumb);
      wrap.appendChild(thumbWrap);
    }

    return wrap;
  }

  // ------------------------- 年表刻度尺（章节段落底部，随卷轴同容器滚动） -------------------------

  function buildRuler(sortedChapters, byChapter) {
    var ruler = document.createElement("div");
    ruler.className = "scroll-ruler";
    ruler.setAttribute("aria-hidden", "true");
    sortedChapters.forEach(function (ch) {
      var count = (byChapter[ch.id] || []).length;
      var width = chapterMinWidth(count);
      var seg = document.createElement("div");
      seg.className = "ruler-segment";
      seg.style.width = width + "px";

      var span = Math.max(ch.endYear - ch.startYear, 1);
      var startTick = Math.ceil(ch.startYear / 10) * 10;
      var hasDecade = false;
      for (var y = startTick; y <= ch.endYear; y += 10) {
        hasDecade = true;
        var pct = ((y - ch.startYear) / span) * 100;
        seg.appendChild(buildRulerMark(pct, y));
      }
      if (!hasDecade) {
        // 章节跨度不足10年（如戊戌变法单年）：仍标出起始年份，避免该章刻度带空白
        seg.appendChild(buildRulerMark(0, ch.startYear));
      }
      // 逐年细刻度：repeating-linear-gradient 一次性绘制，避免年跨度大的章节生成过多DOM节点
      var yearPx = width / span;
      if (yearPx > 4) {
        seg.style.backgroundImage =
          "repeating-linear-gradient(90deg, rgba(42,35,26,0.24) 0, rgba(42,35,26,0.24) 1px, transparent 1px, transparent " +
          yearPx +
          "px)";
      }
      ruler.appendChild(seg);
    });
    return ruler;
  }

  function buildRulerMark(pct, year) {
    var mark = document.createElement("div");
    mark.className = "ruler-mark";
    mark.style.left = pct + "%";
    mark.innerHTML = '<span class="ruler-mark-line"></span><span class="ruler-mark-label">' + year + "</span>";
    return mark;
  }

  function applyNodeStates() {
    var state = getState() || { unlockedCount: 1 };
    var wraps = document.querySelectorAll(".node-wrap");
    wraps.forEach(function (w) {
      var idx = parseInt(w.dataset.globalIndex, 10);
      var btn = w.querySelector(".node");
      if (!btn) return;
      btn.classList.remove("node--locked", "node--current", "node--done");
      var isDone = idx < state.unlockedCount - 1;
      if (isDone) {
        btn.classList.add("node--done");
        btn.disabled = false;
      } else if (idx === state.unlockedCount - 1) {
        btn.classList.add("node--current");
        btn.disabled = false;
      } else {
        btn.classList.add("node--locked");
        btn.disabled = true;
      }
      w.classList.toggle("node-wrap--done", isDone);
    });
    applyChapterGradeSeals(state);
    updateRiverGradients();
  }

  // 轴线本体质感：按该章节点完成度分段着色（已完成红→当前金→未来灰），两端渐隐为透明，
  // 随 applyNodeStates() 每次状态变化（推进/刷新）重新计算，覆盖CSS静态渐变的内联样式。
  function updateRiverGradients() {
    var sections = document.querySelectorAll(".chapter-section");
    sections.forEach(function (sec) {
      var river = sec.querySelector(".timeline-river");
      if (!river) return;
      var btns = sec.querySelectorAll(".node-wrap .node");
      var total = btns.length;
      if (!total) return;
      var done = 0, hasCurrent = false, currentIdx = -1;
      btns.forEach(function (b, i) {
        if (b.classList.contains("node--done")) done++;
        if (b.classList.contains("node--current")) {
          hasCurrent = true;
          currentIdx = i;
        }
      });
      var donePct = (done / total) * 100;
      var curPct = hasCurrent ? ((currentIdx + 1) / total) * 100 : donePct;
      river.style.background = buildRiverGradient(donePct, curPct);
    });
  }

  function buildRiverGradient(donePct, curPct) {
    var stops = [];
    function push(pct, color) {
      pct = Math.max(0, Math.min(100, pct));
      if (stops.length && pct < stops[stops.length - 1].pct) pct = stops[stops.length - 1].pct;
      stops.push({ pct: pct, color: color });
    }
    push(0, "transparent");
    push(3, "var(--c-vermilion)");
    push(donePct, "var(--c-vermilion)");
    push(donePct, "var(--c-gold)");
    var curEnd = Math.max(curPct, donePct);
    push(curEnd, "var(--c-gold)");
    push(curEnd, "var(--c-locked)");
    push(97, "var(--c-locked)");
    push(100, "transparent");
    return (
      "linear-gradient(90deg, " +
      stops
        .map(function (s) {
          return s.color + " " + s.pct + "%";
        })
        .join(", ") +
      ")"
    );
  }

  // 已完成章节在标题旁盖评级印章（甲/乙/丙）；HUD 的 lastGradedChapter 角标之外的第二处呈现，
  // 使评级不必等到"当前前沿事件"恰好回到本章才可见（前沿在 doUnlock() 中已推进到下一章）。
  function applyChapterGradeSeals(state) {
    state = state || getState();
    var earned = (state && state.chapterEarned) || {};
    var sections = document.querySelectorAll(".chapter-section");
    sections.forEach(function (sec) {
      var seal = sec.querySelector(".chapter-grade-seal");
      if (!seal) return;
      var grade = earned[sec.dataset.chapterId];
      if (grade) {
        seal.textContent = grade;
        seal.hidden = false;
        seal.setAttribute("aria-label", "本章评级：" + grade);
      } else {
        seal.textContent = "";
        seal.hidden = true;
        seal.removeAttribute("aria-label");
      }
    });
  }

  // ------------------------- 事件卡片 Modal -------------------------

  function ensureModal() {
    if (modalBackdrop) return;
    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.setAttribute("aria-hidden", "true");

    var card = document.createElement("div");
    card.className = "event-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.innerHTML =
      '<button type="button" class="card-close" aria-label="关闭">×</button>' +
      '<div class="card-banner"></div>' +
      '<div class="card-image-wrap"></div>' +
      '<div class="card-header">' +
      '<div class="card-title-row">' +
      '<h3 class="card-title"></h3>' +
      '<div class="card-voice-controls">' +
      '<button type="button" class="card-voice-btn card-voice-replay" aria-label="重播解说" title="重播解说">⟲</button>' +
      '<button type="button" class="card-voice-btn card-voice-stop" aria-label="停止解说" title="停止解说">▮</button>' +
      "</div>" +
      "</div>" +
      '<p class="card-meta"></p>' +
      '<p class="card-choice-status" hidden></p>' +
      "</div>" +
      '<div class="card-body">' +
      '<p class="card-summary"></p>' +
      '<div class="card-significance"><h4>历史意义</h4><p class="card-significance-text"></p></div>' +
      '<details class="card-extra"><summary>史海钩沉<span class="card-extra-earned" hidden>+10 已计入</span></summary><div class="card-extra-body"></div></details>' +
      '<div class="card-persons"></div>' +
      "</div>" +
      '<div class="card-footer"></div>';

    modalBackdrop.appendChild(card);
    document.body.appendChild(modalBackdrop);

    modalRefs = {
      card: card,
      banner: card.querySelector(".card-banner"),
      imageWrap: card.querySelector(".card-image-wrap"),
      title: card.querySelector(".card-title"),
      meta: card.querySelector(".card-meta"),
      summary: card.querySelector(".card-summary"),
      significance: card.querySelector(".card-significance-text"),
      extra: card.querySelector(".card-extra"),
      extraBody: card.querySelector(".card-extra-body"),
      extraEarnedTag: card.querySelector(".card-extra-earned"),
      persons: card.querySelector(".card-persons"),
      footer: card.querySelector(".card-footer"),
      closeBtn: card.querySelector(".card-close"),
      choiceStatus: card.querySelector(".card-choice-status"),
      voiceReplayBtn: card.querySelector(".card-voice-replay"),
      voiceStopBtn: card.querySelector(".card-voice-stop")
    };

    modalRefs.closeBtn.addEventListener("click", hideModal);
    modalRefs.voiceReplayBtn.addEventListener("click", replayVoiceSafe);
    modalRefs.voiceStopBtn.addEventListener("click", stopVoiceSafe);
    modalBackdrop.addEventListener("click", function (e) {
      if (e.target === modalBackdrop) hideModal();
    });
    // 事件卡挂在 document.body（非 #scroll-view 内），视图切换不会自动隐藏它；从卷轴切到
    // 其他任何视图时兜底关闭，避免卡片悬浮遮在 graph/about/ending 之上（P3 导航栈排查项）。
    // 经由 chip 跳转的场景已在 jumpToGraph 中显式 hideModal()，这里再次调用是幂等安全的。
    document.addEventListener("shy:view-changing", function (e) {
      if (e && e.detail && e.detail.to !== "scroll") hideModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalBackdrop.classList.contains("is-open")) hideModal();
    });

    modalRefs.extra.addEventListener("toggle", function () {
      if (!modalRefs.extra.open) return;
      var id = modalRefs.extra.dataset.eventId;
      var state = getState();
      if (!id || !state) return;
      state.readExtra = state.readExtra || {};
      if (!state.readExtra[id]) {
        state.readExtra[id] = true;
        var extraPoints = window.SHY_SCORE ? window.SHY_SCORE.EXTRA : 10;
        state.total = (state.total || 0) + extraPoints;
        saveStateSafe(state);
        refreshHudSafe();
      }
      if (modalRefs.extraEarnedTag) modalRefs.extraEarnedTag.hidden = false;
    });
  }

  // event.image 非 null → 渲染史料照片 + 图注；加载失败（onerror）或 image 为 null → 占位纹样。
  // image 以 .mp4/.webm 结尾时渲染 <video>（imagePoster 作封面），其余按图片处理。
  function renderCardImage(ev) {
    modalRefs.imageWrap.innerHTML = "";
    if (!ev.image) {
      modalRefs.imageWrap.innerHTML = '<div class="card-image-placeholder">暂无同期影像</div>';
      return;
    }
    var media;
    if (/\.(mp4|webm)$/i.test(ev.image)) {
      media = document.createElement("video");
      media.className = "card-image";
      media.src = ev.image;
      media.controls = true;
      media.playsInline = true;
      media.preload = "metadata";
      if (ev.imagePoster) media.poster = ev.imagePoster;
    } else {
      media = document.createElement("img");
      media.className = "card-image";
      media.src = ev.image;
      media.alt = ev.title || "";
      media.loading = "lazy";
    }
    media.addEventListener("error", function () {
      modalRefs.imageWrap.innerHTML = '<div class="card-image-placeholder">暂无同期影像</div>';
    });
    modalRefs.imageWrap.appendChild(media);
    if (ev.imageCredit) {
      var credit = document.createElement("p");
      credit.className = "card-image-credit";
      credit.textContent = ev.imageCredit;
      modalRefs.imageWrap.appendChild(credit);
    }
  }

  function populateModal(ev, idx, state) {
    ensureModal();
    var isClimax = ev.id === "e1401";
    modalRefs.card.classList.toggle("event-card--climax", isClimax);
    modalRefs.banner.textContent = isClimax ? "开 国 大 典" : "";
    renderCardImage(ev);
    modalRefs.title.textContent = ev.title;
    // 地点渲染为「查看舆图」入口：点击关卡、切 map-view 并聚焦本事件（导航栈记录来处可返回）
    modalRefs.meta.textContent = "";
    modalRefs.meta.appendChild(document.createTextNode(ev.dateText || ""));
    if (ev.place) {
      modalRefs.meta.appendChild(document.createTextNode(" · "));
      var placeBtn = document.createElement("button");
      placeBtn.type = "button";
      placeBtn.className = "card-meta-place";
      placeBtn.textContent = "📍 " + ev.place + " · 查看舆图";
      placeBtn.addEventListener("click", function () {
        if (!window.SHY_MAP || typeof window.SHY_MAP.focus !== "function") return;
        hideModal();
        if (window.SHY_APP && typeof window.SHY_APP.showView === "function") {
          window.SHY_APP.showView("map", { from: { view: "scroll", eventId: ev.id } });
        }
        window.SHY_MAP.focus(ev.id);
      });
      modalRefs.meta.appendChild(placeBtn);
    }
    modalRefs.summary.textContent = ev.summary || "";
    modalRefs.significance.textContent = ev.significance || "";
    modalRefs.extraBody.textContent = ev.extra || "";
    modalRefs.extra.open = false;
    modalRefs.extra.dataset.eventId = ev.id;
    modalRefs.extraEarnedTag.hidden = !(state.readExtra && state.readExtra[ev.id]);

    // 已作答的抉择点：重进节点卡片时以简单文案提示得分，不重复计分（计分逻辑在 choice.js，
    // 本处仅只读展示 state.answered[ev.choiceId] 已写入的 earned）
    var answeredEntry = ev.choiceId && state.answered ? state.answered[ev.choiceId] : null;
    if (answeredEntry) {
      modalRefs.choiceStatus.textContent = "已作答 · 得分 " + scoreFromAnsweredEntry(answeredEntry);
      modalRefs.choiceStatus.hidden = false;
    } else {
      modalRefs.choiceStatus.hidden = true;
    }

    modalRefs.persons.innerHTML = "";
    var persons = (window.SHY_DATA && window.SHY_DATA.persons) || [];
    (ev.personIds || []).forEach(function (pid) {
      var p = null;
      for (var i = 0; i < persons.length; i++) {
        if (persons[i].id === pid) { p = persons[i]; break; }
      }
      if (!p) return;
      var chip = document.createElement("div");
      chip.className = "person-chip person-chip--clickable";
      chip.setAttribute("role", "button");
      chip.tabIndex = 0;
      chip.setAttribute("aria-label", "在人物星图中查看" + (p.name || ""));

      // person.image 非 null → 圆形小头像（object-fit: cover）；加载失败或 null → 姓名首字印章。
      var avatar;
      if (p.image) {
        avatar = document.createElement("img");
        avatar.className = "person-avatar person-avatar--photo";
        avatar.src = p.image;
        avatar.alt = p.name || "";
        avatar.loading = "lazy";
        avatar.addEventListener("error", function () {
          var seal = document.createElement("span");
          seal.className = "person-avatar";
          seal.textContent = (p.name || "?").charAt(0);
          if (avatar.parentNode) avatar.parentNode.replaceChild(seal, avatar);
        });
      } else {
        avatar = document.createElement("span");
        avatar.className = "person-avatar";
        avatar.textContent = (p.name || "?").charAt(0);
      }
      var nameSpan = document.createElement("span");
      nameSpan.className = "person-name";
      nameSpan.textContent = p.name || "";
      chip.appendChild(avatar);
      chip.appendChild(nameSpan);
      // 人物头像点击 → 跳转人物知识星图并高亮该人物（Task 12 SHY_GRAPH.focus 契约）。
      // 携带 origin {view:'scroll', eventId}（P3 导航栈）：星图「返回」据此回到本卷轴并
      // 重新打开当前这张事件卡，避免"进星图→返回→事件卡没了"的上下文丢失。
      var jumpToGraph = function () {
        hideModal();
        if (window.SHY_APP && typeof window.SHY_APP.showView === "function") {
          window.SHY_APP.showView("graph", { from: { view: "scroll", eventId: ev.id } });
        }
        if (window.SHY_GRAPH && typeof window.SHY_GRAPH.focus === "function") window.SHY_GRAPH.focus(pid);
      };
      chip.addEventListener("click", jumpToGraph);
      chip.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jumpToGraph(); }
      });
      modalRefs.persons.appendChild(chip);
    });

    modalRefs.footer.innerHTML = "";
    var isFrontier = idx === state.unlockedCount - 1;
    if (isFrontier) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-continue";
      btn.textContent = "继续前行";
      btn.addEventListener("click", function () {
        hideModal();
        advance();
      });
      modalRefs.footer.appendChild(btn);
    } else {
      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "btn-close-text";
      closeBtn.textContent = "合上卷轴";
      closeBtn.addEventListener("click", hideModal);
      modalRefs.footer.appendChild(closeBtn);
    }
  }

  function showModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.add("is-open");
    modalBackdrop.setAttribute("aria-hidden", "false");
  }

  function hideModal() {
    if (!modalBackdrop) return;
    stopVoiceSafe(); // 关卡（含继续前行、Esc、遮罩点击、跨视图兜底关闭）统一停止解说
    modalBackdrop.classList.remove("is-open");
    modalBackdrop.setAttribute("aria-hidden", "true");
  }

  // ------------------------- 打开节点 -------------------------

  function openEvent(eventId) {
    var idx = indexOfEvent(eventId);
    if (idx < 0) return;
    var state = getState();
    if (!state) return;
    if (idx >= state.unlockedCount) return; // 未解锁，忽略点击

    var ev = eventsList()[idx];
    var changed = false;
    state.litPersons = state.litPersons || [];
    (ev.personIds || []).forEach(function (pid) {
      if (state.litPersons.indexOf(pid) === -1) {
        state.litPersons.push(pid);
        changed = true;
      }
    });
    if (changed) saveStateSafe(state);

    playAudioSafe("page"); // 打开卡片 = 翻开一页史卷
    populateModal(ev, idx, state);
    showModal();
    playVoiceForSafe(ev.id); // 事件卡打开即自动播放本节点语音解说（文件缺失静默降级）
  }

  // ------------------------- 章节评级 -------------------------

  function finalizeChapterGrade(chapterId, state) {
    if (!window.SHY_SCORE) return;
    var events = eventsList();
    var choices = (window.SHY_DATA && window.SHY_DATA.choices) || [];
    var inChapter = {};
    events.forEach(function (e) {
      if (e.chapterId === chapterId) inChapter[e.id] = true;
    });
    var relevant = choices.filter(function (c) {
      return inChapter[c.eventId];
    });
    var possible = relevant.length * window.SHY_SCORE.BASE_CORRECT;
    var earned = 0;
    relevant.forEach(function (c) {
      earned += scoreFromAnsweredEntry(state.answered ? state.answered[c.id] : null);
    });
    state.chapterEarned = state.chapterEarned || {};
    state.chapterEarned[chapterId] = window.SHY_SCORE.chapterGrade(earned, possible);
    // 指针指向"最近一次被评级的章"，供 HUD 展示——doUnlock() 紧接着会把前沿推进到下一章，
    // 若仍按"当前前沿事件所在章"去查 chapterEarned 会永远查不到刚写入的评级。
    state.lastGradedChapter = chapterId;
  }

  // ------------------------- 滚动定位 -------------------------

  function scrollToNode(eventId, smooth) {
    var container = document.getElementById("scroll-view");
    var wrap = document.querySelector('.node-wrap[data-event-id="' + cssEscapeId(eventId) + '"]');
    if (!container || !wrap) return;
    var containerRect = container.getBoundingClientRect();
    var wrapRect = wrap.getBoundingClientRect();
    var targetLeft =
      container.scrollLeft + (wrapRect.left - containerRect.left) - container.clientWidth / 2 + wrapRect.width / 2;
    // #scroll-view 带全局 scroll-behavior:smooth（css/main.css 3 节）。scrollTo() 的
    // behavior:"auto" 按 CSSOM View 规范是"听 CSS 的 scroll-behavior 决定"，不是"强制瞬跳"
    // ——smooth=false 想要的其实是瞬跳，若不额外处理，仍会被 CSS 的 smooth 接管、播出一段
    // 动画。跨断点重渲染（bindBreakpointReflow -> render() -> scrollToCurrentNode(false)）正是
    // 靠 smooth=false 表达"这不是玩家推进节点，是重排后把阅读位置带回原处，应当瞬时完成"，
    // 结果因为这条规范细节失效，每次转屏都能看到长卷平滑滚过、主题色被逐章刷过去。修法：
    // smooth 为 false 时临时用内联样式把 scroll-behavior 压成 auto（内联样式优先级高于任何
    // 无 !important 的样式表规则），scrollTo 完成后立即恢复原来的内联值（通常是空字符串，
    // 即“未设置”，交还给样式表决定）——这与本文件已有的 .is-drag-scrolling
    // { scroll-behavior: auto }（拖拽场景）以及 tools/responsive-check.mjs 里
    // setupScript() 对 #scroll-view 的同款内联覆盖，是同一个技巧的另一处应用。smooth 为
    // true（如 advance() 推进新解锁节点）时完全不碰这条属性，沿用 CSS 的平滑滚动，不受影响。
    if (smooth) {
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
      return;
    }
    var prevInlineBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = "auto";
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "auto" });
    container.style.scrollBehavior = prevInlineBehavior;
  }

  function scrollToCurrentNode(smooth) {
    var state = getState();
    if (!state) return;
    var events = eventsList();
    if (!events.length) return;
    var idx = Math.min(Math.max(state.unlockedCount - 1, 0), events.length - 1);
    var ev = events[idx];
    if (!ev) return;
    setTheme(chapterById(ev.chapterId));
    window.requestAnimationFrame(function () {
      scrollToNode(ev.id, smooth);
    });
  }

  // ------------------------- 推进流程 -------------------------

  function advance() {
    var state = getState();
    if (!state) return;
    var events = eventsList();
    var idx = state.unlockedCount - 1;
    var ev = events[idx];
    if (!ev) return;

    state.answered = state.answered || {};
    if (ev.choiceId && !isChoiceConfirmed(state.answered[ev.choiceId])) {
      // 抉择点且未"确认"（未答过，或已计分但玩家在点"继续前行"前离开/刷新）：交给
      // choice.js 处理——未答过展示完整抉择流程，已计分未确认则展示简化回顾视图
      // （见 choice.js renderAnsweredReplay），收到 shy:choice-done 后再解锁。
      pendingChoiceIdx = idx;
      document.dispatchEvent(new CustomEvent("shy:enter-choice", { detail: { choiceId: ev.choiceId } }));
      return;
    }
    doUnlock(idx);
  }

  document.addEventListener("shy:choice-done", function () {
    var state = getState();
    if (!state) return;
    var idx = pendingChoiceIdx != null ? pendingChoiceIdx : state.unlockedCount - 1;
    pendingChoiceIdx = null;
    doUnlock(idx);
  });

  function doUnlock(idx) {
    var state = getState();
    var events = eventsList();
    if (!state) return;
    var ev = events[idx];
    if (!ev) return;

    var nextEv = events[idx + 1];
    var chapterChanges = !nextEv || nextEv.chapterId !== ev.chapterId;
    if (chapterChanges) finalizeChapterGrade(ev.chapterId, state);

    var isLastEvent = idx === events.length - 1;
    if (isLastEvent) {
      // +1（而非等于 events.length）：与"前沿下标 = unlockedCount - 1"的既定约定保持一致，
      // 否则最后一个节点的下标会一直等于 unlockedCount - 1，被 applyNodeStates() 永远判成
      // node--current（鎏金呼吸态），通关后应与其余已完成节点一样呈 node--done（朱红）。
      state.unlockedCount = events.length + 1;
      state.finished = true;
      saveStateSafe(state);
      applyNodeStates();
      refreshHudSafe();
      refreshMapSafe();
      document.dispatchEvent(new CustomEvent("shy:enter-ending"));
      return;
    }

    state.unlockedCount = idx + 2; // unlockedCount + 1
    saveStateSafe(state);
    playAudioSafe("unlock"); // 常规解锁下一节点；终章的专属音效在 shy:enter-ending 监听处播放（见上方 isLastEvent 分支）
    applyNodeStates();
    if (nextEv) setTheme(chapterById(nextEv.chapterId));
    scrollToNode(nextEv ? nextEv.id : ev.id, true);
    refreshHudSafe();
    refreshMapSafe();
  }

  window.SHY_SCROLL = {
    render: render,
    openEvent: openEvent,
    advance: advance
  };
})();
