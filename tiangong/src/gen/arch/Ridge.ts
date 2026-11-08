/**
 * Ridge.ts —— 正吻、脊兽｜文档 02 §3.3 / 文档 03 §1.3
 *
 * 脊兽顺序：龙、凤、狮子、天马、海马、狻猊、狎鱼、獬豸、斗牛、行什，前置骑凤仙人。
 * 简化为渐变尺寸的小兽剪影（instanced）；灵霄宝殿全场唯一 10 兽 + 骑凤仙人。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const RIDGE_BEAST_NAMES = ['龙', '凤', '狮子', '天马', '海马', '狻猊', '狎鱼', '獬豸', '斗牛', '行什'];

/** 正吻（鸱吻吞脊）：剑把 + 吞口剪影 */
export function chiwenGeometry(h = 2.2): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(h * 0.45, h, h * 0.3);
  body.translate(0, h / 2, 0);
  const tail = new THREE.BoxGeometry(h * 0.18, h * 0.5, h * 0.5);
  tail.translate(0, h * 0.95, -h * 0.1);
  const mouth = new THREE.CylinderGeometry(h * 0.22, h * 0.28, h * 0.35, 6);
  mouth.translate(0, h * 0.18, h * 0.12);
  const merged = mergeGeometries([body, tail, mouth])!;
  merged.computeVertexNormals();
  return merged;
}

/** 单个脊兽剪影（小兽蹲坐） */
export function ridgeBeastGeometry(scale = 1): THREE.BufferGeometry {
  const body = new THREE.ConeGeometry(0.22 * scale, 0.55 * scale, 5);
  body.translate(0, 0.28 * scale, 0);
  const head = new THREE.SphereGeometry(0.16 * scale, 6, 5);
  head.translate(0, 0.62 * scale, 0.05 * scale);
  const merged = mergeGeometries([body, head])!;
  merged.computeVertexNormals();
  return merged;
}

/** 骑凤仙人（最前） */
export function immortalGeometry(scale = 1): THREE.BufferGeometry {
  const bird = new THREE.ConeGeometry(0.2 * scale, 0.5 * scale, 5);
  bird.rotateX(Math.PI / 2.4);
  bird.translate(0, 0.15 * scale, 0);
  const rider = new THREE.CapsuleGeometry(0.1 * scale, 0.25 * scale, 3, 6);
  rider.translate(0, 0.42 * scale, -0.05 * scale);
  const merged = mergeGeometries([bird, rider])!;
  merged.computeVertexNormals();
  return merged;
}
