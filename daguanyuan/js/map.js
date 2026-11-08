// 地图：右上小地图（随行）与 M 键展开的全图（分幅，可点景点神游）
// 全图分两幅：大观园一幅、宁荣二府一幅。原本上下叠成 400×900m 的窄长条，
// 铺满屏幕后字只剩几个像素；分幅后比例接近正方，字号能大一倍有余。
import {
  YUAN, RONG, NING, JIADAO, STREET, HOUJIE,
  STREAM, BRIDGES, REGIONS, regionAt,
} from './layout.js';
import { MAP_SPOTS } from './pois.js';
import { TOUR_PATH, TOUR_STOPS } from './data/tour.js';

const INK = '#2b2620';
const INK2 = '#5f564a';
const ZHU = '#9d3a2b';
const ROUTE = '#c0553c';
const PAPER = '#e9e2d0';
const WATER = '#8fa7a4';
const WALLC = '#b0a690';

export const SPOT_NAME = {
  rongmen: '荣国府大门', yimen: '五道礼仪之门', rongxitang: '荣禧堂', jiamu: '贾母院',
  fengjie: '凤姐院', jiashe: '贾赦东院', lixiang: '梨香院',
  ningmen: '宁国府大门', zongci: '贾氏宗祠', ningtang: '宁府正堂', jiadao: '宁荣夹道',
  yuanmen: '大观园正门', cuizhang: '翠嶂·曲径通幽', qinfang: '沁芳亭桥',
  xiaoxiang: '潇湘馆', huazhong: '花冢', yihong: '怡红院', dicui: '滴翠亭',
  qiushuang: '秋爽斋', ouxiang: '藕香榭', zhuijin: '缀锦楼·紫菱洲', nuanxiang: '暖香坞',
  hengwu: '蘅芜苑', daoxiang: '稻香村', longcui: '栊翠庵', luxue: '芦雪广',
  liaoting: '蓼汀花溆', shengqin: '省亲别墅', jiayin: '嘉荫堂',
  tubi: '凸碧山庄·凹晶溪馆', zha: '沁芳闸', tianxiang: '天香楼',
};

// ---------------------------------------------------------------- 分幅
const SC = 2;                       // 超采样，缩到屏幕上仍清晰
const PAD = 26;
const GAP = 34;
const PANELS = [
  { title: '大 观 园', x0: -190, z0: -862, x1: 190, z1: -203 },
  { title: '宁 荣 二 府', x0: -190, z0: -216, x1: 190, z1: 36 },
];

function layout(canvas) {
  const w0 = PANELS[0].x1 - PANELS[0].x0, h0 = PANELS[0].z1 - PANELS[0].z0;
  const h1 = PANELS[1].z1 - PANELS[1].z0;
  const s = (canvas.height / SC - PAD * 2 - 38) / h0;      // 以大观园高度定标
  const p0 = { ...PANELS[0], s, ox: PAD, oy: PAD + 34 };
  const p1 = { ...PANELS[1], s, ox: PAD + w0 * s + GAP, oy: PAD + 34 + (h0 - h1) * s };
  for (const p of [p0, p1]) {
    p.X = (x) => (p.ox + (x - p.x0) * p.s) * SC;
    p.Y = (z) => (p.oy + (z - p.z0) * p.s) * SC;
    p.has = (x, z) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;
  }
  return [p0, p1];
}

/** 世界坐标 → 画布坐标；优先落在主区（大观园在北、二府在南） */
function project(panels, x, z) {
  const p = z < YUAN.z1 + 4 ? panels[0] : panels[1];
  if (p.has(x, z)) return [p.X(x), p.Y(z), p];
  const q = panels[p === panels[0] ? 1 : 0];
  if (q.has(x, z)) return [q.X(x), q.Y(z), q];
  return null;
}

function rect(g, p, r, fill, stroke, lw = 1) {
  const x0 = Math.max(r.x0, p.x0), x1 = Math.min(r.x1, p.x1);
  const z0 = Math.max(r.z0, p.z0), z1 = Math.min(r.z1, p.z1);
  if (x1 <= x0 || z1 <= z0) return;
  const X = p.X(x0), Y = p.Y(z0), W = (x1 - x0) * p.s * SC, H = (z1 - z0) * p.s * SC;
  if (fill) { g.fillStyle = fill; g.fillRect(X, Y, W, H); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * SC; g.strokeRect(X, Y, W, H); }
}

