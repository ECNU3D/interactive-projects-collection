#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 dr_mario.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(布病毒/移动旋转/4 连消除/连锁重力/过关/Game Over/放大镜)做断言。 */
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

const html = fs.readFileSync(path.join(ROOT, 'dr_mario.html'), 'utf8');
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
/* 步进直到 cond 成立或超时 */
function stepUntil(cond, max) {
  for (let i = 0; i < max; i++) {
    if (cond()) return true;
    steps(1);
  }
  return cond();
}
function gridEmpty() {
  return T.grid.every(row => row.every(v => v === null));
}

/* ================= 1. 标题画面 + 选单 ================= */
console.log('== 1. title / menu ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
ok(T.settings.level === 0 && T.settings.speed === 1, 'defaults: LEVEL 0, MED');
while (T.game.frame % 32 >= 16) steps(1);      // 对齐到 PRESS START 可见相位
snap('d01_title');
ok(countPx(36, 106, 88, 8, 0) > 30, 'PRESS START visible phase draws pixels');
steps(16);
T.render();
ok(countPx(36, 106, 88, 8, 0) === 0, 'PRESS START blink hidden phase is blank');
T.key('right', true); steps(2); T.key('right', false);
ok(T.settings.level === 1, 'menu right: VIRUS LEVEL 0 -> 1');
T.key('left', true); steps(2); T.key('left', false);
ok(T.settings.level === 0, 'menu left: back to 0 (clamped)');
T.key('down', true); steps(2); T.key('down', false);
ok(T.game.cursor === 1, 'down moves cursor to SPEED');
T.key('right', true); steps(2); T.key('right', false);
ok(T.settings.speed === 2, 'menu right: MED -> HI');
T.key('right', true); steps(2); T.key('right', false);
ok(T.settings.speed === 0, 'speed wraps HI -> LOW');
T.settings.speed = 1;                          // 恢复 MED 供后续测试
T.key('up', true); steps(2); T.key('up', false);
ok(T.game.cursor === 0, 'up moves cursor back to LEVEL');
snap('d02_title_menu');

/* ================= 2. 布病毒 ================= */
console.log('== 2. virus placement ==');
let placeOk = true, clearOk = true, countOk = true, zoneOk = true;
for (let lv = 0; lv <= 9; lv++) {
  T.placeViruses(lv);
  if (T.virusesLeft !== 4 * (lv + 1)) countOk = false;
  if (T.findClears().length !== 0) clearOk = false;
  const sum = T.typeLeft[0] + T.typeLeft[1] + T.typeLeft[2];
  if (sum !== T.virusesLeft) placeOk = false;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 8; x++) {
      const c = T.grid[y][x];
      if (c && (!c.v || c.c < 0 || c.c > 2)) placeOk = false;
      if (c && y < 8) zoneOk = false;          // 病毒只在下半部
    }
}
ok(countOk, 'LEVEL L -> exactly 4*(L+1) viruses (L=0..9)');
ok(zoneOk, 'viruses only in lower half (rows 8..15)');
ok(clearOk, 'no pre-existing 4-run at placement');
ok(placeOk, 'typeLeft counts match grid, colors in 0..2');

/* ================= 3. 开始游戏 + 移动/旋转 ================= */
console.log('== 3. start / movement / rotation ==');
T.settings.level = 0; T.settings.speed = 1;
T.startGame();
ok(T.game.state === T.ST.PLAY, 'startGame enters PLAY');
ok(T.virusesLeft === 4, 'LEVEL 0 -> 4 viruses');
ok(!!T.cur && T.cur.x === 3 && T.cur.y === 0 && T.cur.o === 0, 'capsule spawns horizontal at bottle mouth');
T.key('left', true); steps(1);
ok(T.cur.x === 2, 'tap left moves 1 cell immediately');
steps(12);
ok(T.cur.x === 1, 'DAS repeat fires after 12 frames');
T.key('left', false);
T.key('right', true); steps(40); T.key('right', false);
ok(T.cur.x === 6, 'right wall stops horizontal capsule at x=6, x=' + T.cur.x);
T.key('a', true); steps(1); T.key('a', false);
ok(T.cur.o === 1, 'X(A) rotates clockwise (o=1, vertical)');
T.setCur(1, 7, 5, 0, 1);                       // 竖胶囊贴右墙
T.key('a', true); steps(1); T.key('a', false);
ok(T.cur.o === 2 && T.cur.x === 6, 'CW rotation at right wall kicks 1 cell (o=2, x=6), got o=' + T.cur.o + ' x=' + T.cur.x);
T.key('b', true); steps(1); T.key('b', false);
ok(T.cur.o === 1 && T.cur.x === 6, 'Z(B) rotates back counter-clockwise');
/* 重力:MED = 24 帧/格 */
T.setCur(0, 3, 0, 0, 1);
steps(24);
ok(T.cur && T.cur.y === 1, 'MED gravity: 1 cell per 24 frames, y=' + (T.cur && T.cur.y));
/* 快降 */
T.key('down', true); steps(2);
ok(T.cur && T.cur.y === 2, 'soft drop: 1 cell per 2 frames while down held');
T.key('down', false);

