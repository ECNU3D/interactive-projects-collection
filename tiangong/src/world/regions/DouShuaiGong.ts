/**
 * DouShuaiGong.ts —— 区域 O：兜率宫（第五层 · 离恨天 · 最高）｜文档 01 §1.2 O
 *
 * 「三十三天之上，乃离恨天」——一座在所有天之上的孤岛。
 * 三层高阁「朱陵丹台」（讲道）+ 丹房（丹灶、八卦炉、五个葫芦）。
 * 刻意做得远。玩家应该感到自己爬得很高，而且这里没人在乎他。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildBaguaFurnace, buildGourd, buildHuabiao } from '../RegionKit';
import { buildLightShaft } from '../../fx/GodRays';
import type { GameCtx, RegionBuildResult } from '../Region';

const CX = 460;
const CZ = 260;

export function buildDouShuaiGong(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  // 朱陵丹台：三层高阁（多重檐攒尖，道教高阁一路）
  const geSpec: HallSpec = {
    bays: 3, depths: 3, bayWidth: 5, columnHeight: 6,
    podiumTiers: 2, podiumHeight: 3,
    roof: 'zanjian', eaves: 3, finial: 'baozhu',
    dougongSteps: 7, ridgeBeasts: 5, tileColor: 'lv', doorNails: [7, 7],
  };
  const ge = buildHall(geSpec, { name: '朱陵丹台' });
  ge.group.position.set(CX - 24, 0, CZ - 10);
  group.add(ge.group);
  ge.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(CX - 24, 0, CZ - 10))));

  // 丹房（硬山小筑）
  const fangSpec: HallSpec = {
    bays: 3, depths: 1, bayWidth: 4.5, columnHeight: 4.5,
    podiumTiers: 1, podiumHeight: 0.9,
    roof: 'yingshan', eaves: 1, finial: null,
    dougongSteps: 3, ridgeBeasts: 3, tileColor: 'lv', doorNails: [5, 5],
  };
  const fang = buildHall(fangSpec, { name: '丹房' });
  fang.group.position.set(CX + 18, 0, CZ + 8);
  fang.group.rotation.y = -Math.PI / 5;
  group.add(fang.group);
  fang.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(CX + 18, 0, CZ + 8))));

  // 八卦炉（八面，巽位东南可辨识）+ 向上暖光柱（与冷空气对比）
  const furnace = buildBaguaFurnace();
  furnace.group.position.set(CX + 6, 0, CZ + 24);
  group.add(furnace.group);
  ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(CX + 4, 0, CZ + 22), new THREE.Vector3(CX + 8, 4, CZ + 26)));
  const shaft = buildLightShaft({ topR: 0.8, bottomR: 3.4, height: 30, intensity: 0.65, color: 0xff9a50 });
  shaft.position.set(CX + 6, 30, CZ + 24);
  group.add(shaft);

  // 五个葫芦（炉左右安放，第 5 回；可拿起不可开）
  const gourds: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const gourd = buildGourd(0.8);
    gourd.position.set(CX + 2.5 + i * 1.4, 0, CZ + 20 + Math.sin(i * 2.2) * 0.8);
    group.add(gourd);
    gourds.push(gourd);
  }

  // 道教式华表（八角八卦）
  const huabiao = buildHuabiao(true);
  huabiao.position.set(CX - 10, 0, CZ + 34);
  group.add(huabiao);

  return {
    group,
    npcs: [
      {
        id: 'taishang-laojun',
        name: '太上老君',
        region: 'doushuaigong',
        position: new THREE.Vector3(CX - 24, 3, CZ - 4),
        faceYaw: Math.PI,
        radius: 4.5,
        figure: { height: 2.3, robe: 0x5a6a5a, hat: 'furong', prop: 'none', bulk: 1.15, ribbon: 1.7, rim: 0xd8e8c8 },
        title: '太清道德天尊',
      },
      {
        id: 'kanlu-daoren',
        name: '看炉道人',
        region: 'doushuaigong',
        position: new THREE.Vector3(CX + 10, 0, CZ + 22),
        faceYaw: Math.PI / 2,
        radius: 3,
        figure: { height: 1.9, robe: 0x6a7a6a, hat: 'none', prop: 'none', bulk: 1, rim: 0xc8d8c0 },
        title: '兜率宫',
      },
      {
        id: 'jiahuo-tongzi',
        name: '架火童子',
        region: 'doushuaigong',
        position: new THREE.Vector3(CX + 3, 0, CZ + 27),
        faceYaw: Math.PI / 4,
        radius: 3,
        figure: { height: 1.4, robe: 0xa88a6a, hat: 'bun', prop: 'none', bulk: 0.85, rim: 0xe8c8a0 },
        title: '兜率宫',
      },
    ],
    interactables: gourds.map((g, i) => ({
      id: `gourd-${i}`,
      position: g.position.clone(),
      radius: 2.5,
      prompt: '拿起葫芦',
      cooldown: 3000,
      action: (c) => c.events.emit('pick-peach', '葫芦沉甸甸的，封口符箓完好。——开了就是第 5 回了，现在还不到时候。'),
    })),
    annotations: [
      {
        title: '兜率宫',
        source: '第 5 回',
        body: '「兜率宫是三十三天之上，乃离恨天太上老君之处。」注意是「三十三天之上的离恨天」，不是「第三十三层天名叫离恨天」——所以它是一座在所有天之上的孤岛。',
      },
      {
        title: '八卦炉 · 巽位',
        source: '第 7 回',
        body: '「原来那炉是乾、坎、艮、震、巽、离、坤、兑八卦。他即将身钻在『巽宫』位下。巽乃风也，有风则无火。」站到东南巽位，能听见风声。',
      },
      {
        title: '五个葫芦',
        source: '第 5 回',
        body: '「炉左右安放着五个葫芦，葫芦里都是炼就的金丹。」第 7 回老君自称「五壶丹」，异文备考。',
      },
    ],
  };
}
