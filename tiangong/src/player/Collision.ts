/**
 * Collision.ts —— 碰撞（不用物理引擎）｜文档 02 §4.2
 *
 * 每座建筑生成时同时产出简化碰撞体（AABB 并集），玩家胶囊体做 sweep。
 * 每层一个"地面高度"软约束，不掉下云海。
 */
import * as THREE from 'three/webgpu';

export interface WorldCollider {
  box: THREE.Box3; // 世界坐标
}

export class Collision {
  private boxes: THREE.Box3[] = [];
  private rays = {
    forward: new THREE.Ray(),
  };
  private scratch = new THREE.Vector3();
  private penetration = new Float64Array(6);
  private rcCenter = new THREE.Vector3();
  private rcSize = new THREE.Vector3();
  private rcHit = new THREE.Vector3();
  /** 地面高度场函数（按层，云海软地板） */
  groundY: (x: number, y: number, z: number) => number = () => -Infinity;

  /**
   * 脚下地面探测（降落用）：脚下 x/z 覆盖的最高盒顶，与云海软地板取大者。
   *
   * @param radius 玩家碰撞半径。必须与 resolve() 用的一致 —— resolve 把玩家推到
   *   「盒顶 + radius」，落地判定若按裸盒顶算，两者永远差一个半径，
   *   结果是站在任何台基上都悬空 radius 米、grounded 永远为 false。
   * @param includeSoftFloor 是否计入云海软地板。按住 X 主动下降时传 false，
   *   否则本层的云面（cloudY+14）高于层间分界线，五层就成了只能上不能下。
   */
  groundProbe(pos: THREE.Vector3, radius = 0, includeSoftFloor = true): number {
    let best = includeSoftFloor ? this.groundY(pos.x, pos.y, pos.z) : -Infinity;
    for (const b of this.boxes) {
      if (pos.x < b.min.x || pos.x > b.max.x || pos.z < b.min.z || pos.z > b.max.z) continue;
      const top = b.max.y + radius;
      if (top <= pos.y + 1.0 && top > best) best = top;
    }
    return best;
  }

  clear(): void {
    this.boxes = [];
  }

  addBox(box: THREE.Box3): void {
    this.boxes.push(box);
  }

  addBoxes(boxes: THREE.Box3[]): void {
    this.boxes.push(...boxes);
  }

  get boxCount(): number {
    return this.boxes.length;
  }

  /** 把最近添加（index ≥ from）的碰撞体整体抬升 dy（区域按层基高抬升用） */
  translateRecent(from: number, dy: number): void {
    for (let i = from; i < this.boxes.length; i++) {
      this.boxes[i].min.y += dy;
      this.boxes[i].max.y += dy;
    }
  }

  /**
   * 胶囊（简化为半径 r 的球）解算穿透，就地修正 pos。
   *
   * 传入 vel 时，同时把"撞向墙面的那个速度分量"清零。不清零的话，
   * 位置每帧被推回来、速度却一直朝墙里累积 —— 贴墙会抖，离开墙面时会弹射出去。
   */
  resolve(pos: THREE.Vector3, r: number, vel?: THREE.Vector3): THREE.Vector3 {
    const p = this.scratch.copy(pos);
    const d = this.penetration;
    for (const b of this.boxes) {
      // 扩展 AABB（Minkowski）→ 点在盒内则沿最小穿透轴推出
      const minX = b.min.x - r, minY = b.min.y - r, minZ = b.min.z - r;
      const maxX = b.max.x + r, maxY = b.max.y + r, maxZ = b.max.z + r;
      if (p.x <= minX || p.x >= maxX || p.y <= minY || p.y >= maxY || p.z <= minZ || p.z >= maxZ) continue;
      d[0] = p.x - minX; d[1] = maxX - p.x;
      d[2] = p.y - minY; d[3] = maxY - p.y;
      d[4] = p.z - minZ; d[5] = maxZ - p.z;
      let mi = 0;
      for (let i = 1; i < 6; i++) if (d[i] < d[mi]) mi = i;
      switch (mi) {
        case 0: p.x = minX; if (vel && vel.x > 0) vel.x = 0; break;
        case 1: p.x = maxX; if (vel && vel.x < 0) vel.x = 0; break;
        case 2: p.y = minY; if (vel && vel.y > 0) vel.y = 0; break;
        case 3: p.y = maxY; if (vel && vel.y < 0) vel.y = 0; break;
        case 4: p.z = minZ; if (vel && vel.z > 0) vel.z = 0; break;
        case 5: p.z = maxZ; if (vel && vel.z < 0) vel.z = 0; break;
      }
    }
    return p;
  }

  /** 前向射线：返回前方遮挡距离（自动减速用，文档 02 §4.1） */
  raycastForward(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number {
    if (dir.lengthSq() < 1e-6) return Infinity;
    const ray = this.rays.forward;
    ray.origin.copy(origin);
    ray.direction.copy(dir).normalize();
    let best = Infinity;
    const hit = this.rcHit;
    for (const b of this.boxes) {
      // 粗筛：盒心距
      const c = b.getCenter(this.rcCenter);
      const size = b.getSize(this.rcSize).length();
      if (c.distanceTo(origin) - size > Math.min(best, maxDist)) continue;
      if (ray.intersectBox(b, hit)) {
        const d = hit.distanceTo(origin);
        if (d < best) best = d;
      }
    }
    return best;
  }

  /**
   * 地面软约束：低于地面高度则施加向上修正（不穿云而下坠）
   */
  groundConstraint(pos: THREE.Vector3, vel: THREE.Vector3, dt: number): boolean {
    const gy = this.groundY(pos.x, pos.y, pos.z);
    if (gy === -Infinity) return false;
    if (pos.y < gy) {
      pos.y = THREE.MathUtils.lerp(pos.y, gy, Math.min(1, dt * 10));
      if (vel.y < 0) vel.y *= Math.pow(0.001, dt); // 快速消竖直速度 → 软着陆
      return true;
    }
    return false;
  }
}
