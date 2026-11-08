/**
 * Map.ts —— 小地图 + 全图（M 键）｜文档 03 §8.2 的仙气 UI 一套 token
 *
 * 天宫是五层垂直结构，「我在哪」是水平 + 垂直两个问题，所以：
 *   · 常驻小地图：当前层俯视 + 大圣朝向 + 右侧五层标尺（垂直位置一眼可见）
 *   · M 键全图：十九区域平面全览（当前层亮、邻层暗）+ 左侧立面尺 + 区域名录
 *
 * 约定：世界 -z = 北，+x = 东（与 Hud 的方位盘一致）。
 * 小地图 12Hz 重绘、全图只在打开时重绘 —— 常驻 UI 不该吃帧。
 */
import { PLACES, LAYERS, layerAtY, type PlaceInfo } from '../world/Layers';
import type * as THREE from 'three/webgpu';
import { el } from './Hud';
import type { LoreSite } from '../lore/LoreSites';

const MINI_SIZE = 170;
/** 小地图比例尺：米/像素。170px 覆盖约 714m，正好装下蟠桃园（r=260） */
const MINI_SCALE = 4.2;

const GOLD = '#e8b455';
const GOLD_DIM = 'rgba(232,180,85,.35)';
const INK = 'rgba(240,232,216,.85)';

const LAYER_KEYS = Object.keys(LAYERS).map(Number).sort((a, b) => a - b);

export class MapUI {
  private mini: HTMLCanvasElement;
  private miniCtx: CanvasRenderingContext2D;
  private ruler: HTMLElement;
  private miniLabel: HTMLElement;
  private full: HTMLElement;
  private fullCanvas: HTMLCanvasElement;
  private fullCtx: CanvasRenderingContext2D;
  private fullList: HTMLElement;
  private loreCount: HTMLElement;
  open = false;

  private lastDraw = 0;
  private pos: THREE.Vector3 | null = null;
  private yaw = 0;
  /** -1 而不是 3：标尺只在层变化时刷新，初值若等于出生层（3），首帧就不会点亮任何一行 */
  private currentLayer = -1;
  private currentPlace: PlaceInfo | null = null;
  private loreSites: LoreSite[] = [];
  private loreVisited = new Set<string>();

  constructor(root: HTMLElement) {
    // ── 小地图 ──
    const wrap = el('div', 'tg-ui', 'tg-minimap');
    this.mini = document.createElement('canvas');
    this.mini.className = 'tg-mini-canvas';
    this.miniCtx = this.mini.getContext('2d')!;
    this.ruler = el('div', '', 'tg-layer-ruler');
    this.miniLabel = el('div', 'tg-mini-label');
    const plate = el('div', 'tg-mini-plate');
    plate.append(this.mini, this.miniLabel);
    wrap.append(plate, this.ruler);
    this.buildRuler();

    // ── 全图 ──
    this.full = el('div', 'tg-ui', 'tg-fullmap');
    const inner = el('div', 'tg-fullmap-inner');
    const title = el('div', 'tg-fullmap-title');
    title.textContent = '天　宫　全　图';
    this.fullCanvas = document.createElement('canvas');
    this.fullCanvas.className = 'tg-full-canvas';
    this.fullCtx = this.fullCanvas.getContext('2d')!;
    this.fullList = el('div', 'tg-fullmap-list');
    const foot = el('div', 'tg-fullmap-foot');
    foot.textContent = 'M 或 Esc 收起　·　金三角 = 大圣当前所在';
    this.loreCount = el('div', 'tg-fullmap-lore');
    inner.append(title, this.loreCount, this.fullCanvas, this.fullList, foot);
    this.full.append(inner);

    root.append(wrap, this.full);
    addEventListener('resize', () => {
      if (this.open) this.drawFull();
    });
  }

