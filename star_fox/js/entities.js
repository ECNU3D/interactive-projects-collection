// entities.js — 子弹 / 敌机 / 拾取物 / 小行星 / 粒子 / Boss
import * as THREE from 'three';
import { buildDrone, buildFighter, buildTurret, buildMine, buildAsteroid,
         buildBossCruiser, buildBossBehemoth, buildBossFlagship, buildLaserBolt,
         buildMissile, buildTank, buildBossSaucer, buildBossSub, buildWolfen, buildBossAndross } from './models.js?v=20260728';
import { makeSparkSprite, makeGlowSprite, makePickupIcon } from './textures.js?v=20260728';

const _v = new THREE.Vector3();

// ============================================================ 子弹
export class Bullet {
  constructor(scene, pos, vel, { friendly = true, damage = 10, color = 0x40ff90, radius = 1.2 } = {}) {
    this.mesh = buildLaserBolt(color);
    this.mesh.position.copy(pos);
    this.vel = vel.clone();
    this.mesh.lookAt(_v.copy(pos).add(vel));
    this.friendly = friendly;
    this.damage = damage;
    this.radius = radius;
    this.life = 4;
    this.alive = true;
    scene.add(this.mesh);
  }
  update(dt) {
    this.mesh.position.addScaledVector(this.vel, dt);
    this.life -= dt;
    const p = this.mesh.position;
    if (this.life <= 0 || p.z > 30 || p.z < -1600 || Math.abs(p.x) > 300 || Math.abs(p.y) > 200) this.alive = false;
    return this.alive;
  }
  dispose(scene) { scene.remove(this.mesh); }
}

// ============================================================ 爆炸粒子
let sparkTex = null, flashTex = null;
export class Explosion {
  constructor(scene, pos, scale = 1, count = 26) {
    if (!sparkTex) { sparkTex = makeSparkSprite(); flashTex = makeGlowSprite('#fff7e0', 'rgba(255,120,20,0)'); }
    this.scene = scene;
    this.parts = [];
    this.life = 1;
    this.alive = true;
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        color: new THREE.Color().setHSL(0.06 + Math.random() * 0.06, 1, 0.55 + Math.random() * 0.3),
      }));
      s.position.copy(pos);
      const sc = (0.8 + Math.random() * 2.2) * scale;
      s.scale.set(sc, sc, 1);
      const v = new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5))
        .normalize().multiplyScalar((8 + Math.random() * 26) * scale);
      s.userData.vel = v;
      scene.add(s);
      this.parts.push(s);
    }
    // 闪光
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.flash.position.copy(pos);
    this.flash.scale.set(6 * scale, 6 * scale, 1);
    scene.add(this.flash);
  }
  update(dt, scroll = 0) {
    this.life -= dt * 1.4;
    if (this.life <= 0) { this.alive = false; return false; }
    for (const s of this.parts) {
      s.position.addScaledVector(s.userData.vel, dt);
      s.position.z += scroll * dt;
      s.userData.vel.multiplyScalar(1 - dt * 1.5);
      s.material.opacity = this.life;
    }
    this.flash.material.opacity = this.life * 0.9;
    const f = this.flash.scale.x + dt * 30;
    this.flash.scale.set(f, f, 1);
    this.flash.position.z += scroll * dt;
    return true;
  }
  dispose() {
    for (const s of this.parts) this.scene.remove(s);
    this.scene.remove(this.flash);
  }
}

// ============================================================ 敌人基类
export class Enemy {
  constructor(scene, game) {
    this.scene = scene;
    this.group = null;
    this.alive = true;
    this.hp = 10;
    this.radius = 2;
    this.scoreValue = 100;
    this.dropChance = 0.18;
    this.t = Math.random() * 100;
    this.flashT = 0;
  }
  spawnAt(x, y, z = -900) { this.group.position.set(x, y, z); this.scene.add(this.group); return this; }
  takeDamage(n, game) {
    this.hp -= n;
    this.flashT = 0.08;
    if (this.hp <= 0 && this.alive) {
      this.alive = false;
      game.onEnemyKilled(this);
    }
    return !this.alive;
  }
  hitFlash(dt) {
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.group.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setScalar(this.flashT > 0 ? 0.6 : 0); });
    }
  }
  fireAt(game, speed = 90, color = 0xff5030, spread = 0) {
    const from = this.group.position.clone();
    const dir = game.playerPos.clone().sub(from).normalize();
    if (spread) {
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.normalize();
    }
    game.addEnemyBullet(from, dir.multiplyScalar(speed), color);
  }
  update(dt, game) {
    this.t += dt;
    this.group.position.z += game.scrollSpeed * dt;
    this.hitFlash(dt);
    if (this.group.position.z > 25) this.alive = false; // 飞过玩家
    return this.alive;
  }
  dispose() { this.scene.remove(this.group); }
}

