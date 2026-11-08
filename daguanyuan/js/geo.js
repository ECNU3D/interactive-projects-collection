// GeoBuilder —— 多材質通道合併 + 三向映射／本地 UV + 按院落分塊（距離裁剪用）
import * as THREE from 'three';
import { channelMaterial, channelBoost, TEXSCALE } from './materials.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _nm = new THREE.Matrix3();

// 距離裁剪登記表（main.js 每幀按玩家位置剔除）
export const cullables = [];

// 共用基元（複用以省內存）
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  plane: new THREE.PlaneGeometry(1, 1),
  sphere: new THREE.SphereGeometry(0.5, 8, 5),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
};
export const PRIM = G;

export class GeoBuilder {
  constructor(name = '') {
    this.name = name;
    this.channels = {};
    this.minX = Infinity; this.maxX = -Infinity;
    this.minZ = Infinity; this.maxZ = -Infinity;
  }

  _ch(name) {
    if (!this.channels[name]) {
      this.channels[name] = { pos: [], nor: [], col: [], uv: [], wind: [], idx: [], vcount: 0 };
    }
    return this.channels[name];
  }

  /**
   * 烘入一個幾何體。
   * opts: x,y,z 位移；rx,ry,rz 歐拉旋轉；sx,sy,sz 縮放
   *       ch 材質通道；uvMode 'tri'(三向映射,默認) | 'geo'(用幾何自帶 UV)
   *       uvScale [u,v] 與 uvOffset [u,v]（uvMode='geo' 時生效）
   *       texScale 三向映射密度；wind/windFn 風擺強度
   */
  bake(geometry, color, opts = {}) {
    const {
      x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1,
      ch = 'flat', uvMode = 'tri', uvScale = [1, 1], uvOffset = [0, 0],
      texScale = null, wind = 0, windFn = null, order = 'XYZ',
    } = opts;
    const C = this._ch(ch);
    const ts = texScale ?? TEXSCALE[ch] ?? 0.3;
    const boost = channelBoost(ch);

    _e.set(rx, ry, rz, order);
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _n.set(sx, sy, sz));
    _nm.getNormalMatrix(_m);
    _c.set(color);
    const cr = Math.min(1, _c.r * boost), cg = Math.min(1, _c.g * boost), cb = Math.min(1, _c.b * boost);

    const p = geometry.attributes.position;
    const nrm = geometry.attributes.normal;
    const guv = geometry.attributes.uv;
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

      if (uvMode === 'geo' && guv) {
        C.uv.push(guv.getX(i) * uvScale[0] + uvOffset[0], guv.getY(i) * uvScale[1] + uvOffset[1]);
      } else {
        const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
        if (ay >= ax && ay >= az) C.uv.push(_v.x * ts, _v.z * ts);
        else if (ax >= az) C.uv.push(_v.z * ts, _v.y * ts);
        else C.uv.push(_v.x * ts, _v.y * ts);
      }

      if (_v.x < this.minX) this.minX = _v.x;
      if (_v.x > this.maxX) this.maxX = _v.x;
      if (_v.z < this.minZ) this.minZ = _v.z;
      if (_v.z > this.maxZ) this.maxZ = _v.z;
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

  // ---- 便捷基元 ----
  box(w, h, d, color, o = {}) {
    return this.bake(G.box, color, { ...o, sx: w, sy: h, sz: d });
  }
  cyl(rTop, rBot, h, color, o = {}) {
    const seg = o.seg === 6 ? G.cyl6 : o.seg === 12 ? G.cyl12 : G.cyl8;
    const g = (rTop === rBot)
      ? seg
      : new THREE.CylinderGeometry(rTop, rBot, 1, o.seg ?? 8);
    const r = Math.max(rTop, rBot) * 2;
    return this.bake(g, color, { ...o, sx: rTop === rBot ? rTop * 2 : 1, sy: h, sz: rTop === rBot ? rTop * 2 : 1 });
  }
  plane(w, h, color, o = {}) {
    return this.bake(G.plane, color, { ...o, sx: w, sy: h });
  }
  sphere(r, color, o = {}) {
    return this.bake(G.sphere, color, { ...o, sx: r * 2, sy: (o.sy ?? r) * 2, sz: r * 2 });
  }
  cone(r, h, color, o = {}) {
    return this.bake(G.cone, color, { ...o, sx: r * 2, sy: h, sz: r * 2 });
  }

