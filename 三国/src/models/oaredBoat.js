// 03 东汉中型桨战船 —— 长窄低舷、侧桨、竹席拱篷、短桅卷帆、尾操纵桨、石碇
import * as THREE from 'three';
import { materials, railing, pennant, cylBetween } from '../materials.js';
import { loftedHull, deck, oarBank, furledSail, mastFlag, rigging, oar } from './shipCommon.js';

export function createOaredBoat() {
  const M = materials();
  const g = new THREE.Group();
  g.name = 'oaredBoat';

  // 按 README：船首翘度比参考图收敛约 20%
  const L = 9.5, B = 1.7, D = 0.85;
  const hull = loftedHull({
    length: L, beam: B, depth: D,
    bowRise: 0.62, sternRise: 0.45,       // 首翘已调低
    bowKeelRise: 0.35, sternKeelRise: 0.22,
    sternWidth: 0.42, bowWidth: 0.16, flare: 0.3,
    mat: M.hullWood,
  });
  g.add(hull, deck(hull, M.deckWood));
  const deckY = D * 0.82;

  // ---- 低舷栏杆（前后段短栏） ----
  for (const side of [-1, 1]) {
    const r1 = railing(2.6, 0.34, M.darkWood, { posts: 7 });
    r1.position.set(2.8, deckY + 0.28, side * 0.72);
    r1.rotation.x = side * 0.04;
    const r2 = railing(2.2, 0.34, M.darkWood, { posts: 6 });
    r2.position.set(-3.2, deckY + 0.26, side * 0.68);
    g.add(r1, r2);
  }

  // ---- 竹席拱篷（中段，前端开门） ----
  const canopy = archedCanopy(3.2, 1.15, 0.85, M.weave);
  canopy.position.set(-0.6, deckY + 0.05, 0);
  g.add(canopy);
  // 篷门（深色开口 + 门框）
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), M.ironDark);
  door.position.set(1.02, deckY + 0.42, 0);
  door.rotation.y = Math.PI / 2;
  const doorFrame = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 5, 10, Math.PI), M.darkWood);
  doorFrame.position.set(1.02, deckY + 0.42, 0);
  doorFrame.rotation.y = Math.PI / 2;
  g.add(door, doorFrame);

  // ---- 短桅 + 卷帆 ----
  const ms = furledSail({ mastH: 3.4, w: 2.2, mat: M.darkWood, clothMat: M.sail });
  ms.position.set(0.4, deckY + 0.7, 0);
  g.add(ms);
  // 侧支索
  g.add(rigging([
    [[0.4, deckY + 0.7 + 3.4 * 0.9, 0], [2.9, deckY + 0.35, 0.62]],
    [[0.4, deckY + 0.7 + 3.4 * 0.9, 0], [2.9, deckY + 0.35, -0.62]],
    [[0.4, deckY + 0.7 + 3.4 * 0.9, 0], [-2.4, deckY + 0.4, 0]],
  ], M.rope));
  // 桅顶红旗
  const flag = mastFlag(0.7, 0.8, M.flagRed);
  flag.position.set(0.4, deckY + 0.7 + 3.4, 0);
  g.add(flag);

  // ---- 舷侧桨 12 支/舷 ----
  g.add(oarBank(hull, 12, { oarLen: 1.9, side: 1, angle: 0.66, mat: M.paleWood }));
  g.add(oarBank(hull, 12, { oarLen: 1.9, side: -1, angle: 0.66, mat: M.paleWood }));

  // ---- 尾操纵桨（尾部左侧大桨，桨叶斜向下入水） ----
  const steer = oar(2.6, M.darkWood);
  steer.position.set(-L / 2 + 0.35, deckY + 0.5, -0.62);
  steer.rotation.set(0.55, 0, -0.4);
  g.add(steer);
  // 尾部支架
  const fork = new THREE.Group();
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.5, 5), M.darkWood);
    p.position.set(0, 0.25, s * 0.14);
    p.rotation.x = s * 0.25;
    fork.add(p);
  }
  fork.position.set(-L / 2 + 0.3, deckY + 0.1, -0.5);
  g.add(fork);

  // ---- 船首石碇 + 麻绳 ----
  const stone = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M.stone);
  stone.scale.set(1, 0.82, 0.9);
  stone.position.set(L / 2 - 1.15, deckY + 0.16, 0.3);
  g.add(stone);
  const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 14), M.rope);
  ropeCoil.rotation.x = Math.PI / 2;
  ropeCoil.position.set(L / 2 - 0.7, deckY + 0.06, 0.25);
  g.add(ropeCoil);
  g.add(rigging([[[L / 2 - 1.15, deckY + 0.3, 0.3], [L / 2 - 0.72, deckY + 0.1, 0.26]]], M.rope, 0.015));

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.view = { radius: 7, y: 1.6 };
  return g;
}

/** 竹席拱篷（半圆拱壳 + 两端席片） */
export function archedCanopy(len, w, h, mat) {
  const g = new THREE.Group();
  const shellWrap = new THREE.Mesh(
    new THREE.CylinderGeometry(w / 2, w / 2, len, 14, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ map: mat.map, roughness: 0.95, side: THREE.DoubleSide })
  );
  shellWrap.rotation.z = Math.PI / 2;
  shellWrap.rotation.y = Math.PI / 2;
  shellWrap.scale.z = h / (w / 2);
  g.add(shellWrap);
  // 端片（后端封闭）
  const cap = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 12, 0, Math.PI), mat);
  cap.rotation.y = -Math.PI / 2;
  cap.scale.y = h / (w / 2);
  cap.position.x = -len / 2;
  g.add(cap);
  // 拱肋
  for (let i = 0; i <= 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.01, 0.02, 5, 12, Math.PI), materials().darkWood);
    rib.rotation.y = Math.PI / 2;
    rib.scale.y = h / (w / 2);
    rib.position.x = -len / 2 + (len * i) / 4;
    g.add(rib);
  }
  return g;
}
