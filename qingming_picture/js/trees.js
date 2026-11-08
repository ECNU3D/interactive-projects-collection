// 植物：截头老柳（汴堤柳）、杂木、桃树
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { P, vary } from './palette.js';
import { RIVER, BRIDGE } from './layout.js';
import { noise2 } from './terrain.js';

// 截头柳：粗壮疙瘩主干 + 顶部丛生新枝（画中汴堤柳的标志造型）
function willow(gb, x, z, s = 1) {
  const h = (2.6 + Math.random() * 1.2) * s;
  const r = (0.45 + Math.random() * 0.25) * s;
  // 主干（歪扭，树皮纹理）
  const lean = (Math.random() - 0.5) * 0.25;
  gb.cyl(r * 0.75, r, h, vary(P.trunk, 0.1), { x, y: h / 2, z, rz: lean, seg: 7, ch: 'wood', texScale: 0.9 });
  // 树瘤
  if (Math.random() < 0.6) {
    gb.sphere(r * 0.4, vary(0x5c452e, 0.12), { x: x + r * 0.6, y: h * (0.3 + Math.random() * 0.4), z: z + (Math.random() - 0.5) * r });
  }
  // 顶部疙瘩
  gb.sphere(r * 1.35, vary(0x5c452e, 0.1), { x: x + lean * h * 0.5, y: h, z, sy: 0.8 });
  // 丛生新枝：细长上扬弯枝 + 柳叶团
  const n = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const tilt = 0.25 + Math.random() * 0.5;
    const bl = (1.6 + Math.random() * 1.3) * s;
    const bx = x + lean * h * 0.5 + Math.cos(a) * r * 0.7;
    const bz = z + Math.sin(a) * r * 0.7;
    gb.cyl(0.02, 0.055, bl, vary(0x6e5838, 0.12), {
      x: bx + Math.cos(a) * Math.sin(tilt) * bl * 0.4,
      y: h + Math.cos(tilt) * bl * 0.45,
      z: bz + Math.sin(a) * Math.sin(tilt) * bl * 0.4,
      rx: Math.sin(a) * tilt, rz: -Math.cos(a) * tilt,
      seg: 4, wind: 0.25,
    });
    // 柳叶（嫩绿小团，垂感）
    const fx = bx + Math.cos(a) * Math.sin(tilt) * bl * 0.8;
    const fy = h + Math.cos(tilt) * bl * 0.85;
    const fz = bz + Math.sin(a) * Math.sin(tilt) * bl * 0.8;
    gb.sphere((0.38 + Math.random() * 0.28) * s, vary(Math.random() < 0.5 ? P.willow : P.willowD, 0.12), {
      x: fx, y: fy, z: fz, sy: 1.3 + Math.random() * 0.5, wind: 0.4,
    });
    if (Math.random() < 0.6) {
      gb.sphere(0.25 * s, vary(P.willowD, 0.15), { x: fx, y: fy - 0.5 * s, z: fz, sy: 1.5, wind: 0.5 });
    }
  }
}

// 早春杂木（榆槐：疏朗枝干 + 稀疏嫩芽）
function bareTree(gb, x, z, s = 1) {
  const h = (3.2 + Math.random() * 1.6) * s;
  gb.cyl(0.14 * s, 0.26 * s, h, vary(P.trunk, 0.12), { x, y: h / 2, z, rz: (Math.random() - 0.5) * 0.15, seg: 6, ch: 'wood', texScale: 0.9 });
  const n = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const t = 0.5 + Math.random() * 0.65;
    const bl = (1.2 + Math.random() * 1.1) * s;
    const by = h * (0.6 + Math.random() * 0.4);
    gb.cyl(0.02, 0.06 * s, bl, vary(P.bare, 0.15), {
      x: x + Math.cos(a) * Math.sin(t) * bl * 0.5,
      y: by + Math.cos(t) * bl * 0.5,
      z: z + Math.sin(a) * Math.sin(t) * bl * 0.5,
      rx: Math.sin(a) * t, rz: -Math.cos(a) * t, seg: 4,
    });
    if (Math.random() < 0.75) {
      gb.sphere((0.3 + Math.random() * 0.3) * s, vary(P.leaf, 0.18), {
        x: x + Math.cos(a) * Math.sin(t) * bl,
        y: by + Math.cos(t) * bl,
        z: z + Math.sin(a) * Math.sin(t) * bl,
        wind: 0.18,
      });
    }
  }
}

