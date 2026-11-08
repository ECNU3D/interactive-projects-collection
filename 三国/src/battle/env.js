// 赤壁之战 · 战场环境模块 —— 天空/长江水面/两岸地形/赤壁断崖/远山/云/芦苇/树林/灯光与雾/风与相位
// 世界约定：长江沿 X 轴展开（+x 东/下游，+z 南），水面 z∈[-85,85]、x∈[-260,260]、基准 y=0
// 北岸（z<-85）曹军乌林一侧低平沼泽疏林，南岸（z>85）赤壁，x∈[-95,-8] 为红褐色断崖
import * as THREE from 'three';
import { materials, makeRng } from '../materials.js';

const WATER_Y = 0;
const RIVER = { length: 520, halfWidth: 85 };

// 固定东南风，吹向西北
const WIND_DIR = new THREE.Vector3(-0.85, 0, -0.53).normalize();

// ---- 波浪参数（GLSL 与 JS 共用同一份常量，保证 waterHeight 与顶点着色器位移严格一致） ----
// dx/dz 波向，amp 振幅，len 波长，speed 角速度，phase 初相；k = 2π/len 预计算
// 主波沿 +x 推进，带少量横向往复，营造江流东去之感；整体振幅乘 WAVE_AMP（随风力涨落）
const WAVES = [
  { dx: 0.99, dz: 0.14, amp: 0.14, len: 16.0, speed: 0.90, phase: 0.0 },
  { dx: 0.90, dz: -0.44, amp: 0.09, len: 9.0, speed: 1.25, phase: 1.7 },
  { dx: 0.42, dz: 0.91, amp: 0.06, len: 5.4, speed: 1.60, phase: 3.4 },
  { dx: -0.98, dz: 0.20, amp: 0.04, len: 3.2, speed: 2.10, phase: 5.1 },
];
for (const w of WAVES) w.k = (Math.PI * 2) / w.len;

// 波浪振幅系数（模块级，JS 采样与 uniform 同源；单实例环境）
let WAVE_AMP = 1;

// 由 WAVES 生成 GLSL 函数：返回 (波高, dH/dx, dH/dz)，供顶点位移与法线重建
function buildWaveGLSL() {
  let s = 'vec3 waveField(vec2 p, float t) {\n  float h = 0.0; float gx = 0.0; float gz = 0.0;\n';
  for (const w of WAVES) {
    // GLSL 浮点字面量必须带小数点（如 phase=0 需写成 0.0）
    const f = (n) => {
      const str = String(n);
      return str.includes('.') || str.includes('e') ? str : str + '.0';
    };
    s += '  {\n';
    s += `    float a = (p.x * ${f(w.dx)} + p.y * ${f(w.dz)}) * ${f(w.k)} + t * ${f(w.speed)} + ${f(w.phase)};\n`;
    s += `    h += ${f(w.amp)} * sin(a);\n`;
    s += `    float c = ${f(w.amp * w.k)} * cos(a);\n`;
    s += `    gx += c * ${f(w.dx)}; gz += c * ${f(w.dz)};\n  }\n`;
  }
  s += '  return vec3(h, gx, gz);\n}\n';
  return s;
}

// JS 侧同一公式：世界坐标水面高度（含波浪与风浪系数），船只浮沉的依据
function waveHeightJS(x, z, t) {
  let h = 0;
  for (const w of WAVES) h += w.amp * Math.sin((x * w.dx + z * w.dz) * w.k + t * w.speed + w.phase);
  return WATER_Y + h * WAVE_AMP;
}

// ---- 确定性值噪声 / fBm（地形、山体、崖壁位移用，仅构建期执行） ----
function hash2(i, j, seed) {
  const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x, y, seed, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) {
    v += amp * vnoise(x * f, y * f, seed + o * 13);
    amp *= 0.5; f *= 2.1;
  }
  return v; // 约 0..1
}

// ---- 四个战役相位（黄昏对峙 → 入夜 → 火攻之夜 → 清晨尾声），全部可插值参数集中在此 ----
// 夜相刻意提亮：冷月光 + 亮半球光，保证夜战/东南风起段落画面可读
const C = (hex) => new THREE.Color(hex);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MOON_DIR = V(0.57, 0.69, -0.44).normalize(); // 月亮方位（夜相主光方向）

