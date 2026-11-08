// Node 逻辑测试：纯逻辑模块（不依赖 THREE/DOM）
// 运行: node tests/run-tests.mjs
import { SPECIES, getSpecies } from '../src/data/species.js';
import { MOVES, getMove } from '../src/data/movedata.js';
import { TYPES, typeMultiplier } from '../src/data/typeChart.js';
import { ITEMS } from '../src/data/items.js';
import { SHOP_STAPLE, SHOP_RARE_POOL, dailyRareItems, sellPrice } from '../src/data/shopData.js';
import { GYMS, GYM_MOVESETS } from '../src/data/gyms.js';
import { DIALOGUES, VILLAGER_CHATTER, VOICE_PROFILES } from '../src/data/dialogues.js';
import { SFX_PRESETS, cryParams } from '../src/data/sfxPresets.js';
import { SPAWN_TABLES, BIOMES } from '../src/data/spawns.js';
import { STATUS, VOLATILE } from '../src/data/statusData.js';
import { calcStats, expForLevel, levelFromExp, createInstance, expReward, refreshStats } from '../src/pokemon/stats.js';
import { gainExp, tryLearn, learnReplace } from '../src/pokemon/learnset.js';
import { levelUpEvolution, stoneEvolution, applyEvolution } from '../src/pokemon/evolution.js';
import { Party, PARTY_MAX } from '../src/pokemon/party.js';
import { calcDamage, rollHit } from '../src/battle/damage.js';
import { applyStatus, tickStatus, canAct, onHitBy, statusCatchBonus, applyVolatile } from '../src/battle/status.js';
import { captureChance, attemptCapture } from '../src/battle/capture.js';
import { generateTerrain, VILLAGES, WORLD_SIZE, WATER_LEVEL, idx, BIOME_ID, biomeAt } from '../src/world/terrain.js';
import { buildVillages } from '../src/world/village.js';
import { decorate } from '../src/world/decorations.js';
import { MODELS } from '../src/voxel/models/index.js';
import { serialize, deserialize } from '../src/save/storage.js';

let passed = 0, failed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { passed++; }
  else { failed++; failures.push(name); console.error('  ✗ ' + name); }
}
function section(name) { console.log('\n■ ' + name); }

// ============ 1. 图鉴数据完整性 ============
section('图鉴数据');
{
  ok(Object.keys(SPECIES).length === 52, `物种数 52 (实际 ${Object.keys(SPECIES).length})`);
  for (const [key, sp] of Object.entries(SPECIES)) {
    ok(sp.key === key && sp.name && sp.id > 0, `${key} 基本字段`);
    ok(sp.types.every(t => TYPES.includes(t)), `${key} 属性合法`);
    ok(sp.baseStats.hp > 0 && sp.baseStats.atk > 0 && sp.baseStats.def > 0 && sp.baseStats.spd > 0, `${key} 种族值`);
    ok(sp.catchRate >= 25 && sp.catchRate <= 255, `${key} 捕获率范围`);
    ok(['fast', 'medium', 'slow'].includes(sp.growthRate), `${key} 经验组`);
    ok(sp.learnset.length >= 4, `${key} learnset ≥4`);
    ok(sp.learnset.every((l, i, a) => MOVES[l.move] && (i === 0 || a[i - 1].lv <= l.lv)), `${key} learnset 技能存在且等级升序`);
    ok(sp.learnset.some(l => l.lv === 1 && MOVES[l.move].power > 0), `${key} Lv1 有攻击技能`);
    ok(sp.learnset.filter(l => MOVES[l.move].power > 0).length >= 2, `${key} ≥2 攻击技能`);
    ok(MODELS[key], `${key} 有模型`);
    ok(SPECIES[sp.chain], `${key} chain 存在`);
    const evos = sp.evolution ? (Array.isArray(sp.evolution) ? sp.evolution : [sp.evolution]) : [];
    for (const e of evos) {
      ok(SPECIES[e.to], `${key} 进化目标 ${e.to} 存在`);
      if (e.method === 'stone') ok(ITEMS[e.item]?.kind === 'stone', `${key} 进化石 ${e.item} 存在`);
      if (e.method === 'level') ok(e.level >= 2 && e.level <= 100, `${key} 进化等级合法`);
    }
  }
  // 模型全部可构建且体素数>20
  for (const [key, build] of Object.entries(MODELS)) {
    const v = build();
    ok(v.list().length > 20, `模型 ${key} 体素数 ${v.list().length} > 20`);
    // 底部从 y>=0 起、无负坐标悬空（允许装饰负 x/z）
    ok(v.list().every(b => b.y >= 0), `模型 ${key} 无地下体素`);
  }
}

