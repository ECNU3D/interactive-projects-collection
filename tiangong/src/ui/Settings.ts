/**
 * Settings.ts —— 无障碍与晕动症设置｜文档 02 §4.4（必做，不是可选项）
 *
 * 首次进入前就可访问（loading 页「入天门」按钮旁），默认值保守。
 */
import { el } from './Hud';
import { store, type GameState } from '../core/Store';

type Settings = GameState['settings'];

export class SettingsPanel {
  private panel: HTMLElement;

  constructor(root: HTMLElement) {
    this.panel = el('div', 'tg-ui', 'tg-settings');
    root.append(this.panel);
    this.render();
  }

  get isOpen(): boolean {
    return this.panel.classList.contains('open');
  }

  toggle(force?: boolean): void {
    const open = force ?? !this.isOpen;
    this.panel.classList.toggle('open', open);
    if (open) this.render();
  }

  private set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    store.set('settings', { ...store.get('settings'), [key]: value });
    if (key === 'fixedFrame') {
      document.getElementById('tg-frame')!.style.display = value ? 'block' : 'none';
    }
  }

  private render(): void {
    const s = store.get('settings');
    this.panel.innerHTML = '';
    const h = el('h3');
    h.textContent = '设 置';
    this.panel.append(h);

    const rows: [string, HTMLElement][] = [];
    const sel = (opts: [string, string][], cur: string, fn: (v: string) => void): HTMLElement => {
      const e = document.createElement('select');
      for (const [v, label] of opts) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = label;
        if (v === cur) o.selected = true;
        e.append(o);
      }
      e.addEventListener('change', () => fn(e.value));
      return e;
    };
    const range = (cur: number, fn: (v: number) => void): HTMLElement => {
      const e = document.createElement('input');
      e.type = 'range';
      e.min = '0';
      e.max = '100';
      e.value = String(Math.round(cur * 100));
      e.addEventListener('input', () => fn(Number(e.value) / 100));
      return e;
    };
    const bool = (cur: boolean, fn: (v: boolean) => void): HTMLElement =>
      sel([['on', '开'], ['off', '关']], cur ? 'on' : 'off', (v) => fn(v === 'on'));

    rows.push(['FOV 拉伸（加速时视野变宽）', bool(s.fovStretch, (v) => this.set('fovStretch', v))]);
    rows.push([
      '速度线',
      sel([['on', '开'], ['weak', '弱'], ['off', '关']], s.speedLines, (v) => this.set('speedLines', v as Settings['speedLines'])),
    ]);
    rows.push(['相机晃动', range(s.cameraShake, (v) => this.set('cameraShake', v))]);
    rows.push(['镜头侧倾', bool(s.bank, (v) => this.set('bank', v))]);
    rows.push(['暗角强度', range(s.vignette, (v) => this.set('vignette', v))]);
    rows.push(['移动模糊', bool(s.motionBlur, (v) => this.set('motionBlur', v))]);
    rows.push(['固定参考框（缓解晕动）', bool(s.fixedFrame, (v) => this.set('fixedFrame', v))]);
    rows.push([
      '字幕字号',
      sel(
        [['small', '小'], ['medium', '中'], ['large', '大'], ['huge', '特大']],
        s.subtitleSize,
        (v) => this.set('subtitleSize', v as Settings['subtitleSize']),
      ),
    ]);
    rows.push([
      '字幕对比度',
      sel([['standard', '标准'], ['high', '高（纯黑底）']], s.subtitleContrast, (v) =>
        this.set('subtitleContrast', v as Settings['subtitleContrast']),
      ),
    ]);
    rows.push(['对话自动推进', bool(s.autoAdvance, (v) => this.set('autoAdvance', v))]);
    rows.push([
      '光照预设',
      sel([['dawn', '朝晖'], ['noon', '正午'], ['moon', '月夜']], s.sunPreset, (v) => this.set('sunPreset', v as Settings['sunPreset'])),
    ]);
    rows.push(['主音量', range(s.volumeMaster, (v) => this.set('volumeMaster', v))]);
    rows.push(['音乐音量', range(s.volumeMusic, (v) => this.set('volumeMusic', v))]);

    for (const [label, control] of rows) {
      const row = el('div', 'tg-set-row');
      const l = el('span');
      l.textContent = label;
      row.append(l, control);
      this.panel.append(row);
    }

    const closeWrap = el('div', 'tg-close');
    const btn = document.createElement('button');
    btn.textContent = '关 闭';
    btn.addEventListener('click', () => this.toggle(false));
    closeWrap.append(btn);
    this.panel.append(closeWrap);
  }
}
