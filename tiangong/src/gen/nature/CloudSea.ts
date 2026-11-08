/**
 * CloudSea.ts —— 云海（分层平面方案）｜文档 02 §5.2 降级方案 / 文档 03 §3
 *
 * 8–12 层水平半透明平面，每层滚动 fbm 噪声，高度/速度/透明度各异。
 * 云洞用「覆盖度贴图」（文档 03 §3.3）：由控制点在 JS 侧烘焙成 DataTexture，
 * 负值挖洞（灵霄金顶露出、蟠桃园开洞），正值压厚（斩妖台常年阴着）。
 * 配色：暗部碧雾青偏紫，亮部琼香白偏暖金，太阳侧染金（文档 03 §3.2）。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three/webgpu';
import { QualityManager, type Tier } from '../../core/Quality';
import {
  Fn, uniform, vec2, vec3, vec4, float, attribute, texture,
  positionWorld, time, mix, saturate, pow, dot, normalize,
  mx_fractal_noise_float, smoothstep,
} from 'three/tsl';

export interface CloudHole {
  x: number;
  z: number;
  radius: number;
  /** -1 = 全空（云洞），+1 = 全厚 */
  amount: number;
}

export interface CloudSeaOptions {
  /** 云层基准高度（该层云海的"海面"） */
  baseY: number;
  /** 云区中心（世界坐标） */
  centerX?: number;
  centerZ?: number;
  size?: number;
  layers?: number;
  holes?: CloudHole[];
  /** 整体浓度 0–1 */
  density?: number;
  tint?: 'warm' | 'cold' | 'neutral';
}

/** fbm octave 数（大形 / 细节）。7 个 octave × 全屏 overdraw × 多片云海 = 帧时间大头 */
const OCTAVES: Record<Tier, { big: number; fine: number }> = {
  high: { big: 3, fine: 2 },
  mid: { big: 2, fine: 2 },
  low: { big: 2, fine: 1 },
};

export function buildCloudSea(opts: CloudSeaOptions): THREE.Mesh {
  const OCT = OCTAVES[QualityManager.current.tier];
  const size = opts.size ?? 4200;
  // 平面层数同样按档缩减：每层都是一个覆盖全屏的透明四边形
  const layerScale = QualityManager.current.tier === 'high' ? 0.7 : QualityManager.current.tier === 'mid' ? 0.55 : 0.4;
  const nLayers = Math.max(3, Math.round((opts.layers ?? 9) * layerScale));
  const holes = opts.holes ?? [];
  const density = opts.density ?? 1.0;
  const cx = opts.centerX ?? 0;
  const cz = opts.centerZ ?? 0;

  // ── 合并几何：每层一个大平面，attribute layerInfo = (层序号, 不透明度, 速度, 噪声缩放) ──
  const positions: number[] = [];
  const layerInfo: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < nLayers; i++) {
    const f = i / Math.max(nLayers - 1, 1);
    const y = opts.baseY + (f - 0.5) * 22 + Math.sin(i * 7.3) * 3;
    const half = (size * (1 + f * 0.15)) / 2;
    const base = positions.length / 3;
    positions.push(cx - half, y, cz - half, cx + half, y, cz - half, cx + half, y, cz + half, cx - half, y, cz + half);
    const opacity = (0.26 + 0.5 * Math.abs(Math.sin(i * 3.7 + 1))) * density;
    const speed = (0.4 + 0.6 * Math.abs(Math.sin(i * 5.1))) * 0.0016; // 极慢：快速滚动的云=廉价感
    const scale = 2.2 + f * 3.5;
    for (let v = 0; v < 4; v++) layerInfo.push(i, opacity, speed, scale);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2); // 朝上
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('layerInfo', new THREE.Float32BufferAttribute(layerInfo, 4));
  geo.setIndex(indices);

  // ── 覆盖度贴图（云洞） ─────────────────────────────────
  const COV = 256;
  const covData = new Uint8Array(COV * COV * 4);
  for (let iz = 0; iz < COV; iz++) {
    for (let ix = 0; ix < COV; ix++) {
      const wx = (ix / COV - 0.5) * size + cx;
      const wz = (iz / COV - 0.5) * size + cz;
      let v = 0.5; // 中性
      for (const h of holes) {
        const d = Math.hypot(wx - h.x, wz - h.z);
        const k = Math.max(0, 1 - d / h.radius);
        v += h.amount * k * k;
      }
      const o = (iz * COV + ix) * 4;
      const b = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255);
      covData[o] = b;
      covData[o + 1] = b;
      covData[o + 2] = b;
      covData[o + 3] = 255;
    }
  }
  const covTex = new THREE.DataTexture(covData, COV, COV);
  covTex.needsUpdate = true;
  covTex.wrapS = covTex.wrapT = THREE.ClampToEdgeWrapping;

  const tintCold = opts.tint === 'cold';
  const shadowCol = uniform(new THREE.Color(tintCold ? 0x5a6c92 : 0x867aa6), 'color'); // 碧雾青偏紫
  const litCol = uniform(new THREE.Color(tintCold ? 0xd6e4f0 : 0xf5f2ea), 'color'); // 琼香白
  const rimCol = uniform(new THREE.Color(tintCold ? 0xc8d8f0 : 0xffe0a0), 'color'); // 金色轮廓光

  const info: any = attribute('layerInfo') as never;

  const cloudNode = Fn(() => {
    const wpos = positionWorld;
    const t: any = time.mul(info.z);

    // 两层 fbm：大形 + 细节拉丝（层积状 + 丝缕状，文档 03 §3.2）
    // octave 数按画质档给 —— 云海是透明大平面、全屏 overdraw，每加一个 octave
    // 就是一遍全屏噪声采样。实测高空同时可见多片云海时，这里是绝对的帧时间大头。
    const p1 = wpos.xz.mul(0.0011).mul(info.w);
    const n1 = mx_fractal_noise_float(p1.add(vec2(t, t.mul(0.6))), OCT.big, 1.9, 0.6);
    const p2 = wpos.xz.mul(0.0042).mul(info.w);
    const n2 = mx_fractal_noise_float(p2.sub(vec2(t.mul(1.7), 0.0)), OCT.fine, 2.2, 0.5);
    const shape = n1.mul(0.72).add(n2.mul(0.38)).add(0.24);

    // 覆盖度：世界坐标 → 贴图 UV
    const covUV = wpos.xz.sub(vec2(float(cx - size / 2), float(cz - size / 2))).div(float(size));
    const cov = texture(covTex, covUV).r;
    const shaped = shape.mul(cov.mul(2.0)); // 0.5 中性 → ×1

    const alpha: any = smoothstep(0.2, 0.66, shaped).mul(info.y);

    // 光照：亮部琼香白、暗部碧雾青，亮缘描金
    const lit = saturate(shaped.mul(1.25).add(0.22));
    const col = mix(shadowCol, litCol, lit).toVar();
    const rim = smoothstep(0.52, 0.72, shaped).sub(smoothstep(0.78, 0.98, shaped)).clamp(0, 1);
    col.addAssign(rimCol.mul(rim.mul(0.55)));
    // 太阳侧整体染金（逆光祥云）
    const sunDir = normalize(vec3(0.62, 0.36, -0.65));
    const sunAmt = pow(saturate(dot(normalize(wpos.sub(vec3(float(cx), float(opts.baseY), float(cz)))), sunDir)), 3.0);
    col.addAssign(rimCol.mul(sunAmt.mul(0.22)));
    return vec4(col, alpha);
  });

  const mat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  mat.colorNode = cloudNode();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -500;
  return mesh;
}
