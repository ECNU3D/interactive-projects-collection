// 建筑：宋式木构、虹桥、城门、街市布局（材质通道 + 细部构件）
import * as THREE from 'three';
import { GeoBuilder, roof, dougong, plinth, cullables } from './geo.js';
import { P, vary, pick } from './palette.js';
import { addCollider, BRIDGE, RIVER, WALL, bridgeY } from './layout.js';
import { uniforms } from './materials.js';

export const smokeSpots = [];   // 炊烟位置（effects.js 使用）

/* ================= 招牌 / 旗幡 ================= */

function signTexture(text, opts = {}) {
  const { vertical = false, bg = '#e8dcbc', fg = '#3a2c18', border = '#7a5a30', pad = 18 } = opts;
  const fs = 56;
  const cv = document.createElement('canvas');
  const ctx0 = cv.getContext('2d');
  ctx0.font = `${fs}px "Kaiti SC", "STKaiti", serif`;
  if (vertical) {
    cv.width = fs + pad * 2;
    cv.height = fs * text.length + pad * 2 + 8 * (text.length - 1);
  } else {
    cv.width = ctx0.measureText(text).width + pad * 2 + 10 * (text.length - 1);
    cv.height = fs + pad * 2;
  }
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // 旧匾斑驳
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(150,130,95,${0.04 + Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.arc(Math.random() * cv.width, Math.random() * cv.height, 2 + Math.random() * 8, 0, 7);
    ctx.fill();
  }
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, cv.width - 6, cv.height - 6);
  ctx.fillStyle = fg;
  ctx.font = `${fs}px "Kaiti SC", "STKaiti", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (vertical) {
    for (let i = 0; i < text.length; i++) {
      ctx.fillText(text[i], cv.width / 2, pad + fs / 2 + i * (fs + 8));
    }
  } else {
    ctx.fillText(text, cv.width / 2, cv.height / 2 + 3);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: cv.width / cv.height };
}

const signMeshes = [];
export function makeSign(text, opts = {}) {
  const { h = 1, x = 0, y = 0, z = 0, ry = 0, vertical = false, double = true, bg, fg, border } = opts;
  const { tex, aspect } = signTexture(text, { vertical, bg, fg, border });
  const w = h * aspect;
  const mat = new THREE.MeshLambertMaterial({ map: tex, side: double ? THREE.DoubleSide : THREE.FrontSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.userData.x0 = x; mesh.userData.x1 = x;
  signMeshes.push(mesh);
  cullables.push(mesh);
  return mesh;
}

// 布旗（酒旗）：带风摆
export function makeFlag(text, opts = {}) {
  const { x = 0, y = 0, z = 0, ry = 0, w = 1.6, h = 2.4, bg = '#ded0a8', fg = '#8a2c1e' } = opts;
  const { tex } = signTexture(text, { vertical: true, bg, fg, border: fg, pad: 14 });
  const geo = new THREE.PlaneGeometry(w, h, 6, 8);
  const wind = new Float32Array(geo.attributes.position.count);
  for (let i = 0; i < wind.length; i++) {
    const px = geo.attributes.position.getX(i);
    wind[i] = Math.max(0, (px / w + 0.5)) * 0.5;   // 自由边摆动
  }
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 1));
  const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = `
      attribute float aWind;
      uniform float uTime;
    ` + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float phF = position.y * 2.1;
      transformed.z += (sin(uTime * 3.1 + phF + position.x * 3.0) * 0.5 + sin(uTime * 5.3 + phF) * 0.22) * aWind;
      transformed.x += cos(uTime * 2.2 + phF) * aWind * 0.12;`
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.userData.x0 = x; mesh.userData.x1 = x;
  signMeshes.push(mesh);
  cullables.push(mesh);
  return mesh;
}

/* ================= 木构构件 ================= */

// 台基
function platform(gb, x, z, w, d, h = 0.35) {
  gb.box(w + 0.8, h, d + 0.8, P.wallEarth, { x, y: h / 2, z, ch: 'brick', texScale: 0.5 });
}

/* 一间铺面/民居
   opts: {w,d,floors,open,roofType,thatchRoof,ry,face,grand} */