const PHASES = {
  // 傍晚开战场：低角度暖阳，冷蓝灰环境，灰蓝薄雾、能见度较远
  dusk: {
    sunColor: C('#ffb36b'), sunIntensity: 2.3, sunPos: V(-150, 26, 55),
    hemiSky: C('#8a96ad'), hemiGround: C('#4f463c'), hemiIntensity: 1.1,
    fogColor: C('#8a94a0'), fogNear: 90, fogFar: 360,
    skyTop: C('#3a4f78'), skyHorizon: C('#e89a62'),
    glowColor: C('#ff9a4d'), glowStrength: 1.1, glowPow: 5, glowDir: V(-1, 0.10, 0.35).normalize(),
    starOpacity: 0, moonOpacity: 0, ambient: 0,
    cloudColor: C('#e0a273'), cloudOpacity: 0.5,
  },
  // 入夜（东南风起）：明亮冷月光，蓝调可读的夜空，雾透月色
  night: {
    sunColor: C('#b9cdf0'), sunIntensity: 1.75, sunPos: V(91, 111, -71),
    hemiSky: C('#41597e'), hemiGround: C('#161e2b'), hemiIntensity: 1.15,
    fogColor: C('#25324a'), fogNear: 65, fogFar: 300,
    skyTop: C('#0a1426'), skyHorizon: C('#20304e'),
    glowColor: C('#8fa8d8'), glowStrength: 0.55, glowPow: 6, glowDir: MOON_DIR.clone(),
    starOpacity: 1, moonOpacity: 1, ambient: 0,
    cloudColor: C('#4a5c80'), cloudOpacity: 0.4,
  },
  // 火攻之夜：夜色仍有月光基底，地平线压暗、火光光晕收窄（是夜、不是晚霞）
  fireNight: {
    sunColor: C('#9cadcf'), sunIntensity: 1.1, sunPos: V(91, 111, -71),
    hemiSky: C('#5e4234'), hemiGround: C('#241610'), hemiIntensity: 1.2,
    fogColor: C('#342518'), fogNear: 55, fogFar: 275,
    skyTop: C('#0a0e1a'), skyHorizon: C('#381c0c'),
    glowColor: C('#ff8a45'), glowStrength: 0.72, glowPow: 12, glowDir: V(-0.35, 0.06, -1).normalize(),
    starOpacity: 0.7, moonOpacity: 0.85, ambient: 0.8,
    cloudColor: C('#6a3418'), cloudOpacity: 0.45,
  },
  // 尾声清晨：冷青灰渐亮，雾变浅
  dawn: {
    sunColor: C('#e8e3d5'), sunIntensity: 1.5, sunPos: V(140, 30, -60),
    hemiSky: C('#a8b2b8'), hemiGround: C('#5c5548'), hemiIntensity: 1.0,
    fogColor: C('#9aa5ab'), fogNear: 85, fogFar: 340,
    skyTop: C('#607a90'), skyHorizon: C('#cdd2d3'),
    glowColor: C('#e8d9b8'), glowStrength: 0.5, glowPow: 5, glowDir: V(1, 0.10, -0.30).normalize(),
    starOpacity: 0, moonOpacity: 0, ambient: 0,
    cloudColor: C('#d5dadc'), cloudOpacity: 0.5,
  },
};
const NUM_KEYS = ['sunIntensity', 'hemiIntensity', 'fogNear', 'fogFar', 'glowStrength', 'glowPow', 'starOpacity', 'moonOpacity', 'ambient', 'cloudOpacity'];
const COLOR_KEYS = ['sunColor', 'hemiSky', 'hemiGround', 'fogColor', 'skyTop', 'skyHorizon', 'glowColor', 'cloudColor'];
const VEC_KEYS = ['sunPos', 'glowDir'];

// 岸滩高度（解析噪声，确定性）：水线 y≈-0.5 缓升到内陆
function bankHeight(x, d, side) {
  const t = THREE.MathUtils.smoothstep(d, 0, 46);   // 0 水线 → 1 内陆
  const rise = side > 0 ? 3.5 : 2.4;                // 北岸低平，南岸略高
  const n = Math.sin(x * 0.045 + side * 1.7) * Math.sin(d * 0.11 + side)
          + 0.5 * Math.sin(x * 0.13 + d * 0.21 + side * 4.2);
  return -0.5 + rise * t + n * (side > 0 ? 0.5 : 0.35) * t;
}

