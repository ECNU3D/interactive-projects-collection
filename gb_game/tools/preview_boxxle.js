#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 boxxle.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素,渲染成 BMP 供人工检查,
 * 并对核心规则(关卡数据/移动推箱/撤销/重开/过关/全通礼花)做断言。
 * 另内置一个独立的推箱子求解器(贪心 best-first + 角 deadlock 剪枝),
 * 证明 15 关全部可解,并把解逐步回放到真实游戏代码里交叉验证。 */
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
const D = [[0, 1], [0, -1], [-1, 0], [1, 0]];   // 0下 1上 2左 3右

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
const lsStore = {};                              // localStorage 内存桩
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Set, Map,
  document: {
    getElementById: id => (id === 'gb' ? canvasStub : elStub()),
    querySelectorAll: () => [],
  },
  localStorage: {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; },
  },
  performance: { now: () => 0 },
  requestAnimationFrame: () => {},
  addEventListener() {},
  innerWidth: 800, innerHeight: 600,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(ROOT, 'boxxle.html'), 'utf8');
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

/* ================= 独立求解器(不依赖游戏内代码) ================= */
function parseLvl(rows) {
  const h = rows.length, w = Math.max.apply(null, rows.map(r => r.length));
  const wall = new Set(), goals = new Set();
  let boxes = [], p = -1, players = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] || ' ';
      const i = y * w + x;
      if (ch === '#') wall.add(i);
      if (ch === '.' || ch === '*' || ch === '+') goals.add(i);
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') { p = i; players++; }
    }
  return { w, h, wall, goals, boxes: boxes.sort((a, b) => a - b), p, players, rows };
}
/* 玩家可达区域(不跨箱子) */
function reachable(L, p, boxSet) {
  const reach = new Set([p]);
  const q = [p];
  while (q.length) {
    const i = q.pop(), x = i % L.w, y = (i / L.w) | 0;
    for (const [dx, dy] of D) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
      const j = ny * L.w + nx;
      if (L.wall.has(j) || boxSet.has(j) || reach.has(j)) continue;
      reach.add(j); q.push(j);
    }
  }
  return reach;
}
/* 简单角 deadlock:箱子在非目标点的死角(两垂直墙夹角) */
function cornerDead(L, i) {
  if (L.goals.has(i)) return false;
  const x = i % L.w, y = (i / L.w) | 0;
  const at = (xx, yy) => L.wall.has(yy * L.w + xx);
  const u = at(x, y - 1), d = at(x, y + 1), l = at(x - 1, y), r = at(x + 1, y);
  return (u && l) || (u && r) || (d && l) || (d && r);
}
/* 小顶堆 */
function heapPush(heap, item) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const par = (i - 1) >> 1;
    if (heap[par].f <= heap[i].f) break;
    [heap[par], heap[i]] = [heap[i], heap[par]];
    i = par;
  }
}
function heapPop(heap) {
  const top = heap[0], last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < heap.length && heap[l].f < heap[m].f) m = l;
      if (r < heap.length && heap[r].f < heap[m].f) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}