// ============================================================ 追踪导弹
export class Missile {
  // target: { getPos: ()=>Vector3, radius, apply: (dmg, game)=>void, alive: ()=>bool } | null
  constructor(scene, pos, vel, target) {
    this.scene = scene;
    this.mesh = buildMissile();
    this.mesh.position.copy(pos);
    this.vel = vel.clone();
    this.speed = 180;
    this.target = target;
    this.damage = 70;
    this.life = 7;
    this.alive = true;
    this.trailT = 0;
    scene.add(this.mesh);
  }
  update(dt, game) {
    this.life -= dt;
    this.speed = Math.min(360, this.speed + 260 * dt);
    // 追踪
    if (this.target && this.target.alive()) {
      const tp = this.target.getPos();
      const want = tp.clone().sub(this.mesh.position).normalize().multiplyScalar(this.speed);
      // 限转向速率
      const maxTurn = 4.2 * dt;
      const cur = this.vel.clone().normalize();
      const ang = cur.angleTo(want.clone().normalize());
      if (ang > 1e-4) {
        const k = Math.min(1, maxTurn / ang);
        cur.lerp(want.normalize(), k).normalize();
        this.vel.copy(cur.multiplyScalar(this.speed));
      } else {
        this.vel.copy(want);
      }
      // 命中
      if (this.mesh.position.distanceTo(tp) < this.target.radius + 2.5) {
        this.target.apply(this.damage, game);
        game.explode(this.mesh.position.clone(), 1.8);
        game.sfx('explosion');
        this.alive = false;
      }
    } else {
      this.vel.setLength(this.speed); // 目标丢失，直线飞行
    }
    this.mesh.position.addScaledVector(this.vel, dt);
    this.mesh.lookAt(_v.copy(this.mesh.position).add(this.vel));
    // 尾迹
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.04;
      game.spawnTrailPuff(this.mesh.position, this.vel);
    }
    const p = this.mesh.position;
    if (this.life <= 0 || p.z < -1600 || p.z > 60) {
      if (this.life <= 0) game.explode(p.clone(), 1.2);
      this.alive = false;
    }
    return this.alive;
  }
  dispose() { this.scene.remove(this.mesh); }
}

// ============================================================ 地面坦克
export class Tank extends Enemy {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildTank();
    this.hp = 45; this.radius = 3.4; this.scoreValue = 350;
    this.dropChance = 0.35;
    this.fireTimer = 2 + Math.random();
    this.burst = 0;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3);
  }
  update(dt, game) {
    this.t += dt;
    const p = this.group.position;
    p.z += game.scrollSpeed * dt;
    p.x += this.vx * dt;
    if (Math.abs(p.x) > 42) this.vx *= -1;
    this.group.rotation.y = Math.atan2(this.vx, 2) * 0.3;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && p.z > -350 && p.z < -40) {
      this.burst++;
      this.fireTimer = this.burst % 3 === 0 ? 2.4 : 0.22;
      this.fireAt(game, 105, 0xc0ff40, 0.05);
      game.sfx('enemyShoot');
    }
    this.hitFlash(dt);
    if (p.z > 25) this.alive = false;
    return this.alive;
  }
}

// ---------- 无人机：正弦漂飞 + 单发 ----------
export class Drone extends Enemy {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildDrone();
    this.group.scale.setScalar(1.6); // 放大模型，更易瞄准
    this.hp = 10; this.radius = 3.2; this.scoreValue = 100;
    this.baseX = 0; this.baseY = 0;
    this.sineAmp = 5 + Math.random() * 9;
    this.sineFreq = 0.5 + Math.random() * 0.6; // 放慢摆动
    this.fireTimer = 1.5 + Math.random() * 2;
    this.vz = 10 + Math.random() * 7; // 放慢接近速度
  }
  spawnAt(x, y, z) {
    super.spawnAt(x, y, z);
    this.baseX = x; this.baseY = y;
    return this;
  }
  update(dt, game) {
    this.t += dt;
    const p = this.group.position;
    p.z += (game.scrollSpeed + this.vz) * dt;
    p.x = this.baseX + Math.sin(this.t * this.sineFreq) * this.sineAmp;
    p.y = this.baseY + Math.cos(this.t * this.sineFreq * 0.7) * this.sineAmp * 0.6;
    this.group.rotation.z = Math.sin(this.t * this.sineFreq) * 0.4;
    this.group.lookAt(game.playerPos);
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && p.z > -420 && p.z < -60) {
      this.fireTimer = 2.2 + Math.random() * 1.5;
      this.fireAt(game, 95, 0xff5030, 0.04);
      game.sfx('enemyShoot');
    }
    this.hitFlash(dt);
    if (p.z > 25) this.alive = false;
    return this.alive;
  }
}

// ---------- 战斗机：侧向掠袭 + 三连发 ----------
export class Fighter extends Enemy {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildFighter();
    this.group.scale.setScalar(1.5);
    this.hp = 22; this.radius = 3.6; this.scoreValue = 250;
    this.dropChance = 0.3;
    this.fireTimer = 1.2;
    this.burst = 0;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 6);
    this.vz = 16;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(dt, game) {
    this.t += dt;
    const p = this.group.position;
    p.z += (game.scrollSpeed + this.vz) * dt;
    p.x += this.vx * dt;
    p.y += Math.sin(this.t * 2.2 + this.phase) * 6 * dt;
    if (Math.abs(p.x) > 40) this.vx *= -1;
    this.group.rotation.z = -this.vx * 0.02;
    this.group.lookAt(_v.copy(p).add(new THREE.Vector3(this.vx, 0, 20)));
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && p.z > -450 && p.z < -70) {
      this.fireAt(game, 110, 0xff8030, 0.03);
      game.sfx('enemyShoot');
      this.burst++;
      this.fireTimer = this.burst % 3 === 0 ? 1.8 : 0.18;
    }
    this.hitFlash(dt);
    if (p.z > 25) this.alive = false;
    return this.alive;
  }
}

