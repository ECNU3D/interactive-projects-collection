// 赤壁之战 · 运镜模块 —— 每个剧本事件对应一个镜头，帧内平滑逼近目标机位
import * as THREE from 'three';

const _pos = new THREE.Vector3(), _look = new THREE.Vector3();

export class CameraRig {
  /**
   * @param camera THREE.PerspectiveCamera
   * @param controls OrbitControls（自由视角用，运镜时禁用）
   * @param targets 动态目标：{ leadFire: () => Ship, wuFlagship: Ship }
   */
  constructor(camera, controls, targets) {
    this.camera = camera;
    this.controls = controls;
    this.targets = targets;
    this.mode = 'cine';            // cine | free
    this._shot = null;
    this._shotT = 0;
    this._shake = 0;

    // 镜头表：pos0→pos1，look0→look1，随镜头时长缓慢推移
    this.shots = {
      // 开场：低掠江面沿赤壁摩崖东行，再拉起揽全局对峙
      wideRiver: { dur: 30, pos0: [-102, 13, 52], pos1: [36, 34, 72], look0: [-66, 15, 91], look1: [0, 2, -24] },
      weiFleet: { dur: 32, pos0: [20, 22, -5], pos1: [-25, 15, -18], look0: [0, 1.5, -56], look1: [0, 1.5, -56] },
      fireShipsSail: { dur: 34, dynamic: 'leadFire', off0: [-15, 10, 16], off1: [-9, 8, 10], ahead: [0, 1.5, -9] },
      flags: { dur: 22, dynamic: 'wuFlagship', off0: [11, 5.5, 13], off1: [7.5, 4.2, 9.5], ahead: [0, 3.4, 0] },
      fireImpact: { dur: 47, pos0: [34, 15, -6], pos1: [18, 11, -18], look0: [0, 2, -50], look1: [0, 2, -50] },
      volley: { dur: 50, pos0: [95, 42, 45], pos1: [65, 30, 5], look0: [-5, 0, -20], look1: [-5, 0, -20] },
      // 曹军抢滩华容道口 → 摇向小道深处，目送火把纵队远去
      retreat: { dur: 47, pos0: [-24, 13, -46], pos1: [-48, 15, -50], look0: [-60, 2, -84], look1: [-70, 6, -124] },
      // 尾声：晨光洒上赤壁摩崖，再拉远送别大江
      epilogue: { dur: 38, pos0: [12, 13, 56], pos1: [105, 58, 135], look0: [-52, 13, 88], look1: [0, 0, -18] },
    };
  }

  play(id) {
    if (!this.shots[id]) return;
    this._shot = this.shots[id];
    this._shotT = 0;
    if (this.mode !== 'cine') return; // 自由视角下只记录不执行
  }

  shake(k) { this._shake = Math.min(this._shake + k, 1.2); }

  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'free';
    if (mode === 'free') {
      // 注视点重置到镜头正前方（优先取与水面的交点），滚轮缩放即"推向所看之处"
      const dir = this.camera.getWorldDirection(_pos);
      let dist = 45;
      if (dir.y < -0.05) dist = THREE.MathUtils.clamp((this.camera.position.y - 1) / -dir.y, 10, 130);
      this.controls.target.copy(this.camera.position).addScaledVector(dir, dist);
    }
  }

  update(dt, t) {
    if (this.mode !== 'cine' || !this._shot) {
      this.controls.update();
      // 自由视角不允许潜入水下
      if (this.camera.position.y < 1.2) this.camera.position.y = 1.2;
      return;
    }
    const s = this._shot;
    this._shotT += dt;
    const p = Math.min(this._shotT / s.dur, 1);
    const e = p * p * (3 - 2 * p);   // smoothstep 推移

    if (s.dynamic) {
      const ship = this.targets[s.dynamic]?.();
      const anchor = ship ? ship.obj.position : new THREE.Vector3(0, 0, 40);
      _pos.set(
        anchor.x + THREE.MathUtils.lerp(s.off0[0], s.off1[0], e),
        anchor.y + THREE.MathUtils.lerp(s.off0[1], s.off1[1], e),
        anchor.z + THREE.MathUtils.lerp(s.off0[2], s.off1[2], e)
      );
      _look.set(anchor.x + s.ahead[0], anchor.y + s.ahead[1], anchor.z + s.ahead[2]);
    } else {
      _pos.set(
        THREE.MathUtils.lerp(s.pos0[0], s.pos1[0], e),
        THREE.MathUtils.lerp(s.pos0[1], s.pos1[1], e),
        THREE.MathUtils.lerp(s.pos0[2], s.pos1[2], e)
      );
      _look.set(
        THREE.MathUtils.lerp(s.look0[0], s.look1[0], e),
        THREE.MathUtils.lerp(s.look0[1], s.look1[1], e),
        THREE.MathUtils.lerp(s.look0[2], s.look1[2], e)
      );
    }

    // 爆炸震屏
    if (this._shake > 0.001) {
      const k = this._shake * 0.6;
      _pos.x += Math.sin(t * 39) * k;
      _pos.y += Math.cos(t * 47) * k * 0.7;
      _pos.z += Math.sin(t * 31 + 1) * k;
      this._shake *= Math.exp(-dt * 3.2);
    }

    _pos.y = Math.max(_pos.y, 2.2);   // 机位始终高于浪面

    // 平滑逼近（指数阻尼，天然带转场）
    const a = 1 - Math.exp(-dt * 1.6);
    this.camera.position.lerp(_pos, a);
    const curLook = this.controls.target;
    curLook.lerp(_look, a);
    this.camera.lookAt(curLook);
  }
}