/* ================= 4. 4 连消除(病毒 + 胶囊半粒混排) ================= */
console.log('== 4. basic 4-in-a-row clear ==');
T.startGame();
T.clearGrid();
T.setCell(0, 15, T.mkVirus(0));
T.setCell(1, 15, T.mkVirus(0));
T.setCell(2, 15, T.mkVirus(0));
T.recount();
T.setCur(0, 3, 13, 0, 1);                      // a=深色半粒将落到 (3,15),凑成 4 连
ok(stepUntil(() => T.phase !== 'fall', 400), 'capsule locks and triggers clear');
ok(T.phase === 'flash' && T.flashCells.length === 4, 'exactly 4 cells flashing, got ' + (T.flashCells || []).length);
steps(2);
snap('d03_flash');
steps(26);
ok(T.phase === 'drop', 'flash ends into gravity phase');
ok(stepUntil(() => T.game.state === T.ST.CLEAR, 300), 'settle -> all viruses gone -> STAGE CLEAR');
ok(T.virusesLeft === 0, 'all 3 viruses destroyed');
ok(T.grid[15][0] === null && T.grid[15][3] === null, 'cleared cells are empty');
ok(T.grid[15][4] && T.grid[15][4].c === 1 && T.grid[15][4].p === -1, 'orphan half survives as single');
ok(T.game.score === 300, '3 viruses x 100 x chain 1 = 300, score=' + T.game.score);

/* ================= 5. 过关 -> 下一关 ================= */
console.log('== 5. stage clear -> next stage ==');
snap('d04_stageclear');
steps(321);
ok(T.game.state === T.ST.PLAY, 'next stage starts after victory melody');
ok(T.game.stage === 2 && T.game.level === 1, 'stage 2, virus level up to 1');
ok(T.virusesLeft === 8, 'LEVEL 1 -> 8 viruses');

/* ================= 6. 连锁消除 + 重力 ================= */
console.log('== 6. chain reaction ==');
T.startGame();
T.clearGrid();
/* col0 竖 4 深色(3 病毒 + 1 半粒);上方悬 1 个中色单粒;
 * 底排 x1..x3 摆 3 个中色半粒:第一消后单粒落底凑成横 4 -> 连锁 */
T.setCell(0, 15, T.mkVirus(0));
T.setCell(0, 14, T.mkVirus(0));
T.setCell(0, 13, T.mkVirus(0));
T.setCell(0, 12, T.mkHalf(0));
T.setCell(0, 11, T.mkHalf(1));
T.setCell(1, 15, T.mkHalf(1));
T.setCell(2, 15, T.mkHalf(1));
T.setCell(3, 15, T.mkHalf(1));
T.recount();
const vBefore = T.virusesLeft;
T.checkClears();
ok(T.phase === 'flash', 'manual trigger enters flash');
ok(stepUntil(() => T.game.state === T.ST.CLEAR, 600), 'chain fully resolves into STAGE CLEAR');
ok(T.game.maxChain === 2, 'chain reached 2 (vertical clear -> drop -> horizontal clear)');
ok(T.virusesLeft === vBefore - 3, '3 viruses destroyed in chain');
ok(gridEmpty(), 'both clears remove everything, bottle empty');
ok(T.game.score === 300, 'viruses scored in 1st clear only (chain 1): 300, score=' + T.game.score);

/* ================= 7. 完整胶囊(两半链接)一起下落 ================= */
console.log('== 7. linked capsule falls as a unit ==');
T.startGame();
T.clearGrid();
T.recount();
/* 竖胶囊 (4,9)-(4,10),下方悬空 */
const capA = T.mkHalf(1), capB = T.mkHalf(1);
capA.p = 9 * 8 + 4;                            // capA 在 (4,10),伙伴 capB 在 (4,9)
capB.p = 10 * 8 + 4;
T.setCell(4, 10, capA);
T.setCell(4, 9, capB);
T.gravityStep();
ok(T.grid[9][4] === null && T.grid[10][4] === capB && T.grid[11][4] === capA, 'linked vertical capsule falls one cell together');
ok(capA.p === 10 * 8 + 4 && capB.p === 11 * 8 + 4, 'partner links updated after fall');
/* 横胶囊 (5,5)-(6,5),下方悬空 */
const capC = T.mkHalf(2), capD = T.mkHalf(2);
capC.p = 5 * 8 + 6;                            // capC 在 (5,5),伙伴在 (6,5)
capD.p = 5 * 8 + 5;
T.setCell(5, 5, capC);
T.setCell(6, 5, capD);
T.gravityStep();
ok(T.grid[5][5] === null && T.grid[5][6] === null && T.grid[6][5] === capC && T.grid[6][6] === capD, 'linked horizontal capsule falls one cell together');
/* 断链:消掉上半,下半变单粒独自下落(注意:上一次 gravityStep 已让竖胶囊再落一格) */
T.setCell(4, 11, null);                        // 移除 capB(现位于 (4,11))
T.gravityStep();
ok(T.grid[13][4] === capA && capA.p === -1, 'orphaned half becomes single and falls alone');

