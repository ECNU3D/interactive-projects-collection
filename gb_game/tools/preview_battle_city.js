#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 battle_city.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(地图/移动/开炮/地形/刷怪/道具/过关/Game Over)做断言。 */
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

const html = fs.readFileSync(path.join(ROOT, 'battle_city.html'), 'utf8');
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
/* 直接进入干净的 PLAY 状态 */
function freshPlay(stage) {
  T.loadStage(stage || 1);
  T.game.state = T.ST.PLAY;
  T.player.shield = 0;
}

/* ================= 0. 关卡数据自检 ================= */
console.log('== 0. map data ==');
ok(T.MAPS.length === 3, '3 stages hardcoded');
let mapOk = true;
T.MAPS.forEach((m, i) => {
  if (m.length !== 13) { mapOk = false; console.log('  stage', i + 1, 'rows', m.length); }
  m.forEach((r, j) => { if (r.length !== 13) { mapOk = false; console.log('  stage', i + 1, 'row', j, 'len', r.length); } });
});
ok(mapOk, 'all maps are 13x13');

/* BFS 连通性:16x16 坦克(4px 对齐)能从左上出生区到达顶部三点/玩家出生点/基地上方 */
function reachable(stage) {
  T.loadStage(stage);
  const solid = t => t === 1 || t === 2 || t === 3;
  const blocked = (x, y) => {
    if (x < 0 || y < 0 || x > 88 || y > 88) return true;
    const fx0 = x / 4, fy0 = y / 4, fx1 = (x + 15) / 4 | 0, fy1 = (y + 15) / 4 | 0;
    for (let fy = fy0; fy <= fy1; fy++)
      for (let fx = fx0; fx <= fx1; fx++)
        if (solid(T.tileAt(fx, fy))) return true;
    return x < 60 && x + 16 > 44 && y < 104 && y + 16 > 88; // 基地
  };
  const seen = new Set();
  const q = [[0, 0]];
  const key = (x, y) => x + ',' + y;
  if (!blocked(0, 0)) seen.add(key(0, 0));
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {
      const nx = x + dx, ny = y + dy;
      if (!blocked(nx, ny) && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); q.push([nx, ny]); }
    }
  }
  return seen;
}
for (let s = 1; s <= 3; s++) {
  const r = reachable(s);
  const need = [[44, 0], [88, 0], [12, 88], [44, 64], [88, 88]];
  const missing = need.filter(([x, y]) => !r.has(x + ',' + y));
  ok(missing.length === 0, `stage ${s} tank-reachable: top spawns/base/player spawn (${r.size} cells)` +
     (missing.length ? ' MISSING ' + missing.map(m => m.join(',')).join(' ') : ''));
}

/* ================= 1. 标题画面 ================= */
console.log('== 1. title ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
while (T.game.frame % 32 >= 16) steps(1);      // 对齐到 PRESS START 可见相位
snap('b01_title');
ok(countPx(36, 122, 88, 8, 0) > 30, 'PRESS START visible phase draws pixels');
steps(16);
T.render();
ok(countPx(36, 122, 88, 8, 0) === 0, 'PRESS START blink hidden phase is blank');

/* ================= 2. STAGE 开场 ================= */
console.log('== 2. stage intro / reveal ==');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.INTRO, 'START enters INTRO');
steps(5);
snap('b02_intro');
ok(countPx(0, 0, 160, 144, 0) > 160 * 144 * 0.9, 'intro screen is mostly black');
ok(countPx(52, 64, 56, 8, 3) > 20, 'STAGE 1 text drawn in lightest color');
steps(80);
ok(T.game.state === T.ST.REVEAL, 'INTRO -> REVEAL');
steps(25);
snap('b03_reveal');
ok(T.game.revealN > 0 && T.game.revealN < 169, 'map revealing cell by cell, n=' + T.game.revealN);
steps(60);
ok(T.game.state === T.ST.PLAY, 'REVEAL -> PLAY');
ok(T.countTiles(1) > 40, 'stage 1 has bricks, n=' + T.countTiles(1));
ok(T.countTiles(2) === 16, 'stage 1 has 16 steel fine-tiles');
ok(T.countTiles(4) > 0, 'stage 1 has trees');

/* ================= 3. 玩家移动(移动即转向) ================= */
console.log('== 3. player movement ==');
const p0 = T.player;
ok(p0.alive && p0.x === 12 && p0.y === 88 && p0.dir === 0, 'player spawns at (12,88) facing up');
T.key('right', true); steps(10);
ok(p0.dir === 1, 'holding right turns tank right');
ok(p0.x > 12, 'player moves right, x=' + p0.x);
steps(60);
const xStop = p0.x;
T.key('right', false);
ok(xStop <= 20.5, 'brick ring/base zone stops player around x=20, x=' + xStop);
T.key('up', true); steps(40); T.key('up', false);
ok(p0.dir === 0 && p0.y < 88, 'player turns up and moves, y=' + p0.y);
snap('b04_play');