function drawPanelBody(g, p, visited, opts = {}) {
  const { labels = true, order = true } = opts;
  g.save();
  g.beginPath();
  g.rect(p.X(p.x0), p.Y(p.z0), (p.x1 - p.x0) * p.s * SC, (p.z1 - p.z0) * p.s * SC);
  g.clip();

  rect(g, p, YUAN, '#dee3ce', '#8d8b73', 1.2);
  rect(g, p, RONG, '#e5ddc6', '#8d8b73', 1.2);
  rect(g, p, NING, '#e5ddc6', '#8d8b73', 1.2);
  rect(g, p, JIADAO, '#d5ccb2');
  rect(g, p, { x0: RONG.x0, z0: HOUJIE.z0, x1: NING.x1, z1: HOUJIE.z1 }, '#d5ccb2');
  rect(g, p, { x0: STREET.x0, z0: STREET.z0, x1: STREET.x1, z1: STREET.z1 }, '#d5ccb2');

  // 沁芳水系
  g.strokeStyle = WATER; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of STREAM) {
    g.lineWidth = Math.max(2, s.w * p.s) * SC;
    g.beginPath(); g.moveTo(p.X(s.a[0]), p.Y(s.a[1])); g.lineTo(p.X(s.b[0]), p.Y(s.b[1])); g.stroke();
  }
  // 院落
  for (const r of REGIONS) {
    if ((r.x1 - r.x0) > 150 || (r.z1 - r.z0) > 150) continue;
    rect(g, p, r, '#cdbf9b', '#8d8064', 1.0);
  }
  // 桥
  g.strokeStyle = '#8a6a48';
  for (const b of BRIDGES) {
    g.lineWidth = Math.max(2, b.w * p.s) * SC;
    g.beginPath(); g.moveTo(p.X(b.a[0]), p.Y(b.a[1])); g.lineTo(p.X(b.b[0]), p.Y(b.b[1])); g.stroke();
  }

  // 推荐路线
  g.strokeStyle = ROUTE;
  g.lineWidth = 3.4 * SC;
  g.setLineDash([9 * SC, 6 * SC]);
  g.globalAlpha = 0.85;
  g.beginPath();
  let pen = false;
  for (const [x, z] of TOUR_PATH) {
    if (!p.has(x, z)) { pen = false; continue; }
    const X = p.X(x), Y = p.Y(z);
    if (pen) g.lineTo(X, Y); else { g.moveTo(X, Y); pen = true; }
  }
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;

  // 景点与题名；与站点重合处直接用编号徽章当作点，免得序号被点盖住
  const spots = [];
  if (labels) {
    const rows = MAP_SPOTS.filter((s) => p.has(s.x, s.z))
      .map((s) => {
        let no = 0;
        TOUR_STOPS.forEach((st, i) => {
          if (Math.hypot(st.x - s.x, st.z - s.z) < 22) no = i + 1;
        });
        return { s, no, X: p.X(s.x), Y: p.Y(s.z) };
      })
      .sort((a, b) => a.Y - b.Y);
    const LH = 19 * SC;
    let lastY = -1e9;
    g.textBaseline = 'middle';
    for (const r of rows) {
      const seen = visited?.has(r.s.id);
      if (r.no) {
        g.beginPath(); g.arc(r.X, r.Y, 8.5 * SC, 0, 7);
        g.fillStyle = seen ? '#8c2f22' : ROUTE; g.fill();
        g.strokeStyle = PAPER; g.lineWidth = 1.6 * SC; g.stroke();
        g.fillStyle = '#fdf6e6';
        g.textAlign = 'center';
        g.font = `bold ${10.5 * SC}px system-ui, sans-serif`;
        g.fillText(String(r.no), r.X, r.Y + 0.5 * SC);
      } else {
        g.beginPath(); g.arc(r.X, r.Y, 4.5 * SC, 0, 7);
        g.fillStyle = seen ? ZHU : INK; g.fill();
        g.strokeStyle = PAPER; g.lineWidth = 1.4 * SC; g.stroke();
      }

      const ty = Math.max(r.Y, lastY + LH);
      lastY = ty;
      const name = SPOT_NAME[r.s.id] ?? r.s.id;
      const right = r.X < p.X((p.x0 + p.x1) / 2);
      const off = (r.no ? 13 : 9) * SC;
      g.textAlign = right ? 'left' : 'right';
      const tx = r.X + (right ? off : -off);
      if (Math.abs(ty - r.Y) > 2 * SC) {          // 题名被挤开时拉一条引线
        g.strokeStyle = 'rgba(95,86,74,.5)'; g.lineWidth = 1 * SC;
        g.beginPath(); g.moveTo(r.X + (right ? off * 0.6 : -off * 0.6), r.Y); g.lineTo(tx, ty); g.stroke();
      }
      g.font = `${15 * SC}px "Songti SC","STSong","SimSun",serif`;
      g.fillStyle = seen ? ZHU : INK2;
      g.fillText(name, tx, ty);
      spots.push({ id: r.s.id, x: r.s.x, z: r.s.z, px: r.X, py: r.Y, name });
    }
  }
  g.restore();
  return spots;
}