function house(gb, x, z, opts = {}) {
  const {
    w = 10, d = 8, floors = 1, storyH = 3.1, open = true,
    roofType = 'gable', thatchRoof = false, ry = 0, face = 1,
    collide = true, grand = false,
  } = opts;
  const wallC = vary(P.wallWhite, 0.05);
  const woodC = vary(P.wood, 0.06);
  const colC = P.column;
  platform(gb, x, z, w, d);

  for (let f = 0; f < floors; f++) {
    const y0 = 0.35 + f * storyH;
    // 柱 + 一层柱础
    const nx = Math.max(2, Math.round(w / 3.2));
    for (let i = 0; i <= nx; i++) {
      const cx = x - w / 2 + (w / nx) * i;
      gb.box(0.34, storyH, 0.34, colC, { x: cx, y: y0 + storyH / 2, z: z + face * d / 2 - 0.17 });
      gb.box(0.34, storyH, 0.34, colC, { x: cx, y: y0 + storyH / 2, z: z - face * d / 2 + 0.17 });
      if (f === 0) plinth(gb, cx, z + face * d / 2 - 0.17, { y: y0 - 0.05 });
    }
    // 背墙与侧墙（粉墙）
    gb.box(w, storyH, 0.3, wallC, { x, y: y0 + storyH / 2, z: z - face * (d / 2 - 0.15), ch: 'plaster' });
    gb.box(0.3, storyH, d - 0.3, wallC, { x: x - w / 2 + 0.15, y: y0 + storyH / 2, z, ch: 'plaster' });
    gb.box(0.3, storyH, d - 0.3, wallC, { x: x + w / 2 - 0.15, y: y0 + storyH / 2, z, ch: 'plaster' });
    // 临街面
    const fz = z + face * (d / 2 - 0.12);
    if (f === 0 && open) {
      gb.box(w * 0.86, 0.9, 0.5, woodC, { x, y: y0 + 0.45, z: fz, ch: 'wood' });
      gb.box(w, 0.5, 0.34, P.woodDark, { x, y: y0 + storyH - 0.25, z: fz, ch: 'wood' });
    } else {
      gb.box(w, storyH * 0.4, 0.22, woodC, { x, y: y0 + storyH * 0.2, z: fz, ch: 'wood' });
      gb.box(w, storyH * 0.55, 0.16, 0xd8d0b8, { x, y: y0 + storyH * 0.62, z: fz, ch: 'lattice', texScale: 0.7 });
    }
    // 侧墙格窗点缀
    if (f === 0 && !open && Math.random() < 0.6) {
      gb.box(0.14, 1.2, 2.0, 0xd8d0b8, { x: x + w / 2 - 0.07, y: y0 + 1.7, z, ch: 'lattice', texScale: 0.7 });
    }
    if (f > 0) {
      // 挑台栏杆
      gb.box(w + 1.2, 0.12, 1.1, P.woodDark, { x, y: y0 + 0.06, z: fz + face * 0.55, ch: 'wood' });
      gb.box(w + 1.2, 0.5, 0.1, P.bridgeRail, { x, y: y0 + 0.55, z: fz + face * 1.05, ch: 'wood' });
      // 楼上格窗
      gb.box(w * 0.9, storyH * 0.5, 0.14, 0xd8d0b8, { x, y: y0 + storyH * 0.55, z: fz - face * 0.05, ch: 'lattice', texScale: 0.7 });
    }
    // 楼层间腰檐
    if (f < floors - 1) {
      roof(gb, { x, y: y0 + storyH, z, w: d + 1.2, l: w + 1.0, rise: 0.7, overhang: 0.7, lift: 0.3, ry, color: P.tile, ridgeColor: P.ridge, type: 'gable' });
    }
  }
  const topY = 0.35 + floors * storyH;
  // 檐下斗拱（气派建筑）
  if (grand && !thatchRoof) {
    const nD = Math.max(3, Math.round(w / 2.6));
    for (let i = 0; i <= nD; i++) {
      const cx = x - w / 2 + (w / nD) * i;
      dougong(gb, cx, topY - 0.5, z + face * (d / 2 + 0.1), { s: 0.9 });
      dougong(gb, cx, topY - 0.5, z - face * (d / 2 + 0.1), { s: 0.9 });
    }
  }
  roof(gb, {
    x, y: topY, z, w: d, l: w,
    rise: thatchRoof ? 1.5 + d * 0.16 : 1.2 + d * 0.22,
    overhang: thatchRoof ? 0.9 : 1.1,
    lift: thatchRoof ? 0.1 : 0.6,
    ry,
    color: thatchRoof ? vary(P.thatch, 0.07) : vary(P.tile, 0.05),
    ridgeColor: thatchRoof ? P.thatchDark : P.ridge,
    type: roofType,
    thatch: thatchRoof,
    ornate: grand && !thatchRoof,   // 大宅悬山施博风板、悬鱼、惹草
  });
  if (collide) addCollider(x - w / 2 - 0.4, x + w / 2 + 0.4, z - d / 2 - 0.4, z + d / 2 + 0.4);
  return { x, z, w, d, topY };
}

// 茅屋
function thatchHut(gb, x, z, opts = {}) {
  const { w = 6, d = 5, ry = 0, chimney = true } = opts;
  const h = 2.4;
  gb.box(w, h, d, vary(P.wallEarth, 0.08), { x, y: h / 2 + 0.1, z, ry, ch: 'earthwall', texScale: 0.45 });
  gb.box(1.4, 1.8, 0.3, P.woodDark, { x: x - Math.sin(ry) * (d / 2), y: 1.0, z: z + Math.cos(ry) * (d / 2), ry, ch: 'wood' });
  // 小窗
  gb.box(0.9, 0.8, 0.16, 0xd0c8b0, { x: x + Math.cos(ry) * w * 0.28, y: 1.5, z: z + Math.cos(ry) * (d / 2) + Math.sin(ry) * w * 0.28, ry, ch: 'lattice', texScale: 1.1 });
  roof(gb, { x, y: h + 0.1, z, w: d + 0.6, l: w + 0.4, rise: 1.9, overhang: 0.85, lift: 0.05, ry, color: vary(P.thatch, 0.1), ridgeColor: P.thatchDark, type: 'gable', thatch: true });
  addCollider(x - w / 2 - 0.3, x + w / 2 + 0.3, z - d / 2 - 0.3, z + d / 2 + 0.3);
  if (chimney) smokeSpots.push([x + w * 0.3, h + 1.6, z]);
}

// 篱笆
function fence(gb, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.floor(len / 1.1);
  const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    gb.box(0.12, 1.15, 0.12, P.woodLight, { x: x0 + (x1 - x0) * t, y: 0.57, z: z0 + (z1 - z0) * t, ch: 'wood' });
  }
  gb.box(len, 0.1, 0.08, P.woodLight, { x: (x0 + x1) / 2, y: 0.85, z: (z0 + z1) / 2, ry, ch: 'wood' });
  gb.box(len, 0.1, 0.08, P.woodLight, { x: (x0 + x1) / 2, y: 0.45, z: (z0 + z1) / 2, ry, ch: 'wood' });
}

// 水井
function well(gb, x, z) {
  gb.cyl(0.7, 0.8, 0.8, 0xa8a294, { x, y: 0.4, z, seg: 8, ch: 'brick', texScale: 0.8 });
  gb.box(0.15, 2.2, 0.15, P.woodDark, { x: x - 0.9, y: 1.1, z, ch: 'wood' });
  gb.box(0.15, 2.2, 0.15, P.woodDark, { x: x + 0.9, y: 1.1, z, ch: 'wood' });
  gb.box(2.1, 0.12, 0.12, P.woodDark, { x, y: 2.2, z, ch: 'wood' });
}

// 草垛
function haystack(gb, x, z, s = 1) {
  gb.cone(1.4 * s, 2.2 * s, vary(P.thatch, 0.1), { x, y: 1.1 * s, z, seg: 8, ch: 'thatch', texScale: 0.7 });
}

// 坟茔
function grave(gb, x, z, s = 1) {
  gb.sphere(1.1 * s, P.mud, { x, y: 0.1, z, sy: 0.55 });
}