  /** 任意四邊形（用於屋面、水岸、坡地） */
  quad(a, b, c, d, color, o = {}) {
    const ch = o.ch ?? 'flat';
    const C = this._ch(ch);
    const boost = channelBoost(ch);
    _c.set(color);
    const cr = Math.min(1, _c.r * boost), cg = Math.min(1, _c.g * boost), cb = Math.min(1, _c.b * boost);
    const uvs = o.uv ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
    const ts = o.texScale ?? TEXSCALE[ch] ?? 0.3;
    const geoUV = o.uvMode === 'geo';

    // 法向
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;

    const base = C.vcount;
    const pts = [a, b, c, d];
    for (let i = 0; i < 4; i++) {
      const q = pts[i];
      C.pos.push(q[0], q[1], q[2]);
      C.nor.push(nx, ny, nz);
      C.col.push(cr, cg, cb);
      C.wind.push(o.wind ?? 0);
      if (geoUV) C.uv.push(uvs[i][0], uvs[i][1]);
      else {
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay >= ax && ay >= az) C.uv.push(q[0] * ts, q[2] * ts);
        else if (ax >= az) C.uv.push(q[2] * ts, q[1] * ts);
        else C.uv.push(q[0] * ts, q[1] * ts);
      }
      if (q[0] < this.minX) this.minX = q[0];
      if (q[0] > this.maxX) this.maxX = q[0];
      if (q[2] < this.minZ) this.minZ = q[2];
      if (q[2] > this.maxZ) this.maxZ = q[2];
    }
    C.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    C.vcount += 4;
    // 兩面可見（駁岸這類單片幾何，正反都要看得見）
    if (o.both) {
      for (let i = 3; i >= 0; i--) {
        const q = pts[i];
        C.pos.push(q[0], q[1], q[2]);
        C.nor.push(-nx, -ny, -nz);
        C.col.push(cr, cg, cb);
        C.wind.push(o.wind ?? 0);
        const k = 3 - i;
        if (geoUV) C.uv.push(uvs[k][0], uvs[k][1]);
        else {
          const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
          if (ay >= ax && ay >= az) C.uv.push(q[0] * ts, q[2] * ts);
          else if (ax >= az) C.uv.push(q[2] * ts, q[1] * ts);
          else C.uv.push(q[0] * ts, q[1] * ts);
        }
      }
      const b2 = C.vcount;
      C.idx.push(b2, b2 + 1, b2 + 2, b2, b2 + 2, b2 + 3);
      C.vcount += 4;
    }
    return this;
  }

  isEmpty() { return Object.keys(this.channels).length === 0; }

  /** 產出合併網格，登記為裁剪單元 */
  emit(scene, opts = {}) {
    const { cull = true, castShadow = false, receiveShadow = true, radiusPad = 8 } = opts;
    const cx = (this.minX + this.maxX) / 2;
    const cz = (this.minZ + this.maxZ) / 2;
    const r = Math.hypot(this.maxX - this.minX, this.maxZ - this.minZ) / 2 + radiusPad;
    const group = new THREE.Group();
    group.name = this.name;

    for (const [name, C] of Object.entries(this.channels)) {
      if (!C.idx.length) continue;
      // 自檢：非有限或離譜的坐標會毀掉整個合併緩衝的包圍球與深度精度
      for (let i = 0; i < C.pos.length; i++) {
        const v = C.pos[i];
        if (!Number.isFinite(v) || Math.abs(v) > 5000) {
          console.error(`[GEO] ${this.name}/${name} 坐標異常 @${i}: ${v}`);
          break;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(C.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(C.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C.col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(C.uv, 2));
      g.setAttribute('aWind', new THREE.Float32BufferAttribute(C.wind, 1));
      g.setIndex(C.idx);
      const mesh = new THREE.Mesh(g, channelMaterial(name));
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    if (!group.children.length) return null;

    group.userData = { cx, cz, r, zone: this.name };
    scene.add(group);
    if (cull) cullables.push(group);
    return group;
  }
}
