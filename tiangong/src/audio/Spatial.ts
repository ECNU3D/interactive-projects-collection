/**
 * Spatial.ts —— 3D 空间音频 + 程序化合成音源｜文档 04 §5
 *
 * 外采素材缺失时，全部用 Web Audio 合成兜底（钟、鼓、风、捣药、炉火），
 * 存在 public/audio/sfx/*.webm 时优先用素材。
 */
import * as THREE from 'three/webgpu';
import { AudioCore, makeImpulse } from './AudioCore';

export class SpatialAudio {
  private convolver: ConvolverNode;
  private reverbGain: GainNode;
  private currentIR = '';
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  constructor(private audio: AudioCore, private camera: THREE.Camera) {
    this.convolver = audio.ctx.createConvolver();
    this.reverbGain = audio.ctx.createGain();
    this.reverbGain.gain.value = 0.5;
    this.convolver.connect(this.reverbGain);
    this.reverbGain.connect(audio.ambientBus);
    this.setSpace('outdoor');
  }

  /** 空间混响切换（0.5s 交叉淡化用增益近似）｜文档 04 §5.3 */
  setSpace(space: 'outdoor' | 'palace' | 'hall' | 'lingxiao' | 'danfang' | 'moon' | 'garden'): void {
    if (this.currentIR === space) return;
    this.currentIR = space;
    const table = { outdoor: [0.4, 3, 1], palace: [1.2, 2.5, 1], hall: [2.0, 2.2, 0.9], lingxiao: [4.5, 2.0, 1], danfang: [1.5, 2.4, 0.8], moon: [3.0, 2.0, 1.6], garden: [0.8, 2.6, 1.1] } as const;
    const [sec, decay, bright] = table[space];
    this.convolver.buffer = makeImpulse(this.audio.ctx, sec, decay, bright);
  }

  private listenerPos = new THREE.Vector3();
  private listenerFwd = new THREE.Vector3();

  updateListener(): void {
    const ctx = this.audio.ctx;
    this.camera.getWorldPosition(this.listenerPos);
    this.camera.getWorldDirection(this.listenerFwd);
    const l = ctx.listener;
    const up = this.camera.up;
    if (l.forwardX) {
      l.positionX.value = this.listenerPos.x;
      l.positionY.value = this.listenerPos.y;
      l.positionZ.value = this.listenerPos.z;
      l.forwardX.value = this.listenerFwd.x;
      l.forwardY.value = this.listenerFwd.y;
      l.forwardZ.value = this.listenerFwd.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else {
      l.setPosition(this.listenerPos.x, this.listenerPos.y, this.listenerPos.z);
      l.setOrientation(this.listenerFwd.x, this.listenerFwd.y, this.listenerFwd.z, up.x, up.y, up.z);
    }
  }

  /** 创建一个 3D 点音源（循环播放），返回控制柄 */
  attachLoop(obj: THREE.Object3D, makeSource: (ctx: AudioContext) => AudioScheduledSourceNode, opts: { refDistance?: number; maxDistance?: number; rolloff?: number; gain?: number } = {}): { stop(): void } {
    const ctx = this.audio.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = opts.refDistance ?? 8;
    panner.maxDistance = opts.maxDistance ?? 500;
    panner.rolloffFactor = opts.rolloff ?? 1.2;
    const gain = ctx.createGain();
    gain.gain.value = opts.gain ?? 1;
    const src = makeSource(ctx);
    src.connect(gain);
    gain.connect(panner);
    panner.connect(this.audio.ambientBus);
    panner.connect(this.convolver);
    src.start();

    const world = new THREE.Vector3();
    const sync = () => {
      obj.getWorldPosition(world);
      panner.positionX.value = world.x;
      panner.positionY.value = world.y;
      panner.positionZ.value = world.z;
    };
    sync();
    const iv = setInterval(sync, 500);
    return {
      stop: () => {
        clearInterval(iv);
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
        gain.disconnect();
      },
    };
  }

  /** 风（全场 2D 环境）：粉噪 + 带通，中心频率随高度上移，音量随速度 */
  startWind(): void {
    const ctx = this.audio.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      d[i] = (b0 + b1 + b2 + white * 0.05) * 0.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.audio.ambientBus);
    src.start();
    this.windSrc = src;
    this.windGain = gain;
    this.windFilter = filter;
  }

  /** 风声随高度与速度（每帧） */
  updateWind(altitude: number, speed: number): void {
    if (!this.windGain || !this.windFilter) return;
    const t = this.audio.ctx.currentTime;
    const targetF = 300 + Math.min(1, altitude / 600) * 900 + speed * 2;
    const targetG = 0.18 + Math.min(1, speed / 180) * 0.5;
    this.windFilter.frequency.linearRampToValueAtTime(targetF, t + 0.3);
    this.windGain.gain.linearRampToValueAtTime(targetG, t + 0.3);
  }
}

/** ── 合成音源工厂（文档 04 §5.1 标「合成」的项） ── */

/** 金钟/磬：多泛音指数衰减 */
export function bellSource(ctx: AudioContext, base = 220): AudioScheduledSourceNode {
  const freqs = [1, 2.02, 2.94, 3.99, 5.43];
  const gains = [1, 0.6, 0.4, 0.25, 0.12];
  const master = ctx.createGain();
  master.gain.value = 1;
  // 循环敲击由 attachLoop 外的定时器负责——这里用"长衰减+循环"近似
  const buf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / ctx.sampleRate;
    let s = 0;
    for (let h = 0; h < freqs.length; h++) {
      s += Math.sin(2 * Math.PI * base * freqs[h] * t) * gains[h] * Math.exp(-t * (1.2 + h * 0.5));
    }
    d[i] = s * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopEnd = 6;
  return src;
}

/** 捣药杵：0.8s 一下的节奏木击 */
export function pestleSource(ctx: AudioContext): AudioScheduledSourceNode {
  const beat = 0.8;
  const beats = 8;
  const buf = ctx.createBuffer(1, ctx.sampleRate * beat * beats, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let bIdx = 0; bIdx < beats; bIdx++) {
    const start = Math.floor(bIdx * beat * ctx.sampleRate);
    const len = Math.floor(ctx.sampleRate * 0.12);
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      d[start + i] += (Math.sin(2 * Math.PI * 180 * t) + Math.sin(2 * Math.PI * 92 * t) * 0.8) * Math.exp(-t * 45) * (bIdx % 2 ? 0.7 : 1);
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/** 炉火：低频呼呼 + 随机爆响 */
export function furnaceSource(ctx: AudioContext): AudioScheduledSourceNode {
  const len = ctx.sampleRate * 5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    lp += (white - lp) * 0.08;
    d[i] = lp * 1.4;
    // 偶尔爆响
    if (Math.random() < 0.0006) {
      for (let j = 0; j < 800 && i + j < len; j++) {
        d[i + j] += (Math.random() * 2 - 1) * Math.exp(-j / 120) * 0.5;
      }
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

/** 单次敲钟（交互音效，非循环） */
export function strikeBell(audio: AudioCore, base = 180): void {
  const ctx = audio.ctx;
  const src = bellSource(ctx, base) as AudioBufferSourceNode;
  src.loop = false;
  const g = ctx.createGain();
  g.gain.value = 1.2;
  src.connect(g);
  g.connect(audio.sfxBus);
  src.start();
}
