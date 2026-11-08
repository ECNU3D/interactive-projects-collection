/**
 * Streaming.ts —— 区域分阶段 + 按距离流式加载｜文档 02 §6.2 / §6.4
 *
 * 阶段 1（启动）：只建出生区域（齐天府 + 蟠桃园）→ 可交互。
 * 之后按玩家距离懒加载：接近 700m 才生成，超过 900m 隐藏（含 NPC）。
 * 生成在帧间分片让出主线程，避免卡帧。
 */
import * as THREE from 'three/webgpu';
import type { GameCtx, RegionBuildResult } from './Region';
import { REGION_BUILDERS } from './regions';
import { PLACES, LAYERS, type PlaceInfo } from './Layers';
import type { Npc } from '../npc/Npc';
import type { AnnotationEntry } from '../ui/Annotation';

export interface BuiltRegion {
  id: string;
  group: THREE.Group;
  npcs: Npc[];
  annotations: AnnotationEntry[];
  update?: (dt: number, t: number, ctx: GameCtx) => void;
  lodUpdate?: (playerPos: THREE.Vector3) => void;
  onEnter?: (ctx: GameCtx) => void;
  visible: boolean;
}

/** 出生即建的区域（玩家在这里睁开眼） */
export const INITIAL_REGIONS = ['qitian-fu', 'pantaoyuan'];
const BUILD_DIST = 700; // 接近则生成
const SHOW_DIST = 850; // 显示阈值（边到边）
const HIDE_DIST = 1000; // 隐藏阈值（滞回，防抖动）

export class Streaming {
  built = new Map<string, BuiltRegion>();
  private queue: PlaceInfo[] = [];
  private building = false;
  /** 与区域进出无关、每帧都要跑的更新（LOD 分桶），各自内部节流 */
  private lodUpdaters: ((playerPos: THREE.Vector3) => void)[] = [];
  onRegionBuilt: (id: string) => void = () => void 0;

  constructor(private ctx: GameCtx) {}

  /** 启动：建初始区域（序列执行，让出主线程） */
  async buildInitial(onProgress?: (msg: string) => void): Promise<void> {
    for (const id of INITIAL_REGIONS) {
      const place = PLACES.find((p) => p.id === id);
      if (place) await this.buildOne(place, onProgress);
    }
  }

  /** 每帧（或每 0.5s）：按距离补建/显隐 */
  update(playerPos: THREE.Vector3): void {
    for (const place of PLACES) {
      const edgeDist = place.center.distanceTo(playerPos) - place.radius;
      const region = this.built.get(place.id);
      if (!region) {
        if (edgeDist < BUILD_DIST) this.enqueue(place);
      } else {
        const want = edgeDist < (region.visible ? HIDE_DIST : SHOW_DIST);
        if (want !== region.visible) {
          region.visible = want;
          region.group.visible = want;
          for (const n of region.npcs) n.group.visible = want;
        }
      }
    }
    void this.pump();
  }

  private enqueue(place: PlaceInfo): void {
    if (this.queue.some((p) => p.id === place.id)) return;
    this.queue.push(place);
  }

  private async pump(): Promise<void> {
    if (this.building || !this.queue.length) return;
    this.building = true;
    const place = this.queue.shift()!;
    try {
      await this.buildOne(place);
    } finally {
      this.building = false;
    }
  }

  /** 后台预热：进入后按距离顺序逐个生成（间隔让帧），避免飞到跟前才卡 */
  async warmUp(fromPos: THREE.Vector3): Promise<void> {
    const rest = PLACES.filter((p) => !this.built.has(p.id)).sort(
      (a, b) => a.center.distanceToSquared(fromPos) - b.center.distanceToSquared(fromPos),
    );
    for (const place of rest) {
      await this.buildOne(place);
      await new Promise((r) => setTimeout(r, 350));
    }
    console.info('[tiangong] 全图生成完毕');
  }

