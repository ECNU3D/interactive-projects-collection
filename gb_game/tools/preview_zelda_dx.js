#!/usr/bin/env node
/* 离屏预览/逻辑验证:把 03-zelda-links-awakening-dx.html 里的游戏脚本放进 vm,
 * 用 stub 2D context 捕获 fillRect 像素(动态调色板:任意 CSS 颜色映射到索引),
 * 渲染成 BMP 供人工检查,并对核心规则(移动/过场/战斗/道具/机关/BOSS/通关)做断言。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const W = 160, H = 144;

/* ---- stub 2d context:任意颜色动态编号,记进帧缓冲 ---- */
let fb = new Uint8Array(W * H);
const palRGB = [];
const palIdx = new Map();
function ci(color) {
  let i = palIdx.get(color);
  if (i === undefined) {
    i = palRGB.length;
    palIdx.set(color, i);
    const n = parseInt(String(color).slice(1), 16);
    palRGB.push([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  return i;
}
const ctxStub = {
  fillStyle: '#2038a0',
  imageSmoothingEnabled: false,
  fillRect(x, y, w, h) {
    const c = ci(this.fillStyle);
    x |= 0; y |= 0;
    for (let yy = y; yy < y + h; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || xx >= W) continue;
        fb[yy * W + xx] = c;
      }
    }
  },
};
const canvasStub = { width: W, height: H, style: {}, getContext: () => ctxStub, addEventListener() {} };
const elStub = () => ({
  style: {}, offsetHeight: 120,
  classList: { add() {}, remove() {} },
  addEventListener() {}, getAttribute: () => 'x', setPointerCapture() {},
});
const sandbox = {
  console, Math, JSON, Object, Array, String, Number, Set, Map, Uint8Array,
  document: {
    getElementById: id => (id === 'gb' ? canvasStub : elStub()),
    querySelectorAll: () => [],
  },
  performance: { now: () => 0 },
  requestAnimationFrame: () => {},
  addEventListener() {},
  innerWidth: 800, innerHeight: 600,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(ROOT, 'gbc_game', '03-zelda-links-awakening-dx.html'), 'utf8');
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
function countPx(x0, y0, w, h, hex) {
  const c = palIdx.get(hex);
  if (c === undefined) return 0;
  let n = 0;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (px(x, y) === c) n++;
  return n;
}

/* ---- BMP 输出(动态调色板) ---- */
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
      const c = palRGB[fb[sy * W + ((x / scale) | 0)]] || [255, 0, 255];
      buf[o++] = c[2]; buf[o++] = c[1]; buf[o++] = c[0];
    }
    o += pad;
  }
  fs.writeFileSync(path.join(OUT, name + '.bmp'), buf);
}
function snap(name) { T.render(); writeBmp(name); }
function steps(n) { for (let i = 0; i < n; i++) T.step(); }
function press(k, n) { T.key(k, true); steps(n === undefined ? 2 : n); T.key(k, false); }

const WHITE = '#f8f8f8';

/* ================= 1. 标题画面 ================= */
console.log('== 1. title ==');
ok(T.game.state === T.ST.TITLE, 'boots into TITLE');
while (T.game.frame % 32 >= 16) steps(1);      // 对齐到 PRESS START 可见相位
snap('z01_title');
ok(countPx(36, 122, 88, 8, WHITE) > 50, 'PRESS START visible phase draws pixels');
steps(16);
T.render();
ok(countPx(36, 122, 88, 8, WHITE) === 0, 'PRESS START blink hidden phase is blank');

/* ================= 2. 开始游戏 ================= */
console.log('== 2. start ==');
press('start');
ok(T.game.state === T.ST.PLAY, 'START enters PLAY');
ok(T.roomX === 2 && T.roomY === 3, 'spawns in start room (2,3), got (' + T.roomX + ',' + T.roomY + ')');
ok(T.game.hp === 6, 'Link starts with 3 hearts (6 half-units), hp=' + T.game.hp);
ok(!T.game.hasBombs && !T.game.hasHook && T.curItem() === null, 'sword only: no bombs/hook, B slot empty');
snap('z02_start');

