/**
 * VoiceBank.ts —— 语音索引与播放（audio sprite）｜文档 02 §7.2 / §9.2
 *
 * 每个角色一个包：{npc}.webm + {npc}.json { "greet_01": [offsetMs, durMs], ... }
 * LRU：桌面 10–12 包、移动端 4–5 包（文档 04 §8.1）。
 * 语音文件不存在时优雅降级为"纯字幕"（估算时长），游戏照常可玩。
 */
import { QualityManager } from '../core/Quality';
import { AudioCore } from '../audio/AudioCore';

export type SpriteIndex = Record<string, [number, number]>;

interface VoicePack {
  id: string;
  buffer: AudioBuffer;
  index: SpriteIndex;
  lastUsed: number;
}

export class VoiceBank {
  private packs = new Map<string, VoicePack>();
  private loading = new Map<string, Promise<VoicePack | null>>();
  private missing = new Set<string>();
  /** 当前正在播的人声（同一时刻只允许一条），供中断时 stop */
  private current: AudioBufferSourceNode | null = null;
  /** 会话期间不可淘汰的包（引用计数）——见 acquire() */
  private inUse = new Map<string, number>();

  constructor(private audio: AudioCore) {}

  /** 预取某区域全部 NPC 语音包（文档 02 §6.4 阶段 4：按区域下载） */
  async prefetch(ids: string[]): Promise<void> {
    await Promise.allSettled(ids.map((id) => this.load(id)));
  }

  async load(id: string): Promise<VoicePack | null> {
    const hit = this.packs.get(id);
    if (hit) {
      hit.lastUsed = performance.now();
      return hit;
    }
    if (this.missing.has(id)) return null;
    const pending = this.loading.get(id);
    if (pending) return pending;

    const p = (async (): Promise<VoicePack | null> => {
      try {
        const [idxRes, audioRes] = await Promise.all([
          fetch(`audio/voice/${id}.json`),
          fetch(`audio/voice/${id}.webm`),
        ]);
        if (!idxRes.ok || !audioRes.ok) throw new Error('missing');
        const index = (await idxRes.json()) as SpriteIndex;
        const raw = await audioRes.arrayBuffer();
        const buffer = await this.audio.ctx.decodeAudioData(raw);
        const pack: VoicePack = { id, buffer, index, lastUsed: performance.now() };
        this.packs.set(id, pack);
        this.evictIfNeeded();
        console.info(`[voice] 载入语音包 ${id}（${Object.keys(index).length} 条）`);
        return pack;
      } catch {
        this.missing.add(id); // 无语音文件 → 字幕模式
        return null;
      } finally {
        this.loading.delete(id);
      }
    })();
    this.loading.set(id, p);
    return p;
  }

  /**
   * 播放一条：返回实际时长（秒）；无包时返回估算时长。
   *
   * 同一时刻只允许一条人声：开播前先停掉上一条。否则中断后重听、或快速连按
   * 推进键，两条语音会叠在一起播，且反复中断可以无限叠加。
   */
  async play(npcId: string, lineId: string, text: string): Promise<number> {
    const pack = await this.load(npcId);
    if (!pack || !(lineId in pack.index)) {
      this.stopCurrent(); // 字幕降级路径也要掐掉上一条真语音
      return estimateDuration(text);
    }
    const [offsetMs, durMs] = pack.index[lineId];
    this.stopCurrent();
    const src = this.audio.ctx.createBufferSource();
    src.buffer = pack.buffer;
    this.audio.connectVoice(src);
    src.start(0, offsetMs / 1000, durMs / 1000);
    // 自然播完时把登记清掉，避免 stopCurrent 去 stop 一个已结束的 source
    src.onended = () => {
      if (this.current === src) this.current = null;
    };
    this.current = src;
    pack.lastUsed = performance.now();
    return durMs / 1000;
  }

  /**
   * 立即停止当前人声。中断对话/说书时必须调 ——
   * 否则字幕已消失、音乐已恢复，声音还会自顾自说完。
   */
  stopCurrent(): void {
    const src = this.current;
    this.current = null;
    if (!src) return;
    try {
      src.onended = null;
      src.stop();
    } catch {
      /* 已经停了或还没 start：忽略 */
    }
  }

  /** 试播（试听工具用） */
  has(id: string): boolean {
    return this.packs.has(id);
  }

  /**
   * 标记一个包"正在用"，整段对话/说书期间不得被 LRU 淘汰。用引用计数，
   * 必须与 release 配对（放在 finally 里）。
   *
   * 不加这个会出真问题：蟠桃园有 12 个 NPC，而 LRU 上限恰好是 12，
   * 进园时一次预取就能把正在播的说书包挤掉；下一句得重新拉 3.3MB，
   * 期间字幕照常往前走、声音断掉约 1.6 秒，听感就是"说书被打断"。
   */
  acquire(id: string): void {
    this.inUse.set(id, (this.inUse.get(id) ?? 0) + 1);
  }

  release(id: string): void {
    const n = (this.inUse.get(id) ?? 0) - 1;
    if (n > 0) this.inUse.set(id, n);
    else this.inUse.delete(id);
  }

  /** LRU 淘汰：悟空通用片与旁白常驻不淘汰；正在用的包也不淘汰 */
  private evictIfNeeded(): void {
    const limit = QualityManager.current.voiceLRU;
    const PINNED = new Set(['wukong-common', 'narrator']);
    if (this.packs.size <= limit) return;
    const candidates = [...this.packs.values()]
      .filter((p) => !PINNED.has(p.id) && !this.inUse.has(p.id))
      .sort((a, b) => a.lastUsed - b.lastUsed);
    while (this.packs.size > limit && candidates.length) {
      const victim = candidates.shift()!;
      this.packs.delete(victim.id);
      this.missing.delete(victim.id);
    }
  }
}

/** 无语音时的字幕时长估算：古白话约 4.5 字/秒，停顿标记照算 */
export function estimateDuration(text: string): number {
  let extra = 0;
  const clean = text.replace(/<#([\d.]+)#>/g, (_m, s) => {
    extra += parseFloat(s);
    return '';
  });
  const chars = clean.replace(/\s/g, '').length;
  return Math.max(1.2, chars / 4.5 + extra + 0.4);
}
