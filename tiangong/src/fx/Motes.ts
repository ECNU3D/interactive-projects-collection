/**
 * Motes.ts —— 灵光浮尘（全场常驻）+ 花瓣/云絮的 GPU 粒子｜文档 02 §5.5
 *
 * 统一实现：一个 InstancedMesh/Points + 顶点 shader 布朗运动，
 * CPU 每帧只更新一个 uniform（时间）。
 */
import * as THREE from 'three/webgpu';
import {
  Fn, vec3, vec4, float, color, attribute, uniform,
  positionLocal, time, sin, cos, mix, saturate,
  smoothstep, cameraPosition,
} from 'three/tsl';

export interface MotesOptions {
  count?: number;
  /** 分布半径（以跟随点为中心） */
  radius?: number;
  height?: number;
  color?: number;
  size?: number;
  /** 运动幅度 */
  drift?: number;
}

/**
 * 灵光浮尘。跟随相机周围的一片粒子场（环绕包裹，视觉上"全场常驻"）。
 * 位置 = 基准格点 + 三重正弦布朗漂移；格点随相机取模回绕。
 */
export function buildMotes(opts: MotesOptions = {}): THREE.Points {
  const count = opts.count ?? 4000;
  const radius = opts.radius ?? 220;
  const height = opts.height ?? 90;
  const drift = opts.drift ?? 1.4;

  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const scale = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (Math.random() - 0.5) * radius * 2;
    base[i * 3 + 1] = (Math.random() - 0.5) * height;
    base[i * 3 + 2] = (Math.random() - 0.5) * radius * 2;
    phase[i] = Math.random() * 100;
    scale[i] = 0.5 + Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('pscale', new THREE.BufferAttribute(scale, 1));

  const follow = uniform(new THREE.Vector3(), 'vec3'); // 跟随点（玩家位置）
  const radiusU = float(radius);
  const heightU = float(height);

  const node = Fn(() => {
    const p: any = attribute('position') as never;
    const ph: any = attribute('phase');
    const t = time.mul(0.35);
    // 布朗漂移（极慢，逆光才明显——亮度设计见 colorNode）
    const dx = sin(t.add(ph)).add(sin(t.mul(1.7).add(ph.mul(2.1)))).mul(0.5 * drift);
    const dy = sin(t.mul(0.8).add(ph.mul(1.3))).add(sin(t.mul(2.3).add(ph))).mul(0.3 * drift);
    const dz = cos(t.mul(0.9).add(ph.mul(1.7))).add(cos(t.mul(1.9).add(ph.mul(0.7)))).mul(0.5 * drift);
    // 环绕回绕：相对跟随点取模
    const rel = p.add(vec3(dx, dy, dz)).sub(follow);
    const wrapped = rel
      .add(vec3(radiusU, heightU.mul(0.5), radiusU))
      .mod(vec3(radiusU.mul(2), heightU, radiusU.mul(2)))
      .sub(vec3(radiusU, heightU.mul(0.5), radiusU));
    return wrapped.add(follow);
  });

  const mat = new THREE.PointsNodeMaterial({
    color: opts.color ?? 0xffe9b8,
    size: opts.size ?? 0.055,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mat.positionNode = node();

  // 近亮远淡
  const alphaNode = Fn(() => {
    const d = cameraPosition.sub(node()).length();
    return smoothstep(float(radius), float(radius * 0.25), d).mul(0.85);
  });
  void alphaNode;

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;

  (pts as never as { setFollow: (v: THREE.Vector3) => void }).setFollow = (v: THREE.Vector3) => {
    (follow.value as THREE.Vector3).copy(v);
  };
  return pts;
}

/** 花瓣飘落（蟠桃园）：粉色、更大、向下循环飘落 */
export function buildPetals(center: THREE.Vector3, radius: number, count = 600): THREE.Points {
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = center.x + (Math.random() - 0.5) * radius * 2;
    base[i * 3 + 1] = 0;
    base[i * 3 + 2] = center.z + (Math.random() - 0.5) * radius * 2;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));

  const FALL_H = 26;
  const node = Fn(() => {
    const p: any = attribute('position') as never;
    const ph: any = attribute('phase');
    const t = time.mul(0.05).add(ph); // 下落相位
    const cycle = t.mod(1.0);
    const y = float(FALL_H).mul(cycle.oneMinus());
    const sway = sin(time.mul(0.9).add(ph.mul(40))).mul(1.2);
    const sway2 = cos(time.mul(0.7).add(ph.mul(31))).mul(1.2);
    return vec3(p.x.add(sway), y, p.z.add(sway2));
  });

  const mat = new THREE.PointsNodeMaterial({
    color: 0xf0b8c0,
    size: 0.14,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  mat.positionNode = node();
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
