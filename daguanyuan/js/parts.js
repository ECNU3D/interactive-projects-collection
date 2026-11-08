// 構件庫 —— 台基、柱、額枋、斗栱、屋頂、槅扇、院牆、垂花門、遊廊、月洞門、影壁、
// 牌坊、亭、橋、欄杆、匾額楹聯、假山。中式木構的可參數化零件。
import * as THREE from 'three';
import { P } from './palette.js';
import { plaqueUV, coupletUV } from './plaques.js';
import { PRIM } from './geo.js';
import { addCollider, addWallWithGap, addPlatform, addRamp, groundHeight } from './layout.js';

const TAU = Math.PI * 2;

// 診斷開關：?nosoffit=1 可關掉檐下望板與椽頭
export const SOFFIT = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('nosoffit')) };

// 局部坐標 → 世界坐標（rot=0 時正面朝 +Z 即朝南）
export function frame(cx, cz, rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return {
    rot, cos: c, sin: s,
    p(lx, lz) { return [cx + lx * c + lz * s, cz - lx * s + lz * c]; },
  };
}

// 依等級取彩畫通道
export function caihuaCh(rank) {
  return rank <= 1 ? 'hexi' : rank === 2 ? 'xuanzi' : rank === 3 ? 'sushi' : null;
}
// 依等級取瓦
export function tileCh(rank, thatch) {
  if (thatch) return 'thatch';
  return rank <= 1 ? 'liuli' : 'tile';
}

// ---------------------------------------------------------------- 屋頂
/**
 * 參數化屋頂：舉折（近檐平緩、近脊陡峻）+ 翼角起翹。
 * type: wudian(廡殿) | xieshan(歇山) | yingshan(硬山) | xuanshan(懸山)
 *       juanpeng(卷棚) | zanjian(攢尖，用 sides 定邊數)
 */