// 摊位
function stall(gb, x, z, opts = {}) {
  const { ry = 0, awning = true, goods = P.paper } = opts;
  gb.box(2.4, 0.12, 1.2, P.wood, { x, y: 0.85, z, ry, ch: 'wood' });
  for (const [px, pz] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) {
    gb.box(0.12, 0.85, 0.12, P.woodDark, { x: x + px, y: 0.43, z: z + pz, ry, ch: 'wood' });
  }
  for (let i = 0; i < 4; i++) {
    gb.box(0.4, 0.22, 0.35, vary(goods, 0.2), { x: x - 0.8 + i * 0.5 + Math.random() * 0.1, y: 1.0, z: z + (Math.random() - 0.5) * 0.5, ry });
  }
  if (awning) {
    gb.box(0.1, 2.4, 0.1, P.woodDark, { x: x - 1.3, y: 1.2, z: z - 0.7, ry, ch: 'wood' });
    gb.box(0.1, 2.4, 0.1, P.woodDark, { x: x + 1.3, y: 1.2, z: z - 0.7, ry, ch: 'wood' });
    gb.box(0.1, 2.0, 0.1, P.woodDark, { x: x - 1.3, y: 1.0, z: z + 0.9, ry, ch: 'wood' });
    gb.box(0.1, 2.0, 0.1, P.woodDark, { x: x + 1.3, y: 1.0, z: z + 0.9, ry, ch: 'wood' });
    gb.grid(2, 2, (i, j) => [(j * 2 - 1) * 1.6, 2.45 - i * 0.55, i * 1.9 - 0.8], vary(P.mat, 0.1), { x, y: 0, z, ry, doubleSide: true, ch: 'reed' });
  }
}

// 大遮阳伞
function umbrella(gb, x, z, color = P.mat) {
  gb.box(0.12, 2.6, 0.12, P.woodDark, { x, y: 1.3, z, ch: 'wood' });
  gb.cone(2.0, 0.9, vary(color, 0.08), { x, y: 2.8, z, seg: 10, ch: 'reed', texScale: 0.8 });
}

// 独轮车
function wheelbarrow(gb, x, z, ry = 0) {
  gb.cyl(0.55, 0.55, 0.12, P.woodDark, { x, y: 0.55, z, rx: Math.PI / 2, ry, seg: 10, ch: 'wood' });
  gb.box(1.9, 0.12, 0.9, P.wood, { x, y: 0.75, z, ry, ch: 'wood' });
  gb.box(0.5, 0.5, 0.7, vary(P.mat, 0.1), { x: x - Math.sin(ry) * 0.4, y: 1.05, z: z - Math.cos(ry) * 0.4, ry, ch: 'reed' });
  gb.box(0.5, 0.4, 0.7, vary(P.paper, 0.1), { x: x + Math.sin(ry) * 0.5, y: 1.0, z: z + Math.cos(ry) * 0.5, ry });
}

// 太平车（低货 + 苇席棚拱）
function cart(gb, x, z, ry = 0) {
  gb.box(3.2, 0.18, 1.8, P.wood, { x, y: 0.9, z, ry, ch: 'wood' });
  for (const s of [-1, 1]) {
    gb.cyl(0.75, 0.75, 0.15, P.woodDark, { x: x + Math.cos(ry) * s * 1.0, y: 0.75, z: z - Math.sin(ry) * s * 1.0, rx: Math.PI / 2, ry, seg: 10, ch: 'wood' });
  }
  gb.box(2.4, 0.5, 1.5, vary(P.mat, 0.12), { x, y: 1.25, z, ry, ch: 'reed' });
  gb.grid(5, 3, (i, j) => {
    const th = (i / 4) * Math.PI;
    return [(j - 1) * 1.15, 1.45 + Math.sin(th) * 1.0, Math.cos(th) * 0.95];
  }, vary(P.mat, 0.08), { x, y: 0, z, ry, doubleSide: true, ch: 'reed', uvRepeat: [2, 1] });
  gb.box(2.0, 0.15, 0.2, P.woodDark, { x: x - Math.sin(ry) * 1.2, y: 0.8, z: z + Math.cos(ry) * 2.2, ry, ch: 'wood' });
}

// 轿子（y0 用于桥顶等抬高位置）
function sedan(gb, x, z, ry = 0, willowOnTop = false, y0 = 0) {
  gb.box(1.1, 1.3, 1.1, vary(0x4a5a50, 0.1), { x, y: y0 + 1.05, z, ry });
  roof(gb, { x, y: y0 + 1.75, z, w: 1.3, l: 1.3, rise: 0.4, overhang: 0.25, lift: 0.2, ry, color: 0x3e4a42, ridgeColor: P.ridge, type: 'hip' });
  gb.box(3.4, 0.1, 0.12, P.woodDark, { x, y: y0 + 0.75, z: z - 0.45, ry, ch: 'wood' });
  gb.box(3.4, 0.1, 0.12, P.woodDark, { x, y: y0 + 0.75, z: z + 0.45, ry, ch: 'wood' });
  if (willowOnTop) {
    for (let i = 0; i < 4; i++) {
      gb.box(0.06, 0.8, 0.06, P.willow, { x: x + (Math.random() - 0.5) * 0.8, y: y0 + 2.4, z: z + (Math.random() - 0.5) * 0.8, rx: (Math.random() - 0.5) * 0.6, rz: (Math.random() - 0.5) * 0.6, wind: 0.25 });
    }
  }
}

// 彩楼欢门（彩帛条纹贴图）
function huanmen(gb, x, z, opts = {}) {
  const { h = 9, w = 8, ry = 0, rich = false } = opts;
  const dx = Math.cos(ry), dz = -Math.sin(ry);
  for (const sx of [-1, 1]) {
    for (const sz of [0, 1]) {
      const px = x + dx * sx * w / 2 + dz * (sz * 2 - 1) * 1.2;
      const pz = z + dz * sx * w / 2 + dx * (sz * 2 - 1) * 1.2;
      gb.box(0.3, h, 0.3, P.column, { x: px, y: h / 2, z: pz });
      plinth(gb, px, pz, {});
    }
  }
  for (const [t, hh] of [[0.45, h * 0.45], [0.75, h * 0.75], [1.0, h]]) {
    gb.box(w + 1.2, 0.35, 1.5, P.woodDark, { x, y: hh, z, ry, ch: 'wood' });
    // 缠帛（彩条贴图，顶点色置白）
    gb.box(w * 0.96, 0.65, 1.7, 0xffffff, { x, y: hh + 0.16, z, ry, ch: 'silk', texScale: 0.45 });
  }
  gb.box(w * 0.6, 1.6, 1.3, 0xffffff, { x, y: h + 0.9, z, ry, ch: 'silk', texScale: 0.5 });
  gb.box(w * 0.3, 1.2, 1.2, vary(P.bannerRed, 0.08), { x, y: h + 2.0, z, ry });
  for (let i = 0; i < 4; i++) {
    const u = (i / 3 - 0.5) * w * 0.8;
    gb.sphere(0.28, P.lantern, { x: x + dx * u, y: h * 0.68, z: z + dz * u });
  }
  if (rich) {
    for (let i = 0; i < 3; i++) {
      const u = (i / 2 - 0.5) * w * 0.6;
      gb.sphere(0.34, vary(P.bannerRed, 0.1), { x: x + dx * u, y: h * 0.9, z: z + dz * u });
    }
  }
}

