/**
 * Music.ts —— BGM 三层动态混音｜文档 02 §7.4 / 文档 04 §4
 *
 * 三层 stem 同 BPM 同调性，运行时 gain 交叉淡入。
 * public/audio/bgm/{base,melody,grand}.webm 存在时用真实音频；
 * 缺失时用程序化持续音兜底（笙式长音 + 磬点缀），保证"极安静"的底盘。
 */
import { AudioCore } from './AudioCore';

export interface LayerMix {
  base: number;
  melody: number;
  grand: number;
}

export class Music {
  private gains: Record<'base' | 'melody' | 'grand', GainNode> | null = null;
  private current: LayerMix = { base: 1, melody: 0, grand: 0 };
  private loaded = false;
  private sceneSrc: AudioBufferSourceNode | null = null;
  private sceneGain: GainNode | null = null;
  private sceneName = '';
  private sceneBuffers = new Map<string, AudioBuffer | null>();

  constructor(private audio: AudioCore) {}

  async start(): Promise<void> {
    const ctx = this.audio.ctx;
    const gains = {
      base: ctx.createGain(),
      melody: ctx.createGain(),
      grand: ctx.createGain(),
    };
    this.gains = gains;
    gains.base.connect(this.audio.musicBus);
    gains.melody.connect(this.audio.musicBus);
    gains.grand.connect(this.audio.musicBus);
    gains.base.gain.value = 1;
    gains.melody.gain.value = 0;
    gains.grand.gain.value = 0;

    // 尝试加载真实 stem
    const names = ['base', 'melody', 'grand'] as const;
    const buffers = await Promise.all(
      names.map(async (n) => {
        try {
          const res = await fetch(`audio/bgm/layer_${n}.webm`);
          if (!res.ok) return null;
          return await ctx.decodeAudioData(await res.arrayBuffer());
        } catch {
          return null;
        }
      }),
    );

    names.forEach((n, i) => {
      const buf = buffers[i];
      const src = ctx.createBufferSource();
      src.buffer = buf ?? synthStem(ctx, n);
      src.loop = true;
      src.connect(gains[n]);
      src.start();
    });
    this.loaded = true;
    console.info(`[music] BGM ${buffers.some(Boolean) ? '使用预生成 stem' : '使用程序化兜底'}`);
    this.apply(this.current, 0.1);
  }

  /** 区域/事件驱动三层电平，3s 交叉淡入（文档 04 §4.5） */
  apply(mix: Partial<LayerMix>, fadeSec = 3): void {
    this.current = { ...this.current, ...mix };
    if (!this.gains || !this.loaded) return;
    const t = this.audio.ctx.currentTime;
    for (const k of ['base', 'melody', 'grand'] as const) {
      const g = this.gains[k];
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      // 场景曲播放时三层压底
      const target = this.sceneName ? this.current[k] * 0.15 : this.current[k];
      g.gain.linearRampToValueAtTime(target, t + fadeSec);
    }
  }