// ---------------------------------------------------------------- 全图
let bigCache = null;

export function drawBigMap(canvas, visited) {
  const g = canvas.getContext('2d');
  const panels = layout(canvas);

  g.fillStyle = PAPER;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalAlpha = 0.05;
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = i % 2 ? '#8a7f66' : '#c8bfa4';
    g.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2 * SC, 2 * SC);
  }
  g.globalAlpha = 1;

  let spots = [];
  for (const p of panels) {
    // 幅框
    g.strokeStyle = '#9a8f76'; g.lineWidth = 1.6 * SC;
    g.strokeRect(p.X(p.x0), p.Y(p.z0), (p.x1 - p.x0) * p.s * SC, (p.z1 - p.z0) * p.s * SC);
    spots = spots.concat(drawPanelBody(g, p, visited));
    // 幅名
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(43,38,32,.75)';
    g.font = `${24 * SC}px "Songti SC","STSong","SimSun",serif`;
    g.fillText(p.title, p.X((p.x0 + p.x1) / 2), p.Y(p.z0) - 12 * SC);
  }

  // ---- 右上留白：题头、指北、图例 ----
  const p0 = panels[0], p1 = panels[1];
  const bx = p1.X(p1.x0), by = 52 * SC;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.font = `${30 * SC}px "Songti SC","STSong","SimSun",serif`;
  g.fillText('红楼梦 · 宁荣二府与大观园', bx, by);
  g.fillStyle = INK2;
  g.font = `${14.5 * SC}px "Songti SC","STSong","SimSun",serif`;
  g.fillText('元妃省亲之后　会芳园墙垣既拆　二府连属　姊妹俱已入园', bx, by + 28 * SC);
  g.strokeStyle = '#a89c82'; g.lineWidth = 1.4 * SC;
  g.beginPath(); g.moveTo(bx, by + 44 * SC); g.lineTo(bx + 430 * SC, by + 44 * SC); g.stroke();

  // 指北
  const nx = canvas.width - 54 * SC, ny = 66 * SC;
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 2.6 * SC;
  g.beginPath(); g.moveTo(nx, ny + 26 * SC); g.lineTo(nx, ny - 18 * SC); g.stroke();
  g.beginPath(); g.moveTo(nx, ny - 27 * SC); g.lineTo(nx - 7.5 * SC, ny - 10 * SC); g.lineTo(nx + 7.5 * SC, ny - 10 * SC); g.closePath(); g.fill();
  g.textAlign = 'center';
  g.font = `${17 * SC}px "Songti SC","STSong","SimSun",serif`;
  g.fillText('北', nx, ny + 46 * SC);

  // 图例
  let ly = by + 92 * SC;
  const line = (draw, text) => {
    draw(ly);
    g.fillStyle = INK2; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = `${15.5 * SC}px "Songti SC","STSong","SimSun",serif`;
    g.fillText(text, bx + 64 * SC, ly);
    ly += 34 * SC;
  };
  line((y) => {
    g.strokeStyle = ROUTE; g.lineWidth = 3.6 * SC; g.setLineDash([9 * SC, 6 * SC]);
    g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + 48 * SC, y); g.stroke();
    g.setLineDash([]);
  }, '推荐游览线路　依第十七回游园次第，全程约 4.7 公里');
  line((y) => {
    g.beginPath(); g.arc(bx + 14 * SC, y, 8.5 * SC, 0, 7);
    g.fillStyle = ROUTE; g.fill();
    g.strokeStyle = PAPER; g.lineWidth = 1.6 * SC; g.stroke();
    g.fillStyle = '#fdf6e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${10.5 * SC}px system-ui, sans-serif`;
    g.fillText('7', bx + 14 * SC, y + 0.5 * SC);
  }, '线路站点及次序');
  line((y) => {
    g.beginPath(); g.arc(bx + 14 * SC, y, 4.5 * SC, 0, 7);
    g.fillStyle = ZHU; g.fill();
    g.strokeStyle = PAPER; g.lineWidth = 1.4 * SC; g.stroke();
  }, '朱色＝已到过　墨色＝尚未到');
  line((y) => {
    g.strokeStyle = WATER; g.lineWidth = 7 * SC; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + 48 * SC, y); g.stroke();
  }, '沁芳溪　自东北闸口入园，绕园一周汇于沁芳桥');
  line((y) => {
    g.strokeStyle = '#8a6a48'; g.lineWidth = 5 * SC;
    g.beginPath(); g.moveTo(bx + 12 * SC, y); g.lineTo(bx + 36 * SC, y); g.stroke();
  }, '桥梁');
  ly += 6 * SC;
  g.fillStyle = INK2; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = `${15 * SC}px "Songti SC","STSong","SimSun",serif`;
  g.fillText('二府与大观园由宁荣夹道北口相通（见右下幅）。', bx, ly);
  g.fillText('点击图上任一景点即可神游直达。', bx, ly + 30 * SC);

  bigCache = { spots };
  return spots;
}

