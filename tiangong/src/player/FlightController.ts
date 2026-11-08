/**
 * FlightController.ts —— 筋斗云｜文档 02 §4.1
 *
 * 手感优先级：自由 > 精确，但不能"滑"——
 * 1. 有输入时阻尼 0.98（1s 后 ~30%），无输入时 0.94（约 1.5s 停下）
 * 2. 加速有阶段（boost 缓入 + FOV 拉伸）
 * 3. 贴近建筑自动减速（前瞻距离随速度动态计算）
 * 4. 可降落：接近地面时重力接管，落地即 walk 模式，Space 起飞
 */
import * as THREE from 'three/webgpu';
import { store } from '../core/Store';

export interface FlightParams {
  accel: number;
  maxSpeed: number;
  boostSpeed: number;
  damping: number;
  idleDamping: number;
  walkAccel: number;
  walkSpeed: number;
  /** 走行：有输入时的每帧阻尼（须 > 1 - walkAccel/(60·walkSpeed)，否则限速形同虚设） */
  walkDamping: number;
  /** 走行：松手后的每帧阻尼（约 0.2s 刹住） */
  walkStopDamping: number;
  gravity: number;
  pitchLimit: number;
  bankFactor: number;
}

/** 关键参数（需反复调）——文档 02 §4.1 */
export const FLIGHT: FlightParams = {
  accel: 34,
  maxSpeed: 45,
  boostSpeed: 180,
  damping: 0.98,
  idleDamping: 0.94,
  walkAccel: 30,
  walkSpeed: 10,
  walkDamping: 0.975, // 终端 ≈20 m/s > walkSpeed，限速由 walkSpeed 说了算
  walkStopDamping: 0.78,
  gravity: 22,
  pitchLimit: Math.PI * 0.45,
  bankFactor: 0.6,
};

export type FlightMode = 'walk' | 'glide' | 'boost';

export interface FlightState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  mode: FlightMode;
  /** boost 缓入进度 0–1 */
  boostK: number;
  /** 地面附着（walk 模式） */
  grounded: boolean;
}