// ============ 2. 技能/道具/商店/道馆/对话数据 ============
section('技能与道具数据');
{
  for (const [id, m] of Object.entries(MOVES)) {
    ok(TYPES.includes(m.type), `技能 ${id} 属性合法`);
    ok(['physical', 'special', 'status'].includes(m.category), `技能 ${id} 类别`);
    ok(m.accuracy > 0 && m.accuracy <= 100, `技能 ${id} 命中`);
    ok(SFX_PRESETS[m.sfx], `技能 ${id} 音效配方 ${m.sfx} 存在`);
    if (m.effect) ok(STATUS[m.effect.status] || VOLATILE[m.effect.status] || m.effect.kind === 'flinch', `技能 ${id} 效果状态存在`);
  }
  for (const id of [...SHOP_STAPLE, ...SHOP_RARE_POOL]) ok(ITEMS[id], `商品 ${id} 存在`);
  ok(sellPrice('potion') === 150, '半价卖出');
  for (let s = 0; s < 20; s++) {
    const items = dailyRareItems(s, Math.random);
    ok(items.length >= 2 && items.length <= 4, '每日稀有 2~4 种（含大师球概率）');
  }
  for (const gym of Object.values(GYMS)) {
    for (const m of gym.team) ok(SPECIES[m.species], `道馆成员 ${m.species} 存在`);
    for (const mv of Object.values(GYM_MOVESETS)) for (const id of mv) ok(MOVES[id], `道馆技能 ${id} 存在`);
  }
  for (const [id, d] of Object.entries(DIALOGUES)) ok(VOICE_PROFILES[d.voice], `台词 ${id} 音色存在`);
  for (const [p, arr] of Object.entries(VILLAGER_CHATTER)) ok(VOICE_PROFILES[p] && arr.length >= 3, `村民语料 ${p}`);
  // 刷新表
  for (const [biome, table] of Object.entries(SPAWN_TABLES)) {
    for (const e of table) ok(SPECIES[e.species], `刷新表 ${biome}:${e.species} 存在`);
  }
}

// ============ 3. 属性与经验公式（§7.2 官方） ============
section('属性与经验公式');
{
  // 皮卡丘 Lv50 IV 全 0: HP = (35*2*50/100)+50+10 = 95
  const s = calcStats(getSpecies('pikachu'), 50, { hp: 0, atk: 0, def: 0, spd: 0 });
  ok(s.maxHp === 95, `皮卡丘 Lv50 HP=95 (实际 ${s.maxHp})`);
  ok(s.atk === Math.floor(55 * 2 * 50 / 100) + 5, '攻击公式');
  // IV 15: HP = ((35+15)*2*50/100)+60 = 110
  const s2 = calcStats(getSpecies('pikachu'), 50, { hp: 15, atk: 0, def: 0, spd: 0 });
  ok(s2.maxHp === 110, `IV15 HP=110 (实际 ${s2.maxHp})`);
  ok(expForLevel('medium', 10) === 1000 && expForLevel('medium', 50) === 125000, '中速经验曲线');
  ok(expForLevel('fast', 50) === 100000 && expForLevel('slow', 50) === 156250, '快/慢速经验曲线');
  ok(levelFromExp('medium', 1000) === 10, '经验反推等级');
  const inst = createInstance('charmander', 5);
  ok(inst.maxHp > 0 && inst.curHp === inst.maxHp && inst.moves.length > 0, '实例创建');
  ok(inst.atk > 0 && inst.def > 0 && inst.spd > 0, '实例含攻防速数值');
  ok(inst.ivs.hp >= 0 && inst.ivs.hp <= 15, 'IV 范围 0~15');
  ok(expReward(getSpecies('pikachu'), 7) === Math.floor(112 * 7 / 7), '经验奖励公式');
}

