// 大地、沁芳水系、橋、寧榮街、夾道、後街
import * as THREE from 'three';
import { P } from './palette.js';
import { GeoBuilder, cullables } from './geo.js';
import { makeWaterMaterial } from './materials.js';
import {
  WORLD, YUAN, STREET, RONG, NING, JIADAO, HOUJIE,
  STREAM, BRIDGES, waterDepth, groundHeight, addCollider, addRegion,
} from './layout.js';
import { bridge, wallRun, rockery, frame, plaqueBoard, mulberry } from './parts.js';
import { tree } from './flora.js';

const WATER_Y = -0.55;

// ---------------------------------------------------------------- 大地
export function buildGround(scene) {
  // 府邸與街市：平地
  const gb = new GeoBuilder('ground-flat');
  const zTop = WORLD.z1, zBot = YUAN.z1 - 6;
  gb.box(WORLD.x1 - WORLD.x0, 0.3, zTop - zBot, P.mandi, {
    ch: 'earth', x: 0, y: -0.16, z: (zTop + zBot) / 2,
  });
  // 大觀園兩側與北面的園外空地，免得穿幫見底
  for (const [sx, w] of [[-1, YUAN.x0 - WORLD.x0], [1, WORLD.x1 - YUAN.x1]]) {
    const cx = sx < 0 ? (WORLD.x0 + YUAN.x0) / 2 : (YUAN.x1 + WORLD.x1) / 2;
    gb.box(w, 0.3, YUAN.z1 - WORLD.z0, P.cao, { ch: 'grass', x: cx, y: -0.16, z: (YUAN.z0 + YUAN.z1) / 2 - 20 });
  }
  gb.box(YUAN.x1 - YUAN.x0, 0.3, YUAN.z0 - WORLD.z0, P.cao, {
    ch: 'grass', x: 0, y: -0.16, z: (WORLD.z0 + YUAN.z0) / 2,
  });
  gb.emit(scene, { cull: false });

  // 大觀園：高程網格（挖去水面）
  const gb2 = new GeoBuilder('ground-garden');
  const STEP = 7;
  for (let x = YUAN.x0 - 14; x < YUAN.x1 + 14; x += STEP) {
    for (let z = YUAN.z0 - 14; z < YUAN.z1 + 8; z += STEP) {
      const cx = x + STEP / 2, cz = z + STEP / 2;
      if (waterDepth(cx, cz) > -0.18) continue;         // 水面留空
      const h = (px, pz) => groundHeight(px, pz);
      const onHill = h(cx, cz) > 0.4;
      gb2.quad(
        [x, h(x, z), z], [x, h(x, z + STEP), z + STEP],
        [x + STEP, h(x + STEP, z + STEP), z + STEP], [x + STEP, h(x + STEP, z), z],
        onHill ? 0x7e8555 : P.cao, { ch: 'grass' }
      );
    }
  }
  gb2.emit(scene, { cull: false });
}

// ---------------------------------------------------------------- 水
export function buildWater(scene) {
  const pos = [], uv = [], idx = [];
  let v = 0;
  for (const s of STREAM) {
    const [ax, az] = s.a, [bx, bz] = s.b;
    const dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz) || 1;
    const px = -dz / L, pz = dx / L;
    const hw = s.w / 2 + 1.0;
    pos.push(ax - px * hw, WATER_Y, az - pz * hw);
    pos.push(ax + px * hw, WATER_Y, az + pz * hw);
    pos.push(bx + px * hw, WATER_Y, bz + pz * hw);
    pos.push(bx - px * hw, WATER_Y, bz - pz * hw);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
    // 接頭補圓（避免折點缺角）
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const wmat = makeWaterMaterial();
  wmat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, wmat);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  scene.add(mesh);

  // 駁岸：石砌護坡
  const gb = new GeoBuilder('water-bank');
  for (const s of STREAM) {
    const [ax, az] = s.a, [bx, bz] = s.b;
    const dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz) || 1;
    const px = -dz / L, pz = dx / L;
    const hw = s.w / 2;
    for (const sgn of [-1, 1]) {
      gb.quad(
        [ax + px * hw * sgn, WATER_Y - 0.2, az + pz * hw * sgn],
        [bx + px * hw * sgn, WATER_Y - 0.2, bz + pz * hw * sgn],
        [bx + px * (hw + 1.6) * sgn, groundHeight(bx + px * (hw + 1.6) * sgn, bz + pz * (hw + 1.6) * sgn) + 0.08, bz + pz * (hw + 1.6) * sgn],
        [ax + px * (hw + 1.6) * sgn, groundHeight(ax + px * (hw + 1.6) * sgn, az + pz * (hw + 1.6) * sgn) + 0.08, az + pz * (hw + 1.6) * sgn],
        P.taihu, { ch: 'rock', both: true }
      );
    }
  }
  gb.emit(scene, { cull: false });
  return mesh;
}

// ---------------------------------------------------------------- 橋
export function buildBridges(scene) {
  const gb = new GeoBuilder('bridges');
  for (const B of BRIDGES) {
    const stone = B.id !== 'ouxiang' && B.id !== 'daoxiang';
    bridge(gb, B, { stone, rail: true, arch: stone && B.rise > 1.4 });
    const mx = (B.a[0] + B.b[0]) / 2, mz = (B.a[1] + B.b[1]) / 2;
    addRegion(B.name, mx - B.w, mz - 4, mx + B.w, mz + 4);
  }
  gb.emit(scene, { cull: false });
}

