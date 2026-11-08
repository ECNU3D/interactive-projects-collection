// 赤壁之战 · 舰队模块 —— 战船实体（浮力/航行/划桨/燃烧/沉没）与三方布阵
import * as THREE from 'three';
import { materials, makeRng } from '../materials.js';
import { createLouchuan } from '../models/louchuan.js';
import { createOaredBoat } from '../models/oaredBoat.js';
import { createFireShip } from '../models/fireShip.js';

// 船型参数（与 models 中的几何对应：船长沿 x，首向 +x）
const KINDS = {
  louchuan: { build: createLouchuan, L: 12, B: 3.0, deckY: 1.11, draft: 0.5, speed: 2.0, turn: 0.3, hp: 110, oars: true },
  oared:    { build: createOaredBoat, L: 9.5, B: 1.7, deckY: 0.7, draft: 0.32, speed: 3.2, turn: 0.55, hp: 60, oars: true },
  fire:     { build: createFireShip, L: 9, B: 2.6, deckY: 0.9, draft: 0.4, speed: 2.7, turn: 0.4, hp: 40, oars: false },
};

// 阵营：旗色 / 幡上大字
export const FACTIONS = {
  wei:   { name: '魏', color: '#262a33', ink: '#d8d4c8' },
  wu:    { name: '吴', color: '#274d31', ink: '#e8e0c8' },
  shu:   { name: '汉', color: '#6e241c', ink: '#f0e6cc' },
  huang: { name: '黄', color: '#a8761f', ink: '#2b1d08' },
};

let _bannerTex = {};
function bannerTexture(faction) {
  if (_bannerTex[faction]) return _bannerTex[faction];
  const F = FACTIONS[faction];
  const c = document.createElement('canvas');
  c.width = 96; c.height = 144;
  const ctx = c.getContext('2d');
  ctx.fillStyle = F.color; ctx.fillRect(0, 0, 96, 144);
  ctx.strokeStyle = F.ink; ctx.lineWidth = 5; ctx.strokeRect(5, 5, 86, 134);
  ctx.fillStyle = F.ink;
  ctx.font = 'bold 64px "Kaiti SC", "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(F.name, 48, 76);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _bannerTex[faction] = t;
  return t;
}

