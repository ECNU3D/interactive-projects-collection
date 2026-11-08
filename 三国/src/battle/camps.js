// 赤壁之战 · 两岸营寨模块 —— 曹军乌林水寨（北岸）与孙刘联军营寨（南岸）
// 复用 models 下的营门楼橹/木栅/仓棚/帷帐/栈桥，配军旗、火盆（夜间篝火光源）
import * as THREE from 'three';
import { materials, makeRng } from '../materials.js';
import { createWatchtower, palisade } from '../models/watchtower.js';
import { lowShed, tarpTent, jetty } from '../models/chibiScene.js';

// 营旗贴图（与舰队幡旗同风格：底色 + 描边 + 大字）
function campBannerTexture(char, color, ink) {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 144;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 96, 144);
  ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.strokeRect(5, 5, 86, 134);
  ctx.fillStyle = ink;
  ctx.font = 'bold 64px "Kaiti SC", "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(char, 48, 76);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 高杆军旗（幡杆 + 布幡），返回含 banner 引用的组（供拂动动画） */
function campBanner(char, color, ink, M) {
  const g = new THREE.Group();
  const poleH = 4.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, poleH, 6), M.darkWood);
  pole.position.y = poleH / 2;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.65),
    new THREE.MeshStandardMaterial({ map: campBannerTexture(char, color, ink), roughness: 0.95, side: THREE.DoubleSide })
  );
  banner.position.set(0.02, poleH - 1.0, 0.06);
  g.add(pole, banner);
  g.userData.banner = banner;
  pole.castShadow = true;
  return g;
}

/** 火盆（石座铜盆 + HDR 炭火芯，火焰粒子由 effects 驱动） */
function brazier(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.35, 8), M.stone);
  base.position.y = 0.18;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 0.4, 10), M.ironDark);
  bowl.position.y = 0.55;
  // 炭火芯：HDR 颜色（>1）在泛光管线中自发光
  const coalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a35').multiplyScalar(1.8) });
  const coal = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 7), coalMat);
  coal.scale.y = 0.5;
  coal.position.y = 0.72;
  g.add(base, bowl, coal);
  base.castShadow = bowl.castShadow = true;
  return g;
}

