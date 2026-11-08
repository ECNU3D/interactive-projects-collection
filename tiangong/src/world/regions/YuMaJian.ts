/**
 * YuMaJian.ts —— 区域 H：御马监（玩家的旧单位）｜文档 01 §1.2 H
 *
 * 天马千匹。马群见到你会「泯耳攒蹄」（低头贴耳）——一个不用台词的情感瞬间。
 * 与监丞重演品级问答是全作的情绪支点。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { Crowd, crowdFigureGeometry } from '../../npc/NpcManager';
import type { GameCtx, RegionBuildResult } from '../Region';

/** 天马剪影（低头贴耳 = 泯耳攒蹄） */
function horseGeometry(): THREE.BufferGeometry {
  const body = new THREE.CapsuleGeometry(0.5, 1.4, 4, 8);
  body.rotateZ(Math.PI / 2);
  body.translate(0, 1.15, 0);
  const neck = new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6);
  neck.rotateX(0.9); // 低头
  neck.translate(0.95, 1.45, 0);
  const head = new THREE.CapsuleGeometry(0.14, 0.5, 3, 6);
  head.rotateX(1.2);
  head.translate(1.1, 1.15, 0);
  const legG: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[0.55, 0.22], [0.55, -0.22], [-0.55, 0.22], [-0.55, -0.22]] as const) {
    const leg = new THREE.CylinderGeometry(0.07, 0.06, 1.0, 5);
    leg.translate(x, 0.5, z);
    legG.push(leg);
  }
  const geos = [body, neck, head, ...legG];
  return mergeGeometries(geos)!;
}

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildYuMaJian(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();
  const cx = 340;
  const cz = 140;

  // 厩房：悬山小殿两排（杂役建筑，青瓦）
  for (const dz of [-18, 18]) {
    const spec: HallSpec = {
      bays: 5, depths: 1, bayWidth: 4.5, columnHeight: 4,
      podiumTiers: 0, podiumHeight: 0.5,
      roof: 'xuanshan', eaves: 1, finial: null,
      dougongSteps: 3, ridgeBeasts: 3, tileColor: 'hei', doorNails: [3, 3],
    };
    const stable = buildHall(spec, { detail: 'low' });
    stable.group.position.set(cx, 0, cz + dz);
    group.add(stable.group);
    stable.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(cx, 0, cz + dz))));
  }

  // 天马群（泯耳攒蹄 = 低头姿势已建模）
  const horseGeo = horseGeometry();
  const horseMat = new THREE.MeshStandardNodeMaterial({ color: 0xd8d0c0, roughness: 0.7 });
  const horses = new THREE.InstancedMesh(horseGeo, horseMat, 48);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < 48; i++) {
    const x = cx - 30 + (i % 8) * 8 + Math.sin(i * 7) * 2;
    const z = cz - 10 + Math.floor(i / 8) * 4.5;
    q.setFromEuler(new THREE.Euler(0, Math.sin(i * 13) * Math.PI, 0));
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1));
    horses.setMatrixAt(i, m4);
  }
  group.add(horses);

  // 力士群众
  const crowdGeo = crowdFigureGeometry(1.9);
  const crowdMat = new THREE.MeshStandardNodeMaterial({ color: 0x7a6a5a, roughness: 0.8 });
  const transforms: THREE.Matrix4[] = [];
  for (let i = 0; i < 6; i++) {
    m4.makeRotationY(Math.PI / 2);
    m4.setPosition(cx - 24 + i * 9, 0, cz + 26);
    transforms.push(m4.clone());
  }
  group.add(new Crowd(crowdGeo, crowdMat, transforms).mesh);

  return {
    group,
    npcs: [
      {
        id: 'yuma-jiancheng',
        name: '御马监监丞',
        region: 'yumajian',
        position: new THREE.Vector3(cx - 6, 0, cz + 8),
        faceYaw: -Math.PI / 2,
        radius: 3.5,
        figure: { height: 2.0, robe: 0x6a5a4a, hat: 'furong', prop: 'scroll', bulk: 1, rim: 0xd8c8a8 },
        title: '你的旧下属',
      },
    ],
    annotations: [
      {
        title: '御马监',
        source: '第 4 回',
        body: '「弼马昼夜不睡，滋养马匹……那些天马见了他，泯耳攒蹄，倒养得肉肥膘满。」你曾是这里的正堂管事，干得还相当不错——然后你掀了公案跑了。',
      },
    ],
  };
}
