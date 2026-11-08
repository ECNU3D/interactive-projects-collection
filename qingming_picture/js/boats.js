// 船只：龟背篷漕船、客船、舢板、虹桥险情大船
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { P, vary } from './palette.js';
import { RIVER, BRIDGE } from './layout.js';
import { smokeSpots } from './buildings.js';

/* 船体建造（局部坐标：船头朝 +z，长沿 z）
   opts: {L, W, canopy('turtle'|'cabin'|null), mast(0~1 桅杆倾倒程度; -1 无), oar, crew, cargo} */
function buildBoat(opts = {}) {
  const { L = 13, W = 3.6, canopy = 'turtle', mast = -1, oar = false, crew = 2, cargo = false } = opts;
  const gb = new GeoBuilder();
  const hullC = vary(P.boatHull, 0.06);

  // 船底 + 两舷（船头船尾翘起，木板纹理）
  gb.box(W, 0.5, L * 0.8, hullC, { y: 0.25, ch: 'wood', texScale: 0.35 });
  gb.box(W * 0.92, 0.45, L * 0.16, hullC, { y: 0.44, z: L * 0.44, rx: -0.24, ch: 'wood' });
  gb.box(W * 0.92, 0.45, L * 0.16, hullC, { y: 0.44, z: -L * 0.44, rx: 0.24, ch: 'wood' });
  gb.box(0.18, 0.75, L * 0.94, P.boatDark, { x: -W / 2 + 0.09, y: 0.65, ch: 'wood' });
  gb.box(0.18, 0.75, L * 0.94, P.boatDark, { x: W / 2 - 0.09, y: 0.65, ch: 'wood' });
  gb.box(W, 0.14, L * 0.88, vary(P.wood, 0.08), { y: 0.58, ch: 'wood' });   // 甲板

  // 龟背篷 / 客舱
  if (canopy === 'turtle') {
    const R = W * 0.52;
    const cl = L * 0.58;
    const matC = vary(P.mat, 0.08);
    // 半圆拱壳（从舷到舷包过船身，"龟背"状）
    gb.grid(9, 8, (i, j) => {
      const th = (i / 8) * Math.PI;             // 0..π
      const zz = (j / 7 - 0.5) * cl;
      return [Math.cos(th) * R, 0.62 + Math.sin(th) * R * 0.85, zz];
    }, matC, { doubleSide: true, ch: 'reed', uvRepeat: [cl * 0.5, R * 2.2] });
    // 篷上苇席箍条
    for (let i = -2; i <= 2; i++) {
      gb.grid(2, 9, (r, j) => {
        const th = (j / 8) * Math.PI;
        const zz = i * cl / 5 + (r - 0.5) * 0.12;
        return [Math.cos(th) * (R + 0.02), 0.62 + Math.sin(th) * (R * 0.85 + 0.02), zz];
      }, P.rope, { doubleSide: true });
    }
  } else if (canopy === 'cabin') {
    gb.box(W * 0.84, 1.5, L * 0.5, vary(P.wood, 0.06), { y: 1.35, ch: 'wood' });
    gb.box(W * 0.9, 0.5, L * 0.2, vary(P.wood, 0.06), { y: 1.1, z: L * 0.32, ch: 'wood' });
    // 直棂窗板（贴图）
    gb.box(W * 0.88, 1.1, L * 0.48, 0xd8d0b8, { y: 1.4, ch: 'lattice', texScale: 0.9 });
    // 舱顶
    gb.box(W * 0.95, 0.12, L * 0.56, P.boatDark, { y: 2.16, ch: 'wood' });
  }
  if (cargo) {
    for (let i = 0; i < 6; i++) {
      gb.sphere(0.42, vary(P.rope, 0.12), { x: (i % 2 - 0.5) * 0.9, y: 0.9, z: -L * 0.28 + (i >> 1) * 1.0, sy: 0.8 });
    }
  }
  // 平衡舵
  gb.box(0.12, 1.1, 1.4, P.boatDark, { y: 0.35, z: -L / 2 - 0.5, rx: 0.4, ch: 'wood' });

  // 船工（站姿撑篙/摇橹，带手臂动作）
  for (let i = 0; i < crew; i++) {
    const cx = (i % 2 - 0.5) * W * 0.55;
    const cz = L * (0.32 - (i % 3) * 0.3);
    const crewC = vary(0x7a7060, 0.15);
    gb.cyl(0.12, 0.2, 0.78, crewC, { x: cx, y: 1.0, z: cz, seg: 5 });
    gb.sphere(0.11, P.skin, { x: cx, y: 1.52, z: cz });
    gb.box(0.06, 0.4, 0.06, crewC, { x: cx - 0.15, y: 1.28, z: cz + 0.08, rz: 0.5, rx: -0.3 });
    gb.box(0.06, 0.4, 0.06, crewC, { x: cx + 0.15, y: 1.28, z: cz + 0.08, rz: -0.5, rx: -0.3 });
    if (i === 0) {
      // 竹篙
      gb.cyl(0.03, 0.03, 3.6, 0xa89858, { x: cx + 0.2, y: 1.6, z: cz, rx: 0.5, seg: 4 });
    }
  }

  const group = new THREE.Group();
  group.add(gb.buildMeshes({ chunks: false, cull: false }));

  // 桅杆（可动，用于险情船；sail 时加帆桁、卷帆与支索）
  if (mast >= 0) {
    const mgb = new GeoBuilder();
    mgb.cyl(0.08, 0.12, 7.5, P.boatDark, { y: 3.75, seg: 6, ch: 'wood', texScale: 0.8 });
    mgb.box(0.5, 0.3, 0.5, P.boatDark, { y: 0.3 });
    if (opts.sail) {
      mgb.box(3.6, 0.1, 0.1, P.boatDark, { y: 6.6, ch: 'wood' });                     // 帆桁
      mgb.cyl(0.09, 0.09, 3.4, vary(P.mat, 0.06), { y: 6.38, rz: Math.PI / 2, seg: 6, ch: 'reed' }); // 卷起的帆
      mgb.box(0.03, 7.0, 0.03, 0x8a7a5a, { y: 3.5, rx: 0.32 });                       // 前后支索
      mgb.box(0.03, 7.0, 0.03, 0x8a7a5a, { y: 3.5, rx: -0.32 });
    }
    const mastMesh = mgb.buildMeshes({ chunks: false, cull: false });
    mastMesh.position.set(0, 0.6, L * 0.12);
    mastMesh.rotation.x = mast * 1.1;   // 倾倒角
    group.add(mastMesh);
    group.userData.mast = mastMesh;
  }
  // 大橹
  if (oar) {
    const ogb = new GeoBuilder();
    ogb.cyl(0.05, 0.07, 4.2, P.wood, { rz: Math.PI / 2 - 0.35, x: 1.6, y: -0.6, seg: 5, ch: 'wood' });
    ogb.box(0.5, 0.08, 0.9, P.wood, { x: 3.2, y: -1.15 });
    const oarMesh = ogb.buildMeshes({ chunks: false, cull: false });
    oarMesh.position.set(W / 2 - 0.2, 0.9, -L * 0.32);
    group.add(oarMesh);
    group.userData.oar = oarMesh;
  }
  return group;
}

