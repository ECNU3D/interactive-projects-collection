/**
 * NpcManager.ts —— NPC 注册、就近交互检测、更新｜文档 02 §8.2
 */
import * as THREE from 'three/webgpu';
import { Npc, type NpcDef } from './Npc';

export class NpcManager {
  npcs: Npc[] = [];
  private byId = new Map<string, Npc>();

  add(def: NpcDef): Npc {
    const npc = new Npc(def);
    this.npcs.push(npc);
    this.byId.set(def.id, npc);
    return npc;
  }

  get(id: string): Npc | undefined {
    return this.byId.get(id);
  }

  /** 最近的可交互 NPC（简单球体距离判断，不进 BVH） */
  nearest(playerPos: THREE.Vector3, maxR = Infinity): { npc: Npc; dist: number } | null {
    let best: Npc | null = null;
    let bd = maxR;
    for (const n of this.npcs) {
      if (n.def.talkable === false || !n.group.parent) continue;
      const d = n.group.position.distanceTo(playerPos);
      const r = (n.def.radius ?? 3.5) + 1.2;
      if (d < r && d < bd) {
        bd = d;
        best = n;
      }
    }
    return best ? { npc: best, dist: bd } : null;
  }

  update(dt: number, t: number, playerPos: THREE.Vector3): void {
    for (const n of this.npcs) {
      if (!n.group.parent) continue;
      const d = n.group.position.distanceTo(playerPos);
      if (d < 120) {
        n.update(dt, t);
        if (d < 12 && !n.talking) n.faceToward(playerPos, dt * 0.6);
      }
    }
  }
}

/**
 * Crowd.ts —— 群众 NPC（instanced）：天丁枪林、力士、列队神仙｜文档 02 §2
 */
export class Crowd {
  mesh: THREE.InstancedMesh;
  count: number;
  private base: THREE.Matrix4[] = [];

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, transforms: THREE.Matrix4[]) {
    this.mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    this.count = transforms.length;
    transforms.forEach((m, i) => {
      this.mesh.setMatrixAt(i, m);
      this.base.push(m.clone());
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** 待机呼吸（整体轻微浮动，极慢） */
  update(t: number): void {
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.count; i += 3) {
      // 每 3 个动一个，省 CPU
      m.copy(this.base[i]);
      m.elements[13] += Math.sin(t * 0.5 + i) * 0.03;
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** 群众人形剪影（≤400 tri，文档 03 §7.1） */
export function crowdFigureGeometry(h = 2.2): THREE.BufferGeometry {
  const robe = new THREE.CylinderGeometry(h * 0.1, h * 0.22, h * 0.72, 8);
  robe.translate(0, h * 0.36, 0);
  const head = new THREE.SphereGeometry(h * 0.06, 8, 6);
  head.translate(0, h * 0.87, 0);
  const hat = new THREE.ConeGeometry(h * 0.045, h * 0.08, 6);
  hat.translate(0, h * 0.95, 0);
  return mergeGeometries([robe, head, hat])!;
}

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