/* ================= 3. 移动 / 斜走 / 撞墙 ================= */
console.log('== 3. movement ==');
T.setRoom(2, 3); T.setLink(64, 96);
const x0 = T.link.x;
T.key('right', true); steps(30); T.key('right', false);
ok(T.link.x === x0 + 30, 'walk right 30 frames moves 30px, dx=' + (T.link.x - x0));
T.setLink(64, 96);
T.key('left', true); steps(100); T.key('left', false);
ok(T.link.x >= 12 && T.link.x <= 14, 'wall blocks westward walk at x=' + T.link.x);
T.setLink(64, 96);
T.key('down', true); T.key('right', true); steps(30);
T.key('down', false); T.key('right', false);
ok(T.link.x > 64 && T.link.y > 96, 'diagonal walk moves both axes, (' + T.link.x + ',' + T.link.y + ')');

/* ================= 4. 房间滑动过场 ================= */
console.log('== 4. room slide ==');
T.setRoom(2, 3); T.setLink(4, 64); T.face(-1, 0);
T.key('left', true); steps(6); T.key('left', false);
ok(T.game.state === T.ST.SLIDE, 'walking off west edge triggers SLIDE');
steps(25);
ok(T.game.state === T.ST.PLAY && T.roomX === 1 && T.roomY === 3,
  'slide ends in neighbor room (1,3), got (' + T.roomX + ',' + T.roomY + ')');
ok(T.link.x >= 136, 'Link respawned at east side of new room, x=' + T.link.x);
T.setLink(140, 64); T.face(1, 0);
T.key('right', true); steps(6); T.key('right', false);
steps(25);
ok(T.roomX === 2 && T.roomY === 3, 'east slide returns to (2,3)');

/* ================= 4b. 门口互查 + 卡死回归 ================= */
console.log('== 4b. doorway reciprocity + stuck regression ==');
/* 静态互查:每个刻有门口(含 %/D/K 机关门)的边,邻居对应边必须有门 */
T.startGame();                                 // 重建纯净房间数据
const RA = T.roomsAll;
const DOOR_T = { N: [[4, 0], [5, 0]], S: [[4, 7], [5, 7]], W: [[0, 3], [0, 4]], E: [[9, 3], [9, 4]] };
const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
const DXY = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
const hasOpen = (x, y, d) => DOOR_T[d].some(([tx, ty]) => RA[y][x].tiles[ty][tx] !== '#');
let recipOk = true, recipMsg = '';
for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) for (const d of ['N', 'S', 'W', 'E']) {
  if (!hasOpen(x, y, d)) continue;
  const ax = x + DXY[d][0], ay = y + DXY[d][1];
  if (ax < 0 || ax > 4 || ay < 0 || ay > 3) continue;      // 地图外沿无门(设计如此)
  if (!hasOpen(ax, ay, OPP[d])) { recipOk = false; recipMsg = `(${x},${y})${d} -> (${ax},${ay})${OPP[d]}`; }
}
ok(recipOk, 'every doorway has a reciprocal opening in the neighbor room' + (recipMsg ? ' (' + recipMsg + ')' : ''));

/* 回归:(1,1) 南门 -> (1,2) 北门,滑过去不能嵌进北墙(原 bug:(1,2) 没刻北门) */
T.setRoom(1, 1); T.clearEnemies();
T.setLink(64, 108); T.face(0, 1);
T.key('down', true);
for (let i = 0; i < 40 && T.game.state !== T.ST.SLIDE; i++) steps(1);
T.key('down', false);
ok(T.game.state === T.ST.SLIDE && T.roomX === 1 && T.roomY === 2, '(1,1) south doorway slides into (1,2)');
steps(25);
ok(T.game.state === T.ST.PLAY && !T.linkStuck(), 'Link lands on walkable tiles after the slide (no wall embed)');
T.clearEnemies();                              // (1,2) 的史莱姆别干扰走位
const wy0 = T.link.y;
T.key('down', true); steps(10); T.key('down', false);
ok(T.link.y > wy0, 'Link can walk away from the doorway, dy=' + (T.link.y - wy0));

