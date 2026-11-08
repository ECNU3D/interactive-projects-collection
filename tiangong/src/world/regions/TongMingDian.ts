/**
 * TongMingDian.ts —— 区域 E：通明殿（外朝 · 社交中枢）｜文档 01 §1.2 E
 *
 * 进表、演礼、候旨、天师值守 —— 天庭的收发室兼秘书处。
 * 四大天师围着长案互相打趣；殿门朝北开着，能望见灵霄宝殿。
 * 「递本子」流程完成 → 天师引奏 → 获得灵霄殿准入（文档 01 §1.3）。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildPlaque } from '../../gen/arch/Column';
import { store } from '../../core/Store';
import type { GameCtx, RegionBuildResult } from '../Region';
import type { NpcDef } from '../../npc/Npc';

const TIANSHI = [
  { id: 'zhang-daoling', name: '张道陵', robe: 0x8a3a3a, x: -6 },
  { id: 'ge-xianweng', name: '葛仙翁', robe: 0x7a4a5a, x: -2 },
  { id: 'xu-jingyang', name: '许旌阳', robe: 0x5a6a8a, x: 2 },
  { id: 'qiu-hongji', name: '丘弘济', robe: 0x6a5a7a, x: 6 },
];

export function buildTongMingDian(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();
  const cx = 0;
  const cz = 20;

  const spec: HallSpec = {
    bays: 7, depths: 5, bayWidth: 6, columnHeight: 10,
    podiumTiers: 2, podiumHeight: 3.4,
    roof: 'wudian', eaves: 2, finial: null,
    dougongSteps: 7, ridgeBeasts: 9, // 通明殿 9 兽（文档 03 §1.3）
    tileColor: 'huang', doorNails: [9, 7],
  };
  const hall = buildHall(spec, { name: '通明殿' });
  hall.group.position.set(cx, 0, cz);
  group.add(hall.group);
  hall.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(cx, 0, cz))));

  // 长案 + 堆满的表章（可读的彩蛋文本载体）
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 2.2),
    new THREE.MeshStandardNodeMaterial({ color: 0x5a3a2a, roughness: 0.6 }),
  );
  desk.position.set(cx, 3.4 + 0.5, cz + 2);
  group.add(desk);
  const paperGeo = new THREE.BoxGeometry(0.5, 0.04, 0.8);
  const paperMat = new THREE.MeshStandardNodeMaterial({ color: 0xf0e8d0, roughness: 0.9 });
  const papers = new THREE.InstancedMesh(paperGeo, paperMat, 24);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 24; i++) {
    m4.makeRotationY(Math.sin(i * 3.3) * 0.6);
    m4.setPosition(cx - 4.5 + (i % 8) * 1.25, 3.4 + 1.05 + Math.floor(i / 8) * 0.05, cz + 1.4 + Math.sin(i * 7) * 0.4);
    papers.setMatrixAt(i, m4);
  }
  group.add(papers);

  // 「递状子」案前交互 → 完成引奏流程（简化：与任一天师对话中通过 topic 触发；此处放提示牌）
  const plaque = buildPlaque('通政司', 2.4);
  plaque.position.set(cx, 3.4 + 2.2, cz + 4);
  group.add(plaque);

  const npcs: NpcDef[] = TIANSHI.map((t) => ({
    id: t.id,
    name: t.name,
    region: 'tongmingdian',
    position: new THREE.Vector3(cx + t.x, 3.4, cz + 0.5),
    faceYaw: Math.PI,
    radius: 3.5,
    figure: { height: 2.4, robe: t.robe, hat: 'furong' as const, prop: 'scroll' as const, bulk: 1, rim: 0xe8d0a0 },
    title: '四大天师',
  }));

  npcs.push(
    {
      id: 'yinzou-xiantong',
      name: '引奏仙童',
      region: 'tongmingdian',
      position: new THREE.Vector3(cx - 9, 3.4, cz + 4),
      faceYaw: Math.PI / 2,
      radius: 3,
      figure: { height: 1.5, robe: 0x8ab8a0, hat: 'bun', prop: 'none', bulk: 0.8, rim: 0xc8f0d8 },
      title: '通明殿收表',
    },
    {
      id: 'chuanyan-yunv',
      name: '传言玉女',
      region: 'tongmingdian',
      position: new THREE.Vector3(cx + 9, 3.4, cz + 4),
      faceYaw: -Math.PI / 2,
      radius: 3,
      figure: { height: 1.7, robe: 0xd8c8e8, hat: 'huantiao', prop: 'none', bulk: 0.8, ribbon: 1.0, rim: 0xe8d8f0 },
      title: '通明殿收表',
    },
  );

  return {
    group,
    npcs,
    annotations: [
      {
        title: '通明殿',
        source: '第 3、5、7、31 回',
        body: '灵霄宝殿的前导殿，相当于太和门之于太和殿。四大天师（张葛许邱）值守。天庭唯一会跟悟空开玩笑的一组人。',
      },
      {
        title: '丘弘济',
        body: '道教通行四大天师为张葛许萨；《西游记》以丘弘济替下萨守坚，来历无定论。第 87 回作「丘洪济」，属异文。本作沿用丘弘济。',
      },
      { title: '递本引奏流程', body: '原著有「天师引奏」的程序，但玩家进灵霄殿是本作增补。', selfAuthored: true },
    ],
    onEnter: () => void store.get('region'),
  };
}
