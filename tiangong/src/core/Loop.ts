/**
 * Loop.ts —— 主循环：固定步长逻辑 + 可变步长渲染｜文档 02 §2
 *
 * WebGPURenderer 下用 renderer.setAnimationLoop。
 * 逻辑固定 60Hz 步进，避免物理/手感随帧率漂移；渲染每帧执行。
 */

export type UpdateFn = (dt: number) => void;
export type RenderFn = (dt: number, alpha: number) => void;

const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;

export class Loop {
  private updaters: UpdateFn[] = [];
  private renderers: RenderFn[] = [];
  private accumulator = 0;
  private last = -1;
  private _fps = 60;

  get fps(): number {
    return this._fps;
  }

  onUpdate(fn: UpdateFn): () => void {
    this.updaters.push(fn);
    return () => {
      this.updaters = this.updaters.filter((f) => f !== fn);
    };
  }

  onRender(fn: RenderFn): () => void {
    this.renderers.push(fn);
    return () => {
      this.renderers = this.renderers.filter((f) => f !== fn);
    };
  }

  /** 由 Renderer 的 animation loop 调用，time 为毫秒 */
  tick(timeMs: number): void {
    if (this.last < 0) this.last = timeMs;
    let frame = (timeMs - this.last) / 1000;
    this.last = timeMs;
    if (frame > 0.25) frame = 0.25; // 切后台回来不追帧
    this._fps = this._fps * 0.95 + (1 / Math.max(frame, 1e-4)) * 0.05;

    this.accumulator += frame;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      for (const fn of this.updaters) fn(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    const alpha = this.accumulator / FIXED_DT;
    for (const fn of this.renderers) fn(frame, alpha);
  }
}
