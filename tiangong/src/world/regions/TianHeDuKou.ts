/**
 * TianHeDuKou.ts —— 天河渡口（南天门外）｜文档 01 §1.2 A
 * 天蓬元帅驻地。一条横亘云海的星河，八万水兵营寨在岸边。
 * 原著只说他"掌管天河八万水兵"，未写天河形貌 —— 本作自拟（考据栏标注）。
 */
import * as THREE from 'three/webgpu';
import { Fn, vec4, float, color, uv, time, sin, smoothstep } from 'three/tsl';
import { Crowd, crowdFigureGeometry } from '../../npc/NpcManager';
import type { GameCtx, RegionBuildResult } from '../Region';

export function buildTianHe(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  // 天河：一条横贯的星辉水带（发光平面 + 流动噪声）
  const riverGeo = new THREE.PlaneGeometry(1600, 90, 1, 1);
  riverGeo.rotateX(-Math.PI / 2);
  const riverMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  riverMat.colorNode = Fn(() => {
    const flow: any = sin(uv().x.mul(80).sub(time.mul(0.6))).mul(0.5).add(0.5);
    const sparkle: any = smoothstep(0.75, 0.95, flow);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shimmer: any = sin(uv().y.mul(30).add(time.mul(0.4))).mul(0.2).add(0.2);
    const col: any = color(0x2a3a6a)
      .add((color(0x8fb8e8) as any).mul(sparkle.mul(1.6)))
      .add((color(0xc9b8e0) as any).mul(shimmer));
    const edge: any = smoothstep(0.0, 0.15, uv().y).mul(smoothstep(1.0, 0.85, uv().y));
    return vec4(col.r, col.g, col.b, edge.mul(0.9));
  })();
  const river = new THREE.Mesh(riverGeo, riverMat);
  river.position.set(0, 0.5, 980);
  group.add(river);

  // 渡口平台
  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(60, 2, 30),
    new THREE.MeshStandardNodeMaterial({ color: 0x8a8a9a, roughness: 0.8 }),
  );
  dock.position.set(0, 1, 940);
  group.add(dock);
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(-30, -2, 925), new THREE.Vector3(30, 2, 955)));

  // 水兵营寨：一排小帐（圆锥），岸边列队
  const tentGeo = new THREE.ConeGeometry(3, 4.5, 8);
  const tentMat = new THREE.MeshStandardNodeMaterial({ color: 0x4a5a7a, roughness: 0.85 });
  const tents = new THREE.InstancedMesh(tentGeo, tentMat, 40);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) {
    const x = -700 + i * 36 + Math.sin(i * 13) * 8;
    m4.setPosition(x, 2.2, 1040 + Math.sin(i * 7) * 20);
    tents.setMatrixAt(i, m4);
  }
  group.add(tents);

  // 水兵剪影两列
  const soldierGeo = crowdFigureGeometry(2.4);
  const soldierMat = new THREE.MeshStandardNodeMaterial({ color: 0x3a4a6a, roughness: 0.6 });
  const transforms: THREE.Matrix4[] = [];
  for (let i = 0; i < 16; i++) {
    m4.makeRotationY(Math.PI);
    m4.setPosition(-40 + i * 5.5, 2, 950);
    transforms.push(m4.clone());
  }
  group.add(new Crowd(soldierGeo, soldierMat, transforms).mesh);

  return {
    group,
    npcs: [
      {
        id: 'tianpeng',
        name: '天蓬元帅',
        region: 'tianhe',
        position: new THREE.Vector3(6, 2, 938),
        faceYaw: Math.PI,
        radius: 4.5,
        figure: { height: 3.4, robe: 0x2a4a7a, hat: 'helmet', prop: 'none', bulk: 1.7, rim: 0x9ab8e8 },
        title: '总督天河水军',
      },
    ],
    annotations: [
      {
        title: '天河渡口',
        body: '原著只说天蓬「掌管天河八万水兵」，未写天河形貌。星河、营寨、渡口皆为本作补设。',
        selfAuthored: true,
      },
      {
        title: '天蓬元帅',
        source: '第 8 回自述',
        body: '他此刻还是总督水军的元帅，铠甲齐整——距他贬下界还有一场蟠桃会。这是本作赠送给玩家的一次小小的时间旅行。',
      },
    ],
  };
}