  private buildRuler(): void {
    // 由高到低（离恨天在上，天门在下）—— 与实际垂直关系一致
    for (const k of [...LAYER_KEYS].reverse()) {
      const row = el('div', 'tg-ruler-row');
      row.dataset.layer = String(k);
      const num = el('span', 'tg-ruler-num');
      num.textContent = '一二三四五'[k - 1] ?? String(k);
      const name = el('span', 'tg-ruler-name');
      name.textContent = LAYERS[k].name;
      row.append(num, name);
      this.ruler.append(row);
    }
  }

  /** 主装配层在剧情点状态变化时调用 */
  setLore(sites: LoreSite[], visited: string[]): void {
    this.loreSites = sites;
    this.loreVisited = new Set(visited);
    this.lastDraw = 0; // 让下一帧立刻重绘小地图
    if (this.open) this.drawFull();
  }

  toggle(): void {
    this.open = !this.open;
    this.full.classList.toggle('open', this.open);
    if (this.open) this.drawFull();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.full.classList.remove('open');
  }

  /** 每渲染帧调用；内部限流到 12Hz */
  update(pos: THREE.Vector3, yaw: number): void {
    this.pos = pos;
    this.yaw = yaw;
    const now = performance.now();
    if (now - this.lastDraw < 83) return;
    this.lastDraw = now;

    const layer = layerAtY(pos.y);
    if (layer !== this.currentLayer) {
      this.currentLayer = layer;
      for (const row of Array.from(this.ruler.children) as HTMLElement[]) {
        row.classList.toggle('on', Number(row.dataset.layer) === layer);
      }
    }
    this.currentPlace = nearestPlace(pos);
    this.miniLabel.textContent = this.currentPlace ? this.currentPlace.name : `${LAYERS[layer].name}　云中`;
    this.drawMini();
    if (this.open) this.drawFull();
  }

  // ── 小地图：以大圣为中心的当前层俯视 ──────────────────
  private drawMini(): void {
    const pos = this.pos;
    if (!pos) return;
    const dpr = Math.min(devicePixelRatio, 2);
    fitCanvas(this.mini, MINI_SIZE, MINI_SIZE, dpr);
    const g = this.miniCtx;
    const S = MINI_SIZE;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);

    const cx = S / 2;
    const cy = S / 2;
    // 方位刻线
    g.strokeStyle = 'rgba(232,180,85,.13)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, 6); g.lineTo(cx, S - 6);
    g.moveTo(6, cy); g.lineTo(S - 6, cy);
    g.stroke();

    // 区域：本层实心，相邻层只画虚线圈（表示"就在上/下一层"，但不抢读）
    const labels: { x: number; y: number; text: string; here: boolean }[] = [];
    for (const p of PLACES) {
      const d = Math.abs(p.layer - this.currentLayer);
      if (d > 1) continue;
      const x = cx + (p.center.x - pos.x) / MINI_SCALE;
      const y = cy + (p.center.z - pos.z) / MINI_SCALE;
      const r = p.radius / MINI_SCALE;
      if (x + r < 0 || x - r > S || y + r < 0 || y - r > S) continue;
      const here = p === this.currentPlace;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      if (d === 0) {
        g.setLineDash([]);
        g.fillStyle = here ? 'rgba(232,180,85,.20)' : 'rgba(232,180,85,.08)';
        g.fill();
        g.strokeStyle = here ? GOLD : GOLD_DIM;
        g.lineWidth = here ? 1.4 : 1;
      } else {
        g.setLineDash([3, 4]);
        g.strokeStyle = 'rgba(169,203,214,.30)';
        g.lineWidth = 1;
      }
      g.stroke();
      g.setLineDash([]);
      if (d === 0 && r > 6) labels.push({ x, y, text: p.name, here });
    }
    // 标注：本层区域名，简单避让（已占位置就往下挪，挪不开就不标）
    g.font = '10px "Songti SC","STSong",serif';
    g.textAlign = 'center';
    const taken: number[][] = [];
    labels.sort((a, b) => Number(b.here) - Number(a.here));
    for (const l of labels) {
      const w = g.measureText(l.text).width;
      const lx = Math.max(w / 2 + 3, Math.min(S - w / 2 - 3, l.x));
      let ly = -1;
      for (const dy of [0, 12, -12, 24, -24]) {
        const cand = l.y + dy;
        if (cand < 16 || cand > S - 18) continue;
        if (taken.some((t) => Math.abs(t[0] - lx) < (t[2] + w) / 2 + 3 && Math.abs(t[1] - cand) < 11)) continue;
        ly = cand;
        break;
      }
      if (ly < 0) continue;
      taken.push([lx, ly, w]);
      halo(g, l.text, lx, ly, l.here ? '#ffe9b8' : INK);
    }

