/**
 * LoreMarker.ts —— 「书中此处」的世界标记
 *
 * 未听：金色光柱，缓慢脉动；已听：转暗金、不脉动。
 * 加法混合 + depthWrite:false，不进阴影与选择性 bloom 的高开销路径。
 *
 * 远距可见性补丁：光柱+光环只在近处（几米到十几米）好看——加法混合叠在
 * 天宫本就很亮的米黄天空/云海上时，无论怎么加粗都会被"加不动"（src 越亮，
 * 加法结果越接近纯白，色相差异被吃掉）。一开始想用半透明信标球顶替，但
 * alpha 混合会让本就超亮的 HDR 天空像素透进来，把复合值顶过场景 Selective
 * Bloom 的阈值（渲染管线里阈值=1.0，见 src/core/Renderer.ts），糊成一团
 * 发白的软光斑——而且透明度越低（如"已听"调暗时）背景漏光反而越多，
 * 于是"已听"和"未听"在远处看起来一样刺眼，完全没有区分度。
 *
 * 改正方案：信标改成完全不透明（不参与任何混合，不存在背景漏光问题，
 * 自身颜色又刻意压在 1.0 以下），用 positionNode 做"近处收缩成一个点、
 * 远处长回全尺寸"的几何缩放（而不是用 alpha 淡入淡出）。这样近处
 * （<18m）信标只是几个不可见的退化三角形，光柱+光环的近处观感完全不受
 * 影响；远处则是一颗读得出轮廓的实心金球，无视背景多亮都不会被 bloom
 * 吃掉。"已听/未听"改成调颜色深浅（而不是调透明度），保证远处也能一眼
 * 分辨。世界尺寸固定（非屏幕空间常量大小），12 个实例每个只加 1 个
 * 低多边形 IcosahedronGeometry(detail 1，80 面）+ 1 个 draw call，
 * 量级远低于场景基线，不会拖帧。
 */
import * as THREE from 'three/webgpu';
import {
  Fn, positionLocal, positionWorld, cameraPosition, normalWorld,
  vec3, vec4, color, float, uniform, time, sin,
  normalize, dot, saturate, mix, smoothstep,
} from 'three/tsl';
import type { LoreSite } from './LoreSites';

const HEIGHT = 16;
const RADIUS = 1.1;

// 远距信标：世界半径固定（不是屏幕空间常量大小），但比光柱粗得多，
// 保证在 150m 外仍有十几像素的可见面积；靠"完全不透明+压暗色阶"读出对比度。
const BEACON_Y = HEIGHT * 0.72; // 柱子 2/3 高处，地面/空中两个视角都对得上
const BEACON_RADIUS = 2.0;
const BEACON_NEAR = 18; // 18m 内缩成一个点，不打扰"站在点上"的近处观感
const BEACON_FAR = 70; // 70m 外长到满尺寸

export function buildLoreMarker(site: LoreSite, visited: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(site.position);
  g.name = `lore-${site.id}`;

  // 强度 uniform：未听 1.0，已听 0.22
  const strength = uniform(visited ? 0.22 : 1.0);
  (g as never as { __strength: typeof strength }).__strength = strength;

  // 光柱：上细下粗的开口圆柱，顶端淡出
  const geo = new THREE.CylinderGeometry(RADIUS * 0.35, RADIUS, HEIGHT, 12, 1, true);
  geo.translate(0, HEIGHT / 2, 0);
  const mat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  mat.colorNode = Fn(() => {
    const h = positionLocal.y.div(float(HEIGHT)).clamp(0, 1);
    const fade = h.oneMinus().pow(1.6); // 底亮顶淡
    const pulse = sin(time.mul(1.6)).mul(0.18).add(0.82);
    const a = fade.mul(0.5).mul(strength).mul(pulse);
    return vec4(color(0xffe0a0), a);
  })();
  const beam = new THREE.Mesh(geo, mat);
  g.add(beam);

  // 地面光环
  const ringGeo = new THREE.RingGeometry(RADIUS * 1.4, RADIUS * 2.0, 32);
  ringGeo.rotateX(-Math.PI / 2);
  ringGeo.translate(0, 0.12, 0);
  const ringMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  ringMat.colorNode = Fn(() => {
    const pulse = sin(time.mul(1.6).add(1.2)).mul(0.25).add(0.75);
    return vec4(color(0xffe9b8), float(0.55).mul(strength).mul(pulse));
  })();
  const ring = new THREE.Mesh(ringGeo, ringMat);
  g.add(ring);

  // 远距信标：完全不透明的实心小球，不参与任何混合——没有背景漏光，
  // 天空再亮也不会把它推过 bloom 阈值。用 positionNode 把它在近处
  // （<18m）收缩成一个退化的点（视觉上不存在），70m 外长回全尺寸。
  // 世界坐标锚点用 CPU 侧算好的 uniform（而非每顶点重新求 modelWorldMatrix），
  // 与 Motes.ts 的 follow uniform 是同一套写法。
  const beaconAnchor = uniform(
    new THREE.Vector3(site.position.x, site.position.y + BEACON_Y, site.position.z),
    'vec3',
  );
  const beaconGeo = new THREE.IcosahedronGeometry(BEACON_RADIUS, 1);
  beaconGeo.translate(0, BEACON_Y, 0);
  const beaconMat = new THREE.MeshBasicNodeMaterial({
    fog: false,
    // 不设 transparent —— 完全不透明，正常深度写入/深度测试，
    // 既不会被场景其它物体错误穿透，也不会跟背景做任何 alpha 合成。
  });
  const beaconDistFade = Fn(() => {
    const dist = cameraPosition.sub(beaconAnchor).length();
    return smoothstep(float(BEACON_NEAR), float(BEACON_FAR), dist);
  });
  // 近处收缩到肉眼不可见的退化三角形，远处长回全尺寸；缩放中心是信标锚点。
  beaconMat.positionNode = Fn(() => {
    const scale = beaconDistFade().max(0.001);
    const centered = positionLocal.sub(vec3(0, BEACON_Y, 0));
    return centered.mul(scale).add(vec3(0, BEACON_Y, 0));
  })();
  beaconMat.colorNode = Fn(() => {
    const pulse = sin(time.mul(1.6)).mul(0.08).add(0.92);

    // 简单菲涅尔：正对相机的面亮金，侧向/背对相机的面压成深棕，形成描边式对比。
    // 颜色刻意压在 1.0 以下（core 峰值 ~0.89），保证任何背景下都不会自己
    // 撞上 bloom 阈值；"已听"用 strength 直接压暗颜色（而不是调透明度——
    // 不透明物体调透明度没有意义，也回避了"越暗背景漏光越多"的坑）。
    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const rim = saturate(dot(normalWorld, viewDir)).oneMinus().pow(1.6);
    const core = color(0xd08a1c); // 饱和金黄（压低 G/B，AgX 高光段不容易被中和成灰白）
    const edge = color(0x2c1a08); // 深棕描边，任何背景下都读得出轮廓
    const col = mix(core, edge, rim.mul(0.78)).mul(strength).mul(pulse);
    return vec4(col, 1.0);
  })();
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  // beacon 用 positionNode 缩放，CPU 端包围球算不到，必须关剔除；
  // beam/ring 是静态几何、包围球正确，交给剔除省 28 个 draw call
  beacon.frustumCulled = false;
  g.add(beacon);

  return g;
}

/** 听完后调用：把光柱压暗 */
export function setMarkerVisited(marker: THREE.Group, visited: boolean): void {
  const s = (marker as never as { __strength?: { value: number } }).__strength;
  if (s) s.value = visited ? 0.22 : 1.0;
}
