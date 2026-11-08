// 人群：InstancedMesh 分部件实例化 + 区域游走 AI
import * as THREE from 'three';
import { P, ROBES, ROBES_RICH, pick } from './palette.js';
import { walkHeight, colliders, BRIDGE } from './layout.js';
import { getTexture } from './textures.js';

// 颜色压暗（襟边等配色用）
function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

const _m = new THREE.Matrix4();
const _mp = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// —— 游走区域（n 人数，mix 角色权重覆盖）——
const ZONES = [
  // 郊野
  { n: 14, x0: 25, x1: 295, z0: -7, z1: 7, walkP: 0.85 },                 // 官道行人
  { n: 8,  x0: 40, x1: 120, z0: -48, z1: -16, mix: 'farm' },              // 田间农夫
  { n: 7,  x0: 150, x1: 260, z0: 18, z1: 60, mix: 'farm' },
  { n: 7,  x0: 86, x1: 104, z0: 2, z1: 12, walkP: 0.25 },                 // 轿队歇脚
  // 汴河码头
  { n: 12, x0: 362, x1: 392, z0: -40, z1: -22, mix: 'dock', walkP: 0.8 }, // 码头力夫
  { n: 7,  x0: 362, x1: 378, z0: -22, z1: -8, walkP: 0.2 },               // 排档歇脚
  { n: 8,  x0: 315, x1: 360, z0: 6, z1: 20, walkP: 0.5 },                 // 茶肆街
  // 虹桥
  { n: 30, x0: BRIDGE.x0 + 4, x1: BRIDGE.x1 - 4, z0: -4.6, z1: 4.6, walkP: 0.6 },  // 桥上人流
  { n: 8,  x0: BRIDGE.x0 + 6, x1: BRIDGE.x1 - 6, z0: -5.4, z1: -4.4, walkP: 0.05, face: -1 }, // 扶栏观船
  { n: 6,  x0: 486, x1: 520, z0: -12, z1: -4, walkP: 0.5 },               // 脚店门前
  { n: 10, x0: 488, x1: 552, z0: 4, z1: 14, walkP: 0.7 },
  { n: 6,  x0: 370, x1: 386, z0: 2, z1: 12, walkP: 0.6 },                 // 西桥头
  // 城门内外
  { n: 10, x0: 620, x1: 700, z0: -6, z1: 6, walkP: 0.9 },                 // 穿门人流
  { n: 6,  x0: 668, x1: 692, z0: 8, z1: 18, walkP: 0.3, mix: 'dock' },    // 税务所争执
  // 城内
  { n: 38, x0: 700, x1: 940, z0: -9, z1: 9, walkP: 0.85 },                // 大街人流
  { n: 8,  x0: 666, x1: 700, z0: -8, z1: 8, walkP: 0.7 },                 // 门内广场
  { n: 14, x0: 750, x1: 786, z0: -12, z1: -2, walkP: 0.4 },               // 孙羊正店门前
  { n: 8,  x0: 830, x1: 850, z0: -16, z1: -6, walkP: 0.3 },               // 饮子摊
  { n: 5,  x0: 852, x1: 862, z0: -14, z1: -8, walkP: 0.15 },              // 卦摊排队
  { n: 8,  x0: 845, x1: 860, z0: -60, z1: 60, walkP: 0.8 },               // 十字街南北向
  { n: 8,  x0: 900, x1: 940, z0: -14, z1: 6, walkP: 0.5 },                // 赵太丞家候诊
];