// 望火楼
function watchtower(gb, x, z) {
  const h = 12;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    gb.box(0.4, h, 0.4, P.woodDark, { x: x + sx * 1.6, y: h / 2, z: z + sz * 1.6, rx: sz * 0.06, rz: -sx * 0.06, ch: 'wood' });
  }
  gb.box(4.6, 0.3, 4.6, P.wood, { x, y: h, z, ch: 'wood' });
  gb.box(4.6, 0.9, 0.12, P.bridgeRail, { x, y: h + 0.5, z: z - 2.3, ch: 'wood' });
  gb.box(4.6, 0.9, 0.12, P.bridgeRail, { x, y: h + 0.5, z: z + 2.3, ch: 'wood' });
  gb.box(0.12, 0.9, 4.6, P.bridgeRail, { x: x - 2.3, y: h + 0.5, z, ch: 'wood' });
  gb.box(0.12, 0.9, 4.6, P.bridgeRail, { x: x + 2.3, y: h + 0.5, z, ch: 'wood' });
  gb.box(1.0, 0.5, 0.7, P.wood, { x: x + 0.6, y: h + 0.55, z: z + 0.5, ch: 'wood' });
  gb.box(0.5, 0.35, 0.4, P.woodLight, { x: x - 0.7, y: h + 0.47, z: z - 0.6, ch: 'wood' });
  roof(gb, { x, y: h + 1.3, z, w: 5.6, l: 5.6, rise: 1.5, overhang: 0.9, lift: 0.5, color: P.tile, ridgeColor: P.ridge, type: 'hip' });
  addCollider(x - 2, x + 2, z - 2, z + 2);
}

/* ================= 虹桥 ================= */

function rainbowBridge(gb) {
  const { x0, x1, cx, deckHalfW } = BRIDGE;
  const ROWS = 7, COLS = 30;
  // 桥面（木板，法线朝上）
  gb.grid(ROWS, COLS, (i, j) => {
    const x = x0 + (x1 - x0) * (j / (COLS - 1));
    const z = (i / (ROWS - 1) * 2 - 1) * deckHalfW;
    return [x - cx, bridgeY(x) + 0.08, z];
  }, vary(P.bridgeWood, 0.03), { x: cx, y: 0, z: 0, doubleSide: true, ch: 'wood', uvRepeat: [(x1 - x0) * 0.45, deckHalfW] });

  // 贯木拱：两套拱骨系统交织（第一系统 5 道，第二系统 4 道错位）
  const archXa = RIVER.bank0 + 1, archXb = RIVER.bank1 - 1;
  const sys = [
    { lanes: [-deckHalfW + 0.5, -deckHalfW / 2, 0, deckHalfW / 2, deckHalfW - 0.5], segs: 6, dy: -0.75, color: 0x8a4a34, off: 0 },
    { lanes: [-deckHalfW * 0.75, -deckHalfW * 0.25, deckHalfW * 0.25, deckHalfW * 0.75], segs: 6, dy: -1.15, color: 0x7a3e2c, off: 0.5 },
  ];
  for (const S of sys) {
    for (const lz of S.lanes) {
      for (let s = 0; s < S.segs; s++) {
        const ta = (s + S.off * 0.5) / S.segs, tb = (s + 1 + S.off * 0.5) / S.segs;
        if (tb > 1.02) continue;
        const xa = archXa + (archXb - archXa) * Math.min(1, ta);
        const xb = archXa + (archXb - archXa) * Math.min(1, tb);
        const ya = bridgeY(xa) + S.dy, yb = bridgeY(xb) + S.dy;
        const len = Math.hypot(xb - xa, yb - ya);
        const ang = Math.atan2(yb - ya, xb - xa);
        gb.box(len + 0.35, 0.42, 0.5, vary(S.color, 0.06), {
          x: (xa + xb) / 2, y: (ya + yb) / 2, z: lz, rz: ang,
        });
      }
    }
  }
  // 横梁绑联
  for (let s = 1; s < 6; s++) {
    const x = archXa + (archXb - archXa) * (s / 6);
    gb.box(0.5, 0.45, deckHalfW * 2 + 1.2, vary(0x6e3826, 0.05), { x, y: bridgeY(x) - 1.45, z: 0 });
  }
  // 栏杆（望柱带柱头）
  for (const side of [-1, 1]) {
    const zr = side * (deckHalfW - 0.18);
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const x = x0 + (x1 - x0) * (i / N);
      gb.box(0.22, 1.15, 0.22, vary(P.bridgeRail, 0.05), { x, y: bridgeY(x) + 0.65, z: zr, ch: 'wood' });
      gb.sphere(0.14, 0x6a3a28, { x, y: bridgeY(x) + 1.32, z: zr });
    }
    for (let i = 0; i < N; i++) {
      const xa = x0 + (x1 - x0) * (i / N);
      const xb = x0 + (x1 - x0) * ((i + 1) / N);
      const ya = bridgeY(xa) + 1.12, yb = bridgeY(xb) + 1.12;
      const len = Math.hypot(xb - xa, yb - ya);
      gb.box(len + 0.1, 0.16, 0.24, P.bridgeRail, {
        x: (xa + xb) / 2, y: (ya + yb) / 2, z: zr,
        rz: Math.atan2(yb - ya, xb - xa), ch: 'wood',
      });
      gb.box(len + 0.1, 0.1, 0.2, P.bridgeRail, {
        x: (xa + xb) / 2, y: (ya + yb) / 2 - 0.55, z: zr,
        rz: Math.atan2(yb - ya, xb - xa), ch: 'wood',
      });
    }
  }
  // 桥头华表（四根，顶立仙鹤）
  for (const bx of [x0 + 2, x1 - 2]) {
    for (const side of [-1, 1]) {
      const bz = side * (deckHalfW + 1.4);
      gb.cyl(0.16, 0.2, 7, 0xa85848, { x: bx, y: 3.5, z: bz, seg: 8 });
      gb.box(1.5, 0.14, 0.14, 0xa85848, { x: bx, y: 6.6, z: bz });
      gb.box(0.14, 0.14, 1.5, 0xa85848, { x: bx, y: 6.45, z: bz });
      gb.sphere(0.22, 0xe8e0d0, { x: bx, y: 7.15, z: bz, sx: 1.5, sy: 0.9 });
      gb.cyl(0.04, 0.05, 0.55, 0xe8e0d0, { x: bx + 0.25, y: 7.5, z: bz, rz: -0.5, seg: 5 });
      gb.sphere(0.09, 0xe8e0d0, { x: bx + 0.42, y: 7.72, z: bz });
      gb.cone(0.05, 0.22, 0xc8a030, { x: bx + 0.55, y: 7.72, z: bz, rz: -1.5, seg: 5 });
    }
  }
  // 桥上摊贩与遮阳伞
  const stallXs = [x0 + 9, x0 + 18, x1 - 9, x1 - 18];
  for (let i = 0; i < stallXs.length; i++) {
    const sx = stallXs[i];
    const sz = (i % 2 === 0 ? -1 : 1) * (deckHalfW - 1.8);
    const y = bridgeY(sx);
    gb.box(1.8, 0.1, 1.0, P.wood, { x: sx, y: y + 0.8, z: sz, ch: 'wood' });
    gb.box(0.1, 0.8, 0.1, P.woodDark, { x: sx - 0.8, y: y + 0.4, z: sz, ch: 'wood' });
    gb.box(0.1, 0.8, 0.1, P.woodDark, { x: sx + 0.8, y: y + 0.4, z: sz, ch: 'wood' });
    for (let g = 0; g < 3; g++) {
      gb.box(0.35, 0.18, 0.3, vary(P.paper, 0.2), { x: sx - 0.5 + g * 0.5, y: y + 0.95, z: sz });
    }
    gb.box(0.1, 2.4, 0.1, P.woodDark, { x: sx + 0.6, y: y + 1.2, z: sz + 0.3, ch: 'wood' });
    gb.cone(1.5, 0.7, vary(P.mat, 0.1), { x: sx + 0.6, y: y + 2.6, z: sz + 0.3, seg: 9, ch: 'reed', texScale: 0.8 });
  }
}