  private async buildOne(place: PlaceInfo, onProgress?: (msg: string) => void): Promise<void> {
    if (this.built.has(place.id)) return;
    const builder = REGION_BUILDERS[place.id];
    if (!builder) return;
    onProgress?.(place.id);
    const baseY = LAYERS[place.layer].baseY;
    const boxesBefore = this.ctx.collision.boxCount;
    const result = builder(this.ctx);

    // 区域模块以「地面 y=0」局部坐标生成；按层基高抬升
    result.group.position.y = baseY;
    result.group.visible = false; // 建好后由 update 决定显示
    this.ctx.scene.add(result.group);
    this.ctx.collision.translateRecent(boxesBefore, baseY);

    const npcs: Npc[] = [];
    for (const npc of result.npcs ?? []) {
      npc.position.y += baseY;
      const inst = this.ctx.npcs.add({ ...npc, region: npc.region || place.id });
      inst.group.visible = false;
      this.ctx.scene.add(inst.group);
      npcs.push(inst);
    }
    for (const it of result.interactables ?? []) {
      it.position.y += baseY;
      this.ctx.interactables.push(it);
    }
    // 区域地板（实心岛，可站立）+ 云岛底盘 + 玉台面
    this.addIsland(place, baseY, result);

    this.built.set(place.id, {
      id: place.id,
      group: result.group,
      npcs,
      annotations: result.annotations ?? [],
      update: result.update?.bind(result),
      lodUpdate: result.lodUpdate?.bind(result),
      onEnter: result.onEnter?.bind(result),
      visible: false,
    });
    if (result.lodUpdate) this.lodUpdaters.push(result.lodUpdate.bind(result));
    this.onRegionBuilt(place.id);
    // 分帧让出主线程
    await new Promise((r) => setTimeout(r, 16));
  }

  /**
   * 云岛底盘 + 玉台面地面（从下方/远处看区域浮在云海上）。
   *
   * ⚠️ 这块玉台面的**顶面固定在区域局部 y = 0.05**（中心 -0.55 + 高 1.2 的一半），
   * 半径 = place.radius × 0.9 × 0.62。区域模块若自带地面，务必抬到 0.05 以上，
   * 否则同心共面会 z-fighting、整块地面持续闪烁（蟠桃园踩过一次）。
   */
  private addIsland(place: PlaceInfo, baseY: number, result: RegionBuildResult): void {
    const r = place.radius * 0.9;
    this.ctx.collision.addBox(
      new THREE.Box3(
        new THREE.Vector3(place.center.x - r, baseY - 1.4, place.center.z - r),
        new THREE.Vector3(place.center.x + r, baseY, place.center.z + r),
      ),
    );
    const plinthGeo = new THREE.SphereGeometry(r * 0.72, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    plinthGeo.scale(1, 0.4, 1);
    const plinth = new THREE.Mesh(plinthGeo, new THREE.MeshBasicNodeMaterial({ color: 0xf2eee6, fog: true }));
    plinth.position.set(place.center.x, 0.4, place.center.z);
    result.group.add(plinth);
    const floorGeo = new THREE.CylinderGeometry(r * 0.62, r * 0.68, 1.2, 32);
    const floor = new THREE.Mesh(
      floorGeo,
      new THREE.MeshStandardNodeMaterial({ color: 0xe6dfd2, roughness: 0.85, metalness: 0.02 }),
    );
    floor.position.set(place.center.x, -0.55, place.center.z);
    result.group.add(floor);
  }

  updateRegion(id: string, dt: number, t: number): void {
    const r = this.built.get(id);
    if (r?.visible) r.update?.(dt, t, this.ctx);
  }

  /** 正在生成区域（生成是同步的，这段时间的帧时间不代表稳态性能） */
  get isBuilding(): boolean {
    return this.building || this.queue.length > 0;
  }

  /** 每帧：所有已建区域的 LOD 分桶（实现方自行节流） */
  updateLod(playerPos: THREE.Vector3): void {
    for (const fn of this.lodUpdaters) fn(playerPos);
  }

  annotationsOf(id: string): AnnotationEntry[] {
    return this.built.get(id)?.annotations ?? [];
  }

  enter(id: string): void {
    this.built.get(id)?.onEnter?.(this.ctx);
  }
}