// ---------- 炮塔：固定，持续瞄准 ----------
export class Turret extends Enemy {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildTurret();
    this.group.scale.setScalar(1.4);
    this.hp = 35; this.radius = 3.4; this.scoreValue = 300;
    this.dropChance = 0.35;
    this.fireTimer = 1 + Math.random();
  }
  update(dt, game) {
    this.t += dt;
    const p = this.group.position;
    p.z += game.scrollSpeed * dt;
    // 头部朝向玩家
    this.group.lookAt(game.playerPos.x, game.playerPos.y, p.z - 10);
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && p.z > -380 && p.z < -50) {
      this.fireTimer = 1.6 + Math.random() * 0.8;
      this.fireAt(game, 120, 0xffe040, 0.02);
      game.sfx('enemyShoot');
    }
    this.hitFlash(dt);
    if (p.z > 25) this.alive = false;
    return this.alive;
  }
}

// ---------- 水雷：靠近爆炸 ----------
export class Mine extends Enemy {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildMine();
    this.group.scale.setScalar(1.3);
    this.hp = 5; this.radius = 2.3; this.scoreValue = 80;
    this.dropChance = 0.08;
  }
  update(dt, game) {
    this.t += dt;
    const p = this.group.position;
    p.z += game.scrollSpeed * dt;
    this.group.rotation.x += dt * 0.8;
    this.group.rotation.y += dt * 0.6;
    const blink = this.group.userData.blink;
    if (blink) blink.material.color.setScalar(0).setHex(this.t % 0.8 < 0.4 ? 0xff2060 : 0x550a20);
    // 距离触发
    const d = p.distanceTo(game.playerPos);
    if (d < 9 && p.z > -30) {
      this.alive = false;
      game.onMineExplode(this);
    }
    this.hitFlash(dt);
    if (p.z > 25) this.alive = false;
    return this.alive;
  }
}

// ---------- 小行星（障碍物） ----------
export class Asteroid extends Enemy {
  constructor(scene, game, scale = 1) {
    super(scene, game);
    this.group = buildAsteroid(scale);
    this.hp = 60 * scale; this.radius = 3.2 * scale; this.scoreValue = 50;
    this.dropChance = 0.05;
    this.rotAxis = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
    this.rotSpeed = 0.3 + Math.random() * 0.8;
  }
  update(dt, game) {
    const p = this.group.position;
    p.z += game.scrollSpeed * dt;
    this.group.rotateOnAxis(this.rotAxis, this.rotSpeed * dt);
    if (p.z > 30) this.alive = false;
    return this.alive;
  }
}

// ============================================================ 拾取物
export class Pickup {
  constructor(scene, pos, type) {
    this.scene = scene;
    this.type = type; // 'weapon' | 'shield' | 'bomb' | 'missile'
    const conf = { weapon: ['W', '#40ff90'], shield: ['S', '#40c0ff'], bomb: ['B', '#ffb040'], missile: ['M', '#d060ff'] }[type];
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makePickupIcon(conf[0], conf[1]), transparent: true, depthWrite: false,
    }));
    this.sprite.scale.set(4, 4, 1);
    this.sprite.position.copy(pos);
    this.sprite.position.z = Math.min(pos.z, -30);
    this.sprite.position.y = Math.max(pos.y, -16); // 防止埋进地面
    scene.add(this.sprite);
    this.alive = true;
    this.t = 0;
  }
  update(dt, game) {
    this.t += dt;
    const p = this.sprite.position;
    p.z += game.scrollSpeed * 0.85 * dt;
    // 磁吸：玩家靠近后道具自动飞来
    const d = p.distanceTo(game.playerPos);
    if (d < 32) {
      const dir = game.playerPos.clone().sub(p).normalize();
      const spd = (32 - d) * 8 + 40;
      p.addScaledVector(dir, spd * dt);
    }
    this.sprite.material.rotation = Math.sin(this.t * 2) * 0.2;
    const s = 4 + Math.sin(this.t * 3) * 0.4;
    this.sprite.scale.set(s, s, 1);
    if (d < 6) {
      this.alive = false;
      game.onPickup(this.type);
    }
    if (p.z > 20) this.alive = false;
    return this.alive;
  }
  dispose() { this.scene.remove(this.sprite); }
}

