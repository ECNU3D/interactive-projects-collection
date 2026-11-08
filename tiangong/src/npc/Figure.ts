/**
 * Figure.ts —— 程序化生成的简化人形｜文档 02 §8.2 / 文档 03 §7.1
 *
 * 刻意的风格选择：神仙做成"仙气朦胧的轮廓"——
 * 袍服 = 参数化圆锥/圆台 + 褶皱噪声；头 = 球 + 冠；不做手指；袍服及地。
 * 边缘一层极薄的菲涅尔轮廓光（暖金）是"发光感"的来源。
 */
import * as THREE from 'three/webgpu';
import { Fn, vec3, vec4, float, color, positionLocal, normalView, saturate, pow, uniform } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface FigureSpec {
  /** 总高（m）。神仙比人"长"：玉帝 > 天王 > 上仙 > 仙女 > 童子 */
  height?: number;
  /** 袍色 */
  robe: number;
  /** 袍宽比例（武将铠宽、仙女窄） */
  bulk?: number;
  /** 冠/盔形制 */
  hat: 'furong' | 'mian' | 'helmet' | 'star' | 'bun' | 'huantiao' | 'none';
  hatColor?: number;
  /** 标志物：金星背文书、李天王托塔、哪吒火轮…… */
  prop?: 'scroll' | 'pagoda' | 'spear' | 'pestle' | 'basket' | 'staff' | 'sword' | 'none';
  /** 菲涅尔轮廓光颜色（暖金 / 月宫冷银） */
  rim?: number;
  /** 飘带长度（上仙最长最慢，杂役几乎没有） */
  ribbon?: number;
}

