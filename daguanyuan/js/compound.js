// 院落生成器：聲明式數據 → 幾何。40+ 院落共用這一條管線。
import { GeoBuilder } from './geo.js';
import { P } from './palette.js';
import {
  hall, gateHouse, chuihuaMen, yuedongMen, yingbi, wallRun, corridor,
  pavilion, pailou, rockery, plaqueBoard, frame, railing, mulberry,
} from './parts.js';
import { tree, bambooGrove, bush, vines, lotus, paddy, tufts } from './flora.js';
import { addRegion, addCollider, addPlatform, groundHeight } from './layout.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- 小品
export function well(gb, x, z) {                     // 井 + 轆轤
  const gy = groundHeight(x, z);
  gb.cyl(0.95, 1.05, 0.9, P.qingzhuan, { ch: 'brick', x, y: gy + 0.45, z, seg: 12 });
  gb.cyl(0.72, 0.72, 0.3, 0x2a2c28, { ch: 'flat', x, y: gy + 0.92, z, seg: 12 });
  for (const sx of [-1, 1]) gb.box(0.16, 2.0, 0.16, P.woodLight, { ch: 'wood', x: x + sx * 1.0, y: gy + 1.0, z });
  gb.cyl(0.2, 0.2, 2.0, P.woodLight, { ch: 'wood', x, y: gy + 1.95, z, rz: Math.PI / 2, seg: 8 });
  addCollider(x - 1.2, z - 1.2, x + 1.2, z + 1.2);
}

export function stoneTable(gb, x, z, r = 0.85) {     // 石桌石墩
  const gy = groundHeight(x, z);
  gb.cyl(0.28, 0.34, 0.7, P.hanbaiyu, { ch: 'stone', x, y: gy + 0.35, z, seg: 8 });
  gb.cyl(r, r, 0.14, P.hanbaiyu, { ch: 'stone', x, y: gy + 0.75, z, seg: 12 });
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + 0.4;
    gb.cyl(0.28, 0.3, 0.46, P.hanbaiyu, { ch: 'stone', x: x + Math.cos(a) * (r + 0.75), y: gy + 0.23, z: z + Math.sin(a) * (r + 0.75), seg: 8 });
  }
}

export function vat(gb, x, z) {                      // 太平缸（門前防火）
  const gy = groundHeight(x, z);
  gb.cyl(0.72, 0.58, 0.95, 0x6a6258, { ch: 'flat', x, y: gy + 0.48, z, seg: 12 });
  gb.cyl(0.66, 0.66, 0.06, 0x4a6068, { ch: 'flat', x, y: gy + 0.93, z, seg: 12 });
}

export function lantern(gb, x, y, z, s = 1) {        // 燈籠
  gb.cyl(0.26 * s, 0.26 * s, 0.5 * s, P.hongsha, { ch: 'silk', x, y, z, seg: 8 });
  gb.box(0.05, 0.5 * s, 0.05, P.woodDark, { ch: 'wood', x, y: y + 0.5 * s, z });
  gb.box(0.1 * s, 0.28 * s, 0.1 * s, P.jinhuang, { ch: 'flat', x, y: y - 0.36 * s, z });
}

export function flagPole(gb, x, z, h = 9) {          // 旗桿（宗祠、大門前）
  const gy = groundHeight(x, z);
  gb.box(1.1, 1.0, 1.1, P.hanbaiyu, { ch: 'stone', x, y: gy + 0.5, z });
  gb.cyl(0.12, 0.16, h, P.zhu, { ch: 'wood', x, y: gy + 1 + h / 2, z, seg: 8 });
  gb.box(0.9, 0.14, 0.14, P.jin, { ch: 'flat', x, y: gy + h * 0.82, z });
  addCollider(x - 0.7, z - 0.7, x + 0.7, z + 0.7);
}

export function trough(gb, x, z, w = 5, d = 2.4) {   // 馬槽 / 馬廄
  const gy = groundHeight(x, z);
  gb.box(w, 0.8, d, P.woodDark, { ch: 'wood', x, y: gy + 0.4, z });
  gb.box(w - 0.4, 0.16, d - 0.4, 0xa89a70, { ch: 'thatch', x, y: gy + 0.86, z });
  for (let i = 0; i < 4; i++) gb.box(0.16, 2.4, 0.16, P.woodLight, { ch: 'wood', x: x - w / 2 + w * i / 3, y: gy + 1.2, z: z - d / 2 });
}

