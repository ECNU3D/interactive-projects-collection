// textures.js — 程序化贴图 + NASA 图片合成
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// ---------- 星空背景（叠加 NASA 星云图）----------
// image: 可选 HTMLImageElement；tint: 叠加色；returns CanvasTexture
export function makeSkyTexture(image, tint, starCount = 900) {
  const S = 2048;
  const c = canvas(S, S / 2), ctx = c.getContext('2d');
  // 深空底色
  const bg = ctx.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, '#01020a');
  bg.addColorStop(0.5, '#040818');
  bg.addColorStop(1, '#01020a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);

  // NASA 星云图，低透明度多次混合平铺
  if (image) {
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const w = rand(500, 1100), h = w * (image.height / image.width);
      ctx.drawImage(image, rand(-100, S - w + 100), rand(-100, c.height - h + 100), w, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 色调滤镜
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 星点
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = Math.random() < 0.92 ? rand(0.3, 1.1) : rand(1.2, 2.6);
    const hue = Math.random();
    ctx.fillStyle = hue < 0.6 ? '#ffffff' : hue < 0.8 ? '#bcd8ff' : '#ffe9c8';
    ctx.globalAlpha = rand(0.35, 1);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ---------- 金属船体贴图 ----------
export function makeHullTexture(base = '#5a6b7d', accent = '#2fe0ff', panel = 64) {
  const S = 512;
  const c = canvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // 金属噪点
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(Math.random() * S, Math.random() * S, rand(1, 3), rand(1, 3));
  }
  // 装甲板接缝
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= S; x += panel) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); }
  for (let y = 0; y <= S; y += panel) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
  // 高光描边 + 铆钉
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let x = 2; x <= S; x += panel) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let x = panel / 2; x < S; x += panel)
    for (let y = panel / 2; y < S; y += panel) {
      ctx.beginPath(); ctx.arc(x + 6, y + 6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 6, y - 6, 2, 0, Math.PI * 2); ctx.fill();
    }
  // 发光条纹（能量线路）
  ctx.shadowColor = accent; ctx.shadowBlur = 10;
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.85; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const y = rand(20, S - 20);
    ctx.beginPath(); ctx.moveTo(0, y);
    ctx.lineTo(rand(S * 0.3, S * 0.6), y);
    ctx.lineTo(rand(S * 0.6, S), y + rand(-30, 30));
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------- 小行星岩石贴图 ----------
export function makeRockTexture() {
  const S = 256;
  const c = canvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = '#4a4038';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    const g = Math.floor(rand(30, 110));
    ctx.fillStyle = `rgb(${g + 20},${g},${g - 12})`;
    ctx.globalAlpha = rand(0.15, 0.6);
    const r = rand(1, 7);
    ctx.beginPath(); ctx.arc(Math.random() * S, Math.random() * S, r, 0, Math.PI * 2); ctx.fill();
  }
  // 陨坑
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = rand(6, 26);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#241d16';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#8a7a66'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------- 行星贴图（NASA 地球图映射到球面）----------
export function makePlanetTexture(image) {
  const c = canvas(1024, 512), ctx = c.getContext('2d');
  if (image) {
    ctx.drawImage(image, 0, 0, c.width, c.height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#2a4d8f'); g.addColorStop(0.5, '#3f7ad1'); g.addColorStop(1, '#1a2f5a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
  }
  // 大气微光边缘
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 径向辉光精灵（激光/爆炸/引擎）----------
const glowCache = {};
export function makeGlowSprite(inner = '#ffffff', outer = 'rgba(0,150,255,0)') {
  const key = inner + '|' + outer;
  if (glowCache[key]) return glowCache[key];
  const S = 128;
  const c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowCache[key] = tex;
  return tex;
}

// ---------- 爆炸火花 ----------
export function makeSparkSprite() {
  const S = 64;
  const c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,200,80,0.9)');
  g.addColorStop(0.7, 'rgba(255,80,10,0.4)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 拾取物图标（文字贴图）----------
export function makePickupIcon(text, color) {
  const S = 128;
  const c = canvas(S, S), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  // 六边形底座
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 2;
    const x = S / 2 + Math.cos(a) * 52, y = S / 2 + Math.sin(a) * 52;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(4,18,34,0.85)';
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 5;
  ctx.shadowColor = color; ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, S / 2, S / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 角色头像（动物飞行员，扁平风格）----------
export function makePortrait(animal) {
  const S = 128;
  const c = canvas(S, S), ctx = c.getContext('2d');
  // 圆形通讯屏背景
  const bg = ctx.createRadialGradient(S/2, S/2, 8, S/2, S/2, S/2);
  bg.addColorStop(0, '#0e2a4a');
  bg.addColorStop(1, '#030c18');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 2, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 4, 0, Math.PI * 2); ctx.clip();

  const cx = S / 2, cy = S / 2 + 8;
  const draw = {
    fox() {
      // 耳
      ctx.fillStyle = '#b8622a';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * 18, cy - 22); ctx.lineTo(cx + s * 34, cy - 52); ctx.lineTo(cx + s * 38, cy - 14);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a2418';
        ctx.beginPath();
        ctx.moveTo(cx + s * 22, cy - 24); ctx.lineTo(cx + s * 32, cy - 44); ctx.lineTo(cx + s * 34, cy - 18);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b8622a';
      }
      // 脸
      ctx.fillStyle = '#c97130';
      ctx.beginPath(); ctx.ellipse(cx, cy, 34, 30, 0, 0, Math.PI * 2); ctx.fill();
      // 吻部
      ctx.fillStyle = '#f2e4d0';
      ctx.beginPath(); ctx.ellipse(cx, cy + 16, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a10';
      ctx.beginPath(); ctx.ellipse(cx, cy + 8, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      // 眼
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(cx + s * 13, cy - 6, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a6a2a';
        ctx.beginPath(); ctx.arc(cx + s * 13, cy - 5, 3.4, 0, Math.PI * 2); ctx.fill();
      }
    },
    rabbit() {
      // 长耳
      ctx.fillStyle = '#a8988a';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(cx + s * 16, cy - 40, 8, 26, s * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8a0a0';
        ctx.beginPath(); ctx.ellipse(cx + s * 16, cy - 38, 4, 18, s * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a8988a';
      }
      ctx.fillStyle = '#b8a898';
      ctx.beginPath(); ctx.ellipse(cx, cy, 32, 29, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0e8e0';
      ctx.beginPath(); ctx.ellipse(cx, cy + 15, 16, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8a0a8';
      ctx.beginPath(); ctx.ellipse(cx, cy + 7, 4.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(cx + s * 12, cy - 6, 6.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a3020';
        ctx.beginPath(); ctx.arc(cx + s * 12, cy - 5, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      // 老花镜
      ctx.strokeStyle = '#d8c060'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + s * 12, cy - 6, 10, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx - 2, cy - 6); ctx.lineTo(cx + 2, cy - 6); ctx.stroke();
    },
    bird() {
      // 头羽
      ctx.fillStyle = '#2a4a8a';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 8, cy - 22); ctx.lineTo(cx + i * 10 + 4, cy - 46); ctx.lineTo(cx + i * 8 + 8, cy - 22);
        ctx.closePath(); ctx.fill();
      }
      // 脸
      ctx.fillStyle = '#3a5a9a';
      ctx.beginPath(); ctx.ellipse(cx, cy, 32, 28, 0, 0, Math.PI * 2); ctx.fill();
      // 眼周白
      ctx.fillStyle = '#e8ecf2';
      ctx.beginPath(); ctx.ellipse(cx, cy - 6, 24, 14, 0, 0, Math.PI * 2); ctx.fill();
      // 喙
      ctx.fillStyle = '#e8a820';
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 4); ctx.lineTo(cx + 8, cy + 4); ctx.lineTo(cx, cy + 22);
      ctx.closePath(); ctx.fill();
      // 眼（锐利）
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(cx + s * 12, cy - 8, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c02020';
        ctx.beginPath(); ctx.arc(cx + s * 12, cy - 8, 3, 0, Math.PI * 2); ctx.fill();
        // 眉
        ctx.strokeStyle = '#1a2a4a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx + s * 4, cy - 14); ctx.lineTo(cx + s * 19, cy - 17); ctx.stroke();
      }
    },
    frog() {
      // 眼柄
      ctx.fillStyle = '#5a9a3a';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + s * 14, cy - 26, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx + s * 14, cy - 26, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a2a10';
        ctx.beginPath(); ctx.arc(cx + s * 14, cy - 26, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a9a3a';
      }
      // 脸
      ctx.beginPath(); ctx.ellipse(cx, cy + 4, 34, 24, 0, 0, Math.PI * 2); ctx.fill();
      // 嘴
      ctx.strokeStyle = '#2a4a1a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy + 2, 18, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke();
      // 颊点
      ctx.fillStyle = '#4a8a30';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + s * 22, cy + 8, 3, 0, Math.PI * 2); ctx.fill();
      }
    },
    dog() {
      // 垂耳
      ctx.fillStyle = '#7a5a3a';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(cx + s * 30, cy - 8, 10, 20, s * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      // 军帽
      ctx.fillStyle = '#2a4a2a';
      ctx.beginPath(); ctx.ellipse(cx, cy - 26, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 26, cy - 30, 52, 8);
      ctx.fillStyle = '#d8b040';
      ctx.beginPath(); ctx.arc(cx, cy - 26, 4, 0, Math.PI * 2); ctx.fill();
      // 脸
      ctx.fillStyle = '#9a7a50';
      ctx.beginPath(); ctx.ellipse(cx, cy + 2, 32, 28, 0, 0, Math.PI * 2); ctx.fill();
      // 吻部
      ctx.fillStyle = '#e8d8c0';
      ctx.beginPath(); ctx.ellipse(cx, cy + 14, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a10';
      ctx.beginPath(); ctx.ellipse(cx, cy + 6, 5.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      // 眼
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(cx + s * 12, cy - 4, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2410';
        ctx.beginPath(); ctx.arc(cx + s * 12, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
      }
      // 下颚
      ctx.fillStyle = '#c0a888';
      ctx.beginPath(); ctx.ellipse(cx, cy + 24, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    },
  };
  (draw[animal] || draw.fox)();
  ctx.restore();
  // 通讯环
  ctx.strokeStyle = '#4db2ff';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 3, 0, Math.PI * 2); ctx.stroke();
  return c.toDataURL('image/png');
}

// ---------- 加载 NASA 图片 ----------
export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ---------- 大气层天空（行星内环境）----------
export function makeAtmoSkyTexture(top = '#2a6ac8', horizon = '#a8d4f0', cloudCount = 40) {
  const S = 2048;
  const c = canvas(S, S / 2), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, top);
  g.addColorStop(0.72, horizon);
  g.addColorStop(1, '#e8f4ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  // 云朵
  for (let i = 0; i < cloudCount; i++) {
    const x = Math.random() * c.width, y = rand(c.height * 0.15, c.height * 0.75);
    const w = rand(80, 320), h = w * rand(0.18, 0.3);
    const cg = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
    cg.addColorStop(0, 'rgba(255,255,255,0.75)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ---------- 地面纹理（重复平铺）----------
export function makeGroundTexture(kind) {
  const S = 512;
  const c = canvas(S, S), ctx = c.getContext('2d');
  if (kind === 'water') {
    ctx.fillStyle = '#0d3a5c'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = `rgba(${rand(80, 160)},${rand(170, 220)},${rand(200, 255)},${rand(0.1, 0.4)})`;
      ctx.lineWidth = rand(1, 3);
      const x = Math.random() * S, y = Math.random() * S, len = rand(12, 60);
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y + rand(-4, 4), x + len, y);
      ctx.stroke();
    }
  } else if (kind === 'city') {
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(0, 0, S, S);
    // 城市路网
    ctx.strokeStyle = '#4a4f58'; ctx.lineWidth = 8;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(S, i * 128); ctx.stroke();
    }
    ctx.strokeStyle = '#6a707c'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, S); ctx.stroke();
    }
    // 街区地块
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      ctx.fillStyle = `rgba(${rand(50, 80)},${rand(55, 85)},${rand(60, 95)},0.9)`;
      ctx.fillRect(x * 128 + 10, y * 128 + 10, 108, 108);
    }
  } else if (kind === 'sand') {
    ctx.fillStyle = '#b8895a'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,220,170,0.12)' : 'rgba(90,50,20,0.1)';
      ctx.fillRect(Math.random() * S, Math.random() * S, rand(1, 3), rand(1, 3));
    }
    // 沙丘波纹
    ctx.strokeStyle = 'rgba(140,95,50,0.35)'; ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const y = i * 30 + rand(-6, 6);
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 6);
      ctx.stroke();
    }
  } else if (kind === 'snow') {
    ctx.fillStyle = '#dfe8f2'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(150,175,205,0.2)';
      ctx.fillRect(Math.random() * S, Math.random() * S, rand(1, 3), rand(1, 3));
    }
    ctx.strokeStyle = 'rgba(170,195,220,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const y = i * 44 + rand(-8, 8);
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.03 + i * 2) * 8);
      ctx.stroke();
    }
  } else if (kind === 'venom') {
    ctx.fillStyle = '#1a0f0a'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(80,40,25,0.3)' : 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.random() * S, Math.random() * S, rand(1, 4), rand(1, 4));
    }
    // 熔岩裂纹
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ff5522'; ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      let x = Math.random() * S, y = Math.random() * S;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += rand(-60, 60); y += rand(-60, 60); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 30);
  return tex;
}

// ---------- 锁定标记 ----------
export function makeLockSprite(locked = false) {
  const S = 96;
  const c = canvas(S, S), ctx = c.getContext('2d');
  const col = locked ? '#ff4040' : '#ffd040';
  ctx.strokeStyle = col; ctx.lineWidth = 4;
  ctx.shadowColor = col; ctx.shadowBlur = 10;
  const r = 34;
  // 四角括号
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(S / 2 + sx * r, S / 2 + sy * (r - 14));
    ctx.lineTo(S / 2 + sx * r, S / 2 + sy * r);
    ctx.lineTo(S / 2 + sx * (r - 14), S / 2 + sy * r);
    ctx.stroke();
  }
  if (locked) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, 6, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
