/**
 * Roof.ts —— 屋顶（庑殿/歇山/攒尖/悬山/硬山）+ 举架曲线 + 翼角起翘｜文档 02 §3.2
 *
 * 构造法：把屋顶看作平面上的高度场。
 *   h(x,z) = 举架折线( min(距前后檐口, 距两端檐口) ) + 翼角抬升
 * 「距檐口的水平距离 → 高度」由举架折线插值（params.juzheHeight），
 * 距离变换天然给出 45° 戗脊；正方形平面 + 全向距离 = 攒尖。
 * 翼角：檐口自"起翘点"向角点按幂曲线抬升并外冲（冲三翘四）。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  EaveCornerSpec,
  defaultEaveCorner,
  eaveOffset,
  juzheHeight,
  purlinPoints,
  PALETTE,
} from './params';

export type RoofType = 'wudian' | 'xieshan' | 'zanjian' | 'xuanshan' | 'yingshan';

export interface RoofOptions {
  /** 屋面平面尺寸（含出檐）：宽 x，深 z */
  width: number;
  depth: number;
  type: RoofType;
  purlins: 5 | 7 | 9 | 11;
  corner?: EaveCornerSpec;
  /** 网格密度（LOD 控制） */
  segX?: number;
  segZ?: number;
  /** 剪边：檐口一圈换绿瓦（顶点色） */
  jianbian?: boolean;
  tileColor?: number;
  /** 环带模式：挖去中央矩形，用于重檐的下檐裙边 */
  ringInner?: { width: number; depth: number };
  /** 屋面整体抬升（檐口标高由调用方平移） */
}

export interface RoofResult {
  geometry: THREE.BufferGeometry;
  /** 脊檩（最高点）相对檐口的净高 */
  ridgeHeight: number;
  /** 正脊半长（庑殿/歇山）；攒尖为 0 */
  ridgeHalfLen: number;
  /** 半跨（檐檩到脊檩的水平距离） */
  spanHalf: number;
}

/** 屋面高度场 */
export function makeRoofHeightField(opts: RoofOptions) {
  const halfW = opts.width / 2;
  const halfD = opts.depth / 2;
  const corner = opts.corner ?? defaultEaveCorner(opts.depth / 30);
  const isGable = opts.type === 'xuanshan' || opts.type === 'yingshan';
  // 半跨：两坡顶只到进深一半；四坡顶受端部限制
  const spanHalf = isGable ? halfD : halfD;
  const ridgeHalfLen =
    opts.type === 'zanjian' ? 0 : isGable ? halfW : Math.max(halfW - halfD, halfW * 0.12);

  function heightAt(x: number, z: number): number {
    const dz = halfD - Math.abs(z); // 距前后檐口
    const dx = halfW - Math.abs(x); // 距两端檐口
    let d: number;
    if (isGable) {
      d = dz;
    } else if (opts.type === 'zanjian') {
      d = Math.min(dz, dx);
    } else {
      d = Math.min(dz, dx);
    }
    let h = juzheHeight(d, spanHalf, opts.purlins);

    // 翼角起翘：仅在靠角区域抬升（四坡顶）
    if (!isGable) {
      const upLen = Math.max(corner.startRatio * halfW, corner.startRatio * halfD * 2);
      // 沿檐口方向到最近转角的距离
      const along = Math.min(halfW - Math.abs(x), halfD - Math.abs(z));
      // 只影响近檐口的点（深处按权重衰减）
      const nearEave = 1 - Math.min(d / (spanHalf * 0.9), 1);
      if (along < upLen) {
        const t = 1 - along / upLen;
        const { dy } = eaveOffset(t, corner);
        h += dy * (0.35 + 0.65 * nearEave);
      }
    }
    return h;
  }

  /** 翼角外冲：近角顶点沿对角线外推 */
  function outwardAt(x: number, z: number): { ox: number; oz: number } {
    if (isGable) return { ox: 0, oz: 0 };
    const upLen = Math.max(corner.startRatio * halfW, corner.startRatio * halfD * 2);
    const along = Math.min(halfW - Math.abs(x), halfD - Math.abs(z));
    if (along >= upLen) return { ox: 0, oz: 0 };
    const t = 1 - along / upLen;
    const { dOut } = eaveOffset(t, corner);
    const sx = Math.sign(x) || 1;
    const sz = Math.sign(z) || 1;
    const inv = Math.SQRT1_2;
    return { ox: sx * dOut * inv, oz: sz * dOut * inv };
  }

  return { heightAt, outwardAt, spanHalf, ridgeHalfLen, ridgeHeight: juzheHeight(spanHalf, spanHalf, opts.purlins) };
}

