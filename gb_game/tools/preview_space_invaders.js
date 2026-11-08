#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 space_invaders.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP/PNG 供人工检查,
 * 并对核心规则(编队步进/触边下移/越少越快/分行计分/掩体像素破坏/炸弹/
 * 飞碟随机分/碎裂动画/入侵判负/波次刷新更低)做断言。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

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

const html = fs.readFileSync(path.join(ROOT, 'space_invaders.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
vm.runInContext(code, sandbox);
const T = sandbox.__test;

/* ---- 断言工具 ---- */
let failures = 0;
function ok(cond, msg) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg);
  if (!cond) failures++;
}
function px(x, y) { return fb[y * W + x]; }

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
/* ---- PNG 输出(便于直接查看) ---- */
const CRC_T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_T[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(name, scale = 4) {
  const w = W * scale, h = H * scale;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (1 + w * 3));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    const sy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const c = PAL_RGB[fb[sy * W + ((x / scale) | 0)]];
      raw[o++] = c[0]; raw[o++] = c[1]; raw[o++] = c[2];
    }
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(OUT, name + '.png'), png);
}
function snap(name) { T.render(); writeBmp(name); writePng(name); }
function steps(n) { for (let i = 0; i < n; i++) T.step(); }
function countPx(x0, y0, w, h, color) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (px(x, y) === color) n++;
  return n;
}
/* 开一局并快进到 PLAY 状态 */
function gotoPlay() {
  T.newGame();
  steps(90);                                     // CARD -> PLAY
}

/* ================= 1. 标题画面 ================= */
console.log('== 1. title ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
while (T.game.frame % 32 >= 16) steps(1);        // 对齐到 PRESS START 可见相位
snap('s01_title');
ok(countPx(36, 126, 88, 8, 0) > 30, 'PRESS START visible phase draws pixels');
ok(countPx(16, 32, 128, 16, 0) > 100, 'big INVADERS title drawn');
ok(countPx(16, 76, 16, 8, 0) > 10, 'UFO sprite shown in score table');
steps(16);
T.render();
ok(countPx(36, 126, 88, 8, 0) === 0, 'PRESS START blink hidden phase is blank');

/* ================= 2. 开始:WAVE 卡 -> 编队进场 ================= */
console.log('== 2. start / wave card ==');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.CARD, 'START enters WAVE card');
snap('s02_card');
steps(90);
ok(T.game.state === T.ST.PLAY, 'CARD -> PLAY after 90 frames');
ok(T.alive === 55, '5x11 formation = 55 aliens, alive=' + T.alive);
ok(T.fx === T.FX0 && T.fy === T.FY0, 'formation origin ' + T.fx + ',' + T.fy);
snap('s03_play');
ok(countPx(2, 0, 40, 8, 0) > 10, 'HUD SCORE label drawn');
ok(px(12, 26) === 0, 'squid (top row) pixel drawn');
ok(px(22, 38) === 0, 'crab (2nd row) pixel drawn');
ok(countPx(18, 104, 18, 12, 1) > 150, 'shield 0 drawn in mid shade');
ok(countPx(6, 140, 7, 3, 0) > 5, 'lives mini-cannon drawn');

/* ================= 3. 炮台移动与边界 ================= */
console.log('== 3. player movement ==');
const px0 = T.player.x;
T.key('left', true); steps(10);
ok(T.player.x < px0, 'player moves left while held');
steps(200); T.key('left', false);
ok(Math.abs(T.player.x - T.X_MIN) < 0.01, 'player clamps at left edge, x=' + T.player.x);
T.key('right', true); steps(400); T.key('right', false);
ok(Math.abs(T.player.x - (T.X_MAX - 13)) < 0.01, 'player clamps at right edge, x=' + T.player.x);

/* ================= 4. 射击:同屏 1 发 ================= */
console.log('== 4. fire / single bullet ==');
T.player.x = 73;
T.bombs.length = 0;                              // 清场,避免随机炸弹干扰断言
T.key('a', true); T.step();
ok(T.bullet.active, 'A fires the bullet');
ok(T.bullet.x === 79 && T.bullet.y === 116, 'bullet spawns at muzzle and climbs same frame');
const by0 = T.bullet.y;
T.bombs.length = 0; T.step();
T.bombs.length = 0; T.step();
ok(T.bullet.active && T.bullet.y === by0 - 8, 'bullet climbs 4px/frame, still only one shot');
T.key('a', false);