export function roof(gb, o) {
  const {
    x = 0, z = 0, y = 0, rot = 0, w = 12, d = 9, h = 3.6,
    type = 'yingshan', ch = 'tile', color = P.tongwa,
    eave = 1.35, lift = null, rank = 3,
    jian = false,                    // 剪邊（檐口一圈異色琉璃）
    gable = true,                    // 硬山／懸山的山花
    gableColor = P.fenqiang, gableCh = 'plaster',
    overhang = 0,                    // 懸山出際
    zanSides = 4,
  } = o;

  const A = w / 2 + eave, B = d / 2 + eave;
  const F = frame(x, z, rot);
  const hipTypes = type === 'wudian' || type === 'xieshan' || type === 'zanjian';
  const LIFT = lift ?? (hipTypes ? 1.05 : type === 'juanpeng' ? 0.35 : 0.2);
  const SB = 0.44;                   // 歇山收山

  const rise = (s) => h * Math.pow(s, 1.55);
  function prof(s) {
    switch (type) {
      case 'wudian': return [Math.max(0.001, A - s * B), B * (1 - s)];
      case 'xieshan': {
        const sc = Math.min(s, SB);
        return [Math.max(0.5, A - sc * B), B * (1 - s)];
      }
      case 'zanjian': return [A * (1 - s), B * (1 - s)];
      case 'yingshan': return [w / 2, B * (1 - s)];          // 硬山：兩山與牆齊，不出際
      default: return [A, B * (1 - s)];                       // xuanshan / juanpeng 出際
    }
  }
  // 翼角：靠近角部的檐口上翹
  function cf(u) { const t = Math.abs(u * 2 - 1); return t < 0.52 ? 0 : ((t - 0.52) / 0.48) ** 2; }
  function lf(u, s) { return LIFT * cf(u) * Math.pow(1 - s, 2.2); }

  const N = 6;
  const MU = Math.max(3, Math.min(9, Math.round(w / 3.2) + 2));
  const MV = Math.max(3, Math.min(7, Math.round(d / 3.2) + 2));
  const slope = Math.hypot(B, h);
  const uRepW = (2 * A) / 2.7, uRepD = (2 * B) / 2.7, vRep = slope / 2.2;

  const chOf = (s) => (jian && s < 0.16 ? 'liuli' : ch);
  const colOf = (s) => (jian && s < 0.16 ? P.liuli : color);

  const put = (lx, ly, lz) => { const [wx, wz] = F.p(lx, lz); return [wx, ly, wz]; };

  // ---- 前後坡（沿 X 展開）----
  for (let i = 0; i < N; i++) {
    const s0 = i / N, s1 = (i + 1) / N;
    const [ax0, bz0] = prof(s0), [ax1, bz1] = prof(s1);
    const y0 = y + rise(s0), y1 = y + rise(s1);
    for (let j = 0; j < MU; j++) {
      const u0 = j / MU, u1 = (j + 1) / MU;
      const opt = { ch: chOf(s0), uvMode: 'geo' };
      // 前坡 (+Z)
      gb.quad(
        put(-ax0 + 2 * ax0 * u0, y0 + lf(u0, s0), bz0),
        put(-ax0 + 2 * ax0 * u1, y0 + lf(u1, s0), bz0),
        put(-ax1 + 2 * ax1 * u1, y1 + lf(u1, s1), bz1),
        put(-ax1 + 2 * ax1 * u0, y1 + lf(u0, s1), bz1),
        colOf(s0),
        { ...opt, uv: [[u0 * uRepW, s0 * vRep], [u1 * uRepW, s0 * vRep], [u1 * uRepW, s1 * vRep], [u0 * uRepW, s1 * vRep]] }
      );
      // 後坡 (−Z)
      gb.quad(
        put(-ax0 + 2 * ax0 * u1, y0 + lf(u1, s0), -bz0),
        put(-ax0 + 2 * ax0 * u0, y0 + lf(u0, s0), -bz0),
        put(-ax1 + 2 * ax1 * u0, y1 + lf(u0, s1), -bz1),
        put(-ax1 + 2 * ax1 * u1, y1 + lf(u1, s1), -bz1),
        colOf(s0),
        { ...opt, uv: [[u1 * uRepW, s0 * vRep], [u0 * uRepW, s0 * vRep], [u0 * uRepW, s1 * vRep], [u1 * uRepW, s1 * vRep]] }
      );
    }
  }

  // ---- 左右坡（僅廡殿／歇山／攢尖）----
  if (hipTypes) {
    const iMax = type === 'xieshan' ? Math.ceil(SB * N) : N;
    for (let i = 0; i < iMax; i++) {
      const s0 = i / N, s1 = (i + 1) / N;
      const [ax0, bz0] = prof(s0), [ax1, bz1] = prof(s1);
      const y0 = y + rise(s0), y1 = y + rise(s1);
      for (let j = 0; j < MV; j++) {
        const v0 = j / MV, v1 = (j + 1) / MV;
        const opt = { ch: chOf(s0), uvMode: 'geo' };
        // 左坡 (−X)
        gb.quad(
          put(-ax0, y0 + lf(v0, s0), -bz0 + 2 * bz0 * v0),
          put(-ax0, y0 + lf(v1, s0), -bz0 + 2 * bz0 * v1),
          put(-ax1, y1 + lf(v1, s1), -bz1 + 2 * bz1 * v1),
          put(-ax1, y1 + lf(v0, s1), -bz1 + 2 * bz1 * v0),
          colOf(s0),
          { ...opt, uv: [[v0 * uRepD, s0 * vRep], [v1 * uRepD, s0 * vRep], [v1 * uRepD, s1 * vRep], [v0 * uRepD, s1 * vRep]] }
        );
        // 右坡 (+X)
        gb.quad(
          put(ax0, y0 + lf(v1, s0), -bz0 + 2 * bz0 * v1),
          put(ax0, y0 + lf(v0, s0), -bz0 + 2 * bz0 * v0),
          put(ax1, y1 + lf(v0, s1), -bz1 + 2 * bz1 * v0),
          put(ax1, y1 + lf(v1, s1), -bz1 + 2 * bz1 * v1),
          colOf(s0),
          { ...opt, uv: [[v1 * uRepD, s0 * vRep], [v0 * uRepD, s0 * vRep], [v0 * uRepD, s1 * vRep], [v1 * uRepD, s1 * vRep]] }
        );
      }
    }
  }

  // ---- 山花（硬山／懸山／卷棚，及歇山上段）----
  if (gable && type !== 'wudian' && type !== 'zanjian') {
    const s0g = type === 'xieshan' ? SB : 0;
    const gxx = type === 'xieshan' ? prof(SB)[0]
      : type === 'xuanshan' ? A - eave * 0.35 + overhang
        : w / 2;
    const yBase = y + rise(s0g);
    for (const sgn of [-1, 1]) {
      for (let i = Math.round(s0g * N); i < N; i++) {
        const s0 = i / N, s1 = (i + 1) / N;
        const b0 = prof(s0)[1], b1 = prof(s1)[1];
        const y0 = y + rise(s0), y1 = y + rise(s1);
        // 上緣兩點 → 底邊兩點（近似為梯形）
        gb.quad(
          put(sgn * gxx, y0, b0), put(sgn * gxx, y0, -b0),
          put(sgn * gxx, Math.max(yBase, y1), -b1), put(sgn * gxx, Math.max(yBase, y1), b1),
          gableColor, { ch: gableCh }
        );
      }
      // 博風板 + 懸魚（懸山）
      if (type === 'xuanshan') {
        for (let i = 0; i < N; i++) {
          const s0 = i / N, s1 = (i + 1) / N;
          const b0 = prof(s0)[1], b1 = prof(s1)[1];
          const y0 = y + rise(s0), y1 = y + rise(s1);
          for (const zs of [1, -1]) {
            gb.box(0.16, 0.4, Math.hypot(b0 - b1, y1 - y0) + 0.12, P.woodDark, {
              ch: 'wood', ...xy(F, sgn * (gxx + 0.12), zs * (b0 + b1) / 2), y: (y0 + y1) / 2,
              ry: rot, rx: -zs * Math.atan2(y1 - y0, b0 - b1), order: 'YXZ',
            });
          }
        }
        gb.box(0.1, 0.9, 0.55, P.woodDark, { ch: 'wood', ...xy(F, sgn * (gxx + 0.16), 0), y: y + h - 0.5, ry: rot });
      }
    }
  }

  // ---- 正脊 ----
  const [axTop] = prof(1);
  const yTop = y + h;
  if (type !== 'zanjian' && type !== 'juanpeng') {
    const rl = Math.max(0.4, axTop * 2);
    gb.box(rl, 0.62, 0.42, P.ji, { ch: 'ridge', ...xy(F, 0, 0), y: yTop + 0.31, ry: rot });
    // 鴟吻
    if (rank <= 2) {
      for (const sgn of [-1, 1]) {
        // 吻身
        gb.box(0.46, 0.95, 0.46, P.wenshou, { ch: 'ridge', ...xy(F, sgn * (axTop + 0.1), 0), y: yTop + 0.5, ry: rot });
        // 上捲的吻尾（向脊心內捲）
        gb.box(0.3, 0.62, 0.34, P.wenshou, { ch: 'ridge', ...xy(F, sgn * (axTop - 0.02), 0), y: yTop + 1.14, ry: rot, rz: -sgn * 0.55, order: 'YXZ' });
        gb.box(0.24, 0.34, 0.3, P.wenshou, { ch: 'ridge', ...xy(F, sgn * (axTop - 0.36), 0), y: yTop + 1.44, ry: rot, rz: -sgn * 1.15, order: 'YXZ' });
        // 劍把
        gb.box(0.12, 0.4, 0.12, P.jin, { ch: 'flat', ...xy(F, sgn * (axTop + 0.24), 0), y: yTop + 1.02, ry: rot });
      }
    }
  } else if (type === 'juanpeng') {
    // 卷棚：元寶脊（無正脊，圓轉）
    gb.cyl(0.4, 0.4, Math.max(0.4, axTop * 2), color,
      { ch, ...xy(F, 0, 0), y: yTop - 0.05, ry: rot, rz: Math.PI / 2, seg: 8 });
  } else {
    // 攢尖寶頂
    gb.sphere(0.55, P.jin, { ch: 'flat', ...xy(F, 0, 0), y: yTop + 0.55 });
    gb.cyl(0.28, 0.4, 0.7, P.ji, { ch: 'ridge', ...xy(F, 0, 0), y: yTop + 0.1 });
  }

  // ---- 垂脊／戧脊：沿角部路徑鋪小段 ----
  const ridgeSegs = [];
  if (type === 'wudian' || type === 'xieshan') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [];
      const iEnd = type === 'xieshan' ? Math.ceil(SB * N) : N;
      for (let i = 0; i <= iEnd; i++) {
        const s = i / N;
        const [ax, bz] = prof(s);
        pts.push([sx * ax, y + rise(s) + lf(sx > 0 ? 1 : 0, s) + 0.14, sz * bz]);
      }
      ridgeSegs.push(pts);
    }
  }
  if (type === 'yingshan' || type === 'xuanshan' || type === 'xieshan' || type === 'juanpeng') {
    const gx2 = type === 'xieshan' ? prof(SB)[0] : (type === 'xuanshan' ? A - eave * 0.35 : w / 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [];
      const iStart = type === 'xieshan' ? Math.ceil(SB * N) : 0;
      for (let i = iStart; i <= N; i++) {
        const s = i / N;
        const bz = prof(s)[1];
        pts.push([sx * gx2, y + rise(s) + 0.14, sz * bz]);
      }
      ridgeSegs.push(pts);
    }
  }
  for (const pts of ridgeSegs) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const horiz = Math.hypot(dx, dz);
      const len = Math.hypot(dx, dy, dz) + 0.1;
      const [wx, wz] = F.p(mx, mz);
      gb.box(0.3, 0.34, len, P.ji, {
        ch: 'ridge', x: wx, y: my, z: wz,
        ry: rot + Math.atan2(dx, dz),
        rx: -Math.atan2(dy, horiz),
        order: 'YXZ',
      });
    }
    // 仙人走獸（檐端）
    if (rank <= 2) {
      const e = pts[0];
      const [wx, wz] = F.p(e[0], e[2]);
      for (let k = 0; k < 3; k++) {
        gb.sphere(0.13, P.wenshou, { ch: 'flat', x: wx, y: e[1] + 0.28 + k * 0.02, z: wz });
      }
    }
  }

  // ---- 檐下：望板（封住檐底）與椽頭 ----
  if (SOFFIT.on) {
    const sSoffit = 0.34;
    const [ax0, bz0] = prof(0);
    const [ax1, bz1] = prof(sSoffit);
    const dy = rise(sSoffit);
    for (const sz of [1, -1]) {
      const run = Math.abs(bz0 - bz1);
      const len = Math.hypot(run, dy);
      gb.box(ax0 * 2, 0.12, len, P.liang, {
        ch: 'wood', ...xy(F, 0, sz * (bz0 + bz1) / 2), y: y + dy / 2 - 0.14,
        ry: rot, rx: sz * Math.atan2(dy, run), order: 'YXZ',
      });
      // 椽頭（二等以上露明）
      if (rank <= 2) {
        const n = Math.max(4, Math.round(ax0 * 2 / 0.85));
        for (let i = 0; i <= n; i++) {
          const lx = -ax0 + (ax0 * 2) * i / n;
          gb.box(0.13, 0.13, 0.55, P.liang, {
            ch: 'wood', ...xy(F, lx, sz * (bz0 + 0.18)), y: y - 0.2, ry: rot,
            rx: sz * Math.atan2(dy, run) * 0.6, order: 'YXZ',
          });
        }
      }
    }
    if (hipTypes) {
      for (const sx of [1, -1]) {
        const run = Math.abs(ax0 - ax1);
        const len = Math.hypot(run, dy);
        if (len > 0.2) {
          gb.box(0.12, len, bz0 * 2, P.liang, {
            ch: 'wood', ...xy(F, sx * (ax0 + ax1) / 2, 0), y: y + dy / 2 - 0.14,
            ry: rot, rz: -sx * Math.atan2(dy, run), order: 'YXZ',
          });
        }
      }
    }
  }

  // ---- 檐口：瓦當滴水 ----
  {
    const [ax0, bz0] = prof(0);
    for (const sz of [1, -1]) {
      gb.box(ax0 * 2, 0.22, 0.14, jian ? P.liuli : color, {
        ch: jian ? 'liuli' : ch, ...xy(F, 0, sz * bz0), y: y - 0.06, ry: rot,
      });
    }
    if (hipTypes) {
      for (const sx of [1, -1]) {
        gb.box(0.14, 0.22, bz0 * 2, jian ? P.liuli : color, {
          ch: jian ? 'liuli' : ch, ...xy(F, sx * ax0, 0), y: y - 0.06, ry: rot,
        });
      }
    }
  }

  return { eaveY: y, ridgeY: yTop, A, B };
}

function xy(F, lx, lz) { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; }

// ---------------------------------------------------------------- 匾額 / 楹聯
export function plaqueBoard(gb, F, text, lx, ly, lz, w = 2.6, h = 0.95) {
  const uv = plaqueUV(text);
  const [wx, wz] = F.p(lx, lz);
  // 匾身
  gb.bake(new THREE.PlaneGeometry(w, h), 0xffffff, {
    ch: 'plaque', uvMode: 'geo', uvScale: [uv[2] - uv[0], uv[3] - uv[1]], uvOffset: [uv[0], uv[1]],
    x: wx + Math.sin(F.rot) * 0.001, y: ly, z: wz, ry: F.rot,
  });
  // 邊框
  gb.box(w + 0.22, 0.12, 0.12, P.jin, { ch: 'flat', x: wx, y: ly + h / 2 + 0.06, z: wz, ry: F.rot });
  gb.box(w + 0.22, 0.12, 0.12, P.jin, { ch: 'flat', x: wx, y: ly - h / 2 - 0.06, z: wz, ry: F.rot });
}