// 两点间拉一根细绳（纤绳、缆绳用）
function ropeBetween(scene, from, to, r = 0.03, color = 0x8a7a5a) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), new THREE.MeshLambertMaterial({ color }));
  mesh.position.lerpVectors(a, b, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  scene.add(mesh);
  return mesh;
}

export class Boats {
  constructor(scene) {
    this.list = [];

    const add = (opts, x, z, yaw, anim = {}) => {
      const b = buildBoat(opts);
      b.position.set(x, RIVER.waterY + 0.15, z);
      b.rotation.y = yaw;
      scene.add(b);
      const u = { g: b, x, z, yaw, seed: Math.random() * 10, ...anim };
      this.list.push(u);
      return u;
    };

    // —— 险情大船：桅杆将倒未倒，横在桥前 ——
    this.drama = add(
      { L: 15, W: 4.2, canopy: 'cabin', mast: 0.55, oar: true, crew: 5 },
      BRIDGE.cx - 3, -13, 2.75, { drama: true }
    );
    // 船上炊烟（船家灶）
    smokeSpots.push([BRIDGE.cx - 3, 1.5, -13]);

    // —— 码头停泊漕船（西岸一排，带桅杆卷帆）——
    add({ L: 14, W: 4, canopy: 'turtle', crew: 2, cargo: false, mast: 0, sail: true }, 402, -30, 0.06);
    add({ L: 13, W: 3.8, canopy: 'turtle', crew: 1 }, 403, -46, -0.05);
    add({ L: 14, W: 4, canopy: 'turtle', crew: 3, cargo: true, mast: 0, sail: true }, 401.5, -62, 0.1);
    add({ L: 12, W: 3.6, canopy: 'turtle', crew: 0 }, 404, -78, 0);
    smokeSpots.push([402, 1.8, -46]);

    // —— 东岸停泊 ——
    add({ L: 13, W: 3.8, canopy: 'cabin', crew: 2, mast: 0, sail: true }, 470, 24, 3.1);
    add({ L: 12, W: 3.6, canopy: 'turtle', crew: 1 }, 469, 40, 3.2);

    // —— 行驶中的船 ——
    add({ L: 14, W: 4, canopy: 'turtle', crew: 4, oar: true, cargo: true }, 425, 90, 0, { cruise: 2.2, dir: -1 });
    add({ L: 13, W: 3.8, canopy: 'cabin', crew: 3, oar: true }, 448, -120, Math.PI, { cruise: 1.8, dir: 1 });
    add({ L: 6, W: 2, canopy: null, crew: 1, oar: true }, 460, 140, 0, { cruise: 2.8, dir: -1 });

    // —— 纤夫拉的上行船（西岸近纤道）——
    this.towed = add({ L: 14, W: 4, canopy: 'turtle', crew: 3, cargo: true }, 400.5, -95, 0.05, {});

    // 纤绳：从上行船船头连到西岸纤夫队伍
    ropeBetween(scene, [400.6, -0.2, -88.2], [389.2, 1.1, -73.5]);
    // 虹桥险情：桥上热心人抛下的两根缆绳（搭在险情船舷边）
    ropeBetween(scene, [431, 8.1, -5.7], [432.6, 1.5, -10.6]);
    ropeBetween(scene, [440, 8.2, -5.7], [434.8, 1.4, -11.2]);
  }

