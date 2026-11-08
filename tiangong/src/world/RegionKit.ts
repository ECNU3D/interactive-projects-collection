/**
 * RegionKit.ts —— 区域共享构件：华表、日晷、嘉量、铜龟鹤、八卦炉、点卯墙等
 * 全部程序化生成（文档 02 §0：几乎不引入外部模型）
 */
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { giltBronzeMaterial, marbleMaterial, vermilionMaterial, dougongMaterial } from '../gen/arch/materials';
import { PALETTE } from '../gen/arch/params';
import { buildPlaque } from '../gen/arch/Column';

/** 华表（文档 03 §1.6）：须弥座柱础 → 蟠龙柱身 → 云板 → 承露盘 → 蹲兽犼 */
export function buildHuabiao(taoist = false): THREE.Group {
  const g = new THREE.Group();
  const H = 9.57;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, taoist ? 8 : 12), marbleMaterial());
  base.position.y = 0.4;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.49, H * 0.72, taoist ? 8 : 12), marbleMaterial());
  shaft.position.y = 0.8 + (H * 0.72) / 2;
  const cloud = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 0.36), marbleMaterial());
  cloud.position.y = H * 0.72;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.22, taoist ? 8 : 12), marbleMaterial());
  dish.position.y = H * 0.72 + 0.5;
  const hou = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 6), giltBronzeMaterial());
  hou.position.y = H * 0.72 + 0.9;
  g.add(base, shaft, cloud, dish, hou);
  return g;
}

/** 日晷（灵霄殿前；指针影子随游戏日走 —— 文档 03 §1.5） */
export function buildRigui(): { group: THREE.Group; gnomonShadow: THREE.Mesh } {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 8), marbleMaterial());
  base.position.y = 0.25;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 24), marbleMaterial());
  face.position.y = 1.1;
  face.rotation.x = -0.42; // 赤道式日晷倾角
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), giltBronzeMaterial());
  pin.position.y = 1.2;
  pin.rotation.x = -0.42 + Math.PI / 2;
  // 影子（一块可旋转的暗片，随游戏日转）
  const shadow = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.01, 1.5),
    new THREE.MeshBasicNodeMaterial({ color: 0x1a1426, transparent: true, opacity: 0.55 }),
  );
  shadow.position.y = 1.17;
  g.add(base, face, pin, shadow);
  return { group: g, gnomonShadow: shadow };
}

/** 嘉量 */
export function buildJialiang(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.9, 8), giltBronzeMaterial());
  body.position.y = 0.9;
  const ear = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.12), giltBronzeMaterial());
  ear.position.y = 1.35;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.4, 8), marbleMaterial());
  base.position.y = 0.2;
  g.add(base, body, ear);
  return g;
}

/** 铜龟 / 铜鹤（内部中空，大典时燃檀香出烟 —— 朝会事件动效点） */
export function buildBronzeCrane(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), giltBronzeMaterial());
  body.scale.set(0.7, 1.1, 0.7);
  body.position.y = 1.0;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 6), giltBronzeMaterial());
  neck.position.y = 1.6;
  neck.rotation.z = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), giltBronzeMaterial());
  head.position.set(0.15, 1.95, 0);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), giltBronzeMaterial());
  legL.position.set(0.08, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = -0.08;
  g.add(body, neck, head, legL, legR);
  return g;
}

export function buildBronzeTurtle(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), giltBronzeMaterial());
  shell.position.y = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), giltBronzeMaterial());
  head.position.set(0, 0.32, 0.55);
  g.add(shell, head);
  return g;
}

/** 金钟 / 天鼓架（朝圣楼，可敲 —— 文档 01 §1.2 D） */
export function buildBellStand(): { group: THREE.Group; bell: THREE.Mesh } {
  const g = new THREE.Group();
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.3), vermilionMaterial());
  frameL.position.set(-1.6, 2.2, 0);
  const frameR = frameL.clone();
  frameR.position.x = 1.6;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, 0.3), vermilionMaterial());
  beam.position.y = 4.4;
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.85, 1.6, 12), giltBronzeMaterial(0.4));
  bell.position.y = 3.4;
  g.add(frameL, frameR, beam, bell);
  return { group: g, bell };
}

export function buildDrumStand(): { group: THREE.Group; drum: THREE.Mesh } {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.8), vermilionMaterial());
  stand.position.y = 0.5;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 14), new THREE.MeshStandardNodeMaterial({ color: 0x8a3a28, roughness: 0.7 }));
  drum.rotation.x = Math.PI / 2;
  drum.position.y = 1.6;
  g.add(stand, drum);
  return { group: g, drum };
}

