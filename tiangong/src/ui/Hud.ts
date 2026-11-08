/**
 * Hud.ts —— 方位指示 + 区域名 + 交互提示 + 按键说明｜文档 03 §8.2
 */
export class Hud {
  private compass: HTMLElement;
  private region: HTMLElement;
  private prompt: HTMLElement;
  private frame: HTMLElement;
  private speedlines: HTMLElement;
  private regionTimer = 0;

  constructor(root: HTMLElement) {
    this.compass = el('div', 'tg-ui tg-fade', 'tg-compass');
    this.region = el('div', 'tg-ui tg-fade', 'tg-region');
    this.prompt = el('div', 'tg-ui tg-fade', 'tg-prompt');
    this.frame = el('div', '', 'tg-frame');
    // 速度线（boost 时屏幕边缘速度感，文档 02 §4.1/§4.4：可关/可弱）
    this.speedlines = el('div', 'tg-ui tg-fade', 'tg-speedlines');
    this.speedlines.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:14;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg 4deg, rgba(240,232,216,.10) 4.5deg 5deg);-webkit-mask-image:radial-gradient(circle,transparent 42%,black 78%);mask-image:radial-gradient(circle,transparent 42%,black 78%);';
    const hint = el('div', 'tg-ui', 'tg-hint');
    hint.innerHTML = 'W A S D 驾云 · Shift 加速 · X 降落 · Space 起飞<br>C 第一人称 · E 交谈 · M 全图 · Esc 设置';
    root.append(this.compass, this.region, this.prompt, this.frame, this.speedlines, hint);
  }

  /** 每帧：boost 强度 → 速度线透明度（settings.speedLines 控制） */
  setSpeedLines(boostK: number, mode: 'on' | 'off' | 'weak'): void {
    const k = mode === 'off' ? 0 : mode === 'weak' ? boostK * 0.4 : boostK;
    this.speedlines.style.opacity = String(Math.min(1, k * 1.2));
  }

  /** 方位：yaw → 东南西北 */
  setYaw(yaw: number): void {
    const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const deg = ((-yaw * 180) / Math.PI + 360) % 360;
    this.compass.textContent = dirs[Math.round(deg / 45) % 8];
  }

  /** 区域名淡入淡出 */
  showRegion(name: string): void {
    this.region.textContent = name;
    this.region.style.opacity = '1';
    clearTimeout(this.regionTimer);
    this.regionTimer = setTimeout(() => (this.region.style.opacity = '0'), 3800) as never as number;
  }

  setPrompt(text: string | null): void {
    this.prompt.textContent = text ?? '';
    this.prompt.style.opacity = text ? '1' : '0';
  }

  setFixedFrame(on: boolean): void {
    this.frame.style.display = on ? 'block' : 'none';
  }
}

export function el(tag: string, cls?: string, id?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (id) e.id = id;
  return e;
}