export function coupletBoard(gb, F, text, lx, ly, lz, w = 0.5, h = 3.2) {
  const uv = coupletUV(text);
  const [wx, wz] = F.p(lx, lz);
  gb.bake(new THREE.PlaneGeometry(w, h), 0xffffff, {
    ch: 'couplet', uvMode: 'geo', uvScale: [uv[2] - uv[0], uv[3] - uv[1]], uvOffset: [uv[0], uv[1]],
    x: wx, y: ly, z: wz, ry: F.rot,
  });
}

// ---------------------------------------------------------------- 斗栱
export function dougong(gb, F, lx, ly, lz, rot, tiers = 2) {
  const w = xy(F, lx, lz);
  gb.box(0.44, 0.26, 0.44, P.shiqing, { ch: 'flat', ...w, y: ly, ry: rot });
  for (let t = 1; t <= tiers; t++) {
    const s = 0.5 + t * 0.34;
    gb.box(s * 2.0, 0.16, 0.2, P.shilv, { ch: 'flat', ...w, y: ly + t * 0.28, ry: rot });
    gb.box(0.2, 0.16, s * 1.5, t % 2 ? P.bai : P.shilv, { ch: 'flat', ...w, y: ly + t * 0.28, ry: rot });
  }
}

// ---------------------------------------------------------------- 欄杆
export function railing(gb, F, x0, z0, x1, z1, y, o = {}) {
  const { h = 1.05, color = P.zhu, ch = 'wood', stone = false, bench = false } = o;
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.2) return;
  const n = Math.max(1, Math.round(len / 1.5));
  const ang = Math.atan2(-(x1 - x0), -(z1 - z0));
  const col = stone ? P.hanbaiyu : color;
  const chn = stone ? 'stone' : ch;
  // 尋杖（扶手）
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  gb.box(0.14, 0.14, len, col, { ch: chn, ...xy(F, mx, mz), y: y + h, ry: F.rot + ang });
  if (!stone) gb.box(0.1, 0.08, len, col, { ch: chn, ...xy(F, mx, mz), y: y + h * 0.55, ry: F.rot + ang });
  // 望柱／欄板
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
    gb.box(stone ? 0.24 : 0.13, h + (stone ? 0.28 : 0.12), stone ? 0.24 : 0.13, col,
      { ch: chn, ...xy(F, px, pz), y: y + h / 2, ry: F.rot + ang });
    if (stone && i < n) {
      const t2 = (i + 0.5) / n;
      gb.box(0.12, h * 0.7, len / n - 0.3, P.hanbaiyu,
        { ch: 'stone', ...xy(F, x0 + (x1 - x0) * t2, z0 + (z1 - z0) * t2), y: y + h * 0.42, ry: F.rot + ang });
    }
  }
  if (!stone) {
    // 華板：豎欞
    const m = Math.max(2, Math.round(len / 0.75));
    for (let i = 1; i < m; i++) {
      const t = i / m;
      gb.box(0.055, h * 0.45, 0.055, col,
        { ch: chn, ...xy(F, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t), y: y + h * 0.77, ry: F.rot + ang });
    }
  }
  // 坐凳楣子（美人靠）
  if (bench) {
    gb.box(0.42, 0.1, len, P.woodLight, { ch: 'wood', ...xy(F, mx, mz), y: y + 0.46, ry: F.rot + ang });
  }
}

// ---------------------------------------------------------------- 掛落 / 雀替
export function guaLuo(gb, F, x0, z0, x1, z1, y, color = P.zhu) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(-(x1 - x0), -(z1 - z0));
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  gb.box(0.09, 0.34, len, color, { ch: 'wood', ...xy(F, mx, mz), y: y - 0.17, ry: F.rot + ang });
  const m = Math.max(3, Math.round(len / 0.8));
  for (let i = 1; i < m; i++) {
    const t = i / m;
    gb.box(0.05, 0.26, 0.05, color,
      { ch: 'wood', ...xy(F, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t), y: y - 0.3, ry: F.rot + ang });
  }
}

// ---------------------------------------------------------------- 槅扇 / 檻牆 / 支摘窗
function bayInfill(gb, F, cx, lz, bw, y0, y1, kind, o = {}) {
  const {
    latCh = 'lattice', woodC = P.wood, sillC = P.qingzhuan, facing = 1,
    wallC = P.fenqiang, wallCH = 'plaster',
  } = o;
  const inset = 0.02 * facing;
  const faceRot = F.rot + (facing < 0 ? Math.PI : 0);
  if (kind === 'open') return;
  if (kind === 'wall') {
    gb.box(bw, y1 - y0, 0.34, wallC, { ch: wallCH, ...xy(F, cx, lz), y: (y0 + y1) / 2, ry: F.rot });
    return;
  }
  // 可入的堂屋：明間槅扇門向兩側敞開，中間留空——既合禮制（迎客開中門），
  // 也讓玩家一眼看出這裡進得去
  if (kind === 'dooropen') {
    const lw = bw * 0.26, th = 0.62;
    for (const sgn of [-1, 1]) {
      const hx = cx + sgn * bw / 2;
      const lx = hx - sgn * (lw / 2) * Math.cos(th);
      const lzz = lz + (lw / 2) * Math.sin(th) * facing;
      const [wx, wz] = F.p(lx, lzz);
      const leafRot = faceRot + sgn * th * facing;
      const LF = frame(wx, wz, leafRot);
      const pH2 = y1 - y0;
      gb.bake(new THREE.PlaneGeometry(lw - 0.1, pH2 * 0.6), 0xffffff, {
        ch: latCh, uvMode: 'geo', uvScale: [Math.max(1, (lw - 0.1) / 0.62), Math.max(1, pH2 * 0.6 / 0.62)],
        x: wx, y: y1 - pH2 * 0.3 - 0.06, z: wz, ry: leafRot,
      });
      gb.box(lw - 0.1, pH2 * 0.3, 0.07, woodC, { ch: 'wood', ...xy(LF, 0, 0), y: y0 + pH2 * 0.15, ry: leafRot });
      gb.box(lw - 0.1, 0.13, 0.08, P.zhu, { ch: 'wood', ...xy(LF, 0, 0), y: y0 + pH2 * 0.34, ry: leafRot });
      gb.box(0.1, pH2, 0.11, woodC, { ch: 'wood', ...xy(LF, sgn * (lw / 2 - 0.05), 0), y: y0 + pH2 / 2, ry: leafRot });
    }
    gb.box(bw, 0.18, 0.24, P.woodDark, { ch: 'wood', ...xy(F, cx, lz), y: y0 + 0.09, ry: faceRot });   // 門檻
    gb.box(bw, 0.42, 0.13, woodC, { ch: 'wood', ...xy(F, cx, lz), y: y1 - 0.21, ry: faceRot });        // 上檻
    gb.box(0.12, y1 - y0, 0.13, woodC, { ch: 'wood', ...xy(F, cx + bw / 2, lz), y: (y0 + y1) / 2, ry: faceRot });
    gb.box(0.12, y1 - y0, 0.13, woodC, { ch: 'wood', ...xy(F, cx - bw / 2, lz), y: (y0 + y1) / 2, ry: faceRot });
    return;
  }
  const sillH = kind === 'door' ? 0.0 : 0.92;      // 檻牆高
  if (sillH > 0) {
    gb.box(bw, sillH, 0.3, sillC, { ch: 'brick', ...xy(F, cx, lz), y: y0 + sillH / 2, ry: F.rot });
  }
  const pH = y1 - (y0 + sillH);
  const nLeaf = kind === 'door' ? 4 : 3;
  const lw = bw / nLeaf;
  for (let i = 0; i < nLeaf; i++) {
    const lx = cx - bw / 2 + lw * (i + 0.5);
    // 櫺心
    const heartH = kind === 'door' ? pH * 0.62 : pH * 0.84;
    gb.bake(new THREE.PlaneGeometry(lw - 0.09, heartH), 0xffffff, {
      ch: latCh, uvMode: 'geo', uvScale: [Math.max(1, (lw - 0.09) / 0.62), Math.max(1, heartH / 0.62)],
      ...xy(F, lx, lz + inset), y: y1 - heartH / 2 - 0.06, ry: faceRot,
    });
    // 裙板（門扇下段）
    if (kind === 'door') {
      gb.box(lw - 0.09, pH * 0.32, 0.07, woodC, { ch: 'wood', ...xy(F, lx, lz), y: y0 + pH * 0.16, ry: F.rot });
      // 絛環板
      gb.box(lw - 0.09, 0.14, 0.08, P.zhu, { ch: 'wood', ...xy(F, lx, lz), y: y0 + pH * 0.36, ry: F.rot });
    }
    // 立梃
    gb.box(0.09, pH, 0.1, woodC, { ch: 'wood', ...xy(F, lx - lw / 2, lz), y: y0 + sillH + pH / 2, ry: F.rot });
  }
  // 抹頭 / 邊梃
  gb.box(bw, 0.12, 0.12, woodC, { ch: 'wood', ...xy(F, cx, lz), y: y1 - 0.06, ry: F.rot });
  gb.box(0.11, pH, 0.12, woodC, { ch: 'wood', ...xy(F, cx + bw / 2, lz), y: y0 + sillH + pH / 2, ry: F.rot });
  gb.box(0.11, pH, 0.12, woodC, { ch: 'wood', ...xy(F, cx - bw / 2, lz), y: y0 + sillH + pH / 2, ry: F.rot });
}

