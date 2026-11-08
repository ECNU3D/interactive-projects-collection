// 共享材质：材质通道（贴图 × 顶点色 + 风摆）/ 水面 / 天空 / 烟
import * as THREE from 'three';
import { P } from './palette.js';
import { getTexture } from './textures.js';

export const uniforms = {
  uTime: { value: 0 },
};

// ---------- 风摆注入 ----------
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
        float ph = position.x * 0.35 + position.z * 0.27;
        float sway = sin(uTime * 1.35 + ph) * 0.55 + sin(uTime * 2.3 + ph * 1.7) * 0.3 + sin(uTime * 4.1 + ph * 0.6) * 0.15;
        transformed.x += sway * aWind * 0.42;
        transformed.z += cos(uTime * 1.1 + ph) * sway * aWind * 0.18;
        transformed.y -= abs(sway) * aWind * 0.08;
      }`
    );
  };
  return mat;
}

// ---------- 世界主材质（顶点色 + 风摆，无贴图） ----------
export function makeWorldMaterial() {
  return applyWind(new THREE.MeshLambertMaterial({ vertexColors: true }));
}

// ---------- 材质通道 ----------
const CH_TEX = {
  flat: null, tile: 'tile', thatch: 'thatch', wood: 'wood', plaster: 'plaster',
  earthwall: 'earthwall', brick: 'brick', reed: 'reed', lattice: 'lattice', silk: 'silk',
};
const _chCache = {};
export function channelMaterial(name) {
  if (!_chCache[name]) {
    const texName = CH_TEX[name] ?? null;
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      map: texName ? getTexture(texName) : null,
    });
    _chCache[name] = applyWind(mat);
  }
  return _chCache[name];
}

// ---------- 水面 ----------
export function makeWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: uniforms.uTime,
      uDeep: { value: new THREE.Color(P.waterDeep) },
      uShallow: { value: new THREE.Color(P.waterShallow) },
      uFog: { value: new THREE.Color(P.fogColor) },
      uFogNear: { value: 60 },
      uFogFar: { value: 260 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec3 p = position;
        // 细浪起伏
        float wx = p.x * 0.5, wz = p.z * 0.5;
        p.y += sin(uTime * 1.2 + wx * 1.2 + wz * 0.8) * 0.05
             + sin(uTime * 2.1 + wz * 2.2 - wx * 0.4) * 0.035;
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
        // 沿 z 方向流动（河水南去）
        vec2 fp = vec2(vWorld.x * 0.14, vWorld.z * 0.14 - uTime * 0.32);
        float n1 = noise(fp * 3.0);
        float n2 = noise(fp * 7.0 + vec2(3.7, 1.3) + uTime * 0.05);
        // 水纹墨线（仿画中鳞状水纹）
        float streak = sin(vWorld.z * 1.35 - uTime * 1.6 + n1 * 5.2 + vWorld.x * 0.55);
        streak = smoothstep(0.72, 0.99, streak) * 0.5;
        float depthMix = clamp(0.4 + 0.6 * n1, 0.0, 1.0);
        vec3 col = mix(uShallow, uDeep, depthMix);
        col += streak * vec3(0.16, 0.17, 0.15);
        col += (n2 - 0.5) * 0.08;
        // 岸边淡出
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float alpha = mix(0.65, 0.92, edge);
        // 雾
        float d = distance(cameraPosition, vWorld);
        float f = smoothstep(uFogNear, uFogFar, d);
        col = mix(col, uFog, f);
        gl_FragColor = vec4(col, alpha * (1.0 - f * 0.55));
      }
    `,
  });
}

// ---------- 天空穹顶 ----------
export function makeSky() {
  const geo = new THREE.SphereGeometry(900, 20, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(P.skyTop) },
      uBottom: { value: new THREE.Color(P.skyBottom) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop, uBottom;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        float t = smoothstep(-0.08, 0.55, h);
        vec3 col = mix(uBottom, uTop, t);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- 炊烟粒子材质 ----------
export function makeSmokeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: uniforms.uTime,
      uColor: { value: new THREE.Color(0xaba088) },
    },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      varying float vLife;
      void main() {
        float life = fract(aSeed + uTime * 0.055 / (0.6 + fract(aSeed * 7.13) * 0.8));
        vLife = life;
        vec3 p = position;
        float drift = aSeed * 6.2831;
        p.y += life * (7.0 + fract(aSeed * 3.7) * 5.0);
        p.x += sin(uTime * 0.5 + drift + life * 4.0) * (0.3 + life * 1.6) + life * life * 2.2;
        p.z += cos(uTime * 0.4 + drift * 1.3 + life * 3.0) * (0.2 + life * 1.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = (1.6 + life * 6.0) * (220.0 / -mv.z);
        gl_PointSize = clamp(size, 1.0, 70.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vLife;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.12, d);
        float fade = smoothstep(0.0, 0.15, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
        gl_FragColor = vec4(uColor, a * fade * 0.34);
      }
    `,
  });
}