// ---------------------------------------------------------------- 寧榮街
export function buildStreet(scene) {
  const gb = new GeoBuilder('street');
  const rnd = mulberry(4242);
  // 街面
  gb.box(STREET.x1 - STREET.x0, 0.12, STREET.z1 - STREET.z0, P.mandi, {
    ch: 'mandi', x: 0, y: 0.06, z: (STREET.z0 + STREET.z1) / 2,
  });
  // 對面市房（把街框住）
  const shops = [
    [-206, 6], [-176, 5], [-146, 6], [-116, 5], [-86, 6], [-56, 5],
    [-24, 6], [12, 5], [44, 6], [76, 5], [108, 6], [140, 5], [172, 6], [204, 5],
  ];
  for (const [sx, bays] of shops) {
    const w = bays * 3.2;
    gb.box(w, 4.2, 7, P.fenqiang, { ch: 'plaster', x: sx, y: 2.1, z: 24 });
    gb.box(w + 1.2, 0.3, 8.6, P.tongwa, { ch: 'tile', x: sx, y: 4.35, z: 24 });
    gb.box(w + 0.6, 0.36, 0.5, P.ji, { ch: 'ridge', x: sx, y: 4.6, z: 24 });
    // 檐廊
    for (let i = 0; i <= bays; i++) {
      gb.cyl(0.15, 0.16, 3.4, P.woodDark, { ch: 'wood', x: sx - w / 2 + w * i / bays, y: 1.7, z: 20.4, seg: 6 });
    }
    gb.box(w, 0.36, 0.28, P.woodDark, { ch: 'wood', x: sx, y: 3.5, z: 20.4 });
    // 幌子
    if (rnd() < 0.55) {
      gb.box(0.7, 1.9, 0.05, rnd() < 0.5 ? P.hongsha : P.jinhuang, {
        ch: 'silk', x: sx + (rnd() - 0.5) * w * 0.6, y: 2.4, z: 20.1, wind: 0.45,
      });
    }
    addCollider(sx - w / 2, 20, sx + w / 2, 28);
  }
  // 街樹
  for (let x = -212; x <= 212; x += 26) tree(gb, 'huai', x, 18.6, 1.1 + rnd() * 0.3, (x * 3) | 0);
  // 拴馬樁
  for (let x = -190; x <= 190; x += 34) {
    gb.box(0.34, 1.4, 0.34, P.hanbaiyu, { ch: 'stone', x, y: 0.7, z: 3.2 });
    gb.sphere(0.24, P.hanbaiyu, { ch: 'stone', x, y: 1.5, z: 3.2 });
  }
  gb.emit(scene, { cull: false });
  addRegion('宁荣街', STREET.x0, -1, STREET.x1, 34);
}

// ---------------------------------------------------------------- 夾道與後街
export function buildAlleys(scene) {
  const gb = new GeoBuilder('alleys');
  // 寧榮夾道：第十六回「當日寧榮二宅，雖有一小巷界斷不通，然這小巷亦係私地，
  //            並非官道，故可以連屬」——省親後已打通
  gb.box(JIADAO.x1 - JIADAO.x0, 0.12, JIADAO.z1 - JIADAO.z0, P.qingzhuan, {
    ch: 'brick', x: 0, y: 0.06, z: (JIADAO.z0 + JIADAO.z1) / 2,
  });
  // 後街
  gb.box(RONG.x1 - RONG.x0 + 20, 0.12, HOUJIE.z1 - HOUJIE.z0, P.qingzhuan, {
    ch: 'brick', x: (RONG.x0 + RONG.x1) / 2, y: 0.06, z: (HOUJIE.z0 + HOUJIE.z1) / 2,
  });
  gb.box(NING.x1 - NING.x0 + 20, 0.12, HOUJIE.z1 - HOUJIE.z0, P.qingzhuan, {
    ch: 'brick', x: (NING.x0 + NING.x1) / 2, y: 0.06, z: (HOUJIE.z0 + HOUJIE.z1) / 2,
  });
  // 夾道北口通大觀園：立一座隨牆門
  const F = frame(0, -206, 0);
  for (const sx of [-1, 1]) {
    gb.box(1.0, 4.4, 1.0, P.qingzhuan, { ch: 'brick', x: sx * 3.2, y: 2.2, z: -206 });
  }
  gb.box(8.0, 0.9, 1.2, P.qingzhuan, { ch: 'brick', x: 0, y: 4.6, z: -206 });
  gb.box(9.4, 0.28, 1.8, P.tongwa, { ch: 'tile', x: 0, y: 5.2, z: -206 });
  gb.box(8.6, 0.32, 0.6, P.ji, { ch: 'ridge', x: 0, y: 5.5, z: -206 });
  plaqueBoard(gb, F, '大觀園', 0, 4.5, 0.7, 3.0, 1.0);
  addCollider(-4.6, -206.7, -2.6, -205.3);
  addCollider(2.6, -206.7, 4.6, -205.3);
  gb.emit(scene, { cull: false });
  addRegion('宁荣夹道', JIADAO.x0 - 2, JIADAO.z0, JIADAO.x1 + 2, JIADAO.z1);
  addRegion('后街', RONG.x0, HOUJIE.z0, NING.x1, HOUJIE.z1);
}

// ---------------------------------------------------------------- 光照
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xdde7ea, 0x6d6a58, 1.02);
  scene.add(hemi);
  // 室內有天花遮蓋，半球光照不進去，補一點環境光把堂奧提亮
  const amb = new THREE.AmbientLight(0xb6bec2, 0.34);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(P.sunColor, 1.45);
  sun.position.set(120, 220, 160);
  sun.castShadow = false;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa8bcc8, 0.35);
  fill.position.set(-140, 90, -160);
  scene.add(fill);
  return { sun, hemi, fill, amb };
}
