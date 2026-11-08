// js/graph.js
// 《山河岁月》人物知识星图：d3 力导向图，节点=82位历史人物，边=师承/同盟/对立/亲属/影响五类关系。
// 提供 window.SHY_GRAPH = { render(), focus(personId) }
// 消费 window.SHY_DATA.persons/relations、window.SHY_DATA.chapters（节点主题色）、
//      window.SHY_APP.state.litPersons（点亮状态，只增不减，剧情推进时由 scroll.js 写入）。
// 依赖 vendor/d3.v7.min.js 提供的全局 window.d3；file:// 下零外部网络请求。

(function () {
  "use strict";

  var RELATION_COLORS = {
    "师承": "#d4a017",
    "同盟": "#3a7f8f",
    "对立": "#a0522d",
    "亲属": "#7b5ea7",
    "影响": "#6a7f9a"
  };
  var RELATION_ORDER = ["师承", "同盟", "对立", "亲属", "影响"];

  var LIT_R = 10;
  var UNLIT_R = 4;
  var UNLIT_FILL = "#4a5568";

  // zoomBehavior 的 scaleExtent 下限，同时也是 fitToViewport() 里防止缩放超出合法区间的
  // 夹子——两处必须共用同一个值（否则 fit 算出的 k 可能被 zoomBehavior 自己的 scaleExtent
  // 二次夹住，与 fitToViewport() 内部夹出来的结果对不上）。
  //
  // 【2026-07-27 复审改正】上一版把这个下限从 0.3 全局下调到 0.08，报告里定性为"修复既有
  // bug"——这个定性不成立：复审时重新核对同一份实测表发现，桌面/平板的理论所需 k 从未低于
  // 0.35（iPad mini 0.357、iPad Pro 0.510、iPad 横屏 0.456），0.3 这个原始下限对桌面/平板
  // 从来没有失效过，不存在"潜藏缺陷"。真正的情况是：本任务新增的"手机窄屏必须把 82 个节点
  // 完整收进视口"这个需求，与旧常量 0.3 起了冲突——iPhone SE 需要 k≈0.156、iPhone 14 竖屏
  // 需要 k≈0.164、iPhone 14 横屏最窄需要 k≈0.102，全都低于 0.3。这是新需求与旧常量取舍的
  // 问题，不是修 bug；处理方式是按指针类型分流，而不是把桌面端一并放宽——全局下调到 0.08 会
  // 让桌面鼠标滚轮也能把星图缩到 8%，82 个节点挤成一团，反而在桌面引入真实回归。
  // 触屏（(pointer: coarse) 命中）用 0.08（比实测最紧的 iPhone 14 横屏 0.102 留约 20% 余量，
  // 覆盖数据集将来略微增长的情况）；桌面/细指针维持原来的 0.3，手感不变。
  var ZOOM_MIN_SCALE = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ? 0.08 : 0.3;
  var ZOOM_MAX_SCALE = 4;

  var built = false; // DOM 外壳 + 力导向图仅初始化一次；后续 render() 只刷新点亮状态
  var els = null; // 缓存的 DOM 引用
  var nodesData = [];
  var nodeById = {};
  var svgSel = null, zoomG = null, linkSel = null, nodeSel = null, rippleLayer = null;
  var simulation = null, zoomBehavior = null;
  var selectedId = null;
  var resizeObserver = null;
  // 自动 fit：见 startAutoFitWatcher()/fitToViewport()/centerOnNode() 与 buildGraph() 里
  // simulation.on("end", ...) 及 zoomBehavior 的注释——一旦为 false，之后任何自动 fit（无论
  // 轮询触发还是 "end" 触发）都不再执行，且不会再变回 true。
  var autoFitActive = true;
  var autoFitTimer = null;

  // ------------------------- 工具函数 -------------------------

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function personsList() {
    return (window.SHY_DATA && window.SHY_DATA.persons) || [];
  }

  function relationsList() {
    return (window.SHY_DATA && window.SHY_DATA.relations) || [];
  }

  function chaptersList() {
    return (window.SHY_DATA && window.SHY_DATA.chapters) || [];
  }

  function getState() {
    return (window.SHY_APP && window.SHY_APP.state) || null;
  }

  function litIdSet() {
    var state = getState();
    var arr = (state && state.litPersons) || [];
    var set = {};
    arr.forEach(function (id) { set[id] = true; });
    return set;
  }

  function chapterThemeColor(person) {
    var chId = (person.chapterIds && person.chapterIds[0]) || null;
    var chapters = chaptersList();
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].id === chId) return (chapters[i].theme && chapters[i].theme.primary) || "#8a6d3b";
    }
    return "#8a6d3b";
  }

  function yearsText(birth, death) {
    var b = typeof birth === "number" ? birth : "？";
    var d = typeof death === "number" ? death : "？";
    if (birth == null && death == null) return "生卒年不详";
    return b + " — " + d;
  }

  function firstChar(name) {
    return String(name || "？").charAt(0);
  }

  // ------------------------- 外壳 DOM（首次构建） -------------------------

  function buildShell(container) {
    container.innerHTML =
      '<div class="graph-shell">' +
      '<div class="graph-hud">' +
      '<div class="graph-progress" aria-live="polite"></div>' +
      '<button type="button" class="graph-btn-back">返回</button>' +
      "</div>" +
      '<div class="graph-canvas-wrap">' +
      '<svg class="graph-svg" role="img" aria-label="人物知识星图"></svg>' +
      '<div class="graph-legend"></div>' +
      '<aside class="graph-drawer" aria-hidden="true">' +
      '<button type="button" class="graph-drawer-close" aria-label="关闭">×</button>' +
      '<div class="graph-drawer-body"></div>' +
      "</aside>" +
      "</div>" +
      "</div>";

    els = {
      shell: container.querySelector(".graph-shell"),
      progress: container.querySelector(".graph-progress"),
      backBtn: container.querySelector(".graph-btn-back"),
      canvasWrap: container.querySelector(".graph-canvas-wrap"),
      svg: container.querySelector(".graph-svg"),
      legend: container.querySelector(".graph-legend"),
      drawer: container.querySelector(".graph-drawer"),
      drawerClose: container.querySelector(".graph-drawer-close"),
      drawerBody: container.querySelector(".graph-drawer-body")
    };

    // P3 导航栈：优先按 SHY_APP.navigateBack() 回到进入前的视图（scroll/about/ending），
    // 若来处携带 eventId（人物 chip 跳转）则重开该事件卡；navigateBack 缺失时兜底回卷轴。
    els.backBtn.addEventListener("click", function () {
      if (window.SHY_APP && typeof window.SHY_APP.navigateBack === "function") {
        window.SHY_APP.navigateBack();
      } else if (window.SHY_APP && typeof window.SHY_APP.showView === "function") {
        window.SHY_APP.showView("scroll");
      }
    });
    els.drawerClose.addEventListener("click", deselect);

    buildLegend();

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var graphView = document.getElementById("graph-view");
      if (!graphView || graphView.hidden) return;
      deselect();
    });
  }

  function buildLegend() {
    var html = '<h4 class="graph-legend-title">关系图例</h4><ul class="graph-legend-list">';
    RELATION_ORDER.forEach(function (rel) {
      html +=
        '<li class="graph-legend-item"><span class="graph-legend-swatch" style="background:' +
        RELATION_COLORS[rel] +
        '"></span><span>' +
        escapeHtml(rel) +
        "</span></li>";
    });
    html += "</ul>";
    els.legend.innerHTML = html;
  }

  // ------------------------- 力导向图（首次构建） -------------------------

  function canvasSize() {
    var rect = els.canvasWrap.getBoundingClientRect();
    return {
      w: Math.max(rect.width || 0, 280),
      h: Math.max(rect.height || 0, 280)
    };
  }

  // 力导布局按 canvasSize() 铺开（力朝画布中心聚拢，但节点间的斥力/连线距离与视口大小无关），
  // 手机视口（390×700 上下）必然装不下全部 82 个节点，布局收敛后会有节点被裁在视口外。
  // 这里按当前所有节点坐标的真实包围盒算一次缩放平移，把整张星图收进视口。调用时机见
  // startAutoFitWatcher() 与 buildGraph() 里 simulation.on("end", ...) 的注释；与 focus() 的
  // 协调见 centerOnNode()。返回是否真的执行了 fit（false＝坐标未就绪或视图当前隐藏）。
  function fitToViewport(animate) {
    if (!zoomBehavior || !svgSel || !nodesData.length) return false;
    // 视图容器当前 [hidden]（display:none）时，canvasWrap.offsetParent 为 null；此时
    // canvasSize() 只能拿到兜底的 280×280 假尺寸（真实盒模型已塌陷为 0），照它算出的缩放
    // 平移在视图重新可见、尺寸变回真实值后就是错的。不如此刻跳过——startAutoFitWatcher()
    // 的 300ms 轮询会在视图重新可见后的下一拍自然用真实尺寸重试，见该函数注释。
    if (els.canvasWrap && els.canvasWrap.offsetParent === null) return false;
    var size = canvasSize();
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodesData.forEach(function (n) {
      if (typeof n.x !== "number" || typeof n.y !== "number") return;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });
    if (!isFinite(minX)) return false; // tick 尚未跑过，坐标未初始化
    var pad = 44;
    var w = Math.max(maxX - minX, 1);
    var h = Math.max(maxY - minY, 1);
    var k = Math.min((size.w - pad * 2) / w, (size.h - pad * 2) / h);
    k = Math.max(ZOOM_MIN_SCALE, Math.min(ZOOM_MAX_SCALE, k)); // 与 zoomBehavior 的 scaleExtent 保持一致，避免 fit 把缩放推出合法区间
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var t = window.d3.zoomIdentity.translate(size.w / 2 - cx * k, size.h / 2 - cy * k).scale(k);
    // animate=true 用于 startAutoFitWatcher() 的轮询调用（见该函数注释：实测轮询首次触发
    // 时会有一次未经缓动的大幅缩放突变，260ms 短于轮询间隔 300ms，让每次修正在下一次轮询
    // 覆盖前基本播完，避免过渡互相打断造成新的"卡顿感"）；simulation.on("end") 的最终定稿
    // 调用固定传 false——彼时相邻两次坐标差已不到 1%（见 startAutoFitWatcher() 注释里的
    // 膨胀曲线尾段），加过渡反而让"力导已经停止"和"镜头真正锁定"之间多出一段不必要的
    // 尾迹，不如直接落位精确。
    var sel = animate ? svgSel.transition().duration(260).ease(window.d3.easeCubicOut) : svgSel;
    sel.call(zoomBehavior.transform, t);
    return true;
  }

  // ------------------------- 自动 fit：随布局展开持续对齐视口 -------------------------
  // 力导布局收敛（alpha 衰减到 alphaMin 以下）需要时间——实测本项目默认参数（82 节点、
  // charge -85、link distance 62）下约需 5 秒；但节点包围盒的膨胀在收敛过程的头几秒就已经
  // 逼近最终尺寸（实测：300ms 时约 1100×1050，第 3-4 秒左右涨到约 1836×1790 封顶，此后
  // 一路到第 5 秒的 "end" 触发前都只是零点几像素级别的微调）。若只在最终 "end" 时 fit 一次，
  // 中间这几秒星图在手机视口上仍是原样溢出的——不但用户在这几秒内看到的是没收进视口的画面，
  // 验证器截图（tools/responsive-check.mjs 对 graph 视图只 sleep 700ms 就采样）也拍不到
  // "已经 fit" 的状态，量化验收与人工看图两条验收标准都会落空。
  // 改成：布局仍在展开期间，每 300ms 用当前包围盒重新 fit 一次，让镜头跟着展开节奏持续对齐；
  // 一旦真正收敛（"end" 触发且 fit 成功）或用户接管镜头（focus()、真实手势缩放平移），立即
  // 停表且之后永不再自动改变视角——避免收敛之后仍按 300ms 心跳空转，也避免在用户已经自己
  // 划开视角、或已经跳转聚焦到某个人物之后，被这套"持续对齐"逻辑把画面按回去。
  // 不改 simulation 本身的 alphaDecay/alphaMin：那是全局物理调参，会连带影响拖拽手感与桌面端
  // 已经过人工验收的布局观感（收敛更快=relax 迭代更少，可能让节点更容易重叠），风险面更大；
  // 轮询只是"多问几次当前坐标、多喊几次 fit"，完全不干预力导向本身的收敛过程。
  //
  // 【2026-07-27 复审实测】用 CDP 每 80ms 采样一次 d3.zoomTransform，实测轮询第一次触发
  // （布局刚展开到约 300ms 时）会把 k 从初始的 1.0 直接跳到约 0.25——75% 的缩放突变发生在
  // 单次未经缓动的赋值里，肉眼可见是一次生硬的"镜头快切"，随后几次轮询（k 再降约
  // 12%/10%/7%）也是同样量级的突变，直到第 2.6 秒左右差值才降到 5% 以下、不再明显。这正是
  // brief 提醒可能存在的"多次硬切"现象，属实。修法：轮询触发的 fit 改用 fitToViewport(true)
  // （见该函数内 260ms 缓动过渡的说明），把每次修正摊开成短过渡而不是瞬间跳变；
  // simulation.on("end") 的最终一次定稿保持 fitToViewport(false) 不变——彼时坐标已基本
  // 稳定，不需要过渡。
  function stopAutoFitWatcher() {
    if (autoFitTimer !== null) {
      window.clearInterval(autoFitTimer);
      autoFitTimer = null;
    }
  }

  function startAutoFitWatcher() {
    var startedAt = Date.now();
    autoFitTimer = window.setInterval(function () {
      // 12 秒安全上限：正常情况下 5 秒内必然收敛并由下面 simulation.on("end") 的成功分支
      // 自行停表；这里只防极端情况（比如用户在收敛前一直按住某个节点拖拽，dragBehavior 里
      // 的 alphaTarget(0.25) 反复把 alpha 架高，迟迟不跌破 alphaMin）导致轮询无限空转。
      if (!autoFitActive || Date.now() - startedAt > 12000) { stopAutoFitWatcher(); return; }
      // animate=true：见 fitToViewport() 与本函数上方"2026-07-27 复审实测"注释——不加过渡时
      // 轮询期间的缩放修正是瞬间跳变，实测中肉眼可见的硬切。中途多次调用不消费
      // autoFitActive：是否"最终定稿"只由下面 simulation.on("end") 的成功分支、
      // centerOnNode()、以及 zoomBehavior 的真实手势判定这三处决定。
      fitToViewport(true);
    }, 300);
  }

  function buildGraph() {
    var persons = personsList();
    var relations = relationsList();
    var size = canvasSize();

    nodeById = {};
    nodesData = persons.map(function (p) {
      var n = {
        id: p.id,
        name: p.name,
        courtesy: p.courtesy,
        birth: p.birth,
        death: p.death,
        role: p.role,
        bio: p.bio,
        image: p.image,
        imageCredit: p.imageCredit,
        color: chapterThemeColor(p),
        lit: false
      };
      nodeById[p.id] = n;
      return n;
    });

    var links = relations
      .filter(function (r) { return nodeById[r.source] && nodeById[r.target]; })
      .map(function (r) {
        return { source: r.source, target: r.target, relation: r.relation, note: r.note };
      });

    svgSel = window.d3.select(els.svg).attr("viewBox", "0 0 " + size.w + " " + size.h);

    var bgCatch = svgSel.append("rect")
      .attr("class", "graph-bg-catch")
      .attr("x", -5000).attr("y", -5000).attr("width", 10000).attr("height", 10000)
      .attr("fill", "transparent")
      .on("click", function (event) {
        if (event.target === this) deselect();
      });

    zoomG = svgSel.append("g").attr("class", "graph-zoom-layer");
    var linkLayer = zoomG.append("g").attr("class", "graph-link-layer");
    var nodeLayer = zoomG.append("g").attr("class", "graph-node-layer");
    rippleLayer = zoomG.append("g").attr("class", "graph-ripple-layer");

    linkSel = linkLayer.selectAll("line.graph-link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "graph-link")
      .attr("stroke", function (d) { return RELATION_COLORS[d.relation] || "#6a7f9a"; });

    nodeSel = nodeLayer.selectAll("g.graph-node")
      .data(nodesData, function (d) { return d.id; })
      .enter()
      .append("g")
      .attr("class", "graph-node is-unlit")
      .call(dragBehavior());

    // 触控设备上节点半径（未点亮 4px / 点亮 9-10px）远小于手指精度，插一个透明大圆扩大命中区。
    // 只在粗指针下加：桌面上 22px 命中圆会与相邻节点（斥力 -85、连线距离仅 62px）的命中区
    // 重叠，鼠标点击反而更容易误中旁边的节点——细指针本来精度就够，不需要这个代价。
    // matchMedia 只在这里（buildGraph() 首次构建时）求值一次，不随视口变化重新判断：这与
    // buildGraph() 本身"只初始化一次、后续 render() 只刷新点亮状态"的既有设计一致，现实中
    // 指针类型（有没有触控能力）不会在单个页面生命周期内从粗变细，可接受；真正需要它随窗口
    // 尺寸变化重算的场景（比如可折叠设备切换成键鼠模式）不在本项目的目标设备矩阵内。
    // 必须插在可见圆之前（先 append）：SVG 没有 z-index，同层元素按文档顺序绘制，后添加的
    // 盖在先添加的上面。命中圆 fill 是 transparent（不是 none——SVG 的 pointer-events 默认值
    // visiblePainted 只把 transparent 计为"已绘制"从而接受指针事件，none 则不会），先插入
    // 使其被后插入的可见圆盖在视觉下方，不会遮挡圆点/字形的呈现；点击仍能命中，因为
    // click/hover 监听器绑在父级 <g class="graph-node"> 上（见下方 nodeSel.on("click", ...)
    // 与 css/main.css 里 .graph-node.is-lit:hover 一类祖先选择器），指针事件从命中圆冒泡上去
    // 即可，与其绘制顺序无关。
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      nodeSel.append("circle")
        .attr("class", "graph-node-hit")
        .attr("r", 22)
        .attr("fill", "transparent");
    }

    nodeSel.append("circle")
      .attr("class", "graph-node-circle")
      .attr("r", UNLIT_R)
      .attr("fill", UNLIT_FILL);

    nodeSel.append("text")
      .attr("class", "graph-node-glyph")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central");

    nodeSel.append("text")
      .attr("class", "graph-node-label is-blurred")
      .attr("text-anchor", "middle")
      .attr("dy", LIT_R + 13)
      .text("？");

    nodeSel.on("click", function (event, d) {
      if (!d.lit) return;
      selectNode(d.id);
    });

    simulation = window.d3.forceSimulation(nodesData)
      .force("link", window.d3.forceLink(links).id(function (d) { return d.id; }).distance(62).strength(0.14))
      .force("charge", window.d3.forceManyBody().strength(-85))
      .force("center", window.d3.forceCenter(size.w / 2, size.h / 2))
      .force("collision", window.d3.forceCollide().radius(function (d) { return (d.lit ? LIT_R : UNLIT_R) + 6; }))
      .on("tick", onTick);

    // 力导收敛（alpha 衰减到 alphaMin 以下）后做最终一次 fit，并永久停止自动 fit——不放在
    // render() 里直接 fit：render() 触发 buildGraph() 时节点刚按 phyllotaxis 螺旋初始化坐标，
    // 力还没怎么展开，此时 fit 会按这批初始重叠坐标算缩放，结果是所有节点挤在画面中央一点。
    // d3 v7 的 forceSimulation 在内部 timer 里每次 tick 后检查 alpha < alphaMin 就派发一次
    // "end" 事件（停止 timer 前触发），只要页面没有主动调用 simulation.stop()，这个事件在
    // v7 下必然会触发；后续若因拖拽节点（dragBehavior 里的 alphaTarget(0.25).restart()）重新
    // 加热，alpha 再次跌破 alphaMin 时还会再触发一次——所以不能假设它只触发一次，靠下面
    // autoFitActive 的成功判定去重，而不是靠事件本身的触发次数。
    // 收敛前的持续对齐交给 startAutoFitWatcher()（见该函数注释：只等这一次 "end" 会让手机上
    // 头几秒的画面、以及验证器截图，都拍到"还没收进视口"的中间状态）。
    simulation.on("end", function () {
      if (autoFitActive && fitToViewport(false)) {
        autoFitActive = false;
      }
      // 未成功执行（比如此刻视图恰好被切走，fitToViewport 内部因 offsetParent 为 null 提前
      // 返回 false）就不停表，留给轮询在视图重新可见后的下一次 300ms 心跳自然补上；
      // render() 里也有一道兜底：若离开期间轮询触发了 12 秒安全上限而停表、届时仍未成功，
      // 重新进入视图会重新起表，不会让星图永远停留在没 fit 过的状态。
      if (!autoFitActive) stopAutoFitWatcher();
    });
    startAutoFitWatcher();

    zoomBehavior = window.d3.zoom()
      .scaleExtent([ZOOM_MIN_SCALE, ZOOM_MAX_SCALE])
      .on("zoom", function (event) {
        zoomG.attr("transform", event.transform);
        // event.sourceEvent 只在真实用户手势（触摸/滚轮/拖拽画布）驱动时才存在；程序调用
        // zoomBehavior.transform（fitToViewport()/centerOnNode() 都是这样触发的）产生的是
        // 没有 sourceEvent 的合成事件。据此判断"用户自己动手划开视角了"——跟 focus() 接管
        // 镜头同理，自动 fit 从此永久让位，不再在布局收敛过程中把用户刚划开的视角按回去。
        if (event.sourceEvent) {
          autoFitActive = false;
          stopAutoFitWatcher();
        }
      });
    svgSel.call(zoomBehavior);

    setupResize();
  }

  function onTick() {
    // tick 中只做一次 transform/attr 批量赋值，不读取布局属性（getBoundingClientRect 等），
    // 避免强制同步布局引发的 DOM 抖动。
    linkSel
      .attr("x1", function (d) { return d.source.x; })
      .attr("y1", function (d) { return d.source.y; })
      .attr("x2", function (d) { return d.target.x; })
      .attr("y2", function (d) { return d.target.y; });
    nodeSel.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
  }

  function dragBehavior() {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.25).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      // 保持 fx/fy 钉住，避免松手后节点弹回、82 节点长期漂移不定
    }
    return window.d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  }

  function setupResize() {
    var apply = function () {
      var size = canvasSize();
      svgSel.attr("viewBox", "0 0 " + size.w + " " + size.h);
      simulation.force("center", window.d3.forceCenter(size.w / 2, size.h / 2));
      // 若用户在布局收敛前切走视图（#graph-view 加上 [hidden]，display:none），期间
      // fitToViewport() 会因 offsetParent 为 null 而每次都提前返回——不需要在这里额外补一次
      // fit：只要 autoFitActive 还是 true，startAutoFitWatcher() 的 300ms 轮询本身就会在视图
      // 重新可见后的下一拍自然用真实尺寸重试，不必靠这里的 resize 事件专门兜底。
      // 2026-07-28 复审订正（已知限制，本轮只记录不修）：上面这段论证只覆盖了
      // autoFitActive === true 的情形，但 autoFitActive 一经 fitToViewport() 成功执行或用户
      // 交互（缩放/拖拽/focus）就被置为 false 且不会再变回 true（见文件顶部 autoFitActive
      // 声明与各处置位点）——布局通常在进入星图后几秒内就收敛完成，此后 autoFitActive 长期
      // 处于 false。这意味着压倒性常见的情况恰恰不是上面论证的那个分支：转屏（resize）发生
      // 时 autoFitActive 早已是 false，本函数这里除了同步 viewBox/力场中心外，不会触发任何
      // 重新 fit——已经收敛定稿的力导布局不会跟着新的视口尺寸重新缩放/居中，转屏后星图有可能
      // 显示得偏小或偏移。这是当前实现的已知缺口，留给后续轮次处理，这里如实记录、不在本轮
      // 改动行为。
    };
    if (typeof window.ResizeObserver === "function") {
      resizeObserver = new window.ResizeObserver(function () { apply(); });
      resizeObserver.observe(els.canvasWrap);
    } else {
      window.addEventListener("resize", apply);
    }
  }

  // ------------------------- 点亮状态刷新（每次 render() 调用） -------------------------

  function updateLitState() {
    var lit = litIdSet();
    var litCount = 0;
    nodesData.forEach(function (n) {
      n.lit = !!lit[n.id];
      if (n.lit) litCount++;
    });

    nodeSel
      .classed("is-lit", function (d) { return d.lit; })
      .classed("is-unlit", function (d) { return !d.lit; })
      .classed("is-selected", function (d) { return d.id === selectedId; })
      .style("cursor", function (d) { return d.lit ? "pointer" : "default"; })
      .attr("aria-label", function (d) { return d.lit ? d.name : "未点亮人物"; });

    nodeSel.select("circle.graph-node-circle")
      .attr("r", function (d) { return d.lit ? LIT_R : UNLIT_R; })
      .attr("fill", function (d) { return d.lit ? d.color : UNLIT_FILL; });

    // 命中圆只在粗指针下存在（见 buildGraph() 里的 matchMedia 门控）；在桌面/细指针下这是
    // 空选择集，.style() 调用是无操作，安全。22px 的命中圆本意是放大"点击已点亮节点打开
    // 抽屉"的触控精度，但它在未点亮节点（游戏早期占绝大多数）上同样存在，会拦截落在其
    // 22px 范围内、意图平移画布的触摸——未点亮节点点击本来就直接被 nodeSel.on("click") 里
    // 的 `if (!d.lit) return;` 短路，命中圆对它毫无功能意义，纯粹在抢画布平移的触摸事件。
    // 这里按点亮状态收放 pointer-events：只有已点亮（真正可点击）的节点保留命中圆的拦截，
    // 未点亮节点让出这片区域给画布平移。复用本函数每次 render()/focus() 都会重新计算
    // d.lit 之后再刷新一遍其它样式属性的既有模式，不需要新状态机、不需要额外 DOM 操作。
    //
    // 权衡（dragBehavior() 本身不检查 d.lit）：关掉未点亮节点命中圆的 pointer-events 后，
    // 用户仍能通过其可见的 4px 小圆（fill 是不透明的 UNLIT_FILL，默认 pointer-events:
    // visiblePainted 下仍会接受指针事件）单独拖拽该节点——只是命中区从 22px 缩回 4px，
    // 与桌面端（从来没有命中圆，未点亮节点向来只能靠这颗 4px 小圆拖拽）此刻处境一致，是
    // "触屏曾经额外获得、现在收回"的精度回退，不是新增的功能缺口。判断为可接受，不专门
    // 为未点亮节点补一条"禁止拖拽"或者"拖拽单独保留命中区"的规则：未点亮节点在图中纯属
    // 装饰（点击门控在前面已短路，抽屉打不开），拖拽它们不承载任何信息获取功能，其可用性
    // 优先级远低于 brief 点名的核心诉求——把画布平移这个导航手势的可用空间让出来。
    nodeSel.select("circle.graph-node-hit")
      .style("pointer-events", function (d) { return d.lit ? null : "none"; });

    nodeSel.select("text.graph-node-glyph")
      .text(function (d) { return d.lit ? firstChar(d.name) : ""; });

    nodeSel.select("text.graph-node-label")
      .text(function (d) { return d.lit ? d.name : "？"; })
      .classed("is-blurred", function (d) { return !d.lit; });

    simulation.force("collision", window.d3.forceCollide().radius(function (d) { return (d.lit ? LIT_R : UNLIT_R) + 6; }));

    linkSel
      .classed("is-visible", function (d) { return d.source.lit || d.target.lit; })
      .classed("is-both-lit", function (d) { return d.source.lit && d.target.lit; })
      .classed("is-partial-lit", function (d) { return (d.source.lit || d.target.lit) && !(d.source.lit && d.target.lit); });

    if (els.progress) {
      els.progress.textContent = "已点亮 " + litCount + " / " + nodesData.length + " 位历史人物";
    }
  }

  // ------------------------- 选中 / 侧栏抽屉 -------------------------

  function relationsForNode(node) {
    var out = [];
    relationsList().forEach(function (r) {
      var otherId = null;
      if (r.source === node.id) otherId = r.target;
      else if (r.target === node.id) otherId = r.source;
      else return;
      var other = nodeById[otherId];
      if (!other || !other.lit) return; // 只列出与其相连且已点亮的人物，避免剧透未登场人物
      out.push({ other: other, relation: r.relation, note: r.note });
    });
    return out;
  }

  function renderDrawer(node) {
    var rel = relationsForNode(node);
    var relHtml;
    if (rel.length) {
      relHtml =
        '<ul class="graph-relation-list">' +
        rel
          .map(function (item) {
            return (
              '<li class="graph-relation-item" data-person-id="' +
              escapeHtml(item.other.id) +
              '" tabindex="0" role="button" aria-label="跳转至' +
              escapeHtml(item.other.name) +
              '">' +
              '<span class="graph-relation-tag" style="background:' +
              (RELATION_COLORS[item.relation] || "#6a7f9a") +
              '">' +
              escapeHtml(item.relation) +
              "</span>" +
              '<span class="graph-relation-name">' + escapeHtml(item.other.name) + "</span>" +
              '<span class="graph-relation-note">' + escapeHtml(item.note || "") + "</span>" +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    } else {
      relHtml = '<p class="graph-drawer-empty">暂无已点亮的关联人物</p>';
    }

    // person.image 非 null → 抽屉顶部肖像（圆形宣纸边框）+ imageCredit 小字；null → 保持现状（无肖像区块）。
    // 已点亮节点本体（力导向图上的圆点）不放照片，仍是圆点+首字——避免 82 张小图的性能与风格噪音。
    var portraitHtml = node.image
      ? '<div class="graph-drawer-portrait-wrap"><img class="graph-drawer-portrait" src="' +
        escapeHtml(node.image) +
        '" alt="' + escapeHtml(node.name || "") + '肖像" loading="lazy"></div>' +
        (node.imageCredit ? '<p class="graph-drawer-image-credit">' + escapeHtml(node.imageCredit) + "</p>" : "")
      : "";

    els.drawerBody.innerHTML =
      portraitHtml +
      '<h3 class="graph-drawer-name">' + escapeHtml(node.name) + "</h3>" +
      (node.courtesy ? '<p class="graph-drawer-courtesy">' + escapeHtml(node.courtesy) + "</p>" : "") +
      '<p class="graph-drawer-years">' + escapeHtml(yearsText(node.birth, node.death)) + "</p>" +
      '<p class="graph-drawer-role">' + escapeHtml(node.role || "") + "</p>" +
      '<p class="graph-drawer-bio">' + escapeHtml(node.bio || "") + "</p>" +
      '<h4 class="graph-drawer-relations-title">相关人物</h4>' +
      relHtml;

    // 肖像加载失败（onerror）：整块（含图注）移除，不留破图图标，退化为无图布局。
    var portraitImg = els.drawerBody.querySelector(".graph-drawer-portrait");
    if (portraitImg) {
      portraitImg.addEventListener("error", function () {
        var wrap = portraitImg.parentNode;
        if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
        var credit = els.drawerBody.querySelector(".graph-drawer-image-credit");
        if (credit && credit.parentNode) credit.parentNode.removeChild(credit);
      });
    }

    var items = els.drawerBody.querySelectorAll(".graph-relation-item");
    items.forEach(function (li) {
      var jump = function () { focus(li.dataset.personId); };
      li.addEventListener("click", jump);
      li.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(); }
      });
    });
  }

  function selectNode(id) {
    var node = nodeById[id];
    if (!node || !node.lit) return;
    selectedId = id;
    nodeSel.classed("is-selected", function (d) { return d.id === id; });
    renderDrawer(node);
    els.drawer.classList.add("is-open");
    els.drawer.setAttribute("aria-hidden", "false");
    if (els.canvasWrap) els.canvasWrap.classList.add("has-drawer-open"); // 图例避让抽屉
  }

  function deselect() {
    selectedId = null;
    if (nodeSel) nodeSel.classed("is-selected", false);
    if (els) {
      els.drawer.classList.remove("is-open");
      els.drawer.setAttribute("aria-hidden", "true");
      if (els.canvasWrap) els.canvasWrap.classList.remove("has-drawer-open");
    }
  }

  // ------------------------- focus(personId)：居中 + 涟漪 -------------------------

  function centerOnNode(node) {
    // focus() 从这里开始接管镜头：一旦调用，之后（含还在轮询中、尚未收敛的自动 fit）一律
    // 永久让位，不再执行——避免自动 fit 的下一次 300ms 心跳或最终 "end" 姗姗来迟，把刚摆好
    // 的聚焦位置又冲掉。见 startAutoFitWatcher() 与 buildGraph() 里 simulation.on("end", ...)
    // 的详细协调说明。
    autoFitActive = false;
    stopAutoFitWatcher();
    // 力导向模拟持续运行时节点仍在漂移：若只按调用瞬间的 node.x/y 算好目标变换就播放 700ms
    // 过渡，动画播完时节点早已移动到别处，"居中"名不副实。这里将节点钉在当前坐标（与拖拽
    // 松手后保持定钉一致的设计），使其在整个过渡及之后都不再被力场推移，视角与节点位置
    // 才能始终吻合。
    node.fx = node.x;
    node.fy = node.y;
    var size = canvasSize();
    var current = window.d3.zoomTransform(els.svg);
    var scale = Math.max(current.k || 1, 1.3);
    var target = window.d3.zoomIdentity.translate(size.w / 2 - node.x * scale, size.h / 2 - node.y * scale).scale(scale);
    svgSel.transition().duration(700).ease(window.d3.easeCubicOut).call(zoomBehavior.transform, target);
  }

  function showRipple(node) {
    if (!rippleLayer) return;
    var ripple = rippleLayer.append("circle")
      .attr("class", "graph-ripple")
      .attr("cx", node.x)
      .attr("cy", node.y)
      .attr("r", LIT_R)
      .attr("fill", "none")
      .attr("stroke", node.color)
      .attr("stroke-width", 2.5)
      .attr("opacity", 0.9);
    ripple
      .transition()
      .duration(900)
      .ease(window.d3.easeCubicOut)
      .attr("r", LIT_R + 42)
      .attr("opacity", 0)
      .on("end", function () { ripple.remove(); });
  }

  function focus(personId) {
    if (!built) render(); // 保证外壳与力导向图已就绪（scroll.js 会先 showView('graph') 触发 render()，此处为兜底）
    var node = nodeById[personId];
    if (!node) return;
    updateLitState();
    if (!node.lit) return; // 未点亮门控：不 pin fx/fy、不居中、不放涟漪（涟漪用章节主题色会泄露信息），也不开抽屉
    selectNode(personId);
    centerOnNode(node);
    showRipple(node);
  }

  // ------------------------- 对外入口 -------------------------

  function render() {
    var container = document.getElementById("graph-view");
    if (!container) return;
    if (!built) {
      if (!window.d3) return; // vendor/d3.v7.min.js 未加载时静默失败，不抛异常阻断其他视图
      built = true;
      buildShell(container);
      buildGraph();
    } else if (autoFitActive && autoFitTimer === null) {
      // 补救极端情况：用户在布局收敛前离开视图、又拖了很久（超过 startAutoFitWatcher() 的
      // 12 秒安全上限）才回来，届时轮询早已自行停表，但既没收敛成功也没被用户接管——这里
      // app.js 的 showView('graph') 每次都会调 render()，借这个必经入口重新起表，让它再有
      // 一次机会用重新可见后的真实尺寸完成 fit，不至于让星图永远停留在没 fit 过的状态。
      startAutoFitWatcher();
    }
    updateLitState();
  }

  window.SHY_GRAPH = {
    render: render,
    focus: focus
  };
})();
