// 野生精灵 AI（设计文档 §8.3）：游荡→警戒→追击→攻击→脱战回位；低血 30% 概率逃跑
import { canAct, speedMultiplier } from '../battle/status.js';

const ALERT_RANGE = 6;
const DEAGGRO_RANGE = 20;
const ATTACK_PAUSE = 1.2;

export function updateAI(c, dt) {
  if (c.fainted || c.faintT >= 0) return;
  if (c.bossSleeping) { c.vel.x = 0; c.vel.z = 0; return; }   // 结局 Boss 沉睡中
  const game = c.game;
  const player = game.player;
  c.stateT += dt;
  c.flinchT = Math.max(0, c.flinchT - dt);

  // 冰冻/睡眠挂起 AI；混乱乱走
  if (!canAct(c.inst)) { c.vel.x = 0; c.vel.z = 0; return; }

  const distP = c.distToPlayer();
  const inVillage = !!game.world.villageAt(c.pos.x, c.pos.z) || !!game.world.villageAt(player.pos.x, player.pos.z);

  // 脱战：距离远 / 进村庄安全区
  if ((c.state === 'chase' || c.state === 'attack' || c.state === 'alert') &&
      (distP > DEAGGRO_RANGE || inVillage || game.mode !== 'play')) {
    c.state = 'return';
    c.target = null;
    game.combat?.onDeaggro?.(c);
  }

  const lowHp = c.inst.curHp / c.inst.maxHp < 0.25;

  switch (c.state) {
    case 'wander': {
      if (c.stateT > 2 + Math.random() * 3) {
        c.stateT = 0;
        c.wanderDir = Math.random() * Math.PI * 2;
        c.wanderMove = Math.random() < 0.6;
      }
      const spd = c.wanderMove ? 1.2 : 0;
      c.vel.x = Math.sin(c.wanderDir) * spd;
      c.vel.z = Math.cos(c.wanderDir) * spd;
      if (c.wanderMove) c.faceYaw = c.wanderDir;
      // 发现玩家
      if (distP < ALERT_RANGE && !inVillage && game.mode === 'play' && player.active?.curHp > 0) {
        c.state = 'alert'; c.stateT = 0;
        game.audio?.cry(c.species.id, 'encounter');
        game.combat?.onAggro?.(c);
      }
      break;
    }
    case 'alert': {
      c.vel.x = 0; c.vel.z = 0;
      c.faceYaw = Math.atan2(player.pos.x - c.pos.x, player.pos.z - c.pos.z);
      if (c.stateT > 0.5) { c.state = lowHp && Math.random() < 0.3 ? 'flee' : 'chase'; c.stateT = 0; }
      break;
    }
    case 'chase': {
      // 低血量一次性判定：30% 概率逃跑（§8.3）
      if (lowHp && !c.fleeRolled) {
        c.fleeRolled = true;
        if (Math.random() < 0.3) { c.state = 'flee'; c.stateT = 0; break; }
      }
      const dx = player.pos.x - c.pos.x, dz = player.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      // 混乱时乱走
      const confused = c.inst.volatile.includes('confusion');
      const ang = Math.atan2(dx, dz) + (confused ? Math.sin(c.moveTime * 5) * 1.5 : 0);
      const spd = 3.2 * speedMultiplier(c.inst);
      c.vel.x = Math.sin(ang) * spd;
      c.vel.z = Math.cos(ang) * spd;
      c.faceYaw = Math.atan2(c.vel.x, c.vel.z);
      // 进入技能射程 → 攻击
      const move = pickMove(c);
      if (move && d <= move.range * 0.95) { c.state = 'attack'; c.stateT = 0; }
      break;
    }
    case 'attack': {
      c.vel.x = 0; c.vel.z = 0;
      c.faceYaw = Math.atan2(player.pos.x - c.pos.x, player.pos.z - c.pos.z);
      if (distP > DEAGGRO_RANGE * 0.7) { c.state = 'chase'; break; }
      if (c.stateT >= ATTACK_PAUSE) {
        const move = pickMove(c, true);
        if (move) {
          game.combat.creatureCastMove(c, move);
          c.stateT = 0;
        }
        if (distP > 4) { c.state = 'chase'; c.stateT = 0; }
      }
      break;
    }
    case 'flee': {
      const dx = c.pos.x - player.pos.x, dz = c.pos.z - player.pos.z;
      const ang = Math.atan2(dx, dz);
      const spd = 3.6 * speedMultiplier(c.inst);
      c.vel.x = Math.sin(ang) * spd;
      c.vel.z = Math.cos(ang) * spd;
      c.faceYaw = ang;
      if (c.stateT > 4) { c.state = 'wander'; c.stateT = 0; c.target = null; game.combat?.onDeaggro?.(c); }
      break;
    }
    case 'return': {
      if (!c.homePos) { c.state = 'wander'; break; }
      const dx = c.homePos.x - c.pos.x, dz = c.homePos.z - c.pos.z;
      if (Math.hypot(dx, dz) < 2) { c.state = 'wander'; c.stateT = 0; c.vel.x = 0; c.vel.z = 0; break; }
      const ang = Math.atan2(dx, dz);
      c.vel.x = Math.sin(ang) * 2.2; c.vel.z = Math.cos(ang) * 2.2;
      c.faceYaw = ang;
      break;
    }
  }
}

// 选一个可用技能；readyOnly=true 时只选冷却就绪的
function pickMove(c, readyOnly = false) {
  const now = c.game.time;
  const usable = c.inst.moves.filter(m => (c.cooldowns[m] || 0) <= now);
  if (!usable.length) return null;
  const id = usable[Math.floor(Math.random() * usable.length)];
  const move = c.game.getMove(id);
  if (readyOnly) {
    const d = c.distToPlayer();
    if (move.range < d) return null;
  }
  return move;
}
