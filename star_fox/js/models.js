// models.js — 飞船 / 敌机 / Boss / 场景模型
import * as THREE from 'three';
import { makeHullTexture, makeRockTexture, makeGlowSprite } from './textures.js?v=20260728';

let hullTexCache = {};
export function hullTex(base, accent) {
  const key = base + accent;
  if (!hullTexCache[key]) hullTexCache[key] = makeHullTexture(base, accent);
  return hullTexCache[key];
}

function mat(base, accent, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map: hullTex(base, accent),
    metalness: 0.75,
    roughness: 0.38,
    emissive: new THREE.Color(accent).multiplyScalar(0.18),
    ...opts,
  });
}

// Boss 舰体材质：更强的自发光，确保远距离清晰可见
function bossMat(base, accent) {
  return mat(base, accent, { emissive: new THREE.Color(accent).multiplyScalar(0.38) });
}

function emissiveMat(color, intensity = 2) {
  return new THREE.MeshBasicMaterial({ color });
}

// ---------- 玩家战机（第三人称）—— N64 Arwing 风格 ----------
export function buildPlayerShip() {
  const g = new THREE.Group();
  const white = mat('#cfd4dc', '#8a94a8', { flatShading: true });
  const blue = mat('#1f3f9f', '#4a7aff', { flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2430, metalness: 0.9, roughness: 0.3, flatShading: true });
  // 机身（细长菱形截面）
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.62, 4.6, 6), white);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  // 长尖机头
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.0, 6), white);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.7;
  g.add(nose);
  // 机头红色条纹（原版涂装）
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xd83028, metalness: 0.6, roughness: 0.4 }));
  stripe.position.set(0, 0.3, -2.4);
  g.add(stripe);
  // 黑色座舱盖（靠后上方）
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0e16, metalness: 0.95, roughness: 0.12 }));
  canopy.position.set(0, 0.42, -0.7);
  canopy.scale.set(0.75, 0.55, 1.9);
  g.add(canopy);
  // 主翼（后掠 + 下反角）+ 蓝色翼板 + 翼尖炮舱
  const wingGeo = new THREE.BoxGeometry(3.5, 0.1, 1.8);
  const panelGeo = new THREE.BoxGeometry(2.4, 0.07, 1.15);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, white);
    wing.position.set(s * 2.15, 0, 0.75);
    wing.rotation.y = s * -0.55;   // 翼尖后掠
    wing.rotation.z = s * -0.09;
    g.add(wing);
    const panel = new THREE.Mesh(panelGeo, blue);
    panel.position.set(s * 2.7, 0.09, 1.1);
    panel.rotation.y = s * -0.55;
    panel.rotation.z = s * -0.09;
    g.add(panel);
    // 翼尖炮舱 + 炮管（激光由此射出）
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 1.3), dark);
    pod.position.set(s * 3.7, -0.08, 1.4);
    g.add(pod);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(s * 3.7, -0.08, 0.3);
    g.add(barrel);
  }
  // 机头双联长炮管（原版标志特征）
  for (const s of [-1, 1]) {
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6), dark);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(s * 0.55, -0.3, -3.6);
    g.add(cannon);
  }
  // 垂尾（白色后掠，蓝色顶端）
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.6), white);
  tail.position.set(0, 0.95, 1.55);
  tail.rotation.x = -0.22;
  g.add(tail);
  const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.4, 1.0), blue);
  tailTip.position.set(0, 1.55, 1.75);
  tailTip.rotation.x = -0.22;
  g.add(tailTip);
  // 翼根双引擎 + 蓝色尾焰
  const flameTex = makeGlowSprite('#e8f2ff', 'rgba(90,160,255,0)');
  g.userData.flames = [];
  for (const s of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.9, 8), dark);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(s * 0.95, -0.12, 1.7);
    g.add(eng);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8), emissiveMat(0x66aaff));
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(s * 0.95, -0.12, 2.75);
    g.add(nozzle);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    flame.position.set(s * 0.95, -0.12, 3.2);
    flame.scale.set(1.5, 1.5, 1);
    g.add(flame);
    g.userData.flames.push(flame);
  }
  g.userData.gunTips = [new THREE.Vector3(-3.7, -0.08, -0.5), new THREE.Vector3(3.7, -0.08, -0.5)];
  return g;
}