// ---------------------------------------------------------------- 殿宇
/**
 * 一座房屋（正房／廂房／廳堂／樓）
 * rot=0 表示坐北朝南，正面朝 +Z。
 */
export function hall(gb, o) {
  const {
    x = 0, z = 0, rot = 0,
    bays = 3, bayW = 4.2, depth = 8,
    rank = 3, roofType = null,
    baseH = null, colH = null,
    name = null, couplet = null,
    front = 'mixed',                 // mixed(明間門+次間窗) | door | window | open | wall
    back = 'wall', sides = 'wall',
    porch = false, veranda = false,  // 前廊 / 四面出廊
    storey = 1,
    thatch = false,
    latCh = null,
    wallColor = null, wallCh = null,
    tileColor = null,
    enterable = false,
    collide = true,
    windOff = false,
  } = o;

  const W = bays * bayW;
  const D = depth;
  const F = frame(x, z, rot);
  const rt = roofType ?? (rank <= 1 ? 'wudian' : rank === 2 ? 'yingshan' : rank === 3 ? 'juanpeng' : 'yingshan');
  const bH = baseH ?? (rank <= 1 ? 1.5 : rank === 2 ? 0.85 : rank === 3 ? 0.5 : 0.28);
  const cH = colH ?? (rank <= 1 ? 6.4 : rank === 2 ? 4.6 : rank === 3 ? 3.7 : 3.1);
  const lat = latCh ?? (rank <= 2 ? 'tortoise' : rank === 3 ? 'ice' : 'zhiling');
  const wallC = wallColor ?? (rank <= 2 ? P.qingzhuan : P.fenqiang);
  const wallCH = wallCh ?? (rank <= 2 ? 'brick' : 'plaster');
  const tileC = tileColor ?? (thatch ? P.mao : rank <= 1 ? P.liuli : P.tongwa);
  const gz = groundHeight(x, z);

  const pOut = porch || veranda ? 1.6 : 0;
  const podW = W + 1.7 + (veranda ? 2.6 : 0);
  const podD = D + 1.7 + pOut + (veranda ? 1.6 : 0);
  // 台基要把前廊一起托住：前緣在 D/2+pOut 之外，故中心向前（+z）挪 pOut/2
  const podZ = pOut / 2;
  // ---- 台基 ----
  gb.box(podW, bH + gz, podD, rank <= 1 ? P.hanbaiyu : P.taiming, {
    ch: rank <= 1 ? 'stone' : 'brick', ...xy(F, 0, podZ), y: (bH + gz) / 2, ry: rot,
  });
  gb.box(podW - 0.1, 0.07, podD - 0.1, P.mandi, { ch: 'mandi', ...xy(F, 0, podZ), y: gz + bH + 0.03, ry: rot });
  if (rank <= 1) {
    gb.box(podW + 0.4, 0.26, podD + 0.4, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, podZ), y: gz + bH - 0.13, ry: rot });
    gb.box(podW + 0.4, 0.26, podD + 0.4, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, podZ), y: gz + 0.13, ry: rot });
  }
  {
    const [px, pz] = F.p(0, podZ);
    const hw = Math.abs(podW * F.cos) / 2 + Math.abs(podD * F.sin) / 2;
    const hd = Math.abs(podW * F.sin) / 2 + Math.abs(podD * F.cos) / 2;
    addPlatform(px - hw, pz - hd, px + hw, pz + hd, gz + bH);
  }
  // 踏跺：內側（台基邊）高、外側（院子）低。方向必須隨朝向計算——
  // 若把高低端寫反，檐前就變成一道 bH 高的坎，玩家永遠上不了台基。
  {
    const nS = Math.max(2, Math.round(bH / 0.24));
    const sw = Math.min(W * 0.62, Math.max(5.4, bayW * 1.7));
    // 踏跺總長取「每級 0.42m」與「高差 ×2.6」的較大者：後者保證坡度夠緩，
    // 玩家（每級可邁高差 0.62m）不會被自家台階擋在門外
    const rampLen = Math.max(0.42 * nS, (bH + gz) * 2.6);
    const sd = rampLen / nS;
    for (let i = 0; i < nS; i++) {
      const hh = (bH + gz) * (nS - i) / nS;
      gb.box(sw, hh, sd, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, podD / 2 + podZ + sd * (i + 0.5)), y: hh / 2, ry: rot });
    }
    // 垂帶石：兩側的斜坡邊石，遠看就知道這裡上得去
    for (const sgn of [-1, 1]) {
      gb.box(0.42, 0.34, Math.hypot(rampLen, bH + gz) + 0.3, P.hanbaiyu, {
        ch: 'stone', ...xy(F, sgn * (sw / 2 + 0.21), podD / 2 + podZ + rampLen / 2),
        y: (bH + gz) / 2 + 0.17, ry: rot, rx: Math.atan2(bH + gz, rampLen), order: 'YXZ',
      });
    }
    const zi = podD / 2 + podZ;              // 內端：緊貼台基
    const zo = zi + rampLen;                 // 外端：落地
    const [ix, iz] = F.p(0, zi);
    const [ox, oz] = F.p(0, zo);
    const outH = groundHeight(ox, oz);       // 建在坡上時，外端接的是坡面而不是 0
    const pad = sw / 2 + 0.35;
    if (Math.abs(oz - iz) > Math.abs(ox - ix)) {
      addRamp(Math.min(ix, ox) - pad, iz, Math.max(ix, ox) + pad, oz, gz + bH, outH, 'z');
    } else {
      addRamp(ix, Math.min(iz, oz) - pad, ox, Math.max(iz, oz) + pad, gz + bH, outH, 'x');
    }
  }

  const y0 = gz + bH;

  // ---- 柱網 ----
  const colR = rank <= 1 ? 0.34 : rank === 2 ? 0.27 : 0.21;
  const colRows = [D / 2, -D / 2];
  if (pOut) colRows.push(D / 2 + pOut);
  const drawColumns = (yBase, hCol) => {
    for (let i = 0; i <= bays; i++) {
      const lx = -W / 2 + i * bayW;
      for (const lz of colRows) {
        gb.cyl(colR, colR * 1.06, hCol, P.zhu, { ch: 'wood', ...xy(F, lx, lz), y: yBase + hCol / 2, seg: 8 });
        gb.cyl(colR * 1.5, colR * 1.65, 0.24, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, lz), y: yBase + 0.12, seg: 8 });
      }
    }
    if (veranda) {
      for (const lx of [-W / 2 - 1.6, W / 2 + 1.6]) {
        for (let k = 0; k <= Math.round(D / 3); k++) {
          const lz = -D / 2 + (D / Math.max(1, Math.round(D / 3))) * k;
          gb.cyl(colR * 0.85, colR * 0.9, hCol, P.zhu, { ch: 'wood', ...xy(F, lx, lz), y: yBase + hCol / 2, seg: 8 });
        }
      }
    }
  };

  // ---- 牆與門窗 ----
  // 逐間定填充：mixed=明間門+次間窗；gate=明間開洞（可穿行）+次間實牆
  const bayKind = (spec, i) => {
    const isCenter = bays % 2 === 1 ? i === (bays - 1) / 2 : (i === bays / 2 - 1 || i === bays / 2);
    if (spec === 'mixed') return isCenter ? (enterable ? 'dooropen' : 'door') : 'window';
    if (spec === 'gate') return isCenter ? 'open' : 'wall';
    return spec;
  };

  const drawSkin = (yBase, hCol, frontKind) => {
    // 後檐
    if (back === 'wall') {
      gb.box(W + 0.5, hCol, 0.42, wallC, { ch: wallCH, ...xy(F, 0, -D / 2 - 0.06), y: yBase + hCol / 2, ry: rot });
    } else if (back !== 'open') {
      for (let i = 0; i < bays; i++) {
        bayInfill(gb, F, -W / 2 + bayW * (i + 0.5), -D / 2 - 0.05, bayW - 0.16,
          yBase, yBase + hCol - 0.3, bayKind(back, i), { latCh: lat, facing: -1, wallC, wallCH, sillC: wallC });
      }
    }
    // 山牆
    if (sides === 'wall') {
      for (const sx of [-1, 1]) {
        gb.box(0.42, hCol, D + 0.5, wallC, { ch: wallCH, ...xy(F, sx * (W / 2 + 0.06), 0), y: yBase + hCol / 2, ry: rot });
      }
    }
    // 前檐
    for (let i = 0; i < bays; i++) {
      bayInfill(gb, F, -W / 2 + bayW * (i + 0.5), D / 2 + 0.04, bayW - 0.16,
        yBase, yBase + hCol - 0.3, bayKind(frontKind, i), { latCh: lat, wallC, wallCH, sillC: wallC });
    }
  };

  // ---- 額枋 + 斗栱 ----
  const drawBeams = (yBase, hCol) => {
    const chC = caihuaCh(rank);
    const beamY = yBase + hCol - 0.3;
    for (let i = 0; i < bays; i++) {
      const lx = -W / 2 + bayW * (i + 0.5);
      for (const lz of [D / 2, -D / 2]) {
        gb.box(bayW - 0.1, 0.56, 0.34, 0xffffff, {
          ch: chC ?? 'wood', uvMode: chC ? 'geo' : 'tri', ...xy(F, lx, lz), y: beamY, ry: rot,
        });
      }
      if (pOut) {
        gb.box(bayW - 0.1, 0.56, 0.34, 0xffffff, {
          ch: chC ?? 'wood', uvMode: chC ? 'geo' : 'tri', ...xy(F, lx, D / 2 + pOut), y: beamY, ry: rot,
        });
      }
    }
    // 側面額枋
    for (const sx of [-1, 1]) {
      gb.box(0.34, 0.56, D - 0.1, 0xffffff, {
        ch: chC ?? 'wood', uvMode: chC ? 'geo' : 'tri', uvScale: [Math.max(1, D / bayW), 1],
        ...xy(F, sx * W / 2, 0), y: beamY, ry: rot,
      });
    }
    // 平板枋
    gb.box(W + 0.5, 0.2, D + 0.5, P.shiqing, { ch: 'flat', ...xy(F, 0, 0), y: beamY + 0.38, ry: rot });
    if (pOut) gb.box(W + 0.5, 0.2, 0.4, P.shiqing, { ch: 'flat', ...xy(F, 0, D / 2 + pOut), y: beamY + 0.38, ry: rot });
    // 雀替
    for (let i = 0; i <= bays; i++) {
      const lx = -W / 2 + i * bayW;
      for (const sgn of [-1, 1]) {
        if ((i === 0 && sgn < 0) || (i === bays && sgn > 0)) continue;
        gb.box(0.55, 0.3, 0.16, P.shilv, { ch: 'flat', ...xy(F, lx + sgn * 0.4, D / 2 + pOut), y: beamY - 0.36, ry: rot });
      }
    }
    // 斗栱
    if (rank <= 2) {
      const n = Math.max(bays, Math.round(W / 2.8));
      for (let i = 0; i <= n; i++) {
        const lx = -W / 2 + (W / n) * i;
        dougong(gb, F, lx, beamY + 0.5, D / 2 + pOut, rot, rank <= 1 ? 3 : 2);
        dougong(gb, F, lx, beamY + 0.5, -D / 2, rot, rank <= 1 ? 3 : 2);
      }
    }
    return beamY + 0.5 + (rank <= 2 ? (rank <= 1 ? 1.0 : 0.72) : 0.18);
  };

  let eaveY;
  if (storey >= 2) {
    // 下層
    drawColumns(y0, cH);
    drawSkin(y0, cH, front);
    const midY = drawBeams(y0, cH);
    // 腰檐
    const [mrx, mrz] = F.p(0, pOut / 2);
    roof(gb, {
      x: mrx, z: mrz, rot, y: midY, w: W + 1.0 + pOut * 0.4, d: D + 1.0 + pOut, h: 1.5,
      type: 'juanpeng', ch: tileCh(rank, thatch), color: tileC, eave: 1.0, rank: 3, gable: true,
    });
    // 平座欄杆
    const deckY = midY + 1.7;
    gb.box(W + 1.6, 0.24, D + 1.6, P.wood, { ch: 'wood', ...xy(F, 0, 0), y: deckY - 0.12, ry: rot });
    railing(gb, F, -(W / 2 + 0.8), D / 2 + 0.8, W / 2 + 0.8, D / 2 + 0.8, deckY, { h: 0.95 });
    railing(gb, F, -(W / 2 + 0.8), -(D / 2 + 0.8), -(W / 2 + 0.8), D / 2 + 0.8, deckY, { h: 0.95 });
    railing(gb, F, W / 2 + 0.8, -(D / 2 + 0.8), W / 2 + 0.8, D / 2 + 0.8, deckY, { h: 0.95 });
    // 上層
    const cH2 = cH * 0.88;
    drawColumns(deckY, cH2);
    drawSkin(deckY, cH2, 'window');
    eaveY = drawBeams(deckY, cH2);
  } else {
    drawColumns(y0, cH);
    drawSkin(y0, cH, front);
    eaveY = drawBeams(y0, cH);
  }

  // ---- 屋頂 ----
  const rh = rt === 'wudian' || rt === 'xieshan' ? Math.max(3.2, D * 0.44)
    : rt === 'zanjian' ? Math.max(2.8, Math.min(W, D) * 0.5)
      : Math.max(2.2, D * 0.36);
  const [rx0, rz0] = F.p(0, pOut / 2);
  roof(gb, {
    x: rx0, z: rz0, rot, y: eaveY, w: W + (veranda ? 3.2 : 0), d: D + pOut + (veranda ? 1.6 : 0), h: rh,
    type: rt, ch: tileCh(rank, thatch), color: tileC, rank,
    jian: rank <= 1, eave: rank <= 2 ? 1.7 : 1.35,
    gableColor: rank <= 2 ? P.qingzhuan : P.fenqiang, gableCh: rank <= 2 ? 'brick' : 'plaster',
  });

  // ---- 匾額楹聯 ----
  if (name) {
    const pw = Math.min(bayW * 0.86, 3.4);
    plaqueBoard(gb, F, name, 0, y0 + cH - 0.95, D / 2 + pOut + 0.32, pw, pw * 0.36);
  }
  if (couplet) {
    coupletBoard(gb, F, couplet[0], -bayW * 0.5 - 0.18, y0 + cH * 0.55, D / 2 + pOut + 0.3, 0.52, cH * 0.72);
    coupletBoard(gb, F, couplet[1], bayW * 0.5 + 0.18, y0 + cH * 0.55, D / 2 + pOut + 0.3, 0.52, cH * 0.72);
  }

  // ---- 碰撞 ----
  if (collide) {
    const [px, pz] = F.p(0, 0);
    const hw = Math.abs((W + 0.9) * F.cos) / 2 + Math.abs((D + 0.9) * F.sin) / 2;
    const hd = Math.abs((W + 0.9) * F.sin) / 2 + Math.abs((D + 0.9) * F.cos) / 2;
    if (enterable) {
      const t = 0.5;
      const gap = bayW * 0.8;
      const backOpen = back === 'gate' || back === 'open';   // 門樓、儀門：前後都要穿得過
      // 正面朝向：局部 +z 映射到世界 (sin rot, cos rot)
      const frontIsZ = Math.abs(F.cos) > 0.5;
      const sgn = frontIsZ ? Math.sign(F.cos) : Math.sign(F.sin);
      if (frontIsZ) {
        const fz = pz + sgn * hd, bz = pz - sgn * hd;
        addWallWithGap(px - hw, fz - sgn * t, px + hw, fz, px, gap);
        if (backOpen) addWallWithGap(px - hw, bz, px + hw, bz + sgn * t, px, gap);
        else addCollider(px - hw, bz, px + hw, bz + sgn * t);
        addCollider(px - hw, pz - hd, px - hw + t, pz + hd);
        addCollider(px + hw - t, pz - hd, px + hw, pz + hd);
      } else {
        const fx = px + sgn * hw, bx = px - sgn * hw;
        addWallWithGap(fx - sgn * t, pz - hd, fx, pz + hd, pz, gap);
        if (backOpen) addWallWithGap(bx, pz - hd, bx + sgn * t, pz + hd, pz, gap);
        else addCollider(bx, pz - hd, bx + sgn * t, pz + hd);
        addCollider(px - hw, pz - hd, px + hw, pz - hd + t);
        addCollider(px - hw, pz + hd - t, px + hw, pz + hd);
      }
    } else {
      addCollider(px - hw, pz - hd, px + hw, pz + hd);
    }
  }

  return { eaveY, y0, W, D, F, colH: cH, baseH: bH };
}