  update(dt, t) {
    for (const b of this.list) {
      // 泊船摇晃
      const bob = Math.sin(t * 0.9 + b.seed) * 0.06 + Math.sin(t * 1.7 + b.seed * 2) * 0.03;
      b.g.position.y = RIVER.waterY + 0.15 + bob;
      b.g.rotation.z = Math.sin(t * 0.8 + b.seed) * 0.022;
      b.g.rotation.x = Math.cos(t * 0.6 + b.seed) * 0.014;

      // 行船
      if (b.cruise) {
        b.g.position.z += b.dir * b.cruise * dt;
        if (b.g.position.z > 200) { b.g.position.z = 200; b.dir = -1; b.g.rotation.y += Math.PI; }
        if (b.g.position.z < -200) { b.g.position.z = -200; b.dir = 1; b.g.rotation.y += Math.PI; }
        // 避开桥洞中央险情船：轻微绕行
        const az = Math.abs(b.g.position.z);
        if (az < 26) b.g.position.x += (b.g.position.x < BRIDGE.cx ? -1 : 1) * dt * 1.2 * (1 - az / 26);
        if (b.g.userData.oar) b.g.userData.oar.rotation.x = Math.sin(t * 2.4 + b.seed) * 0.35;
      }

      // 险情船：桅杆摇摇欲坠 + 船身急转
      if (b.drama) {
        b.g.rotation.y = 2.75 + Math.sin(t * 0.4) * 0.1;
        b.g.position.z = -13 + Math.sin(t * 0.25) * 2.2;
        b.g.position.x = BRIDGE.cx - 3 + Math.cos(t * 0.3) * 1.2;
        if (b.g.userData.mast) {
          b.g.userData.mast.rotation.x = 0.62 + Math.sin(t * 1.1) * 0.1;
        }
        if (b.g.userData.oar) b.g.userData.oar.rotation.x = Math.sin(t * 3.2) * 0.5;
      }
    }
  }
}