// ---------- 玩家座舱（第一人称）----------
export function buildCockpit() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a2433, metalness: 0.85, roughness: 0.35 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.05, depthWrite: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x27e0a8 });

  // 仪表台
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.9), frameMat);
  dash.position.set(0, -0.72, -1.15);
  dash.rotation.x = -0.28;
  g.add(dash);

  // 仪表发光面板
  for (let i = -1; i <= 1; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), i === 0 ? glowMat : new THREE.MeshBasicMaterial({ color: 0x2a86ff }));
    p.position.set(i * 0.62, -0.60, -0.99);
    p.rotation.x = -0.28;
    g.add(p);
  }
  // 侧舷
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 1.6), frameMat);
  sideL.position.set(-1.45, -0.55, -0.6); sideL.rotation.z = 0.22; sideL.rotation.y = -0.15;
  g.add(sideL);
  const sideR = sideL.clone();
  sideR.position.x = 1.45; sideR.rotation.z = -0.22; sideR.rotation.y = 0.15;
  g.add(sideR);
  // 舱盖骨架（A 字支柱）
  const strutGeo = new THREE.BoxGeometry(0.09, 1.5, 0.09);
  const strutL = new THREE.Mesh(strutGeo, frameMat);
  strutL.position.set(-0.95, 0.35, -1.15); strutL.rotation.z = -0.42; strutL.rotation.x = 0.18;
  g.add(strutL);
  const strutR = strutL.clone();
  strutR.position.x = 0.95; strutR.rotation.z = 0.42;
  g.add(strutR);
  // 顶部横梁
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.09, 0.09), frameMat);
  beam.position.set(0, 0.88, -1.02); beam.rotation.x = 0.18;
  g.add(beam);
  // 玻璃
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), glassMat);
  glass.position.set(0, 0.15, -1.25);
  glass.rotation.x = 0.18;
  g.add(glass);
  // 机鼻（向前下方延伸）
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.2, 6), mat('#cfd4dc', '#4a7aff', { flatShading: true }));
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.95, -2.6);
  g.add(nose);
  // 两翼尖（视野边缘可见）
  const wingGeo = new THREE.BoxGeometry(1.6, 0.08, 0.7);
  const wingL = new THREE.Mesh(wingGeo, mat('#cfd4dc', '#4a7aff', { flatShading: true }));
  wingL.position.set(-1.9, -0.75, -0.9); wingL.rotation.y = 0.5; wingL.rotation.z = 0.1;
  g.add(wingL);
  const wingR = wingL.clone();
  wingR.position.x = 1.9; wingR.rotation.y = -0.5; wingR.rotation.z = -0.1;
  g.add(wingR);
  // 翼尖炮管
  const gunGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8);
  const gunMat2 = new THREE.MeshStandardMaterial({ color: 0x223044, metalness: 0.9, roughness: 0.3 });
  const gunL = new THREE.Mesh(gunGeo, gunMat2);
  gunL.rotation.x = Math.PI / 2; gunL.position.set(-1.55, -0.72, -1.75);
  g.add(gunL);
  const gunR = gunL.clone(); gunR.position.x = 1.55;
  g.add(gunR);
  g.userData.gunTips = [new THREE.Vector3(-1.55, -0.72, -2.2), new THREE.Vector3(1.55, -0.72, -2.2)];

  return g;
}

// ---------- 敌机：无人机（SF64 Venom 蝶式战斗机风格）----------
export function buildDrone() {
  const g = new THREE.Group();
  const olive = mat('#6a6238', '#b8a860', { flatShading: true });
  const darkOlive = mat('#4a4428', '#8a7a40', { flatShading: true });
  // 矮胖机身
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), olive);
  body.scale.set(1, 0.55, 1.6);
  g.add(body);
  // 红色独眼传感器（朝向玩家 +z）
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), emissiveMat(0xff3020));
  eye.position.set(0, 0.1, 1.5);
  g.add(eye);
  // 蝶形上反双翼（V 形张开）
  const wingGeo = new THREE.BoxGeometry(2.8, 0.09, 1.1);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, darkOlive);
    wing.position.set(s * 1.5, 0.35, -0.3);
    wing.rotation.z = s * 0.5;   // 上反角
    wing.rotation.y = s * 0.35;  // 略后掠
    g.add(wing);
  }
  // 下部小垂鳍
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.8), darkOlive);
  fin.position.set(0, -0.5, -0.9);
  g.add(fin);
  // 尾部引擎光
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.5, 8), emissiveMat(0xff8020));
  eng.rotation.x = Math.PI / 2;
  eng.position.set(0, 0, -1.4);
  g.add(eng);
  g.userData.radius = 2.0;
  return g;
}