    // 剧情点：未听金色实心 + 光晕，已听空心灰。
    // 必须与上面的区域一样按层过滤 —— 天宫是垂直五层，御马监(二层)与齐天府(三层)
    // 水平只差 42m，不过滤的话小地图上两个金点几乎重叠，玩家水平飞过去扑空。
    for (const s of this.loreSites) {
      if (layerAtY(s.position.y) !== this.currentLayer) continue;
      const x = cx + (s.position.x - pos.x) / MINI_SCALE;
      const y = cy + (s.position.z - pos.z) / MINI_SCALE;
      if (x < 4 || x > S - 4 || y < 4 || y > S - 4) continue;
      const done = this.loreVisited.has(s.id);
      if (!done) {
        g.beginPath();
        g.arc(x, y, 5.5, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,233,184,.18)';
        g.fill();
      }
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fillStyle = done ? 'rgba(200,214,226,.35)' : '#ffe9b8';
      g.fill();
      g.strokeStyle = done ? 'rgba(200,214,226,.5)' : 'rgba(60,40,12,.9)';
      g.lineWidth = 1;
      g.stroke();
    }

    // 北标
    g.fillStyle = GOLD;
    g.font = '9px "Songti SC","STSong",serif';
    g.textAlign = 'center';
    g.fillText('北', cx, 11);

