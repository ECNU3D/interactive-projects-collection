// 村庄预制建筑拼装（设计文档 §4.2/§4.3）：宝可梦中心、商店摊位、民居、道馆、农田、井、码头
// 纯 JS：只产出 overlay 方块表与元数据，不依赖 THREE
import { VILLAGES, WATER_LEVEL, WORLD_SIZE, idx } from './terrain.js';

const C = {
  log: 0x6B4A2F, plank: 0x9C7A4A, mud: 0xC9B08A, stone: 0x8A8A8A, stoneBrick: 0x70707A,
  roofRed: 0xC0392B, roofBrown: 0x7A4A2A, white: 0xF0F0F0, cross: 0xE03A3A,
  torch: 0xFFD75A, farm: 0x6B4A2F, crop: 0x5DA347, glass: 0xBFE8F2,
  awningR: 0xE04848, awningW: 0xF0F0F0, gold: 0xFCDC5F, magma: 0xFF7A20,
  door: 0x4A2F1B, sign: 0xC9A86A, water: 0x3A76C9, brickRed: 0x9C5B4A,
};

function key(x, y, z) { return x + '|' + y + '|' + z; }

class Stamp {
  constructor(overlay, topOverride) { this.overlay = overlay; this.topOverride = topOverride; }
  set(x, y, z, c, opts = {}) {
    this.overlay.set(key(x, y, z), { x, y, z, c, solid: opts.solid !== false, glow: !!opts.glow });
  }
  box(x1, x2, y1, y2, z1, z2, c, opts) {
    for (let x = Math.min(x1,x2); x <= Math.max(x1,x2); x++)
      for (let y = Math.min(y1,y2); y <= Math.max(y1,y2); y++)
        for (let z = Math.min(z1,z2); z <= Math.max(z1,z2); z++) this.set(x, y, z, c, opts);
  }
  //  hollow 盒：只有墙面
  walls(x1, x2, y1, y2, z1, z2, c, opts) {
    for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) {
      if (x === x1 || x === x2 || z === z1 || z === z2) this.set(x, y, z, c, opts);
    }
  }
  topColor(x, z, c) { this.topOverride.set(idx(x, z), c); }
  pathTo(x1, z1, x2, z2) {
    // L 形 2 宽石径
    let x = x1, z = z1;
    const stepX = Math.sign(x2 - x1), stepZ = Math.sign(z2 - z1);
    while (x !== x2) { this.topColor(x, z, C.stone); this.topColor(x, z + 1, C.stone); x += stepX; }
    while (z !== z2) { this.topColor(x, z, C.stone); this.topColor(x + 1, z, C.stone); z += stepZ; }
    this.topColor(x2, z2, C.stone);
  }
}

// 尖顶屋顶（沿 x 方向人字）
function gableRoof(st, x1, x2, y, z1, z2, c) {
  const midZ = (z1 + z2) / 2;
  let half = Math.ceil((z2 - z1 + 1) / 2);
  for (let i = 0; i < half; i++) {
    st.box(x1 - 1, x2 + 1, y + i, y + i, z1 + i, z2 - i, c);
  }
}

// 民居（橡木框架+泥墙+棕屋顶，门朝 -z 即朝村中心方向可调）
function house(st, hx, hz, h, doorDir = 1) {
  const w = 3, d = 2; // 半宽/半深
  st.box(hx - w, hx + w, h + 1, h + 1, hz - d, hz + d, C.plank);            // 地板
  st.walls(hx - w, hx + w, h + 2, h + 5, hz - d, hz + d, C.mud);           // 泥墙
  for (const sx of [-1, 1]) for (const sz of [-1, 1])                      // 橡木角柱
    st.box(hx + sx * w, hx + sx * w, h + 2, h + 5, hz + sz * d, hz + sz * d, C.log);
  st.set(hx - 1, h + 3, hz + doorDir * d, C.glass);                        // 窗
  st.set(hx + 1, h + 4, hz + doorDir * d, C.glass);
  st.set(hx, h + 2, hz + doorDir * d, C.door, { solid: false });           // 门洞
  st.set(hx, h + 3, hz + doorDir * d, C.door, { solid: false });
  gableRoof(st, hx - w, hx + w, h + 6, hz - d, hz + d, C.roofBrown);
  return { x: hx, z: hz + doorDir * (d + 1), y: h + 1 };
}