// 慢变阵风噪声，输出约 ±1
function gustNoise(t) {
  return Math.sin(t * 0.53) * 0.55 + Math.sin(t * 1.31 + 2.1) * 0.3 + Math.sin(t * 2.17 + 5.0) * 0.15;
}

// ---- 赤壁崖面纹理（岩层横纹 + 裂缝 + 摩崖"赤壁"二字，全程序化） ----
// 返回 { map, emissiveMap }：自发光贴图底为暗灰（岩体保留微弱暖光），
// 仅"赤壁"二字高亮——黄昏背光、入夜后二字依然醒目
function cliffTextures() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  const rng = makeRng(4181);
  ctx.fillStyle = '#7d4a38';
  ctx.fillRect(0, 0, 1024, 512);
  // 岩层横向条带
  for (let y = 0; y < 512; y += 8) {
    const tone = 0.78 + fbm(3, y * 0.05, 8) * 0.5;
    const rr = Math.min(255, 125 * tone) | 0, gg = Math.min(255, 74 * tone) | 0, bb = Math.min(255, 56 * tone) | 0;
    ctx.fillStyle = `rgba(${rr},${gg},${bb},0.55)`;
    ctx.fillRect(0, y + Math.sin(y * 0.1) * 3, 1024, 5 + rng() * 5);
  }
  // 竖向裂缝
  ctx.strokeStyle = 'rgba(30,16,10,0.5)';
  for (let i = 0; i < 60; i++) {
    ctx.lineWidth = 1 + rng() * 2.5;
    ctx.beginPath();
    let x = rng() * 1024, y = rng() * 260;
    ctx.moveTo(x, y);
    const len = 60 + rng() * 180;
    for (let s = 0; s < len; s += 14) {
      x += (rng() - 0.5) * 16; y += 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 明暗斑块
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(150,96,70,0.12)' : 'rgba(52,30,22,0.14)';
    ctx.beginPath();
    ctx.ellipse(rng() * 1024, rng() * 512, 20 + rng() * 70, 10 + rng() * 32, rng() * 3, 0, 7);
    ctx.fill();
  }
  // 摩崖石刻"赤壁"二字：凿刻暗影 → 受光棱边 → 亮朱砂主体，与红褐岩面拉开对比
  const chars = (ctx2, dx, dy, style) => {
    ctx2.save();
    ctx2.translate(700, 78);
    ctx2.rotate(-0.03);
    ctx2.font = 'bold 132px "Kaiti SC", "STKaiti", "KaiTi", serif';
    ctx2.textAlign = 'center';
    ctx2.fillStyle = style;
    ctx2.fillText('赤', dx, 104 + dy);
    ctx2.fillText('壁', dx, 240 + dy);
    ctx2.restore();
  };
  chars(ctx, 5, 6, 'rgba(28,10,6,0.9)');       // 凿刻阴影（右下）
  chars(ctx, -3, -4, 'rgba(255,216,182,0.5)'); // 受光棱边（左上）
  chars(ctx, 0, 0, '#f04226');                 // 朱砂主体

  // 自发光贴图：暗灰底 + 高亮二字
  const ce = document.createElement('canvas');
  ce.width = 1024; ce.height = 512;
  const ctxE = ce.getContext('2d');
  ctxE.fillStyle = '#292929';
  ctxE.fillRect(0, 0, 1024, 512);
  chars(ctxE, 0, 0, '#ffffff');

  const mk = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { map: mk(c), emissiveMap: mk(ce) };
}

