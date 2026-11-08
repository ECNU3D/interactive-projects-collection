// 动物：驴队、骆驼商队、马、牛、猪、狗（四足步态）
import * as THREE from 'three';
import { P, vary } from './palette.js';

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.castShadow = true;
  return m;
}
function sphere(r, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), new THREE.MeshLambertMaterial({ color }));
  m.castShadow = true;
  return m;
}

/* 通用四足动物
   spec: {bodyL, bodyH, bodyW, legH, legR, neckL, neckUp, headS, color, dark, ears, horns, humps, tailUp, load} */
function quadruped(spec) {
  const g = new THREE.Group();
  const c = spec.color, cd = spec.dark || c;
  const body = box(spec.bodyL, spec.bodyH, spec.bodyW, c);
  body.position.y = spec.legH + spec.bodyH / 2;
  g.add(body);

  // 颈 + 头
  const neck = box(spec.neckL, 0.14, 0.14, c);
  neck.position.set(spec.bodyL / 2 + spec.neckL * 0.3, spec.legH + spec.bodyH * 0.8 + spec.neckUp * 0.5, 0);
  neck.rotation.z = -spec.neckUp;
  g.add(neck);
  const head = box(spec.headS * 1.5, spec.headS, spec.headS * 0.8, cd);
  head.position.set(spec.bodyL / 2 + spec.neckL * 0.75, spec.legH + spec.bodyH * 0.8 + spec.neckUp * spec.neckL * 0.8, 0);
  g.add(head);
  g.userData.head = head;

  // 耳
  if (spec.ears) {
    for (const s of [-1, 1]) {
      const ear = box(0.05, spec.ears, 0.05, cd);
      ear.position.set(head.position.x - spec.headS * 0.4, head.position.y + spec.headS * 0.7 + spec.ears / 2, s * spec.headS * 0.35);
      g.add(ear);
    }
  }
  // 角
  if (spec.horns) {
    for (const s of [-1, 1]) {
      const horn = box(0.06, 0.06, spec.horns, 0xd8ccb0);
      horn.position.set(head.position.x - spec.headS * 0.3, head.position.y + spec.headS * 0.6, s * spec.horns * 0.5);
      horn.rotation.x = s * 0.5;
      g.add(horn);
    }
  }
  // 驼峰
  if (spec.humps) {
    for (let i = 0; i < spec.humps; i++) {
      const hump = sphere(spec.bodyW * 0.42, cd);
      hump.position.set((i - (spec.humps - 1) / 2) * spec.bodyL * 0.32, spec.legH + spec.bodyH + spec.bodyW * 0.2, 0);
      hump.scale.y = 1.2;
      g.add(hump);
    }
  }
  // 鞍鞯（鞍垫 + 鞍）
  if (spec.saddle) {
    const pad = box(spec.bodyL * 0.44, 0.08, spec.bodyW + 0.16, spec.blanket || 0x7a3a2e);
    pad.position.set(0, spec.legH + spec.bodyH + 0.04, 0);
    g.add(pad);
    const saddle = box(0.46, 0.13, 0.38, spec.dark);
    saddle.position.set(0, spec.legH + spec.bodyH + 0.14, 0);
    g.add(saddle);
  }
  // 鬃毛（沿颈脊一排）
  if (spec.mane) {
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      const mane = box(0.07, 0.17, 0.05, spec.dark);
      mane.position.set(
        (spec.bodyL / 2 + spec.neckL * 0.22) * (1 - t) + (head.position.x - 0.06) * t,
        (spec.legH + spec.bodyH * 1.0) * (1 - t) + (head.position.y + spec.headS * 0.35) * t,
        0
      );
      mane.rotation.z = -spec.neckUp * 0.6;
      g.add(mane);
    }
  }
  // 驼队毡毯 + 驮架 + 货卷（丝绸之路商队装束）
  if (spec.pack) {
    const blanket = box(spec.bodyL * 0.74, 0.07, spec.bodyW + 0.2, 0x8a4a34);
    blanket.position.set(0, spec.legH + spec.bodyH + 0.02, 0);
    g.add(blanket);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.75, 7), new THREE.MeshLambertMaterial({ color: 0x9a7a52 }));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, spec.legH + spec.bodyH + spec.bodyW * 0.2 + 0.3, 0);
    roll.castShadow = true;
    g.add(roll);
    for (const s of [-1, 1]) {
      const rail = box(spec.bodyL * 0.6, 0.05, 0.06, 0x5a4028);
      rail.position.set(0, spec.legH + spec.bodyH * 0.72, s * (spec.bodyW / 2 + 0.24));
      g.add(rail);
    }
  }
  // 驮架（木炭驮驴的木鞍架）
  if (spec.rack) {
    const rack = box(0.6, 0.06, spec.bodyW + 0.3, 0x5a4028);
    rack.position.set(0, spec.legH + spec.bodyH + 0.03, 0);
    g.add(rack);
    for (const s of [-1, 1]) {
      const slat = box(0.06, 0.05, spec.bodyW + 0.36, 0x5a4028);
      slat.position.set(s * 0.2, spec.legH + spec.bodyH + 0.06, 0);
      g.add(slat);
    }
  }
  // 驮货
  if (spec.load) {
    for (const s of [-1, 1]) {
      const bag = box(spec.bodyL * 0.5, spec.bodyH * 0.6, 0.22, spec.load);
      bag.position.set(0, spec.legH + spec.bodyH * 0.9, s * (spec.bodyW / 2 + 0.12));
      g.add(bag);
    }
  }
  // 尾
  const tailLen = spec.tailUp ? 0.28 : (spec.tailLong ? 0.62 : 0.4);
  const tail = box(0.05, tailLen, 0.05, cd);
  tail.position.set(-spec.bodyL / 2, spec.legH + spec.bodyH * (spec.tailUp ? 1.0 : 0.6), 0);
  tail.rotation.z = spec.tailUp ? 0.6 : 0.15;
  g.add(tail);

  // 四腿（原点在髋）
  const legs = [];
  const legGeoH = spec.legH + spec.bodyH * 0.3;
  for (const [fx, fz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = box(spec.legR, legGeoH, spec.legR, cd);
    leg.geometry.translate(0, -legGeoH / 2 + 0.02, 0);
    leg.position.set(fx * (spec.bodyL / 2 - spec.legR), spec.legH + spec.bodyH * 0.3, fz * (spec.bodyW / 2 - spec.legR * 0.6));
    g.add(leg);
    legs.push(leg);
  }
  g.userData.legs = legs;
  g.userData.phase = Math.random() * 10;
  return g;
}

