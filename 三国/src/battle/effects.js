// 赤壁之战 · 战争特效引擎
// ------------------------------------------------------------------
// 设计要点（借鉴 LinearAbilityCastingThreeJS 的思路，按本战役规模简化）：
//  - 全部粒子贴图由 Canvas 程序化生成（径向渐变），不使用任何外部贴图
//  - 粒子系统 = THREE.Points + 预分配环形缓冲池，CPU 维护每粒子 pos/vel/life/size，
//    死亡槽位 aSize 置 0，循环时 early-skip，运行期不 new 任何对象
//  - 火焰/火星用加法混合，浓烟/水花用普通透明混合
//  - 灯光池：预创建 6 盏 PointLight 停放（intensity 0），按需分配给最大的火源/爆炸，
//    避免增删灯光导致着色器重编译；池满时新火源静默跳过
//  - 性能预算：粒子池总容量 5800（≤6000），同时在飞箭矢 ≤200，箭矢池 800
// ------------------------------------------------------------------
import * as THREE from 'three';
import { makeRng } from '../materials.js';

// ---------- 常量 ----------
const GRAV_ARROW = 9.8 * 0.35;   // 箭矢弹道重力（缩放世界）
const ARROW_CAP = 800;           // 箭矢 InstancedMesh 池容量
const MAX_FLYING = 200;          // 同时在飞箭矢上限
const LIGHT_POOL_SIZE = 8;       // 灯光池大小
const RING_CAP = 8;              // 水面冲击环池容量
const FLAME_CAP = 2000;          // 火焰粒子池（加法）
const SMOKE_CAP = 1800;          // 浓烟粒子池（普通透明）
const SPARK_CAP = 1200;          // 火星粒子池（加法）
const WATER_CAP = 800;           // 水花/浪花粒子池（普通透明）
const RNG_SEED = 20260822;       // 确定性随机种子