// ============================================================ Boss 基类
export class Boss extends Enemy {
  constructor(scene, game) {
    super(scene, game);
    this.name = 'BOSS';
    this.maxHp = 1000;
    this.hp = this.maxHp;
    this.scoreValue = 5000;
    this.attackTimer = 3;
    this.pattern = 0;
    this.baseZ = -170;
    this.entering = true;
    this.weakPoints = []; // {mesh, hp, maxHp, radius, alive, exposed}
    this.coreExposed = false;
    this.strafeT = 0;
    this.bodyParts = []; // {a, b, r} 局部坐标胶囊体（a==b 时为球体）
  }
  totalHp() { return this.hp; }
  takeDamage(n, game) { /* Boss 用弱点判定，见 main.js */ }
  damageCore(n, game) {
    this.hp -= n;
    this.flashT = 0.08;
    if (this.hp <= 0 && this.alive) {
      this.alive = false;
      game.onBossDefeated(this);
    }
  }
  move(dt, game) {
    this.strafeT += dt;
    const p = this.group.position;
    if (this.entering) {
      p.z += (this.baseZ - p.z) * dt * 0.8;
      if (Math.abs(p.z - this.baseZ) < 4) this.entering = false;
    } else {
      p.x = Math.sin(this.strafeT * 0.28) * 16;
      p.y = Math.cos(this.strafeT * 0.22) * 9;
      p.z = this.baseZ + Math.sin(this.strafeT * 0.4) * 8;
    }
  }
  updateWeakPoints(dt, game) {
    for (const w of this.weakPoints) {
      if (!w.alive) continue;
      // 弱点脉动
      const s = 1 + Math.sin(this.t * 5) * 0.12;
      w.mesh.scale.setScalar(s);
    }
  }
  damageWeak(w, n, game) {
    if (!w.alive || w.shielded) return false;
    w.hp -= n;
    game.sfx('hit');
    if (w.hp <= 0) {
      w.alive = false;
      w.mesh.visible = false;
      game.explode(w.mesh.getWorldPosition(new THREE.Vector3()), 1.5);
      game.addScore(800);
      this.onWeakDestroyed(game);
    }
    return true;
  }
  onWeakDestroyed(game) {}
  hitTestWeak(pos, radius) {
    for (const w of this.weakPoints) {
      if (!w.alive) continue;
      const wp = w.mesh.getWorldPosition(_v);
      if (wp.distanceTo(pos) < w.radius + radius) return w;
    }
    return null;
  }
  coreHit(pos, radius) {
    if (!this.coreExposed || !this.alive) return false;
    const cp = this.core.getWorldPosition(_v);
    return cp.distanceTo(pos) < (this.coreRadius || 3) + radius;
  }
  bodyHit(pos, radius) {
    // 舰体用胶囊体/球体组合判定，避免大球吞掉射向弱点的子弹
    for (const part of this.bodyParts) {
      const a = this.group.localToWorld(part.a.clone());
      const b = this.group.localToWorld(part.b.clone());
      const ab = b.sub(a);
      const len2 = ab.lengthSq();
      let t = len2 > 0 ? _v.copy(pos).sub(a).dot(ab) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const closest = a.addScaledVector(ab, t);
      if (closest.distanceTo(pos) < part.r + radius) return true;
    }
    return false;
  }
}

// ---------- Boss 1: 拦截巡洋舰 ----------
export class BossCruiser extends Boss {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildBossCruiser();
    this.name = '拦截者巡洋舰 · VX-9';
    this.hp = this.maxHp = 900;
    this.radius = 12;
    this.core = this.group.userData.core;
    this.coreShieldMesh = this.group.userData.shield;
    this.coreRadius = 4.5;
    this.coreExposed = false;
    const [tl, tr] = this.group.userData.turrets;
    this.weakPoints = [
      { mesh: tl, hp: 120, maxHp: 120, radius: 5, alive: true, fireT: 1.5 },
      { mesh: tr, hp: 120, maxHp: 120, radius: 5, alive: true, fireT: 2.2 },
    ];
    // 主舰体胶囊（避开两侧炮塔）
    this.bodyParts = [{ a: new THREE.Vector3(0, 0, -30), b: new THREE.Vector3(0, 0, 22), r: 5.5 }];
    this.group.position.set(0, 0, -700);
    scene.add(this.group);
  }
  onWeakDestroyed(game) {
    if (this.weakPoints.every(w => !w.alive)) {
      this.coreExposed = true;
      this.coreShieldMesh.visible = false;
      game.radio('佩比', '核心暴露了！就是现在，集中火力攻击！', 'radio_core');
    }
  }
  update(dt, game) {
    this.t += dt;
    this.move(dt, game);
    this.group.rotation.z = Math.sin(this.strafeT * 0.3) * 0.06;
    this.updateWeakPoints(dt, game);
    // 炮塔射击
    if (!this.entering) {
      for (const w of this.weakPoints) {
        if (!w.alive) continue;
        w.mesh.lookAt(game.playerPos);
        w.fireT -= dt;
        if (w.fireT <= 0) {
          w.fireT = 1.4 + Math.random() * 0.6;
          const from = w.mesh.getWorldPosition(new THREE.Vector3());
          const dir = game.playerPos.clone().sub(from).normalize();
          // 三连散射
          for (let i = -1; i <= 1; i++) {
            const d = dir.clone();
            d.x += i * 0.05; d.y += (Math.random() - 0.5) * 0.03;
            game.addEnemyBullet(from, d.normalize().multiplyScalar(120), 0xff40c0);
          }
          game.sfx('enemyShoot');
        }
      }
      // 核心暴露后主炮齐射
      if (this.coreExposed) {
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          this.pattern++;
          this.attackTimer = this.pattern % 3 === 0 ? 4 : 2.2;
          const from = this.group.position.clone(); from.z -= 20;
          const n = 14;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 1).normalize();
            game.addEnemyBullet(from, dir.multiplyScalar(95), 0xff40c0);
          }
          game.sfx('bossBarrage');
        }
      }
    }
    this.hitFlash(dt);
    return this.alive;
  }
}

