/**
 * Sky.ts —— TSL 程序化天空 + 高度雾｜文档 02 §5.1 / §5.4 / 文档 03 §2.2
 *
 * 天空：三段渐变（天顶 / 地平 / 云海反光）+ 低频 fbm 云絮 + 朝晖太阳辉光盘。
 * 雾：自写 height fog（FogExp2 没有高度概念），带太阳内散射。
 */
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, color, fog,
  positionLocal, positionWorld, cameraPosition,
  normalize, mix, saturate, pow, dot, exp, max,
  mx_fractal_noise_float, smoothstep,
} from 'three/tsl';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Atmosphere {
  sunDirection: any;
  sunColor: any;
  fogNear: any;
  fogFar: any;
  sky: THREE.Mesh;
  applyPreset(preset: 'dawn' | 'noon' | 'moon'): void;
}

/** 三个光照预设（文档 03 §5.1：不做昼夜循环，只做预设） */
const PRESETS = {
  dawn: { elev: 22, azim: 135, sun: 0xffd9a0, fogNear: 0xc9a8d8, fogFar: 0x8fa8c8, zenith: 0x6f7fc0, horizon: 0xf0c890 },
  noon: { elev: 65, azim: 135, sun: 0xfff2dd, fogNear: 0xb8b8d0, fogFar: 0x98b0cc, zenith: 0x7f9fd8, horizon: 0xe8e0c8 },
  moon: { elev: 40, azim: 220, sun: 0xc8d8f0, fogNear: 0x5a6a88, fogFar: 0x3a4a68, zenith: 0x1a2440, horizon: 0x4a5a78 },
} as const;

export function createAtmosphere(preset: 'dawn' | 'noon' | 'moon' = 'dawn'): Atmosphere {
  const sunDirection = uniform(new THREE.Vector3(0.5, 0.38, 0.75).normalize(), 'vec3');
  const sunColor = uniform(new THREE.Color(PRESETS[preset].sun), 'color');
  const fogNear = uniform(new THREE.Color(PRESETS[preset].fogNear), 'color');
  const fogFar = uniform(new THREE.Color(PRESETS[preset].fogFar), 'color');
  const zenith = uniform(new THREE.Color(PRESETS[preset].zenith), 'color');
  const horizon = uniform(new THREE.Color(PRESETS[preset].horizon), 'color');

  const skyNode = Fn(() => {
    const dir = normalize(positionLocal);
    const y = dir.y;
    const lower = color(0x9ab8c8); // 云海反光（碧雾青）
    const grad = mix(
      mix(lower, horizon, smoothstep(-0.35, 0.02, y)),
      zenith,
      smoothstep(0.05, 0.7, y),
    );
    // 低频 fbm 云絮（远景云带，成本 ~0）
    const n = mx_fractal_noise_float(dir.mul(3.5), 4, 2.0, 0.55);
    const wisps = smoothstep(0.15, 0.75, n).mul(smoothstep(0.55, 0.05, y.abs())).mul(0.35);
    const cloudTint = mix(color(0xf5f2ea), color(0xc9b8e0), saturate(n.mul(0.8).add(0.3)));
    // 太阳辉光盘（不是 DirectionalLight 的可视化，是单独画的辉光）
    const sunAmt = max(dot(dir, sunDirection), 0.0);
    const col = mix(grad, cloudTint, wisps).add(
      sunColor.mul(pow(sunAmt, 900).mul(8.0).add(pow(sunAmt, 24).mul(0.55)).add(pow(sunAmt, 5).mul(0.22))),
    );
    return vec4(col, 1.0);
  });

  const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  skyMat.colorNode = skyNode();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 20), skyMat);
  sky.renderOrder = -1000;
  sky.frustumCulled = false;

  function applyPreset(p: 'dawn' | 'noon' | 'moon'): void {
    const cfg = PRESETS[p];
    const elev = THREE.MathUtils.degToRad(cfg.elev);
    const azim = THREE.MathUtils.degToRad(cfg.azim);
    (sunDirection.value as THREE.Vector3).set(
      Math.cos(elev) * Math.sin(azim),
      Math.sin(elev),
      Math.cos(elev) * Math.cos(azim),
    );
    (sunColor.value as THREE.Color).set(cfg.sun);
    (fogNear.value as THREE.Color).set(cfg.fogNear);
    (fogFar.value as THREE.Color).set(cfg.fogFar);
    (zenith.value as THREE.Color).set(cfg.zenith);
    (horizon.value as THREE.Color).set(cfg.horizon);
  }
  applyPreset(preset);

  return { sunDirection, sunColor, fogNear, fogFar, sky, applyPreset };
}

/**
 * height fog（文档 02 §5.4）
 * fogFactor = 1 - exp(-density * distance * exp(-(cameraY - fogBaseY) * falloff))
 * fogColor  = mix(fogNear, fogFar, dist/maxDist) + sunColor * pow(dot(viewDir,sunDir), 8) * inscatter
 */
export function applyHeightFog(
  scene: THREE.Scene,
  atm: Atmosphere,
  opts: { density?: number; falloff?: number; baseY?: number; inscatter?: number } = {},
): void {
  const density = float(opts.density ?? 0.0016);
  const falloff = float(opts.falloff ?? 0.012);
  const baseY = float(opts.baseY ?? 0);
  const inscatter = float(opts.inscatter ?? 0.5);
  const maxDist = float(2500);

  const viewVec = positionWorld.sub(cameraPosition);
  const dist = viewVec.length();
  const dir = viewVec.normalize();
  const heightFac = exp(cameraPosition.y.sub(baseY).mul(falloff).negate());
  const fac = density.mul(dist).mul(heightFac).negate().exp().oneMinus().clamp(0.0, 1.0);
  const sunAmt = pow(saturate(dot(dir, atm.sunDirection)), 8.0).mul(inscatter);
  const fogCol = mix(atm.fogNear, atm.fogFar, saturate(dist.div(maxDist))).add(atm.sunColor.mul(sunAmt));
  scene.fogNode = fog(fogCol, fac) as never;
}
