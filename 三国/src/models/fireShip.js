// 04 黄盖火攻船（点火前）—— 满装薪草、油浸帷幕遮盖、陶质油器、尾系走舸两艘
import * as THREE from 'three';
import { materials, pennant, makeRng } from '../materials.js';
import { loftedHull, deck, furledSail, rudder, rigging, smallBoat } from './shipCommon.js';

export function createFireShip() {
  const M = materials();
  const g = new THREE.Group();
  g.name = 'fireShip';

  const L = 9, B = 2.6, D = 1.1;
  const hull = loftedHull({
    length: L, beam: B, depth: D,
    bowRise: 0.35, sternRise: 0.4, bowKeelRise: 0.15, sternKeelRise: 0.15,
    sternWidth: 0.62, bowWidth: 0.4, flare: 0.4, mat: M.hullWood,
  });
  g.add(hull, deck(hull, M.deckWood, 0.9));
  const deckY = D * 0.82;
  const rng = makeRng(42);

  // ---- 薪草柴束堆（舷侧可见层） ----
  // 柴束：成捆圆柱，横向码放
  const faggotMat = M.reed;
  for (let layer = 0; layer < 3; layer++) {
    const count = 9 - layer * 2;
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1 + rng() * 0.3, 7), faggotMat);
        f.rotation.x = Math.PI / 2 + (rng() - 0.5) * 0.12;
        f.rotation.y = (rng() - 0.5) * 0.2;
        f.position.set(
          -3.2 + (6.4 * i) / (count - 1) + (rng() - 0.5) * 0.15,
          deckY + 0.12 + layer * 0.17,
          side * (0.95 - layer * 0.22) + (rng() - 0.5) * 0.1
        );
        g.add(f);
      }
    }
  }
  // 薪草垛（蓬松束团，首尾部）
  for (const [x, s] of [[3.3, 1.1], [2.2, 0.9], [-3.5, 0.8]]) {
    const pile = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const straw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.8 + rng() * 0.5, 4), faggotMat);
      straw.position.set((rng() - 0.5) * 0.7 * s, 0.3, (rng() - 0.5) * 0.7 * s);
      straw.rotation.set((rng() - 0.5) * 0.9, 0, (rng() - 0.5) * 0.9);
      pile.add(straw);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 8, 6), faggotMat);
    core.scale.set(1.2, 0.7, 1);
    core.position.y = 0.28;
    pile.add(core);
    pile.position.set(x, deckY, (rng() - 0.5) * 0.4);
    g.add(pile);
  }

  // ---- 陶质油器（尖底罐成排） ----
  for (let i = 0; i < 6; i++) {
    const jar = oilJar(0.34, M.clay);
    const side = i % 2 ? 1 : -1;
    jar.position.set(-1.6 + Math.floor(i / 2) * 1.15, deckY + 0.3, side * 0.62);
    g.add(jar);
  }

  // ---- 油浸帷幕（大罩布，中央隆起盖住货堆） ----
  const tarpGeo = new THREE.PlaneGeometry(6.6, 3.4, 20, 12);
  const pos = tarpGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const nx = x / 6.6, ny = y / 3.4;
    const hump = Math.cos(nx * Math.PI) * 0 + Math.sin((nx + 0.5) * Math.PI) * Math.sin((ny + 0.5) * Math.PI);
    pos.setZ(i, hump * 1.05 + Math.sin(x * 2.1) * 0.05 + Math.cos(y * 3.3) * 0.04);
  }
  tarpGeo.computeVertexNormals();
  const tarp = new THREE.Mesh(tarpGeo, M.darkCloth);
  tarp.rotation.x = -Math.PI / 2;
  tarp.position.set(-0.3, deckY + 0.62, 0);
  g.add(tarp);
  // 罩布捆扎绳网
  for (let i = 0; i < 5; i++) {
    const x = -3.3 + i * 1.5;
    g.add(rigging([[[x, deckY + 1.6, 0], [x, deckY + 0.15, 1.35]], [[x, deckY + 1.6, 0], [x, deckY + 0.15, -1.35]]], M.rope, 0.014));
  }

  // ---- 桅杆 + 卷帆 + 破旧红旗 ----
  const ms = furledSail({ mastH: 3.8, w: 2.6, mat: M.darkWood, clothMat: M.sail });
  ms.position.set(0.6, deckY + 1.15, 0);
  g.add(ms);
  const tatteredFlag = pennant(1.1, 0.42, M.flagRedDark, true);
  tatteredFlag.position.set(0.62, deckY + 1.15 + 3.8 - 0.35, 0.02);
  tatteredFlag.rotation.y = -0.25;
  g.add(tatteredFlag);
  g.add(rigging([
    [[0.6, deckY + 1.15 + 3.8 * 0.95, 0], [3.9, deckY + 0.6, 0]],
    [[0.6, deckY + 1.15 + 3.8 * 0.95, 0], [-4.0, deckY + 0.7, 0]],
  ], M.rope));

  // ---- 尾部舵 + 系缆 ----
  const rud = rudder(1.7, M.darkWood);
  rud.position.set(-L / 2 - 0.1, deckY + 0.4, 0);
  g.add(rud);

  // ---- 走舸两艘（尾后随行，浮于同一水线） ----
  const boat1 = smallBoat(2.3, M.hullWood);
  boat1.position.set(-L / 2 - 2.2, 0.05, 0.85);
  boat1.rotation.y = 0.12;
  const boat2 = smallBoat(2.1, M.hullWood);
  boat2.position.set(-L / 2 - 2.5, 0.05, -0.9);
  boat2.rotation.y = -0.1;
  g.add(boat1, boat2);
  // 拖缆
  g.add(rigging([
    [[-L / 2, deckY + 0.2, 0.3], [-L / 2 - 1.2, 0.42, 0.8]],
    [[-L / 2, deckY + 0.2, -0.3], [-L / 2 - 1.4, 0.42, -0.85]],
  ], M.rope, 0.02));

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.view = { radius: 8.5, y: 2 };
  return g;
}

/** 陶质油器（尖底罐） */
export function oilJar(r = 0.32, mat) {
  const g = new THREE.Group();
  const pts = [];
  const profile = [[0.02, 0], [0.12, 0.06], [0.3, 0.28], [0.36, 0.55], [0.3, 0.8], [0.16, 0.95], [0.14, 1.05], [0.18, 1.12]];
  for (const [x, y] of profile) pts.push(new THREE.Vector2(x * (r / 0.36), y * (r / 0.36)));
  const jar = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), mat);
  g.add(jar);
  // 罐口绳箍
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.15 * (r / 0.36), 0.02, 5, 10), materials().rope);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.98 * (r / 0.36);
  g.add(band);
  return g;
}
