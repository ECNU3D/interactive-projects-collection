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


const DEFS = [...RONG_DEFS, ...NING_DEFS, ...YUAN_DEFS].filter(d => d.wall !== false && d.x0 !== undefined);
console.log('—— 桥压进有墙的院子 ——');
for (const b of layout.BRIDGES) {
  const hw = b.w / 2;
  for (let t = -0.1; t <= 1.1; t += 0.05) {
    const x = b.a[0] + (b.b[0]-b.a[0])*t, z = b.a[1] + (b.b[1]-b.a[1])*t;
    const hit = DEFS.find(d => x > d.x0-hw && x < d.x1+hw && z > d.z0-hw && z < d.z1+hw);
    if (hit) { console.log('  ' + b.name.padEnd(12) + ' → ' + hit.name); break; }
  }
}
console.log('—— 房子泡在水里 ——');
for (const d of [...RONG_DEFS, ...NING_DEFS, ...YUAN_DEFS]) {
  for (const bl of d.buildings ?? []) {
    if (layout.waterDepth(bl.x, bl.z) > -0.3) console.log('  ' + d.name + ' 的一座房 (' + bl.x + ',' + bl.z + ')');
  }
  for (const g of d.gates ?? []) {
    const gx = g.x ?? g.at, gz = g.z ?? g.at;
    if (typeof gx === 'number' && typeof gz === 'number' && layout.waterDepth(gx, gz) > -0.3) console.log('  ' + d.name + ' 的门 (' + gx + ',' + gz + ')');
  }
}
