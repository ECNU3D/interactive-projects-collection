#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 serpent.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(转向/吃果/石头提速/大果子/死亡动画/HI-SCORE)做断言。 */
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

const html = fs.readFileSync(path.join(ROOT, 'serpent.html'), 'utf8');
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
snap('s01_title');
ok(countPx(36, 126, 88, 8, 0) > 50, 'PRESS START visible phase draws pixels');
steps(16);                                     // 进入隐藏相位
T.render();
ok(countPx(36, 126, 88, 8, 0) === 0, 'PRESS START blink hidden phase is blank');

/* ================= 2. 开始游戏 ================= */
console.log('== 2. start ==');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.PLAY, 'START enters PLAY');
ok(T.snake.length === 3, 'snake starts with 3 segments');
ok(T.snake[0].x === 9 && T.snake[0].y === 8, 'snake centered at (9,8)');
ok(T.speed === 8, 'speed starts at 8 cells/sec');
ok(!!T.food, 'food spawned');
snap('s02_spawn');

/* ================= 3. 转向 + 禁止 180° 掉头 ================= */
console.log('== 3. steering ==');
T.startGame();
steps(8);                                      // 向右走 1 格(8 格/秒 -> 60/8=7.5 帧)
ok(T.snake[0].x === 10, 'moves right 1 cell after ~8 frames, x=' + T.snake[0].x);
T.key('left', true); steps(2); T.key('left', false);
steps(16);
ok(T.dir.x === 1, '180-degree reversal ignored, still moving right');
T.key('down', true); steps(2); T.key('down', false);
steps(8);
ok(T.dir.y === 1 && T.snake[0].y === 9, 'turn down queued and applied, y=' + T.snake[0].y);
/* 快速连按:同一格内上->左 两连转应都生效 */
T.startGame();
steps(8);
T.key('down', true); steps(1); T.key('down', false);
T.key('left', true); steps(1); T.key('left', false);
steps(20);
ok(T.dir.x === -1, 'two queued turns within one cell both apply (down then left)');

/* ================= 4. 吃果:长 1 节 + 10 分 ================= */
console.log('== 4. eat food ==');
T.startGame();
T.setFood(11, 8);                              // 正前方 2 格
const len0 = T.snake.length;
steps(16);                                     // 走 2 格吃到
ok(T.snake.length === len0 + 1, 'snake grows by 1, len=' + T.snake.length);
ok(T.game.score === 10, '+10 points, score=' + T.game.score);
ok(!!T.food && !(T.food.x === 11 && T.food.y === 8), 'new food spawned elsewhere');

/* ================= 5. 每 5 个果子:石头 + 提速 ================= */
console.log('== 5. stone + speed up ==');
T.startGame();
T.setFoods(4);
T.setFood(10, 8);                              // 第 5 个果子
steps(8);
ok(T.foods === 5, '5 foods eaten');
ok(T.speed === 9, 'speed up to 9 after 5 foods, speed=' + T.speed);
let stoneCnt = 0;
for (let i = 0; i < T.stones.length; i++) stoneCnt += T.stones[i];
ok(stoneCnt === 1, 'one permanent stone spawned');
const s35 = T.speed;
ok(s35 === 9, 'speed snapshot=' + s35);
snap('s03_stone');

/* ================= 6. 撞墙 / 撞石头 / 撞自己 ================= */
console.log('== 6. collisions ==');
T.startGame();
steps(8 * 12);                                 // 一路向右撞墙
ok(T.game.state === T.ST.DYING, 'wall hit enters DYING');
steps(3 * 6 + 20);                             // 3 节消失动画 + 停顿
ok(T.game.state === T.ST.OVER, 'dying animation ends in OVER');
snap('s04_over');

T.startGame();
T.setStone(11, 8, 1);
steps(8 * 3);
ok(T.game.state === T.ST.DYING, 'stone hit enters DYING');

T.startGame();
/* 摆一个口字形:头在 (5,5) 朝右,身体绕一圈,右转必撞自己 */
T.setSnake([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }], { x: 1, y: 0 });
T.key('down', true); steps(1); T.key('down', false);
steps(8);
ok(T.game.state === T.ST.DYING, 'self bite enters DYING');

