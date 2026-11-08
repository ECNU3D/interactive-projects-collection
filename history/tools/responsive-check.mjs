#!/usr/bin/env node
// tools/responsive-check.mjs
// 移动端/平板适配的可复现验证器：headless Chrome + CDP 真设备模拟（Emulation.setDeviceMetricsOverride
// 带 DPR、setTouchEmulationEnabled 带触摸），跨设备尺寸 × 视图跑布局断言并归档截图。
//
// 为什么不用缩放窗口：窗口尺寸不改变 devicePixelRatio、不开启触摸，(pointer: coarse) 媒体查询
// 不会命中，触控热区一类断言必然测不到真实行为。CDP 模拟是唯一能在 headless 下同时改变
// 视口、DPR 与指针类型的手段。CDP 连接方式沿用 tools/selftest-run.mjs 已验证的模式。
//
// 用法：node tools/responsive-check.mjs [baseUrl=http://localhost:8080] [outDir=.responsive-shots/current] [--baseline [dir=.responsive-shots/baseline]]
// 退出码：0 = 断言全绿（含基线截图比对，若启用）；1 = 有失败或 Chrome 启动失败
//
// --baseline：对每个设备/视图截图，若「基线目录」里存在同名 PNG，就把它与本次截图做逐像素比对
// （PNG 解码完全交给浏览器自己的 <canvas>，Node 侧不引入任何图像解码依赖）——两张图都通过本地
// HTTP 服务器以同源方式加载（tools/serve.mjs 会原样吐出仓库内任意文件，含被 .gitignore 忽略的
// .responsive-shots/），canvas 不会被跨源污染，getImageData 可读。基线目录里没有的文件名一律
// 跳过比对（不当失败处理），跳过清单会在运行结束时明确打印，不静默略过。

import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --baseline 是可选的具名开关，可能出现在两个位置参数之后的任意位置；先把它摘出来，
// 剩下的位置参数再按原来的顺序（baseUrl、outDir）解析，避免二者互相干扰。
const rawArgs = process.argv.slice(2);
let baselineDirArg = null;
const baselineFlagIdx = rawArgs.indexOf("--baseline");
if (baselineFlagIdx !== -1) {
  const val = rawArgs[baselineFlagIdx + 1];
  if (val && !val.startsWith("--")) {
    baselineDirArg = val;
    rawArgs.splice(baselineFlagIdx, 2);
  } else {
    baselineDirArg = ".responsive-shots/baseline";
    rawArgs.splice(baselineFlagIdx, 1);
  }
}

const baseUrl = (rawArgs[0] || "http://localhost:8080").replace(/\/$/, "");
const outDir = path.resolve(rawArgs[1] || ".responsive-shots/current");
const baselineDirAbs = baselineDirArg ? path.resolve(baselineDirArg) : null;

// 把仓库内的绝对路径转成可通过本地静态服务器访问的 URL；路径若落在仓库根目录之外，
// 服务器根本没有路由能吐出它，返回 null 由调用方显式报错，不能悄悄比对到别的文件。
function toServableUrl(absPath) {
  const rel = path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
  if (rel.startsWith("..")) return null;
  return baseUrl + "/" + rel.split("/").map(encodeURIComponent).join("/");
}

// 逐像素比较两张图：在浏览器里各自 decode 成 <img>，尺寸不一致单独报出（不当成 100% 差异），
// 尺寸一致再各画一份 canvas 用 getImageData 逐通道比较。返回 Promise，须配合 evaluate() 的
// awaitPromise:true 使用。
const IMG_COMPARE_FN = `function (urlA, urlB) {
  function loadImg(url) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error("图片加载失败: " + url)); };
      img.src = url;
    });
  }
  return Promise.all([loadImg(urlA), loadImg(urlB)]).then(function (imgs) {
    var a = imgs[0], b = imgs[1];
    if (a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight) {
      return {
        sizeMismatch: true,
        curSize: [a.naturalWidth, a.naturalHeight],
        baseSize: [b.naturalWidth, b.naturalHeight]
      };
    }
    var w = a.naturalWidth, h = a.naturalHeight;
    var ca = document.createElement("canvas"); ca.width = w; ca.height = h;
    var cb = document.createElement("canvas"); cb.width = w; cb.height = h;
    var xa = ca.getContext("2d"), xb = cb.getContext("2d");
    xa.drawImage(a, 0, 0);
    xb.drawImage(b, 0, 0);
    var da = xa.getImageData(0, 0, w, h).data;
    var db = xb.getImageData(0, 0, w, h).data;
    var diffPixels = 0;
    var total = w * h;
    for (var i = 0; i < da.length; i += 4) {
      if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) diffPixels++;
    }
    return {
      sizeMismatch: false,
      curSize: [w, h], baseSize: [w, h],
      diffPixels: diffPixels, totalPixels: total, diffRatio: diffPixels / total
    };
  });
}`;