export function createCamps(scene, env, effects) {
  const M = materials();
  const rng = makeRng(20208);
  const group = new THREE.Group();
  group.name = 'camps';
  scene.add(group);

  const banners = [];
  const lights = [];

  // 岸上放置：按到水线距离取地形高度（北岸 side=-1，z=-(85+d)；南岸 side=+1，z=85+d）
  const groundY = (x, z) => {
    const side = z > 0 ? 1 : -1;
    const d = Math.abs(z) - env.RIVER.halfWidth;
    return env.bankHeight(x, d, side);
  };
  const put = (obj, x, z, ry = 0, sink = 0.05) => {
    obj.position.set(x, groundY(x, z) - sink, z);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  };

  // ---------- 北岸 · 曹军乌林水寨（大营，正对江面） ----------
  {
    const gate = createWatchtower();
    gate.scale.setScalar(1.25);
    put(gate, 0, -96, 0, 0.1);          // 门面朝 +z（江面）

    // 门两翼木栅墙（沿岸线一字排开，微角度错落）
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const seg = palisade(10, 2.0, M);
        put(seg, s * (10.4 + i * 9.6), -96 - i * 0.8, s * -(0.06 + i * 0.03));
      }
      // 侧墙折向内陆
      for (let i = 0; i < 2; i++) {
        const seg = palisade(10, 2.0, M);
        put(seg, s * 47, -103 - i * 9.4, Math.PI / 2 + s * 0.08);
      }
    }

    // 营内仓棚 / 帷帐（乌林大营连绵）
    const sheds = [[-30, -106, 0.2], [-16, -110, -0.15], [-2, -107, 0.3], [14, -111, -0.3], [28, -106, 0.15]];
    for (const [x, z, ry] of sheds) put(lowShed(3.2 + rng() * 1.6, M), x, z, ry);
    const tents = [[-36, -112, 0.5], [-9, -114, -0.2], [7, -115, 0.4], [22, -116, -0.5], [36, -111, 0.2]];
    for (const [x, z, ry] of tents) put(tarpTent(2.2 + rng() * 0.8, M), x, z, ry);

    // 军旗：魏（玄黑底浅字）
    for (const [x, z] of [[-6.5, -93], [6.5, -93], [-24, -99], [24, -99], [0, -112]]) {
      const b = campBanner('魏', '#262a33', '#d8d4c8', M);
      put(b, x, z, rng() * 0.6 - 0.3, 0);
      banners.push(b);
    }

    // 栈桥伸入江面（连接水寨前沿）
    for (const x of [-28, 6, 30]) {
      const p = jetty(11 + rng() * 3, M);
      p.position.set(x, 0.12, -86.5);
      p.rotation.y = Math.PI + (rng() - 0.5) * 0.16;   // 桥面伸向 +z（江心）
      group.add(p);
    }

    // 火盆（营门与栈桥头，入夜篝火）
    for (const [x, z] of [[-9, -91.5], [9, -91.5], [-28, -99], [28, -99]]) {
      const br = brazier(M);
      put(br, x, z, 0, 0);
      effects.igniteShip(br, [new THREE.Vector3(0, 0.75, 0)], 0.3);
    }

    // 营地暖光（常燃，夜里成为北岸光池）
    const l = new THREE.PointLight('#ff9a4a', 2.4, 60, 1.6);
    l.position.set(0, groundY(0, -96) + 7, -96);
    group.add(l);
    lights.push({ light: l, base: 2.4, seed: 1.7 });
  }

  // ---------- 南岸 · 孙刘联军营寨（依赤壁东侧坡地） ----------
  {
    const gate = createWatchtower();
    gate.scale.setScalar(1.1);
    put(gate, 38, 97, Math.PI, 0.1);    // 门面朝 -z（江面）

    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const seg = palisade(9, 1.9, M);
        put(seg, 38 + s * (9.4 + i * 8.6), 97 + i * 0.7, s * (0.05 + i * 0.04));
      }
    }
    // 侧墙
    for (const s of [-1, 1]) {
      const seg = palisade(9, 1.9, M);
      put(seg, 38 + s * 34, 104, Math.PI / 2 - s * 0.1);
    }

    const sheds = [[26, 106, 0.25], [40, 108, -0.2], [52, 105, 0.35]];
    for (const [x, z, ry] of sheds) put(lowShed(3.0 + rng() * 1.2, M), x, z, ry);
    const tents = [[20, 111, 0.5], [34, 113, -0.3], [48, 112, 0.3], [60, 108, -0.4]];
    for (const [x, z, ry] of tents) put(tarpTent(2.0 + rng() * 0.8, M), x, z, ry);

    // 军旗：吴（青绿）为主，东翼一杆汉（绛红）
    for (const [x, z, f] of [[32, 94, 'wu'], [44, 94, 'wu'], [24, 102, 'wu'], [58, 100, 'shu']]) {
      const b = f === 'wu'
        ? campBanner('吴', '#274d31', '#e8e0c8', M)
        : campBanner('漢', '#6e241c', '#f0e6cc', M);
      put(b, x, z, rng() * 0.6 - 0.3, 0);
      banners.push(b);
    }

    for (const x of [28, 50]) {
      const p = jetty(10 + rng() * 3, M);
      p.position.set(x, 0.12, 86.5);
      p.rotation.y = (rng() - 0.5) * 0.16;             // 桥面伸向 -z（江心）
      group.add(p);
    }

    for (const [x, z] of [[33, 93], [43, 93], [55, 102]]) {
      const br = brazier(M);
      put(br, x, z, 0, 0);
      effects.igniteShip(br, [new THREE.Vector3(0, 0.75, 0)], 0.28);
    }

    const l = new THREE.PointLight('#ff9a4a', 2.0, 52, 1.6);
    l.position.set(38, groundY(38, 97) + 6.5, 97);
    group.add(l);
    lights.push({ light: l, base: 2.0, seed: 4.9 });
  }

  // ---------- 每帧：军旗拂动 + 篝火光摇曳 ----------
  function update(dt, t) {
    const w = env.getWind().length();
    for (let i = 0; i < banners.length; i++) {
      const b = banners[i].userData.banner;
      b.rotation.y = Math.sin(t * (1.8 + w * 0.4) + i * 1.3) * 0.2 * (0.4 + Math.min(w, 8) * 0.12);
    }
    for (const e of lights) {
      e.light.intensity = e.base * (0.85 + 0.15 * Math.sin(t * 11 + e.seed) * Math.sin(t * 6.3 + e.seed * 2.1));
    }
  }

  return { group, update };
}
