// 匾額與楹聯：把所有題名燒進一張圖集，全園匾額共用一個 draw call
import * as THREE from 'three';

// ---- 橫匾（8 列 × 16 行 = 128 格，每格 256×128）----
const H_COLS = 8, H_ROWS = 16, H_CW = 256, H_CH = 128;
// ---- 豎聯（16 列 × 4 行 = 64 格，每格 128×512）----
const V_COLS = 16, V_ROWS = 4, V_CW = 128, V_CH = 512;

export const PLAQUES = [
  // 寧榮二府
  '敕造寧國府', '敕造榮國府', '榮禧堂', '榮慶堂', '賈氏宗祠', '叢綠堂',
  '天香樓', '登仙閣', '逗蜂軒', '凝曦軒', '佩鳳偕鸞', '夢坡齋', '綺霰齋',
  '梨香院', '議事廳', '儀門', '內儀門', '寧榮街', '賈赦東院', '後罩房',
  '庫房', '賬房', '茶房', '大廚房', '馬廄', '玄真觀',
  // 大觀園
  '大觀園', '省親別墅', '顧恩思義', '天仙寶境', '體仁沐德',
  '瀟湘館', '怡紅院', '蘅蕪苑', '稻香村', '秋爽齋', '綴錦樓', '暖香塢',
  '櫳翠庵', '藕香榭', '蘆雪廣', '凸碧山莊', '凹晶溪館', '嘉蔭堂',
  '滴翠亭', '沁芳亭', '沁芳閘', '沁芳橋', '曲徑通幽', '蓼汀花漵', '荇葉渚',
  '紫菱洲', '杏簾在望', '有鳳來儀', '蘅芷清芬', '紅香綠玉', '翠煙橋', '蜂腰橋',
  '綴錦閣', '含芳閣', '花冢', '小廚房', '折帶朱欄', '梨花春雨',
];

export const COUPLETS = [
  ['繞堤柳借三篙翠', '隔岸花分一脈香'],       // 沁芳亭
  ['寶鼎茶閒煙尚綠', '幽窗棋罷指猶涼'],       // 瀟湘館
  ['吟成豆蔻才猶艷', '睡足酴醾夢也香'],       // 蘅蕪苑
  ['新漲綠添浣葛處', '好雲香護採芹人'],       // 稻香村
  ['座上珠璣昭日月', '堂前黼黻煥煙霞'],       // 榮禧堂
  ['嫩寒鎖夢因春冷', '芳氣籠人是酒香'],       // 秦可卿臥房
  ['煙霞閒骨格', '泉石野生涯'],               // 櫳翠庵
  ['三徑香風飄玉蕙', '一庭明月照金蘭'],       // 秋爽齋
];

const hIndex = new Map();
const vIndex = new Map();

function drawPlaqueCell(g, x, y, w, h, text) {
  // 青地描金
  g.fillStyle = '#16273a';
  g.fillRect(x, y, w, h);
  const gd = g.createLinearGradient(x, y, x, y + h);
  gd.addColorStop(0, 'rgba(255,255,255,0.10)');
  gd.addColorStop(0.5, 'rgba(0,0,0,0.10)');
  gd.addColorStop(1, 'rgba(0,0,0,0.24)');
  g.fillStyle = gd; g.fillRect(x, y, w, h);
  // 金邊
  g.strokeStyle = '#c2a04e';
  g.lineWidth = Math.max(2, h * 0.045);
  g.strokeRect(x + h * 0.06, y + h * 0.06, w - h * 0.12, h - h * 0.12);
  // 題字
  const n = text.length;
  const size = Math.min(h * 0.62, (w - h * 0.34) / n * 0.98);
  g.font = `bold ${size}px "Songti SC","STSong","SimSun","Noto Serif CJK SC",serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const step = (w - h * 0.3) / n;
  for (let i = 0; i < n; i++) {
    const cx = x + h * 0.15 + step * (i + 0.5);
    const cy = y + h * 0.52;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillText(text[i], cx + size * 0.03, cy + size * 0.03);
    g.fillStyle = '#e0bd63';
    g.fillText(text[i], cx, cy);
  }
}

function drawCoupletCell(g, x, y, w, h, text) {
  g.fillStyle = '#7a2d24';
  g.fillRect(x, y, w, h);
  const gd = g.createLinearGradient(x, y, x + w, y);
  gd.addColorStop(0, 'rgba(255,255,255,0.10)');
  gd.addColorStop(0.6, 'rgba(0,0,0,0.06)');
  gd.addColorStop(1, 'rgba(0,0,0,0.26)');
  g.fillStyle = gd; g.fillRect(x, y, w, h);
  g.strokeStyle = '#c2a04e'; g.lineWidth = 2;
  g.strokeRect(x + 5, y + 5, w - 10, h - 10);
  const n = text.length;
  const size = Math.min(w * 0.66, (h - 24) / n * 0.92);
  g.font = `bold ${size}px "Songti SC","STSong","SimSun","Noto Serif CJK SC",serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const step = (h - 24) / n;
  for (let i = 0; i < n; i++) {
    const cx = x + w * 0.5;
    const cy = y + 12 + step * (i + 0.5);
    g.fillStyle = 'rgba(0,0,0,0.40)';
    g.fillText(text[i], cx + 2, cy + 2);
    g.fillStyle = '#f0dfa8';
    g.fillText(text[i], cx, cy);
  }
}