/* 回归:(2,0) 南门对着 (2,1) 未开的机关门 D:不许滑过去嵌死;开门后能滑 */
T.setRoom(2, 0); T.clearEnemies();
T.setLink(64, 108); T.face(0, 1);
T.key('down', true); steps(40); T.key('down', false);
ok(T.roomX === 2 && T.roomY === 0, 'closed switch-door blocks the south slide (stays in (2,0))');
ok(!T.linkStuck(), 'Link not embedded while bumping the closed door');
RA[1][2].tiles[0][4] = '.'; RA[1][2].tiles[0][5] = '.';  // 模拟推块开门
T.key('down', true);
for (let i = 0; i < 40 && T.game.state !== T.ST.SLIDE; i++) steps(1);
T.key('down', false);
steps(25);
ok(T.roomX === 2 && T.roomY === 1 && !T.linkStuck(), 'opened switch-door slides into (2,1) cleanly');
T.startGame();                                 // 4b 改动过 (2,1) 门砖,重建纯净房间再进后续测试

/* ================= 5. 战斗:史莱姆/骷髅格挡/蝙蝠正弦 ================= */
console.log('== 5. combat ==');
T.setRoom(2, 2); T.clearEnemies();
T.setLink(64, 80); T.face(0, 1);
T.spawnEnemy('slime', 4, 5);                  // 正前方一格
press('a', 2);
steps(12);
ok(T.enemies.length === 0, 'sword arc kills slime in front');
ok(T.game.hp === 6, 'slime 16px away deals no contact damage, hp=' + T.game.hp);

/* 骷髅:正面格挡(铛,不掉血),背后两刀击杀(t=50 让其原地不巡逻,保证距离不变) */
T.setLink(64, 80); T.face(0, 1);
const sk = T.spawnEnemy('skeleton', 4, 5);
sk.face = 'up'; sk.t = 50;                    // 面向林克(北) -> 格挡
press('a', 2); steps(4);
ok(sk.hp === 2, 'skeleton blocks frontal sword hit (no damage), hp=' + sk.hp);
ok(T.game.clinkT > 0, 'block produces clink flag');
steps(10);
sk.face = 'down'; sk.t = 50;                  // 背对林克 -> 可砍
press('a', 2); steps(12);
ok(sk.hp === 1, 'back hit damages skeleton, hp=' + sk.hp);
sk.face = 'down'; sk.t = 50;
press('a', 2); steps(12);
ok(T.enemies.length === 0, 'second back hit kills skeleton');

/* 蝙蝠:正弦飞行轨迹 */
T.setLink(140, 120);
const bat = T.spawnEnemy('bat', 4, 3);
const ys = [];
for (let i = 0; i < 64; i++) { steps(1); ys.push(T.enemies[T.enemies.length - 1].y); }
const ymin = Math.min(...ys), ymax = Math.max(...ys);
ok(ymax - ymin >= 10, 'bat follows sine path, y range=' + (ymax - ymin).toFixed(1));
ok(Math.abs((ymin + ymax) / 2 - 64) < 4, 'bat sine centered on baseY=64, mid=' + ((ymin + ymax) / 2).toFixed(1));

/* ================= 6. 掉落物:心回血 / 卢比计数 ================= */
console.log('== 6. drops ==');
T.setRoom(2, 3); T.clearEnemies();
T.game.hp = 4;
T.setLink(64, 96);
T.spawnDrop(4, 5, 'heart');                   // 正好落在林克身上 (68,100)
steps(2);
ok(T.game.hp === 5, 'heart pickup heals half a heart, hp=' + T.game.hp);
const rp0 = T.game.rupees;
T.spawnDrop(4, 5, 'rupee');
steps(2);
ok(T.game.rupees === rp0 + 1, 'rupee pickup increments counter, rupees=' + T.game.rupees);