const SPECS = {
  donkey: { bodyL: 1.15, bodyH: 0.55, bodyW: 0.42, legH: 0.62, legR: 0.09, neckL: 0.5, neckUp: 0.7, headS: 0.24, color: P.donkey, dark: P.donkeyD, ears: 0.22, load: 0x3a332c, rack: true },
  camel:  { bodyL: 1.9, bodyH: 0.85, bodyW: 0.62, legH: 1.15, legR: 0.12, neckL: 0.95, neckUp: 1.0, headS: 0.26, color: P.camel, dark: P.camelD, ears: 0.08, humps: 2, load: 0x7a5a38, pack: true },
  horse:  { bodyL: 1.5, bodyH: 0.65, bodyW: 0.5, legH: 0.95, legR: 0.09, neckL: 0.7, neckUp: 0.9, headS: 0.26, color: P.horse, dark: P.horseD, ears: 0.12, saddle: true, mane: true, tailLong: true, blanket: 0x7a3a2e },
  ox:     { bodyL: 1.6, bodyH: 0.8, bodyW: 0.66, legH: 0.65, legR: 0.13, neckL: 0.45, neckUp: 0.25, headS: 0.3, color: P.ox, dark: 0x4a3c2e, horns: 0.3 },
  pig:    { bodyL: 0.95, bodyH: 0.5, bodyW: 0.44, legH: 0.28, legR: 0.08, neckL: 0.2, neckUp: 0.05, headS: 0.24, color: P.pig, dark: 0x322a22 },
  dog:    { bodyL: 0.7, bodyH: 0.3, bodyW: 0.24, legH: 0.32, legR: 0.06, neckL: 0.25, neckUp: 0.5, headS: 0.16, color: P.dog, dark: 0x776850, ears: 0.09, tailUp: true },
};