/* ================= 5. 击中外星人:计分 + 闪爆 + 爆裂帧 ================= */
console.log('== 5. alien hit ==');
T.setAlienTimer(999);                            // 冻结编队,方便断言
const ax = T.fx + 5 * T.PITCHX, ay = T.fy + 4 * T.PITCHY; // 底行 c5
const s0 = T.game.score;
T.bullet.active = true; T.bullet.x = ax + 5; T.bullet.y = ay + 4;
steps(1);
ok(T.alive === 54, 'hit removes one alien, alive=' + T.alive);
ok(T.game.score - s0 === 10, 'bottom row scores 10, delta=' + (T.game.score - s0));
ok(!T.bullet.active, 'bullet consumed on hit');
ok(T.explosions.length === 1 && T.explosions[0].t === 8, 'explosion starts at flash frame');
T.render();
ok(countPx(ax, ay, 11, 8, 2) > 10, 'white flash (light shade) drawn for 1 frame');
steps(1);
T.render();
ok(countPx(ax, ay, 11, 8, 0) > 5 && countPx(ax, ay, 11, 8, 2) === 0, 'flash -> explosion sprite next frame');
snap('s04_explosion');
steps(8);
ok(T.explosions.length === 0, 'explosion expires');
/* 分行计分 */
const s1 = T.game.score;
T.killAlien(0, 0);
ok(T.game.score - s1 === 30, 'top row (squid) scores 30');
const s2 = T.game.score;
T.killAlien(1, 0);
ok(T.game.score - s2 === 20, 'middle row (crab) scores 20');

/* ================= 6. 编队步进 / 心跳 / 触边下移 ================= */
console.log('== 6. formation step ==');
gotoPlay();
const fx0 = T.fx, sc0 = T.stepC;
T.setAlienTimer(1);
steps(1);
ok(T.fx === fx0 + 2 && T.anim === 1, 'formation steps 2px and toggles anim frame');
ok(T.stepC === sc0 + 1, 'heartbeat note counter advances each step');
ok(T.stepInterval() === 30, 'interval with 55 alive = 30 frames, got ' + T.stepInterval());
/* 触边:右界 156,编队宽 131,fx=24 时右沿 155,再走一步必下移反向 */
T.setFormation(24, 26, 1);
T.stepAliens();
ok(T.fy === 34 && T.fdir === -1 && T.fx === 24, 'edge -> descend 8px and reverse');
snap('s05_descend');

/* ================= 7. 越少越快(心跳加速机制) ================= */
console.log('== 7. speed-up ==');
T.killAllBut(5);
ok(T.stepInterval() === 3, '5 alive -> interval 3, got ' + T.stepInterval());
T.killAllBut(1);
ok(T.stepInterval() === 1, 'last alien -> interval 1 (nearly teleporting)');

/* ================= 8. 掩体:像素级破坏 ================= */
console.log('== 8. shields ==');
gotoPlay();
ok(T.shields.length === 4, '4 shields');
ok(T.shieldPixelCount(0) === 178, 'fresh shield has 178 solid pixels, got ' + T.shieldPixelCount(0));
/* 玩家子弹打进掩体底部 */
const full = T.shieldPixelCount(0);
T.bullet.active = true; T.bullet.x = 20; T.bullet.y = 116; // 掩体 0 左下角实心区
steps(1);
ok(!T.bullet.active, 'bullet dies inside shield');
ok(T.shieldPixelCount(0) < full, 'shield eroded by player shot: ' + full + ' -> ' + T.shieldPixelCount(0));
/* 炸弹砸进掩体顶部 */
const full1 = T.shieldPixelCount(1);
T.bombs.push({ x: 62, y: 98 });                // 掩体 1 (x54..72) 上方
steps(4);
ok(T.shieldPixelCount(1) < full1, 'shield eroded by alien bomb: ' + full1 + ' -> ' + T.shieldPixelCount(1));
snap('s06_shields');
/* 外星人压过掩体,把覆盖像素磨掉 */
gotoPlay();
T.killAllBut(0);
T.aliens[4][5] = 1; T.recount();               // 只留底行中间 1 个
T.setFormation(8, 52, 1);                      // 底行 y=100..108,压到掩体顶 104
const beforeErode = T.shieldPixelCount(0) + T.shieldPixelCount(1);
T.stepAliens();
const afterErode = T.shieldPixelCount(0) + T.shieldPixelCount(1);
ok(afterErode < beforeErode, 'aliens grind through shields: ' + beforeErode + ' -> ' + afterErode);