// ---------- Boss 2: 采矿巨兽 ----------
export class BossBehemoth extends Boss {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildBossBehemoth();
    this.name = '深渊采矿巨兽 · KRAKEN';
    this.hp = this.maxHp = 1400;
    this.radius = 16;
    this.core = this.group.userData.core;
    this.ring = this.group.userData.ring;
    this.doors = this.group.userData.doors;
    this.coreRadius = 5;
    this.coreExposed = true;
    this.doorT = 0;
    this.mineT = 4;
    this.ringT = 6;
    // 中央舱球体（采集环/钻臂不挡子弹）
    this.bodyParts = [{ a: new THREE.Vector3(0, 0, 0), b: new THREE.Vector3(0, 0, 0), r: 7 }];
    this.group.position.set(0, 0, -750);
    scene.add(this.group);
  }
  update(dt, game) {
    this.t += dt;
    this.move(dt, game);
    // 采集环持续旋转
    this.group.rotation.z += dt * 0.5;
    // 舱门开合周期：开 4s / 关 3s
    this.doorT += dt;
    const cycle = this.doorT % 7;
    const open = cycle < 4;
    this.coreExposed = open && !this.entering;
    const target = open ? 1.6 : 0;
    for (const [i, door] of this.doors.entries()) {
      const cur = door.rotation.z;
      door.rotation.z += ((i === 0 ? target : -target) - cur) * dt * 4;
    }
    this.core.visible = open;
    if (this.entering) return this.alive;
    // 发射水雷
    this.mineT -= dt;
    if (this.mineT <= 0) {
      this.mineT = 3.5 + Math.random() * 2;
      const p = this.group.position;
      game.spawnEnemy('mine', p.x + (Math.random()-0.5) * 20, p.y + (Math.random()-0.5) * 14, p.z - 10);
      game.sfx('enemyShoot');
    }
    // 环形弹幕
    this.ringT -= dt;
    if (this.ringT <= 0) {
      this.ringT = 5.5;
      const from = this.group.position.clone();
      const n = 22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 1).normalize();
        game.addEnemyBullet(from, dir.multiplyScalar(85), 0xffd020);
      }
      game.sfx('bossBarrage');
    }
    // 定向钻头弹
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = 2.6;
      const from = this.group.position.clone(); from.z -= 8;
      const dir = game.playerPos.clone().sub(from).normalize();
      for (let i = 0; i < 5; i++) {
        const d = dir.clone();
        d.x += (Math.random()-0.5) * 0.12; d.y += (Math.random()-0.5) * 0.12;
        game.addEnemyBullet(from, d.normalize().multiplyScalar(130), 0xff9020);
      }
      game.sfx('enemyShoot');
    }
    this.hitFlash(dt);
    return this.alive;
  }
  takeDamage(n, game) {
    // 身体减伤；核心正常伤害（coreHit 判定在 main.js）
    this.damageCore(n * 0.15, game);
  }
}

// ---------- Boss 3: 歼灭旗舰 ----------
export class BossFlagship extends Boss {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildBossFlagship();
    this.name = '歼灭旗舰 · ARMAGEDDON';
    this.hp = this.maxHp = 2000;
    this.radius = 15;
    this.core = this.group.userData.core;
    this.coreShieldMesh = this.group.userData.coreShield;
    this.coreRadius = 5;
    this.coreExposed = false;
    this.weakPoints = this.group.userData.gens.map((g, i) => ({
      mesh: g, hp: 160, maxHp: 160, radius: 4, alive: true, fireT: 1 + i * 0.5,
    }));
    this.droneT = 5;
    // 中央舰体 + 两侧翼舱胶囊（避开发生器与舰艏核心）
    this.bodyParts = [
      { a: new THREE.Vector3(0, 0, -40), b: new THREE.Vector3(0, 0, 26), r: 4.5 },
      { a: new THREE.Vector3(13, 0, -14), b: new THREE.Vector3(13, 0, 24), r: 2.5 },
      { a: new THREE.Vector3(-13, 0, -14), b: new THREE.Vector3(-13, 0, 24), r: 2.5 },
    ];
    this.group.position.set(0, 0, -800);
    scene.add(this.group);
  }
  onWeakDestroyed(game) {
    const left = this.weakPoints.filter(w => w.alive).length;
    if (left === 0) {
      this.coreExposed = true;
      this.coreShieldMesh.visible = false;
      game.banner('护盾崩溃！', '攻击舰艏红色核心', 2.5);
    } else {
      game.banner(`护盾发生器剩余 ${left}`, '', 1.5);
    }
  }
  update(dt, game) {
    this.t += dt;
    this.move(dt, game);
    this.group.rotation.z = Math.sin(this.strafeT * 0.4) * 0.1;
    this.updateWeakPoints(dt, game);
    if (this.entering) return this.alive;
    // 发生器充能射击
    for (const w of this.weakPoints) {
      if (!w.alive) continue;
      w.fireT -= dt;
      if (w.fireT <= 0) {
        w.fireT = 2.0 + Math.random();
        const from = w.mesh.getWorldPosition(new THREE.Vector3());
        const dir = game.playerPos.clone().sub(from).normalize();
        game.addEnemyBullet(from, dir.multiplyScalar(130), 0x60ffb0);
        game.sfx('enemyShoot');
      }
    }
    // 召唤无人机
    this.droneT -= dt;
    if (this.droneT <= 0) {
      this.droneT = 7;
      const p = this.group.position;
      game.spawnEnemy('drone', p.x - 18, p.y - 8, p.z - 20);
      game.spawnEnemy('drone', p.x + 18, p.y - 8, p.z - 20);
    }
    // 弹幕
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.pattern++;
      this.attackTimer = this.coreExposed ? 1.6 : 2.6;
      const from = this.core.getWorldPosition(new THREE.Vector3());
      if (this.pattern % 2 === 0) {
        // 扇形扫射
        const dir = game.playerPos.clone().sub(from).normalize();
        for (let i = -3; i <= 3; i++) {
          const d = dir.clone();
          d.x += i * 0.07;
          game.addEnemyBullet(from, d.normalize().multiplyScalar(120), 0xff5040);
        }
      } else {
        // 双螺旋环
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + this.t;
          const dir = new THREE.Vector3(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 1).normalize();
          game.addEnemyBullet(from, dir.multiplyScalar(100), 0xff5040);
        }
      }
      game.sfx('bossBarrage');
    }
    this.hitFlash(dt);
    return this.alive;
  }
  takeDamage(n, game) {
    if (this.coreExposed) this.damageCore(n * 0.2, game);
  }
}

