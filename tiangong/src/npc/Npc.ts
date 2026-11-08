/**
 * Npc.ts —— 单个 NPC：位置、朝向、待机动画、交互半径｜文档 02 §2
 */
import * as THREE from 'three/webgpu';
import { buildFigure, type FigureSpec, type FigureParts } from './Figure';

export interface NpcDef {
  /** 唯一 id，对应 content/dialogue/{id}.yaml 与语音包名 */
  id: string;
  name: string;
  figure: FigureSpec;
  /** 世界坐标与朝向 */
  position: THREE.Vector3;
  faceYaw?: number;
  /** 交互半径（默认 3.5m，文档 02 §8.2） */
  radius?: number;
  /** 所在区域 id */
  region: string;
  /** 是否可被对话（王母不可近） */
  talkable?: boolean;
  /** 标注：道具/头衔等 UI 角标 */
  title?: string;
}

export class Npc {
  def: NpcDef;
  figure: FigureParts;
  group: THREE.Group;
  talking = false;

  constructor(def: NpcDef) {
    this.def = def;
    this.figure = buildFigure(def.figure);
    this.group = new THREE.Group();
    this.group.add(this.figure.group);
    this.group.position.copy(def.position);
    this.group.rotation.y = def.faceYaw ?? 0;
  }

  /** 面向某点（玩家靠近时转身） */
  faceToward(p: THREE.Vector3, dt: number): void {
    const target = Math.atan2(p.x - this.group.position.x, p.z - this.group.position.z);
    let d = target - this.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.group.rotation.y += d * Math.min(1, dt * 3);
  }

  update(dt: number, t: number): void {
    this.figure.talkWeight.value += ((this.talking ? 1 : 0) - this.figure.talkWeight.value) * Math.min(1, dt * 5);
    this.figure.update(dt, t);
  }
}