/** 战船实体：外层 Group 管位置与航向，内层管波浪俯仰/侧倾 */
export class Ship {
  constructor(kind, faction, env, effects) {
    const K = KINDS[kind];
    this.kind = kind; this.K = K;
    this.faction = faction;
    this.env = env; this.effects = effects;

    this.obj = new THREE.Group();          // 外层：位置 + 航向
    this.inner = K.build();                // 内层：模型本体（俯仰/侧倾）
    this.obj.add(this.inner);

    this.heading = 0;                      // 世界 XZ 方位角：前进方向 (cosθ, 0, sinθ)
    this.speed = 0;
    this.waypoints = [];
    this.state = 'anchored';               // anchored | sail | burning | sinking | sunk | fleeing
    this.hp = K.hp;
    this.burnProgress = 0;                 // 0..1 烧灼碳化程度
    this._sinkT = 0;
    this._wakeT = 0;
    this._rowPhase = Math.random() * 6.28;
    this._charred = false;                 // 材质是否已克隆（碳化用）

    // 收集桨（做划桨动画）
    this._oars = [];
    this.inner.traverse((o) => {
      if (o.name === 'oar') this._oars.push({ o, base: o.rotation.clone() });
    });

    // 既有红色幡旗替换为阵营色
    const M = materials();
    const flagMat = new THREE.MeshStandardMaterial({ color: FACTIONS[faction].color, roughness: 0.95, side: THREE.DoubleSide });
    this.inner.traverse((o) => {
      if (o.isMesh && (o.material === M.flagRed || o.material === M.flagRedDark)) o.material = flagMat;
    });

    // 尾楼认旗（幡杆 + 布幡）
    const poleH = 2.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, poleH, 5), M.darkWood);
    pole.position.set(-K.L / 2 + 0.9, K.deckY + poleH / 2 + 0.3, 0);
    this.banner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 1.2),
      new THREE.MeshStandardMaterial({ map: bannerTexture(faction), roughness: 0.95, side: THREE.DoubleSide })
    );
    this.banner.position.set(-K.L / 2 + 0.9, K.deckY + poleH - 0.35, 0.06);
    this.inner.add(pole, this.banner);

    // 船尾灯笼（夜战辨识；HDR 微光，泛光管线中自发亮）
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffa347').multiplyScalar(1.35) });
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lampMat);
    this.lamp.position.set(-K.L / 2 + 0.9, K.deckY + poleH + 0.12, 0);
    this.inner.add(this.lamp);
  }

  /** 设航向（θ：前进方向 (cosθ,0,sinθ)） */
  setHeading(theta) { this.heading = theta; this.obj.rotation.y = -theta; }

  /** 驶向目标点（清空原航点） */
  setCourse(x, z, speedK = 1) {
    this.waypoints = [{ x, z }];
    this.speedK = speedK;
    if (this.state === 'anchored') this.state = 'sail';
  }

  /** 溃逃：更快、脱离连环 */
  fleeTo(x, z) {
    this.waypoints = [{ x, z }];
    this.speedK = 1.5;
    this.state = 'fleeing';
  }

  halt() { this.waypoints = []; this.speedK = 0; if (this.state === 'sail') this.state = 'anchored'; }

  /** 甲板随机点（箭雨瞄准用，世界坐标） */
  deckPoint(out) {
    const K = this.K;
    out.set((Math.random() - 0.42) * K.L * 0.7, K.deckY + 0.1, (Math.random() - 0.5) * K.B * 0.7);
    return this.inner.localToWorld(out);
  }

  /** 起火 */
  ignite(intensity = 0.5) {
    if (this.state === 'sinking' || this.state === 'sunk') return;
    if (this.state !== 'burning') this.state = 'burning';
    this._cloneMaterials();
    const K = this.K;
    const anchors = [
      new THREE.Vector3(K.L * 0.22, K.deckY + 0.15, K.B * 0.2),
      new THREE.Vector3(-K.L * 0.2, K.deckY + 0.15, -K.B * 0.22),
      new THREE.Vector3(0, K.deckY + 0.35, 0),
    ];
    this.effects.igniteShip(this.inner, anchors, intensity);
  }

  setFireIntensity(v) { this.effects.setShipFireIntensity(this.inner, v); }

  damage(n) {
    if (this.state === 'sunk' || this.state === 'sinking') return;
    this.hp -= n;
    if (this.hp <= 0) this.sink();
  }

  /** 克隆材质以便单独碳化（首次点火时执行一次） */
  _cloneMaterials() {
    if (this._charred) return;
    this._charred = true;
    this._mats = [];
    const seen = new Map();
    this.inner.traverse((o) => {
      if (!o.isMesh) return;
      if (!seen.has(o.material)) {
        const c = o.material.clone();
        seen.set(o.material, c);
        this._mats.push({ mat: c, base: c.color.clone() });
      }
      o.material = seen.get(o.material);
    });
  }

  sink() {
    if (this.state === 'sinking' || this.state === 'sunk') return;
    this.state = 'sinking';
    this._sinkT = 0;
    this.effects.extinguishShip(this.inner);
    const p = new THREE.Vector3();
    this.obj.getWorldPosition(p);
    p.y = this.env.WATER_Y;
    this.effects.splash(p, 2.2);
  }

  get alive() { return this.state !== 'sunk' && this.state !== 'sinking'; }

  update(dt, t) {
    const { K, env } = this;
    const pos = this.obj.position;

    // ---- 沉没 ----
    if (this.state === 'sinking') {
      this._sinkT += dt;
      const k = Math.min(this._sinkT / 9, 1);
      pos.y -= dt * (0.5 + k * 0.9);
      this.inner.rotation.z += dt * 0.06;         // 船首下沉
      this.inner.rotation.x += dt * 0.035;        // 侧倾
      if (k >= 1) { this.state = 'sunk'; this.obj.visible = false; }
      return;
    }
    if (this.state === 'sunk') return;

    // ---- 航行 ----
    const wp = this.waypoints[0];
    let targetSpeed = 0;
    if (wp) {
      const dx = wp.x - pos.x, dz = wp.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) { this.waypoints.shift(); }
      else {
        const want = Math.atan2(dz, dx);
        let d = want - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const maxTurn = K.turn * dt;
        this.setHeading(this.heading + THREE.MathUtils.clamp(d, -maxTurn, maxTurn));
        targetSpeed = K.speed * (this.speedK || 1) * (Math.abs(d) > 1.2 ? 0.4 : 1);
      }
    } else if (this.state === 'sail' || this.state === 'fleeing') {
      this.state = this.state === 'fleeing' ? 'fleeing' : 'anchored';
    }
    this.speed += (targetSpeed - this.speed) * Math.min(dt * 0.8, 1);
    if (this.speed > 0.02) {
      pos.x += Math.cos(this.heading) * this.speed * dt;
      pos.z += Math.sin(this.heading) * this.speed * dt;
    }

    // ---- 波浪浮沉（采样首/尾/两舷波高） ----
    const fx = Math.cos(this.heading), fz = Math.sin(this.heading);
    const hBow = env.waterHeight(pos.x + fx * K.L * 0.4, pos.z + fz * K.L * 0.4, t);
    const hStern = env.waterHeight(pos.x - fx * K.L * 0.4, pos.z - fz * K.L * 0.4, t);
    const hPort = env.waterHeight(pos.x - fz * K.B * 0.5, pos.z + fx * K.B * 0.5, t);
    const hStar = env.waterHeight(pos.x + fz * K.B * 0.5, pos.z - fx * K.B * 0.5, t);
    const targetY = (hBow + hStern + hPort + hStar) / 4 - K.draft;
    pos.y += (targetY - pos.y) * Math.min(dt * 3, 1);
    this.inner.rotation.z = Math.atan2(hBow - hStern, K.L * 0.8) * 0.8;
    this.inner.rotation.x = Math.atan2(hPort - hStar, K.B) * 0.7 + Math.sin(t * 0.7 + this._rowPhase) * 0.008;

    // ---- 划桨 ----
    const rowK = THREE.MathUtils.clamp(this.speed / K.speed, 0, 1);
    if (K.oars && this._oars.length) {
      for (let i = 0; i < this._oars.length; i++) {
        const { o, base } = this._oars[i];
        const ph = t * 2.4 + this._rowPhase + i * 0.32;
        o.rotation.y = base.y + Math.sin(ph) * 0.3 * rowK;
        o.rotation.x = base.x + Math.cos(ph) * 0.1 * rowK * Math.sign(base.x || 1);
      }
    }

    // ---- 幡旗拂动 ----
    if (this.banner) {
      const w = env.getWind().length();
      this.banner.rotation.y = Math.sin(t * (2 + w * 0.4) + this._rowPhase) * 0.18 * (0.4 + w * 0.15);
    }

    // ---- 燃烧：碳化加深 + 持续掉血 ----
    if (this.state === 'burning') {
      this.burnProgress = Math.min(this.burnProgress + dt / 50, 1);
      if (this._mats) {
        for (const { mat, base } of this._mats) {
          mat.color.copy(base).lerp(_charColor, this.burnProgress * 0.85);
        }
      }
      this.damage(dt * 5.5);
    }

    // ---- 船尾浪（节流） ----
    this._wakeT -= dt;
    if (this.speed > 0.5 && this._wakeT <= 0) {
      this._wakeT = 0.35;
      const stern = new THREE.Vector3(-K.L / 2, 0.1, 0);
      this.inner.localToWorld(stern);
      stern.y = env.WATER_Y;
      this.effects.wake(stern, new THREE.Vector3(-fx, 0, -fz), this.speed / K.speed);
    }
  }
}
const _charColor = new THREE.Color('#161210');

