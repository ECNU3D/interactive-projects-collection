// 生成推荐游览路线：在与游戏一致的可行走栅格上跑 A*，逐段串起景点，
// 再做视线简化，写出 js/data/tour.js。用法：node tools/route.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---- 最小 DOM/Canvas 桩 ----
function fakeCtx() {
  const noop = () => {};
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    lineCap: '', lineJoin: '', globalAlpha: 1,
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, bezierCurveTo: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    fillText: noop, strokeText: noop, drawImage: noop, setTransform: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(160), width: w, height: h }),
    putImageData: noop,
  };
}
const stubEl = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {}, textContent: '', getContext: () => fakeCtx(), width: 100, height: 100,
});
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 256, height: 256, style: {}, getContext: () => fakeCtx(), addEventListener() {} }
    : stubEl()),
  getElementById: () => stubEl(),
  addEventListener() {}, removeEventListener() {}, querySelector: () => null, body: { appendChild() {} },
};
globalThis.window = {
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
  addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }),
};
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true }); } catch { /* Node 已内建 */ }
globalThis.self = globalThis.window;
globalThis.location = { search: '' };

const scene = { add() {}, children: [] };
const { buildCompound } = await import('../js/compound.js');
const { RONG_DEFS } = await import('../js/data/rong.js');
const { NING_DEFS } = await import('../js/data/ning.js');
const { YUAN_DEFS } = await import('../js/data/yuan.js');
const world = await import('../js/world.js');
const layout = await import('../js/layout.js');

world.buildGround(scene); world.buildWater(scene); world.buildBridges(scene);
world.buildStreet(scene); world.buildAlleys(scene);
for (const d of [...RONG_DEFS, ...NING_DEFS, ...YUAN_DEFS]) buildCompound(scene, d);

// ---------------------------------------------------------------- 栅格（与 selfcheck 一致）
const STEP_UP = 0.62, R = 0.5, CELL = 1.5;
const GX0 = -200, GX1 = 200, GZ0 = -870, GZ1 = 40;
const NX = Math.ceil((GX1 - GX0) / CELL), NZ = Math.ceil((GZ1 - GZ0) / CELL);
const idx = (i, j) => j * NX + i;
const cellX = (i) => GX0 + (i + 0.5) * CELL;
const cellZ = (j) => GZ0 + (j + 0.5) * CELL;
const toI = (x) => Math.round((x - GX0) / CELL - 0.5);
const toJ = (z) => Math.round((z - GZ0) / CELL - 0.5);

const blocked = new Uint8Array(NX * NZ);
for (const b of layout.colliders) {
  const i0 = Math.max(0, Math.floor((b.x0 - R - GX0) / CELL));
  const i1 = Math.min(NX - 1, Math.ceil((b.x1 + R - GX0) / CELL));
  const j0 = Math.max(0, Math.floor((b.z0 - R - GZ0) / CELL));
  const j1 = Math.min(NZ - 1, Math.ceil((b.z1 + R - GZ0) / CELL));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cx = cellX(i), cz = cellZ(j);
      if (cx > b.x0 - R && cx < b.x1 + R && cz > b.z0 - R && cz < b.z1 + R) blocked[idx(i, j)] = 1;
    }
  }
}
const H = new Float32Array(NX * NZ).fill(NaN);
for (let j = 0; j < NZ; j++) {
  for (let i = 0; i < NX; i++) {
    const h = layout.walkHeight(cellX(i), cellZ(j));
    if (h !== null) H[idx(i, j)] = h;
  }
}
const walkable = (c) => !blocked[c] && !Number.isNaN(H[c]);
const passable = (a, b) => walkable(b) && Math.abs(H[b] - H[a]) <= STEP_UP;

// 先把「从出生点走得到」的连通域算出来——景点中心常落在台基上，
// 若不限定连通域，snap 可能选到一个孤立的小平台，两点间自然找不到路。
const COMP = (() => {
  const seen = new Uint8Array(NX * NZ);
  const q = new Int32Array(NX * NZ);
  let head = 0, tail = 0;
  const s0 = idx(toI(layout.SPAWN.x), toJ(layout.SPAWN.z));
  q[tail++] = s0; seen[s0] = 1;
  const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < tail) {
    const c = q[head++];
    const ci = c % NX, cj = (c / NX) | 0;
    for (const [di, dj] of NB4) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = idx(ni, nj);
      if (seen[n] || !passable(c, n)) continue;
      seen[n] = 1; q[tail++] = n;
    }
  }
  return seen;
})();

