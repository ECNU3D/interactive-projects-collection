/**
 * PanTaoYuan.ts —— 区域 K：蟠桃园（第三层 · 出生点所在）｜文档 01 §1.2 K
 *
 * 分三段，花果并存，园子四周彩色云霓。
 * 全场唯一让人放松的地方——云洞开在正上方，阳光直射。
 *
 * 株数与园子尺寸按可玩性取舍，不是原著的三千六百株（见 README 偏差清单）。
 */
import * as THREE from 'three/webgpu';
import { buildPeachOrchard } from '../../gen/layout/PeachOrchard';
import { buildPetals } from '../../fx/Motes';
import type { GameCtx, RegionBuildResult } from '../Region';

const CX = 0;
const CZ = 90;

const XIANNV = [
  { id: 'qiyi-hong', name: '红衣仙女', robe: 0xc2402f },
  { id: 'qiyi-qing', name: '青衣仙女', robe: 0x3e7c8c },
  { id: 'qiyi-su', name: '素衣仙女', robe: 0xf0ede4 },
  { id: 'qiyi-zao', name: '皂衣仙女', robe: 0x2b2a33 },
  { id: 'qiyi-zi', name: '紫衣仙女', robe: 0x7b5ea7 },
  { id: 'qiyi-huang', name: '黄衣仙女', robe: 0xe0b23a },
  { id: 'qiyi-lv', name: '绿衣仙女', robe: 0x5a9153 },
];

export function buildPanTaoYuan(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();
  const orchard = buildPeachOrchard();
  orchard.group.position.set(CX, 0, CZ);
  group.add(orchard.group);

  // 花瓣飘落
  group.add(buildPetals(new THREE.Vector3(CX, 0, CZ), 200, 700));

  // 园界软碰撞（云霓圈外不准走出园子）
  // 省略硬碰撞：云的地面高度场托底

  // 摘桃交互（三段各一：画面反馈不同）
  const pickPoints: [number, number, string][] = [
    [-120, -100, '前段的桃，花微果小，三千年一熟。'],
    [0, 0, '中段的桃，层花甘实，六千年一熟。'],
    [110, 110, '后段的桃，紫纹缃核，九千年一熟。'],
  ];

  return {
    group,
    // 桃树的 LOD 分桶：不能挂 update（玩家在齐天府时也看得见这片园子）
    lodUpdate: (playerPos) => orchard.updateLod(playerPos),
    npcs: [
      {
        id: 'pantao-tudi',
        name: '蟠桃园土地',
        region: 'pantaoyuan',
        // 园子缩到 300 后，原来的 (-150,-160) 会落到云霓环（半径 186）之外、
        // 站在林子外面，往回收到前段林中
        position: new THREE.Vector3(CX - 105, 0, CZ - 110),
        faceYaw: Math.PI / 4,
        radius: 4,
        figure: { height: 1.4, robe: 0x8a7a5a, hat: 'none', prop: 'staff', bulk: 1.1, rim: 0xd8c8a8 },
        title: '看园',
      },
      { id: 'lishi-chu', name: '锄树力士', region: 'pantaoyuan', position: new THREE.Vector3(CX - 60, 0, CZ - 80), radius: 3, figure: { height: 2.2, robe: 0x9a8a6a, hat: 'none', prop: 'none', bulk: 1.3, rim: 0xc8b898 }, title: '园工' },
      { id: 'lishi-yun', name: '运水力士', region: 'pantaoyuan', position: new THREE.Vector3(CX + 40, 0, CZ - 30), radius: 3, figure: { height: 2.2, robe: 0x7a8a9a, hat: 'none', prop: 'none', bulk: 1.3, rim: 0xc8b898 }, title: '园工' },
      { id: 'lishi-xiu', name: '修桃力士', region: 'pantaoyuan', position: new THREE.Vector3(CX + 90, 0, CZ + 60), radius: 3, figure: { height: 2.2, robe: 0x8a9a7a, hat: 'none', prop: 'none', bulk: 1.3, rim: 0xc8b898 }, title: '园工' },
      { id: 'lishi-sao', name: '打扫力士', region: 'pantaoyuan', position: new THREE.Vector3(CX - 30, 0, CZ + 100), radius: 3, figure: { height: 2.2, robe: 0xa89a8a, hat: 'none', prop: 'none', bulk: 1.3, rim: 0xc8b898 }, title: '园工' },
      // 七衣仙女（定时事件简化为常驻于中段，各顶花篮）
      ...XIANNV.map((x, i) => ({
        id: x.id,
        name: x.name,
        region: 'pantaoyuan',
        position: new THREE.Vector3(CX - 20 + i * 7, 0, CZ + 10 + Math.sin(i * 2) * 5),
        faceYaw: -Math.PI / 2,
        radius: 3,
        figure: { height: 1.8, robe: x.robe, hat: 'huantiao' as const, prop: 'basket' as const, bulk: 0.8, ribbon: 1.4, rim: 0xf0e0e8 },
        title: '王母侍女',
      })),
    ],
    interactables: pickPoints.map(([dx, dz, text], i) => ({
      id: `pick-peach-${i}`,
      position: new THREE.Vector3(CX + dx, 0, CZ + dz),
      radius: 14,
      prompt: '摘桃',
      cooldown: 4000,
      action: (c) => {
        c.events.emit('pick-peach', text);
      },
    })),
    annotations: [
      {
        title: '蟠桃园',
        source: '第 5 回',
        body: '「有三千六百株：前面一千二百株，花微果小，三千年一熟……后面一千二百株，紫纹缃核，九千年一熟。」「时开时结千年熟，无夏无冬万载迟」——同一棵树上花与果并存。',
      },
      {
        title: '后段树完好',
        body: '原文「花果稀疏，止有几个毛蒂青皮的」是偷桃之后的状态。本作时间点在偷桃之前，后段树是完好的。',
      },
    ],
  };
}