// ---------- 敌机：战斗机（SF64 Venom 截击机风格）----------
export function buildFighter() {
  const g = new THREE.Group();
  const grey = mat('#5a6068', '#a8b0b8', { flatShading: true });
  const darkGrey = mat('#3a4048', '#7a8288', { flatShading: true });
  // 尖头机身（朝 +z）
  const fus = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4.6, 6), grey);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  // 座舱
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x101418, metalness: 0.9, roughness: 0.2 }));
  cockpit.position.set(0, 0.42, 0.4); cockpit.scale.set(0.9, 0.55, 1.5);
  g.add(cockpit);
  // 后掠主翼
  const wingGeo = new THREE.BoxGeometry(4.6, 0.1, 1.2);
  const wing = new THREE.Mesh(wingGeo, darkGrey);
  wing.position.z = -1.0;
  g.add(wing);
  // 翼尖红色条带（原版涂装）
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.11, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xc03828, metalness: 0.6, roughness: 0.4 }));
    tip.position.set(s * 1.9, 0, -1.0);
    g.add(tip);
  }
  // 双垂尾（外倾）
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.9), darkGrey);
    tail.position.set(s * 0.55, 0.55, -1.7);
    tail.rotation.z = s * -0.3;
    g.add(tail);
  }
  // 双引擎红光
  for (const s of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.0, 8), emissiveMat(0xff4820));
    eng.rotation.x = Math.PI / 2; eng.position.set(s * 1.3, 0, -1.8);
    g.add(eng);
  }
  g.userData.radius = 2.6;
  return g;
}

// ---------- 敌机：炮塔（SF64 地面圆顶炮塔风格）----------
export function buildTurret() {
  const g = new THREE.Group();
  const olive = mat('#6a6248', '#c8b870', { flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 1.2, 8), olive);
  g.add(base);
  // 装甲圆顶
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), olive);
  head.position.y = 0.6;
  g.add(head);
  // 散热口环
  const vent = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2a22, metalness: 0.7, roughness: 0.5 }));
  vent.rotation.x = Math.PI / 2;
  vent.position.y = 0.7;
  g.add(vent);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.25 }));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.3, 1.6);
  g.add(barrel);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), emissiveMat(0xffe040));
  tip.position.set(0, 1.3, 2.9);
  g.add(tip);
  g.userData.radius = 2.4;
  g.userData.barrel = barrel;
  return g;
}

// ---------- 太空水雷 ----------
export function buildMine() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), mat('#402028', '#ff2080'));
  g.add(core);
  const spikeGeo = new THREE.ConeGeometry(0.22, 1.1, 6);
  const sm = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.4 });
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for (const d of dirs) {
    const s = new THREE.Mesh(spikeGeo, sm);
    s.position.set(d[0]*1.3, d[1]*1.3, d[2]*1.3);
    s.lookAt(d[0]*3, d[1]*3, d[2]*3);
    s.rotateX(Math.PI/2);
    g.add(s);
  }
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), emissiveMat(0xff2060));
  blink.position.y = 0.2;
  g.add(blink);
  g.userData.radius = 1.8;
  g.userData.blink = blink;
  return g;
}

// ---------- 小行星 ----------
let rockTex = null;
export function buildAsteroid(scale = 1) {
  if (!rockTex) rockTex = makeRockTexture();
  const geo = new THREE.IcosahedronGeometry(3 * scale, 1);
  // 顶点扰动
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + (Math.sin(v.x * 3.1) + Math.cos(v.y * 2.3 + v.z)) * 0.12 + (Math.random() - 0.5) * 0.22;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.95, metalness: 0.05 }));
  const g = new THREE.Group();
  g.add(m);
  g.userData.radius = 3.2 * scale;
  return g;
}

