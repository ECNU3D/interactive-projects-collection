// js/chapterfilm.js
// 《山河岁月》章开篇影片：全屏播放 assets/video/chapters/<chapterId>.mp4。
// 提供 window.SHY_CHAPTER_FILM = { probeAvailable, open, play, close, isOpen, setPaused }
// debugState() 为非契约调试接口（见文件尾注释），调用方不得依赖。
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

  var LOAD_TIMEOUT_MS = 30000; // 30s 内没 canplay 就判定失败，与 walkin.js 的加载超时同量级

  // 当前会话；null 表示没有影片在放。异步回调一律用 current !== session 判断
  // "自己是否已被关闭或被新会话取代"（沿用 walkin.js 的会话句柄手法）。
  var current = null;

  // 世代计数器：play() 的 probeAvailable() 是异步的，若探测仍在飞行时发生一次 close()
  // （Esc / 顶栏按钮 / 切场景…），close() 时会话可能还没建（探测还没回来），disposeCurrent
  // 此刻是空操作；随后探测一回来 start() 照样会建覆盖层——放映明明已经结束，却凭空升起
  // 一段 40-50 秒、导演模式下没有任何退出手段的全屏影片。close() 每次调用都递增世代号，
  // play() 探测前记下当时的世代，探测回来后世代若已变就放弃 start()。
  var generation = 0;

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
    generation++;
    disposeCurrent();
  }

  function isOpen() {
    return current !== null;
  }

  function setPaused(on) {
    if (!current) return;
    current.paused = !!on;
    if (!current.video) return;
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
      chapterId: chapterId, // I-1 音频回退要知道退到哪一章的 mp3
      timeoutHandle: null, onKeydown: null, onFocusIn: null, onMuted: null,
      paused: false   // 暂停意图。必须记在会话上而不是只对 video 调 pause()——
                       // 加载期间 video 还没起播，那时的 pause() 是空操作，
                       // 而 canplay 到来时会无条件起播，导致整场放映冻结着、影片却在演
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
      } else if (!okFlag) {
        // 手动模式（引言卡 ▶）没有调用方接管失败，必须自己退回音频——否则玩家按下按钮
        // 只得到一句报错，而改动前这个按钮必定会播 chNN.mp3，属功能倒退。close() 已在上面
        // 调过（duck(false)），playFor 自己会重新 duck，次序无冲突。
        if (window.SHY_APP && typeof window.SHY_APP.showToast === "function") {
          window.SHY_APP.showToast("开篇影片加载失败，改为播放解说");
        }
        if (window.SHY_VOICE && typeof window.SHY_VOICE.playFor === "function") {
          window.SHY_VOICE.playFor(session.chapterId);
        }
      }
    }

    // 起播逻辑抽成一个函数供两处共用：一处在 src 赋值后同步调用（保留 ▶ 点击带来的 user
    // activation——Safari/iOS 的媒体激活是 transient 的，推迟到异步的 canplay 回调里再调
    // play() 会丢失手势，未静音的 play() 因此被 NotAllowedError 拒绝，这是 Chrome 有 sticky
    // activation 兜底、三套自检全绿，但 Safari/iOS 上手动模式"按了没反应"的根因）；另一处
    // 在 canplay 里补播兜底。浏览器允许在 readyState 未就绪前调用 play()，它会排队等到可播
    // 时启动，手势因此得以保留。两处都靠 session.paused 守住暂停意图，拒绝时按 AbortError
    // 与真失败分流——AbortError 是 pause() 打断在途 play() 的正常结果，不是失败。
    function tryPlay(session, video) {
      if (session.paused) return;
      var p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(function (err) {
          if (err && err.name === "AbortError") return;
          settle(false);
        });
      }
    }

    video.addEventListener("ended", function () { settle(true); });
    video.addEventListener("error", function () { settle(false); });
    session.timeoutHandle = setTimeout(function () { settle(false); }, LOAD_TIMEOUT_MS);

    tryPlay(session, video); // 同步首次尝试：见上方 tryPlay 注释

    video.addEventListener("canplay", function () {
      if (current !== session) return;
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
        session.timeoutHandle = null;
      }
      loading.hidden = true;
      tryPlay(session, video); // 补播：见上方 tryPlay 注释
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
    var g = generation; // 记下发起探测时的世代
    return probeAvailable(chapterId).then(function (available) {
      if (g !== generation) return false; // 探测期间发生过 close()，放映已结束，不再起播
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

  window.SHY_CHAPTER_FILM = {
    probeAvailable: probeAvailable,
    open: open,
    play: play,
    close: close,
    isOpen: isOpen,
    setPaused: setPaused,
    debugState: debugState
  };
})();