/** 斗牛宫点卯名牌墙（奎木狼的牌子是空的 —— 文档 01 §1.2 G） */
export function buildRollcallWall(): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 0.4), vermilionMaterial());
  wall.position.y = 2;
  g.add(wall);
  const names = [
    '角木蛟', '亢金龙', '氐土貉', '房日兔', '心月狐', '尾火虎', '箕水豹',
    '斗木獬', '牛金牛', '女土蝠', '虚日鼠', '危月燕', '室火猪', '壁水貐',
    '奎木狼', '娄金狗', '胃土雉', '昴日鸡', '毕月乌', '觜火猴', '参水猿',
    '井木犴', '鬼金羊', '柳土獐', '星日马', '张月鹿', '翼火蛇', '轸水蚓',
  ];
  names.forEach((name, i) => {
    const row = Math.floor(i / 7);
    const col = i % 7;
    const plaque = buildPlaque(name === '奎木狼' ? '' : name, 1.5); // 奎木狼的牌子是空的
    plaque.scale.setScalar(0.5);
    plaque.position.set(-6 + col * 2, 3.3 - row * 0.85, 0.28);
    g.add(plaque);
  });
  return g;
}

/** 八卦炉（八面，巽位东南必须可辨识为风口 —— 文档 01 §1.2 O） */
export function buildBaguaFurnace(): { group: THREE.Group; xunMarker: THREE.Object3D } {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 2.6, 8), giltBronzeMaterial());
  body.position.y = 1.6;
  const lid = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.0, 8), giltBronzeMaterial());
  lid.position.y = 3.4;
  // 炉火口（丹炉赤，全场唯一高饱和暖点）
  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.3, 8),
    new THREE.MeshStandardNodeMaterial({ color: PALETTE.danluChi, emissive: PALETTE.danluChi, emissiveIntensity: 2.5 }),
  );
  mouth.position.set(0, 1.2, 1.55);
  const legs: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6), giltBronzeMaterial());
    const a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 1.1, 0.45, Math.sin(a) * 1.1);
    legs.push(leg);
  }
  // 巽位（东南）风口标记
  const xun = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.06, 6, 8),
    dougongMaterial(),
  );
  const xunAngle = Math.PI * 0.75; // 东南
  xun.position.set(Math.cos(xunAngle) * 1.62, 1.8, Math.sin(xunAngle) * 1.62);
  xun.rotation.y = -xunAngle + Math.PI / 2;
  g.add(body, lid, mouth, ...legs, xun);
  return { group: g, xunMarker: xun };
}

/** 金丹葫芦（兜率宫五个，可拿起不可开） */
export function buildGourd(scale = 1): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  const profile: [number, number][] = [
    [0.02, 0], [0.5, 0.15], [0.62, 0.5], [0.5, 0.85], [0.22, 1.05], [0.3, 1.2], [0.26, 1.42], [0.05, 1.55], [0, 1.6],
  ];
  for (const [r, y] of profile) pts.push(new THREE.Vector2(r * scale, y * scale));
  const g = new THREE.LatheGeometry(pts, 10);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardNodeMaterial({ color: 0xc9a45c, roughness: 0.4, metalness: 0.6 }));
  return mesh;
}

/** 桂树（广寒宫） */
export function buildOsmanthus(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 5, 7), new THREE.MeshStandardNodeMaterial({ color: 0x4a4550, roughness: 0.9 }));
  trunk.position.y = 2.5;
  trunk.rotation.z = 0.12;
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 1),
    new THREE.MeshStandardNodeMaterial({ color: 0x7a8a9e, roughness: 0.85, emissive: 0x8fa4b8, emissiveIntensity: 0.12 }),
  );
  crown.position.set(0.6, 6.2, 0);
  crown.scale.y = 0.75;
  g.add(trunk, crown);
  return g;
}

/** 降妖柱（斩妖台：柱身有砍痕，什么都不会发生） */
export function buildDemonPillar(): THREE.Group {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 9, 10), new THREE.MeshStandardNodeMaterial({ color: 0x5a5560, roughness: 0.95 }));
  pillar.position.y = 4.5;
  g.add(pillar);
  // 砍痕
  for (let i = 0; i < 7; i++) {
    const scar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.06), new THREE.MeshBasicNodeMaterial({ color: 0x2b2830 }));
    const a = Math.random() * Math.PI * 2;
    scar.position.set(Math.cos(a) * 0.2, 2 + i * 0.9, Math.sin(a) * 0.2);
    scar.rotation.y = a;
    scar.rotation.z = (Math.random() - 0.5) * 0.7;
    g.add(scar);
  }
  return g;
}

/** 酒缸（瑶池长廊） */
export function buildWineJar(): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  const profile: [number, number][] = [[0.02, 0], [0.5, 0.1], [0.62, 0.6], [0.5, 1.0], [0.42, 1.1], [0.5, 1.2]];
  for (const [r, y] of profile) pts.push(new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 10), new THREE.MeshStandardNodeMaterial({ color: 0x6a5a48, roughness: 0.7 }));
}

/** 席位牌（瑶池） */
export function buildSeatCard(name: string): THREE.Mesh {
  return buildPlaque(name, 1.6);
}