// ---------- Boss 1: 攻击母舰（SF64 Attack Carrier 风格，舰艉朝玩家）----------
export function buildBossCruiser() {
  const g = new THREE.Group();
  const frameMat = bossMat('#565a62', '#9aa0a8');
  const rustMat = bossMat('#7a4a32', '#c08a50');
  // 中央灰色机械中框
  const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 10, 36), frameMat);
  frame.position.z = -4;
  g.add(frame);
  // 中框散热格栅
  for (let i = 0; i < 5; i++) {
    const grill = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.7, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.8, roughness: 0.5 }));
    grill.position.set(0, 0, -16 + i * 6);
    g.add(grill);
  }
  // 上下两条锈棕色钳形舰艏（向玩家 +z 方向伸出）
  for (const s of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 40), rustMat);
    prong.position.set(0, s * 9, -2);
    g.add(prong);
    // 装甲补强板
    const plate = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.2, 16), frameMat);
    plate.position.set(0, s * 9, -12);
    g.add(plate);
    // 舰艏前端（玩家侧）橙色引擎喷口
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 1.2, 10), emissiveMat(0xff8030));
    eng.rotation.x = Math.PI / 2;
    eng.position.set(0, s * 9, 18.4);
    g.add(eng);
    // 喷口外框
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.4, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.85, roughness: 0.4 }));
    rim.position.set(0, s * 9, 18.8);
    g.add(rim);
  }
  // 舰艉发射舱核心（两钳之间，红色发光）+ 护罩
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 14), new THREE.MeshBasicMaterial({ color: 0xff40c0 }));
  core.position.set(0, 0, 19.2);
  g.add(core);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xc040ff, transparent: true, opacity: 0.25, depthWrite: false }));
  shield.position.copy(core.position);
  g.add(shield);
  // 两侧主炮（弱点）：炮塔 Group 会被 lookAt 到玩家，炮管沿局部 +z
  const weakMat = new THREE.MeshBasicMaterial({ color: 0xff40c0 });
  const mkTurret = (x) => {
    const t = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12), rustMat);
    t.add(ball);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 }));
    barrel.rotation.x = Math.PI / 2; barrel.position.z = 3.5;
    t.add(barrel);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), weakMat.clone());
    eye.position.z = 1.8;
    t.add(eye);
    t.position.set(x, 0, 10);
    g.add(t);
    return t;
  };
  const turretL = mkTurret(-7.2), turretR = mkTurret(7.2);
  g.userData = { radius: 12, turrets: [turretL, turretR], core, shield };
  return g;
}

// ---------- Boss 2: 陨石粉碎者（SF64 Meteo Crusher 风格）----------
export function buildBossBehemoth() {
  const g = new THREE.Group();
  const bronze = bossMat('#6a4f28', '#c09a40');
  const gold = bossMat('#8a6a30', '#ffd050');
  // 六边形核心舱（面朝玩家 +z）
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 9, 6), bronze);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  // 舱面装甲板细节
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 10), gold);
    rib.position.set(Math.cos(a) * 6.8, Math.sin(a) * 6.8, 0);
    rib.rotation.z = a;
    g.add(rib);
  }
  // 旋转采集环
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 1.8, 10, 40), bronze);
  g.add(ring);
  // 四条叶片机械臂（上二小、下二大，金色铲叶）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const big = i >= 2 ? 1 : 0.62; // 下两条更大
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8 * big, 1.8 * big, 9 * big), bronze);
    const cx = Math.cos(a), cy = Math.sin(a);
    arm.position.set(cx * 9, cy * 9, 0);
    arm.rotation.z = a;
    g.add(arm);
    // 金色铲叶（扁平三角）
    const blade = new THREE.Mesh(new THREE.ConeGeometry(2.6 * big, 9 * big, 4), gold);
    blade.position.set(cx * 15, cy * 15, 0);
    blade.rotation.z = a - Math.PI / 2;
    blade.scale.z = 0.35;
    g.add(blade);
  }
  // 蓝白色发光核心（朝向玩家 +z，周期暴露）
  const core = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 16), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
  core.position.z = 6.5;
  g.add(core);
  // 核心舱门（与核心同心半球壳，游戏逻辑改 rotation.z 开合）
  const doorGeo = new THREE.SphereGeometry(4.0, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const doorL = new THREE.Mesh(doorGeo, bronze);
  doorL.position.z = 6.5; doorL.rotation.x = Math.PI / 2; doorL.rotation.z = 0;
  g.add(doorL);
  const doorR = doorL.clone();
  g.add(doorR);
  g.userData = { radius: 16, core, ring, doors: [doorL, doorR] };
  return g;
}

