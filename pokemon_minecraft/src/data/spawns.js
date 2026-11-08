// 群系与野生精灵刷新表（设计文档 §4.1）
export const BIOMES = {
  grass:   { name:'中央草原', level:[2,8] },
  forest:  { name:'森林',     level:[5,14] },
  lake:    { name:'湖泊水域', level:[8,18] },
  volcano: { name:'火山岩地', level:[14,24] },
  snow:    { name:'雪山',     level:[18,30] },
};

// 每个群系的野生精灵（weight 相对权重，nightOnly 夜间出没）
export const SPAWN_TABLES = {
  grass: [
    { species:'pikachu',   weight:18 },
    { species:'rattata',   weight:25 },
    { species:'pidgey',    weight:25 },
    { species:'bulbasaur', weight:12 },
    { species:'clefairy',  weight:10, nightOnly:true },
  ],
  forest: [
    { species:'caterpie',  weight:22 },
    { species:'weedle',    weight:22 },
    { species:'oddish',    weight:24 },
    { species:'eevee',     weight:8 },
    { species:'metapod',   weight:12 },
    { species:'kakuna',    weight:12 },
  ],
  lake: [
    { species:'squirtle',  weight:16 },
    { species:'magikarp',  weight:30, waterOnly:true },
    { species:'psyduck',   weight:22 },
    { species:'tentacool', weight:24, waterOnly:true },
  ],
  volcano: [
    { species:'charmander', weight:16 },
    { species:'growlithe',  weight:22 },
    { species:'geodude',    weight:28 },
    { species:'magmar',     weight:14 },
  ],
  snow: [
    { species:'vulpix_a',  weight:30 },
    { species:'seel',      weight:28 },
    { species:'snorlax',   weight:6 },
  ],
  night: [   // 夜间全图追加
    { species:'gastly', weight:20 },
  ],
};

// 高等级区域（无徽章进入会遭遇压制等级的野怪，§12 软性解锁）
export function biomeLevel(biome, badges) {
  const [lo, hi] = BIOMES[biome].level;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
