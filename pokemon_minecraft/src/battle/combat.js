// 实时战斗运行时（设计文档 §8/§10）：施法前摇、冷却、自动瞄准、弹道、伤害、异常、捕获
import { getMove } from '../data/movedata.js';
import { getSpecies } from '../data/species.js';
import { calcDamage, rollHit, effectivenessLabel } from './damage.js';
import { applyStatus, applyVolatile, canAct, onHitBy, statusCatchBonus } from './status.js';
import { attemptCapture } from './capture.js';
import { expReward, moneyReward } from '../pokemon/stats.js';
import { gainExp } from '../pokemon/learnset.js';
import { levelUpEvolution } from '../pokemon/evolution.js';
import { STATUS, VOLATILE, confusionSelfDamage } from '../data/statusData.js';
import { playMoveAnim, projectileTo } from '../fx/moveAnims.js';
import { burstHit, burstHeal, burstStars } from '../fx/particles.js';

const AUTOAIM_RANGE = 12;
const AUTOAIM_COS = Math.cos(Math.PI / 3);   // ±60° 扇形

export class Combat {
  constructor(game) {
    this.game = game;
    this.aggroSet = new Set();       // 仇恨玩家的野生精灵
    this.projectiles = [];           // 弹道视觉效果
    this.playerCooldowns = {};       // moveId → 就绪时间
    this.playerCasting = null;       // { moveId, t, target }
    this.capturing = null;           // 捕获流程状态
    this.coins = [];                 // 金币掉落
    this.battleEndTimer = 0;
    this.playerStagger = 0;          // 硬直（畏缩/麻痹失败）
  }

  get inBattle() { return this.aggroSet.size > 0; }

  onAggro(c) {
    const wasEmpty = this.aggroSet.size === 0;
    this.aggroSet.add(c);
    if (wasEmpty) this.game.audio?.bgm(c.gymMon ? 'battle_gym' : 'battle_wild');
  }

  onDeaggro(c) {
    this.aggroSet.delete(c);
    if (this.aggroSet.size === 0) this.game._scheduleAmbientBgm?.();
  }

