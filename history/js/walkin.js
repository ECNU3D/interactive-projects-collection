// js/walkin.js
// 「走入历史」高斯泼溅漫游：全项目唯一一处 ES module（其余 js/*.js 均为普通 <script>），
// 因 SparkJS 仅发布 ES module 构建、file:// 协议下会被浏览器 CORS 拒绝加载 —— 见
// docs/superpowers/specs/2026-07-13-walk-into-history-gaussian-splat-design.md。
// 挂载 window.SHY_WALKIN 作为与 js/choice.js（普通脚本）之间唯一的桥接点。
// 桥接契约：probeAvailable(choiceId)/open(choiceId)/close()/isOpen()；
// debugState() 为非契约调试接口（见文件尾注释），choice.js 不得依赖。

import * as THREE from "three";
import { SparkRenderer, SplatMesh, SparkControls } from "@sparkjsdev/spark";

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

var current = null; // { overlay, renderer, scene, camera, spark, mesh, onResize, onKeydown, onFocusIn, timeoutHandle } | null

// 各幕初始机位 [x, y, z]（世界坐标，+y 向上，相机初始朝 -z）。.spz 场景原点通常贴地，
// 默认值 = 抬到人眼高度并后撤，避免开场趴在地板上、贴脸主体（c01 实测调定）。
var CAMERA_START = {
  default: [0, 1.2, 0.5],
  c03: [-1.0, 1.5, 0.1]
};

// SparkControls（及其内部 FpsMovement/PointerControls）在构造时会向 document/window
// 无条件挂 6 个匿名监听器（keydown/keyup/blur/pointerup/pointercancel/pointermove），
// vendor 未提供任何 dispose/移除 API（已通读 vendor/spark.module.min.js 构造路径确认，
// 全 bundle 的 document/window addEventListener 仅此 6 处）。若每次 open 都 new 一个，
// 监听器将随进出次数无界累积。因此 canvas 与 SparkControls 均为模块级单例：首次 open
// 时惰性创建、绑定同一个 canvas，之后每个会话都把该 canvas 交给新的 THREE.WebGLRenderer
// （three r180 的 renderer.dispose() 会移除其挂在 canvas 上的 webglcontextlost/restored
// 监听器，getContext 复取同一上下文，跨会话复用同一 canvas 是安全的）——监听器只在
// 页面生命周期内挂一次，不再增长。
var sharedCanvas = null;
var sharedControls = null;
function ensureSharedControls() {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
    sharedControls = new SparkControls({ canvas: sharedCanvas });
  }
  return sharedControls;
}

var sparkDisposedAt = 0; // 最近一次 spark.dispose() 的时刻，用于窄化下方拦截器的生效窗口

var orbitPaused = false; // 放映暂停时冻结 yaw 推进：画面继续渲染，只是镜头停住

// 已知第三方清理噪音的窄域拦截（非全局吞异常）：SparkRenderer.dispose() 内部会
// dispose 其 sortWorker/lodWorker（vendor/spark.module.min.js 的 AQ.dispose），该方法
// worker.terminate() 后把尚在途中的 RPC promise 逐个 reject(new Error("Worker terminate"))；
// 而 SparkJS 内部 driveSort() 对该 RPC 存在 fire-and-forget 调用链（同文件 setTimeout 回调
// 与 driveSort 尾部的无 await 自调用），rejection 无人 catch，必然以 unhandledrejection
// 冒泡（调用路径：AQ.dispose ← iA.dispose ← 本文件 disposeCurrent）。SparkRenderer 未提供
// 任何“等排序静止后再销毁”的 API，实测调整 mesh/spark/renderer 的销毁顺序也无法消除。
// 因此仅在本模块刚执行过 spark.dispose() 的极短窗口内、且 reason.message 精确等于
// "Worker terminate" 时 preventDefault，其余 rejection 一律照常冒泡。
window.addEventListener("unhandledrejection", function (event) {
  if (!sparkDisposedAt) return;
  if (!event.reason || event.reason.message !== "Worker terminate") return;
  if (performance.now() - sparkDisposedAt > 3000) return;
  event.preventDefault();
});

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
    '<div class="walkin-hint">WASD 移动 · Q/E 降升 · 鼠标环视 · Esc 返回抉择</div>' +
    '<button type="button" class="walkin-exit">回到抉择</button>';
  container.appendChild(overlay);
  return overlay;
}

