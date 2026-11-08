// GeoBuilder —— 多材质通道合并 + 三向映射 UV + 按 X 分块（距离裁剪用）
import * as THREE from 'three';
import { channelMaterial } from './materials.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _nm = new THREE.Matrix3();

// 贴图通道的亮度补偿（贴图均值 <1，顶点色相应提亮以保持原调）
const BOOST = {
  flat: 1.0, tile: 1.38, thatch: 1.28, wood: 1.3, plaster: 1.14,
  earthwall: 1.22, brick: 1.24, reed: 1.28, lattice: 1.15, silk: 1.0,
};
// 各通道默认三向映射密度（每世界单位重复次数）
const TEXSCALE = {
  tile: 0.55, thatch: 0.5, wood: 0.42, plaster: 0.24, earthwall: 0.14,
  brick: 0.3, reed: 0.55, lattice: 0.5, silk: 0.6, flat: 0.3,
};

// 距离裁剪登记表（main.js 每帧按玩家 x 剔除）
export const cullables = [];

export class GeoBuilder {
  constructor() {
    this.channels = {};
  }

  _ch(name) {
    if (!this.channels[name]) {
      this.channels[name] = { pos: [], nor: [], col: [], uv: [], wind: [], idx: [], vcount: 0 };
    }
    return this.channels[name];
  }

  // 通用：烘入一个 three 几何体
  bake(geometry, color, opts = {}) {
    const {
      x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1,
      wind = 0, windFn = null, ch = 'flat', texScale = null,
    } = opts;
    const C = this._ch(ch);
    const ts = texScale ?? TEXSCALE[ch] ?? 0.3;
    const boost = BOOST[ch] ?? 1;

    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _n.set(sx, sy, sz));
    _nm.getNormalMatrix(_m);
    _c.set(color);
    const cr = Math.min(1, _c.r * boost), cg = Math.min(1, _c.g * boost), cb = Math.min(1, _c.b * boost);

