// 船舶公共构件：放样船壳 / 桨 / 舵 / 桅帆 / 索具
import * as THREE from 'three';
import { materials, cylBetween } from '../materials.js';

/**
 * 放样木船壳：平底、两舷外张、首尾起翘
 * x 轴为船长方向（-L/2 尾, +L/2 首），z 为船宽方向
 */
export function loftedHull({
  length = 10, beam = 2.4, depth = 1.0,
  bowRise = 0.55, sternRise = 0.25,      // 起翘（甲板线）
  bowKeelRise = 0.3, sternKeelRise = 0.1, // 龙骨线起翘
  sternWidth = 0.55, bowWidth = 0.22,     // 端部宽度比例
  flare = 0.35, mat, sections = 28, vseg = 10,
}) {
  const M = mat || materials().hullWood;
  const halfW = (t) => {
    const bulge = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.92)), 0.72);
    const endW = sternWidth + (bowWidth - sternWidth) * t;
    // 船首端强制收拢闭合（末端 3% 区段急剧收尖）
    const bowTaper = 1 - 0.97 * THREE.MathUtils.smoothstep(t, 0.97, 1);
    return (beam / 2) * (endW + (1 - endW) * bulge) * bowTaper;
  };
  const rise = (t, amp, from) => amp * Math.pow(THREE.MathUtils.smoothstep(t, from, 1), 2);
  const sheerY = (t) => depth + rise(t, bowRise, 0.62) + rise(1 - t, sternRise, 0.62);
  const keelY = (t) => rise(t, bowKeelRise, 0.7) + rise(1 - t, sternKeelRise, 0.7);

  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const x = -length / 2 + length * t;
    const W = Math.max(halfW(t), 0.02);
    const ky = keelY(t), sy = sheerY(t);
    const Wb = W * (1 - flare); // 平底半宽
    for (let j = 0; j <= vseg; j++) {
      const u = j / vseg;
      let y, z;
      if (u < 0.25) {          // 左舷
        const s = u / 0.25;
        z = -W + (W - Wb) * s * s;  y = sy + (ky - sy) * s;
      } else if (u <= 0.75) {  // 船底
        const s = (u - 0.25) / 0.5;
        z = -Wb + 2 * Wb * s;       y = ky;
      } else {                 // 右舷
        const s = (u - 0.75) / 0.25;
        z = Wb + (W - Wb) * (1 - (1 - s) * (1 - s)); y = ky + (sy - ky) * s;
      }
      positions.push(x, y, z);
      uvs.push(t * 4, u);
    }
  }
  const row = vseg + 1;
  for (let i = 0; i < sections; i++)
    for (let j = 0; j < vseg; j++) {
      const a = i * row + j, b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const hull = new THREE.Mesh(geo, M);
  hull.name = 'hull';
  hull.userData = { length, beam, depth, sheerY, halfW };

  // 尾封板（方阔船尾）
  const stern = new THREE.Mesh(new THREE.BoxGeometry(0.1, depth * 0.9, beam * sternWidth * 0.98), M);
  stern.position.set(-length / 2 + 0.02, (keelY(0) + sheerY(0)) / 2 - depth * 0.02, 0);
  hull.add(stern);
  // 首柱（包住船首接缝并起翘，汉船典型构件）
  const stemH = (sheerY(1) - keelY(1)) * 1.28;
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.09, stemH, 0.09), M);
  stem.position.set(length / 2 - 0.04, keelY(1) + stemH / 2 - 0.1, 0);
  stem.rotation.z = 0.16;
  hull.add(stem);
  return hull;
}

/** 甲板（含两舷压条） */
export function deck(hull, mat, inset = 0.94) {
  const { length, depth, halfW, sheerY } = hull.userData;
  const M = mat || materials().deckWood;
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = -length / 2 + length * t;
    const w = halfW(t) * inset;
    i === 0 ? shape.moveTo(x, -w) : shape.lineTo(x, -w);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N, x = -length / 2 + length * t;
    shape.lineTo(x, halfW(t) * inset);
  }
  const geo = new THREE.ShapeGeometry(shape);
  const d = new THREE.Mesh(geo, M);
  d.rotation.x = -Math.PI / 2;
  d.position.y = depth * 0.82;
  g.add(d);
  // 舷缘压条
  const capMat = materials().darkWood;
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(new THREE.Vector3(-length / 2 + length * t, sheerY(t) + 0.02, side * halfW(t) * 0.985));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.045, 5), capMat);
    g.add(tube);
  }
  return g;
}

/** 单支桨（桨杆 + 扁桨叶；桨叶朝 -y，即入水端在下） */
export function oar(len = 2.4, mat) {
  const M = mat || materials().paleWood;
  const g = new THREE.Group();
  g.name = 'oar';   // 供战场模块检索做划桨动画
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, len * 0.72, 6), M);
  shaft.position.y = -len * 0.36;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, len * 0.3, 0.14), M);
  blade.position.y = -len * 0.86;
  g.add(shaft, blade);
  return g;
}

/** 尾舵（舵杆 + 大叶舵板 + 舵柄） */
export function rudder(h = 1.8, mat) {
  const M = mat || materials().darkWood;
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 6), M);
  post.position.y = -h / 2;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.62, 0.42), M);
  blade.position.set(-0.02, -h * 0.62, 0.14);
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.9, 5), M);
  tiller.rotation.z = Math.PI / 2 - 0.35;
  tiller.position.set(0.42, 0.16, 0);
  g.add(post, blade, tiller);
  return g;
}

