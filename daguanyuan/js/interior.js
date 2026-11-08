// 可入室內：進入 60m 內才生成，生成後緩存。器物依原著描寫。
import * as THREE from 'three';
import { P } from './palette.js';
import { GeoBuilder } from './geo.js';
import { frame, plaqueBoard, coupletBoard } from './parts.js';
import { groundHeight } from './layout.js';

// ---------------------------------------------------------------- 器物
function K(gb, F, o) {                                   // 炕／床
  const { x = 0, z = 0, w = 3.2, d = 1.9, h = 0.52, color = P.wood, quilt = P.hongsha } = o;
  const p = (lx, lz) => { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; };
  gb.box(w, h, d, color, { ch: 'wood', ...p(x, z), y: F.y + h / 2, ry: F.rot });
  gb.box(w - 0.2, 0.1, d - 0.2, quilt, { ch: 'silk', ...p(x, z), y: F.y + h + 0.05, ry: F.rot });
  gb.box(w, 0.42, 0.16, color, { ch: 'wood', ...p(x, z - d / 2), y: F.y + h + 0.21, ry: F.rot });
}
function table(gb, F, o) {                               // 案／桌
  const { x = 0, z = 0, w = 2.4, d = 0.8, h = 0.82, color = P.wood } = o;
  const p = (lx, lz) => { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; };
  gb.box(w, 0.09, d, color, { ch: 'wood', ...p(x, z), y: F.y + h, ry: F.rot });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    gb.box(0.09, h, 0.09, color, { ch: 'wood', ...p(x + sx * (w / 2 - 0.14), z + sz * (d / 2 - 0.12)), y: F.y + h / 2, ry: F.rot });
  }
  gb.box(w - 0.3, 0.12, 0.06, color, { ch: 'wood', ...p(x, z + d / 2 - 0.1), y: F.y + h - 0.16, ry: F.rot });
}
function chair(gb, F, x, z, ry = 0, color = P.wood) {    // 交椅
  const p = (lx, lz) => { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; };
  gb.box(0.52, 0.07, 0.5, color, { ch: 'wood', ...p(x, z), y: F.y + 0.46, ry: F.rot + ry });
  gb.box(0.5, 0.72, 0.07, color, { ch: 'wood', ...p(x, z - 0.22), y: F.y + 0.82, ry: F.rot + ry });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    gb.box(0.06, 0.46, 0.06, color, { ch: 'wood', ...p(x + sx * 0.21, z + sz * 0.2), y: F.y + 0.23, ry: F.rot + ry });
  }
}
function screen(gb, F, x, z, w = 2.6, h = 2.0, ry = 0, color = P.woodDark, panel = P.hanbaiyu) {  // 插屏／屏風
  const p = (lx, lz) => { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; };
  gb.box(w, 0.14, 0.6, color, { ch: 'wood', ...p(x, z), y: F.y + 0.07, ry: F.rot + ry });
  gb.box(w, h, 0.12, color, { ch: 'wood', ...p(x, z), y: F.y + h / 2 + 0.14, ry: F.rot + ry });
  gb.box(w - 0.4, h - 0.4, 0.06, panel, { ch: 'stone', ...p(x, z + 0.05), y: F.y + h / 2 + 0.14, ry: F.rot + ry });
}
function vaseOn(gb, F, x, y, z, r = 0.2, h = 0.55, color = 0x6a8a90) {
  const [wx, wz] = F.p(x, z);
  gb.cyl(r * 0.55, r, h, color, { ch: 'flat', x: wx, y: y + h / 2, z: wz, seg: 8 });
  gb.cyl(r * 0.35, r * 0.5, 0.12, color, { ch: 'flat', x: wx, y: y + h + 0.06, z: wz, seg: 8 });
}
function ding(gb, F, x, y, z, s = 1) {                   // 古銅鼎
  const [wx, wz] = F.p(x, z);
  gb.cyl(0.34 * s, 0.28 * s, 0.5 * s, 0x5c7a62, { ch: 'flat', x: wx, y: y + 0.25 * s, z: wz, seg: 8 });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094;
    gb.box(0.06 * s, 0.3 * s, 0.06 * s, 0x5c7a62, { ch: 'flat', x: wx + Math.cos(a) * 0.2 * s, y: y - 0.14 * s, z: wz + Math.sin(a) * 0.2 * s });
  }
  gb.cyl(0.36 * s, 0.36 * s, 0.06 * s, 0x5c7a62, { ch: 'flat', x: wx, y: y + 0.52 * s, z: wz, seg: 8 });
}
function scroll(gb, F, x, y, z, w = 1.5, h = 2.4, color = 0xe0dac6) {   // 掛畫
  const [wx, wz] = F.p(x, z);
  gb.box(w, h, 0.04, color, { ch: 'paper', x: wx, y, z: wz, ry: F.rot });
  gb.box(w + 0.12, 0.08, 0.07, P.woodDark, { ch: 'wood', x: wx, y: y + h / 2, z: wz, ry: F.rot });
  gb.box(w + 0.12, 0.08, 0.07, P.woodDark, { ch: 'wood', x: wx, y: y - h / 2, z: wz, ry: F.rot });
}
function shelf(gb, F, x, z, w = 2.0, h = 2.0, ry = 0) {  // 多寶槅／書架
  const p = (lx, lz) => { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; };
  for (let i = 0; i <= 3; i++) {
    gb.box(w, 0.07, 0.42, P.wood, { ch: 'wood', ...p(x, z), y: F.y + i * (h / 3) + 0.1, ry: F.rot + ry });
  }
  for (const sx of [-1, 1]) gb.box(0.08, h, 0.42, P.wood, { ch: 'wood', ...p(x + sx * w / 2, z), y: F.y + h / 2, ry: F.rot + ry });
  for (let i = 0; i < 6; i++) {
    const lv = (i % 3) + 1;
    gb.box(0.28, 0.22, 0.2, i % 2 ? 0x7a5a4a : 0x4a6a70, {
      ch: 'flat', ...p(x - w / 2 + 0.4 + (i % 3) * (w / 3), z), y: F.y + lv * (h / 3) + 0.22, ry: F.rot + ry,
    });
  }
}
function drape(gb, F, x, z, w = 2.4, h = 2.2, color = P.hongsha, ry = 0) {  // 帳幔
  const p = (lx, lz) => { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; };
  gb.box(w, h, 0.05, color, { ch: 'silk', ...p(x, z), y: F.y + h / 2 + 0.4, ry: F.rot + ry });
  gb.box(w + 0.2, 0.12, 0.12, P.woodDark, { ch: 'wood', ...p(x, z), y: F.y + h + 0.46, ry: F.rot + ry });
}
function lampStand(gb, F, x, z) {
  const [wx, wz] = F.p(x, z);
  gb.cyl(0.16, 0.22, 0.1, P.woodDark, { ch: 'wood', x: wx, y: F.y + 0.05, z: wz, seg: 8 });
  gb.cyl(0.05, 0.05, 1.5, P.woodDark, { ch: 'wood', x: wx, y: F.y + 0.8, z: wz, seg: 6 });
  gb.cyl(0.2, 0.2, 0.42, P.hongsha, { ch: 'silk', x: wx, y: F.y + 1.7, z: wz, seg: 8 });
}