// ---------------------------------------------------------------- 院牆
export function wallRun(gb, o) {
  const {
    x0, z0, x1, z1, h = 3.4, thick = 0.55,
    color = P.fenqiang, ch = 'plaster', capColor = P.tongwa,
    gapAt = null, gapW = 0, collide = true, cap = true,
  } = o;
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.1) return;
  const ang = Math.atan2(-(x1 - x0), -(z1 - z0));
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;

  const emit = (cx, cz, L) => {
    gb.box(thick, h, L, color, { x: cx, y: h / 2 + groundHeight(cx, cz), z: cz, ry: ang, ch });
    if (cap) {
      gb.box(thick + 0.34, 0.2, L, capColor, { x: cx, y: h + 0.1 + groundHeight(cx, cz), z: cz, ry: ang, ch: 'tile' });
      gb.box(thick + 0.16, 0.24, L, P.ji, { x: cx, y: h + 0.32 + groundHeight(cx, cz), z: cz, ry: ang, ch: 'ridge' });
    }
  };

  if (gapAt !== null && gapW > 0) {
    // 沿牆長度參數 t∈[0,1] 開洞
    const t = gapAt;
    const g0 = Math.max(0, t - gapW / 2 / len), g1 = Math.min(1, t + gapW / 2 / len);
    if (g0 > 0.001) {
      const L = len * g0;
      emit(x0 + (x1 - x0) * g0 / 2, z0 + (z1 - z0) * g0 / 2, L);
    }
    if (g1 < 0.999) {
      const L = len * (1 - g1);
      emit(x0 + (x1 - x0) * (g1 + 1) / 2, z0 + (z1 - z0) * (g1 + 1) / 2, L);
    }
    if (collide) {
      const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const gx = x0 + (x1 - x0) * t, gz = z0 + (z1 - z0) * t;
      addWallWithGap(
        Math.min(x0, x1) - (horiz ? 0 : thick / 2), Math.min(z0, z1) - (horiz ? thick / 2 : 0),
        Math.max(x0, x1) + (horiz ? 0 : thick / 2), Math.max(z0, z1) + (horiz ? thick / 2 : 0),
        horiz ? gx : gz, gapW
      );
    }
  } else {
    emit(mx, mz, len);
    if (collide) {
      const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      addCollider(
        Math.min(x0, x1) - (horiz ? 0 : thick / 2), Math.min(z0, z1) - (horiz ? thick / 2 : 0),
        Math.max(x0, x1) + (horiz ? 0 : thick / 2), Math.max(z0, z1) + (horiz ? thick / 2 : 0)
      );
    }
  }
}