// ---------- Canvas 程序化粒子贴图 ----------
function makeCanvasTexture(size, painter) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  painter(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 火焰：白黄芯 → 橙 → 透明（自带颜色，顶点色仅作透明度/微调）
function flameTexture() {
  return makeCanvasTexture(64, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0.0, 'rgba(255,246,214,1)');
    g.addColorStop(0.25, 'rgba(255,196,80,0.95)');
    g.addColorStop(0.55, 'rgba(255,110,26,0.55)');
    g.addColorStop(1.0, 'rgba(180,40,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  });
}

// 浓烟：白色软团（多块径向渐变叠出絮状），实际灰度由顶点色决定
function smokeTexture() {
  return makeCanvasTexture(128, (ctx, S) => {
    const rng = makeRng(99);
    for (let i = 0; i < 9; i++) {
      const x = S / 2 + (rng() - 0.5) * S * 0.36;
      const y = S / 2 + (rng() - 0.5) * S * 0.36;
      const r = S * (0.16 + rng() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    // 整体径向衰减，避免方块边缘
    ctx.globalCompositeOperation = 'destination-in';
    const m = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(0.7, 'rgba(0,0,0,0.9)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, S, S);
  });
}

// 火星：亮点带辉光（白色，顶点色染橙）
function sparkTexture() {
  return makeCanvasTexture(32, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  });
}

// 水花：白色软点
function splashTexture() {
  return makeCanvasTexture(32, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(235,244,250,0.5)');
    g.addColorStop(1, 'rgba(235,244,250,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  });
}

// 粒子着色器：每粒子尺寸/颜色（含透明度），aSize=0 即丢弃
const POINT_VERT = /* glsl */`
  attribute float aSize;
  attribute vec4 aColor;
  varying vec4 vColor;
  uniform float uScale;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const POINT_FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying vec4 vColor;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vColor * tex;
    if (gl_FragColor.a < 0.004) discard;
  }
`;

function pointsMaterial(map, blending) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uScale: { value: 800 } },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite: false,
    blending,
  });
}

// ---------- 粒子环形缓冲池 ----------
class PointPool {
  constructor(scene, cap, material) {
    this.cap = cap;
    this.head = 0;      // 环形写入指针（满了覆盖最旧粒子）
    this.alive = 0;
    // 每粒子 CPU 状态
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4); // rgb 出生写入，alpha 每帧更新
    this.sizeAttr = new Float32Array(cap);
    this.life = new Float32Array(cap);    // 剩余寿命，<=0 为空闲
    this.maxLife = new Float32Array(cap);
    this.baseSize = new Float32Array(cap);
    this.grow = new Float32Array(cap);    // 尺寸增长速度（世界单位/秒）
    this.grav = new Float32Array(cap);    // 重力加速度（向下为正）
    this.drag = new Float32Array(cap);    // 阻力系数（/秒）
    this.windK = new Float32Array(cap);   // 受风系数
    this.baseA = new Float32Array(cap);   // 基础透明度

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr_ = new THREE.BufferAttribute(this.sizeAttr, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr_);
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  // 生成一个粒子（全部池预分配，这里只写数组）
  spawn(x, y, z, vx, vy, vz, o) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    if (this.life[i] <= 0) this.alive++;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i4] = o.r; this.col[i4 + 1] = o.g; this.col[i4 + 2] = o.b; this.col[i4 + 3] = o.a;
    this.life[i] = this.maxLife[i] = o.life;
    this.baseSize[i] = o.size;
    this.grow[i] = o.grow || 0;
    this.grav[i] = o.grav || 0;
    this.drag[i] = o.drag || 0;
    this.windK[i] = o.wind || 0;
    this.baseA[i] = o.a;
    this.sizeAttr[i] = o.size;
  }

  update(dt, wind) {
    if (this.alive === 0) return;
    const { pos, vel, col, life, maxLife, baseSize, grow, grav, drag, windK, baseA, sizeAttr } = this;
    const wx = wind.x, wy = wind.y, wz = wind.z;
    for (let i = 0; i < this.cap; i++) {
      if (life[i] <= 0) continue; // early-skip 空闲槽
      life[i] -= dt;
      const i3 = i * 3, i4 = i * 4;
      if (life[i] <= 0) { // 死亡：尺寸置 0 即不再渲染
        sizeAttr[i] = 0;
        col[i4 + 3] = 0;
        this.alive--;
        continue;
      }
      // 阻力 + 重力 + 风漂移
      const d = Math.max(0, 1 - drag[i] * dt);
      vel[i3] = vel[i3] * d + wx * windK[i] * dt;
      vel[i3 + 1] = (vel[i3 + 1] - grav[i] * dt) * d + wy * windK[i] * dt;
      vel[i3 + 2] = vel[i3 + 2] * d + wz * windK[i] * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      // 透明度：出生淡入 + 消亡淡出；尺寸随年龄增长
      const f = life[i] / maxLife[i];
      const fade = Math.min((1 - f) * 8, 1) * Math.min(f * 5, 1);
      col[i4 + 3] = baseA[i] * fade;
      sizeAttr[i] = baseSize[i] + grow[i] * (maxLife[i] - life[i]);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr_.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.sizeAttr.fill(0);
    this.head = 0;
    this.alive = 0;
    this.colAttr.needsUpdate = true;
    this.sizeAttr_.needsUpdate = true;
  }
}

// ---------- 灯光池 ----------
// 预创建 N 盏 PointLight 停放（intensity 0），acquire/release 只改参数不增删灯，
// 避免 three 因灯光数量变化重编译全部着色器；池满 acquire 返回 null（静默跳过）。
class LightPool {
  constructor(scene, n) {
    this.free = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xff7722, 0, 45, 2);
      l.position.set(0, -999, 0); // 停放在地下
      scene.add(l);
      this.free.push(l);
    }
  }
  acquire(color) {
    const l = this.free.pop();
    if (!l) return null;
    l.color.set(color);
    return l;
  }
  release(l) {
    if (!l) return;
    l.intensity = 0;
    l.position.set(0, -999, 0);
    this.free.push(l);
  }
}

