// 共享程序化材质库 —— 赤壁/汉代水军营寨
// 所有纹理均为 Canvas 程序化生成，无外部贴图
import * as THREE from 'three';

function canvasTexture(size, painter, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  painter(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 确定性伪随机
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- 木板（顺纹 + 板缝 + 节疤） ----------
export function woodTexture({ base = '#6b543c', dark = '#57432f', light = '#7d6549',
                              planks = 6, vertical = false, seed = 7, repeat } = {}) {
  return canvasTexture(512, (ctx, S) => {
    const rng = makeRng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const pw = S / planks;
    for (let p = 0; p < planks; p++) {
      const off = p * pw;
      const tone = 0.85 + rng() * 0.3;
      ctx.fillStyle = shade(base, tone);
      if (vertical) ctx.fillRect(off, 0, pw, S);
      else ctx.fillRect(0, off, S, pw);
      // 木纹
      ctx.strokeStyle = shade(dark, 0.9 + rng() * 0.2);
      ctx.globalAlpha = 0.35;
      const lines = 14;
      for (let i = 0; i < lines; i++) {
        ctx.lineWidth = 0.6 + rng() * 1.2;
        ctx.beginPath();
        const wob = rng() * 20;
        for (let s = 0; s <= S; s += 16) {
          const w = Math.sin((s + p * 40) * 0.02 + i) * wob * 0.3 + (rng() - 0.5) * 2;
          const a = vertical ? [off + (i + 0.5) * (pw / lines) + w, s]
                             : [s, off + (i + 0.5) * (pw / lines) + w];
          s === 0 ? ctx.moveTo(...a) : ctx.lineTo(...a);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // 节疤
      if (rng() > 0.55) {
        const kx = vertical ? off + pw * (0.3 + rng() * 0.4) : rng() * S;
        const ky = vertical ? rng() * S : off + pw * (0.3 + rng() * 0.4);
        ctx.strokeStyle = shade(dark, 0.8);
        for (let r = 2; r < 7; r += 1.6) {
          ctx.beginPath();
          ctx.ellipse(kx, ky, r * 1.6, r, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // 板缝
      ctx.fillStyle = 'rgba(20,14,8,0.85)';
      if (vertical) ctx.fillRect(off, 0, 2, S);
      else ctx.fillRect(0, off, S, 2);
      ctx.fillStyle = light; ctx.globalAlpha = 0.25;
      if (vertical) ctx.fillRect(off + 2, 0, 1, S);
      else ctx.fillRect(0, off + 2, S, 1);
      ctx.globalAlpha = 1;
    }
  }, repeat);
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

// ---------- 编织席（篷/帆/屏障） ----------
export function weaveTexture({ base = '#b89a6a', dark = '#8f744c', seed = 3, repeat } = {}) {
  return canvasTexture(256, (ctx, S) => {
    const rng = makeRng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const step = 12;
    for (let y = 0; y < S; y += step) {
      for (let x = 0; x < S; x += step) {
        const even = ((x + y) / step) % 2 === 0;
        ctx.fillStyle = shade(even ? base : dark, 0.9 + rng() * 0.2);
        ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      }
    }
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rng() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(rng() * S, rng() * S, 20 + rng() * 40, 3);
    }
    ctx.globalAlpha = 1;
  }, repeat);
}

// ---------- 粗麻布（帆/帷幕） ----------
export function clothTexture({ base = '#c9b48c', dark = '#a68f68', seed = 5, repeat } = {}) {
  return canvasTexture(256, (ctx, S) => {
    const rng = makeRng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = dark;
    for (let y = 0; y < S; y += 3) {
      ctx.lineWidth = 0.6 + rng();
      ctx.beginPath(); ctx.moveTo(0, y + rng() * 2); ctx.lineTo(S, y + rng() * 2); ctx.stroke();
    }
    for (let x = 0; x < S; x += 3) {
      ctx.lineWidth = 0.5 + rng() * 0.8;
      ctx.beginPath(); ctx.moveTo(x + rng() * 2, 0); ctx.lineTo(x + rng() * 2, S); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 污渍
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 0.06 + rng() * 0.06;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(rng() * S, rng() * S, 20 + rng() * 50, 15 + rng() * 30, rng() * 3, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, repeat);
}

// ---------- 灰瓦（屋面） ----------
export function tileTexture({ base = '#5d5d58', dark = '#46463f', repeat } = {}) {
  return canvasTexture(256, (ctx, S) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const row = 24, col = 32;
    for (let y = 0; y < S; y += row) {
      for (let x = -col; x < S + col; x += col) {
        const ox = (y / row) % 2 ? col / 2 : 0;
        ctx.fillStyle = shade(base, 0.85 + ((x + y) % 97) / 97 * 0.3);
        ctx.beginPath();
        ctx.ellipse(x + ox + col / 2, y + row, col / 2 - 1, row * 0.62, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(x + ox + col / 2, y + row, col / 2 - 1, row * 0.62, 0, Math.PI, 0);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y, S, 2);
    }
  }, repeat);
}

// ---------- 陶土 ----------
export function clayTexture({ base = '#8a5f45', repeat } = {}) {
  return canvasTexture(128, (ctx, S) => {
    const rng = makeRng(11);
    ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 24; i++) {
      ctx.strokeStyle = shade(base, 0.8 + rng() * 0.4);
      ctx.lineWidth = 1 + rng() * 2;
      ctx.beginPath();
      ctx.moveTo(0, rng() * S);
      ctx.bezierCurveTo(S * .3, rng() * S, S * .7, rng() * S, S, rng() * S);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, repeat);
}

// ---------- 材质单例 ----------
let _m = null;
export function materials() {
  if (_m) return _m;
  const std = (opts) => new THREE.MeshStandardMaterial(opts);
  _m = {
    hullWood: std({ map: woodTexture({ base: '#6a5138', dark: '#4e3a27', light: '#82684b', planks: 7, repeat: [3, 1] }), roughness: 0.85 }),
    deckWood: std({ map: woodTexture({ base: '#7a6247', dark: '#5d4933', light: '#8f7557', planks: 9, repeat: [4, 2] }), roughness: 0.9 }),
    darkWood: std({ map: woodTexture({ base: '#54402c', dark: '#3e2d1e', light: '#66513a', planks: 5, repeat: [2, 1] }), roughness: 0.88 }),
    paleWood: std({ map: woodTexture({ base: '#8d7352', dark: '#6d573d', light: '#a08663', planks: 6, repeat: [2, 1] }), roughness: 0.85 }),
    weave: std({ map: weaveTexture({ repeat: [3, 2] }), roughness: 0.95 }),
    sail: std({ map: clothTexture({ base: '#c7b189', dark: '#a5906b', repeat: [2, 2] }), roughness: 0.95, side: THREE.DoubleSide }),
    darkCloth: std({ map: clothTexture({ base: '#6d5c42', dark: '#4e4030', seed: 9, repeat: [3, 2] }), roughness: 0.98, side: THREE.DoubleSide }),
    roofTile: std({ map: tileTexture({ repeat: [4, 3] }), roughness: 0.9 }),
    clay: std({ map: clayTexture({}), roughness: 0.8 }),
    rope: std({ color: '#a38d5f', roughness: 1 }),
    flagRed: std({ color: '#8a3b2a', roughness: 0.95, side: THREE.DoubleSide }),
    flagRedDark: std({ color: '#6e2f22', roughness: 0.95, side: THREE.DoubleSide }),
    ironDark: std({ color: '#3a3632', roughness: 0.6, metalness: 0.6 }),
    stone: std({ color: '#8d8a80', roughness: 1 }),
    reed: std({ map: woodTexture({ base: '#9a7f4e', dark: '#77613a', light: '#b2985f', planks: 12, seed: 21, repeat: [4, 1] }), roughness: 1 }),
    mud: std({ color: '#6e5f4b', roughness: 1 }),
  };
  return _m;
}

// ---------- 常用小构件 ----------
export function cylBetween(a, b, r, mat, radial = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r, r, len, radial);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

export function railing(length, h, mat, { posts = 8, rails = 2, postR = 0.035, railR = 0.03 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i <= posts; i++) {
    const x = -length / 2 + (length * i) / posts;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, h, 5), mat);
    p.position.set(x, h / 2, 0);
    g.add(p);
  }
  for (let r = 1; r <= rails; r++) {
    const y = (h * r) / rails;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(railR, railR, length, 5), mat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = y;
    g.add(bar);
  }
  return g;
}

// 旗（长三角旗/幡，带燕尾）
export function pennant(w, h, mat, tattered = false) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, h * 0.5);
  shape.lineTo(0, h);
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geo, mat);
  if (tattered) {
    // 尾部锯齿
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x > w * 0.6) pos.setY(i, pos.getY(i) + (i % 2 ? -h * 0.12 : h * 0.1));
    }
    geo.computeVertexNormals();
  }
  return mesh;
}

// 尖桩（木栅）
export function stake(r, h, mat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h * 0.82, 6), mat);
  body.position.y = h * 0.41;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.18, 6), mat);
  tip.position.y = h * 0.91;
  g.add(body, tip);
  return g;
}
