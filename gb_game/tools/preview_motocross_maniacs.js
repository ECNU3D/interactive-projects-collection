#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 motocross_maniacs.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(油门/起跳/落地/环形圈/翻转奖励/摔车复活/计时评级)做断言。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const W = 160, H = 144;
const PAL_HEX = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
const PAL_RGB = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];

/* ---- stub 2d context:把 fillRect 记进帧缓冲 ---- */
let fb = new Uint8Array(W * H);
const ctxStub = {
  fillStyle: PAL_HEX[3],
  imageSmoothingEnabled: false,
  fillRect(x, y, w, h) {
    const ci = PAL_HEX.indexOf(this.fillStyle);
    if (ci < 0) throw new Error('non-palette color: ' + this.fillStyle);
    x |= 0; y |= 0;
    for (let yy = y; yy < y + h; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || xx >= W) continue;
        fb[yy * W + xx] = ci;
      }
    }
  },
};
const canvasStub = { width: W, height: H, style: {}, getContext: () => ctxStub, addEventListener() {} };
const elStub = () => ({
  style: {}, offsetHeight: 120,
  classList: { add() {}, remove() {} },
  addEventListener() {}, getAttribute: () => 'x', setPointerCapture() {},
});
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Set, Map, Uint8Array,
  document: {
    getElementById: id => (id === 'gb' ? canvasStub : elStub()),
    querySelectorAll: () => [],
  },
  performance: { now: () => 0 },
  requestAnimationFrame: () => {},
  addEventListener() {},
  innerWidth: 800, innerHeight: 600,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(ROOT, 'motocross_maniacs.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
vm.runInContext(code, sandbox);
const T = sandbox.__test;

/* ---- 断言工具 ---- */
let failures = 0;
function ok(cond, msg) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg);
  if (!cond) failures++;
}
function pxCount() {
  let n = 0;
  for (let i = 0; i < fb.length; i++) if (fb[i] !== 3) n++;
  return n;
}
function angNorm(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/* ---- BMP 输出 ---- */
function writeBmp(name, scale = 4) {
  const w = W * scale, h = H * scale;
  const rowSize = w * 3, pad = (4 - (rowSize % 4)) % 4;
  const dataSize = (rowSize + pad) * h;
  const buf = Buffer.alloc(54 + dataSize);
  buf.write('BM');
  buf.writeUInt32LE(54 + dataSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);
  let o = 54;
  for (let y = h - 1; y >= 0; y--) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const c = PAL_RGB[fb[sy * W + ((x / scale) | 0)]];
      buf[o++] = c[2]; buf[o++] = c[1]; buf[o++] = c[0];
    }
    o += pad;
  }
  fs.writeFileSync(path.join(OUT, name + '.bmp'), buf);
}
function snap(name) { vm.runInContext('render()', sandbox); writeBmp(name); }
function steps(n) { for (let i = 0; i < n; i++) T.step(); }
function releaseAll() { for (const k in T.keys) T.key(k, false); }
function freshRace() { releaseAll(); T.startGame(); steps(1); }

/* 机器人:全程油门;空中 PD 调整姿态对准落点坡角;有氮气就用 */
function botFrame(useNitro) {
  const b = T.bike;
  T.key('a', true);
  if (b.mode === 'air') {
    const ahead = T.groundAt(b.x + Math.max(12, b.vx * 14));
    const d = angNorm(ahead.ang - b.th);
    T.key('right', d > 0.08);
    T.key('left', d < -0.08);
  } else {
    T.key('right', false); T.key('left', false);
    if (useNitro && T.nitro > 0 && b.mode === 'ground') T.key('up', true);
    else T.key('up', false);
  }
}

console.log('== 1. 标题画面 ==');
steps(5);
ok(T.game.state === T.ST.TITLE, 'boot -> TITLE');
snap('mm_01_title');
ok(pxCount() > 500, 'title screen has pixels (' + pxCount() + ')');

console.log('== 2. 开始游戏 / 油门加速 ==');
T.key('start', true); steps(2); T.key('start', false);
steps(2);
ok(T.game.state === T.ST.PLAY, 'start -> PLAY');
T.key('a', true);
steps(300);
ok(T.bike.mode === 'ground' || T.bike.mode === 'air', 'mode sane: ' + T.bike.mode);
ok(T.bike.x > 500, 'full throttle 300f: x=' + Math.round(T.bike.x) + ' (>500)');
ok(Math.abs(T.bike.v) > 1.2, 'bike has speed v=' + T.bike.v.toFixed(2));
snap('mm_02_run');

console.log('== 3. 空中起跳发生过(小丘腾跃) ==');
ok(T.loopDbg.entered === 0, 'no loop yet');

console.log('== 4. 环形圈:全速通过 ==');
freshRace();
T.setGround(1500, 3.2);
T.key('a', true);
let guard = 0;
let midLoopSnapped = false;
while (T.bike.x < 1700 && guard++ < 600 && T.game.state === T.ST.PLAY) {
  botFrame(false);
  steps(1);
  if (!midLoopSnapped && T.bike.mode === 'loop' && T.bike.phi < 0) {
    snap('mm_03_loop');                    // 上半圈倒挂着的一刻
    midLoopSnapped = true;
  }
}
releaseAll();
ok(T.loopDbg.entered >= 1, 'loop entered x' + T.loopDbg.entered);
ok(T.loopDbg.cleared >= 1, 'loop cleared x' + T.loopDbg.cleared + ' (fell x' + T.loopDbg.fell + ')');
ok(midLoopSnapped, 'rode the loop upper half');
ok(T.game.state === T.ST.PLAY, 'still racing after loop');