let hTex = null, vTex = null;

export function buildPlaqueTextures() {
  if (hTex) return;
  // 橫匾
  const c1 = document.createElement('canvas');
  c1.width = H_COLS * H_CW; c1.height = H_ROWS * H_CH;
  const g1 = c1.getContext('2d');
  g1.fillStyle = '#16273a'; g1.fillRect(0, 0, c1.width, c1.height);
  PLAQUES.forEach((t, i) => {
    const col = i % H_COLS, row = (i / H_COLS) | 0;
    if (row >= H_ROWS) return;
    drawPlaqueCell(g1, col * H_CW, row * H_CH, H_CW, H_CH, t);
    hIndex.set(t, [
      (col * H_CW + 1) / c1.width, 1 - (row * H_CH + H_CH - 1) / c1.height,
      ((col + 1) * H_CW - 1) / c1.width, 1 - (row * H_CH + 1) / c1.height,
    ]);
  });
  hTex = new THREE.CanvasTexture(c1);
  hTex.colorSpace = THREE.SRGBColorSpace;
  hTex.anisotropy = 8;

  // 豎聯
  const c2 = document.createElement('canvas');
  c2.width = V_COLS * V_CW; c2.height = V_ROWS * V_CH;
  const g2 = c2.getContext('2d');
  g2.fillStyle = '#7a2d24'; g2.fillRect(0, 0, c2.width, c2.height);
  const flat = [];
  COUPLETS.forEach((pair) => { flat.push(pair[0], pair[1]); });
  flat.forEach((t, i) => {
    const col = i % V_COLS, row = (i / V_COLS) | 0;
    if (row >= V_ROWS) return;
    drawCoupletCell(g2, col * V_CW, row * V_CH, V_CW, V_CH, t);
    vIndex.set(t, [
      (col * V_CW + 1) / c2.width, 1 - (row * V_CH + V_CH - 1) / c2.height,
      ((col + 1) * V_CW - 1) / c2.width, 1 - (row * V_CH + 1) / c2.height,
    ]);
  });
  vTex = new THREE.CanvasTexture(c2);
  vTex.colorSpace = THREE.SRGBColorSpace;
  vTex.anisotropy = 8;
}

export function plaqueTexture() { buildPlaqueTextures(); return hTex; }
export function coupletTexture() { buildPlaqueTextures(); return vTex; }

// 未登記的題名（自檢用）
export const plaqueMisses = new Set();

/** 返回 [u0,v0,u1,v1]；未登記的題名回落到第一格 */
export function plaqueUV(text) {
  buildPlaqueTextures();
  const hit = hIndex.get(text);
  if (!hit) plaqueMisses.add(text);
  return hit ?? hIndex.get(PLAQUES[0]);
}
export function coupletUV(text) {
  buildPlaqueTextures();
  const hit = vIndex.get(text);
  if (!hit) plaqueMisses.add(`（聯）${text}`);
  return hit ?? vIndex.get(COUPLETS[0][0]);
}
