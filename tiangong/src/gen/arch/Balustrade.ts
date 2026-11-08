/**
 * Balustrade.ts —— 栏杆望柱 + 螭首｜文档 02 §3.1 / 文档 03 §1.4
 * 一根望柱 + 一块栏板 = 两个 InstancedMesh；螭首是台基边缘的排水兽首。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** 单根望柱（含云拱柱头简化） */
export function balusterPostGeometry(h = 1.6): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(0.09, 0.11, h, 6);
  shaft.translate(0, h / 2, 0);
  const cap = new THREE.SphereGeometry(0.14, 6, 5);
  cap.translate(0, h + 0.08, 0);
  const merged = mergeGeometries([shaft, cap])!;
  merged.computeVertexNormals();
  return merged;
}

/** 单块栏板 */
export function balustradePanelGeometry(len = 2.2, h = 1.1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(len, h, 0.12);
  g.translate(len / 2, h / 2 + 0.15, 0);
  return g;
}

/** 螭首（排水兽首，简化：方喙 + 收头） */
export function chishouGeometry(): THREE.BufferGeometry {
  const head = new THREE.BoxGeometry(0.5, 0.42, 0.9);
  head.translate(0, 0, 0.45);
  const snout = new THREE.BoxGeometry(0.34, 0.26, 0.5);
  snout.translate(0, -0.05, 1.05);
  const merged = mergeGeometries([head, snout])!;
  merged.computeVertexNormals();
  return merged;
}

/**
 * 沿矩形周边布置望柱/栏板/螭首的 instance 矩阵。
 */
export function balustradePlacements(
  halfW: number,
  halfD: number,
  y: number,
  spacing = 2.2,
): { posts: THREE.Matrix4[]; panels: THREE.Matrix4[]; dragons: THREE.Matrix4[] } {
  const posts: THREE.Matrix4[] = [];
  const panels: THREE.Matrix4[] = [];
  const dragons: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);

  const edges = [
    { len: halfW * 2, rot: 0, ox: 0, oz: halfD, dx: 1, dz: 0 },
    { len: halfW * 2, rot: Math.PI, ox: 0, oz: -halfD, dx: -1, dz: 0 },
    { len: halfD * 2, rot: Math.PI / 2, ox: halfW, oz: 0, dx: 0, dz: -1 },
    { len: halfD * 2, rot: -Math.PI / 2, ox: -halfW, oz: 0, dx: 0, dz: 1 },
  ];
  for (const e of edges) {
    const n = Math.max(2, Math.round(e.len / spacing));
    const step = e.len / n;
    for (let i = 0; i <= n; i++) {
      const t = -e.len / 2 + i * step;
      const x = e.ox + e.dx * t;
      const z = e.oz + e.dz * t;
      q.setFromEuler(new THREE.Euler(0, e.rot, 0));
      m.compose(new THREE.Vector3(x, y, z), q, s);
      posts.push(m.clone());
      if (i < n) {
        m.compose(new THREE.Vector3(x + e.dx * 0, y, z), q, s);
        // 栏板起点对齐相邻望柱
        const p = m.clone();
        p.setPosition(x, y, z);
        panels.push(p);
      }
    }
    // 螭首：每边 3–5 个，外挑
    const dn = Math.max(3, Math.round(e.len / 14));
    for (let i = 0; i < dn; i++) {
      const t = -e.len / 2 + ((i + 0.5) / dn) * e.len;
      const x = e.ox + e.dx * t;
      const z = e.oz + e.dz * t;
      q.setFromEuler(new THREE.Euler(0, e.rot, 0));
      m.compose(new THREE.Vector3(x, y - 0.5, z), q, s);
      dragons.push(m.clone());
    }
  }
  return { posts, panels, dragons };
}