console.log('== 5. 环形圈:低速脱落 -> 摔车 ==');
freshRace();
T.setGround(1560, 2.6);
guard = 0;
while (T.game.state === T.ST.PLAY && guard++ < 400) steps(1);
ok(T.loopDbg.fell >= 1, 'slow loop entry -> fell x' + T.loopDbg.fell);
ok(T.game.state === T.ST.CRASH, 'state CRASH');
steps(30);
snap('mm_05_crash');

console.log('== 6. 摔车动画 2 秒后原地复活 ==');
const respX = T.crash.respawnX;
guard = 0;
while (T.game.state === T.ST.CRASH && guard++ < 200) steps(1);
ok(T.game.state === T.ST.PLAY, 'respawned -> PLAY');
ok(T.bike.mode === 'ground' && T.bike.v === 0, 'respawn on ground, v=0');
ok(Math.abs(T.bike.x - respX) < 1, 'respawn at flat spot x=' + Math.round(T.bike.x));

console.log('== 7. 完整翻转 360° -> 奖励氮气 ==');
freshRace();
T.setNitro(0);
T.setAir(2330, 70, 5.0, -3.0, -0.7);         // BIG AIR 跳台出口速度
guard = 0;
let landed = false;
while (guard++ < 120 && T.game.state === T.ST.PLAY) {
  const b = T.bike;
  if (b.mode === 'air') {
    /* 转满一圈且姿态回正就松手 */
    const need = b.rotAcc < 6.0 || angNorm(b.th) < -0.4;
    T.key('right', need);
  }
  steps(1);
  if (b.mode === 'ground') { landed = true; break; }
}
releaseAll();
ok(landed, 'flip landing survived (state ' + T.game.state + ')');
ok(T.game.nitroT > 0, 'flip reward: free nitro burst nitroT=' + T.game.nitroT);
snap('mm_04_air');

console.log('== 8. 氮气爆发提速 ==');
freshRace();
T.setGround(100, 2.0);
T.setNitro(2);
T.key('a', true);
T.key('up', true); steps(2); T.key('up', false);
steps(40);
ok(T.bike.v > T.consts.V_MAX + 0.3, 'nitro speed v=' + T.bike.v.toFixed(2) + ' > V_MAX+0.3');
ok(T.bike.v <= T.consts.V_NITRO + 0.01, 'nitro capped at V_NITRO v=' + T.bike.v.toFixed(2));
releaseAll();

console.log('== 9. 道具拾取(氮气瓶/时间瓶) ==');
freshRace();
T.setNitro(0);
T.setGround(690, 2.5);                        // 700 有氮气瓶
steps(30);
ok(T.nitro >= 1, 'nitro bottle picked: nitro=' + T.nitro);
const tl0 = T.timeLeft;
T.setGround(1190, 2.5);                       // 1200 有时间瓶
steps(30);
ok(T.timeLeft > tl0 - 30, 'time bottle +5s: ' + tl0 + ' -> ' + T.timeLeft);

console.log('== 10. 超时 -> TIME UP ==');
freshRace();
T.setTimeLeft(5);
steps(10);
ok(T.game.state === T.ST.OVER, 'time up -> OVER');
T.key('start', true); steps(50); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'OVER + start -> TITLE');

console.log('== 11. 机器人全程通关(限时内,物理不穿地) ==');
freshRace();
let crashes = 0, maxY = 0, tunnel = 0, flipRewarded = 0;
guard = 0;
let prevNitro = T.nitro;
while (guard++ < 60 * 90) {
  if (T.game.state === T.ST.FINISH) break;
  if (T.game.state === T.ST.OVER) break;
  if (T.game.state === T.ST.PLAY) {
    botFrame(true);
    const b = T.bike;
    if (b.mode === 'ground') {
      const gy = T.groundAt(b.x).y;
      if (Math.abs(b.y - gy) > 2) tunnel++;
      maxY = Math.max(maxY, b.y - gy);
    }
    if (T.nitro > prevNitro) flipRewarded++;
    prevNitro = T.nitro;
  } else if (T.game.state === T.ST.CRASH) {
    crashes++;
    releaseAll();
    steps(1);
    continue;
  }
  steps(1);
}
console.log('  bot: state=' + T.game.state + ' x=' + Math.round(T.bike.x) +
            ' raceT=' + (T.raceT / 60).toFixed(1) + 's timeLeft=' + (T.timeLeft / 60).toFixed(1) +
            's crashes=' + crashes + ' loopCleared=' + T.loopDbg.cleared +
            ' rating=' + T.game.rating);
ok(T.game.state === T.ST.FINISH, 'bot finished the race');
ok(tunnel === 0, 'no ground tunneling (' + tunnel + ')');
ok(T.loopDbg.cleared >= 1, 'bot cleared the loop');
ok(crashes <= 4, 'bot crashes reasonable (' + crashes + ')');
snap('mm_06_finish');

console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