// ---------- Boss 3: 歼灭旗舰 ----------
export function buildBossFlagship() {
  const g = new THREE.Group();
  // 主舰体 —— 三叉戟形
  const hullMat = bossMat('#2a3a2f', '#40ff90');
  const center = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 50, 8), hullMat);
  center.rotation.x = Math.PI / 2;
  g.add(center);
  const prow = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 8), hullMat);
  prow.rotation.x = -Math.PI / 2; prow.position.z = -34;
  g.add(prow);
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 4, 30, 8), hullMat);
    wing.rotation.x = Math.PI / 2;
    wing.position.set(sx * 13, 0, 8);
    g.add(wing);
    const wprow = new THREE.Mesh(new THREE.ConeGeometry(2.5, 10, 8), hullMat);
    wprow.rotation.x = -Math.PI / 2; wprow.position.set(sx * 13, 0, -12);
    g.add(wprow);
    // 引擎
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, 3.5, 10), emissiveMat(0x40ff90));
    eng.rotation.x = Math.PI / 2; eng.position.set(sx * 13, 0, 24);
    g.add(eng);
  }
  const mainEng = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 4, 12), emissiveMat(0x40ff90));
  mainEng.rotation.x = Math.PI / 2; mainEng.position.z = 26;
  g.add(mainEng);
  // 弱点：三个护盾发生器 + 主核心
  const genMat = new THREE.MeshBasicMaterial({ color: 0x60ffb0 });
  const gens = [];
  for (const [x, y, z] of [[-13, 3.5, 4], [13, 3.5, 4], [0, 6.5, 12]]) {
    const gen = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 12), genMat.clone());
    gen.position.set(x, y, z);
    g.add(gen);
    gens.push(gen);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff5040 }));
  core.position.set(0, 0, -20);
  g.add(core);
  const coreShield = new THREE.Mesh(new THREE.SphereGeometry(4.4, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.3, depthWrite: false }));
  coreShield.position.copy(core.position);
  g.add(coreShield);
  g.userData = { radius: 15, gens, core, coreShield };
  return g;
}

// ---------- 追踪导弹 ----------
export function buildMissile() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xb8c4d4, metalness: 0.9, roughness: 0.25 }));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), emissiveMat(0xff5040));
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -1.45;
  g.add(tip);
  // 尾翼
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8a94a4, metalness: 0.8, roughness: 0.4 }));
    const a = i * Math.PI / 2;
    fin.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.9);
    fin.rotation.z = a;
    g.add(fin);
  }
  // 尾焰
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowSprite('#fff2d8', 'rgba(255,140,40,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  flame.position.z = 1.5;
  flame.scale.set(1.8, 1.8, 1);
  g.add(flame);
  return g;
}

// ---------- 地面坦克 ----------
export function buildTank() {
  const g = new THREE.Group();
  const bodyMat = mat('#5a5240', '#c8a050', { flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 5), bodyMat);
  body.position.y = 0.9;
  g.add(body);
  // 倾斜首上装甲
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.2), bodyMat);
  glacis.position.set(0, 1.1, 2.6);
  glacis.rotation.x = 0.5;
  g.add(glacis);
  // 履带
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x22251e, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5.4), trackMat);
    track.position.set(s * 1.6, 0.4, 0);
    g.add(track);
  }
  // 炮塔
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 8), bodyMat);
  turret.position.y = 1.8;
  g.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2d26, metalness: 0.85, roughness: 0.3 }));
  barrel.rotation.x = Math.PI / 2 - 0.15;
  barrel.position.set(0, 2.0, 1.8);
  g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), emissiveMat(0xffa040));
  muzzle.position.set(0, 2.25, 3.4);
  g.add(muzzle);
  g.userData.radius = 3.0;
  return g;
}

