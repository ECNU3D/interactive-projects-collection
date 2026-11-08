/**
 * YaoChi.ts —— 区域 M：瑶池宝阁（第三层）｜文档 01 §1.2 M
 *
 * 「那里铺设得齐齐整整，却还未有仙来。」
 * 一场即将开始、而你没被邀请的宴会。全场最强的情绪场。
 */
import * as THREE from 'three/webgpu';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import { buildWineJar, buildSeatCard } from '../RegionKit';
import { giltBronzeMaterial, vermilionMaterial } from '../../gen/arch/materials';
import type { GameCtx, RegionBuildResult } from '../Region';

const CX = -290;
const CZ = -60;

/** 蟠桃会宾客名单（第 5 回，可直接读） */
const GUESTS = ['三清', '四帝', '五方五老', '五斗星君', '上八洞天仙', '中八洞神仙', '下八洞地仙'];

export function buildYaoChi(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  // 宝阁（瑶台铺彩结，宝阁散氤氲）
  const spec: HallSpec = {
    bays: 7, depths: 3, bayWidth: 5.5, columnHeight: 8.5,
    podiumTiers: 2, podiumHeight: 2.8,
    roof: 'xieshan', eaves: 2, finial: 'baozhu',
    dougongSteps: 7, ridgeBeasts: 7, tileColor: 'huang', doorNails: [9, 7],
  };
  const hall = buildHall(spec, { name: '瑶池宝阁' });
  hall.group.position.set(CX, 0, CZ - 20);
  group.add(hall.group);
  hall.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(CX, 0, CZ - 20))));

  // 九凤丹霞扆（御座屏风）+ 八宝紫霓墩 + 五彩描金桌 + 千花碧玉盆（第 5 回陈设）
  const screen = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 0.3), vermilionMaterial());
  screen.position.set(CX, 2.8 + 2.5, CZ - 26);
  group.add(screen);
  for (let i = 0; i < 4; i++) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.7, 8), giltBronzeMaterial(0.3));
    stool.position.set(CX - 4 + i * 2.7, 2.8 + 0.35, CZ - 22);
    group.add(stool);
  }
  for (let i = 0; i < 3; i++) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.9), giltBronzeMaterial(0.2));
    table.position.set(CX - 3 + i * 3, 2.8 + 0.4, CZ - 19);
    group.add(table);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.4, 8), new THREE.MeshStandardNodeMaterial({ color: 0x3a7a5c, roughness: 0.3 }));
    basin.position.set(CX - 3 + i * 3, 2.8 + 1.0, CZ - 19);
    group.add(basin);
  }

  // 席位牌（可读：五方五老、三清四帝的名字，没有你的）
  GUESTS.forEach((name, i) => {
    const card = buildSeatCard(name);
    card.position.set(CX - 12 + i * 4, 1.2, CZ - 6);
    group.add(card);
  });

  // 长廊：酒缸一列（可看不可喝——喝了就进入第 5 回，超出本作范围）
  for (let i = 0; i < 8; i++) {
    const jar = buildWineJar();
    jar.position.set(CX + 22, 0, CZ - 10 + i * 4.2);
    group.add(jar);
  }

  // 王母远景：最深处，远远的一个轮廓，不可接近不可对话（文档 01 §2.1）
  const wangmuMat = new THREE.MeshStandardNodeMaterial({ color: 0xe8d8f0, roughness: 0.6, emissive: 0xc9b8e0, emissiveIntensity: 0.4, transparent: true, opacity: 0.75 });
  const wangmuRobe = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.55, 1.6, 10), wangmuMat);
  const wangmu = new THREE.Group();
  wangmu.add(wangmuRobe);
  const wangmuHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), wangmuMat);
  wangmuHead.position.y = 1.95;
  wangmu.add(wangmuHead);
  wangmuRobe.position.y = 0.8;
  wangmu.position.set(CX, 2.8, CZ - 30);
  group.add(wangmu);

  return {
    group,
    npcs: [
      { id: 'zaojiu-xianguan', name: '造酒仙官', region: 'yaochi', position: new THREE.Vector3(CX + 20, 0, CZ - 4), faceYaw: -Math.PI / 2, radius: 3.2, figure: { height: 2.0, robe: 0x8a6a4a, hat: 'furong', prop: 'none', bulk: 1.05, rim: 0xe8d0a8 }, title: '瑶池酿酒' },
      { id: 'panzao-lishi', name: '盘糟力士', region: 'yaochi', position: new THREE.Vector3(CX + 20, 0, CZ + 6), faceYaw: -Math.PI / 2, radius: 3, figure: { height: 2.2, robe: 0x7a6a5a, hat: 'none', prop: 'none', bulk: 1.35, rim: 0xc8b898 }, title: '瑶池杂役' },
      { id: 'yunshui-daoren', name: '运水道人', region: 'yaochi', position: new THREE.Vector3(CX + 16, 0, CZ + 12), faceYaw: -Math.PI / 2, radius: 3, figure: { height: 2.0, robe: 0x6a7a8a, hat: 'none', prop: 'none', bulk: 1, rim: 0xb8c8d8 }, title: '瑶池杂役' },
      { id: 'shaohuo-tongzi', name: '烧火童子', region: 'yaochi', position: new THREE.Vector3(CX + 16, 0, CZ - 8), faceYaw: -Math.PI / 2, radius: 3, figure: { height: 1.4, robe: 0xa88a6a, hat: 'bun', prop: 'none', bulk: 0.85, rim: 0xe8c8a0 }, title: '瑶池杂役' },
    ],
    interactables: [
      {
        id: 'read-seats',
        position: new THREE.Vector3(CX, 0, CZ - 6),
        radius: 10,
        prompt: '看席位牌',
        action: (c) => c.events.emit('pick-peach', '五方五老、三清四帝、五斗星君……一排排看下去，没有「齐天大圣」。'),
      },
    ],
    annotations: [
      {
        title: '瑶池宝阁',
        source: '第 5 回',
        body: '「琼香缭绕，瑞霭缤纷，瑶台铺彩结，宝阁散氤氲。」铺设得齐齐整整，却还未有仙来。席位牌上写着五方五老、三清四帝的名字——没有你的。',
      },
      { title: '席位牌', body: '席位牌装置为本作设计；宾客名单据第 5 回。', selfAuthored: true },
    ],
  };
}
