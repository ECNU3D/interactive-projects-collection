// 赤壁之战 · 音频模块 —— BGM 循环 + 解说配音（配音时 BGM 自动闪避）
// 音频文件由 配音配乐/generate_audio.mjs 生成；缺失时静默降级（字幕仍正常显示）
import { narrAudio, BGM_FILE, EVENTS } from './script.js';

export class BattleAudio {
  constructor() {
    this.bgm = new Audio(BGM_FILE);
    this.bgm.loop = true;
    this.bgm.volume = 0;
    this._bgmTarget = 0;
    this.muted = false;
    this._cur = null;
    // 解说表必须同步建好：首段解说在开演第一帧（t=0）即触发，
    // 异步填表会让"隔江对峙"一段永远赶不上播放
    this._narr = new Map();
    for (const ev of EVENTS) {
      const a = new Audio(narrAudio(ev.id));
      a.preload = 'auto';
      a.addEventListener('error', () => this._narr.delete(ev.id), { once: true });
      this._narr.set(ev.id, a);
    }
  }

  /** 用户手势后调用：启动 BGM */
  unlock() {
    this.bgm.play().then(() => { this._bgmTarget = 0.5; }).catch(() => { });
  }

  playNarration(id) {
    if (this._cur) { this._cur.pause(); this._cur = null; }
    const a = this._narr.get(id);
    if (!a || this.muted) return;
    this._cur = a;
    a.currentTime = 0;
    this._bgmDuck = true;
    a.onended = () => { if (this._cur === a) this._cur = null; this._bgmDuck = false; };
    a.play().catch(() => { this._bgmDuck = false; });
  }

  toggleMute() {
    this.muted = !this.muted;
    this.bgm.muted = this.muted;
    if (this._cur) this._cur.muted = this.muted;
    return this.muted;
  }

  /** 每帧微调音量（闪避与淡入淡出） */
  update(dt) {
    const want = this.muted ? 0 : (this._bgmDuck ? 0.15 : this._bgmTarget);
    this.bgm.volume += (want - this.bgm.volume) * Math.min(dt * 2.5, 1);
  }
}