// portraitPhone 标记参与"首屏可见节点数"断言；touch 标记参与触控热区断言。
const DEVICES = [
  { name: "iphone-se",      width: 375,  height: 667,  dpr: 2, touch: true,  portraitPhone: true },
  { name: "iphone-14",      width: 390,  height: 844,  dpr: 3, touch: true,  portraitPhone: true },
  { name: "iphone-14-land", width: 844,  height: 390,  dpr: 3, touch: true,  portraitPhone: false },
  { name: "ipad-mini",      width: 744,  height: 1133, dpr: 2, touch: true,  portraitPhone: false },
  { name: "ipad-pro",       width: 1024, height: 1366, dpr: 2, touch: true,  portraitPhone: false },
  { name: "ipad-land",      width: 1366, height: 1024, dpr: 2, touch: true,  portraitPhone: false },
  { name: "desktop",        width: 1440, height: 900,  dpr: 2, touch: false, portraitPhone: false }
];

const VIEWS = ["scroll", "card", "graph", "map", "choice", "ending"];

// 页内断言源码：注入后调用 __shyAssert(view, dev) 返回 [{id, ok, detail}]
const ASSERT_SRC = `
function __shyPx(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}
// 命中矩形 = 元素自身矩形，若有向外扩张（负 inset）的绝对定位 ::after 则并入其扩张量
function __shyHitRect(el) {
  var r = el.getBoundingClientRect();
  var w = r.width, h = r.height;
  var cs = getComputedStyle(el, "::after");
  if (cs && cs.content && cs.content !== "none" && cs.position === "absolute") {
    var t = parseFloat(cs.top) || 0, l = parseFloat(cs.left) || 0;
    var b = parseFloat(cs.bottom) || 0, rr = parseFloat(cs.right) || 0;
    if (t < 0 || l < 0 || b < 0 || rr < 0) { w = r.width - l - rr; h = r.height - t - b; }
  }
  return { w: w, h: h };
}
function __shyVisible(el) {
  var r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth &&
        r.bottom > 0 && r.top < window.innerHeight)) return false;
  // 仅几何可见不够——2026-07-27 审查在接入真实命中测试后发现：.modal-backdrop（事件卡
  // 弹层）常年常驻 DOM，只用 opacity:0 + pointer-events:none 隐藏（css/main.css 6 节），
  // 不是 display:none/[hidden]，getBoundingClientRect 在"关闭"状态下依然返回视口内的
  // 非零矩形，纯几何判断会把 .card-close 之类的弹层内容误判成"当前视图可见"，导致 A5
  // 在 card 以外的视图也去检验它——而它此刻并不在最上层（真实点击会穿透到它背后的内容），
  // 这不是样式缺陷，是判断可见性的方法不够严谨。用元素自身矩形中心做一次
  // elementFromPoint，确认此刻真的是它自己（或其后代）盖在最上层，才算真正可见/可参与
  // 命中测试；中心点本身越界（罕见）时无法判定，保守按几何结果放行，留给下面的四向真实
  // 探测和 A1/A6 等其它断言处理。
  var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (cx < 0 || cx >= window.innerWidth || cy < 0 || cy >= window.innerHeight) return true;
  var hit = document.elementFromPoint(cx, cy);
  return !!(hit && el.contains(hit));
}
// 真实命中测试（2026-07-27 审查追加，弥补 __shyHitRect 纯算术模型的假绿）：__shyHitRect 只读
// ::after 的声明 inset 做加减，不模拟祖先的 overflow 裁剪与层叠上下文——真实案例：
// #top-bar-actions button 在手机宽度档下算术命中矩形算出 46x47（PASS），但 Task 4 加的
// overflow-x:auto 按 CSS 规范强制 overflow-y 也计算成 auto，::after 的纵向扩张被裁在
// #top-bar-actions 自己的裁剪盒边缘，elementFromPoint 实测真实命中区只有 42x41——一次已经
// 发生的假绿，只能靠人工用 elementFromPoint/CDP 才发现。这里把"最终判定"换成四向真实探测：
// 从元素中心沿上/下/左/右四个方向各探测 44×44 目标框四条边的中点，用
// document.elementFromPoint 取该点实际命中的元素，四个方向都命中"元素自身或其后代"才算
// 真正达标。elementFromPoint 可能返回子元素（例如按钮内的 .btn-label-short 文字节点的父
// span），所以用 el.contains(hit) 按祖先链判定归属，不能用 === 简单比较（el.contains(el)
// 本身也是 true，天然覆盖"探测点直接落在 el 自身"的情况）。
//
// 探测距离用 PROBE_DIST=21.5，不是字面的 22——这不是放宽判定，是修正一个已用最小可复现
// 用例证实的边界量测假象：写一个干净的 20×20 方块、::after 用 inset:-12px（声明层面精确
// 等于 44×44，无任何裁剪祖先），用 elementFromPoint 逐 0.2px 扫描，命中在 d=21.8 仍是元素
// 自身，d=22.0 整点就已经落在元素之外——去掉 z-index、交换 DOM 顺序、去掉遮挡的兄弟节点，
// 这个"22.0 整点判负"的边界都不变，说明这是浏览器对"半开区间"矩形命中测试的通用取整行为
// （盒子边界是 [center-R, center+R) 半开区间，不含右端点），不是这份 CSS 的裁剪缺陷。如果
// 仍按字面 22 探测，会把大量已经严格等于 44×44 的健康元素（包括 .node 圆点节点）误判成
// "真实未命中"——那将是探测方法本身引入的假红，跟本次要修的假绿同样不可接受。21.5 只让出
// 0.5px（对应"至少 43px"，而不是"恰好 44.0px"），远小于此前发现的真实缺陷量级（纵向曾
// 缺口达 4px、抉择点菱形缺口达 2px），足以避开这个取整假象，又不会掩盖任何真正的裁剪。
function __shyRealHit(el) {
  var PROBE_DIST = 21.5;
  var r = el.getBoundingClientRect();
  var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  var vw = window.innerWidth, vh = window.innerHeight;
  var dirs = [
    { name: "上", dx: 0, dy: -PROBE_DIST },
    { name: "下", dx: 0, dy: PROBE_DIST },
    { name: "左", dx: -PROBE_DIST, dy: 0 },
    { name: "右", dx: PROBE_DIST, dy: 0 }
  ];
  var offscreen = [], missed = [];
  for (var i = 0; i < dirs.length; i++) {
    var x = cx + dirs[i].dx, y = cy + dirs[i].dy;
    // 探测点落在视口外的方向跳过——屏幕边缘是物理边界，CSS 无法让扩张层伸到屏幕之外，
    // 不能怪罪样式；但"跳过"必须体现在返回值里，由调用方写进 detail，不能静默当作通过。
    if (x < 0 || x >= vw || y < 0 || y >= vh) { offscreen.push(dirs[i].name); continue; }
    var hit = document.elementFromPoint(x, y);
    if (!(hit && el.contains(hit))) missed.push(dirs[i].name);
  }
  return { ok: missed.length === 0, offscreen: offscreen, missed: missed };
}
function __shyAssert(view, dev) {
  var out = [];
  function add(id, ok, detail) { out.push({ id: id, ok: !!ok, detail: detail || "" }); }
  var vw = window.innerWidth, vh = window.innerHeight;

  // A1 文档不得横向溢出（长卷的横向滚动发生在 #scroll-view 内部，不影响文档）
  var over = document.scrollingElement.scrollWidth - vw;
  add("A1-no-page-overflow", over <= 1, "scrollWidth - innerWidth = " + over);

  if (view === "scroll") {
    // A2 每章渲染宽度 == chapterMinWidth() 的 CSS 变量口径
    // 守卫：.chapter-section 一个都没选中时，下面的 forEach 不执行、worst 停在初始值 0，
    // 会被 worst<=2 误判成"完全对齐"而 PASS——实际是选择器/页面结构坏了，必须大声失败。
    var sections = document.querySelectorAll(".chapter-section");
    if (sections.length === 0) {
      add("A2-section-width", false, "未匹配到 .chapter-section，无法验证章节宽度");
    } else {
      var unit = __shyPx("--node-w") + __shyPx("--node-gap");
      var base = __shyPx("--title-w") + __shyPx("--timeline-pad") * 2 + __shyPx("--intro-w");
      var worst = 0, worstId = "";
      [].forEach.call(sections, function (s) {
        var expect = base + s.querySelectorAll(".node-wrap").length * unit;
        var d = Math.abs(s.offsetWidth - expect);
        if (d > worst) { worst = d; worstId = s.dataset.chapterId || "?"; }
      });
      add("A2-section-width", worst <= 2, "最大偏差 " + worst.toFixed(1) + "px @" + worstId);
    }

    // A3 刻度尺总宽 == 卷轴总宽
    // 守卫：.scroll-track 或 .scroll-ruler 任一缺失时，原逻辑会把两边都当 0 比出"完全相等"
    // 而 PASS，同样是假绿——必须先确认两个容器都存在，再谈宽度是否对齐。
    var track = document.querySelector(".scroll-track");
    var ruler = document.querySelector(".scroll-ruler");
    if (!track || !ruler) {
      add("A3-ruler-aligned", false,
          "未找到 .scroll-track（" + !!track + "）或 .scroll-ruler（" + !!ruler + "）");
    } else {
      var rulerW = 0;
      [].forEach.call(ruler.children, function (seg) { rulerW += seg.offsetWidth; });
      var trackW = track.offsetWidth;
      add("A3-ruler-aligned", Math.abs(rulerW - trackW) <= 2, "刻度尺 " + rulerW + " vs 卷轴 " + trackW);
    }

    // A4a 引言卡不得越过刻度尺顶边
    // 守卫：.chapter-intro-card 零匹配时 bad 停在 0 误判 PASS；ruler 缺失时原逻辑退化为
    // "以视口底边为界"，几乎不可能触发压穿，同样是假绿，因此两者都要单独拦截。
    var introCards = document.querySelectorAll(".chapter-intro-card");
    if (introCards.length === 0) {
      add("A4a-intro-card-clear", false, "未匹配到 .chapter-intro-card");
    } else if (!ruler) {
      add("A4a-intro-card-clear", false, "未找到 .scroll-ruler，无法判定引言卡是否压穿刻度尺");
    } else {
      var rulerTop = ruler.getBoundingClientRect().top;
      var bad = 0;
      [].forEach.call(introCards, function (c) {
        if (c.getBoundingClientRect().bottom > rulerTop + 1) bad++;
      });
      add("A4a-intro-card-clear", bad === 0, bad + " 张引言卡压穿刻度尺");
    }

    // A4b 节点标签不得与轴线本体相交（只查视口内的，卷外的无意义）
    // 守卫：.timeline-river 缺失或 .node-label 零匹配都会让 hit 停在 0 误判 PASS。
    // 注意「卷外不参与」（r.right<0 || r.left>vw 时 continue）是正常的空间过滤，不属于
    // 「选择器没匹配到东西」，不能也守卫成失败——两者语义不同，见下方 forEach 内的区分。
    var river = document.querySelector(".timeline-river");
    var labels = document.querySelectorAll(".node-label");
    if (!river) {
      add("A4b-label-clear-axis", false, "未找到 .timeline-river");
    } else if (labels.length === 0) {
      add("A4b-label-clear-axis", false, "未匹配到 .node-label");
    } else {
      var rr = river.getBoundingClientRect();
      var hit = 0;
      [].forEach.call(labels, function (lb) {
        var r = lb.getBoundingClientRect();
        if (r.right < 0 || r.left > vw) return; // 卷外不参与，不是"未匹配"
        if (r.bottom > rr.top && r.top < rr.bottom) hit++;
      });
      add("A4b-label-clear-axis", hit === 0, hit + " 个标签与轴线相交");
    }

    // A4c 节点标签不得与节点本体（圆点/菱形/高潮）相交（只查视口内的，卷外的无意义）
    // 只比对"轴线"（A4b）测不出这类缺陷：抉择点菱形 .node--choice 旋转 45° 后的外接盒
    // （getBoundingClientRect() 拿到的正是旋转后的矩形，不还原成未旋转尺寸）比其令牌尺寸大
    // 一圈，当 --tick-len 比这个外接盒的半对角线还小时，标签会直接压进菱形——2026-07-26
    // 审查在 iPhone-14 横屏（平板档 --node-dot:26 × 矮屏档 --tick-len:14）上实测到这个真实
    // 重叠，A4b 对此完全没有反应（标签确实没碰轴线，只是撞上了节点本体）。
    // 守卫：.node-wrap 零匹配直接失败；单个 wrap 内缺 .node 或 .node-label 说明结构坏了，
    // 用 missingStruct 单独计数，与"卷外不参与"的正常空间过滤区分开（同 A4b 的守卫风格）。
    var nodeWraps = document.querySelectorAll(".node-wrap");
    if (nodeWraps.length === 0) {
      add("A4c-label-clear-node", false, "未匹配到 .node-wrap");
    } else {
      var hitNode = 0, missingStruct = 0;
      [].forEach.call(nodeWraps, function (w) {
        var wr = w.getBoundingClientRect();
        if (wr.right < 0 || wr.left > vw) return; // 卷外不参与，不是"未匹配"
        var n = w.querySelector(".node");
        var lb = w.querySelector(".node-label");
        if (!n || !lb) { missingStruct++; return; }
        var nr = n.getBoundingClientRect();
        var lr = lb.getBoundingClientRect();
        if (lr.left < nr.right && lr.right > nr.left && lr.top < nr.bottom && lr.bottom > nr.top) hitNode++;
      });
      if (missingStruct > 0) {
        add("A4c-label-clear-node", false, missingStruct + " 个 .node-wrap 缺少 .node 或 .node-label 子元素");
      } else {
        add("A4c-label-clear-node", hitNode === 0, hitNode + " 个标签与节点本体相交");
      }
    }

    // A6 手机竖屏首屏可见节点 >= 3
    if (dev.portraitPhone) {
      var vis = 0;
      [].forEach.call(document.querySelectorAll(".node-wrap"), function (w) {
        var r = w.getBoundingClientRect();
        if (r.right > 0 && r.left < vw) vis++;
      });
      add("A6-node-density", vis >= 3, "首屏可见节点 " + vis);
    }
  }

  // A5 粗指针下所有可交互元素命中矩形 >= 44x44
  // 守卫：某选择器在当前视图一个元素都没匹配到时，原逻辑只是不给 small 添项，5 个选择器全部
  // 落空也会汇报"0 处过小"而 PASS——查不到东西和查到的都够大，在这条断言里完全无法区分，是
  // 假绿。用 DOM 总数（querySelectorAll(sel).length，而非"当前可见"）判断选择器是否有命中：
  // .node / #top-bar-actions button 的容器只用 [hidden] 切换视图，元素始终留在 DOM 里，因此在
  // 全部 6 个视图都应有命中；.person-chip / .card-close 只在事件卡（card）视图渲染进 DOM；
  // .choice-option 只在抉择（choice）视图渲染进 DOM——这三个在其余视图天然是 0，不能算失败，
  // 否则就是把"本视图本不该有"误判成假红（同样违反守卫的本意）。至于"存在但暂不可见/被遮挡"
  // (__shyVisible 过滤掉的)，那是正常状态，不在本守卫覆盖范围，仍按原语义静默跳过。
  //
  // 2026-07-27 审查订正：__shyHitRect 只做算术加减，测不出祖先 overflow 裁剪/层叠遮挡——
  // 真实案例：#top-bar-actions button 手机宽度档下算术命中矩形算出 46x47（PASS），但
  // elementFromPoint 实测真实命中区只有 42x41，是一次已经发生的假绿。现在把 __shyHitRect
  // 降级为"快速粗筛"（数值太小的直接判定失败，省去无谓的真实探测），最终判定一律加做
  // __shyRealHit 的四向真实命中测试，两者都通过才算真正达标；任何一处真实探测未命中都要
  // 显式失败，不得为了凑绿放宽这条判定。
  if (dev.touch) {
    var A5_EXPECT_VIEWS = {
      ".node": ["scroll", "card", "graph", "map", "choice", "ending"],
      "#top-bar-actions button": ["scroll", "card", "graph", "map", "choice", "ending"],
      ".person-chip": ["card"],
      ".choice-option": ["choice"],
      ".card-close": ["card"]
    };
    var small = [];
    var missing = [];
    var realMissed = [];
    var realOffscreen = [];
    [".node", "#top-bar-actions button", ".person-chip", ".choice-option", ".card-close"].forEach(function (sel) {
      var all = document.querySelectorAll(sel);
      if (all.length === 0) {
        if (A5_EXPECT_VIEWS[sel].indexOf(view) !== -1) missing.push(sel);
        return;
      }
      [].forEach.call(all, function (el) {
        if (el.disabled) return;          // 未解锁节点不可交互，不参与
        if (!__shyVisible(el)) return;    // 视口外/隐藏的不参与
        var h = __shyHitRect(el);
        if (h.w < 44 || h.h < 44) {
          small.push(sel + " " + Math.round(h.w) + "x" + Math.round(h.h));
          return; // 算术粗筛已经不达标，真实探测必然更差，没必要再测一遍
        }
        // 算术粗筛过关的，还要过真实命中测试这一关——最终判定以这里为准
        var real = __shyRealHit(el);
        if (real.offscreen.length) {
          realOffscreen.push(sel + "(" + real.offscreen.join("/") + "探测点越界，已跳过不计入失败)");
        }
        if (!real.ok) {
          realMissed.push(sel + " 真实未命中方向:" + real.missed.join("/"));
        }
      });
    });
    var detailParts = [];
    if (small.length) {
      detailParts.push("算术粗筛不达标: " + small.slice(0, 3).join("; ") + (small.length > 3 ? " …共 " + small.length + " 处" : ""));
    }
    if (missing.length) {
      detailParts.push("选择器未匹配到任何元素：" + missing.join(", "));
    }
    if (realMissed.length) {
      detailParts.push("真实命中测试未通过: " + realMissed.slice(0, 3).join("; ") + (realMissed.length > 3 ? " …共 " + realMissed.length + " 处" : ""));
    }
    if (realOffscreen.length) {
      detailParts.push(realOffscreen.slice(0, 2).join("; ") + (realOffscreen.length > 2 ? " …共 " + realOffscreen.length + " 处越界跳过" : ""));
    }
    add("A5-touch-target",
        small.length === 0 && missing.length === 0 && realMissed.length === 0,
        detailParts.join(" | "));
  }
  return out;
}
`;