// ---------- 城市高楼 ----------
export function buildBuilding(w = 8, h = 30, d = 8) {
  const g = new THREE.Group();
  const S = 128;
  const cvs = document.createElement('canvas');
  cvs.width = S; cvs.height = S;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#232830';
  ctx.fillRect(0, 0, S, S);
  // 发光窗户
  for (let y = 6; y < S - 6; y += 14) {
    for (let x = 6; x < S - 6; x += 12) {
      const lit = Math.random();
      ctx.fillStyle = lit < 0.35 ? '#ffd873' : lit < 0.5 ? '#7fd4ff' : '#3a4250';
      ctx.fillRect(x, y, 8, 9);
    }
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.8 }));
  m.position.y = h / 2;
  g.add(m);
  return g;
}

// ---------- 岩柱（沙漠/毒液星）----------
export function buildMesa(color = '#8a5f3a', h = 25) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(h * 0.18, h * 0.4, h, 7);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.x *= 1 + (Math.random() - 0.5) * 0.25;
    v.z *= 1 + (Math.random() - 0.5) * 0.25;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  m.position.y = h / 2;
  g.add(m);
  return g;
}

// ---------- 冰锥（雪原）----------
export function buildIceSpike(h = 22) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.22, h, 6),
    new THREE.MeshStandardMaterial({ color: 0xcfe4f8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
  m.position.y = h / 2;
  g.add(m);
  return g;
}

// ---------- 探照灯（佐内斯）----------
export function buildSearchlight() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 3, 8), mat('#3a4048', '#ffe040'));
  base.position.y = 1.5;
  g.add(base);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 10), emissiveMat(0xfff2c0));
  head.position.y = 3.6;
  g.add(head);
  // 光锥
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = 18;
  g.add(cone);
  g.userData.cone = cone;
  g.userData.radius = 2.2;
  return g;
}

// ---------- Boss: 飞碟母舰（卡蒂娜）—— SF64 Saucerer 深色透镜碟 ----------
export function buildBossSaucer() {
  const g = new THREE.Group();
  const hullDark = bossMat('#2e343a', '#6a7a88');
  // 透镜形主碟体（扁球）
  const disc = new THREE.Mesh(new THREE.SphereGeometry(20, 28, 14), hullDark);
  disc.scale.set(1, 0.22, 1);
  g.add(disc);
  // 碟体环向装甲脊
  for (const r of [10, 15]) {
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 6, 36),
      new THREE.MeshStandardMaterial({ color: 0x1c2024, metalness: 0.85, roughness: 0.45 }));
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = 20 * 0.22 * Math.sqrt(Math.max(0, 1 - (r / 20) ** 2)) * 1.06;
    g.add(ridge);
  }
  // 上穹顶
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hullDark);
  dome.position.y = 3.4;
  dome.scale.y = 0.8;
  g.add(dome);
  // 碟缘灯带
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19.4, 0.8, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xff8040 }));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  // 三个悬浮炮位（弱点）
  const turMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  const turrets = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12), turMat.clone());
    t.position.set(Math.cos(a) * 16, -3.5, Math.sin(a) * 16);
    g.add(t);
    turrets.push(t);
    // 炮位挂架
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.4, 6), hullDark);
    mount.position.set(Math.cos(a) * 16, -1.6, Math.sin(a) * 16);
    g.add(mount);
  }
  // 底部核心
  const core = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff5040 }));
  g.add(core);
  core.position.set(0, -4.5, 0);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff8040, transparent: true, opacity: 0.28, depthWrite: false }));
  shield.position.copy(core.position);
  g.add(shield);
  g.userData = { radius: 20, turrets, core, shield, ring };
  return g;
}