// 桃树（点缀几株春花）
function peachTree(gb, x, z, s = 1) {
  const h = 2.2 * s;
  gb.cyl(0.1 * s, 0.18 * s, h, vary(P.trunk, 0.1), { x, y: h / 2, z, seg: 5, ch: 'wood', texScale: 0.9 });
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    gb.sphere((0.5 + Math.random() * 0.3) * s, vary(P.peach, 0.08), {
      x: x + Math.cos(a) * 0.7 * s, y: h + 0.4 * s + Math.random() * 0.4, z: z + Math.sin(a) * 0.7 * s, wind: 0.2,
    });
  }
}

// 松（远景点缀）
function pine(gb, x, z, s = 1) {
  const h = 4 * s;
  gb.cyl(0.14 * s, 0.24 * s, h, vary(P.trunk, 0.1), { x, y: h / 2, z, seg: 5, ch: 'wood', texScale: 0.9 });
  for (let i = 0; i < 3; i++) {
    gb.cone((1.3 - i * 0.32) * s, 1.3 * s, vary(P.pine, 0.1), { x, y: h * 0.55 + i * 1.05 * s, z, seg: 7 });
  }
}

export function buildVegetation(scene) {
  const gb = new GeoBuilder();

  // ---- 汴堤柳：沿河两岸成排 ----
  for (const bankX of [RIVER.bank0 - 5, RIVER.bank1 + 5]) {
    for (let z = -195; z <= 195; z += 11) {
      if (Math.abs(z) < BRIDGE.deckHalfW + 6) continue;      // 桥头留空
      const jx = bankX + (Math.random() - 0.5) * 5;
      const jz = z + (Math.random() - 0.5) * 5;
      willow(gb, jx, jz, 0.85 + Math.random() * 0.5);
    }
  }
  // 桥头两棵大柳
  willow(gb, RIVER.bank0 - 8, 14, 1.3);
  willow(gb, RIVER.bank1 + 9, -13, 1.25);

  // ---- 郊野：道旁柳 + 疏林 ----
  for (let x = 20; x < 300; x += 18) {
    if (Math.random() < 0.75) willow(gb, x + Math.random() * 8, (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 4), 0.8 + Math.random() * 0.45);
  }
  for (let i = 0; i < 42; i++) {
    const x = 10 + Math.random() * 290;
    const z = (Math.random() < 0.5 ? -1 : 1) * (24 + Math.random() * 95);
    if (noise2(x * 0.05, z * 0.05) < 0.62) bareTree(gb, x, z, 0.8 + Math.random() * 0.6);
  }
  for (let i = 0; i < 8; i++) {
    peachTree(gb, 40 + Math.random() * 220, (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 40), 0.9 + Math.random() * 0.4);
  }
  // 坟茔旁的松
  pine(gb, 116, 84, 0.9); pine(gb, 130, 76, 0.75); pine(gb, 204, -84, 0.85);

  // ---- 河东岸至城门 ----
  for (let i = 0; i < 14; i++) {
    const x = 490 + Math.random() * 150;
    const z = (Math.random() < 0.5 ? -1 : 1) * (26 + Math.random() * 70);
    (Math.random() < 0.5 ? willow : bareTree)(gb, x, z, 0.8 + Math.random() * 0.5);
  }

  // ---- 城内：街树稀疏 ----
  const cityTreeSpots = [
    [700, 8], [738, -8], [790, 9], [856, -16], [900, 10], [944, -8], [700, -30], [820, 30], [880, 28],
  ];
  for (const [x, z] of cityTreeSpots) {
    (Math.random() < 0.6 ? willow : bareTree)(gb, x + Math.random() * 4, z + Math.random() * 3, 0.85 + Math.random() * 0.4);
  }
  // 卦摊边的老柳（讲解点）
  willow(gb, 861, -15, 1.35);

  scene.add(gb.buildMeshes({ name: 'vegetation' }));
}
