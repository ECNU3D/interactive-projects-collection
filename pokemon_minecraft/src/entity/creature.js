// 生物实体（野生精灵/道馆精灵共用）：模型、物理、状态特效锚点、受击闪白、濒死倾倒
import { meshFromVox } from '../voxel/mesher.js';
import { getModel } from '../voxel/models/index.js';
import { getSpecies } from '../data/species.js';
import { moveEntity } from './physics.js';
import { tickStatus, canAct } from '../battle/status.js';

let CID = 1;

export class Creature {
  constructor(game, inst, opts = {}) {
    this.id = CID++;
    this.game = game;
    this.inst = inst;                     // 精灵实例（含 level/status/moves）
    this.species = getSpecies(inst.speciesKey);
    this.wild = opts.wild !== false;
    this.gymMon = !!opts.gymMon;
    this.noCapture = !!opts.noCapture || this.gymMon;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.half = 0.35;
    this.height = 0.9;
    this.onGround = false;
    this.faceYaw = Math.random() * Math.PI * 2;

    this.model = meshFromVox(this.species.key, getModel(this.species.key)(), 1 / 8);
    game.scene.add(this.model);
    // AI 状态
    this.state = 'wander';
    this.homePos = null;
    this.target = null;                   // 敌对目标（玩家）
    this.stateT = 0;
    this.wanderDir = Math.random() * Math.PI * 2;
    this.cooldowns = {};                  // moveId → 就绪时间
    this.casting = null;                  // { move, t, target }
    this.flinchT = 0;
    this.dead = false;
    this.faintT = -1;
    this.flashT = 0;
    this.removeMe = false;
    this.moveTime = Math.random() * 10;
    this.statusFxT = 0;

    // 冰冻冰壳
    this.iceShell = null;
    // 混乱小鸟
    this.confuseBirds = null;
  }

  get fainted() { return this.inst.curHp <= 0; }

  // 放置到世界坐标（立即同步模型位置，休眠生物也需正确显示）
  placeAt(x, y, z) {
    this.pos.set(x, y, z);
    this.model.position.copy(this.pos);
    this.homePos = this.homePos || this.pos.clone();
    return this;
  }

