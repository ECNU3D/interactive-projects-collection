// 花木：松、柳、竹、芭蕉、海棠、杏、梨、梅、桃、槐、桑榆槿柘、桂、荷、稻、藤萝、草丛
// 树冠不再拿球体堆——改用带 alpha 的枝叶贴图交叉成片（松针扇、垂柳条、花枝、竹叶、芭蕉叶），
// 同样的面数下形态细得多，也才配得上「大观园的景色」。
import * as THREE from 'three';
import { P } from './palette.js';
import { groundHeight } from './layout.js';
import { mulberry } from './parts.js';

const TAU = Math.PI * 2;
const PLANE = new THREE.PlaneGeometry(1, 1);

// ---------------------------------------------------------------- 基本件
/** 主干：下粗上细，可略带倾斜 */
function trunk(gb, x, y, z, h, rBot, rTop, color, lean = 0, dir = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, 1, 6);
  gb.bake(g, color, {
    ch: 'wood', x: x + Math.sin(lean) * h * 0.5 * Math.cos(dir), y: y + h / 2,
    z: z + Math.sin(lean) * h * 0.5 * Math.sin(dir), sy: h, rz: lean, ry: -dir, order: 'YXZ',
  });
}

/** 从 (x,y,z) 按方位 az、与竖直夹角 tilt 伸出一根枝，返回梢头坐标 */
function branch(gb, x, y, z, az, tilt, len, r, color) {
  const dx = Math.sin(tilt) * Math.cos(az), dy = Math.cos(tilt), dz = Math.sin(tilt) * Math.sin(az);
  const g = new THREE.CylinderGeometry(r * 0.5, r, 1, 5);
  gb.bake(g, color, {
    ch: 'wood', x: x + dx * len / 2, y: y + dy * len / 2, z: z + dz * len / 2,
    sy: len, rz: tilt, ry: -az, order: 'YXZ',
  });
  return [x + dx * len, y + dy * len, z + dz * len];
}

/** n 片交叉竖片 */
function cross(gb, ch, x, y, z, w, h, n, color, wind, rot0 = 0) {
  for (let k = 0; k < n; k++) {
    gb.bake(PLANE, color, {
      ch, uvMode: 'geo', x, y, z, sx: w, sy: h, ry: rot0 + k * Math.PI / n, wind,
    });
  }
}

/** 一片平铺（松针层） */
function flat(gb, ch, x, y, z, w, color, wind, rot = 0) {
  gb.bake(PLANE, color, {
    ch, uvMode: 'geo', x, y, z, sx: w, sy: w, rx: -Math.PI / 2, ry: rot, order: 'YXZ', wind,
  });
}

const BLOSSOM_TINT = {
  hai: 0xf2c6ce, mei: 0xeda9b6, tao: 0xf4c8cf, xing: 0xf8dee2, li: 0xfdfbf6,
};