// —— 定点人物（位置/朝向固定）——
const FIXED = [
  // 虹桥顶：轿马争道（文轿在西，武马在东，仆从对峙）
  { x: 431, z: 0.8, yaw: -1.5, role: 'rich' },
  { x: 432.5, z: -0.6, yaw: -1.6, role: 'worker' },
  { x: 433.5, z: 1.2, yaw: -1.7, role: 'worker' },
  { x: 440, z: 0.2, yaw: 1.6, role: 'rich' },
  { x: 438.6, z: -1.0, yaw: 1.5, role: 'worker' },
  { x: 438.2, z: 1.4, yaw: 1.4, role: 'worker' },
  // 纤夫（西岸，停步回望）
  { x: 392, z: -56, yaw: 2.6, role: 'worker', lean: 0.3 },
  { x: 390.5, z: -61, yaw: 2.7, role: 'worker', lean: 0.32 },
  { x: 389, z: -66, yaw: 2.5, role: 'worker', lean: 0.3 },
  { x: 387.5, z: -71, yaw: 2.8, role: 'worker', lean: 0.34 },
  { x: 386, z: -76, yaw: 2.6, role: 'worker', lean: 0.3 },
  // 码头监工（发竹签）
  { x: 384, z: -26, yaw: -2.2, role: 'townsman' },
  // 卦摊先生
  { x: 858, z: -13.5, yaw: 0.1, role: 'townsman' },
  // 饮子摊主
  { x: 840, z: -14.2, yaw: 0.2, role: 'townsman' },
  // 孙羊正店门口伙计
  { x: 764, z: -11.5, yaw: 0.3, role: 'worker' },
  { x: 772, z: -11.8, yaw: -0.4, role: 'worker' },
  // 城楼上的更夫
  { x: 655, z: -4, yaw: 0.9, role: 'worker', y: 14.4 },
  // 望火楼下歇脚兵（望火楼在城门内东北侧）
  { x: 691.5, z: 34.5, yaw: 2.2, role: 'worker' },
  // 税吏
  { x: 678, z: 13, yaw: -0.6, role: 'rich' },
  // 孙羊正店楼上推杯换盏的客人（二、三层挑台）
  { x: 764.5, z: -17.1, yaw: 0.2, role: 'rich', y: 3.71 },
  { x: 771, z: -17.1, yaw: -0.3, role: 'townsman', y: 3.71 },
  { x: 768, z: -17.2, yaw: 0.1, role: 'rich', y: 7.01 },
  // 新酒旗下执扇士人（"新酒之谜"旁证）
  { x: 513, z: -9.5, yaw: -0.7, role: 'rich', fan: true },
];

function makeRole(mix) {
  const r = Math.random();
  if (mix === 'farm') return r < 0.8 ? 'worker' : 'townsman';
  if (mix === 'dock') return r < 0.92 ? 'worker' : 'townsman';
  if (r < 0.42) return 'worker';
  if (r < 0.72) return 'townsman';
  if (r < 0.8) return 'rich';
  if (r < 0.88) return 'woman';
  return 'child';
}

