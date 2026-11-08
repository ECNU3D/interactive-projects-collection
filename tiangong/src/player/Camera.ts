/**
 * Camera.ts —— 第三人称（临界阻尼跟随）+ 第一人称 + 对话过肩镜头｜文档 02 §4.3
 *
 * 跟随用 SmoothDamp（临界阻尼的解析解），不用显式弹簧积分：
 * 显式弹簧在掉帧那一帧（dt 可达 0.25s）会过冲甚至发散，表现为"镜头被甩出去"。
 * SmoothDamp 对任意 dt 都稳定，且永不过冲。
 *
 * 本文件在每帧路径上不分配对象（全部用复用的 scratch 向量）。
 */
import * as THREE from 'three/webgpu';
import { store } from '../core/Store';

export type CameraMode = 'third' | 'first' | 'dialogue';

const BASE_FOV = 65;
/** 第三人称跟随距离 */
const FOLLOW_DIST = 7;

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'third';
  /** 第三人称跟随状态 */
  private springPos = new THREE.Vector3();
  private springVel = new THREE.Vector3();
  private dialogueTarget: { pos: THREE.Vector3; lookAt: THREE.Vector3 } | null = null;
  // 每帧复用的临时量
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, aspect, 0.3, 9000);
  }

  toggleFirstPerson(): void {
    this.mode = this.mode === 'first' ? 'third' : 'first';
  }

  /** 对话：过肩镜头，NPC 占画面右 1/3 */
  enterDialogue(playerPos: THREE.Vector3, npcPos: THREE.Vector3, playerYaw: number): void {
    this.mode = 'dialogue';
    const toNpc = npcPos.clone().sub(playerPos).normalize();
    const side = new THREE.Vector3(-toNpc.z, 0, toNpc.x);
    // 机位：玩家肩后 1.2m，高 1.7m，看向 NPC 胸口
    const pos = playerPos
      .clone()
      .addScaledVector(toNpc, -1.2)
      .addScaledVector(side, 0.55)
      .add(new THREE.Vector3(0, 1.7, 0));
    const lookAt = npcPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.dialogueTarget = { pos, lookAt };
    void playerYaw;
  }

  exitDialogue(): void {
    this.mode = 'third';
    this.dialogueTarget = null;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    yaw: number,
    pitch: number,
    fovOffset: number,
    bank: number,
  ): void {
    const cam = this.camera;
    const shake = store.get('settings').cameraShake;

    if (this.mode === 'dialogue' && this.dialogueTarget) {
      cam.position.lerp(this.dialogueTarget.pos, 1 - Math.exp(-3.5 * dt));
      const cur = this.tmpA;
      cam.getWorldDirection(cur);
      const want = this.tmpB.copy(this.dialogueTarget.lookAt).sub(cam.position).normalize();
      cur.lerp(want, 1 - Math.exp(-3.5 * dt));
      cam.lookAt(this.tmpC.copy(cam.position).add(cur));
      cam.fov = THREE.MathUtils.lerp(cam.fov, 50, 1 - Math.exp(-3 * dt));
      cam.updateProjectionMatrix();
      return;
    }

    const lookDir = this.tmpA.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );

    if (this.mode === 'first') {
      cam.position.copy(playerPos);
      cam.position.y += 1.6;
      cam.lookAt(this.tmpB.copy(cam.position).add(lookDir));
    } else {
      // 第三人称：临界阻尼跟随（永不过冲，任意 dt 稳定）
      const target = this.tmpB.copy(playerPos).addScaledVector(lookDir, -FOLLOW_DIST);
      target.y += 2.4;
      // 晃动设置：0 = 更懒更稳，1 = 更贴身
      const smoothTime = 0.55 - shake * 0.27;
      smoothDamp(this.springPos, target, this.springVel, smoothTime, dt);
      cam.position.copy(this.springPos);
      const lookAt = this.tmpC.copy(playerPos).addScaledVector(lookDir, 8);
      lookAt.y += 1.4;
      cam.lookAt(lookAt);
    }

    // FOV 拉伸（boost，可关）+ 侧倾
    const targetFov = BASE_FOV + fovOffset;
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();
    cam.rotation.z += bank;
  }

  snapBehind(playerPos: THREE.Vector3, yaw: number): void {
    const back = this.tmpA.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.springPos.copy(playerPos).addScaledVector(back, FOLLOW_DIST);
    this.springPos.y += 2.4;
    this.springVel.set(0, 0, 0);
  }
}

/**
 * 临界阻尼平滑（Game Programming Gems 4 / Unity SmoothDamp 的解析形式）。
 * 对任意 dt 无条件稳定：dt→∞ 时 exp→0，位置直接落到 target，不会发散。
 * 就地修改 current 与 vel。
 */
function smoothDamp(
  current: THREE.Vector3,
  target: THREE.Vector3,
  vel: THREE.Vector3,
  smoothTime: number,
  dt: number,
): void {
  const omega = 2 / Math.max(smoothTime, 1e-4);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const axis of ['x', 'y', 'z'] as const) {
    const change = current[axis] - target[axis];
    const temp = (vel[axis] + omega * change) * dt;
    vel[axis] = (vel[axis] - omega * temp) * exp;
    current[axis] = target[axis] + (change + temp) * exp;
  }
}
