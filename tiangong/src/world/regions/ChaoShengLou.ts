/**
 * ChaoShengLou.ts —— 区域 D：朝圣楼｜文档 01 §1.2 D
 *
 * 「金钟撞动，三曹神表进丹墀；天鼓鸣时，万圣朝王参玉帝。」
 * 金钟与天鼓可以敲 —— 敲响后远处宫殿群神仙列队又散去（朝会演出）。
 * 这是本作最重要的单点交互。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildBellStand, buildDrumStand } from '../RegionKit';
import { Crowd, crowdFigureGeometry } from '../../npc/NpcManager';
import type { GameCtx, RegionBuildResult } from '../Region';

export function buildChaoShengLou(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  const spec: HallSpec = {
    bays: 5, depths: 3, bayWidth: 5.5, columnHeight: 9,
    podiumTiers: 2, podiumHeight: 3,
    roof: 'xieshan', eaves: 2, finial: null,
    dougongSteps: 7, ridgeBeasts: 7, tileColor: 'huang', doorNails: [7, 7],
  };
  const lou = buildHall(spec, { name: '朝圣楼' });
  lou.group.position.set(0, 0, 150);
  group.add(lou.group);
  lou.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(0, 0, 150))));

  // 金钟、天鼓（楼前左右）
  const bellStand = buildBellStand();
  bellStand.group.position.set(-12, 0, 166);
  group.add(bellStand.group);
  const drumStand = buildDrumStand();
  drumStand.group.position.set(12, 0, 166);
  group.add(drumStand.group);

  // 朝会演出用的列队神仙（初始隐藏）
  const crowdGeo = crowdFigureGeometry(2.4);
  const crowdMat = new THREE.MeshStandardNodeMaterial({ color: 0x9a3a3a, roughness: 0.7 });
  const crowdMats: THREE.Matrix4[] = [];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 36; i++) {
    const row = Math.floor(i / 6);
    const col = i % 6;
    m4.makeRotationY(0);
    m4.setPosition(-25 + col * 10, 0, 120 - row * 12);
    crowdMats.push(m4.clone());
  }
  const crowd = new Crowd(crowdGeo, crowdMat, crowdMats);
  crowd.mesh.visible = false;
  group.add(crowd.mesh);

  ctx.events.on('chaohui', () => {
    crowd.mesh.visible = true;
    setTimeout(() => (crowd.mesh.visible = false), 90000); // 一炷香后散去
  });

  const bellWorld = new THREE.Vector3(-12, 3.4, 166 + 140 * 0);
  bellWorld.set(-12, 3.4, 166);
  return {
    group,
    interactables: [
      {
        id: 'strike-bell',
        position: new THREE.Vector3(-12, 0, 166),
        radius: 5,
        prompt: '撞金钟',
        cooldown: 8000,
        action: (c) => {
          c.audio.playBell(new THREE.Vector3(-12, 3, 166));
          c.events.emit('chaohui');
        },
      },
      {
        id: 'strike-drum',
        position: new THREE.Vector3(12, 0, 166),
        radius: 5,
        prompt: '鸣天鼓',
        cooldown: 8000,
        action: (c) => {
          c.audio.playDrum(new THREE.Vector3(12, 2, 166));
          c.events.emit('chaohui');
        },
      },
    ],
    annotations: [
      {
        title: '朝圣楼',
        source: '第 4 回',
        body: '「金钟撞动，三曹神表进丹墀；天鼓鸣时，万圣朝王参玉帝。」全书仅此一句。百官候朝、集散之地的功能是推断。',
        selfAuthored: true,
      },
      {
        title: '金钟可敲',
        body: '原著只写「金钟撞动」「天鼓鸣时」，未写谁敲、能否敲。让玩家敲响它，是本作的补笔。',
        selfAuthored: true,
      },
    ],
  };
}