export class Crowd {
  constructor(scene) {
    const people = [];

    const spawn = (zone) => {
      for (let i = 0; i < zone.n; i++) {
        const role = makeRole(zone.mix);
        let x, z, tries = 0;
        do {
          x = zone.x0 + Math.random() * (zone.x1 - zone.x0);
          z = zone.z0 + Math.random() * (zone.z1 - zone.z0);
          tries++;
        } while (tries < 12 && (walkHeight(x, z) === null || inCollider(x, z)));
        people.push(makePerson(role, x, z, {
          zone,
          walker: Math.random() < (zone.walkP ?? 0.6),
          faceZ: zone.face,
        }));
      }
    };
    for (const z of ZONES) spawn(z);
    for (const f of FIXED) {
      const p = makePerson(f.role, f.x, f.z, { fixed: true });
      p.yaw = f.yaw;
      p.lean = f.lean || 0;
      p.fixedY = f.y;
      p.fan = !!f.fan;
      people.push(p);
    }

    // —— 十千脚店送餐伙计（一手托盘两碗、一手持箸，快步往返送餐）——
    const courier = makePerson('worker', 504, -10.5, {});
    courier.tray = true; courier.hat = 'cap'; courier.carrier = false;
    courier.shuttle = { ax: 504, az: -10.5, bx: 521, bz: -7.5, toB: true, wait: 1.4 };
    courier.walking = true; courier.tx = 521; courier.tz = -7.5; courier.speed = 1.75;
    people.push(courier);

    // —— 码头背粮力夫（背着粮袋，踩着跳板来来回回）——
    for (const zz of [-30.5, -35.5]) {
      const porter = makePerson('worker', 380, zz, {});
      porter.backSack = true; porter.carrier = false; porter.lean = 0.14; porter.hat = 'none';
      porter.shuttle = { ax: 372.5, az: zz, bx: 388.2, bz: zz, toB: true, wait: 0.9 };
      porter.walking = true; porter.tx = 388.2; porter.tz = zz; porter.speed = 1.25;
      people.push(porter);
    }

    this.people = people;
    this.externals = [];
    const N = people.length + 20;   // 预留外部驱动名额
    this.N = N;

    // —— 部件几何（单位人坐标系）——
    const robeGeo = new THREE.CylinderGeometry(0.15, 0.31, 1.12, 7);
    robeGeo.translate(0, 0.61, 0);
    const headGeo = new THREE.SphereGeometry(0.125, 7, 6);
    headGeo.translate(0, 1.34, 0);
    const strawGeo = new THREE.ConeGeometry(0.3, 0.14, 8);
    strawGeo.translate(0, 1.5, 0);
    const capGeo = new THREE.BoxGeometry(0.19, 0.15, 0.21);
    capGeo.translate(0, 1.5, 0);
    const armGeo = new THREE.BoxGeometry(0.085, 0.46, 0.085);
    armGeo.translate(0, -0.2, 0);      // 原点在肩
    const legGeo = new THREE.BoxGeometry(0.1, 0.52, 0.1);
    legGeo.translate(0, -0.24, 0);     // 原点在胯
    const poleGeo = new THREE.BoxGeometry(1.5, 0.045, 0.05);
    const basketGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.14, 6);
    // —— 北宋服饰部件 ——
    const futouCapGeo = new THREE.BoxGeometry(0.2, 0.17, 0.22);    // 幞头（展脚）
    futouCapGeo.translate(0, 1.5, 0);
    const futouWingGeo = new THREE.BoxGeometry(0.56, 0.035, 0.07);
    futouWingGeo.translate(0, 1.55, 0);
    const bunGeo = new THREE.SphereGeometry(0.075, 6, 5);          // 女子发髻
    bunGeo.translate(0, 1.49, 0);
    const sashGeo = new THREE.BoxGeometry(0.4, 0.09, 0.42);        // 腰带
    sashGeo.translate(0, 0.98, 0);
    const fanGeo = new THREE.BoxGeometry(0.035, 0.5, 0.3);         // 团扇（原点在扇柄）
    fanGeo.translate(0, 0.25, 0);
    const trayGeo = new THREE.BoxGeometry(0.52, 0.045, 0.36);      // 托盘
    const bowlGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.075, 6); // 碗
    // —— 宋式服装细部 ——
    const collarGeo = new THREE.BoxGeometry(0.055, 0.5, 0.02);     // 交领襟带（右衽）
    const hemGeo = new THREE.BoxGeometry(0.6, 0.07, 0.62);         // 襕衫下襕
    hemGeo.translate(0, 0.28, 0);
    const sleeveGeo = new THREE.BoxGeometry(0.17, 0.52, 0.17);     // 宽袖（原点在肩）
    sleeveGeo.translate(0, -0.22, 0);

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const matCloth = new THREE.MeshLambertMaterial({ color: 0xffffff, map: getTexture('robe') });     // 麻布
    const matBrocade = new THREE.MeshLambertMaterial({ color: 0xffffff, map: getTexture('brocade') }); // 织锦
    const mk = (geo, count, m = mat) => {
      const im = new THREE.InstancedMesh(geo, m, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      im.frustumCulled = false;
      scene.add(im);
      return im;
    };
    this.robe = mk(robeGeo, N, matCloth);
    this.robeBrocade = mk(robeGeo, N, matBrocade);   // 士人锦袍（同为袍形，换织锦贴图）
    this.head = mk(headGeo, N);
    this.straw = mk(strawGeo, N);
    this.cap = mk(capGeo, N);
    this.arms = mk(armGeo, N * 2);
    this.legs = mk(legGeo, N * 2);
    this.pole = mk(poleGeo, N);
    this.basket = mk(basketGeo, N * 2);
    this.futouCap = mk(futouCapGeo, N);
    this.futouWing = mk(futouWingGeo, N);
    this.bun = mk(bunGeo, N);
    this.sash = mk(sashGeo, N);
    this.fan = mk(fanGeo, N);
    this.tray = mk(trayGeo, N);
    this.bowls = mk(bowlGeo, N * 2);
    this.collarL = mk(collarGeo, N, matCloth);
    this.collarR = mk(collarGeo, N, matCloth);
    this.hem = mk(hemGeo, N, matCloth);
    this.sleeve = mk(sleeveGeo, N * 2, matCloth);

    // 颜色
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      this.robe.setColorAt(i, _c.set(p.robeColor));
      this.arms.setColorAt(i * 2, _c);
      this.arms.setColorAt(i * 2 + 1, _c);
      this.head.setColorAt(i, _c.set(p.skinColor));
      this.legs.setColorAt(i * 2, _c.set(p.pantsColor));
      this.legs.setColorAt(i * 2 + 1, _c);
      this.straw.setColorAt(i, _c.set(p.strawColor));
      this.cap.setColorAt(i, _c.set(p.capColor));
      this.pole.setColorAt(i, _c.set(P.woodDark));
      this.basket.setColorAt(i * 2, _c.set(P.rope));
      this.basket.setColorAt(i * 2 + 1, _c);
      this.futouCap.setColorAt(i, _c.set(P.hatBlack));
      this.futouWing.setColorAt(i, _c);
      this.bun.setColorAt(i, _c.set(0x241c12));
      this.sash.setColorAt(i, _c.set(p.sashColor));
      this.fan.setColorAt(i, _c.set(0xe8dcb8));
      this.tray.setColorAt(i, _c.set(P.woodDark));
      this.bowls.setColorAt(i * 2, _c.set(0xd8d0c0));
      this.bowls.setColorAt(i * 2 + 1, _c);
      this.robeBrocade.setColorAt(i, _c.set(p.robeColor));
      this.collarL.setColorAt(i, _c.set(p.collarColor));
      this.collarR.setColorAt(i, _c);
      this.hem.setColorAt(i, _c.set(p.sashColor));
      this.sleeve.setColorAt(i * 2, _c.set(p.robeColor));
      this.sleeve.setColorAt(i * 2 + 1, _c);
    }
    this.robe.instanceColor.needsUpdate = true;
  }

  // 外部驱动的人（驼队驭手等）
  addExternal(role) {
    const idx = this.people.length + this.externals.length;
    if (idx >= this.N) return -1;
    const p = makePerson(role, 0, 0, { fixed: true });
    p.external = true;
    this.externals.push(p);
    this.robe.setColorAt(idx, _c.set(p.robeColor));
    this.arms.setColorAt(idx * 2, _c);
    this.arms.setColorAt(idx * 2 + 1, _c);
    this.head.setColorAt(idx, _c.set(p.skinColor));
    this.legs.setColorAt(idx * 2, _c.set(p.pantsColor));
    this.legs.setColorAt(idx * 2 + 1, _c);
    this.straw.setColorAt(idx, _c.set(p.strawColor));
    this.cap.setColorAt(idx, _c.set(p.capColor));
    this.futouCap.setColorAt(idx, _c.set(P.hatBlack));
    this.futouWing.setColorAt(idx, _c);
    this.bun.setColorAt(idx, _c.set(0x241c12));
    this.sash.setColorAt(idx, _c.set(p.sashColor));
    this.fan.setColorAt(idx, _c.set(0xe8dcb8));
    this.tray.setColorAt(idx, _c.set(P.woodDark));
    this.bowls.setColorAt(idx * 2, _c.set(0xd8d0c0));
    this.bowls.setColorAt(idx * 2 + 1, _c);
    this.robeBrocade.setColorAt(idx, _c.set(p.robeColor));
    this.collarL.setColorAt(idx, _c.set(p.collarColor));
    this.collarR.setColorAt(idx, _c);
    this.hem.setColorAt(idx, _c.set(p.sashColor));
    this.sleeve.setColorAt(idx * 2, _c.set(p.robeColor));
    this.sleeve.setColorAt(idx * 2 + 1, _c);
    return this.externals.length - 1;
  }
  setExternal(i, x, z, yaw, walking) {
    const p = this.externals[i];
    if (!p) return;
    p.x = x; p.z = z; p.yaw = yaw; p.walking = walking;
  }

  update(dt, t, camPos) {
    const all = this.people.concat(this.externals);
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const distSq = (p.x - camPos.x) ** 2 + (p.z - camPos.z) ** 2;
      if (!p.external) updateAI(p, dt, distSq);
      writeMatrices(this, i, p, t, distSq);
    }
    this.robe.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.straw.instanceMatrix.needsUpdate = true;
    this.cap.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
    this.legs.instanceMatrix.needsUpdate = true;
    this.pole.instanceMatrix.needsUpdate = true;
    this.basket.instanceMatrix.needsUpdate = true;
    this.futouCap.instanceMatrix.needsUpdate = true;
    this.futouWing.instanceMatrix.needsUpdate = true;
    this.bun.instanceMatrix.needsUpdate = true;
    this.sash.instanceMatrix.needsUpdate = true;
    this.fan.instanceMatrix.needsUpdate = true;
    this.tray.instanceMatrix.needsUpdate = true;
    this.bowls.instanceMatrix.needsUpdate = true;
    this.robeBrocade.instanceMatrix.needsUpdate = true;
    this.collarL.instanceMatrix.needsUpdate = true;
    this.collarR.instanceMatrix.needsUpdate = true;
    this.hem.instanceMatrix.needsUpdate = true;
    this.sleeve.instanceMatrix.needsUpdate = true;
    this.robe.count = this.head.count = this.straw.count = this.cap.count = this.pole.count = all.length;
    this.futouCap.count = this.futouWing.count = this.bun.count = this.sash.count = this.fan.count = this.tray.count = all.length;
    this.robeBrocade.count = this.collarL.count = this.collarR.count = this.hem.count = all.length;
    this.arms.count = this.legs.count = this.basket.count = this.bowls.count = this.sleeve.count = all.length * 2;
  }
}

