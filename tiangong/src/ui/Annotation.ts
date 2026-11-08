/**
 * Annotation.ts —— 考据栏｜文档 02 §8.3 / 文档 03 §8.3
 *
 * 可折叠右侧栏，默认收起。古籍页面质感，朱笔批注色标出处。
 * 凡本作自拟内容，必须标注「本作设定」——这是对读者的诚实。
 */
import { el } from './Hud';

export interface AnnotationEntry {
  title: string;
  source?: string; // 朱批：出处回目
  body: string;
  selfAuthored?: boolean; // 「本作设定」标注
  /**
   * 覆盖 selfAuthored 的标签文案。默认「本作设定（原著无载）」适用于原著根本
   * 没有的内容；说书人转述的是原著确有的情节、只是没用原文，两者不可混为一谈。
   */
  selfAuthoredLabel?: string;
}

export class Annotation {
  private panel: HTMLElement;
  private toggle: HTMLElement;
  private body: HTMLElement;
  private openState = false;

  constructor(root: HTMLElement) {
    this.panel = el('div', 'tg-ui', 'tg-annotation');
    const h = el('h3');
    h.textContent = '考 据';
    this.body = el('div');
    this.panel.append(h, this.body);
    this.toggle = el('div', 'tg-ui', 'tg-anno-toggle');
    this.toggle.textContent = '考据';
    this.toggle.addEventListener('click', () => this.toggleOpen());
    root.append(this.panel, this.toggle);
  }

  toggleOpen(): void {
    this.openState = !this.openState;
    this.panel.classList.toggle('open', this.openState);
  }

  show(entries: AnnotationEntry[]): void {
    this.body.innerHTML = '';
    for (const e of entries) {
      if (e.source) {
        const s = el('div', 'anno-src');
        s.textContent = `〔出处〕${e.source}`;
        this.body.append(s);
      }
      const t = el('div', 'anno-src');
      t.style.color = '#e8d9a0';
      t.textContent = e.title;
      const b = el('div', 'anno-body');
      b.textContent = e.body;
      this.body.append(t, b);
      if (e.selfAuthored) {
        const tag = el('span', 'anno-self');
        tag.textContent = e.selfAuthoredLabel ?? '本作设定（原著无载）';
        this.body.append(tag);
      }
    }
    if (entries.length && !this.openState) {
      this.toggle.style.boxShadow = '0 0 12px rgba(232,180,85,.5)';
      setTimeout(() => (this.toggle.style.boxShadow = ''), 2000);
    }
  }
}