// ---- 云朵贴图（软絮团） ----
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const rng = makeRng(77);
  for (let i = 0; i < 14; i++) {
    const x = 40 + rng() * 176, y = 40 + rng() * 48;
    const r = 18 + rng() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  // 底缘压平（层云感）
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createLinearGradient(0, 0, 0, 128);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(0.75, 'rgba(0,0,0,0.9)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createEnvironment(scene) {
  const M = materials();
  const rng = makeRng(20813);
  const env = new THREE.Group();
  env.name = 'environment';
  scene.add(env);

  const uTime = { value: 0 };      // 水波时间（JS 与着色器共用）
  const uWaveAmp = { value: 1 };   // 风浪系数（与 WAVE_AMP 同步）
  const uSkyReflect = { value: C('#8a94a0') }; // 水面菲涅尔映空色

  // ---- 天空球（BackSide 渐变 + 日落/火光光晕） ----
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: C('#3a4f78') },
      uHorizon: { value: C('#e89a62') },
      uGlowColor: { value: C('#ff9a4d') },
      uGlowDir: { value: V(-1, 0.1, 0.35).normalize() },
      uGlowStrength: { value: 1.1 },
      uGlowPow: { value: 5 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlowColor;
      uniform vec3 uGlowDir; uniform float uGlowStrength; uniform float uGlowPow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
        float g = pow(max(dot(d, normalize(uGlowDir)), 0.0), uGlowPow) * uGlowStrength;
        col += uGlowColor * g * (1.0 - h * 0.75);   // 光晕压向地平线
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  env.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat));

  // ---- 星星（约 600 颗，夜相显形） ----
  const starPos = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const az = rng() * Math.PI * 2;
    const el = Math.asin(0.08 + rng() * 0.9);       // 只布在上半球
    const r = 380;
    starPos[i * 3] = Math.cos(el) * Math.cos(az) * r;
    starPos[i * 3 + 1] = Math.sin(el) * r;
    starPos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#cfe0ff', size: 1.8, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  env.add(stars);

  // ---- 月亮（发光面片 + 光晕） ----
  const moon = new THREE.Group();
  const moonCoreMat = new THREE.MeshBasicMaterial({ color: '#e8eef5', transparent: true, opacity: 0, fog: false });
  const moonCore = new THREE.Mesh(new THREE.CircleGeometry(9, 24), moonCoreMat);
  const moonHaloMat = new THREE.MeshBasicMaterial({ color: '#9fb4d8', transparent: true, opacity: 0, fog: false, depthWrite: false });
  const moonHalo = new THREE.Mesh(new THREE.CircleGeometry(22, 24), moonHaloMat);
  moonHalo.position.z = -0.5;
  moon.add(moonHalo, moonCore);
  moon.position.copy(MOON_DIR).multiplyScalar(350);
  moon.lookAt(0, 0, 0);
  env.add(moon);

  // ---- 云层（Sprite 环布战场四周，随风缓漂，颜色/透明度随相位插值） ----
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTexture(), color: '#e0a273', transparent: true, opacity: 0.5,
    depthWrite: false, fog: false,
  });
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(cloudMat);
    const az = (i / 12) * Math.PI * 2 + rng() * 0.5;
    const r = 250 + rng() * 90;
    sp.position.set(Math.cos(az) * r, 55 + rng() * 75, Math.sin(az) * r);
    sp.scale.set(95 + rng() * 75, 26 + rng() * 20, 1);
    clouds.push(sp);
    env.add(sp);
  }

  // ---- 长江水面（顶点着色器位移 + 菲涅尔映空，CPU 不逐帧改顶点） ----
  const waterMat = new THREE.MeshStandardMaterial({ color: '#265257', roughness: 0.2, metalness: 0.12 });
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uWaveAmp = uWaveAmp;
    shader.uniforms.uSkyReflect = uSkyReflect;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        `#include <common>\nuniform float uTime;\nuniform float uWaveAmp;\nvarying float vWaveH;\n${buildWaveGLSL()}`)
      .replace('#include <beginnormal_vertex>',
        `vec3 wf = waveField(position.xz, uTime) * uWaveAmp;\nvec3 objectNormal = normalize(vec3(-wf.y, 1.0, -wf.z));`)
      .replace('#include <begin_vertex>',
        `vec3 transformed = vec3(position);\ntransformed.y += wf.x;\nvWaveH = wf.x;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWaveH;\nuniform vec3 uSkyReflect;')
      .replace('#include <color_fragment>',
        `#include <color_fragment>\ndiffuseColor.rgb += vWaveH * vec3(0.12, 0.15, 0.15);`)
      // 出射色叠加菲涅尔角度的映空反射（在雾/色调映射之前）
      .replace('#include <opaque_fragment>',
        `#include <opaque_fragment>
        float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uSkyReflect, fres * 0.36);`);
  };
  const waterGeo = new THREE.PlaneGeometry(RIVER.length, RIVER.halfWidth * 2, 128, 56);
  waterGeo.rotateX(-Math.PI / 2);   // 烘焙到水平，position.xz 即世界 xz
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  env.add(water);

  // ---- 两岸地形 ----
  for (const side of [-1, 1]) {     // -1 北岸（曹军乌林） / +1 南岸（赤壁）
    const depth = 70;
    const geo = new THREE.PlaneGeometry(RIVER.length, depth, 104, 14);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const zl = pos.getZ(i);                                   // -35..35
      const d = side > 0 ? zl + depth / 2 : depth / 2 - zl;     // 距水线 0 → 内陆 70
      pos.setY(i, bankHeight(x, d, side));
    }
    geo.computeVertexNormals();
    // 北岸沼泽感用偏灰暗泥色，南岸用共享泥褐色
    const mat = side > 0 ? M.mud : new THREE.MeshStandardMaterial({ color: '#5c5140', roughness: 1 });
    const bank = new THREE.Mesh(geo, mat);
    bank.position.z = side * (RIVER.halfWidth + depth / 2);
    bank.receiveShadow = true;
    env.add(bank);
  }

  // ---- 赤壁断崖（南岸 x∈[-95,-8]，fBm 位移崖壁 + 摩崖"赤壁"石刻 + 崖底乱石） ----
  {
    const W = 88, H = 24;
    const geo = new THREE.PlaneGeometry(W, H, 128, 32);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);                     // -44..44
      const ly = pos.getY(i);                     // -12..12
      const u = (lx + W / 2) / W, v = (ly + H / 2) / H;
      // 横向岩棱强、纵向弱的各向异性 fBm；顶缘参差
      let d = (fbm(u * 10, v * 3.2, 41) - 0.5) * 4.2 + (fbm(u * 26, v * 9, 87) - 0.5) * 1.4;
      if (v > 0.82) d -= (v - 0.82) * 16 * (0.4 + fbm(u * 14, 0.5, 5));  // 顶部收进、成锯齿
      if (v < 0.12) d += (0.12 - v) * 10;                                 // 底部外扩成崖脚
      pos.setZ(i, d);
    }
    geo.computeVertexNormals();
    // 微弱暖自发光（emissiveMap 暗灰底）+ 高亮的"赤壁"石刻：背光/夜里二字依然可辨
    const cliffTex = cliffTextures();
    const cliffMat = new THREE.MeshStandardMaterial({
      map: cliffTex.map, roughness: 0.95,
      emissive: C('#e8684a'), emissiveIntensity: 0.55, emissiveMap: cliffTex.emissiveMap,
    });
    const cliff = new THREE.Mesh(geo, cliffMat);
    cliff.rotation.y = Math.PI;         // 面向江面（-z）
    cliff.rotation.x = -0.05;           // 微微后仰
    cliff.position.set(-51, H / 2 - 1.2, 93);
    cliff.castShadow = cliff.receiveShadow = true;
    env.add(cliff);

    // 崖底乱石（talus）
    const tones = ['#7d4a38', '#6e4030', '#8a5642'];
    for (let i = 0; i < 12; i++) {
      const x = -92 + i * 7.4 + (rng() - 0.5) * 3;
      const s = 1.4 + rng() * 2.6;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        new THREE.MeshStandardMaterial({ color: tones[i % 3], roughness: 1, flatShading: true })
      );
      rock.position.set(x, -0.4 + s * 0.35, 87.5 + rng() * 3);
      rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      rock.castShadow = rock.receiveShadow = true;
      env.add(rock);
    }
  }

  // ---- 远山（fBm 位移的平顶锥体，flatShading 出山脊棱线；南北两层 + 东西两端） ----
  function mountainGeo(seed) {
    const geo = new THREE.ConeGeometry(1, 1, 26, 7);
    const pos = geo.attributes.position;
    const vec = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      vec.fromBufferAttribute(pos, i);
      const ang = Math.atan2(vec.z, vec.x);
      const hK = vec.y + 0.5;                              // 0 底 → 1 顶
      const n = fbm(Math.cos(ang) * 1.6 + seed, Math.sin(ang) * 1.6 + hK * 2.2, seed * 7, 4);
      const rK = 1 + (n - 0.5) * 0.85 * (1 - hK * 0.55);   // 山脚起伏大、近顶收敛
      pos.setX(i, vec.x * rK);
      pos.setZ(i, vec.z * rK);
      if (hK > 0.02 && hK < 0.98) pos.setY(i, vec.y + (n - 0.5) * 0.1);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const mtGeos = [mountainGeo(3), mountainGeo(11), mountainGeo(23), mountainGeo(37)];

  // 崖后山体（补住崖壁背面，从南岸回望是整座临江山丘）
  {
    const hillMat = new THREE.MeshStandardMaterial({ color: '#4c4436', roughness: 1, flatShading: true });
    for (const [x, z, r, h] of [[-78, 108, 26, 22], [-52, 112, 30, 26], [-24, 108, 24, 20], [-6, 112, 20, 15]]) {
      const m = new THREE.Mesh(mtGeos[(x + 100) % 4 | 0], hillMat);
      m.scale.set(r, h, r * 0.7);
      m.rotation.y = (x * 0.37) % 3;
      m.position.set(x, h * 0.42 - 1, z);
      m.receiveShadow = true;
      env.add(m);
    }
  }
  function ridge({ count, spread, base, alongX, color, hMin, hMax, rMin, rMax }) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    for (let i = 0; i < count; i++) {
      const r = rMin + rng() * (rMax - rMin);
      const h = hMin + rng() * (hMax - hMin);
      const m = new THREE.Mesh(mtGeos[(i * 7 + count) % 4], mat);
      m.scale.set(r, h, r * 0.62);
      m.rotation.y = rng() * Math.PI * 2;
      const off = (rng() * 2 - 1) * spread;
      if (alongX) m.position.set(off, h * 0.42, base + (rng() - 0.5) * 18);
      else m.position.set(base + (rng() - 0.5) * 18, h * 0.42, off);
      g.add(m);
    }
    return g;
  }
  env.add(ridge({ count: 7, spread: 250, base: -195, alongX: true, color: '#3e4a52', hMin: 14, hMax: 28, rMin: 45, rMax: 80 }));
  env.add(ridge({ count: 6, spread: 260, base: -272, alongX: true, color: '#323c44', hMin: 26, hMax: 44, rMin: 60, rMax: 100 }));
  env.add(ridge({ count: 6, spread: 250, base: 205, alongX: true, color: '#414c53', hMin: 16, hMax: 32, rMin: 45, rMax: 85 }));
  env.add(ridge({ count: 4, spread: 250, base: 288, alongX: true, color: '#37424c', hMin: 30, hMax: 48, rMin: 60, rMax: 95 }));
  env.add(ridge({ count: 3, spread: 160, base: 315, alongX: false, color: '#39434b', hMin: 18, hMax: 32, rMin: 50, rMax: 85 }));
  env.add(ridge({ count: 3, spread: 160, base: -315, alongX: false, color: '#39434b', hMin: 18, hMax: 32, rMin: 50, rMax: 85 }));

  // ---- 岸边树林（南岸赤壁一侧茂密、北岸乌林疏林；InstancedMesh 双层：树干 + 树冠） ----
  {
    const treeSpots = [];
    // 南岸：崖东、崖西的坡地
    for (let i = 0; i < 70; i++) {
      const x = rng() > 0.35 ? 0 + rng() * 240 : -240 + rng() * 130;
      const d = 10 + rng() * 42;
      treeSpots.push([x, d, 1]);
    }
    // 北岸乌林：疏林（避开华容道走廊 x∈[-92,-42]）
    for (let i = 0; i < 26; i++) {
      let x = (rng() * 2 - 1) * 240;
      if (x > -92 && x < -42) x -= 100;
      treeSpots.push([x, 18 + rng() * 44, -1]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.16, 1.1, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 });
    const crownGeo = new THREE.ConeGeometry(1.05, 2.6, 6);
    const crownMat = new THREE.MeshStandardMaterial({ color: '#2e4632', roughness: 1, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length);
    const m4 = new THREE.Matrix4();
    treeSpots.forEach(([x, d, side], i) => {
      const z = side * (RIVER.halfWidth + d);
      const y = bankHeight(x, d, side);
      const s = 0.8 + rng() * 1.5;
      m4.makeRotationY(rng() * Math.PI);
      m4.scale(new THREE.Vector3(s, s * (0.85 + rng() * 0.4), s));
      m4.setPosition(x, y + 0.55 * s, z);
      trunks.setMatrixAt(i, m4);
      m4.makeRotationY(rng() * Math.PI);
      m4.scale(new THREE.Vector3(s, s * (0.85 + rng() * 0.4), s));
      m4.setPosition(x, y + (1.1 + 1.3) * s * 0.8, z);
      crowns.setMatrixAt(i, m4);
    });
    trunks.castShadow = crowns.castShadow = true;
    env.add(trunks, crowns);
  }

  // ---- 岸边芦苇（两岸水线附近，InstancedMesh 锥体） ----
  {
    const reedGeo = new THREE.ConeGeometry(0.05, 1.4, 4);
    const reedMat = new THREE.MeshStandardMaterial({ color: '#8a7f4e', roughness: 1 });
    const perBank = 400;
    const reeds = new THREE.InstancedMesh(reedGeo, reedMat, perBank * 2);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < perBank * 2; i++) {
      const side = i < perBank ? -1 : 1;
      const x = (rng() * 2 - 1) * 250;
      const d = -1.5 + rng() * 7;                               // 浅水带到岸上
      const z = side * (RIVER.halfWidth + d);
      const s = 0.7 + rng() * 0.9;
      const y = Math.max(bankHeight(x, d, side), -0.4) + 0.45 * s;
      m4.makeRotationY(rng() * Math.PI);
      m4.scale(new THREE.Vector3(s, s * (0.85 + rng() * 0.5), s));
      m4.setPosition(x, y, z);
      reeds.setMatrixAt(i, m4);
    }
    reeds.instanceMatrix.needsUpdate = true;
    env.add(reeds);
  }

  // ---- 风痕（东南大风起时可见的顺风飞掠细线，InstancedMesh 薄长条） ----
  const STREAKS = 140;
  const streakGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
  const streakMat = new THREE.MeshBasicMaterial({
    color: '#cdd8ec', transparent: true, opacity: 0, depthWrite: false,
  });
  const streaks = new THREE.InstancedMesh(streakGeo, streakMat, STREAKS);
  streaks.frustumCulled = false;
  streaks.visible = false;
  const streakPos = new Float32Array(STREAKS * 3);
  const streakSpd = new Float32Array(STREAKS);
  for (let i = 0; i < STREAKS; i++) {
    streakPos[i * 3] = (rng() * 2 - 1) * 95;
    streakPos[i * 3 + 1] = 1.2 + rng() * 13;
    streakPos[i * 3 + 2] = (rng() * 2 - 1) * 95;
    streakSpd[i] = 0.75 + rng() * 0.7;
  }
  env.add(streaks);
  const _sm4 = new THREE.Matrix4();
  const _squat = new THREE.Quaternion();
  const _svec = new THREE.Vector3();

  // ---- 灯光与雾 ----
  scene.fog = new THREE.Fog('#8a94a0', 90, 360);

  const hemi = new THREE.HemisphereLight('#8a96ad', '#4f463c', 0.9);
  env.add(hemi);

  const sun = new THREE.DirectionalLight('#ffb36b', 1.8);
  sun.position.set(-150, 26, 55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -130;   // 覆盖主战场
  sun.shadow.camera.right = sun.shadow.camera.top = 130;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 1.5;
  env.add(sun, sun.target);

  // 火攻之夜的全局暖色环境光
  const fireAmbient = new THREE.AmbientLight('#ff7a3a', 0);
  env.add(fireAmbient);

  // ---- 相位插值状态 ----
  const cur = {};
  let target = PHASES.dusk;
  function snap(name) {
    const p = PHASES[name];
    for (const k of NUM_KEYS) cur[k] = p[k];
    for (const k of COLOR_KEYS) cur[k] = p[k].clone();
    for (const k of VEC_KEYS) cur[k] = p[k].clone();
  }
  snap('dusk');

  // ---- 风状态 ----
  let time = 0;
  let windBase = 1.2;        // 风力基准（缓动逼近目标）
  let windTarget = 1.2;
  const wind = new THREE.Vector3();

  function update(dt, t) {
    time = typeof t === 'number' ? t : time + dt;
    uTime.value = time;

    // 相位整体 lerp（时间常数 2.4s，约 6~8 秒收敛）
    const k = 1 - Math.exp(-dt / 2.4);
    for (const key of NUM_KEYS) cur[key] += (target[key] - cur[key]) * k;
    for (const key of COLOR_KEYS) cur[key].lerp(target[key], k);
    for (const key of VEC_KEYS) cur[key].lerp(target[key], k);

    // 应用到灯光/雾/天空
    sun.color.copy(cur.sunColor);
    sun.intensity = cur.sunIntensity;
    sun.position.copy(cur.sunPos);
    hemi.color.copy(cur.hemiSky);
    hemi.groundColor.copy(cur.hemiGround);
    hemi.intensity = cur.hemiIntensity;
    scene.fog.color.copy(cur.fogColor);
    scene.fog.near = cur.fogNear;
    scene.fog.far = cur.fogFar;
    skyMat.uniforms.uTop.value.copy(cur.skyTop);
    skyMat.uniforms.uHorizon.value.copy(cur.skyHorizon);
    skyMat.uniforms.uGlowColor.value.copy(cur.glowColor);
    skyMat.uniforms.uGlowDir.value.copy(cur.glowDir).normalize();
    skyMat.uniforms.uGlowStrength.value = cur.glowStrength;
    skyMat.uniforms.uGlowPow.value = cur.glowPow;
    fireAmbient.intensity = cur.ambient;

    // 水面映空色：雾色与地平线色的混合
    uSkyReflect.value.copy(cur.fogColor).lerp(cur.skyHorizon, 0.45);

    // 云随相位调色/显隐 + 随风缓漂
    cloudMat.color.copy(cur.cloudColor);
    cloudMat.opacity = cur.cloudOpacity;
    const cdx = wind.x * dt * 0.35, cdz = wind.z * dt * 0.35;
    for (const sp of clouds) {
      sp.position.x += cdx;
      sp.position.z += cdz;
      // 漂出边界从对侧回卷
      if (sp.position.x < -360) sp.position.x += 720;
      if (sp.position.x > 360) sp.position.x -= 720;
      if (sp.position.z < -360) sp.position.z += 720;
      if (sp.position.z > 360) sp.position.z -= 720;
    }

    // 星月随相位显隐
    starMat.opacity = cur.starOpacity;
    stars.visible = cur.starOpacity > 0.02;
    moonCoreMat.opacity = cur.moonOpacity * 0.95;
    moonHaloMat.opacity = cur.moonOpacity * 0.2;
    moon.visible = cur.moonOpacity > 0.02;

    // 风力缓动（时间常数 1.1s，约 3~4 秒收敛）+ 小幅阵风与风向微摆
    windBase += (windTarget - windBase) * (1 - Math.exp(-dt / 1.1));
    const strength = windBase * (1 + 0.2 * gustNoise(time));
    const wob = 0.05 * gustNoise(time * 0.7 + 9.3);
    const c = Math.cos(wob), s = Math.sin(wob);
    wind.set(WIND_DIR.x * c - WIND_DIR.z * s, 0, WIND_DIR.x * s + WIND_DIR.z * c).multiplyScalar(strength);

    // 风浪：波幅随风力缓动（0.95 静水 → ~1.7 大风），JS/GPU 同源
    const ampTarget = THREE.MathUtils.clamp(0.82 + windBase * 0.12, 0.95, 1.75);
    WAVE_AMP += (ampTarget - WAVE_AMP) * (1 - Math.exp(-dt / 2));
    uWaveAmp.value = WAVE_AMP;

    // 风痕：风力 > 3 时可见，顺风高速飞掠、出界回卷
    const streakK = THREE.MathUtils.clamp((strength - 3) / 4, 0, 1);
    streaks.visible = streakK > 0.02;
    if (streaks.visible) {
      streakMat.opacity = streakK * 0.2;
      const wl = Math.max(strength, 0.001);
      _svec.set(wind.x / wl, 0, wind.z / wl);
      _squat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _svec);
      const len = 2.5 + strength * 0.55;
      for (let i = 0; i < STREAKS; i++) {
        const i3 = i * 3;
        streakPos[i3] += wind.x * streakSpd[i] * dt * 2.6;
        streakPos[i3 + 2] += wind.z * streakSpd[i] * dt * 2.6;
        // 出界（±95 区域）回卷到上风向
        if (streakPos[i3] < -95) streakPos[i3] += 190;
        if (streakPos[i3] > 95) streakPos[i3] -= 190;
        if (streakPos[i3 + 2] < -95) streakPos[i3 + 2] += 190;
        if (streakPos[i3 + 2] > 95) streakPos[i3 + 2] -= 190;
        const y = streakPos[i3 + 1] + Math.sin(time * 2.2 + i) * 0.4;
        _svec.set(streakPos[i3], y, streakPos[i3 + 2]);
        _sm4.compose(_svec, _squat, new THREE.Vector3(1, 1, len * streakSpd[i]));
        streaks.setMatrixAt(i, _sm4);
      }
      streaks.instanceMatrix.needsUpdate = true;
    }
  }

  function getWind() { return wind; }
  function setWind(strength) { windTarget = strength; }
  function setPhase(name) { if (PHASES[name]) target = PHASES[name]; }

  return {
    update,
    waterHeight: waveHeightJS,
    bankHeight,
    getWind,
    setWind,
    setPhase,
    sun,
    hemi,
    WATER_Y,
    RIVER,
  };
}
