// 进化系统（设计文档 §7.3 官方设定；通信交换进化本地化为 Lv40）
import { getSpecies } from '../data/species.js';
import { refreshStats } from './stats.js';

// 该实例当前可满足的进化（等级进化在升级时检查；石头在背包使用时检查）
export function availableEvolutions(inst) {
  const sp = getSpecies(inst.speciesKey);
  if (!sp.evolution) return [];
  return Array.isArray(sp.evolution) ? sp.evolution : [sp.evolution];
}

// 升级后是否触发等级进化
export function levelUpEvolution(inst) {
  if (inst.noEvolve) return null;
  for (const e of availableEvolutions(inst)) {
    if (e.method === 'level' && inst.level >= e.level) return e;
  }
  return null;
}

// 对实例使用进化石：匹配返回进化条目，不匹配返回 null
export function stoneEvolution(inst, itemId) {
  if (inst.noEvolve) return null;
  for (const e of availableEvolutions(inst)) {
    if (e.method === 'stone' && e.item === itemId) return e;
  }
  return null;
}

// 执行进化：换种族→属性重算（HP 百分比保留）→技能/经验/等级/IV 保留→补学新形态技能
// 返回 { from, to, newMoves }
export function applyEvolution(inst, toKey) {
  const fromKey = inst.speciesKey;
  const fromLevel = inst.level;
  inst.speciesKey = toKey;
  inst.speciesId = getSpecies(toKey).id;
  refreshStats(inst, { keepRatio: true });
  // 进化瞬间检查新形态 learnset 补学技能：不满 4 个直接学会，满了进待学习列表（UI 弹替换面板）
  const newSp = getSpecies(toKey);
  const autoLearned = [], pending = [];
  for (const l of newSp.learnset) {
    if (l.lv <= fromLevel && !inst.moves.includes(l.move)) {
      if (inst.moves.length < 4) { inst.moves.push(l.move); autoLearned.push(l.move); }
      else if (!pending.includes(l.move)) pending.push(l.move);
    }
  }
  return { from: fromKey, to: toKey, autoLearned, pendingMoves: pending };
}