function inCollider(x, z) {
  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
  }
  return false;
}

function makePerson(role, x, z, opts = {}) {
  const p = {
    role, x, z, yaw: Math.random() * Math.PI * 2,
    zone: opts.zone || null,
    fixed: !!opts.fixed,
    walker: !!opts.walker,
    faceZ: opts.faceZ || 0,
    walking: false,
    tx: x, tz: z,
    wait: Math.random() * 4,
    phase: Math.random() * 10,
    seed: Math.random() * 100,
    lean: 0,
    speed: 0.9 + Math.random() * 0.5,
    s: 0.92 + Math.random() * 0.14,
    shortRobe: false, carrier: false, hat: 'none',
    sash: false, fan: false, tray: false, backSack: false, shuttle: null,
    robeColor: pick(ROBES), skinColor: P.skin, pantsColor: pick([0x4a4238, 0x5a5044, 0x6a5c48]),
    strawColor: P.hatStraw, capColor: P.hatBlack, sashColor: 0x5a5244,
    fixedY: undefined,
  };
  switch (role) {
    case 'worker':
      p.shortRobe = true;
      p.hat = Math.random() < 0.45 ? 'straw' : (Math.random() < 0.25 ? 'cap' : 'none');
      p.carrier = Math.random() < 0.3;
      p.speed *= 1.15;
      break;
    case 'townsman':
      p.hat = Math.random() < 0.5 ? 'cap' : (Math.random() < 0.35 ? 'futou' : 'none');
      p.sash = Math.random() < 0.6;
      p.sashColor = pick([0x5a5244, 0x6a5a48, 0x4a4a52]);
      break;
    case 'rich':
      p.robeColor = pick(ROBES_RICH);
      p.hat = 'futou';          // 展脚幞头，宋代士人标识
      p.sash = true;
      p.sashColor = pick([0x7a2e22, 0x5a3a28]);
      p.speed *= 0.8;
      break;
    case 'hu':                  // 胡人驭手：尖顶毡帽、深色袍、虬髯面色
      p.robeColor = pick([0x4a3c30, 0x54452e, 0x3e4a42]);
      p.skinColor = 0xb08a62;
      p.hat = 'hu';
      p.strawColor = 0x4a3a28;
      break;
    case 'woman':
      p.robeColor = pick([0x9a8ea0, 0xa89a86, 0x8a9a90, 0xb0a090, 0x968878]);
      p.hat = Math.random() < 0.7 ? 'bun' : 'none';  // 发髻
      p.sash = true;
      p.sashColor = pick([0x8a5a48, 0x6a4a52]);
      p.speed *= 0.85;
      break;
    case 'child':
      p.s = 0.52 + Math.random() * 0.1;
      p.shortRobe = true;
      p.speed *= 1.35;
      p.hat = 'none';
      break;
  }
  if (role === 'woman' && p.hat === 'cap') p.capColor = 0x2a2018;
  p.collarColor = shade(p.robeColor, 0.72);   // 襟边用同料深色
  return p;
}