function disposeCurrent() {
  if (!current) return;
  if (current.orbitDone) {
    // 环视途中被 close()/新会话顶掉（Esc 停止放映、切抉择等）：把仍在等待的 promise
    // 以 false 收尾，否则导演会一直 await 到封顶时限才继续，白等一大段。
    var abortedOrbit = current.orbitDone;
    current.orbitDone = null;
    abortedOrbit(false);
  }
  if (current.renderer) {
    current.renderer.setAnimationLoop(null);
    current.renderer.dispose();
  }
  if (current.mesh && typeof current.mesh.dispose === "function") current.mesh.dispose();
  if (current.spark && typeof current.spark.dispose === "function") {
    sparkDisposedAt = performance.now(); // 见下方 unhandledrejection 拦截器的注释
    current.spark.dispose();
  }
  if (current.timeoutHandle) clearTimeout(current.timeoutHandle); // 提前关闭时解除仍在计时的30s超时
  if (current.onResize) window.removeEventListener("resize", current.onResize);
  if (current.onKeydown) document.removeEventListener("keydown", current.onKeydown, true); // 与注册时的捕获阶段配对
  if (current.onFocusIn) document.removeEventListener("focusin", current.onFocusIn);
  if (current.overlay && current.overlay.parentNode) current.overlay.parentNode.removeChild(current.overlay);
  current = null;
}

function close() {
  disposeCurrent();
}

