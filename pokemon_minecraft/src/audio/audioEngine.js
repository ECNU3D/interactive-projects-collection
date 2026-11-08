// 运行时音频引擎（设计文档 §14.1）：Web Audio + BGM/SFX/语音三总线 + 环境音层
// BGM/语音优先播放离线预生成 mp3（assets/audio/manifest.json），缺失时用 8-bit 程序化合成回退
import { SFX_PRESETS, cryParams } from '../data/sfxPresets.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buses = null;
    this.volumes = { bgm: 0.6, sfx: 0.8, voice: 0.9 };
    this.manifest = null;
    this.currentBgm = null;      // { key, source|seq, gain }
    this.bgmChannels = [null, null];  // 双通道交叉淡入淡出
    this.bgmActive = 0;
    this.sfxPlaying = {};        // 同种并发上限 3
    this.pendingBgm = null;
    this.ambienceKey = null;
    this.ambienceNode = null;
    this._noiseBuf = null;
  }

  // 首次用户手势后调用
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const mk = (v) => { const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.ctx.destination); return g; };
    this.buses = { bgm: mk(this.volumes.bgm), sfx: mk(this.volumes.sfx), voice: mk(this.volumes.voice) };
    // 加载素材清单（离线生成产物；不存在则纯合成模式）
    fetch('assets/audio/manifest.json').then(r => r.ok ? r.json() : null).then(m => { this.manifest = m; }).catch(() => {});
    if (this.pendingBgm) { const k = this.pendingBgm; this.pendingBgm = null; this.bgm(k); }
  }

  get ready() { return !!this.ctx; }

  setVolume(bus, v) {
    this.volumes[bus] = v;
    if (this.buses) this.buses[bus].gain.value = v;
  }

  noiseBuffer() {
    if (this._noiseBuf) return this._noiseBuf;
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  // ---- SFX 合成（§14.4 配方表） ----
  sfx(name, { pitchVar = true, bus = 'sfx' } = {}) {
    if (!this.ctx) return;
    const preset = SFX_PRESETS[name];
    if (!preset) return;
    this.sfxPlaying[name] = this.sfxPlaying[name] || 0;
    if (this.sfxPlaying[name] >= 3) return;               // 并发上限
    this.sfxPlaying[name]++;
    setTimeout(() => this.sfxPlaying[name]--, 400);
    const rate = pitchVar ? 1 + (Math.random() - 0.5) * 0.2 : 1;   // ±10% 音高
    for (const layer of preset) this._playLayer(layer, this.buses[bus], rate);
  }

  _playLayer(layer, dest, rate = 1, when = 0) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (layer.delay || 0) + when;
    let src;
    if (layer.src === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
    } else {
      src = ctx.createOscillator();
      src.type = layer.wave || 'square';
      src.frequency.setValueAtTime((layer.freq || 440) * rate, t0);
      if (layer.freqEnd) src.frequency.exponentialRampToValueAtTime(Math.max(20, layer.freqEnd * rate), t0 + layer.dur);
    }
    let node = src;
    if (layer.filter) {
      const f = ctx.createBiquadFilter();
      f.type = layer.filter.type;
      f.frequency.setValueAtTime(layer.filter.freq, t0);
      if (layer.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, layer.filter.freqEnd), t0 + layer.dur);
      node.connect(f); node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime((layer.vol || 0.4), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + layer.dur + 0.03);
    node.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + layer.dur + 0.05);
  }

  // ---- 3D 空间音效（PannerNode 按距离衰减定位，听者=镜头） ----
  sfx3d(name, pos) {
    if (!this.ctx) return;
    const preset = SFX_PRESETS[name];
    if (!preset) return;
    const cam = window.__camera;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 4;
    panner.maxDistance = 60;
    panner.rolloffFactor = 1;
    panner.positionX.value = pos.x; panner.positionY.value = pos.y; panner.positionZ.value = pos.z;
    if (cam && this.ctx.listener.positionX) {
      this.ctx.listener.positionX.value = cam.position.x;
      this.ctx.listener.positionY.value = cam.position.y;
      this.ctx.listener.positionZ.value = cam.position.z;
    }
    panner.connect(this.buses.sfx);
    for (const layer of preset) this._playLayer(layer, panner);
  }

  // ---- 精灵叫声（§14.4：每种一组程序化参数，同族共享变调） ----
  cry(speciesId, kind = 'encounter') {
    if (!this.ctx) return;
    const p = cryParams(speciesId);
    const layer = { src: 'tone', wave: p.wave, freq: p.freq, freqEnd: p.freqEnd, dur: p.dur, vol: 0.35 };
    if (kind === 'hurt') { layer.freq *= 1.3; layer.dur *= 0.5; }
    if (kind === 'faint') { layer.freqEnd = p.freq * 0.4; layer.dur *= 1.4; layer.wave = 'sawtooth'; }
    this._playLayer(layer, this.buses.sfx);
    if (p.chirp) this._playLayer({ ...layer, delay: p.dur * 0.7, freq: p.freq * 1.2 }, this.buses.sfx);
  }

  // ---- BGM：mp3 或芯片合成回退；双通道 2s 交叉淡入淡出 ----
  bgm(key) {
    if (!this.ctx) { this.pendingBgm = key; return; }
    if (this.currentBgm === key) return;
    this.currentBgm = key;
    const file = this.manifest?.bgm?.[key];
    if (file) this._bgmMp3('assets/audio/bgm/' + file, key);
    else this._bgmSynth(key);
  }

  _crossfadeTo(node) {
    const prev = this.bgmChannels[this.bgmActive];
    this.bgmActive = 1 - this.bgmActive;
    this.bgmChannels[this.bgmActive] = node;
    const t = this.ctx.currentTime;
    if (prev) {
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, t);
      prev.gain.gain.linearRampToValueAtTime(0, t + 2);
      setTimeout(() => prev.stop?.(), 2200);
    }
    node.gain.gain.setValueAtTime(0, t);
    node.gain.gain.linearRampToValueAtTime(1, t + 2);
  }

  async _bgmMp3(url, key) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('404');
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      if (this.currentBgm !== key) return;         // 已切歌
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const gain = this.ctx.createGain();
      src.connect(gain); gain.connect(this.buses.bgm);
      src.start();
      this._crossfadeTo({ gain, stop: () => { try { src.stop(); } catch {} } });
    } catch {
      this._bgmSynth(key);                          // mp3 缺失 → 合成回退
    }
  }

  // 8-bit 芯片音乐循环（离线素材缺失时的回退，风格与像素画面统一）
  _bgmSynth(key) {
    const seq = BGM_LOOPS[key] || BGM_LOOPS.grassland;
    const gain = this.ctx.createGain();
    gain.connect(this.buses.bgm);
    let step = 0;
    const stepDur = 60 / seq.tempo / 4;
    const timer = setInterval(() => {
      if (!this.ctx) return;
      const bar = Math.floor(step / 16) % seq.lead.length;
      const s16 = step % 16;
      const lead = seq.lead[bar][s16];
      const bass = seq.bass[bar % seq.bass.length][s16 % seq.bass[bar % seq.bass.length].length];
      if (lead) this._chiptuneNote(lead, stepDur * (seq.legato || 1.8), seq.wave || 'square', 0.16, gain);
      if (bass) this._chiptuneNote(bass, stepDur * 1.5, 'triangle', 0.2, gain);
      if (seq.drum && s16 % 4 === 0) this._chiptuneDrum(gain, s16 % 8 === 0 ? 90 : 60);
      step++;
    }, stepDur * 1000);
    this._crossfadeTo({ gain, stop: () => clearInterval(timer) });
  }

  _chiptuneNote(midi, dur, wave, vol, dest) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.setValueAtTime(vol, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _chiptuneDrum(dest, freq) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(40, t0 + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + 0.12);
  }

  // 一次性短乐句（jingle）：暂停 BGM 播完淡回
  jingle(name) {
    if (!this.ctx) return;
    const notes = JINGLES[name];
    if (!notes) return;
    const cur = this.bgmChannels[this.bgmActive];
    if (cur) cur.gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.buses.bgm);
    let t = 0;
    for (const [midi, dur] of notes) {
      setTimeout(() => midi && this._chiptuneNote(midi, dur * 0.95, 'square', 0.2, gain), t * 1000);
      t += dur;
    }
    setTimeout(() => {
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
      if (cur) cur.gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1);
      setTimeout(() => gain.disconnect(), 600);
    }, t * 1000);
  }

  // ---- 语音（离线预生成 mp3；缺失则静默，文字照常显示） ----
  voice(dialogueKey) {
    if (!this.ctx || !dialogueKey) return null;
    const file = this.manifest?.voice?.[dialogueKey];
    if (!file) return null;
    const url = 'assets/audio/voice/' + file;
    fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(buf => this.ctx.decodeAudioData(buf)).then(ab => {
      this.stopVoice();
      const src = this.ctx.createBufferSource();
      src.buffer = ab;
      src.connect(this.buses.voice);
      src.start();
      this._voiceSrc = src;
    }).catch(() => {});
    return true;
  }

  stopVoice() { try { this._voiceSrc?.stop(); } catch {} this._voiceSrc = null; }

  // ---- 环境音（§14.5：第四条低音量循环层） ----
  ambience(key) {
    if (!this.ctx || this.ambienceKey === key) return;
    this.ambienceKey = key;
    if (this.ambienceNode) {
      const old = this.ambienceNode;
      old.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
      setTimeout(() => old.stop(), 2200);
      this.ambienceNode = null;
    }
    const conf = AMBIENCE[key];
    if (!conf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(); src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = conf.filter; f.frequency.value = conf.freq; f.Q.value = conf.q || 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(conf.vol, this.ctx.currentTime + 2);
    src.connect(f); f.connect(gain); gain.connect(this.buses.bgm);
    src.start();
    this.ambienceNode = { gain, stop: () => { try { src.stop(); } catch {} } };
  }
}

