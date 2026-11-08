// 属性/经验计算（设计文档 §7.2 官方公式）
import { getSpecies } from '../data/species.js';

// HP = floor((种族值 + IV) × 2 × Lv / 100) + Lv + 10
// 其他 = floor((种族值 + IV) × 2 × Lv / 100) + 5
export function calcStats(species, level, ivs) {
  const b = species.baseStats;
  return {
    maxHp: Math.floor((b.hp + ivs.hp) * 2 * level / 100) + level + 10,
    atk:   Math.floor((b.atk + ivs.atk) * 2 * level / 100) + 5,
    def:   Math.floor((b.def + ivs.def) * 2 * level / 100) + 5,
    spd:   Math.floor((b.spd + ivs.spd) * 2 * level / 100) + 5,
  };
}

// 官方经验组（升到 Lv 所需总经验）
export function expForLevel(growthRate, level) {
  if (level <= 1) return 0;
  const c = level ** 3;
  if (growthRate === 'fast') return Math.floor(0.8 * c);
  if (growthRate === 'slow') return Math.floor(1.25 * c);
  return c;
}

export function levelFromExp(growthRate, exp) {
  let lv = 1;
  while (lv < 100 && expForLevel(growthRate, lv + 1) <= exp) lv++;
  return lv;
}

export function randomIVs(rand = Math.random) {
  const r = () => Math.floor(rand() * 16);
  return { hp: r(), atk: r(), def: r(), spd: r() };
}

// 创建精灵实例（§7.1 数据结构）
export function createInstance(speciesKey, level, opts = {}) {
  const sp = getSpecies(speciesKey);
  const ivs = opts.ivs || randomIVs(opts.rand);
  const stats = calcStats(sp, level, ivs);
  const moves = opts.moves || defaultMoves(sp, level);
  return {
    speciesId: sp.id,
    speciesKey: sp.key,
    nickname: null,
    level,
    exp: expForLevel(sp.growthRate, level),
    ivs,
    curHp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    status: null,      // poison|badpoison|paralysis|burn|freeze|sleep|null
    statusData: null,  // 运行时计数（剧毒递增/睡眠剩余秒数等）
    volatile: [],      // ['confusion']
    moves: moves.slice(0, 4),
    noEvolve: false,
  };
}

// 按当前等级取 learnset 中最新的最多 4 个技能
export function defaultMoves(species, level) {
  const learned = species.learnset.filter(l => l.lv <= level).map(l => l.move);
  return [...new Set(learned)].slice(-4);
}

// 重算属性（升级/进化后），保留当前 HP 百分比（进化）或按差值加血（升级）
export function refreshStats(inst, { keepRatio = false } = {}) {
  const sp = getSpecies(inst.speciesKey);
  const oldMax = inst.maxHp;
  const ratio = keepRatio && oldMax > 0 ? inst.curHp / oldMax : null;
  const stats = calcStats(sp, inst.level, inst.ivs);
  inst.maxHp = stats.maxHp;
  if (ratio !== null) inst.curHp = Math.max(1, Math.round(inst.maxHp * ratio));
  else if (inst.curHp > 0) inst.curHp = Math.min(inst.maxHp, inst.curHp + (inst.maxHp - oldMax));
  inst.atk = stats.atk; inst.def = stats.def; inst.spd = stats.spd;
  return inst;
}

// 击败奖励经验 = expYield × 敌方等级 / 7
export function expReward(defeatedSpecies, defeatedLevel) {
  return Math.max(1, Math.floor(defeatedSpecies.expYield * defeatedLevel / 7));
}

// 金币掉落 ≈ 敌方等级 × 3
export function moneyReward(level) {
  return Math.floor(level * 3 * (0.8 + Math.random() * 0.4));
}