// 室內基本殼：地面、後壁、樑架、天花
function shell(gb, F, w, d, h, o = {}) {
  const { floor = P.mandi, floorCh = 'mandi', beam = P.liang } = o;
  const p = (lx, lz) => { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; };
  gb.box(w, 0.08, d, floor, { ch: floorCh, ...p(0, 0), y: F.y + 0.04, ry: F.rot });
  // 樑架
  const n = Math.max(2, Math.round(w / 4));
  for (let i = 0; i <= n; i++) {
    gb.box(0.24, 0.34, d, beam, { ch: 'wood', ...p(-w / 2 + w * i / n, 0), y: F.y + h - 0.2, ry: F.rot });
  }
  gb.box(w, 0.3, 0.3, beam, { ch: 'wood', ...p(0, 0), y: F.y + h - 0.5, ry: F.rot });
  // 天花（軟天花糊紙）
  gb.box(w - 0.2, 0.06, d - 0.2, 0xdad3bd, { ch: 'paper', ...p(0, 0), y: F.y + h - 0.02, ry: F.rot });
}

// ---------------------------------------------------------------- 室內定義
export const INTERIORS = [
  {
    id: 'in-rongxitang', name: '荣禧堂', x: -91.2, z: -152, rot: 0, y: 0.85, w: 22, d: 10, h: 4.2,
    build(gb, F) {
      shell(gb, F, 22, 10, 4.2);
      // 「大紫檀雕螭案上，設著三尺來高青綠古銅鼎……一邊是玻璃盒，一邊是金蜼彝」
      table(gb, F, { x: 0, z: -4.0, w: 4.6, d: 0.9, h: 0.95, color: 0x53311f });
      ding(gb, F, 0, F.y + 0.95, -4.0, 1.3);
      gb.box(0.5, 0.44, 0.36, 0xb8c8cc, { ch: 'flat', ...xy(F, -1.4, -4.0), y: F.y + 1.17, ry: F.rot });
      gb.box(0.42, 0.5, 0.32, P.jin, { ch: 'flat', ...xy(F, 1.4, -4.0), y: F.y + 1.2, ry: F.rot });
      // 「待漏隨朝墨龍大畫」
      scroll(gb, F, 0, F.y + 2.6, -4.75, 3.4, 2.6, 0xe2dcc8);
      // 「地下兩溜十六張楠木交椅」
      for (let i = 0; i < 8; i++) {
        chair(gb, F, -6.4 + i * 1.5, -1.4, 0);
        chair(gb, F, -6.4 + i * 1.5, 1.6, Math.PI);
      }
      // 「兩邊掛著一副烏木聯牌，鑲著鏨銀的字跡」
      coupletBoard(gb, F, '座上珠璣昭日月', -5.4, F.y + 2.3, -4.7, 0.6, 3.0);
      coupletBoard(gb, F, '堂前黼黻煥煙霞', 5.4, F.y + 2.3, -4.7, 0.6, 3.0);
      plaqueBoard(gb, F, '榮禧堂', 0, F.y + 3.55, -4.7, 3.2, 1.1);
      lampStand(gb, F, -8.4, -3.6); lampStand(gb, F, 8.4, -3.6);
      screen(gb, F, -9.6, 2.0, 2.4, 2.0, Math.PI / 2);
    },
  },
  {
    id: 'in-jiamu', name: '荣庆堂', x: -147, z: -104, rot: 0, y: 0.85, w: 22, d: 9.5, h: 4.1,
    build(gb, F) {
      shell(gb, F, 22, 9.5, 4.1);
      K(gb, F, { x: 0, z: -3.2, w: 4.4, d: 2.2, h: 0.55, quilt: 0x9a4a52 });
      table(gb, F, { x: 0, z: -3.2, w: 1.5, d: 0.7, h: 0.42, color: 0x53311f });
      for (let i = 0; i < 5; i++) { chair(gb, F, -5.2 + i * 2.2, 0.6, 0); chair(gb, F, -5.2 + i * 2.2, 3.0, Math.PI); }
      shelf(gb, F, -8.6, -3.6, 2.4, 2.4);
      shelf(gb, F, 8.6, -3.6, 2.4, 2.4);
      drape(gb, F, 6.0, -4.3, 2.6, 2.2, 0x8a4a52);
      scroll(gb, F, -3.4, F.y + 2.5, -4.5, 1.4, 2.2);
      scroll(gb, F, 3.4, F.y + 2.5, -4.5, 1.4, 2.2);
      plaqueBoard(gb, F, '榮慶堂', 0, F.y + 3.4, -4.5, 3.0, 1.05);
      lampStand(gb, F, -7.0, 1.6); lampStand(gb, F, 7.0, 1.6);
      vaseOn(gb, F, -6.2, F.y + 0.9, -3.0, 0.26, 0.7, 0x8a5a4a);
    },
  },
  {
    id: 'in-yihong', name: '怡红院', x: 126, z: -346, rot: 0, y: 0.5, w: 20, d: 8.5, h: 3.9,
    build(gb, F) {
      shell(gb, F, 20, 8.5, 3.9, { floor: P.wood, floorCh: 'wood' });
      // 「四面皆是雕空玲瓏木板，或流雲百蝠，或歲寒三友……或貯書處，或設鼎處」
      const cuts = [[-6.5, -1], [-2.5, 1.6], [1.5, -1.4], [5.5, 1.2], [8.2, -1.6]];
      for (const [cx, cz] of cuts) {
        gb.box(0.18, 3.1, 3.6, P.wood, { ch: 'wood', ...xy(F, cx, cz), y: F.y + 1.55, ry: F.rot });
        for (let i = 0; i < 3; i++) {
          gb.box(0.24, 0.7, 0.9, 0xdad3bd, { ch: 'lattice', uvMode: 'geo', ...xy(F, cx, cz - 1.1 + i * 1.1), y: F.y + 0.9 + i * 0.75, ry: F.rot });
        }
      }
      // 「原來是一架玻璃大鏡」——迷路的由來
      gb.box(2.2, 2.6, 0.12, 0xc8d6d8, { ch: 'flat', ...xy(F, 3.6, -3.9), y: F.y + 1.5, ry: F.rot });
      gb.box(2.5, 2.9, 0.16, P.woodDark, { ch: 'wood', ...xy(F, 3.6, -4.0), y: F.y + 1.5, ry: F.rot });
      K(gb, F, { x: -8.2, z: -2.6, w: 3.0, d: 2.0, quilt: 0xb8474f });
      drape(gb, F, -8.2, -3.7, 3.2, 2.4, 0xc9707a);
      table(gb, F, { x: 0, z: 2.6, w: 2.2, d: 0.9, h: 0.8 });
      chair(gb, F, -1.6, 2.6, Math.PI / 2); chair(gb, F, 1.6, 2.6, -Math.PI / 2);
      shelf(gb, F, 7.6, -3.6, 2.6, 2.6);
      vaseOn(gb, F, 0, F.y + 0.8, 2.6, 0.22, 0.6, 0x9a5a5a);
      lampStand(gb, F, -5.0, 3.0); lampStand(gb, F, 5.0, 3.0);
    },
  },
  {
    id: 'in-xiaoxiang', name: '潇湘馆', x: -119, z: -330, rot: 0, y: 0.5, w: 12, d: 7.5, h: 3.7,
    build(gb, F) {
      shell(gb, F, 12, 7.5, 3.7, { floor: P.mandi });
      // 「窗下案上設著筆硯，又見書架上磊著滿滿的書」——劉姥姥誤認作公子書房
      table(gb, F, { x: -2.6, z: -2.4, w: 2.4, d: 0.9, h: 0.82 });
      shelf(gb, F, -5.0, -2.8, 2.2, 2.4);
      shelf(gb, F, 4.6, -2.8, 2.2, 2.4);
      chair(gb, F, -2.6, -1.3, Math.PI);
      K(gb, F, { x: 3.4, z: -2.4, w: 2.6, d: 1.8, quilt: 0x8fa7a4 });
      // 茜紗窗
      drape(gb, F, 0, 3.4, 6.0, 2.2, P.qiansha);
      scroll(gb, F, 0, F.y + 2.4, -3.5, 1.3, 2.2);
      coupletBoard(gb, F, '寶鼎茶閒煙尚綠', -3.2, F.y + 2.0, -3.5, 0.5, 2.6);
      coupletBoard(gb, F, '幽窗棋罷指猶涼', 3.2, F.y + 2.0, -3.5, 0.5, 2.6);
      lampStand(gb, F, -4.6, 2.4);
      // 鸚鵡架
      gb.cyl(0.06, 0.06, 1.9, P.woodDark, { ch: 'wood', ...xy(F, 4.8, 2.6), y: F.y + 0.95, seg: 6 });
      gb.sphere(0.16, 0x6f9247, { ch: 'flat', ...xy(F, 4.8, 2.6), y: F.y + 2.0 });
    },
  },
  {
    id: 'in-hengwu', name: '蘅芜苑', x: 28, z: -520, rot: 0, y: 0.5, w: 17, d: 7.5, h: 3.6,
    build(gb, F) {
      // 「及進了房屋，雪洞一般，一色玩器全無……只有一個土定瓶，瓶中供著數枝菊花，
      //   並兩部書，茶奩茶杯而已。床上只弔著青紗帳幔，衾褥也十分樸素」
      shell(gb, F, 17, 7.5, 3.6, { floor: P.mandi });
      table(gb, F, { x: 0, z: -2.6, w: 2.0, d: 0.8, h: 0.82, color: 0x6a5a48 });
      vaseOn(gb, F, 0, F.y + 0.86, -2.6, 0.2, 0.5, 0xd8d2c0);
      gb.sphere(0.3, 0xe8e6dc, { ch: 'flat', ...xy(F, 0, -2.6), y: F.y + 1.5, sy: 0.28 });
      gb.box(0.3, 0.1, 0.22, 0x6a5a48, { ch: 'wood', ...xy(F, 0.6, -2.6), y: F.y + 0.9, ry: F.rot });
      gb.box(0.3, 0.1, 0.22, 0x6a5a48, { ch: 'wood', ...xy(F, 0.6, -2.6), y: F.y + 1.0, ry: F.rot });
      K(gb, F, { x: -5.4, z: -2.4, w: 2.8, d: 1.9, quilt: 0xb8b6a8 });
      drape(gb, F, -5.4, -3.4, 3.0, 2.2, 0x6a8a90);
      chair(gb, F, 4.6, -2.0, 0); chair(gb, F, 6.4, -2.0, 0);
      lampStand(gb, F, 6.6, 2.4);
    },
  },
  {
    id: 'in-daoxiang', name: '稻香村', x: -134, z: -498, rot: 0, y: 0.28, w: 12, d: 6.5, h: 3.1,
    build(gb, F) {
      shell(gb, F, 12, 6.5, 3.1, { floor: 0xa8987c, floorCh: 'earth', beam: 0x7a6a50 });
      table(gb, F, { x: 0, z: -2.0, w: 2.2, d: 0.8, h: 0.78, color: 0x8a7452 });
      chair(gb, F, -1.6, -1.0, Math.PI, 0x8a7452);
      chair(gb, F, 1.6, -1.0, Math.PI, 0x8a7452);
      K(gb, F, { x: -3.8, z: -2.0, w: 2.4, d: 1.7, color: 0x8a7452, quilt: 0xb0a884 });
      shelf(gb, F, 4.2, -2.4, 1.8, 1.8);
      scroll(gb, F, 0, F.y + 2.0, -3.0, 1.2, 1.8, 0xe6e0cc);
      lampStand(gb, F, 4.4, 1.8);
    },
  },
  {
    id: 'in-qiushuang', name: '秋爽斋', x: -96, z: -412, rot: 0, y: 0.5, w: 14, d: 8, h: 3.8,
    build(gb, F) {
      // 「這三間屋子並不曾隔斷。當地放著一張花梨大理石大案，案上磊著各種名人法帖……
      //   那一邊設著斗大的一個汝窯花囊，插著滿滿的一囊水晶球兒的白菊」
      shell(gb, F, 14, 8, 3.8, { floor: P.mandi });
      table(gb, F, { x: 0, z: -1.6, w: 4.4, d: 1.4, h: 0.86, color: 0x8a6a4a });
      gb.box(4.2, 0.08, 1.2, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, -1.6), y: F.y + 0.92, ry: F.rot });
      for (let i = 0; i < 4; i++) {
        gb.box(0.5, 0.16, 0.36, i % 2 ? 0x9a8a70 : 0x7a6a58, { ch: 'paper', ...xy(F, -1.6 + i * 0.9, -1.9), y: F.y + 1.02, ry: F.rot });
      }
      // 筆海
      gb.cyl(0.26, 0.26, 0.4, 0x6a5a48, { ch: 'wood', ...xy(F, 1.7, -1.5), y: F.y + 1.14, seg: 8 });
      for (let i = 0; i < 9; i++) {
        gb.cyl(0.02, 0.02, 0.5, 0x3a3028, { ch: 'flat', ...xy(F, 1.7 + (i % 3 - 1) * 0.09, -1.5 + ((i / 3 | 0) - 1) * 0.09), y: F.y + 1.5, rz: (i % 3 - 1) * 0.1, seg: 6 });
      }
      // 汝窯花囊 + 白菊
      vaseOn(gb, F, -4.6, F.y + 0.1, -1.6, 0.55, 1.1, 0x9fb6b2);
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785;
        gb.sphere(0.2, 0xf0eee4, { ch: 'flat', ...xy(F, -4.6 + Math.cos(a) * 0.4, -1.6 + Math.sin(a) * 0.4), y: F.y + 1.4 + (i % 3) * 0.12 });
      }
      chair(gb, F, -2.0, 0.4, Math.PI); chair(gb, F, 2.0, 0.4, Math.PI);
      K(gb, F, { x: 4.8, z: -2.4, w: 2.6, d: 1.8, quilt: 0x8aa07a });
      plaqueBoard(gb, F, '秋爽齋', 0, F.y + 3.2, -3.7, 2.8, 0.98);
      lampStand(gb, F, -5.4, 2.4); lampStand(gb, F, 5.4, 2.4);
    },
  },
  {
    id: 'in-longcui', name: '栊翠庵', x: -156, z: -574, rot: 0, y: 0.5, w: 12, d: 7.5, h: 3.7,
    build(gb, F) {
      shell(gb, F, 12, 7.5, 3.7, { floor: P.mandi });
      // 佛龕
      gb.box(2.2, 2.6, 0.6, P.woodDark, { ch: 'wood', ...xy(F, 0, -3.2), y: F.y + 1.3, ry: F.rot });
      gb.sphere(0.42, P.jin, { ch: 'flat', ...xy(F, 0, -3.1), y: F.y + 1.5, sy: 0.6 });
      ding(gb, F, 0, F.y + 0.1, -2.4, 0.8);
      // 「一杯為品，二杯即是解渴的蠢物」——茶具
      table(gb, F, { x: 3.0, z: -1.4, w: 1.8, d: 0.8, h: 0.5, color: 0x5a4634 });
      for (let i = 0; i < 3; i++) {
        gb.cyl(0.1, 0.08, 0.14, 0xd8d2c0, { ch: 'flat', ...xy(F, 2.4 + i * 0.6, -1.4), y: F.y + 0.58, seg: 8 });
      }
      gb.cyl(0.2, 0.24, 0.3, 0x6a8a90, { ch: 'flat', ...xy(F, 3.6, -1.0), y: F.y + 0.65, seg: 8 });
      // 蒲團
      for (const [cx, cz] of [[-3.0, -1.2], [-3.0, 0.4], [-1.4, -1.2]]) {
        gb.cyl(0.42, 0.42, 0.18, 0xb0a888, { ch: 'thatch', ...xy(F, cx, cz), y: F.y + 0.09, seg: 10 });
      }
      scroll(gb, F, -4.2, F.y + 2.3, -3.5, 1.2, 2.0, 0xe8e4d4);
      lampStand(gb, F, 4.6, 2.2);
    },
  },
  {
    id: 'in-shengqin', name: '省亲别墅正殿', x: 0, z: -650, rot: 0, y: 1.5, w: 26, d: 12, h: 6.0,
    build(gb, F) {
      shell(gb, F, 26, 12, 6.0, { floor: P.mandi });
      // 御座
      gb.box(6.0, 0.6, 4.0, P.hanbaiyu, { ch: 'stone', ...xy(F, 0, -3.6), y: F.y + 0.3, ry: F.rot });
      gb.box(2.2, 1.1, 1.5, 0x8a3a2a, { ch: 'wood', ...xy(F, 0, -3.8), y: F.y + 1.15, ry: F.rot });
      gb.box(2.4, 1.6, 0.2, 0x8a3a2a, { ch: 'wood', ...xy(F, 0, -4.5), y: F.y + 1.7, ry: F.rot });
      screen(gb, F, 0, -5.2, 6.4, 4.2, 0, P.woodDark, 0xc8b47a);
      ding(gb, F, -3.4, F.y + 0.6, -3.6, 1.6);
      ding(gb, F, 3.4, F.y + 0.6, -3.6, 1.6);
      for (let i = 0; i < 6; i++) {
        chair(gb, F, -7.5 + i * 3.0, -0.4, 0);
        chair(gb, F, -7.5 + i * 3.0, 3.2, Math.PI);
      }
      plaqueBoard(gb, F, '顧恩思義', 0, F.y + 5.0, -5.7, 5.0, 1.7);
      coupletBoard(gb, F, '座上珠璣昭日月', -7.4, F.y + 3.2, -5.7, 0.8, 4.2);
      coupletBoard(gb, F, '堂前黼黻煥煙霞', 7.4, F.y + 3.2, -5.7, 0.8, 4.2);
      for (const cx of [-10.5, -5.5, 5.5, 10.5]) lampStand(gb, F, cx, 4.4);
      drape(gb, F, -11.6, -4.0, 3.2, 3.4, 0x9d3a2b);
      drape(gb, F, 11.6, -4.0, 3.2, 3.4, 0x9d3a2b);
    },
  },
  {
    id: 'in-tianxiang', name: '天香楼', x: 150, z: -258, rot: 0, y: 0.85, w: 13, d: 8, h: 4.0,
    build(gb, F) {
      shell(gb, F, 13, 8, 4.0, { floor: P.wood, floorCh: 'wood' });
      table(gb, F, { x: 0, z: -1.0, w: 2.6, d: 1.4, h: 0.82 });
      for (let i = 0; i < 4; i++) chair(gb, F, -2.4 + i * 1.6, 1.2, Math.PI);
      shelf(gb, F, -4.8, -3.0, 2.2, 2.2);
      drape(gb, F, 4.4, -3.4, 2.8, 2.4, 0x9a4a52);
      scroll(gb, F, 0, F.y + 2.5, -3.7, 1.6, 2.4);
      plaqueBoard(gb, F, '天香樓', 0, F.y + 3.4, -3.7, 2.8, 0.98);
      lampStand(gb, F, -5.0, 2.6); lampStand(gb, F, 5.0, 2.6);
    },
  },
  {
    id: 'in-keqing', name: '秦氏卧房', x: 150, z: -262, rot: Math.PI, y: 5.9, upper: true, w: 12, d: 7, h: 3.6,
    // 第五回：「案上設著武則天當日鏡室中設的寶鏡，一邊擺著飛燕立著舞過的金盤，
    //           盤內盛著安祿山擲過傷了太真乳的木瓜……懸的是同昌公主製的聯珠帳」
    build(gb, F) {
      shell(gb, F, 12, 7, 3.6, { floor: P.wood, floorCh: 'wood' });
      K(gb, F, { x: 0, z: -2.0, w: 3.6, d: 2.2, quilt: 0xc06a72 });
      drape(gb, F, 0, -3.2, 4.2, 2.6, 0xc9707a);
      // 「案上設著武則天當日鏡室中設的寶鏡」
      table(gb, F, { x: -3.8, z: -1.6, w: 1.8, d: 0.7, h: 0.8, color: 0x53311f });
      gb.cyl(0.42, 0.42, 0.06, 0xc8d6d8, { ch: 'flat', ...xy(F, -3.8, -1.7), y: F.y + 1.24, rx: Math.PI / 2, ry: F.rot, order: 'YXZ', seg: 12 });
      gb.cyl(0.24, 0.24, 0.05, P.jin, { ch: 'flat', ...xy(F, -3.0, -1.6), y: F.y + 0.86, rx: Math.PI / 2, order: 'YXZ', seg: 12 });
      gb.sphere(0.16, 0xc8b24a, { ch: 'flat', ...xy(F, -3.0, -1.6), y: F.y + 0.94 });
      // 「海棠春睡圖」與對聯
      scroll(gb, F, 3.4, F.y + 2.3, -3.3, 1.5, 2.2, 0xe6dccb);
      coupletBoard(gb, F, '嫩寒鎖夢因春冷', 1.6, F.y + 1.9, -3.3, 0.5, 2.4);
      coupletBoard(gb, F, '芳氣籠人是酒香', 5.2, F.y + 1.9, -3.3, 0.5, 2.4);
      lampStand(gb, F, -4.6, 2.2); lampStand(gb, F, 4.6, 2.2);
    },
  },
  {
    id: 'in-lixiang', name: '梨香院', x: -38, z: -193, rot: 0, y: 0.5, w: 17, d: 7.5, h: 3.6,
    build(gb, F) {
      shell(gb, F, 17, 7.5, 3.6, { floor: P.mandi });
      K(gb, F, { x: -5.0, z: -2.4, w: 3.0, d: 2.0, quilt: 0xb8945a });
      table(gb, F, { x: 1.0, z: -1.6, w: 2.4, d: 1.0, h: 0.82 });
      for (let i = 0; i < 3; i++) chair(gb, F, -0.6 + i * 1.6, 0.4, Math.PI);
      shelf(gb, F, 6.4, -2.8, 2.2, 2.2);
      drape(gb, F, -5.0, -3.4, 3.2, 2.2, 0xb8945a);
      scroll(gb, F, 1.0, F.y + 2.4, -3.5, 1.4, 2.2);
      lampStand(gb, F, 6.6, 2.2);
    },
  },
];

