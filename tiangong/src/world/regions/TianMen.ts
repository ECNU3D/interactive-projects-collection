/**
 * TianMen.ts —— 东 / 西 / 北天门｜文档 01 §1.2 A
 * 规模约为南天门 1/3，形制相同、瓦色降一级。各驻一位天王。
 * ⚠️ 西天门有原文依据（第 5 回）；东、北天门属本作自拟（考据栏标注）。
 */
import * as THREE from 'three/webgpu';
import { buildGate } from './NanTianMen';
import type { GameCtx, RegionBuildResult } from '../Region';

function makeGateRegion(
  gatePos: [number, number, number],
  faceYaw: number,
  king: { id: string; name: string; robe: number; title: string; prop: 'sword' | 'spear' | 'staff' | 'none' },
  selfAuthored: boolean,
) {
  return (ctx: GameCtx): RegionBuildResult => {
    const group = new THREE.Group();
    const gate = buildGate(0.62, 'lv');
    gate.position.set(...gatePos);
    gate.rotation.y = faceYaw;
    group.add(gate);

    // 天王驻在门下
    const inward = new THREE.Vector3(0, 0, -14).applyEuler(new THREE.Euler(0, faceYaw, 0));
    const npcPos = new THREE.Vector3(...gatePos).add(inward).add(new THREE.Vector3(4, 0, 0));

    return {
      group,
      npcs: [
        {
          id: king.id,
          name: king.name,
          region: '',
          position: npcPos,
          faceYaw,
          radius: 5,
          figure: { height: 4.4, robe: king.robe, hat: 'helmet', prop: king.prop, bulk: 1.5, rim: 0xa8c8e8 },
          title: king.title,
        },
      ],
      annotations: [
        selfAuthored
          ? { title: '天门方位', body: '原著仅见南天门（第 1、4 回）与西天门（第 5 回）。此门为本作补设。', selfAuthored: true }
          : { title: '西天门', source: '第 5 回', body: '悟空偷丹后「从西天门，使个隐身法逃去」——证明天门不止一座。' },
      ],
    };
  };
}

export const buildDongTianMen = makeGateRegion(
  [660, 0, 60],
  Math.PI / 2,
  { id: 'chiguo', name: '持国天王', robe: 0x4a6a8a, title: '东天门', prop: 'none' },
  true,
);
export const buildXiTianMen = makeGateRegion(
  [-660, 0, 60],
  -Math.PI / 2,
  { id: 'guangmu', name: '广目天王', robe: 0x5a8a6a, title: '西天门', prop: 'staff' },
  false,
);
export const buildBeiTianMen = makeGateRegion(
  [0, 0, -660],
  0,
  { id: 'duowen', name: '多闻天王', robe: 0x6a5a8a, title: '北天门', prop: 'none' },
  true,
);