function updateAI(p, dt, distSq) {
  if (p.fixed) return;
  // 定点往返人物（送餐伙计、背粮力夫）：路径已避开碰撞与水面
  if (p.shuttle) {
    if (distSq > 22500 && Math.random() < 0.7) return;
    if (p.walking) {
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) {
        const s = p.shuttle;
        s.toB = !s.toB;
        p.tx = s.toB ? s.bx : s.ax;
        p.tz = s.toB ? s.bz : s.az;
        p.walking = false;
        p.wait = s.wait;
      } else {
        const step = p.speed * dt;
        p.x += dx / d * step;
        p.z += dz / d * step;
        p.yaw = Math.atan2(dx, dz);
        p.phase += dt * p.speed * 5.2;
      }
    } else {
      p.wait -= dt;
      if (p.wait <= 0) p.walking = true;
    }
    return;
  }
  // 远处的人降频（粗略：跳过部分帧）
  if (distSq > 22500 && Math.random() < 0.7) return;

  if (p.walking) {
    const dx = p.tx - p.x, dz = p.tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) {
      p.walking = false;
      p.wait = 1.5 + Math.random() * 5;
    } else {
      const step = p.speed * dt;
      const nx = p.x + dx / d * step;
      const nz = p.z + dz / d * step;
      if (walkHeight(nx, nz) === null || inCollider(nx, nz)) {
        p.walking = false;
        p.wait = 0.5 + Math.random();
      } else {
        p.x = nx; p.z = nz;
        p.yaw = Math.atan2(dx, dz);
        p.phase += dt * p.speed * 5.2;
      }
    }
  } else {
    p.wait -= dt;
    if (p.wait <= 0 && p.walker && p.zone) {
      const z = p.zone;
      p.tx = z.x0 + Math.random() * (z.x1 - z.x0);
      p.tz = z.z0 + Math.random() * (z.z1 - z.z0);
      p.walking = true;
    } else if (p.faceZ) {
      p.yaw = p.faceZ > 0 ? 0 : Math.PI;   // 面向指定方向（扶栏看河）
    }
  }
}

