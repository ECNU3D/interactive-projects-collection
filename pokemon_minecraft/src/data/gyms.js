// 道馆数据（设计文档 §12）：道馆都位于村庄内，依次 1v1 车轮战
export const GYMS = {
  rock: {
    id:'rock', name:'岩系道馆', village:'grass', badge:'岩石徽章',
    leaderName:'岩刚', recLevel:'Lv12+',
    sign:'岩系道馆 · 馆主岩刚 · 推荐等级 Lv12',
    type:'rock',
    team: [
      { species:'geodude',  level:12 },
      { species:'geodude',  level:14 },
      { species:'onix',     level:16, ace:true },
    ],
    reward: { money:2000, items:[{id:'ultraball',count:5}], expShare:true },
  },
  fire: {
    id:'fire', name:'火系道馆', village:'volcano', badge:'火焰徽章',
    leaderName:'炎烈', recLevel:'Lv22+',
    sign:'火系道馆 · 馆主炎烈 · 推荐等级 Lv22',
    type:'fire',
    team: [
      { species:'growlithe', level:22 },
      { species:'magmar',    level:24 },
      { species:'arcanine',  level:26, ace:true },
    ],
    reward: { money:5000, items:[{id:'firestone',count:1}], expShare:true },
  },
};

// 馆主宝可梦固定技能组（文档 §12 阵容示例）
export const GYM_MOVESETS = {
  geodude:   ['rockthrow','tackle','mudbomb','takedown'],
  onix:      ['rockthrow','ironhead','bind','rockslide'],
  growlithe: ['ember','bite','quickattack','flamethrower'],
  magmar:    ['firespin','flamethrower','smog','fireblast'],
  arcanine:  ['flamethrower','crunch','extremespeed','fireblast'],
};
