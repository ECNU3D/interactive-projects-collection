// js/audio.js
// 《山河岁月》Web Audio 合成音效——不加载任何音频文件，全部实时合成。
// 提供 window.SHY_AUDIO = { init(), play(name), setMuted(b), muted }
// name ∈ page（翻页）| unlock（节点解锁）| correct（答对）| wrong（答错）| ending（终章）
// 设置持久化于 localStorage「shanhe_settings_v1」（JSON { muted }）。
//
// 设计克制：master gain ≤0.25；muted 时 play() 直接短路，不创建任何音频节点；
// AudioContext 不可用（老浏览器/权限受限/file:// 极端环境）时任何操作静默降级，绝不抛错。

(function () {
  "use strict";

  var SETTINGS_KEY = "shanhe_settings_v1";

  // 五声音阶（宫商角徵羽）常用音高，供 unlock/correct/ending 取用
  var NOTE = {
    GONG3: 261.63,  // 宫 C4
    SHANG3: 293.66, // 商 D4
    JIAO3: 329.63,  // 角 E4
    ZHI3: 392.0,    // 徵 G4
    YU3: 440.0,     // 羽 A4
    GONG4: 523.25,  // 宫 C5
    ZHI4: 783.99     // 徵 G5
  };

  var ctx = null;
  var masterGain = null;
  var muted = false;
  var gestureBound = false;

  // ------------------------- 设置读写（shanhe_settings_v1） -------------------------

  function loadSettings() {
    try {
      var raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function persistMuted(b) {
    try {
      var settings = loadSettings();
      settings.muted = !!b;
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // file:// 协议下 localStorage 可能受限，静默失败
    }
  }

  // ------------------------- AudioContext 生命周期 -------------------------

  function ensureContext() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.2; // 总音量克制，≤0.25
      masterGain.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      masterGain = null;
    }
    return ctx;
  }

  function init() {
    try {
      var c = ensureContext();
      if (c && c.state === "suspended" && typeof c.resume === "function") {
        var result = c.resume();
        if (result && typeof result.catch === "function") result.catch(function () {});
      }
    } catch (e) {
      // 静默降级
    }
  }

  // 首次用户手势自动解锁 AudioContext（浏览器自动播放策略要求）
  function bindGestureUnlock() {
    if (gestureBound) return;
    gestureBound = true;
    var handler = function () {
      init();
    };
    try {
      document.addEventListener("pointerdown", handler, { once: true });
      document.addEventListener("keydown", handler, { once: true });
    } catch (e) {
      // 极端环境下 addEventListener 选项不支持时静默忽略
    }
  }

  // ------------------------- 包络与基础音块工具 -------------------------

  // 短促起音 + 指数衰减的增益包络（打击/拨弦类音色的通用形状）
  function pluckEnvelope(gainNode, startTime, peak, attack, decayTo) {
    var g = gainNode.gain;
    g.cancelScheduledValues(startTime);
    g.setValueAtTime(0.0001, startTime);
    g.linearRampToValueAtTime(peak, startTime + attack);
    g.exponentialRampToValueAtTime(0.0001, startTime + decayTo);
  }

  // 生成一段淡出的白噪声 BufferSource（未 start()，调用方自行调度）
  function makeNoiseBurst(c, duration) {
    var size = Math.max(1, Math.floor(c.sampleRate * duration));
    var buffer = c.createBuffer(1, size, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    }
    var src = c.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  // 单个编钟/古琴风格音块：正弦主音 + 三角泛音叠加，用于 unlock/correct/ending
  function bellTone(c, dest, startTime, freq, dur, peak) {
    peak = peak == null ? 0.5 : peak;
    var osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    var oscGain = c.createGain();
    pluckEnvelope(oscGain, startTime, peak, 0.015, dur);
    osc.connect(oscGain).connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);

    var overtone = c.createOscillator();
    overtone.type = "triangle";
    overtone.frequency.value = freq * 2;
    var overtoneGain = c.createGain();
    pluckEnvelope(overtoneGain, startTime, peak * 0.3, 0.015, dur * 0.6);
    overtone.connect(overtoneGain).connect(dest);
    overtone.start(startTime);
    overtone.stop(startTime + dur + 0.05);
  }

  // ------------------------- 各音效实现 -------------------------

  // page：翻页——短白噪声 burst 经带通滤波，模拟纸卷沙沙声（~120ms）
  function soundPage(c) {
    var t = c.currentTime;
    var dur = 0.12;
    var noise = makeNoiseBurst(c, dur);
    var bandpass = c.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 3000;
    bandpass.Q.value = 0.7;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bandpass).connect(g).connect(masterGain);
    noise.start(t);
    noise.stop(t + dur + 0.02);
  }

  // unlock：节点解锁——五声音阶单音清音（宫音 C5，正弦+泛音，轻微 decay，~300ms）
  function soundUnlock(c) {
    var t = c.currentTime;
    bellTone(c, masterGain, t, NOTE.GONG4, 0.3, 0.5);
  }

  // correct：答对——编钟双音（宫+徵），错落 80ms，余韵 1s
  function soundCorrect(c) {
    var t = c.currentTime;
    bellTone(c, masterGain, t, NOTE.GONG4, 1.0, 0.5);
    bellTone(c, masterGain, t + 0.08, NOTE.ZHI4, 1.0, 0.42);
  }

  // wrong：答错——低频沉鼓，90Hz 快速 pitch drop + 短噪声，~400ms，庄重不刺耳
  function soundWrong(c) {
    var t = c.currentTime;
    var dur = 0.4;

    var osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.32);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);

    var burstDur = 0.06;
    var noise = makeNoiseBurst(c, burstDur);
    var lowpass = c.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 280;
    var ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.4, t + 0.005);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + burstDur);
    noise.connect(lowpass).connect(ng).connect(masterGain);
    noise.start(t);
    noise.stop(t + burstDur + 0.02);
  }

  // ending：终章——宫商角徵羽五音上行琶音，庄重缓释，约 3 秒
  function soundEnding(c) {
    var t = c.currentTime;
    var notes = [NOTE.GONG3, NOTE.SHANG3, NOTE.JIAO3, NOTE.ZHI3, NOTE.YU3];
    var step = 0.3;
    notes.forEach(function (freq, i) {
      var start = t + i * step;
      var isLast = i === notes.length - 1;
      bellTone(c, masterGain, start, freq, isLast ? 1.6 : 0.9, isLast ? 0.5 : 0.4);
      if (isLast) {
        // 主音高八度叠一层泛音，收束更显庄重
        bellTone(c, masterGain, start, freq * 2, 1.4, 0.18);
      }
    });
  }

  var SOUND_MAP = {
    page: soundPage,
    unlock: soundUnlock,
    correct: soundCorrect,
    wrong: soundWrong,
    ending: soundEnding
  };

  // ------------------------- 对外接口 -------------------------

  function play(name) {
    // 双读：闭包 muted 与对外属性 SHY_AUDIO.muted 任一为真即短路，
    // 防御外部直赋 SHY_AUDIO.muted=true 而未走 setMuted() 的不同步场景
    if (muted || (SHY_AUDIO && SHY_AUDIO.muted)) return;
    var fn = SOUND_MAP[name];
    if (!fn) return;
    try {
      var c = ensureContext();
      if (!c || !masterGain) return;
      // suspended 时钟上调度的音会滞留到首次手势时"凭空"补播——静默跳过
      if (c.state !== "running") return;
      fn(c);
    } catch (e) {
      // AudioContext/节点创建失败等异常场景：静默降级，绝不向上抛错
    }
  }

  function setMuted(b) {
    muted = !!b;
    SHY_AUDIO.muted = muted;
    persistMuted(muted);
    // 静音统一：js/narration.js、js/bgm.js 监听本事件同步停解说/暂停或恢复BGM，
    // 与 audio.js 自身的静音短路（play() 内的双读检查）解耦，互不依赖加载顺序。
    try {
      document.dispatchEvent(new CustomEvent("shy:muted-changed", { detail: { muted: muted } }));
    } catch (e) {
      // 极端环境下 CustomEvent 不可用时静默降级
    }
  }

  var SHY_AUDIO = {
    init: init,
    play: play,
    setMuted: setMuted,
    muted: false
  };
  window.SHY_AUDIO = SHY_AUDIO;

  // 启动时读取已持久化的静音设置
  muted = !!loadSettings().muted;
  SHY_AUDIO.muted = muted;

  bindGestureUnlock();
})();