// ---------------------------------------------------------------- 一株树
export function tree(gb, kind, x, z, s = 1, seed = 1) {
  const rnd = mulberry(seed * 977 + 13);
  const gy = groundHeight(x, z);
  const lean = (rnd() - 0.5) * 0.10;
  const dir = rnd() * TAU;

  switch (kind) {
    case 'song': {                       // 松：层叠平展的针叶
      const h = (8.5 + rnd() * 4) * s;
      trunk(gb, x, gy, z, h * 0.96, 0.30 * s, 0.13 * s, 0x584631, lean, dir);
      const tx = x + Math.sin(lean) * h * 0.5 * Math.cos(dir);
      const tz = z + Math.sin(lean) * h * 0.5 * Math.sin(dir);
      const layers = 4 + (rnd() < 0.5 ? 1 : 0);
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1);
        const ly = gy + h * (0.44 + t * 0.54);
        const r = (3.6 - t * 2.0) * s * (0.86 + rnd() * 0.28);
        const az = rnd() * TAU;
        branch(gb, tx, ly, tz, az, 1.32, r * 0.62, 0.09 * s, 0x584631);
        flat(gb, 'pine', tx + (rnd() - 0.5) * 0.5 * s, ly, tz + (rnd() - 0.5) * 0.5 * s,
          r * 2, 0xdfe6da, 0.16, rnd() * TAU);
      }
      break;
    }

    case 'liu': {                        // 柳：枝干上扬，柳条自梢头垂下
      const h = (8 + rnd() * 3.5) * s;
      trunk(gb, x, gy, z, h * 0.6, 0.34 * s, 0.20 * s, 0x6a5638, lean * 1.6, dir);
      const bx = x + Math.sin(lean * 1.6) * h * 0.3 * Math.cos(dir);
      const bz = z + Math.sin(lean * 1.6) * h * 0.3 * Math.sin(dir);
      const by = gy + h * 0.6;
      const nb = 4 + ((rnd() * 2) | 0);
      for (let i = 0; i < nb; i++) {
        const az = i * TAU / nb + rnd() * 0.5;
        const bl = (2.6 + rnd() * 1.6) * s;
        const tip = branch(gb, bx, by, bz, az, 0.62 + rnd() * 0.24, bl, 0.13 * s, 0x6a5638);
        // 柳条：一幅垂帘挂在梢头
        const cw = (3.4 + rnd() * 1.4) * s, ch2 = (4.6 + rnd() * 2.0) * s;
        for (let k = 0; k < 2; k++) {
          gb.bake(PLANE, 0xe9f0d6, {
            ch: 'willow', uvMode: 'geo',
            x: tip[0], y: tip[1] - ch2 / 2 + 0.3 * s, z: tip[2],
            sx: cw, sy: ch2, ry: az + k * Math.PI / 2 + 0.3, wind: 0.62,
          });
        }
      }
      cross(gb, 'leaf', bx, by + 1.0 * s, bz, 4.2 * s, 2.6 * s, 2, 0xdcead0, 0.3, rnd() * 3);
      break;
    }

    case 'zhu': {                        // 单竿竹
      const h = (6.6 + rnd() * 3.2) * s;
      gb.cyl(0.075 * s, 0.095 * s, h, P.bamboo, {
        ch: 'bamboo', x, y: gy + h / 2, z, rz: (rnd() - 0.5) * 0.12, seg: 6, wind: 0.26,
      });
      for (let i = 0; i < 3; i++) {
        const ly = gy + h * (0.56 + i * 0.17);
        cross(gb, 'bambooleaf', x, ly, z, (2.1 + rnd() * 0.9) * s, (1.9 + rnd() * 0.8) * s,
          2, 0xe4eed6, 0.55, rnd() * 3);
      }
      break;
    }

    case 'jiao': {                       // 芭蕉：数片大叶自根部张开
      const h = 1.35 * s;
      trunk(gb, x, gy, z, h, 0.30 * s, 0.22 * s, 0x6f8046);
      const n = 6 + ((rnd() * 2) | 0);
      for (let i = 0; i < n; i++) {
        const az = i * TAU / n + rnd() * 0.3;
        const L = (2.9 + rnd() * 1.1) * s;
        gb.bake(PLANE, 0xdfeacd, {
          ch: 'banana', uvMode: 'geo',
          x: x + Math.cos(az) * L * 0.34, y: gy + h + L * 0.36, z: z + Math.sin(az) * L * 0.34,
          sx: L * 0.62, sy: L, ry: -az + Math.PI / 2, rx: -0.62 - rnd() * 0.2, order: 'YXZ', wind: 0.5,
        });
      }
      break;
    }

    case 'hai': case 'mei': case 'tao': case 'xing': case 'li': {
      const tint = BLOSSOM_TINT[kind] ?? 0xf2c6ce;
      const h = (4.4 + rnd() * 2.2) * s;
      trunk(gb, x, gy, z, h * 0.62, 0.24 * s, 0.15 * s, 0x5b4632, lean * 2.2, dir);
      const bx = x + Math.sin(lean * 2.2) * h * 0.31 * Math.cos(dir);
      const bz = z + Math.sin(lean * 2.2) * h * 0.31 * Math.sin(dir);
      const by = gy + h * 0.62;
      const nb = 3 + ((rnd() * 2) | 0);
      const tips = [];
      for (let i = 0; i < nb; i++) {
        const az = i * TAU / nb + rnd() * 0.6;
        tips.push(branch(gb, bx, by, bz, az, 0.55 + rnd() * 0.35, (1.5 + rnd() * 0.9) * s, 0.10 * s, 0x5b4632));
      }
      for (const t of tips) {
        cross(gb, 'blossom', t[0], t[1] + 0.5 * s, t[2],
          (2.6 + rnd() * 1.0) * s, (2.3 + rnd() * 0.9) * s, 2, tint, 0.34, rnd() * 3);
      }
      cross(gb, 'blossom', bx, by + 1.5 * s, bz, 3.0 * s, 2.6 * s, 2, tint, 0.3, rnd() * 3);
      break;
    }

    case 'gui': {                        // 桂：矮而密，色深
      const h = (3.8 + rnd() * 1.6) * s;
      trunk(gb, x, gy, z, h * 0.5, 0.22 * s, 0.15 * s, 0x5b4632, lean, dir);
      cross(gb, 'leaf', x, gy + h * 0.92, z, (3.6 + rnd() * 0.8) * s, (3.2 + rnd() * 0.7) * s,
        3, 0xbcd0b2, 0.2, rnd() * 3);
      break;
    }

    default: {                           // 槐、榆、桑、柘、槿：阔叶乔木
      const tint = kind === 'sang' ? 0xd8e2b8 : kind === 'jin' ? 0xd6e6c6 : 0xdae6cc;
      const h = (6.5 + rnd() * 3.5) * s;
      trunk(gb, x, gy, z, h * 0.58, 0.32 * s, 0.18 * s, 0x5b4632, lean, dir);
      const bx = x + Math.sin(lean) * h * 0.29 * Math.cos(dir);
      const bz = z + Math.sin(lean) * h * 0.29 * Math.sin(dir);
      const by = gy + h * 0.58;
      const nb = 3 + ((rnd() * 2) | 0);
      const tips = [];
      for (let i = 0; i < nb; i++) {
        const az = i * TAU / nb + rnd() * 0.6;
        tips.push(branch(gb, bx, by, bz, az, 0.5 + rnd() * 0.35, (1.8 + rnd() * 1.1) * s, 0.13 * s, 0x5b4632));
      }
      for (const t of tips) {
        cross(gb, 'leaf', t[0], t[1] + 0.7 * s, t[2],
          (3.4 + rnd() * 1.2) * s, (2.8 + rnd() * 1.0) * s, 2, tint, 0.26, rnd() * 3);
      }
      cross(gb, 'leaf', bx, by + 2.0 * s, bz, (4.0 + rnd()) * s, (3.2 + rnd()) * s, 2, tint, 0.24, rnd() * 3);
      break;
    }
  }
}