// ============ 4. 升级与学技能 ============
section('升级与学技能');
{
  const inst = createInstance('bulbasaur', 5);
  const res = gainExp(inst, expForLevel('slow', 8) - inst.exp);
  ok(res.levelsGained === 3 && inst.level === 8, '升级到 8');
  ok(res.movesToLearn.every(l => MOVES[l.move]), '可学技能合法');
  // 学技能：满 4 需替换
  inst.moves = ['tackle', 'vinewhip', 'razorleaf', 'growl' in MOVES ? 'growl' : 'absorb'];
  ok(tryLearn(inst, 'sleeppowder') === false, '满 4 无法直接学');
  learnReplace(inst, 'sleeppowder', 1);
  ok(inst.moves[1] === 'sleeppowder' && inst.moves.length === 4, '替换学习');
  learnReplace(inst, 'toxic', -1);
  ok(!inst.moves.includes('toxic'), '放弃学习');
}

// ============ 5. 伤害公式（§8.2） ============
section('伤害公式');
{
  const atk = { level: 20, atk: 40, def: 30, types: ['electric'], status: null };
  const defWater = { types: ['water'], def: 30 };
  const defRock = { types: ['rock'], def: 30 };
  const vsWater = calcDamage(atk, defWater, getMove('thundershock'), () => 0.5);
  const vsRock = calcDamage(atk, defRock, getMove('thundershock'), () => 0.5);
  ok(vsWater.mult === 2 && vsWater.stab === 1.5, '电打水 2 倍+STAB');
  ok(vsRock.mult === 0 && vsRock.damage === 0, '电打岩（地面）无效');
  // 基础值验证（攻击方火系用普系技能无 STAB）: base = floor(floor((2*20/5+2)*40*40/30)/50)+2 = 12
  const base = calcDamage({ level: 20, atk: 40, def: 0, types: ['fire'], status: null }, { types: ['normal'], def: 30 }, getMove('tackle'), () => 0.5);
  ok(base.damage === 11, `基础伤害值 floor(12×0.925)=11 (实际 ${base.damage})`);
  // STAB 本系加成
  const stabbed = calcDamage({ level: 20, atk: 40, def: 0, types: ['normal'], status: null }, { types: ['normal'], def: 30 }, getMove('tackle'), () => 0.5);
  ok(stabbed.stab === 1.5 && stabbed.damage === 16, `STAB 1.5 倍 (实际 ${stabbed.damage})`);
  // 烧伤物理减半
  const burned = calcDamage({ level: 20, atk: 40, def: 0, types: ['normal'], status: 'burn' }, { types: ['normal'], def: 30 }, getMove('tackle'), () => 0.5);
  ok(burned.damage < base.damage, '烧伤物理伤害减半');
  // 克制表
  ok(typeMultiplier('normal', ['ghost']) === 0, '普打鬼无效');
  ok(typeMultiplier('fire', ['grass']) === 2, '火打草 2 倍');
  ok(rollHit(getMove('tackle'), () => 0.99) === true, '命中判定');
  ok(rollHit(getMove('thunder'), () => 0.75) === false, '打雷 70 命中可 MISS');
}