function open(choiceId, opts) {
  disposeCurrent(); // 防御式：若上一场景未正确关闭，先清理，避免显存泄漏累积

  var overlay = buildOverlayDom();
  if (!overlay) return;

  // opts.orbit = { durationMs, done(ok) }：自动放映的原地环视模式。省略即原有自由漫游。
  var orbitCfg = (opts && opts.orbit) || null;

  var canvasWrap = overlay.querySelector(".walkin-canvas-wrap");
  var progressEl = overlay.querySelector(".walkin-progress");
  var progressText = overlay.querySelector(".walkin-progress-text");
  var errorEl = overlay.querySelector(".walkin-error");
  var exitBtn = overlay.querySelector(".walkin-exit");
  var errorCloseBtn = overlay.querySelector(".walkin-error-close");

  var controls = ensureSharedControls(); // 单例，见模块顶部注释；渲染器每会话新建但共用同一 canvas
  controls.lastTime = 0; // 重置内部时间基准，避免跨会话的间隔被当作一次巨大的 deltaTime

  // 画布尺寸以容器为准而非窗口：.walkin-overlay 是 #choice-view 的 inset:0 覆盖层，而
  // #choice-view 位于顶栏之下（比视口矮 56px），按 window.innerHeight 取尺寸会导致每帧
  // 底部 56px 被裁掉。布局未就绪时（clientWidth/Height 为 0）回退到窗口尺寸兜底。
  function wrapSize() {
    return {
      w: canvasWrap.clientWidth || window.innerWidth,
      h: canvasWrap.clientHeight || window.innerHeight
    };
  }

  var size = wrapSize();
  var renderer = new THREE.WebGLRenderer({ antialias: false, canvas: sharedCanvas });
  renderer.setSize(size.w, size.h);
  canvasWrap.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, size.w / size.h, 0.01, 1000);
  // 初始机位：.spz 场景的原点通常贴在采集视角的地面附近，默认 (0,0,0) 会趴在地板上
  // 且离主体过近（用户实测反馈）。抬到人眼高度并后撤，获得开阔的第一眼构图；
  // 若后续某幕需要不同机位，在此表加对应 choiceId 的条目即可。
  var camPos = CAMERA_START[choiceId] || CAMERA_START.default;
  camera.position.set(camPos[0], camPos[1], camPos[2]);
  var spark = new SparkRenderer({ renderer: renderer });
  scene.add(spark);

  current = {
    overlay: overlay, renderer: renderer, scene: scene, camera: camera,
    spark: spark, mesh: null, onResize: null, onKeydown: null, onFocusIn: null,
    timeoutHandle: null, orbitDone: orbitCfg ? orbitCfg.done : null
  };
  var session = current; // 本次 open 的会话句柄：异步回调据此识别“自己是否已被关闭/被新会话取代”

  current.onResize = function () {
    var s = wrapSize();
    camera.aspect = s.w / s.h;
    camera.updateProjectionMatrix();
    renderer.setSize(s.w, s.h);
  };
  window.addEventListener("resize", current.onResize);

  current.onKeydown = function (e) {
    if (!current) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      // 以捕获阶段注册（下方第三参 true）从构造上保证先于 choice.js 的 Escape 处理执行：
      // choice.js 的 document keydown 是冒泡阶段且注册在前，捕获阶段监听必然先触发，
      // 与注册顺序无关；stopImmediatePropagation 阻断后续传播，冒泡阶段处理不再运行。
      // 见设计文档§5。
      e.stopImmediatePropagation();
      close();
    }
  };
  document.addEventListener("keydown", current.onKeydown, true);

  if (orbitCfg) {
    // 环视是"放映片段"而不是"可操作场景"：藏掉退出按钮与操作提示，改成一行状态文案。
    // 退出统一由放映指示条与 Esc 负责（js/autoplay.js 在捕获阶段接管）。
    overlay.classList.add("walkin-overlay--orbit");
    exitBtn.hidden = true;
    overlay.querySelector(".walkin-hint").textContent = "自动环视中";
    overlay.tabIndex = -1;
  }

  exitBtn.addEventListener("click", close);
  errorCloseBtn.addEventListener("click", close);

  // 焦点圈禁：吞按键（choice.js 的 isOpen() 守卫）不足以杜绝隔层操作——若焦点仍落在
  // 覆盖层背后的按钮上（如鼠标点击「走入历史」后焦点留在该按钮，或 Tab 走进被遮挡的
  // 抉择面板，choice.js 还会自动聚焦「我明白了/继续前行」），Enter/Space 会由浏览器
  // 原生合成 click 激活该按钮，完全绕过任何冒泡阶段的键盘守卫。因此必须圈禁焦点本身。
  // 环视模式下退出按钮已隐藏、不可聚焦，改以覆盖层自身（tabindex=-1）为落点；常规漫游
  // 模式仍落在「回到抉择」——打开即聚焦，此后任何落到覆盖层之外的聚焦立即被拉回。
  var focusTarget = orbitCfg ? overlay : exitBtn;
  focusTarget.focus();
  current.onFocusIn = function (e) {
    if (!current || current !== session) return;
    if (current.overlay.contains(e.target)) return;
    focusTarget.focus();
  };
  document.addEventListener("focusin", current.onFocusIn);

  function showError() {
    if (progressEl) progressEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    if (orbitCfg) {
      // 环视模式下加载失败：不给观众留一个需要手动点掉的错误框，直接收尾跳过本段
      var failed = orbitCfg.done;
      orbitCfg = null;
      if (session) session.orbitDone = null;
      close();
      failed(false);
    }
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
  session.timeoutHandle = setTimeout(function () {
    timedOut = true;
    showError();
  }, 30000); // 挂在会话上：disposeCurrent 会 clearTimeout，提前关闭不留下仍在计时的定时器

  mesh.initialized
    .then(function () {
      // current !== session：本会话已被关闭或被新会话取代（用户加载期间关闭又重开时，
      // current 非 null 但已是新会话，绝不能在已 dispose 的旧 renderer 上重启渲染循环）
      if (timedOut || current !== session) return;
      clearTimeout(session.timeoutHandle);
      progressEl.hidden = true;

      if (orbitCfg) {
        // 原地转身环视：相机钉在 CAMERA_START 机位只转不动。.spz 是从单一视点重建的，
        // 相机一旦沿圆周公转就会跑出重建体积、露出空洞与破面，且每一幕都得单独调半径。
        var orbitElapsed = 0;
        var orbitLastTs = 0;
        camera.rotation.order = "YXZ";
        renderer.setAnimationLoop(function (ts) {
          if (current !== session) return;
          if (!orbitCfg) return; // 已收尾、正等下一个宏任务真正停循环，这几帧什么都不做
          if (!orbitLastTs) orbitLastTs = ts;
          var dtMs = ts - orbitLastTs;
          orbitLastTs = ts;
          if (dtMs > 100) dtMs = 100;
          if (!orbitPaused) orbitElapsed += dtMs;
          var p = Math.min(orbitElapsed / orbitCfg.durationMs, 1);
          camera.rotation.x = 0;
          camera.rotation.z = 0;
          camera.rotation.y = -2 * Math.PI * window.SHY_AUTOPLAY_KIT.orbitEase(p);
          renderer.render(scene, camera);
          if (p >= 1) {
            var settle = orbitCfg.done;
            orbitCfg = null;      // 同步置空：上面的短路据此挡住收尾前的残余帧，杜绝重入
            session.orbitDone = null; // 先摘掉，避免 close() → disposeCurrent 重复 settle
            // three 的 WebGLAnimation 是"回调返回后才 requestAnimationFrame 续帧"
            // （vendor/three.module.min.js 的 Cn()：i(t,a){n(t,a),r=requestAnimationFrame(i)}），
            // 因此在回调内部 close() 时，stop() 取消的是正在执行的这一帧的 id，属空操作，
            // 回调一返回循环就自续，留下一条永远空转、且把已 dispose 的 renderer 钉住不放的
            // RAF 链。改到下一个宏任务再收尾，此时 stop() 取消的是刚续上的那一帧，链条才真断。
            setTimeout(function () {
              // 若此宏任务触发前 current 已被新会话顶替，本会话早已由那次 open() 自身的
              // disposeCurrent() 善后（渲染循环、mesh、spark 均已释放），这里绝不能再无条件
              // close()——那样关掉的是与本次环视无关的新会话。直接 settle 即可：orbitDone
              // 已在上面同步摘空，这是本次 orbit() promise 唯一的残留结算点。
              if (current === session) close();
              settle(true);
            }, 0);
            return;
          }
        });
        return;
      }

      renderer.setAnimationLoop(function () {
        renderer.render(scene, camera);
        controls.update(camera);
      });
    })
    .catch(function () {
      if (current !== session) return; // 会话已关闭：超时定时器已由 disposeCurrent 清理，UI 已移除
      clearTimeout(session.timeoutHandle);
      showError();
    });
}

