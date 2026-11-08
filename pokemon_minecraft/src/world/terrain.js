// 地形与群系（设计文档 §4）：512×512 世界、2 层 simplex 叠加高度图、5 群系
// 纯 JS（不依赖 THREE），Node 可直接测试
import { makeNoise2D, fbm2 } from './noise.js';

export const WORLD_SIZE = 512;
export const CHUNK = 16;
export const MAX_Y = 48;
export const WATER_LEVEL = 20;

export const BIOME_ID = { grass:0, forest:1, lake:2, volcano:3, snow:4 };
export const BIOME_KEY = ['grass','forest','lake','volcano','snow'];

// 村庄固定布局（§4.2）：坐落在群系交界处
export const VILLAGES = [
  { key:'grass',   name:'草原村', x:256, z:256, r:30, baseH:21, hasGym:'rock' },
  { key:'lake',    name:'湖畔村', x:256, z:392, r:26, baseH:22, hasGym:null },
  { key:'volcano', name:'火山村', x:200, z:118, r:26, baseH:24, hasGym:'fire' },
];

const noiseA = makeNoise2D(20260719);   // 高度
const noiseB = makeNoise2D(91573001);   // 群系扰动
const noiseC = makeNoise2D(55533311);   // 岩浆/冰面/装饰

export function idx(x, z) { return z * WORLD_SIZE + x; }

// 群系判定：中心草原，东森林、南湖泊、北火山、西雪山（噪声扰动边界）
export function biomeAt(x, z) {
  const dx = x - 256, dz = z - 256;
  const wob = noiseB(x * 0.015, z * 0.015) * 24;
  if (Math.hypot(dx, dz) + wob < 92) return BIOME_ID.grass;
  const ax = x + noiseB(x * 0.01 + 50, z * 0.01) * 36;
  const az = z + noiseB(x * 0.01, z * 0.01 + 90) * 36;
  const scores = [
    [BIOME_ID.forest,  ax - 348],
    [BIOME_ID.lake,    az - 352],
    [BIOME_ID.volcano, 152 - az],
    [BIOME_ID.snow,    152 - ax],
  ];
  let best = BIOME_ID.grass, bs = 0;
  for (const [b, s] of scores) if (s > bs) { bs = s; best = b; }
  return best;
}

// 原始高度（未做村庄整平）
function rawHeight(x, z, biome) {
  const n = fbm2(noiseA, x * 0.02, z * 0.02, 2);
  const n2 = fbm2(noiseA, x * 0.055 + 300, z * 0.055, 2);
  switch (biome) {
    case BIOME_ID.grass:   return Math.round(20 + n * 2.5 + n2 * 1.2);
    case BIOME_ID.forest:  return Math.round(20 + n * 4 + n2 * 1.5);
    case BIOME_ID.lake: {
      // 浅水湖床（1~3 格深，可涉水）；越深入湖泊越低
      const depth = Math.min(1, Math.max(0, (z - 352) / 60));
      return Math.round(21 - depth * (3 + n * 1.5) + n2 * 1.0);
    }
    case BIOME_ID.volcano: {
      let h = 22 + Math.abs(n) * 7 + n2 * 2;
      // 岩浆池：噪声高处挖出低洼
      const lava = noiseC(x * 0.03, z * 0.03);
      if (lava > 0.42) h = 21;
      return Math.round(h);
    }
    case BIOME_ID.snow: {
      const m = Math.abs(n);
      return Math.round(22 + m * 12 + n2 * 2);
    }
  }
  return 21;
}

// 村庄整平系数（1=完全整平）
function villageBlend(x, z, v) {
  const d = Math.hypot(x - v.x, z - v.z);
  if (d >= v.r) return 0;
  const t = 1 - d / v.r;
  return Math.min(1, t * 2.2);
}

// 世界数据一次性生成
export function generateTerrain() {
  const N = WORLD_SIZE * WORLD_SIZE;
  const groundH = new Uint8Array(N);
  const biome = new Uint8Array(N);
  const sand = new Uint8Array(N);
  const ice = new Uint8Array(N);
  const lava = new Uint8Array(N);

  for (let z = 0; z < WORLD_SIZE; z++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const i = idx(x, z);
      const b = biomeAt(x, z);
      biome[i] = b;
      let h = rawHeight(x, z, b);
      // 村庄整平
      for (const v of VILLAGES) {
        const t = villageBlend(x, z, v);
        if (t > 0) h = Math.round(h * (1 - t) + v.baseH * t);
      }
      h = Math.max(8, Math.min(MAX_Y - 4, h));
      groundH[i] = h;

      // 沙滩：湖泊群系且贴近水面
      if (b === BIOME_ID.lake && h >= WATER_LEVEL - 1 && h <= WATER_LEVEL + 1) sand[i] = 1;
      // 岩浆：火山群系的低洼
      if (b === BIOME_ID.volcano && h <= 21 && noiseC(x * 0.03, z * 0.03) > 0.42) lava[i] = 1;
      // 冰面：雪山低处冻结水面
      if (b === BIOME_ID.snow && h <= WATER_LEVEL + 1) ice[i] = 1;
    }
  }
  return { groundH, biome, sand, ice, lava };
}

// 各群系方块颜色（顶面/侧面）
export function columnColors(terrain, x, z) {
  const i = idx(x, z);
  const b = terrain.biome[i];
  if (terrain.lava[i]) return { top: 0xE85A10, side: 0xB8430A, glow: true };
  if (terrain.ice[i])  return { top: 0xBFE3F2, side: 0x9FC8DC };
  if (terrain.sand[i]) return { top: 0xE4D9A8, side: 0xD4C491 };
  switch (b) {
    case BIOME_ID.grass:   return { top: 0x79B94C, side: 0x8A6A48 };
    case BIOME_ID.forest:  return { top: 0x5DA347, side: 0x7A5A40 };
    case BIOME_ID.lake: {
      const h = terrain.groundH[i];
      return h < WATER_LEVEL ? { top: 0xD8C89A, side: 0xC4B488 } : { top: 0x79B94C, side: 0x8A6A48 };
    }
    case BIOME_ID.volcano: return { top: 0x6A6A70, side: 0x55555C };
    case BIOME_ID.snow:    return { top: 0xF0F6F8, side: 0xD8E0E4 };
  }
  return { top: 0x79B94C, side: 0x8A6A48 };
}

// 确定性哈希（装饰摆放用）
export function hash2(x, z, salt = 0) {
  let h = (x * 374761393 + z * 668265263 + salt * 1442695040888963407) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
