// 無瀏覽器基準：用最小 DOM/Canvas 樁跑一遍興造，量出各院落的幾何生成耗時。
// 用法：node tools/bench.mjs
const W = 256;

function fakeCtx() {
  const noop = () => {};
  const ctx = {
    canvas: null,
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
  return ctx;
}

const doc = {
  createElement(tag) {
    if (tag === 'canvas') {
      const c = { width: W, height: W, style: {}, getContext: () => fakeCtx(), addEventListener() {} };
      return c;
    }
    return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, textContent: '' };
  },
  getElementById: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, textContent: '', getContext: () => fakeCtx(), width: 100, height: 100 }),
  addEventListener() {}, removeEventListener() {},
  querySelector: () => null,
  body: { appendChild() {} },
};

globalThis.document = doc;
globalThis.window = {
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
  addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }),
  location: { search: '' },
};
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true }); } catch { /* Node 已內建 navigator */ }
globalThis.self = globalThis.window;
globalThis.HTMLCanvasElement = class {};
globalThis.location = { search: '' };
globalThis.URLSearchParams = URLSearchParams;
globalThis.performance = globalThis.performance ?? { now: () => Number(process.hrtime.bigint() / 1000000n) };

const scene = { add() {}, children: [] };

const { GeoBuilder, cullables } = await import('../js/geo.js');
const { buildCompound } = await import('../js/compound.js');
const { RONG_DEFS } = await import('../js/data/rong.js');
const { NING_DEFS } = await import('../js/data/ning.js');
const { YUAN_DEFS } = await import('../js/data/yuan.js');
const world = await import('../js/world.js');
const { colliders, platforms, REGIONS } = await import('../js/layout.js');

function timed(label, fn) {
  const t = performance.now();
  fn();
  const ms = performance.now() - t;
  return { label, ms };
}

const rows = [];
rows.push(timed('ground', () => world.buildGround(scene)));
rows.push(timed('water', () => world.buildWater(scene)));
rows.push(timed('bridges', () => world.buildBridges(scene)));
rows.push(timed('street', () => world.buildStreet(scene)));
rows.push(timed('alleys', () => world.buildAlleys(scene)));

const per = [];
for (const defs of [RONG_DEFS, NING_DEFS, YUAN_DEFS]) {
  for (const d of defs) {
    const t = performance.now();
    buildCompound(scene, d);
    per.push([d.id, performance.now() - t]);
  }
}

let tris = 0, verts = 0;
for (const g of cullables) {
  for (const m of g.children ?? []) {
    tris += (m.geometry.index?.count ?? 0) / 3;
    verts += m.geometry.attributes.position.count;
  }
}

console.log('--- 場景基礎 ---');
for (const r of rows) console.log(`${r.label.padEnd(10)} ${r.ms.toFixed(1)}ms`);
console.log('\n--- 院落（耗時前 12）---');
per.sort((a, b) => b[1] - a[1]);
for (const [id, ms] of per.slice(0, 12)) console.log(`${id.padEnd(22)} ${ms.toFixed(1)}ms`);
const total = rows.reduce((s, r) => s + r.ms, 0) + per.reduce((s, p) => s + p[1], 0);
console.log(`\n院落數 ${per.length}　合計 ${total.toFixed(0)}ms`);
console.log(`裁剪單元 ${cullables.length}　三角面 ${(tris / 1000).toFixed(0)}k　頂點 ${(verts / 1000).toFixed(0)}k`);
console.log(`碰撞盒 ${colliders.length}　台基 ${platforms.length}　分區 ${REGIONS.length}`);
