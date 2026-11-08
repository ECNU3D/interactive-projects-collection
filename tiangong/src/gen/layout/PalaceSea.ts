/**
 * PalaceSea.ts —— 三十三宫七十二殿的布局生成｜文档 02 §3.4
 *
 * 原著只命名了 10 座，其余 95 座未命名 —— 这是程序化生成的合法授权。
 * 算法：主轴 + 递归分形院落；距主轴越远规格越低；固定 seed 保证布局一致。
 * 远处殿宇不生成实体几何——按等级合并为几个 InstancedMesh（等效 impostor 的 draw call 控制）。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, type HallSpec } from '../arch/params';

/** 距主轴越远 → 规格越低（文档 02 §3.4 RANK_BY_DISTANCE） */
export function rankByDistance(d: number): Partial<HallSpec> {
  return {
    bays: d < 1 ? 9 : d < 3 ? 7 : 5,
    depths: d < 1 ? 5 : 3,
    eaves: d < 1 ? 2 : 1,
    podiumTiers: d < 1 ? 3 : d < 3 ? 2 : 1,
    dougongSteps: d < 1 ? 9 : d < 3 ? 7 : 5,
    ridgeBeasts: d < 1 ? 9 : d < 3 ? 7 : 5,
    tileColor: d < 2 ? 'huang' : d < 4 ? 'huang-lv-jianbian' : 'lv',
  } as Partial<HallSpec>;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE: HallSpec = {
  bays: 5,
  depths: 3,
  bayWidth: 5.5,
  columnHeight: 8,
  podiumTiers: 1,
  podiumHeight: 2.4,
  roof: 'wudian',
  eaves: 1,
  finial: null,
  dougongSteps: 5,
  ridgeBeasts: 5,
  tileColor: 'huang',
  doorNails: [7, 7],
};

export interface SeaPlacement {
  x: number;
  z: number;
  rotY: number;
  rank: number;
  spec: HallSpec;
}

/**
 * 布局：主轴两侧 L 层院落，极坐标环形排布。
 * @param count 总数（宫 + 殿 = 105）
 */
export function palaceSeaLayout(count = 105, seed = 20260808): SeaPlacement[] {
  const rand = mulberry32(seed);
  const out: SeaPlacement[] = [];
  let ring = 0;
  while (out.length < count) {
    const inRing = Math.min(10 + ring * 8, count - out.length);
    const radius = 130 + ring * 105;
    for (let i = 0; i < inRing; i++) {
      const ang = (i / inRing) * Math.PI * 2 + rand() * 0.25;
      // 主轴（南北向 z）附近留空，给主轴五节点
      const x = Math.cos(ang) * radius * (0.9 + rand() * 0.25);
      const z = Math.sin(ang) * radius * (1.1 + rand() * 0.3);
      if (Math.abs(x) < 70 && z > -450 && z < 450) continue; // 主轴走廊
      const rank = Math.floor(radius / 130);
      out.push({
        x,
        z,
        rotY: Math.atan2(-x, -z) + (rand() - 0.5) * 0.2, // 大致朝向主轴
        rank,
        spec: { ...BASE, ...rankByDistance(rank), seedJitter: rand() } as HallSpec,
      });
    }
    ring++;
  }
  return out;
}

/**
 * 宫殿海：按等级分组的 InstancedMesh（低细节剪影殿）。
 * 返回 group + 每座殿的占位信息（供命名殿替换/碰撞近似）。
 */
export function buildPalaceSea(placements: SeaPlacement[]): THREE.Group {
  const group = new THREE.Group();
  const byRank = new Map<number, SeaPlacement[]>();
  for (const p of placements) {
    const arr = byRank.get(p.rank) ?? [];
    arr.push(p);
    byRank.set(p.rank, arr);
  }
  for (const [rank, arr] of byRank) {
    // 每等级一个"剪影殿"几何 → 一个 InstancedMesh（draw call 控制的关键，文档 02 §6.1）
    const silhouette = makeSilhouette(arr[0].spec);
    const im = new THREE.InstancedMesh(silhouette.geometry, silhouette.material, arr.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    arr.forEach((p, i) => {
      q.setFromEuler(new THREE.Euler(0, p.rotY, 0));
      m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
    void rank;
  }
  return group;
}

/** 剪影殿：须弥座 + 殿身 + 屋顶三块合并（远景用，~800 tri） */
function makeSilhouette(spec: HallSpec): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  const w = spec.bays * spec.bayWidth * 0.92;
  const d = spec.depths * spec.bayWidth * 0.7;
  const podiumH = spec.podiumHeight;
  const bodyH = spec.columnHeight;
  const parts: { g: THREE.BufferGeometry; c: THREE.Color }[] = [];
  const push = (g: THREE.BufferGeometry, hex: number) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push({ g, c });
  };
  const podium = new THREE.BoxGeometry(w + 6, podiumH, d + 6);
  podium.translate(0, podiumH / 2, 0);
  push(podium, PALETTE.hanBaiYu);
  const body = new THREE.BoxGeometry(w, bodyH, d);
  body.translate(0, podiumH + bodyH / 2, 0);
  push(body, 0xc9b8a0);
  // 屋顶剪影：用压扁的四棱锥近似（举架剪影）
  const roofH = d * 0.55;
  const roof = new THREE.CylinderGeometry(0.001, 1, roofH, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale((w + 8) / Math.SQRT2, 1, (d + 8) / Math.SQRT2);
  roof.translate(0, podiumH + bodyH + roofH / 2, 0);
  push(roof, spec.tileColor === 'lv' ? PALETTE.liuliLv : PALETTE.liuliHuang);
  const merged = mergeGeometries(parts.map((p) => p.g))!;
  merged.computeVertexNormals();
  const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 });
  return { geometry: merged, material };
}