export class Animals {
  constructor(scene, crowd) {
    this.scene = scene;
    this.crowd = crowd;
    this.units = [];       // {g, spec, mode, ...}
    this.trains = [];

    // —— 驮炭驴队（郊野官道，讲解触发时召回至玩家前方）——
    const donkeyTrain = { animals: [], escorts: [], path: { x0: 28, x1: 165, z: 3.2 }, t: 60, dir: 1, speed: 1.5, gap: 3.2 };
    for (let i = 0; i < 5; i++) {
      const d = this.add('donkey', 0, 0);
      donkeyTrain.animals.push(d);
    }
    if (crowd) {
      donkeyTrain.escorts.push(crowd.addExternal('child'));   // 少年牵头
      donkeyTrain.escorts.push(crowd.addExternal('worker'));  // 老者殿后
    }
    this.trains.push(donkeyTrain);
    this.donkeyTrain = donkeyTrain;

    // —— 骆驼商队（胡人驭手，在城门洞一带往返；讲解触发时召回门洞）——
    const camelTrain = { animals: [], escorts: [], path: { x0: 612, x1: 706, z: -1.5 }, t: 690, dir: -1, speed: 1.1, gap: 4.6 };
    for (let i = 0; i < 5; i++) {
      const c = this.add('camel', 0, 0);
      camelTrain.animals.push(c);
    }
    if (crowd) {
      camelTrain.escorts.push(crowd.addExternal('hu'));
      camelTrain.escorts.push(crowd.addExternal('hu'));
    }
    this.trains.push(camelTrain);
    this.camelTrain = camelTrain;

    // —— 桥顶争道的骏马（武官骑乘，原地踏步，面朝西侧轿子迎面相对）——
    const warhorse = this.add('horse', 441.5, 0.2, { yaw: Math.PI + 0.15, fidget: true, onBridge: true });
    // 骑者
    const rider = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 0.85, 6), new THREE.MeshLambertMaterial({ color: 0x4a5a70 }));
    robe.position.y = 0.42; robe.castShadow = true;
    const rhead = sphere(0.12, P.skin); rhead.position.y = 1.0;
    const rhat = box(0.18, 0.12, 0.2, P.hatBlack); rhat.position.y = 1.12;
    rider.add(robe, rhead, rhat);
    rider.position.set(0, SPECS.horse.legH + SPECS.horse.bodyH + 0.2, 0);
    warhorse.g.add(rider);

    // —— 官员坐骑（郊野路上缓行）——
    const roadHorse = { animals: [this.add('horse', 0, 0)], escorts: [], path: { x0: 120, x1: 340, z: -3 }, t: 220, dir: 1, speed: 1.2, gap: 4 };
    if (crowd) roadHorse.escorts.push(crowd.addExternal('worker'));
    this.trains.push(roadHorse);

    // —— 牛车（税务所旁，站立甩尾）——
    this.add('ox', 668, 6.5, { yaw: 0.4, fidget: true });
    this.add('ox', 666, 8.8, { yaw: 0.5, fidget: true });

    // —— 猪群（城郊街边觅食）——
    const pigZone = { x0: 236, x1: 254, z0: 24, z1: 36 };
    for (let i = 0; i < 4; i++) {
      this.add('pig', pigZone.x0 + Math.random() * 18, pigZone.z0 + Math.random() * 12, { wander: pigZone, speed: 0.5 });
    }
    // —— 狗 ——
    this.add('dog', 60, -18, { wander: { x0: 48, x1: 76, z0: -22, z1: -10 }, speed: 1.6 });
    this.add('dog', 512, 6, { wander: { x0: 495, x1: 545, z0: 3, z1: 12 }, speed: 1.8 });
    this.add('dog', 810, -7, { wander: { x0: 790, x1: 838, z0: -9, z1: 8 }, speed: 1.7 });

    // —— 拴在树旁的驴（歇脚）——
    this.add('donkey', 273, -11, { yaw: 2.4, fidget: true });
    this.add('donkey', 372, 9, { yaw: -0.8, fidget: true });
  }

  add(kind, x, z, opts = {}) {
    const g = quadruped(SPECS[kind]);
    g.position.set(x, 0, z);
    g.rotation.y = opts.yaw || 0;
    this.scene.add(g);
    const u = { g, kind, ...opts, x, z, wait: Math.random() * 3, tx: x, tz: z, walking: false };
    this.units.push(u);
    return u;
  }

  // 讲解触发联动：把对应队伍召回到语音描述的位置（px 为玩家当前 x）
  cue(id, px = 0) {
    if (id === 'xumu' && this.donkeyTrain) {
      const tr = this.donkeyTrain;
      // 驴队出现在玩家前方进城方向（"正沿着小路进城"）
      tr.t = Math.max(tr.path.x0 + 16, Math.min(px + 17, tr.path.x1 - 8));
      tr.dir = 1;
    } else if (id === 'chengmen' && this.camelTrain) {
      const tr = this.camelTrain;
      // 驼队恰好正从城门洞走出：头驼在门洞中，队尾在城内
      tr.t = 664;
      tr.dir = -1;
    }
  }

  update(dt, t) {
    // 车队（直线往返）
    for (const tr of this.trains) {
      tr.t += tr.speed * dt * tr.dir;
      if (tr.t > tr.path.x1) { tr.dir = -1; }
      if (tr.t < tr.path.x0) { tr.dir = 1; }
      const headX = tr.t;
      // 动物模型头朝局部 +X：沿 +X 走 rotation.y=0，沿 -X 走 rotation.y=π
      const animalYaw = tr.dir > 0 ? 0 : Math.PI;
      // 人物模型面朝局部 +Z：yaw = atan2(dx, dz)
      const personYaw = tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      tr.animals.forEach((a, i) => {
        const ax = headX - tr.dir * (i + 1) * tr.gap;
        a.g.position.x = ax;
        a.g.position.z = tr.path.z + Math.sin(i * 2.7) * 0.6;
        a.g.rotation.y = animalYaw;
        animateWalk(a, t, 4.2);
      });
      // 领队与殿后（人群外部驱动）
      if (this.crowd && tr.escorts.length) {
        const lead = headX + tr.dir * 2.2;
        this.crowd.setExternal(tr.escorts[0], lead, tr.path.z + 0.4, personYaw, true);
        if (tr.escorts[1] !== undefined) {
          const rear = headX - tr.dir * (tr.animals.length + 1.2) * tr.gap;
          this.crowd.setExternal(tr.escorts[1], rear, tr.path.z - 0.4, personYaw, true);
        }
      }
    }
    // 散养动物
    for (const u of this.units) {
      if (u.wander) {
        if (u.walking) {
          const dx = u.tx - u.g.position.x, dz = u.tz - u.g.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3) { u.walking = false; u.wait = 2 + Math.random() * 5; }
          else {
            u.g.position.x += dx / d * u.speed * dt;
            u.g.position.z += dz / d * u.speed * dt;
            // 头朝局部 +X：yaw = atan2(dx, dz) - π/2
            u.g.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
            animateWalk(u, t, 6);
          }
        } else {
          u.wait -= dt;
          animateIdle(u, t);
          if (u.wait <= 0) {
            u.tx = u.wander.x0 + Math.random() * (u.wander.x1 - u.wander.x0);
            u.tz = u.wander.z0 + Math.random() * (u.wander.z1 - u.wander.z0);
            u.walking = true;
          }
        }
      } else if (u.fidget) {
        animateIdle(u, t);
      }
    }
  }
}

function animateWalk(u, t, freq) {
  const g = u.g;
  g.userData.phase += 0.016 * freq;
  const ph = g.userData.phase;
  const legs = g.userData.legs;
  legs[0].rotation.z = Math.sin(ph) * 0.45;
  legs[3].rotation.z = Math.sin(ph) * 0.45;
  legs[1].rotation.z = -Math.sin(ph) * 0.45;
  legs[2].rotation.z = -Math.sin(ph) * 0.45;
  g.position.y = (u.onBridge ? bridgeLift(g.position.x) : 0) + Math.abs(Math.sin(ph)) * 0.03;
}

function animateIdle(u, t) {
  const g = u.g;
  const s = g.userData.phase;
  if (g.userData.head) g.userData.head.rotation.z = Math.sin(t * 0.7 + s) * 0.12;
  g.position.y = (u.onBridge ? bridgeLift(g.position.x) : 0);
}

import { bridgeY } from './layout.js';
function bridgeLift(x) { return bridgeY(x); }
