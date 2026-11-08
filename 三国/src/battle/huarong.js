// 赤壁之战 · 华容道模块 —— 乌林以西的泥泞小道：曹军残部弃船抢滩，
// 举火把、扛残旗的步兵纵队沿道蜿蜒北撤，渐行渐远没入夜雾
import * as THREE from 'three';
import { materials, makeRng, pennant } from '../materials.js';

const MAX_SOLDIERS = 70;

export function createHuarong(scene, env, effects) {
  const M = materials();
  const rng = makeRng(20215);
  const g = new THREE.Group();
  g.name = 'huarong';
  scene.add(g);

  const groundY = (x, z) => env.bankHeight(x, -z - env.RIVER.halfWidth, -1);

  // ---- 道路曲线（岸边登陆点 → 蜿蜒北上，出画没入雾中） ----
  const pts = [
    [-62, -84], [-68, -96], [-63, -108], [-72, -122], [-66, -134], [-73, -148],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  for (const p of pts) p.y = groundY(p.x, p.z);
  const curve = new THREE.CatmullRomCurve3(pts);
  const LEN = curve.getLength();

  // ---- 泥泞路面（沿曲线贴地的条带） ----
  {
    const N = 60, HALF = 1.7;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const idx = [];
    const p = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, tan);
      side.set(-tan.z, 0, tan.x).normalize();
      for (const s of [-1, 1]) {
        const x = p.x + side.x * HALF * s;
        const z = p.z + side.z * HALF * s;
        const o = (i * 2 + (s + 1) / 2) * 3;
        pos[o] = x; pos[o + 1] = groundY(x, z) + 0.09; pos[o + 2] = z;
      }
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: '#42362a', roughness: 1, side: THREE.DoubleSide,
    }));
    road.receiveShadow = true;
    g.add(road);
  }

  // ---- 道旁枯树（沼泽疏林，光杆斜立） ----
  {
    const trunkGeo = new THREE.CylinderGeometry(0.05, 0.12, 2.6, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#3e332a', roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 16);
    trunks.frustumCulled = false;
    const m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
    const v = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
    for (let i = 0; i < 16; i++) {
      const u = 0.06 + (i / 16) * 0.9;
      curve.getPointAt(u, v);
      curve.getTangentAt(u, tan);
      side.set(-tan.z, 0, tan.x).normalize();
      const lat = (2.6 + rng() * 3.5) * (i % 2 ? 1 : -1);
      const x = v.x + side.x * lat, z = v.z + side.z * lat;
      const s = 0.7 + rng() * 0.9;
      e.set((rng() - 0.5) * 0.24, rng() * Math.PI, (rng() - 0.5) * 0.24);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, groundY(x, z) + 1.2 * s, z), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m4);
    }
    g.add(trunks);
  }

  // ---- 行军纵队（InstancedMesh：披甲身躯 / 头 / 长矛 / 火把） ----
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#2b2e36', roughness: 0.95 });
  const bodies = new THREE.InstancedMesh(new THREE.ConeGeometry(0.24, 1.0, 5), bodyMat, MAX_SOLDIERS);
  const heads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.12, 6, 5),
    new THREE.MeshStandardMaterial({ color: '#8a7458', roughness: 0.9 }),
    MAX_SOLDIERS
  );
  const spears = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.9, 4),
    new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1 }),
    MAX_SOLDIERS
  );
  // 火把头：HDR 颜色，泛光管线中自发亮
  const torches = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.07, 6, 5),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a35').multiplyScalar(2) }),
    MAX_SOLDIERS
  );
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const im of [bodies, heads, spears, torches]) {
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_SOLDIERS; i++) im.setMatrixAt(i, ZERO);
    g.add(im);
  }

  // 士兵状态（预分配）
  const sArr = new Float32Array(MAX_SOLDIERS);      // 已行进弧长
  const spd = new Float32Array(MAX_SOLDIERS);
  const lat = new Float32Array(MAX_SOLDIERS);       // 横向散布
  const bob = new Float32Array(MAX_SOLDIERS);       // 步伐相位
  const scl = new Float32Array(MAX_SOLDIERS);
  const hasTorch = new Uint8Array(MAX_SOLDIERS);
  const hasSpear = new Uint8Array(MAX_SOLDIERS);
  for (let i = 0; i < MAX_SOLDIERS; i++) {
    spd[i] = 1.4 + rng() * 0.9;
    lat[i] = (rng() * 2 - 1) * 1.0;
    bob[i] = rng() * 6.28;
    scl[i] = 0.85 + rng() * 0.3;
    hasTorch[i] = rng() < 0.28 ? 1 : 0;
    hasSpear[i] = rng() < 0.6 ? 1 : 0;
  }

  // ---- 两杆残旗（破幡，由纵队中的旗手扛行） ----
  const bannerCarriers = [6, 30];
  const bannerGroups = bannerCarriers.map(() => {
    const bg = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 2.3, 5), M.darkWood);
    pole.position.y = 1.15;
    const flagMat = new THREE.MeshStandardMaterial({ color: '#262a33', roughness: 0.95, side: THREE.DoubleSide });
    const flag = pennant(0.85, 0.45, flagMat, true);   // 燕尾残旗
    flag.position.set(0.02, 1.85, 0);
    bg.add(pole, flag);
    bg.visible = false;
    g.add(bg);
    return bg;
  });

  // ---- 随行火把光（常驻一盏，未启用时熄灭，灯光总数恒定） ----
  const torchLight = new THREE.PointLight('#ff9a4a', 0, 34, 1.7);
  torchLight.position.set(-64, 4, -100);
  g.add(torchLight);

  // ---- 行军调度状态 ----
  let started = false;
  let delay = 0;
  let spawned = 0;
  let spawnT = 0;

  const _p = new THREE.Vector3(), _tan = new THREE.Vector3(), _side = new THREE.Vector3();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const _sv = new THREE.Vector3();

  /** 弃船登岸开始（delaySec 后前锋踏上小道） */
  function begin(delaySec = 9) {
    if (started) return;
    started = true;
    delay = delaySec;
  }

  function update(dt, t) {
    if (!started) return;
    if (delay > 0) { delay -= dt; return; }

    // 陆续登岸入列
    spawnT -= dt;
    while (spawnT <= 0 && spawned < MAX_SOLDIERS) {
      spawned++;
      spawnT += 0.45;
    }

    let tx = 0, ty = 0, tz = 0, tn = 0;   // 火把位置均值（灯光跟随）
    for (let i = 0; i < spawned; i++) {
      sArr[i] += spd[i] * dt;
      const u = sArr[i] / LEN;
      if (u >= 1) {   // 走完全程：没入远方
        bodies.setMatrixAt(i, ZERO);
        heads.setMatrixAt(i, ZERO);
        spears.setMatrixAt(i, ZERO);
        torches.setMatrixAt(i, ZERO);
        continue;
      }
      curve.getPointAt(u, _p);
      curve.getTangentAt(u, _tan);
      _side.set(-_tan.z, 0, _tan.x).normalize();
      const sway = lat[i] + Math.sin(t * 1.8 + bob[i]) * 0.08;
      const x = _p.x + _side.x * sway;
      const z = _p.z + _side.z * sway;
      const y = groundY(x, z) + Math.abs(Math.sin(t * 5.4 + bob[i])) * 0.05;
      // 入列淡入 + 道尽头淡出（尺度收缩，远端没入雾色）
      const k = Math.min(u * LEN / 4, 1) * Math.min((1 - u) * LEN / 7, 1);
      const sc = scl[i] * THREE.MathUtils.clamp(k, 0, 1);
      if (sc <= 0.01) { bodies.setMatrixAt(i, ZERO); heads.setMatrixAt(i, ZERO); spears.setMatrixAt(i, ZERO); torches.setMatrixAt(i, ZERO); continue; }

      _q.identity();
      _sv.set(sc, sc, sc);
      _m4.compose(_p.set(x, y + 0.5 * sc, z), _q, _sv);
      bodies.setMatrixAt(i, _m4);
      _m4.compose(_p.set(x, y + 1.06 * sc, z), _q, _sv);
      heads.setMatrixAt(i, _m4);
      if (hasSpear[i]) {
        _e.set(0.1, 0, Math.sin(bob[i]) * 0.08);
        _q.setFromEuler(_e);
        _m4.compose(_p.set(x + _side.x * 0.2 * sc, y + 0.98 * sc, z + _side.z * 0.2 * sc), _q, _sv);
        spears.setMatrixAt(i, _m4);
      }
      if (hasTorch[i]) {
        const fx = x + Math.sin(t * 3.1 + bob[i]) * 0.05;
        const fz = z + Math.cos(t * 2.7 + bob[i]) * 0.05;
        _q.identity();
        _m4.compose(_p.set(fx, y + 1.52 * sc, fz), _q, _sv);
        torches.setMatrixAt(i, _m4);
        tx += fx; ty += y + 1.52 * sc; tz += fz; tn++;
        // 火把偶尔溅出火星
        if (Math.random() < dt * 1.5) {
          effects.spark.spawn(fx, y + 1.55 * sc, fz,
            (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6,
            { life: 0.3 + Math.random() * 0.3, size: 0.07, grav: 1.2, drag: 0.4, wind: 0.8, r: 1, g: 0.6, b: 0.15, a: 0.9 });
        }
      }
      // 旗手：残旗跟随
      const bi = bannerCarriers.indexOf(i);
      if (bi >= 0) {
        const bg = bannerGroups[bi];
        bg.visible = true;
        bg.position.set(x, y, z);
        bg.scale.setScalar(sc);
        bg.rotation.y = Math.atan2(_tan.x, _tan.z) + Math.sin(t * 1.5 + bi * 2) * 0.15;
      }
    }
    for (const im of [bodies, heads, spears, torches]) im.instanceMatrix.needsUpdate = true;
    for (let bi = 0; bi < bannerCarriers.length; bi++) {
      const u = sArr[bannerCarriers[bi]] / LEN;
      if (bannerCarriers[bi] >= spawned || u >= 1) bannerGroups[bi].visible = false;
    }

    // 火把灯光：跟随火把群心，摇曳；纵队走尽则熄灭
    if (tn > 0) {
      torchLight.position.set(tx / tn, ty / tn + 1.2, tz / tn);
      torchLight.intensity = 3.2 * (0.85 + 0.15 * Math.sin(t * 12.3) * Math.sin(t * 7.7 + 2));
    } else {
      torchLight.intensity = Math.max(0, torchLight.intensity - dt * 2);
    }
  }

  return { group: g, begin, update };
}
