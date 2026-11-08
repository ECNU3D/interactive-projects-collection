/**
 * PiXiangDian.ts —— 区域 I：披香殿｜文档 01 §1.2 I / 文档 03 §9
 *
 * 全场体积光最集中的房间：终年焚香，几乎看不清对面。
 * 高窗斜射光被香烟切成光柱；地面一层平铺白雾。
 * 玩家应该下意识地放慢移动速度。
 */
import * as THREE from 'three/webgpu';
import { Fn, vec4, float, color, positionWorld, time, mx_fractal_noise_float, smoothstep } from 'three/tsl';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildShaftGroup } from '../../fx/GodRays';
import { Crowd, crowdFigureGeometry } from '../../npc/NpcManager';
import type { GameCtx, RegionBuildResult } from '../Region';

export function buildPiXiangDian(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();
  const cx = -270;
  const cz = -130;

  const spec: HallSpec = {
    bays: 5, depths: 3, bayWidth: 4.5, columnHeight: 7,
    podiumTiers: 1, podiumHeight: 1.8,
    roof: 'xieshan', eaves: 1, finial: null,
    dougongSteps: 7, ridgeBeasts: 5, tileColor: 'huang-lv-jianbian', doorNails: [7, 5],
  };
  const hall = buildHall(spec, { name: '披香殿' });
  hall.group.position.set(cx, 0, cz);
  group.add(hall.group);
  hall.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(cx, 0, cz))));

  // 香烟光柱群（丁达尔效应集中展示）
  const shafts = buildShaftGroup(5, 3.2, { topR: 0.8, bottomR: 3, height: 22, intensity: 0.75, color: 0xffe0c0 });
  shafts.position.set(cx, 1.8 + 20, cz);
  group.add(shafts);

  // 地面平铺白雾
  const fogGeo = new THREE.PlaneGeometry(30, 20);
  fogGeo.rotateX(-Math.PI / 2);
  const fogMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  fogMat.colorNode = Fn(() => {
    const n = mx_fractal_noise_float(positionWorld.xz.mul(0.25).add(time.mul(0.02)), 3, 2.0, 0.6);
    return vec4(color(0xf5f2ea), smoothstep(0.2, 0.7, n).mul(0.5));
  })();
  const floorFog = new THREE.Mesh(fogGeo, fogMat);
  floorFog.position.set(cx, 2.4, cz);
  group.add(floorFog);

  // 侍香玉女（烟里若隐若现的身影，不可对话——她的戏在烟里）
  const figure = crowdFigureGeometry(1.8);
  const figureMat = new THREE.MeshStandardNodeMaterial({ color: 0xd8c8d8, roughness: 0.8, transparent: true, opacity: 0.55 });
  const transforms: THREE.Matrix4[] = [];
  const m4 = new THREE.Matrix4();
  m4.makeRotationY(Math.PI / 3);
  m4.setPosition(cx - 4, 1.8, cz - 3);
  transforms.push(m4.clone());
  m4.makeRotationY(-Math.PI / 2);
  m4.setPosition(cx + 5, 1.8, cz + 2);
  transforms.push(m4.clone());
  group.add(new Crowd(figure, figureMat, transforms).mesh);

  return {
    group,
    annotations: [
      {
        title: '披香殿',
        source: '第 31、87 回',
        body: '原著只有「披香殿侍香的玉女」一句，无外观描写。本作定为终年焚香、烟雾极浓的内廷小殿，光线全靠香烟中的丁达尔效应。',
        selfAuthored: true,
      },
    ],
  };
}