// ---------- Boss: 飞碟母舰（卡蒂娜）----------
export class BossSaucer extends Boss {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildBossSaucer();
    this.name = '飞碟母舰 · SAUCERER';
    this.hp = this.maxHp = 1100;
    this.radius = 20;
    this.core = this.group.userData.core;
    this.coreShieldMesh = this.group.userData.shield;
    this.coreRadius = 4;
    this.coreExposed = false;
    this.weakPoints = this.group.userData.turrets.map((t, i) => ({
      mesh: t, hp: 140, maxHp: 140, radius: 4, alive: true, fireT: 1.2 + i * 0.6,
    }));
    this.bodyParts = [{ a: new THREE.Vector3(0, -2, 0), b: new THREE.Vector3(0, 3, 0), r: 15 }];
    this.droneT = 6;
    this.group.position.set(0, 0, -750);
    scene.add(this.group);
  }
  onWeakDestroyed(game) {
    if (this.weakPoints.every(w => !w.alive)) {
      this.coreExposed = true;
      this.coreShieldMesh.visible = false;
      game.radio('佩比', '核心暴露了！攻击碟底红色核心！', 'radio_core');
    }
  }
  update(dt, game) {
    this.t += dt;
    this.move(dt, game);
    // 碟体缓旋
    this.group.rotation.y += dt * 0.4;
    this.updateWeakPoints(dt, game);
    if (this.entering) return this.alive;
    // 炮位射击
    for (const w of this.weakPoints) {
      if (!w.alive) continue;
      w.fireT -= dt;
      if (w.fireT <= 0) {
        w.fireT = 1.8 + Math.random() * 0.8;
        const from = w.mesh.getWorldPosition(new THREE.Vector3());
        const dir = game.playerPos.clone().sub(from).normalize();
        for (let i = -1; i <= 1; i++) {
          const d = dir.clone(); d.x += i * 0.05;
          game.addEnemyBullet(from, d.normalize().multiplyScalar(115), 0xffb060);
        }
        game.sfx('enemyShoot');
      }
    }
    // 召唤无人机
    this.droneT -= dt;
    if (this.droneT <= 0) {
      this.droneT = 8;
      const p = this.group.position;
      game.spawnEnemy('drone', p.x - 15, p.y - 10, p.z - 30);
      game.spawnEnemy('drone', p.x + 15, p.y - 10, p.z - 30);
    }
    // 核心暴露后环形弹幕
    if (this.coreExposed) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackTimer = 2.4;
        const from = this.core.getWorldPosition(new THREE.Vector3());
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const dir = new THREE.Vector3(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 1).normalize();
          game.addEnemyBullet(from, dir.multiplyScalar(100), 0xff8040);
        }
        game.sfx('bossBarrage');
      }
    }
    this.hitFlash(dt);
    return this.alive;
  }
}