/* 贪心 best-first(f = 推数 + 2*曼哈顿启发),返回 {pushes, path:[{box,dir}]} 或 null */
function solve(L, cap) {
  const goalArr = [...L.goals];
  const key = (p, boxes) => p + '|' + boxes.join(',');
  const heuristic = boxes => {
    let s = 0;
    for (const b of boxes) {
      const bx = b % L.w, by = (b / L.w) | 0;
      let m = 1e9;
      for (const g of goalArr) m = Math.min(m, Math.abs(g % L.w - bx) + Math.abs(((g / L.w) | 0) - by));
      s += m;
    }
    return s;
  };
  const win = boxes => goalArr.every(g => boxes.includes(g));
  const start = { p: L.p, boxes: L.boxes.slice(), g: 0, f: 0, path: [] };
  start.f = 2 * heuristic(start.boxes);
  const seen = new Set([key(start.p, start.boxes)]);
  const heap = [start];
  let explored = 0;
  while (heap.length) {
    const node = heapPop(heap);
    if (win(node.boxes)) return { pushes: node.g, path: node.path };
    if (++explored > cap) return null;
    const boxSet = new Set(node.boxes);
    const reach = reachable(L, node.p, boxSet);
    for (let bi = 0; bi < node.boxes.length; bi++) {
      const b = node.boxes[bi], bx = b % L.w, by = (b / L.w) | 0;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = D[d];
        const bhx = bx - dx, bhy = by - dy, ahx = bx + dx, ahy = by + dy;
        if (bhx < 0 || bhy < 0 || bhx >= L.w || bhy >= L.h) continue;
        if (ahx < 0 || ahy < 0 || ahx >= L.w || ahy >= L.h) continue;
        const behind = bhy * L.w + bhx, ahead = ahy * L.w + ahx;
        if (!reach.has(behind)) continue;
        if (L.wall.has(ahead) || boxSet.has(ahead)) continue;
        if (cornerDead(L, ahead)) continue;
        const nb = node.boxes.slice();
        nb[bi] = ahead;
        nb.sort((a, b2) => a - b2);
        const k = key(b, nb);
        if (seen.has(k)) continue;
        seen.add(k);
        heapPush(heap, { p: b, boxes: nb, g: node.g + 1, f: node.g + 1 + 2 * heuristic(nb), path: node.path.concat([{ box: b, dir: d }]) });
      }
    }
  }
  return null;
}
/* 人从 from 走到 to 的方向序列(绕开箱子) */
function walkPath(L, from, to, boxSet) {
  if (from === to) return [];
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const i = q.shift();
    if (i === to) break;
    const x = i % L.w, y = (i / L.w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + D[d][0], ny = y + D[d][1];
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
      const j = ny * L.w + nx;
      if (L.wall.has(j) || boxSet.has(j) || prev.has(j)) continue;
      prev.set(j, { p: i, d });
      q.push(j);
    }
  }
  if (!prev.has(to)) return null;
  const path = [];
  let c = to;
  while (prev.get(c)) { path.unshift(prev.get(c).d); c = prev.get(c).p; }
  return path;
}
/* 把解回放到真实游戏(T.tryMove),镜像状态逐步交叉验证 */
function replay(L, sol) {
  let mP = L.p;
  const mBoxes = L.boxes.slice();
  for (const push of sol.path) {
    const bx = push.box % L.w, by = (push.box / L.w) | 0;
    const [dx, dy] = D[push.dir];
    const behind = (by - dy) * L.w + (bx - dx);
    const path = walkPath(L, mP, behind, new Set(mBoxes));
    if (!path) return 'no walk path to ' + JSON.stringify(push);
    for (const d of path) {
      if (!T.tryMove(d)) return 'walk step rejected at ' + JSON.stringify(push);
      mP += D[d][1] * L.w + D[d][0];
    }
    if (!T.tryMove(push.dir)) return 'push rejected at ' + JSON.stringify(push);
    const bi = mBoxes.indexOf(push.box);
    mBoxes[bi] = push.box + dy * L.w + dx;
    mBoxes.sort((a, b) => a - b);
    mP = push.box;
    if (T.p !== mP) return 'player mismatch: page=' + T.p + ' mirror=' + mP;
    const tb = T.boxes.slice().sort((a, b) => a - b);
    if (tb.join(',') !== mBoxes.join(',')) return 'boxes mismatch: page=' + tb + ' mirror=' + mBoxes;
  }
  return null;
}

/* ================= 1. 关卡数据自检 + 全部可解证明 ================= */
console.log('== 1. level data & solvability ==');
let dataOk = true;
const solutions = [];
for (let i = 0; i < 15; i++) {
  const rows = T.LEVELS[i];
  const L = parseLvl(rows);
  const widths = new Set(rows.map(r => r.length));
  if (widths.size !== 1) { dataOk = false; console.log('  L' + (i + 1) + ' ragged rows: ' + [...widths]); }
  if (L.players !== 1) { dataOk = false; console.log('  L' + (i + 1) + ' players=' + L.players); }
  if (L.boxes.length !== L.goals.size) {
    dataOk = false;
    console.log('  L' + (i + 1) + ' boxes=' + L.boxes.length + ' goals=' + L.goals.size);
  }
  const sol = solve(L, 400000);
  solutions.push(sol);
  if (!sol) { dataOk = false; console.log('  L' + (i + 1) + ' UNSOLVABLE'); }
  else console.log('  L' + String(i + 1).padStart(2) + ' solved: ' + sol.pushes + ' pushes, ' + L.boxes.length + ' boxes');
}
ok(dataOk, 'all 15 levels: rectangular, 1 player, boxes==goals, solvable');
ok(T.LEVELS.length === 15, 'exactly 15 levels built in');