/* ================= 7. 大果子:30 秒出现,限时 8 秒,+50 缩 2 节 ================= */
console.log('== 7. big fruit ==');
T.startGame();
T.setBigTimer(1);
steps(1);
ok(!!T.big, 'big fruit appears when timer expires');
ok(T.big.ttl === 480, 'big fruit ttl = 480 frames (8s), ttl=' + T.big.ttl);
T.setBig(19, 0, 2);                            // 挪到蛇路径之外,2 帧后到期
steps(3);
ok(!T.big, 'big fruit disappears when ttl runs out');
ok(T.bigTimer > 1700, 'next big fruit re-armed ~30s later, timer=' + T.bigTimer);
/* 吃掉:分数 +50,长度净减 2 */
T.startGame();
/* 把蛇加长到 6 节再测缩短 */
T.setSnake([{ x: 9, y: 8 }, { x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }], { x: 1, y: 0 });
T.setFood(19, 15);                             // 普通果子挪远
T.setBig(11, 8, 400);                          // 大果子放正前方
const lenB = T.snake.length;
steps(16);
ok(!T.big, 'big fruit eaten');
ok(T.game.score === 50, '+50 points, score=' + T.game.score);
ok(T.snake.length === lenB - 2, 'snake shrinks by 2, len=' + T.snake.length);
/* 闪烁:可见相位有深色描边像素 */
T.setBig(3, 3, 400);
while ((T.game.frame >> 2) % 2 !== 0) steps(1);
T.render();
ok(countPx(3 * 8, 16 + 3 * 8, 8, 8, 0) > 8, 'big fruit visible phase draws dark outline');
snap('s05_big');
steps(4);
T.render();
ok(countPx(3 * 8, 16 + 3 * 8, 8, 8, 0) === 0, 'big fruit hidden phase is blank');

/* ================= 8. HI-SCORE ================= */
console.log('== 8. hi-score ==');
T.startGame();
T.setHi(0);                                    // 清掉前面小节留下的 hi
T.setFood(10, 8);
steps(8);
ok(T.hi === 10, 'hi-score tracks live score, hi=' + T.hi);
steps(8 * 20);                                 // 撞墙死
steps(200);
ok(T.game.state === T.ST.OVER, 'reached OVER');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'OVER + START returns to TITLE');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.PLAY && T.game.score === 0, 'new game resets score');
ok(T.hi === 10, 'hi-score survives restart, hi=' + T.hi);
snap('s06_hud');

/* ================= 9. 布景快照(游戏画面观感) ================= */
console.log('== 9. staged play scene ==');
T.startGame();
T.setSnake([{ x: 12, y: 6 }, { x: 11, y: 6 }, { x: 10, y: 6 }, { x: 10, y: 7 }, { x: 10, y: 8 }, { x: 9, y: 8 }, { x: 8, y: 8 }], { x: 1, y: 0 });
T.setStone(4, 4, 1); T.setStone(15, 11, 1); T.setStone(6, 12, 1);
T.setFood(16, 3);
T.setBig(3, 10, 400);
while ((T.game.frame >> 2) % 2 !== 0) steps(1);
snap('s07_play');

/* ================= 10. 机器人随机乱按 6000 帧 ================= */
console.log('== 10. bot fuzz ==');
let seed = 98765;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
T.startGame();
let sawOver = false, okLen = true, okBounds = true, restarts = 0;
for (let f = 0; f < 6000; f++) {
  if (rnd() < 0.25) T.key('up', rnd() < 0.4);
  if (rnd() < 0.25) T.key('down', rnd() < 0.4);
  if (rnd() < 0.25) T.key('left', rnd() < 0.4);
  if (rnd() < 0.25) T.key('right', rnd() < 0.4);
  T.step();
  if (T.game.state === T.ST.OVER) { sawOver = true; T.startGame(); restarts++; }
  if (f % 30 === 0) {
    const sn = T.snake;
    if (T.game.state === T.ST.PLAY && sn.length < 2) okLen = false;
    if (sn.some(s => s.x < 0 || s.x >= 20 || s.y < 0 || s.y >= 16)) okBounds = false;
  }
}
ok(okLen, 'snake length stays >= 2 during PLAY');
ok(okBounds, 'snake always inside 20x16 field');
ok(sawOver, 'bot died at least once (deaths=' + restarts + ')');
ok(T.speed >= 8 && T.speed <= 15, 'speed within 8..15, speed=' + T.speed);

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
