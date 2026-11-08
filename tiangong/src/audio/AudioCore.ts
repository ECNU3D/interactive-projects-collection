/**
 * AudioCore.ts —— AudioContext、总线、解锁｜文档 02 §7.1 / 文档 04 §7.4
 *
 * 总线：master ← limiter；voice 1.00 / sfx 0.70 / music 0.35 / ambient 0.45。
 * 自动播放：「入天门」按钮 = 用户手势，resume + 播一帧静音彻底解锁 iOS。
 */
export class AudioCore {
  ctx!: AudioContext;
  master!: GainNode;
  musicBus!: GainNode;
  voiceBus!: GainNode;
  sfxBus!: GainNode;
  ambientBus!: GainNode;
  private unlocked = false;

  init(): void {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    // brickwall limiter（四路总和 2.5，必须挂）
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(limiter);

    this.musicBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambientBus = ctx.createGain();
    this.musicBus.gain.value = 0.35;
    this.voiceBus.gain.value = 1.0;
    this.sfxBus.gain.value = 0.7;
    this.ambientBus.gain.value = 0.45;
    // voice 加轻微 compressor + 提亮（文档 04 §5.4）
    const voiceComp = ctx.createDynamicsCompressor();
    voiceComp.ratio.value = 3;
    const voiceEQ = ctx.createBiquadFilter();
    voiceEQ.type = 'peaking';
    voiceEQ.frequency.value = 3000;
    voiceEQ.gain.value = 2;
    this.voiceBus.connect(voiceEQ);
    voiceEQ.connect(voiceComp);
    voiceComp.connect(this.master);
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambientBus.connect(this.master);

    // 后台挂起/恢复
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else if (this.unlocked) void ctx.resume();
    });
  }

  /** 必须由用户手势调用（入天门按钮） */
  async unlock(): Promise<void> {
    if (this.unlocked) return;
    await this.ctx.resume();
    // 播一帧静音 buffer 彻底解锁 iOS
    const buf = this.ctx.createBuffer(1, 1, 48000);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    src.start();
    this.unlocked = true;
  }

  /** 语音链接入（VoiceBank 用） */
  connectVoice(node: AudioBufferSourceNode): void {
    node.connect(this.voiceBus);
  }

  /** 对话开始：音乐 ×0.35、环境 ×0.5（0.4s 淡） */
  duckForDialogue(): void {
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.linearRampToValueAtTime(0.35 * 0.35, t + 0.4);
    this.ambientBus.gain.linearRampToValueAtTime(0.45 * 0.5, t + 0.4);
  }

  restoreAfterDialogue(): void {
    const t = this.ctx.currentTime;
    this.musicBus.gain.linearRampToValueAtTime(0.35, t + 0.6);
    this.ambientBus.gain.linearRampToValueAtTime(0.45, t + 0.6);
  }
}

/** 合成混响 IR（噪声 + 指数衰减包络，文档 04 §5.3：不需要真实采样） */
export function makeImpulse(ctx: AudioContext, seconds: number, decay = 2.5, bright = 1): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const white = Math.random() * 2 - 1;
      // bright > 1 高频衰减慢（广寒宫"脆"）；< 1 闷（披香殿）
      last = last + (white - last) * Math.min(1, 0.2 * bright);
      d[i] = last * Math.pow(1 - t, decay);
    }
  }
  return buf;
}