/** 就近找一个与出生点连通的可走格 */
function snap(x, z) {
  const i0 = toI(x), j0 = toJ(z);
  for (let r = 0; r <= 20; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = i0 + di, j = j0 + dj;
        if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
        const c = idx(i, j);
        if (walkable(c) && COMP[c]) return c;
      }
    }
  }
  return -1;
}

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 广度优先——步长一致，用扁平队列即可，不必上堆 */
function bfs(start, goal) {
  const prev = new Int32Array(NX * NZ).fill(-1);
  const seen = new Uint8Array(NX * NZ);
  const q = new Int32Array(NX * NZ);
  let head = 0, tail = 0;
  q[tail++] = start; seen[start] = 1;
  let found = start === goal;
  while (head < tail && !found) {
    const c = q[head++];
    const ci = c % NX, cj = (c / NX) | 0;
    for (const [di, dj] of NB) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const n = idx(ni, nj);
      if (seen[n] || !passable(c, n)) continue;
      seen[n] = 1; prev[n] = c; q[tail++] = n;
      if (n === goal) { found = true; break; }
    }
  }
  if (!found) return null;
  const out = [];
  for (let c = goal; c !== -1; c = prev[c]) { out.push(c); if (c === start) break; }
  return out.reverse();
}

/** 视线简化：能一直线走过去就不必留中间点 */
function los(a, b) {
  const ax = cellX(a % NX), az = cellZ((a / NX) | 0);
  const bx = cellX(b % NX), bz = cellZ((b / NX) | 0);
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.6));
  let prevC = a;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const c = idx(toI(ax + (bx - ax) * t), toJ(az + (bz - az) * t));
    if (c < 0 || c >= NX * NZ) return false;
    if (!passable(prevC, c)) return false;
    prevC = c;
  }
  return true;
}
function simplify(cells) {
  const out = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    for (; j > i + 1; j--) if (los(cells[i], cells[j])) break;
    out.push(cells[j]);
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------- 站点顺序
const STOPS = [
  ['起点 · 宁荣街', -91.2, 26],
  ['荣国府大门', -91.2, -6],
  ['五道礼仪之门', -91.2, -44],
  ['荣禧堂', -91.2, -144],
  ['贾母院', -147, -94],
  ['凤姐院', -151, -148],
  ['贾赦东院', -37, -55],
  ['梨香院', -38, -184],
  ['宁荣夹道', 0, -180],
  ['大观园正门', -20, -218],
  ['翠嶂 · 曲径通幽', -18, -248],
  ['沁芳亭桥', -20, -291],
  ['潇湘馆', -119, -318],
  ['花冢', -152, -340],
  ['秋爽斋', -96, -402],
  ['稻香村', -134, -484],
  ['栊翠庵', -156, -564],
  ['芦雪广', -64, -632],
  ['蓼汀花溆', -30, -681],
  ['嘉荫堂', -8, -704],
  ['省亲别墅', 0, -622],
  ['凸碧山庄', 140, -782],
  ['凹晶溪馆', 118, -806],
  ['沁芳闸', 168, -804],
  ['荇叶渚', 84, -612],
  ['蘅芜苑', 28, -510],
  ['暖香坞', 145, -500],
  ['缀锦楼 · 紫菱洲', 102, -448],
  ['藕香榭', 34, -438],
  ['滴翠亭', 66, -362],
  ['怡红院', 126, -334],
  ['天香楼', 150, -254],
  ['宁国府正堂', 91.2, -154],
  ['贾氏宗祠', 38, -48],
  ['终点 · 宁国府大门', 91.2, -6],
];

const pts = [];
const marks = [];
let fail = 0;
for (let s = 0; s < STOPS.length; s++) {
  const [name, x, z] = STOPS[s];
  const c = snap(x, z);
  if (c < 0) { console.error(`✗ 站点「${name}」附近找不到可走格`); fail++; continue; }
  marks.push({ name, x: +cellX(c % NX).toFixed(1), z: +cellZ((c / NX) | 0).toFixed(1) });
  if (s === 0) { pts.push(c); continue; }
  const from = pts[pts.length - 1];
  const path = bfs(from, c);
  if (!path) {
    console.error(`✗ 「${STOPS[s - 1][0]}」→「${name}」走不通`);
    fail++;
    pts.push(c);
    continue;
  }
  const simp = simplify(path);
  for (let k = 1; k < simp.length; k++) pts.push(simp[k]);
}

const poly = pts.map((c) => [+cellX(c % NX).toFixed(1), +cellZ((c / NX) | 0).toFixed(1)]);
let len = 0;
for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]);

const out = `// 推荐游览线路 —— 由 tools/route.mjs 在可行走栅格上跑 A* 生成，勿手改。
// 站点顺序依第十七回游园次第，路径保证与游戏碰撞规则一致（落水、超过 0.62m 高差均绕开）。
// 全长约 ${Math.round(len)} m
export const TOUR_PATH = ${JSON.stringify(poly)};

export const TOUR_STOPS = ${JSON.stringify(marks, null, 0).replace(/\},\{/g, '},\n  {').replace(/^\[/, '[\n  ').replace(/\]$/, ',\n]')};
`;
fs.writeFileSync(path.join(ROOT, 'js/data/tour.js'), out);
console.log(`${fail ? '✗ ' + fail + ' 段失败；' : '✓ '}站点 ${marks.length}　折点 ${poly.length}　全长 ${Math.round(len)}m → js/data/tour.js`);
process.exitCode = fail ? 1 : 0;