function writeMatrices(crowd, i, p, t, distSq) {
  const y = p.fixedY !== undefined ? p.fixedY : (walkHeight(p.x, p.z) ?? 0);
  const near = distSq < 32400;   // 180m 内做全套动画

  const swing = p.walking && near ? Math.sin(p.phase) * 0.55 : 0;
  const bob = p.walking && near ? Math.abs(Math.sin(p.phase)) * 0.05 : 0;
  const sway = !p.walking && near ? Math.sin(t * 1.1 + p.seed) * 0.025 : 0;
  const lean = p.lean + (p.walking ? 0.06 : 0) + (p.carrier ? 0.1 : 0);

  _e.set(lean, p.yaw, sway);
  _q.setFromEuler(_e);
  _v.set(p.x, y + bob, p.z);
  _s.set(p.s, p.s, p.s);
  _mp.compose(_v, _q, _s);

  // 袍/上衣（士人着团花织锦襕衫，平民着麻布）
  const zero = ZERO;
  const richRobe = p.role === 'rich' && !p.shortRobe;
  if (p.shortRobe) {
    _m.copy(_mp).multiply(_t(0, 0.86, 0)).multiply(_sc(1, 0.52, 1)).multiply(_t(0, -0.61, 0));
    crowd.robe.setMatrixAt(i, _m);
    crowd.robeBrocade.setMatrixAt(i, _m.copy(_mp).multiply(zero));
  } else if (richRobe) {
    crowd.robe.setMatrixAt(i, _m.copy(_mp).multiply(zero));
    crowd.robeBrocade.setMatrixAt(i, _mp);
  } else {
    crowd.robe.setMatrixAt(i, _mp);
    crowd.robeBrocade.setMatrixAt(i, _m.copy(_mp).multiply(zero));
  }
  // 头
  crowd.head.setMatrixAt(i, _mp);
  // 首服：草帽/胡人毡帽 / 襆头纱帽 / 展脚幞头 / 女子发髻
  crowd.straw.setMatrixAt(i, (p.hat === 'straw' || p.hat === 'hu') ? _mp : _m.copy(_mp).multiply(zero));
  crowd.cap.setMatrixAt(i, p.hat === 'cap' ? _mp : _m.copy(_mp).multiply(zero));
  crowd.futouCap.setMatrixAt(i, p.hat === 'futou' ? _mp : _m.copy(_mp).multiply(zero));
  crowd.futouWing.setMatrixAt(i, p.hat === 'futou' ? _mp : _m.copy(_mp).multiply(zero));
  crowd.bun.setMatrixAt(i, p.hat === 'bun' ? _mp : _m.copy(_mp).multiply(zero));
  // 腰带（长袍人物）
  crowd.sash.setMatrixAt(i, p.sash && !p.shortRobe ? _mp : _m.copy(_mp).multiply(zero));
  // 交领右衽（长袍人物，双襟交叠）
  if (!p.shortRobe) {
    _mL.copy(_mp).multiply(_t(-0.01, 1.05, 0.165)).multiply(_rx(-0.08)).multiply(_rz(0.44));
    crowd.collarL.setMatrixAt(i, _mL);
    _mR.copy(_mp).multiply(_t(0.01, 1.05, 0.175)).multiply(_rx(-0.08)).multiply(_rz(-0.44));
    crowd.collarR.setMatrixAt(i, _mR);
  } else {
    crowd.collarL.setMatrixAt(i, _m.copy(_mp).multiply(zero));
    crowd.collarR.setMatrixAt(i, _m.copy(_mp).multiply(zero));
  }
  // 襕衫下襕（士人）
  crowd.hem.setMatrixAt(i, richRobe ? _mp : _m.copy(_mp).multiply(zero));
  // 手臂/宽袖（士人圆领大袖；挑夫扶担、送餐平端托盘、执扇抬手）
  if (p.carrier) {
    _mL.copy(_mp).multiply(_t(-0.27, 1.14, 0)).multiply(_rz(0.9)).multiply(_rx(-0.4));
    _mR.copy(_mp).multiply(_t(0.27, 1.14, 0)).multiply(_rx(-swing * 0.6));
  } else if (p.tray) {
    _mL.copy(_mp).multiply(_t(-0.27, 1.14, 0)).multiply(_rx(-0.5));
    _mR.copy(_mp).multiply(_t(0.27, 1.14, 0)).multiply(_rx(-1.05));
  } else if (p.fan) {
    _mL.copy(_mp).multiply(_t(-0.27, 1.14, 0)).multiply(_rx(swing));
    _mR.copy(_mp).multiply(_t(0.27, 1.14, 0)).multiply(_rx(-0.95));
  } else {
    _mL.copy(_mp).multiply(_t(-0.27, 1.14, 0)).multiply(_rx(swing));
    _mR.copy(_mp).multiply(_t(0.27, 1.14, 0)).multiply(_rx(-swing));
  }
  if (richRobe) {
    crowd.arms.setMatrixAt(i * 2, _m.copy(_mp).multiply(zero));
    crowd.arms.setMatrixAt(i * 2 + 1, _m.copy(_mp).multiply(zero));
    crowd.sleeve.setMatrixAt(i * 2, _mL);
    crowd.sleeve.setMatrixAt(i * 2 + 1, _mR);
  } else {
    crowd.sleeve.setMatrixAt(i * 2, _m.copy(_mp).multiply(zero));
    crowd.sleeve.setMatrixAt(i * 2 + 1, _m.copy(_mp).multiply(zero));
    crowd.arms.setMatrixAt(i * 2, _mL);
    crowd.arms.setMatrixAt(i * 2 + 1, _mR);
  }
  // 腿
  if (p.shortRobe) {
    _m.copy(_mp).multiply(_t(-0.1, 0.62, 0)).multiply(_rx(-swing));
    crowd.legs.setMatrixAt(i * 2, _m);
    _m.copy(_mp).multiply(_t(0.1, 0.62, 0)).multiply(_rx(swing));
    crowd.legs.setMatrixAt(i * 2 + 1, _m);
  } else {
    crowd.legs.setMatrixAt(i * 2, _m.copy(_mp).multiply(zero));
    crowd.legs.setMatrixAt(i * 2 + 1, _m.copy(_mp).multiply(zero));
  }
  // 扁担与筐（背粮力夫则背驮粮袋）
  if (p.carrier) {
    _m.copy(_mp).multiply(_t(0, 1.32, 0)).multiply(_rz(Math.sin(p.phase * 0.5) * 0.04));
    crowd.pole.setMatrixAt(i, _m);
    const dip = Math.sin(p.phase) * 0.06;
    _m.copy(_mp).multiply(_t(-0.68, 0.92 + dip, 0));
    crowd.basket.setMatrixAt(i * 2, _m);
    _m.copy(_mp).multiply(_t(0.68, 0.92 - dip, 0));
    crowd.basket.setMatrixAt(i * 2 + 1, _m);
  } else if (p.backSack) {
    crowd.pole.setMatrixAt(i, _m.copy(_mp).multiply(zero));
    _m.copy(_mp).multiply(_t(0, 1.04, -0.3)).multiply(_rx(-0.25)).multiply(_sc(1.55, 1.6, 1.55));
    crowd.basket.setMatrixAt(i * 2, _m);
    crowd.basket.setMatrixAt(i * 2 + 1, _m.copy(_mp).multiply(zero));
  } else {
    crowd.pole.setMatrixAt(i, _m.copy(_mp).multiply(zero));
    crowd.basket.setMatrixAt(i * 2, _m.copy(_mp).multiply(zero));
    crowd.basket.setMatrixAt(i * 2 + 1, _m.copy(_mp).multiply(zero));
  }
  // 托盘与两碗（送餐伙计）
  if (p.tray) {
    _m.copy(_mp).multiply(_t(0.29, 1.07, 0.47));
    crowd.tray.setMatrixAt(i, _m);
    _m.copy(_mp).multiply(_t(0.17, 1.13, 0.4));
    crowd.bowls.setMatrixAt(i * 2, _m);
    _m.copy(_mp).multiply(_t(0.41, 1.13, 0.54));
    crowd.bowls.setMatrixAt(i * 2 + 1, _m);
  } else {
    crowd.tray.setMatrixAt(i, _m.copy(_mp).multiply(zero));
    crowd.bowls.setMatrixAt(i * 2, _m.copy(_mp).multiply(zero));
    crowd.bowls.setMatrixAt(i * 2 + 1, _m.copy(_mp).multiply(zero));
  }
  // 团扇（执扇士人）
  if (p.fan) {
    _m.copy(_mp).multiply(_t(0.34, 1.02, 0.28)).multiply(_rx(0.25)).multiply(_rz(-0.2));
    crowd.fan.setMatrixAt(i, _m);
  } else {
    crowd.fan.setMatrixAt(i, _m.copy(_mp).multiply(zero));
  }
}

// —— 小工具矩阵 ——
const _tm = new THREE.Matrix4();
const _tm2 = new THREE.Matrix4();
const _mL = new THREE.Matrix4();
const _mR = new THREE.Matrix4();
const ZERO = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
function _t(x, y, z) { return _tm.makeTranslation(x, y, z); }
function _rx(a) { return _tm2.makeRotationX(a); }
function _rz(a) { return _tm2.makeRotationZ(a); }
function _sc(x, y, z) { return _tm2.makeScale(x, y, z); }