/* ================= 9. 炸弹命中炮台:碎裂 -> 扣命 -> 重生 ================= */
console.log('== 9. player death ==');
gotoPlay();
T.player.x = 73;
T.bombs.push({ x: 76, y: 116 });               // 正对炮台,掩体缝隙(x72..90)
steps(1);
ok(T.game.state === T.ST.DYING, 'bomb hit -> DYING (crack animation)');
snap('s07_dying');
steps(80);
ok(T.game.lives === 2 && T.game.state === T.ST.PLAY, 'death costs 1 life, respawn in PLAY');
ok(T.bombs.length === 0, 'bombs cleared on respawn');
/* 最后一条命 -> GAME OVER */
T.game.lives = 1;
T.player.x = 73;
T.bombs.push({ x: 76, y: 116 });
steps(1);
steps(80);
ok(T.game.state === T.ST.OVER, 'last life lost -> GAME OVER');
while (T.game.frame % 32 >= 16) steps(1);
snap('s08_over');
ok(countPx(44, 44, 72, 8, 3) > 50, 'GAME OVER text drawn');
steps(40);
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'PRESS START returns to TITLE');

/* ================= 10. 神秘飞碟 ================= */
console.log('== 10. ufo ==');
gotoPlay();
T.forceUfo(1);
steps(20);
ok(T.ufo.active && T.ufo.x > -13, 'ufo crosses from the left, x=' + T.ufo.x);
snap('s09_ufo');
ok(countPx(Math.max(0, T.ufo.x), T.UFO_Y, 13, 7, 0) > 10, 'ufo sprite drawn');
const su = T.game.score;
T.bullet.active = true; T.bullet.x = T.ufo.x + 6; T.bullet.y = T.UFO_Y + 2;
steps(1);
const du = T.game.score - su;
ok(du >= 50 && du <= 300 && du % 50 === 0, 'ufo score is 50..300 step 50, got ' + du);
ok(!T.ufo.active, 'ufo destroyed');
ok(T.popups.length === 1, 'score popup shown');

/* ================= 11. 入侵:外星人压到玩家行 ================= */
console.log('== 11. invasion ==');
gotoPlay();
T.killAllBut(0);
T.aliens[4][5] = 1; T.recount();               // 只留底行 1 个
T.setFormation(8, 70, 1);                      // 底行 y=118..126,已压玩家行
T.stepAliens();
ok(T.game.state === T.ST.OVER, 'aliens reaching player row -> GAME OVER');

/* ================= 12. 清波刷新:起始位置更低,掩体不修复 ================= */
console.log('== 12. next wave ==');
gotoPlay();
T.shields[0].px.fill(0);                        // 手动打烂掩体 0
T.killAllBut(1);
T.killAlien(0, 0);                              // 清空全场
steps(1);
ok(T.game.state === T.ST.CARD && T.game.wave === 2, 'wave cleared -> WAVE 2 card');
steps(90);
ok(T.game.state === T.ST.PLAY && T.fy === 34, 'wave 2 starts 8px lower, fy=' + T.fy);
ok(T.shieldPixelCount(0) === 0, 'shields NOT repaired between waves');
ok(T.alive === 55, 'full 55-alien formation respawned');
snap('s10_wave2');
/* 新开局才修复掩体 */
T.newGame();
ok(T.shieldPixelCount(0) === 178, 'new credit restores shields');

/* ================= 13. 机器人实战 6000 帧 ================= */
console.log('== 13. bot play ==');
T.newGame();
let overs = 0, finiteOK = true, boundsOK = true, rng = 12345;
function rnd() { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; }
for (let f = 0; f < 6000; f++) {
  const g = T.game;
  if (g.state === T.ST.TITLE) { T.key('start', true); T.step(); T.key('start', false); continue; }
  if (g.state === T.ST.OVER) {
    if (g.overT > 31) { overs++; T.key('start', true); T.step(); T.key('start', false); continue; }
  }
  if (g.state === T.ST.PLAY) {
    if (f % 17 === 0) {                          // 换个方向乱走 + 按住连发
      const r = rnd();
      T.key('left', r < 0.4);
      T.key('right', r >= 0.4 && r < 0.8);
    }
    T.key('a', true);
  }
  T.step();
  const b = T.bullet, p = T.player;
  if (!isFinite(p.x) || !isFinite(b.y)) finiteOK = false;
  if (p.x < T.X_MIN - 0.01 || p.x > T.X_MAX - 13 + 0.01) boundsOK = false;
  if (b.active && (b.y < 6 || b.y > T.PLAYER_Y)) boundsOK = false;
  for (const bb of T.bombs) if (bb.y < 0 || bb.y > H) boundsOK = false;
}
T.key('a', false); T.key('left', false); T.key('right', false);
ok(finiteOK, 'all physics stay finite for 6000 frames');
ok(boundsOK, 'player/bullet/bombs stay in bounds');
ok(T.game.score > 0 || overs > 0, 'bot fought waves, score=' + T.game.score + ' overs=' + overs);
console.log('  bot: overs=' + overs + ' score=' + T.game.score + ' wave=' + T.game.wave + ' alive=' + T.alive);
snap('s11_bot');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