/** 矩形院牆（南面留門） */
export function courtyardWall(gb, o) {
  const { x0, z0, x1, z1, h = 3.4, gate = null, color = P.fenqiang, ch = 'plaster' } = o;
  const gAt = gate ? (gate.x - x0) / (x1 - x0) : null;
  wallRun(gb, { x0, z0: z1, x1, z1, h, color, ch, gapAt: gAt, gapW: gate ? gate.w : 0 });  // 南
  wallRun(gb, { x0, z0, x1, z1: z0, h, color, ch });                                        // 北
  wallRun(gb, { x0, z0, x1: x0, z1, h, color, ch });                                        // 西
  wallRun(gb, { x0: x1, z0, x1, z1, h, color, ch });                                        // 東
}

// ---------------------------------------------------------------- 垂花門
export function chuihuaMen(gb, o) {
  const { x, z, rot = 0, w = 4.6, h = 4.2, name = null } = o;
  const F = frame(x, z, rot);
  const gz = groundHeight(x, z);
  const d = 3.2;
  // 台明
  gb.box(w + 1.6, 0.35 + gz, d + 1.4, P.taiming, { ch: 'brick', ...xy(F, 0, 0), y: (0.35 + gz) / 2, ry: rot });
  addPlatform(x - (w + 1.6) / 2, z - (d + 1.4) / 2, x + (w + 1.6) / 2, z + (d + 1.4) / 2, gz + 0.35);
  const y0 = gz + 0.35;
  // 後檐柱（落地）
  for (const sx of [-1, 1]) {
    gb.cyl(0.24, 0.25, h, P.zhu, { ch: 'wood', ...xy(F, sx * w / 2, -d / 2), y: y0 + h / 2, seg: 8 });
    gb.cyl(0.34, 0.36, 0.22, P.hanbaiyu, { ch: 'stone', ...xy(F, sx * w / 2, -d / 2), y: y0 + 0.11, seg: 8 });
  }
  // 垂蓮柱（懸空）
  for (const sx of [-1, 1]) {
    gb.cyl(0.22, 0.22, h - 1.5, P.zhu, { ch: 'wood', ...xy(F, sx * w / 2, d / 2), y: y0 + 1.5 + (h - 1.5) / 2, seg: 8 });
    gb.sphere(0.3, P.jin, { ch: 'flat', ...xy(F, sx * w / 2, d / 2), y: y0 + 1.42, sy: 0.34 });
    // 蓮瓣
    for (let k = 0; k < 6; k++) {
      const a = k * TAU / 6;
      gb.sphere(0.13, P.shilv, {
        ch: 'flat',
        ...(() => { const [wx, wz] = F.p(sx * w / 2 + Math.cos(a) * 0.22, d / 2 + Math.sin(a) * 0.22); return { x: wx, z: wz }; })(),
        y: y0 + 1.62, sy: 0.2,
      });
    }
  }
  // 額枋（蘇式彩畫）+ 花罩
  gb.box(w + 0.7, 0.5, 0.3, 0xffffff, { ch: 'sushi', uvMode: 'geo', ...xy(F, 0, d / 2), y: y0 + h - 0.3, ry: rot });
  gb.box(w + 0.7, 0.5, 0.3, 0xffffff, { ch: 'sushi', uvMode: 'geo', ...xy(F, 0, -d / 2), y: y0 + h - 0.3, ry: rot });
  guaLuo(gb, F, -w / 2, d / 2, w / 2, d / 2, y0 + h - 0.62, P.zhu);
  // 門扇（朱漆板門）
  gb.box(w - 0.5, h - 1.1, 0.16, P.zhu, { ch: 'wood', ...xy(F, 0, -d / 2 + 0.1), y: y0 + (h - 1.1) / 2, ry: rot });
  for (const sx of [-1, 1]) {
    gb.sphere(0.11, P.jin, { ch: 'flat', ...xy(F, sx * 0.55, -d / 2 + 0.02), y: y0 + 1.5 });
  }
  // 一殿一卷式屋頂
  roof(gb, { x, z, rot, y: y0 + h + 0.2, w: w + 1.5, d: d + 1.2, h: 1.9, type: 'juanpeng', rank: 3, eave: 1.1 });
  if (name) plaqueBoard(gb, F, name, 0, y0 + h - 0.95, d / 2 + 0.24, 2.0, 0.72);
  // 碰撞：兩側柱墩，中間可過
  addWallWithGap(x - w / 2 - 0.9, z - 0.3, x + w / 2 + 0.9, z + 0.3, x, w - 0.9);
}

