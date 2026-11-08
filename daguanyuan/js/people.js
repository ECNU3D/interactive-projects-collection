// 府中人物：環境 NPC（丫鬟、婆子、小廝、管事、匠人、小道士）自由活動 + 主要人物定位
import * as THREE from 'three';
import { P } from './palette.js';
import { groundHeight } from './layout.js';
import { buildNav, navOk, navH, navStep, navSnap, navResolve } from './nav.js';
import { mulberry } from './parts.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- 人形幾何
function mergeParts(parts) {
  let vc = 0, ic = 0;
  for (const p of parts) { vc += p.geo.attributes.position.count; ic += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), col = new Float32Array(vc * 3);
  const idx = new Uint16Array(ic);
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  const c = new THREE.Color();
  let vo = 0, io = 0;
  for (const p of parts) {
    m.compose(
      new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0)),
      new THREE.Vector3(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1)
    );
    nm.getNormalMatrix(m);
    c.set(p.color);
    const ap = p.geo.attributes.position, an = p.geo.attributes.normal;
    for (let i = 0; i < ap.count; i++) {
      v.fromBufferAttribute(ap, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      n.fromBufferAttribute(an, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z;
      col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b;
    }
    if (p.geo.index) {
      for (let i = 0; i < p.geo.index.count; i++) idx[io + i] = vo + p.geo.index.getX(i);
      io += p.geo.index.count;
    } else {
      for (let i = 0; i < ap.count; i++) idx[io + i] = vo + i;
      io += ap.count;
    }
    vo += ap.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const CONE = new THREE.ConeGeometry(0.5, 1, 8);
const SPH = new THREE.SphereGeometry(0.5, 8, 6);

/**
 * 一個人：清初旗漢雜糅的裝束
 * kind: 'nu'(女子·襖裙) | 'po'(婆子) | 'si'(小廝·短褐) | 'guan'(管事·長袍) | 'dao'(小道士) | 'gong'(匠人)
 */
export function personGeometry(kind, o = {}) {
  const {
    robe = P.qingduan, skirt = P.shuihong, trim = P.bai,
    skin = P.fu, hair = P.fa, h = 1.66,
  } = o;
  const parts = [];
  const female = kind === 'nu' || kind === 'po' || kind === 'zhu';
  const S = h / 1.66;

  if (female) {
    // 裙（下擺外張）
    parts.push({ geo: new THREE.CylinderGeometry(0.17, 0.30, 1, 10), color: skirt, y: 0.45 * S, sy: 0.9 * S, sx: 1, sz: 0.78 });
    // 襖（上衣）
    parts.push({ geo: CYL, color: robe, y: 1.10 * S, sx: 0.42, sy: 0.56 * S, sz: 0.32 });
    // 領緣
    parts.push({ geo: CYL, color: trim, y: 1.35 * S, sx: 0.30, sy: 0.07 * S, sz: 0.24 });
    // 袖
    for (const sx of [-1, 1]) {
      parts.push({ geo: CYL, color: robe, x: sx * 0.24, y: 1.06 * S, sx: 0.17, sy: 0.52 * S, sz: 0.17, rz: sx * 0.14 });
    }
    // 頭
    parts.push({ geo: SPH, color: skin, y: 1.50 * S, sx: 0.22, sy: 0.26 * S, sz: 0.21 });
    // 髮髻
    parts.push({ geo: SPH, color: hair, y: 1.58 * S, sx: 0.24, sy: 0.18 * S, sz: 0.23 });
    parts.push({ geo: SPH, color: hair, y: 1.66 * S, z: -0.06, sx: 0.15, sy: 0.14 * S, sz: 0.15 });
    if (kind === 'zhu') {
      // 主子：披風與簪
      parts.push({ geo: CYL, color: o.cape ?? P.hongsha, y: 1.02 * S, z: -0.05, sx: 0.50, sy: 0.72 * S, sz: 0.36 });
      parts.push({ geo: BOX, color: P.jin, y: 1.68 * S, x: 0.13, sx: 0.05, sy: 0.05, sz: 0.16 });
    }
  } else if (kind === 'dao') {
    parts.push({ geo: new THREE.CylinderGeometry(0.19, 0.30, 1, 10), color: robe, y: 0.62 * S, sy: 1.24 * S });
    parts.push({ geo: CYL, color: trim, y: 1.14 * S, sx: 0.30, sy: 0.06 * S, sz: 0.28 });
    parts.push({ geo: SPH, color: skin, y: 1.50 * S, sx: 0.22, sy: 0.26 * S, sz: 0.21 });
    parts.push({ geo: CYL, color: hair, y: 1.63 * S, sx: 0.16, sy: 0.14 * S, sz: 0.16 });
    parts.push({ geo: BOX, color: P.woodDark, y: 1.70 * S, sx: 0.10, sy: 0.10, sz: 0.10 });
  } else if (kind === 'guan') {
    // 長袍馬褂
    parts.push({ geo: new THREE.CylinderGeometry(0.20, 0.28, 1, 10), color: robe, y: 0.64 * S, sy: 1.28 * S });
    parts.push({ geo: CYL, color: o.gua ?? P.shenqing, y: 1.10 * S, sx: 0.48, sy: 0.52 * S, sz: 0.40 });
    for (const sx of [-1, 1]) {
      parts.push({ geo: CYL, color: o.gua ?? P.shenqing, x: sx * 0.25, y: 1.04 * S, sx: 0.17, sy: 0.5 * S, sz: 0.17, rz: sx * 0.1 });
    }
    parts.push({ geo: SPH, color: skin, y: 1.50 * S, sx: 0.22, sy: 0.26 * S, sz: 0.21 });
    // 瓜皮小帽
    parts.push({ geo: SPH, color: P.fa, y: 1.60 * S, sx: 0.24, sy: 0.18 * S, sz: 0.24 });
    parts.push({ geo: SPH, color: P.zhu, y: 1.70 * S, sx: 0.06, sy: 0.06, sz: 0.06 });
  } else {
    // 小廝／匠人：短褐 + 褲
    for (const sx of [-1, 1]) {
      parts.push({ geo: CYL, color: o.pants ?? P.zibu, x: sx * 0.10, y: 0.36 * S, sx: 0.17, sy: 0.72 * S, sz: 0.17 });
    }
    parts.push({ geo: CYL, color: robe, y: 1.02 * S, sx: 0.44, sy: 0.66 * S, sz: 0.34 });
    parts.push({ geo: BOX, color: trim, y: 0.74 * S, sx: 0.46, sy: 0.09, sz: 0.36 });
    for (const sx of [-1, 1]) {
      parts.push({ geo: CYL, color: robe, x: sx * 0.25, y: 1.02 * S, sx: 0.15, sy: 0.5 * S, sz: 0.15, rz: sx * 0.16 });
    }
    parts.push({ geo: SPH, color: skin, y: 1.44 * S, sx: 0.21, sy: 0.25 * S, sz: 0.20 });
    parts.push({ geo: SPH, color: hair, y: 1.53 * S, sx: 0.22, sy: 0.14 * S, sz: 0.22 });
    // 辮子
    parts.push({ geo: CYL, color: hair, y: 1.30 * S, z: -0.18, sx: 0.06, sy: 0.5 * S, sz: 0.06, rx: 0.2 });
  }
  return mergeParts(parts);
}

// ---------------------------------------------------------------- 環境 NPC
// 每組一個 InstancedMesh；同組共用一種裝束
const GROUPS = [
  { key: 'yahuan', kind: 'nu', o: { robe: 0x35566b, skirt: 0xd8909a }, n: 34 },
  { key: 'yahuan2', kind: 'nu', o: { robe: 0x5a7d6c, skirt: 0xd6c98e }, n: 26 },
  { key: 'pozi', kind: 'po', o: { robe: 0x3b4550, skirt: 0x5a5f52, hair: 0x6a6a66 }, n: 24 },
  { key: 'xiaosi', kind: 'si', o: { robe: 0x5a6570, pants: 0x4a5058 }, n: 30 },
  { key: 'guanshi', kind: 'guan', o: { robe: 0x6a5c48, gua: 0x33404e }, n: 14 },
  { key: 'jiangren', kind: 'gong', o: { robe: 0x7a6a4c, pants: 0x5a5040 }, n: 12 },
  { key: 'daoshi', kind: 'dao', o: { robe: 0x5b6a70, trim: 0xd8d2c0 }, n: 6 },
];

// 活動區：[x, z, 半徑, 權重]
const HAUNTS = [
  [-91.2, -20, 16, 3], [-91.2, -60, 14, 3], [-91.2, -110, 12, 2], [-91.2, -145, 14, 3],
  [-147, -85, 18, 4], [-151, -145, 12, 2], [-37, -55, 16, 2], [-38, -184, 10, 1],
  [-98, -184, 22, 3], [-118, -145, 8, 2], [-160, -25, 12, 1],
  [91.2, -20, 16, 2], [91.2, -60, 14, 2], [91.2, -155, 14, 2], [38, -48, 16, 2],
  [146, -50, 14, 2], [144, -105, 12, 2], [34, -180, 14, 1],
  [0, -180, 10, 2],
  [-20, -222, 12, 2], [-20, -288, 14, 2], [-119, -312, 12, 3], [126, -328, 14, 4],
  [-96, -398, 11, 2], [28, -504, 12, 2], [-134, -478, 13, 2], [102, -444, 11, 2],
  [145, -496, 10, 1], [-156, -558, 10, 1], [34, -434, 10, 2], [0, -620, 16, 2],
  [-64, -628, 9, 1], [152, -768, 10, 1], [150, -252, 10, 1], [-144, -432, 8, 1],
];

export class Crowd {
  constructor(scene) {
    this.groups = [];
    const rnd = mulberry(20260808);
    const pool = [];
    for (const h of HAUNTS) for (let k = 0; k < h[3]; k++) pool.push(h);

    for (const G of GROUPS) {
      const geo = personGeometry(G.kind, G.o);
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.InstancedMesh(geo, mat, G.n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
      const agents = [];
      for (let i = 0; i < G.n; i++) {
        const h = pool[(rnd() * pool.length) | 0];
        const a = rnd() * TAU, rr = Math.sqrt(rnd()) * h[2];
        const snapped = navResolve(...(navSnap(h[0] + Math.cos(a) * rr, h[1] + Math.sin(a) * rr, 12)
          ?? navSnap(h[0], h[1], 16) ?? [h[0], h[1]]), 0.55);
        const x = snapped[0], z = snapped[1];
        agents.push({
          hx: h[0], hz: h[1], hr: h[2],
          x, z, tx: x, tz: z,
          yaw: rnd() * TAU, spd: 0.85 + rnd() * 0.7, gy: 0, dirty: true,
          wait: rnd() * 5, phase: rnd() * TAU, s: 0.94 + rnd() * 0.12,
        });
      }
      this.groups.push({ mesh, agents });
    }
    this._retarget = (a, r) => {
      for (let k = 0; k < 8; k++) {
        const ang = r() * TAU, rr = Math.sqrt(r()) * a.hr;
        const tx = a.hx + Math.cos(ang) * rr, tz = a.hz + Math.sin(ang) * rr;
        if (navOk(tx, tz)) { a.tx = tx; a.tz = tz; return; }
      }
      a.tx = a.x; a.tz = a.z;
    };
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.rnd = rnd;
  }

  update(dt, t, playerPos) {
    const rnd = this.rnd;
    for (const g of this.groups) {
      const { mesh, agents } = g;
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        // 遠處不必精算
        const far = Math.abs(a.x - playerPos.x) > 170 || Math.abs(a.z - playerPos.z) > 170;
        if (!far) {
          if (a.wait > 0) {
            a.wait -= dt;
          } else {
            const dx = a.tx - a.x, dz = a.tz - a.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.5) {
              a.tx = a.hx; a.tz = a.hz;
              this._retarget(a, rnd);
              a.wait = rnd() < 0.42 ? 1.5 + rnd() * 6 : 0;
            } else {
              const nx = a.x + dx / d * a.spd * dt;
              const nz = a.z + dz / d * a.spd * dt;
              if (navStep(a.x, a.z, nx, nz)) {
                a.x = nx; a.z = nz; a.dirty = true;
                a.yaw = Math.atan2(dx, dz) + Math.PI;
              } else if (navStep(a.x, a.z, nx, a.z)) {      // 貼牆滑行，不硬穿
                a.x = nx; a.dirty = true;
                a.yaw = Math.atan2(dx, 0) + Math.PI;
              } else if (navStep(a.x, a.z, a.x, nz)) {
                a.z = nz; a.dirty = true;
                a.yaw = Math.atan2(0, dz) + Math.PI;
              } else {
                this._retarget(a, rnd);                      // 撞死角就換個去處
                a.wait = 0.4 + rnd() * 1.2;
              }
              // 栅格只有 1.5m，贴墙时再精确推出去一次
              const res = navResolve(a.x, a.z, 0.55);
              if (res[0] !== a.x || res[1] !== a.z) { a.x = res[0]; a.z = res[1]; a.dirty = true; }
            }
          }
        }
        if (a.dirty) { a.gy = navH(a.x, a.z); a.dirty = false; }
        const gy = a.gy;
        const moving = a.wait <= 0;
        const bob = moving ? Math.sin(t * 6.5 + a.phase) * 0.024 : Math.sin(t * 1.1 + a.phase) * 0.008;
        this._p.set(a.x, gy + bob, a.z);
        this._e.set(0, a.yaw, moving ? Math.sin(t * 6.5 + a.phase) * 0.035 : 0);
        this._q.setFromEuler(this._e);
        this._s.set(a.s, a.s, a.s);
        this._m.compose(this._p, this._q, this._s);
        mesh.setMatrixAt(i, this._m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------- 主要人物
// 時序：第二十三回之後（姊妹已入園）、第五十四回之前。秦可卿卒於第十三回，故不列。
export const FIGURES = [
  { id: 'jiamu_ren', name: '贾母', x: -147, z: -98, yaw: 0, kind: 'zhu',
    o: { robe: 0x5a4a6a, skirt: 0x7a6a8c, cape: 0x8a4a52, hair: 0x9a9a96, h: 1.58 } },
  { id: 'wangfuren', name: '王夫人', x: -60, z: -145, yaw: 0.4, kind: 'zhu',
    o: { robe: 0x4a5a6a, skirt: 0x8a8a7c, cape: 0x5a6a7a, h: 1.62 } },
  { id: 'fengjie_ren', name: '王熙凤', x: -151, z: -150, yaw: 0.2, kind: 'zhu',
    o: { robe: 0x9d3a2b, skirt: 0xc06a5a, cape: 0xb8474f, h: 1.64 } },
  { id: 'jiazheng', name: '贾政', x: -44, z: -122, yaw: 0, kind: 'guan',
    o: { robe: 0x3a4a5a, gua: 0x2a3440, h: 1.72 } },
  { id: 'baoyu', name: '贾宝玉', x: 126, z: -330, yaw: 0.3, kind: 'guan',
    o: { robe: 0xb8474f, gua: 0x9d3a2b, h: 1.66 } },
  { id: 'daiyu', name: '林黛玉', x: -119, z: -322, yaw: -0.2, kind: 'zhu',
    o: { robe: 0x6a8090, skirt: 0xd8d2c8, cape: 0x8fa7a4, h: 1.60 } },
  { id: 'baochai', name: '薛宝钗', x: 28, z: -512, yaw: 0.1, kind: 'zhu',
    o: { robe: 0xc9a86a, skirt: 0xe0d8c0, cape: 0xd8b878, h: 1.62 } },
  { id: 'tanchun', name: '贾探春', x: -96, z: -406, yaw: 0, kind: 'zhu',
    o: { robe: 0x4a7a6a, skirt: 0xc8d0b8, cape: 0x5a8a72, h: 1.64 } },
  { id: 'xiangyun', name: '史湘云', x: 34, z: -434, yaw: 0.5, kind: 'zhu',
    o: { robe: 0x7a9ab8, skirt: 0xd8c8a8, cape: 0x9ab0c8, h: 1.61 } },
  { id: 'liwan', name: '李纨', x: -134, z: -490, yaw: 0, kind: 'zhu',
    o: { robe: 0x6a7060, skirt: 0xc0c2b0, cape: 0x8a9080, h: 1.62 } },
  { id: 'yingxi', name: '贾迎春', x: 102, z: -452, yaw: 0, kind: 'zhu',
    o: { robe: 0x8a8aa0, skirt: 0xd0d0c0, cape: 0xa0a0b0, h: 1.61 } },
  { id: 'yingxi2', name: '贾惜春', x: 145, z: -502, yaw: 0, kind: 'nu', narr: 'yingxi',
    o: { robe: 0x6a7a8a, skirt: 0xc8ccc0, h: 1.50 } },
  { id: 'miaoyu', name: '妙玉', x: -156, z: -568, yaw: 0, kind: 'dao',
    o: { robe: 0xd8d4c8, trim: 0x8a9a9a, h: 1.62 } },
  { id: 'xiren', name: '袭人', x: 121, z: -334, yaw: 0.8, kind: 'nu',
    o: { robe: 0x9a7a8a, skirt: 0xd8b8c0, h: 1.60 } },
  { id: 'xiren2', name: '晴雯', x: 131, z: -332, yaw: -0.6, kind: 'nu', narr: 'xiren',
    o: { robe: 0x5a8a8a, skirt: 0xc8d8d0, h: 1.61 } },
  { id: 'pinger', name: '平儿', x: -155, z: -146, yaw: 0.6, kind: 'nu', narr: 'fengjie_ren',
    o: { robe: 0x8a7a6a, skirt: 0xd0c0a8, h: 1.61 } },
  { id: 'yuanyang', name: '鸳鸯', x: -143, z: -96, yaw: -0.4, kind: 'nu', narr: 'jiamu_ren',
    o: { robe: 0x6a6a8a, skirt: 0xc0c0d0, h: 1.60 } },
  { id: 'zijuan', name: '紫鹃', x: -115, z: -320, yaw: 0.5, kind: 'nu', narr: 'daiyu',
    o: { robe: 0x7a8a6a, skirt: 0xc8d0b0, h: 1.59 } },
];

export class Figures {
  constructor(scene) {
    this.list = [];
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const f of FIGURES) {
      const geo = personGeometry(f.kind, f.o);
      const mesh = new THREE.Mesh(geo, mat);
      const sp = navSnap(f.x, f.z, 6);
      if (sp) { const r2 = navResolve(sp[0], sp[1], 0.55); f.x = r2[0]; f.z = r2[1]; }
      const gy = navH(f.x, f.z);
      mesh.position.set(f.x, gy, f.z);
      mesh.rotation.y = f.yaw;
      scene.add(mesh);
      this.list.push({ ...f, mesh, base: gy, phase: Math.random() * TAU, narr: f.narr ?? f.id });
    }
    this.nameEl = document.getElementById('npc-name');
    this.near = null;
  }

  update(dt, t, playerPos) {
    let best = null, bd = 7.5;
    for (const f of this.list) {
      f.mesh.position.y = f.base + Math.sin(t * 0.9 + f.phase) * 0.012;
      f.mesh.rotation.y = f.yaw + Math.sin(t * 0.5 + f.phase) * 0.10;
      const d = Math.hypot(f.x - playerPos.x, f.z - playerPos.z);
      if (d < bd) { bd = d; best = f; }
    }
    if (best !== this.near) {
      this.near = best;
      if (best) {
        this.nameEl.textContent = best.name;
        this.nameEl.classList.remove('hidden');
        this.onNear?.(best);
      } else {
        this.nameEl.classList.add('hidden');
      }
    }
  }
}
