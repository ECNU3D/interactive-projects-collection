#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 tetris.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(7-bag/踢墙/消行计分/升级/Game Over/火箭彩蛋)做断言。 */
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
  console, Math, JSON, Object, Array, String, Number, Set, Map,
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

const html = fs.readFileSync(path.join(ROOT, 'tetris.html'), 'utf8');
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
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
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
function snap(name) { T.render(); writeBmp(name); }
function steps(n) { for (let i = 0; i < n; i++) T.step(); }
function countPx(x0, y0, w, h, color) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (px(x, y) === color) n++;
  return n;
}

/* ================= 1. 标题画面 ================= */
console.log('== 1. title ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
while (T.game.frame % 32 >= 16) steps(1);      // 对齐到 PRESS START 可见相位
snap('t01_title');
ok(countPx(40, 66, 32, 8, 0) > 30, 'PRESS START visible phase draws pixels');
steps(16);                                     // 进入隐藏相位
T.render();
ok(countPx(40, 66, 32, 8, 0) === 0, 'PRESS START blink hidden phase is blank');

/* ================= 2. 开始游戏 ================= */
console.log('== 2. start ==');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.PLAY, 'START enters PLAY');
ok(!!T.cur, 'a piece is falling');
snap('t02_spawn');

/* ================= 3. 7-bag ================= */
console.log('== 3. 7-bag ==');
T.startGame();
const bag1 = [T.cur.p, T.nextId];             // 已抽出的两个也属于第一袋
for (let i = 0; i < 5; i++) bag1.push(T.nextFromBag());   // 抽空第一袋
const bag2 = [];
for (let i = 0; i < 7; i++) bag2.push(T.nextFromBag());   // 第二袋
ok(new Set(bag1).size === 7, 'first bag contains all 7 pieces: ' + bag1.join(','));
ok(new Set(bag2).size === 7, 'second bag contains all 7 pieces: ' + bag2.join(','));

/* ================= 4. 移动 + 按住连发(DAS) ================= */
console.log('== 4. movement / DAS ==');
T.startGame();
T.setNext(2); T.spawnNext();                   // T 块,x=3
T.key('right', true); steps(1);
ok(T.cur.x === 4, 'tap right moves 1 cell immediately');
steps(12);
ok(T.cur.x === 5, 'DAS repeat fires after 12 frames');
steps(3);
ok(T.cur.x === 6, 'DAS repeats every 3 frames');
T.key('right', false);
T.key('left', true); steps(60); T.key('left', false);
ok(T.cur.x === 0, 'left wall stops piece at x=0 (no tunneling), x=' + T.cur.x);

/* ================= 5. 旋转 + 踢墙 ================= */
console.log('== 5. rotation / wall kick ==');
T.startGame();
T.setCur(2, 0, 3, 0);                          // T 块
T.key('a', true); steps(1); T.key('a', false);
ok(T.cur.r === 1, 'X(A) rotates clockwise');
T.key('b', true); steps(1); T.key('b', false);
ok(T.cur.r === 0, 'Z(B) rotates counter-clockwise');
T.setCur(0, 1, 7, 5);                          // 竖 I 贴右墙(col 9)
T.key('a', true); steps(1); T.key('a', false);
ok(T.cur.r === 2 && T.cur.x === 6, 'CW rotation at right wall kicks 1 cell (x=7->6, r=2), got x=' + T.cur.x + ' r=' + T.cur.r);

/* ================= 6. 硬降 + 单行消除 ================= */
console.log('== 6. single line clear ==');
T.startGame();
for (let c = 4; c < 10; c++) T.setCell(c, 17, 1);
T.setNext(0); T.spawnNext();                   // I
T.key('left', true); steps(40); T.key('left', false);  // 推到最左
ok(T.cur.p === 0 && T.cur.x === 0, 'I piece pushed to far left');
T.key('up', true); steps(1); T.key('up', false);       // 硬降
ok(!!T.clearing, 'hard drop locks and full row enters flash');
steps(3);
snap('t03_flash');
ok(T.grid[17].every(v => v) && countPx(8, 17 * 8, 80, 8, 3) === 640, 'row flashes white during clear');
steps(27);
ok(T.grid[17].every(v => v === 0), 'row removed after 3 flashes');
ok(T.game.lines === 1, 'LINES = 1');
ok(T.game.score === 40, 'single = 40 x (level 0 + 1), score=' + T.game.score);

/* ================= 7. 等级倍率计分 ================= */
console.log('== 7. score multiplier ==');
T.game.level = 2;
for (let c = 4; c < 10; c++) T.setCell(c, 17, 1);
T.setCur(0, 0, 0, 16); T.lockPiece();
steps(31);
ok(T.game.score === 40 + 120, 'single at level 2 = 40 x 3, total=' + T.game.score);

/* ================= 8. 四消 Tetris + 震动 ================= */
console.log('== 8. tetris ==');
T.startGame();
for (let r = 14; r < 18; r++)
  for (let c = 1; c < 10; c++) T.setCell(c, r, 1);
