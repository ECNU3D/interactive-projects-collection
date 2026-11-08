// 方块粒子系统（设计文档 §13：统一用方块粒子保持体素风）
// 单个 THREE.Points 池，方形点精灵 + 顶点色
const MAX = 2048;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(MAX * 3);
    this.colArr = new Float32Array(MAX * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pool = [];   // {x,y,z,vx,vy,vz,life,maxLife,r,g,b,gravity}
    this.c = new THREE.Color();
  }

  spawn(x, y, z, opts = {}) {
    const n = opts.count || 8;
    for (let i = 0; i < n; i++) {
      if (this.pool.length >= MAX) this.pool.shift();
      this.c.set(opts.color ?? 0xffffff);
      const spread = opts.spread ?? 1.6;
      const up = opts.up ?? 2.2;
      // 颜色抖动
      const jj = 0.85 + Math.random() * 0.3;
      this.pool.push({
        x: x + (Math.random() - 0.5) * (opts.area ?? 0.3),
        y: y + (Math.random() - 0.5) * (opts.area ?? 0.3),
        z: z + (Math.random() - 0.5) * (opts.area ?? 0.3),
        vx: (Math.random() - 0.5) * spread,
        vy: Math.random() * up + (opts.upBase ?? 0),
        vz: (Math.random() - 0.5) * spread,
        life: 0, maxLife: (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        r: Math.min(1, this.c.r * jj), g: Math.min(1, this.c.g * jj), b: Math.min(1, this.c.b * jj),
        gravity: opts.gravity ?? 5,
      });
    }
  }

  update(dt) {
    const alive = [];
    for (const p of this.pool) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      alive.push(p);
    }
    this.pool = alive;
    for (let i = 0; i < MAX; i++) {
      const p = alive[i];
      if (p) {
        this.posArr[i * 3] = p.x; this.posArr[i * 3 + 1] = p.y; this.posArr[i * 3 + 2] = p.z;
        const fade = 1 - p.life / p.maxLife;
        this.colArr[i * 3] = p.r * fade; this.colArr[i * 3 + 1] = p.g * fade; this.colArr[i * 3 + 2] = p.b * fade;
      } else {
        this.posArr[i * 3 + 1] = -9999;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// 常用爆发配方
export function burstHit(particles, pos, color) {
  particles.spawn(pos.x, pos.y + 0.6, pos.z, { color, count: 14, spread: 3.2, up: 3, life: 0.5 });
}
export function burstHeal(particles, pos) {
  particles.spawn(pos.x, pos.y + 0.8, pos.z, { color: 0x7AEF7A, count: 16, spread: 1, up: 2.4, life: 0.9, gravity: -1 });
}
export function burstStars(particles, pos, count = 24) {
  particles.spawn(pos.x, pos.y + 1, pos.z, { color: 0xFCDC5F, count, spread: 4, up: 4.5, life: 1.1, gravity: 3 });
}
export function burstSmoke(particles, pos) {
  particles.spawn(pos.x, pos.y + 0.5, pos.z, { color: 0xBBBBBB, count: 18, spread: 2, up: 1.8, life: 0.8, gravity: -0.5 });
}
