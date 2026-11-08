// 动效：炊烟、飞鸟
import * as THREE from 'three';
import { makeSmokeMaterial } from './materials.js';
import { smokeSpots } from './buildings.js';

export class Smoke {
  constructor(scene) {
    const perEmitter = 16;
    const n = smokeSpots.length * perEmitter;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    let k = 0;
    for (const [x, y, z] of smokeSpots) {
      for (let i = 0; i < perEmitter; i++) {
        pos[k * 3] = x + (Math.random() - 0.5) * 0.4;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
        seed[k] = Math.random();
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const points = new THREE.Points(geo, makeSmokeMaterial());
    points.frustumCulled = false;
    scene.add(points);
  }
  update() {}
}

export class Birds {
  constructor(scene) {
    // 三群飞鸟：绕圈滑翔的 V 形剪影
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -0.55, 0.08, 0,   -0.05, 0, 0.06,   -0.05, 0, -0.06,
       0.55, 0.08, 0,    0.05, 0, 0.06,    0.05, 0, -0.06,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a4136, side: THREE.DoubleSide });
    this.count = 22;
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.birds = [];
    const flocks = [
      { cx: 430, cz: -60, r: 55, h: 34 },
      { cx: 200, cz: 40, r: 70, h: 28 },
      { cx: 780, cz: -20, r: 65, h: 40 },
    ];
    for (let i = 0; i < this.count; i++) {
      const f = flocks[i % flocks.length];
      this.birds.push({
        f,
        a: Math.random() * Math.PI * 2,
        speed: 0.12 + Math.random() * 0.08,
        h: f.h + Math.random() * 8,
        r: f.r * (0.75 + Math.random() * 0.5),
        flap: Math.random() * 10,
        s: 0.8 + Math.random() * 0.7,
      });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  update(dt, t) {
    for (let i = 0; i < this.count; i++) {
      const b = this.birds[i];
      b.a += b.speed * dt * 2;
      b.flap += dt * (6 + Math.sin(t + i) * 2);
      const x = b.f.cx + Math.cos(b.a) * b.r;
      const z = b.f.cz + Math.sin(b.a) * b.r;
      const y = b.h + Math.sin(b.a * 3 + i) * 2.5;
      this._e.set(0, -b.a, Math.sin(b.flap) * 0.5);
      this._q.setFromEuler(this._e);
      this._v.set(x, y, z);
      this._s.set(b.s, b.s, b.s);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
