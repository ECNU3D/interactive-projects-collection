// 捕获系统（设计文档 §10）：概率公式 + 摇晃判定
import { getSpecies } from '../data/species.js';
import { statusCatchBonus } from './status.js';

// p = catchRate/255 × (1 - 0.7×curHp/maxHp) × ballBonus × statusBonus
export function captureChance(inst, ballBonus) {
  const sp = getSpecies(inst.speciesKey);
  const hpFactor = 1 - 0.7 * (inst.curHp / inst.maxHp);
  return Math.min(1, (sp.catchRate / 255) * hpFactor * ballBonus * statusCatchBonus(inst));
}

// 摇晃 0~3 次：每次独立判定，3 次全过则捕获成功
// 返回 { success, shakes }（shakes = 实际摇晃次数）
export function attemptCapture(inst, ballBonus, rand = Math.random) {
  if (ballBonus >= 255) return { success: true, shakes: 3 };   // 大师球必中
  const p = captureChance(inst, ballBonus);
  let shakes = 0;
  for (let i = 0; i < 3; i++) {
    if (rand() < Math.max(0.05, p)) shakes++;
    else return { success: false, shakes };
  }
  return { success: true, shakes };
}
