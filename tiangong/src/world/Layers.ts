/**
 * Layers.ts —— 五层结构的容器与切换｜文档 01 §1.1 / 文档 02 §6.2
 *
 * 层级可见性本身就是最好的剔除方案：玩家在第三层时，
 * 第二层的宫殿海整体降到剪影，第一层直接隐藏。
 */
import * as THREE from 'three/webgpu';
import placesData from '@content/places.json';

export interface LayerInfo {
  name: string;
  baseY: number;
  cloudY: number;
}

export const LAYERS: Record<number, LayerInfo> = Object.fromEntries(
  Object.entries(placesData.layers).map(([k, v]) => [Number(k), v]),
) as unknown as Record<number, LayerInfo>;

export interface PlaceInfo {
  id: string;
  name: string;
  layer: number;
  center: THREE.Vector3;
  radius: number;
  music: { base: number; melody: number; grand: number };
  reverb: 'outdoor' | 'palace' | 'hall' | 'lingxiao' | 'danfang' | 'moon' | 'garden';
  track?: string;
}

export const PLACES: PlaceInfo[] = placesData.places.map((p) => ({
  id: p.id,
  name: p.name,
  layer: p.layer as 1 | 2 | 3 | 4 | 5,
  center: new THREE.Vector3(...(p.center as [number, number, number])),
  radius: p.radius,
  music: p.music,
  reverb: p.reverb as PlaceInfo['reverb'],
  track: (p as { track?: string }).track,
}));

/** 层级容器：每层的对象挂进对应 Group，便于整层控制 */
export class LayerManager {
  groups: Map<number, THREE.Group> = new Map();

  constructor(private scene: THREE.Scene) {
    for (const [layer, info] of Object.entries(LAYERS)) {
      const g = new THREE.Group();
      g.position.y = info.baseY;
      g.name = `layer-${layer}`;
      scene.add(g);
      this.groups.set(Number(layer), g);
    }
  }

  get(layer: number): THREE.Group {
    return this.groups.get(layer)!;
  }

  /** 层级剔除：只完整显示当前层与相邻层；远处降载 */
  updateVisibility(currentLayer: number): void {
    for (const [layer, g] of this.groups) {
      const d = Math.abs(layer - currentLayer);
      g.visible = d <= 2; // 隔两层以上隐藏
    }
  }

  /** 地面高度场（每层一个函数）：云面软地板 */
  groundYAt(layer: number): number {
    const info = LAYERS[layer];
    return info ? info.cloudY + 12 : -Infinity;
  }
}

/** 由世界坐标判断所在层（最近的 baseY） */
export function layerAtY(y: number): number {
  let best = 1;
  let bd = Infinity;
  for (const [k, info] of Object.entries(LAYERS)) {
    const d = Math.abs(info.baseY - y);
    if (d < bd) {
      bd = d;
      best = Number(k);
    }
  }
  return best;
}

/** 由世界坐标判断所在区域 */
export function placeAt(pos: THREE.Vector3): PlaceInfo | null {
  let best: PlaceInfo | null = null;
  let bd = Infinity;
  for (const p of PLACES) {
    const d = p.center.distanceTo(pos);
    if (d < p.radius && d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
