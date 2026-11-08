#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 hyper_lode_runner.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(关卡数据/挖掘/恢复/守卫追踪/困洞/埋掉掉金/
 * 金块收集/隐藏梯子/过关/死亡/Game Over)做断言。
 * 另内置一个按真实移动规则(走/爬梯/抓杠/下落/挖砖下穿)的 BFS,
 * 证明 5 关所有金块与顶层出口全部可达(即关卡理论可通)。 */
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

const html = fs.readFileSync(path.join(ROOT, 'hyper_lode_runner.html'), 'utf8');
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
function setP(x, y) { T.pl.x = x; T.pl.y = y; T.pl.ft = 0; T.pl.mt = 0; }

/* ================= 1. 关卡数据自检 + BFS 可达性(可通关证明) ================= */
console.log('== 1. level data & reachability ==');
/* 与游戏一致的移动规则 BFS(隐藏梯子视为已出现):
 * 走:左右非实体;上:梯子;下:非实体即可(梯子/放手/坠落统一);
 * 挖:站立时斜下方是砖且斜上方可进 -> 可落进洞;洞下若还是空则继续落。 */
function bfsReach(rows) {
  const at = (x, y) => (x < 0 || y < 0 || x >= 20 || y >= 14) ? '@' : (rows[y][x] || ' ');
  const solid = (x, y) => at(x, y) === '#' || at(x, y) === '@';
  const ladder = (x, y) => at(x, y) === 'H' || at(x, y) === '~';
  const bar = (x, y) => at(x, y) === '-';
  const support = (x, y) => ladder(x, y) || bar(x, y) || solid(x, y + 1) || ladder(x, y + 1);
  let sx = -1, sy = -1;
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < 20; x++) if (at(x, y) === 'P') { sx = x; sy = y; }
  const seen = new Set([sy * 20 + sx]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    const add = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= 20 || ny >= 14) return;
      const k = ny * 20 + nx;
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); }
    };
    if (!solid(x - 1, y)) add(x - 1, y);                       // 走左
    if (!solid(x + 1, y)) add(x + 1, y);                       // 走右
    if ((ladder(x, y) || ladder(x, y - 1)) && !solid(x, y - 1)) add(x, y - 1); // 上梯
    if (!solid(x, y + 1)) add(x, y + 1);                       // 下梯/落杠/坠落
    if (support(x, y)) {                                       // 站稳才能挖
      for (const dx of [-1, 1]) {
        if (at(x + dx, y + 1) === '#' && !solid(x + dx, y)) add(x + dx, y + 1); // 挖斜下砖落进洞
      }
    }
  }
  return seen;
}
let dataOk = true;
ok(T.LEVELS.length === 5, 'exactly 5 levels built in');
for (let i = 0; i < 5; i++) {
  const rows = T.LEVELS[i];
  const tag = 'L' + (i + 1);
  if (rows.length !== 14) { dataOk = false; console.log('  ' + tag + ' rows=' + rows.length); }
  const widths = new Set(rows.map(r => r.length));
  if (widths.size !== 1 || !widths.has(20)) { dataOk = false; console.log('  ' + tag + ' bad widths: ' + [...widths]); }
  let players = 0, golds = 0, guards = 0, carriers = 0, hidden = 0;
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < 20; x++) {
      const ch = rows[y][x] || ' ';
      if (ch === 'P') players++;
      if (ch === '*') golds++;
      if (ch === 'G') guards++;
      if (ch === 'g') { guards++; carriers++; }
      if (ch === '~') hidden++;
    }
  if (players !== 1) { dataOk = false; console.log('  ' + tag + ' players=' + players); }
  if (golds + carriers < 1) { dataOk = false; console.log('  ' + tag + ' no gold'); }
  if (guards < 1) { dataOk = false; console.log('  ' + tag + ' no guards'); }
  if (hidden < 1) { dataOk = false; console.log('  ' + tag + ' no hidden ladder'); }
  const reach = bfsReach(rows);
  let unreachable = [];
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < 20; x++)
      if ((rows[y][x] || ' ') === '*' && !reach.has(y * 20 + x)) unreachable.push(x + ',' + y);
  if (unreachable.length) { dataOk = false; console.log('  ' + tag + ' UNREACHABLE gold: ' + unreachable.join(' ')); }
  let topOk = false;
  for (let x = 0; x < 20; x++) if (reach.has(x)) { topOk = true; break; }
  if (!topOk) { dataOk = false; console.log('  ' + tag + ' top row unreachable'); }
  console.log('  ' + tag + ': gold=' + golds + (carriers ? '+' + carriers + ' carried' : '') +
              ' guards=' + guards + ' reachable=' + reach.size + (unreachable.length ? ' UNREACHABLE!' : ' all gold+top reachable'));
}
ok(dataOk, 'all 5 levels: 20x14, 1 player, gold+guards+hidden ladder present, all gold & top reachable');