// ---------------------------------------------------------------- 鋪地
function paveRect(gb, x, z, w, d, ch = 'mandi', color = P.mandi) {
  gb.box(w, 0.1, d, color, { ch, x, y: groundHeight(x, z) + 0.05, z });
}

/** 甬路：由折線鋪出的御路／花街 */
export function path(gb, pts, w = 3.2, ch = 'mandi', color = P.mandi) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.2) continue;
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    gb.box(w, 0.1, len + w * 0.6, color, { ch, x: mx, y: groundHeight(mx, mz) + 0.05, z: mz, ry: ang });
  }
}

// ---------------------------------------------------------------- 院落
export function buildCompound(scene, def) {
  const gb = new GeoBuilder(def.id);
  const rnd = mulberry((def.id || 'x').length * 7717 + (def.seed ?? 1));

  // 鋪地（先鋪，免得壓住台基）
  if (def.pave) {
    for (const p of def.pave) paveRect(gb, p[0], p[1], p[2], p[3], p[4] ?? 'mandi', p[5] ?? P.mandi);
  }
  if (def.paths) for (const pp of def.paths) path(gb, pp.pts, pp.w ?? 3.0, pp.ch ?? 'mandi', pp.color ?? P.mandi);

  // 院牆與門
  if (def.wall !== false && def.x0 !== undefined) {
    const w = def.wall ?? {};
    const h = w.h ?? 3.6;
    const color = w.color ?? P.fenqiang;
    const ch = w.ch ?? 'plaster';
    const gates = def.gates ?? [];
    const sideGate = (side) => gates.find((g) => g.side === side && (g.type === 'plain' || g.type === 'chuihua' || g.type === 'gate' || g.type === 'yuedong'));
    const seg = (side, x0, z0, x1, z1) => {
      const g = sideGate(side);
      if (!g) { wallRun(gb, { x0, z0, x1, z1, h, color, ch }); return; }
      const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const t = horiz ? (g.at - x0) / (x1 - x0) : (g.at - z0) / (z1 - z0);
      wallRun(gb, { x0, z0, x1, z1, h, color, ch, gapAt: t, gapW: (g.w ?? 4.6) + 1.4 });
    };
    seg('S', def.x0, def.z1, def.x1, def.z1);
    seg('N', def.x0, def.z0, def.x1, def.z0);
    seg('W', def.x0, def.z0, def.x0, def.z1);
    seg('E', def.x1, def.z0, def.x1, def.z1);
  }

  for (const g of def.gates ?? []) {
    const rot = g.side === 'S' ? 0 : g.side === 'N' ? Math.PI : g.side === 'E' ? -Math.PI / 2 : Math.PI / 2;
    const gx = g.x ?? (g.side === 'S' || g.side === 'N' ? g.at : (g.side === 'W' ? def.x0 : def.x1));
    const gz = g.z ?? (g.side === 'S' ? def.z1 : g.side === 'N' ? def.z0 : g.at);
    if (g.type === 'chuihua') chuihuaMen(gb, { x: gx, z: gz, rot, w: g.w ?? 4.6, name: g.name });
    else if (g.type === 'yuedong') yuedongMen(gb, { x: gx, z: gz, rot, r: g.r ?? 1.5, wallH: (def.wall?.h ?? 3.6) });
    else if (g.type === 'gate') {
      gateHouse(gb, {
        x: gx, z: gz, rot, bays: g.bays ?? 3, bayW: g.bayW ?? 4.6, depth: g.depth ?? 6.5,
        rank: g.rank ?? 2, name: g.name, lions: g.lions ?? false,
      });
    } else if (g.type === 'plain') {
      // 隨牆門：磚券小門
      const F = frame(gx, gz, rot);
      const gw = g.w ?? 3.0, gh = 3.2;
      for (const sx of [-1, 1]) {
        gb.box(0.7, gh + 0.6, 0.7, P.qingzhuan, { ch: 'brick', x: gx + Math.cos(rot) * sx * (gw / 2 + 0.35), y: gh / 2, z: gz - Math.sin(rot) * sx * (gw / 2 + 0.35), ry: rot });
      }
      gb.box(gw + 1.6, 0.7, 0.9, P.qingzhuan, { ch: 'brick', x: gx, y: gh + 0.35, z: gz, ry: rot });
      gb.box(gw + 2.4, 0.24, 1.3, P.tongwa, { ch: 'tile', x: gx, y: gh + 0.85, z: gz, ry: rot });
      gb.box(gw + 2.0, 0.28, 0.5, P.ji, { ch: 'ridge', x: gx, y: gh + 1.1, z: gz, ry: rot });
      if (g.name) plaqueBoard(gb, F, g.name, 0, gh + 0.3, 0.5, Math.min(2.2, gw * 0.8), 0.7);
    }
  }

  // 影壁
  for (const y of def.yingbi ?? []) yingbi(gb, { x: y[0], z: y[1], rot: y[2] ?? 0, w: y[3] ?? 6.5, h: y[4] ?? 4.2 });

  // 建築
  for (const b of def.buildings ?? []) {
    hall(gb, {
      x: b.x, z: b.z, rot: b.rot ?? 0,
      bays: b.bays ?? 3, bayW: b.bayW ?? 4.2, depth: b.depth ?? 7.5,
      rank: b.rank ?? 3, roofType: b.roof ?? null,
      name: b.name ?? null, couplet: b.couplet ?? null,
      front: b.front ?? 'mixed', storey: b.storey ?? 1,
      porch: b.porch ?? false, veranda: b.veranda ?? false,
      thatch: b.thatch ?? false, enterable: b.enterable ?? false,
      wallColor: b.wallColor ?? null, wallCh: b.wallCh ?? null,
      tileColor: b.tileColor ?? null, latCh: b.latCh ?? null,
      baseH: b.baseH ?? null, colH: b.colH ?? null,
    });
  }

  // 遊廊
  for (const c of def.corridors ?? []) corridor(gb, c.pts ?? c, { w: c.w ?? 2.4, h: c.h ?? 3.1, bench: c.bench ?? true });

  // 亭
  for (const t of def.pavilions ?? []) pavilion(gb, t);

  // 牌坊
  for (const p of def.pailou ?? []) pailou(gb, p);

  // 山石
  for (const r of def.rocks ?? []) rockery(gb, r[0], r[1], r[2] ?? 1, r[3] ?? 1);

  // 花木
  for (const t of def.trees ?? []) tree(gb, t[0], t[1], t[2], t[3] ?? 1, t[4] ?? ((t[1] * 7 + t[2] * 13) | 0));
  for (const b of def.bamboo ?? []) bambooGrove(gb, b[0], b[1], b[2], b[3], b[4] ?? 3);
  for (const b of def.bushes ?? []) bush(gb, b[0], b[1], b[2] ?? 1.1, b[3] ?? 0xd8e4c8, b[4] ?? 5);
  for (const t of def.tufts ?? []) tufts(gb, t[0], t[1], t[2] ?? 6, t[3] ?? 14, t[4] ?? 7);
  for (const v of def.vines ?? []) vines(gb, v[0], v[1], v[2], v[3] ?? 14, v[4] ?? 9);
  for (const l of def.lotus ?? []) lotus(gb, l[0], l[1], l[2], l[3] ?? 26, l[4] ?? 11);
  for (const p of def.paddy ?? []) paddy(gb, p[0], p[1], p[2], p[3], p[4] ?? 13);

  // 小品
  for (const w of def.wells ?? []) well(gb, w[0], w[1]);
  for (const t of def.tables ?? []) stoneTable(gb, t[0], t[1], t[2] ?? 0.85);
  for (const v of def.vats ?? []) vat(gb, v[0], v[1]);
  for (const f of def.flags ?? []) flagPole(gb, f[0], f[1], f[2] ?? 9);
  for (const t of def.troughs ?? []) trough(gb, t[0], t[1], t[2] ?? 5, t[3] ?? 2.4);

  // 自定義補充
  def.extra?.(gb, rnd);

  const group = gb.emit(scene, { cull: def.cull !== false });
  if (def.x0 !== undefined && def.region !== false) {
    addRegion(def.name, def.x0, def.z0, def.x1, def.z1);
  }
  return group;
}

export function buildAll(scene, defs) {
  for (const d of defs) buildCompound(scene, d);
}

/** 逐院興造，每兩院讓出主線程一次，載入時進度條才走得動 */
export async function buildAllAsync(scene, defs, onProgress, sync = false) {
  for (let i = 0; i < defs.length; i++) {
    onProgress?.(i, defs.length, defs[i].id);
    buildCompound(scene, defs[i]);
    if (!sync && (i % 2 === 1 || i === defs.length - 1)) await new Promise((r) => setTimeout(r, 0));
  }
}