// 宝可梦中心（红屋顶+十字+回复台）
function pokeCenter(st, px, pz, h) {
  const w = 4, d = 3;
  st.box(px - w, px + w, h + 1, h + 1, pz - d, pz + d, C.white);
  st.walls(px - w, px + w, h + 2, h + 5, pz - d, pz + d, C.white);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    st.box(px + sx * w, px + sx * w, h + 2, h + 5, pz + sz * d, pz + sz * d, C.roofRed);
  // 正面红十字标志
  st.set(px, h + 4, pz + d, C.cross); st.set(px - 1, h + 4, pz + d, C.cross);
  st.set(px + 1, h + 4, pz + d, C.cross); st.set(px, h + 3, pz + d, C.cross); st.set(px, h + 5, pz + d, C.cross);
  // 门洞（朝南 +z）
  st.set(px, h + 2, pz + d, C.door, { solid: false });
  st.set(px, h + 3, pz + d, C.door, { solid: false });
  gableRoof(st, px - w, px + w, h + 6, pz - d, pz + d, C.roofRed);
  // 回复台（发光）
  st.set(px, h + 2, pz - 1, C.torch, { glow: true });
  st.set(px, h + 2, pz - 2, C.roofRed);
  return { x: px, z: pz + d + 1, y: h + 1, nurseX: px, nurseZ: pz - 1 };
}

// 商店摊位（柜台+条纹雨棚，头顶 $ 标记由 NPC 渲染）
function shopStall(st, sx, sz, h) {
  st.box(sx - 2, sx + 2, h + 1, h + 2, sz, sz, C.plank);                    // 柜台
  for (const dx of [-2, 2]) st.box(sx + dx, sx + dx, h + 1, h + 4, sz - 2, sz - 2, C.log); // 支柱
  for (let dx = -2; dx <= 2; dx++)                                          // 条纹雨棚
    st.box(sx + dx, sx + dx, h + 5, h + 5, sz - 3, sz + 1, dx % 2 === 0 ? C.awningR : C.awningW);
  st.set(sx, h + 2, sz, C.gold, { glow: true });                            // 金币袋
  return { x: sx, z: sz + 2, y: h + 1, merchantX: sx, merchantZ: sz - 1 };
}

// 道馆（石砖建筑+属性主题，门口指示牌）
function gym(st, gx, gz, h, type) {
  const w = 5, d = 4;
  const accent = type === 'fire' ? C.magma : C.stone;
  st.box(gx - w, gx + w, h + 1, h + 1, gz - d, gz + d, C.stoneBrick);
  st.walls(gx - w, gx + w, h + 2, h + 7, gz - d, gz + d, C.stoneBrick);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    st.box(gx + sx * w, gx + sx * w, h + 2, h + 7, gz + sz * d, gz + sz * d, accent);
  if (type === 'fire') for (const sx of [-1, 1]) st.set(gx + sx * w, h + 8, gz + d, C.magma, { glow: true });
  // 双开门（朝村中心 +z）
  for (const dx of [0, 1]) {
    st.set(gx - 1 + dx + 0, h + 2, gz + d, C.door, { solid: false });
    st.set(gx - 1 + dx + 0, h + 3, gz + d, C.door, { solid: false });
  }
  st.box(gx - w, gx + w, h + 8, h + 8, gz - d, gz + d, C.stoneBrick);       // 平顶
  st.box(gx - w + 1, gx + w - 1, h + 9, h + 9, gz - d + 1, gz + d - 1, accent);
  // 指示牌
  const signX = gx + 3, signZ = gz + d + 2;
  st.set(signX, h + 1, signZ, C.log);
  st.set(signX, h + 2, signZ, C.sign, { solid: false });
  return { x: gx, z: gz + d + 1, y: h + 1, signX, signZ, doorX: gx, doorZ: gz + d };
}