/** 全图点击命中景点 */
export function hitBigMap(canvas, clientX, clientY) {
  if (!bigCache) return null;
  const r = canvas.getBoundingClientRect();
  const px = (clientX - r.left) * (canvas.width / r.width);
  const py = (clientY - r.top) * (canvas.height / r.height);
  let best = null, bd = 30 * SC;
  for (const s of bigCache.spots) {
    const d = Math.hypot(s.px - px, s.py - py);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// ---------------------------------------------------------------- 小地图
export function drawMiniMap(canvas, px, pz, yaw, visited) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const s = 1.35;                       // px / m
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(s, s);
  g.translate(-px, -pz);

  const R = (r, fill, stroke) => {
    if (fill) { g.fillStyle = fill; g.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 0.9; g.strokeRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0); }
  };
  R(YUAN, '#dee3ce', '#8d8b73');
  R(RONG, '#e5ddc6', '#8d8b73');
  R(NING, '#e5ddc6', '#8d8b73');
  R(JIADAO, '#d5ccb2');
  R({ x0: STREET.x0, z0: STREET.z0, x1: STREET.x1, z1: STREET.z1 }, '#d5ccb2');
  R({ x0: RONG.x0, z0: HOUJIE.z0, x1: NING.x1, z1: HOUJIE.z1 }, '#d5ccb2');

  g.strokeStyle = WATER; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const seg of STREAM) {
    g.lineWidth = seg.w;
    g.beginPath(); g.moveTo(seg.a[0], seg.a[1]); g.lineTo(seg.b[0], seg.b[1]); g.stroke();
  }
  for (const r of REGIONS) {
    if ((r.x1 - r.x0) > 150 || (r.z1 - r.z0) > 150) continue;
    if (Math.abs((r.x0 + r.x1) / 2 - px) > 190 || Math.abs((r.z0 + r.z1) / 2 - pz) > 190) continue;
    R(r, 'rgba(188,176,148,.62)', WALLC);
  }
  g.strokeStyle = '#8a6a48';
  for (const b of BRIDGES) {
    g.lineWidth = b.w * 0.9;
    g.beginPath(); g.moveTo(b.a[0], b.a[1]); g.lineTo(b.b[0], b.b[1]); g.stroke();
  }

  // 推荐路线：跟着这条朱线走就不会迷路
  g.strokeStyle = ROUTE; g.lineWidth = 2.6; g.setLineDash([6, 4]);
  g.beginPath();
  let pen = false;
  for (const [x, z] of TOUR_PATH) {
    if (Math.abs(x - px) > 230 || Math.abs(z - pz) > 230) { pen = false; continue; }
    if (pen) g.lineTo(x, z); else { g.moveTo(x, z); pen = true; }
  }
  g.stroke();
  g.setLineDash([]);

  for (const p of MAP_SPOTS) {
    if (Math.abs(p.x - px) > 190 || Math.abs(p.z - pz) > 190) continue;
    g.beginPath();
    g.arc(p.x, p.z, 2.6, 0, 7);
    g.fillStyle = visited?.has(p.id) ? ZHU : 'rgba(43,38,32,.55)';
    g.fill();
  }
  g.restore();

  // 玩家：北在上，yaw=0 为朝北，故箭头转角取 -yaw
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-yaw);
  g.fillStyle = ZHU;
  g.strokeStyle = '#f6ecd8'; g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(0, -15); g.lineTo(10, 11); g.lineTo(0, 6); g.lineTo(-10, 11);
  g.closePath(); g.fill(); g.stroke();
  g.restore();

  g.fillStyle = 'rgba(43,38,32,.65)';
  g.font = '19px "Songti SC","STSong","SimSun",serif';
  g.textAlign = 'center';
  g.fillText('北', W - 22, 26);
  g.strokeStyle = 'rgba(43,38,32,.5)'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(W - 22, 32); g.lineTo(W - 22, 50); g.stroke();
}

export { regionAt };
