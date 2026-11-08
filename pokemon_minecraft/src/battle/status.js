// 异常状态运行时逻辑（设计文档 §9，Gen7+ 官方数值，1 回合 ≈ 3 秒 tick）
import { STATUS, VOLATILE } from '../data/statusData.js';
import { getSpecies } from '../data/species.js';

// 尝试施加主异常：免疫/已有主异常返回 false；返回 true 表示施加成功
export function applyStatus(inst, status) {
  if (!STATUS[status]) return false;
  if (inst.status) return false;                       // 主异常唯一
  const types = getSpecies(inst.speciesKey).types;
  if (STATUS[status].immuneTypes?.some(t => types.includes(t))) return false;
  inst.status = status;
  inst.statusData = {};
  if (status === 'sleep') {
    const d = STATUS.sleep;
    inst.statusData.remain = d.minDuration + Math.random() * (d.maxDuration - d.minDuration);
  }
  if (status === 'badpoison') inst.statusData.stack = 1;
  if (status === 'freeze') inst.statusData.immune = 0;
  return true;
}

export function applyVolatile(inst, vol) {
  if (!VOLATILE[vol] || inst.volatile.includes(vol)) return false;
  inst.volatile.push(vol);
  if (vol === 'confusion') {
    const d = VOLATILE.confusion;
    inst.volatileData = inst.volatileData || {};
    inst.volatileData.confusionRemain = d.minDuration + Math.random() * (d.maxDuration - d.minDuration);
  }
  return true;
}

export function cureStatus(inst) { inst.status = null; inst.statusData = null; }
export function cureVolatile(inst, vol) {
  inst.volatile = inst.volatile.filter(v => v !== vol);
}

// 每帧 tick：返回事件数组 [{type:'dot',amount},{type:'thawed'},{type:'woke'},{type:'confusionEnd'},...]
// dt 秒；世界内精灵才 tick（战斗中/激活状态由调用方控制）
export function tickStatus(inst, dt, inBattle = true) {
  const events = [];
  if (!inst.status && inst.volatile.length === 0) return events;
  const sd = inst.statusData = inst.statusData || {};
  sd.t = (sd.t || 0) + dt;

  switch (inst.status) {
    case 'burn': case 'poison': {
      const d = STATUS[inst.status];
      while (sd.t >= d.tickInterval) {
        sd.t -= d.tickInterval;
        const dmg = Math.max(1, Math.floor(inst.maxHp * d.tickFraction));
        const before = inst.curHp;
        inst.curHp = d.nonLethal ? Math.max(1, inst.curHp - dmg) : Math.max(0, inst.curHp - dmg);
        events.push({ type: 'dot', status: inst.status, amount: before - inst.curHp });
      }
      break;
    }
    case 'badpoison': {
      const d = STATUS.badpoison;
      while (sd.t >= d.tickInterval) {
        sd.t -= d.tickInterval;
        const frac = Math.min(d.tickMax, sd.stack * d.tickStep);
        const dmg = Math.max(1, Math.floor(inst.maxHp * frac));
        const before = inst.curHp;
        inst.curHp = Math.max(1, inst.curHp - dmg);
        sd.stack = Math.min(4, (sd.stack || 1) + 1);
        events.push({ type: 'dot', status: 'badpoison', amount: before - inst.curHp });
      }
      break;
    }
    case 'freeze': {
      sd.immune = Math.max(0, (sd.immune || 0) - dt);
      const d = STATUS.freeze;
      while (sd.t >= d.thawInterval) {
        sd.t -= d.thawInterval;
        if (Math.random() < d.thawChance) {
          cureStatus(inst);
          sd.immune = d.reFreezeImmune;
          inst.statusData = { immune: d.reFreezeImmune, t: 0 };
          events.push({ type: 'thawed' });
          break;
        }
      }
      break;
    }
    case 'sleep': {
      sd.remain = (sd.remain ?? 6) - dt;
      if (sd.remain <= 0) { cureStatus(inst); events.push({ type: 'woke' }); }
      break;
    }
  }

  // 挥发性：混乱倒计时
  if (inst.volatile.includes('confusion')) {
    const vd = inst.volatileData = inst.volatileData || {};
    vd.confusionRemain = (vd.confusionRemain ?? 7) - dt;
    if (vd.confusionRemain <= 0) { cureVolatile(inst, 'confusion'); events.push({ type: 'confusionEnd' }); }
  }
  return events;
}

// 能否行动（冰冻/睡眠不可行动；麻痹 25% 失败单独掷）
export function canAct(inst) {
  if (inst.status === 'freeze' || inst.status === 'sleep') return false;
  return true;
}

// 受击处理：火系技能解冻、受击唤醒（实时制调整）
export function onHitBy(inst, moveType) {
  const events = [];
  if (inst.status === 'freeze' && moveType === STATUS.freeze.thawByType) {
    cureStatus(inst);
    inst.statusData = { immune: STATUS.freeze.reFreezeImmune, t: 0 };
    events.push({ type: 'thawed' });
  }
  if (inst.status === 'sleep' && STATUS.sleep.wakeOnHit) {
    cureStatus(inst);
    events.push({ type: 'woke' });
  }
  return events;
}

// 移速倍率（麻痹 ×0.5）
export function speedMultiplier(inst) {
  return inst.status === 'paralysis' ? STATUS.paralysis.speedMult : 1;
}

// 捕获状态倍率（官方：睡眠·冰冻 2.0 / 麻痹·中毒·烧伤 1.5）
export function statusCatchBonus(inst) {
  if (inst.status === 'sleep' || inst.status === 'freeze') return 2.0;
  if (inst.status === 'paralysis' || inst.status === 'poison' || inst.status === 'badpoison' || inst.status === 'burn') return 1.5;
  return 1.0;
}
