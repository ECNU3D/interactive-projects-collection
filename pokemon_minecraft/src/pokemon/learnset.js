// 学技能/升级（设计文档 §7.2）：升级触发 learnset；已满 4 个需替换（可放弃）
import { getSpecies } from '../data/species.js';
import { expForLevel, refreshStats } from './stats.js';

// 返回获得经验后的升级事件 { levelsGained, movesToLearn: [{move, atLevel}] }
export function gainExp(inst, amount) {
  const sp = getSpecies(inst.speciesKey);
  const before = inst.level;
  inst.exp = Math.min(inst.exp + amount, expForLevel(sp.growthRate, 100));
  let lv = before;
  while (lv < 100 && inst.exp >= expForLevel(sp.growthRate, lv + 1)) lv++;
  const result = { levelsGained: lv - before, fromLevel: before, toLevel: lv, movesToLearn: [] };
  if (lv > before) {
    inst.level = lv;
    refreshStats(inst);
    for (const l of sp.learnset) {
      if (l.lv > before && l.lv <= lv && !inst.moves.includes(l.move)) {
        result.movesToLearn.push({ move: l.move, atLevel: l.lv });
      }
    }
  }
  return result;
}

// 尝试直接学会技能；未满 4 个直接学会返回 true，已满返回 false（交给替换面板）
export function tryLearn(inst, moveId) {
  if (inst.moves.includes(moveId)) return true;
  if (inst.moves.length < 4) { inst.moves.push(moveId); return true; }
  return false;
}

// 替换学习：replaceIndex 0~3 替换；传 -1 表示放弃学习
export function learnReplace(inst, moveId, replaceIndex) {
  if (inst.moves.includes(moveId)) return;
  if (replaceIndex >= 0 && replaceIndex < 4 && inst.moves.length === 4) {
    inst.moves[replaceIndex] = moveId;
  } else if (inst.moves.length < 4) {
    inst.moves.push(moveId);
  }
}
