// 属性克制表（本作 10 系，设计文档 §8.2：先做 9 系 + 超能；
// 官方归并：钢→岩、地→岩、妖精→普、虫→毒、飞行→普，见文档 9.3 注）
export const TYPES = ['normal','fire','water','grass','electric','rock','poison','ghost','ice','psychic'];

export const TYPE_NAMES = {
  normal:'普', fire:'火', water:'水', grass:'草', electric:'电',
  rock:'岩', poison:'毒', ghost:'幽灵', ice:'冰', psychic:'超',
};

// 攻击方 → 防守方倍率（未列出 = 1）
const CHART = {
  normal:   { rock:0.5, ghost:0 },
  fire:     { fire:0.5, water:0.5, grass:2, ice:2, rock:0.5 },
  water:    { fire:2, water:0.5, grass:0.5, rock:2 },
  grass:    { fire:0.5, grass:0.5, water:2, poison:0.5, rock:2 },
  electric: { water:2, electric:0.5, grass:0.5, rock:0 },   // 岩系在本作含地面系→电无效
  rock:     { fire:2, ice:2 },
  poison:   { grass:2, poison:0.5, rock:0.5, ghost:0.5 },
  ghost:    { normal:0, ghost:2, psychic:2 },
  ice:      { fire:0.5, water:0.5, grass:2, ice:0.5 },
  psychic:  { poison:2, psychic:0.5 },
};

// 计算攻击属性对防守方(可能双属性)的总倍率
export function typeMultiplier(atkType, defTypes) {
  const row = CHART[atkType] || {};
  let m = 1;
  for (const t of defTypes) m *= (row[t] ?? 1);
  return m;
}
