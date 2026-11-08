// 装饰物（设计文档 §4.1）：树、草丛、花、蘑菇、芦苇、发光矿石
// 纯 JS：向 overlay 写入方块；tallGrass 标记供遭遇加成
import { WORLD_SIZE, WATER_LEVEL, BIOME_ID, VILLAGES, hash2, idx } from './terrain.js';

const C = {
  log: 0x6B4A2F, leaves: 0x3E7D32, leavesSnow: 0xE8F2F4, spruce: 0x2E5B33,
  flowerR: 0xE04848, flowerY: 0xFCDC5F, grass: 0x6FAF45,
  mushroom: 0xD84535, mushStem: 0xE8DCC8, reed: 0x7FAF5A,
  ore: 0xFFB84A, dead: 0x8A7A5A,
};

function key(x, y, z) { return x + '|' + y + '|' + z; }

function nearVillage(x, z, margin = 4) {
  return VILLAGES.some(v => Math.hypot(x - v.x, z - v.z) < v.r + margin);
}

function oakTree(set, x, y, z, h) {
  for (let i = 1; i <= h; i++) set(x, y + i, z, C.log, true);
  const top = y + h;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) {
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy !== 0) continue;
    if (dx === 0 && dz === 0 && dy < 1) continue;
    set(x + dx, top + dy, z + dz, C.leaves, false);
  }
  set(x, top + 2, z, C.leaves, false);
}

function spruceTree(set, x, y, z, h) {
  for (let i = 1; i <= h; i++) set(x, y + i, z, C.log, true);
  for (let dy = 2; dy <= h; dy++) {
    const r = dy > h - 2 ? 0 : (dy % 2 === 0 ? 2 : 1);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx === 0 && dz === 0) continue;
      if (Math.abs(dx) === r && Math.abs(dz) === r && r === 2) continue;
      set(x + dx, y + dy, z + dz, dy > h - 3 ? C.leavesSnow : C.spruce, false);
    }
  }
  set(x, y + h + 1, z, C.leavesSnow, false);
}

export function decorate(terrain, overlay, topOverride) {
  const tallGrass = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
  const set = (x, y, z, c, solid) => {
    if (x < 1 || z < 1 || x >= WORLD_SIZE - 1 || z >= WORLD_SIZE - 1) return;
    overlay.set(key(x, y, z), { x, y, z, c, solid: !!solid, glow: c === C.ore });
  };

  for (let z = 2; z < WORLD_SIZE - 2; z++) {
    for (let x = 2; x < WORLD_SIZE - 2; x++) {
      const i = idx(x, z);
      const b = terrain.biome[i];
      const h = terrain.groundH[i];
      if (h <= WATER_LEVEL) continue;                    // 水下不摆
      if (terrain.lava[i] || terrain.ice[i]) continue;
      if (nearVillage(x, z)) continue;
      if (topOverride.has(i)) continue;                  // 村径不摆
      const r = hash2(x, z, 7);

      if (b === BIOME_ID.grass) {
        if (r < 0.008) oakTree(set, x, h, z, 4 + Math.floor(hash2(x, z, 8) * 2));
        else if (r < 0.05) set(x, h + 1, z, hash2(x, z, 9) < 0.5 ? C.flowerR : C.flowerY, false);
        else if (r < 0.16) { set(x, h + 1, z, C.grass, false); tallGrass[i] = 1; }
      } else if (b === BIOME_ID.forest) {
        if (r < 0.05) oakTree(set, x, h, z, 4 + Math.floor(hash2(x, z, 8) * 3));
        else if (r < 0.065) set(x, h + 1, z, C.mushroom, false);
        else if (r < 0.14) { set(x, h + 1, z, C.grass, false); tallGrass[i] = 1; }
      } else if (b === BIOME_ID.lake) {
        if (r < 0.03 && h >= WATER_LEVEL && h <= WATER_LEVEL + 1) set(x, h + 1, z, C.reed, false);
        else if (r < 0.045) set(x, h + 2, z, C.reed, false);
      } else if (b === BIOME_ID.volcano) {
        if (r < 0.02) set(x, h + 1, z, C.ore, true);     // 发光矿石（可碰撞的发光块）
        else if (r < 0.04) set(x, h + 1, z, C.dead, false);
      } else if (b === BIOME_ID.snow) {
        if (r < 0.025) spruceTree(set, x, h, z, 5 + Math.floor(hash2(x, z, 8) * 3));
      }
    }
  }
  return { tallGrass };
}
