// 世界编排：数据生成、区块网格缓存、碰撞查询、昼夜循环、道具点/宝箱、道馆竞技场
import { WORLD_SIZE, CHUNK, WATER_LEVEL, MAX_Y, idx, BIOME_ID, BIOME_KEY, VILLAGES, generateTerrain, hash2 } from './terrain.js';
import { buildVillages } from './village.js';
import { decorate } from './decorations.js';
import { ChunkMesher } from './chunk.js';

const DAY_LENGTH = 600;          // 10 分钟一天（§4.1）
const VIEW_RADIUS = 7;           // 区块可视半径

export class World {
  constructor(scene) {
    this.scene = scene;
    this.terrain = generateTerrain();
    const v = buildVillages(this.terrain);
    this.overlay = v.overlay;
    this.topOverride = v.topOverride;
    this.villages = v.villages;
    const d = decorate(this.terrain, this.overlay, this.topOverride);
    this.tallGrass = d.tallGrass;

    // overlay 按 chunk 索引
    this.chunkBlocks = new Map();
    for (const b of this.overlay.values()) {
      const ck = Math.floor(b.x / CHUNK) + ',' + Math.floor(b.z / CHUNK);
      if (!this.chunkBlocks.has(ck)) this.chunkBlocks.set(ck, []);
      this.chunkBlocks.get(ck).push(b);
    }

    this.mesher = new ChunkMesher(this);
    this.chunks = new Map();          // "cx,cz" → Group
    this.dayTime = 0.3;               // 0~1，0.25 正午 0.75 午夜
    this.dayCount = 1;
    this.itemPoints = [];
    this.chests = [];
    this._placeLoot();

    // 光照
    this.hemi = new THREE.HemisphereLight(0xd9ecff, 0x8a6b4a, 0.75);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3d6, 0.95);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -60; this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60; this.sun.shadow.camera.bottom = -60;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.normalBias = 0.06;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(this.ambient);
    scene.fog = new THREE.Fog(0xC5E8FF, 60, 130);
  }

  // 有效站立高度（雪山冰面可行走）
  effH(x, z) {
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return 0;
    const i = idx(x, z);
    const th = this.terrain.groundH[i];
    if (this.terrain.biome[i] === BIOME_ID.snow && th < WATER_LEVEL) return WATER_LEVEL;
    return th;
  }

  isIce(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return false;
    const i = idx(x, z);
    return this.terrain.biome[i] === BIOME_ID.snow && this.terrain.groundH[i] < WATER_LEVEL;
  }

  isWater(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return false;
    const i = idx(x, z);
    return this.terrain.groundH[i] < WATER_LEVEL && this.terrain.biome[i] !== BIOME_ID.snow;
  }

  isLava(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return false;
    return !!this.terrain.lava[idx(x, z)];
  }

  inTallGrass(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return false;
    return !!this.tallGrass[idx(x, z)];
  }

  solidAt(x, y, z) {
    // 世界边界（道馆竞技场区域除外，竞技场的墙由 overlay 方块构成）
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) {
      if (!this._inArena(x, z)) return true;
    } else {
      if (y <= this.effH(x, z)) return true;
    }
    if (y < 0) return true;
    const b = this.overlay.get(x + '|' + y + '|' + z);
    return !!(b && b.solid);
  }

  _inArena(x, z) {
    if (!this.arenaRects) return false;
    return this.arenaRects.some(r => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
  }

  biomeAt(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= WORLD_SIZE || z >= WORLD_SIZE) return 'grass';
    return BIOME_KEY[this.terrain.biome[idx(x, z)]];
  }

  // 村庄安全区（§4.2：范围内不刷新野生精灵）
  villageAt(x, z) {
    for (const v of this.villages) {
      if (Math.hypot(x - v.x, z - v.z) < v.r) return v;
    }
    return null;
  }

  // ---- 区块网格缓存 ----
  ensureChunks(px, pz) {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
    let built = 0;
    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS) continue;
        const cx = ccx + dx, cz = ccz + dz;
        const k = cx + ',' + cz;
        if (this.chunks.has(k)) continue;
        if (built >= 3) return;                                  // 每帧最多建 3 个
        const g = this.mesher.build(cx, cz);
        this.chunks.set(k, g);
        this.scene.add(g);
        built++;
      }
    }
    // 卸载远处
    for (const [k, g] of this.chunks) {
      const [cx, cz] = g.userData.chunk;
      const dx = cx - ccx, dz = cz - ccz;
      if (dx * dx + dz * dz > (VIEW_RADIUS + 3) ** 2) {
        this.scene.remove(g);
        g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        this.chunks.delete(k);
      }
    }
  }

  // ---- 昼夜（10 分钟一天） ----
  updateDayNight(dt, playerPos) {
    const prev = this.dayTime;
    this.dayTime += dt / DAY_LENGTH;
    if (this.dayTime >= 1) { this.dayTime -= 1; this.dayCount++; }
    const t = this.dayTime;
    // 太阳角度：0.25 正午 0.75 午夜
    const ang = (t - 0.25) * Math.PI * 2;
    const sunH = Math.sin(ang);   // >0 白天
    const day = Math.max(0, sunH);
    const dusk = Math.max(0, 1 - Math.abs(sunH) * 3);  // 晨昏过渡
    this.sun.intensity = 0.15 + day * 0.8;
    this.hemi.intensity = 0.25 + day * 0.5;
    this.ambient.intensity = 0.12 + day * 0.18;
    const sd = this.sun;
    sd.position.set(playerPos.x + Math.cos(ang) * 80, playerPos.y + Math.max(8, sunH * 90), playerPos.z + 40);
    sd.target.position.copy(playerPos);
    // 天空色
    const sky = new THREE.Color().setHSL(0.58, 0.55, 0.08 + day * 0.55 + dusk * 0.1);
    if (dusk > 0.3) sky.lerp(new THREE.Color(0xE88A4A), dusk * 0.35);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.15);
    this.night = t > 0.58 && t < 0.92;
    return prev !== this.dayTime;
  }

  // ---- 道具刷新点与宝箱（§4.1） ----
  _findSpot(cx, cz, maxR = 40) {
    for (let r = 0; r < maxR; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += 0.6) {
        const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
        if (x < 2 || z < 2 || x >= WORLD_SIZE - 2 || z >= WORLD_SIZE - 2) continue;
        const h = this.terrain.groundH[idx(x, z)];
        if (h > WATER_LEVEL && !this.villageAt(x, z) && !this.terrain.lava[idx(x, z)]) return { x, y: h + 1, z };
      }
    }
    return { x: cx, y: this.terrain.groundH[idx(cx, cz)] + 1, z: cz };
  }

  _placeLoot() {
    const itemPool = ['potion', 'pokeball', 'pokeball', 'antidote', 'paralyzheal', 'superpotion', 'greatball', 'burnheal'];
    // 道具点：每群系中心散布 5 个
    const centers = { grass: [256, 200], forest: [420, 256], lake: [256, 440], volcano: [200, 90], snow: [90, 256] };
    for (const [biome, [cx, cz]] of Object.entries(centers)) {
      for (let i = 0; i < 5; i++) {
        const spot = this._findSpot(cx + Math.floor(hash2(i, cx, 1) * 60 - 30), cz + Math.floor(hash2(i, cz, 2) * 60 - 30));
        this.itemPoints.push({
          ...spot, biome,
          itemId: itemPool[Math.floor(hash2(i, cx + cz, 3) * itemPool.length)],
          active: true, respawnAt: 0,
        });
      }
    }
    // 宝箱（固定位置一次性，给稀有球/进化石/大量药）
    const chestDefs = [
      { at: [300, 300], loot: [{ id: 'ultraball', count: 3 }, { id: 'superpotion', count: 3 }] },
      { at: [180, 180], loot: [{ id: 'greatball', count: 5 }, { id: 'potion', count: 5 }] },
      { at: [420, 200], loot: [{ id: 'leafstone', count: 1 }, { id: 'fullheal', count: 2 }] },
      { at: [380, 420], loot: [{ id: 'waterstone', count: 1 }, { id: 'superpotion', count: 3 }] },
      { at: [256, 470], loot: [{ id: 'ultraball', count: 5 }] },
      { at: [150, 90],  loot: [{ id: 'firestone', count: 1 }, { id: 'fullrestore', count: 1 }] },
      { at: [90, 200],  loot: [{ id: 'icestone', count: 1 }, { id: 'fullheal', count: 2 }] },
      { at: [420, 90],  loot: [{ id: 'thunderstone', count: 1 }, { id: 'greatball', count: 3 }] },
      { at: [100, 420], loot: [{ id: 'moonstone', count: 1 }, { id: 'superpotion', count: 5 }] },
    ];
    chestDefs.forEach((def, i) => {
      const spot = this._findSpot(def.at[0], def.at[1]);
      this.chests.push({ id: 'chest' + i, ...spot, loot: def.loot, opened: false });
    });
  }

  updateLoot(now) {
    for (const p of this.itemPoints) {
      if (!p.active && now >= p.respawnAt) {
        p.active = true;
        const pool = ['potion', 'pokeball', 'antidote', 'superpotion', 'greatball', 'paralyzheal', 'burnheal'];
        p.itemId = pool[Math.floor(Math.random() * pool.length)];
      }
    }
  }

  // 整平一块空地并清除装饰（Boss 场地用）
  carveClearing(cx, cz, r = 6) {
    const base = this.effH(cx, cz);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, z = cz + dz;
        if (x < 1 || z < 1 || x >= WORLD_SIZE - 1 || z >= WORLD_SIZE - 1) continue;
        this.terrain.groundH[idx(x, z)] = base;
        for (let y = base + 1; y <= base + 14; y++) this.overlay.delete(x + '|' + y + '|' + z);
      }
    }
    // 重建受影响区块的方块索引
    this.chunkBlocks.clear();
    for (const b of this.overlay.values()) {
      const ck = Math.floor(b.x / CHUNK) + ',' + Math.floor(b.z / CHUNK);
      if (!this.chunkBlocks.has(ck)) this.chunkBlocks.set(ck, []);
      this.chunkBlocks.get(ck).push(b);
    }
    return { x: cx, y: base + 1, z: cz };
  }

  // ---- 道馆竞技场（独立封闭空间，远离主地图坐标） ----
  buildArena(gymType) {
    // 竞技场中心放在世界外固定坐标
    const ax = gymType === 'rock' ? -200 : -300;
    const az = -200;
    const floorY = 30;
    const accent = gymType === 'fire' ? 0xFF7A20 : 0x70707A;
    const set = (x, y, z, c, solid = true, glow = false) => {
      this.overlay.set(x + '|' + y + '|' + z, { x, y, z, c, solid, glow });
      const ck = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
      if (!this.chunkBlocks.has(ck)) this.chunkBlocks.set(ck, []);
      this.chunkBlocks.get(ck).push(this.overlay.get(x + '|' + y + '|' + z));
    };
    // 20×14×20 石砖封闭场
    for (let x = ax - 10; x <= ax + 10; x++) for (let z = az - 10; z <= az + 10; z++) {
      set(x, floorY, z, 0x60606A);
      for (let y = floorY + 1; y <= floorY + 7; y++) {
        if (x === ax - 10 || x === ax + 10 || z === az - 10 || z === az + 10) set(x, y, z, 0x50505A);
      }
      set(x, floorY + 8, z, 0x50505A);
    }
    // 角柱与火把
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      for (let y = floorY + 1; y <= floorY + 7; y++) set(ax + sx * 9, y, az + sz * 9, accent);
      set(ax + sx * 6, floorY + 2, az + sz * 9, 0xFFD75A, false, true);
    }
    if (gymType === 'fire') for (let i = -2; i <= 2; i++) set(ax + i, floorY + 1, az - 9, 0xFF7A20, false, true);
    this.arenaRects = this.arenaRects || [];
    if (!this.arenaRects.some(r => r.x1 === ax - 10)) this.arenaRects.push({ x1: ax - 10, x2: ax + 10, z1: az - 10, z2: az + 10 });
    // effH 在竞技场区域返回 floorY-1（overlay 地板块本身 solid）
    this.arenaInfo = this.arenaInfo || {};
    this.arenaInfo[gymType] = { ax, az, floorY, playerX: ax, playerZ: az + 7, enemyX: ax, enemyZ: az - 4, exitX: ax, exitZ: az + 9 };
    return this.arenaInfo[gymType];
  }
}
