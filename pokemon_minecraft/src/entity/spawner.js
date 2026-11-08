// 野生精灵刷新器（设计文档 §8.1）：同屏活跃上限 ~20 只，按距离激活/休眠；村庄安全区不刷新
import { Creature } from './creature.js';
import { createInstance } from '../pokemon/stats.js';
import { SPAWN_TABLES, BIOMES } from '../data/spawns.js';
import { WORLD_SIZE, WATER_LEVEL, idx, BIOME_ID } from '../world/terrain.js';

const MAX_ACTIVE = 20;
const SPAWN_INTERVAL = 2.5;
const SPAWN_MIN = 16, SPAWN_MAX = 38;
const DESPAWN = 70;

export class Spawner {
  constructor(game) {
    this.game = game;
    this.creatures = [];
    this.timer = 0;
  }

  // 按权重从刷新表抽一只（考虑夜晚/水表）
  pickSpecies(biome, night) {
    let table = [...(SPAWN_TABLES[biome] || [])];
    if (night) table = table.concat(SPAWN_TABLES.night);
    const pool = night ? table : table.filter(e => !e.nightOnly);
    if (!pool.length) return null;
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of pool) { r -= e.weight; if (r <= 0) return e; }
    return pool[0];
  }

  trySpawn() {
    const g = this.game;
    const p = g.player.pos;
    const biome = g.world.biomeAt(p.x, p.z);
    const entry = this.pickSpecies(biome, g.world.night);
    if (!entry) return;
    // 草丛遭遇加成：玩家在草丛中刷新率翻倍（由 timer 处控制），此处提高近距刷新概率
    for (let tries = 0; tries < 8; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      const x = Math.floor(p.x + Math.sin(ang) * dist);
      const z = Math.floor(p.z + Math.cos(ang) * dist);
      if (x < 2 || z < 2 || x >= WORLD_SIZE - 2 || z >= WORLD_SIZE - 2) continue;
      if (g.world.villageAt(x, z)) continue;                       // 安全区
      const i = idx(x, z);
      const isWater = g.world.isWater(x, z);
      if (entry.waterOnly && !isWater) continue;
      if (!entry.waterOnly && isWater) continue;
      if (g.world.isLava(x, z)) continue;
      const [lo, hi] = BIOMES[biome].level;
      const level = lo + Math.floor(Math.random() * (hi - lo + 1));
      const inst = createInstance(entry.species, level);
      const c = new Creature(g, inst, { wild: true });
      c.placeAt(x + 0.5, (isWater ? WATER_LEVEL : g.world.effH(x, z)) + 1.02, z + 0.5);
      c.homePos = c.pos.clone();
      if (isWater) { c.floatWater = true; }
      this.creatures.push(c);
      g.onCreatureSpawned?.(c);
      return;
    }
  }

  update(dt) {
    const g = this.game;
    if (g.mode === 'play' && !g.playerInGym) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const inGrass = g.world.inTallGrass(Math.floor(g.player.pos.x), Math.floor(g.player.pos.z));
        this.timer = SPAWN_INTERVAL * (inGrass ? 0.5 : 1);
        if (this.creatures.filter(c => !c.fainted).length < MAX_ACTIVE) this.trySpawn();
      }
    }
    // 更新 + 休眠/清理
    const p = g.player.pos;
    for (const c of this.creatures) {
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (!c.boss && d > DESPAWN && c.state !== 'chase' && c.state !== 'attack') { c.removeMe = true; continue; }
      c.dormant = d > 45 && c.state === 'wander';
      if (!c.dormant) c.update(dt);
    }
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      if (this.creatures[i].removeMe) {
        this.creatures[i].dispose();
        this.creatures.splice(i, 1);
      }
    }
  }

  clearAll() {
    for (const c of this.creatures) c.dispose();
    this.creatures = [];
  }
}
