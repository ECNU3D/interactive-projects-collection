// 程序化贴图：全部 Canvas 生成，配合顶点色相乘使用（多数为近中性明度纹理）
import * as THREE from 'three';

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}

function finish(cv, repeat = 1) {
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 伪随机（确定性，避免每次刷新纹理闪变）
let _seed = 7;
function rnd() {
  _seed = (_seed * 16807) % 2147483647;
  return _seed / 2147483647;
}

const makers = {
  // 青瓦：瓦垄竖线 + 瓦排横痕
  tile() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#c3c6cc'; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) {
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#9fa3ab');
      grad.addColorStop(0.5, '#ced2d8');
      grad.addColorStop(1, '#9fa3ab');
      g.fillStyle = grad;
      g.fillRect(x, 0, 16, 128);
      g.fillStyle = 'rgba(60,64,72,0.55)';
      g.fillRect(x, 0, 2, 128);
    }
    for (let y = 0; y < 128; y += 21) {
      g.fillStyle = 'rgba(58,62,70,0.35)';
      g.fillRect(0, y, 128, 3);
      g.fillStyle = 'rgba(235,238,242,0.25)';
      g.fillRect(0, y + 3, 128, 2);
    }
    return finish(cv);
  },

  // 茅草：垂直枯草笔触
  thatch() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#d2c49e'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * 128, y = rnd() * 128, l = 6 + rnd() * 18;
      const tone = rnd();
      g.strokeStyle = tone < 0.5 ? 'rgba(140,120,72,0.30)' : tone < 0.8 ? 'rgba(190,175,130,0.35)' : 'rgba(96,80,48,0.28)';
      g.lineWidth = 0.8 + rnd() * 0.9;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 3, y + l);
      g.stroke();
    }
    return finish(cv);
  },

  // 木板：板缝 + 木纹
  wood() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#d8ccb8'; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 32) {
      g.fillStyle = 'rgba(90,70,45,0.5)';
      g.fillRect(x, 0, 2, 128);
      for (let i = 0; i < 22; i++) {
        const gx = x + 3 + rnd() * 27, gy = rnd() * 128, gl = 10 + rnd() * 34;
        g.strokeStyle = rnd() < 0.7 ? 'rgba(150,124,88,0.28)' : 'rgba(200,185,158,0.3)';
        g.lineWidth = 0.7 + rnd();
        g.beginPath();
        g.moveTo(gx, gy);
        g.quadraticCurveTo(gx + (rnd() - 0.5) * 4, gy + gl / 2, gx + (rnd() - 0.5) * 2, gy + gl);
        g.stroke();
      }
      if (rnd() < 0.8) {
        const kx = x + 6 + rnd() * 20, ky = rnd() * 128;
        g.fillStyle = 'rgba(105,82,52,0.45)';
        g.beginPath(); g.ellipse(kx, ky, 2.2, 3.2, 0, 0, 7); g.fill();
      }
    }
    return finish(cv);
  },

  // 粉墙：斑驳灰泥
  plaster() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#e2dcca'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * 128, y = rnd() * 128, r = 2 + rnd() * 10;
      g.fillStyle = rnd() < 0.6 ? `rgba(176,164,134,${0.06 + rnd() * 0.1})` : `rgba(238,234,222,${0.08 + rnd() * 0.08})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // 底部泛潮渍
    const grad = g.createLinearGradient(0, 96, 0, 128);
    grad.addColorStop(0, 'rgba(150,138,108,0)');
    grad.addColorStop(1, 'rgba(150,138,108,0.28)');
    g.fillStyle = grad; g.fillRect(0, 96, 128, 32);
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = 'rgba(130,118,92,0.25)';
      g.lineWidth = 0.7;
      const x = rnd() * 128; let y = rnd() * 60;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) g.lineTo(x + (rnd() - 0.5) * 10, y += 8 + rnd() * 8);
      g.stroke();
    }
    return finish(cv);
  },

  // 夯土：水平夯层 + 麻点
  earthwall() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#cfc0a0'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 24) {
      g.fillStyle = 'rgba(120,102,72,0.32)';
      g.fillRect(0, y, 128, 2.5);
      g.fillStyle = 'rgba(230,220,196,0.3)';
      g.fillRect(0, y + 3, 128, 2);
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(120,104,74,0.22)' : 'rgba(226,216,192,0.22)';
      g.fillRect(rnd() * 128, rnd() * 128, 1.4, 1.4);
    }
    return finish(cv);
  },

  // 砖：错缝砌法
  brick() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#c2bcae'; g.fillRect(0, 0, 128, 128);
    const bh = 16, bw = 42;
    for (let row = 0; row < 8; row++) {
      const y = row * bh;
      g.fillStyle = 'rgba(96,90,78,0.5)';
      g.fillRect(0, y, 128, 1.8);
      const off = (row % 2) * bw / 2;
      for (let x = -bw; x < 128 + bw; x += bw) {
        g.fillRect(x + off, y, 1.8, bh);
      }
      for (let x = 0; x < 128; x += 10) {
        g.fillStyle = `rgba(${150 + rnd() * 40},${140 + rnd() * 36},${120 + rnd() * 34},0.14)`;
        g.fillRect(x, y + 2, 10, bh - 3);
      }
    }
    return finish(cv);
  },

  // 苇席：斜纹编织
  reed() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#cdbd96'; g.fillRect(0, 0, 128, 128);
    for (let d = -128; d < 256; d += 9) {
      g.strokeStyle = 'rgba(146,126,84,0.4)';
      g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(d, 0); g.lineTo(d + 128, 128); g.stroke();
      g.strokeStyle = 'rgba(226,214,180,0.35)';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(d + 4, 0); g.lineTo(d + 132, 128); g.stroke();
    }
    for (let d = -128; d < 256; d += 13) {
      g.strokeStyle = 'rgba(158,138,96,0.3)';
      g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(d + 128, 0); g.lineTo(d, 128); g.stroke();
    }
    return finish(cv);
  },

  // 直棂窗：纸底 + 木棂条
  lattice() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#e6dfc8'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(210,200,172,0.5)';
    for (let i = 0; i < 60; i++) g.fillRect(rnd() * 128, rnd() * 128, 3, 3);
    g.fillStyle = '#5a4226';
    for (let x = 4; x < 128; x += 14) g.fillRect(x, 0, 5, 128);
    g.fillRect(0, 0, 128, 7);
    g.fillRect(0, 121, 128, 7);
    g.fillRect(0, 60, 128, 6);
    return finish(cv);
  },

  // 地面细节：绢面笔触 + 碎石斑点（叠加于顶点色）
  ground() {
    const [cv, g] = canvas(256, 256);
    g.fillStyle = '#d6d0c0'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 256, y = rnd() * 256;
      const tone = rnd();
      g.fillStyle = tone < 0.45 ? `rgba(150,138,110,${0.10 + rnd() * 0.12})`
        : tone < 0.8 ? `rgba(226,220,204,${0.10 + rnd() * 0.1})`
        : `rgba(120,110,88,${0.08 + rnd() * 0.08})`;
      const r = rnd() < 0.85 ? 0.8 + rnd() * 1.6 : 2 + rnd() * 3.5;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 120; i++) {
      const x = rnd() * 256, y = rnd() * 256, l = 6 + rnd() * 22;
      const a = rnd() * Math.PI;
      g.strokeStyle = `rgba(140,128,100,${0.06 + rnd() * 0.08})`;
      g.lineWidth = 0.8 + rnd() * 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return finish(cv);
  },

  // 彩帛条纹（彩楼欢门缠帛，自带颜色，顶点色置白）
  silk() {
    const [cv, g] = canvas(128, 128);
    // 以红蓝为主（《东京梦华录》：缠红蓝彩帛）
    const stripes = ['#9c4a36', '#546682', '#b0563e', '#c8b890', '#48587a', '#7e8c58', '#9c4a36', '#546682'];
    const sw = 128 / stripes.length;
    stripes.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(i * sw, 0, sw + 1, 128);
      g.fillStyle = 'rgba(255,244,220,0.22)';
      g.fillRect(i * sw + 2, 0, 3, 128);
      g.fillStyle = 'rgba(40,26,16,0.22)';
      g.fillRect((i + 1) * sw - 3, 0, 3, 128);
    });
    // 布褶横纹
    for (let y = 0; y < 128; y += 9) {
      g.fillStyle = `rgba(30,20,12,${0.05 + rnd() * 0.1})`;
      g.fillRect(0, y, 128, 2);
    }
    return finish(cv);
  },

  // 麻布平织（平民衣料：经纬织痕 + 少量疵点，近中性明度供顶点色相乘）
  robe() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#e2ded2'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 3) {
      g.fillStyle = `rgba(96,88,72,${0.10 + rnd() * 0.08})`;
      g.fillRect(0, y, 128, 1);
    }
    for (let x = 0; x < 128; x += 3) {
      g.fillStyle = `rgba(96,88,72,${0.06 + rnd() * 0.06})`;
      g.fillRect(x, 0, 1, 128);
    }
    for (let i = 0; i < 200; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(88,78,62,0.09)' : 'rgba(248,244,234,0.10)';
      g.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 4, 1 + rnd() * 2);
    }
    const tex = finish(cv);
    tex.repeat.set(2, 3);
    return tex;
  },

  // 织锦团花（士人绸袍：八瓣团花交错排布 + 缠枝细蔓，织金效果）
  brocade() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#d9d3c4'; g.fillRect(0, 0, 128, 128);
    const cell = 32;
    for (let ry = 0; ry < 5; ry++) {
      for (let rx = 0; rx < 5; rx++) {
        const cx = rx * cell + (ry % 2) * cell / 2 + cell / 4;
        const cy = ry * cell + cell / 4;
        for (let p = 0; p < 8; p++) {
          const a = p / 8 * Math.PI * 2;
          g.fillStyle = 'rgba(88,64,38,0.42)';
          g.beginPath();
          g.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 2.8, 1.7, a, 0, 7);
          g.fill();
          g.fillStyle = 'rgba(238,212,150,0.30)';
          g.beginPath();
          g.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 1.4, 0.8, a, 0, 7);
          g.fill();
        }
        g.fillStyle = 'rgba(88,64,38,0.5)';
        g.beginPath(); g.arc(cx, cy, 2.4, 0, 7); g.fill();
        g.fillStyle = 'rgba(238,212,150,0.4)';
        g.beginPath(); g.arc(cx, cy, 1.1, 0, 7); g.fill();
        g.strokeStyle = 'rgba(88,64,38,0.22)';
        g.lineWidth = 1.2;
        g.beginPath(); g.arc(cx, cy, 11, 0.3, 2.6); g.stroke();
      }
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = 'rgba(96,76,48,0.08)';
      g.fillRect(rnd() * 128, rnd() * 128, 1.5, 1.5);
    }
    const tex = finish(cv);
    tex.repeat.set(3, 3);
    return tex;
  },

  // 石板路（城内地面局部……并入 ground 使用即可，此处备用）
  paving() {
    const [cv, g] = canvas(128, 128);
    g.fillStyle = '#c8c0ac'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) {
      g.fillStyle = 'rgba(96,88,72,0.4)';
      g.fillRect(0, y, 128, 2.2);
      const off = ((y / 32) % 2) * 32;
      for (let x = 0; x < 128; x += 64) g.fillRect(x + off, y, 2.2, 32);
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(110,102,84,0.16)' : 'rgba(224,218,202,0.16)';
      g.fillRect(rnd() * 128, rnd() * 128, 2, 2);
    }
    return finish(cv);
  },
};

const cache = {};
export function getTexture(name) {
  if (!cache[name]) cache[name] = makers[name]();
  return cache[name];
}
