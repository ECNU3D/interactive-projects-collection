// 伤害计算（设计文档 §8.2 官方简化公式）
import { typeMultiplier } from '../data/typeChart.js';

// damage = ((2×Lv/5 + 2) × power × atk/def / 50 + 2) × 克制 × STAB × random(0.85~1.0)
export function calcDamage(attacker, defender, move, rand = Math.random) {
  const atkTypes = attacker.types;
  const defTypes = defender.types;
  const stab = atkTypes.includes(move.type) ? 1.5 : 1;
  const mult = typeMultiplier(move.type, defTypes);
  let atk = attacker.atk, def = defender.def;
  // 烧伤：物理技能伤害 ×0.5（§9.1）
  if (move.category === 'physical' && attacker.status === 'burn') atk = Math.floor(atk * 0.5);
  const base = Math.floor(Math.floor((2 * attacker.level / 5 + 2) * move.power * atk / Math.max(1, def)) / 50) + 2;
  const dmg = Math.floor(base * mult * stab * (0.85 + rand() * 0.15));
  return { damage: Math.max(mult > 0 ? 1 : 0, dmg), mult, stab };
}

// 命中判定（accuracy 掷骰）
export function rollHit(move, rand = Math.random) {
  return rand() * 100 < move.accuracy;
}

// 效果绝佳提示阈值
export function effectivenessLabel(mult) {
  if (mult === 0) return '没有效果';
  if (mult >= 2) return '效果绝佳!';
  if (mult < 1) return '效果不佳';
  return '';
}