/* ================= 2. 标题画面 + 闪烁 PRESS START ================= */
console.log('== 2. title ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
while (T.game.frame % 32 >= 16) steps(1);       // 对齐 PRESS START 可见相位
snap('h01_title');
ok(countPx(36, 106, 88, 8, 0) > 30, 'PRESS START visible phase draws pixels');
steps(16);
T.render();
ok(countPx(36, 106, 88, 8, 0) === 0, 'PRESS START blink hidden phase is blank');
ok(countPx(32, 28, 96, 32, 0) > 100, 'title big text drawn');

/* ================= 3. 开始游戏 + 挖掘/碎裂/恢复 ================= */
console.log('== 3. dig / crumble / regrow ==');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.PLAY && T.level === 0 && T.lives === 3, 'START begins level 1 with 3 lives');
snap('h02_opening');
setP(10, 5);                                    // 站在第 6 行砖平台上
T.pl.inv = 0;
ok(T.isSolid(10, 6) && T.tileAt(10, 6) === '#', 'standing on brick platform');
ok(T.tryDig(1) === true, 'dig right-down brick accepted');
ok(T.tryDig(1) === false, 'double dig on same brick rejected');
const hi = 6 * 20 + 11;
const hole = T.holes.get(hi);
ok(hole && hole.state === 'crumble', 'brick enters crumble state');
/* 碎裂 3 帧画面互不相同且砖像素递减 */
const pix = [];
for (let f = 0; f < 3; f++) {
  T.render();
  pix.push(countPx(T.OX + 11 * 8, T.OY + 6 * 8, 8, 8, 0) + countPx(T.OX + 11 * 8, T.OY + 6 * 8, 8, 8, 1));
  steps(6);
}
ok(pix[0] > pix[1] && pix[1] > pix[2], 'crumble anim: 3 frames, brick pixels decreasing (' + pix.join('>') + ')');
snap('h03_crumble_done');
ok(T.holes.get(hi).state === 'open', 'after crumble the hole is open');
ok(T.isSolid(11, 6) === false, 'open hole is passable');
/* 恢复渐显 3 步像素递增,最后变回整砖 */
T.holes.get(hi).t = 2;                          // 快进:2 帧后开始恢复
steps(3);
ok(T.holes.get(hi) && T.holes.get(hi).state === 'fade', 'hole starts fading back');
const fp = [];
for (let f = 0; f < 3; f++) {
  T.render();
  fp.push(countPx(T.OX + 11 * 8, T.OY + 6 * 8, 8, 8, 0) + countPx(T.OX + 11 * 8, T.OY + 6 * 8, 8, 8, 1));
  steps(6);
}
ok(fp[0] < fp[1] && fp[1] < fp[2], 'regrow fade-in: pixels increasing (' + fp.join('<') + ')');
steps(4);
ok(!T.holes.has(hi) && T.isSolid(11, 6), 'brick fully restored after ~5s cycle');
/* 混凝土不可挖 */
setP(2, 12);                                    // 出生点左侧角落是混凝土装饰块
ok(T.tileAt(1, 13) === '@' && T.tryDig(-1) === false, 'concrete block cannot be dug');

/* ================= 4. 移动规则:爬梯/单杠/重力/不能跳 ================= */
console.log('== 4. movement rules ==');
T.loadLevel(0);
setP(4, 11);                                    // 第 1 关梯子底部
T.key('up', true); steps(30); T.key('up', false);
ok(T.pl.y < 11, 'climbing ladder goes up (y=' + T.pl.y + ')');
const yTop = T.pl.y;
steps(30);
ok(T.pl.y === yTop, 'hangs on ladder without falling (no jump/fall off)');
setP(4, 2);                                     // 梯子顶,横向走上平台
T.key('right', true); steps(7); T.key('right', false);
ok(T.pl.x === 5 && T.pl.y === 2, 'walked off ladder onto platform');
T.key('right', true); steps(60); T.key('right', false);
ok(T.pl.x > 5 && T.pl.x <= 16 && T.pl.y === 2, 'walks along platform without falling (x=' + T.pl.x + ', y=' + T.pl.y + ')');
/* 单杠:第 2 关,从平台边走上单杠悬挂,松手落下 */
T.loadLevel(1);
setP(2, 5);                                     // r6 平台表面,正下方是砖
steps(1);
ok(T.pl.y === 5 && T.isSolid(2, 6), 'stands on r6 platform');
T.key('left', true); steps(40); T.key('left', false); // 向左走出平台边缘 -> 坠落
ok(T.pl.y > 5, 'walked off edge and fell (y=' + T.pl.y + ')');
setP(3, 6); T.holes.set(6 * 20 + 3, { state: 'open', t: 500 }); // 人工开洞体验坠落路线
steps(30);
ok(T.pl.y >= 8, 'fell through dug hole to bar/floor below (y=' + T.pl.y + ')');
ok(T.isBar(3, 8) ? (T.pl.x === 3 && T.pl.y === 8) : true, 'lands hanging on the bar');
snap('h04_bar_hang');

