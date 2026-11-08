/**
 * params.ts —— 殿宇参数化模型｜文档 02 §3.1 / §3.2
 *
 * 目标：用 12 个左右的参数描述一座中式殿宇。
 */
import * as THREE from 'three/webgpu';

export interface HallSpec {
  /** 面阔间数，奇数。明代奉天殿 9 */
  bays: number;
  /** 进深间数 */
  depths: number;
  /** 明间宽（m），次间递减 0.85^n（几何递减太狠，改用 0.92） */
  bayWidth: number;
  /** 檐柱高 */
  columnHeight: number;

  /** 须弥座层数 0–3 */
  podiumTiers: 0 | 1 | 2 | 3;
  podiumHeight: number;

  roof: 'wudian' | 'xieshan' | 'zanjian' | 'xuanshan' | 'yingshan';
  /** 檐数。灵霄宝殿原文"三檐四簇"→ 3 */
  eaves: 1 | 2 | 3;
  /** 攒尖宝顶。灵霄宝殿"大金葫芦顶" */
  finial?: 'jinhulu' | 'baozhu' | null;
  /** 檩数（决定举架系数数组长度），默认 9 */
  purlins?: 5 | 7 | 9 | 11;

  /** 斗拱"踩"数 */
  dougongSteps: 3 | 5 | 7 | 9 | 11;
  /** 脊兽数，奇数 ≤9；灵霄宝殿例外为 10 + 骑凤仙人 */
  ridgeBeasts: number;
  tileColor: 'huang' | 'huang-lv-jianbian' | 'lv' | 'lan' | 'hei';
  /** 门钉路×排，最高 9×9 */
  doorNails: [number, number];
}

/** 清式举架系数。数组长度 = 半跨步架数 = (檩数-1)/2｜文档 02 §3.2 */
export const JUJIA = {
  5: [0.5, 0.7],
  7: [0.5, 0.7, 0.9],
  9: [0.5, 0.7, 0.8, 0.9],
  11: [0.5, 0.65, 0.75, 0.85, 0.95],
} as const;

/** 明代修正：举高下调 5–8%（文档 02 §3.2，待核实幅度，取 0.93） */
export const MING_FACTOR = 0.93;

/**
 * 举架折线：从檐檩到脊檩的剖面点列。
 * @param spanHalf 半跨（檐檩到脊檩的水平距离）
 * @param purlins 檩数
 * @returns 从檐口(x=spanHalf,y=0)到脊檩(x≈0,y=max)的点列
 */
export function purlinPoints(spanHalf: number, purlins: 5 | 7 | 9 | 11): THREE.Vector2[] {
  const coeff = JUJIA[purlins];
  const steps = (purlins - 1) / 2;
  console.assert(
    coeff.length === steps,
    `举架系数个数(${coeff.length})必须等于步架数(${steps})`,
  );

  const stepLen = spanHalf / steps;
  const pts = [new THREE.Vector2(spanHalf, 0)]; // 檐檩
  let x = spanHalf;
  let y = 0;
  for (let i = 0; i < steps; i++) {
    x -= stepLen;
    y += stepLen * coeff[i] * MING_FACTOR; // 不钳位；长度不匹配必须报错
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}

/** 举架折线的反函数：给定距檐口的水平距离 d ∈ [0, spanHalf]，求屋面高度 */
export function juzheHeight(d: number, spanHalf: number, purlins: 5 | 7 | 9 | 11): number {
  const pts = purlinPoints(spanHalf, purlins);
  const dist = THREE.MathUtils.clamp(d, 0, spanHalf); // 距檐口距离；折线点 x 从 spanHalf 递减到 0
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = spanHalf - pts[i].x; // 转为"距檐口"坐标
    const x1 = spanHalf - pts[i + 1].x;
    if (dist >= x0 && dist <= x1) {
      const t = x1 === x0 ? 0 : (dist - x0) / (x1 - x0);
      return THREE.MathUtils.lerp(pts[i].y, pts[i + 1].y, t);
    }
  }
  return pts[pts.length - 1].y;
}

/** 翼角起翘参数｜文档 02 §3.2「冲三翘四」 */
export interface EaveCornerSpec {
  rafterDia: number; // 檐椽径 d
  out: number; // = 3 * d，冲出
  rise: number; // = 4 * d，翘起
  startRatio: number; // 起翘点距角的距离 / 半跨，典型 0.18–0.25
  power: number; // 过渡曲线指数，2.0 = 二次，2.6 更"扬"
}

/** 北方官式默认：翘起克制（文档 02 §3.2） */
export function defaultEaveCorner(scale = 1): EaveCornerSpec {
  const d = 0.2 * scale;
  return { rafterDia: d, out: 3 * d, rise: 4 * d, startRatio: 0.22, power: 2.2 };
}

/** t: 0 = 起翘点, 1 = 转角 */
export function eaveOffset(t: number, s: EaveCornerSpec): { dy: number; dOut: number } {
  const k = Math.pow(THREE.MathUtils.clamp(t, 0, 1), s.power);
  return { dy: s.rise * k, dOut: s.out * k };
}

/** 琉璃瓦配色（文档 03 §2.1，sRGB） */
export const PALETTE = {
  jinqueJin: 0xe8b455, // 金阙金
  liuliHuang: 0xd99b2b, // 琉璃黄
  zhuMenHong: 0xa82f26, // 朱门红
  hanBaiYu: 0xede8dc, // 汉白玉
  ruiqiZi: 0x8b6fb0, // 瑞气紫
  biwuQing: 0x5e8c9e, // 碧雾青
  qiongxiangBai: 0xf5f2ea, // 琼香白
  yuegongYin: 0x8fa4b8, // 月宫银
  danluChi: 0xd4471f, // 丹炉赤
  pantaoFen: 0xe8a0a8, // 蟠桃粉
  liuliLv: 0x3e7c5c, // 绿琉璃
  liuliLan: 0x3a5f8a, // 蓝琉璃
  liuliHei: 0x2b2a33, // 黑琉璃
} as const;

export function tileColorOf(spec: HallSpec): number {
  switch (spec.tileColor) {
    case 'huang':
      return PALETTE.liuliHuang;
    case 'huang-lv-jianbian':
      return PALETTE.liuliHuang; // 檐口剪边由 Roof 顶点色处理
    case 'lv':
      return PALETTE.liuliLv;
    case 'lan':
      return PALETTE.liuliLan;
    case 'hei':
      return PALETTE.liuliHei;
  }
}
