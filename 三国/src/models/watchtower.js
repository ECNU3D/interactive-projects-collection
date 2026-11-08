// 05 东汉营门 + 两层楼橹 —— 木柱、双板门、门环、短木栅、开放瞭望台、灰瓦四坡顶、斗栱、木梯、军鼓
import * as THREE from 'three';
import { materials, railing, stake, cylBetween } from '../materials.js';
import { hipRoof } from './louchuan.js';

export function createWatchtower() {
  const M = materials();
  const g = new THREE.Group();
  g.name = 'watchtower';

  // ---- 石础 ----
  const plinthPos = [[-2.1, -1.15], [-2.1, 1.15], [2.1, -1.15], [2.1, 1.15], [-2.1, 0], [2.1, 0]];
  for (const [x, z] of plinthPos) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.5, 8), M.stone);
    s.position.set(x, 0.25, z);
    g.add(s);
  }

  // ---- 门柱（六柱） ----
  const postH = 3.6;
  for (const [x, z] of plinthPos) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, postH, 10), M.darkWood);
    p.position.set(x, 0.5 + postH / 2, z);
    g.add(p);
  }
  // 柱间横枋（下枋两道）
  for (const y of [1.2, 2.6]) {
    for (const z of [-1.15, 1.15]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 0.12), M.darkWood);
      beam.position.set(0, y, z);
      g.add(beam);
    }
  }

  // ---- 双板门（中央两柱之间，含门环） ----
  const doorW = 1.9, doorH = 2.75;
  for (const side of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.09), M.hullWood);
    door.position.set(side * (doorW / 2 + 0.1), 0.5 + doorH / 2, 0);
    g.add(door);
    // 门板竖缝
    for (let i = 1; i < 5; i++) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.015, doorH, 0.1), M.ironDark);
      seam.position.set(side * (doorW / 2 + 0.1) - doorW / 2 + (doorW * i) / 5, 0.5 + doorH / 2, 0);
      g.add(seam);
    }
    // 横贯门闩带
    for (const y of [0.9, 2.4]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.12, 0.03), M.ironDark);
      strap.position.set(side * (doorW / 2 + 0.1), y, 0.06);
      g.add(strap);
    }
  }
  // 门环
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.028, 6, 14), M.ironDark);
    ring.position.set(side * 0.42, 1.55, 0.09);
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.06, 8), M.ironDark);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(side * 0.42, 1.72, 0.08);
    g.add(ring, boss);
  }

  // ---- 上层楼面（平座） ----
  const floorY = 0.5 + postH;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.18, 3.0), M.deckWood);
  floor.position.set(0, floorY, 0);
  g.add(floor);
  // 平座下斗栱（简化：柱头小斗 + 横栱）
  for (const [x, z] of plinthPos) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), M.darkWood);
    cap.position.set(x, floorY - 0.12, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.16), M.darkWood);
    arm.position.set(x, floorY - 0.26, z);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.7), M.darkWood);
    arm2.position.set(x, floorY - 0.38, z);
    g.add(cap, arm, arm2);
  }

  // ---- 二层望楼：四柱 + 板壁（后壁与两侧壁，前面开敞） ----
  const upH = 1.9, upY = floorY + 0.09;
  const upPosts = [[-1.7, -0.9], [1.7, -0.9], [-1.7, 0.9], [1.7, 0.9]];
  for (const [x, z] of upPosts) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, upH, 8), M.darkWood);
    p.position.set(x, upY + upH / 2, z);
    g.add(p);
  }
  // 后壁板 + 侧后壁
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, upH * 0.82, 0.08), M.hullWood);
  back.position.set(0, upY + upH * 0.41, -0.9);
  g.add(back);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, upH * 0.82, 0.95), M.hullWood);
    wall.position.set(side * 1.7, upY + upH * 0.41, -0.42);
    g.add(wall);
    // 小窗洞
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.34), M.ironDark);
    win.position.set(side * 1.7, upY + upH * 0.55, -0.42);
    g.add(win);
  }
  // 二层斗栱
  for (const [x, z] of upPosts) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.34), M.darkWood);
    cap.position.set(x, upY + upH - 0.07, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.13), M.darkWood);
    arm.position.set(x, upY + upH - 0.2, z);
    g.add(cap, arm);
  }

  // ---- 望楼外回廊栏杆 ----
  const railY = floorY + 0.18;
  for (const side of [-1, 1]) {
    const r = railing(5.3, 0.55, M.darkWood, { posts: 12 });
    r.position.set(0, railY, side * 1.42);
    g.add(r);
  }
  for (const end of [-1, 1]) {
    const r = railing(2.84, 0.55, M.darkWood, { posts: 6 });
    r.rotation.y = Math.PI / 2;
    r.position.set(end * 2.6, railY, 0);
    g.add(r);
  }

  // ---- 四坡灰瓦顶 ----
  const roof = hipRoof(4.3, 2.5, 1.05, M.roofTile, 0.55);
  roof.position.set(0, upY + upH, 0);
  g.add(roof);
  // 脊端鸱吻（简化小柱）
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.14), M.darkWood);
    fin.position.set(side * (4.3 * 0.45) / 2 * 1.05, upY + upH + 1.05 + 0.12, 0);
    fin.rotation.z = side * 0.15;
    g.add(fin);
  }

  // ---- 木梯（侧面斜梯上楼） ----
  const ladder = new THREE.Group();
  const ladderH = floorY + 0.3;
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ladderH * 1.28, 6), M.paleWood);
    rail.position.set(0, ladderH / 2, s * 0.3);
    ladder.add(rail);
  }
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5), M.paleWood);
    rung.rotation.x = Math.PI / 2;
    rung.position.set(0, 0.3 + (ladderH - 0.6) * i / (steps - 1), 0);
    ladder.add(rung);
  }
  ladder.position.set(3.1, 0, 1.0);
  ladder.rotation.z = -0.62;
  ladder.rotation.y = 0.25;
  g.add(ladder);

  // ---- 军鼓（望楼前栏边） ----
  const drum = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 14), M.flagRedDark);
  shell.rotation.x = Math.PI / 2;
  const skin1 = new THREE.Mesh(new THREE.CircleGeometry(0.3, 14), M.clay);
  skin1.position.z = 0.26;
  const skin2 = skin1.clone(); skin2.position.z = -0.26; skin2.rotation.y = Math.PI;
  // 鼓钉圈
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), M.ironDark);
    nail.position.set(Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0.27);
    drum.add(nail);
  }
  drum.add(shell, skin1, skin2);
  // 鼓架
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.3), M.darkWood);
  stand.position.y = -0.42;
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.44, 5), M.darkWood);
    leg.position.set(s * 0.28, -0.22, 0);
    drum.add(leg);
  }
  drum.add(stand);
  drum.position.set(-1.9, floorY + 0.62, 0.9);
  drum.rotation.y = 0.5;
  g.add(drum);

  // ---- 两侧木栅（尖桩栅，横绳捆扎） ----
  for (const side of [-1, 1]) {
    const fence = palisade(5.5, 1.7, M);
    fence.position.set(side * (2.65 + 2.75), 0, 0.4);
    fence.rotation.y = side * -0.06;
    g.add(fence);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.view = { radius: 9, y: 3 };
  return g;
}

/** 尖桩木栅段 */
export function palisade(len = 5.5, h = 1.7, M = materials()) {
  const g = new THREE.Group();
  const n = Math.floor(len / 0.24);
  for (let i = 0; i < n; i++) {
    const s = stake(0.09, h * (0.92 + (i % 3) * 0.05), M.darkWood);
    s.position.set(-len / 2 + (len * (i + 0.5)) / n, 0, 0);
    s.rotation.z = (i % 2 ? 1 : -1) * 0.02;
    g.add(s);
  }
  // 横束杆两道
  for (const y of [h * 0.35, h * 0.68]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 6), M.paleWood);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, 0.12);
    g.add(bar);
  }
  return g;
}