// ==================================================================
export class EffectsEngine {
  constructor(scene, env) {
    this.scene = scene;
    this.env = env; // { waterHeight(x,z,t), getWind() -> Vector3 }
    this.rng = makeRng(RNG_SEED);
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._zeroWind = new THREE.Vector3(); // env.getWind 缺失时的回退
    this._zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    this._m4 = new THREE.Matrix4();
    this._quat = new THREE.Quaternion();

    // 粒子池（火焰/火星加法混合，浓烟/水花普通透明）
    this.flame = new PointPool(scene, FLAME_CAP, pointsMaterial(flameTexture(), THREE.AdditiveBlending));
    this.smoke = new PointPool(scene, SMOKE_CAP, pointsMaterial(smokeTexture(), THREE.NormalBlending));
    this.spark = new PointPool(scene, SPARK_CAP, pointsMaterial(sparkTexture(), THREE.AdditiveBlending));
    this.water = new PointPool(scene, WATER_CAP, pointsMaterial(splashTexture(), THREE.NormalBlending));

    // 灯光池
    this.lights = new LightPool(scene, LIGHT_POOL_SIZE);

    // 着火船登记：{ obj, anchors, intensity, extinguishing, light, seed, acc }
    this.fires = [];
    // 爆炸闪光：{ light, t }
    this.flashes = [];

    // ---- 箭矢池（InstancedMesh，细长锥体；浅色便于夜战辨识）----
    const arrowGeo = new THREE.ConeGeometry(0.045, 0.9, 5);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x9c8b6a });
    this.arrowMesh = new THREE.InstancedMesh(arrowGeo, arrowMat, ARROW_CAP);
    this.arrowMesh.frustumCulled = false;
    this.arrowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.arrowMesh);
    // 箭矢状态：0 空闲 / 1 待发射(stagger) / 2 在飞 / 3 钉在甲板
    this.aState = new Uint8Array(ARROW_CAP);
    this.aPos = new Float32Array(ARROW_CAP * 3);
    this.aVel = new Float32Array(ARROW_CAP * 3);
    this.aTimer = new Float32Array(ARROW_CAP); // 待发射延迟 / 钉甲板剩余时间
    this.aDeckY = new Float32Array(ARROW_CAP); // 目标甲板高度
    this.aFire = new Uint8Array(ARROW_CAP);    // 是否火箭
    this.flying = 0;
    this._arrowCursor = 0;
    for (let i = 0; i < ARROW_CAP; i++) this.arrowMesh.setMatrixAt(i, this._zeroM);

    // ---- 水面冲击环池（共享几何体，各自材质以独立控制透明度）----
    const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    this.rings = [];
    for (let i = 0; i < RING_CAP; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc88, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      });
      const m = new THREE.Mesh(ringGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, maxScale: 1, active: false });
    }
  }

  // ---------------- 每帧更新 ----------------
  update(dt, t) {
    const wind = this.env.getWind ? this.env.getWind() : this._zeroWind;
    this._updateArrows(dt, t);
    this._updateFires(dt, t);
    this._updateFlashes(dt);
    this._updateRings(dt);
    this.flame.update(dt, wind);
    this.smoke.update(dt, wind);
    this.spark.update(dt, wind);
    this.water.update(dt, wind);
  }

  // ---------------- 箭雨齐射 ----------------
  // origins: Vector3[]（各船发射位），target: 目标区域中心 Vector3
  // opts: { perOrigin=10, fire=false, spread=5, arc=0.55 }
  arrowVolley(origins, target, opts = {}) {
    const { perOrigin = 10, fire = false, spread = 5, arc = 0.55 } = opts;
    const rng = this.rng;
    for (const o of origins) {
      for (let k = 0; k < perOrigin; k++) {
        const i = this._allocArrow();
        if (i < 0) return; // 池满静默丢弃余下箭矢
        // 目标散布
        const tx = target.x + (rng() * 2 - 1) * spread;
        const tz = target.z + (rng() * 2 - 1) * spread;
        const ty = target.y + rng() * 0.6;
        const dx = tx - o.x, dz = tz - o.z, dy = ty - o.y;
        const dist = Math.hypot(dx, dz);
        // 弹道解算：arc 越大滞空越久、抛得越高，仍精确落向目标点
        const T = Math.min(Math.max((dist / 34) * (1 + arc), 0.8), 3.2);
        const i3 = i * 3;
        this.aPos[i3] = o.x; this.aPos[i3 + 1] = o.y; this.aPos[i3 + 2] = o.z;
        this.aVel[i3] = dx / T;
        this.aVel[i3 + 1] = (dy + 0.5 * GRAV_ARROW * T * T) / T;
        this.aVel[i3 + 2] = dz / T;
        this.aDeckY[i] = ty;
        this.aFire[i] = fire ? 1 : 0;
        this.aTimer[i] = rng() * 0.3; // 0.3 秒内陆续出射（stagger）
        this.aState[i] = 1;
      }
    }
  }

  _allocArrow() {
    // 游标式顺序扫描，找到第一个空闲槽
    for (let n = 0; n < ARROW_CAP; n++) {
      const i = (this._arrowCursor + n) % ARROW_CAP;
      if (this.aState[i] === 0) {
        this._arrowCursor = (i + 1) % ARROW_CAP;
        return i;
      }
    }
    return -1;
  }

  _updateArrows(dt, t) {
    const rng = this.rng;
    let dirty = false;
    for (let i = 0; i < ARROW_CAP; i++) {
      const st = this.aState[i];
      if (st === 0) continue;
      const i3 = i * 3;
      if (st === 1) { // 待发射：stagger 计时，受在飞上限节流
        this.aTimer[i] -= dt;
        if (this.aTimer[i] <= 0 && this.flying < MAX_FLYING) {
          this.aState[i] = 2;
          this.flying++;
        }
        continue;
      }
      if (st === 2) { // 在飞：弹道积分
        this.aVel[i3 + 1] -= GRAV_ARROW * dt;
        this.aPos[i3] += this.aVel[i3] * dt;
        this.aPos[i3 + 1] += this.aVel[i3 + 1] * dt;
        this.aPos[i3 + 2] += this.aVel[i3 + 2] * dt;
        const x = this.aPos[i3], y = this.aPos[i3 + 1], z = this.aPos[i3 + 2];
        // 火箭沿途洒橙色火星（进入火星池）
        if (this.aFire[i] && rng() < 0.6) {
          this.spark.spawn(
            x, y, z,
            this.aVel[i3] * 0.08 + (rng() - 0.5), this.aVel[i3 + 1] * 0.08 + (rng() - 0.5), this.aVel[i3 + 2] * 0.08 + (rng() - 0.5),
            { life: 0.3 + rng() * 0.35, size: 0.1 + rng() * 0.06, grav: 1.5, r: 1, g: 0.55 + rng() * 0.2, b: 0.12, a: 0.9 },
          );
        }
        // 命中判定：下落到达甲板高度 → 钉住闪烁；落水 → 小水花回收
        if (this.aVel[i3 + 1] < 0 && y <= this.aDeckY[i]) {
          this.aState[i] = 3;
          this.aTimer[i] = 1.5;
          this.flying--;
          this._writeArrowMatrix(i, false);
          dirty = true;
          continue;
        }
        if (this.env.waterHeight && y <= this.env.waterHeight(x, z, t)) {
          this._tmp.set(x, y, z);
          this.splash(this._tmp, 0.3);
          this._freeArrow(i);
          this.flying--;
          dirty = true;
          continue;
        }
        this._writeArrowMatrix(i, false);
        dirty = true;
        continue;
      }
      // 钉在甲板：末段快速闪烁后熄灭回收
      this.aTimer[i] -= dt;
      if (this.aTimer[i] <= 0) {
        this._freeArrow(i);
        dirty = true;
        continue;
      }
      if (this.aTimer[i] < 0.8) {
        const blinkOn = ((this.aTimer[i] * 12) | 0) % 2 === 0;
        this._writeArrowMatrix(i, !blinkOn);
        dirty = true;
      }
    }
    if (dirty) this.arrowMesh.instanceMatrix.needsUpdate = true;
  }

  // 姿态沿速度方向；hidden 用于闪烁（写零缩放矩阵）
  _writeArrowMatrix(i, hidden) {
    if (hidden) {
      this.arrowMesh.setMatrixAt(i, this._zeroM);
      return;
    }
    const i3 = i * 3;
    this._tmp.set(this.aVel[i3], this.aVel[i3 + 1], this.aVel[i3 + 2]).normalize();
    this._quat.setFromUnitVectors(this._up.set(0, 1, 0), this._tmp);
    this._tmp2.set(this.aPos[i3], this.aPos[i3 + 1], this.aPos[i3 + 2]);
    this._m4.compose(this._tmp2, this._quat, this._tmp.set(1, 1, 1));
    this.arrowMesh.setMatrixAt(i, this._m4);
  }

  _freeArrow(i) {
    this.aState[i] = 0;
    this.arrowMesh.setMatrixAt(i, this._zeroM);
  }

  // ---------------- 船只起火 ----------------
  // obj: 船的 THREE.Group；anchors: 局部坐标着火点 Vector3[]（甲板 2~4 点）
  igniteShip(obj, anchors, intensity = 0.5) {
    const e = this.fires.find((f) => f.obj === obj);
    if (e) { // 已着火则只更新参数
      e.anchors = anchors;
      e.intensity = THREE.MathUtils.clamp(intensity, 0, 1);
      e.extinguishing = false;
      return;
    }
    this.fires.push({
      obj, anchors,
      intensity: THREE.MathUtils.clamp(intensity, 0, 1),
      extinguishing: false,
      light: null,
      seed: this.rng() * 100,
      acc: { flame: 0, smoke: 0, spark: 0 },
    });
  }

  setShipFireIntensity(obj, v) {
    const e = this.fires.find((f) => f.obj === obj);
    if (e) e.intensity = THREE.MathUtils.clamp(v, 0, 1);
  }

  extinguishShip(obj) {
    const e = this.fires.find((f) => f.obj === obj);
    if (e) e.extinguishing = true; // 渐熄：intensity 缓降，烟渐稀
  }

  isBurning(obj) {
    return this.fires.some((f) => f.obj === obj && !f.extinguishing);
  }

  _updateFires(dt, t) {
    const rng = this.rng;
    for (let fi = this.fires.length - 1; fi >= 0; fi--) {
      const e = this.fires[fi];
      // 渐熄：约 3 秒降到 0，然后注销并归还灯光
      if (e.extinguishing) {
        e.intensity -= dt / 3;
        if (e.intensity <= 0) {
          this.lights.release(e.light);
          this.fires.splice(fi, 1);
          continue;
        }
      }
      const inten = e.intensity;
      // 发射速率（个/秒/着火点）
      e.acc.flame += dt * (6 + 30 * inten);
      e.acc.smoke += dt * (1.5 + 9 * inten);
      e.acc.spark += dt * (0.5 + 5 * inten);
      const nFlame = e.acc.flame | 0; e.acc.flame -= nFlame;
      const nSmoke = e.acc.smoke | 0; e.acc.smoke -= nSmoke;
      const nSpark = e.acc.spark | 0; e.acc.spark -= nSpark;
      // 烟色：火大烟浓黑（0.08），火小烟浅灰（0.55）
      const smokeGray = 0.55 - 0.47 * inten;
      let cx = 0, cy = 0, cz = 0; // 着火点世界坐标均值（放灯光用）
      for (const a of e.anchors) {
        this._tmp.copy(a);
        e.obj.localToWorld(this._tmp); // 着火点每帧随船矩阵变换
        const ax = this._tmp.x, ay = this._tmp.y, az = this._tmp.z;
        cx += ax; cy += ay; cz += az;
        for (let n = 0; n < nFlame; n++) { // 火焰：上升、抖动、短命
          this.flame.spawn(
            ax + (rng() - 0.5) * 0.9, ay + rng() * 0.3, az + (rng() - 0.5) * 0.9,
            (rng() - 0.5) * 0.7, 1.5 + rng() * 1.5 * (0.6 + inten), (rng() - 0.5) * 0.7,
            {
              life: 0.5 + rng() * 0.4, size: (0.55 + rng() * 0.5) * (0.5 + inten * 1.1),
              grow: 0.4, drag: 0.6, wind: 0.15,
              r: 0.9 + rng() * 0.1, g: 0.85 + rng() * 0.15, b: 0.75 + rng() * 0.2, a: 0.85,
            },
          );
        }
        for (let n = 0; n < nSmoke; n++) { // 浓烟：升得慢、变大变淡、受风漂移
          const g = smokeGray * (0.8 + rng() * 0.4);
          this.smoke.spawn(
            ax + (rng() - 0.5) * 1.2, ay + 1 + inten + rng() * 0.6, az + (rng() - 0.5) * 1.2,
            (rng() - 0.5) * 0.4, 0.9 + rng() * 0.8, (rng() - 0.5) * 0.4,
            {
              life: 2.5 + rng() * 1.5, size: 1.1 + rng() * 0.7 + inten,
              grow: 1.2 + rng() * 0.8, drag: 0.15, wind: 0.9,
              r: g, g, b: g, a: 0.3 + 0.3 * inten,
            },
          );
        }
        for (let n = 0; n < nSpark; n++) { // 火星：加法混合、受风明显、可飘很远
          this.spark.spawn(
            ax, ay + rng() * 0.5, az,
            (rng() - 0.5) * 2.5, 2.5 + rng() * 3.5, (rng() - 0.5) * 2.5,
            {
              life: 0.8 + rng() * 1.2, size: 0.1 + rng() * 0.08,
              grav: 2.2, drag: 0.25, wind: 1.6,
              r: 1, g: 0.5 + rng() * 0.25, b: 0.12, a: 0.95,
            },
          );
        }
      }
      // 灯光：intensity 高时申请一盏橙色 PointLight 放船上方闪烁；池满静默跳过
      const na = e.anchors.length || 1;
      if (!e.extinguishing && inten >= 0.45 && !e.light) {
        e.light = this.lights.acquire(0xff8833);
      }
      if (e.light) {
        e.light.position.set(cx / na, cy / na + 2.5 + 2 * inten, cz / na);
        const fl = 0.8 + 0.2 * Math.sin(t * 13 + e.seed) * Math.sin(t * 7.1 + e.seed * 1.7);
        e.light.intensity = (4 + 12 * inten) * fl;
        if (e.extinguishing && inten < 0.25) { // 快熄灭了提前归还
          this.lights.release(e.light);
          e.light = null;
        }
      }
    }
  }

  // ---------------- 爆炸 ----------------
  explosion(pos, scale = 1) {
    const rng = this.rng;
    // 闪光：灯光池瞬时 40 → 0（约 0.5 秒），池满静默跳过
    const light = this.lights.acquire(0xffaa66);
    if (light) {
      light.position.set(pos.x, pos.y + 2, pos.z);
      light.intensity = 40;
      this.flashes.push({ light, t: 0 });
    }
    // 火球：一簇火焰点高速扩散、强阻力减速
    const nBall = Math.round(36 * scale);
    for (let i = 0; i < nBall; i++) {
      const th = rng() * Math.PI * 2, ph = Math.acos(rng() * 2 - 1);
      const sp = (5 + rng() * 8) * scale;
      this.flame.spawn(
        pos.x, pos.y, pos.z,
        Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.9 + 2, Math.sin(ph) * Math.sin(th) * sp,
        {
          life: 0.5 + rng() * 0.5, size: (1 + rng() * 0.8) * scale,
          grow: 0.6, drag: 2.6, wind: 0.2,
          r: 1, g: 0.9 + rng() * 0.1, b: 0.7 + rng() * 0.2, a: 0.95,
        },
      );
    }
    // 大量火星
    const nSpark = Math.round(50 * scale);
    for (let i = 0; i < nSpark; i++) {
      const th = rng() * Math.PI * 2, ph = Math.acos(rng() * 2 - 1);
      const sp = (9 + rng() * 13) * scale;
      this.spark.spawn(
        pos.x, pos.y, pos.z,
        Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp, Math.sin(ph) * Math.sin(th) * sp,
        {
          life: 0.7 + rng() * 1, size: 0.12 + rng() * 0.08,
          grav: 4.5, drag: 0.5, wind: 1.2,
          r: 1, g: 0.55 + rng() * 0.25, b: 0.15, a: 1,
        },
      );
    }
    // 爆炸浓烟
    const nSmoke = Math.round(10 * scale);
    for (let i = 0; i < nSmoke; i++) {
      const g = 0.1 + rng() * 0.12;
      this.smoke.spawn(
        pos.x + (rng() - 0.5) * scale, pos.y + rng() * scale, pos.z + (rng() - 0.5) * scale,
        (rng() - 0.5) * 3, 1.5 + rng() * 2, (rng() - 0.5) * 3,
        {
          life: 2 + rng() * 1.5, size: 1.5 * scale, grow: 2.2, drag: 0.8, wind: 1,
          r: g, g, b: g, a: 0.5,
        },
      );
    }
    // 水面冲击环：共享几何体，缩放 1→scale*14 同时透明度 1→0，0.7 秒
    const ring = this.rings.find((r) => !r.active);
    if (ring) {
      ring.active = true;
      ring.t = 0;
      ring.maxScale = scale * 14;
      // 冲击环贴水面（无 waterHeight 接口时退化为爆炸点高度）
      const wy = this.env.waterHeight ? this.env.waterHeight(pos.x, pos.z, 0) : pos.y;
      ring.mesh.position.set(pos.x, wy + 0.05, pos.z);
      ring.mesh.visible = true;
    }
  }

  _updateFlashes(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / 0.5;
      if (k >= 1) {
        this.lights.release(f.light);
        this.flashes.splice(i, 1);
      } else {
        f.light.intensity = 40 * (1 - k) * (1 - k);
      }
    }
  }

  _updateRings(dt) {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const k = r.t / 0.7;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        r.mesh.material.opacity = 0;
        continue;
      }
      const ease = 1 - (1 - k) * (1 - k); // easeOutQuad
      const s = 1 + (r.maxScale - 1) * ease;
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = 1 - k;
    }
  }

  // ---------------- 水花 / 船尾浪花 ----------------
  splash(pos, scale = 1) {
    const rng = this.rng;
    const n = Math.round(10 + 6 * scale);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const sp = (0.6 + rng() * 1.4) * scale;
      this.water.spawn(
        pos.x + (rng() - 0.5) * 0.3 * scale, pos.y, pos.z + (rng() - 0.5) * 0.3 * scale,
        Math.cos(a) * sp, (1.6 + rng() * 2.4) * Math.sqrt(scale), Math.sin(a) * sp,
        {
          life: 0.4 + rng() * 0.3, size: (0.16 + rng() * 0.14) * (0.6 + scale),
          grow: 0.5, grav: 6, drag: 0.4, wind: 0.3,
          r: 0.92, g: 0.96, b: 1, a: 0.85,
        },
      );
    }
  }

  // 船尾浪花（调用方节流）：白色短命小粒子
  wake(pos, dir, strength) {
    const rng = this.rng;
    const n = 1 + Math.min(3, Math.round(strength * 2));
    for (let i = 0; i < n; i++) {
      this.water.spawn(
        pos.x + (rng() - 0.5) * 0.8, pos.y + rng() * 0.1, pos.z + (rng() - 0.5) * 0.8,
        -dir.x * strength * 0.4 + (rng() - 0.5) * 0.6,
        0.4 + rng() * 0.6,
        -dir.z * strength * 0.4 + (rng() - 0.5) * 0.6,
        {
          life: 0.35 + rng() * 0.25, size: 0.16 + strength * 0.12 + rng() * 0.08,
          grow: 0.6, grav: 1.5, drag: 1, wind: 0.2,
          r: 0.9, g: 0.95, b: 1, a: 0.55,
        },
      );
    }
  }

  // ---------------- 复位（重播战役） ----------------
  clear() {
    this.flame.clear();
    this.smoke.clear();
    this.spark.clear();
    this.water.clear();
    // 箭矢全部回收
    this.aState.fill(0);
    this.flying = 0;
    for (let i = 0; i < ARROW_CAP; i++) this.arrowMesh.setMatrixAt(i, this._zeroM);
    this.arrowMesh.instanceMatrix.needsUpdate = true;
    // 着火船：归还灯光后清空
    for (const e of this.fires) this.lights.release(e.light);
    this.fires.length = 0;
    // 爆炸闪光归还
    for (const f of this.flashes) this.lights.release(f.light);
    this.flashes.length = 0;
    // 冲击环复位
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
      r.mesh.material.opacity = 0;
    }
    this.rng = makeRng(RNG_SEED); // 重置确定性随机序列
  }
}