// ---------- Boss: 深海潜艇（佐内斯）—— SF64 Sarumarine 风格 ----------
export function buildBossSub() {
  const g = new THREE.Group();
  const rust = bossMat('#5a3228', '#c06040');
  const bronze = bossMat('#6a4a30', '#c08a50');
  // 主艇体（锈红装甲）
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 42, 12), rust);
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  // 艇艏/艇艉
  const bow = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 12), rust);
  bow.position.z = -21; bow.scale.z = 1.3;
  g.add(bow);
  const stern = bow.clone(); stern.position.z = 21;
  g.add(stern);
  // 舷侧装甲板（古铜）
  for (const s of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, 26), bronze);
    plate.position.set(s * 5, 0, 0);
    g.add(plate);
  }
  // 红色发光舱板
  for (const s of [-1, 1]) {
    const glowPanel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 8), emissiveMat(0xff3020));
    glowPanel.position.set(s * 5.4, 1.2, -6);
    g.add(glowPanel);
  }
  // 前部双大口径鱼雷发射管（黑色管口朝玩家 +z）
  for (const s of [-1, 1]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 10, 12), bronze);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(s * 3, 1.6, 20);
    g.add(tube);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x0a0c10, metalness: 0.6, roughness: 0.6 }));
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(s * 3, 1.6, 25);
    g.add(muzzle);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.35, 8, 14), bronze);
    rim.position.set(s * 3, 1.6, 25.2);
    g.add(rim);
  }
  // 下部双浮筒舱
  for (const s of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 26, 10), rust);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(s * 5.2, -4.2, 0);
    g.add(pod);
    const podCap = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 10), rust);
    podCap.position.set(s * 5.2, -4.2, 13);
    g.add(podCap);
  }
  // 指挥塔 + 潜望镜
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5, 8), bronze);
  tower.position.set(0, 6, -4);
  g.add(tower);
  const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 4, 8), emissiveMat(0x40c8ff));
  periscope.position.set(0, 10, -4);
  g.add(periscope);
  // 尾舵
  for (const [rx, rz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 4), rust);
    fin.position.set(rx * 5.5, rz * 5.5, 20);
    fin.rotation.z = rx !== 0 ? 0 : Math.PI / 2;
    g.add(fin);
  }
  // 导弹发射舱核心 + 舱盖（构造不变，游戏逻辑改 rotation.y 开合）
  const core = new THREE.Mesh(new THREE.SphereGeometry(3, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffe060 }));
  core.position.set(0, 5.5, 6);
  g.add(core);
  const hatchGeo = new THREE.SphereGeometry(3.8, 14, 10, 0, Math.PI, 0, Math.PI / 2);
  const hatchL = new THREE.Mesh(hatchGeo, bronze);
  hatchL.position.copy(core.position);
  hatchL.rotation.z = Math.PI / 2;
  g.add(hatchL);
  const hatchR = new THREE.Mesh(hatchGeo, bronze);
  hatchR.position.copy(core.position);
  hatchR.rotation.z = -Math.PI / 2;
  g.add(hatchR);
  g.userData = { radius: 14, core, hatches: [hatchL, hatchR] };
  return g;
}

// ---------- 沃尔夫战机（福尔图娜）—— SF64 Wolfen 风格，+z 朝玩家 ----------
export function buildWolfen() {
  const g = new THREE.Group();
  const grey = bossMat('#6a6a72', '#b0b0bc');
  const red = bossMat('#a02820', '#ff5040');
  // 飞镖机身（尖头朝 +z）
  const fus = new THREE.Mesh(new THREE.ConeGeometry(1.0, 5.6, 6), grey);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  // 黑色座舱盖
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0e14, metalness: 0.95, roughness: 0.15 }));
  cockpit.position.set(0, 0.42, 0.4);
  cockpit.scale.set(0.85, 0.55, 1.7);
  g.add(cockpit);
  // 顶部条状散热口
  for (let i = 0; i < 3; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x14181e, metalness: 0.8, roughness: 0.5 }));
    vent.position.set(0, 0.72, -0.5 - i * 0.45);
    g.add(vent);
  }
  // 机头两根超长白刺（原版标志特征）
  for (const s of [-1, 1]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 4.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d0, metalness: 0.7, roughness: 0.3 }));
    spike.rotation.x = Math.PI / 2;
    spike.position.set(s * 0.65, 0.05, 3.6);
    g.add(spike);
  }
  // 四片红色尾翼（X 形布局，向外张开）
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.3), red);
    fin.position.set(sx * 1.3, sy * 1.3, -2.0);
    fin.rotation.z = sx * sy * 0.78;      // 45° 斜置
    fin.rotation.y = sx * 0.25;           // 略后掠
    g.add(fin);
  }
  // 尾部引擎红光
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 8), emissiveMat(0xff4040));
  eng.rotation.x = Math.PI / 2;
  eng.position.set(0, 0, -2.9);
  g.add(eng);
  g.userData.radius = 3.2;
  return g;
}

