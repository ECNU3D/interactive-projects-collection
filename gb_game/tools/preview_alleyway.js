#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 alleyway.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(反弹角/击砖计分/提速缩板/碰顶减半/关卡循环/奖励关免罚)做断言。 */
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

const html = fs.readFileSync(path.join(ROOT, 'alleyway.html'), 'utf8');
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
function snap(name) { T.render(); writeBmp(name); }
function steps(n) { for (let i = 0; i < n; i++) T.step(); }
function countPx(x0, y0, w, h, color) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (px(x, y) === color) n++;
  return n;
}
/* 直接进入某关的 PLAY 状态并发球 */
function gotoPlay(lv) {
  T.game.level = lv;
  T.startCard();
  steps(90);                                     // CARD -> SERVE
  T.game.state = T.ST.PLAY;                      // 手动置 PLAY,球速方向由测试给定
  T.ball.trail = [];
}

/* ================= 1. 标题画面 ================= */
console.log('== 1. title ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
while (T.game.frame % 32 >= 16) steps(1);        // 对齐到 PRESS START 可见相位
snap('a01_title');
ok(countPx(36, 84, 88, 8, 0) > 30, 'PRESS START visible phase draws pixels');
ok(px(5, 13) === 0 && px(5, 19) === 1 && px(5, 25) === 2, 'title shows 3-shade brick rows');
steps(16);
T.render();
ok(countPx(36, 84, 88, 8, 0) === 0, 'PRESS START blink hidden phase is blank');

/* ================= 2. 开始游戏:卡片 -> 发球 ================= */
console.log('== 2. start / serve ==');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.CARD, 'START enters stage CARD');
snap('a02_card');
steps(90);
ok(T.game.state === T.ST.SERVE, 'CARD -> SERVE after 90 frames');
ok(T.wall.kind === 'normal' && T.wall.cols === 19 && T.wall.rows === 8, 'level 1 = normal 19x8 wall');
ok(T.ball.y === T.PAD_Y - 2, 'ball rests on paddle while serving');
snap('a03_serve');
ok(countPx(0, 0, 40, 8, 0) > 10, 'HUD SCORE label drawn');
ok(px(1, 50) === 1 && px(157, 50) === 1, 'side walls drawn');
ok(px(80, 9) === 0, 'ceiling line drawn');

/* ================= 3. 挡板移动与边界 ================= */
console.log('== 3. paddle movement ==');
const px0 = T.pad.x;
T.key('left', true); steps(10);
ok(T.pad.x < px0, 'paddle moves left while held');
steps(50); T.key('left', false);
ok(T.pad.x === T.WALL_L, 'paddle clamps at left wall, x=' + T.pad.x);
T.key('right', true); steps(120); T.key('right', false);   // 发球等待 240 帧内完成,避免自动发球
ok(T.pad.x === T.WALL_R - T.pad.w, 'paddle clamps at right wall, x=' + T.pad.x);
T.key('a', true); steps(1); T.key('a', false);
ok(T.game.state === T.ST.PLAY, 'A launches the ball');
ok(T.ball.vy < 0, 'ball launched upward, vy=' + T.ball.vy.toFixed(2));

/* ================= 4. 反弹角(手感核心) ================= */
console.log('== 4. bounce angle ==');
function bounceAt(offset) {                      // offset: 球心相对板中偏移
  gotoPlay(1);
  T.pad.x = 68; T.pad.w = 24;
  T.ball.x = T.pad.x + T.pad.w / 2 - 1 + offset;
  T.ball.y = T.PAD_Y - 6;
  T.ball.vx = 0; T.ball.vy = 1.5;
  for (let i = 0; i < 12 && T.ball.vy > 0; i++) T.step();
  return { vx: T.ball.vx, vy: T.ball.vy };
}
const center = bounceAt(0);
ok(center.vy < 0 && Math.abs(center.vx) < 0.2, 'center hit -> nearly vertical, vx=' + center.vx.toFixed(3));
const edge = bounceAt(9);
ok(edge.vy < 0 && Math.abs(edge.vx) > 0.7, 'edge hit -> steep angle, vx=' + edge.vx.toFixed(3));
const edgeL = bounceAt(-9);
ok(edgeL.vx < -0.7, 'left edge bounces left, vx=' + edgeL.vx.toFixed(3));

