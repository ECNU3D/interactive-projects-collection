// 自檢：在 Node 裡把整個世界造一遍，逐項核對。用法：node tools/selfcheck.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---- 最小 DOM/Canvas 樁 ----
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
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true }); } catch { /* Node 已內建 */ }
globalThis.self = globalThis.window;
globalThis.location = { search: '' };
globalThis.performance = globalThis.performance ?? { now: () => Number(process.hrtime.bigint() / 1000000n) };

const scene = { add() {}, children: [] };

const { cullables } = await import('../js/geo.js');
const { buildCompound } = await import('../js/compound.js');
const { RONG_DEFS } = await import('../js/data/rong.js');
const { NING_DEFS } = await import('../js/data/ning.js');
const { YUAN_DEFS } = await import('../js/data/yuan.js');
const world = await import('../js/world.js');
const layout = await import('../js/layout.js');
const { POIS } = await import('../js/pois.js');
const { FIGURES, Crowd } = await import('../js/people.js');
const { buildNav, navOk } = await import('../js/nav.js');
const { INTERIORS } = await import('../js/interior.js');
const { PLAQUES, COUPLETS, plaqueMisses } = await import('../js/plaques.js');
const { SPOT_NAME } = await import('../js/map.js');

world.buildGround(scene); world.buildWater(scene); world.buildBridges(scene);
world.buildStreet(scene); world.buildAlleys(scene);
const ALL = [...RONG_DEFS, ...NING_DEFS, ...YUAN_DEFS];
for (const d of ALL) buildCompound(scene, d);

const fails = [], warns = [], extraLines = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const warn = (cond, msg) => { if (!cond) warns.push(msg); };