    // 大圣：始终居中，三角指向朝向（yaw=0 → -z → 屏幕上方）
    g.save();
    g.translate(cx, cy);
    g.rotate(-this.yaw);
    g.beginPath();
    g.moveTo(0, -7.5);
    g.lineTo(4.6, 5);
    g.lineTo(0, 2.6);
    g.lineTo(-4.6, 5);
    g.closePath();
    g.fillStyle = '#ffe9b8';
    g.fill();
    g.strokeStyle = 'rgba(40,26,16,.8)';
    g.lineWidth = 0.8;
    g.stroke();
    g.restore();
  }

  // ── 全图：十九区域平面全览 + 左侧立面尺 ────────────────
  private drawFull(): void {
    const pos = this.pos;
    const W = Math.min(innerWidth * 0.74, 900);
    const H = Math.min(innerHeight * 0.6, 580);
    const dpr = Math.min(devicePixelRatio, 2);
    fitCanvas(this.fullCanvas, W, H, dpr);
    const g = this.fullCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const ELEV_W = 118; // 左侧立面尺宽度
    const planX = ELEV_W + 18;
    const planW = W - planX - 8;

    // ── 立面尺：五层的真实高度关系 + 大圣所在高度 ──
    const ys = LAYER_KEYS.map((k) => LAYERS[k].baseY);
    const yMin = Math.min(...ys) - 60;
    const yMax = Math.max(...ys) + 90;
    const toScreenY = (wy: number) => H - 26 - ((wy - yMin) / (yMax - yMin)) * (H - 56);

    g.strokeStyle = 'rgba(232,180,85,.22)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(ELEV_W - 10, 18);
    g.lineTo(ELEV_W - 10, H - 18);
    g.stroke();

    for (const k of LAYER_KEYS) {
      const y = toScreenY(LAYERS[k].baseY);
      const on = k === this.currentLayer;
      g.strokeStyle = on ? GOLD : 'rgba(232,180,85,.28)';
      g.lineWidth = on ? 1.6 : 1;
      g.beginPath();
      g.moveTo(8, y);
      g.lineTo(ELEV_W - 10, y);
      g.stroke();
      g.fillStyle = on ? '#ffe9b8' : 'rgba(240,232,216,.6)';
      g.font = `${on ? 13 : 12}px "Songti SC","STSong",serif`;
      g.textAlign = 'left';
      g.fillText(`${'一二三四五'[k - 1]}　${LAYERS[k].name}`, 8, y - 6);
    }
    if (pos) {
      const py = toScreenY(pos.y);
      g.fillStyle = '#ffe9b8';
      g.beginPath();
      g.moveTo(ELEV_W - 10, py);
      g.lineTo(ELEV_W - 19, py - 4.5);
      g.lineTo(ELEV_W - 19, py + 4.5);
      g.closePath();
      g.fill();
      g.fillStyle = GOLD;
      g.font = '10px "Songti SC","STSong",serif';
      g.textAlign = 'right';
      // 层名画在刻线上方，高度读数画在下方，免得两者在同一层时叠字
      g.fillText(`${Math.round(pos.y)}丈`, ELEV_W - 22, py + 13);
    }

    // ── 平面：全部区域按世界坐标等比投影 ──
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of PLACES) {
      minX = Math.min(minX, p.center.x - p.radius);
      maxX = Math.max(maxX, p.center.x + p.radius);
      minZ = Math.min(minZ, p.center.z - p.radius);
      maxZ = Math.max(maxZ, p.center.z + p.radius);
    }
    const pad = 46;
    const k = Math.min((planW - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    const ox = planX + planW / 2 - ((minX + maxX) / 2) * k;
    const oz = H / 2 - ((minZ + maxZ) / 2) * k;
    const sx = (wx: number) => ox + wx * k;
    const sy = (wz: number) => oz + wz * k;

    // 先画远层（暗），再画本层（亮），最后画当前区域
    const order = [...PLACES].sort(
      (a, b) => Math.abs(b.layer - this.currentLayer) - Math.abs(a.layer - this.currentLayer),
    );
    for (const p of order) {
      const d = Math.abs(p.layer - this.currentLayer);
      const here = p === this.currentPlace;
      const x = sx(p.center.x);
      const y = sy(p.center.z);
      const r = Math.max(3, p.radius * k);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = d === 0 ? 'rgba(232,180,85,.14)' : `rgba(169,203,214,${Math.max(0.03, 0.09 - d * 0.02)})`;
      g.fill();
      g.strokeStyle = here ? '#ffe9b8' : d === 0 ? GOLD_DIM : `rgba(169,203,214,${Math.max(0.12, 0.3 - d * 0.06)})`;
      g.lineWidth = here ? 1.8 : 1;
      g.stroke();
    }
    // 标注单独走一遍并做避让：宫城层与内苑层在平面上几乎同心，直接标必然糊成一团。
    // 优先级：当前区域 > 本层 > 邻层；实在放不下的不标（底部名录里有全部区域）。
    g.textAlign = 'center';
    const taken: number[][] = [];
    const cands = order
      .slice()
      .reverse()
      .sort((a, b) => {
        const pa = a === this.currentPlace ? -1 : Math.abs(a.layer - this.currentLayer);
        const pb = b === this.currentPlace ? -1 : Math.abs(b.layer - this.currentLayer);
        return pa - pb;
      });
    for (const p of cands) {
      const d = Math.abs(p.layer - this.currentLayer);
      const here = p === this.currentPlace;
      const x = sx(p.center.x);
      const y = sy(p.center.z);
      const r = Math.max(3, p.radius * k);
      const size = here ? 13 : 11;
      g.font = `${size}px "Songti SC","STSong",serif`;
      const w = g.measureText(p.name).width;
      const lx = Math.max(planX + w / 2 + 2, Math.min(W - w / 2 - 2, x));
      let ly = -1;
      for (const off of [r + 13, -r - 5, r + 26, -r - 18, r + 39]) {
        const cand = y + off;
        if (cand < 14 || cand > H - 6) continue;
        if (taken.some((t) => Math.abs(t[0] - lx) < (t[2] + w) / 2 + 4 && Math.abs(t[1] - cand) < 13)) continue;
        ly = cand;
        break;
      }
      if (ly < 0) continue;
      taken.push([lx, ly, w]);
      halo(g, p.name, lx, ly, here ? '#ffe9b8' : d === 0 ? INK : 'rgba(200,214,226,.42)');
    }

    // 剧情点
    for (const s of this.loreSites) {
      const x = sx(s.position.x);
      const y = sy(s.position.z);
      const done = this.loreVisited.has(s.id);
      if (!done) {
        g.beginPath();
        g.arc(x, y, 8, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,233,184,.16)';
        g.fill();
      }
      g.beginPath();
      g.arc(x, y, 3.4, 0, Math.PI * 2);
      g.fillStyle = done ? 'rgba(200,214,226,.32)' : '#ffe9b8';
      g.fill();
      g.strokeStyle = done ? 'rgba(200,214,226,.45)' : 'rgba(60,40,12,.9)';
      g.lineWidth = 1;
      g.stroke();
    }

    // 北针
    g.strokeStyle = GOLD_DIM;
    g.fillStyle = GOLD;
    g.font = '11px "Songti SC","STSong",serif';
    g.textAlign = 'center';
    g.beginPath();
    g.moveTo(planX + planW - 24, 40);
    g.lineTo(planX + planW - 24, 18);
    g.stroke();
    g.fillText('北', planX + planW - 24, 14);

    // 大圣
    if (pos) {
      g.save();
      g.translate(sx(pos.x), sy(pos.z));
      g.rotate(-this.yaw);
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(6, 6.5);
      g.lineTo(0, 3.4);
      g.lineTo(-6, 6.5);
      g.closePath();
      g.fillStyle = '#ffe9b8';
      g.fill();
      g.strokeStyle = 'rgba(40,26,16,.85)';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }

    // ── 区域名录（按层分组，当前区域朱标） ──
    const parts: string[] = [];
    for (const lk of LAYER_KEYS) {
      const inLayer = PLACES.filter((p) => p.layer === lk);
      if (!inLayer.length) continue;
      const names = inLayer
        .map((p) => (p === this.currentPlace ? `<b>${p.name}</b>` : p.name))
        .join('・');
      parts.push(
        `<div class="tg-fm-row${lk === this.currentLayer ? ' on' : ''}"><span class="tg-fm-layer">${'一二三四五'[lk - 1]}　${LAYERS[lk].name}</span><span class="tg-fm-names">${names}</span></div>`,
      );
    }
    this.fullList.innerHTML = parts.join('');

    const doneCount = this.loreSites.filter((s) => this.loreVisited.has(s.id)).length;
    this.loreCount.textContent = this.loreSites.length
      ? `书中此处　${doneCount} / ${this.loreSites.length}`
      : '';
  }
}

/** 带暗色描边的文字：区域圈有金色填充，纯填充文字在上面读不清 */
function halo(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  g.strokeStyle = 'rgba(10,7,18,.9)';
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

/** 落在哪个区域（半径内取最近）；不在任何区域内返回 null */
function nearestPlace(pos: THREE.Vector3): PlaceInfo | null {
  let best: PlaceInfo | null = null;
  let bd = Infinity;
  for (const p of PLACES) {
    const dx = p.center.x - pos.x;
    const dz = p.center.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < p.radius && Math.abs(p.center.y - pos.y) < 120 && d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** 只在尺寸真的变了时重设 canvas（重设会清空并重新分配后备存储） */
function fitCanvas(c: HTMLCanvasElement, w: number, h: number, dpr: number): void {
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (c.width !== pw || c.height !== ph) {
    c.width = pw;
    c.height = ph;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
  }
}
