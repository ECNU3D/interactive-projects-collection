/**
 * GuangHanGong.ts —— 区域 N：广寒宫（第四层 · 月天）｜文档 01 §1.2 N
 *
 * 永夜，冷色，全场唯一不用暖金色的区域。桂树，捣药声。
 * 全场最好的 3D 空间音频演示点。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildOsmanthus } from '../RegionKit';
import { buildLightShaft } from '../../fx/GodRays';
import type { GameCtx, RegionBuildResult } from '../Region';

const CX = -750;
const CZ = -350;

export function buildGuangHanGong(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  // 月宫：蓝瓦冷色（脱离黄色系）
  const spec: HallSpec = {
    bays: 5, depths: 3, bayWidth: 5, columnHeight: 7,
    podiumTiers: 2, podiumHeight: 2.4,
    roof: 'xieshan', eaves: 2, finial: 'baozhu',
    dougongSteps: 7, ridgeBeasts: 5, tileColor: 'lan', doorNails: [7, 7],
  };
  const hall = buildHall(spec, { name: '广寒宫' });
  hall.group.position.set(CX, 0, CZ);
  group.add(hall.group);
  hall.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(CX, 0, CZ))));

  // 桂树
  const tree = buildOsmanthus();
  tree.position.set(CX - 26, 0, CZ + 18);
  group.add(tree);

  // 冷色月光盘（天上挂一轮）
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(30, 20, 16),
    new THREE.MeshBasicNodeMaterial({ color: 0xd6e4f0, fog: false }),
  );
  moon.position.set(CX - 300, 260, CZ - 400);
  group.add(moon);

  // 冷蓝光柱（稀薄，与其他区域对照）
  const shaft = buildLightShaft({ topR: 4, bottomR: 10, height: 50, intensity: 0.22, color: 0xa8c8f0 });
  shaft.position.set(CX - 26, 60, CZ + 18);
  group.add(shaft);

  // 捣药臼（玉兔的工位 —— 全场最好的空间音频演示点）
  const mortar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.3, 0.5, 8),
    new THREE.MeshStandardNodeMaterial({ color: 0xb9b4ac, roughness: 0.6 }),
  );
  mortar.position.set(CX - 24, 0.25, CZ + 15);
  group.add(mortar);

  return {
    group,
    npcs: [
      {
        id: 'taiyin-xingjun',
        name: '太阴星君',
        region: 'guanghangong',
        position: new THREE.Vector3(CX, 2.4, CZ + 12),
        faceYaw: 0,
        radius: 4,
        figure: { height: 2.3, robe: 0xc8d4e8, hat: 'huantiao', prop: 'none', bulk: 1, ribbon: 1.8, rim: 0xd6e4f0 },
        title: '月宫之主',
      },
      {
        id: 'change',
        name: '霓裳仙子',
        region: 'guanghangong',
        position: new THREE.Vector3(CX - 6, 2.4, CZ + 10),
        faceYaw: 0.3,
        radius: 3.2,
        figure: { height: 1.9, robe: 0xe8ecf4, hat: 'huantiao', prop: 'none', bulk: 0.8, ribbon: 1.6, rim: 0xd6e4f0 },
        title: '嫦娥（月宫仙女的统称）',
      },
      {
        id: 'yutu',
        name: '玉兔',
        region: 'guanghangong',
        position: new THREE.Vector3(CX - 24, 0, CZ + 14),
        faceYaw: Math.PI / 3,
        radius: 3.2,
        figure: { height: 1.3, robe: 0xf0f0f0, hat: 'none', prop: 'pestle', bulk: 0.8, rim: 0xe8f0f8 },
        title: '广寒宫捣药',
      },
    ],
    annotations: [
      {
        title: '广寒宫',
        source: '第 19、95 回',
        body: '别名蟾宫、桂殿。永夜，冷色——全场唯一的冷区。「是我广寒宫捣玄霜仙药之玉兔也。」',
      },
      {
        title: '嫦娥是复数',
        body: '原著中「嫦娥」是月宫仙女的统称（姮娥仙子、霓裳仙子等），不是一个人名。',
      },
    ],
  };
}
