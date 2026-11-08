// js/map.js
// 《山河岁月》山河舆图：水墨矢量中国地图，按时间序标注已解锁事件与历史足迹。
// 提供 window.SHY_MAP = { render(), focus(eventId), refresh() }
// 消费 window.SHY_MAP_GEO（tools/gen-map.mjs 烘焙的几何）、window.SHY_MAP_PLACES（93 事件经纬度）、
//      window.SHY_APP.state.unlockedCount（只读，防剧透口径与长卷一致：idx < unlockedCount 可见）。
// 经纬度→SVG 坐标公式与 data/map-geo.js 文件头注释一致（伪墨卡托，运行时复现）。

(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var MARKER_R = 5.5;      // 普通事件朱砂圆点半径
  var CLIMAX_R = 8.5;      // 开国大典 e1401 特殊大标记半径
  var MIN_SCALE = 1;
  var MAX_SCALE = 4;
  var FOCUS_SCALE = 2.2;   // focus(eventId) 目标缩放
  var TRAIL_PERIOD = 24000; // 金色光点沿足迹线循环一周毫秒数
  var ENTER_STAGGER = 38;   // 进入动效事件点错峰落点毫秒数

  // 域外注记锚点（相对地图舞台的百分比 top；东京/纽约贴右缘，巴黎贴左缘，相互错开）
  var OFFSHORE_ANCHORS = {
    "东京": { side: "right", top: 30 },
    "纽约": { side: "right", top: 13 },
    "巴黎": { side: "left", top: 15 }
  };

  var built = false;   // DOM 外壳 + 底图仅初始化一次；render() 重复进入只 refresh + 重播进入动效
  var els = null;      // 缓存的 DOM 引用
  var view = { s: 1, tx: 0, ty: 0 }; // 内容 g 的平移缩放（缩放 1 时归位全景）
  var markerById = {}; // eventId -> { x, y, el, ev }
  var trailPath = null;
  var trailDot = null;
  var rafId = null;
  var drag = null;
  var suppressClick = false; // 拖拽结束后抑制紧随其后的 marker 点击
  var animTimers = [];       // 进入动效的延时清理句柄（refresh 时统一作废）

  // ------------------------- 工具函数 -------------------------

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function eventsList() {
    return (window.SHY_DATA && window.SHY_DATA.events) || [];
  }

  function getState() {
    return (window.SHY_APP && window.SHY_APP.state) || null;
  }

  function unlockedCount() {
    var state = getState();
    return state ? state.unlockedCount || 1 : 1;
  }

  function dataReady() {
    return !!(window.SHY_MAP_GEO && window.SHY_MAP_GEO.proj && window.SHY_MAP_PLACES);
  }

  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
    }
    if (parent) parent.appendChild(el);
    return el;
  }

  // 投影公式见 data/map-geo.js 文件头：merc(φ)=ln tan(π/4+φ/2)·180/π（φ 单位度）
  function merc(deg) {
    var rad = (deg * Math.PI) / 180;
    return (Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180) / Math.PI;
  }

  function project(lng, lat) {
    var p = window.SHY_MAP_GEO.proj;
    return { x: (lng - p.lng0) * p.K, y: (merc(p.lat0) - merc(lat)) * p.K };
  }

  function vb() {
    return window.SHY_MAP_GEO.viewBox;
  }

  function openEventSafe(eventId) {
    if (window.SHY_SCROLL && typeof window.SHY_SCROLL.openEvent === "function") {
      window.SHY_SCROLL.openEvent(eventId);
    }
  }

  function later(fn, ms) {
    animTimers.push(setTimeout(fn, ms));
  }

  function clearAnimTimers() {
    animTimers.forEach(clearTimeout);
    animTimers = [];
  }

  // ------------------------- 可见事件与同地分散 -------------------------

  // 已解锁（含域外）事件：数组顺序即全局时间序，与长卷 unlockedCount 口径一致
  function collectVisible() {
    var events = eventsList();
    var places = window.SHY_MAP_PLACES || {};
    var n = Math.min(unlockedCount(), events.length);
    var out = [];
    for (var i = 0; i < n; i++) {
      var ev = events[i];
      var pl = places[ev.id];
      if (!pl || !pl.geo) continue;
      out.push({ ev: ev, idx: i, place: pl });
    }
    return out;
  }

  // 同地多事件（坐标完全相同）分组均布：2 个左右错开；3+ 环形（>8 个双环）；
  // e1401 开国大典若在同地组内固定占据圆心。返回 eventId -> {x,y}。
  function layoutPositions(items) {
    var groups = {};
    items.forEach(function (it) {
      if (it.place.offshore) return;
      var p = project(it.place.geo[0], it.place.geo[1]);
      it.cx = p.x;
      it.cy = p.y;
      var key = p.x.toFixed(2) + "," + p.y.toFixed(2);
      (groups[key] = groups[key] || []).push(it);
    });
    var pos = {};
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      var cx = g[0].cx;
      var cy = g[0].cy;
      if (g.length === 1) {
        pos[g[0].ev.id] = { x: cx, y: cy };
        return;
      }
      var center = null;
      var rest = [];
      g.forEach(function (it) {
        if (it.ev.id === "e1401") center = it;
        else rest.push(it);
      });
      if (center) pos[center.ev.id] = { x: cx, y: cy };
      var n = rest.length;
      if (!n) return;
      if (!center && n === 2) {
        pos[rest[0].ev.id] = { x: cx - 8, y: cy };
        pos[rest[1].ev.id] = { x: cx + 8, y: cy };
        return;
      }
      if (n <= 8) {
        var r = 9 + n * 0.8;
        rest.forEach(function (it, i) {
          var a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          pos[it.ev.id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
        });
      } else {
        var inner = Math.ceil(n / 2);
        var outer = n - inner;
        rest.forEach(function (it, i) {
          var a, rr;
          if (i < inner) {
            a = -Math.PI / 2 + (i * 2 * Math.PI) / inner;
            rr = 11;
          } else {
            a = -Math.PI / 2 + ((i - inner) * 2 * Math.PI) / outer;
            rr = 20;
          }
          pos[it.ev.id] = { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) };
        });
      }
    });
    return pos;
  }

  // ------------------------- 底图 -------------------------

  // 竖排文字：以锚点为中心纵向均布各字；整体 clamp 在 viewBox 内（"南海"锚点贴近底边）
  function verticalText(parent, text, x, y, cls, step) {
    var t = svgEl("text", { "class": cls, "text-anchor": "middle" }, parent);
    var n = text.length;
    var H = vb().height;
    var startY = y - ((n - 1) * step) / 2;
    if (startY + (n - 1) * step > H - 6) startY = H - 6 - (n - 1) * step;
    if (startY < 12) startY = 12;
    for (var i = 0; i < n; i++) {
      var ts = svgEl("tspan", { x: x, y: startY + i * step }, t);
      ts.textContent = text.charAt(i);
    }
    return t;
  }

  function buildBase() {
    var GEO = window.SHY_MAP_GEO;
    var g = els.baseG;
    svgEl("path", { "class": "map-neighbors map-draw", d: GEO.neighbors }, g);
    svgEl("path", { "class": "map-china map-draw", d: GEO.china }, g);
    svgEl("path", { "class": "map-provinces map-draw", d: GEO.provinces }, g);
    if (GEO.rivers) {
      if (GEO.rivers.yellow) svgEl("path", { "class": "map-river map-draw", d: GEO.rivers.yellow }, g);
      if (GEO.rivers.yangtze) svgEl("path", { "class": "map-river map-draw", d: GEO.rivers.yangtze }, g);
    }
    (GEO.seas || []).forEach(function (s) {
      verticalText(g, s.name, s.x, s.y, "map-sea-label", 17);
    });
    // 河流名竖排注记（锚点数据已带上下偏移；字段缺失时跳过，兼容旧版 map-geo.js）
    (GEO.riverLabels || []).forEach(function (s) {
      verticalText(g, s.name, s.x, s.y, "map-river-label", 15);
    });
    var ss = GEO.southSea;
    if (ss) {
      var inset = svgEl("g", { "class": "map-inset" }, g);
      svgEl(
        "rect",
        { "class": "map-inset-frame", x: ss.frame[0], y: ss.frame[1], width: ss.frame[2], height: ss.frame[3], rx: 2 },
        inset
      );
      svgEl("path", { "class": "map-inset-dashes", d: ss.dashes }, inset);
      (ss.islands || []).forEach(function (pt) {
        svgEl("circle", { "class": "map-inset-island", cx: pt[0], cy: pt[1], r: 2 }, inset);
      });
      if (ss.label) {
        // 锚点上移 15，保证四字竖排整体落在附图框内
        verticalText(inset, ss.label.text, ss.label.x, ss.label.y - 15, "map-inset-label", 11.5);
      }
    }
  }

  // ------------------------- 事件标注 -------------------------

  function renderMarkers(items, positions) {
    els.markersG.innerHTML = "";
    markerById = {};
    var count = unlockedCount();
    var total = eventsList().length;
    items.forEach(function (it) {
      if (it.place.offshore) return;
      var p = positions[it.ev.id];
      if (!p) return;
      var isCurrent = count <= total && it.idx === count - 1;
      var isClimax = it.ev.id === "e1401";
      var isChoice = !!it.ev.choiceId;

      var g = svgEl("g", { "class": "map-marker", transform: "translate(" + p.x + " " + p.y + ")" }, els.markersG);
      g.classList.add(isCurrent ? "map-marker--current" : "map-marker--done");
      if (isClimax) g.classList.add("map-marker--climax");
      if (isChoice) g.classList.add("map-marker--choice");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", it.ev.title + (it.ev.dateText ? "（" + it.ev.dateText + "）" : ""));

      // 内层 g 承载进入动效 scale（CSS transform 会覆盖外层 translate 属性，故分层）
      var inner = svgEl("g", { "class": "map-marker-inner" }, g);
      inner.style.animationDelay = it.idx * ENTER_STAGGER + "ms";

      if (isCurrent) svgEl("circle", { "class": "map-marker-halo", r: MARKER_R + 4 }, inner);
      if (isClimax) svgEl("circle", { "class": "map-marker-ring", r: CLIMAX_R + 4.5 }, inner);

      if (isChoice) {
        svgEl("rect", { "class": "map-marker-shape", x: -5, y: -5, width: 10, height: 10 }, inner);
      } else {
        svgEl("circle", { "class": "map-marker-shape", r: isClimax ? CLIMAX_R : MARKER_R }, inner);
      }

      var ripple = svgEl("circle", { "class": "map-ripple", r: isClimax ? CLIMAX_R : MARKER_R }, inner);
      ripple.style.animationDelay = it.idx * ENTER_STAGGER + 120 + "ms";

      (function (eventId, ev) {
        g.addEventListener("mouseenter", function (e) {
          showTooltip(ev, e.clientX, e.clientY);
        });
        g.addEventListener("mousemove", function (e) {
          showTooltip(ev, e.clientX, e.clientY);
        });
        g.addEventListener("mouseleave", hideTooltip);
        g.addEventListener("click", function () {
          if (suppressClick) return;
          openEventSafe(eventId);
        });
        g.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openEventSafe(eventId);
          }
        });
      })(it.ev.id, it.ev);

      markerById[it.ev.id] = { x: p.x, y: p.y, el: g, ev: it.ev };
    });
  }

  // ------------------------- 历史足迹路线与光点 -------------------------

  function renderTrail(items, positions, animate) {
    els.trailG.innerHTML = "";
    trailPath = null;
    trailDot = null;
    var pts = [];
    items.forEach(function (it) {
      if (it.place.offshore) return;
      var p = positions[it.ev.id];
      if (p) pts.push(p);
    });
    if (pts.length < 2) return;
    var d =
      "M" +
      pts
        .map(function (p) {
          return p.x.toFixed(1) + " " + p.y.toFixed(1);
        })
        .join("L");
    trailPath = svgEl("path", { "class": "map-trail", d: d }, els.trailG);
    trailDot = svgEl("g", { "class": "map-trail-dot" }, els.trailG);
    svgEl("circle", { "class": "map-trail-dot-halo", r: 8 }, trailDot);
    svgEl("circle", { "class": "map-trail-dot-core", r: 3.2 }, trailDot);
    var pt0 = trailPath.getPointAtLength(0);
    trailDot.setAttribute("transform", "translate(" + pt0.x + " " + pt0.y + ")");

    if (animate) {
      // 足迹自绘：先全隐藏，进入动效中段（约 1s 后）开始 2.6s 内绘完
      var len = trailPath.getTotalLength();
      trailPath.style.strokeDasharray = String(len);
      trailPath.style.strokeDashoffset = String(len);
      later(function () {
        if (!trailPath) return;
        trailPath.style.transition = "stroke-dashoffset 2.6s cubic-bezier(0.22, 0.61, 0.36, 1)";
        trailPath.style.strokeDashoffset = "0";
      }, 1000);
      later(function () {
        if (!trailPath) return;
        trailPath.style.transition = "";
        trailPath.style.strokeDasharray = "";
        trailPath.style.strokeDashoffset = "";
      }, 3800);
    }
  }

  function startLoop() {
    if (rafId || !els) return;
    var tick = function () {
      rafId = window.requestAnimationFrame(tick);
      if (!trailPath || !trailDot) return;
      var len = trailPath.getTotalLength();
      if (!len) return;
      var t = (window.performance.now() % TRAIL_PERIOD) / TRAIL_PERIOD;
      var pt = trailPath.getPointAtLength(t * len);
      trailDot.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
    };
    tick();
  }

  function stopLoop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ------------------------- 域外注记 -------------------------

  function renderNotes(items) {
    els.notesWrap.innerHTML = "";
    var byCity = {};
    items.forEach(function (it) {
      if (!it.place.offshore) return;
      var city = it.place.short || "域外";
      (byCity[city] = byCity[city] || []).push(it);
    });
    Object.keys(byCity).forEach(function (city) {
      var anchor = OFFSHORE_ANCHORS[city] || { side: "right", top: 20 };
      byCity[city].forEach(function (it, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "map-note map-note--" + anchor.side;
        btn.style.top = anchor.top + i * 7.5 + "%";
        btn.innerHTML =
          '<span class="map-note-tag">域外 · ' + escapeHtml(city) + "</span>" +
          '<span class="map-note-title">' + escapeHtml(it.ev.title) + "</span>";
        btn.addEventListener("click", function () {
          openEventSafe(it.ev.id);
        });
        btn.addEventListener("mouseenter", function (e) {
          showTooltip(it.ev, e.clientX, e.clientY);
        });
        btn.addEventListener("mouseleave", hideTooltip);
        els.notesWrap.appendChild(btn);
      });
    });
  }

  // ------------------------- 提示卡 -------------------------

  function showTooltip(ev, clientX, clientY) {
    if (!els) return;
    var t = els.tooltip;
    t.innerHTML = "<strong>" + escapeHtml(ev.title) + "</strong><span>" + escapeHtml(ev.dateText || "") + "</span>";
    t.hidden = false;
    var stageRect = els.stage.getBoundingClientRect();
    var x = clientX - stageRect.left + 14;
    var y = clientY - stageRect.top - 12;
    if (x + t.offsetWidth > stageRect.width - 8) x = clientX - stageRect.left - t.offsetWidth - 14;
    if (y + t.offsetHeight > stageRect.height - 8) y = stageRect.height - t.offsetHeight - 8;
    if (y < 8) y = 8;
    t.style.left = x + "px";
    t.style.top = y + "px";
  }

  function hideTooltip() {
    if (els) els.tooltip.hidden = true;
  }

  // ------------------------- 平移缩放 -------------------------

  function clampView() {
    view.s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.s));
    var W = vb().width;
    var H = vb().height;
    view.tx = Math.min(0, Math.max(W - W * view.s, view.tx));
    view.ty = Math.min(0, Math.max(H - H * view.s, view.ty));
  }

  function applyTransform(animate) {
    clampView();
    var c = els.content;
    c.style.transition = animate ? "transform 480ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none";
    c.style.transform = "translate(" + view.tx + "px, " + view.ty + "px) scale(" + view.s + ")";
    var atFull = view.s === 1 && view.tx === 0 && view.ty === 0;
    els.resetBtn.hidden = atFull;
  }

  function resetView(animate) {
    view.s = 1;
    view.tx = 0;
    view.ty = 0;
    applyTransform(animate);
  }

  // 屏幕坐标 → SVG 用户坐标（preserveAspectRatio="xMidYMid meet"，需扣除两侧留白）
  function toSvgPoint(clientX, clientY) {
    var rect = els.svg.getBoundingClientRect();
    var W = vb().width;
    var H = vb().height;
    var scale = Math.min(rect.width / W, rect.height / H);
    var ox = rect.left + (rect.width - W * scale) / 2;
    var oy = rect.top + (rect.height - H * scale) / 2;
    return { x: (clientX - ox) / scale, y: (clientY - oy) / scale, pxPerUnit: scale };
  }

  function bindPanZoom() {
    var svg = els.svg;

    // 活动指针表：双指捏合需要同时知道两个触点的当前坐标。单指路径（drag）完全不读取
    // 这张表，行为不受影响；只有指针数达到 2 才会切入捏合分支。
    var pointers = new Map();
    var pinch = null; // { startDist, startScale }，仅双指同时按住期间非空

    function pinchDistance() {
      var pts = [];
      pointers.forEach(function (p) {
        pts.push(p);
      });
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    function pinchMidpoint() {
      var pts = [];
      pointers.forEach(function (p) {
        pts.push(p);
      });
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }

    svg.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        // 第二指落下：单指拖拽状态机让位给捏合，但绝不能顺手清掉 suppressClick——
        // 它此刻可能还是 false（第一指刚落下、还没动过），可双指本来就不是单指 tap，
        // 立刻标成 true 能防住「双指几乎不动就同时抬起」这种边界情况误触发 marker 点击。
        // 捏合结束后同一个 60ms 抑制窗口（见 endDrag）会负责把它落回 false。
        drag = null;
        suppressClick = true;
        pinch = { startDist: pinchDistance(), startScale: view.s };
        // 捏合没有「点击」顾虑（两指按下这件事本身就不可能是 marker 单指 tap），
        // 可以立即捕获两指，保证手指滑出 svg 可视区域时也不丢 move 事件——
        // 这点与单指拖拽故意延迟捕获（见下）恰恰相反，原因也在于此。
        pointers.forEach(function (p, id) {
          try {
            svg.setPointerCapture(id);
          } catch (err) {
            // 同下：某些环境不支持指针捕获
          }
        });
        return;
      }
      // 注意：不能在此处 setPointerCapture——捕获会把随后的 click 重定向到 svg，
      // marker 的点击（打开事件卡）将永远收不到。改为首次真正拖动时才捕获（见 pointermove）。
      drag = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, moved: false };
    });
    svg.addEventListener("pointermove", function (e) {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        var dist = pinchDistance();
        if (!dist || !pinch.startDist) return;
        var mid = pinchMidpoint();
        var pt = toSvgPoint(mid.x, mid.y);
        var old = view.s;
        var next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.startScale * (dist / pinch.startDist)));
        if (next !== old) {
          // 以两指中点为锚，公式与滚轮缩放完全一致：中点下的图面点保持不动，
          // 双指与鼠标滚轮两种输入手感统一（clampView 仍会在 applyTransform 里生效，
          // 越界时和滚轮缩放一样会有轻微修正，不是捏合独有的问题）。
          view.tx = pt.x - (pt.x - view.tx) * (next / old);
          view.ty = pt.y - (pt.y - view.ty) * (next / old);
          view.s = next;
          applyTransform(false);
        }
        suppressClick = true;
        return;
      }
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        try {
          svg.setPointerCapture(drag.pointerId);
        } catch (err) {
          // 某些环境（如旧浏览器/测试桩）不支持指针捕获，拖拽降级为按住有效
        }
      }
      var scale = toSvgPoint(e.clientX, e.clientY).pxPerUnit || 1;
      view.tx += dx / scale;
      view.ty += dy / scale;
      drag.x = e.clientX;
      drag.y = e.clientY;
      applyTransform(false);
    });
    var endDrag = function (e) {
      // pointercancel（如系统手势打断）与 pointerup 都走这里：必须把该指从指针表里
      // 摘掉，否则表里残留的「幽灵指针」会让后续单指手势被误判成还有第二指在场。
      if (e && e.pointerId != null) pointers.delete(e.pointerId);
      var wasPinching = !!pinch;
      if (pointers.size < 2) pinch = null;
      if ((drag && drag.moved) || suppressClick) {
        suppressClick = true;
        setTimeout(function () {
          suppressClick = false;
        }, 60);
      }
      drag = null;
      // 捏合中先松开一指、只剩一指留在台面上：直接把这一指接续为新的拖拽起点，
      // 否则用户得先完全松开再重新按下才能继续平移，体验会卡一下。这一指此前已经
      // 有过 pointerdown 了，之后不会再收到一次，只能在这里补起手（moved 仍从
      // false 起算，4px 阈值与延迟捕获两道安全阀照常生效，不会绕开 marker 点击保护）。
      if (wasPinching && pointers.size === 1) {
        pointers.forEach(function (p, id) {
          drag = { x: p.x, y: p.y, pointerId: id, moved: false };
        });
      }
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        var pt = toSvgPoint(e.clientX, e.clientY);
        var old = view.s;
        var next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, old * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
        if (next === old) return;
        // 以指针处为锚点缩放：指针下的图面点保持不动
        view.tx = pt.x - (pt.x - view.tx) * (next / old);
        view.ty = pt.y - (pt.y - view.ty) * (next / old);
        view.s = next;
        applyTransform(false);
      },
      { passive: false }
    );
    svg.addEventListener("dblclick", function () {
      resetView(true);
    });
  }

  // ------------------------- 进入动效 -------------------------

  function playEnter() {
    var stage = els.stage;
    stage.classList.remove("map-enter");
    void stage.offsetWidth; // 强制重排，保证重复进入时动画可重放
    stage.classList.add("map-enter");

    // 墨线自绘：底图各轮廓 dash 动画约 1s 内绘完
    var paths = els.baseG.querySelectorAll(".map-draw");
    paths.forEach(function (p) {
      var len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
    });
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        paths.forEach(function (p) {
          p.style.transition = "stroke-dashoffset 1s cubic-bezier(0.22, 0.61, 0.36, 1)";
          p.style.strokeDashoffset = "0";
        });
      });
    });
    later(function () {
      paths.forEach(function (p) {
        p.style.transition = "";
        p.style.strokeDasharray = "";
        p.style.strokeDashoffset = "";
      });
    }, 1400);
  }

  // ------------------------- 构建与刷新 -------------------------

  function build(viewEl) {
    viewEl.innerHTML = "";
    var shell = document.createElement("div");
    shell.className = "map-shell";
    shell.innerHTML =
      '<div class="map-hud">' +
      '<h2 class="map-title">山河舆图</h2>' +
      '<p class="map-subtitle"></p>' +
      "</div>";
    var stage = document.createElement("div");
    stage.className = "map-stage";

    var svg = svgEl("svg", {
      "class": "map-svg",
      viewBox: "0 0 " + vb().width + " " + vb().height,
      role: "img",
      "aria-label": "山河舆图：中国近代史事件地图"
    });
    var content = svgEl("g", { "class": "map-content" }, svg);
    var baseG = svgEl("g", { "class": "map-layer-base" }, content);
    var trailG = svgEl("g", { "class": "map-layer-trail" }, content);
    var markersG = svgEl("g", { "class": "map-layer-markers" }, content);
    stage.appendChild(svg);

    var notesWrap = document.createElement("div");
    notesWrap.className = "map-notes";
    stage.appendChild(notesWrap);

    var tooltip = document.createElement("div");
    tooltip.className = "map-tooltip";
    tooltip.hidden = true;
    stage.appendChild(tooltip);

    var legend = document.createElement("div");
    legend.className = "map-legend";
    legend.innerHTML =
      '<span><i class="lg-dot"></i>事件</span>' +
      '<span><i class="lg-diamond"></i>抉择</span>' +
      '<span><i class="lg-current"></i>当前位置</span>';
    stage.appendChild(legend);

    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "map-reset";
    resetBtn.textContent = "复位";
    resetBtn.hidden = true;
    resetBtn.addEventListener("click", function () {
      resetView(true);
    });
    stage.appendChild(resetBtn);

    shell.appendChild(stage);
    viewEl.appendChild(shell);

    els = {
      view: viewEl,
      shell: shell,
      stage: stage,
      svg: svg,
      content: content,
      baseG: baseG,
      trailG: trailG,
      markersG: markersG,
      notesWrap: notesWrap,
      tooltip: tooltip,
      subtitle: shell.querySelector(".map-subtitle"),
      resetBtn: resetBtn
    };

    buildBase();
    bindPanZoom();
  }

  // 存档变化后重算已解锁集合，重绘 marker 层 / 足迹线 / 域外注记（底图与视角不动）
  function refresh() {
    if (!built || !els || !dataReady()) return;
    clearAnimTimers();
    var items = collectVisible();
    var positions = layoutPositions(items);
    renderMarkers(items, positions);
    renderTrail(items, positions, false);
    renderNotes(items);
    var total = eventsList().length;
    els.subtitle.textContent = "史迹解锁进度：已解锁 " + Math.min(unlockedCount(), total) + " / " + total + " 处";
  }

  function render() {
    var viewEl = document.getElementById("map-view");
    if (!viewEl) return;
    if (!dataReady()) {
      built = false;
      els = null;
      viewEl.innerHTML = '<div class="map-missing">舆图数据缺失，请检查 data/map-geo.js 与 data/map-places.js</div>';
      return;
    }
    if (!built) {
      build(viewEl);
      built = true;
    }
    clearAnimTimers();
    var items = collectVisible();
    var positions = layoutPositions(items);
    renderMarkers(items, positions);
    renderTrail(items, positions, true);
    renderNotes(items);
    var total = eventsList().length;
    els.subtitle.textContent = "史迹解锁进度：已解锁 " + Math.min(unlockedCount(), total) + " / " + total + " 处";
    resetView(false);
    playEnter();
    startLoop();
  }

  // 事件卡跳入：平滑平移缩放至目标事件并播三圈金色同心圆；未解锁/无坐标（含域外）仅回全景
  function focus(eventId) {
    if (!dataReady()) return;
    if (!built) render();
    var m = markerById[eventId];
    if (!m) {
      resetView(true);
      return;
    }
    view.s = FOCUS_SCALE;
    view.tx = vb().width / 2 - m.x * FOCUS_SCALE;
    view.ty = vb().height / 2 - m.y * FOCUS_SCALE;
    applyTransform(true);
    for (var i = 0; i < 3; i++) {
      (function (idx) {
        var ring = svgEl("circle", { "class": "map-focus-ring", cx: m.x, cy: m.y, r: 10 }, els.markersG);
        ring.style.animationDelay = idx * 160 + "ms";
        setTimeout(function () {
          if (ring.parentNode) ring.parentNode.removeChild(ring);
        }, 1700);
      })(i);
    }
  }

  // rAF 光点与提示卡仅在舆图可见时存活：切走即停，切回由 render() 重启
  document.addEventListener("shy:view-changing", function (e) {
    if (!e || !e.detail) return;
    if (e.detail.to !== "map") {
      stopLoop();
      hideTooltip();
    }
  });

  window.SHY_MAP = {
    render: render,
    focus: focus,
    refresh: refresh
  };
})();