T.setCur(0, 1, -2, 14);                        // 竖 I 填 col 0 的 rows 14..17
T.lockPiece();
ok(T.clearing && T.clearing.rows.length === 4, '4 rows detected');
steps(31);
ok(T.game.lines === 4, 'LINES = 4');
ok(T.game.score === 1200, 'tetris = 1200 x (level 0 + 1), score=' + T.game.score);
ok(T.shake > 0, 'screen shake active after tetris');
ok(T.grid.every(row => row.every(v => v === 0)), 'all 4 rows collapsed away');

/* ================= 9. 速度表 + 升级 ================= */
console.log('== 9. speed / level up ==');
ok(T.speedFor(0) === 48, 'level 0 = 48 frames (~800ms)');
ok(T.speedFor(9) === 6 && T.speedFor(15) === 6, 'level 9+ = 6 frames (~100ms)');
T.game.lines = 9; T.game.score = 0;
for (let c = 4; c < 10; c++) T.setCell(c, 17, 1);
T.setCur(0, 0, 0, 16); T.lockPiece();
steps(31);
ok(T.game.lines === 10 && T.game.level === 1, '10 lines -> level 1');
ok(T.game.score === 40, 'scored with pre-clear level 0, score=' + T.game.score);

/* ================= 10. Game Over 填灰动画 ================= */
console.log('== 10. game over fill ==');
T.startGame();
for (let c = 3; c <= 6; c++) { T.setCell(c, 0, 1); T.setCell(c, 1, 1); }
T.spawnNext();                                  // 出生点被堵
ok(T.game.state === T.ST.FILL, 'blocked spawn enters FILL animation');
steps(3);
ok(T.grid[17].every(v => v === 8) && T.grid[16].every(v => v !== 8), 'fills bottom row first');
steps(27);
snap('t04_overfill');
steps(24 + 19);
ok(T.grid.every(row => row.every(v => v === 8)), 'all 18 rows filled with gray blocks');
ok(T.game.state === T.ST.OVER, 'low score goes straight to OVER (no rocket)');
snap('t05_over');
ok(countPx(44, 44, 72, 8, 3) > 50, 'GAME OVER text drawn');

/* ================= 11. 火箭彩蛋(>10000 分) ================= */
console.log('== 11. rocket easter egg ==');
T.startGame();
T.game.score = 20000;
for (let c = 3; c <= 6; c++) { T.setCell(c, 0, 1); T.setCell(c, 1, 1); }
T.spawnNext();
steps(54 + 20);
ok(T.game.state === T.ST.ROCKET, 'score > 10000 triggers rocket');
steps(45);                                     // 火箭飞到屏幕中段
snap('t06_rocket');
steps(75);
ok(T.game.state === T.ST.OVER, 'rocket done -> OVER screen');
snap('t07_over_rocket');

/* ================= 12. 布景快照(游戏画面观感) ================= */
console.log('== 12. staged play scene ==');
T.startGame();
const scene = [
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 6],
  [1, 1, 0, 0, 0, 0, 0, 0, 6, 6],
  [2, 1, 1, 0, 0, 4, 4, 0, 7, 6],
  [2, 2, 1, 3, 0, 0, 4, 4, 7, 7],
  [2, 5, 3, 3, 3, 0, 5, 4, 7, 4],
];
scene.forEach((row, i) => row.forEach((v, x) => T.setCell(x, 13 + i, v)));
T.setNext(3); T.spawnNext();
T.setCur(2, 0, 4, 5);                           // 空中一个 T
snap('t08_play');

/* ================= 13. 机器人随机乱按 4000 帧 ================= */
console.log('== 13. bot fuzz ==');
T.startGame();
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let sawFill = false, spawns = 0, lastCur = null, gridOk = true;
for (let f = 0; f < 4000; f++) {
  if (rnd() < 0.3) T.key('left', rnd() < 0.5);
  if (rnd() < 0.3) T.key('right', rnd() < 0.5);
  if (rnd() < 0.2) T.key('down', rnd() < 0.5);
  if (rnd() < 0.12) { T.key('a', true); } else T.key('a', false);
  if (rnd() < 0.12) { T.key('b', true); } else T.key('b', false);
  if (f % 23 === 0) T.key('up', true); else T.key('up', false);
  T.step();
  if (T.cur && T.cur !== lastCur) spawns++;
  lastCur = T.cur;
  if (T.game.state === T.ST.FILL) sawFill = true;
  if (T.game.state === T.ST.OVER) T.startGame();
  if (f % 50 === 0) {
    const g = T.grid;
    if (g.length !== 18 || g.some(r => r.length !== 10 || r.some(v => v < 0 || v > 8))) gridOk = false;
  }
}
ok(gridOk, 'grid stays 18x10 with values 0..8 throughout fuzz');
ok(spawns > 30, 'pieces keep spawning under fuzz, spawns=' + spawns);
ok(sawFill, 'bot reached game over fill at least once');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
