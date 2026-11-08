/**
 * DialogueEngine.ts —— 对话树解释器｜文档 02 §8.1 / §8.2
 *
 * 流程：greet（随机一条）→ topic 列表 → 逐行播放 → next 分支 → __end。
 * `__end` 是保留字。老君的"缠磨"机制是全场唯一的状态机（文档 01 §3.3）。
 */
import type { DialogueFile, DialogueLine, Topic } from './types';
import { VoiceBank, estimateDuration } from './VoiceBank';
import { store } from '../core/Store';

export interface DialogueEvents {
  /** 一行开始：显示字幕（quote 带考据角标） */
  onLine(line: DialogueLine, speakerName: string): void;
  /** 显示话题分支 */
  onTopics(topics: { label: string; goto: string }[]): void;
  /** 台词内隐藏分支点选 */
  onTopicList(topics: Topic[]): void;
  onEnd(): void;
  /** NPC 说话状态（驱动口型） */
  onTalking(talking: boolean): void;
  /** 考据栏更新 */
  onSource(source?: string): void;
}

const END = '__end';

export class DialogueEngine {
  private file: DialogueFile | null = null;
  private npcId = '';
  private stopped = false;
  /** 缠磨计数器：topicId → 已问次数 */
  private pesterCount = new Map<string, number>();
  /** 话题完成钩子（灵霄殿引奏等流程用） */
  onTopicDone: (npcId: string, topicId: string) => void = () => void 0;
  /** 悟空语音当前分片（天门/宫城/内苑/上层/通用，文档 04 §8.1） */
  wukongPack = 'wukong-common';
  /** 本次对话锁住的语音包，end 时释放 */
  private acquired: string[] = [];

  constructor(private voice: VoiceBank) {}

  /** 开始一段对话 */
  async start(npcId: string, file: DialogueFile, events: DialogueEvents): Promise<void> {
    this.file = file;
    this.npcId = npcId;
    this.stopped = false;
    store.set('inDialogue', true);
    // 锁住本次对话要用的包，防止 LRU 在对话中途把它们淘汰掉
    // （蟠桃园 12 个 NPC 正好顶满 LRU 上限，一次区域预取就能挤掉正在用的包）
    this.acquired = [npcId, this.wukongPack];
    for (const id of this.acquired) this.voice.acquire(id);

    const greet = file.greet?.length ? pick(file.greet) : null;
    if (greet) {
      await this.playLine(greet, file, events);
      if (this.stopped) return;
    }
    this.showRootTopics(events);
  }

  private showRootTopics(events: DialogueEvents): void {
    if (!this.file) return;
    const topics = (this.file.topics ?? []).map((t) => ({ label: t.label, goto: t.id }));
    topics.push({ label: '罢了。', goto: END });
    events.onTopicList(this.file.topics ?? []);
    events.onTopics(topics);
  }

  /** 玩家点选话题 */
  async choose(gotoId: string, events: DialogueEvents): Promise<void> {
    if (this.stopped || !this.file) return;
    if (gotoId === END) {
      await this.bye(events);
      return;
    }
    const topic = this.file.topics?.find((t) => t.id === gotoId);
    if (!topic) {
      // 未实现的话题 → fallback
      const fb = this.file.fallback?.length ? pick(this.file.fallback) : null;
      if (fb) await this.playLine(fb, this.file, events);
      if (!this.stopped) this.showRootTopics(events);
      return;
    }
    if (topic.source) events.onSource(topic.source);

    // 缠磨机制（老君）：同一话题反复追问，逐条推进
    let lines = topic.lines;
    const pesters = lines.filter((l) => l.id.endsWith('__p1') || l.id.endsWith('__p2') || l.id.endsWith('__p3') || l.id.endsWith('__p4') || l.id.endsWith('__p5'));
    if (pesters.length > 0) {
      const n = this.pesterCount.get(gotoId) ?? 0;
      const base = lines.filter((l) => !/__p\d$/.test(l.id));
      const stage = Math.min(n, pesters.length - 1);
      const chosen = pesters.find((l) => l.id.endsWith(`__p${stage + 1}`))!;
      lines = [...base, chosen];
      this.pesterCount.set(gotoId, n + 1);
    }

    for (const line of lines) {
      if (this.stopped) return;
      await this.playLine(line, this.file, events);
    }
    this.onTopicDone(this.npcId, gotoId);
    if (this.stopped) return;
    if (topic.next?.length) {
      events.onTopics(topic.next);
    } else {
      this.showRootTopics(events);
    }
  }

  private async bye(events: DialogueEvents): Promise<void> {
    if (this.file?.bye?.length) {
      await this.playLine(pick(this.file.bye), this.file, events);
    }
    this.end(events);
  }

  end(events: DialogueEvents): void {
    if (this.stopped) return;
    this.stopped = true;
    this.voice.stopCurrent(); // 否则对话框已关、声音还在自顾自说完
    for (const id of this.acquired) this.voice.release(id);
    this.acquired = [];
    store.set('inDialogue', false);
    events.onTalking(false);
    events.onEnd();
  }

  get active(): boolean {
    return !this.stopped && this.file !== null;
  }

  private async playLine(line: DialogueLine, file: DialogueFile, events: DialogueEvents): Promise<void> {
    const speakerName = line.speaker === 'pc' ? '齐天大圣' : line.speaker === 'narrator' ? '' : file.name;
    events.onLine(line, speakerName);
    events.onTalking(line.speaker === 'npc');
    // 玩家台词用悟空语音包（按区域分片 + 通用片，文档 04 §8.1）
    const packId = line.speaker === 'pc' ? this.wukongPack : this.npcId;
    let dur = await this.voice.play(packId, line.id, line.text);
    if (line.speaker === 'pc' && packId !== 'wukong-common') {
      // 分片缺失时回退通用片
      const pack = await this.voice.load(packId);
      if (!pack || !(line.id in pack.index)) dur = await this.voice.play('wukong-common', line.id, line.text);
    }
    // 字幕逐句高亮依赖 subtitle_file；运行时按估算/实际时长等待
    if (store.get('settings').autoAdvance) {
      await wait(dur * 1000 + 350);
    } else {
      await waitForAdvance(() => this.stopped);
    }
    events.onTalking(false);
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 手动推进模式：等待点击/按键（由 UI 层调 window.__advanceDialogue） */
function waitForAdvance(isStopped: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (isStopped() || (window as never as { __advanceDialogue?: boolean }).__advanceDialogue) {
        (window as never as { __advanceDialogue?: boolean }).__advanceDialogue = false;
        resolve();
      } else {
        setTimeout(check, 120);
      }
    };
    check();
  });
}

export { estimateDuration };