// 契约接口：漫游是否正在打开。choice.js 据此在漫游期间令抉择面板全部键盘捷径失效，
// 保证不透明覆盖层背后不发生任何用户不可见的状态变更（纯视觉层约束）。
function isOpen() {
  return current !== null;
}

// 非契约性调试接口：仅供 walkin-selftest.html 观测当前场景状态，choice.js 不得依赖它
// （命名/暴露方式沿用 js/bgm.js、js/narration.js 既有的非契约调试 getter 先例）。
function debugState() {
  return current;
}

// 自动放映契约：把泼溅场景原地转满一周后自动关闭。
// resolve(true) = 转满一周；resolve(false) = 无模型 / 不支持 WebGL2 / 加载失败 / 中途被关闭。
// 调用方据此决定跳过本段，不必自己判断素材是否齐备。
function orbit(choiceId, opts) {
  var durationMs = (opts && opts.durationMs) || 24000;
  return probeAvailable(choiceId).then(function (available) {
    if (!available) return false;
    return new Promise(function (resolve) {
      open(choiceId, { orbit: { durationMs: durationMs, done: resolve } });
    });
  });
}

function setOrbitPaused(on) {
  orbitPaused = !!on;
}

window.SHY_WALKIN = {
  probeAvailable: probeAvailable,
  open: open,
  close: close,
  isOpen: isOpen,
  debugState: debugState,
  orbit: orbit,
  setOrbitPaused: setOrbitPaused
};