// ---- 芯片音乐循环谱（16 步 × N 小节；MIDI 音高，0=休止） ----
const _ = 0;
const BGM_LOOPS = {
  title:     { tempo: 100, wave: 'square', lead: [[72,_,76,_,79,_,76,_,72,_,76,_,79,_,84,_,79,_],[74,_,77,_,81,_,77,_,74,_,77,_,81,_,86,_,81,_]], bass: [[48,_,_,_,48,_,_,_,48,_,_,_,48,_,_,_],[50,_,_,_,50,_,_,_,50,_,_,_,50,_,_,_]], drum: true },
  grassland: { tempo: 112, wave: 'square', lead: [[72,_,76,_,79,_,_,_,76,_,72,_,74,_,_,_,_],[69,_,72,_,76,_,_,_,74,_,69,_,72,_,_,_,_]], bass: [[48,_,_,_,52,_,_,_,48,_,_,_,52,_,_,_],[45,_,_,_,48,_,_,_,45,_,_,_,48,_,_,_]], drum: true },
  forest:    { tempo: 88, wave: 'triangle', lead: [[69,_,_,72,_,_,76,_,_,74,_,_,72,_,_,_],[67,_,_,71,_,_,74,_,_,72,_,_,71,_,_,_]], bass: [[45,_,_,_,_,_,52,_,_,_,_,_,45,_,_,_],[43,_,_,_,_,_,50,_,_,_,_,_,43,_,_,_]] },
  lake:      { tempo: 92, wave: 'sine', lead: [[74,_,_,_,78,_,_,_,81,_,_,_,78,_,_,_],[76,_,_,_,81,_,_,_,79,_,_,_,76,_,_,_]], bass: [[50,_,_,_,_,_,_,_,50,_,_,_,_,_,_,_],[48,_,_,_,_,_,_,_,48,_,_,_,_,_,_,_]] },
  volcano:   { tempo: 96, wave: 'sawtooth', lead: [[52,_,52,_,_,55,_,_,52,_,52,_,_,50,_,_],[52,_,52,_,_,55,_,_,57,_,55,_,52,_,_,_]], bass: [[40,_,_,40,_,_,40,_,40,_,_,40,_,_,40,_],[40,_,_,40,_,_,40,_,41,_,_,41,_,_,41,_]], drum: true },
  snow:      { tempo: 72, wave: 'sine', lead: [[76,_,_,_,_,_,79,_,_,_,_,_,76,_,_,_],[74,_,_,_,_,_,77,_,_,_,_,_,74,_,_,_]], bass: [[52,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],[50,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_]] },
  night:     { tempo: 66, wave: 'triangle', lead: [[69,_,_,_,72,_,_,_,76,_,_,_,_,_,_,_],[67,_,_,_,71,_,_,_,74,_,_,_,_,_,_,_]], bass: [[45,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],[43,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_]] },
  village:   { tempo: 108, wave: 'square', lead: [[72,_,74,_,76,_,77,_,79,_,_,_,76,_,_,_],[74,_,76,_,77,_,79,_,81,_,_,_,79,_,_,_]], bass: [[48,_,48,_,45,_,45,_,48,_,_,_,48,_,_,_],[50,_,50,_,47,_,47,_,48,_,_,_,48,_,_,_]], drum: true },
  battle_wild: { tempo: 152, wave: 'square', lead: [[72,_,72,_,75,_,72,_,74,_,74,_,77,_,74,_,_],[72,_,72,_,75,_,72,_,79,_,77,_,75,_,74,_,_]], bass: [[48,48,_,48,_,48,48,_,48,48,_,48,_,48,48,_],[46,46,_,46,_,46,46,_,46,46,_,46,_,46,46,_]], drum: true, legato: 1 },
  battle_gym:  { tempo: 160, wave: 'sawtooth', lead: [[64,_,67,_,64,_,67,_,69,_,67,_,64,_,67,_,_],[65,_,69,_,65,_,69,_,72,_,69,_,65,_,69,_,_]], bass: [[40,40,_,40,_,40,40,_,43,43,_,43,_,43,43,_],[41,41,_,41,_,41,41,_,45,45,_,45,_,45,45,_]], drum: true, legato: 1 },
};