// 各视图的页内准备脚本：统一造一个"已推进 40 个节点、420 分、点亮 30 人"的存档态
function setupScript(view) {
  // #scroll-view 的 CSS 有无条件的 scroll-behavior:smooth（css/main.css:282），下面 render()
  // 触发的 scrollToCurrentNode() 用 scrollTo({behavior:"auto"}) 压不住它（"auto" 按规范是"听 CSS
  // 的"，不是"立即跳转"），实际会播放一段平滑滚动动画。A5/A6 按"首屏可见节点"采样，若采样时动画
  // 还没播完，测到的是动画中途的瞬时位置，同一份代码多跑几次结果会抖动（已用诊断脚本实测confirm：
  // 目标 scrollLeft 与 700ms 时的实际 scrollLeft 对不上）。这里用内联样式覆盖掉 CSS 的 smooth——
  // 内联样式优先级高于任何非 !important 的样式表规则，之后同一个 scrollTo({behavior:"auto"}) 调用
  // 会读到"无平滑滚动"的计算值，变成瞬间跳转，从根上消除动画而不是等它播完。只改的是运行时注入
  // 脚本里的内联样式（DOM 属性），css/main.css 源文件本身未改动一个字符。
  var scrollAuto = "document.getElementById('scroll-view').style.scrollBehavior = 'auto';";
  // 各视图共用的展示态基础值："已推进 40 个节点、420 分、点亮 30 人"
  var baseState =
    "window.SHY_APP.state.unlockedCount = 40;" +
    "window.SHY_APP.state.total = 420;" +
    "window.SHY_APP.state.litPersons = (window.SHY_DATA.persons || []).slice(0, 30).map(function (p) { return p.id; });";
  var renderAndRefresh = "window.SHY_SCROLL.render();" + "window.SHY_APP.refreshHud();";
  var common = scrollAuto + baseState + renderAndRefresh;
  if (view === "scroll") return common;
  if (view === "card") return common + "window.SHY_SCROLL.openEvent(window.SHY_DATA.events[0].id);";
  if (view === "choice") return common + "window.SHY_CHOICE.open(window.SHY_DATA.choices[0].id);";
  if (view === "ending") {
    // 曾经的写法是 common（内含一次 refreshHud()）后面再追加 finished=true，那次 refreshHud()
    // 跑在 finished 还是 false 的时刻，而 showView() 本身不会再触发 refreshHud()——结果是
    // ending 视图的断言/截图实际上从未真正见过 #btn-ending 现身，"6 按钮态"完全没被测到过
    // （Task 4 审查复核证实）。同一处顺带还有一个尺寸 bug：render() 也在 common 里跑在
    // unlockedCount 被覆盖成终局值之前，用的是中途值 40 定位滚动，而不是通关后的真实位置。
    // 这里把 finished/unlockedCount 的赋值挪到 render()/refreshHud() 之前，两个问题一次修完：
    // render() 用终局 unlockedCount 定位、refreshHud() 用 finished=true 让 #btn-ending 现身。
    return scrollAuto +
      baseState +
      "window.SHY_APP.state.finished = true;" +
      "window.SHY_APP.state.unlockedCount = window.SHY_DATA.events.length + 1;" +
      renderAndRefresh +
      "window.SHY_APP.showView('ending');";
  }
  return common + "window.SHY_APP.showView('" + view + "');";
}

