/**
 * materials.ts —— 三套材质预设（TSL / MeshPhysicalNodeMaterial）｜文档 02 §5.7
 *
 * 鎏金铜：metalness 1.0, roughness 0.25 —— 灵霄宝殿、金顶、法宝（照武当金殿）
 * 琉璃瓦：clearcoat 1.0 —— 釉面与陶胎分离，是宫殿"亮起来"的原因
 * 汉白玉：微弱透射 —— 须弥座、栏杆、丹陛
 */
import * as THREE from 'three/webgpu';
import { color, float, sin, uv, positionLocal, mx_fractal_noise_vec3, mul, add, mix } from 'three/tsl';
import { PALETTE } from './params';

const cache = new Map<string, THREE.Material>();

/** 琉璃瓦（含瓦垄条纹 + 顶点色剪边） */
export function glazedTileMaterial(baseColor: number, striped = true): THREE.Material {
  const key = `tile-${baseColor}-${striped}`;
  if (cache.has(key)) return cache.get(key)!;
  const m = new THREE.MeshPhysicalNodeMaterial({
    color: baseColor,
    metalness: 0.0,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  if (striped) {
    // 瓦垄：沿 UV.x 的正弦明暗（UV 为世界尺度，垄距 0.28m）
    const stripe = sin(uv().x.mul(Math.PI * 2 / 0.28)).mul(0.06).add(0.97);
    m.colorNode = color(baseColor).mul(stripe);
  }
  cache.set(key, m);
  return m;
}

/** 鎏金铜（武当金殿质感）。emissive 供 selective bloom */
export function giltBronzeMaterial(emissiveBoost = 0): THREE.Material {
  const key = `gilt-${emissiveBoost}`;
  if (cache.has(key)) return cache.get(key)!;
  const m = new THREE.MeshPhysicalNodeMaterial({
    color: PALETTE.jinqueJin,
    metalness: 0.9,
    roughness: 0.32,
    anisotropy: 0.3,
    envMapIntensity: 1.6, // 弱环境下金属不发黑（文档 03 §5.2：天宫没有真正的暗部）
  });
  // 基础微光：鎏金铜在逆光/阴影里也保一点暖金（文档 03 §5.2 没有真正的暗部）
  m.emissive = new THREE.Color(PALETTE.jinqueJin);
  m.emissiveIntensity = 0.3 + emissiveBoost;
  cache.set(key, m);
  return m;
}

/** 汉白玉 */
export function marbleMaterial(): THREE.Material {
  if (cache.has('marble')) return cache.get('marble')!;
  const m = new THREE.MeshPhysicalNodeMaterial({
    color: PALETTE.hanBaiYu,
    metalness: 0,
    roughness: 0.6,
    transmission: 0.05,
    thickness: 0.5,
  });
  cache.set('marble', m);
  return m;
}

/** 朱漆（柱、门、窗） */
export function vermilionMaterial(): THREE.Material {
  if (cache.has('vermilion')) return cache.get('vermilion')!;
  const m = new THREE.MeshStandardNodeMaterial({
    color: PALETTE.zhuMenHong,
    metalness: 0.05,
    roughness: 0.55,
  });
  cache.set('vermilion', m);
  return m;
}

/** 墙面（淡粉白，明代宫墙抹灰） */
export function plasterMaterial(tint = 0xd8c9b0): THREE.Material {
  const key = `plaster-${tint}`;
  if (cache.has(key)) return cache.get(key)!;
  const m = new THREE.MeshStandardNodeMaterial({ color: tint, metalness: 0, roughness: 0.85 });
  cache.set(key, m);
  return m;
}

/** 深色殿内（开门后的深不见底） */
export function interiorMaterial(): THREE.Material {
  if (cache.has('interior')) return cache.get('interior')!;
  const m = new THREE.MeshBasicNodeMaterial({ color: 0x140f0a, side: THREE.BackSide });
  cache.set('interior', m);
  return m;
}

/** 木构彩画简化：斗拱用（青绿为主，描金边不做了） */
export function dougongMaterial(): THREE.Material {
  if (cache.has('dougong')) return cache.get('dougong')!;
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x4a6b5d, metalness: 0.1, roughness: 0.7 });
  cache.set('dougong', m);
  return m;
}

export function clearMaterialCache(): void {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}
