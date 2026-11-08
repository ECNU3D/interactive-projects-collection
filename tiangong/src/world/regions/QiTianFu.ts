/**
 * QiTianFu.ts —— 区域 L：齐天大圣府（第三层 · 家 · 出生点）｜文档 01 §1.2 L
 *
 * 「在蟠桃园右首，起一座齐天大圣府，府内设个二司：一名安静司，一名宁神司。」
 * 全新落成，崭新，气派，空的。这是本作最大的冷笑话，且完全出自原著。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildPlaque } from '../../gen/arch/Column';
import { giltBronzeMaterial } from '../../gen/arch/materials';
import type { GameCtx, RegionBuildResult } from '../Region';

const CX = 310;
const CZ = 90;

export function buildQiTianFu(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  // 正厅（气派、崭新、空）
  const mainSpec: HallSpec = {
    bays: 5, depths: 3, bayWidth: 5.5, columnHeight: 7,
    podiumTiers: 1, podiumHeight: 1.6,
    roof: 'xieshan', eaves: 1, finial: null,
    dougongSteps: 5, ridgeBeasts: 5, tileColor: 'huang', doorNails: [7, 7],
  };
  const main = buildHall(mainSpec, { name: '齐天大圣府' });
  main.group.position.set(CX, 0, CZ - 30);
  group.add(main.group);
  main.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(CX, 0, CZ - 30))));

  // 二司：东西配房，各挂一块匾
  for (const [dx, name] of [[-26, '安静司'], [26, '宁神司']] as const) {
    const sideSpec: HallSpec = {
      bays: 3, depths: 1, bayWidth: 4.5, columnHeight: 4.5,
      podiumTiers: 1, podiumHeight: 0.8,
      roof: 'xuanshan', eaves: 1, finial: null,
      dougongSteps: 3, ridgeBeasts: 3, tileColor: 'huang-lv-jianbian', doorNails: [5, 5],
    };
    const side = buildHall(sideSpec, { name });
    side.group.position.set(CX + dx, 0, CZ - 28);
    group.add(side.group);
    side.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(CX + dx, 0, CZ - 28))));
  }

  // 院中案几：御酒二瓶、金花十朵（第 4 回五斗星君送任时所赐，没动过）
  const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.2), new THREE.MeshStandardNodeMaterial({ color: 0x4a3a2a, roughness: 0.5 }));
  table.position.set(CX, 0.45, CZ - 12);
  group.add(table);
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(CX - 1.5, 0, CZ - 12.6), new THREE.Vector3(CX + 1.5, 1, CZ - 11.4)));
  for (const s of [-0.7, 0.7]) {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.6, 8), giltBronzeMaterial(0.4));
    bottle.position.set(CX + s, 1.2, CZ - 12);
    group.add(bottle);
  }
  const flowerGeo = new THREE.IcosahedronGeometry(0.09, 0);
  const flowerMat = giltBronzeMaterial(0.8);
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 10);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 10; i++) {
    m4.setPosition(CX - 1.1 + i * 0.24, 0.95, CZ - 11.7 + Math.sin(i * 3) * 0.15);
    flowers.setMatrixAt(i, m4);
  }
  group.add(flowers);

  // 院墙（矮墙圈出"家"）
  const wallMat = new THREE.MeshStandardNodeMaterial({ color: 0xd8c9b0, roughness: 0.85 });
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(70, 3, 0.8), wallMat);
  wallN.position.set(CX, 1.5, CZ - 44);
  const wallS = wallN.clone();
  wallS.position.z = CZ + 16;
  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 60), wallMat);
  wallW.position.set(CX - 35, 1.5, CZ - 14);
  const wallE = wallW.clone();
  wallE.position.x = CX + 35;
  group.add(wallN, wallS, wallW, wallE);
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(CX - 35.4, 0, CZ - 44.4), new THREE.Vector3(CX + 35, 3, CZ - 43.6)));
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(CX - 35.4, 0, CZ + 15.6), new THREE.Vector3(CX + 35, 3, CZ + 16.4)));
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(CX - 35.4, 0, CZ - 44), new THREE.Vector3(CX - 34.6, 3, CZ + 16)));
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(CX + 34.6, 0, CZ - 44), new THREE.Vector3(CX + 35.4, 3, CZ + 16)));

  // 院门（南向缺口处立一对小匾柱）
  const gatePlaque = buildPlaque('齐天府', 3);
  gatePlaque.position.set(CX, 5.5, CZ + 16);
  group.add(gatePlaque);

  return {
    group,
    npcs: [
      {
        id: 'anjing-sili',
        name: '安静司仙吏',
        region: 'qitian-fu',
        position: new THREE.Vector3(CX - 26, 0.8, CZ - 24),
        faceYaw: Math.PI,
        radius: 3.2,
        figure: { height: 1.9, robe: 0x9ab8c8, hat: 'furong', prop: 'none', bulk: 0.95, rim: 0xc8d8e8 },
        title: '齐天府二司',
      },
      {
        id: 'ningshen-sili',
        name: '宁神司仙吏',
        region: 'qitian-fu',
        position: new THREE.Vector3(CX + 26, 0.8, CZ - 24),
        faceYaw: Math.PI,
        radius: 3.2,
        figure: { height: 1.9, robe: 0xc8a8b8, hat: 'furong', prop: 'none', bulk: 0.95, rim: 0xe8d0d8 },
        title: '齐天府二司',
      },
      {
        id: 'taibai-jinxing',
        name: '太白金星',
        region: 'qitian-fu',
        position: new THREE.Vector3(CX - 8, 0, CZ + 6),
        faceYaw: Math.PI / 2,
        radius: 4,
        figure: { height: 2.2, robe: 0xf0e8d8, hat: 'furong', prop: 'scroll', bulk: 1.05, ribbon: 1.5, rim: 0xffe9c0 },
        title: '传旨天使',
      },
    ],
    annotations: [
      {
        title: '齐天大圣府',
        source: '第 4 回',
        body: '「玉帝即命工干官——张、鲁二班——在蟠桃园右首，起一座齐天大圣府，府内设个二司：一名安静司，一名宁神司。」玉帝给一只闹事的猴子建了座府，府里两个部门，一个叫安静，一个叫宁神。',
      },
      { title: '御酒金花', source: '第 4 回', body: '五斗星君送任时「赐御酒二瓶，金花十朵」。就放在案上，没动过。' },
    ],
  };
}