// ------------------------- CDP 连接（同 tools/selftest-run.mjs） -------------------------

const port = 9000 + Math.floor(Math.random() * 1000);
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=" + port,
  "--no-first-run",
  "--user-data-dir=" + path.join(os.tmpdir(), "responsive-chrome-" + port),
  "about:blank"
], { stdio: "ignore" });

function cleanup(code) {
  try { chrome.kill(); } catch (e) { /* 已退出 */ }
  process.exit(code);
}
process.on("SIGINT", () => cleanup(1));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: p }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

let version = null;
for (let i = 0; i < 50; i++) {
  try { version = await getJson("/json/version"); break; } catch (e) { await sleep(200); }
}
if (!version) { console.error("Chrome DevTools 端口未就绪"); cleanup(1); }

const ws = new WebSocket(version.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
function send(method, params, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  }
};
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, sessionId);
await send("Page.enable", {}, sessionId);

async function evaluate(expression, returnByValue, awaitPromise) {
  const r = await send("Runtime.evaluate", {
    expression: expression,
    returnByValue: !!returnByValue,
    awaitPromise: !!awaitPromise
  }, sessionId);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result ? r.result.value : undefined;
}

// --baseline 专用：把 IMG_COMPARE_FN 连同两个 URL 一起丢进已导航好的页面执行，用
// awaitPromise:true 等浏览器把 decode + getImageData + 逐像素比较都做完再拿结果回来。
async function compareScreenshots(curUrl, baseImgUrl) {
  const expr = "(" + IMG_COMPARE_FN + ")(" + JSON.stringify(curUrl) + "," + JSON.stringify(baseImgUrl) + ")";
  return await evaluate(expr, true, true);
}

