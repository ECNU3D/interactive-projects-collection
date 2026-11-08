/**
 * Avatar.ts —— 玩家化身：齐天大圣｜文档 01 §2.5
 * 「戴上紫金冠，贯上黄金甲，登上步云鞋」（第 4 回）。
 * 第三人称能看见自己的紫金冠黄金甲——这是扮演感的来源。
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { giltBronzeMaterial } from '../gen/arch/materials';
import { Fn, color, normalView, saturate, pow } from 'three/tsl';

export function buildWukong(): THREE.Group {
  const g = new THREE.Group();
  const H = 1.7;

  // 锁子黄金甲（西海敖闰所赠）
  const armorMat = new THREE.MeshPhysicalNodeMaterial({ color: 0xd9a43a, metalness: 0.9, roughness: 0.35 });
  armorMat.emissiveNode = Fn(() => {
    const f = pow(saturate(normalView.z).oneMinus(), 2.4);
    return color(0xffd9a0).mul(f.mul(0.5));
  })();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.13, H * 0.2, H * 0.5, 10), armorMat);
  body.position.y = H * 0.45;
  g.add(body);

  // 猿面（金棕色，眼位亮）
  const headMat = new THREE.MeshStandardNodeMaterial({ color: 0xb08050, roughness: 0.7 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(H * 0.07, 12, 10), headMat);
  head.position.y = H * 0.82;
  g.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(H * 0.055, 10, 8, -Math.PI / 3, (Math.PI * 2) / 3, Math.PI * 0.3, Math.PI * 0.4), new THREE.MeshStandardNodeMaterial({ color: 0xe8c8a0, roughness: 0.65 }));
  face.position.copy(head.position);
  g.add(face);

  // 凤翅紫金冠（南海敖钦所赠）：冠 + 两根长翎
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.05, H * 0.06, H * 0.06, 8), giltBronzeMaterial(0.5));
  crown.position.y = H * 0.9;
  g.add(crown);
  const featherGeo = new THREE.CylinderGeometry(0.008, 0.002, H * 0.34, 4);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(featherGeo, giltBronzeMaterial(0.8));
    f.position.set(s * H * 0.05, H * 1.04, -H * 0.02);
    f.rotation.z = s * 0.28;
    g.add(f);
  }

  // 四肢（简化：甲袖 + 甲裤）
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.035, H * 0.045, H * 0.3, 6), armorMat);
    arm.position.set(s * H * 0.17, H * 0.52, 0);
    arm.rotation.z = s * 0.2;
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.045, H * 0.05, H * 0.22, 6), armorMat);
    leg.position.set(s * H * 0.07, H * 0.12, 0);
    g.add(leg);
    // 藕丝步云履（北海敖顺所赠）
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(H * 0.06, H * 0.035, H * 0.1), new THREE.MeshStandardNodeMaterial({ color: 0xf0e8d8, roughness: 0.5 }));
    shoe.position.set(s * H * 0.07, H * 0.015, H * 0.02);
    g.add(shoe);
  }

  // 如意金箍棒（斜背）：两头金箍，中间乌铁
  const shaft = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6);
  const iron = new THREE.MeshStandardNodeMaterial({ color: 0x2a2a30, metalness: 0.8, roughness: 0.4 });
  const staffParts: THREE.BufferGeometry[] = [shaft];
  for (const e of [-0.68, 0.68]) {
    const hoop = new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6);
    hoop.translate(0, e, 0);
    staffParts.push(hoop);
  }
  const staff = new THREE.Mesh(mergeGeometries(staffParts)!, iron);
  const hoopL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6), giltBronzeMaterial(0.6));
  hoopL.position.y = -0.68;
  const hoopR = hoopL.clone();
  hoopR.position.y = 0.68;
  const staffGroup = new THREE.Group();
  staffGroup.add(staff, hoopL, hoopR);
  staffGroup.position.set(-0.1, H * 0.55, -0.16);
  staffGroup.rotation.z = 0.5;
  g.add(staffGroup);

  // 虎皮裙一缕（腰下短摆）
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.2, H * 0.26, H * 0.14, 10, 1, true), new THREE.MeshStandardNodeMaterial({ color: 0xc98a3a, roughness: 0.8, side: THREE.DoubleSide }));
  skirt.position.y = H * 0.22;
  g.add(skirt);

  return g;
}
