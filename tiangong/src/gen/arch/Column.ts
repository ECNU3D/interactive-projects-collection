/**
 * Column.ts —— 柱网、额枋、墙体与朱门（含门钉、匾额）｜文档 02 §3.1 / 文档 03 §1.9
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, type HallSpec } from './params';

export interface ColumnGrid {
  /** 檐柱位置（含朝向面标记） */
  positions: { x: number; z: number; face: 'front' | 'back' | 'left' | 'right' | 'corner' }[];
  /** 各间宽度（自明间向两侧 0.92 递减） */
  bayWidths: number[];
  depthBays: number[];
  /** 柱网总宽/总深 */
  width: number;
  depth: number;
}

/** 间宽序列：明间 bayWidth，次间递减 */
export function bayWidths(bays: number, bayWidth: number): number[] {
  const widths: number[] = [];
  const half = (bays - 1) / 2;
  for (let i = 0; i < bays; i++) {
    const k = Math.abs(i - half);
    widths.push(bayWidth * Math.pow(0.92, k));
  }
  return widths;
}

export function columnGrid(spec: HallSpec): ColumnGrid {
  const bw = bayWidths(spec.bays, spec.bayWidth);
  const db = bayWidths(spec.depths, spec.bayWidth * 0.72);
  const width = bw.reduce((a, b) => a + b, 0);
  const depth = db.reduce((a, b) => a + b, 0);
  const xs: number[] = [-width / 2];
  for (const w of bw) xs.push(xs[xs.length - 1] + w);
  const zs: number[] = [-depth / 2];
  for (const w of db) zs.push(zs[zs.length - 1] + w);

  const positions: ColumnGrid['positions'] = [];
  for (let i = 0; i < xs.length; i++) {
    positions.push({ x: xs[i], z: depth / 2, face: i === 0 ? 'corner' : i === xs.length - 1 ? 'corner' : 'front' });
    positions.push({ x: xs[i], z: -depth / 2, face: i === 0 ? 'corner' : i === xs.length - 1 ? 'corner' : 'back' });
  }
  for (let j = 1; j < zs.length - 1; j++) {
    positions.push({ x: -width / 2, z: zs[j], face: 'left' });
    positions.push({ x: width / 2, z: zs[j], face: 'right' });
  }
  return { positions, bayWidths: bw, depthBays: db, width, depth };
}

/** 柱 + 额枋合并几何（朱漆） */
export function buildColumnsAndBeams(
  grid: ColumnGrid,
  columnHeight: number,
  columnRadius: number,
): { columns: THREE.BufferGeometry; beams: THREE.BufferGeometry; beamTopY: number } {
  const cols: THREE.BufferGeometry[] = [];
  for (const p of grid.positions) {
    const g = new THREE.CylinderGeometry(columnRadius * 0.92, columnRadius, columnHeight, 10);
    g.translate(p.x, columnHeight / 2, p.z);
    cols.push(g);
  }
  const columns = mergeGeometries(cols)!;
  columns.computeVertexNormals();

  // 额枋：沿四面柱顶的梁
  const beams: THREE.BufferGeometry[] = [];
  const beamH = columnHeight * 0.09;
  const beamW = columnRadius * 1.6;
  const y = columnHeight + beamH / 2;
  const { width, depth } = grid;
  for (const [w, d, x, z] of [
    [width, beamW, 0, depth / 2],
    [width, beamW, 0, -depth / 2],
    [beamW, depth, width / 2, 0],
    [beamW, depth, -width / 2, 0],
  ] as const) {
    const g = new THREE.BoxGeometry(w, beamH, d);
    g.translate(x, y, z);
    beams.push(g);
  }
  const beamGeo = mergeGeometries(beams)!;
  beamGeo.computeVertexNormals();
  return { columns, beams: beamGeo, beamTopY: columnHeight + beamH };
}

export interface DoorHole {
  /** 门洞中心（局部坐标）与尺寸——碰撞体要挖开 */
  x: number;
  z: number;
  width: number;
  face: 'front' | 'back';
}