export class FlightController {
  state: FlightState = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    mode: 'glide',
    boostK: 0,
    grounded: false,
  };

  /**
   * 上一个固定步长结束时的状态。逻辑是 60Hz 定步长、渲染是可变帧率，
   * 两者不对齐 —— 若渲染直接读 state，会出现"某帧不动、下一帧走两格"的抖动
   * （实测 60Hz 屏上 13.7% 的帧如此，120Hz 屏上近半数）。
   * 渲染层用 sample(alpha) 在 prev→state 之间插值，运动才是连续的。
   */
  prev = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, bank: 0 };
  /** sample() 的输出（复用，避免每帧分配） */
  private sampled = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, bank: 0 };
  private curBank = 0;

  keys = new Set<string>();
  /** 鼠标视角增量（由输入层写入） */
  lookDX = 0;
  lookDY = 0;
  /** 移动端虚拟摇杆（-1..1） */
  stick = { x: 0, y: 0 };
  stickLook = { x: 0, y: 0 };
  /** 每帧前方遮挡距离（Collision 写入，用于自动减速） */
  obstacleAhead = Infinity;
  /** 脚下地面高度（Collision.groundProbe 写入；-Infinity = 悬空） */
  groundY = -Infinity;
  /** 脚下是云面（软地板）而非实体建筑 —— 云面可以按 X 沉下去，屋顶不行 */
  groundIsSoft = false;

  update(dt: number): void {
    const s = this.state;
    const k = this.keys;

    // 本步开始前先存档，供渲染层插值
    this.prev.pos.copy(s.pos);
    this.prev.yaw = s.yaw;
    this.prev.pitch = s.pitch;
    this.prev.bank = this.curBank;

    // 视角
    s.yaw -= (this.lookDX + this.stickLook.x * 8) * 0.0022;
    s.pitch -= (this.lookDY + this.stickLook.y * 8) * 0.0022;
    s.pitch = THREE.MathUtils.clamp(s.pitch, -FLIGHT.pitchLimit, FLIGHT.pitchLimit);
    this.lookDX = 0;
    this.lookDY = 0;

    // 输入方向（相机系）
    let ix = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.stick.x;
    let iz = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0) + this.stick.y;
    const down = k.has('KeyX') || k.has('ControlLeft');
    const up = k.has('Space');
    let iy = (up ? 1 : 0) - (down ? 1 : 0);
    ix = THREE.MathUtils.clamp(ix, -1, 1);
    iz = THREE.MathUtils.clamp(iz, -1, 1);
    const hasDirInput = ix !== 0 || iz !== 0 || iy !== 0;
    const boosting = k.has('ShiftLeft') || k.has('ShiftRight');

    // boost 缓入：45 → 180 m/s 用 1.2s（文档 02 §4.1）
    const target = boosting && !s.grounded ? 1 : 0;
    s.boostK += (target - s.boostK) * Math.min(1, dt / 1.2) * (target > s.boostK ? 1 : 2.5);
    s.boostK = THREE.MathUtils.clamp(s.boostK, 0, 1);

    const forward = new THREE.Vector3(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch));
    const right = new THREE.Vector3(-Math.sin(s.yaw - Math.PI / 2), 0, -Math.cos(s.yaw - Math.PI / 2));

    if (s.grounded && this.groundY < s.pos.y - 0.5) {
      // 走出台基/云面边缘：脚下空了就转入下落（否则会一直在空中走 —— grounded 时
      // 位置只被抬高不被拉低，走下台阶就成了凌空漫步）
      s.grounded = false;
      s.mode = 'glide';
    }

    if (s.grounded) {
      // ── walk 模式：贴地走，Space 起飞 ──
      s.mode = 'walk';
      const acc = new THREE.Vector3().addScaledVector(forward, -iz).addScaledVector(right, ix);
      acc.y = 0;
      const walking = acc.lengthSq() > 0;
      if (walking) {
        acc.normalize().multiplyScalar(FLIGHT.walkAccel);
        s.vel.addScaledVector(acc, dt);
      }
      const hs = Math.hypot(s.vel.x, s.vel.z);
      if (hs > FLIGHT.walkSpeed) {
        const f = FLIGHT.walkSpeed / hs;
        s.vel.x *= f;
        s.vel.z *= f;
      }
      // 有输入时只做轻微阻尼（限速交给上面的 walkSpeed 钳制），松手才刹住。
      // 原先不分输入一律 ×0.8/步，终端速度被压到 2.5 m/s ——
      // walkSpeed=10 的钳制永远触发不到，走起来又黏又飘。
      const walkDamp = walking ? FLIGHT.walkDamping : FLIGHT.walkStopDamping;
      s.vel.x *= Math.pow(walkDamp, dt * 60);
      s.vel.z *= Math.pow(walkDamp, dt * 60);
      s.vel.y = 0;
      if (up) {
        // 起飞
        s.grounded = false;
        s.vel.y = 9;
        s.mode = 'glide';
      } else if (down && this.groundIsSoft) {
        // 站在云面上按 X：踏云而下，沉到下一层（站在殿顶上按 X 则不动）
        s.grounded = false;
        s.vel.y = -6;
        s.mode = 'glide';
      }
    } else {
      // ── 飞行模式 ──
      s.mode = s.boostK > 0.4 ? 'boost' : 'glide';
      const acc = new THREE.Vector3()
        .addScaledVector(forward, -iz)
        .addScaledVector(right, ix)
        .addScaledVector(new THREE.Vector3(0, 1, 0), iy * 0.8);
      if (acc.lengthSq() > 0) {
        acc.normalize().multiplyScalar(FLIGHT.accel * (1 + s.boostK * 2.2));
        s.vel.addScaledVector(acc, dt);
      } else {
        // 无输入重力：缓慢下沉（有"重量"，便于降落）
        s.vel.y -= FLIGHT.gravity * 0.25 * dt;
      }
      // 按住 X 主动降落
      if (down) s.vel.y -= FLIGHT.gravity * 0.5 * dt;

      // 限速：glide 45，boost 180
      const maxSpeed = THREE.MathUtils.lerp(FLIGHT.maxSpeed, FLIGHT.boostSpeed, s.boostK);
      const speed = s.vel.length();
      if (speed > maxSpeed) s.vel.multiplyScalar(maxSpeed / speed);

      // 帧率无关衰减：有输入 0.98，无输入 0.94
      const damp = hasDirInput ? FLIGHT.damping : FLIGHT.idleDamping;
      s.vel.multiplyScalar(Math.pow(damp, dt * 60));

      // 贴近建筑自动减速：前瞻距离随速度动态计算（文档 02 §4.1）
      const safeSpeed = 12;
      const v = s.vel.length();
      if (v > safeSpeed && this.obstacleAhead < Infinity) {
        const stopDist = (v * v - safeSpeed * safeSpeed) / (2 * FLIGHT.accel);
        const lookAhead = stopDist * 1.5 + 30;
        if (this.obstacleAhead < lookAhead) {
          const f = THREE.MathUtils.clamp(this.obstacleAhead / lookAhead, 0.15, 1);
          if (s.vel.length() > maxSpeed * f) s.vel.setLength(maxSpeed * f);
        }
      }
    }

    s.pos.addScaledVector(s.vel, dt);

    // 落地判定：脚下有地面且正在下落 → 吸附
    if (!s.grounded && this.groundY > -Infinity && s.vel.y <= 0.5) {
      if (s.pos.y <= this.groundY + 0.05) {
        s.pos.y = this.groundY;
        s.vel.y = 0;
        s.grounded = true;
        s.mode = 'walk';
      }
    }

    this.curBank = this.computeBank();
  }

  /**
   * 渲染层取值：在上一步与当前步之间按 alpha 插值。
   * alpha 由 Loop 给出 = accumulator / FIXED_DT ∈ [0,1)。
   */
  sample(alpha: number): { pos: THREE.Vector3; yaw: number; pitch: number; bank: number } {
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    const o = this.sampled;
    o.pos.lerpVectors(this.prev.pos, this.state.pos, a);
    // yaw/pitch 是连续实数（不做 ±π 回绕），直接线性插值即可
    o.yaw = this.prev.yaw + (this.state.yaw - this.prev.yaw) * a;
    o.pitch = this.prev.pitch + (this.state.pitch - this.prev.pitch) * a;
    o.bank = this.prev.bank + (this.curBank - this.prev.bank) * a;
    return o;
  }

  /** 传送/出生后调用：让 prev 与 state 对齐，避免插值把角色从旧位置拉过来 */
  resetInterpolation(): void {
    this.prev.pos.copy(this.state.pos);
    this.prev.yaw = this.state.yaw;
    this.prev.pitch = this.state.pitch;
    this.prev.bank = this.curBank;
  }

  /** 当前 FOV 偏移（boost 拉伸，可关） */
  fovOffset(): number {
    if (!store.get('settings').fovStretch) return 0;
    return this.state.boostK * 30; // 65° → 95°
  }

  /** 侧倾角（视觉）——逻辑步内算一次，渲染层取插值后的 sample().bank */
  private computeBank(): number {
    if (!store.get('settings').bank) return 0;
    const s = this.state;
    const lateral = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.stick.x;
    return -lateral * FLIGHT.bankFactor * 0.35 * Math.min(1, s.vel.length() / FLIGHT.maxSpeed);
  }
}