/** 竹林（潇湘馆「千百竿翠竹遮映」） */
export function bambooGrove(gb, x, z, r, n, seed = 3) {
  const rnd = mulberry(seed * 131 + 7);
  n = Math.min(n, 72);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * r;
    tree(gb, 'zhu', x + Math.cos(a) * rr, z + Math.sin(a) * rr, 0.85 + rnd() * 0.45, seed * 1000 + i);
  }
}

/** 花木丛（芍药、蔷薇、月季） */
export function bush(gb, x, z, r = 1.1, color = 0xd8e4c8, seed = 5) {
  const rnd = mulberry(seed * 313 + 11);
  const gy = groundHeight(x, z);
  const flowering = ((color >> 16) & 255) > 150;
  cross(gb, flowering ? 'blossom' : 'leaf', x, gy + r * 0.95, z,
    r * 2.6, r * 1.9, 2, color, 0.3, rnd() * 3);
  cross(gb, 'leaf', x + (rnd() - 0.5) * r, gy + r * 0.6, z + (rnd() - 0.5) * r,
    r * 1.9, r * 1.4, 2, 0xcfe0c0, 0.3, rnd() * 3);
}

/** 草丛野花：铺在园径两侧与院角 */
export function tufts(gb, x, z, r, n = 14, seed = 7) {
  const rnd = mulberry(seed * 617 + 5);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * r;
    const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    const w = 1.0 + rnd() * 0.9, h = 0.55 + rnd() * 0.45;
    gb.bake(PLANE, 0xdfe8c8, {
      ch: 'tuft', uvMode: 'geo', x: px, y: groundHeight(px, pz) + h / 2, z: pz,
      sx: w, sy: h, ry: rnd() * TAU, wind: 0.4,
    });
  }
}