async function waitForReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ok = await evaluate(
        "!!(window.SHY_APP && window.SHY_APP.state && window.SHY_SCROLL && document.querySelector('.chapter-section'))",
        true);
      if (ok) return true;
    } catch (e) { /* 导航间隙，继续轮询 */ }
    await sleep(200);
  }
  return false;
}

// choice 视图专用：.choice-option 由 js/choice.js 的旁白节奏定时器触发（逐句淡入最长 1400ms +
// 揭示延迟 550ms，见 renderSceneAndSchedule），最晚 1950ms 后才出现，通用的 sleep(700) 覆盖不到。
// 若不额外等，A5 新加的"选择器零匹配"守卫会把"还没到点"误判成"选择器失效"的假红——这是本次
// 修复守卫时才发现的真实时序缺口，只对 choice 视图轮询，不拖慢其余 41 个组合。
async function waitForChoiceOptions(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ok = await evaluate("document.querySelectorAll('.choice-option').length > 0", true);
      if (ok) return true;
    } catch (e) { /* 忽略，继续轮询 */ }
    await sleep(150);
  }
  return false;
}

// 兜底验证：setupScript() 里已经把 #scroll-view 的 scroll-behavior 强制改成 auto，让 render() 触发的
// 定位变成瞬间跳转而非动画，这应该已经消除了 A5/A6 采样时机撞上滚动动画中段的问题。这里再轮询
// scrollLeft 是双保险——连续两次采样完全相等才判定"已稳定"，带硬上限；万一将来 scroll.js 的定位逻辑
// 换成了别的触发方式（不再是一次性 scrollTo），或本次覆盖因某种原因未生效，稳定性检查会超时，绝不能
// 静默放行去采样一个还在动的页面，必须留下一条看得见的失败记录（见调用处）。
async function waitForScrollStable(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let prev = null;
  while (Date.now() < deadline) {
    let cur = null;
    try {
      cur = await evaluate(
        "(function(){var el=document.getElementById('scroll-view'); return el ? el.scrollLeft : null;})()",
        true);
    } catch (e) { /* 导航间隙，继续轮询 */ }
    if (cur !== null && cur === prev) return true;
    prev = cur;
    await sleep(100);
  }
  return false;
}

