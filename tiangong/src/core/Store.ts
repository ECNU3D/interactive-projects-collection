/**
 * Store.ts —— 全局状态（极简 pub/sub，不用 redux）｜文档 02 §2
 */
export type Listener<T> = (value: T, prev: T) => void;

export class Store<T extends object> {
  private state: T;
  private listeners = new Map<keyof T, Set<Listener<never>>>();

  constructor(initial: T) {
    this.state = { ...initial };
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.state[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    const prev = this.state[key];
    if (Object.is(prev, value)) return;
    this.state = { ...this.state, [key]: value };
    const set = this.listeners.get(key);
    if (set) for (const fn of set) (fn as Listener<T[K]>)(value, prev);
  }

  on<K extends keyof T>(key: K, fn: Listener<T[K]>): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }
}

/** 全局游戏状态 */
export interface GameState {
  /** 当前所在区域 id（content/places.json） */
  region: string;
  /** 当前所在层 1–5 */
  layer: number;
  /** 对话是否进行中 */
  inDialogue: boolean;
  /** 画质档 */
  tier: 'high' | 'mid' | 'low';
  /** 渲染后端 */
  backend: 'webgpu' | 'webgl2' | 'unknown';
  /** 当前游戏日进度 0–1（18 分钟抽象周期，文档 01 §4） */
  gameDay: number;
  /** 已解锁灵霄殿准入（通明殿递本流程完成） */
  lingxiaoAdmitted: boolean;
  /** 已听过的「书中此处」剧情点 id（持久化到 localStorage） */
  visitedLore: string[];
  /** 设置（文档 02 §4.4 无障碍与晕动症，默认值保守） */
  settings: {
    fovStretch: boolean;
    speedLines: 'on' | 'off' | 'weak';
    cameraShake: number;      // 0–1，默认 0.5
    bank: boolean;
    vignette: number;         // 0–1，默认 0.3
    motionBlur: boolean;      // 默认关
    fixedFrame: boolean;      // 固定参考框，默认关
    subtitleSize: 'small' | 'medium' | 'large' | 'huge';
    subtitleContrast: 'standard' | 'high';
    autoAdvance: boolean;
    volumeMaster: number;
    volumeMusic: number;
    volumeVoice: number;
    sunPreset: 'dawn' | 'noon' | 'moon';
  };
}

const PROGRESS_KEY = 'tiangong.progress';

/**
 * 进度是否落盘。**暂时关闭**：测试与录像时每次打开都该是全新的，
 * 十二处「书中此处」都未听过。想恢复存档只需把这里改回 true —— 读写两条
 * 路径都保留着，关掉后进度只活在本次会话内。
 */
const PERSIST_PROGRESS = false;

interface PersistedProgress {
  visitedLore?: string[];
}

/**
 * 读存档。隐私模式下 localStorage 会抛异常，吞掉退回空进度即可。
 * 注意：`JSON.parse('null')`（以及 '5'、'"x"'、'true'、'[]' 等原始值/数组）不会抛异常，
 * 会合法返回非对象结果，所以不能只靠 `as PersistedProgress` 类型断言，必须在这里对
 * 解析结果做运行时形状校验，否则非对象会一路传到 `persisted.visitedLore` 处抛出
 * 未捕获的 TypeError，导致模块顶层初始化失败、整个游戏起不来。
 */
function loadProgress(): PersistedProgress {
  if (!PERSIST_PROGRESS) return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as PersistedProgress)
      : {};
  } catch {
    return {};
  }
}

const persisted = loadProgress();

export const store = new Store<GameState>({
  region: 'qitian-fu',
  layer: 3,
  inDialogue: false,
  tier: 'mid',
  backend: 'unknown',
  gameDay: 0,
  lingxiaoAdmitted: false,
  visitedLore: Array.isArray(persisted.visitedLore) ? persisted.visitedLore : [],
  settings: {
    fovStretch: true,
    speedLines: 'on',
    cameraShake: 0.5,
    bank: true,
    vignette: 0.3,
    motionBlur: false,
    fixedFrame: false,
    subtitleSize: 'medium',
    subtitleContrast: 'standard',
    autoAdvance: true,
    volumeMaster: 0.9,
    volumeMusic: 0.35,
    volumeVoice: 1.0,
    sunPreset: 'dawn',
  },
});

function saveProgress(): void {
  if (!PERSIST_PROGRESS) return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ visitedLore: store.get('visitedLore') }));
  } catch {
    /* 隐私模式：进度只留在内存里，本次会话仍正常 */
  }
}

/** 标记一处剧情点已听（幂等），并落盘 */
export function markLoreVisited(id: string): void {
  const cur = store.get('visitedLore');
  if (cur.includes(id)) return;
  store.set('visitedLore', [...cur, id]); // 必须换新数组，Store 用 Object.is 判变化
  saveProgress();
}

export function isLoreVisited(id: string): boolean {
  return store.get('visitedLore').includes(id);
}
