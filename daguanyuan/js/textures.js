// 程序化貼圖 —— 全部 Canvas 生成，無外部資源
import * as THREE from 'three';

const cache = {};
// 每張貼圖的線性平均亮度：頂點色按 1/mean 提亮，使 map × vertexColor 恰好還原調色板色
const texMean = {};

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** 細節貼圖歸一：壓成接近白的灰度細節，色調交由頂點色承擔 */
function normalize(g, size, target = 0.84, desat = 0.78) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  let sum = 0;
  const N = d.length / 4;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const mean = sum / N / 255;
  const k = target / Math.max(0.04, mean);
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.max(0, Math.min(255, (d[i + c] * (1 - desat) + lum * desat) * k));
    }
  }
  g.putImageData(img, 0, 0);
}

function measure(g, size) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  let sum = 0;
  const N = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    sum += 0.299 * srgbToLinear(d[i] / 255) + 0.587 * srgbToLinear(d[i + 1] / 255) + 0.114 * srgbToLinear(d[i + 2] / 255);
  }
  return sum / N;
}

function cv(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function finish(canvas, { aniso = 8, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 均勻噪點（做舊、斑駁）
function grain(g, size, amount, alpha) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
    if (alpha !== undefined) d[i + 3] = Math.min(255, d[i + 3] * alpha);
  }
  g.putImageData(img, 0, 0);
}

// 柔和斑塊（粉牆水漬、石皴）
function blobs(g, size, n, color, r0, r1, a0, a1) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = r0 + Math.random() * (r1 - r0);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = a0 + Math.random() * (a1 - a0);
    grd.addColorStop(0, `rgba(${color},${a})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
}

// ---------------------------------------------------------------- 瓦作
// 筒瓦壟：U 方向為壟（跨脊），V 方向沿坡向下，末端一排瓦當
function drawTile(g, S, base, hi, lo) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const rows = 8;                       // 8 壟
  const w = S / rows;
  for (let i = 0; i < rows; i++) {
    const x = i * w;
    // 板瓦凹槽（壟間）
    const gl = g.createLinearGradient(x, 0, x + w, 0);
    gl.addColorStop(0.00, lo);
    gl.addColorStop(0.16, base);
    gl.addColorStop(0.42, hi);
    gl.addColorStop(0.58, hi);
    gl.addColorStop(0.84, base);
    gl.addColorStop(1.00, lo);
    g.fillStyle = gl;
    g.fillRect(x, 0, w, S);
    // 筒瓦節（沿坡的橫向瓦口線）
    g.strokeStyle = 'rgba(0,0,0,0.20)';
    g.lineWidth = 1.1;
    for (let y = 0; y < S; y += S / 7) {
      g.beginPath();
      g.moveTo(x + w * 0.30, y);
      g.bezierCurveTo(x + w * 0.42, y + 2.6, x + w * 0.58, y + 2.6, x + w * 0.70, y);
      g.stroke();
    }
  }
  grain(g, S, 22);
}

// 屋脊：連珠磚雕紋
function drawRidge(g, S, base) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2;
  for (let y = 0; y < S; y += S / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let x = 0; x < S; x += S / 10) g.fillRect(x + 2, S * 0.28, S / 22, S * 0.44);
  grain(g, S, 16);
}

// ---------------------------------------------------------------- 磚石
function drawBrick(g, S) {
  g.fillStyle = '#8b8983'; g.fillRect(0, 0, S, S);
  const rows = 14, h = S / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (S / 8);
    for (let c = -1; c < 8; c++) {
      const x = c * (S / 4) + off, y = r * h;
      const v = 0.94 + Math.random() * 0.10;
      g.fillStyle = `rgb(${Math.round(139 * v)},${Math.round(137 * v)},${Math.round(131 * v)})`;
      g.fillRect(x + 1, y + 1, S / 4 - 2, h - 2);
    }
  }
  grain(g, S, 16);
}

// 方磚墁地：大方磚，磨磚對縫
function drawMandi(g, S) {
  g.fillStyle = '#9a978d'; g.fillRect(0, 0, S, S);
  const n = 4, u = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 0.95 + Math.random() * 0.09;
    g.fillStyle = `rgb(${Math.round(154 * v)},${Math.round(151 * v)},${Math.round(141 * v)})`;
    g.fillRect(i * u + 1.5, j * u + 1.5, u - 3, u - 3);
    blobs(g, S, 0);
  }
  g.globalAlpha = 0.5; blobs(g, S, 26, '120,116,104', 6, 22, 0.05, 0.16); g.globalAlpha = 1;
  grain(g, S, 12);
}

// 卵石花街：園徑的碎石拼花
function drawCobble(g, S) {
  g.fillStyle = '#7d7a70'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 2.4 + Math.random() * 4.2;
    const t = Math.random();
    const c = t < 0.5 ? [150, 146, 134] : t < 0.78 ? [116, 112, 100] : [178, 170, 152];
    g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.7 + Math.random() * 0.5), Math.random() * 3.14, 0, 7);
    g.fill();
  }
  grain(g, S, 14);
}

// 漢白玉
function drawStone(g, S) {
  g.fillStyle = '#dcd8cc'; g.fillRect(0, 0, S, S);
  blobs(g, S, 30, '190,186,172', 10, 40, 0.05, 0.14);
  g.strokeStyle = 'rgba(150,146,132,0.28)'; g.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    let x = Math.random() * S, y = Math.random() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  grain(g, S, 8);
}

// 太湖石：瘦漏透皺的皴筆
function drawRock(g, S) {
  g.fillStyle = '#8d8b81'; g.fillRect(0, 0, S, S);
  blobs(g, S, 70, '96,95,88', 6, 30, 0.14, 0.34);
  blobs(g, S, 46, '186,184,174', 4, 18, 0.10, 0.24);
  blobs(g, S, 26, '62,62,58', 3, 12, 0.16, 0.34);
  // 皴：短促、方向散乱，免得被三向映射拉成一圈圈条纹
  g.strokeStyle = 'rgba(62,62,56,0.44)';
  for (let i = 0; i < 150; i++) {
    g.lineWidth = 0.5 + Math.random() * 1.4;
    let x = Math.random() * S, y = Math.random() * S;
    let a = Math.random() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      a += (Math.random() - 0.5) * 1.6;
      x += Math.cos(a) * (4 + Math.random() * 9);
      y += Math.sin(a) * (4 + Math.random() * 9);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // 石眼（漏）
  g.fillStyle = 'rgba(48,48,44,0.55)';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.ellipse(Math.random() * S, Math.random() * S, 3 + Math.random() * 7, 4 + Math.random() * 9, Math.random() * 3, 0, 7);
    g.fill();
  }
  grain(g, S, 18);
}

// ---------------------------------------------------------------- 牆體
function drawPlaster(g, S) {
  g.fillStyle = '#e9e3d5'; g.fillRect(0, 0, S, S);
  blobs(g, S, 34, '198,190,172', 16, 62, 0.05, 0.15);
  blobs(g, S, 14, '250,248,240', 20, 60, 0.06, 0.16);
  // 牆根返潮
  const gl = g.createLinearGradient(0, S * 0.72, 0, S);
  gl.addColorStop(0, 'rgba(150,146,130,0)');
  gl.addColorStop(1, 'rgba(150,146,130,0.26)');
  g.fillStyle = gl; g.fillRect(0, S * 0.72, S, S * 0.28);
  grain(g, S, 10);
}

function drawEarth(g, S) {
  g.fillStyle = '#b59a63'; g.fillRect(0, 0, S, S);
  blobs(g, S, 40, '150,124,74', 10, 44, 0.08, 0.22);
  g.strokeStyle = 'rgba(120,98,58,0.30)'; g.lineWidth = 2;
  for (let y = S / 6; y < S; y += S / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  // 稻莖掩護
  g.strokeStyle = 'rgba(196,176,120,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 16, y + 8 + Math.random() * 12); g.stroke();
  }
  grain(g, S, 20);
}

// ---------------------------------------------------------------- 木作
function drawWood(g, S) {
  g.fillStyle = '#6a4a34'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 34; i++) {
    g.strokeStyle = `rgba(${40 + Math.random() * 60},${26 + Math.random() * 40},${16 + Math.random() * 28},${0.16 + Math.random() * 0.3})`;
    g.lineWidth = 0.7 + Math.random() * 2.6;
    g.beginPath();
    const y0 = Math.random() * S;
    g.moveTo(0, y0);
    for (let x = 0; x <= S; x += S / 8) g.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 4 + (Math.random() - 0.5) * 3);
    g.stroke();
  }
  grain(g, S, 12);
}

// ---------------------------------------------------------------- 槅扇櫺心
// 步步錦：橫豎短棂拼接的「錦」字紋
function drawLattice(g, S) {
  g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, S, S);   // 糊紙
  g.strokeStyle = '#6a4a34'; g.lineCap = 'square';
  const cell = S / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * cell, y = j * cell;
    g.lineWidth = S / 44;
    // 外框
    g.strokeRect(x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88);
    g.lineWidth = S / 64;
    // 步步錦：階梯狀短棂
    g.beginPath();
    g.moveTo(x + cell * 0.06, y + cell * 0.32); g.lineTo(x + cell * 0.60, y + cell * 0.32);
    g.moveTo(x + cell * 0.60, y + cell * 0.32); g.lineTo(x + cell * 0.60, y + cell * 0.94);
    g.moveTo(x + cell * 0.34, y + cell * 0.62); g.lineTo(x + cell * 0.94, y + cell * 0.62);
    g.moveTo(x + cell * 0.34, y + cell * 0.06); g.lineTo(x + cell * 0.34, y + cell * 0.62);
    g.stroke();
  }
}

// 冰裂紋（園中軒館、什錦窗）
function drawIce(g, S) {
  g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#5a3f2c'; g.lineWidth = S / 52;
  const pts = [];
  for (let i = 0; i < 26; i++) pts.push([Math.random() * S, Math.random() * S]);
  for (let i = 0; i < pts.length; i++) {
    // 連最近的三個點，形成不規則多邊裂紋
    const d = pts.map((p, j) => [((p[0] - pts[i][0]) ** 2 + (p[1] - pts[i][1]) ** 2), j]).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k <= 3; k++) {
      const j = d[k][1];
      g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.stroke();
    }
  }
}

// 龜背錦（高等級槅扇）
function drawTortoise(g, S) {
  g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#5a3f2c'; g.lineWidth = S / 48;
  const r = S / 8, h = r * Math.sqrt(3) / 2;
  for (let row = -1; row * h < S + h; row++) {
    for (let col = -1; col * r * 1.5 < S + r; col++) {
      const cx = col * r * 1.5;
      const cy = row * h * 2 + (col % 2 ? h : 0);
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 3 * k;
        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.stroke();
    }
  }
}

// 直櫺窗（下人房、庫房）
function drawZhiling(g, S) {
  g.fillStyle = '#e2dcca'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#6a4a34';
  for (let x = 0; x < S; x += S / 10) g.fillRect(x, 0, S / 22, S);
  g.fillRect(0, S * 0.46, S, S / 34);
}

// ---------------------------------------------------------------- 彩畫
// 旋子彩畫：箍頭｜藻頭（旋花）｜枋心｜藻頭｜箍頭，青綠相間
function drawXuanzi(g, S) {
  const H = S;
  g.fillStyle = '#2c5c85'; g.fillRect(0, 0, S, H);
  const white = 'rgba(232,226,214,0.92)';
  const gold = '#c2a04e';
  const green = '#2f7358';

  // 上下暈邊
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, S, H * 0.07);
  g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(0, H * 0.93, S, H * 0.07);

  // 箍頭（兩端）
  const gw = S * 0.08;
  for (const x0 of [0, S - gw]) {
    g.fillStyle = green; g.fillRect(x0, 0, gw, H);
    g.strokeStyle = white; g.lineWidth = S / 180;
    g.strokeRect(x0 + gw * 0.16, H * 0.16, gw * 0.68, H * 0.68);
    // 回紋
    g.beginPath();
    g.moveTo(x0 + gw * 0.3, H * 0.34); g.lineTo(x0 + gw * 0.7, H * 0.34);
    g.lineTo(x0 + gw * 0.7, H * 0.66); g.lineTo(x0 + gw * 0.42, H * 0.66);
    g.stroke();
  }

  // 枋心（中段，深青地，行龍/錦紋）
  const fx0 = S * 0.34, fx1 = S * 0.66;
  g.fillStyle = '#1f4463'; g.fillRect(fx0, H * 0.10, fx1 - fx0, H * 0.80);
  g.strokeStyle = white; g.lineWidth = S / 190;
  g.strokeRect(fx0, H * 0.10, fx1 - fx0, H * 0.80);
  g.strokeStyle = gold; g.lineWidth = S / 150;
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const px = fx0 + (fx1 - fx0) * t;
    const py = H * 0.5 + Math.sin(t * Math.PI * 3) * H * 0.18;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
  g.fillStyle = gold;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(fx0 + (fx1 - fx0) * (0.12 + i * 0.19), H * 0.5 + Math.sin((0.12 + i * 0.19) * Math.PI * 3) * H * 0.18, S / 90, 0, 7);
    g.fill();
  }

  // 藻頭旋花（枋心兩側）
  for (const [ax0, ax1] of [[gw, fx0], [fx1, S - gw]]) {
    const cwd = ax1 - ax0;
    g.fillStyle = '#2c5c85'; g.fillRect(ax0, 0, cwd, H);
    for (let k = 0; k < 2; k++) {
      const cx = ax0 + cwd * (0.30 + k * 0.44), cy = H * 0.5;
      const rr = Math.min(cwd * 0.19, H * 0.34);
      // 旋眼
      g.fillStyle = gold; g.beginPath(); g.arc(cx, cy, rr * 0.24, 0, 7); g.fill();
      // 三層旋瓣
      for (let ring = 1; ring <= 3; ring++) {
        g.strokeStyle = ring % 2 ? white : green;
        g.lineWidth = S / (170 + ring * 30);
        g.beginPath(); g.arc(cx, cy, rr * (0.24 + ring * 0.24), 0, 7); g.stroke();
        for (let p = 0; p < 8; p++) {
          const a = p * Math.PI / 4 + ring * 0.35;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * rr * (0.24 + (ring - 1) * 0.24), cy + Math.sin(a) * rr * (0.24 + (ring - 1) * 0.24));
          g.lineTo(cx + Math.cos(a + 0.4) * rr * (0.24 + ring * 0.24), cy + Math.sin(a + 0.4) * rr * (0.24 + ring * 0.24));
          g.stroke();
        }
      }
    }
    // 岔口線
    g.strokeStyle = white; g.lineWidth = S / 170;
    g.beginPath(); g.moveTo(ax1, H * 0.06); g.lineTo(ax1 - cwd * 0.12, H * 0.5); g.lineTo(ax1, H * 0.94); g.stroke();
  }
  grain(g, S, 8);
}

// 和璽彩畫（最高等級：金龍、瀝粉貼金）
function drawHexi(g, S) {
  const H = S;
  g.fillStyle = '#1f4463'; g.fillRect(0, 0, S, H);
  g.fillStyle = '#2f7358'; g.fillRect(0, 0, S * 0.10, H); g.fillRect(S * 0.90, 0, S * 0.10, H);
  const gold = '#d0ad55';
  // 「W」形分界（和璽的圭線）
  g.strokeStyle = gold; g.lineWidth = S / 90;
  for (const dir of [1, -1]) {
    g.beginPath();
    g.moveTo(S * 0.10, dir > 0 ? 0 : H);
    g.lineTo(S * 0.26, H * 0.5);
    g.lineTo(S * 0.42, dir > 0 ? 0 : H);
    g.moveTo(S * 0.58, dir > 0 ? 0 : H);
    g.lineTo(S * 0.74, H * 0.5);
    g.lineTo(S * 0.90, dir > 0 ? 0 : H);
    g.stroke();
  }
  // 行龍
  g.strokeStyle = gold; g.lineWidth = S / 60;
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const px = S * (0.12 + t * 0.76);
    const py = H * 0.5 + Math.sin(t * Math.PI * 4) * H * 0.26;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
  g.fillStyle = gold;
  for (let i = 0; i < 10; i++) {
    const t = i / 10 + 0.05;
    g.beginPath();
    g.arc(S * (0.12 + t * 0.76), H * 0.5 + Math.sin(t * Math.PI * 4) * H * 0.26, S / 70, 0, 7);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, S, H * 0.06);
  grain(g, S, 6);
}

// 蘇式彩畫（園林軒館：包袱、卡子、寫生畫）
function drawSushi(g, S) {
  const H = S;
  g.fillStyle = '#2f7358'; g.fillRect(0, 0, S, H);
  g.fillStyle = '#2c5c85'; g.fillRect(0, 0, S * 0.11, H); g.fillRect(S * 0.89, 0, S * 0.11, H);
  // 包袱（中央半圓）
  g.fillStyle = '#e6e2d6';
  g.beginPath();
  g.moveTo(S * 0.28, H);
  g.bezierCurveTo(S * 0.30, H * 0.06, S * 0.70, H * 0.06, S * 0.72, H);
  g.closePath(); g.fill();
  g.strokeStyle = '#2c5c85'; g.lineWidth = S / 120; g.stroke();
  // 包袱內寫生：遠山、竹枝
  g.strokeStyle = 'rgba(60,90,100,0.75)'; g.lineWidth = S / 200;
  g.beginPath();
  g.moveTo(S * 0.33, H * 0.62);
  g.lineTo(S * 0.40, H * 0.42); g.lineTo(S * 0.47, H * 0.60);
  g.lineTo(S * 0.55, H * 0.34); g.lineTo(S * 0.66, H * 0.64);
  g.stroke();
  g.strokeStyle = 'rgba(70,110,60,0.8)';
  for (let i = 0; i < 5; i++) {
    const bx = S * (0.36 + i * 0.07);
    g.beginPath(); g.moveTo(bx, H * 0.92); g.lineTo(bx + S * 0.01, H * 0.66); g.stroke();
  }
  // 卡子（兩側草花）
  g.strokeStyle = '#c2a04e'; g.lineWidth = S / 150;
  for (const cx of [S * 0.18, S * 0.82]) {
    g.beginPath();
    g.arc(cx, H * 0.5, H * 0.22, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      g.beginPath();
      g.moveTo(cx, H * 0.5);
      g.lineTo(cx + Math.cos(a) * H * 0.22, H * 0.5 + Math.sin(a) * H * 0.22);
      g.stroke();
    }
  }
  grain(g, S, 8);
}

// ---------------------------------------------------------------- 其他
function drawThatch(g, S) {
  g.fillStyle = '#b6a173'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const v = 0.7 + Math.random() * 0.55;
    g.strokeStyle = `rgba(${Math.round(190 * v)},${Math.round(168 * v)},${Math.round(114 * v)},0.85)`;
    g.lineWidth = 0.7 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 5, y + 9 + Math.random() * 16); g.stroke();
  }
  grain(g, S, 18);
}

function drawSilk(g, S) {
  g.fillStyle = '#b8474f'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,235,220,0.13)'; g.lineWidth = 1;
  for (let x = 0; x < S; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  for (let y = 0; y < S; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  // 團花
  g.strokeStyle = 'rgba(255,225,170,0.34)'; g.lineWidth = 1.6;
  for (const [cx, cy] of [[S * 0.25, S * 0.25], [S * 0.75, S * 0.75], [S * 0.75, S * 0.25], [S * 0.25, S * 0.75]]) {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * S * 0.05, cy + Math.sin(a) * S * 0.05, S * 0.045, S * 0.02, a, 0, 7);
      g.stroke();
    }
  }
  grain(g, S, 8);
}

function drawPaper(g, S) {
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, S, S);
  blobs(g, S, 26, '210,202,182', 12, 40, 0.05, 0.13);
  g.strokeStyle = 'rgba(196,188,166,0.4)'; g.lineWidth = 0.8;
  for (let y = 0; y < S; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  grain(g, S, 8);
}

function drawBamboo(g, S) {
  g.fillStyle = '#7f9a52'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += S / 6) {
    const gl = g.createLinearGradient(x, 0, x + S / 6, 0);
    gl.addColorStop(0, '#5f7a3c'); gl.addColorStop(0.45, '#8fae5e'); gl.addColorStop(1, '#5f7a3c');
    g.fillStyle = gl; g.fillRect(x, 0, S / 6, S);
    g.strokeStyle = 'rgba(60,80,40,0.5)'; g.lineWidth = 2;
    for (let y = S / 5; y < S; y += S / 5) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + S / 6, y); g.stroke(); }
  }
  grain(g, S, 12);
}

// 草地／苔痕
function drawGrass(g, S) {
  g.fillStyle = '#6f8b4e'; g.fillRect(0, 0, S, S);
  blobs(g, S, 40, '90,116,60', 14, 48, 0.10, 0.24);
  blobs(g, S, 24, '140,160,96', 10, 34, 0.06, 0.18);
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    g.strokeStyle = `rgba(${70 + Math.random() * 70},${100 + Math.random() * 60},${50 + Math.random() * 40},0.5)`;
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y - 4 - Math.random() * 6); g.stroke();
  }
  grain(g, S, 14);
}

// 匾額底（黑漆／青地，供貼金字）
function drawPlaqueBase(g, S) {
  g.fillStyle = '#1d3348'; g.fillRect(0, 0, S, S);
  blobs(g, S, 20, '10,20,32', 20, 60, 0.10, 0.26);
  g.strokeStyle = '#c2a04e'; g.lineWidth = S / 40;
  g.strokeRect(S * 0.05, S * 0.05, S * 0.9, S * 0.9);
  grain(g, S, 8);
}

// ---------------------------------------------------------------- 枝葉（帶透明通道）
// 樹冠不再拿球體堆，改用帶 alpha 的葉叢貼圖交叉成片——同樣的面數，形態細得多。
function leafBlade(g, x, y, L, W, ang, fill, stroke) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(W, -L * 0.32, 0, -L);
  g.quadraticCurveTo(-W, -L * 0.32, 0, 0);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = Math.max(0.5, L * 0.03); g.stroke(); }
  g.restore();
}

// 闊葉樹冠：疏密有致的一叢，邊緣參差
function drawLeaf(g, S) {
  g.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  // 細枝
  g.strokeStyle = 'rgba(86,66,44,0.85)';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.36;
    g.lineWidth = S * 0.012;
    g.beginPath(); g.moveTo(cx, S * 0.98);
    g.quadraticCurveTo(cx + Math.cos(a) * S * 0.16, cy, cx + Math.cos(a) * S * 0.40, cy + Math.sin(a) * S * 0.34);
    g.stroke();
  }
  const greens = ['#4d7038', '#5b8140', '#6b9349', '#3f6030', '#7aa356'];
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.pow(Math.random(), 0.62) * S * 0.46;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.92;
    const d = rr / (S * 0.46);
    if (Math.random() < d * d * 0.75) continue;           // 邊緣自然變稀
    const L = S * (0.10 - d * 0.035) * (0.7 + Math.random() * 0.7);
    leafBlade(g, x, y, L, L * 0.34, Math.random() * Math.PI * 2,
      greens[(Math.random() * greens.length) | 0], 'rgba(40,58,30,0.35)');
  }
}

// 垂柳：自上而下的長條，末梢略向外飄
function drawWillow(g, S) {
  g.clearRect(0, 0, S, S);
  const n = 15;
  for (let i = 0; i < n; i++) {
    const x0 = S * (0.06 + 0.88 * (i + (Math.random() - 0.5) * 0.6) / n);
    const sway = (x0 - S / 2) / (S / 2);                  // 越外側飄得越開
    const len = S * (0.62 + Math.random() * 0.36);
    const tip = x0 + sway * S * 0.16 + (Math.random() - 0.5) * S * 0.05;
    g.strokeStyle = 'rgba(96,120,58,0.9)';
    g.lineWidth = S * 0.007;
    g.beginPath();
    g.moveTo(x0, 0);
    g.quadraticCurveTo(x0 + sway * S * 0.04, len * 0.5, tip, len);
    g.stroke();
    const steps = Math.round(len / (S * 0.028));
    for (let k = 2; k < steps; k++) {
      const t = k / steps;
      const px = x0 * (1 - t) * (1 - t) + 2 * (x0 + sway * S * 0.04) * t * (1 - t) + tip * t * t;
      const py = len * t;
      const L = S * 0.052 * (0.6 + 0.55 * (1 - t));
      const shade = t > 0.72 ? '#8fb264' : (k % 2 ? '#6e8f42' : '#7ea44f');
      leafBlade(g, px, py, L, L * 0.17, (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7), shade, null);
    }
  }
}

// 松針：一層平展的針葉扇
function drawPine(g, S) {
  g.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  g.strokeStyle = 'rgba(70,54,36,0.9)'; g.lineWidth = S * 0.014;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * S * 0.44, cy + Math.sin(a) * S * 0.44); g.stroke();
  }
  for (let i = 0; i < 190; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.pow(Math.random(), 0.55) * S * 0.46;
    if (rr > S * 0.42 && Math.random() < 0.6) continue;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    const na = a + (Math.random() - 0.5) * 0.9;
    const L = S * 0.075 * (0.6 + Math.random() * 0.7);
    g.strokeStyle = Math.random() < 0.5 ? '#2f5233' : '#3b6540';
    g.lineWidth = S * 0.006;
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(na + k * 0.13) * L, y + Math.sin(na + k * 0.13) * L);
      g.stroke();
    }
  }
}

// 花枝：五瓣花成簇，顏色由頂點色定（海棠、杏、梅、桃、梨共用）
function drawBlossom(g, S) {
  g.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  g.strokeStyle = 'rgba(84,60,44,0.9)';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.42;
    g.lineWidth = S * 0.013;
    g.beginPath(); g.moveTo(cx, S * 0.99);
    g.quadraticCurveTo(cx + Math.cos(a) * S * 0.14, cy, cx + Math.cos(a) * S * 0.40, cy + Math.sin(a) * S * 0.30);
    g.stroke();
  }
  // 少量襯葉
  for (let i = 0; i < 55; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 0.6) * S * 0.42;
    leafBlade(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92, S * 0.06, S * 0.022,
      Math.random() * 6.28, '#6b8f4a', null);
  }
  for (let i = 0; i < 120; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.pow(Math.random(), 0.6) * S * 0.45;
    const d = rr / (S * 0.45);
    if (Math.random() < d * d * 0.8) continue;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.92;
    const R = S * 0.030 * (0.7 + Math.random() * 0.6);
    const base = Math.random() < 0.35 ? '#ffffff' : '#f6e2e6';
    for (let p = 0; p < 5; p++) {
      const pa = p * 1.2566 + Math.random() * 0.2;
      g.beginPath();
      g.ellipse(x + Math.cos(pa) * R * 0.75, y + Math.sin(pa) * R * 0.75, R * 0.62, R * 0.48, pa, 0, 7);
      g.fillStyle = base; g.fill();
      g.strokeStyle = 'rgba(190,140,150,0.5)'; g.lineWidth = 0.7; g.stroke();
    }
    g.beginPath(); g.arc(x, y, R * 0.26, 0, 7);
    g.fillStyle = '#d8b24e'; g.fill();
  }
}

// 竹葉：細長披針，三五成簇
function drawBambooLeaf(g, S) {
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 34; i++) {
    const x = S * (0.08 + Math.random() * 0.84);
    const y = S * (0.10 + Math.random() * 0.80);
    const a0 = (Math.random() - 0.5) * 2.2;
    g.strokeStyle = 'rgba(90,120,52,0.85)'; g.lineWidth = S * 0.006;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a0 - 1.57) * S * 0.09, y + Math.sin(a0 - 1.57) * S * 0.09); g.stroke();
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k - 1.5) * 0.34;
      leafBlade(g, x, y, S * (0.15 + Math.random() * 0.09), S * 0.023, a,
        k % 2 ? '#6f9247' : '#5c8039', 'rgba(50,74,34,0.4)');
    }
  }
}

// 芭蕉葉：一片大葉，中肋與平行脈，邊緣有裂
function drawBanana(g, S) {
  g.clearRect(0, 0, S, S);
  const cx = S / 2;
  g.beginPath();
  g.moveTo(cx, S * 0.99);
  g.bezierCurveTo(cx - S * 0.40, S * 0.72, cx - S * 0.34, S * 0.20, cx, S * 0.02);
  g.bezierCurveTo(cx + S * 0.34, S * 0.20, cx + S * 0.40, S * 0.72, cx, S * 0.99);
  g.closePath();
  g.fillStyle = '#4e7a42'; g.fill();
  g.strokeStyle = 'rgba(40,66,34,0.6)'; g.lineWidth = S * 0.008; g.stroke();
  g.strokeStyle = 'rgba(150,180,110,0.75)'; g.lineWidth = S * 0.022;
  g.beginPath(); g.moveTo(cx, S * 0.98); g.lineTo(cx, S * 0.04); g.stroke();
  g.lineWidth = S * 0.007;
  for (let i = 1; i < 26; i++) {
    const t = i / 26, y = S * (0.96 - t * 0.9);
    const w = Math.sin(t * Math.PI) * S * 0.36;
    for (const sgn of [-1, 1]) {
      g.strokeStyle = 'rgba(120,155,88,0.55)';
      g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + sgn * w, y - S * 0.06); g.stroke();
    }
    if (i % 5 === 0) {                                    // 葉緣裂口
      for (const sgn of [-1, 1]) {
        g.globalCompositeOperation = 'destination-out';
        g.lineWidth = S * 0.02;
        g.strokeStyle = '#000';
        g.beginPath(); g.moveTo(cx + sgn * w, y - S * 0.06); g.lineTo(cx + sgn * w * 0.55, y - S * 0.03); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
    }
  }
}

// 草叢與野花
function drawTuft(g, S) {
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 46; i++) {
    const x = S * (0.06 + Math.random() * 0.88);
    const h = S * (0.42 + Math.random() * 0.5);
    const bend = (Math.random() - 0.5) * S * 0.24;
    g.strokeStyle = ['#5f7f3c', '#6f9147', '#7ea052', '#54713a'][(Math.random() * 4) | 0];
    g.lineWidth = S * (0.008 + Math.random() * 0.008);
    g.beginPath();
    g.moveTo(x, S);
    g.quadraticCurveTo(x + bend * 0.4, S - h * 0.55, x + bend, S - h);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = S * (0.12 + Math.random() * 0.76), y = S * (0.18 + Math.random() * 0.44);
    g.fillStyle = ['#e8e0c0', '#e2c8d2', '#dcd0a0'][(Math.random() * 3) | 0];
    for (let p = 0; p < 5; p++) {
      const pa = p * 1.2566;
      g.beginPath(); g.ellipse(x + Math.cos(pa) * S * 0.016, y + Math.sin(pa) * S * 0.016, S * 0.014, S * 0.010, pa, 0, 7); g.fill();
    }
  }
}

const DRAW = {
  tile: [null, 256, (g, S) => drawTile(g, S, '#545a5f', '#6b7176', '#3c4145')],
  liuli: [null, 256, (g, S) => drawTile(g, S, '#3a6b52', '#4f8468', '#26493a')],
  ridge: [null, 128, (g, S) => drawRidge(g, S, '#44494d')],
  brick: [null, 256, drawBrick],
  mandi: [null, 256, drawMandi],
  cobble: [null, 256, drawCobble],
  stone: [null, 256, drawStone],
  rock: [null, 256, drawRock],
  plaster: [null, 256, drawPlaster],
  earth: [null, 256, drawEarth],
  wood: [null, 256, drawWood],
  lattice: [null, 256, drawLattice],
  ice: [null, 256, drawIce],
  tortoise: [null, 256, drawTortoise],
  zhiling: [null, 128, drawZhiling],
  xuanzi: [null, 512, drawXuanzi],
  hexi: [null, 512, drawHexi],
  sushi: [null, 512, drawSushi],
  thatch: [null, 256, drawThatch],
  silk: [null, 256, drawSilk],
  paper: [null, 256, drawPaper],
  bamboo: [null, 256, drawBamboo],
  grass: [null, 256, drawGrass],
  plaque: [null, 256, drawPlaqueBase],
  leaf: [null, 320, drawLeaf],
  willow: [null, 320, drawWillow],
  pine: [null, 256, drawPine],
  blossom: [null, 320, drawBlossom],
  bambooleaf: [null, 256, drawBambooLeaf],
  banana: [null, 256, drawBanana],
  tuft: [null, 192, drawTuft],
};

// 需要歸一的「細節」通道（色調由頂點色給）；彩畫、櫺心、匾額保留本色
const NORMALIZE = new Set([
  'tile', 'liuli', 'ridge', 'brick', 'mandi', 'cobble', 'stone', 'rock',
  'plaster', 'earth', 'wood', 'thatch', 'silk', 'paper', 'bamboo', 'grass',
]);

export function getTexture(name) {
  if (cache[name]) return cache[name];
  const entry = DRAW[name];
  if (!entry) return null;
  const [, size, fn] = entry;
  const c = cv(size);
  const g = c.getContext('2d');
  fn(g, size);
  if (NORMALIZE.has(name)) normalize(g, size);
  texMean[name] = measure(g, size);
  cache[name] = finish(c);
  return cache[name];
}

/** 頂點色提亮係數：1 / 貼圖線性均值 */
export function texBoost(name) {
  if (!cache[name]) getTexture(name);
  const m = texMean[name];
  return m ? 1 / m : 1;
}