/* ================= 7. 受伤:半心/击退/无敌闪烁/死亡 ================= */
console.log('== 7. damage & death ==');
T.setRoom(2, 3); T.clearEnemies();
T.game.hp = 6;
T.setLink(64, 90);
T.spawnEnemy('slime', 4, 5);                  // 与林克重叠
steps(2);
ok(T.game.hp === 5, 'enemy contact costs half a heart, hp=' + T.game.hp);
ok(T.link.invuln > 0, 'invincibility frames active, invuln=' + T.link.invuln);
ok(T.link.kb > 0, 'knockback frames active, kb=' + T.link.kb);
const ky0 = T.link.y;
steps(6);
ok(T.link.y !== ky0, 'knockback displaces Link, dy=' + (T.link.y - ky0));
/* 致死 -> DIE -> OVER */
T.clearEnemies();
T.game.hp = 1;
T.setLink(64, 90);                            // setLink 清无敌/击退
T.spawnEnemy('slime', 4, 5);
steps(2);
ok(T.game.state === T.ST.DIE, 'death at 0 hp enters DIE anim');
steps(80);
ok(T.game.state === T.ST.OVER, 'DIE anim ends in GAME OVER');
steps(35);                                    // OVER 需停 30 帧才响应 START
press('start'); steps(2);
ok(T.game.state === T.ST.TITLE, 'OVER + START returns to TITLE');

/* ================= 8. 宝箱仪式:炸弹 ================= */
console.log('== 8. chest ceremony (bombs) ==');
press('start');                               // TITLE -> PLAY(新游戏)
ok(T.game.state === T.ST.PLAY, 'new game from title');
T.setRoom(0, 2); T.clearEnemies();
T.setLink(80, 64); T.face(0, -1);             // 宝箱在 (5,2),林克在正下方朝上
T.key('up', true); steps(1); T.key('up', false);
ok(T.game.state === T.ST.ITEMGET, 'pushing into chest triggers ITEMGET ceremony');
ok(T.game.hasBombs && T.game.bombs === 10, 'ceremony grants bombs x10');
steps(29);
snap('z04_chest');                            // 仪式进行中快照
steps(80);
ok(T.game.state === T.ST.PLAY, 'ceremony ends back in PLAY');
ok(T.room.chest.opened, 'chest stays opened');

/* ================= 9. 炸弹炸裂缝墙 -> 通路打开 ================= */
console.log('== 9. bomb cracked wall ==');
T.setRoom(2, 2); T.clearEnemies();
T.giveItem('bombs'); T.setItem('bombs');
ok(T.tileAt(4, 0) === '%' && T.tileAt(5, 0) === '%', 'cracked wall present before bombing');
T.setLink(64, 32); T.face(0, -1);
press('b', 2);
ok(T.bombsEnt.length === 1, 'bomb placed');
steps(100);
ok(T.tileAt(4, 0) === '.' && T.tileAt(5, 0) === '.', 'explosion blows cracked wall into floor');
T.giveItem('heal');                           // 爆炸可能波及林克,补满再走过场
T.setLink(72, 48); T.face(0, -1);
T.key('up', true); steps(40); T.key('up', false);
steps(25);
ok(T.roomX === 2 && T.roomY === 1, 'walking through blown wall reaches (2,1)');

/* ================= 10. 小钥匙 + 钥匙门 ================= */
console.log('== 10. key & locked door ==');
T.setRoom(4, 1); T.clearEnemies();
T.setLink(80, 64); T.face(0, -1);
T.key('up', true); steps(1); T.key('up', false);
ok(T.game.state === T.ST.ITEMGET && T.game.keys === 1, 'key chest grants small key');
steps(110);
T.setRoom(2, 0);
ok(T.tileAt(0, 3) === 'K' && T.tileAt(0, 4) === 'K', 'locked door present');
T.setLink(16, 64); T.face(-1, 0);
T.key('left', true); steps(3); T.key('left', false);
ok(T.game.keys === 0, 'locked door consumes the key');
ok(T.tileAt(0, 3) === '.' && T.tileAt(0, 4) === '.', 'locked door opens');

/* ================= 11. 推块上开关 -> 机关门开 ================= */
console.log('== 11. push block puzzle ==');
T.setRoom(2, 1); T.clearEnemies();
ok(T.tileAt(4, 0) === 'D' && T.tileAt(5, 0) === 'D', 'switch door closed initially');
T.setLink(32, 80); T.face(1, 0);              // 块在 (3,4),开关在 (5,4)
T.key('right', true);
for (let i = 0; i < 100 && T.tileAt(4, 0) === 'D'; i++) steps(1);  // 门一开就松手
T.key('right', false);
ok(T.room.block.tx === 5 && T.room.block.ty === 4,
  'block pushed onto switch at (5,4), got (' + T.room.block.tx + ',' + T.room.block.ty + ')');