/* ================= 城墙与城门 ================= */

function cityWallAndGate(gb) {
  const { x, thick, gateHalf, height } = WALL;
  for (const [z0, z1] of [[-230, -gateHalf], [gateHalf, 230]]) {
    const len = z1 - z0;
    const mid = (z0 + z1) / 2;
    gb.box(thick, height, len, vary(P.wallEarth, 0.04), { x, y: height / 2, z: mid, ch: 'earthwall' });
    gb.box(thick * 0.8, 1.4, len, vary(P.brickDark, 0.05), { x, y: height + 0.7, z: mid, ch: 'brick' });
    addCollider(x - thick / 2, x + thick / 2, z0, z1);
  }
  // 墙头杂树
  for (let i = 0; i < 14; i++) {
    const z = (Math.random() < 0.5 ? -1 : 1) * (gateHalf + 4 + Math.random() * 130);
    const s = 0.5 + Math.random() * 0.7;
    gb.cyl(0.08 * s, 0.14 * s, 1.6 * s, P.bare, { x: x + (Math.random() - 0.5) * 4, y: height + 1.4 + 0.8 * s, z, ch: 'wood' });
    gb.sphere(0.9 * s, vary(P.leaf, 0.15), { x: x + (Math.random() - 0.5) * 4, y: height + 2.6 + 0.9 * s, z, wind: 0.12 });
  }
  // 门洞：砖包壁 + 排叉柱
  for (const side of [-1, 1]) {
    const wz = side * gateHalf;
    gb.box(thick + 1.5, height, 1.2, vary(P.brick, 0.04), { x, y: height / 2, z: wz, ch: 'brick' });
    for (let i = 0; i < 5; i++) {
      const px = x - thick / 2 + 1 + i * (thick - 2) / 4;
      gb.box(0.4, height - 2, 0.4, P.column, { x: px, y: (height - 2) / 2, z: wz - side * 0.75 });
    }
  }
  gb.box(thick + 1.5, 1.8, gateHalf * 2 + 1.5, P.woodDark, { x, y: height - 0.9, z: 0, ch: 'wood' });

  // 城楼（单檐庑殿顶 + 斗拱层）
  const ty = height + 1.4;
  const tw = 26, td = 13;
  gb.box(tw, 1.4, td, vary(P.brick, 0.03), { x, y: height + 0.7, z: 0, ch: 'brick' });
  gb.box(tw, 0.8, 0.15, P.bridgeRail, { x, y: ty + 0.4, z: -td / 2 + 0.1, ch: 'wood' });
  gb.box(tw, 0.8, 0.15, P.bridgeRail, { x, y: ty + 0.4, z: td / 2 - 0.1, ch: 'wood' });
  gb.box(0.15, 0.8, td, P.bridgeRail, { x: x - tw / 2 + 0.1, y: ty + 0.4, z: 0, ch: 'wood' });
  gb.box(0.15, 0.8, td, P.bridgeRail, { x: x + tw / 2 - 0.1, y: ty + 0.4, z: 0, ch: 'wood' });
  const bw = 20, bd = 9, bh = 4.6;
  for (let i = 0; i <= 6; i++) {
    const pz = -bd / 2 + (bd / 6) * i;
    gb.box(0.45, bh, 0.45, P.column, { x: x - bw / 2, y: ty + bh / 2, z: pz });
    gb.box(0.45, bh, 0.45, P.column, { x: x + bw / 2, y: ty + bh / 2, z: pz });
  }
  for (let i = 0; i <= 8; i++) {
    const px = x - bw / 2 + (bw / 8) * i;
    gb.box(0.45, bh, 0.45, P.column, { x: px, y: ty + bh / 2, z: -bd / 2 });
    gb.box(0.45, bh, 0.45, P.column, { x: px, y: ty + bh / 2, z: bd / 2 });
  }
  // 楼身格窗
  gb.box(bw - 0.5, bh * 0.9, bd - 0.5, 0xcfc8b2, { x, y: ty + bh * 0.45, z: 0, ch: 'lattice', texScale: 0.55 });
  // 斗拱层（七铺作，画中规格最高）
  for (let i = 0; i <= 8; i++) {
    const px = x - bw / 2 + (bw / 8) * i;
    dougong(gb, px, ty + bh + 0.05, -bd / 2 - 0.4, { s: 1.15 });
    dougong(gb, px, ty + bh + 0.05, bd / 2 + 0.4, { s: 1.15 });
  }
  for (let i = 0; i <= 2; i++) {
    const pz = -bd / 2 + (bd / 2) * i;
    dougong(gb, x - bw / 2 - 0.4, ty + bh + 0.05, pz, { s: 1.15 });
    dougong(gb, x + bw / 2 + 0.4, ty + bh + 0.05, pz, { s: 1.15 });
  }
  gb.box(bw + 2.6, 0.5, bd + 2.6, 0x8a4a34, { x, y: ty + bh + 0.85, z: 0 });
  roof(gb, { x, y: ty + bh + 1.1, z: 0, w: bd + 3.5, l: bw + 2.5, rise: 3.4, overhang: 1.6, lift: 0.9, color: P.tile, ridgeColor: P.ridge, type: 'hip' });
  // 城楼大鼓
  gb.cyl(0.8, 0.8, 0.6, 0x8a3a28, { x: x - bw / 2 + 2, y: ty + 1.2, z: -td / 2 + 1.4, rx: Math.PI / 2, seg: 10 });
}