// ============ 6. 异常状态（§9 全表） ============
section('异常状态');
{
  // 麻痹：电系免疫
  const pika = createInstance('pikachu', 10);
  ok(applyStatus(pika, 'paralysis') === false, '电系免疫麻痹');
  const rata = createInstance('rattata', 10);
  ok(applyStatus(rata, 'paralysis') === true, '普通系可麻痹');
  ok(applyStatus(rata, 'burn') === false, '主异常唯一');
  // 中毒不致死
  const squirt = createInstance('squirtle', 10);
  applyStatus(squirt, 'poison');
  squirt.curHp = 2;
  for (let i = 0; i < 100; i++) tickStatus(squirt, 3);
  ok(squirt.curHp === 1, '野外中毒扣到 1 HP 停止');
  // 剧毒递增
  const oddish = createInstance('rattata', 10);
  applyStatus(oddish, 'badpoison');
  tickStatus(oddish, 3);
  const d1 = oddish.maxHp - oddish.curHp;
  tickStatus(oddish, 3);
  const d2 = oddish.maxHp - oddish.curHp;
  ok(d2 > d1, '剧毒伤害递增');
  // 睡眠不可行动 + 受击唤醒
  const pidgey = createInstance('pidgey', 10);
  applyStatus(pidgey, 'sleep');
  ok(canAct(pidgey) === false, '睡眠不可行动');
  const evs = onHitBy(pidgey, 'normal');
  ok(pidgey.status === null && evs.some(e => e.type === 'woke'), '受击唤醒');
  // 冰冻 + 火系解冻
  const vulpix = createInstance('vulpix_a', 10);
  ok(applyStatus(vulpix, 'freeze') === false, '冰系免疫冰冻');
  const seel = createInstance('seel', 10);
  applyStatus(seel, 'freeze');
  ok(canAct(seel) === false, '冰冻不可行动');
  onHitBy(seel, 'fire');
  ok(seel.status === null, '火系技能解冻');
  // 火系免疫烧伤；毒系免疫中毒
  ok(applyStatus(createInstance('charmander', 10), 'burn') === false, '火系免疫烧伤');
  ok(applyStatus(createInstance('gastly', 10), 'poison') === false, '毒系免疫中毒');
  // 混乱可叠加
  const eevee = createInstance('eevee', 10);
  applyStatus(eevee, 'burn');
  ok(applyVolatile(eevee, 'confusion') === true, '混乱可与主异常叠加');
  // 捕获状态倍率
  const c1 = createInstance('rattata', 5);
  ok(statusCatchBonus(c1) === 1, '无状态倍率 1');
  applyStatus(c1, 'sleep');
  ok(statusCatchBonus(c1) === 2, '睡眠倍率 2');
  // 万灵药对应表
  ok(ITEMS.fullheal.cures.length === 6, '万灵药解全部异常');
}

// ============ 7. 捕获 ============
section('捕获系统');
{
  const inst = createInstance('rattata', 5);
  const full = captureChance(inst, 1.0);
  inst.curHp = 1;
  const low = captureChance(inst, 1.0);
  ok(low > full, '残血更容易捕获');
  const ultra = captureChance(inst, 2.0);
  ok(ultra > low, '高级球倍率更高');
  const master = attemptCapture(inst, 255, () => 0.999);
  ok(master.success, '大师球必中');
  const always = attemptCapture(inst, 1.0, () => 0.001);
  ok(always.success && always.shakes === 3, '极低随机数必中');
  const never = attemptCapture(inst, 1.0, () => 0.999);
  ok(!never.success, '高随机数失败');
}

