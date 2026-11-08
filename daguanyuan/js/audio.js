// 音頻：BGM（府邸／園中／夜色）、環境聲、POI 與人物講解、字幕
import { POIS } from './pois.js';
import { YUAN, waterDepth } from './layout.js';

function splitChunks(text) {
  const out = [];
  for (const s of text.match(/[^。！？；]+[。！？；]?/g) || [text]) {
    if (s.length <= 26) { out.push(s); continue; }
    let buf = '';
    for (const part of s.match(/[^，、：；]+[，、：；]?/g) || [s]) {
      if (buf && (buf + part).length > 26) { out.push(buf); buf = part; }
      else buf += part;
    }
    if (buf) out.push(buf);
  }
  return out.filter(Boolean);
}

export class AudioSys {
  constructor() {
    this.muted = false;
    this.started = false;
    this.narrations = null;
    this.current = null;
    this.played = new Set();
    this.plaqueTimer = 0;
    this.lastPlaque = null;
    this.bgmTarget = 0.42;

    // 兩軌 BGM：府邸莊重 / 園中清雅（跨大觀園牆時交叉淡入）
    this.bgmFu = new Audio('audio/bgm_fu.mp3');
    this.bgmYuan = new Audio('audio/bgm_yuan.mp3');
    this.bgmYe = new Audio('audio/bgm_ye.mp3');       // 凸碧山莊·凹晶溪館一帶（中秋賞月處）
    for (const a of [this.bgmFu, this.bgmYuan, this.bgmYe]) { a.loop = true; a.volume = 0; }
    this.inYuan = false;

    fetch('audio/narrations.json')
      .then((r) => r.json())
      .then((j) => (this.narrations = j))
      .catch(() => {});

    this.box = document.getElementById('narration-box');
    this.boxTitle = document.getElementById('narration-title');
    this.boxText = document.getElementById('narration-text');
    this.boxNext = document.getElementById('narration-next');
    this.plaque = document.getElementById('poi-plaque');

    this.compact = window.matchMedia?.('(pointer: coarse)').matches
      || new URLSearchParams(location.search).has('touch');
    if (this.compact) this.box.classList.add('compact');
    this._chunks = null; this._cum = null; this._chunkIdx = -1;
  }