// ---------- Boss: 皇帝安德罗斯（维诺姆）—— SF64 切面猿面，脸朝玩家 +z ----------
export function buildBossAndross() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: 0x9a7450, roughness: 0.85, metalness: 0.08, flatShading: true,
    emissive: 0x2a1808, emissiveIntensity: 0.5,
  });
  const skinDark = new THREE.MeshStandardMaterial({
    color: 0x6a4c30, roughness: 0.9, metalness: 0.05, flatShading: true,
    emissive: 0x1a0e04, emissiveIntensity: 0.5,
  });
  // 巨大切面头颅
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 1), skin);
  head.scale.set(1.12, 1.28, 0.95);
  g.add(head);
  // 颅顶棱冠
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 0), skinDark);
  crown.position.set(0, 13, -3);
  crown.scale.set(1.3, 0.7, 1.1);
  g.add(crown);
  // 粗眉骨（压向玩家 +z）
  const brow = new THREE.Mesh(new THREE.BoxGeometry(19, 3.6, 5), skinDark);
  brow.position.set(0, 6.2, 12.5);
  brow.rotation.x = 0.28;
  g.add(brow);
  // 双眼（弱点，发光）
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc20 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 12), eyeMat.clone());
    eye.position.set(s * 6.5, 2.5, 13.8);
    g.add(eye);
    eyes.push(eye);
    // 眼窝
    const socket = new THREE.Mesh(new THREE.SphereGeometry(3.9, 10, 10), skinDark);
    socket.position.set(s * 6.5, 2.5, 12.6);
    socket.scale.z = 0.6;
    g.add(socket);
  }
  // 鼻梁/吻部
  const snout = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 4.5), skin);
  snout.position.set(0, -2, 14);
  g.add(snout);
  // 嘴部空腔 + 核心（初始有护罩）
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  mouth.position.set(0, -8.5, 13.2);
  g.add(mouth);
  const mouthShield = new THREE.Mesh(new THREE.SphereGeometry(5.6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5, depthWrite: false }));
  mouthShield.position.copy(mouth.position);
  g.add(mouthShield);
  // 上下两排獠牙
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.5, flatShading: true });
  for (let i = -2; i <= 2; i++) {
    const up = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 1.2), toothMat);
    up.position.set(i * 2.0, -4.6, 14.2);
    g.add(up);
    const down = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 1.2), toothMat);
    down.position.set(i * 2.0, -12.4, 14.2);
    g.add(down);
  }
  // 两侧脸颊甲
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 7), skinDark);
    cheek.position.set(s * 15, 1, 2);
    cheek.rotation.y = s * -0.35;
    g.add(cheek);
  }
  // 双手（掌心 + 四根长手指 + 拇指，整体作为 Group 便于游戏逻辑摆动）
  const hands = [];
  for (const s of [-1, 1]) {
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 0), skin);
    palm.scale.set(0.9, 1.2, 1);
    hand.add(palm);
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 4.6), skin);
      finger.position.set((f - 1.5) * 1.7, 3.8, 2.6);
      finger.rotation.x = -0.25 - f * 0.06;
      hand.add(finger);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 2.2), skinDark);
      tip.position.set((f - 1.5) * 1.7, 4.6 + f * 0.28, 5.2);
      tip.rotation.x = -0.5;
      hand.add(tip);
    }
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 3.4), skin);
    thumb.position.set(s * -4.2, -1.5, 2.2);
    thumb.rotation.y = s * 0.6;
    hand.add(thumb);
    hand.position.set(s * 24, -6, -6);
    g.add(hand);
    hands.push(hand);
  }
  g.userData = { radius: 18, eyes, core: mouth, coreShield: mouthShield, hands };
  return g;
}

// ---------- 激光束 ----------
export function buildLaserBolt(color = 0x40ff90, len = 6, r = 0.14) {
  const geo = new THREE.CylinderGeometry(r, r, len, 6);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  const g = new THREE.Group();
  g.add(m);
  const c = new THREE.Color(color);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowSprite('#ffffff', `rgba(${(c.r*255)|0},${(c.g*255)|0},${(c.b*255)|0},0)`),
    transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(1.6, 1.6, 1);
  g.add(glow);
  return g;
}
