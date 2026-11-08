/**
 * NanTianMen.ts —— 区域 A：南天门（第一层 · 入口）｜文档 01 §1.2 A
 *
 * 「碧沉沉，琉璃造就；明幌幌，宝玉妆成」——碧色琉璃门楼，逆光，巨大。
 * 两边镇天元帅、金甲神人（群众剪影）；门楼上千里眼顺风耳；门外巨灵神。
 */
import * as THREE from 'three/webgpu';
import { buildRoof, buildRidges, makeRoofHeightField } from '../../gen/arch/Roof';
import { glazedTileMaterial, vermilionMaterial, marbleMaterial, giltBronzeMaterial } from '../../gen/arch/materials';
import { PALETTE } from '../../gen/arch/params';
import { buildHuabiao } from '../RegionKit';
import { buildLightShaft } from '../../fx/GodRays';
import { Crowd, crowdFigureGeometry } from '../../npc/NpcManager';
import type { GameCtx, RegionBuildResult } from '../Region';

/** 天门门楼：四柱三间 + 重檐庑殿顶（碧色琉璃），东西北天门缩 1/3、瓦色降级 */
export function buildGate(scale = 1, tile: 'lan' | 'lv' = 'lan'): THREE.Group {
  const g = new THREE.Group();
  const W = 46 * scale; // 总宽
  const H = 26 * scale; // 柱高
  const D = 16 * scale;
  const tileCol = tile === 'lan' ? PALETTE.liuliLan : PALETTE.liuliLv;

  // 台基
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 10, 3 * scale, D + 8), marbleMaterial());
  base.position.y = 1.5 * scale;
  g.add(base);
  // 四柱（中柱间即门洞）
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * scale, 1.3 * scale, H, 12), vermilionMaterial());
    col.position.set(x, 3 * scale + H / 2, 0);
    g.add(col);
  }
  // 门楣（大额枋，金字）
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 2.2 * scale, 2.4 * scale), giltBronzeMaterial(0.5));
  beam.position.y = 3 * scale + H + 1 * scale;
  g.add(beam);

  // 屋顶（重檐：下檐环 + 主顶）
  const roofOpts = {
    width: W + 14 * scale,
    depth: D + 10 * scale,
    type: 'wudian' as const,
    purlins: 9 as const,
    tileColor: tileCol,
    segX: 36,
    segZ: 16,
  };
  const roof = buildRoof(roofOpts);
  const roofMesh = new THREE.Mesh(roof.geometry, glazedTileMaterial(tileCol));
  roofMesh.position.y = 3 * scale + H + 2 * scale;
  g.add(roofMesh);
  const field = makeRoofHeightField(roofOpts);
  for (const rg of buildRidges(roofOpts, field, 0.5 * scale)) {
    const rm = new THREE.Mesh(rg, glazedTileMaterial(tileCol, false));
    rm.position.y = 3 * scale + H + 2 * scale;
    g.add(rm);
  }
  return g;
}

export function buildNanTianMen(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  const gate = buildGate(1, 'lan');
  gate.position.set(0, 0, 620);
  group.add(gate);
  // 门楼碰撞：只挡四柱，门洞可穿行
  for (const x of [-23, -7.7, 7.7, 23]) {
    ctx.collision.addBox(new THREE.Box3(new THREE.Vector3(x - 1.5, 0, 618.5), new THREE.Vector3(x + 1.5, 30, 621.5)));
  }

  // 华表一对（皇家圆柱云龙式）
  for (const s of [-1, 1]) {
    const h = buildHuabiao(false);
    h.position.set(s * 30, 0, 596);
    group.add(h);
  }

  // 镇天元帅 / 金甲神人：两列巨型剪影（顶梁靠柱，持铣拥旄）
  const soldierGeo = crowdFigureGeometry(8.5);
  const soldierMat = new THREE.MeshStandardNodeMaterial({ color: 0x9a7a4a, metalness: 0.4, roughness: 0.5, emissive: 0x5a4a2a, emissiveIntensity: 0.35 });
  const transforms: THREE.Matrix4[] = [];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) {
    const s = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    m4.makeRotationY(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    m4.setPosition(s * 40, 3, 620 - 16 - row * 18);
    transforms.push(m4.clone());
  }
  for (let i = 0; i < 12; i++) {
    const s = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    m4.makeRotationY(0);
    m4.setPosition(s * (30 + (row % 3) * 8), 0, 648 + row * 14);
    transforms.push(m4.clone());
  }
  const crowd = new Crowd(soldierGeo, soldierMat, transforms);
  group.add(crowd.mesh);

  // 门洞光柱：天光射入，尘埃浮动（文档 03 §4.1）
  const shaft = buildLightShaft({ topR: 3.5, bottomR: 9, height: 42, intensity: 0.16 });
  shaft.position.set(0, 32, 614);
  shaft.rotation.x = 0.35;
  group.add(shaft);

  return {
    group,
    npcs: [
      {
        id: 'zengzhang',
        name: '增长天王',
        region: 'nantianmen',
        position: new THREE.Vector3(14, 3, 606),
        faceYaw: Math.PI,
        radius: 5,
        figure: { height: 4.6, robe: 0x3a5a8a, hat: 'helmet', prop: 'sword', bulk: 1.5, rim: 0xa8c8e8 },
        title: '守南天门',
      },
      {
        id: 'qianliyan',
        name: '千里眼',
        region: 'nantianmen',
        position: new THREE.Vector3(-8, 31, 620),
        radius: 6,
        figure: { height: 2.2, robe: 0x5a7a4a, hat: 'star', rim: 0xa8e8c8 },
        title: '天庭情报',
      },
      {
        id: 'shunfenger',
        name: '顺风耳',
        region: 'nantianmen',
        position: new THREE.Vector3(8, 31, 620),
        radius: 6,
        figure: { height: 2.2, robe: 0x7a5a4a, hat: 'star', rim: 0xa8e8c8 },
        title: '天庭情报',
      },
      {
        id: 'juling',
        name: '巨灵神',
        region: 'nantianmen',
        position: new THREE.Vector3(-20, 0, 680),
        faceYaw: Math.PI * 0.9,
        radius: 5,
        figure: { height: 4.2, robe: 0x6a4a3a, hat: 'helmet', prop: 'spear', bulk: 1.6, rim: 0xe8c8a8 },
        title: '李天王部下先锋',
      },
      {
        id: 'ma-yuanshuai',
        name: '马元帅',
        region: 'nantianmen',
        position: new THREE.Vector3(26, 3, 634),
        radius: 4,
        figure: { height: 3.1, robe: 0xa83a2a, hat: 'helmet', prop: 'sword', bulk: 1.3, rim: 0xe8b455 },
        title: '南天门护法',
      },
    ],
    annotations: [
      {
        title: '南天门',
        source: '第 1、4 回',
        body: '「碧沉沉，琉璃造就；明幌幌，宝玉妆成。两边摆数十员镇天元帅，一员员顶梁靠柱，持铣拥旄。」天界正门。',
      },
      { title: '东、北天门', body: '原著未见，仅西天门有第 5 回依据。本作补设东、北二门。', selfAuthored: true },
    ],
  };
}