  /** 场景专属曲目（文档 04 §4.4）：存在文件则切入，否则维持三层 */
  async setSceneTrack(name: string): Promise<void> {
    if (name === this.sceneName) return;
    const ctx = this.audio.ctx;
    // 预取/校验曲目存在性（缺失则忽略）
    if (!this.sceneBuffers.has(name)) {
      try {
        const res = await fetch(`audio/bgm/scene_${name}.webm`);
        this.sceneBuffers.set(name, res.ok ? await ctx.decodeAudioData(await res.arrayBuffer()) : null);
      } catch {
        this.sceneBuffers.set(name, null);
      }
    }
    const buf = this.sceneBuffers.get(name);
    if (!buf) return; // 无该场景曲：维持三层混音
    this.sceneName = name;
    const t = ctx.currentTime;
    // 旧曲淡出
    if (this.sceneSrc && this.sceneGain) {
      const old = this.sceneGain;
      old.gain.linearRampToValueAtTime(0, t + 2);
      const oldSrc = this.sceneSrc;
      setTimeout(() => {
        try {
          oldSrc.stop();
        } catch {
          /* stopped */
        }
        old.disconnect();
      }, 2400);
    }
    // 新曲淡入
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.85, t + 3);
    src.connect(gain);
    gain.connect(this.audio.musicBus);
    src.start();
    this.sceneSrc = src;
    this.sceneGain = gain;
    this.apply({}, 2); // 三层压底
  }

  /** 离开场景曲区域：淡出，三层恢复 */
  clearSceneTrack(): void {
    if (!this.sceneName) return;
    this.sceneName = '';
    const t = this.audio.ctx.currentTime;
    if (this.sceneSrc && this.sceneGain) {
      const old = this.sceneGain;
      old.gain.linearRampToValueAtTime(0, t + 2.5);
      const oldSrc = this.sceneSrc;
      setTimeout(() => {
        try {
          oldSrc.stop();
        } catch {
          /* stopped */
        }
        old.disconnect();
      }, 2800);
    }
    this.sceneSrc = null;
    this.sceneGain = null;
    this.apply({}, 3);
  }
}

/**
 * 程序化兜底 stem：D 羽调式、60 BPM 感。
 * base = 笙式长音（D3+A3 五度 + 呼吸感起伏）；melody = 稀疏五声音阶挑音；grand = 低频钟鼓脉动。
 */
function synthStem(ctx: AudioContext, layer: 'base' | 'melody' | 'grand'): AudioBuffer {
  const dur = 24; // 24s 循环
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(2, rate * dur, rate);
  const D3 = 146.83;
  const penta = [D3, D3 * 1.125, D3 * 1.3348, D3 * 1.5, D3 * 1.6818, D3 * 2]; // 羽调式五声

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    if (layer === 'base') {
      for (let i = 0; i < d.length; i++) {
        const t = i / rate;
        const breath = 0.6 + 0.4 * Math.sin((2 * Math.PI * t) / 12);
        let s = 0;
        for (const [f, g] of [
          [D3, 0.4],
          [D3 * 1.5, 0.25],
          [D3 * 2, 0.15],
          [D3 * 2.02, 0.1],
        ] as const) {
          s += Math.sin(2 * Math.PI * f * t + ch * 0.3) * g;
        }
        // 偶发磬声
        const bellT = t % 12;
        if (bellT < 1.5) {
          s += Math.sin(2 * Math.PI * D3 * 4 * bellT) * Math.exp(-bellT * 4) * 0.25;
        }
        d[i] = s * breath * 0.18;
      }
    } else if (layer === 'melody') {
      let noteStart = 2;
      let ni = 0;
      while (noteStart < dur - 2) {
        const f = penta[[0, 2, 4, 1, 3, 5, 2][ni % 7]] * 2;
        const noteLen = 1.5 + (ni % 3) * 0.5;
        const start = Math.floor(noteStart * rate);
        const len = Math.floor(noteLen * rate);
        for (let i = 0; i < len && start + i < d.length; i++) {
          const t = i / rate;
          const env = Math.sin((Math.PI * i) / len);
          d[start + i] += (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.01 * t)) * env * 0.12;
        }
        noteStart += noteLen + 1.5 + (ni % 2);
        ni++;
      }
    } else {
      // grand：每 4s 一次低钟 + 大鼓脉动
      for (let beat = 0; beat < dur / 4; beat++) {
        const start = Math.floor(beat * 4 * rate);
        const len = Math.floor(2.2 * rate);
        for (let i = 0; i < len && start + i < d.length; i++) {
          const t = i / rate;
          d[start + i] +=
            (Math.sin(2 * Math.PI * D3 * 0.5 * t) * 0.7 + Math.sin(2 * Math.PI * D3 * 1.01 * t) * 0.3) *
            Math.exp(-t * 2.2) *
            0.5;
        }
      }
    }
  }
  return buf;
}