/* ================= 5. 击砖:计分 / 反弹 / 提速 ================= */
console.log('== 5. brick break ==');
gotoPlay(1);
const s0 = T.game.score;
T.pad.x = 4;                                     // 挡板挪远,别碍事
T.ball.x = 8; T.ball.y = 66; T.ball.vx = 0; T.ball.vy = -1.5; // 正对底行 (c0,r7) 的 1 分砖
steps(3);
ok(T.wall.cells[7][0] === 0, 'bottom-row brick cell removed');
ok(T.game.score - s0 === 1, 'bottom-row brick scores 1, delta=' + (T.game.score - s0));
ok(T.ball.vy > 0, 'ball reflected downward');
ok(T.bricksHit === 1, 'bricksHit = 1');
const s1 = T.game.score;
T.breakCell(0, 0);
ok(T.game.score - s1 === 3, 'top-row brick scores 3, delta=' + (T.game.score - s1));
snap('a04_play');

/* ================= 6. 提速 + 挡板缩短 + 碰顶减半 ================= */
console.log('== 6. speed / shrink / ceiling ==');
gotoPlay(1);
const v0 = T.ballSpeed();
T.setHits(16);
ok(T.pad.w === 20, 'paddle 24 -> 20 after 16 bricks, w=' + T.pad.w);
T.setHits(40);
ok(T.pad.w === 16, 'paddle -> 16 after 40 bricks, w=' + T.pad.w);
ok(T.ballSpeed() > v0 + 0.7, 'ball speed grows with bricks: ' + v0.toFixed(2) + ' -> ' + T.ballSpeed().toFixed(2));
/* 清空球上方的第 9 列,让球一路碰顶 */
T.setHits(0);
for (let r = 0; r < 8; r++) T.wall.cells[r][9] = 0;
T.ball.x = 80; T.ball.y = 70; T.ball.vx = 0; T.ball.vy = -2;
let touched = false;
for (let i = 0; i < 60 && !touched; i++) { T.step(); if (T.ceilHalved) touched = true; }
ok(touched, 'ball touched the ceiling');
ok(T.pad.w === 12, 'ceiling touch halves paddle 24 -> 12, w=' + T.pad.w);

/* ================= 7. 丢球扣命 ================= */
console.log('== 7. lose ball ==');
gotoPlay(1);
ok(T.game.lives === 3, 'starts with 3 lives');
T.ball.x = 80; T.ball.y = H + 2; T.ball.vx = 0; T.ball.vy = 2;
steps(1);
ok(T.game.lives === 2 && T.game.state === T.ST.SERVE, 'ball lost -> -1 life, back to SERVE');

/* ================= 8. 关卡类型循环 ================= */
console.log('== 8. level kinds ==');
const seq = [];
for (let n = 1; n <= 8; n++) seq.push(T.kindOf(n));
ok(seq.join(',') === 'normal,shift,descend,bonus,normal,shift,descend,bonus',
  '8-level cycle: ' + seq.join(','));
ok(T.kindOf(9) === 'normal', 'level 9 loops back to normal');

/* ================= 9. 平移阵 / 下压阵机制 ================= */
console.log('== 9. moving walls ==');
gotoPlay(2);
const ox0 = T.wall.ox;
for (let i = 0; i < 200; i++) T.stepWall();
ok(T.wall.ox !== ox0, 'shift wall slides, ox ' + ox0 + ' -> ' + T.wall.ox);
let oxOK = true;
for (let i = 0; i < 2000; i++) { T.stepWall(); if (T.wall.ox < 0 || T.wall.ox > 32) oxOK = false; }
ok(oxOK, 'shift wall stays inside playfield (ox in 0..32)');
snap('a05_shift');
gotoPlay(3);
const oy0 = T.wall.oy;
for (let i = 0; i < 361; i++) T.stepWall();
ok(T.wall.oy === oy0 + 6, 'descend wall drops one row after ~6s, oy ' + oy0 + ' -> ' + T.wall.oy);
let oyMaxOK = true;
for (let i = 0; i < 20000; i++) T.stepWall();
ok(T.BR_Y + T.wall.oy + T.wall.rows * T.BROW <= T.PAD_Y - 18, 'descend wall stops above paddle, bottom=' +
  (T.BR_Y + T.wall.oy + T.wall.rows * T.BROW));