// ---------------------------------------------------------------- 1. 音頻齊備
const narr = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/narrations.json'), 'utf8'));
const audioDir = path.join(ROOT, 'audio');
const mp3 = new Set(fs.readdirSync(audioDir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
for (const p of POIS) {
  ok(narr[p.id], `POI「${p.id}」缺講解詞`);
  ok(mp3.has(p.id), `POI「${p.id}」缺 mp3`);
}
for (const f of FIGURES) {
  const id = f.narr ?? f.id;
  ok(narr[id], `人物「${f.name}」的講解 id「${id}」缺講解詞`);
  ok(mp3.has(id), `人物「${f.name}」的講解 id「${id}」缺 mp3`);
}
for (const b of ['bgm_fu', 'bgm_yuan', 'bgm_ye']) ok(mp3.has(b), `缺配樂 ${b}.mp3`);
const usedNarr = new Set([...POIS.map((p) => p.id), ...FIGURES.map((f) => f.narr ?? f.id)]);
for (const k of Object.keys(narr)) warn(usedNarr.has(k), `講解「${k}」未被任何觸發點使用`);

// ---------------------------------------------------------------- 2. 題名齊備
for (const t of plaqueMisses) warn(false, `題名「${t}」不在匾額圖集中（會回落到第一格）`);
for (const p of POIS) warn(p.id === 'welcome' || SPOT_NAME[p.id], `景點「${p.id}」在全圖上沒有中文名`);

// ---------------------------------------------------------------- 3. 每個講解點站得住、走得到
for (const p of POIS) {
  const h = layout.walkHeight(p.x, p.z);
  ok(h !== null, `講解點「${p.id}」落在水面上，走不到`);
  // 觸發半徑內不應被碰撞盒完全塞死
  let free = 0;
  for (let a = 0; a < 8; a++) {
    const px = p.x + Math.cos(a * 0.785) * p.r * 0.6;
    const pz = p.z + Math.sin(a * 0.785) * p.r * 0.6;
    if (layout.walkHeight(px, pz) !== null && !layout.colliders.some(
      (b) => px > b.x0 - 0.5 && px < b.x1 + 0.5 && pz > b.z0 - 0.5 && pz < b.z1 + 0.5)) free++;
  }
  ok(free >= 2, `講解點「${p.id}」四周被堵死（8 個方位只有 ${free} 個可站）`);
}

// ---------------------------------------------------------------- 4. 人物不站在牆裡／水裡
for (const f of FIGURES) {
  ok(layout.walkHeight(f.x, f.z) !== null, `人物「${f.name}」站在水面上`);
  const inWall = layout.colliders.some(
    (b) => f.x > b.x0 && f.x < b.x1 && f.z > b.z0 && f.z < b.z1);
  warn(!inWall, `人物「${f.name}」站在碰撞盒裡（${f.x},${f.z}）`);
}

// ---------------------------------------------------------------- 5. 室內錨點落在對應建築內
for (const it of INTERIORS) {
  const onPlatform = layout.platforms.some(
    (p) => it.x > p.x0 && it.x < p.x1 && it.z > p.z0 && it.z < p.z1 && Math.abs(p.h - (layout.groundHeight(it.x, it.z) + it.y)) < 1.2);
  warn(it.upper || onPlatform, `室內「${it.name}」的錨點高程 ${it.y} 與台基不符，家具可能懸空或陷入`);
}

// ---------------------------------------------------------------- 6. 橋確實跨在水上、園門通得過
for (const b of layout.BRIDGES) {
  const mx = (b.a[0] + b.b[0]) / 2, mz = (b.a[1] + b.b[1]) / 2;
  warn(layout.waterDepth(mx, mz) > -0.5, `橋「${b.name}」的中點不在水上`);
  for (const t of [-0.1, 1.1]) {
    const px = b.a[0] + (b.b[0] - b.a[0]) * t, pz = b.a[1] + (b.b[1] - b.a[1]) * t;
    ok(layout.walkHeight(px, pz) !== null, `橋「${b.name}」的橋頭落水，上不去`);
  }
}
// 桥两端与整跨都不该压进有墙的院子——园中的桥是过水的，不是穿院的
const WALLED = [...RONG_DEFS, ...NING_DEFS, ...YUAN_DEFS].filter((d) => d.wall !== false && d.x0 !== undefined);
for (const b of layout.BRIDGES) {
  const hw = b.w / 2;
  for (let t = -0.1; t <= 1.1001; t += 0.05) {
    const x = b.a[0] + (b.b[0] - b.a[0]) * t, z = b.a[1] + (b.b[1] - b.a[1]) * t;
    const hit = WALLED.find((d) => x > d.x0 - hw && x < d.x1 + hw && z > d.z0 - hw && z < d.z1 + hw);
    if (hit) { fails.push(`橋「${b.name}」壓進「${hit.name}」的院牆內`); break; }
  }
}
// 院牆不該被溪水穿過——牆與水交在一起，看上去就是一道墙泡在河里
for (const d of WALLED) {
  const edges = [
    [d.x0, d.z0, d.x1, d.z0], [d.x0, d.z1, d.x1, d.z1],
    [d.x0, d.z0, d.x0, d.z1], [d.x1, d.z0, d.x1, d.z1],
  ];
  let wet = null;
  for (const [ax, az, bx, bz] of edges) {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (layout.waterDepth(x, z) > -0.2) { wet = [x.toFixed(0), z.toFixed(0)]; break; }
    }
    if (wet) break;
  }
  ok(!wet, `「${d.name}」的院牆被溪水穿過（${wet?.[0]},${wet?.[1]}）`);
}

// 房子與院門不該泡在水裡
for (const d of [...RONG_DEFS, ...NING_DEFS, ...YUAN_DEFS]) {
  for (const bl of d.buildings ?? []) {
    ok(layout.waterDepth(bl.x, bl.z) <= -0.3, `「${d.name}」有一座房落在水裡（${bl.x},${bl.z}）`);
  }
  for (const g of d.gates ?? []) {
    const gx = g.x, gz = g.z;
    if (typeof gx !== 'number' || typeof gz !== 'number') continue;
    ok(layout.waterDepth(gx, gz) <= -0.3, `「${d.name}」的院門落在水裡（${gx},${gz}）`);
  }
}
for (const g of [layout.YUAN_GATE, layout.YUAN_EGATE, layout.YUAN_WGATE]) {
  for (const dz of [6, -6]) {
    const blocked = layout.colliders.some(
      (b) => g.x > b.x0 - 0.5 && g.x < b.x1 + 0.5 && g.z + dz > b.z0 - 0.5 && g.z + dz < b.z1 + 0.5);
    ok(!blocked, `園門（${g.x},${g.z}）${dz > 0 ? '南' : '北'}側被牆堵死`);
  }
}

// ---------------------------------------------------------------- 7. 全域可達性（洪水填充）
// 把世界柵格化，從出生點按與遊戲一致的規則（落水攔住、高差超過 STEP_UP 攔住、
// 碰撞盒按玩家半徑膨脹）漫延一遍，逐一核對每個講解點與可入室內是否走得到。
const STEP_UP = 0.62, R = 0.5, CELL = 1.5;
const GX0 = -200, GX1 = 200, GZ0 = -870, GZ1 = 40;
const NX = Math.ceil((GX1 - GX0) / CELL), NZ = Math.ceil((GZ1 - GZ0) / CELL);
const idx = (i, j) => j * NX + i;
const cellX = (i) => GX0 + (i + 0.5) * CELL;
const cellZ = (j) => GZ0 + (j + 0.5) * CELL;

const blocked = new Uint8Array(NX * NZ);
for (const b of layout.colliders) {
  const i0 = Math.max(0, Math.floor((b.x0 - R - GX0) / CELL));
  const i1 = Math.min(NX - 1, Math.ceil((b.x1 + R - GX0) / CELL));
  const j0 = Math.max(0, Math.floor((b.z0 - R - GZ0) / CELL));
  const j1 = Math.min(NZ - 1, Math.ceil((b.z1 + R - GZ0) / CELL));
  // 只有格心落在（按玩家半徑膨脹後的）盒內才算堵住——按索引整段塗黑會把門洞也抹掉
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
const seen = new Uint8Array(NX * NZ);
const start = idx(Math.round((layout.SPAWN.x - GX0) / CELL), Math.round((layout.SPAWN.z - GZ0) / CELL));
const queue = [start];
seen[start] = 1;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (let qi = 0; qi < queue.length; qi++) {
  const c = queue[qi];
  const ci = c % NX, cj = (c / NX) | 0;
  const ch = H[c];
  for (const [di, dj] of NB) {
    const ni = ci + di, nj = cj + dj;
    if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
    const n = idx(ni, nj);
    if (seen[n] || blocked[n] || Number.isNaN(H[n])) continue;
    if (Math.abs(H[n] - ch) > STEP_UP) continue;
    seen[n] = 1;
    queue.push(n);
  }
}
const reachable = (x, z, rad = 3) => {
  const i0 = Math.max(0, Math.floor((x - rad - GX0) / CELL));
  const i1 = Math.min(NX - 1, Math.ceil((x + rad - GX0) / CELL));
  const j0 = Math.max(0, Math.floor((z - rad - GZ0) / CELL));
  const j1 = Math.min(NZ - 1, Math.ceil((z + rad - GZ0) / CELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (seen[idx(i, j)]) return true;
  return false;
};
const reach = queue.length;
for (const p of POIS) ok(reachable(p.x, p.z, p.r * 0.7), `講解點「${p.id}」從出生點走不到`);
for (const it of INTERIORS) {
  if (it.upper) continue;
  ok(reachable(it.x, it.z, 4), `室內「${it.name}」從出生點走不進去`);
}
for (const f of FIGURES) warn(reachable(f.x, f.z, 3), `人物「${f.name}」所在處走不到`);
// 推薦路線逐段可走
if (layout.TOUR) {
  for (let i = 0; i < layout.TOUR.length - 1; i++) {
    const a = layout.TOUR[i], b = layout.TOUR[i + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(2, Math.ceil(L / CELL));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
      if (!reachable(px, pz, 1.6)) {
        fails.push(`推薦路線 ${i}→${i + 1}（${a.name ?? ''}→${b.name ?? ''}）在 (${px.toFixed(0)},${pz.toFixed(0)}) 走不通`);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- 8. NPC 不穿模
{
  const t0 = performance.now();
  buildNav();
  const navMs = performance.now() - t0;
  const crowd = new Crowd({ add() {} });
  const inside = (x, z) => layout.colliders.some(
    (b) => x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3);
  // 嵌在台明立面裡：人在低處，卻站進了高出一截的台基輪廓
  const inStep = (x, z) => {
    const h = layout.walkHeight(x, z) ?? 0;
    return layout.platforms.some((p) => !p.ramp && p.h > h + 0.3
      && x > p.x0 - 0.3 && x < p.x1 + 0.3 && z > p.z0 - 0.3 && z < p.z1 + 0.3);
  };
  let bad0 = 0, n = 0;
  for (const g of crowd.groups) for (const a of g.agents) { n++; if (!navOk(a.x, a.z) || inside(a.x, a.z) || inStep(a.x, a.z)) bad0++; }
  ok(bad0 === 0, `${bad0}/${n} 位環境 NPC 出生在牆體、台明立面或不可站處`);
  // 跑一段，看會不會走進牆裡
  const p = { x: -91.2, z: -60 };
  for (let f = 0; f < 900; f++) crowd.update(1 / 60, f / 60, p);
  let bad1 = 0;
  for (const g of crowd.groups) for (const a of g.agents) if (inside(a.x, a.z) || inStep(a.x, a.z)) bad1++;
  ok(bad1 === 0, `跑 15 秒後有 ${bad1}/${n} 位環境 NPC 嵌在牆體或台明立面裡`);
  extraLines.push(`環境 NPC ${n}　行走柵格 ${navMs.toFixed(0)}ms`);
}

// ---------------------------------------------------------------- 9. 幾何規模與健全性
let tris = 0, verts = 0, bad = 0;
for (const g of cullables) {
  for (const m of g.children ?? []) {
    const pos = m.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i]) || Math.abs(pos[i]) > 5000) bad++;
    tris += (m.geometry.index?.count ?? 0) / 3;
    verts += m.geometry.attributes.position.count;
  }
}
ok(bad === 0, `有 ${bad} 個異常坐標`);
warn(tris < 900000, `三角面 ${(tris / 1000) | 0}k 偏高`);

// ---------------------------------------------------------------- 10. 分區覆蓋
const probes = [
  [-91.2, 13, '宁荣街'], [-91.2, -152, '荣禧堂'], [-147, -104, '贾母院'],
  [91.2, -162, '宁府正堂'], [0, -180, '宁荣夹道'], [-119, -330, '潇湘馆'],
  [126, -346, '怡红院'], [28, -520, '蘅芜苑'], [-134, -498, '稻香村'], [0, -650, '省亲别墅'],
];
for (const [x, z, want] of probes) {
  const got = layout.regionAt(x, z);
  warn(got === want, `分區判定：(${x},${z}) 期望「${want}」實得「${got}」`);
}

// ---------------------------------------------------------------- 報告
const line = (s) => console.log(s);
line('════════ 紅樓夢 · 入府遊　自檢 ════════');
line(`院落／裁剪單元　${cullables.length}`);
line(`三角面　${(tris / 1000).toFixed(0)}k　頂點 ${(verts / 1000).toFixed(0)}k`);
line(`碰撞盒 ${layout.colliders.length}　台基 ${layout.platforms.length}　分區 ${layout.REGIONS.length}`);
line(`講解點 ${POIS.length}　主要人物 ${FIGURES.length}　可入室內 ${INTERIORS.length}`);
line(`講解詞 ${Object.keys(narr).length}　音頻 ${mp3.size}　匾額 ${PLAQUES.length}　楹聯 ${COUPLETS.length} 對`);
line(`可達格點 ${reach}（格 ${CELL}m）`);
for (const l of extraLines) line(l);
line('');
if (warns.length) { line(`⚠ 提示 ${warns.length}：`); for (const w of warns) line(`  · ${w}`); line(''); }
if (fails.length) { line(`✗ 失敗 ${fails.length}：`); for (const f of fails) line(`  · ${f}`); process.exitCode = 1; }
else line('✓ 全部必檢項通過');