// 水井
function well(st, wx, wz, h) {
  st.box(wx - 1, wx + 1, h + 1, h + 1, wz - 1, wz + 1, C.stoneBrick);
  st.set(wx, h + 1, wz, C.water, { solid: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) st.set(wx + sx, h + 2, wz + sz, C.log);
  st.box(wx - 1, wx + 1, h + 4, h + 4, wz - 1, wz + 1, C.roofBrown);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) st.set(wx + sx, h + 3, wz + sz, C.log);
}

// 农田
function farm(st, fx, fz, h) {
  for (let x = fx - 2; x <= fx + 2; x++) for (let z = fz - 1; z <= fz + 1; z++) {
    st.topColor(x, z, C.farm);
    st.set(x, h + 1, z, C.crop, { solid: false });
  }
}

// 火把柱
function torchPost(st, tx, tz, h) {
  st.set(tx, h + 1, tz, C.log);
  st.set(tx, h + 2, tz, C.torch, { glow: true, solid: false });
}

// 码头（湖畔村）
function dock(st, dx, dz, h) {
  for (let i = 0; i < 8; i++) {
    st.box(dx - 1, dx + 1, h + 1, h + 1, dz + i, dz + i, C.plank);
    if (i % 3 === 0) for (const sx of [-1, 1]) st.set(dx + sx, h + 2, dz + i, C.log);
  }
}

// 生成全部村庄：返回 { overlay, topOverride, villages: [...元数据] }
export function buildVillages(terrain) {
  const overlay = new Map();
  const topOverride = new Map();
  const st = new Stamp(overlay, topOverride);
  const out = [];

  for (const v of VILLAGES) {
    const h = v.baseH;
    const meta = { ...v, npcSpots: {}, signs: [], houses: [] };
    // 中心水井
    well(st, v.x, v.z, h);
    // 宝可梦中心（北侧）
    const pc = pokeCenter(st, v.x - 8, v.z - 12, h);
    meta.pokeCenter = { x: v.x - 8, z: v.z - 12 };
    // 护士站在门口迎客（出生点一定能立刻找到她回血）
    meta.npcSpots.nurse = { x: pc.nurseX, y: h + 1, z: pc.z };
    meta.respawnPoint = { x: pc.x, y: h + 2, z: pc.z + 1 };
    st.pathTo(pc.x, pc.z, v.x, v.z);
    // 商店摊位（东侧）
    const shop = shopStall(st, v.x + 10, v.z + 4, h);
    meta.shopStall = { x: v.x + 10, z: v.z + 4 };
    meta.npcSpots.merchant = { x: shop.merchantX, y: h + 2, z: shop.merchantZ };
    st.pathTo(shop.x, shop.z, v.x, v.z);
    // 民居
    const houseSpots = v.key === 'grass'
      ? [[-14, 6], [12, -10], [-4, 14], [14, 12]]
      : [[-12, 8], [10, -8], [12, 10]];
    for (const [dx, dz] of houseSpots) {
      const door = house(st, v.x + dx, v.z + dz, h, dz >= 0 ? -1 : 1);
      meta.houses.push({ x: v.x + dx, z: v.z + dz, door });
      st.pathTo(door.x, door.z, v.x, v.z);
    }
    // 道馆
    if (v.hasGym) {
      const g = gym(st, v.x + 2, v.z - 16, h, v.hasGym);
      meta.gym = { type: v.hasGym, x: v.x + 2, z: v.z - 16, doorX: g.doorX, doorZ: g.doorZ, enterX: g.x, enterY: h + 2, enterZ: g.z + 1 };
      meta.signs.push({ x: g.signX, y: h + 2, z: g.signZ, gym: v.hasGym });
      st.pathTo(g.x, g.z, v.x, v.z);
    }
    // 农田（草原村）
    if (v.key === 'grass') {
      farm(st, v.x - 16, v.z - 2, h);
      farm(st, v.x - 16, v.z + 3, h);
    }
    // 码头（湖畔村，伸向 +z 湖面）
    if (v.key === 'lake') dock(st, v.x + 2, v.z + 16, h);
    // 火把沿主径
    for (const [dx, dz] of [[-4, 0], [4, 0], [0, -6], [0, 6], [-9, -8], [8, 2]]) {
      torchPost(st, v.x + dx, v.z + dz, h);
    }
    out.push(meta);
  }
  return { overlay, topOverride, villages: out };
}
