/**
 * PeachTree.ts —— 蟠桃树｜文档 01 §1.2 K / 文档 03 §9
 *
 * 视觉铁律：「时开时结千年熟，无夏无冬万载迟」——同一棵树上花与果并存。
 * 三段梯度：前段青小 → 中段丰满 → 后段紫纹缃核。
 *
 * 三级 LOD（三千六百株全部实体化，靠 LOD 控面数，不减株数）：
 *   L0 近景 ~700 tri｜L1 中景 ~260 tri｜L2 远景 ~70 tri
 * 三级共用同一套随机序列，树干/分枝/花果的**位置完全一致**，
 * 切档只换网格精度，不换形状 —— 所以看不到跳变。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type PeachSection = 'front' | 'mid' | 'back';
/** 0 = 近景实体，1 = 中景，2 = 远景剪影 */
export type PeachLod = 0 | 1 | 2;

const SECTION_STYLE = {
  front: { blossom: 0xf4c8cc, fruit: 0x9fb36a, fruitSize: 0.16, density: 0.7 }, // 花微果小，青皮
  mid: { blossom: 0xf0b4bc, fruit: 0xd9897a, fruitSize: 0.24, density: 1.0 }, // 层花甘实
  back: { blossom: 0xe8a0a8, fruit: 0xc9433f, fruitSize: 0.3, density: 1.25 }, // 紫纹缃核，饱满
} as const;

/**
 * 每级 LOD 的网格精度。株数、花果数量与位置不随 LOD 变化（原著三千六百株是硬设定），
 * 变的只是每个花/果/叶团用几个三角形画。
 */
const LOD_DETAIL: Record<PeachLod, {
  trunkSeg: number;
  branchSeg: number;
  /** 叶冠细分（IcosahedronGeometry detail） */
  crownDetail: number;
  /** 花：绘制比例（其余仍参与随机序列，只是不出网格） */
  blossomKeep: number;
  blossomDetail: number;
  fruitKeep: number;
  fruitSeg: [number, number];
}> = {
  0: { trunkSeg: 6, branchSeg: 5, crownDetail: 1, blossomKeep: 1, blossomDetail: 0, fruitKeep: 1, fruitSeg: [6, 4] },
  1: { trunkSeg: 5, branchSeg: 4, crownDetail: 0, blossomKeep: 0.5, blossomDetail: 0, fruitKeep: 0.6, fruitSeg: [5, 3] },
  2: { trunkSeg: 4, branchSeg: 0, crownDetail: 0, blossomKeep: 0, blossomDetail: 0, fruitKeep: 0.25, fruitSeg: [4, 2] },
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 一棵蟠桃树：弯曲树干 + 2 层分枝 + 叶冠团 + 花与果（并存！）。
 * 全部合并为一个 BufferGeometry，顶点色区分材质（干/叶/花/果）。
 */
export function buildPeachTree(section: PeachSection, seed = 1, lod: PeachLod = 0): THREE.BufferGeometry {
  const rand = rng(seed * 7919 + 13);
  const style = SECTION_STYLE[section];
  const D = LOD_DETAIL[lod];
  const parts: THREE.BufferGeometry[] = [];
  const trunkCol = new THREE.Color(0x6b4a3a);
  const leafCol = new THREE.Color(0x5a7a4a);
  const blossomCol = new THREE.Color(style.blossom);
  const fruitCol = new THREE.Color(style.fruit);

  function push(g: THREE.BufferGeometry, c: THREE.Color): void {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  }

  // 树干（弯）
  const lean = (rand() - 0.5) * 0.35;
  const trunk = new THREE.CylinderGeometry(0.14, 0.24, 2.6, D.trunkSeg);
  trunk.translate(0, 1.3, 0);
  trunk.rotateZ(lean);
  push(trunk, trunkCol);

  // 分枝 3–5 条（远景不画枝，只留干和冠——几十米外看不见枝）
  const nBr = 3 + Math.floor(rand() * 3);
  const tips: THREE.Vector3[] = [];
  for (let i = 0; i < nBr; i++) {
    const ang = (i / nBr) * Math.PI * 2 + rand() * 0.8;
    const tilt = 0.5 + rand() * 0.5;
    const len = 1.4 + rand() * 0.9;
    if (D.branchSeg > 0) {
      const br = new THREE.CylinderGeometry(0.05, 0.1, len, D.branchSeg);
      br.translate(0, len / 2, 0);
      br.rotateX(tilt);
      br.rotateY(ang);
      br.translate(lean * 2.2, 2.4, 0);
      push(br, trunkCol);
    }
    tips.push(
      new THREE.Vector3(Math.sin(ang) * Math.sin(tilt) * len + lean * 2.2, 2.4 + Math.cos(tilt) * len, Math.cos(ang) * Math.sin(tilt) * len),
    );
  }

  // 叶冠团 + 花 + 果
  for (const tip of tips) {
    const crown = new THREE.IcosahedronGeometry(0.85 + rand() * 0.5, D.crownDetail);
    crown.scale(1.25, 0.75, 1.25);
    crown.translate(tip.x, tip.y + 0.25, tip.z);
    push(crown, leafCol);

    // 花：小球簇（胭脂）。低档只画一部分，但随机序列照走，位置不漂移。
    const nBlossom = Math.round(7 * style.density);
    const blossomDraw = Math.round(nBlossom * D.blossomKeep);
    for (let b = 0; b < nBlossom; b++) {
      const th = rand() * Math.PI * 2;
      const ph = rand() * Math.PI;
      const r = 0.9 + rand() * 0.45;
      const rr = rand();
      if (b >= blossomDraw) continue;
      // 花只有 9–14cm，用八面体足够；原先的二十面体在三千六百株上翻了 2.5 倍面数
      const bl = new THREE.OctahedronGeometry(0.09 + rr * 0.05, D.blossomDetail);
      bl.translate(
        tip.x + Math.sin(ph) * Math.cos(th) * r * 1.25,
        tip.y + 0.25 + Math.cos(ph) * r * 0.75,
        tip.z + Math.sin(ph) * Math.sin(th) * r * 1.25,
      );
      push(bl, blossomCol);
    }
    // 果：与花并存（锦弹垂枝）
    const nFruit = Math.round(4 * style.density);
    const fruitDraw = Math.max(1, Math.round(nFruit * D.fruitKeep));
    for (let fIdx = 0; fIdx < nFruit; fIdx++) {
      const th = rand() * Math.PI * 2;
      const r = 0.6 + rand() * 0.5;
      const drop = rand();
      if (fIdx >= fruitDraw) continue;
      const fr = new THREE.SphereGeometry(style.fruitSize, D.fruitSeg[0], D.fruitSeg[1]);
      fr.scale(1, 1.15, 1); // 桃形略长
      fr.translate(tip.x + Math.cos(th) * r, tip.y - 0.15 - drop * 0.4, tip.z + Math.sin(th) * r);
      push(fr, fruitCol);
    }
  }

  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  merged.computeVertexNormals();
  return merged;
}
