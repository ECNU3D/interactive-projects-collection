// js/narration.js
// 《山河岁月》语音解说播放器——预生成的本地 mp3（assets/audio/narration/<id>.mp3），
// 全部离线播放，不发任何运行期网络请求。单实例 Audio，播放前把 SHY_BGM duck 到 0.08，
// 结束/停止后恢复。文件缺失（onerror）静默降级，绝不抛出未捕获异常。
//
// 提供 window.SHY_VOICE = { playFor(id), replay(), stop(), current }
// id ∈ 事件id（e0101…）| 抉择id（c01…）| 章节id（ch01…），对应
// assets/audio/narration/<id>.mp3。current 为当前播放的 <audio> 元素（无播放时为 null）。

(function () {
  "use strict";

  var NARRATION_DIR = "assets/audio/narration/";

  var SHY_VOICE = {
    playFor: playFor,
    replay: replay,
    stop: stop,
    current: null
  };
  window.SHY_VOICE = SHY_VOICE;

  var currentId = null;

  function narrationPath(id) {
    return NARRATION_DIR + id + ".mp3";
  }

  function isMuted() {
    return !!(window.SHY_AUDIO && window.SHY_AUDIO.muted);
  }

  function duckBgmSafe(on) {
    if (window.SHY_BGM && typeof window.SHY_BGM._duck === "function") {
      try {
        window.SHY_BGM._duck(on);
      } catch (e) {
        // 静默降级
      }
    }
  }

  // 停止当前解说播放（若有），并恢复 BGM 音量。所有关闭路径（关卡/继续前行/静音/
  // 切换到新的解说前）均经此函数，保证状态单点收敛。
  function stop() {
    var audio = SHY_VOICE.current;
    if (audio) {
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      } catch (e) {
        // 静默降级
      }
    }
    var hadAudio = !!audio;
    SHY_VOICE.current = null;
    currentId = null;
    if (hadAudio) duckBgmSafe(false);
  }

  function playFor(id) {
    stop();
    if (!id || isMuted()) return;
    var audio;
    try {
      audio = new Audio(narrationPath(id));
    } catch (e) {
      // 极端环境下 Audio 构造失败：静默降级
      return;
    }
    audio.preload = "auto";
    currentId = id;
    SHY_VOICE.current = audio;
    duckBgmSafe(true);

    audio.addEventListener("ended", function () {
      if (SHY_VOICE.current === audio) {
        SHY_VOICE.current = null;
        currentId = null;
        duckBgmSafe(false);
      }
    });
    audio.addEventListener("error", function () {
      // 文件缺失/解码失败等：静默降级，不向上抛错
      if (SHY_VOICE.current === audio) {
        SHY_VOICE.current = null;
        currentId = null;
        duckBgmSafe(false);
      }
    });

    try {
      var p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          // 自动播放被浏览器拒绝等：静默降级，不抛出未捕获的 promise rejection
        });
      }
    } catch (e) {
      // 静默降级
    }
  }

  function replay() {
    var audio = SHY_VOICE.current;
    if (!audio || !currentId) return;
    try {
      audio.currentTime = 0;
      var p = audio.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {
      // 静默降级
    }
  }

  // 静音统一：js/audio.js 的 setMuted() 派发本事件（见该文件改动），静音时立即停止解说。
  document.addEventListener("shy:muted-changed", function (e) {
    if (e && e.detail && e.detail.muted) stop();
  });
})();