snap('a06_descend');

/* ================= 10. 奖励关:马里奥阵 + 不扣命 ================= */
console.log('== 10. bonus stage ==');
gotoPlay(4);
ok(T.wall.kind === 'bonus' && T.wall.cols === 16 && T.wall.rows === 12, 'level 4 = mario bonus wall');
snap('a07_bonus');
ok(px(49, 17) === 0, 'mario hat pixel is darkest shade');
ok(px(66, 53) === 2, 'mario face pixel is lightest shade');
const livesB = T.game.lives;
T.loseBall();
ok(T.game.lives === livesB && T.game.state === T.ST.SERVE, 'bonus stage ball loss costs no life');

/* ================= 11. 过关 -> 8 关通关 -> 循环加速 ================= */
console.log('== 11. clear / congrats / loop ==');
gotoPlay(1);
T.clearToLast();
const c0 = (() => { for (let r = 0; r < 8; r++) for (let c = 0; c < 19; c++) if (T.wall.cells[r][c]) return { c, r }; })();
T.breakCell(c0.c, c0.r);
ok(T.game.state === T.ST.CLEAR, 'last brick -> STAGE CLEAR');
snap('a08_clear');
steps(110);
ok(T.game.state === T.ST.CARD && T.game.level === 2, 'advance to level 2 card');
gotoPlay(8);
T.clearToLast();
const c8 = (() => { for (let r = 0; r < T.wall.rows; r++) for (let c = 0; c < T.wall.cols; c++) if (T.wall.cells[r][c]) return { c, r }; })();
T.breakCell(c8.c, c8.r);
steps(110);
ok(T.game.state === T.ST.CONGRATS, 'clearing level 8 -> CONGRATULATIONS');
snap('a09_congrats');
const sBefore = T.game.score;
steps(220);
ok(T.game.state === T.ST.CARD && T.game.level === 1 && T.game.loop === 1, 'loop restarts at level 1 with speed up');
const vLoop = (T.setHits(0), T.ballSpeed());
ok(Math.abs(vLoop - 1.25 * 1.15) < 0.001, 'loop 1 base speed = 1.25 x 1.15, v=' + vLoop.toFixed(3));

/* ================= 12. Game Over ================= */
console.log('== 12. game over ==');
T.newGame();
steps(90);                                       // CARD -> SERVE
T.game.lives = 1;
T.game.state = T.ST.PLAY;
T.loseBall();
ok(T.game.state === T.ST.OVER, 'last life lost -> GAME OVER');
while (T.game.frame % 32 >= 16) steps(1);
snap('a10_over');
ok(countPx(44, 44, 72, 8, 3) > 50, 'GAME OVER text drawn');
steps(40);
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'PRESS START returns to TITLE');

/* ================= 13. 机器人实战 8000 帧 ================= */
console.log('== 13. bot play ==');
T.newGame();
let overs = 0, boundsOK = true, finiteOK = true, minLiveBricks = 1e9;
for (let f = 0; f < 8000; f++) {
  const g = T.game, b = T.ball, p = T.pad;
  if (g.state === T.ST.SERVE) {                  // 发球
    T.key('a', true); T.step(); T.key('a', false);
    continue;
  }
  if (g.state === T.ST.PLAY) {                   // 挡板追球
    const bc = b.x + 1, pc = p.x + p.w / 2;
    T.key('left', bc < pc - 2);
    T.key('right', bc > pc + 2);
  }
  T.step();
  if (g.state === T.ST.PLAY) {
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) finiteOK = false;
    if (b.x < T.WALL_L - 0.01 || b.x + 2 > T.WALL_R + 0.01 || b.y < T.CEIL_Y - 0.01 || b.y > H + 3) boundsOK = false;
    if (T.wall && T.wall.left < minLiveBricks) minLiveBricks = T.wall.left;
  }
  if (g.state === T.ST.OVER) { overs++; T.newGame(); }
}
ok(finiteOK, 'ball physics stay finite for 8000 frames');
ok(boundsOK, 'ball never escapes walls/ceiling');
ok(T.game.score > 0 || minLiveBricks < 152, 'bot broke bricks, score=' + T.game.score);
console.log('  bot: overs=' + overs + ' score=' + T.game.score + ' level=' + T.game.level);
snap('a11_bot');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