/* ================= 8. Game Over(瓶口被堵) ================= */
console.log('== 8. game over ==');
T.startGame();
T.setCell(3, 0, T.mkHalf(0));
T.setCell(4, 0, T.mkHalf(1));
T.spawnNext();                                  // 出生点被堵
ok(T.game.state === T.ST.OVER, 'blocked bottle mouth -> GAME OVER');
snap('d05_over');
ok(countPx(44, 40, 72, 8, 3) > 50, 'GAME OVER text drawn');
ok(countPx(32, 64, 96, 8, 3) > 30, 'final score shown');
steps(31);
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'PRESS START returns to title');

/* ================= 9. 放大镜圆窗 ================= */
console.log('== 9. magnifier window ==');
T.startGame();
T.clearGrid();
T.setCell(0, 15, T.mkVirus(0));
T.setCell(1, 15, T.mkVirus(1));
T.setCell(2, 15, T.mkVirus(2));
T.recount();
T.render();
ok(countPx(94, 8, 48, 48, 0) > 40, 'magnifier ring drawn (dark pixels in circle area)');
const inCircle = c => countPx(96, 14, 44, 36, c);
ok(inCircle(0) > 20 && inCircle(1) > 20 && inCircle(2) > 20, 'all 3 virus shades visible inside lens');
/* 消灭一类 -> 少一只 */
T.setCell(2, 15, null);
T.recount();
T.render();
ok(inCircle(2) < 20, 'eliminated type disappears from lens');
snap('d06_magnifier');

/* ================= 10. 布景快照(游戏画面观感) ================= */
console.log('== 10. staged play scene ==');
T.startGame();
T.clearGrid();
const V = T.mkVirus, Hf = T.mkHalf;
const scene = [
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [V(2), null, null, null, null, null, null, null],
  [V(2), V(0), null, null, V(1), null, null, null],
  [V(1), V(0), Hf(2), null, V(1), Hf(0), null, null],
  [V(1), Hf(0), Hf(2), V(2), Hf(1), Hf(0), V(0), null],
  [Hf(1), Hf(0), V(1), V(2), Hf(1), Hf(2), V(0), Hf(2)],
];
scene.forEach((row, i) => row.forEach((v, x) => { if (v) T.setCell(x, 8 + i, v); }));
T.recount();
T.setCur(0, 3, 2, 1, 2);
T.render();
snap('d07_play');
ok(countPx(8, 8, 64, 128, 0) > 30, 'bottle interior has dark-virus/half pixels');
ok(countPx(8, 8, 64, 128, 2) > 30, 'bottle interior has light-virus/half pixels');

/* ================= 11. 机器人随机乱按 4000 帧 ================= */
console.log('== 11. bot fuzz ==');
T.startGame();
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let spawns = 0, lastCur = null, gridOk = true, sawOver = false, sawClear = false;
for (let f = 0; f < 4000; f++) {
  if (rnd() < 0.3) T.key('left', rnd() < 0.5);
  if (rnd() < 0.3) T.key('right', rnd() < 0.5);
  if (rnd() < 0.2) T.key('down', rnd() < 0.5);
  if (rnd() < 0.12) T.key('a', true); else T.key('a', false);
  if (rnd() < 0.12) T.key('b', true); else T.key('b', false);
  T.step();
  if (T.cur && T.cur !== lastCur) spawns++;
  lastCur = T.cur;
  if (T.game.state === T.ST.OVER) { sawOver = true; T.startGame(); }
  if (T.game.state === T.ST.CLEAR) { sawClear = true; steps(330); }
  if (f % 50 === 0) {
    const g = T.grid;
    if (g.length !== 16 || g.some(r => r.length !== 8 ||
        r.some(v => v !== null && (v.c < 0 || v.c > 2)))) gridOk = false;
  }
}
ok(gridOk, 'grid stays 16x8 with valid cells throughout fuzz');
ok(spawns > 30, 'capsules keep spawning under fuzz, spawns=' + spawns);
ok(sawOver || sawClear, 'bot reached game over or stage clear at least once (over=' + sawOver + ' clear=' + sawClear + ')');
T.render();
snap('d08_fuzz_end');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
