/**
 * Podium.ts —— 须弥座台基｜文档 02 §3.1 / 文档 03 §1.4
 * 分层（自下而上）：圭角—下枋—下枭—束腰—上枭—上枋。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** 单层须弥座 */
export function buildXumizuo(width: number, depth: number, height: number): THREE.BufferGeometry {
  // 各层：圭角 18% / 下枋 12% / 下枭 12% / 束腰 28% / 上枭 12% / 上枋 18%
  const layers: { h: number; inset: number }[] = [
    { h: 0.18, inset: 0.0 }, // 圭角（最宽）
    { h: 0.12, inset: 0.35 },
    { h: 0.12, inset: 0.55 }, // 下枭（最收）
    { h: 0.28, inset: 0.45 }, // 束腰
    { h: 0.12, inset: 0.55 },
    { h: 0.18, inset: 0.3 }, // 上枋
  ];
  const parts: THREE.BufferGeometry[] = [];
  let y = 0;
  for (const l of layers) {
    const h = height * l.h;
    const g = new THREE.BoxGeometry(width - l.inset * 2, h, depth - l.inset * 2);
    g.translate(0, y + h / 2, 0);
    parts.push(g);
    y += h;
  }
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  return merged;
}

/**
 * 多层台基（三台）：逐层收分、加宽出平台。
 * @returns 几何与顶面标高
 */
export function buildPodium(
  width: number,
  depth: number,
  tiers: 0 | 1 | 2 | 3,
  totalHeight: number,
): { geometry: THREE.BufferGeometry; topY: number } {
  if (tiers === 0) {
    const g = new THREE.BoxGeometry(width, totalHeight, depth);
    g.translate(0, totalHeight / 2, 0);
    return { geometry: g, topY: totalHeight };
  }
  const parts: THREE.BufferGeometry[] = [];
  const tierH = totalHeight / tiers;
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    // 上层比下层每边收 ~4m（三台实测逐层收进）
    const grow = (tiers - 1 - i) * 8;
    const g = buildXumizuo(width + grow, depth + grow, tierH);
    g.translate(0, y, 0);
    parts.push(g);
    y += tierH;
  }
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  return { geometry: merged, topY: totalHeight };
}