/* ================= 5. 金块收集 + 隐藏梯子 + 过关 ================= */
console.log('== 5. gold / hidden ladder / clear ==');
T.loadLevel(0);
T.pl.inv = 999999;                              // 测试期间免打扰
const g0 = T.goldLeft();
setP(12, 12);                                   // 金块 (11,12) 右边一格
T.key('left', true); steps(7); T.key('left', false);
ok(T.goldLeft() === g0 - 1 && T.score >= 100, 'walking onto gold collects it (+100)');
/* 传送收掉其余全部金块 */
for (const idx of [...T.gold]) { setP(idx % 20, (idx / 20) | 0); steps(1); }
ok(T.goldLeft() === 0, 'all gold collected');
ok(T.revealed === true, 'hidden ladder revealed after last gold');
/* 隐藏梯子真的画出来了(第 1 关在 (4,1)) */
T.render();
ok(countPx(T.OX + 4 * 8, T.OY + 1 * 8, 8, 8, 0) >= 6, 'revealed ladder pixels drawn at top');
snap('h05_revealed');
setP(4, 2);
T.key('up', true); steps(20); T.key('up', false);
ok(T.game.state === T.ST.CLEAR, 'climbing to top row after reveal -> CLEAR');
snap('h06_clear');
steps(111);
ok(T.game.state === T.ST.PLAY && T.level === 1, 'auto-advance to level 2 after jingle');

/* ================= 6. 守卫 AI:追踪/掉洞被困/爬出/埋掉重生掉金 ================= */
console.log('== 6. guard AI ==');
T.loadLevel(0);
T.pl.inv = 999999;
steps(30);                                      // 守卫先落到地面
const g6 = T.guards[0];
const d0 = Math.abs(g6.x - T.pl.x) + Math.abs(g6.y - T.pl.y);
steps(180);
const d1 = Math.abs(g6.x - T.pl.x) + Math.abs(g6.y - T.pl.y);
ok(d1 < d0, 'guard chases player (manhattan ' + d0 + ' -> ' + d1 + ')');
snap('h02_play_l1');
/* 掉洞被困 -> 时间到爬出 */
T.loadLevel(2);
T.pl.inv = 999999;
setP(18, 12);                                   // 玩家停远点
let cg = T.guards.find(g => g.carry);
ok(!!cg, 'level 3 has a gold carrier guard');
cg.x = 5; cg.y = 12; cg.gt = T.C.GUARD_T; cg.ft = 0;  // 传送 + 冻结决策节拍
T.holes.set(13 * 20 + 5, { state: 'open', t: T.C.TRAP_T + 60 });
steps(T.C.FALL_T + 1);
ok(cg.x === 5 && cg.y === 13, 'guard fell into open pit');
ok(cg.trap > 0, 'guard is trapped in the pit');
snap('h07_trapped');
steps(T.C.TRAP_T + 8);
ok(cg.y <= 12, 'guard climbs out when trap time expires (y=' + cg.y + ')');
/* 砖先恢复 -> 被埋 -> 顶部重生 + 掉落金块 */
T.loadLevel(2);
T.pl.inv = 999999;
setP(18, 12);
cg = T.guards.find(g => g.carry);
cg.x = 5; cg.y = 12; cg.gt = T.C.GUARD_T; cg.ft = 0;
T.holes.set(13 * 20 + 5, { state: 'open', t: 30 });
steps(T.C.FALL_T + 1);
ok(cg.y === 13 && cg.trap > 0, 'carrier fell in and is trapped');
const s0 = T.score, gl0 = T.goldLeft();
T.holes.get(13 * 20 + 5).t = 2;                 // 快进恢复
steps(4);
ok(T.score === s0 + 50, 'buried guard scores +50');
ok(!cg.carry, 'buried carrier drops its gold');
ok(T.gold.has(12 * 20 + 5), 'dropped gold appears above the refilled brick');
ok(T.goldLeft() === gl0, 'gold total conserved (carried -> tile)');
ok(cg.y <= 1, 'buried guard respawns at top row (y=' + cg.y + ')');