/** 连环船铁索（静态悬链，断裂时移除） */
function buildChain(scene, a, b) {
  const pa = new THREE.Vector3(a.K.L / 2 + 0.1, a.K.deckY + 0.25, 0);
  a.inner.localToWorld(pa);
  const pb = new THREE.Vector3(-b.K.L / 2 - 0.1, b.K.deckY + 0.25, 0);
  b.inner.localToWorld(pb);
  const mid = pa.clone().lerp(pb, 0.5); mid.y -= 0.9;
  const curve = new THREE.CatmullRomCurve3([pa, mid, pb]);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, 0.05, 5),
    materials().ironDark
  );
  scene.add(mesh);
  return { mesh, a, b };
}

/** 三方布阵：北岸魏军连环船（z<0），南岸联军（z>0），黄盖火船列于联军前沿 */
export function buildFleets(scene, env, effects) {
  const all = [];
  const mk = (kind, faction, x, z, heading, scale = 1) => {
    const s = new Ship(kind, faction, env, effects);
    s.obj.position.set(x, -KINDS[kind].draft, z);
    s.setHeading(heading);
    s.inner.scale.setScalar(scale);
    scene.add(s.obj);
    all.push(s);
    return s;
  };

  const SOUTH = Math.PI / 2, NORTH = -Math.PI / 2;  // 朝南=+z，朝北=-z

  // ---- 魏军（北岸乌林，连环两排） ----
  const wei = [];
  const weiRow1 = [[-27, -52], [-9, -52], [9, -52], [27, -52]];
  const weiRow2 = [[-18, -66], [0, -66], [18, -66]];
  const row1Ships = weiRow1.map(([x, z]) => { const s = mk('louchuan', 'wei', x, z, SOUTH); wei.push(s); return s; });
  const row2Ships = weiRow2.map(([x, z], i) => { const s = mk('louchuan', 'wei', x, z, SOUTH, i === 1 ? 1.08 : 1); wei.push(s); return s; });
  for (const [x, z] of [[-46, -40], [-37, -44], [38, -42], [48, -40], [0, -38], [-8, -36]]) {
    wei.push(mk('oared', 'wei', x, z, SOUTH));
  }

  // 铁索：横排相邻相连
  const chains = [];
  for (const row of [row1Ships, row2Ships])
    for (let i = 0; i < row.length - 1; i++) chains.push(buildChain(scene, row[i], row[i + 1]));

  // ---- 吴军（南岸中路，周瑜旗舰） ----
  const wu = [];
  [[-32, 42, 1], [-12, 42, 1.06], [8, 42, 1]].forEach(([x, z, k]) => wu.push(mk('louchuan', 'wu', x, z, NORTH, k)));
  for (const [x, z] of [[-42, 54], [-22, 55], [0, 56], [16, 54]]) wu.push(mk('oared', 'wu', x, z, NORTH));

  // ---- 汉军（刘备，南岸东路） ----
  const shu = [];
  [[30, 46], [47, 46]].forEach(([x, z]) => shu.push(mk('louchuan', 'shu', x, z, NORTH)));
  for (const [x, z] of [[24, 58], [40, 59], [55, 57]]) shu.push(mk('oared', 'shu', x, z, NORTH));

  // ---- 黄盖火船队（列于联军阵线之前作先锋，北进时不穿越吴军本阵） ----
  const huangGai = [];
  [-34, -27, -20, -13, -6, 1].forEach((x, i) => huangGai.push(mk('fire', 'huang', x, 33 + (i % 2) * 3, NORTH)));

  /** 斩断与某船相连的铁索 */
  function breakChains(ship) {
    for (const c of chains) {
      if (c.broken || (c.a !== ship && c.b !== ship)) continue;
      c.broken = true;
      const p = new THREE.Vector3();
      c.mesh.getWorldPosition(p);
      effects.splash(new THREE.Vector3(p.x, env.WATER_Y, p.z), 0.8);
      scene.remove(c.mesh);
      c.mesh.geometry.dispose();
    }
  }

  /** 与某船以铁索相连的邻船（火势蔓延用） */
  function chainedNeighbors(ship) {
    const out = [];
    for (const c of chains) {
      if (c.broken) continue;
      if (c.a === ship) out.push(c.b);
      else if (c.b === ship) out.push(c.a);
    }
    return out;
  }

  /** 软性分离：航行中的船与邻船圆域重叠时横向推开，防止穿模
   *  例外：黄盖火船与魏船必须相撞引爆，该组合不分离 */
  function resolveOverlaps(dt) {
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (!b.alive) continue;
        if ((a.faction === 'huang' && b.faction === 'wei') ||
            (a.faction === 'wei' && b.faction === 'huang')) continue;
        const movingA = a.speed > 0.05, movingB = b.speed > 0.05;
        if (!movingA && !movingB) continue;         // 锚泊编队保持原位
        const dx = b.obj.position.x - a.obj.position.x;
        const dz = b.obj.position.z - a.obj.position.z;
        const R = (a.K.L + b.K.L) * 0.21;           // 近似圆域半径之和
        const d2 = dx * dx + dz * dz;
        if (d2 >= R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (R - d) * Math.min(dt * 1.6, 0.5) / d;
        // 双方都在动各让一半；一方锚泊则由动方避让
        const ka = movingA ? (movingB ? 0.5 : 1) : 0;
        const kb = movingB ? (movingA ? 0.5 : 1) : 0;
        a.obj.position.x -= dx * push * ka;
        a.obj.position.z -= dz * push * ka;
        b.obj.position.x += dx * push * kb;
        b.obj.position.z += dz * push * kb;
      }
    }
  }

  function update(dt, t) {
    for (const s of all) s.update(dt, t);
    resolveOverlaps(dt);
  }

  return { all, wei, wu, shu, huangGai, chains, breakChains, chainedNeighbors, update };
}
