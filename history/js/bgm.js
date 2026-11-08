// js/bgm.js
// 《山河岁月》背景音乐引擎——全局底乐 + 26 个抉择专属 BGM + 终章 BGM，全部预生成本地 mp3
// （assets/audio/bgm/），离线播放零运行期网络请求。双 <audio> 元素交替，实现曲目间 1s
// 交叉淡入淡出；语音解说播放时（narration.js 调用 _duck）临时把音量压到 0.08，解说结束
// 恢复 0.22。任一曲目文件缺失（onerror）静默降级、维持原曲目不变，绝不抛出未捕获异常。
//
// 提供 window.SHY_BGM = { start(), enterChoice(choiceId), leaveChoice(), enterEnding(), setMuted(b) }
// 首次用户手势自动启动全局 app.mp3（复用 audio.js 的手势解锁模式）。

(function () {
  "use strict";

  var BGM_DIR = "assets/audio/bgm/";
  var BASE_VOL = 0.22;
  var DUCK_VOL = 0.08;
  var CROSSFADE_MS = 1000;
  var DUCK_FADE_MS = 200;

  var players = [makePlayer(), makePlayer()];
  var activeIdx = 0;
  var currentKey = null; // 'app' | 'cNN' | 'ending' | null（静音期间仅记录，不真正播放）
  var muted = !!(window.SHY_AUDIO && window.SHY_AUDIO.muted);
  var ducked = false;
  var gestureBound = false;

  function makePlayer() {
    var el = new Audio();
    el.loop = true;
    el.volume = 0;
    el.preload = "auto";
    el._fadeRAF = null;
    return el;
  }

  function activePlayer() {
    return players[activeIdx];
  }
  function inactivePlayer() {
    return players[1 - activeIdx];
  }

  function bgmPath(key) {
    return BGM_DIR + key + ".mp3";
  }

  function targetVol() {
    return ducked ? DUCK_VOL : BASE_VOL;
  }

  function cancelFade(el) {
    if (el._fadeRAF) {
      try {
        window.cancelAnimationFrame(el._fadeRAF);
      } catch (e) {
        // 静默降级
      }
      el._fadeRAF = null;
    }
  }

  function fadeTo(el, target, ms, cb) {
    cancelFade(el);
    var startVol = el.volume;
    var startTs = null;
    function step(ts) {
      if (startTs == null) startTs = ts;
      var t = ms <= 0 ? 1 : Math.min(1, (ts - startTs) / ms);
      el.volume = startVol + (target - startVol) * t;
      if (t < 1) {
        el._fadeRAF = window.requestAnimationFrame(step);
      } else {
        el._fadeRAF = null;
        if (cb) cb();
      }
    }
    try {
      el._fadeRAF = window.requestAnimationFrame(step);
    } catch (e) {
      // 极端环境无 rAF：直接跳变，不阻塞主流程
      el.volume = target;
      if (cb) cb();
    }
  }

  function safePlay(el) {
    try {
      var p = el.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {
      // 静默降级
    }
  }

  // 切曲（crossfadeMs=0 为瞬切，用于首次启动/静音恢复等场景）。文件缺失时静默降级、
  // 维持当前活跃曲目不变（"缺失则维持全局"，若本身就是 app 则不再二次回退避免死循环）。
  function switchTo(key, crossfadeMs) {
    if (!key) return;
    if (muted) {
      currentKey = key;
      return;
    }
    if (currentKey === key && !activePlayer().paused) return;

    var incoming = inactivePlayer();
    var outgoing = activePlayer();
    var outgoingHadSrc = !!outgoing.src;

    incoming.onerror = function () {
      incoming.onerror = null;
      if (key !== "app") {
        switchTo("app", crossfadeMs);
      }
    };
    currentKey = key;
    activeIdx = 1 - activeIdx;

    incoming.src = bgmPath(key);
    incoming.currentTime = 0;
    incoming.volume = 0;
    safePlay(incoming);
    fadeTo(incoming, targetVol(), crossfadeMs);

    if (outgoingHadSrc) {
      fadeTo(outgoing, 0, crossfadeMs, function () {
        try {
          outgoing.pause();
        } catch (e) {
          // 静默降级
        }
      });
    }
  }

  function applyDuck() {
    if (muted) return;
    fadeTo(activePlayer(), targetVol(), DUCK_FADE_MS);
  }

  // ------------------------- 首次用户手势启动（复用 audio.js 的手势解锁模式） -------------------------

  function bindGestureStart() {
    if (gestureBound) return;
    gestureBound = true;
    var handler = function () {
      if (!muted) switchTo(currentKey || "app", 0);
    };
    try {
      document.addEventListener("pointerdown", handler, { once: true });
      document.addEventListener("keydown", handler, { once: true });
    } catch (e) {
      // 极端环境下 addEventListener 选项不支持时静默忽略
    }
  }

  function start() {
    currentKey = currentKey || "app";
    bindGestureStart();
    if (!muted) switchTo(currentKey, 0);
  }

  function enterChoice(choiceId) {
    if (!choiceId) return;
    switchTo(choiceId, CROSSFADE_MS);
  }

  function leaveChoice() {
    switchTo("app", CROSSFADE_MS);
  }

  function enterEnding() {
    switchTo("ending", CROSSFADE_MS);
  }

  function setMuted(b) {
    muted = !!b;
    if (muted) {
      players.forEach(function (p) {
        cancelFade(p);
        try {
          p.pause();
        } catch (e) {
          // 静默降级
        }
      });
    } else {
      switchTo(currentKey || "app", 0);
    }
  }

  // narration.js 调用的内部接口（非 shared-interfaces.md 强制契约）：语音解说播放期间
  // duck(true) 压低当前 BGM 音量至 0.08，结束/停止时 duck(false) 恢复。
  function duck(on) {
    ducked = !!on;
    applyDuck();
  }

  var SHY_BGM = {
    start: start,
    enterChoice: enterChoice,
    leaveChoice: leaveChoice,
    enterEnding: enterEnding,
    setMuted: setMuted,
    _duck: duck
  };
  // 非 shared-interfaces.md 强制契约的便利性暴露（呼应 choice.js 的 window.SHY_CHOICE.open
  // 先例），供调试/自动化测试观测当前曲目 key/音量/播放状态，不影响上面 5 个契约方法。
  Object.defineProperty(SHY_BGM, "current", {
    get: function () {
      var p = activePlayer();
      return { key: currentKey, volume: p.volume, paused: p.paused, src: p.src, muted: muted, ducked: ducked };
    }
  });
  window.SHY_BGM = SHY_BGM;

  // ------------------------- 事件接线 -------------------------

  document.addEventListener("shy:enter-choice", function (e) {
    var id = e && e.detail && e.detail.choiceId;
    if (id) enterChoice(id);
  });
  document.addEventListener("shy:choice-done", function () {
    leaveChoice();
  });
  document.addEventListener("shy:enter-ending", function () {
    enterEnding();
  });
  // 静音统一：js/audio.js 的 setMuted() 派发本事件（见该文件改动）。
  document.addEventListener("shy:muted-changed", function (e) {
    setMuted(!!(e && e.detail && e.detail.muted));
  });

  bindGestureStart();
  start();
})();
