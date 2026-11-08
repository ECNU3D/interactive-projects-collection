/**
 * Ribbon.ts —— 祥云流光 / 幢幡｜文档 02 §5.5 / 文档 03 §4.4
 *
 * 祥云流光：沿 Catmull-Rom 曲线生成 ribbon，UV 滚动 + 加法混合。
 * 作用：把空旷的宫殿间距填满，让"空"变成"辽阔"。
 */
import * as THREE from 'three/webgpu';
import {
  Fn, vec2, vec3, vec4, float, attribute,
  uv, time, sin, mix, smoothstep, color,
} from 'three/tsl';

/** 沿曲线的飘带几何：每顶点存 (沿线参数 t, 侧向 -1..1) */
function ribbonGeometry(curve: THREE.CatmullRomCurve3, width: number, segments = 120): THREE.BufferGeometry {
  const positions: number[] = [];
  const params: number[] = []; // (t, side)
  const indices: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const side = new THREE.Vector3().crossVectors(tan, up).normalize();
    if (side.lengthSq() < 0.01) side.set(1, 0, 0);
    const w = width * (0.6 + 0.4 * Math.sin(t * Math.PI)); // 两端收
    positions.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
    params.push(t, -1);
    positions.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
    params.push(t, 1);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('rparam', new THREE.Float32BufferAttribute(params, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export interface RibbonOptions {
  points: THREE.Vector3[];
  width?: number;
  color?: number;
  color2?: number;
  /** UV 滚动速度（慢） */
  speed?: number;
  /** 顶点波动幅度 */
  wave?: number;
}

/** 祥云流光 */
export function buildRibbon(opts: RibbonOptions): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(opts.points);
  const geo = ribbonGeometry(curve, opts.width ?? 2.2);
  const speed = opts.speed ?? 0.02;
  const wave = opts.wave ?? 1.5;

  const param: any = attribute('rparam') as never;
  const mat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  // 顶点波动（正弦 + 噪声感）
  mat.positionNode = Fn(() => {
    const p: any = attribute('position') as never;
    const w = sin(time.mul(0.5).add(param.x.mul(14))).mul(wave * 0.4);
    const w2 = sin(time.mul(0.33).add(param.x.mul(23).add(1.7))).mul(wave * 0.25);
    return vec3(p.x.add(w2), p.y.add(w), p.z.add(w2));
  })();

  mat.colorNode = Fn(() => {
    // 滚动的高光带：无始无终
    const band: any = smoothstep(0.0, 0.35, sin(param.x.mul(20).sub(time.mul(speed * 60))).mul(0.5).add(0.5));
    const edge: any = param.y.mul(param.y).oneMinus(); // 侧向羽化
    const col: any = mix(color(opts.color ?? 0xffe0a0), color(opts.color2 ?? 0xc9b8e0), param.x);
    return vec4(col.r, col.g, col.b, band.mul(edge).mul(0.35));
  })();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/** 幢幡（竖直悬挂的旗，风摆） */
export function buildBanner(width: number, height: number, col = 0xa82f26): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, height, 4, 12);
  geo.translate(0, -height / 2, 0); // 顶端悬挂
  const mat = new THREE.MeshStandardNodeMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.8 });
  mat.positionNode = Fn(() => {
    const p: any = attribute('position') as never;
    const drop = float(height).add(p.y).div(height); // 0 顶 → 1 底
    const sway = sin(time.mul(0.8).add(p.y.mul(1.2))).mul(0.35).mul(drop);
    const sway2 = sin(time.mul(0.53).add(p.y.mul(2.1)).add(1.3)).mul(0.2).mul(drop);
    return vec3(p.x.add(sway2), p.y, p.z.add(sway));
  })();
  return new THREE.Mesh(geo, mat);
}