// jingle 旋律 [MIDI, 秒]
const JINGLES = {
  victory:   [[72,0.12],[76,0.12],[79,0.12],[84,0.3],[0,0.06],[79,0.12],[84,0.4]],
  capture:   [[76,0.1],[79,0.1],[84,0.1],[88,0.35]],
  evolution: [[60,0.15],[64,0.15],[67,0.15],[72,0.15],[76,0.15],[79,0.15],[84,0.5]],
  defeat:    [[64,0.25],[60,0.25],[57,0.25],[48,0.6]],
};

// 环境音配置（滤波噪声床）
const AMBIENCE = {
  grass:   { filter: 'bandpass', freq: 3000, q: 0.5, vol: 0.05 },   // 鸟鸣般高频窸窣
  forest:  { filter: 'bandpass', freq: 2200, q: 0.6, vol: 0.06 },
  lake:    { filter: 'lowpass',  freq: 900,  q: 0.7, vol: 0.07 },   // 流水
  volcano: { filter: 'lowpass',  freq: 180,  q: 0.8, vol: 0.09 },   // 低频隆隆
  snow:    { filter: 'highpass', freq: 1200, q: 0.5, vol: 0.06 },   // 风声
  night:   { filter: 'bandpass', freq: 4000, q: 1.2, vol: 0.04 },   // 虫鸣
  village: { filter: 'bandpass', freq: 800,  q: 0.4, vol: 0.05 },   // 人声嘈杂感
};
