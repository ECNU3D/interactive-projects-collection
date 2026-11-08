/**
 * DialogueBox.ts —— 对话框 + 话题列表 + 字幕｜文档 03 §8.2
 * 半透明深色底 + 一条金线，宋体白字，不用气泡框。
 */
import { el } from './Hud';
import { store } from '../core/Store';
import type { DialogueLine } from '../dialogue/types';

export class DialogueBox {
  root: HTMLElement;
  private speaker: HTMLElement;
  private text: HTMLElement;
  private nextHint: HTMLElement;
  private topics: HTMLElement;
  private dismiss: HTMLElement;
  private onChoose: (goto: string) => void = () => void 0;
  private onQuote: (line: DialogueLine) => void = () => void 0;
  private onDismiss: () => void = () => void 0;

  constructor(root: HTMLElement) {
    this.root = el('div', 'tg-ui tg-fade', 'tg-dialogue');
    this.speaker = el('div', '', 'tg-dlg-speaker');
    const box = el('div', '', 'tg-dlg-box');
    this.text = el('div', '', 'tg-dlg-text');
    this.nextHint = el('div', '', 'tg-dlg-next');
    this.topics = el('div', '', 'tg-topics');
    // 退出按钮：说书是线性播放、没有话题分支，玩家需要一个看得见的出口
    this.dismiss = el('button', 'tg-dismiss');
    this.dismiss.style.display = 'none';
    this.dismiss.addEventListener('click', (e) => {
      e.stopPropagation(); // 别让点击穿到 box 上被当成"推进下一句"
      this.onDismiss();
    });
    box.append(this.text, this.nextHint);
    this.root.append(this.speaker, box, this.dismiss, this.topics);
    root.append(this.root);

    const advance = () => {
      (window as never as { __advanceDialogue?: boolean }).__advanceDialogue = true;
    };
    box.addEventListener('click', advance);
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        if (this.root.classList.contains('open')) advance();
      }
    });
  }

  handlers(onChoose: (goto: string) => void, onQuote: (line: DialogueLine) => void): void {
    this.onChoose = onChoose;
    this.onQuote = onQuote;
  }

  open(): void {
    this.root.classList.add('open');
  }

  /** 显示退出按钮（说书用；传 null 收起） */
  setDismiss(label: string | null, onClick?: () => void): void {
    if (!label) {
      this.dismiss.style.display = 'none';
      this.onDismiss = () => void 0;
      return;
    }
    this.dismiss.textContent = label;
    this.dismiss.style.display = 'block';
    this.onDismiss = onClick ?? (() => void 0);
  }

  close(): void {
    this.root.classList.remove('open');
    this.setTopics([]);
    this.setDismiss(null);
  }

  showLine(line: DialogueLine, speakerName: string): void {
    this.speaker.textContent = speakerName;
    this.topics.innerHTML = '';
    // 停顿标记在字幕中隐去（三叠短语的重复必须保留，文档 04 §6.4）
    const clean = line.text.replace(/<#[\d.]+#>/g, '').replace(/\((laughs|chuckle|coughs|clear-throat|groans|breath|pant|inhale|exhale|gasps|sniffs|sighs|snorts|burps|lip-smacking|humming|hissing|emm|sneezes)\)/g, '……');
    this.text.textContent = clean;
    const s = store.get('settings');
    const sizes = { small: 15, medium: 19, large: 23, huge: 28 } as const;
    this.text.style.fontSize = `${sizes[s.subtitleSize]}px`;
    (this.text.parentElement as HTMLElement).style.background =
      s.subtitleContrast === 'high' ? 'rgba(0,0,0,.92)' : 'rgba(18,12,28,.72)';
    if (line.quote) {
      const mark = el('span', 'quote-mark');
      mark.textContent = '原文';
      mark.title = '点击查看出处';
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onQuote(line);
      });
      this.text.append(mark);
    }
    this.nextHint.textContent = s.autoAdvance ? '' : '点击继续 ▸';
  }

  setTopics(topics: { label: string; goto: string }[]): void {
    this.topics.innerHTML = '';
    for (const t of topics) {
      const b = el('div', 'tg-topic');
      b.textContent = t.label;
      b.addEventListener('click', () => {
        this.topics.innerHTML = '';
        this.onChoose(t.goto);
      });
      this.topics.append(b);
    }
  }
}