/** 褶皱袍服：圆台 + 低频竖向扰动 */
function robeGeometry(h: number, bulk: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(h * 0.11, h * 0.24 * bulk, h * 0.72, 14, 6, false);
  geo.translate(0, h * 0.36, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const fold = Math.sin(ang * 7) * 0.03 * h * (1 - y / h); // 褶皱下摆大领口小
    const r = Math.hypot(x, z);
    if (r > 0.01) {
      pos.setX(i, x + (x / r) * fold);
      pos.setZ(i, z + (z / r) * fold);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function hatGeometry(kind: FigureSpec['hat'], h: number, c: number): THREE.BufferGeometry | null {
  const col = new THREE.Color(c);
  let g: THREE.BufferGeometry | null = null;
  const headY = h * 0.87;
  switch (kind) {
    case 'furong': // 芙蓉冠
      g = new THREE.ConeGeometry(h * 0.05, h * 0.1, 8);
      g.translate(0, headY + h * 0.07, 0);
      break;
    case 'mian': { // 十二旒冕（板 + 前后垂旒简化）
      const board = new THREE.BoxGeometry(h * 0.16, h * 0.015, h * 0.1);
      board.translate(0, headY + h * 0.075, 0);
      const crown = new THREE.CylinderGeometry(h * 0.045, h * 0.05, h * 0.05, 8);
      crown.translate(0, headY + h * 0.045, 0);
      g = mergeGeometries([board, crown])!;
      break;
    }
    case 'helmet': // 金盔
      g = new THREE.SphereGeometry(h * 0.065, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
      g.translate(0, headY + h * 0.02, 0);
      break;
    case 'star': { // 星冠（尖顶带珠）
      const cone = new THREE.ConeGeometry(h * 0.04, h * 0.09, 6);
      cone.translate(0, headY + h * 0.07, 0);
      const bead = new THREE.SphereGeometry(h * 0.018, 6, 5);
      bead.translate(0, headY + h * 0.12, 0);
      g = mergeGeometries([cone, bead])!;
      break;
    }
    case 'bun': // 总角（双髻）
      g = mergeGeometries([
        new THREE.SphereGeometry(h * 0.022, 6, 5).translate(h * 0.04, headY + h * 0.05, 0),
        new THREE.SphereGeometry(h * 0.022, 6, 5).translate(-h * 0.04, headY + h * 0.05, 0),
      ])!;
      break;
    case 'huantiao': { // 双鬟（仙女）
      const l = new THREE.TorusGeometry(h * 0.03, h * 0.012, 5, 8);
      l.translate(h * 0.05, headY + h * 0.04, 0);
      const r2 = l.clone();
      r2.translate(-h * 0.1, 0, 0);
      g = mergeGeometries([l, r2])!;
      break;
    }
    case 'none':
      return null;
  }
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function propGeometry(kind: FigureSpec['prop'], h: number): THREE.BufferGeometry | null {
  switch (kind) {
    case 'scroll': { // 背著一角文书（太白金星的视觉符号，第 3 回）
      const g = new THREE.BoxGeometry(h * 0.1, h * 0.26, h * 0.04);
      g.rotateZ(0.5);
      g.translate(-h * 0.1, h * 0.62, -h * 0.12);
      return g;
    }
    case 'pagoda': { // 托塔
      const base = new THREE.CylinderGeometry(h * 0.03, h * 0.045, h * 0.05, 6);
      const top = new THREE.ConeGeometry(h * 0.035, h * 0.06, 6);
      top.translate(0, h * 0.055, 0);
      const g = mergeGeometries([base, top])!;
      g.translate(h * 0.2, h * 0.6, h * 0.05);
      return g;
    }
    case 'spear': { // 三尖两刃枪 / 长兵
      const shaft = new THREE.CylinderGeometry(h * 0.008, h * 0.008, h * 1.1, 5);
      const tip = new THREE.ConeGeometry(h * 0.02, h * 0.12, 5);
      tip.translate(0, h * 0.6, 0);
      const g = mergeGeometries([shaft, tip])!;
      g.translate(h * 0.22, h * 0.55, 0);
      return g;
    }
    case 'pestle': { // 捣药杵（玉兔）
      const g = new THREE.CylinderGeometry(h * 0.025, h * 0.035, h * 0.3, 6);
      g.translate(h * 0.16, h * 0.35, h * 0.1);
      return g;
    }
    case 'basket': { // 花篮（七衣仙女）
      const g = new THREE.CylinderGeometry(h * 0.06, h * 0.045, h * 0.07, 8);
      g.translate(h * 0.2, h * 0.42, 0);
      return g;
    }
    case 'staff': { // 降妖杖（卷帘大将）
      const shaft = new THREE.CylinderGeometry(h * 0.01, h * 0.01, h * 0.95, 5);
      const head = new THREE.BoxGeometry(h * 0.06, h * 0.09, h * 0.02);
      head.translate(0, h * 0.5, 0);
      const g = mergeGeometries([shaft, head])!;
      g.translate(h * 0.2, h * 0.5, 0);
      return g;
    }
    case 'sword': { // 金鞭（王灵官）
      const g = new THREE.BoxGeometry(h * 0.025, h * 0.7, h * 0.025);
      g.translate(h * 0.2, h * 0.5, 0);
      return g;
    }
    default:
      return null;
  }
}

export interface FigureParts {
  group: THREE.Group;
  head: THREE.Mesh;
  /** 说话时头部点动权重 0–1（语音包络驱动） */
  talkWeight: { value: number };
  update(dt: number, t: number): void;
}

export function buildFigure(spec: FigureSpec): FigureParts {
  const h = spec.height ?? 2.1;
  const group = new THREE.Group();

  // 袍服
  const robeMat = new THREE.MeshStandardNodeMaterial({ color: spec.robe, roughness: 0.75, metalness: 0.05 });
  const rimC = spec.rim ?? 0xffd9a0;
  // 菲涅尔轮廓光（暖金）：他们"发光"的来源
  robeMat.emissiveNode = Fn(() => {
    const f = pow(saturate(normalView.z).oneMinus(), 2.6);
    return color(rimC).mul(f.mul(0.55));
  })();
  const robe = new THREE.Mesh(robeGeometry(h, spec.bulk ?? 1), robeMat);
  group.add(robe);

  // 袖（简化为肩下两片）
  const sleeveGeo = new THREE.CylinderGeometry(h * 0.035, h * 0.06, h * 0.3, 7);
  const sleeves: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const sl = new THREE.Mesh(sleeveGeo, robeMat);
    sl.position.set(s * h * 0.13, h * 0.6, 0);
    sl.rotation.z = s * 0.25;
    group.add(sl);
    sleeves.push(sl);
  }

  // 头：受光浅浮雕轮廓 + 眼位暗区（不做五官）
  const headMat = new THREE.MeshStandardNodeMaterial({ color: 0xe8d0b8, roughness: 0.6 });
  headMat.emissiveNode = Fn(() => {
    const f = pow(saturate(normalView.z).oneMinus(), 2.2);
    return color(rimC).mul(f.mul(0.4));
  })();
  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.062, 12, 10), headMat);
  head.scale.y = 1.15;
  head.position.y = h * 0.87;
  group.add(head);
  // 眼位暗区
  const eyes = new THREE.Mesh(
    new THREE.SphereGeometry(h * 0.058, 10, 8, -Math.PI / 3, (Math.PI * 2) / 3, Math.PI * 0.35, Math.PI * 0.25),
    new THREE.MeshBasicNodeMaterial({ color: 0x4a3a30 }),
  );
  eyes.position.copy(head.position);
  eyes.scale.y = 1.15;
  group.add(eyes);

  // 冠 + 标志物
  const hat = hatGeometry(spec.hat, h, spec.hatColor ?? 0xd9b36a);
  if (hat) group.add(new THREE.Mesh(hat, new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 })));
  const prop = propGeometry(spec.prop ?? 'none', h);
  if (prop) group.add(new THREE.Mesh(prop, new THREE.MeshStandardNodeMaterial({ color: 0xd9c9a0, roughness: 0.5, metalness: 0.5 })));

  // 天衣飘带（顶点波动）
  let ribbonMesh: THREE.Mesh | null = null;
  if (spec.ribbon) {
    const rg = new THREE.PlaneGeometry(h * 0.06, spec.ribbon, 2, 16);
    rg.translate(0, -spec.ribbon / 2, 0);
    const rm = new THREE.MeshBasicNodeMaterial({ color: rimC, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    ribbonMesh = new THREE.Mesh(rg, rm);
    ribbonMesh.position.set(0, h * 0.72, -h * 0.06);
    group.add(ribbonMesh);
  }

  const state = { talkWeight: { value: 0 }, t: Math.random() * 100 };
  return {
    group,
    head,
    talkWeight: state.talkWeight,
    update(dt: number, t: number): void {
      // 待机：极缓慢呼吸
      const breathe = Math.sin(t * 0.6 + state.t) * 0.008;
      robe.scale.y = 1 + breathe;
      robe.scale.x = robe.scale.z = 1 - breathe * 0.5;
      // 说话：头部微幅点动 ±3°
      const nod = state.talkWeight.value * Math.sin(t * 9) * 0.05;
      head.rotation.x = nod;
      eyes.rotation.x = nod;
      // 飘带波动
      if (ribbonMesh) {
        ribbonMesh.rotation.x = Math.sin(t * 0.5 + state.t) * 0.12;
        ribbonMesh.rotation.z = Math.sin(t * 0.34 + state.t * 1.7) * 0.1;
      }
    },
  };
}