/* ================= 4. 开炮:同屏 1 发,升级 2 发 ================= */
console.log('== 4. firing ==');
freshPlay(1);
Object.assign(T.player, { x: 44, y: 64, dir: 0 });
T.key('a', true); steps(2);
ok(T.bullets.length === 1, 'fire one bullet');
steps(2);
ok(T.bullets.length === 1, 'holding A still 1 bullet (max 1 on screen)');
for (let i = 0; i < 200 && T.bullets.length; i++) steps(1);
ok(T.bullets.length === 0, 'bullet leaves field and despawns');
T.key('a', false);
Object.assign(T.player, { x: 44, y: 64, dir: 0, level: 2, fireCd: 0 });
T.key('a', true); steps(3);
ok(T.bullets.length === 1, 'level 2: first shot');
steps(8);
ok(T.bullets.length === 2, 'level 2: second shot while first alive (max 2), n=' + T.bullets.length);
T.key('a', false);
steps(120);

/* ================= 5. 地形:砖碎 / 钢挡 / 河挡 / 树林可过 ================= */
console.log('== 5. terrain ==');
freshPlay(1);
Object.assign(T.player, { x: 32, y: 56, dir: 2 });
const bricks0 = T.countTiles(1);
T.key('a', true); steps(40); T.key('a', false);
const bricks1 = T.countTiles(1);
ok(bricks1 < bricks0, `brick destroyed by bullet (${bricks0} -> ${bricks1})`);
freshPlay(1);
Object.assign(T.player, { x: 24, y: 40, dir: 2 });
const steel0 = T.countTiles(2);
for (let k = 0; k < 3; k++) { T.key('a', true); steps(80); T.key('a', false); }
ok(T.countTiles(2) === steel0, 'steel survives repeated fire');
snap('b05_terrain');
freshPlay(2);
Object.assign(T.player, { x: 8, y: 24, dir: 2 });
T.key('down', true); steps(50); T.key('down', false);
ok(T.player.y <= 24.5, 'river blocks tank, y=' + T.player.y);
Object.assign(T.player, { x: 0, y: 64, dir: 2 });
T.key('down', true); steps(60); T.key('down', false);
ok(T.player.y > 80, 'trees are passable, y=' + T.player.y);

/* ================= 6. 刷怪:顶部三点,同屏 <=4 ================= */
console.log('== 6. enemy spawn ==');
freshPlay(1);
steps(400);
ok(T.enemies.length >= 1 && T.enemies.length <= 4, 'enemies on screen: ' + T.enemies.length);
ok(T.queue.length + T.enemies.length <= 20, 'total enemies bounded by 20: ' + (T.queue.length + T.enemies.length));
ok(T.enemies.every(e => [0, 44, 88].includes(e.x) && e.y === 0 || e.y > 0), 'spawn points are top three');
steps(600);
ok(T.enemies.length <= 4, 'never more than 4 on screen: ' + T.enemies.length);
ok(T.queue.length < 20, 'queue drains as enemies spawn: ' + T.queue.length);

/* ================= 7. 击毁敌人:得分 + 爆炸 ================= */
console.log('== 7. kill enemy ==');
freshPlay(1);
T.enemies.push({ x: 88, y: 16, dir: 2, type: 0, hp: 1, anim: 0, turnT: 9999, fireT: 9999, spawnFx: 0 });
Object.assign(T.player, { x: 88, y: 64, dir: 0 });
const score0 = T.game.score;
T.key('a', true); steps(2); T.key('a', false);
steps(60);
ok(T.game.score === score0 + 100, 'normal tank +100, score=' + T.game.score);
ok(T.game.killed[0] === 1, 'kill counted in stats');
ok(T.explosions.length >= 0 && T.enemies.length === 0, 'enemy removed after explosion');

/* ================= 8. 道具:星星 / 铁锹 / 炸弹 / 命 ================= */
console.log('== 8. powerups ==');
freshPlay(1);
T.applyPowerup(0); T.applyPowerup(0);
ok(T.player.level === 2, 'two stars -> level 2 (double fire)');
T.game.lives = 3;
T.applyPowerup(3);
ok(T.game.lives === 4, 'tank powerup +1 life, lives=' + T.game.lives);
T.applyPowerup(1);
ok(T.tileAt(9, 20) === 2 && T.tileAt(16, 25) === 2, 'shovel turns base ring to steel');
ok(T.shovelT === 600, 'shovel lasts 600 frames (10s)');
steps(601);
ok(T.tileAt(9, 20) === 1 && T.tileAt(16, 25) === 1, 'ring reverts to brick after 10s');
freshPlay(1);
T.enemies.push(
  { x: 0, y: 32, dir: 2, type: 0, hp: 1, anim: 0, turnT: 99, fireT: 9999, spawnFx: 0 },
  { x: 88, y: 32, dir: 2, type: 1, hp: 1, anim: 0, turnT: 99, fireT: 9999, spawnFx: 0 });