// ---------- Boss: 深海潜艇（佐内斯）----------
export class BossSub extends Boss {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildBossSub();
    this.name = '深海潜艇 · SARUMARINE';
    this.hp = this.maxHp = 1500;
    this.radius = 14;
    this.core = this.group.userData.core;
    this.hatches = this.group.userData.hatches;
    this.coreRadius = 4.2;
    this.coreExposed = true;
    this.hatchT = 0;
    this.torpedoT = 3;
    this.mineT = 5;
    this.bodyParts = [{ a: new THREE.Vector3(0, 0, -24), b: new THREE.Vector3(0, 0, 24), r: 5.5 },
      // 两侧浮筒舱
      { a: new THREE.Vector3(5.2, -4.2, -13), b: new THREE.Vector3(5.2, -4.2, 13), r: 2.8 },
      { a: new THREE.Vector3(-5.2, -4.2, -13), b: new THREE.Vector3(-5.2, -4.2, 13), r: 2.8 }];
    this.group.position.set(0, 0, -780);
    scene.add(this.group);
  }
  update(dt, game) {
    this.t += dt;
    this.move(dt, game);
    this.group.rotation.z = Math.sin(this.strafeT * 0.5) * 0.08;
    // 舱盖开合：开 3.5s / 关 3.5s
    this.hatchT += dt;
    const open = (this.hatchT % 7) < 3.5;
    this.coreExposed = open && !this.entering;
    this.core.visible = open;
    const target = open ? 1.5 : 0;
    this.hatches[0].rotation.y += (target - this.hatches[0].rotation.y) * dt * 4;
    this.hatches[1].rotation.y += (-target - this.hatches[1].rotation.y) * dt * 4;
    if (this.entering) return this.alive;
    // 鱼雷（大型慢速弹，可被击毁）
    this.torpedoT -= dt;
    if (this.torpedoT <= 0 && open) {
      this.torpedoT = 2.8;
      const from = this.core.getWorldPosition(new THREE.Vector3());
      const dir = game.playerPos.clone().sub(from).normalize();
      const b = game.addEnemyBullet(from, dir.multiplyScalar(75), 0xffe060);
      if (b) { b.mesh.scale.set(2.2, 2.2, 2.2); b.damage = 16; b.radius = 2.6; }
      game.sfx('enemyShoot');
    }
    // 布设水雷
    this.mineT -= dt;
    if (this.mineT <= 0) {
      this.mineT = 4 + Math.random() * 2;
      const p = this.group.position;
      game.spawnEnemy('mine', p.x + (Math.random() - 0.5) * 24, p.y + (Math.random() - 0.5) * 12, p.z - 10);
    }
    // 指挥塔机炮
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = 2.2;
      const from = this.group.position.clone(); from.y += 8; from.z -= 4;
      const dir = game.playerPos.clone().sub(from).normalize();
      for (let i = -2; i <= 2; i++) {
        const d = dir.clone(); d.x += i * 0.06;
        game.addEnemyBullet(from, d.normalize().multiplyScalar(125), 0x40c8ff);
      }
      game.sfx('enemyShoot');
    }
    this.hitFlash(dt);
    return this.alive;
  }
  takeDamage(n, game) {
    // 艇体减伤
    this.damageCore(n * 0.12, game);
  }
}

// ---------- Boss: 沃尔夫小队（福尔图娜）----------
export class BossStarWolf extends Boss {
  constructor(scene, game) {
    super(scene, game);
    this.group = new THREE.Group(); // 隐形锚点
    this.name = '沃尔夫小队 · STAR WOLF';
    this.hp = this.maxHp = 0; // 血条只算成员
    this.radius = 0;
    this.core = null;
    this.coreExposed = false;
    this.bodyParts = [];
    const names = ['沃尔夫', '莱昂', '皮格玛'];
    this.weakPoints = [];
    for (let i = 0; i < 3; i++) {
      const mesh = buildWolfen();
      mesh.position.set((i - 1) * 24, 8, -420); // 从远处编队飞入
      this.group.add(mesh);
      this.weakPoints.push({
        mesh, hp: 260, maxHp: 260, radius: 4, alive: true,
        fireT: 1.5 + i, phase: i * 2.1, diveT: 5 + i * 3, diving: 0,
        name: names[i],
      });
    }
    // 锚点不需入场飞行（move 由成员各自完成），直接解除入场状态，
    // 否则 main.js 的命中/锁定/炸弹判定会被 entering 永久屏蔽
    this.entering = false;
    this.group.position.set(0, 0, -160);
    scene.add(this.group);
  }
  onWeakDestroyed(game) {
    const left = this.weakPoints.filter(w => w.alive).length;
    if (left > 0) game.banner(`击落一架！沃尔夫小队剩余 ${left}`, '', 2);
    else { this.hp = 0; this.alive = false; game.onBossDefeated(this); }
  }
  move() {} // 成员各自移动
  update(dt, game) {
    this.t += dt;
    for (const w of this.weakPoints) {
      if (!w.alive) continue;
      w.phase += dt;
      const m = w.mesh;
      // 俯冲攻击周期：平时环绕，俯冲时逼近玩家
      w.diveT -= dt;
      if (w.diveT <= 0) { w.diveT = 6 + Math.random() * 4; w.diving = 2.2; }
      let tx, ty, tz;
      if (w.diving > 0) {
        w.diving -= dt;
        // 掠过玩家前方（先逼近再拉远；局部 z 峰值 +75 ≈ 世界 -85）
        tx = Math.sin(w.phase * 3) * 10;
        ty = Math.cos(w.phase * 2.2) * 6;
        tz = -10 + Math.sin(Math.min(Math.PI, (2.2 - w.diving) / 2.2 * Math.PI)) * 85;
      } else {
        // 巡航：在玩家前方中近距离盘旋（局部 z -35~+15 ≈ 世界 -195~-145）
        tx = Math.sin(w.phase * 0.7) * 26;
        ty = Math.cos(w.phase * 0.55) * 12;
        tz = -10 + Math.sin(w.phase * 0.9) * 25;
      }
      m.position.x += (tx - m.position.x) * dt * 2.5;
      m.position.y += (ty - m.position.y) * dt * 2.5;
      m.position.z += (tz - m.position.z) * dt * 2.5;
      m.lookAt(game.playerPos);
      // 开火
      w.fireT -= dt;
      if (w.fireT <= 0 && m.position.z > -300) {
        w.fireT = 1.3 + Math.random() * 0.7;
        const from = m.getWorldPosition(new THREE.Vector3()); // 子弹需世界坐标
        const dir = game.playerPos.clone().sub(from).normalize();
        for (let i = -1; i <= 1; i++) {
          const d = dir.clone(); d.x += i * 0.04;
          game.addEnemyBullet(from, d.normalize().multiplyScalar(135), 0xff4040);
        }
        game.sfx('enemyShoot');
      }
    }
    return this.alive;
  }
}