ok(T.tileAt(4, 0) === '.' && T.tileAt(5, 0) === '.', 'switch opens the door');

/* ================= 12. 钩爪飞越 2 格沟壑 ================= */
console.log('== 12. hookshot gap cross ==');
T.setRoom(1, 0); T.clearEnemies();
T.giveItem('hook'); T.setItem('hook');
T.setLink(112, 80); T.face(-1, 0);            // 沟壑在 4,5 列,桩在 (2,4)
press('b', 2);
ok(T.hook.st !== 0, 'hookshot fired');
steps(40);
ok(T.hook.st === 0, 'hookshot sequence finished');
ok(T.link.x < 64 && T.link.x > 30, 'Link latch-pulled across the 2-tile chasm, x=' + T.link.x);
/* 返程:西半岸朝东挂 (7,3) 桩拉回(防单向陷阱) */
T.setLink(24, 64); T.face(1, 0);
press('b', 2);
steps(40);
ok(T.hook.st === 0, 'return hookshot sequence finished');
ok(T.link.x > 80, 'Link latch-pulled back east across the chasm, x=' + T.link.x);

/* ================= 13. BOSS 战:三段循环 + 3 轮弱点 + 三角通关 ================= */
console.log('== 13. boss fight ==');
T.setRoom(0, 0); T.setLink(120, 80);
ok(!!T.boss, 'boss spawns in (0,0)');
ok(T.boss.phase === 'charge', 'boss starts in charge phase');
ok(T.BGM.song === 'boss', 'boss room switches BGM to boss variant');
steps(125);
ok(T.boss.phase === 'barrage', 'phase advances charge -> barrage');
steps(155);
ok(T.boss.phase === 'stun', 'phase advances barrage -> stun');
T.giveItem('heal');
for (let round = 1; round <= 3; round++) {
  if (round > 1) { T.boss.phase = 'stun'; T.boss.t = 0; T.boss.gemHit = false; }
  T.setLink(T.boss.x + 24, T.boss.y - 16); T.face(0, 1);   // 站宝石正上方朝下砍
  press('a', 2); steps(3);
  ok(T.boss && T.boss.rounds === round, 'weak point hit: round ' + round);
  if (round === 1) snap('z06_boss');
  steps(10);
}
ok(T.boss.phase === 'dying', '3 rounds -> boss dying');
steps(100);
ok(T.boss === null, 'boss dies');
ok(T.drops.some(d => d.kind === 'triforce'), 'triforce dropped');
const tri = T.drops.find(d => d.kind === 'triforce');
T.setLink(tri.x - 4, tri.y - 4);
steps(2);
ok(T.game.state === T.ST.VICTORY, 'collecting triforce enters VICTORY');
steps(100);
snap('z07_victory');
ok(T.game.time > 0, 'clear time tracked, frames=' + T.game.time);

/* ================= 14. 音频模块无 AudioContext 安全调用 ================= */
console.log('== 14. audio no-op safety ==');
const sndFns = ['init', 'start', 'select', 'slash', 'clink', 'enemyHit', 'enemyDie', 'hurt',
  'heart', 'rupee', 'keyGet', 'chestOpen', 'itemGet', 'bombPlace', 'bombBoom', 'hookFire',
  'hookLatch', 'door', 'push', 'bossRoar', 'bossHit', 'spit', 'triForce', 'over'];
let audioOk = true, audioErr = '';
for (const f of sndFns) {
  if (typeof T.Snd[f] !== 'function') { audioOk = false; audioErr = f + ' missing'; break; }
  try { T.Snd[f](); } catch (e) { audioOk = false; audioErr = f + ': ' + e.message; break; }
}
ok(audioOk, 'all SFX functions exist and no-op safely without AudioContext' + (audioErr ? ' (' + audioErr + ')' : ''));
let bgmOk = true;
try { T.BGM.play('dungeon'); for (let i = 0; i < 300; i++) T.BGM.tick(); T.BGM.play('boss'); for (let i = 0; i < 300; i++) T.BGM.tick(); T.BGM.stop(); }
catch (e) { bgmOk = false; }
ok(bgmOk, 'BGM sequencer ticks without throwing (no sound card)');