// ------------------------- 主循环 -------------------------

fs.mkdirSync(outDir, { recursive: true });
let pass = 0, fail = 0;
const failures = [];
const baselineSkipped = []; // 基线目录里没有同名文件，明确记录、不算失败也不静默

// >0.1% 的差异比例才判 FAIL——不是放宽容差，是给 PNG 解码/重绘链路留出的唯一裕量；
// 逐通道比较本身仍是精确整数相等（见 IMG_COMPARE_FN），跳变判定只在这一步做百分比换算。
const BASELINE_DIFF_THRESHOLD = 0.001;

for (const dev of DEVICES) {
  // 设备级 CDP 调用不再裸跑：这两条曾经真实崩过一次（0 号 maxTouchPoints 被 Chrome 拒绝），
  // 说明 CDP 调用本身不可假定必然成功。与 setup/assert 已有的 evaluate() try/catch 对齐，
  // 一旦这里抛异常，改为把该设备的全部 6 个视图记为失败并继续跑完剩下的设备，而不是让
  // 未捕获异常终止整个进程——那样会连汇总行都打不出来，直接破坏"跑得完整"这条验收标准。
  let deviceReady = true;
  try {
    await send("Emulation.setDeviceMetricsOverride", {
      width: dev.width, height: dev.height, deviceScaleFactor: dev.dpr, mobile: dev.touch
    }, sessionId);
    // maxTouchPoints 即使 enabled:false 也必须落在 CDP 校验的 1~16 区间内，传 0 会被 Chrome
    // 拒绝（"Touch points must be between 1 and 16"）导致整个运行崩溃；真正关闭触摸靠 enabled。
    await send("Emulation.setTouchEmulationEnabled", {
      enabled: dev.touch, maxTouchPoints: dev.touch ? 5 : 1
    }, sessionId);
  } catch (e) {
    console.log("[FAIL] " + dev.name + " device-setup " + e.message);
    deviceReady = false;
  }

  for (const view of VIEWS) {
    if (!deviceReady) {
      console.log("[FAIL] " + dev.name + "/" + view + " device-setup 设备模拟未就绪，跳过");
      fail++; failures.push(dev.name + "/" + view + " device-setup");
      continue;
    }

    try {
      await send("Page.navigate", { url: baseUrl + "/index.html" }, sessionId);
    } catch (e) {
      console.log("[FAIL] " + dev.name + "/" + view + " navigate " + e.message);
      fail++; failures.push(dev.name + "/" + view + " navigate");
      continue;
    }
    if (!(await waitForReady(15000))) {
      console.log("[FAIL] " + dev.name + "/" + view + " boot 页面未就绪");
      fail++; failures.push(dev.name + "/" + view + " boot");
      continue;
    }
    try {
      await evaluate(setupScript(view));
    } catch (e) {
      console.log("[FAIL] " + dev.name + "/" + view + " setup " + e.message);
      fail++; failures.push(dev.name + "/" + view + " setup");
      continue;
    }
    await sleep(700); // 让力导布局/过渡稳定
    if (view === "choice") await waitForChoiceOptions(2500); // 见 waitForChoiceOptions 注释

    // 见 waitForScrollStable 注释：不 continue——采样不稳只降低这次结果的可信度，不是硬性阻断，
    // 断言仍然照跑并记录，只是额外打一条独立的 FAIL 把"这次采样可能不可靠"摆到台面上。
    if (!(await waitForScrollStable(2000))) {
      console.log("[FAIL] " + dev.name + "/" + view + " scroll-settle 横向滚动 2000ms 内未稳定，本次采样结果可能不可靠");
      fail++; failures.push(dev.name + "/" + view + " scroll-settle");
    }

    let results;
    try {
      results = await evaluate(ASSERT_SRC + ";__shyAssert(" +
        JSON.stringify(view) + "," + JSON.stringify(dev) + ")", true);
    } catch (e) {
      console.log("[FAIL] " + dev.name + "/" + view + " assert " + e.message);
      fail++; failures.push(dev.name + "/" + view + " assert");
      continue;
    }
    for (const r of results) {
      console.log((r.ok ? "[PASS] " : "[FAIL] ") + dev.name + "/" + view + " " + r.id + " " + r.detail);
      if (r.ok) pass++; else { fail++; failures.push(dev.name + "/" + view + " " + r.id); }
    }

    // 截图前只冻结「无限循环」动画（星图/长卷的呼吸光晕 map-halo、shy-pulse 等 2.3s infinite）到
    // 周期起点这一个确定相位——它们按真实墙钟时间播放，两次独立运行采样到的相位必然不同，这在
    // --baseline 比对里第一次实测就抓到过真实后果：desktop/map 的差异比例在两次连续运行里从
    // 0.3779% 摆到 0.0970%，跨过了 0.1% 判据，同一份代码、同一份基线却一次判 FAIL 一次判 PASS。
    // 有限时长动画（choice 场景的 Ken Burns 缓慢平移等）刻意不碰：曾经试过对所有动画一律调用
    // finish()，结果把 desktop/choice 的差异从稳定的 0.0000% 冲到 4.0132%——finish() 会把「仍在
    // 播放中途、但由固定 sleep 时长保证了确定性」的长效果跳到播放完毕的终态，那是一个跟基线完全
    // 不同的画面，等于用「让它更确定」的名义引入了新的不确定性。只挑 iterations===Infinity 的
    // 动画处理，不去动任何有限动画，是把「已知会抖动」和「已经确定」严格分开、只修前者。
    // 试过更激进的方案（对所有动画一律 pause()，不只是 infinite 的）：结果把此前稳定在 6.0678%
    // 的 desktop/ending 冲到 28.3489%——ending 页面的入场过渡本来就会在既有 sleep/等待窗口内
    // 自然播完，多出的这一次 pause() 反而偶尔会在过渡还没播完时把它提前定格，等于亲手引入了新的
    // 不确定性。只对 iterations===Infinity 的动画动手、完全不碰有限动画（哪怕只是 pause() 不改
    // currentTime），是唯一在三个视图（scroll 稳定、choice 不再被 finish() 破坏、ending 不被
    // 误伤）之间都不引入新问题的做法；graph（d3 力导向布局的浮点收敛）与 choice（Ken Burns 长效
    // 果本身的自然播放进度随机）残留的样本间微小波动，属于宿主页面自身的真实时间驱动效果，不在
    // tools/ 单侧可安全消除的范围内（见验收报告的「疑虑」一节）。
    try {
      await evaluate(
        "(function(){document.getAnimations().forEach(function(a){try{var t=a.effect&&a.effect.getTiming?a.effect.getTiming():null;" +
        "if(t&&t.iterations===Infinity){a.pause();a.currentTime=0;}}catch(e){}});})()"
      );
    } catch (e) { /* 冻结失败不阻断截图，只是这一张的动画相位仍随机 */ }

    let shotPath = null;
    try {
      const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
      const fileName = dev.name + "-" + view + ".png";
      shotPath = path.join(outDir, fileName);
      fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
    } catch (e) {
      console.log("[FAIL] " + dev.name + "/" + view + " screenshot " + e.message);
      fail++; failures.push(dev.name + "/" + view + " screenshot");
    }

    // --baseline 比对：只对基线目录里实际存在同名文件的组合做比对（本轮适配预期让 6 台非桌面
    // 设备的布局大改，与旧基线比必然全红——这不是要验证的东西）。基线目录没有对应文件时明确
    // 记入 baselineSkipped 并在运行结束时打印，不静默跳过。
    if (baselineDirAbs && shotPath) {
      const fileName = dev.name + "-" + view + ".png";
      const baselinePath = path.join(baselineDirAbs, fileName);
      if (!fs.existsSync(baselinePath)) {
        baselineSkipped.push(fileName);
      } else {
        const curUrl = toServableUrl(shotPath);
        const baseImgUrl = toServableUrl(baselinePath);
        if (!curUrl || !baseImgUrl) {
          console.log("[FAIL] " + dev.name + "/" + view + " baseline-diff 截图路径超出仓库根目录，本地服务器无法提供，无法比对");
          fail++; failures.push(dev.name + "/" + view + " baseline-diff");
        } else {
          try {
            const cmp = await compareScreenshots(curUrl, baseImgUrl);
            if (cmp.sizeMismatch) {
              console.log("[FAIL] " + dev.name + "/" + view + " baseline-diff 尺寸不一致：当前 " +
                cmp.curSize.join("x") + " vs 基线 " + cmp.baseSize.join("x"));
              fail++; failures.push(dev.name + "/" + view + " baseline-diff");
            } else {
              const ok = cmp.diffRatio <= BASELINE_DIFF_THRESHOLD;
              const pct = (cmp.diffRatio * 100).toFixed(4);
              console.log((ok ? "[PASS] " : "[FAIL] ") + dev.name + "/" + view + " baseline-diff 差异 " +
                pct + "%（" + cmp.diffPixels + "/" + cmp.totalPixels + " 像素）");
              if (ok) pass++; else { fail++; failures.push(dev.name + "/" + view + " baseline-diff"); }
            }
          } catch (e) {
            console.log("[FAIL] " + dev.name + "/" + view + " baseline-diff 比对异常 " + e.message);
            fail++; failures.push(dev.name + "/" + view + " baseline-diff");
          }
        }
      }
    }
  }
}

console.log("截图归档：" + outDir);
if (baselineDirAbs) {
  console.log("基线比对目录：" + baselineDirAbs);
  if (baselineSkipped.length) {
    console.log("基线比对跳过（目录内无同名文件，不计入通过/失败，共 " + baselineSkipped.length + " 项）：" +
      baselineSkipped.join(", "));
  } else {
    console.log("基线比对无跳过项（本次截图与基线目录文件名一一对应）");
  }
}
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
if (fail) console.log("失败清单：" + failures.join(" | "));
cleanup(fail ? 1 : 0);
