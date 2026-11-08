// 玩家：操控当前出战宝可梦（第三人称跟随镜头，设计文档 §6）
import { moveEntity, snapToGround } from './physics.js';
import { speedMultiplier } from '../battle/status.js';
import { meshFromVox } from '../voxel/mesher.js';
import { getModel } from '../voxel/models/index.js';
import { getSpecies } from '../data/species.js';

const WALK_SPEED = 5.2;
const SPRINT_MULT = 1.6;
const JUMP_VEL = 8.5;
const CAM_DIST = 6;
const CAM_HEIGHT = 2.2;

export class Player {
  constructor(world, scene, camera, game) {
    this.world = world;
    this.scene = scene;
    this.camera = camera;
    this.game = game;
    this.pos = new THREE.Vector3(256.5, 30, 270.5);   // 出生点：草原村旁
    this.vel = new THREE.Vector3();
    this.half = 0.35;
    this.height = 1.0;
    this.onGround = false;
    this.yaw = Math.PI;        // 镜头偏航
    this.pitch = -0.26;        // 俯角 15°
    this.faceYaw = Math.PI;    // 模型朝向
    this.keys = {};
    this.modelGroup = null;
    this.moveTime = 0;
    this.frozen = false;       // 剧情/菜单时冻结
    this.lavaHurtT = 0;
  }

  spawnAt(x, y, z) {
    this.pos.set(x + 0.5, y + 0.1, z + 0.5);
    this.vel.set(0, 0, 0);
    snapToGround(this.world, this, 40);
  }

  // 换上当前出战宝可梦模型
  refreshModel() {
    const inst = this.game.party.active;
    if (this.modelGroup) { this.scene.remove(this.modelGroup); this.modelGroup = null; }
    if (!inst) return;
    const sp = getSpecies(inst.speciesKey);
    this.modelGroup = meshFromVox(sp.key, getModel(sp.key)(), 1 / 8);
    this.scene.add(this.modelGroup);
  }

  bindInput(dom) {
    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    dom.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== dom) return;
      this.yaw -= e.movementX * 0.0028;
      this.pitch -= e.movementY * 0.0028;
      this.pitch = Math.max(-1.1, Math.min(0.9, this.pitch));
    });
  }

  get active() { return this.game.party.active; }

  update(dt) {
    const inst = this.active;
    const k = this.keys;
    let mx = 0, mz = 0;
    if (!this.frozen && this.game.mode === 'play') {
      if (k['KeyW']) mz += 1;
      if (k['KeyS']) mz -= 1;
      if (k['KeyA']) mx -= 1;
      if (k['KeyD']) mx += 1;
    }
    const moving = (mx !== 0 || mz !== 0);
    let speed = WALK_SPEED;
    if (k['ShiftLeft'] || k['ShiftRight']) speed *= SPRINT_MULT;
    if (inst) speed *= speedMultiplier(inst);                       // 麻痹 ×0.5
    if (inst && (inst.status === 'freeze' || inst.status === 'sleep')) { mx = 0; mz = 0; }
    // 混乱：移动方向随机偏移
    if (inst && inst.volatile.includes('confusion') && moving) {
      const a = Math.sin(this.moveTime * 3.1) * 1.2;
      const c = Math.cos(a), s = Math.sin(a);
      [mx, mz] = [mx * c - mz * s, mx * s + mz * c];
    }

    // 相对镜头方向移动
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dx = (mz * -sin + mx * cos);
    const dz = (mz * -cos - mx * sin);
    const len = Math.hypot(dx, dz) || 1;
    // 冰面打滑
    const onIce = this.world.isIce(Math.floor(this.pos.x), Math.floor(this.pos.z));
    const accel = onIce ? 3 : 18;
    this.vel.x += ((dx / len) * speed * (moving ? 1 : 0) - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += ((dz / len) * speed * (moving ? 1 : 0) - this.vel.z) * Math.min(1, accel * dt);

    if (!this.frozen && k['Space'] && this.onGround && this.game.mode === 'play') {
      this.vel.y = JUMP_VEL;
      this.onGround = false;
      this.game.audio?.sfx('jump');
    }

    moveEntity(this.world, this, dt);

    // 水中减速（浅水跋涉）
    const inWater = this.world.isWater(Math.floor(this.pos.x), Math.floor(this.pos.z));
    if (inWater) { this.vel.x *= 0.85; this.vel.z *= 0.85; }

    // 岩浆伤害（1 秒 1 次）
    if (this.world.isLava(Math.floor(this.pos.x), Math.floor(this.pos.z)) && this.pos.y % 1 < 0.5) {
      this.lavaHurtT -= dt;
      if (this.lavaHurtT <= 0) {
        this.lavaHurtT = 1;
        this.game.onPlayerHazard?.(Math.max(1, Math.floor((inst?.maxHp || 10) / 16)), '岩浆');
      }
    }

    // 掉出世界兜底
    if (this.pos.y < -10) this.spawnAt(256, 30, 270);

    // 模型朝向与动画
    if (this.modelGroup) {
      if (moving) this.faceYaw = Math.atan2(this.vel.x, this.vel.z);
      let dy = this.faceYaw - this.modelGroup.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.modelGroup.rotation.y += dy * Math.min(1, 12 * dt);
      this.modelGroup.position.copy(this.pos);
      this.moveTime += dt * (moving ? Math.hypot(this.vel.x, this.vel.z) / WALK_SPEED : 0);
      // 待机浮动 / 走路摆动
      const g = this.modelGroup;
      if (moving && this.onGround) {
        g.position.y = this.pos.y + Math.abs(Math.sin(this.moveTime * 6)) * 0.08;
        g.rotation.z = Math.sin(this.moveTime * 6) * 0.06;
      } else {
        g.position.y = this.pos.y + Math.sin(performance.now() * 0.0018) * 0.05;
        g.rotation.z = 0;
      }
    }

    // 第三人称镜头（肩后 6 方块）
    const cd = CAM_DIST, ch = CAM_HEIGHT;
    const cx = this.pos.x + Math.sin(this.yaw) * Math.cos(this.pitch) * cd;
    const cy = this.pos.y + ch - Math.sin(this.pitch) * cd;
    const cz = this.pos.z + Math.cos(this.yaw) * Math.cos(this.pitch) * cd;
    // 镜头防穿墙：沿视线步进
    let t = 1;
    for (let i = 1; i <= 10; i++) {
      const f = i / 10;
      const tx = this.pos.x + (cx - this.pos.x) * f;
      const ty = this.pos.y + ch + (cy - this.pos.y - ch) * f;
      const tz = this.pos.z + (cz - this.pos.z) * f;
      if (this.world.solidAt(Math.floor(tx), Math.floor(ty), Math.floor(tz))) { t = Math.max(0.15, f - 0.12); break; }
    }
    this.camera.position.set(
      this.pos.x + (cx - this.pos.x) * t,
      this.pos.y + ch + (cy - this.pos.y - ch) * t,
      this.pos.z + (cz - this.pos.z) * t,
    );
    this.camera.lookAt(this.pos.x, this.pos.y + 1.0, this.pos.z);
  }
}