// ---------------------------------------------------------------- 大門（獸頭門 / 廣亮大門）
export function gateHouse(gb, o) {
  const {
    x, z, rot = 0, bays = 3, bayW = 4.6, depth = 6.5,
    rank = 2, name = null, lions = false, doorNails = true,
  } = o;
  const r = hall(gb, {
    x, z, rot, bays, bayW, depth, rank,
    roofType: rank <= 1 ? 'xieshan' : 'yingshan',
    front: 'gate', back: 'gate', name,
    enterable: true, collide: true,
  });
  const F = frame(x, z, rot);
  const W = bays * bayW, D = depth;
  const y0 = r.y0;
  const doorW = bayW * 0.82;
  // 門扇必須矮於匾額，否則正面題名被遮掉一半
  const doorH = Math.min(3.0, r.colH - 1.75);

  // 門楣與抱框
  gb.box(doorW + 0.7, 0.34, 0.55, P.woodDark, { ch: 'wood', ...xy(F, 0, D / 2), y: y0 + doorH + 0.17, ry: rot });
  for (const sgn of [-1, 1]) {
    gb.box(0.26, doorH + 0.34, 0.5, P.woodDark, { ch: 'wood', ...xy(F, sgn * (doorW / 2 + 0.13), D / 2), y: y0 + (doorH + 0.34) / 2, ry: rot });
  }
  // 門檻
  gb.box(doorW + 0.4, 0.28, 0.26, P.woodDark, { ch: 'wood', ...xy(F, 0, D / 2 + 0.08), y: y0 + 0.14, ry: rot });

  // 對開板門：以外側為軸向外敞開，讓出中間通路
  const th = 1.18;
  const leafW = doorW / 2;
  for (const sgn of [-1, 1]) {
    const lx = sgn * (doorW / 2 - (leafW / 2) * Math.cos(th));
    const lz = D / 2 + 0.14 + (leafW / 2) * Math.sin(th);
    const [wx, wz] = F.p(lx, lz);
    const leafRot = rot + sgn * th;
    gb.box(leafW, doorH, 0.13, P.zhu, { ch: 'wood', x: wx, y: y0 + doorH / 2, z: wz, ry: leafRot });
    if (doorNails) {
      const LF = frame(wx, wz, leafRot);
      for (let ry2 = 0; ry2 < 5; ry2++) {
        for (let c = 0; c < 3; c++) {
          const nx = -leafW / 2 + leafW * (c + 0.5) / 3;
          gb.sphere(0.075, P.jin, {
            ch: 'flat', ...xy(LF, nx, 0.07), y: y0 + 0.55 + ry2 * (doorH - 1.1) / 4, sy: 0.05,
          });
        }
      }
      // 鋪首銜環
      gb.cyl(0.15, 0.15, 0.05, P.jin, { ch: 'flat', ...xy(LF, sgn * -leafW * 0.3, 0.08), y: y0 + doorH * 0.5, rx: Math.PI / 2, ry: leafRot, order: 'YXZ', seg: 12 });
      gb.bake(new THREE.TorusGeometry(0.16, 0.028, 5, 10), P.jin, {
        ch: 'flat', ...xy(LF, sgn * -leafW * 0.3, 0.09), y: y0 + doorH * 0.5 - 0.16, ry: leafRot,
      });
    }
  }

  // 抱鼓石
  for (const sgn of [-1, 1]) {
    gb.cyl(0.55, 0.55, 0.3, P.hanbaiyu, { ch: 'stone', ...xy(F, sgn * (doorW / 2 + 0.62), D / 2 + 0.3), y: y0 + 0.86, rx: Math.PI / 2, ry: rot, order: 'YXZ', seg: 12 });
    gb.box(0.4, 0.7, 0.85, P.hanbaiyu, { ch: 'stone', ...xy(F, sgn * (doorW / 2 + 0.62), D / 2 + 0.3), y: y0 + 0.35, ry: rot });
  }

  // 石獅（門外街面）
  if (lions) {
    for (const sgn of [-1, 1]) {
      const lx = sgn * (W / 2 + 2.4);
      const lz = D / 2 + 2.6;
      gb.box(1.5, 0.7, 1.2, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, lz), y: 0.35, ry: rot });
      gb.box(0.8, 1.15, 0.95, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, lz - 0.05), y: 1.28, ry: rot });
      gb.sphere(0.42, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, lz + 0.32), y: 2.02 });
      gb.sphere(0.2, P.hanbaiyu, { ch: 'stone', ...xy(F, lx + sgn * 0.3, lz + 0.5), y: 1.6 });
      gb.sphere(0.14, P.hanbaiyu, { ch: 'stone', ...xy(F, lx - sgn * 0.22, lz + 0.52), y: 2.3 });
      const [ax, az] = F.p(lx, lz);
      addCollider(ax - 0.9, az - 0.9, ax + 0.9, az + 0.9);
    }
  }
  return r;
}

// ---------------------------------------------------------------- 月洞門
export function yuedongMen(gb, o) {
  const { x, z, rot = 0, r = 1.5, wallH = 3.4, color = P.fenqiang } = o;
  const F = frame(x, z, rot);
  const gz = groundHeight(x, z);
  const n = 22;
  // 圓洞周圈磚券
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n;
    const am = (a0 + a1) / 2;
    const lx = Math.cos(am) * (r + 0.22);
    const ly = gz + 0.9 + Math.sin(am) * (r + 0.22);
    gb.box(0.36, 0.36, 0.75, P.qingzhuan, { ch: 'brick', ...xy(F, lx, 0), y: ly, ry: rot, rz: am + Math.PI / 2 });
  }
  // 洞兩側牆
  for (const sgn of [-1, 1]) {
    gb.box(1.9, wallH, 0.6, color, { ch: 'plaster', ...xy(F, sgn * (r + 1.35), 0), y: gz + wallH / 2, ry: rot });
    const [cx, cz] = F.p(sgn * (r + 1.35), 0);
    addCollider(cx - 1.0, cz - 0.4, cx + 1.0, cz + 0.4);
  }
  // 洞上牆
  gb.box(r * 2 + 0.6, wallH - (0.9 + r + 0.4), 0.6, color, { ch: 'plaster', ...xy(F, 0, 0), y: gz + 0.9 + r + 0.4 + (wallH - (0.9 + r + 0.4)) / 2, ry: rot });
  gb.box(r * 2 + 3.6, 0.2, 0.9, P.tongwa, { ch: 'tile', ...xy(F, 0, 0), y: gz + wallH + 0.1, ry: rot });
}

// ---------------------------------------------------------------- 影壁
export function yingbi(gb, o) {
  const { x, z, rot = 0, w = 6.5, h = 4.2 } = o;
  const F = frame(x, z, rot);
  const gz = groundHeight(x, z);
  gb.box(w, 0.5, 1.0, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, 0), y: gz + 0.25, ry: rot });
  gb.box(w, h, 0.7, P.fenqiang, { ch: 'plaster', ...xy(F, 0, 0), y: gz + 0.5 + h / 2, ry: rot });
  // 磚雕心
  gb.box(w * 0.62, h * 0.56, 0.14, P.qingzhuan, { ch: 'brick', ...xy(F, 0, 0.38), y: gz + 0.5 + h * 0.52, ry: rot });
  gb.box(w * 0.56, h * 0.48, 0.1, P.zhuanDark, { ch: 'brick', ...xy(F, 0, 0.44), y: gz + 0.5 + h * 0.52, ry: rot });
  // 壁帽
  roof(gb, { x, z, rot, y: gz + 0.5 + h, w: w + 0.6, d: 1.5, h: 0.9, type: 'yingshan', rank: 3, eave: 0.55, gable: false });
  addCollider(x - w / 2, z - 0.6, x + w / 2, z + 0.6);
}

// ---------------------------------------------------------------- 遊廊（抄手／穿山）
export function corridor(gb, pts, o = {}) {
  const {
    h = 3.1, w = 2.4, color = P.zhu, rank = 3,
    bench = true, roofed = true, collide = false,
  } = o;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.3) continue;
    const ang = Math.atan2(-(x1 - x0), -(z1 - z0));
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const F = frame(mx, mz, ang);
    const gz = groundHeight(mx, mz);
    // 廊台
    gb.box(w, 0.3 + gz, len, P.mandi, { ch: 'mandi', x: mx, y: (0.3 + gz) / 2, z: mz, ry: ang });
    addPlatform(Math.min(x0, x1) - w / 2, Math.min(z0, z1) - w / 2, Math.max(x0, x1) + w / 2, Math.max(z0, z1) + w / 2, gz + 0.3);
    const y0 = gz + 0.3;
    const n = Math.max(1, Math.round(len / 3.0));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const lz = -len / 2 + len * t;
      for (const sx of [-1, 1]) {
        gb.cyl(0.16, 0.17, h, color, { ch: 'wood', ...xy(F, sx * (w / 2 - 0.22), lz), y: y0 + h / 2, seg: 8 });
        gb.cyl(0.24, 0.25, 0.16, P.hanbaiyu, { ch: 'stone', ...xy(F, sx * (w / 2 - 0.22), lz), y: y0 + 0.08, seg: 8 });
      }
    }
    // 楣枋 + 掛落 + 坐凳
    for (const sx of [-1, 1]) {
      gb.box(0.2, 0.4, len, 0xffffff, { ch: 'sushi', uvMode: 'geo', uvScale: [Math.max(1, len / 3.4), 1], ...xy(F, sx * (w / 2 - 0.22), 0), y: y0 + h - 0.2, ry: ang });
      guaLuo(gb, F, sx * (w / 2 - 0.22), -len / 2, sx * (w / 2 - 0.22), len / 2, y0 + h - 0.42, color);
      if (bench) {
        gb.box(0.34, 0.09, len, P.woodLight, { ch: 'wood', ...xy(F, sx * (w / 2 - 0.3), 0), y: y0 + 0.48, ry: ang });
        const m = Math.max(2, Math.round(len / 1.1));
        for (let k2 = 0; k2 <= m; k2++) {
          gb.box(0.09, 0.55, 0.09, P.woodLight, { ch: 'wood', ...xy(F, sx * (w / 2 - 0.3), -len / 2 + len * k2 / m), y: y0 + 0.24, ry: ang });
        }
        gb.box(0.08, 0.5, len, color, { ch: 'wood', ...xy(F, sx * (w / 2 - 0.16), 0), y: y0 + 0.86, ry: ang });
      }
    }
    if (roofed) {
      roof(gb, {
        x: mx, z: mz, rot: ang, y: y0 + h, w: len, d: w, h: 1.15,
        type: 'juanpeng', rank: 3, eave: 0.85, gable: false, ch: 'tile', color: P.tongwa,
      });
    }
    if (collide) addCollider(Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1);
  }
}

