// 赤壁之战 · 导演模块 —— 按剧本时间线调度事件，驱动战斗模拟
import * as THREE from 'three';
import { EVENTS, BATTLE_DURATION } from './script.js';

const V = new THREE.Vector3();

export class Director {
  constructor({ env, fleets, effects, cameraRig, audio, ui, huarong }) {
    Object.assign(this, { env, fleets, effects, cameraRig, audio, ui, huarong });
    this.t = 0;
    this.running = false;
    this._fired = new Set();
    this._combat = false;          // 总攻阶段互射开关
    this._volleyT = 0;
    this._spreadT = 0;             // 火势蔓延计时
    this._fireShipsLit = false;
    this._retreated = false;
  }

  start() {
    this.running = true;
    this.env.setPhase('dusk');
    this.env.setWind(1.4);
  }

  update(dt) {
    if (!this.running) return;
    this.t += dt;

    // ---- 剧本事件 ----
    for (const ev of EVENTS) {
      if (this.t >= ev.t && !this._fired.has(ev.id)) {
        this._fired.add(ev.id);
        this._onEvent(ev);
      }
    }

    // ---- 火船冲撞判定 ----
    if (this._fireShipsLit) this._updateFireShips(dt);

    // ---- 火势沿铁索蔓延 ----
    if (this._fired.has('fireAttack')) this._updateFireSpread(dt);

    // ---- 总攻互射 ----
    if (this._combat) this._updateCombat(dt);

    // ---- 落幕 ----
    if (this.t >= BATTLE_DURATION && !this._ended) {
      this._ended = true;
      this.ui.showEnd();
    }
  }

  _onEvent(ev) {
    this.audio.playNarration(ev.id);
    this.ui.subtitle(ev.text);
    this.ui.toast(ev.title);
    this.ui.markEvent(ev.id);
    if (ev.camera) this.cameraRig.play(ev.camera);
    this['_act_' + ev.id]?.();
  }

  // ---------- 各事件动作 ----------
  _act_standoff() {
    this.env.setPhase('dusk');
  }

  _act_defection() {
    // 黄盖火船队出发：各自瞄准魏军前排船的间隙
    const targets = [[-24, -30], [-12, -28], [-3, -30], [6, -28], [15, -30], [24, -28]];
    this.fleets.huangGai.forEach((s, i) => {
      s.setCourse(targets[i][0], targets[i][1], 0.55 + i * 0.04);
    });
  }

  _act_southeastWind() {
    this.env.setWind(7.5);           // 东南大风起
    this.env.setPhase('night');      // 入夜
  }

  _act_fireAttack() {
    this._fireShipsLit = true;
    this.env.setPhase('fireNight');
    // 火船点火、满帆直冲曹营
    for (const s of this.fleets.huangGai) {
      if (!s.alive) continue;
      s.ignite(0.85);
      const pos = s.obj.position;
      s.setCourse(pos.x + (Math.random() - 0.5) * 8, -48, 1.6);
    }
  }

  _act_allOutAttack() {
    this._combat = true;
    // 吴、汉两军全线渡江压上
    const advance = (fleet, zBase) => fleet.forEach((s, i) => {
      if (s.alive) s.setCourse(s.obj.position.x + (i % 2 ? 6 : -6), zBase + (i % 3) * 6, 1);
    });
    advance(this.fleets.wu, -8);
    advance(this.fleets.shu, -2);
    // 总攻第一轮：全员火箭齐射，各船锁定就近魏船（目标分散，不再集火一船）
    const allies = [...this.fleets.wu, ...this.fleets.shu].filter((s) => s.alive);
    const foes = this.fleets.wei.filter((s) => s.alive);
    if (allies.length && foes.length) {
      allies.forEach((s, i) => {
        const sorted = [...foes].sort((a, b) =>
          a.obj.position.distanceToSquared(s.obj.position) - b.obj.position.distanceToSquared(s.obj.position));
        const target = sorted[Math.min(i % 3, sorted.length - 1)];   // 就近三选一错开
        this.effects.arrowVolley(
          [s.deckPoint(new THREE.Vector3())],
          target.deckPoint(new THREE.Vector3()),
          { perOrigin: 12, fire: true, spread: 5 }
        );
      });
    }
  }