/** 藤萝薜荔（蘅芜苑「异草仙藤，累垂可爱」） */
export function vines(gb, x, z, r, n = 14, seed = 9) {
  const rnd = mulberry(seed * 71 + 3);
  const gy = groundHeight(x, z);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, rr = rnd() * r;
    const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    const h = 1.6 + rnd() * 3.4;
    gb.cyl(0.05, 0.06, h, 0x6f8a4a, { ch: 'wood', x: px, y: gy + 1.0 + h / 2, z: pz, seg: 5, wind: 0.4 });
    cross(gb, 'leaf', px, gy + 1.0 + h, pz, 1.5 + rnd() * 0.8, 1.2 + rnd() * 0.6,
      2, i % 4 === 0 ? 0xd0bcdc : 0xd6e4c4, 0.46, rnd() * 3);
  }
}

/** 荷（藕香榭前池） */
export function lotus(gb, x, z, r, n = 26, seed = 11) {
  const rnd = mulberry(seed * 53 + 17);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, rr = Math.sqrt(rnd()) * r;
    const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    gb.sphere(0.78 + rnd() * 0.5, 0x4e7b46, { ch: 'flat', x: px, y: -0.42, z: pz, sy: 0.055 });
    if (rnd() < 0.30) {                               // 立叶
      const hh = 0.7 + rnd() * 0.6;
      gb.cyl(0.035, 0.04, hh, 0x5c7f42, { ch: 'flat', x: px, y: -0.42 + hh / 2, z: pz, seg: 5, wind: 0.3 });
      gb.sphere(0.55, 0x54834a, { ch: 'flat', x: px, y: -0.42 + hh, z: pz, sy: 0.09, wind: 0.32 });
    }
    if (rnd() < 0.22) {                               // 花
      gb.cyl(0.03, 0.035, 0.85, 0x5c7f42, { ch: 'flat', x: px + 0.3, y: 0.0, z: pz + 0.2, seg: 5 });
      gb.sphere(0.26, 0xe4bcc6, { ch: 'flat', x: px + 0.3, y: 0.44, z: pz + 0.2, sy: 0.62 });
    }
  }
}

/** 稻畦（稻香村「分畦列亩，佳蔬菜花」） */
export function paddy(gb, x0, z0, x1, z1, seed = 13) {
  const rnd = mulberry(seed * 17 + 5);
  const rows = Math.max(2, Math.round(Math.abs(z1 - z0) / 3.2));
  for (let r = 0; r < rows; r++) {
    const zz = z0 + (z1 - z0) * (r + 0.5) / rows;
    gb.box(Math.abs(x1 - x0), 0.16, 2.1, P.daogen, {
      ch: 'grass', x: (x0 + x1) / 2, y: groundHeight((x0 + x1) / 2, zz) + 0.08, z: zz,
    });
    const n = Math.round(Math.abs(x1 - x0) / 1.4);
    for (let i = 0; i < n; i++) {
      const px = x0 + (x1 - x0) * (i + 0.5) / n;
      const pz = zz + (rnd() - 0.5) * 0.7;
      gb.bake(PLANE, 0xdde2b0, {
        ch: 'tuft', uvMode: 'geo', x: px, y: groundHeight(px, pz) + 0.42, z: pz,
        sx: 1.1, sy: 0.85, ry: rnd() * TAU, wind: 0.3,
      });
    }
  }
  // 青篱（「编就两溜青篱」）
  const n2 = Math.round(Math.abs(x1 - x0) / 0.7);
  for (const zz of [z0, z1]) {
    for (let i = 0; i <= n2; i++) {
      const px = x0 + (x1 - x0) * i / n2;
      gb.box(0.07, 1.0, 0.07, 0x9a8a5c, { ch: 'wood', x: px, y: groundHeight(px, zz) + 0.5, z: zz });
    }
    gb.box(Math.abs(x1 - x0), 0.07, 0.07, 0x9a8a5c, {
      ch: 'wood', x: (x0 + x1) / 2, y: groundHeight((x0 + x1) / 2, zz) + 0.86, z: zz,
    });
  }
}

/** 草坡 */
export function lawn(gb, x, z, w, d) {
  gb.box(w, 0.08, d, P.cao, { ch: 'grass', x, y: groundHeight(x, z) + 0.04, z });
}