// ---------------------------------------------------------------- 亭
export function pavilion(gb, o) {
  const {
    x, z, rot = 0, r = 3.4, h = 3.3, sides = 4, name = null,
    rank = 3, bench = true, baseH = 0.55, couplet = null,
  } = o;
  const F = frame(x, z, rot);
  const gz = groundHeight(x, z);
  const w = r * 2;
  gb.box(w + 1.0, baseH + gz, w + 1.0, P.taiming, { ch: 'brick', ...xy(F, 0, 0), y: (baseH + gz) / 2, ry: rot });
  gb.box(w + 0.9, 0.06, w + 0.9, P.mandi, { ch: 'mandi', ...xy(F, 0, 0), y: gz + baseH + 0.03, ry: rot });
  addPlatform(x - (w + 1) / 2, z - (w + 1) / 2, x + (w + 1) / 2, z + (w + 1) / 2, gz + baseH);
  addRamp(x - 1.4, z + (w + 1) / 2, x + 1.4, z + (w + 1) / 2 + 1.2, gz + baseH, 0, 'z');
  const y0 = gz + baseH;
  const corners = sides === 4
    ? [[-r, -r], [r, -r], [r, r], [-r, r]]
    : Array.from({ length: sides }, (_, k) => {
      const a = (k + 0.5) * TAU / sides;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
  for (const [lx, lz] of corners) {
    gb.cyl(0.19, 0.2, h, P.zhu, { ch: 'wood', ...xy(F, lx, lz), y: y0 + h / 2, seg: 8 });
    gb.cyl(0.28, 0.3, 0.18, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, lz), y: y0 + 0.09, seg: 8 });
  }
  for (let k = 0; k < corners.length; k++) {
    const a = corners[k], b = corners[(k + 1) % corners.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ang = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    gb.box(0.18, 0.42, len, 0xffffff, { ch: 'sushi', uvMode: 'geo', ...xy(F, mx, mz), y: y0 + h - 0.21, ry: rot + ang });
    guaLuo(gb, F, a[0], a[1], b[0], b[1], y0 + h - 0.45, P.zhu);
    // 南面留出入口
    const isFront = mz > r * 0.6;
    if (bench && !isFront) railing(gb, F, a[0], a[1], b[0], b[1], y0, { h: 0.52, bench: true });
  }
  roof(gb, {
    x, z, rot, y: y0 + h, w: w, d: w, h: Math.max(2.4, r * 0.95),
    type: 'zanjian', rank, eave: 1.35, ch: 'tile', color: P.tongwa, zanSides: sides,
  });
  if (name) plaqueBoard(gb, F, name, 0, y0 + h - 0.75, r + 0.6, Math.min(2.4, r * 0.8), Math.min(0.85, r * 0.3));
  if (couplet) {
    coupletBoard(gb, F, couplet[0], -r + 0.1, y0 + h * 0.5, r + 0.25, 0.42, h * 0.66);
    coupletBoard(gb, F, couplet[1], r - 0.1, y0 + h * 0.5, r + 0.25, 0.42, h * 0.66);
  }
}

// ---------------------------------------------------------------- 牌坊（玉石牌坊）
export function pailou(gb, o) {
  const { x, z, rot = 0, w = 12, h = 8, name = '省親別墅' } = o;
  const F = frame(x, z, rot);
  const gz = groundHeight(x, z);
  const cols = [-w / 2, -w / 6, w / 6, w / 2];
  for (const lx of cols) {
    gb.box(0.8, h, 0.8, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, 0), y: gz + h / 2, ry: rot });
    gb.box(1.5, 0.5, 1.5, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, 0), y: gz + 0.25, ry: rot });
    // 夾杆石
    for (const sz of [-1, 1]) {
      gb.box(0.7, 1.7, 0.5, P.hanbaiyu, { ch: 'stone', ...xy(F, lx, sz * 0.7), y: gz + 0.85, ry: rot });
    }
    const [cx, cz] = F.p(lx, 0);
    addCollider(cx - 0.7, cz - 0.7, cx + 0.7, cz + 0.7);
  }
  // 額枋三道
  for (const yy of [h * 0.62, h * 0.78]) {
    gb.box(w + 1.4, 0.5, 0.6, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, 0), y: gz + yy, ry: rot });
  }
  // 明間字板
  gb.box(w / 3 + 0.6, 1.5, 0.5, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, 0), y: gz + h * 0.70, ry: rot });
  plaqueBoard(gb, F, name, 0, gz + h * 0.70, 0.32, w / 3 - 0.2, 1.1);
  // 雲板 / 小樓頂
  const tops = [[0, w / 3 + 1.2, 1.5], [-w / 3 - 0.6, w / 3 - 0.4, 1.1], [w / 3 + 0.6, w / 3 - 0.4, 1.1]];
  for (const [lx, tw, th] of tops) {
    roof(gb, {
      x: F.p(lx, 0)[0], z: F.p(lx, 0)[1], rot, y: gz + h * (lx === 0 ? 0.86 : 0.80),
      w: tw, d: 1.9, h: th, type: 'xieshan', rank: 1, eave: 0.8, jian: true, ch: 'liuli', color: P.liuli,
    });
  }
}

// ---------------------------------------------------------------- 橋
export function bridge(gb, B, o = {}) {
  const { stone = true, rail = true, arch = true } = o;
  const [ax, az] = B.a, [bx, bz] = B.b;
  const len = Math.hypot(bx - ax, bz - az);
  const ang = Math.atan2(-(bx - ax), -(bz - az));
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const F = frame(mx, mz, ang);
  const n = 10;
  const col = stone ? P.hanbaiyu : P.woodLight;
  const ch = stone ? 'stone' : 'wood';
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const y0 = B.rise * Math.sin(Math.PI * t0), y1 = B.rise * Math.sin(Math.PI * t1);
    const lz0 = -len / 2 + len * t0, lz1 = -len / 2 + len * t1;
    const segLen = Math.hypot(lz1 - lz0, y1 - y0);
    gb.box(B.w, 0.3, segLen + 0.06, col, {
      ch, ...xy(F, 0, (lz0 + lz1) / 2), y: (y0 + y1) / 2 - 0.15, ry: ang,
      rx: -Math.atan2(y1 - y0, lz1 - lz0), order: 'YXZ',
    });
  }
  // 拱券
  if (arch && stone) {
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * i / 14;
      const lz = -len * 0.34 * Math.cos(a);
      const yy = B.rise * 0.95 * Math.sin(a) - 0.5;
      gb.box(B.w + 0.2, 0.34, 0.42, col, { ch, ...xy(F, 0, lz), y: yy, ry: ang, rx: a - Math.PI / 2, order: 'YXZ' });
    }
  }
  if (rail) {
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const y0 = B.rise * Math.sin(Math.PI * t0), y1 = B.rise * Math.sin(Math.PI * t1);
      for (const sx of [-1, 1]) {
        railing(gb, F, sx * B.w / 2, -len / 2 + len * t0, sx * B.w / 2, -len / 2 + len * t1,
          (y0 + y1) / 2, { stone, h: 0.85, color: P.zhu });
      }
    }
  }
}

// ---------------------------------------------------------------- 假山 / 峰石
export function rockery(gb, x, z, scale = 1, seed = 1) {
  const rnd = mulberry(seed);
  const gz = groundHeight(x, z);
  // 太湖石贵在瘦、皱：用高低参差、各向不等的块面叠，而不是堆一窝圆球
  const n = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const rr = Math.sqrt(rnd()) * 2.4 * scale;
    const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    const s = (0.55 + rnd() * 1.0) * Math.min(scale, 1.9);
    const tall = 1.0 + rnd() * 1.7;
    gb.bake(PRIM.sphere, P.taihu, {
      ch: 'rock', x: px, y: gz + s * tall * 0.46, z: pz,
      sx: s * (1.1 + rnd() * 0.7), sy: s * tall, sz: s * (0.8 + rnd() * 0.7),
      rx: (rnd() - 0.5) * 0.5, ry: rnd() * TAU, rz: (rnd() - 0.5) * 0.6,
    });
  }
  // 主峰：一柱擎起，上端略向外挑
  const hPk = (2.4 + rnd() * 1.8) * Math.min(scale, 1.7);
  gb.bake(PRIM.sphere, P.taihu, {
    ch: 'rock', x, y: gz + hPk * 0.44, z, sx: 1.7 * scale, sy: hPk, sz: 1.35 * scale, rz: 0.12, ry: rnd() * TAU,
  });
  gb.bake(PRIM.sphere, P.taihu, {
    ch: 'rock', x: x + 0.5 * scale, y: gz + hPk * 0.86, z: z - 0.25 * scale,
    sx: 1.25 * scale, sy: hPk * 0.46, sz: 1.0 * scale, rz: -0.4, ry: rnd() * TAU,
  });
  addCollider(x - 2.2 * scale, z - 2.2 * scale, x + 2.2 * scale, z + 2.2 * scale);
}

export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