  _act_retreat() {
    this._retreated = true;
    this._combat = false;
    // 曹军残部斩断铁索，弃船抢滩乌林西岸；步卒登岸沿华容道北撤
    let n = 0;
    for (const s of this.fleets.wei) {
      if (!s.alive) continue;
      if (s.state === 'burning' && s.burnProgress > 0.5) continue;  // 火势太大的弃船等沉（断樯残帆）
      this.fleets.breakChains(s);
      if (s.state === 'burning') s.setFireIntensity(0.3);           // 边逃边扑救
      const lx = -46 - (n % 6) * 7 - Math.random() * 3;             // 华容道口滩头，错落抢滩
      const lz = -73 - ((n * 5) % 3) * 4 - Math.random() * 2;
      s.fleeTo(lx, lz);
      n++;
    }
    this.huarong?.begin();
    // 联军停止于江心，不再追击（旁白：华容道）
    for (const s of [...this.fleets.wu, ...this.fleets.shu]) {
      if (s.alive) s.setCourse(s.obj.position.x, -25, 0.6);
    }
  }

  _act_epilogue() {
    this.env.setPhase('dawn');
    this.env.setWind(2);
  }

  // ---------- 持续模拟 ----------
  _updateFireShips(dt) {
    for (const s of this.fleets.huangGai) {
      if (s.state === 'sunk' || s.state === 'sinking') continue;
      // 接近任意魏船即撞爆
      for (const w of this.fleets.wei) {
        if (!w.alive) continue;
        const d = V.copy(s.obj.position).distanceTo(w.obj.position);
        if (d < 9) {
          const p = s.obj.position.clone();
          p.y = this.env.WATER_Y + 0.5;
          this.effects.explosion(p, 1.4);
          this.cameraRig.shake(0.7);
          w.ignite(0.75);
          s.setFireIntensity(1);
          s.damage(999);
          break;
        }
      }
    }
  }

  _updateFireSpread(dt) {
    this._spreadT -= dt;
    if (this._spreadT > 0) return;
    this._spreadT = 1;
    for (const s of this.fleets.wei) {
      if (s.state !== 'burning') continue;
      // 铁索相连必然蔓延（延迟引燃）
      for (const n of this.fleets.chainedNeighbors(s)) {
        if (n.state !== 'burning' && n.alive && Math.random() < 0.3) {
          n.ignite(0.55);
          if (!this._spreadToastT || this.t - this._spreadToastT > 18) {
            this._spreadToastT = this.t;
            this.ui.toast('火势蔓延！');
          }
        }
      }
      // 邻近船只小概率波及
      for (const n of this.fleets.wei) {
        if (n === s || n.state === 'burning' || !n.alive) continue;
        if (V.copy(s.obj.position).distanceTo(n.obj.position) < 15 && Math.random() < 0.06) {
          n.ignite(0.45);
        }
      }
      // 火势渐旺
      if (s.burnProgress > 0.3 && Math.random() < 0.2) {
        s.setFireIntensity(Math.min(0.5 + s.burnProgress, 1));
      }
    }
  }

  _updateCombat(dt) {
    this._volleyT -= dt;
    if (this._volleyT > 0) return;
    this._volleyT = 4.5 + Math.random() * 3;

    const allies = [...this.fleets.wu, ...this.fleets.shu].filter((s) => s.alive);
    const foes = this.fleets.wei.filter((s) => s.alive);
    if (!allies.length || !foes.length) return;

    // 联军齐射（三成火箭）：每船独立择敌，箭雨落向多船
    const shooters = allies.filter(() => Math.random() < 0.6).slice(0, 6);
    for (const s of shooters) {
      const target = foes[Math.floor(Math.random() * foes.length)];
      this.effects.arrowVolley(
        [s.deckPoint(new THREE.Vector3())],
        target.deckPoint(new THREE.Vector3()),
        { perOrigin: 8, fire: Math.random() < 0.35, spread: 4 }
      );
      target.damage(1 + Math.random() * 1.5);
      if (Math.random() < 0.05 && target.state !== 'burning') target.ignite(0.4);
    }
    // 曹军零星还击（已乱阵脚）：各船也各自选目标
    const weiBack = foes.filter((s) => s.state !== 'burning').slice(0, 3);
    for (const s of weiBack) {
      if (Math.random() > 0.4) continue;
      const at = allies[Math.floor(Math.random() * allies.length)];
      this.effects.arrowVolley(
        [s.deckPoint(new THREE.Vector3())],
        at.deckPoint(new THREE.Vector3()),
        { perOrigin: 6, fire: false, spread: 4 }
      );
      at.damage(0.8);
    }
  }
}

export { BATTLE_DURATION };