/* ================= 总布局 ================= */

export function buildArchitecture(scene) {
  const gb = new GeoBuilder();

  /* ---- 一、郊野 ---- */
  thatchHut(gb, 52, -26, { ry: 0.2 });
  thatchHut(gb, 60, -34, { w: 5, d: 4.5, ry: -0.3 });
  fence(gb, 46, -20, 66, -20); fence(gb, 46, -20, 46, -40);
  haystack(gb, 68, -28); well(gb, 65, -21);

  thatchHut(gb, 108, 30, { ry: -0.15 });
  thatchHut(gb, 118, 38, { w: 5.5, d: 4.5, ry: 0.4, chimney: false });
  fence(gb, 100, 24, 126, 24); haystack(gb, 124, 32, 0.8);

  thatchHut(gb, 168, -40, { w: 7, d: 5.5 });
  haystack(gb, 176, -46); haystack(gb, 180, -42, 0.7); well(gb, 160, -34);
  fence(gb, 158, -32, 182, -32);

  thatchHut(gb, 232, 26, { ry: 0.1 });
  thatchHut(gb, 240, 34, { w: 5, d: 4, ry: -0.2, chimney: false });
  fence(gb, 224, 20, 250, 20);

  grave(gb, 120, 74); grave(gb, 126, 78, 0.8); grave(gb, 116, 80, 0.7);
  grave(gb, 200, -80); grave(gb, 206, -76, 0.85);

  house(gb, 270, -16, { w: 8, d: 6, thatchRoof: true, roofType: 'gable' });
  makeFlag('小酒', { x: 266, y: 4.6, z: -12, w: 1.2, h: 2.0, ry: Math.PI / 2 });
  gb.box(0.12, 5.2, 0.12, P.woodDark, { x: 265.4, y: 2.6, z: -12, ch: 'wood' });

  sedan(gb, 96, 6.5, 0.3, true);
  sedan(gb, 92, 8.5, 0.1, true);

  /* ---- 二、汴河西岸 ---- */
  for (let i = 0; i < 4; i++) {
    house(gb, 318 + i * 13, -30 - (i % 2) * 10, { w: 10, d: 8, open: false, roofType: 'gable' });
  }
  gb.box(26, 0.5, 14, P.bridgeWood, { x: 382, y: 0.25, z: -32, ch: 'wood' });
  for (let i = 0; i < 8; i++) {
    gb.box(0.9, 0.7, 0.6, vary(P.mat, 0.15), { x: 374 + (i % 4) * 1.2, y: 0.85 + Math.floor(i / 4) * 0.7, z: -30 - (i % 2), ry: Math.random() * 0.4, ch: 'reed' });
  }
  for (let i = 0; i < 6; i++) {
    gb.sphere(0.5, vary(P.rope, 0.12), { x: 380 + (i % 3) * 1.1, y: 0.95, z: -36.5 + Math.floor(i / 3) * 1.2, sy: 0.75 });
  }
  gb.box(6, 0.18, 1.1, P.wood, { x: 390.5, y: 0.1, z: -30, rz: -0.12, ch: 'wood' });
  gb.box(6, 0.18, 1.1, P.wood, { x: 390.5, y: 0.1, z: -35, rz: -0.12, ch: 'wood' });
  stall(gb, 372, -16, { ry: 0.2, goods: 0xc8b088 });
  stall(gb, 366, -20, { ry: -0.1, goods: 0xa89058 });
  umbrella(gb, 369, -12);

  house(gb, 330, 14, { w: 9, d: 7 });
  house(gb, 344, 15, { w: 8, d: 7 });
  makeFlag('茶', { x: 336, y: 4.4, z: 18.5, w: 1.1, h: 1.8, ry: Math.PI / 2 });
  gb.box(0.12, 5.0, 0.12, P.woodDark, { x: 335.4, y: 2.5, z: 18.5, ch: 'wood' });
  umbrella(gb, 352, 12, P.paper);

  stall(gb, 356, -60, { ry: 0.4, awning: true, goods: 0xb09868 });

  /* ---- 三、虹桥 ---- */
  rainbowBridge(gb);

  // 桥顶争道的轿子（文官轿在西，与东侧武官骏马迎面相遇）
  sedan(gb, 429.8, 0.9, 0.05, false, bridgeY(429.8));

  // 十千脚店
  house(gb, 506, -22, { w: 14, d: 10, floors: 2, roofType: 'gable', grand: true });
  huanmen(gb, 506, -13.5, { h: 8.5, w: 9 });
  makeSign('十千腳店', { h: 0.85, x: 502.6, y: 2.1, z: -13.2, vertical: true, bg: '#ede2c2' });
  makeSign('腳店', { h: 0.7, x: 506, y: 5.6, z: -16.6, bg: '#e8dcbc' });
  makeFlag('新酒', { x: 510.5, y: 9.6, z: -13.5, w: 1.5, h: 2.4, bg: '#e2d4ac', fg: '#8a2c1e', ry: Math.PI / 2 });
  gb.box(0.14, 11, 0.14, P.woodDark, { x: 509.8, y: 5.5, z: -13.5, ch: 'wood' });
  gb.box(0.9, 2.6, 0.9, P.paper, { x: 502.6, y: 1.65, z: -13.2 });

  house(gb, 528, 16, { w: 10, d: 8 });
  house(gb, 541, 17, { w: 9, d: 8 });
  makeFlag('酒', { x: 534, y: 4.6, z: 21, w: 1.1, h: 1.8, ry: Math.PI / 2 });
  gb.box(0.12, 5.2, 0.12, P.woodDark, { x: 533.4, y: 2.6, z: 21, ch: 'wood' });
  stall(gb, 520, 10, { goods: 0x9a7a4a });
  stall(gb, 549, 11, { ry: -0.2, goods: P.paper });
  umbrella(gb, 526, 9);

  house(gb, 560, -18, { w: 11, d: 9, floors: 2 });
  makeSign('久住王員外家', { h: 0.7, x: 560, y: 6.9, z: -13.1, bg: '#e5d8b5' });
  house(gb, 575, -16, { w: 9, d: 8 });

  watchtower(gb, 694, 38);
  house(gb, 610, -20, { w: 10, d: 8, open: false });
  fence(gb, 603, -14, 617, -14);

  /* ---- 四、城墙城门 ---- */
  cityWallAndGate(gb);

  /* ---- 五、城内街市 ---- */
  house(gb, 680, 20, { w: 12, d: 9, open: true });
  makeSign('稅', { h: 0.9, x: 680, y: 4.3, z: 15.2, ry: Math.PI, vertical: true, bg: '#ddcfa8' });   // 面向街道（南）
  for (let i = 0; i < 5; i++) {
    gb.sphere(0.55, vary(P.rope, 0.1), { x: 674 + (i % 3) * 1.3, y: 0.55, z: 12 + Math.floor(i / 3) * 1.3, sy: 0.8 });
  }
  cart(gb, 671, 9, 0.3);

  house(gb, 700, -16, { w: 9, d: 8, floors: 2 });
  makeSign('解', { h: 1.3, x: 700, y: 4.0, z: -11.4, bg: '#e8dcbc', fg: '#2a2a3a' });

  const shopsN = [
    { x: 718, w: 10, sign: '弓箭鋪' }, { x: 731, w: 9, sign: null },
    { x: 744, w: 10, sign: '綵帛鋪' }, { x: 800, w: 9, sign: null },
    { x: 814, w: 11, sign: '王家紙馬' }, { x: 830, w: 9, sign: null },
    { x: 872, w: 10, sign: '劉家上色沉檀楝香' }, { x: 886, w: 9, sign: null },
  ];
  for (const s of shopsN) {
    const floors = Math.random() < 0.3 ? 2 : 1;
    house(gb, s.x, 16 + Math.random() * 2, { w: s.w, d: 8, floors, face: 1, ry: 0 });
    if (s.sign) makeSign(s.sign, { h: 0.62, x: s.x, y: floors > 1 ? 6.9 : 3.6, z: 11.6, ry: Math.PI, bg: '#e5d8b5' });   // 面向街道（南）
  }
  gb.box(1.4, 2.2, 1.4, P.paper, { x: 810, y: 1.45, z: 11 });
  roof(gb, { x: 810, y: 2.6, z: 11, w: 1.8, l: 1.8, rise: 0.6, overhang: 0.3, lift: 0.3, color: 0xdcd2b2, ridgeColor: 0xc4b894, type: 'hip' });
  gb.box(1.0, 1.6, 1.0, P.paper, { x: 812.4, y: 1.15, z: 11.4 });

  const shopsS = [
    { x: 716, w: 10, sign: '肉' }, { x: 729, w: 9, sign: null },
    { x: 742, w: 9, sign: null }, { x: 796, w: 10, sign: '香藥鋪' },
    { x: 810, w: 9, sign: null }, { x: 838, w: 10, sign: null },
    { x: 884, w: 10, sign: null },
  ];
  for (const s of shopsS) {
    const floors = Math.random() < 0.3 ? 2 : 1;
    house(gb, s.x, -17 - Math.random() * 2, { w: s.w, d: 8, floors, face: -1 });
    if (s.sign) makeSign(s.sign, { h: s.sign.length > 1 ? 0.62 : 1.1, x: s.x, y: floors > 1 ? 6.9 : 3.6, z: -12.4, bg: '#e5d8b5' });
  }

  // 孙羊正店（三层 + 斗拱 + 彩楼欢门）
  {
    const sx = 768, sz = -24;
    house(gb, sx, sz, { w: 18, d: 13, floors: 3, storyH: 3.3, roofType: 'hip', grand: true });
    huanmen(gb, sx, sz + 10.5, { h: 11, w: 13, rich: true });
    makeSign('孫羊店', { h: 0.95, x: sx - 4.2, y: 2.3, z: sz + 11.6, vertical: true, bg: '#ede2c2' });
    makeSign('正店', { h: 0.95, x: sx + 4.2, y: 2.3, z: sz + 11.6, vertical: true, bg: '#ede2c2' });
    gb.box(1.0, 3.0, 1.0, P.paper, { x: sx - 4.2, y: 1.85, z: sz + 11.6 });
    gb.box(1.0, 3.0, 1.0, P.paper, { x: sx + 4.2, y: 1.85, z: sz + 11.6 });
    makeSign('孫羊正店', { h: 0.8, x: sx, y: 10.9, z: sz + 6.8, bg: '#e8dcbc', fg: '#5a2018' });
    makeFlag('香醪', { x: sx + 8, y: 12.5, z: sz + 8, w: 1.6, h: 2.6, ry: Math.PI / 2 });
    gb.box(0.16, 14.5, 0.16, P.woodDark, { x: sx + 7.2, y: 7.2, z: sz + 8, ch: 'wood' });
    stall(gb, sx - 9, sz + 13, { goods: 0x9a5a48, awning: true });
    smokeSpots.push([sx - 5, 4.5, sz - 5]);
  }

  gb.cyl(0.18, 0.24, 9, P.woodDark, { x: 852, y: 4.5, z: 0, seg: 8, ch: 'wood' });
  makeFlag('北望朱雀門', { x: 852.8, y: 7.6, z: 0, w: 1.2, h: 3.2, bg: '#d8c8a0', fg: '#3a3048', ry: Math.PI / 2 });

  umbrella(gb, 838, -10, P.paper);
  umbrella(gb, 843, -12, P.mat);
  stall(gb, 840, -13, { awning: false, goods: 0xc8a868 });
  makeSign('飲子', { h: 0.72, x: 838, y: 1.9, z: -8.6, bg: '#eee2c0' });
  makeSign('香飲子', { h: 0.6, x: 843.5, y: 1.8, z: -10.6, bg: '#eee2c0' });
  stall(gb, 858, -12, { awning: true, goods: P.paper });
  makeSign('神課', { h: 1.15, x: 856.6, y: 2.0, z: -10.4, vertical: true, bg: '#ece0be' });
  makeSign('看命', { h: 1.15, x: 858.1, y: 2.0, z: -10.4, vertical: true, bg: '#ece0be' });
  makeSign('決疑', { h: 1.15, x: 859.6, y: 2.0, z: -10.4, vertical: true, bg: '#ece0be' });

  {
    const sx = 924, sz = -20;
    house(gb, sx, sz, { w: 13, d: 10, floors: 2, grand: true });
    makeSign('趙太丞家', { h: 0.8, x: sx, y: 7.0, z: sz + 5.9, bg: '#e8dcbc', fg: '#28303e' });
    makeSign('治酒所傷真方集香丸', { h: 3.4, x: sx - 5.6, y: 2.4, z: sz + 6.3, vertical: true, bg: '#ece0be' });
    makeSign('大理中丸醫腸胃冷', { h: 3.1, x: sx + 5.6, y: 2.3, z: sz + 6.3, vertical: true, bg: '#ece0be' });
    // 柜台上的算盘（画中最早的算盘图像之说）
    gb.box(0.5, 0.045, 0.3, 0x3a2c18, { x: sx - 1.4, y: 1.29, z: sz + 5.0 });
    gb.box(0.46, 0.02, 0.035, 0x6b4a30, { x: sx - 1.4, y: 1.34, z: sz + 5.0 });
    for (let i = 0; i < 5; i++) {
      gb.box(0.025, 0.055, 0.26, 0x8a6540, { x: sx - 1.58 + i * 0.09, y: 1.36, z: sz + 5.0 });
    }
  }
  house(gb, 952, 20, { w: 16, d: 12, open: false, roofType: 'hip', grand: true });
  house(gb, 968, -18, { w: 14, d: 11, open: false, roofType: 'hip' });
  fence(gb, 942, 12, 964, 12);

  // 沿街摊贩与杂物
  const streetStalls = [
    [706, 10.5, 0x9a7a4a], [726, -10.5, 0xc8a868], [758, 10.5, 0x8a8a5a],
    [794, -10.5, 0x9a5a48], [806, 10.5, 0xb09868], [848, 10.5, 0x9a7a4a],
    [878, -10.5, 0xc8b088], [896, 10.5, 0xa89058], [912, -10.5, 0x8a8a5a],
  ];
  for (const [sx2, sz2, gc] of streetStalls) {
    stall(gb, sx2, sz2, { ry: (Math.random() - 0.5) * 0.4, goods: gc, awning: Math.random() < 0.7 });
  }
  for (const [ux, uz] of [[718, -10], [772, 10.5], [822, -10.5], [906, 10]]) umbrella(gb, ux, uz, Math.random() < 0.5 ? P.mat : P.paper);
  for (let i = 0; i < 12; i++) {
    const gx = 700 + Math.random() * 230;
    const gz = (Math.random() < 0.5 ? -1 : 1) * (9.5 + Math.random() * 2.5);
    if (Math.random() < 0.5) gb.box(0.8, 0.6, 0.6, vary(P.mat, 0.15), { x: gx, y: 0.3, z: gz, ry: Math.random(), ch: 'reed' });
    else gb.cyl(0.32, 0.26, 0.5, vary(P.rope, 0.15), { x: gx, y: 0.25, z: gz, seg: 6 });
  }
  for (const hx of [694, 734, 776, 818, 868, 908]) {
    gb.box(0.16, 1.2, 0.16, P.woodDark, { x: hx, y: 0.6, z: 9.2, ch: 'wood' });
    gb.sphere(0.11, P.woodDark, { x: hx, y: 1.25, z: 9.2 });
  }
  for (const [bx2, bz2] of [[712, 11.5], [762, -11], [842, 11], [902, -11.5]]) {
    gb.box(1.6, 0.1, 0.35, P.woodLight, { x: bx2, y: 0.5, z: bz2, ch: 'wood' });
    gb.box(0.1, 0.5, 0.3, P.woodLight, { x: bx2 - 0.65, y: 0.25, z: bz2, ch: 'wood' });
    gb.box(0.1, 0.5, 0.3, P.woodLight, { x: bx2 + 0.65, y: 0.25, z: bz2, ch: 'wood' });
  }

  stall(gb, 494, 6, { goods: 0xb09868 });
  stall(gb, 560, -9, { ry: 0.3, goods: 0x9a7a4a });
  umbrella(gb, 500, 8, P.paper);

  wheelbarrow(gb, 712, 4, 0.4);
  wheelbarrow(gb, 800, -6, -0.9);
  cart(gb, 748, 6, 0.1);
  sedan(gb, 782, 5, 1.2);

  /* ---- 构建 ---- */
  scene.add(gb.buildMeshes({ name: 'architecture' }));
  for (const s of signMeshes) scene.add(s);
}
