/**
 * ShouXingTai.ts —— 区域 C：寿星台 · 炼药炉｜文档 01 §1.2 C
 * 「寿星台上，有千千年不卸的名花；炼药炉边，有万万载常青的瑞草。」
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { giltBronzeMaterial } from '../../gen/arch/materials';
import type { GameCtx, RegionBuildResult } from '../Region';

export function buildShouXingTai(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  // 寿星台：攒尖台亭
  const taiSpec: HallSpec = {
    bays: 3, depths: 3, bayWidth: 4, columnHeight: 5,
    podiumTiers: 2, podiumHeight: 2.6,
    roof: 'zanjian', eaves: 1, finial: 'baozhu',
    dougongSteps: 5, ridgeBeasts: 5, tileColor: 'huang', doorNails: [5, 5],
  };
  const tai = buildHall(taiSpec, { name: '寿星台' });
  tai.group.position.set(-40, 0, 300);
  group.add(tai.group);
  tai.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(-40, 0, 300))));

  // 名花：台上团团花簇（千千年不卸）
  const flowerGeo = new THREE.IcosahedronGeometry(0.3, 0);
  const flowerMat = new THREE.MeshStandardNodeMaterial({ color: 0xe8a0b8, roughness: 0.7, emissive: 0xe8a0b8, emissiveIntensity: 0.25 });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 60);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r = 3.5 + Math.sin(i * 7) * 1.2;
    m4.setPosition(-40 + Math.cos(a) * r, 3.2 + Math.sin(i * 3) * 0.5, 300 + Math.sin(a) * r);
    flowers.setMatrixAt(i, m4);
  }
  group.add(flowers);

  // 炼药炉：青铜大炉 + 瑞草丛
  const furnace = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 2.4, 8), giltBronzeMaterial(0.6));
  furnace.position.set(18, 1.2, 288);
  group.add(furnace);
  const grassGeo = new THREE.ConeGeometry(0.14, 1.1, 5);
  const grassMat = new THREE.MeshStandardNodeMaterial({ color: 0x6a9a5a, roughness: 0.8, emissive: 0x3a6a3a, emissiveIntensity: 0.3 });
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, 80);
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    const r = 3 + Math.abs(Math.sin(i * 11)) * 6;
    m4.setPosition(18 + Math.cos(a) * r, 0.5, 288 + Math.sin(a) * r);
    grass.setMatrixAt(i, m4);
  }
  group.add(grass);

  return {
    group,
    npcs: [
      {
        id: 'shouxing',
        name: '寿星',
        region: 'shouxingtai',
        position: new THREE.Vector3(-36, 2.6, 296),
        faceYaw: Math.PI * 0.8,
        radius: 4,
        figure: { height: 2.0, robe: 0xe8d0a0, hat: 'furong', prop: 'staff', bulk: 1.2, ribbon: 1.2, rim: 0xffe9c0 },
        title: '南极老人星',
      },
    ],
    annotations: [
      {
        title: '寿星台 · 炼药炉',
        source: '第 4 回',
        body: '「寿星台上，有千千年不卸的名花；炼药炉边，有万万载常青的瑞草。」全书只有这两句的地方，正好做成两个安静的小景点。',
      },
    ],
  };
}
