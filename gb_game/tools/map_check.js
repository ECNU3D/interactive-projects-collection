#!/usr/bin/env node
/* 地图连通性检查:把每关 16x16 坦克可达车道(4px 网格)画成 ASCII 图。
 * 画新地图后跑 `node tools/map_check.js`,确认出生点/基地/玩家区全部连通。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const W = 160, H = 144;
const PAL_HEX = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
const ctxStub = { fillStyle: PAL_HEX[3], imageSmoothingEnabled: false, fillRect() {} };
const canvasStub = { width: W, height: H, style: {}, getContext: () => ctxStub, addEventListener() {} };
const elStub = () => ({ style: {}, offsetHeight: 120, classList: { add() {}, remove() {} }, addEventListener() {}, getAttribute: () => 'x', setPointerCapture() {} });
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Set, Map, Uint8Array,
  document: { getElementById: id => (id === 'gb' ? canvasStub : elStub()), querySelectorAll: () => [] },
  performance: { now: () => 0 }, requestAnimationFrame: () => {}, addEventListener() {},
  innerWidth: 800, innerHeight: 600,
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const html = fs.readFileSync(path.join(__dirname, '..', 'battle_city.html'), 'utf8');
vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], sandbox);
const T = sandbox.__test;

const solid = t => t === 1 || t === 2 || t === 3;
function laneBlocked(stage, x, y) {
  if (x < 0 || y < 0 || x > 88 || y > 88) return true;
  for (let fy = y / 4; fy <= (y + 15) / 4; fy++)
    for (let fx = x / 4; fx <= (x + 15) / 4; fx++)
      if (solid(T.tileAt(fx, fy))) return true;
  return x < 60 && x + 16 > 44 && y < 104 && y + 16 > 88; // 基地
}
for (let s = 1; s <= 3; s++) {
  T.loadStage(s);
  const seen = new Set(['0,0']);
  const q = [[0, 0]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (!laneBlocked(s, nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  console.log('--- stage ' + s + ' (reachable ' + seen.size + ') ---');
  console.log('     ' + Array.from({ length: 23 }, (_, i) => (i * 4 % 10)).join(''));
  for (let y = 0; y <= 88; y += 4) {
    let row = '';
    for (let x = 0; x <= 88; x += 4) {
      row += seen.has(x + ',' + y) ? '*' : (laneBlocked(s, x, y) ? '#' : '.');
    }
    console.log(String(y).padStart(3) + '  ' + row);
  }
}
