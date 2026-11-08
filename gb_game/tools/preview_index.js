#!/usr/bin/env node
/* 离屏冒烟测试:把 index.html(合集启动器)的脚本放进 vm,
 * 验证 状态机(待插卡->插卡->开机->菜单->进入) 与菜单渲染,
 * 并把菜单画面渲染成 BMP 供人工检查。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const W = 160, H = 144;
const PAL_HEX = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
const PAL_RGB = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];

/* ---- stub 2d context:fillRect 记进帧缓冲,clearRect 记为"关机黑" ---- */
let fb = new Uint8Array(W * H).fill(255);
const ctxStub = {
  fillStyle: PAL_HEX[3],
  imageSmoothingEnabled: false,
  clearRect() { fb.fill(255); },
  fillRect(x, y, w, h) {
    const ci = PAL_HEX.indexOf(this.fillStyle);
    if (ci < 0) throw new Error('non-palette color: ' + this.fillStyle);
    x |= 0; y |= 0;
    for (let yy = y; yy < y + h; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || xx >= W) continue;
        fb[yy * W + xx] = ci;
      }
    }
  },
};
const canvasStub = { width: W, height: H, style: {}, getContext: () => ctxStub, addEventListener() {} };
const elStub = () => ({
  style: {}, offsetHeight: 20,
  classList: { add() {}, remove() {} },
  addEventListener() {}, getAttribute: () => 'x', setPointerCapture() {},
});
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Set, Map,
  document: {
    getElementById: id => (id === 'gb' ? canvasStub : elStub()),
    querySelectorAll: () => [],
  },
  location: { href: '' },
  performance: { now: () => 0 },
  requestAnimationFrame: () => {},
  addEventListener() {},
  innerWidth: 800, innerHeight: 600,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];
vm.runInContext(code, sandbox);
const T = sandbox.__test;

/* ---- 断言工具 ---- */
let failures = 0;
function ok(cond, msg) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + msg);
  if (!cond) failures++;
}
function px(x, y) { return fb[y * W + x]; }
function countPx(x0, y0, w, h, color) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (px(x, y) === color) n++;
  return n;
}

/* ---- BMP 输出 ---- */
function writeBmp(name, scale = 4) {
  const w = W * scale, h = H * scale;
  const rowSize = w * 3, pad = (4 - (rowSize % 4)) % 4;
  const dataSize = (rowSize + pad) * h;
  const buf = Buffer.alloc(54 + dataSize);
  buf.write('BM');
  buf.writeUInt32LE(54 + dataSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);
  let o = 54;
  for (let y = h - 1; y >= 0; y--) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const v = fb[sy * W + ((x / scale) | 0)];
      const c = v === 255 ? [34, 30, 38] : PAL_RGB[v];   // 255 = 关机黑
      buf[o++] = c[2]; buf[o++] = c[1]; buf[o++] = c[0];
    }
    o += pad;
  }
  fs.writeFileSync(path.join(OUT, name + '.bmp'), buf);
}

/* 手动推进 ts 毫秒(16.7ms 一帧) */
let ts = 0;
function run(ms) {
  const end = ts + ms;
  while (ts < end) { ts += 16.7; T.tick(ts); }
}

/* ================= 1. 游戏列表 ================= */
console.log('== 1. game list ==');
ok(T.GAMES.length === 10, 'exactly 10 games listed');
let filesOk = true;
for (const g of T.GAMES) {
  if (!fs.existsSync(path.join(ROOT, g.file))) { filesOk = false; console.log('  missing: ' + g.file); }
  if (g.name.length > 17) { filesOk = false; console.log('  name too long: ' + g.name); }
}
ok(filesOk, 'every listed game file exists, names fit the screen');

/* ================= 2. 待插卡(黑屏闪烁提示) ================= */
console.log('== 2. idle ==');
ok(T.phase === 'idle', 'boots into idle (awaiting cartridge)');
run(100);
T.render();
const idleOn = countPx(40, 50, 80, 32, 2);
ok(idleOn > 30, 'INSERT CARTRIDGE blink visible phase draws pixels');
run(600);                                       // 越过闪烁暗相(512ms 半周期)
T.render();
const idleOff = countPx(40, 50, 80, 32, 2);
ok(idleOff < idleOn, 'blink hidden phase darker (' + idleOn + ' -> ' + idleOff + ')');
writeBmp('i01_idle');

/* ================= 3. 插卡 -> 开机 -> 菜单 ================= */
console.log('== 3. insert / boot / menu ==');
T.insert();
ok(T.phase === 'insert', 'insert starts cartridge animation');
run(700);
ok(T.phase === 'boot', 'cart seated -> boot sequence');
run(400);                                       // logo 下落中
writeBmp('i02_boot');
ok(T.logoY > -20, 'boot logo is dropping (y=' + T.logoY.toFixed(1) + ')');
run(1200);
ok(T.phase === 'menu', 'boot finishes -> game menu');
ok(T.logoY === 64, 'logo settled at final position');
T.render();
ok(countPx(0, 0, W, 16, 0) > 400, 'menu header strip drawn');
/* 5x2 封面网格:每张卡都有图标像素和名字像素 */
let gridOk = true;
for (let i = 0; i < 10; i++) {
  const cx = (i % 5) * 32, cy = 20 + ((i / 5) | 0) * 54;
  if (countPx(cx + 2, cy + 2, 28, 28, 0) < 10) { gridOk = false; console.log('  card ' + i + ' icon empty'); }
  if (countPx(cx, cy + 30, 32, 16, 0) < 5) { gridOk = false; console.log('  card ' + i + ' caption empty'); }
}
ok(gridOk, 'all 10 cover cards: icon + caption drawn');
ok(countPx(1, 21, 30, 46, 2) > 200, 'selected card highlighted with light fill');
ok(countPx(1, 20, 30, 1, 0) >= 20 && countPx(1, 20 + 47, 30, 1, 0) >= 20, 'selected card has top/bottom bars');
writeBmp('i03_menu');

/* ================= 4. 光标移动 + 进入游戏 ================= */
console.log('== 4. select & launch ==');
T.moveCursor(1, 0);
ok(T.sel === 1, 'cursor moves right to card 1');
T.moveCursor(0, 1);
ok(T.sel === 6, 'cursor moves down to card 6');
T.moveCursor(-1, 0);
ok(T.sel === 5, 'cursor moves left to card 5');
T.moveCursor(0, -1);
ok(T.sel === 0, 'cursor moves up to card 0');
T.moveCursor(-1, 0);
ok(T.sel === 4, 'cursor wraps left edge to card 4');
T.moveCursor(0, -1);
ok(T.sel === 9, 'cursor wraps top edge to card 9');
ok(T.cardAt(16, 24) === 0 && T.cardAt(16 + 32 * 4, 20 + 54 + 10) === 9, 'cardAt maps pixels to cards');
ok(T.cardAt(80, 4) === -1 && T.cardAt(80, 140) === -1, 'cardAt rejects header/outside');
T.launch(-1);
ok(T.phase === 'menu', 'out-of-range launch ignored');
T.launch(T.sel);
ok(T.phase === 'flash', 'launch starts flash');
run(400);
ok(sandbox.location.href === 'tetris.html', 'navigates to selected game file (' + sandbox.location.href + ')');
T.render();
writeBmp('i04_flash');

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