/* ================= 7. 死亡/扣命/Game Over ================= */
console.log('== 7. death / game over ==');
T.loadLevel(0);
steps(5);
T.pl.inv = 0;
let gg = T.guards[0];
gg.x = T.pl.x; gg.y = T.pl.y; gg.gt = T.C.GUARD_T; gg.ft = 0; // 强制触碰(冻结决策节拍防跑开)
steps(1);
ok(T.deadT > 0, 'touching a guard triggers death');
steps(T.C.DEAD_T);
ok(T.lives === 2, 'death costs one life (lives=2)');
ok(T.pl.x === T.pl.sx && T.pl.y === T.pl.sy, 'player respawns at spawn point');
ok(T.pl.inv > 0, 'respawn grants invincibility');
/* 埋玩家也扣命:挖开的砖恢复时玩家还在洞里(第 3 关砖地) */
T.loadLevel(2);
steps(2);
T.pl.inv = 0;
setP(5, 12);                                    // 砖地面上
T.holes.set(13 * 20 + 5, { state: 'open', t: 30 });
steps(T.C.FALL_T + 1);
ok(T.pl.y === 13, 'player fell into the pit');
T.holes.get(13 * 20 + 5).t = 2;
steps(4);
ok(T.deadT > 0, 'player buried by regrowing brick dies');
steps(T.C.DEAD_T);
ok(T.lives === 1, 'burial costs another life (lives=1)');
/* 最后一条命 -> GAME OVER */
T.pl.inv = 0;
gg = T.guards[0];
gg.x = T.pl.x; gg.y = T.pl.y; gg.gt = T.C.GUARD_T; gg.ft = 0;
steps(1);
steps(T.C.DEAD_T);
ok(T.game.state === T.ST.OVER && !T.game.overAll, 'losing all lives -> GAME OVER');
steps(40);
snap('h08_gameover');
ok(countPx(8, 36, 144, 16, 0) > 100, 'GAME OVER text drawn');
while (T.game.frame % 32 >= 16) steps(1);
T.render();
ok(countPx(36, 106, 88, 8, 0) > 30, 'GAME OVER shows blinking PRESS START');
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'PRESS START returns to title');

/* ================= 8. 第 5 关全通 -> ALL CLEAR ================= */
console.log('== 8. all clear ==');
T.loadLevel(4);
T.pl.inv = 999999;
for (const idx of [...T.gold]) { setP(idx % 20, (idx / 20) | 0); steps(1); }
const cg8 = T.guards.find(g => g.carry);
if (cg8) { cg8.carry = false; T.gold.add(12 * 20 + 19); setP(19, 12); steps(1); } // 模拟收掉携带金
ok(T.goldLeft() === 0 && T.revealed, 'level 5 all gold -> revealed');
setP(4, 1);                                     // 隐藏梯子 (~) 处
steps(1);
T.key('up', true); steps(8); T.key('up', false);
ok(T.game.state === T.ST.CLEAR, 'level 5 cleared');
steps(111);
ok(T.game.state === T.ST.OVER && T.game.overAll, 'all 5 levels -> ALL CLEAR screen');
steps(40);
snap('h09_allclear');
ok(countPx(8, 36, 144, 16, 0) > 100, 'ALL CLEAR text drawn');

/* ================= 9. 机器人随机乱按 6000 帧 ================= */
console.log('== 9. bot fuzz ==');
T.loadLevel(2);                                 // 砖地关卡,机器人能真正挖洞
let seed = 4242;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let fuzzOk = true, deaths = 0, digs = 0, clears = 0, overs = 0;
const K = ['left', 'right', 'up', 'down', 'a', 'b'];
let holesSeen = 0;
for (let f = 0; f < 6000; f++) {
  for (const k of K) if (rnd() < 0.3) T.key(k, rnd() < 0.6);
  T.step();
  if (T.holes.size > 0) { holesSeen++; digs++; }
  if (T.deadT === T.C.DEAD_T - 1) deaths++;
  if (T.game.state === T.ST.CLEAR) { clears++; steps(111); }
  if (T.game.state === T.ST.OVER) { overs++; steps(50); T.loadLevel(2); }
  if (f % 50 === 0 && T.game.state === T.ST.PLAY && T.deadT === 0) {
    const ents = [T.pl, ...T.guards];
    for (const e of ents) {
      if (e.x < 0 || e.x >= 20 || e.y < 0 || e.y >= 14) fuzzOk = false;
      else if (T.isSolid(e.x, e.y)) fuzzOk = false;          // 实体卡进墙里
    }
    if (T.goldLeft() < 0) fuzzOk = false;
    if (T.guards.length !== T.parseLevel(T.LEVELS[T.level]).guards.length) fuzzOk = false;
  }
}
ok(fuzzOk, 'fuzz: nobody inside solid tiles, in-bounds, gold>=0, guard count constant');
ok(digs > 30, 'fuzz actually dug holes (' + digs + ' frames with holes)');
console.log('  (bot: ' + deaths + ' deaths, ' + clears + ' clears, ' + overs + ' game overs)');
T.render();
snap('h10_fuzz_end');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
