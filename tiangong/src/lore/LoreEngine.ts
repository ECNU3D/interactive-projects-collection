/**
 * LoreEngine.ts —— 「书中此处」线性播放
 *
 * 不复用 DialogueEngine：那个引擎是 greet/topics/goto 对话树，说书是线性序列，
 * 硬套会把两边都弄脏。这里复用更底层的 VoiceBank（含"无语音包→纯字幕"降级）
 * 与 DialogueBox（含字幕字号/对比度设置、原文角标）。
 */
import { store, markLoreVisited } from '../core/Store';
import type { VoiceBank } from '../dialogue/VoiceBank';
import type { DialogueBox } from '../ui/DialogueBox';
import type { AudioCore } from '../audio/AudioCore';
import type { DialogueLine } from '../dialogue/types';
import { SHUOSHU_PACK, LORE_INTRO, type LoreSite } from './LoreSites';

export interface LoreHooks {
  /** 播完：把出处推给考据栏 */
  onSource(site: LoreSite): void;
  /** 播完：marker 转暗、地图刷新 */
  onVisited(site: LoreSite): void;
}

const SPEAKER = '说书人';

export class LoreEngine {
  private stopped = false;
  private running = false;

  constructor(
    private voice: VoiceBank,
    private box: DialogueBox,
    private audio: AudioCore,
    private hooks: LoreHooks,
  ) {}

  get active(): boolean {
    return this.running;
  }

  async start(site: LoreSite): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.stopped = false;
    store.set('inDialogue', true);
    // 整段说书期间锁住语音包：否则 LRU 会在播放中途把它淘汰，
    // 下一句得重新拉 3.3MB，字幕照走而声音断掉（见 VoiceBank.acquire）
    this.voice.acquire(SHUOSHU_PACK);
    this.audio.duckForDialogue();

    try {
      // 先备好包再开口，免得第一句字幕出来了、声音还在下载。
      // 正常情况下走近时已由 prewarm 预取过，这里立即返回；
      // 对话框放在它之后开，避免万一要下载时先弹一个空框。
      await this.voice.load(SHUOSHU_PACK);
      this.box.open();
      this.box.setDismiss('不听了　（Esc）', () => this.abort());

      // 一次性引子：只在从未听过任何一处时插在正文之前
      const queue: DialogueLine[] = [];
      if (LORE_INTRO && store.get('visitedLore').length === 0) queue.push(LORE_INTRO);
      queue.push(...site.lines);

      for (const line of queue) {
        if (this.stopped) break;
        await this.playLine(line);
      }
      if (!this.stopped) {
        markLoreVisited(site.id);
        this.hooks.onSource(site);
        this.hooks.onVisited(site);
      }
    } finally {
      this.finish();
    }
  }

  abort(): void {
    this.stopped = true;
  }

  /** 走近剧情点时后台预热语音包，按 E 才能立刻出声（重复调用由 VoiceBank 去重） */
  prewarm(): void {
    void this.voice.load(SHUOSHU_PACK);
  }

  private finish(): void {
    this.running = false;
    // 中断时字幕已消失、音乐已恢复，声音必须一起停，否则说书人会自顾自说完；
    // 且 Interactable 的冷却只有 0.5s，不停的话重听会叠音。
    this.voice.stopCurrent();
    this.voice.release(SHUOSHU_PACK);
    this.box.close();
    this.audio.restoreAfterDialogue();
    store.set('inDialogue', false);
  }

  private async playLine(line: DialogueLine): Promise<void> {
    this.box.showLine(line, SPEAKER);
    const dur = await this.voice.play(SHUOSHU_PACK, line.id, line.text);
    if (store.get('settings').autoAdvance) {
      await wait(dur * 1000 + 350, () => this.stopped);
    } else {
      await waitForAdvance(() => this.stopped);
    }
  }
}

/** 可被 abort 提前打断的等待 */
function wait(ms: number, isStopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (): void => {
      if (isStopped() || performance.now() - t0 >= ms) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** 手动推进：等 DialogueBox 置起的 window.__advanceDialogue（与 DialogueEngine 同一约定） */
function waitForAdvance(isStopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const tick = (): void => {
      const w = window as never as { __advanceDialogue?: boolean };
      if (isStopped() || w.__advanceDialogue) {
        w.__advanceDialogue = false;
        resolve();
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
