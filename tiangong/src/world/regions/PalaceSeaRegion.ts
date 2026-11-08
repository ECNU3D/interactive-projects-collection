/**
 * PalaceSeaRegion.ts —— 区域 B：主轴宫殿海（第二层）｜文档 01 §1.2 B
 *
 * 三十三座天宫、七十二重宝殿。原文举名十座，其余九十余座未命名——
 * 这是程序化生成的合法授权。空旷本身是内容。
 */
import * as THREE from 'three/webgpu';
import { palaceSeaLayout, buildPalaceSea } from '../../gen/layout/PalaceSea';
import { buildHall } from '../../gen/arch/Hall';
import type { HallSpec } from '../../gen/arch/params';
import type { GameCtx, RegionBuildResult } from '../Region';

/** 原文举名的十座（文档 01 §1.2 B） */
const NAMED_GONG = ['遣云宫', '毗沙宫', '五明宫', '太阳宫', '化乐宫'];
const NAMED_DIAN = ['朝会殿', '凌虚殿', '宝光殿', '灵官殿'];

export function buildGongDianHai(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  // 宫殿海：程序化布局 + 剪影 InstancedMesh
  const placements = palaceSeaLayout(105);
  group.add(buildPalaceSea(placements));

  // 近主轴的十座命名宫殿（低细节实体）
  const named = [...NAMED_GONG, ...NAMED_DIAN];
  named.forEach((name, i) => {
    const ring = Math.floor(i / 3);
    const ang = (i / named.length) * Math.PI * 2 + 0.4;
    const r = 150 + ring * 60;
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r * 1.15;
    if (Math.abs(x) < 70 && Math.abs(z) < 460) return;
    const spec: HallSpec = {
      bays: 7, depths: 3, bayWidth: 6, columnHeight: 9,
      podiumTiers: 2, podiumHeight: 3.2,
      roof: i % 2 ? 'xieshan' : 'wudian', eaves: 2, finial: null,
      dougongSteps: 7, ridgeBeasts: 7,
      tileColor: 'huang', doorNails: [7, 7],
    };
    const hall = buildHall(spec, { name, detail: 'low' });
    hall.group.position.set(x, 0, z);
    hall.group.rotation.y = Math.atan2(-x, -z);
    group.add(hall.group);
    hall.colliders.forEach((b) => ctx.collision.addBox(b.translate(new THREE.Vector3(x, 0, z))));
  });

  // 天王殿（李靖 + 哪吒）——主轴东侧近处，单独高细节
  const tianwangSpec: HallSpec = {
    bays: 7, depths: 3, bayWidth: 6.5, columnHeight: 10,
    podiumTiers: 2, podiumHeight: 3.6,
    roof: 'wudian', eaves: 2, finial: null,
    dougongSteps: 7, ridgeBeasts: 7, tileColor: 'huang', doorNails: [7, 7],
  };
  const tianwang = buildHall(tianwangSpec, { name: '天王殿' });
  tianwang.group.position.set(150, 0, 210);
  tianwang.group.rotation.y = -Math.PI / 3;
  group.add(tianwang.group);
  tianwang.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(150, 0, 210))));

  return {
    group,
    npcs: [
      {
        id: 'li-jing',
        name: '托塔李天王',
        region: 'gongdianhai',
        position: new THREE.Vector3(146, 3.6, 214),
        faceYaw: -Math.PI / 3,
        radius: 4.5,
        figure: { height: 3.2, robe: 0x8a2a2a, hat: 'helmet', prop: 'pagoda', bulk: 1.4, rim: 0xe8b455 },
        title: '降魔大元帅',
      },
      {
        id: 'nezha',
        name: '哪吒三太子',
        region: 'gongdianhai',
        position: new THREE.Vector3(153, 3.6, 218),
        faceYaw: -Math.PI / 3,
        radius: 4,
        figure: { height: 1.7, robe: 0xe8e0d0, hat: 'bun', prop: 'spear', bulk: 0.85, rim: 0xffe9a8 },
        title: '三坛海会大神',
      },
      {
        id: 'chijiao',
        name: '赤脚大仙',
        region: 'gongdianhai',
        position: new THREE.Vector3(-60, 0, 120),
        faceYaw: Math.PI / 2,
        radius: 4,
        figure: { height: 2.5, robe: 0xb89a6a, hat: 'furong', prop: 'none', bulk: 1.15, ribbon: 1.6, rim: 0xffe0a0 },
        title: '上仙',
      },
      {
        id: 'jintou-jiedi',
        name: '金头揭谛',
        region: 'gongdianhai',
        position: new THREE.Vector3(40, 0, -60),
        faceYaw: Math.PI,
        radius: 3.5,
        figure: { height: 2.6, robe: 0xc9a45c, hat: 'helmet', prop: 'staff', bulk: 1.1, rim: 0xe8b455 },
        title: '五方揭谛之首',
      },
      {
        id: 'zhiri-gongcao',
        name: '值日功曹',
        region: 'gongdianhai',
        position: new THREE.Vector3(-30, 0, -20),
        faceYaw: 0,
        radius: 3.5,
        figure: { height: 2.3, robe: 0x6a7a9a, hat: 'furong', prop: 'scroll', bulk: 1, rim: 0xc8d8f0 },
        title: '四值功曹',
      },
    ],
    annotations: [
      {
        title: '三十三座天宫 · 七十二重宝殿',
        source: '第 4 回',
        body: '原文举名仅十座：遣云宫、毗沙宫、五明宫、太阳宫、化乐宫；朝会殿、凌虚殿、宝光殿、天王殿、灵官殿。其余九十余座未命名——布局为本作生成。「一宫宫脊吞金稳兽，一殿殿柱列玉麒麟。」',
      },
      { title: '宫殿海布局', body: '未命名宫殿的布局是本作程序化生成的。', selfAuthored: true },
    ],
  };
}
