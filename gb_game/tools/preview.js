#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 index.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并跑一个"笨蛋机器人"验证关卡可通关、物理不穿透。 */
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

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
/* 同一脚本内追加钩子,保证能拿到词法作用域里的内部函数 */
const hook = `
;globalThis.__h = { drawSpr, drawText, SPR, R, FONT, ST, solidAt, tileAt };
`;
vm.runInContext(code + hook, sandbox);
const T = sandbox.__test;
const Hk = sandbox.__h;

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
function blank() { vm.runInContext('R(0,0,160,144,3)', sandbox); }
function steps(n) { for (let i = 0; i < n; i++) T.step(); }

/* ---- 0. 关卡数据自检 ---- */
console.log('== level rows ==');
T.levelRows.forEach((r, i) => console.log('row', i, 'len', r.length));
const badRow = T.levelRows.findIndex(r => r.length !== T.levelRows[0].length);
console.log(badRow < 0 ? 'rows OK' : 'ROW MISMATCH at ' + badRow);

/* ---- 1. 标题画面 ---- */
steps(5);
snap('01_title');

/* ---- 2. 精灵 & 字体表 ---- */
blank();
vm.runInContext(`
  const names=['marioS0','marioS1','marioS2','marioSJ','marioB0','marioB1','marioB2','marioBJ',
               'goomba0','goomba1','goombaDie','fly0','fly1','shroom','coin0','coin1','coin2'];
  names.forEach((n,i)=>{ drawSpr(SPR[n], (i%9)*18, Math.floor(i/9)*20); });
  drawText('ABCDEFGHIJKLM', 0, 48, 0);
  drawText('NOPQRSTUVWXYZ', 0, 58, 0);
  drawText('0123456789', 0, 68, 0);
  drawText('!.-:*', 0, 78, 0);
  drawText('PRESS START', 0, 92, 0);
  drawText('GAME OVER', 0, 102, 0);
  drawText('MARIO', 0, 116, 0, 2);
`, sandbox);
writeBmp('02_sheet');

/* ---- 3. 进入游戏:开头卡 -> 游戏中 ---- */
T.key('start', true); steps(2); T.key('start', false);
snap('03_card');
steps(140);
console.log('state after card (expect 2=PLAY):', T.game.state);
snap('04_spawn');

/* ---- 4. 物理:跑步+跳跃 ---- */
T.key('right', true); T.key('b', true);
steps(90);
const px1 = T.player.x, py1 = T.player.y;
console.log('after run 90f: x=%s y=%s (expect x>150, y~98)', px1.toFixed(1), py1.toFixed(1));
snap('05_run');
T.key('a', true);
const arc = [];
for (let i = 0; i < 50; i++) { steps(1); arc.push(T.player.vy.toFixed(2)); }
console.log('jump arc vy:', arc.slice(0, 24).join(' '));
console.log('landed y=%s onGround=%s', T.player.y.toFixed(1), T.player.onGround);
T.key('a', false); T.key('right', false); T.key('b', false);
steps(30);

/* ---- 工具:无敌(防止场景测试被敌人随机打断) ---- */
function god() { if (T.player) T.player.invuln = 100; }
function freshPlay(x, y) {           // 强制回到干净的游玩状态(重载关卡,敌人归位)
  T.startLevel();
  T.game.state = 2;
  T.player.x = x; T.player.y = y; T.player.vx = 0; T.player.vy = 0;
  T.game.camX = Math.max(0, Math.min(x - 60, 200 * 16 - 160));
  god();
}

/* ---- 5. 顶问号砖(金币) ---- */
freshPlay(15 * 16 + 2, 98);
const coins0 = T.game.coins;
T.key('a', true);
for (let i = 0; i < 10; i++) { god(); steps(1); }
T.key('a', false);
for (let i = 0; i < 30; i++) { god(); steps(1); }
console.log('bump ? : coins %d -> %d, tile=%s (expect +1, U)', coins0, T.game.coins, T.map[4][15]);
snap('06_bump');