  // ---- 自动瞄准（§6：±60° 扇形 12 方块内取最近目标） ----
  autoAim() {
    const g = this.game;
    const p = g.player;
    const fx = Math.sin(p.faceYaw), fz = Math.cos(p.faceYaw);
    let best = null, bestD = Infinity;
    for (const c of g.spawner.creatures) {
      if (c.fainted || c.faintT >= 0 || c.removeMe) continue;
      if (this.capturing?.target === c) continue;
      const dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > AUTOAIM_RANGE) continue;
      const dot = d > 0.001 ? (dx * fx + dz * fz) / d : 1;
      if (dot < AUTOAIM_COS && d > 2.5) continue;   // 近战范围内放宽方向
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  // ---- 玩家施放技能（数字键 1~4） ----
  playerCastMove(slot) {
    const g = this.game;
    const inst = g.party.active;
    if (!inst || inst.curHp <= 0 || g.mode !== 'play') return false;
    if (this.playerCasting || this.playerStagger > 0) return false;
    const moveId = inst.moves[slot];
    if (!moveId) return false;
    const move = getMove(moveId);
    if ((this.playerCooldowns[moveId] || 0) > g.time) { g.audio?.sfx('ui_error'); return false; }
    if (!canAct(inst)) { g.ui?.floatText(g.player.pos.clone().add(new THREE.Vector3(0, 2, 0)), statusBlockText(inst), '#ccc'); return false; }

    // 麻痹 25% 失败
    if (inst.status === 'paralysis' && Math.random() < STATUS.paralysis.failChance) {
      this.playerStagger = 0.5;
      this.playerCooldowns[moveId] = g.time + move.cooldown;
      g.particles.spawn(g.player.pos.x, g.player.pos.y + 1, g.player.pos.z, { color: 0xF8D030, count: 10, spread: 2, up: 1, life: 0.3 });
      g.ui?.floatText(g.player.pos.clone().setY(g.player.pos.y + 2), '麻痹了，无法行动!', '#F8D030');
      g.audio?.sfx('status_para');
      return true;
    }
    // 混乱 33% 自伤
    if (inst.volatile.includes('confusion') && Math.random() < VOLATILE.confusion.selfHitChance) {
      const dmg = confusionSelfDamage(inst.level, inst.atk, inst.def);
      this.damagePlayer(dmg, '混乱自伤');
      this.playerCooldowns[moveId] = g.time + move.cooldown;
      g.ui?.floatText(g.player.pos.clone().setY(g.player.pos.y + 2), '混乱中攻击了自己!', '#FCDC5F');
      return true;
    }

    const target = move.category === 'status' && move.range === 0 ? null : this.autoAim();
    if (move.power > 0 && !target) { g.ui?.hint('附近没有目标'); return false; }
    if (move.category === 'status' && move.range > 0 && !target) { g.ui?.hint('附近没有目标'); return false; }

    this.playerCasting = { moveId, t: move.castTime, target };
    this.playerCooldowns[moveId] = g.time + move.cooldown;
    return true;
  }

  // ---- 野生精灵施放 ----
  creatureCastMove(c, move) {
    if (c.fainted || !canAct(c.inst)) return;
    const g = this.game;
    // 麻痹 25% 失败
    if (c.inst.status === 'paralysis' && Math.random() < STATUS.paralysis.failChance) {
      g.particles.spawn(c.pos.x, c.pos.y + 1, c.pos.z, { color: 0xF8D030, count: 8, spread: 2, up: 1, life: 0.3 });
      g.audio?.sfx('status_para');
      return;
    }
    // 混乱 33% 自伤
    if (c.inst.volatile.includes('confusion') && Math.random() < VOLATILE.confusion.selfHitChance) {
      const dmg = confusionSelfDamage(c.inst.level, c.inst.atk, c.inst.def);
      this.damageCreature(c, dmg, null, 'normal');
      g.ui?.floatText(c.headPos(), '混乱自伤!', '#FCDC5F');
      return;
    }
    const moveId = c.inst.moves.find(m => getMove(m) === move);
    if (moveId) c.cooldowns[moveId] = g.time + move.cooldown + 1.2;   // AI 额外喘息
    c.casting = { move, t: move.castTime, target: 'player' };
  }

  // ---- 施法进行中 ----
  update(dt) {
    const g = this.game;
    this.playerStagger = Math.max(0, this.playerStagger - dt);

    // 玩家前摇
    if (this.playerCasting) {
      const cast = this.playerCasting;
      cast.t -= dt;
      if (cast.t <= 0) {
        const move = getMove(cast.moveId);
        this.playerCasting = null;
        this.executePlayerMove(move, cast.target);
      }
    }
    // 野怪前摇
    for (const c of g.spawner.creatures) {
      if (!c.casting) continue;
      c.casting.t -= dt;
      if (c.casting.t <= 0) {
        const move = c.casting.move;
        c.casting = null;
        this.executeCreatureMove(c, move);
      }
    }
    // 弹道
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt / p.dur;
      if (p.t >= 1) {
        p.mesh && g.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        p.onArrive?.();
      } else {
        p.update?.(p.t);
      }
    }
    // 金币磁吸
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.t += dt;
      coin.mesh.rotation.y += dt * 5;
      const d = coin.mesh.position.distanceTo(g.player.pos);
      if (d < 8) coin.mesh.position.lerp(g.player.pos.clone().setY(g.player.pos.y + 0.5), Math.min(1, dt * 4));
      if (d < 1 || coin.t > 5) {
        g.addMoney(coin.amount);
        g.audio?.sfx('money');
        g.scene.remove(coin.mesh);
        this.coins.splice(i, 1);
      }
    }
    // 捕获流程推进
    this.updateCapture(dt);
    // 战斗结束检测（全灭仇恨目标）
    if (this.aggroSet.size > 0) {
      for (const c of this.aggroSet) {
        if (c.fainted || c.removeMe || c.state === 'wander' || c.state === 'return') this.onDeaggro(c);
      }
    }
  }

  // ---- 玩家技能命中 ----
  executePlayerMove(move, target) {
    const g = this.game;
    const inst = g.party.active;
    if (!inst) return;
    const from = g.player.pos.clone().setY(g.player.pos.y + 0.8);
    g.audio?.sfx(move.sfx);
    if (!target) { playMoveAnim(g, move, from, null); return; }
    playMoveAnim(g, move, from, target, () => this.hitCreature(target, move, inst));
  }

  hitCreature(c, move, inst) {
    if (c.fainted || c.removeMe) return;
    const g = this.game;
    // 激怒目标（即使未命中也会反击）
    if (c.state === 'wander' || c.state === 'return') { c.state = 'chase'; this.onAggro(c); }
    if (!rollHit(move)) {
      g.ui?.damageText(c.headPos(), 'MISS', '#AAAAAA');
      g.audio?.sfx('miss');
      return;
    }
    if (move.category === 'status' || move.power === 0) {
      this.applyMoveEffect(c, move, inst);
      return;
    }
    const atkSide = { level: inst.level, atk: inst.atk, def: inst.def, types: getSpecies(inst.speciesKey).types, status: inst.status };
    const { damage, mult } = calcDamage(atkSide, { types: c.species.types, def: c.inst.def }, move);
    if (mult === 0) {
      g.ui?.damageText(c.headPos(), '没有效果', '#AAAAAA');
      return;
    }
    this.damageCreature(c, damage, move, move.type);
    const label = effectivenessLabel(mult);
    if (label) g.ui?.floatText(c.headPos().add(new THREE.Vector3(0, 0.5, 0)), label, mult >= 2 ? '#F8D030' : '#88A8F8');
    if (mult >= 2) g.audio?.sfx('hit_super'); else g.audio?.sfx('hit_normal');
    // 附加效果
    if (move.effect) this.rollEffect(c, move, inst);
    // 吸取类
    if (move.drain && damage > 0) {
      const heal = Math.max(1, Math.floor(damage * move.drain));
      inst.curHp = Math.min(inst.maxHp, inst.curHp + heal);
      burstHeal(g.particles, g.player.pos);
    }
  }

  // 技能附加效果掷骰（§9.3 官方概率）
  rollEffect(c, move, inst) {
    const g = this.game;
    const e = move.effect;
    if (Math.random() * 100 >= e.chance) return;
    this.applyMoveEffect(c, move, inst, e);
  }

  applyMoveEffect(c, move, inst, e = move.effect) {
    if (!e) return;
    const g = this.game;
    // 粉末类草系免疫（§9.3）
    if (move.powder && c.species.types.includes('grass')) { g.ui?.damageText(c.headPos(), '没有效果', '#AAAAAA'); return; }
    // 电磁波对岩系（含地面）无效
    if (move.id === 'thunderwave' && c.species.types.includes('rock')) { g.ui?.damageText(c.headPos(), '没有效果', '#AAAAAA'); return; }
    if (e.kind === 'flinch') {
      c.flinchT = Math.max(c.flinchT, VOLATILE.flinch.duration);
      c.casting = null;
      g.ui?.floatText(c.headPos(), '畏缩了!', '#CCCCCC');
      return;
    }
    const ok = e.kind === 'status' ? applyStatus(c.inst, e.status) : applyVolatile(c.inst, e.status);
    if (ok) {
      const name = e.kind === 'status' ? STATUS[e.status].name : VOLATILE[e.status].name;
      g.ui?.floatText(c.headPos(), `${c.species.name} ${name}了!`, STATUS[e.status]?.color || '#FCDC5F');
      g.audio?.sfx('status_' + (e.status === 'badpoison' ? 'poison' : { paralysis: 'para', confusion: 'confuse' }[e.status] || e.status));
    } else if (move.category === 'status') {
      g.ui?.damageText(c.headPos(), '没有效果', '#AAAAAA');
    }
  }

  // ---- 野怪技能命中玩家 ----
  executeCreatureMove(c, move) {
    const g = this.game;
    const d = c.distToPlayer();
    const from = c.pos.clone().setY(c.pos.y + 0.6);
    g.audio?.sfx3d?.(move.sfx, c.pos);
    if (d > move.range * 1.3) { playMoveAnim(g, move, from, null); return; }   // 已脱离射程
    playMoveAnim(g, move, from, g.player, () => this.hitPlayer(c, move));
  }

  hitPlayer(c, move) {
    const g = this.game;
    const inst = g.party.active;
    if (!inst || inst.curHp <= 0) return;
    if (!rollHit(move)) {
      g.ui?.damageText(g.player.pos.clone().setY(g.player.pos.y + 1.8), 'MISS', '#AAAAAA');
      return;
    }
    if (move.category === 'status' || move.power === 0) {
      // 状态技打玩家
      const e = move.effect;
      if (e) {
        const spTypes = getSpecies(inst.speciesKey).types;
        if (move.powder && spTypes.includes('grass')) return;
        const ok = e.kind === 'status' ? applyStatus(inst, e.status) : applyVolatile(inst, e.status);
        if (ok) {
          const name = e.kind === 'status' ? STATUS[e.status].name : VOLATILE[e.status].name;
          g.ui?.floatText(g.player.pos.clone().setY(g.player.pos.y + 2), `${getSpecies(inst.speciesKey).name} ${name}了!`, '#F08080');
          g.audio?.sfx('status_' + (e.status === 'badpoison' ? 'poison' : { paralysis: 'para', confusion: 'confuse' }[e.status] || e.status));
        }
      }
      return;
    }
    const atkSide = { level: c.inst.level, atk: c.inst.atk, def: c.inst.def, types: c.species.types, status: c.inst.status };
    const defSide = { types: getSpecies(inst.speciesKey).types, def: inst.def };
    const { damage, mult } = calcDamage(atkSide, defSide, move);
    if (mult === 0) { g.ui?.damageText(g.player.pos.clone().setY(g.player.pos.y + 1.8), '没有效果', '#AAAAAA'); return; }
    this.damagePlayer(damage, null, move);
    const label = effectivenessLabel(mult);
    if (label) g.ui?.floatText(g.player.pos.clone().setY(g.player.pos.y + 2.2), label, mult >= 2 ? '#F08080' : '#88A8F8');
    // 附加效果
    if (move.effect && Math.random() * 100 < move.effect.chance) {
      const e = move.effect;
      if (e.kind === 'flinch') { this.playerStagger = Math.max(this.playerStagger, VOLATILE.flinch.duration); this.playerCasting = null; }
      else {
        const ok = e.kind === 'status' ? applyStatus(inst, e.status) : applyVolatile(inst, e.status);
        if (ok) g.ui?.floatText(g.player.pos.clone().setY(g.player.pos.y + 2), (STATUS[e.status]?.name || VOLATILE[e.status].name) + '了!', '#F08080');
      }
    }
    // 受击唤醒/解冻
    for (const ev of onHitBy(inst, move.type)) {
      g.ui?.floatText(g.player.pos.clone().setY(g.player.pos.y + 2), ev.type === 'woke' ? '被吵醒了!' : '解冻了!', '#A8A878');
    }
  }

  // ---- 伤害结算 ----
  damageCreature(c, amount, move, moveType) {
    const g = this.game;
    c.inst.curHp = Math.max(0, c.inst.curHp - amount);
    c.flash();
    burstHit(g.particles, c.pos, 0xffffff);
    g.ui?.damageText(c.headPos(), '-' + amount, TYPE_COLORS_TEXT[move?.type || moveType] || '#FF6B6B');   // 属性色伤害数字
    g.audio?.cry(c.species.id, 'hurt');
    if (move) for (const ev of onHitBy(c.inst, move.type)) {
      g.ui?.floatText(c.headPos(), ev.type === 'woke' ? '被吵醒了!' : '解冻了!', '#A8A878');
    }
    if (c.inst.curHp <= 0) {
      c.startFaint();
      this.onCreatureDefeated(c);
    } else if (c.state === 'wander' || c.state === 'return') {
      c.state = 'chase';
      this.onAggro(c);
    }
  }

  damagePlayer(amount, source, move) {
    const g = this.game;
    const inst = g.party.active;
    if (!inst) return;
    inst.curHp = Math.max(0, inst.curHp - amount);
    burstHit(g.particles, g.player.pos, 0xff8888);
    g.ui?.damageText(g.player.pos.clone().setY(g.player.pos.y + 1.8), '-' + amount, '#FF6B6B');
    g.audio?.sfx('hurt');
    g.ui?.flashVignette?.();
    if (inst.curHp <= 0) this.onPlayerMonFainted();
  }

  // 野怪倒下：经验 + 金币
  onCreatureDefeated(c) {
    const g = this.game;
    this.onDeaggro(c);
    g.audio?.jingle('victory');
    if (c.boss) g.onBossDefeated?.();          // 结局：击败雪山 Boss
    // 金币方块掉落（≈敌方等级×3）
    const amount = moneyReward(c.inst.level);
    const coinMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xFCDC5F }));
    coinMesh.position.copy(c.pos).setY(c.pos.y + 0.5);
    g.scene.add(coinMesh);
    this.coins.push({ mesh: coinMesh, amount, t: 0 });
    // 经验：出战全額、队伍其他 50%
    const total = expReward(c.species, c.inst.level);
    this.grantExp(total);
  }

  grantExp(total) {
    const g = this.game;
    const shares = g.party.distributeExp(total);
    for (const { index, amount } of shares) {
      const m = g.party.members[index];
      const sp = getSpecies(m.speciesKey);
      const res = gainExp(m, amount);
      if (index === g.party.activeIndex) {
        g.ui?.floatText(g.player.pos.clone().setY(g.player.pos.y + 2), `+${amount} 经验`, '#7AEF7A');
      }
      if (res.levelsGained > 0) {
        g.audio?.sfx('levelup');
        burstStars(g.particles, index === g.party.activeIndex ? g.player.pos : g.player.pos, 16);
        g.ui?.announce(`${sp.name} 升到了 Lv.${m.level}!`);
        for (const l of res.movesToLearn) g.queueMoveLearn(m, l.move);
        // 进化检查
        const evo = levelUpEvolution(m);
        if (evo) g.queueEvolution(m, evo);
      }
    }
    g.ui?.refreshParty?.();
  }

  // 玩家宝可梦倒下
  onPlayerMonFainted() {
    const g = this.game;
    const inst = g.party.active;
    const sp = getSpecies(inst.speciesKey);
    g.ui?.announce(`${sp.name} 倒下了!`);
    g.audio?.sfx('faint');
    const next = g.party.nextUsable();
    if (next >= 0) {
      g.party.switchTo(next);
      g.player.refreshModel();
      g.ui?.refreshParty?.();
      const nsp = getSpecies(g.party.active.speciesKey);
      g.ui?.announce(`上吧，${nsp.name}!`);
      g.audio?.cry(nsp.id, 'encounter');
    } else {
      g.onBlackout();
    }
  }

  // ---- 捕获 ----
  throwBall(itemId) {
    const g = this.game;
    if (this.capturing) { g.ui?.hint('精灵球还在摇晃…'); return false; }
    const target = this.autoAim();
    if (!target) { g.ui?.hint('附近没有可捕捉的野生宝可梦'); return false; }
    if (target.noCapture) { g.ui?.hint('道馆宝可梦不可捕获!'); return false; }
    const item = g.bag[itemId];
    if (!item || item <= 0) { g.ui?.hint('没有这种精灵球'); g.audio?.sfx('ui_error'); return false; }
    const bonus = { pokeball: 1.0, greatball: 1.5, ultraball: 2.0, masterball: 255 }[itemId];
    g.removeItem(itemId, 1);
    g.audio?.sfx('ball_throw');
    const from = g.player.pos.clone().setY(g.player.pos.y + 1.2);
    const to = target.pos.clone().setY(target.pos.y + 0.5);
    // 抛物线球体
    const ballMesh = makeBallMesh(itemId);
    g.scene.add(ballMesh);
    const dur = 0.5;
    const start = from.clone();
    projectileTo(g, ballMesh, start, to, dur, () => this.startAbsorb(target, itemId, bonus, ballMesh));
    return true;
  }

  startAbsorb(c, itemId, bonus, ballMesh) {
    const g = this.game;
    g.audio?.sfx('ball_absorb');
    c.held = true;
    c.vel.set(0, 0, 0);
    this.capturing = { target: c, phase: 'absorb', t: 0, itemId, bonus, ballMesh, shakes: 0 };
    // 红光吸入粒子
    g.particles.spawn(c.pos.x, c.pos.y + 0.6, c.pos.z, { color: 0xFF4040, count: 20, spread: 1, up: 1, life: 0.5, gravity: -3 });
  }

  updateCapture(dt) {
    const cap = this.capturing;
    if (!cap) return;
    const g = this.game;
    const c = cap.target;
    cap.t += dt;
    if (cap.phase === 'absorb') {
      const s = Math.max(0.01, 1 - cap.t / 0.6);
      c.model.scale.setScalar(s / 8);
      if (cap.t >= 0.6) {
        c.model.visible = false;
        cap.phase = 'drop'; cap.t = 0;
      }
    } else if (cap.phase === 'drop') {
      cap.ballMesh.position.y = Math.max(c.pos.y + 0.25, cap.ballMesh.position.y - dt * 4);
      if (cap.t > 0.4) { cap.phase = 'shakes'; cap.t = 0; cap.result = attemptCapture(c.inst, cap.bonus); }
    } else if (cap.phase === 'shakes') {
      const shakeDur = 0.9;
      const i = Math.floor(cap.t / shakeDur);          // 第几次摇晃
      const st = (cap.t % shakeDur) / shakeDur;
      const totalShakes = cap.result.success ? 3 : cap.result.shakes;
      if (i < totalShakes) {
        cap.ballMesh.rotation.z = Math.sin(st * Math.PI * 4) * 0.45;
        if (!cap['sound' + i] && st > 0.1) { g.audio?.sfx('ball_shake'); cap['sound' + i] = true; }
      } else if (cap.t > totalShakes * shakeDur + 0.35) {
        if (cap.result.success) this.captureSuccess(cap);
        else this.captureFail(cap);
      } else {
        cap.ballMesh.rotation.z *= 0.8;
      }
    }
  }

  captureSuccess(cap) {
    const g = this.game;
    g.audio?.sfx('ball_success');
    g.audio?.jingle('capture');
    burstStars(g.particles, cap.target.pos, 20);
    g.scene.remove(cap.ballMesh);
    const inst = cap.target.inst;
    if (cap.target.boss) g.onBossDefeated?.();   // 结局：捕获雪山 Boss 同样通关
    this.onDeaggro(cap.target);
    cap.target.removeMe = true;
    this.capturing = null;
    g.onPokemonCaptured(inst);
  }

  captureFail(cap) {
    const g = this.game;
    g.audio?.sfx('ball_break');
    g.scene.remove(cap.ballMesh);
    const c = cap.target;
    c.held = false;
    c.model.visible = true;
    c.model.scale.setScalar(1 / 8);
    burstHit(g.particles, c.pos, 0xff4444);
    g.ui?.announce(`哎呀！${c.species.name} 挣脱了!`);
    c.state = 'chase';
    this.onAggro(c);
    this.capturing = null;
  }
}

function statusBlockText(inst) {
  return inst.status === 'freeze' ? '被冻住了!' : '睡着了!';
}

const TYPE_COLORS_TEXT = {
  normal: '#E8E8D8', fire: '#F08030', water: '#6890F0', grass: '#78C850',
  electric: '#F8D030', rock: '#B8A038', poison: '#A040A0', ghost: '#705898',
  ice: '#98D8D8', psychic: '#F85888',
};

function makeBallMesh(itemId) {
  const color = { pokeball: 0xE03A3A, greatball: 0x3A6AD8, ultraball: 0x333333, masterball: 0x8A3AD8 }[itemId] || 0xE03A3A;
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color }));
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xF0F0F0 }));
  g.add(top); g.add(bottom);
  return g;
}