// ============ 8. 队伍 ============
section('队伍系统');
{
  const party = new Party();
  for (let i = 0; i < 8; i++) party.add(createInstance('rattata', 5));
  ok(party.members.length === PARTY_MAX, '队伍上限 6');
  party.members.forEach(m => { m.curHp = 0; });
  ok(party.allFainted(), '全灭判定');
  ok(party.nextUsable() === -1, '无可战成员');
  party.members[2].curHp = 10;
  ok(party.nextUsable() === 2, '找下一只可战');
  party.healAll();
  ok(party.members.every(m => m.curHp === m.maxHp && !m.status), '宝可梦中心全队回满');
  const shares = party.distributeExp(100);
  ok(shares.find(s => s.index === 0).amount === 100, '出战全额经验');
  ok(shares.find(s => s.index === 1).amount === 50, '非出战 50% 经验');
}

// ============ 9. 进化（§7.3） ============
section('进化系统');
{
  const charm = createInstance('charmander', 15);
  ok(levelUpEvolution(charm) === null, '15 级不触发');
  charm.level = 16;
  const evo = levelUpEvolution(charm);
  ok(evo && evo.to === 'charmeleon', '16 级触发进化火恐龙');
  const expBefore = charm.exp;
  const ivBefore = JSON.stringify(charm.ivs);
  charm.curHp = Math.floor(charm.maxHp / 2);
  const res = applyEvolution(charm, 'charmeleon');
  ok(charm.speciesKey === 'charmeleon' && charm.level === 16, '进化后等级保留');
  ok(charm.exp === expBefore && JSON.stringify(charm.ivs) === ivBefore, '经验/IV 保留');
  const ratio = charm.curHp / charm.maxHp;
  ok(ratio > 0.4 && ratio < 0.6, 'HP 百分比保留');
  // 石头进化
  const eevee = createInstance('eevee', 20);
  ok(stoneEvolution(eevee, 'waterstone')?.to === 'vaporeon', '伊布水之石');
  ok(stoneEvolution(eevee, 'firestone')?.to === 'flareon', '伊布火之石');
  ok(stoneEvolution(eevee, 'leafstone') === null, '不匹配石头无反应');
  // 永不进化
  eevee.noEvolve = true;
  ok(stoneEvolution(eevee, 'waterstone') === null, '永不进化勾选生效');
  // 等级进化链完整性（文档 4.1）
  const chains = [
    ['bulbasaur', 16, 'ivysaur'], ['ivysaur', 32, 'venusaur'],
    ['squirtle', 16, 'wartortle'], ['wartortle', 36, 'blastoise'],
    ['caterpie', 7, 'metapod'], ['metapod', 10, 'butterfree'],
    ['weedle', 7, 'kakuna'], ['kakuna', 10, 'beedrill'],
    ['pidgey', 18, 'pidgeotto'], ['pidgeotto', 36, 'pidgeot'],
    ['rattata', 20, 'raticate'], ['oddish', 21, 'gloom'],
    ['magikarp', 20, 'gyarados'], ['psyduck', 33, 'golduck'],
    ['tentacool', 30, 'tentacruel'], ['geodude', 25, 'graveler'], ['graveler', 40, 'golem'],
    ['seel', 34, 'dewgong'], ['gastly', 25, 'haunter'], ['haunter', 40, 'gengar'],
    ['charmander', 16, 'charmeleon'], ['charmeleon', 36, 'charizard'],
  ];
  for (const [from, lv, to] of chains) {
    const sp = getSpecies(from);
    const e = Array.isArray(sp.evolution) ? sp.evolution[0] : sp.evolution;
    ok(e?.method === 'level' && e.level === lv && e.to === to, `${from} Lv${lv}→${to}`);
  }
  const stoneChains = [
    ['pikachu', 'thunderstone', 'raichu'], ['clefairy', 'moonstone', 'clefable'],
    ['gloom', 'leafstone', 'vileplume'], ['growlithe', 'firestone', 'arcanine'],
    ['vulpix_a', 'icestone', 'ninetales_a'],
  ];
  for (const [from, item, to] of stoneChains) {
    const sp = getSpecies(from);
    const e = Array.isArray(sp.evolution) ? sp.evolution.find(x => x.item === item) : sp.evolution;
    ok(e?.method === 'stone' && e.to === to, `${from} ${item}→${to}`);
  }
}

