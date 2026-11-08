// 共享材質：材質通道（貼圖 × 頂點色 + 風擺）/ 水面 / 天空 / 煙
import * as THREE from 'three';
import { P } from './palette.js';
import { getTexture, texBoost } from './textures.js';
import { plaqueTexture, coupletTexture } from './plaques.js';

export const uniforms = { uTime: { value: 0 } };

// ---------- 風擺注入（竹、柳、芭蕉、幡幢） ----------
export function applyWind(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = `
      attribute float aWind;
      uniform float uTime;
    ` + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      if (aWind > 0.001) {
        float ph = position.x * 0.33 + position.z * 0.25;
        float sway = sin(uTime * 1.25 + ph) * 0.55 + sin(uTime * 2.2 + ph * 1.7) * 0.3 + sin(uTime * 3.9 + ph * 0.6) * 0.15;
        transformed.x += sway * aWind * 0.40;
        transformed.z += cos(uTime * 1.05 + ph) * sway * aWind * 0.17;
        transformed.y -= abs(sway) * aWind * 0.07;
      }`
    );
  };
  return mat;
}

// ---------- 材質通道 ----------
// 通道名即貼圖名；'flat' 為純頂點色
const CHANNELS = [
  'flat', 'tile', 'liuli', 'ridge', 'brick', 'mandi', 'cobble', 'stone', 'rock',
  'plaster', 'earth', 'wood', 'lattice', 'ice', 'tortoise', 'zhiling',
  'xuanzi', 'hexi', 'sushi', 'thatch', 'silk', 'paper', 'bamboo', 'grass', 'plaque', 'couplet',
  'leaf', 'willow', 'pine', 'blossom', 'bambooleaf', 'banana', 'tuft',
];

// 頂點色提亮：由貼圖實測線性均值反推（見 textures.js 的歸一與 texBoost）。
// 帶自身色彩的通道（彩畫、櫺心、匾額）頂點色恆為白，不提亮。
const NO_BOOST = new Set(['flat', 'xuanzi', 'hexi', 'sushi', 'lattice', 'ice', 'tortoise', 'zhiling', 'plaque', 'couplet',
  'leaf', 'willow', 'pine', 'blossom', 'bambooleaf', 'banana', 'tuft']);

// 枝葉貼圖帶 alpha，需要 alphaTest 摳掉背景，且正反都要看得見
export const FOLIAGE = new Set(['leaf', 'willow', 'pine', 'blossom', 'bambooleaf', 'banana', 'tuft']);

export function channelBoost(name) {
  if (NO_BOOST.has(name)) return 1;
  return texBoost(name);
}

// 三向映射密度（每世界單位重複次數）；用 uvMode:'geo' 的通道此值無效
export const TEXSCALE = {
  flat: 0.3, tile: 0.5, liuli: 0.5, ridge: 0.5, brick: 0.34, mandi: 0.22,
  cobble: 0.4, stone: 0.2, rock: 0.16, plaster: 0.13, earth: 0.16, wood: 0.5,
  lattice: 0.5, ice: 0.4, tortoise: 0.45, zhiling: 0.6,
  xuanzi: 0.3, hexi: 0.3, sushi: 0.3, thatch: 0.45, silk: 0.5, paper: 0.4,
  bamboo: 0.5, grass: 0.2, plaque: 0.4, couplet: 0.4,
  leaf: 0.3, willow: 0.3, pine: 0.3, blossom: 0.3, bambooleaf: 0.3, banana: 0.3, tuft: 0.3,
};

const _chCache = {};
export function channelMaterial(name) {
  if (!_chCache[name]) {
    let map = null;
    if (name === 'plaque') map = plaqueTexture();
    else if (name === 'couplet') map = coupletTexture();
    else if (name !== 'flat') map = getTexture(name);
    const foliage = FOLIAGE.has(name);
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      map,
      side: foliage ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: foliage ? 0.45 : 0,
    });
    _chCache[name] = applyWind(mat);
  }
  return _chCache[name];
}

export const ALL_CHANNELS = CHANNELS;

// ---------- 水面：沁芳溪 ----------
export function makeWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: uniforms.uTime,
      uDeep: { value: new THREE.Color(P.waterDeep) },
      uShallow: { value: new THREE.Color(P.waterShallow) },
      uFog: { value: new THREE.Color(P.fogColor) },
      uFogNear: { value: 70 },
      uFogFar: { value: 320 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.y += sin(uTime * 1.1 + p.x * 0.55 + p.z * 0.4) * 0.035
             + sin(uTime * 1.9 + p.z * 1.1 - p.x * 0.3) * 0.025;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uFog;
      uniform float uFogNear, uFogFar;
      varying vec2 vUv;
      varying vec3 vWorld;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }

      void main() {
        // 沁芳溪自東北來，向西南去
        vec2 fp = vec2(vWorld.x * 0.11 + uTime * 0.10, vWorld.z * 0.11 - uTime * 0.14);
        float n1 = noise(fp * 3.0);
        float n2 = noise(fp * 8.0 + vec2(3.7, 1.3));
        float streak = sin(vWorld.x * 0.9 + vWorld.z * 0.7 - uTime * 1.2 + n1 * 5.0);
        streak = smoothstep(0.76, 0.99, streak) * 0.42;
        vec3 col = mix(uShallow, uDeep, clamp(0.35 + 0.65 * n1, 0.0, 1.0));
        col += streak * vec3(0.20, 0.21, 0.19);
        col += (n2 - 0.5) * 0.07;
        // 岸邊淡出
        float edge = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x);
        float alpha = mix(0.62, 0.92, edge);
        float d = distance(cameraPosition, vWorld);
        float f = smoothstep(uFogNear, uFogFar, d);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, alpha * (1.0 - f * 0.5));
      }
    `,
  });
}