/** 生成屋面网格（带顶点色：主体瓦色 + 剪边绿檐口 + 瓦垄条纹） */
export function buildRoof(opts: RoofOptions): RoofResult {
  const segX = opts.segX ?? 36;
  const segZ = opts.segZ ?? 20;
  const field = makeRoofHeightField(opts);
  const halfW = opts.width / 2;
  const halfD = opts.depth / 2;
  const tile = new THREE.Color(opts.tileColor ?? PALETTE.liuliHuang);
  const jianbianColor = new THREE.Color(PALETTE.liuliLv);

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const indexOf = new Map<string, number>();

  const inner = opts.ringInner;
  function insideInner(x: number, z: number): boolean {
    if (!inner) return false;
    return Math.abs(x) < inner.width / 2 - 0.01 && Math.abs(z) < inner.depth / 2 - 0.01;
  }

  function vertKey(ix: number, iz: number): string {
    return ix + ':' + iz;
  }

  function pushVertex(ix: number, iz: number): number {
    const key = vertKey(ix, iz);
    const hit = indexOf.get(key);
    if (hit !== undefined) return hit;
    const u = ix / segX;
    const v = iz / segZ;
    const x = (u - 0.5) * opts.width;
    const z = (v - 0.5) * opts.depth;
    const { ox, oz } = field.outwardAt(x, z);
    const y = field.heightAt(x, z);
    const idx = positions.length / 3;
    positions.push(x + ox, y, z + oz);
    normals.push(0, 1, 0); // 后面统一重算
    // 顶点色：剪边 = 檐口带宽（约 1/8 半跨）用绿
    const dz = halfD - Math.abs(z);
    const dx = halfW - Math.abs(x);
    const dEdge = Math.min(dz, dx);
    let c = tile;
    if (opts.jianbian && dEdge < field.spanHalf * 0.14) c = jianbianColor;
    colors.push(c.r, c.g, c.b);
    uvs.push(u * opts.width, v * opts.depth); // 世界尺度 UV，供瓦垄条纹用
    indexOf.set(key, idx);
    return idx;
  }

  const stepX = opts.width / segX;
  const stepZ = opts.depth / segZ;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const cx = (ix + 0.5) * stepX - halfW;
      const cz = (iz + 0.5) * stepZ - halfD;
      if (insideInner(cx, cz)) continue;
      const a = pushVertex(ix, iz);
      const b = pushVertex(ix + 1, iz);
      const c = pushVertex(ix + 1, iz + 1);
      const d = pushVertex(ix, iz + 1);
      indices.push(a, d, b, b, d, c); // 逆时针朝上（+y）
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return {
    geometry: geo,
    ridgeHeight: field.ridgeHeight,
    ridgeHalfLen: field.ridgeHalfLen,
    spanHalf: field.spanHalf,
  };
}

/**
 * 屋脊：正脊 + 垂脊/戗脊（沿高度场的脊线放样圆管）
 */
export function buildRidges(
  opts: RoofOptions,
  field: ReturnType<typeof makeRoofHeightField>,
  radius = 0.35,
): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  const halfW = opts.width / 2;
  const halfD = opts.depth / 2;
  const isGable = opts.type === 'xuanshan' || opts.type === 'yingshan';
  const ridgeH = field.ridgeHeight;

  function loft(pts: THREE.Vector3[], r: number): THREE.BufferGeometry {
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, Math.max(pts.length * 2, 8), r, 6, false);
  }

  // 正脊（重檐裙边无正脊）
  if (!opts.ringInner && opts.type !== 'zanjian' && field.ridgeHalfLen > 0.05) {
    const pts: THREE.Vector3[] = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const x = -field.ridgeHalfLen + (i / n) * 2 * field.ridgeHalfLen;
      const z = 0;
      pts.push(new THREE.Vector3(x, field.heightAt(x, z) + radius * 0.4, z));
    }
    geos.push(loft(pts, radius * 1.35));
  }

  if (!isGable) {
    // 四条垂脊/戗脊：沿 45° 角线从脊端到檐角（重檐裙边：从内环角到檐角）
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pts: THREE.Vector3[] = [];
        const n = 12;
        const startX = opts.ringInner
          ? sx * (opts.ringInner.width / 2)
          : opts.type === 'zanjian'
            ? 0
            : sx * field.ridgeHalfLen;
        const startZ = opts.ringInner ? sz * (opts.ringInner.depth / 2) : 0;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const x = THREE.MathUtils.lerp(startX, sx * halfW, t);
          const z = THREE.MathUtils.lerp(startZ, sz * halfD, t);
          const { ox, oz } = field.outwardAt(x, z);
          pts.push(new THREE.Vector3(x + ox, field.heightAt(x, z) + radius * 0.4, z + oz));
        }
        geos.push(loft(pts, radius));
      }
    }
  } else {
    // 两坡顶：前后坡边缘的博脊略
  }
  return geos;
}

/** 攒尖宝顶：金葫芦 / 宝珠（灵霄宝殿"大金葫芦顶"） */
export function buildFinial(kind: 'jinhulu' | 'baozhu', scale = 1): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  if (kind === 'jinhulu') {
    // 葫芦剖面：座 → 下球 → 收腰 → 上球 → 尖
    const profile: [number, number][] = [
      [0.9, 0], [1.0, 0.25], [0.85, 1.0], [1.05, 1.6], [0.95, 2.2],
      [0.45, 2.7], [0.6, 3.0], [0.55, 3.5], [0.3, 3.9], [0.08, 4.3], [0.0, 4.6],
    ];
    for (const [r, y] of profile) pts.push(new THREE.Vector2(r * scale, y * scale));
  } else {
    const profile: [number, number][] = [
      [0.7, 0], [0.85, 0.5], [0.7, 1.1], [0.4, 1.5], [0.0, 1.9],
    ];
    for (const [r, y] of profile) pts.push(new THREE.Vector2(r * scale, y * scale));
  }
  return new THREE.LatheGeometry(pts, 12);
}

export { mergeGeometries };