// ============ 10. 世界生成 ============
section('世界生成');
{
  const terrain = generateTerrain();
  ok(terrain.groundH.length === WORLD_SIZE * WORLD_SIZE, '高度图尺寸');
  // 五群系都存在
  const biomeSet = new Set(terrain.biome);
  for (const b of Object.values(BIOME_ID)) ok(biomeSet.has(b), `群系 ${b} 存在`);
  // 村庄整平
  for (const v of VILLAGES) {
    const h = terrain.groundH[idx(v.x, v.z)];
    ok(h === v.baseH, `${v.name} 中心整平 (${h}==${v.baseH})`);
  }
  // 村庄数据
  const { overlay, topOverride, villages } = buildVillages(terrain);
  ok(villages.length === 3, '3 座村庄');
  for (const v of villages) {
    ok(v.npcSpots.nurse && v.npcSpots.merchant, `${v.name} 护士/商人点位`);
    ok(overlay.size > 100, `${v.name} 建筑方块`);
  }
  const grassV = villages.find(v => v.key === 'grass');
  const volcV = villages.find(v => v.key === 'volcano');
  ok(grassV.gym?.type === 'rock', '岩系道馆在草原村');
  ok(volcV.gym?.type === 'fire', '火系道馆在火山村');
  ok(!villages.find(v => v.key === 'lake').gym, '湖畔村无道馆');
  // 装饰
  const { tallGrass } = decorate(terrain, overlay, topOverride);
  ok(tallGrass.some(v => v === 1), '草丛存在');
  // 高度合法性
  let min = 99, max = 0;
  for (let i = 0; i < terrain.groundH.length; i++) { min = Math.min(min, terrain.groundH[i]); max = Math.max(max, terrain.groundH[i]); }
  ok(min >= 8 && max <= 44, `高度范围 ${min}~${max}`);
  // 中心是草原
  ok(biomeAt(256, 256) === BIOME_ID.grass, '出生点群系为草原');
  ok(biomeAt(480, 256) === BIOME_ID.forest, '东部森林');
  ok(biomeAt(256, 480) === BIOME_ID.lake, '南部湖泊');
  ok(biomeAt(256, 40) === BIOME_ID.volcano, '北部火山');
  ok(biomeAt(40, 256) === BIOME_ID.snow, '西部雪山');
}

// ============ 11. 存档 ============
section('存档系统');
{
  const mockGame = {
    player: { pos: { x: 1, y: 2, z: 3 }, yaw: 0.5 },
    party: { members: [createInstance('pikachu', 12)], activeIndex: 0 },
    bag: { pokeball: 5 }, quickbar: ['pokeball', null, null, null, null],
    money: 1234, badges: new Set(['岩石徽章']), dex: new Set(['pikachu']),
    respawn: { x: 1, y: 2, z: 3, village: 'grass' },
    chestsOpened: new Set(['chest0']),
    merchantState: { present: true, village: 'grass', rareItems: ['firestone'], day: 1 },
    volumes: { bgm: 0.5, sfx: 0.6, voice: 0.7 },
    dayTime: 0.4,
  };
  // serialize 需要 Set 兼容 chestsOpened
  mockGame.chestsOpened = ['chest0'];
  const json = serialize(mockGame);
  const back = deserialize(json);
  ok(back.money === 1234 && back.party.length === 1 && back.badges.includes('岩石徽章'), '存档往返');
  ok(back.volumes.sfx === 0.6 && Math.abs(back.dayTime - 0.4) < 1e-9, '音量/时间存档');
  ok(back.party[0].speciesKey === 'pikachu' && back.party[0].ivs, '精灵实例含 IV 存档');
}

// ============ 结果 ============
console.log(`\n══════════════════════════════`);
console.log(`通过 ${passed} · 失败 ${failed}`);
if (failed) {
  console.log('失败项:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('全部测试通过 ✓');
}
