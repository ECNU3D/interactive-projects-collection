/**
 * DouNiuGong.ts —— 区域 G：斗牛宫（星官点卯处）｜文档 01 §1.2 G
 * 二十八宿名牌墙，奎木狼的牌子是空的——一块空名牌讲清天上一日下界一年。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildRollcallWall } from '../RegionKit';
import type { GameCtx, RegionBuildResult } from '../Region';

export function buildDouNiuGong(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();
  const cx = -330;
  const cz = 90;

  const spec: HallSpec = {
    bays: 5, depths: 3, bayWidth: 5.5, columnHeight: 8,
    podiumTiers: 1, podiumHeight: 2.2,
    roof: 'xieshan', eaves: 1, finial: null,
    dougongSteps: 7, ridgeBeasts: 5, tileColor: 'huang', doorNails: [7, 7],
  };
  const hall = buildHall(spec, { name: '斗牛宫' });
  hall.group.position.set(cx, 0, cz);
  group.add(hall.group);
  hall.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(cx, 0, cz))));

  // 点卯名牌墙（宫外）
  const wall = buildRollcallWall();
  wall.position.set(cx + 24, 0, cz + 16);
  wall.rotation.y = Math.PI / 4;
  group.add(wall);

  return {
    group,
    npcs: [
      {
        id: 'xurishu',
        name: '虚日鼠',
        region: 'douniugong',
        position: new THREE.Vector3(cx + 22, 0, cz + 12),
        faceYaw: Math.PI / 4,
        radius: 3.5,
        figure: { height: 2.0, robe: 0x7a8a4a, hat: 'star', prop: 'scroll', bulk: 0.95, rim: 0xd8e8a0 },
        title: '二十八宿 · 传令',
      },
      {
        id: 'maori',
        name: '昴日星官',
        region: 'douniugong',
        position: new THREE.Vector3(cx - 10, 0, cz + 20),
        faceYaw: Math.PI / 2,
        radius: 3.5,
        figure: { height: 2.3, robe: 0xe8e0c8, hat: 'star', prop: 'none', bulk: 1, rim: 0xffe9a8 },
        title: '二十八宿 · 居东天门光明宫',
      },
    ],
    annotations: [
      {
        title: '斗牛宫点卯',
        source: '第 31 回',
        body: '「又查那斗牛宫外，二十八宿，颠倒只有二十七位，内独少了奎星。」奎木狼的牌子是空的——他此刻正在下界当黄袍怪。「四卯不到……今已十三日了。」「天上十三日，下界已是十三年。」',
      },
      { title: '点卯名牌墙', body: '名牌墙装置为本作设计。', selfAuthored: true },
    ],
  };
}
