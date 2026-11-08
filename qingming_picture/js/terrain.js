// 地形：大地、汴河水面、远山、天光
import * as THREE from 'three';
import { P } from './palette.js';
import { WORLD, RIVER, WALL, ROAD } from './layout.js';
import { makeWaterMaterial, makeSky, applyWind } from './materials.js';
import { GeoBuilder } from './geo.js';
import { getTexture } from './textures.js';

// ---- 简易值噪声 ----
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const cA = new THREE.Color(), cB = new THREE.Color();
function lerpColor(hexA, hexB, t, out) {
  cA.set(hexA); cB.set(hexB);
  out.copy(cA).lerp(cB, Math.max(0, Math.min(1, t)));
}

// 地面高度（纯视觉；行走高度见 layout.walkHeight）
function terrainY(x, z) {
  let y = 0;
  // 汴河河槽
  if (x > RIVER.bank0 && x < RIVER.bank1) {
    const t0 = Math.min(1, (x - RIVER.bank0) / 9);
    const t1 = Math.min(1, (RIVER.bank1 - x) / 9);
    const t = Math.min(t0, t1);
    y = RIVER.bedY * (t < 1 ? t * t * (3 - 2 * t) : 1);
  }
  // 远处缓坡与起伏
  const az = Math.abs(z);
  if (az > 150) y += (az - 150) * 0.06 + noise2(x * 0.02, z * 0.02) * 3.5 * ((az - 150) / 80);
  if (x < -20) y += (-20 - x) * 0.04;
  if (x > 1000) y += (x - 1000) * 0.04;
  if (az > 24 && !(x > RIVER.bank0 - 8 && x < RIVER.bank1 + 8)) {
    y += noise2(x * 0.05, z * 0.05) * 0.55 * Math.min(1, (az - 24) / 30);
  }
  return y;
}

export function buildTerrain(scene) {
  const W = WORLD.x1 - WORLD.x0, D = WORLD.z1 - WORLD.z0;
  const segX = 285, segZ = 115;
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(WORLD.x0 + W / 2, 0, WORLD.z0 + D / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const wind = new Float32Array(pos.count);
  const uvs = new Float32Array(pos.count * 2);
  const col = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainY(x, z));

    // ---- 着色 ----
    const az = Math.abs(z);
    const n = noise2(x * 0.11, z * 0.11);
    const n2 = noise2(x * 0.031 + 7.7, z * 0.031);
    let hex;

    const roadHalf = x > WALL.x - 40 ? ROAD.cityHalfW : ROAD.halfW;
    const inRiver = x > RIVER.bank0 && x < RIVER.bank1;

    if (inRiver) {
      hex = P.riverbed;
    } else if (az < roadHalf * (0.8 + n * 0.45)) {
      // 主路
      hex = x > WALL.x - 40 ? P.paving : P.earth;
      if (n2 > 0.62) hex = P.earthDark;
    } else if (x > WALL.x - 30 && az < 60) {
      // 城内街区地面（石板缝）
      hex = n > 0.5 ? P.paving : P.earth;
      const jointX = ((x % 7) + 7) % 7, jointZ = ((z % 5) + 5) % 5;
      if (jointX < 0.9 || jointZ < 0.7) hex = P.earthDark;
    } else if (x < 300) {
      // 郊野田畴：拼布农田
      const cell = Math.floor(x / 26 + 100) * 7 + Math.floor((z + 300) / 20);
      const fields = [P.field1, P.field2, P.field3, P.grass, P.grassDry];
      hex = fields[cell % fields.length];
      if (n > 0.72) hex = P.grassDry;
    } else {
      hex = n > 0.55 ? P.grassDry : P.grass;
      if (az < RIVER.bank1 && x > RIVER.bank0 - 26 && x < RIVER.bank1 + 26 && az < 90) {
        // 河岸带泥土
        if (n2 > 0.45) hex = P.mud;
      }
    }
    // 泛旧色差 + 贴图亮度补偿
    lerpColor(hex, P.silk, 0.10 + n2 * 0.12, col);
    const boost = 1.16;
    colors[i * 3] = Math.min(1, col.r * boost);
    colors[i * 3 + 1] = Math.min(1, col.g * boost);
    colors[i * 3 + 2] = Math.min(1, col.b * boost);
    wind[i] = 0;
    uvs[i * 2] = x * 0.3;
    uvs[i * 2 + 1] = z * 0.3;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aWind', new THREE.BufferAttribute(wind, 1));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  const groundMat = applyWind(new THREE.MeshLambertMaterial({ vertexColors: true, map: getTexture('ground') }));
  const ground = new THREE.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // ---- 汴河水面 ----
  const waterGeo = new THREE.PlaneGeometry(RIVER.bank1 - RIVER.bank0 + 4, D, 24, 90);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, makeWaterMaterial());
  water.position.set((RIVER.x0 + RIVER.x1) / 2, RIVER.waterY, 0);
  water.name = 'water';
  scene.add(water);

  // ---- 远山（水墨剪影） ----
  const gb = new GeoBuilder();
  const hillColor = 0x8f8a74;
  const hills = [
    { x: 150, z: -260, w: 300, h: 42 }, { x: 520, z: -290, w: 420, h: 58 },
    { x: 900, z: -260, w: 320, h: 40 }, { x: 200, z: 265, w: 360, h: 46 },
    { x: 650, z: 285, w: 400, h: 52 }, { x: 1120, z: 80, w: 380, h: 48 },
    { x: -160, z: -60, w: 320, h: 38 },
  ];
  for (const hill of hills) {
    const facing = Math.abs(hill.z) > Math.abs(hill.x - 500) ? 0 : Math.PI / 2;
    gb.grid(2, 24, (i, j) => {
      const u = j / 23 * 2 - 1;
      const y = i === 0
        ? Math.max(0, Math.cos(u * Math.PI / 2)) * hill.h * 0.72 * (0.6 + noise2(j * 0.9 + hill.x, 0) * 0.75)
        : -6;
      return [u * hill.w / 2, y, 0];
    }, hillColor, { x: hill.x, y: 0, z: hill.z, ry: facing, doubleSide: true });
  }
  scene.add(gb.buildMeshes({ chunks: false, cull: false, shadows: false, name: 'hills' }));

  // ---- 天空 ----
  scene.add(makeSky());

  return { ground, water };
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xf2e6c4, 0xa4906c, 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d2, 1.35);
  sun.position.set(120, 180, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 460;
  const S = 95;
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.4;
  scene.add(sun);
  scene.add(sun.target);

  return {
    sun,
    // 太阳阴影相机跟随玩家
    follow(px, pz) {
      sun.position.set(px + 120, 180, pz + 90);
      sun.target.position.set(px, 0, pz);
    },
  };
}