// ---------- 天空穹頂 ----------
export function makeSky() {
  const geo = new THREE.SphereGeometry(1400, 24, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(P.skyTop) },
      uBottom: { value: new THREE.Color(P.skyBottom) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform vec3 uTop, uBottom;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        float t = smoothstep(-0.10, 0.60, h);
        gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- 炊煙／香煙粒子 ----------
export function makeSmokeMaterial(color = 0xb0a690) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: uniforms.uTime, uColor: { value: new THREE.Color(color) } },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      varying float vLife;
      void main() {
        float life = fract(aSeed + uTime * 0.05 / (0.6 + fract(aSeed * 7.13) * 0.8));
        vLife = life;
        vec3 p = position;
        float drift = aSeed * 6.2831;
        p.y += life * (6.0 + fract(aSeed * 3.7) * 4.5);
        p.x += sin(uTime * 0.45 + drift + life * 4.0) * (0.3 + life * 1.4) + life * life * 1.8;
        p.z += cos(uTime * 0.36 + drift * 1.3 + life * 3.0) * (0.2 + life * 1.1);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.4 + life * 5.4) * (220.0 / -mv.z), 1.0, 64.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.12, d);
        float fade = smoothstep(0.0, 0.15, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
        gl_FragColor = vec4(uColor, a * fade * 0.30);
      }
    `,
  });
}

// ---------- 落花（怡紅院海棠、瀟湘館竹葉） ----------
export function makePetalMaterial(color = 0xd08a97) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: uniforms.uTime, uColor: { value: new THREE.Color(color) } },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      varying float vA;
      void main() {
        float sp = 0.35 + fract(aSeed * 5.31) * 0.45;
        float life = fract(aSeed + uTime * sp * 0.06);
        vec3 p = position;
        p.y -= life * 9.0;
        p.x += sin(uTime * 0.9 + aSeed * 20.0 + life * 9.0) * 1.7;
        p.z += cos(uTime * 0.7 + aSeed * 13.0 + life * 7.0) * 1.4;
        vA = (1.0 - smoothstep(0.75, 1.0, life)) * smoothstep(0.0, 0.08, life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(2.6 * (200.0 / -mv.z), 1.0, 9.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.2, d) * vA * 0.85);
      }
    `,
  });
}