/* ================= 15. 确定性机器人乱按 6000 帧 ================= */
console.log('== 15. bot fuzz ==');
let seed = 13579;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
T.game.state = T.ST.TITLE;
press('start');
const KS = ['up', 'down', 'left', 'right', 'a', 'b', 'select'];
let fuzzErr = '', boundsOk = true, embedOk = true, sawSlide = false, sawItemGet = false;
for (let f = 0; f < 6000 && !fuzzErr; f++) {
  for (const k of KS) if (rnd() < 0.2) T.key(k, rnd() < 0.5);
  if (rnd() < 0.01) T.key('start', rnd() < 0.5);
  try { T.step(); } catch (e) { fuzzErr = 'frame ' + f + ': ' + e.message; break; }
  const st = T.game.state;
  if (st === T.ST.SLIDE) sawSlide = true;
  if (st === T.ST.ITEMGET) sawItemGet = true;
  if (st === T.ST.PLAY || st === T.ST.SLIDE) {
    if (T.link.x < -4 || T.link.x > 164 || T.link.y < 10 || T.link.y > 148) boundsOk = false;
    if (T.game.hp < 0 || T.game.hp > 6) boundsOk = false;
    if (T.roomX < 0 || T.roomX > 4 || T.roomY < 0 || T.roomY > 3) boundsOk = false;
    if (st === T.ST.PLAY && T.linkStuck()) embedOk = false;   // 嵌墙=卡死前兆
  }
  if ((st === T.ST.OVER || st === T.ST.TITLE || st === T.ST.VICTORY) && f % 90 === 0) press('start');
  if (f % 600 === 0) T.render();               // 渲染路径也压一遍
}
ok(!fuzzErr, 'no exception in 6000 fuzz frames' + (fuzzErr ? ' (' + fuzzErr + ')' : ''));
ok(boundsOk, 'invariants hold: Link in bounds, hp 0..6, room coords valid');
ok(embedOk, 'Link never ends a PLAY frame embedded in a wall');
ok(sawSlide, 'bot triggered room slide transitions');

/* ================= 16. 布景快照 ================= */
console.log('== 16. staged snapshots ==');
/* 草地/水池房 */
T.game.state = T.ST.TITLE; press('start');
T.setRoom(1, 3); T.setLink(16, 96); T.face(1, 0);
steps(2);
snap('z03_grasswater');
/* 战斗场面:挥剑瞬间 + 三种敌人(史莱姆放弧线外保证同框) */
T.setRoom(2, 2); T.clearEnemies();
T.setLink(64, 80); T.face(0, 1);
T.spawnEnemy('slime', 7, 5);
T.spawnEnemy('skeleton', 6, 3);
T.spawnEnemy('bat', 2, 2);
press('a', 2); steps(4);
snap('z05_combat');
/* 沟壑房:双向钩爪桩(西桩 (2,4),东桩 (7,3)) */
T.setRoom(1, 0); T.clearEnemies();
T.setLink(120, 80); T.face(-1, 0);
steps(2);
snap('z08_chasm');

/* ---- BMP -> PNG(macOS sips) ---- */
console.log('== bmp -> png (sips) ==');
for (const f of fs.readdirSync(OUT).filter(f => f.startsWith('z') && f.endsWith('.bmp'))) {
  const bmp = path.join(OUT, f);
  const png = path.join(OUT, f.replace(/\.bmp$/, '.png'));
  try { execSync(`sips -s format png "${bmp}" --out "${png}" >/dev/null 2>&1`); console.log('PNG  ' + f.replace(/\.bmp$/, '.png')); }
  catch (e) { console.log('sips failed for ' + f); failures++; }
}

/* ================= 结果 ================= */
console.log('== done ==');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' FAILURE(S)');
process.exit(failures === 0 ? 0 : 1);