  headPos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height + 0.4, this.pos.z); }

  distToPlayer() {
    const p = this.game.player.pos;
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  flash() { this.flashT = 0.18; }

  startFaint() {
    if (this.faintT >= 0) return;
    this.faintT = 0;
    this.state = 'faint';
    this.game.audio?.sfx('faint');
    this.game.audio?.cry(this.species.id, 'faint');
  }

  // 异常状态视觉效果（冰壳/混乱鸟）
  updateStatusFx(dt) {
    const frozen = this.inst.status === 'freeze';
    if (frozen && !this.iceShell) {
      const g = new THREE.BoxGeometry(1.1, 1.3, 1.1);
      const m = new THREE.MeshLambertMaterial({ color: 0x9FD8F0, transparent: true, opacity: 0.55 });
      this.iceShell = new THREE.Mesh(g, m);
      this.iceShell.position.y = 0.65;
      this.model.add(this.iceShell);
    } else if (!frozen && this.iceShell) {
      this.model.remove(this.iceShell);
      this.iceShell = null;
    }
    const confused = this.inst.volatile.includes('confusion');
    if (confused && !this.confuseBirds) {
      this.confuseBirds = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14),
          new THREE.MeshBasicMaterial({ color: 0xFCDC5F }));
        b.userData.a = i * Math.PI * 2 / 3;
        this.confuseBirds.add(b);
      }
      this.confuseBirds.position.y = this.height + 0.5;
      this.model.add(this.confuseBirds);
    } else if (!confused && this.confuseBirds) {
      this.model.remove(this.confuseBirds);
      this.confuseBirds = null;
    }
    if (this.confuseBirds) {
      const t = performance.now() * 0.004;
      for (const b of this.confuseBirds.children) {
        const a = b.userData.a + t;
        b.position.set(Math.cos(a) * 0.45, Math.sin(t * 1.3 + b.userData.a) * 0.08, Math.sin(a) * 0.45);
      }
    }
    // 持续异常粒子（毒泡/火苗/黄电/Z）
    this.statusFxT -= dt;
    if (this.statusFxT <= 0 && this.inst.status) {
      this.statusFxT = 0.7;
      const p = this.pos;
      const fx = this.game.particles;
      if (!fx) return;
      if (this.inst.status === 'poison' || this.inst.status === 'badpoison')
        fx.spawn(p.x, p.y + 1, p.z, { color: 0xA040A0, count: 3, spread: 0.6, up: 1, life: 0.7, gravity: -1 });
      else if (this.inst.status === 'burn')
        fx.spawn(p.x, p.y + 0.9, p.z, { color: 0xF08030, count: 3, spread: 0.7, up: 1.6, life: 0.5, gravity: -2 });
      else if (this.inst.status === 'paralysis')
        fx.spawn(p.x, p.y + 0.9, p.z, { color: 0xF8D030, count: 2, spread: 1.4, up: 0.6, life: 0.25, gravity: 0 });
      else if (this.inst.status === 'sleep')
        fx.spawn(p.x, p.y + 1.2, p.z, { color: 0x88A8F8, count: 1, spread: 0.2, up: 0.8, life: 1.1, gravity: -1.2 });
    }
  }

  updatePhysics(dt) {
    // 水生精灵浮在水面，不受重力，不离开水域
    if (this.floatWater) {
      const WL = this.game.world.constructor.WATER_LEVEL ?? 20;
      const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
      if (this.game.world.isWater(Math.floor(nx), Math.floor(nz))) { this.pos.x = nx; this.pos.z = nz; }
      else { this.vel.x = 0; this.vel.z = 0; }
      this.pos.y = WL + 0.55 + Math.sin(this.moveTime * 1.5) * 0.1;
      this.model.position.copy(this.pos);
      let dyy = this.faceYaw - this.model.rotation.y;
      while (dyy > Math.PI) dyy -= Math.PI * 2;
      while (dyy < -Math.PI) dyy += Math.PI * 2;
      this.model.rotation.y += dyy * Math.min(1, 10 * dt);
      this.moveTime += dt;
      return;
    }
    moveEntity(this.game.world, this, dt);
    this.model.position.copy(this.pos);
    let dy = this.faceYaw - this.model.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.model.rotation.y += dy * Math.min(1, 10 * dt);

    // 受击闪白
    const mesh = this.model.children[0];
    if (this.flashT > 0) {
      this.flashT -= dt;
      mesh.material.emissive?.setHex(0xffffff);
      mesh.material.color?.setHex(0xffffff);
    } else if (mesh.material.emissive && mesh.material.emissive.getHex() === 0xffffff) {
      mesh.material.emissive.setHex(0x000000);
      mesh.material.color?.setHex(0xffffff);
    }

    // 濒死倾倒
    if (this.faintT >= 0) {
      this.faintT += dt;
      this.model.rotation.x = -Math.min(1, this.faintT / 0.5) * Math.PI / 2;
      if (this.faintT > 1.4) this.removeMe = true;
      return;
    }

    // 待机浮动/走路摆动
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.5;
    this.moveTime += dt * (moving ? 1 : 0.2);
    if (moving) {
      this.model.position.y = this.pos.y + Math.abs(Math.sin(this.moveTime * 6)) * 0.08;
      this.model.rotation.z = Math.sin(this.moveTime * 6) * 0.05;
    } else {
      this.model.position.y = this.pos.y + Math.sin(this.moveTime * 2) * 0.04;
      this.model.rotation.z = 0;
    }
  }

  update(dt) {
    if (this.removeMe) return;
    if (this.fainted) this.startFaint();
    // 异常 tick（毒素/烧伤/解冻/苏醒）
    const events = tickStatus(this.inst, dt);
    for (const ev of events) {
      if (ev.type === 'dot' && ev.amount > 0) this.game.ui?.damageText(this.headPos(), '-' + ev.amount, '#A040A0');
      if (ev.type === 'thawed') this.game.ui?.floatText(this.headPos(), '解冻了!', '#98D8D8');
      if (ev.type === 'woke') this.game.ui?.floatText(this.headPos(), '醒来了!', '#A8A878');
      if (ev.type === 'confusionEnd') this.game.ui?.floatText(this.headPos(), '混乱解除', '#FCDC5F');
    }
    this.updateStatusFx(dt);
    this.updatePhysics(dt);
  }

  dispose() {
    this.game.scene.remove(this.model);
  }

  canActNow() { return this.flinchT <= 0 && !this.casting && canAct(this.inst); }
}