/**
 * 墙体：四面围合，前檐明间/次间留门洞。
 * @returns 墙体几何 + 门洞记录 + 门扇几何（朱门 + 门钉位）
 */
export function buildWalls(
  grid: ColumnGrid,
  height: number,
  spec: HallSpec,
): { walls: THREE.BufferGeometry; doors: THREE.BufferGeometry; holes: DoorHole[]; nailMatrices: THREE.Matrix4[] } {
  const wallParts: THREE.BufferGeometry[] = [];
  const doorParts: THREE.BufferGeometry[] = [];
  const holes: DoorHole[] = [];
  const nailMatrices: THREE.Matrix4[] = [];
  const t = 0.5; // 墙厚
  const { width, depth, bayWidths: bw } = grid;

  // 前檐：中央 1–3 间开门
  const half = (spec.bays - 1) / 2;
  const doorBays = new Set<number>([half]);
  if (spec.bays >= 7) {
    doorBays.add(half - 1);
    doorBays.add(half + 1);
  }
  let x = -width / 2;
  for (let i = 0; i < spec.bays; i++) {
    const w = bw[i];
    if (doorBays.has(i)) {
      // 门洞：上方留槛墙（额枋以下 15% 做横披）
      const lintelH = height * 0.15;
      const lintel = new THREE.BoxGeometry(w, lintelH, t);
      lintel.translate(x + w / 2, height - lintelH / 2, depth / 2);
      wallParts.push(lintel);
      // 门扇（双开，半掩）
      const doorW = w * 0.92;
      const doorH = height - lintelH;
      for (const s of [-1, 1]) {
        const dg = new THREE.BoxGeometry(doorW / 2, doorH, 0.12);
        dg.translate(x + w / 2 + (s * doorW) / 4, doorH / 2, depth / 2 - t / 2 + 0.06);
        doorParts.push(dg);
        // 门钉
        const [routes, rows] = spec.doorNails;
        for (let r = 0; r < routes; r++) {
          for (let c = 0; c < rows; c++) {
            const nx = x + w / 2 + (s * doorW) / 4 + ((r + 0.5) / routes - 0.5) * (doorW / 2) * 0.85;
            const ny = ((c + 0.5) / rows) * doorH * 0.9 + doorH * 0.05;
            const m = new THREE.Matrix4().setPosition(nx, ny, depth / 2 - t / 2 + 0.14);
            nailMatrices.push(m);
          }
        }
      }
      holes.push({ x: x + w / 2, z: depth / 2, width: doorW * 0.8, face: 'front' });
    } else {
      const g = new THREE.BoxGeometry(w, height, t);
      g.translate(x + w / 2, height / 2, depth / 2);
      wallParts.push(g);
    }
    x += w;
  }
  // 后檐与两山：实心
  const back = new THREE.BoxGeometry(width, height, t);
  back.translate(0, height / 2, -depth / 2);
  wallParts.push(back);
  for (const s of [-1, 1]) {
    const side = new THREE.BoxGeometry(t, height, depth);
    side.translate((s * width) / 2, height / 2, 0);
    wallParts.push(side);
  }

  const walls = mergeGeometries(wallParts)!;
  walls.computeVertexNormals();
  const doors = mergeGeometries(doorParts)!;
  doors.computeVertexNormals();
  return { walls, doors, holes, nailMatrices };
}

/** 门钉 geometry（一颗） */
export function doorNailGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.09, 8, 6);
  g.scale(1, 1, 0.55);
  return g;
}

/** 匾额（CanvasTexture 金字蓝底） */
export function buildPlaque(text: string, width = 4): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1d2b4a';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#c9a45c';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 176);
  ctx.fillStyle = '#e8d9a0';
  ctx.font = 'bold 108px "Songti SC", "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 100);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.6, metalness: 0.1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, width * 0.375, 0.12), mat);
  return mesh;
}

export { PALETTE };