T.applyPowerup(2);
ok(T.enemies.length === 0, 'bomb wipes all on-screen enemies');
ok(T.game.killed[0] === 1 && T.game.killed[1] === 1, 'bomb kills counted toward quota');
/* 随机掉落:杀很多只会出道具 */
freshPlay(1);
let dropped = 0;
for (let i = 0; i < 60; i++) {
  T.enemies.push({ x: 44, y: 32, dir: 2, type: 0, hp: 1, anim: 0, turnT: 99, fireT: 9999, spawnFx: 0 });
  T.killEnemy(T.enemies[T.enemies.length - 1], false);
  if (T.powerups.length) { dropped++; T.powerups.length = 0; }
}
ok(dropped > 0, 'enemies randomly drop powerups (' + dropped + '/60)');

/* ================= 9. 玩家受击 / 复活 ================= */
console.log('== 9. player hit / respawn ==');
freshPlay(1);
const lives0 = T.game.lives;
T.hitPlayer();
ok(!T.player.alive && T.game.lives === lives0 - 1, 'hit costs a life');
steps(80);
ok(T.player.alive && T.player.x === 12 && T.player.y === 88, 'player respawns at spawn point');
ok(T.player.shield > 0, 'respawn shield active');
/* 保护罩期间无敌 */
T.hitPlayer();
ok(T.player.alive, 'shielded player survives hit');

/* ================= 10. 基地被毁 -> Game Over ================= */
console.log('== 10. base destroyed ==');
freshPlay(1);
snap('b06_base');
T.hitBase();
ok(!T.baseAlive, 'eagle destroyed');
steps(90);
ok(T.game.state === T.ST.OVER, 'base hit -> GAME OVER');
snap('b07_over');
ok(countPx(44, 44, 72, 8, 3) > 50, 'GAME OVER text drawn');
steps(60);
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'PRESS START returns to title, state=' + T.game.state);

/* ================= 11. 全歼 20 辆 -> 过关结算 ================= */
console.log('== 11. stage clear ==');
freshPlay(1);
T.queue.length = 0;
while (T.enemies.length) T.killEnemy(T.enemies[0], true);
steps(120);
ok(T.game.state === T.ST.CLEAR, 'all 20 destroyed -> CLEAR screen');
snap('b08_clear');
ok(countPx(28, 14, 104, 8, 0) > 30, 'STAGE 1 CLEAR text drawn');
steps(70);
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.INTRO && T.game.stage === 2, 'next stage begins');

/* ================= 12. 三关全通 -> 胜利画面 ================= */
console.log('== 12. win ==');
freshPlay(3);
T.game.stage = 3;
T.queue.length = 0;
while (T.enemies.length) T.killEnemy(T.enemies[0], true);
steps(120);
ok(T.game.state === T.ST.CLEAR, 'stage 3 clear');
steps(70);
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.WIN, 'all 3 stages -> WIN screen');
snap('b09_win');

/* ================= 13. 布景快照 ================= */
console.log('== 13. staged scene ==');
freshPlay(1);
T.player.level = 3;
T.enemies.push(
  { x: 0, y: 24, dir: 2, type: 0, hp: 1, anim: 3, turnT: 999, fireT: 9999, spawnFx: 0 },
  { x: 44, y: 8, dir: 1, type: 1, hp: 1, anim: 7, turnT: 999, fireT: 9999, spawnFx: 0 },
  { x: 80, y: 40, dir: 3, type: 2, hp: 3, anim: 1, turnT: 999, fireT: 9999, spawnFx: 0 });
T.spawnPowerup(0, 56, 48);
T.player.x = 60; T.player.y = 76; T.player.dir = 1;
T.key('a', true); steps(3); T.key('a', false);
steps(6);
snap('b10_scene');

/* ================= 14. 机器人乱按 5000 帧 ================= */
console.log('== 14. bot fuzz ==');
freshPlay(1);
let seed = 999;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let fuzzOk = true, maxEnemies = 0, sawSpawn = false;
try {
  for (let f = 0; f < 5000; f++) {
    if (rnd() < 0.3) T.key('left', rnd() < 0.5);
    if (rnd() < 0.3) T.key('right', rnd() < 0.5);
    if (rnd() < 0.3) T.key('up', rnd() < 0.5);
    if (rnd() < 0.3) T.key('down', rnd() < 0.5);
    T.key('a', rnd() < 0.4);
    steps(1);
    maxEnemies = Math.max(maxEnemies, T.enemies.length);
    if (T.enemies.length > 0) sawSpawn = true;
    if (T.enemies.length > 4) { fuzzOk = false; break; }
    if (T.bullets.some(b => b.x < -8 || b.x > 112 || b.y < -8 || b.y > 112)) { fuzzOk = false; break; }
    if (T.game.state === T.ST.OVER) {
      steps(60);
      T.key('start', true); steps(2); T.key('start', false);
      T.key('start', true); steps(2); T.key('start', false);
      steps(150);
    }
  }
} catch (e) {
  fuzzOk = false;
  console.log('  fuzz exception: ' + e.message);
}
ok(fuzzOk, 'fuzz 5000 frames: invariants hold, no exception');
ok(sawSpawn, 'enemies spawned during fuzz, max on screen=' + maxEnemies);
snap('b11_fuzz');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
