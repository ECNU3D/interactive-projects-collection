// 验证 A/D 左右移动是否与镜头右向量一致
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--disable-gpu', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.goto('http://localhost:8642/?autostart=1&still=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.title === 'STILL READY', { timeout: 120000 });

const res = await page.evaluate(() => {
  const g = window.__game;
  const cam = g.camera;
  // 镜头实际右向量（世界坐标）
  const e = cam.matrixWorld.elements;
  const camRight = { x: e[0], y: e[1], z: e[2] };      // 第一列 = right
  const camFwd = new THREE.Vector3();
  cam.getWorldDirection(camFwd);
  const out = { camRight: camRight, camFwd: { x: camFwd.x, z: camFwd.z } };
  for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
    const p0 = g.player.pos.clone();
    g.player.keys = {};
    g.player.keys[key] = true;
    for (let i = 0; i < 20; i++) { g.time += 0.05; g._update(0.05); }
    const d = g.player.pos.clone().sub(p0);
    // 位移在镜头右向量上的投影（>0 = 屏幕右）
    const dotR = d.x * camRight.x + d.z * camRight.z;
    const dotF = d.x * camFwd.x + d.z * camFwd.z;
    out[key] = { dx: +d.x.toFixed(2), dz: +d.z.toFixed(2), 屏幕右投影: +dotR.toFixed(2), 屏幕前投影: +dotF.toFixed(2) };
  }
  return out;
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