/** 桅杆 + 矩形织物帆（含上下桁、竹骨、帆面微弯） */
export function mastSail({ mastH = 4.5, sailW = 2.6, sailH = 2.6, mat, sailMat, battens = 6, y = 0 } = {}) {
  const M = mat || materials().darkWood;
  const g = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, mastH, 8), M);
  mast.position.y = mastH / 2;
  g.add(mast);
  const topY = mastH * 0.86, botY = topY - sailH;
  // 上桁（带绳索缠绕感：两端略出）
  const yardT = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, sailW * 1.12, 7), M);
  yardT.rotation.z = Math.PI / 2; yardT.position.y = topY;
  const yardB = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, sailW * 1.05, 7), M);
  yardB.rotation.z = Math.PI / 2; yardB.position.y = botY;
  g.add(yardT, yardB);
  // 帆面：横向分节微弯
  const geo = new THREE.PlaneGeometry(sailW, sailH, 12, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
    pos.setZ(i, Math.sin((py / sailH + 0.5) * Math.PI) * 0.12 + Math.cos(px / sailW * Math.PI) * 0.06);
  }
  geo.computeVertexNormals();
  const sail = new THREE.Mesh(geo, sailMat || materials().sail);
  sail.position.y = (topY + botY) / 2;
  g.add(sail);
  // 竹骨
  for (let b = 1; b < battens; b++) {
    const yb = botY + (sailH * b) / battens;
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, sailW * 1.02, 5), M);
    bat.rotation.z = Math.PI / 2;
    bat.position.set(0, yb, 0.03 + Math.sin((yb / sailH) * Math.PI) * 0.1);
    g.add(bat);
  }
  g.position.y = y;
  return g;
}

/** 卷起的帆（帆桁上捆扎的布卷） */
export function furledSail({ mastH = 3.2, w = 2.4, mat, clothMat, y = 0 } = {}) {
  const M = mat || materials().darkWood;
  const g = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, mastH, 8), M);
  mast.position.y = mastH / 2;
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, w * 1.1, 7), M);
  yard.rotation.z = Math.PI / 2;
  yard.position.y = mastH * 0.82;
  // 布卷：多节椭球
  const CM = clothMat || materials().sail;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), CM);
    s.scale.set(1.6, 0.75, 0.9);
    s.position.set(-w / 2 + (w * (i + 0.5)) / segs, mastH * 0.79, 0);
    g.add(s);
  }
  g.add(mast, yard);
  g.position.y = y;
  return g;
}

/** 桅顶旗杆 + 燕尾旗 */
export function mastFlag(h = 0.8, w = 0.85, mat) {
  const M = mat || materials().flagRed;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 5), materials().darkWood);
  pole.position.y = h / 2;
  const flagGeo = new THREE.PlaneGeometry(w, 0.28, 8, 2);
  const pos = flagGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin(x * 6) * 0.05 * (x / w + 0.5));
    if (x > w * 0.25) pos.setY(i, pos.getY(i) * (1 - (x / w + 0.5) * 0.4) + ((i % 2) ? -0.02 : 0.02));
  }
  flagGeo.computeVertexNormals();
  const flag = new THREE.Mesh(flagGeo, M);
  flag.position.set(w / 2 + 0.02, h - 0.2, 0);
  g.add(pole, flag);
  return g;
}

/** 简单索具 */
export function rigging(points, mat, r = 0.012) {
  const M = mat || materials().rope;
  const g = new THREE.Group();
  for (const [a, b] of points) g.add(cylBetween(new THREE.Vector3(...a), new THREE.Vector3(...b), r, M, 4));
  return g;
}

/** 舷侧桨组 */
export function oarBank(hull, count, { oarLen = 2.2, y = null, angle = 0.62, side = 1, mat } = {}) {
  const { length, depth, halfW } = hull.userData;
  const g = new THREE.Group();
  const oy = y ?? depth * 0.62;
  for (let i = 0; i < count; i++) {
    const t = 0.18 + (0.64 * i) / (count - 1);
    const x = -length / 2 + length * t;
    const o = oar(oarLen, mat);
    o.position.set(x, oy, side * (halfW(t) * 0.92));
    // 桨叶朝下并向舷外斜伸出水
    o.rotation.x = side > 0 ? -angle : angle;
    o.rotation.y = side > 0 ? -0.12 : 0.12;
    g.add(o);
    // 桨孔
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), materials().ironDark);
    port.position.set(x, oy, side * (halfW(t) * 0.97));
    g.add(port);
  }
  return g;
}

/** 小艇（走舸） */
export function smallBoat(len = 2.2, mat) {
  const g = new THREE.Group();
  const hull = loftedHull({ length: len, beam: len * 0.32, depth: len * 0.16, bowRise: 0.18, sternRise: 0.14, bowKeelRise: 0.1, sternKeelRise: 0.08, mat, sections: 14, vseg: 6 });
  g.add(hull, deck(hull, mat, 0.9));
  // 舱横梁
  for (let i = -1; i <= 1; i++) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, len * 0.26), mat);
    bench.position.set(i * len * 0.25, len * 0.13, 0);
    g.add(bench);
  }
  return g;
}