// ---------- Boss: 皇帝安德罗斯（维诺姆）----------
export class BossAndross extends Boss {
  constructor(scene, game) {
    super(scene, game);
    this.group = buildBossAndross();
    this.name = '皇帝安德罗斯 · ANDROSS';
    this.hp = this.maxHp = 2400;
    this.radius = 18;
    this.core = this.group.userData.core;
    this.coreShieldMesh = this.group.userData.coreShield;
    this.hands = this.group.userData.hands;
    this.coreRadius = 5;
    this.coreExposed = false;
    this.weakPoints = this.group.userData.eyes.map((e, i) => ({
      mesh: e, hp: 220, maxHp: 220, radius: 4.2, alive: true, fireT: 1.2 + i * 0.8,
    }));
    this.bodyParts = [{ a: new THREE.Vector3(0, -12, 0), b: new THREE.Vector3(0, 12, 0), r: 14 }];
    this.inhaleT = 8;
    this.group.position.set(0, 0, -820);
    scene.add(this.group);
  }
  onWeakDestroyed(game) {
    const left = this.weakPoints.filter(w => w.alive).length;
    if (left === 0) {
      this.coreExposed = true;
      this.coreShieldMesh.visible = false;
      game.radio('佩比', '安德罗斯的嘴部暴露了！集火口腔核心！', 'radio_core');
    } else {
      game.banner(`剩余 ${left} 只眼睛`, '', 1.5);
    }
  }
  update(dt, game) {
    this.t += dt;
    this.move(dt, game);
    // 头颅缓慢逼近感
    this.group.rotation.z = Math.sin(this.strafeT * 0.3) * 0.05;
    // 双手拍击摆动
    for (const [i, h] of this.hands.entries()) {
      h.position.y = -6 + Math.sin(this.t * 1.2 + i * 2) * 8;
      h.position.x = (i === 0 ? -24 : 24) + Math.sin(this.t * 0.7 + i) * 6;
    }
    this.updateWeakPoints(dt, game);
    if (this.entering) return this.alive;
    // 眼部光束弹
    for (const w of this.weakPoints) {
      if (!w.alive) continue;
      w.fireT -= dt;
      if (w.fireT <= 0) {
        w.fireT = 1.7 + Math.random() * 0.7;
        const from = w.mesh.getWorldPosition(new THREE.Vector3());
        const dir = game.playerPos.clone().sub(from).normalize();
        game.addEnemyBullet(from, dir.multiplyScalar(140), 0xffcc20);
        game.sfx('enemyShoot');
      }
    }
    // 吸入弹幕（核心暴露后加强）
    this.inhaleT -= dt;
    if (this.inhaleT <= 0) {
      this.inhaleT = this.coreExposed ? 4 : 6.5;
      const from = this.core.getWorldPosition(new THREE.Vector3());
      const n = this.coreExposed ? 20 : 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.t;
        const dir = new THREE.Vector3(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 1).normalize();
        game.addEnemyBullet(from, dir.multiplyScalar(105), 0xff3020);
      }
      game.sfx('bossBarrage');
    }
    // 手掌能量弹
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = 3;
      for (const h of this.hands) {
        const from = h.getWorldPosition(new THREE.Vector3());
        const dir = game.playerPos.clone().sub(from).normalize();
        for (let i = -1; i <= 1; i++) {
          const d = dir.clone(); d.y += i * 0.06;
          game.addEnemyBullet(from, d.normalize().multiplyScalar(120), 0xff8020);
        }
      }
      game.sfx('enemyShoot');
    }
    this.hitFlash(dt);
    return this.alive;
  }
  takeDamage(n, game) {
    // 面部减伤（核心暴露前）
    this.damageCore(n * (this.coreExposed ? 0.25 : 0.05), game);
  }
}

export const ENEMY_TYPES = { drone: Drone, fighter: Fighter, turret: Turret, mine: Mine, tank: Tank };
export const BOSS_TYPES = { cruiser: BossCruiser, behemoth: BossBehemoth, flagship: BossFlagship,
  saucer: BossSaucer, sub: BossSub, starwolf: BossStarWolf, andross: BossAndross };
