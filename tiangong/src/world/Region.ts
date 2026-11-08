/**
 * Region.ts —— 区域模块契约｜文档 02 §2
 */
import * as THREE from 'three/webgpu';
import type { NpcDef } from '../npc/Npc';
import type { Collision } from '../player/Collision';
import type { NpcManager } from '../npc/NpcManager';
import type { AnnotationEntry } from '../ui/Annotation';

/** 可交互点（敲钟、摘桃、看席位牌……） */
export interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  prompt: string;
  action: (ctx: GameCtx) => void;
  /** 一次性/冷却 */
  cooldown?: number;
}

export interface GameCtx {
  scene: THREE.Scene;
  npcs: NpcManager;
  collision: Collision;
  interactables: Interactable[];
  /** 敲钟等事件 → 朝会演出 */
  events: {
    emit(name: 'chaohui' | 'dianmao' | 'pick-peach' | 'bell', data?: unknown): void;
    on(name: string, fn: (data?: unknown) => void): void;
  };
  audio: {
    playBell(pos: THREE.Vector3): void;
    playDrum(pos: THREE.Vector3): void;
  };
  /** 动态挂载（事件演出临时对象） */
  addEphemeral(obj: THREE.Object3D, ttlMs: number): void;
}

export interface RegionBuildResult {
  group: THREE.Group;
  npcs?: NpcDef[];
  interactables?: Interactable[];
  /** 考据栏内容（进入该区域时显示） */
  annotations?: AnnotationEntry[];
  /** 区域专属 update（只在玩家身处该区域时调用） */
  update?(dt: number, t: number, ctx: GameCtx): void;
  /**
   * 与"玩家是否在本区域内"无关的每帧更新——LOD 分桶属于这一类：
   * 站在齐天府也看得见蟠桃园，此时仍需按距离分桶。实现方内部自行节流。
   */
  lodUpdate?(playerPos: THREE.Vector3): void;
  /** 进入时触发（音乐电平、混响等） */
  onEnter?(ctx: GameCtx): void;
}

export type RegionBuilder = (ctx: GameCtx) => RegionBuildResult;

/** 区域常驻配置（与 content/places.json 对应） */
export interface PlaceDef {
  id: string;
  name: string;
  layer: 1 | 2 | 3 | 4 | 5;
  /** 区域中心世界坐标 */
  center: [number, number, number];
  /** 区域半径（进入判定） */
  radius: number;
  /** 音乐三层电平 */
  music: { base: number; melody: number; grand: number };
  /** 混响空间 */
  reverb: 'outdoor' | 'palace' | 'hall' | 'lingxiao' | 'danfang' | 'moon' | 'garden';
}
