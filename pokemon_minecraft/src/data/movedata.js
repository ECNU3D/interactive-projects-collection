// 技能数据（设计文档 §8.2 / §9.3，威力/命中/附加概率为官方值）
// category: physical 物理 / special 特殊 / status 变化
// cooldown 秒（官方 1 回合 ≈ 本作 3s，小招 1.5s 大招 8s），castTime 前摇秒
// effect: { kind:'status'|'volatile'|'flinch', status, chance } — chance 为百分比
// anim: 粒子动画 key（fx/moveAnims.js），sfx: 合成音效 key（data/sfxPresets.js）
export const MOVES = {
  // ---- 普攻 ----
  tackle:      { name:'撞击',   type:'normal', category:'physical', power:40,  accuracy:100, cooldown:1.5, range:2.2, castTime:0.2, anim:'tackle',  sfx:'hit_normal' },
  scratch:     { name:'抓',     type:'normal', category:'physical', power:40,  accuracy:100, cooldown:1.5, range:2.2, castTime:0.2, anim:'slash',   sfx:'hit_normal' },
  pound:       { name:'拍击',   type:'normal', category:'physical', power:40,  accuracy:100, cooldown:1.5, range:2.2, castTime:0.2, anim:'tackle',  sfx:'hit_normal' },
  quickattack: { name:'电光一闪', type:'normal', category:'physical', power:40, accuracy:100, cooldown:2.0, range:8,   castTime:0.15, anim:'dash',  sfx:'hit_normal' },
  hyperfang:   { name:'愤怒门牙', type:'normal', category:'physical', power:80, accuracy:90,  cooldown:4.0, range:2.4, castTime:0.3, anim:'slash',  sfx:'hit_normal' },
  bite:        { name:'咬住',   type:'normal', category:'physical', power:60,  accuracy:100, cooldown:3.0, range:2.4, castTime:0.3, anim:'bite',    sfx:'hit_normal' },
  crunch:      { name:'咬碎',   type:'normal', category:'physical', power:80,  accuracy:100, cooldown:4.5, range:2.4, castTime:0.3, anim:'bite',    sfx:'hit_normal' },
  headbutt:    { name:'头锤',   type:'normal', category:'physical', power:70,  accuracy:100, cooldown:3.5, range:2.4, castTime:0.3, anim:'tackle',  sfx:'hit_normal' },
  bodyslam:    { name:'泰山压顶', type:'normal', category:'physical', power:85, accuracy:100, cooldown:5.0, range:2.6, castTime:0.4, anim:'tackle', sfx:'hit_super' },
  swift:       { name:'高速星星', type:'normal', category:'special',  power:60, accuracy:100, cooldown:3.5, range:10,  castTime:0.3, anim:'stars',  sfx:'hit_normal' },
  gust:        { name:'起风',   type:'normal', category:'special',  power:40,  accuracy:100, cooldown:2.0, range:9,   castTime:0.25, anim:'gust',   sfx:'grass' },
  wingattack:  { name:'翅膀攻击', type:'normal', category:'physical', power:60, accuracy:100, cooldown:3.0, range:3,   castTime:0.25, anim:'slash', sfx:'hit_normal' },
  peck:        { name:'啄',     type:'normal', category:'physical', power:35,  accuracy:100, cooldown:1.5, range:2.4, castTime:0.2, anim:'slash',   sfx:'hit_normal' },
  extremespeed:{ name:'神速',   type:'normal', category:'physical', power:80,  accuracy:100, cooldown:5.0, range:10,  castTime:0.1, anim:'dash',   sfx:'hit_super' },
  bind:        { name:'绑紧',   type:'normal', category:'physical', power:15,  accuracy:85,  cooldown:2.5, range:2.4, castTime:0.3, anim:'wrap',   sfx:'hit_normal' },
  wrap:        { name:'紧束',   type:'normal', category:'physical', power:15,  accuracy:90,  cooldown:2.5, range:2.4, castTime:0.3, anim:'wrap',   sfx:'hit_normal' },
  splash:      { name:'跃起',   type:'normal', category:'status',   power:0,   accuracy:100, cooldown:1.5, range:0,   castTime:0.2, anim:'none',   sfx:'ui_blip', noEffect:true },

  // ---- 火系 ----
  ember:       { name:'火花',     type:'fire', category:'special', power:40,  accuracy:100, cooldown:2.0, range:9,  castTime:0.3, effect:{kind:'status',status:'burn',chance:10}, anim:'fire',  sfx:'fire' },
  flamethrower:{ name:'火焰放射', type:'fire', category:'special', power:90,  accuracy:100, cooldown:5.0, range:10, castTime:0.4, effect:{kind:'status',status:'burn',chance:10}, anim:'fire',  sfx:'fire' },
  fireblast:   { name:'大字爆炎', type:'fire', category:'special', power:110, accuracy:85,  cooldown:8.0, range:11, castTime:0.5, effect:{kind:'status',status:'burn',chance:10}, anim:'fireburst', sfx:'fire' },
  firespin:    { name:'火焰旋涡', type:'fire', category:'special', power:35,  accuracy:85,  cooldown:3.0, range:8,  castTime:0.3, effect:{kind:'status',status:'burn',chance:10}, anim:'fire', sfx:'fire' },
  firefang:    { name:'火焰牙',   type:'fire', category:'physical', power:65, accuracy:95,  cooldown:3.5, range:2.4,castTime:0.3, effect:{kind:'status',status:'burn',chance:10}, anim:'bite', sfx:'fire' },
  willowisp:   { name:'鬼火',     type:'fire', category:'status',  power:0,   accuracy:85,  cooldown:5.0, range:9,  castTime:0.4, effect:{kind:'status',status:'burn',chance:100}, anim:'willowisp', sfx:'status_burn' },

  // ---- 水系 ----
  watergun:    { name:'水枪',   type:'water', category:'special', power:40,  accuracy:100, cooldown:2.0, range:9,  castTime:0.3, anim:'water', sfx:'water' },
  bubble:      { name:'泡沫',   type:'water', category:'special', power:40,  accuracy:100, cooldown:2.0, range:9,  castTime:0.3, anim:'water', sfx:'water' },
  hydropump:   { name:'水炮',   type:'water', category:'special', power:110, accuracy:80,  cooldown:8.0, range:11, castTime:0.5, anim:'waterburst', sfx:'water' },
  surf:        { name:'冲浪',   type:'water', category:'special', power:90,  accuracy:100, cooldown:6.0, range:10, castTime:0.4, anim:'waterburst', sfx:'water' },
  waterfall:   { name:'攀瀑',   type:'water', category:'physical', power:80, accuracy:100, cooldown:5.0, range:3,  castTime:0.35, anim:'water', sfx:'water' },
  clamp:       { name:'贝壳夹', type:'water', category:'physical', power:35, accuracy:85,  cooldown:2.5, range:2.4,castTime:0.3, anim:'bite', sfx:'water' },
  aurorabeam:  { name:'极光束', type:'ice',  category:'special', power:65,  accuracy:100, cooldown:3.5, range:10, castTime:0.3, anim:'ice', sfx:'ice' },

  // ---- 草系 ----
  vinewhip:    { name:'藤鞭',     type:'grass', category:'physical', power:45, accuracy:100, cooldown:2.0, range:4,  castTime:0.25, anim:'vine',  sfx:'grass' },
  razorleaf:   { name:'飞叶快刀', type:'grass', category:'physical', power:55, accuracy:95,  cooldown:3.0, range:9,  castTime:0.3, anim:'leaves',sfx:'grass' },
  absorb:      { name:'吸取',     type:'grass', category:'special',  power:20, accuracy:100, cooldown:2.0, range:8,  castTime:0.3, anim:'leaves',sfx:'grass', drain:0.5 },
  megadrain:   { name:'超级吸取', type:'grass', category:'special',  power:40, accuracy:100, cooldown:3.5, range:8,  castTime:0.3, anim:'leaves',sfx:'grass', drain:0.5 },
  petaldance:  { name:'花瓣舞',   type:'grass', category:'special',  power:120,accuracy:100, cooldown:8.0, range:8,  castTime:0.5, anim:'leaves',sfx:'grass' },
  sleeppowder: { name:'睡眠粉',   type:'grass', category:'status',   power:0, accuracy:75,  cooldown:6.0, range:8,  castTime:0.4, effect:{kind:'status',status:'sleep',chance:100}, anim:'powder', sfx:'status_sleep', powder:true },
  stunspore:   { name:'麻痹粉',   type:'grass', category:'status',   power:0, accuracy:75,  cooldown:6.0, range:8,  castTime:0.4, effect:{kind:'status',status:'paralysis',chance:100}, anim:'powder', sfx:'status_para', powder:true },
  poisonpowder:{ name:'毒粉',     type:'grass', category:'status',   power:0, accuracy:75,  cooldown:6.0, range:8,  castTime:0.4, effect:{kind:'status',status:'poison',chance:100}, anim:'powder', sfx:'status_poison', powder:true },
  spore:       { name:'蘑菇孢子', type:'grass', category:'status',   power:0, accuracy:100, cooldown:6.0, range:8,  castTime:0.4, effect:{kind:'status',status:'sleep',chance:100}, anim:'powder', sfx:'status_sleep', powder:true },

  // ---- 电系 ----
  thundershock: { name:'电击',     type:'electric', category:'special', power:40,  accuracy:100, cooldown:2.0, range:9,  castTime:0.25, effect:{kind:'status',status:'paralysis',chance:10}, anim:'electric', sfx:'electric' },
  thunderbolt:  { name:'十万伏特', type:'electric', category:'special', power:90,  accuracy:100, cooldown:5.0, range:10, castTime:0.4,  effect:{kind:'status',status:'paralysis',chance:10}, anim:'electric', sfx:'electric' },
  thunder:      { name:'打雷',     type:'electric', category:'special', power:110, accuracy:70,  cooldown:8.0, range:12, castTime:0.5,  effect:{kind:'status',status:'paralysis',chance:30}, anim:'thunder', sfx:'electric' },
  thunderwave:  { name:'电磁波',   type:'electric', category:'status',  power:0,   accuracy:90,  cooldown:5.0, range:9,  castTime:0.3,  effect:{kind:'status',status:'paralysis',chance:100}, anim:'thunderwave', sfx:'status_para' },
  thunderfang:  { name:'雷电牙',   type:'electric', category:'physical', power:65, accuracy:95,  cooldown:3.5, range:2.4,castTime:0.3,  effect:{kind:'status',status:'paralysis',chance:10}, anim:'bite', sfx:'electric' },

  // ---- 岩系（含官方地/钢归并） ----
  rockthrow: { name:'落石',   type:'rock', category:'physical', power:50, accuracy:90,  cooldown:2.5, range:9,  castTime:0.3, anim:'rock', sfx:'rock' },
  rockslide: { name:'岩崩',   type:'rock', category:'physical', power:75, accuracy:90,  cooldown:5.0, range:9,  castTime:0.4, effect:{kind:'flinch',chance:30}, anim:'rockburst', sfx:'rock' },
  ironhead:  { name:'铁头',   type:'rock', category:'physical', power:80, accuracy:100, cooldown:4.5, range:2.6,castTime:0.35, effect:{kind:'flinch',chance:30}, anim:'tackle', sfx:'rock' },
  mudbomb:   { name:'泥巴炸弹', type:'rock', category:'special', power:65, accuracy:85, cooldown:3.5, range:9,  castTime:0.3, anim:'mud', sfx:'rock' },
  dig:       { name:'挖洞',   type:'rock', category:'physical', power:80, accuracy:100, cooldown:5.0, range:3,  castTime:0.4, anim:'mud', sfx:'rock' },
  takedown:  { name:'猛撞',   type:'normal', category:'physical', power:90, accuracy:85, cooldown:6.0, range:2.6,castTime:0.4, anim:'tackle', sfx:'hit_super' },

  // ---- 毒系 ----
  poisonsting: { name:'毒针',     type:'poison', category:'physical', power:15, accuracy:100, cooldown:1.5, range:8,  castTime:0.2, effect:{kind:'status',status:'poison',chance:30}, anim:'poison', sfx:'poison' },
  sludgebomb:  { name:'污泥炸弹', type:'poison', category:'special',  power:90, accuracy:100, cooldown:5.0, range:10, castTime:0.4, effect:{kind:'status',status:'poison',chance:30}, anim:'poisonburst', sfx:'poison' },
  smog:        { name:'浊雾',     type:'poison', category:'special',  power:30, accuracy:70,  cooldown:2.5, range:8,  castTime:0.3, effect:{kind:'status',status:'poison',chance:40}, anim:'poison', sfx:'poison' },
  acid:        { name:'溶解液',   type:'poison', category:'special',  power:40, accuracy:100, cooldown:2.5, range:9,  castTime:0.3, anim:'poison', sfx:'poison' },
  toxic:       { name:'剧毒',     type:'poison', category:'status',   power:0, accuracy:90,  cooldown:6.0, range:9,  castTime:0.4, effect:{kind:'status',status:'badpoison',chance:100}, anim:'toxic', sfx:'status_poison', sureHitByType:'poison' },

  // ---- 幽灵系 ----
  lick:        { name:'舌舔',     type:'ghost', category:'physical', power:30, accuracy:100, cooldown:2.0, range:2.4,castTime:0.3, effect:{kind:'status',status:'paralysis',chance:30}, anim:'ghost', sfx:'ghost' },
  shadowball:  { name:'暗影球',   type:'ghost', category:'special',  power:80, accuracy:100, cooldown:4.5, range:10, castTime:0.4, anim:'ghostburst', sfx:'ghost' },
  nightshade:  { name:'黑夜诅咒', type:'ghost', category:'special',  power:50, accuracy:100, cooldown:3.5, range:9,  castTime:0.35, anim:'ghost', sfx:'ghost' },
  confuseray:  { name:'奇异之光', type:'ghost', category:'status',   power:0, accuracy:100, cooldown:5.0, range:9,  castTime:0.4, effect:{kind:'volatile',status:'confusion',chance:100}, anim:'confuse', sfx:'status_confuse' },
  hypnosis:    { name:'催眠术',   type:'psychic', category:'status', power:0, accuracy:60,  cooldown:6.0, range:9,  castTime:0.5, effect:{kind:'status',status:'sleep',chance:100}, anim:'hypnosis', sfx:'status_sleep' },
  dreameater:  { name:'食梦',     type:'psychic', category:'special', power:100, accuracy:100, cooldown:6.0, range:9, castTime:0.5, anim:'psychic', sfx:'psychic', drain:0.5, needsSleep:true },

  // ---- 超能系 ----
  confusion:   { name:'念力',     type:'psychic', category:'special', power:50, accuracy:100, cooldown:2.5, range:9,  castTime:0.3, effect:{kind:'volatile',status:'confusion',chance:10}, anim:'psychic', sfx:'psychic' },
  psybeam:     { name:'幻象光线', type:'psychic', category:'special', power:65, accuracy:100, cooldown:3.5, range:10, castTime:0.35, effect:{kind:'volatile',status:'confusion',chance:10}, anim:'psychic', sfx:'psychic' },
  psychic:     { name:'精神强念', type:'psychic', category:'special', power:90, accuracy:100, cooldown:5.0, range:10, castTime:0.45, effect:{kind:'volatile',status:'confusion',chance:10}, anim:'psychicburst', sfx:'psychic' },

  // ---- 冰系 ----
  powdersnow:  { name:'细雪',     type:'ice', category:'special', power:40,  accuracy:100, cooldown:2.0, range:9,  castTime:0.3, effect:{kind:'status',status:'freeze',chance:10}, anim:'ice', sfx:'ice' },
  icebeam:     { name:'冰冻光束', type:'ice', category:'special', power:90,  accuracy:100, cooldown:5.0, range:10, castTime:0.4, effect:{kind:'status',status:'freeze',chance:10}, anim:'ice', sfx:'ice' },
  blizzard:    { name:'暴风雪',   type:'ice', category:'special', power:110, accuracy:70,  cooldown:8.0, range:11, castTime:0.5, effect:{kind:'status',status:'freeze',chance:10}, anim:'iceburst', sfx:'ice' },
  icefang:     { name:'冰冻牙',   type:'ice', category:'physical', power:65, accuracy:95,  cooldown:3.5, range:2.4,castTime:0.3, effect:{kind:'status',status:'freeze',chance:10}, anim:'bite', sfx:'ice' },
  icywind:     { name:'冰冻之风', type:'ice', category:'special', power:55, accuracy:95,  cooldown:3.0, range:9,  castTime:0.3, anim:'ice', sfx:'ice' },

  // ---- 妖精/其他归普 ----
  sweetkiss:   { name:'甜吻', type:'normal', category:'status', power:0, accuracy:75, cooldown:5.0, range:8, castTime:0.4, effect:{kind:'volatile',status:'confusion',chance:100}, anim:'confuse', sfx:'status_confuse' },
  sing:        { name:'唱歌', type:'normal', category:'status', power:0, accuracy:55, cooldown:6.0, range:8, castTime:0.5, effect:{kind:'status',status:'sleep',chance:100}, anim:'hypnosis', sfx:'status_sleep' },
};

export function getMove(id) {
  const m = MOVES[id];
  if (!m) throw new Error('未知技能: ' + id);
  return m;
}
// 回填 id 字段（战斗中识别特定技能用）
for (const [id, m] of Object.entries(MOVES)) m.id = id;