/* ================= 2. 标题画面 + 选关 ================= */
console.log('== 2. title / level select ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
while (T.game.frame % 32 >= 16) steps(1);       // 对齐 PRESS START 可见相位
snap('b01_title');
ok(countPx(36, 100, 88, 8, 0) > 30, 'PRESS START visible phase draws pixels');
steps(16);
T.render();
ok(countPx(36, 100, 88, 8, 0) === 0, 'PRESS START blink hidden phase is blank');
ok(T.sel === 0 && T.unlocked === 1, 'fresh save: unlocked=1, cursor on LEVEL 01');
T.key('right', true); steps(2); T.key('right', false);
ok(T.sel === 0, 'level select clamped at unlocked (still LEVEL 01)');
T.setUnlocked(5);
T.key('right', true); steps(2); T.key('right', false);
T.key('right', true); steps(2); T.key('right', false);
ok(T.sel === 2, 'unlocked=5: right x2 -> LEVEL 03, sel=' + T.sel);
T.key('right', true); steps(2); T.key('right', false);
T.key('right', true); steps(2); T.key('right', false);
T.key('right', true); steps(2); T.key('right', false);
ok(T.sel === 4, 'clamped at highest unlocked LEVEL 05, sel=' + T.sel);
T.key('left', true); steps(2); T.key('left', false);
ok(T.sel === 3, 'left -> LEVEL 04');
T.setSel(0); T.setUnlocked(1);                  // 还原清爽存档

/* ================= 3. 开始游戏 + 基本移动/推箱 ================= */
console.log('== 3. start / movement / push ==');
T.loadLevel(0);
ok(T.game.state === T.ST.PLAY && T.cur === 0, 'loadLevel(0) enters PLAY on level 1');
const L1 = parseLvl(T.LEVELS[0]);
ok(T.p === L1.p && T.boxes.join(',') === L1.boxes.join(','), 'player/boxes match level data');
ok(T.tryMove(2) === false && T.steps === 0, 'walking into wall rejected (left)');
ok(T.dirIdx === 2, 'facing still turns toward the wall');
ok(T.tryMove(3) === true && T.steps === 1, 'first push right accepted');
ok(T.boxes[0] === L1.boxes[0] + 1, 'box moved 1 cell right');
ok(T.p === L1.p + 1, 'player follows behind box');
/* 撤销:连撤两步回到开局 */
T.undo(); T.undo();
ok(T.steps === 0 && T.boxes[0] === L1.boxes[0] && T.p === L1.p, 'undo x2 restores initial state');
ok(T.histLen === 0, 'undo stack empty at start state');
T.undo();
ok(T.steps === 0, 'undo on empty stack is a no-op');
/* 重开 */
T.tryMove(3); T.tryMove(3);
T.restart();
ok(T.steps === 0 && T.boxes[0] === L1.boxes[0], 'Select restart resets the level');
/* 推第 3 步即过关 */
T.tryMove(3); T.tryMove(3);
ok(T.game.state === T.ST.PLAY, '2 pushes: still playing');
T.tryMove(3);
ok(T.game.state === T.ST.CLEAR, '3rd push lands box on goal -> CLEAR');
ok(T.best[0] === 3, 'best steps recorded: 3, got ' + T.best[0]);
ok(T.unlocked === 2, 'level 2 unlocked');
const saved1 = JSON.parse(lsStore.boxxle_save || '{}');
ok(saved1.unlocked === 2 && saved1.best && saved1.best[0] === 3, 'save persisted to localStorage');
snap('b02_clear_flash');
steps(111);
ok(T.game.state === T.ST.PLAY && T.cur === 1, 'auto-advance to level 2 after jingle');

/* ================= 4. 目标点变色 + 关卡 3 全流程(键盘连发) ================= */
console.log('== 4. box-on-goal highlight / key-repeat playthrough ==');
T.loadLevel(2);
const L2 = parseLvl(T.LEVELS[2]);
/* 用真实按键走:右 x3 把第一个箱子推上目标点 */
T.key('right', true);
steps(1);
ok(T.anim !== null, 'held key starts slide animation');
steps(40);
T.key('right', false);
const onGoalBox = T.boxes.find(b => T.lv.goals.has(b));
ok(onGoalBox !== undefined, 'held-key auto-repeat pushed box onto goal');
ok(T.game.state === T.ST.PLAY, 'one box left: still playing');
snap('b03_on_goal');
/* 撤销可一路撤到开局 */
for (let i = 0; i < 10; i++) T.undo();
ok(T.steps === 0 && T.p === L2.p && T.boxes.join(',') === L2.boxes.join(','), 'undo chain reaches level start');

/* ================= 5. 求解器解回放(真机交叉验证,抽样 4 关) ================= */
console.log('== 5. solver replay through real game ==');
for (const idx of [2, 8, 11, 13]) {             // 关卡 3/9/12/14
  T.loadLevel(idx);
  const L = parseLvl(T.LEVELS[idx]);
  if (!solutions[idx]) { ok(false, 'L' + (idx + 1) + ' has no solution to replay'); continue; }
  const err = replay(L, solutions[idx]);
  ok(err === null && T.game.state === T.ST.CLEAR,
     'L' + (idx + 1) + ' solution replays to CLEAR' + (err ? ' -- ' + err : ''));
  steps(111);                                    // 进入下一关
}

/* ================= 6. 第 15 关 -> ALL CLEAR 礼花 ================= */
console.log('== 6. final level -> ALL CLEAR ==');
T.setUnlocked(15);
T.loadLevel(14);
snap('b04_level15');
const L15 = parseLvl(T.LEVELS[14]);
const err15 = solutions[14] ? replay(L15, solutions[14]) : 'no solution';
ok(err15 === null, 'L15 solution replays cleanly' + (err15 ? ' -- ' + err15 : ''));
ok(T.game.state === T.ST.CLEAR, 'L15 finished -> CLEAR');
steps(111);
ok(T.game.state === T.ST.ALLCLEAR, 'all 15 clear -> ALLCLEAR fireworks');
steps(60);                                       // 放几轮礼花
ok(T.fw.parts.length > 0, 'firework particles alive, n=' + T.fw.parts.length);
snap('b05_allclear');
ok(countPx(0, 0, W, H, 0) > 8000, 'ALL CLEAR dark background');
ok(countPx(8, 24, 144, 16, 3) > 60, 'ALL CLEAR title text drawn');
steps(45);
T.key('start', true); steps(2); T.key('start', false);
ok(T.game.state === T.ST.TITLE, 'PRESS START returns to title');

/* ================= 7. 机器人随机乱按 4000 帧 ================= */
console.log('== 7. bot fuzz ==');
T.loadLevel(6);
let seed = 999;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let fuzzOk = true, undos = 0, restarts = 0, clears = 0;
const boxCount = parseLvl(T.LEVELS[6]).boxes.length;
for (let f = 0; f < 4000; f++) {
  const r = rnd();
  if (r < 0.25) T.key('left', rnd() < 0.5);
  if (r < 0.5) T.key('right', rnd() < 0.5);
  if (r < 0.6) T.key('up', rnd() < 0.5);
  if (r < 0.7) T.key('down', rnd() < 0.5);
  if (rnd() < 0.06) { T.key('b', true); undos++; } else T.key('b', false);
  if (rnd() < 0.02) { T.key('select', true); restarts++; } else T.key('select', false);
  T.step();
  if (T.game.state === T.ST.CLEAR) { clears++; steps(111); }
  if (f % 50 === 0 && T.game.state === T.ST.PLAY) {
    if (T.boxes.length !== boxCount) fuzzOk = false;
    if (T.lv.wall.has(T.p) || !T.lv.floor.has(T.p)) fuzzOk = false;
    const seen = new Set(T.boxes);
    if (seen.size !== T.boxes.length) fuzzOk = false;   // 箱子重叠
    for (const b of T.boxes) if (T.lv.wall.has(b)) fuzzOk = false;
  }
}
ok(fuzzOk, 'fuzz: box count constant, no overlap, nothing inside walls');
ok(undos > 20 && restarts > 5, 'fuzz exercised undo x' + undos + ', restart x' + restarts);
console.log('  (bot cleared the level ' + clears + ' time(s) by accident)');
T.render();
snap('b06_fuzz_end');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
