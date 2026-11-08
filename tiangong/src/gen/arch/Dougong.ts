/**
 * Dougong.ts —— 斗拱｜文档 02 §3.3
 *
 * 单攒 = 1 个合并 BufferGeometry（约 300–800 tri）；
 * 全场的斗拱按「踩数 × 位置类型」分组为 InstancedMesh。
 * 明代特征：密而小——平身科每间 6–8 攒。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type DougongSteps = 3 | 5 | 7 | 9;
export type DougongType = 'pingshen' | 'zhutou' | 'jiao';

const cache = new Map<string, THREE.BufferGeometry>();

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/**
 * 单攒斗拱。D = 斗口（九踩大殿取 0.10m）。
 * 踩数 = 2 × 出跳数 + 1。自下而上：坐斗 → 逐跳(出跳构件+十八斗+横栱) → 耍头/撑头木/桁椀。
 * 朝向：+z 为檐面外侧。
 */
export function buildDougong(steps: DougongSteps, type: DougongType = 'pingshen', D = 0.1): THREE.BufferGeometry {
  const key = `${steps}-${type}-${D}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const parts: THREE.BufferGeometry[] = [];
  const jump = 3.0 * D; // 每跳出跳
  const angLift = 0.55 * D; // 昂的斜削抬升
  let y = 0;

  // 0 坐斗（大斗）：长 3D × 宽 3D × 高 2D；柱头科加大
  const zuodouW = type === 'zhutou' ? 4.0 * D : 3.0 * D;
  parts.push(box(zuodouW, 2.0 * D, 3.0 * D, 0, y + 1.0 * D, 0));
  y += 2.0 * D;

  const jumps = (steps - 1) / 2;
  for (let i = 0; i < jumps; i++) {
    const isAng = i > 0; // 第二跳起为昂（斜向构件）
    const out = jump * (i + 0.5);
    // 出跳构件（翘/昂）：垂直檐面，前后对称出跳
    const len = jump * (i + 1) + 2.0 * D;
    const pitch = isAng ? -0.18 : 0; // 昂嘴斜削
    parts.push(box(1.0 * D, 1.4 * D, len, 0, y + 0.7 * D + (isAng ? angLift * 0.5 : 0), isAng ? 0.2 * D : 0, pitch));
    // 十八斗：每跳里外端各 1 个
    for (const s of [-1, 1]) {
      parts.push(box(1.8 * D, 1.0 * D, 1.48 * D, 0, y + 1.4 * D + (isAng ? angLift : 0), s * out));
    }
    // 横栱（瓜栱/万栱，平行檐面）：长随跳数
    const gongLen = (i === 0 ? 6.2 : 9.2) * D;
    parts.push(box(gongLen, 1.1 * D, 1.0 * D, 0, y + 2.1 * D + (isAng ? angLift : 0), out));
    parts.push(box(gongLen, 1.1 * D, 1.0 * D, 0, y + 2.1 * D + (isAng ? angLift : 0), -out));
    // 三才升：横栱两端
    for (const s of [-1, 1]) {
      for (const o of [out, -out]) {
        parts.push(box(1.3 * D, 1.0 * D, 1.3 * D, s * gongLen * 0.44, y + 3.0 * D + (isAng ? angLift : 0), o));
      }
    }
    y += 3.2 * D + (isAng ? angLift : 0);
  }

  // 耍头 + 撑头木 + 桁椀
  parts.push(box(1.2 * D, 1.2 * D, jump * jumps + 3 * D, 0, y + 0.6 * D, 0.3 * D, -0.12));
  y += 1.6 * D;
  parts.push(box(1.4 * D, 1.0 * D, jump * jumps + 2 * D, 0, y + 0.5 * D, 0));
  y += 1.5 * D;
  parts.push(box(2.2 * D, 1.2 * D, 2.2 * D, 0, y + 0.4 * D, jump * jumps * 0.5)); // 桁椀承挑檐桁

  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  cache.set(key, merged);
  return merged;
}

/** 一座殿的斗拱布点：返回 { type, matrix } 列表，供 InstancedMesh */
export function dougongPlacements(
  halfW: number,
  halfD: number,
  yBase: number,
  perBay: number,
  D: number,
  steps: DougongSteps,
): { type: DougongType; m: THREE.Matrix4 }[] {
  const out: { type: DougongType; m: THREE.Matrix4 }[] = [];
  const jumps = (steps - 1) / 2;
  const totalH = (2 + jumps * 3.2 + 3) * D;
  const y = yBase - totalH; // 桁椀顶住檐檩 → 倒推坐斗高度
  const m = new THREE.Matrix4();

  // 四角：角科
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      m.makeRotationY(sx * sz > 0 ? Math.PI / 4 : -Math.PI / 4);
      m.setPosition(sx * halfW, y, sz * halfD);
      out.push({ type: 'jiao', m: m.clone() });
    }
  }
  // 四面平身科（前后檐 + 两山），柱头科落在柱位由调用方按间距混入
  const spacing = 1 / (perBay + 1);
  const faces: { len: number; rot: number; cx: number; cz: number; dx: number; dz: number }[] = [
    { len: halfW * 2, rot: 0, cx: 0, cz: halfD, dx: 1, dz: 0 },
    { len: halfW * 2, rot: Math.PI, cx: 0, cz: -halfD, dx: -1, dz: 0 },
    { len: halfD * 2, rot: Math.PI / 2, cx: halfW, cz: 0, dx: 0, dz: -1 },
    { len: halfD * 2, rot: -Math.PI / 2, cx: -halfW, cz: 0, dx: 0, dz: 1 },
  ];
  for (const f of faces) {
    const count = Math.max(2, Math.round((f.len / 8) * perBay));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5;
      const x = f.cx + f.dx * t * f.len;
      const z = f.cz + f.dz * t * f.len;
      // 角部让位给角科
      if (Math.abs(Math.abs(x) - halfW) < 1.2 && Math.abs(Math.abs(z) - halfD) < 1.2) continue;
      m.makeRotationY(f.rot);
      m.setPosition(x, y, z);
      out.push({ type: 'pingshen', m: m.clone() });
    }
  }
  return out;
}

export const DOUGONG_D = 0.1;
