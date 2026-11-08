/**
 * GodRays.ts —— 光锥几何体｜文档 02 §5.3 第二类
 *
 * 手工放置的锥形/楔形半透明 mesh，TSL 材质：
 * 沿视线方向的软化 + 噪声扰动 + 两端羽化。
 */
import * as THREE from 'three/webgpu';
import {
  Fn, vec3, vec4, float, color, attribute,
  uv, time, mix, smoothstep, sin,
  positionWorld, cameraPosition, dot, normalize, mx_fractal_noise_float,
} from 'three/tsl';

export interface LightShaftOptions {
  /** 顶部半径 / 底部半径 / 高 */
  topR?: number;
  bottomR?: number;
  height?: number;
  color?: number;
  intensity?: number;
}

export function buildLightShaft(opts: LightShaftOptions = {}): THREE.Mesh {
  const h = opts.height ?? 40;
  const geo = new THREE.CylinderGeometry(opts.topR ?? 2, opts.bottomR ?? 6, h, 12, 1, true);
  geo.translate(0, -h / 2, 0); // 顶端为原点

  const mat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const intensity = float(opts.intensity ?? 0.4);
  mat.colorNode = Fn(() => {
    const vUv = uv();
    // 两端羽化 + 侧缘羽化（圆柱 UV.x 闭合处无妨，视线软化靠 fresnel-ish）
    const endFade = smoothstep(0.0, 0.18, vUv.y).mul(smoothstep(1.0, 0.72, vUv.y));
    // 噪声扰动（尘埃翻滚感，极慢）
    const n = mx_fractal_noise_float(vec3(vUv.mul(vec3(3, 6, 0) as never).xy, time.mul(0.05) as never), 3, 2.0, 0.5);
    // 视线软化：视线与柱面法向垂直时最亮
    const vdir = normalize(positionWorld.sub(cameraPosition));
    const up = vec3(0, 1, 0);
    const grazing = dot(vdir, up).abs().oneMinus();
    const a = endFade.mul(n.mul(0.5).add(0.5)).mul(grazing).mul(intensity);
    return vec4(color(opts.color ?? 0xffe9c0), a);
  })();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}

/** 披香殿式浓香烟雾中的光柱：多根并排楔形 */
export function buildShaftGroup(count: number, spread: number, opts: LightShaftOptions = {}): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const shaft = buildLightShaft(opts);
    shaft.position.set((i - (count - 1) / 2) * spread, 0, (Math.sin(i * 2.7) * spread) / 2);
    shaft.rotation.z = 0.15 + Math.sin(i * 1.3) * 0.1;
    g.add(shaft);
  }
  return g;
}