function xy(F, lx, lz) { const [wx, wz] = F.p(lx, lz); return { x: wx, z: wz }; }

// ---------------------------------------------------------------- 延遲構建
export class Interiors {
  constructor(scene) {
    this.scene = scene;
    this.built = new Set();
    this.hintEl = document.getElementById('enter-hint');
    this.near = null;
  }

  update(playerPos) {
    let best = null, bd = 26;
    for (const it of INTERIORS) {
      const d = Math.hypot(it.x - playerPos.x, it.z - playerPos.z);
      if (d < 60 && !this.built.has(it.id)) {
        this.built.add(it.id);
        const gb = new GeoBuilder(it.id);
        const F = frame(it.x, it.z, it.rot);
        F.y = groundHeight(it.x, it.z) + it.y;
        try { it.build(gb, F); } catch (e) { console.error('[interior]', it.id, e); }
        gb.emit(this.scene, { cull: true });
      }
      if (d < bd) { bd = d; best = it; }
    }
    const show = best && bd < 22 ? best : null;
    if (show !== this.near) {
      this.near = show;
      if (show) {
        this.hintEl.textContent = `${show.name} · 可入内`;
        this.hintEl.classList.remove('hidden');
      } else {
        this.hintEl.classList.add('hidden');
      }
    }
  }
}
