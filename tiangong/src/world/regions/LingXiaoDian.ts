/**
 * LingXiaoDian.ts —— 区域 F：灵霄宝殿（第二层 · 终点）｜文档 01 §1.2 F / §1.3
 *
 * 「金阙云宫灵霄宝殿」。重檐庑殿体量 + 大金葫芦顶收头（文档 03 §1.11 折中）。
 * 准入纪律：不能打进去，只能被引进去。门口有王灵官，只有一句台词。
 */
import * as THREE from 'three/webgpu';
import { buildHall, LINGXIAO } from '../../gen/arch/Hall';
import { buildRigui, buildJialiang, buildBronzeCrane, buildBronzeTurtle, buildHuabiao } from '../RegionKit';
import { giltBronzeMaterial } from '../../gen/arch/materials';
import { buildLightShaft } from '../../fx/GodRays';
import { store } from '../../core/Store';
import type { GameCtx, RegionBuildResult } from '../Region';

const CZ = -230; // 殿中心 z

export function buildLingXiaoDian(ctx: GameCtx): RegionBuildResult {
  const group = new THREE.Group();

  const hall = buildHall(LINGXIAO, { name: '灵霄宝殿', gilt: true });
  hall.group.position.set(0, 0, CZ);
  group.add(hall.group);
  hall.colliders.forEach((b) => ctx.collision.addBox(b.clone().translate(new THREE.Vector3(0, 0, CZ))));

  // 殿门阻挡（未获准入时可看不可进）：王灵官身前一道隐形槛
  const doorBlock = new THREE.Box3(
    new THREE.Vector3(-14, 8, CZ + hall.size.depth / 2 - 8),
    new THREE.Vector3(14, 20, CZ + hall.size.depth / 2 + 1),
  );
  const blockCollider = { box: doorBlock, active: true };
  ctx.collision.addBox(doorBlock);
  store.on('lingxiaoAdmitted', (admitted) => {
    if (admitted && blockCollider.active) {
      blockCollider.active = false;
      // 从碰撞体移除（重建一个不透明门帘的"让开"）
      doorBlock.min.set(0, 0, 0);
      doorBlock.max.set(0, 0, 0);
    }
  });

  // 丹墀陈设：日晷（影子随游戏日走）、嘉量、铜龟铜鹤各一对
  const rigui = buildRigui();
  rigui.group.position.set(-14, 8.13, CZ + 46);
  group.add(rigui.group);
  const jialiang = buildJialiang();
  jialiang.position.set(14, 8.13, CZ + 46);
  group.add(jialiang);
  for (const [i, maker] of [buildBronzeCrane, buildBronzeCrane, buildBronzeTurtle, buildBronzeTurtle].entries()) {
    const m = maker();
    m.position.set((i % 2 ? 1 : -1) * 8, 8.13, CZ + 40 - Math.floor(i / 2) * 6);
    group.add(m);
  }
  // 华表一对
  for (const s of [-1, 1]) {
    const h = buildHuabiao(false);
    h.position.set(s * 26, 8.13, CZ + 52);
    group.add(h);
  }

  // 殿内：御座珠帘 + 逆光剪影玉帝（永不给正面特写，文档 01 §2.1）
  // 深殿内透出的高窗斜射光柱
  const shaft = buildLightShaft({ topR: 3, bottomR: 9, height: 30, intensity: 0.5, color: 0xffe0b0 });
  shaft.position.set(-6, 8.13 + 24, CZ);
  shaft.rotation.z = 0.3;
  group.add(shaft);

  // 珠帘（半透明竖条）后的御座轮廓
  const curtainMat = new THREE.MeshBasicNodeMaterial({ color: 0xe8d9a0, transparent: true, opacity: 0.28, depthWrite: false });
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), curtainMat);
  curtain.position.set(0, 8.13 + 6, CZ - 6);
  group.add(curtain);
  const throne = new THREE.Mesh(new THREE.BoxGeometry(5, 4.5, 2.4), giltBronzeMaterial(0.6));
  throne.position.set(0, 8.13 + 2.2, CZ - 12);
  group.add(throne);
  // 琉璃盘太乙丹、玛瑙瓶珊瑚树（殿内陈设，第 4 回）
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 0.4, 10), giltBronzeMaterial(1.2));
  dish.position.set(-6, 8.13 + 1.2, CZ - 8);
  group.add(dish);
  const coral = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 6), new THREE.MeshStandardNodeMaterial({ color: 0xc9433f, roughness: 0.4, emissive: 0xc9433f, emissiveIntensity: 0.5 }));
  coral.position.set(6, 8.13 + 1.8, CZ - 8);
  group.add(coral);

  return {
    group,
    npcs: [
      {
        id: 'yudi',
        name: '玉皇大帝',
        region: 'lingxiaodian',
        position: new THREE.Vector3(0, 8.13, CZ - 10.5),
        faceYaw: 0,
        radius: 6,
        figure: { height: 2.9, robe: 0x2b2a33, hat: 'mian', prop: 'none', bulk: 1.2, rim: 0xffe9a8 },
        title: '高天上圣大慈仁者玉皇大天尊玄穹高上帝',
      },
      {
        id: 'wang-lingguan',
        name: '王灵官',
        region: 'lingxiaodian',
        position: new THREE.Vector3(0, 8.13, CZ + 30),
        faceYaw: 0,
        radius: 4,
        figure: { height: 2.8, robe: 0x8a2a2a, hat: 'helmet', prop: 'sword', bulk: 1.35, rim: 0xe86a4a },
        title: '太乙雷声应化尊 · 执灵霄殿',
      },
      {
        id: 'juanlian',
        name: '卷帘大将',
        region: 'lingxiaodian',
        position: new THREE.Vector3(6, 8.13, CZ + 34),
        faceYaw: 0,
        radius: 3.5,
        figure: { height: 2.9, robe: 0xc9a45c, hat: 'helmet', prop: 'staff', bulk: 1.3, rim: 0xffe0a0 },
        title: '灵霄殿下侍銮舆',
      },
    ],
    annotations: [
      {
        title: '灵霄宝殿',
        source: '第 1、3、4 回',
        body: '「金钉攒玉户，彩凤舞朱门。复道回廊，处处玲珑剔透；三檐四簇，层层龙凤翱翔。上面有个紫巍巍、明幌幌、圆丢丢、亮灼灼，大金葫芦顶。」',
      },
      {
        title: '形制取舍',
        body: '「三檐四簇 + 大金葫芦顶」是多重檐攒尖阁的做法，与太和殿式重檐庑殿不同。本作取折中：重檐庑殿的体量与仪轨 + 攒尖金葫芦收头。原著里有、现实里没有——这正是它该有的样子。',
        selfAuthored: true,
      },
      {
        title: '准入规则',
        source: '第 7 回',
        body: '悟空「只打到通明殿里，灵霄殿外」——他从未打进灵霄宝殿。本作纪律：不能打进去，只能被引进去（通明殿递本 → 天师引奏）。',
      },
    ],
    update: (dt, t) => {
      // 日晷影子随游戏日转（18 分钟抽象周期；刻意与太阳不一致 —— 仪式性时间）
      const day = store.get('gameDay');
      rigui.gnomonShadow.rotation.y = day * Math.PI * 2;
      void dt;
      void t;
    },
  };
}
