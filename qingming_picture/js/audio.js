// 音频：BGM、汴河环境声、POI 讲解触发与字幕
import { POIS } from './pois.js';
import { RIVER } from './layout.js';

// 紧凑字幕用：整段切为短句（先按句读切，过长再按逗顿切分）
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
    this.current = null;        // 正在播放的讲解 <audio>
    this.played = new Set();
    this.plaqueTimer = 0;
    this.lastPlaque = null;
    this.bgmTarget = 0.45;

    this.bgm = new Audio('audio/bgm.mp3');
    this.bgm.loop = true;
    this.bgm.volume = 0;

    fetch('audio/narrations.json')
      .then((r) => r.json())
      .then((j) => (this.narrations = j))
      .catch(() => {});

    this.box = document.getElementById('narration-box');
    this.boxTitle = document.getElementById('narration-title');
    this.boxText = document.getElementById('narration-text');
    this.boxNext = document.getElementById('narration-next');
    this.plaque = document.getElementById('poi-plaque');

    // 触屏：顶部紧凑滚动字幕
    this.compact = window.matchMedia?.('(pointer: coarse)').matches
      || new URLSearchParams(location.search).has('touch');
    if (this.compact) this.box.classList.add('compact');
    this._chunks = null;   // 当前讲解的短句序列（紧凑模式）
    this._cum = null;      // 累计字数（估算播放进度）
    this._chunkIdx = -1;
  }

  begin() {
    if (this.started) return;
    this.started = true;
    this.bgm.play().catch(() => {});

    // 汴河水声（WebAudio 噪声）
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;      // 布朗噪声近似水声
        data[i] = last * 3.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      this.riverGain = ctx.createGain();
      this.riverGain.gain.value = 0;
      src.connect(filter).connect(this.riverGain).connect(ctx.destination);
      src.start();
    } catch (e) { /* 无 WebAudio 也不影响 */ }

    // 开卷欢迎
    setTimeout(() => this.playNarration('welcome'), 1400);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.bgm.muted = this.muted;
    if (this.current) this.current.muted = this.muted;
    if (this.riverGain) this.riverGain.gain.value = this.muted ? 0 : this.riverGain.gain.value;
    return !this.muted;
  }

  playNarration(id) {
    if (this.current) return false;              // 一次只讲一段
    const meta = this.narrations?.[id];
    const a = new Audio(`audio/${id}.mp3`);
    a.muted = this.muted;
    a.volume = 1;
    this.current = a;
    this.played.add(id);
    if (meta) {
      this.boxTitle.textContent = meta.title;
      if (this.compact) {
        // 紧凑字幕：切短句，随 timeupdate 逐句滚动
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
      setTimeout(() => {
        if (!this.current) this.box.classList.add('hidden');
      }, 1200);
    };
    a.addEventListener('ended', done);
    a.addEventListener('error', done);
    a.play().catch(done);
    return true;
  }

  // 调试：直接显示紧凑字幕（?subtest 截图验证用）
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

  // 紧凑字幕：按播放进度（时长未知则按字数估算）定位当前短句
  _syncSubtitle(a) {
    if (!this._chunks) return;
    const total = this._cum[this._cum.length - 1];
    const dur = a.duration && isFinite(a.duration) ? a.duration : total * 0.26;
    const prog = Math.min(0.999, a.currentTime / dur) * total;
    let idx = this._cum.findIndex((c) => prog < c);
    if (idx < 0) idx = this._cum.length - 1;
    if (idx !== this._chunkIdx) {
      this._chunkIdx = idx;
      this._renderSubtitle(false);
    }
  }

  _renderSubtitle(first) {
    const i = Math.max(0, this._chunkIdx);
    this.boxText.textContent = this._chunks?.[i] || '';
    if (this.boxNext) this.boxNext.textContent = this._chunks?.[i + 1] || '';
    if (!first) {
      // 重放滚动动画
      for (const el of [this.boxText, this.boxNext]) {
        if (!el) continue;
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = '';
      }
    }
  }

  update(playerPos, dt) {
    if (!this.started) return;

    // BGM 闪避（讲解时压低）
    const target = this.current ? 0.12 : this.bgmTarget;
    this.bgm.volume += (target - this.bgm.volume) * Math.min(1, dt * 2.5);

    // 河声随距离
    if (this.riverGain && !this.muted) {
      const dx = playerPos.x < RIVER.x0 ? RIVER.x0 - playerPos.x
               : playerPos.x > RIVER.x1 ? playerPos.x - RIVER.x1 : 0;
      const v = Math.max(0, 1 - dx / 90) * 0.14;
      this.riverGain.gain.value += (v - this.riverGain.gain.value) * Math.min(1, dt * 3);
    }

    // POI 检测
    for (const poi of POIS) {
      const d2 = (playerPos.x - poi.x) ** 2 + (playerPos.z - poi.z) ** 2;
      if (d2 < poi.r * poi.r) {
        // 题签提示
        if (this.lastPlaque !== poi.id) {
          const meta = this.narrations?.[poi.id];
          if (meta) {
            this.plaque.textContent = meta.title;
            this.plaque.classList.remove('hidden');
            this.lastPlaque = poi.id;
            this.plaqueTimer = 5;
          }
        }
        // 讲解（每处一次）；确认开讲后联动场景（如召回驼队、驴队）
        if (!this.played.has(poi.id) && this.playNarration(poi.id)) {
          this.onTrigger?.(poi.id, playerPos);
        }
        break;
      }
    }
    if (this.plaqueTimer > 0) {
      this.plaqueTimer -= dt;
      if (this.plaqueTimer <= 0) {
        this.plaque.classList.add('hidden');
        this.lastPlaque = null;
      }
    }
  }
}
