// 异常状态数据（设计文档 §9，Gen7+ 官方数值；官方 1 回合 ≈ 本作 3 秒 tick）
export const STATUS = {
  paralysis: {
    name:'麻痹', icon:'⚡', color:'#F8D030',
    speedMult:0.5,          // 移速 ×0.5
    failChance:0.25,        // 每次施放技能 25% 概率失败（硬直 0.5s）
    immuneTypes:['electric'], cureItems:['paralyzheal','fullheal'],
  },
  burn: {
    name:'烧伤', icon:'🔥', color:'#F08030',
    tickInterval:3, tickFraction:1/16,   // 每 3s 扣 1/16 最大 HP
    physicalMult:0.5,       // 物理技能伤害 ×0.5
    immuneTypes:['fire'], cureItems:['burnheal','fullheal'],
  },
  freeze: {
    name:'冰冻', icon:'❄', color:'#98D8D8',
    thawInterval:3, thawChance:0.2,      // 每 3s 掷 20% 解冻
    thawByType:'fire',                   // 被火系技能击中立即解冻
    reFreezeImmune:3,                    // 解冻后 3s 免疫再冻结
    immuneTypes:['ice'], cureItems:['iceheal','fullheal'],
  },
  poison: {
    name:'中毒', icon:'☠', color:'#A040A0',
    tickInterval:3, tickFraction:1/16,   // 官方 1/8 减半校准实时节奏
    nonLethal:true,                      // 野外不致死，扣到 1 HP 停止
    immuneTypes:['poison'], cureItems:['antidote','fullheal'],
  },
  badpoison: {
    name:'剧毒', icon:'☠', color:'#7A1F7A',
    tickInterval:3, tickStart:1/16, tickStep:1/16, tickMax:4/16,  // 递增 1/16→上限 4/16
    nonLethal:true,
    immuneTypes:['poison'], cureItems:['antidote','fullheal'],
  },
  sleep: {
    name:'睡眠', icon:'💤', color:'#A8A878',
    minDuration:4, maxDuration:8,        // 4~8s 无法行动
    wakeOnHit:true,                      // 实时制调整：受击提前唤醒（官方不唤醒）
    immuneTypes:[], cureItems:['awakening','fullheal'],
  },
};

// 挥发性状态（可与主异常叠加）
export const VOLATILE = {
  confusion: {
    name:'混乱', minDuration:5, maxDuration:10,
    selfHitChance:0.33,     // 每次施放技能 33% 概率改为自伤
    selfHitPower:40,        // 官方 40 威力无属性物理伤害
  },
  flinch: { name:'畏缩', duration:0.8 },  // 0.8s 硬直并打断施法
};

// 状态自伤公式（官方混乱自伤，无视属性克制）
export function confusionSelfDamage(level, atk, def) {
  const base = Math.floor(Math.floor((2*level/5 + 2) * VOLATILE.confusion.selfHitPower * atk / Math.max(1,def)) / 50) + 2;
  return Math.max(1, Math.floor(base * (0.85 + Math.random()*0.15)));
}
