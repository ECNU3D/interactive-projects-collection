// 01+06 赤壁江岸水寨组合场景 —— 江面、泥岸、芦苇、木栅营地、仓棚、栈桥、泊船
import * as THREE from 'three';
import { materials, makeRng } from '../materials.js';
import { createLouchuan } from './louchuan.js';
import { createOaredBoat } from './oaredBoat.js';
import { createFireShip } from './fireShip.js';
import { createWatchtower, palisade } from './watchtower.js';

export function createChibiScene() {
  const M = materials();
  const g = new THREE.Group();
  g.name = 'chibiScene';
  const rng = makeRng(208);

  // ---- 江面 ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 110, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#3d5a5c', roughness: 0.3, metalness: 0.18 })
  );
  water.rotation.x = -Math.PI / 2;
  const wpos = water.geometry.attributes.position;
  for (let i = 0; i < wpos.count; i++) {
    wpos.setZ(i, Math.sin(wpos.getX(i) * 0.35) * 0.05 + Math.cos(wpos.getY(i) * 0.5) * 0.04);
  }
  water.geometry.computeVertexNormals();
  water.position.y = -0.4;
  water.receiveShadow = true;
  g.add(water);
  const WATER_Y = -0.4;

  // ---- 岸滩（z<0 为开阔江面；z 0.5~4.5 为岸线过渡；内侧为营地台地） ----
  const shoreGeo = new THREE.PlaneGeometry(160, 50, 48, 20);
  const spos = shoreGeo.attributes.position;
  for (let i = 0; i < spos.count; i++) {
    const ly = spos.getY(i);            // 局部 -25..25 → 世界 z 0..50
    const wz = ly + 25;
    const t = THREE.MathUtils.smoothstep(wz, 0.5, 4.5);   // 岸线过渡带
    const h = -0.45 + 1.35 * t;
    const noise = Math.sin(spos.getX(i) * 0.2 + wz * 0.3) * 0.1 * t;
    spos.setZ(i, h + noise);
  }
  shoreGeo.computeVertexNormals();
  const shore = new THREE.Mesh(shoreGeo, new THREE.MeshStandardMaterial({ color: '#7a6b52', roughness: 1 }));
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(0, 0, 25);
  shore.receiveShadow = true;
  g.add(shore);

  // ---- 芦苇丛（江岸浅水带） ----
  const reedGeo = new THREE.ConeGeometry(0.03, 1.1, 4);
  const reedMat = new THREE.MeshStandardMaterial({ color: '#8a7f4e', roughness: 1 });
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, 500);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 500; i++) {
    const x = (rng() - 0.5) * 120;
    const z = -0.4 - rng() * 3.5;      // 岸线浅水带
    const s = 0.7 + rng() * 0.9;
    m4.makeRotationY(rng() * 3);
    m4.scale(new THREE.Vector3(s, s * (0.8 + rng() * 0.6), s));
    m4.setPosition(x, 0.35 * s - 0.45, z);
    reeds.setMatrixAt(i, m4);
  }
  g.add(reeds);

  // ---- 营门楼橹（营地正门，面江） ----
  const tower = createWatchtower();
  tower.position.set(0, 0.9, 8);
  tower.rotation.y = Math.PI;      // 面朝江（-z 为江）
  g.add(tower);

  // ---- 木栅围墙（圈出营地） ----
  const wallPts = [
    [-22, 6, 0.35], [-14, 9, 0.2], [-6, 10.5, 0.05],
  ];
  for (const [x, z, ry] of wallPts) {
    const seg = palisade(9, 1.8, M);
    seg.position.set(x, 0.85, z);
    seg.rotation.y = ry;
    g.add(seg);
  }
  const wallPtsR = [[22, 6, -0.35], [14, 9, -0.2], [6, 10.5, -0.05]];
  for (const [x, z, ry] of wallPtsR) {
    const seg = palisade(9, 1.8, M);
    seg.position.set(x, 0.85, z);
    seg.rotation.y = ry;
    g.add(seg);
  }
  // 后墙
  const backWall = palisade(44, 1.8, M);
  backWall.position.set(0, 0.95, 18);
  g.add(backWall);

  // ---- 仓棚与帷帐 ----
  const shedPos = [[-12, 12, 0.2], [-5, 13.5, -0.15], [8, 13, 0.3], [15, 11, -0.4]];
  for (const [x, z, ry] of shedPos) {
    const shed = lowShed(3.4 + rng() * 1.4, M);
    shed.position.set(x, 0.95, z);
    shed.rotation.y = ry;
    g.add(shed);
  }
  // 帷帐
  for (const [x, z, ry] of [[-16, 14, 0.6], [3, 14.5, -0.3]]) {
    const tent = tarpTent(2.4, M);
    tent.position.set(x, 0.95, z);
    tent.rotation.y = ry;
    g.add(tent);
  }

  // ---- 柴草堆、粮袋、陶罐 ----
  for (let i = 0; i < 10; i++) {
    const kind = i % 3;
    let prop;
    if (kind === 0) {
      prop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5), M.reed);
      prop.scale.set(1.3, 0.6, 1);
    } else if (kind === 1) {
      prop = new THREE.Mesh(new THREE.SphereGeometry(0.35, 7, 6), M.rope);
      prop.scale.set(1, 0.85, 1);
    } else {
      prop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.55, 9), M.clay);
    }
    prop.position.set(-9 + rng() * 18, 1.15, 10.5 + rng() * 5);
    prop.castShadow = true;
    g.add(prop);
  }

  // ---- 修船架 ----
  const rack = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 5), M.darkWood);
    leg1.position.set(s * 0.8, 0.8, -0.5); leg1.rotation.x = 0.4;
    const leg2 = leg1.clone(); leg2.position.z = 0.5; leg2.rotation.x = -0.4;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 5), M.darkWood);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.25, 0);
    rack.add(leg1, leg2, bar);
  }
  rack.position.set(-14, 0.95, 6);
  g.add(rack);

  // ---- 两座木栈桥 ----
  for (const [x, len, ry] of [[-8, 12, 0.15], [9, 10, -0.2]]) {
    const pier = jetty(len, M);
    pier.position.set(x, 0.1, 2);
    pier.rotation.y = ry;
    g.add(pier);
  }

  // ---- 泊船（龙骨没入水面，按各船吃水定位） ----
  const lou = createLouchuan();
  lou.scale.setScalar(0.8);
  lou.position.set(-8, WATER_Y - 0.18, -10);
  lou.rotation.y = 0.35;
  g.add(lou);

  const fire = createFireShip();
  fire.scale.setScalar(0.8);
  fire.position.set(9.5, WATER_Y - 0.16, -8);
  fire.rotation.y = -0.3;
  g.add(fire);

  const oar1 = createOaredBoat();
  oar1.scale.setScalar(0.75);
  oar1.position.set(-17, WATER_Y - 0.12, -13);
  oar1.rotation.y = 0.9;
  g.add(oar1);

  const oar2 = createOaredBoat();
  oar2.scale.setScalar(0.75);
  oar2.position.set(17, WATER_Y - 0.12, -14);
  oar2.rotation.y = -0.7;
  g.add(oar2);

  const oar3 = createOaredBoat();
  oar3.scale.setScalar(0.7);
  oar3.position.set(1, WATER_Y - 0.11, -21);
  oar3.rotation.y = 2.6;
  g.add(oar3);

  // ---- 远景：北岸低平岸线 + 薄雾感山影 ----
  const far = new THREE.Mesh(new THREE.BoxGeometry(220, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#5d6a5e', roughness: 1 }));
  far.position.set(0, 0.4, -52);
  g.add(far);
  // 赤崖（南岸红色崖体）
  const cliff = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 5), new THREE.MeshStandardMaterial({ color: '#8a5a48', roughness: 1 }));
  cliff.position.set(-55, 1.4, -30);
  cliff.rotation.y = 0.5;
  g.add(cliff);

  g.userData.view = { radius: 40, y: 10 };
  return g;
}

/** 低矮仓棚（四柱 + 草/瓦顶） */
export function lowShed(w = 3.4, M = materials()) {
  const g = new THREE.Group();
  const d = w * 0.7, h = 1.5;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 6), M.darkWood);
    p.position.set(x, h / 2, z);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, 0.8, 4), M.reed);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, d / w * 1.1);
  roof.position.y = h + 0.4;
  g.add(roof);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** 帷帐（披布式） */
export function tarpTent(w, M = materials()) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.01, w * 0.62, 1.6, 8, 1, true);
  const tent = new THREE.Mesh(geo, M.sail);
  tent.position.y = 0.8;
  g.add(tent);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

/** 木栈桥 */
export function jetty(len, M = materials()) {
  const g = new THREE.Group();
  const w = 1.6;
  const deckM = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, len), M.deckWood);
  deckM.position.set(0, 0.5, -len / 2);
  g.add(deckM);
  for (let i = 0; i <= len; i += 2) {
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 6), M.darkWood);
      p.position.set(s * (w / 2 - 0.08), -0.1, -i);
      g.add(p);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
