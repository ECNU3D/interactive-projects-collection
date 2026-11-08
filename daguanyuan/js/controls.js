// 第一人稱漫遊：指針鎖定 + WASD + 台階攀登 + 牆體碰撞 + 憑虛御風 + 觸屏搖桿
import * as THREE from 'three';
import { walkHeight, colliders, WORLD, SPAWN } from './layout.js';

const EYE = 1.66;
const WALK = 4.6, RUN = 10.5;
const FLY_EYE = 90;
const STEP_UP = 0.62;      // 可邁上的最大高差（踏跺一級）

export class WalkControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = SPAWN.yaw;
    this.pitch = -0.03;
    this.pos = new THREE.Vector3(SPAWN.x, EYE, SPAWN.z);
    this.groundY = 0;
    this.keys = {};
    this.locked = false;
    this.flyMode = false;
    this.flyT = 0;
    this.bobPhase = 0;
    this.moving = false;
    this.enabled = false;
    this.frozen = false;      // 展圖時凍結行走
    this.onKey = null;
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches
      || new URLSearchParams(location.search).has('touch');
    this.joy = { x: 0, y: 0 };

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (!this.enabled) return;
      if (e.code === 'KeyF') this.flyMode = !this.flyMode;
      this.onKey?.(e.code);
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
        const t = e.changedTouches[0]; jid = t.identifier; move(t);
      }, { passive: false });
      joy.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === jid) move(t);
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === jid) {
          jid = null; this.joy.x = this.joy.y = 0; knob.style.transform = '';
        }
      };
      joy.addEventListener('touchend', end);
      joy.addEventListener('touchcancel', end);
    }

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

  /** 神遊：由地圖直接移駕 */
  teleport(x, z, yaw) {
    this.pos.x = x; this.pos.z = z;
    if (yaw !== undefined) this.yaw = yaw;
    const h = walkHeight(x, z);
    this.groundY = h ?? 0;
    this.pos.y = this.groundY + EYE;
  }

  update(dt) {
    if (!this.enabled) return;
    dt = Math.min(dt, 0.05);

    const target = this.flyMode ? 1 : 0;
    this.flyT += (target - this.flyT) * Math.min(1, dt * 2.2);

    const k = this.frozen ? {} : this.keys;
    let fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    let strafe = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
    if (!this.frozen) { fwd += -this.joy.y; strafe += this.joy.x; }
    const mag = Math.hypot(fwd, strafe);
    const run = k['ShiftLeft'] || k['ShiftRight'] || Math.hypot(this.joy.x, this.joy.y) > 0.85;
    const speedBase = this.flyT > 0.5 ? (run ? 90 : 40) : (run ? RUN : WALK);

    let vx = 0, vz = 0;
    if (mag > 0) {
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      vx = (-sy * fwd + cy * strafe);
      vz = (-cy * fwd - sy * strafe);
      const len = Math.hypot(vx, vz) || 1;
      const spd = speedBase * Math.min(1, mag);
      vx = vx / len * spd; vz = vz / len * spd;
    }
    this.moving = mag > 0;

    let nx = this.pos.x + vx * dt;
    let nz = this.pos.z + vz * dt;
    nx = Math.max(WORLD.x0 + 6, Math.min(WORLD.x1 - 6, nx));
    nz = Math.max(WORLD.z0 + 6, Math.min(WORLD.z1 - 6, nz));

    if (this.flyT < 0.5) {
      const cur = this.groundY;
      // 高差過大或落水 → 攔住；先試單軸滑動
      const ok = (px, pz) => {
        const h = walkHeight(px, pz);
        return h !== null && h - cur <= STEP_UP;
      };
      if (!ok(nx, nz)) {
        if (ok(this.pos.x, nz)) nx = this.pos.x;
        else if (ok(nx, this.pos.z)) nz = this.pos.z;
        else { nx = this.pos.x; nz = this.pos.z; }
      }
      // 牆體碰撞
      const R = 0.5;
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
      const gh = walkHeight(nx, nz);
      if (gh !== null) this.groundY += (gh - this.groundY) * Math.min(1, dt * 14);
    }

    this.pos.x = nx;
    this.pos.z = nz;

    let eyeY = this.groundY + EYE;
    if (this.moving && this.flyT < 0.4) {
      this.bobPhase += dt * (run ? 11 : 7.5);
      eyeY += Math.sin(this.bobPhase) * 0.042;
    }
    const flyY = FLY_EYE + Math.sin(performance.now() * 0.0004) * 2;
    const yy = eyeY + (flyY - eyeY) * this.flyT;
    this.pos.y += (yy - this.pos.y) * Math.min(1, dt * (this.flyT > 0.05 && this.flyT < 0.95 ? 2.0 : 14));

    this.camera.position.copy(this.pos);
    const cy2 = Math.cos(this.pitch);
    this.camera.lookAt(
      this.pos.x - Math.sin(this.yaw) * cy2,
      this.pos.y + Math.sin(this.pitch),
      this.pos.z - Math.cos(this.yaw) * cy2
    );
  }
}
