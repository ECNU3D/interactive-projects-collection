/**
 * ZhanYaoTai.ts —— 区域 J：斩妖台 · 降妖柱｜文档 01 §1.2 J
 *
 * 空置、废弃、无人。台上有一根柱子，柱身有砍痕。
 * 玩家走近，什么都不会发生。这是全作唯一的"预言"。
 * 无音乐，只有风声（文档 04 §4.5：刻意的安静）。
 */
import * as THREE from 'three/webgpu';
import { buildDemonPillar } from '../RegionKit';
import type { GameCtx, RegionBuildResult } from '../Region';

export function buildZhanYaoTai(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();
  const cx = 390;
  const cz = -270;

  // 石台（残破，无栏杆）
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 18, 3, 8),
    new THREE.MeshStandardNodeMaterial({ color: 0x4a4550, roughness: 0.95 }),
  );
  platform.position.set(cx, 1.5, cz);
  group.add(platform);
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(cx - 14, -1, cz - 14), new THREE.Vector3(cx + 14, 3, cz + 14)));

  // 降妖柱
  const pillar = buildDemonPillar();
  pillar.position.set(cx, 3, cz);
  group.add(pillar);

  // 两根断柱
  for (const [dx, dz, tilt] of [[-7, 4, 0.2], [6, -6, -0.15]] as const) {
    const broken = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.7, 3, 7),
      new THREE.MeshStandardNodeMaterial({ color: 0x555060, roughness: 0.95 }),
    );
    broken.position.set(cx + dx, 4.2, cz + dz);
    broken.rotation.z = tilt;
    group.add(broken);
  }

  return {
    group,
    annotations: [
      {
        title: '斩妖台 · 降妖柱',
        source: '第 7 回',
        body: '「押去斩妖台下，绑在降妖柱上，刀砍斧剁，枪刺剑刳，莫想伤及其身。」此刻它还空着。没有 NPC，没有音乐，没有台词。',
      },
    ],
  };
}
