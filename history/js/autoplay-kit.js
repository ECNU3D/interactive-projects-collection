// js/autoplay-kit.js
// 《山河岁月》自动放映的公共原语：可暂停/可取消的时基，以及镜头环绕的缓动曲线。
// 提供 window.SHY_AUTOPLAY_KIT = { createClock(), isCancelledError(err), orbitEase(p) }
//
// 为什么不用裸 setTimeout 做等待：放映要支持"暂停 2 秒再继续，剩余时长不丢"。若用
// clearTimeout + 恢复时重开一个完整时长的定时器，每次暂停都会白等一遍全长；本模块改为
// 维护一条"有效时间轴"（暂停期间不累加），所有等待挂在这条时间轴的到期点上。
//
// 为什么缓动放在这里而不是各自的镜头实现里：js/choice.js（全景平移）与 js/walkin.js
// （泼溅相机 yaw）需要同一条曲线，两处各写一份必然漂移；而让镜头实现去依赖导演
// （js/autoplay.js）又是依赖倒置——镜头是被编排者，不该知道编排者的存在。

(function () {
  "use strict";

  var TICK_MS = 50;
  var EASE_EDGE = 0.12; // 两端各 12% 用于加减速

  function CancelledError() {
    this.name = "AutoplayCancelled";
    this.message = "autoplay cancelled";
  }
  CancelledError.prototype = Object.create(Error.prototype);
  CancelledError.prototype.constructor = CancelledError;

  function isCancelledError(err) {
    return !!err && err.name === "AutoplayCancelled";
  }

  // 位移曲线：速度在 [0, E] 由 0 平滑升到 V、在 [E, 1-E] 恒为 V、在 [1-E, 1] 平滑降回 0。
  // 令总位移恰为 1 可解出 V = 1/(1-E)：两段加减速各贡献 V·E/2，中段贡献 V·(1-2E)。
  // 端点精确（orbitEase(1) === 1）是硬要求——差一点点，全景就转不满一周、接缝会露出来。
  function orbitEase(p) {
    if (!(p > 0)) return 0;
    if (p >= 1) return 1;
    var E = EASE_EDGE;
    var V = 1 / (1 - E);
    if (p < E) {
      var x = p / E;
      // ∫₀ˣ smoothstep(u) du = x³ - x⁴/2，再乘以 E·V 换回真实尺度
      return V * E * (x * x * x - (x * x * x * x) / 2);
    }
    if (p > 1 - E) {
      var y = (1 - p) / E;
      return 1 - V * E * (y * y * y - (y * y * y * y) / 2);
    }
    return V * (E / 2 + (p - E));
  }

  function createClock() {
    var effectiveMs = 0; // 有效时间轴累计（暂停期间不增长）
    var lastTs = Date.now();
    var paused = false;
    var cancelled = false;
    var waiters = []; // { dueAt, resolve, reject }
    var pollers = []; // { predicate, nextPollAt, intervalMs, deadline, resolve, reject }

    var timer = setInterval(tick, TICK_MS);

    function tick() {
      var now = Date.now();
      var delta = now - lastTs;
      lastTs = now;
      if (paused || cancelled) return;
      // 后台标签页的 setInterval 被节流到约 1s：单次 delta 封顶，避免切回前台时一次性
      // 补跑一大段时间轴（连着触发好几个到期点，观感是"哗啦一下连跳几幕"）。
      if (delta > 250) delta = 250;
      effectiveMs += delta;
      fire();
    }

    function fire() {
      var i;
      for (i = waiters.length - 1; i >= 0; i--) {
        if (effectiveMs >= waiters[i].dueAt) waiters.splice(i, 1)[0].resolve();
      }
      for (i = pollers.length - 1; i >= 0; i--) {
        var po = pollers[i];
        if (effectiveMs >= po.nextPollAt) {
          po.nextPollAt = effectiveMs + po.intervalMs;
          var hit = false;
          try { hit = !!po.predicate(); } catch (e) { hit = false; }
          if (hit) { pollers.splice(i, 1); po.resolve(true); continue; }
        }
        if (effectiveMs >= po.deadline) { pollers.splice(i, 1); po.resolve(false); }
      }
    }

    function wait(msArg) {
      if (cancelled) return Promise.reject(new CancelledError());
      var d = Number(msArg) || 0;
      if (d <= 0) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        waiters.push({ dueAt: effectiveMs + d, resolve: resolve, reject: reject });
      });
    }

    function waitFor(predicate, opts) {
      if (cancelled) return Promise.reject(new CancelledError());
      opts = opts || {};
      var timeoutMs = opts.timeoutMs == null ? 180000 : opts.timeoutMs;
      var intervalMs = opts.intervalMs == null ? 100 : opts.intervalMs;
      var immediate = false;
      try { immediate = !!predicate(); } catch (e) { immediate = false; }
      if (immediate) return Promise.resolve(true);
      return new Promise(function (resolve, reject) {
        pollers.push({
          predicate: predicate,
          nextPollAt: effectiveMs + intervalMs,
          intervalMs: intervalMs,
          deadline: effectiveMs + timeoutMs,
          resolve: resolve,
          reject: reject
        });
      });
    }

    // 给任何外部 promise 套一个"有效时间"上限。用途：全景/泼溅的环绕 promise 靠 rAF 推进，
    // 而 rAF 在后台标签页会完全停摆——没有这层封顶，切走标签页就等于把放映永久挂死。
    function withCap(promise, capMs) {
      return Promise.race([
        Promise.resolve(promise),
        wait(capMs).then(function () { return undefined; })
      ]);
    }

    function cancel() {
      if (cancelled) return;
      cancelled = true;
      clearInterval(timer);
      timer = null;
      var pendingWaiters = waiters.splice(0, waiters.length);
      var pendingPollers = pollers.splice(0, pollers.length);
      pendingWaiters.forEach(function (w) { w.reject(new CancelledError()); });
      pendingPollers.forEach(function (po) { po.reject(new CancelledError()); });
    }

    return {
      wait: wait,
      waitFor: waitFor,
      withCap: withCap,
      now: function () { return effectiveMs; },
      pause: function () { paused = true; },
      resume: function () { paused = false; },
      isPaused: function () { return paused; },
      cancel: cancel,
      isCancelled: function () { return cancelled; }
    };
  }

  window.SHY_AUTOPLAY_KIT = {
    createClock: createClock,
    isCancelledError: isCancelledError,
    orbitEase: orbitEase
  };
})();