    const p = geometry.attributes.position;
    const nrm = geometry.attributes.normal;
    const base = C.vcount;
    const lp = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      lp.fromBufferAttribute(p, i);
      const w = windFn ? windFn(lp.x, lp.y, lp.z) : wind;
      _v.copy(lp).applyMatrix4(_m);
      C.pos.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(nrm, i).applyMatrix3(_nm).normalize();
      C.nor.push(_n.x, _n.y, _n.z);
      C.col.push(cr, cg, cb);
      C.wind.push(w);
      // 三向映射 UV（世界坐标）
      const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
      if (ay >= ax && ay >= az) C.uv.push(_v.x * ts, _v.z * ts);
      else if (ax >= az) C.uv.push(_v.z * ts, _v.y * ts);
      else C.uv.push(_v.x * ts, _v.y * ts);
    }
    if (geometry.index) {
      const ind = geometry.index;
      for (let i = 0; i < ind.count; i++) C.idx.push(base + ind.getX(i));
    } else {
      for (let i = 0; i < p.count; i++) C.idx.push(base + i);
    }
    C.vcount += p.count;
    return this;
  }

  box(w, h, d, color, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    this.bake(g, color, opts);
    g.dispose();
    return this;
  }

  cyl(rt, rb, h, color, opts = {}) {
    const seg = opts.seg || 7;
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts.open);
    this.bake(g, color, opts);
    g.dispose();
    return this;
  }

  cone(r, h, color, opts = {}) {
    const seg = opts.seg || 7;
    const g = new THREE.ConeGeometry(r, h, seg);
    this.bake(g, color, opts);
    g.dispose();
    return this;
  }

  sphere(r, color, opts = {}) {
    const g = new THREE.SphereGeometry(r, opts.w || 7, opts.h || 5);
    this.bake(g, color, opts);
    g.dispose();
    return this;
  }

  plane(w, h, color, opts = {}) {
    const g = new THREE.PlaneGeometry(w, h, opts.segw || 1, opts.segh || 1);
    this.bake(g, color, opts);
    g.dispose();
    return this;
  }

  // 网格面片：fn(i,j) => [x,y,z] 局部坐标
  grid(rows, cols, fn, color, opts = {}) {
    const {
      x = 0, y = 0, z = 0, ry = 0, wind = 0, windFn = null, doubleSide = false,
      ch = 'flat', uvRepeat = null, texScale = null,
    } = opts;
    const C = this._ch(ch);
    const boost = BOOST[ch] ?? 1;
    const ts = texScale ?? TEXSCALE[ch] ?? 0.3;

    _e.set(0, ry, 0);
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _n.set(1, 1, 1));
    _nm.getNormalMatrix(_m);
    _c.set(color);
    const cr = Math.min(1, _c.r * boost), cg = Math.min(1, _c.g * boost), cb = Math.min(1, _c.b * boost);

    const base = C.vcount;
    const verts = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const [px, py, pz] = fn(i, j);
        verts.push(px, py, pz);
      }
    }
    const nrm = new Array(verts.length).fill(0);
    const at = (i, j) => {
      const k = (i * cols + j) * 3;
      return [verts[k], verts[k + 1], verts[k + 2]];
    };
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const i2 = Math.min(i + 1, rows - 1), i1 = Math.max(i - 1, 0);
        const j2 = Math.min(j + 1, cols - 1), j1 = Math.max(j - 1, 0);
        const a = at(i2, j), b = at(i1, j), c = at(i, j2), d = at(i, j1);
        const du = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const dv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
        const k = (i * cols + j) * 3;
        nrm[k]     = du[1] * dv[2] - du[2] * dv[1];
        nrm[k + 1] = du[2] * dv[0] - du[0] * dv[2];
        nrm[k + 2] = du[0] * dv[1] - du[1] * dv[0];
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const k = (i * cols + j) * 3;
        const w = windFn ? windFn(verts[k], verts[k + 1], verts[k + 2]) : wind;
        _v.set(verts[k], verts[k + 1], verts[k + 2]).applyMatrix4(_m);
        C.pos.push(_v.x, _v.y, _v.z);
        _n.set(nrm[k], nrm[k + 1], nrm[k + 2]).applyMatrix3(_nm).normalize();
        C.nor.push(_n.x, _n.y, _n.z);
        C.col.push(cr, cg, cb);
        C.wind.push(w);
        if (uvRepeat) {
          C.uv.push(j / (cols - 1) * uvRepeat[0], i / (rows - 1) * uvRepeat[1]);
        } else {
          const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
          if (ay >= ax && ay >= az) C.uv.push(_v.x * ts, _v.z * ts);
          else if (ax >= az) C.uv.push(_v.z * ts, _v.y * ts);
          else C.uv.push(_v.x * ts, _v.y * ts);
        }
      }
    }
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = base + i * cols + j;
        const b = a + 1;
        const c2 = a + cols;
        const d = c2 + 1;
        C.idx.push(a, c2, b, b, c2, d);
        if (doubleSide) C.idx.push(a, b, c2, b, d, c2);
      }
    }
    C.vcount += rows * cols;
    return this;
  }

  /* 生成网格组。
     opts.chunks: 按 X 分块以便距离裁剪（默认 true，静态大世界用）
     opts.cull:   登记到 cullables（默认同 chunks）
     opts.shadows: 投影/接影 */
  buildMeshes(opts = {}) {
    const { chunks = true, cull = chunks, shadows = true, name = '' } = opts;
    const BOUNDS = [300, 490, 660];   // 画卷分段线
    const group = new THREE.Group();
    group.name = name;

    for (const chName of Object.keys(this.channels)) {
      const C = this.channels[chName];
      if (!C.vcount) continue;
      const binOf = (cx2) => {
        for (let b = 0; b < BOUNDS.length; b++) if (cx2 < BOUNDS[b]) return b;
        return BOUNDS.length;
      };
      const nBins = chunks ? BOUNDS.length + 1 : 1;
      const bins = Array.from({ length: nBins }, () => ({ map: new Map(), pos: [], nor: [], col: [], uv: [], wind: [], idx: [], x0: Infinity, x1: -Infinity }));

      for (let t = 0; t < C.idx.length; t += 3) {
        const ia = C.idx[t], ib = C.idx[t + 1], ic = C.idx[t + 2];
        const cx2 = (C.pos[ia * 3] + C.pos[ib * 3] + C.pos[ic * 3]) / 3;
        const bin = bins[chunks ? binOf(cx2) : 0];
        for (const vi of [ia, ib, ic]) {
          let ni = bin.map.get(vi);
          if (ni === undefined) {
            ni = bin.pos.length / 3;
            bin.map.set(vi, ni);
            const px = C.pos[vi * 3];
            bin.pos.push(px, C.pos[vi * 3 + 1], C.pos[vi * 3 + 2]);
            bin.nor.push(C.nor[vi * 3], C.nor[vi * 3 + 1], C.nor[vi * 3 + 2]);
            bin.col.push(C.col[vi * 3], C.col[vi * 3 + 1], C.col[vi * 3 + 2]);
            bin.uv.push(C.uv[vi * 2], C.uv[vi * 2 + 1]);
            bin.wind.push(C.wind[vi]);
            if (px < bin.x0) bin.x0 = px;
            if (px > bin.x1) bin.x1 = px;
          }
          bin.idx.push(ni);
        }
      }

      for (const bin of bins) {
        if (!bin.idx.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(bin.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(bin.nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(bin.col, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(bin.uv, 2));
        g.setAttribute('aWind', new THREE.Float32BufferAttribute(bin.wind, 1));
        g.setIndex(bin.idx);
        const mesh = new THREE.Mesh(g, channelMaterial(chName));
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
        mesh.userData.x0 = bin.x0;
        mesh.userData.x1 = bin.x1;
        group.add(mesh);
        if (cull) cullables.push(mesh);
      }
    }
    return group;
  }
}

/* ---------- 宋式屋顶 ---------- */
export function roof(gb, opts) {
  const {
    x = 0, y = 0, z = 0, w = 6, l = 8, rise = 2.2,
    overhang = 1.0, lift = 0.55, ry = 0,
    color, ridgeColor, type = 'gable', ridgeLen = null,
    thatch = false, ornate = false,
  } = opts;
  const ch = thatch ? 'thatch' : 'tile';
  const halfW = w / 2 + overhang;
  const rl = ridgeLen !== null ? ridgeLen : (type === 'gable' ? l / 2 + overhang * 0.7 : l * 0.28);
  const halfL = l / 2 + overhang;
  const ROWS = 5, COLS = 9;
  const uRep = (l + overhang * 2) * 0.5;      // 瓦垄沿脊向重复
  const vRep = halfW * 0.5;

  for (const side of [1, -1]) {
    gb.grid(ROWS, COLS, (i, j) => {
      const t = i / (ROWS - 1);
      const u = j / (COLS - 1) * 2 - 1;
      const xr = type === 'gable'
        ? u * (l / 2 + overhang * 0.7)
        : u * (rl + (halfL - rl) * t);
      const sag = Math.pow(t, 0.72);
      const edge = Math.pow(Math.abs(u), 3);
      const py = rise * (1 - sag) + lift * edge * t + lift * 0.7 * Math.pow(t, 3);
      const pz = side * halfW * t;
      return [xr, py, pz];
    }, color, { x, y, z, ry, doubleSide: true, ch, uvRepeat: [uRep, vRep] });
  }
  if (type !== 'gable') {
    for (const side of [1, -1]) {
      gb.grid(ROWS, 7, (i, j) => {
        const t = i / (ROWS - 1);
        const u = j / 6 * 2 - 1;
        const zr = u * halfW * t;
        const sag = Math.pow(t, 0.72);
        const edge = Math.pow(Math.abs(u), 3);
        const py = rise * (1 - sag) + lift * edge * t + lift * 0.7 * Math.pow(t, 3);
        const px = side * (rl + (halfL - rl) * t);
        return [px, py, zr];
      }, color, { x, y, z, ry, doubleSide: true, ch, uvRepeat: [w * 0.5, vRep] });
    }
  } else {
    for (const side of [1, -1]) {
      const gx = side * (l / 2 + overhang * 0.7);
      gb.grid(2, 2, (i, j) => {
        const t = i;
        const zz = (j * 2 - 1) * halfW * (t === 0 ? 0.02 : 1);
        return [gx, t === 0 ? rise : 0, zz];
      }, ridgeColor || color, { x, y, z, ry, doubleSide: true, ch: thatch ? 'thatch' : 'wood' });
    }
  }
  // 正脊
  const rlen = type === 'gable' ? l + overhang * 1.4 : rl * 2;
  gb.box(rlen, rise * 0.14 + 0.12, 0.34, ridgeColor || color, { x, y: y + rise, z, ry, ch: thatch ? 'thatch' : 'flat' });
  // 鸱吻（双段上勾）
  if (!thatch) {
    const chi = rise * 0.22 + 0.18;
    for (const side of [1, -1]) {
      const lx = Math.cos(ry) * side * rlen / 2;
      const lz = -Math.sin(ry) * side * rlen / 2;
      gb.box(0.3, chi, 0.4, ridgeColor || color, { x: x + lx, y: y + rise + chi / 2, z: z + lz, ry });
      gb.box(0.18, chi * 0.6, 0.26, ridgeColor || color, {
        x: x + lx - Math.cos(ry) * side * 0.14, y: y + rise + chi + chi * 0.2, z: z + lz + Math.sin(ry) * side * 0.14, ry, rz: side * 0.35,
      });
    }
  }
  // 山面装饰（宋式小木作：博风板、悬鱼、惹草；仅悬山大屋顶用）
  if (type === 'gable' && ornate) {
    const gx = l / 2 + overhang * 0.7 + 0.06;    // 山面檩端（外挑少许，免与山花面片共面）
    const L2 = Math.hypot(halfW, rise);
    const py = halfW / L2, pz = rise / L2;      // 博风板宽向（垂直于坡面）
    const boardC = 0x7a4632, fishC = 0x8a4a34;
    for (const ex of [1, -1]) {
      // 博风板（沿山坡两檐）
      for (const sz of [1, -1]) {
        gb.grid(3, 2, (i, j) => {
          const t = i / 2;
          return [
            ex * gx,
            rise * (1 - t) + 0.05 + (j - 0.5) * 0.34 * py,
            sz * (halfW * t + (j - 0.5) * 0.34 * pz),
          ];
        }, boardC, { x, y, z, ry, doubleSide: true, ch: 'flat' });
      }
      // 悬鱼（山尖下垂叶形）
      gb.grid(3, 2, (i, j) => {
        const ww = [0.02, 0.17, 0.06][i];
        return [ex * gx, rise - 0.08 - i * 0.36, (j * 2 - 1) * ww];
      }, fishC, { x, y, z, ry, doubleSide: true, ch: 'flat' });
      // 惹草（悬鱼两侧小草叶）
      for (const sz of [1, -1]) {
        gb.grid(3, 2, (i, j) => {
          const ww = [0.01, 0.08, 0.03][i];
          return [ex * gx, rise * 0.6 - i * 0.18, sz * 0.42 + (j * 2 - 1) * ww];
        }, boardC, { x, y, z, ry, doubleSide: true, ch: 'flat' });
      }
    }
  }
  return gb;
}

// 斗拱：柱头铺作（简化三跳）
export function dougong(gb, x, y, z, opts = {}) {
  const { ry = 0, s = 1, color = 0x9a5a40 } = opts;
  const dx = Math.cos(ry), dz = -Math.sin(ry);
  gb.box(0.34 * s, 0.16 * s, 0.34 * s, color, { x, y: y + 0.08 * s, z });
  gb.box(0.7 * s, 0.14 * s, 0.24 * s, color, { x, y: y + 0.23 * s, z, ry });
  gb.box(0.24 * s, 0.14 * s, 0.7 * s, color, { x, y: y + 0.23 * s, z, ry });
  gb.box(1.05 * s, 0.13 * s, 0.26 * s, color, { x, y: y + 0.38 * s, z, ry });
  gb.box(0.26 * s, 0.13 * s, 1.05 * s, vary2(color), { x, y: y + 0.38 * s, z, ry });
}

function vary2(hex) {
  const f = 0.94 + Math.random() * 0.12;
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

// 柱础（石鼓）
export function plinth(gb, x, z, opts = {}) {
  const { r = 0.26, y = 0 } = opts;
  gb.cyl(r * 0.8, r, 0.22, 0xb8b0a0, { x, y: y + 0.11, z, seg: 7 });
}