  begin() {
    if (this.started) return;
    this.started = true;
    this.bgmFu.play().catch(() => {});
    this.bgmYuan.play().catch(() => {});
    this.bgmYe.play().catch(() => {});

    // 環境聲：水聲（布朗噪聲低通）+ 竹風
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      const mk = (cut, gainVal, shape) => {
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + shape * white) / (1 + shape);
          d[i] = last * 3.0;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = cut;
        const g = ctx.createGain();
        g.gain.value = gainVal;
        src.connect(f).connect(g).connect(ctx.destination);
        src.start();
        return g;
      };
      this.waterGain = mk(640, 0, 0.02);
      this.windGain = mk(1500, 0, 0.05);
    } catch (e) { /* 無 WebAudio 亦可 */ }

    setTimeout(() => this.playNarration('welcome'), 1500);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.bgmFu.muted = this.muted;
    this.bgmYuan.muted = this.muted;
    this.bgmYe.muted = this.muted;
    if (this.current) this.current.muted = this.muted;
    return !this.muted;
  }

  playNarration(id) {
    if (this.current) return false;
    const meta = this.narrations?.[id];
    const a = new Audio(`audio/${id}.mp3`);
    a.muted = this.muted;
    a.volume = 1;
    this.current = a;
    this.played.add(id);
    if (meta) {
      this.boxTitle.textContent = meta.title;
      if (this.compact) {
        this._chunks = splitChunks(meta.text);
        let acc = 0;
        this._cum = this._chunks.map((c) => (acc += c.length));
        this._chunkIdx = 0;
        this._renderSubtitle(true);
        a.addEventListener('timeupdate', () => this._syncSubtitle(a));
      } else {
        this.boxText.textContent = meta.text;
      }
      this.box.classList.remove('hidden');
    }
    const done = () => {
      this.current = null;
      this._chunks = null;
      if (this.boxNext) this.boxNext.textContent = '';
      setTimeout(() => { if (!this.current) this.box.classList.add('hidden'); }, 1400);
    };
    a.addEventListener('ended', done);
    a.addEventListener('error', done);
    a.play().catch(done);
    return true;
  }

  showPlaque(text, secs = 5) {
    this.plaque.textContent = text;
    this.plaque.classList.remove('hidden');
    this.plaqueTimer = secs;
  }

  debugSubtitle(id, idx = 0) {
    const meta = this.narrations?.[id];
    if (!meta) return false;
    this.boxTitle.textContent = meta.title;
    this._chunks = splitChunks(meta.text);
    let acc = 0;
    this._cum = this._chunks.map((c) => (acc += c.length));
    this._chunkIdx = idx;
    this._renderSubtitle(true);
    this.box.classList.remove('hidden');
    return true;
  }

  _syncSubtitle(a) {
    if (!this._chunks) return;
    const total = this._cum[this._cum.length - 1];
    const dur = a.duration && isFinite(a.duration) ? a.duration : total * 0.26;
    const prog = Math.min(0.999, a.currentTime / dur) * total;
    let idx = this._cum.findIndex((c) => prog < c);
    if (idx < 0) idx = this._cum.length - 1;
    if (idx !== this._chunkIdx) { this._chunkIdx = idx; this._renderSubtitle(false); }
  }

  _renderSubtitle(first) {
    const i = Math.max(0, this._chunkIdx);
    this.boxText.textContent = this._chunks?.[i] || '';
    if (this.boxNext) this.boxNext.textContent = this._chunks?.[i + 1] || '';
    if (!first) {
      for (const el of [this.boxText, this.boxNext]) {
        if (!el) continue;
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = '';
      }
    }
  }

  update(p, dt) {
    if (!this.started) return;

    // 過園牆換樂
    const nowYuan = p.z < YUAN.z1;
    if (nowYuan !== this.inYuan) this.inYuan = nowYuan;
    // 凸碧山莊·凹晶溪館一帶換夜色一軌（第七十五、七十六回中秋賞月處）
    const dMoon = Math.hypot(p.x - 138, p.z - 782);
    const inMoon = this.inYuan && dMoon < 95;
    const duck = this.current ? 0.10 : this.bgmTarget;
    const tFu = this.inYuan ? 0 : duck;
    const tYuan = this.inYuan && !inMoon ? duck : 0;
    const tYe = inMoon ? duck : 0;
    const k = Math.min(1, dt * 1.2);
    this.bgmFu.volume += (tFu - this.bgmFu.volume) * k;
    this.bgmYuan.volume += (tYuan - this.bgmYuan.volume) * k;
    this.bgmYe.volume += (tYe - this.bgmYe.volume) * k;

    // 水聲隨距水面遠近
    if (this.waterGain && !this.muted) {
      let near = 0;
      for (let r = 6; r <= 30; r += 8) {
        if (waterDepth(p.x + r, p.z) > -0.4 || waterDepth(p.x - r, p.z) > -0.4
          || waterDepth(p.x, p.z + r) > -0.4 || waterDepth(p.x, p.z - r) > -0.4) {
          near = Math.max(near, 1 - r / 34);
        }
      }
      const v = near * 0.16;
      this.waterGain.gain.value += (v - this.waterGain.gain.value) * Math.min(1, dt * 2.5);
    }
    if (this.windGain && !this.muted) {
      const v = this.inYuan ? 0.045 : 0.02;
      this.windGain.gain.value += (v - this.windGain.gain.value) * Math.min(1, dt * 1.5);
    }

    // POI 檢測
    for (const poi of POIS) {
      const d2 = (p.x - poi.x) ** 2 + (p.z - poi.z) ** 2;
      if (d2 < poi.r * poi.r) {
        if (this.lastPlaque !== poi.id) {
          const meta = this.narrations?.[poi.id];
          if (meta) { this.showPlaque(meta.title.split(' · ').pop()); this.lastPlaque = poi.id; }
        }
        if (!this.played.has(poi.id)) {
          if (this.playNarration(poi.id)) this.onTrigger?.(poi.id, p);
        }
        break;
      }
    }
    if (this.plaqueTimer > 0) {
      this.plaqueTimer -= dt;
      if (this.plaqueTimer <= 0) { this.plaque.classList.add('hidden'); this.lastPlaque = null; }
    }
  }
}