/* ---- 5b. 顶蘑菇砖 -> 吃蘑菇变大 ---- */
freshPlay(21 * 16 + 2, 98);
T.key('a', true);
for (let i = 0; i < 10; i++) { god(); steps(1); }
T.key('a', false);
console.log('mushroom spawned (expect true):', !!T.mushroom);
for (let i = 0; i < 900 && !T.player.big; i++) { god(); steps(1); }
console.log('player big after eating (expect true):', T.player.big);
snap('06b_mushroom');

/* ---- 5c. 踩敌 ---- */
freshPlay(284, 60);
let stomped = false, bounceCd = 0;
for (let i = 0; i < 400 && !stomped; i++) {
  god();
  if (T.player.onGround && bounceCd <= 0) { T.key('a', true); bounceCd = 20; }
  else if (bounceCd > 0) { bounceCd--; if (bounceCd < 14) T.key('a', false); }
  steps(1);
  if (T.enemies.some(e => e.dead === 1 || e.dead === 2)) stomped = true;
}
T.key('a', false);
console.log('stomp enemy (expect true):', stomped);

/* ---- 5d. 大状态侧面受击 -> 变小而不是死 ---- */
freshPlay(400, 96);                  // 站在 col26 栗子怪的行进路线上
T.player.big = true; T.player.h = 16; T.player.invuln = 0;
let shrunk = false;
for (let i = 0; i < 300; i++) {
  steps(1);
  if (!T.player.big && T.player.invuln > 0) { shrunk = true; break; }
  if (T.game.state !== 2) break;
}
console.log('hurt while big -> shrink not die (expect true, state 2):', shrunk, T.game.state);

/* ---- 6. 各区域取景 ---- */
function spot(x, name) {
  freshPlay(x, 60);
  for (let i = 0; i < 50; i++) { god(); steps(1); }
  snap(name);
}
spot(340, '07_pipe1');
spot(700, '08_stairs');
spot(1010, '09_pipe2');
spot(1460, '10_bricks');
spot(1790, '11_bigstairs');
spot(2430, '12_highbricks');
spot(2870, '13_pipe5');
spot(3030, '14_flag');

/* ---- 7. 机器人通关测试(无敌,只验地形/跳跃可达性) ---- */
console.log('== bot run ==');
T.game.state = 0;                          // 确保回到标题再重新开始
T.key('start', true); steps(2); T.key('start', false);
steps(140);
console.log('bot start state (expect 2):', T.game.state);
T.game.lives = 99;
let deaths = 0, jumpHold = 0, maxX = 0, frames = 0, prevLives = 99;
const logs = [];
function groundBelow(p) {                  // 前方脚下 60px 内有地 -> 可以直接走下去,不用跳
  const tx = Math.floor((p.x + p.w + 10) / 16);
  for (let dy = 6; dy <= 60; dy += 16)
    if (Hk.solidAt(tx, Math.floor((p.y + p.h + dy) / 16))) return true;
  return false;
}
for (let f = 0; f < 12000; f++) {
  frames = f;
  const g = T.game, p = T.player;
  if (g.state === 2) {
    god();
    T.key('right', true); T.key('b', true);
    const stuck = Math.abs(p.vx) < 0.05 && p.onGround;
    if (jumpHold > 0) { T.key('a', true); jumpHold--; }
    else if (p.onGround && (stuck || !groundBelow(p))) { T.key('a', true); jumpHold = 12; }
    else T.key('a', false);
    maxX = Math.max(maxX, p.x);
  }
  steps(1);
  if (T.game.lives < prevLives) { deaths++; logs.push('die near x=' + Math.round(maxX)); prevLives = T.game.lives; }
  if (T.game.state === 4) { logs.push('GAME OVER'); break; }
  if (T.game.state === 6) { logs.push('CLEAR! score=' + T.game.score + ' coins=' + T.game.coins); break; }
}
console.log('deaths:', deaths, 'maxX:', Math.round(maxX), 'frames:', frames);
logs.forEach(l => console.log(' ', l));
snap('15_final');
console.log('done');
