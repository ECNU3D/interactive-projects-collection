/**
 * Quality.ts —— 画质分档｜文档 02 §6.1 / §6.3
 */
import { store } from './Store';

export type Tier = 'high' | 'mid' | 'low';
export type Backend = 'webgpu' | 'webgl2';

export interface QualityPreset {
  tier: Tier;
  /** 体积云 raymarch 步数；0 = 用分层平面（文档 02 §5.2 降级方案） */
  cloudMarchSteps: number;
  /** 粒子总数 */
  particles: number;
  /** 后处理 pass 数（预算参考） */
  postPasses: number;
  /** 渲染分辨率缩放 */
  pixelRatioCap: number;
  /** 是否开 selective bloom */
  bloom: boolean;
  /** 阴影 */
  shadowMapSize: number;
  shadowEnabled: boolean;
  /** 宫殿海 impostor 距离（m） */
  impostorDistance: number;
  /** 语音包 LRU 上限（文档 04 §8.1） */
  voiceLRU: number;
}

export const PRESETS: Record<Tier, QualityPreset> = {
  high: {
    tier: 'high',
    cloudMarchSteps: 48,
    particles: 8000,
    postPasses: 8,
    // Retina 上 2.0 意味着 4 倍像素量，而本作的大头是透明云海的填充率。
    // 1.5 省 44% 像素、在 Retina 上肉眼几乎分辨不出（FXAA 还会再抹一道）。
    pixelRatioCap: 1.5,
    bloom: true,
    shadowMapSize: 2048,
    shadowEnabled: true,
    impostorDistance: 400,
    voiceLRU: 12,
  },
  mid: {
    tier: 'mid',
    cloudMarchSteps: 24,
    particles: 3000,
    postPasses: 5,
    pixelRatioCap: 1.5,
    bloom: true,
    shadowMapSize: 1024,
    shadowEnabled: true,
    impostorDistance: 320,
    voiceLRU: 10,
  },
  low: {
    tier: 'low',
    cloudMarchSteps: 0, // 移动端关 raymarching（文档 02 §1.1 兜底）
    particles: 800,
    postPasses: 3,
    pixelRatioCap: 1,
    bloom: false,
    shadowMapSize: 512,
    shadowEnabled: false,
    impostorDistance: 240,
    voiceLRU: 5,
  },
};

/** 文档 02 §6.3：不用 UA 判断 iPad；触屏 + 无精确指针 = 移动档 */
export function detectTier(backend: Backend): Tier {
  const mobile = navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches;
  if (mobile) return 'low';
  if (backend === 'webgl2') return 'mid';
  return 'high';
}

export class QualityManager {
  static current: QualityPreset = PRESETS.mid;
  private static frameTimes: number[] = [];
  private static lastAutoDowngrade = 0;
  /** 降档后需要真正生效的部分（分辨率缩放、粒子等）由装配层接管 */
  static onChange: (preset: QualityPreset) => void = () => void 0;

  static applyPreset(tier: Tier): void {
    QualityManager.current = PRESETS[tier];
    store.set('tier', tier);
    QualityManager.onChange(PRESETS[tier]);
  }

  /**
   * 运行时自适应：连续 3 秒平均帧时间 > 22ms 自动降一档
   * （先降体积云步数，再降粒子，再降后处理 —— 简化为整档下调）｜文档 02 §6.3
   *
   * 注意：必须传**真实渲染帧时间**。此前是在固定步长的 update 里调用的，
   * 拿到的永远是 16.67ms，判据 >22ms 永不成立，整个自适应形同虚设。
   */
  static sampleFrame(dtMs: number): void {
    const q = QualityManager.current;
    if (q.tier === 'low') return;
    // 区域生成、着色器编译、切后台会产生几百 ms 的单帧尖峰。
    // 这类瞬时卡顿不代表机器扛不住稳态渲染，不该换来一次永久降档 ——
    // 所以丢弃离群帧，并用中位数（而非均值）作判据。
    if (dtMs > 50) return;
    const times = QualityManager.frameTimes;
    times.push(dtMs);
    if (times.length < 180) return;
    times.shift();
    const sorted = times.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    const now = performance.now();
    if (median > 22 && now - QualityManager.lastAutoDowngrade > 8000) {
      QualityManager.lastAutoDowngrade = now;
      const next: Tier = q.tier === 'high' ? 'mid' : 'low';
      console.info(`[quality] 帧时间中位数 ${median.toFixed(1)}ms，自动降为 ${next}`);
      QualityManager.applyPreset(next);
      times.length = 0;
    }
  }
}
