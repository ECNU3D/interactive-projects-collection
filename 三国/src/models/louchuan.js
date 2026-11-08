// 02 东汉楼船 / 指挥舰 —— 两层战棚、低栏楯、桨位、尾舵+舵楼、单桅矩形帆
import * as THREE from 'three';
import { materials, railing, cylBetween, pennant } from '../materials.js';
import { loftedHull, deck, oarBank, rudder, mastSail, rigging } from './shipCommon.js';

export function createLouchuan() {
  const M = materials();
  const g = new THREE.Group();
  g.name = 'louchuan';

  const L = 12, B = 3.0, D = 1.35;
  const hull = loftedHull({ length: L, beam: B, depth: D, bowRise: 0.5, sternRise: 0.35, bowKeelRise: 0.25, sternKeelRise: 0.12, sternWidth: 0.6, bowWidth: 0.3, mat: M.hullWood });
  g.add(hull, deck(hull, M.deckWood));
  const deckY = D * 0.82;

  // ---- 栏楯（低护栏沿甲板一圈，前后段） ----
  for (const side of [-1, 1]) {
    const r1 = railing(4.4, 0.42, M.darkWood, { posts: 12 });
    r1.position.set(3.4, deckY, side * 1.28);
    const r2 = railing(2.6, 0.42, M.darkWood, { posts: 7 });
    r2.position.set(-4.4, deckY + 0.08, side * 1.15);
    g.add(r1, r2);
  }

  // ---- 下层长舱（战棚第一层，竹席墙 + 窗洞） ----
  const cab1L = 7.2, cab1H = 1.15, cab1W = 2.2;
  const cab1 = new THREE.Mesh(new THREE.BoxGeometry(cab1L, cab1H, cab1W), M.weave);
  cab1.position.set(-0.9, deckY + cab1H / 2, 0);
  g.add(cab1);
  // 木构柱框
  for (let i = 0; i <= 8; i++) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, cab1H, 0.09), M.darkWood);
      post.position.set(-0.9 - cab1L / 2 + (cab1L * i) / 8, deckY + cab1H / 2, side * (cab1W / 2));
      g.add(post);
    }
  }
  // 窗洞（深色小方块表现开口）
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.04), M.ironDark);
      win.position.set(-0.9 - cab1L / 2 + (cab1L * (i + 0.75)) / 8, deckY + cab1H * 0.55, side * (cab1W / 2 + 0.01));
      g.add(win);
    }
  }
  // 一层舱顶板（即上层甲板）
  const deck2Y = deckY + cab1H;
  const cab1Roof = new THREE.Mesh(new THREE.BoxGeometry(cab1L + 0.5, 0.08, cab1W + 0.7), M.deckWood);
  cab1Roof.position.set(-0.9, deck2Y, 0);
  g.add(cab1Roof);

  // 上层甲板四周栏杆
  const railTop = railing(cab1L + 0.4, 0.4, M.darkWood, { posts: 14 });
  for (const side of [-1, 1]) {
    const rr = railTop.clone();
    rr.position.set(-0.9, deck2Y + 0.04, side * (cab1W / 2 + 0.3));
    g.add(rr);
  }
  for (const end of [-1, 1]) {
    const rr = railing(cab1W + 0.6, 0.4, M.darkWood, { posts: 5 });
    rr.rotation.y = Math.PI / 2;
    rr.position.set(-0.9 + end * (cab1L / 2 + 0.2), deck2Y + 0.04, 0);
    g.add(rr);
  }

  // ---- 上层战棚（尾部一段，带窗） ----
  const cab2L = 3.4, cab2H = 0.95, cab2W = 1.8;
  const cab2 = new THREE.Mesh(new THREE.BoxGeometry(cab2L, cab2H, cab2W), M.weave);
  cab2.position.set(-1.6, deck2Y + 0.04 + cab2H / 2, 0);
  g.add(cab2);
  for (let i = 0; i <= 4; i++) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, cab2H, 0.08), M.darkWood);
      post.position.set(-1.6 - cab2L / 2 + (cab2L * i) / 4, deck2Y + 0.04 + cab2H / 2, side * (cab2W / 2));
      g.add(post);
    }
  }
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.04), M.ironDark);
      win.position.set(-1.6 - cab2L / 2 + (cab2L * (i + 0.9)) / 4, deck2Y + 0.04 + cab2H * 0.55, side * (cab2W / 2 + 0.01));
      g.add(win);
    }
  }
  const cab2Roof = new THREE.Mesh(new THREE.BoxGeometry(cab2L + 0.4, 0.07, cab2W + 0.5), M.deckWood);
  cab2Roof.position.set(-1.6, deck2Y + 0.04 + cab2H, 0);
  g.add(cab2Roof);
  // 二层顶栏杆
  for (const side of [-1, 1]) {
    const rr = railing(cab2L + 0.3, 0.34, M.darkWood, { posts: 8 });
    rr.position.set(-1.6, deck2Y + 0.08 + cab2H, side * (cab2W / 2 + 0.2));
    g.add(rr);
  }

  // ---- 舵楼（尾部小亭，四坡灰瓦） ----
  const towerY = deck2Y + 0.08 + cab2H;
  const tw = new THREE.Group();
  const twBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.9), M.darkWood);
  twBase.position.y = 0.35;
  const winF = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.04), M.ironDark);
  winF.position.set(0, 0.42, 0.46);
  tw.add(twBase, winF);
  tw.add(hipRoof(1.3, 1.1, 0.42, M.roofTile, 0.55));
  tw.position.set(-4.6, deckY + 0.42, 0);
  g.add(tw);

  // ---- 尾舵 ----
  const rud = rudder(2.2, M.darkWood);
  rud.position.set(-L / 2 - 0.15, deckY + 0.35, 0);
  g.add(rud);

  // ---- 桅与矩形帆 ----
  const ms = mastSail({ mastH: 5.2, sailW: 2.9, sailH: 3.0, battens: 7, mat: M.darkWood, sailMat: M.sail });
  ms.position.set(1.6, deckY, 0);
  g.add(ms);
  // 索具
  g.add(rigging([
    [[1.6, deckY + 5.2 * 0.92, 0], [5.4, deckY + 0.9, 0]],   // 前支索
    [[1.6, deckY + 5.2 * 0.92, 0], [-4.2, deck2Y + 0.4, 0]], // 后支索
    [[1.6, deckY + 5.2 * 0.9, 0], [1.0, deckY + 0.15, 1.35]],
    [[1.6, deckY + 5.2 * 0.9, 0], [1.0, deckY + 0.15, -1.35]],
    [[1.6 - 1.55, deckY + 5.2 * 0.86 + 0.02, 0], [1.6 + 1.55, deckY + 5.2 * 0.86 + 0.02, 0]],
  ], M.rope));

  // ---- 舷侧桨（楼船桨位较低、数量多） ----
  g.add(oarBank(hull, 12, { oarLen: 2.0, side: 1, mat: M.paleWood }));
  g.add(oarBank(hull, 12, { oarLen: 2.0, side: -1, mat: M.paleWood }));

  // ---- 旗帜：船首大幡 + 尾楼小旗 ----
  const bowPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.6, 6), M.darkWood);
  bowPole.position.set(L / 2 - 0.7, deckY + 1.1, 0);
  const bowFlag = pennant(1.0, 0.5, M.flagRed);
  bowFlag.position.set(L / 2 - 0.68, deckY + 1.5, 0.02);
  bowFlag.rotation.y = -0.2;
  g.add(bowPole, bowFlag);
  for (const [x, y] of [[-3.2, towerY + 0.5], [-4.6, deckY + 1.6]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.0, 5), M.darkWood);
    p.position.set(x, y, 0);
    const f = pennant(0.6, 0.3, M.flagRedDark);
    f.position.set(x + 0.02, y + 0.35, 0.01);
    f.rotation.y = -0.15;
    g.add(p, f);
  }

  // ---- 登舱梯 ----
  const ladder = new THREE.Group();
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 5), M.paleWood);
    rail.position.set(0, 0.675, side * 0.22);
    ladder.add(rail);
  }
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 5), M.paleWood);
    rung.rotation.x = Math.PI / 2;
    rung.position.set(0, 0.18 + i * 0.25, 0);
    ladder.add(rung);
  }
  ladder.position.set(3.1, deckY, 1.32);
  ladder.rotation.z = 0.28;
  g.add(ladder);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.view = { radius: 9, y: 2.2 };
  return g;
}

/** 四坡瓦顶（庑殿式简形） */
export function hipRoof(w, d, h, mat, overhang = 0.25) {
  const g = new THREE.Group();
  const W = w + overhang * 2, D = d + overhang * 2;
  const geo = new THREE.BufferGeometry();
  const y0 = 0, y1 = h, ridgeW = W * 0.45;
  const v = [
    // 四角
    [-W / 2, y0, -D / 2], [W / 2, y0, -D / 2], [W / 2, y0, D / 2], [-W / 2, y0, D / 2],
    // 脊两端
    [-ridgeW / 2, y1, 0], [ridgeW / 2, y1, 0],
  ];
  const idx = [0, 1, 5, 0, 5, 4, 2, 3, 4, 2, 4, 5, 1, 2, 5, 3, 0, 4];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // UV 简易
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0.25, 1, 0.75, 1]);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const roof = new THREE.Mesh(geo, mat);
  roof.material.side = THREE.DoubleSide;
  g.add(roof);
  // 脊
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ridgeW + 0.15, 6), materials().darkWood);
  ridge.rotation.z = Math.PI / 2;
  ridge.position.y = y1 + 0.02;
  g.add(ridge);
  return g;
}
