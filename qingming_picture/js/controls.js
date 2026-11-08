// 第一人称漫游控制：指针锁定 + WASD + 桥拱行走 + 碰撞 + 鸟瞰模式 + 触屏摇杆
import * as THREE from 'three';
import { walkHeight, colliders, WORLD, RIVER, BRIDGE } from './layout.js';

const EYE = 1.68;
const WALK = 5.2, RUN = 11;
const FLY_EYE = 55;

export class WalkControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = -Math.PI / 2 + 0.35;   // 初始朝东（+X）
    this.pitch = -0.04;
    this.pos = new THREE.Vector3(30, EYE, 6);
    this.keys = {};
    this.locked = false;
    this.flyMode = false;
    this.flyT = 0;          // 0 walk .. 1 fly（平滑过渡）
    this.bobPhase = 0;
    this.moving = false;
    this.enabled = false;
    // 触屏设备（手机/平板）：?touch=1 可强制开启用于调试
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches
      || new URLSearchParams(location.search).has('touch');
    this.joy = { x: 0, y: 0 };   // 虚拟摇杆向量（+x 右，+y 下）

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyM' && this.enabled) this.flyMode = !this.flyMode;
    });
    document.addEventListener('keyup', (e) => (this.keys[e.code] = false));

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0021;
      this.pitch -= e.movementY * 0.0019;
      const lim = Math.PI / 2 - 0.06;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });

    this.dom.addEventListener('click', () => {
      if (this.enabled && !this.locked && !this.isTouch) this.dom.requestPointerLock();
    });

    if (this.isTouch) this._bindTouch();
  }

  // —— 触屏：左下摇杆行走 + 画面滑动环顾 ——
  _bindTouch() {
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joy-knob');
    if (joy && knob) {
      joy.classList.remove('hidden');
      let jid = null;
      const move = (t) => {
        const r = joy.getBoundingClientRect();
        const max = r.width / 2;
        let dx = t.clientX - (r.left + max);
        let dy = t.clientY - (r.top + max);
        const len = Math.hypot(dx, dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joy.x = dx / max;
        this.joy.y = dy / max;
      };
      joy.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        jid = t.identifier;
        move(t);
      }, { passive: false });
      joy.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === jid) move(t);
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === jid) {
          jid = null;
          this.joy.x = this.joy.y = 0;
          knob.style.transform = '';
        }
      };
      joy.addEventListener('touchend', end);
      joy.addEventListener('touchcancel', end);
    }

    // 画面滑动环顾（单指拖动转视角）
    let lid = null, lx = 0, ly = 0;
    this.dom.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[e.changedTouches.length - 1];
      lid = t.identifier; lx = t.clientX; ly = t.clientY;
    }, { passive: false });
    this.dom.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === lid) {
          this.yaw -= (t.clientX - lx) * 0.0044;
          this.pitch -= (t.clientY - ly) * 0.0039;
          const lim = Math.PI / 2 - 0.06;
          this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
          lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: false });
    const lend = (e) => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; };
    this.dom.addEventListener('touchend', lend);
    this.dom.addEventListener('touchcancel', lend);
  }

  start() {
    this.enabled = true;
    if (!this.isTouch) this.dom.requestPointerLock?.();
  }

  toggleFly() { this.flyMode = !this.flyMode; }

  update(dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);

    // 走/飞 过渡
    const target = this.flyMode ? 1 : 0;
    this.flyT += (target - this.flyT) * Math.min(1, dt * 2.2);

    const k = this.keys;
    let fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    let strafe = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
    // 摇杆并入（上推为前进；推满自动疾行）
    fwd += -this.joy.y;
    strafe += this.joy.x;
    const mag = Math.hypot(fwd, strafe);
    const run = k['ShiftLeft'] || k['ShiftRight'] || Math.hypot(this.joy.x, this.joy.y) > 0.85;
    const speedBase = this.flyT > 0.5 ? (run ? 60 : 28) : (run ? RUN : WALK);

    let vx = 0, vz = 0;
    if (mag > 0) {
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      // 前向（水平投影）
      vx = (-sy * fwd + cy * strafe);
      vz = (-cy * fwd - sy * strafe);
      const len = Math.hypot(vx, vz) || 1;
      const spd = speedBase * Math.min(1, mag);
      vx = vx / len * spd;
      vz = vz / len * spd;
    }
    this.moving = mag > 0;

    let nx = this.pos.x + vx * dt;
    let nz = this.pos.z + vz * dt;

    // 世界边界
    nx = Math.max(WORLD.x0 + 12, Math.min(WORLD.x1 - 12, nx));
    nz = Math.max(WORLD.z0 + 14, Math.min(WORLD.z1 - 14, nz));

    if (this.flyT < 0.5) {
      // ---- 地面模式碰撞 ----
      // 桥面上：限制 z 在桥宽内
      const h0 = walkHeight(nx, nz);
      if (h0 === null) {
        // 尝试只沿一个轴滑动
        if (walkHeight(this.pos.x, nz) !== null) nx = this.pos.x;
        else if (walkHeight(nx, this.pos.z) !== null) nz = this.pos.z;
        else { nx = this.pos.x; nz = this.pos.z; }
      }
      // 桥上防跌落：在桥拱 x 范围且接近桥宽边缘时夹住
      if (nx > BRIDGE.x0 && nx < BRIDGE.x1 && Math.abs(nz) < BRIDGE.deckHalfW + 1.2) {
        const inRiverX = nx > RIVER.bank0 + 2 && nx < RIVER.bank1 - 2;
        if (inRiverX) nz = Math.max(-BRIDGE.walkHalfW, Math.min(BRIDGE.walkHalfW, nz));
      }
      // 建筑碰撞盒
      const R = 0.55;
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        if (nx > b.x0 - R && nx < b.x1 + R && nz > b.z0 - R && nz < b.z1 + R) {
          const dxl = nx - (b.x0 - R), dxr = (b.x1 + R) - nx;
          const dzl = nz - (b.z0 - R), dzr = (b.z1 + R) - nz;
          const m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl) nx = b.x0 - R;
          else if (m === dxr) nx = b.x1 + R;
          else if (m === dzl) nz = b.z0 - R;
          else nz = b.z1 + R;
        }
      }
    }

    this.pos.x = nx;
    this.pos.z = nz;

    // 高度
    const groundH = walkHeight(nx, nz) ?? 0;
    let eyeY = groundH + EYE;
    // 步伐微晃
    if (this.moving && this.flyT < 0.4) {
      this.bobPhase += dt * (run ? 11 : 7.5);
      eyeY += Math.sin(this.bobPhase) * 0.045;
    }
    const flyY = FLY_EYE + Math.sin(performance.now() * 0.0004) * 1.5;
    const y = eyeY + (flyY - eyeY) * this.flyT;
    this.pos.y += (y - this.pos.y) * Math.min(1, dt * (this.flyT > 0.05 && this.flyT < 0.95 ? 2.0 : 14));

    // 应用到相机
    this.camera.position.copy(this.pos);
    const cy = Math.cos(this.pitch);
    this.camera.lookAt(
      this.pos.x - Math.sin(this.yaw) * cy,
      this.pos.y + Math.sin(this.pitch),
      this.pos.z - Math.cos(this.yaw) * cy
    );
  }
}
