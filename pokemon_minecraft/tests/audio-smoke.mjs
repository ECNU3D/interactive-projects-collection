// 音频引擎冒烟：真实 AudioContext 下各合成路径不抛错
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--disable-gpu', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:8642/?autostart=1&still=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.title === 'STILL READY', { timeout: 120000 });

const result = await page.evaluate(async () => {
  const out = [];
  try {
    const { AudioEngine } = await import('./src/audio/audioEngine.js');
    const a = new AudioEngine();
    a.init();
    if (!a.ctx) return ['AudioContext 不可用'];
    await a.ctx.resume();
    // 各合成路径
    for (const s of ['electric', 'fire', 'water', 'grass', 'rock', 'ghost', 'ice', 'poison', 'hit_super', 'ui_buy', 'ball_success', 'levelup', 'status_para', 'badge']) a.sfx(s);
    a.sfx3d('fire', new THREE.Vector3(256, 22, 260));
    for (const id of [25, 4, 94, 143]) { a.cry(id, 'encounter'); a.cry(id, 'hurt'); a.cry(id, 'faint'); }
    for (const b of ['title', 'grassland', 'forest', 'lake', 'volcano', 'snow', 'night', 'village', 'battle_wild', 'battle_gym']) { a.bgm(b); await new Promise(r => setTimeout(r, 60)); }
    for (const j of ['victory', 'capture', 'evolution', 'defeat']) a.jingle(j);
    for (const k of ['grass', 'forest', 'lake', 'volcano', 'snow', 'night', 'village']) a.ambience(k);
    a.setVolume('bgm', 0.3); a.setVolume('sfx', 0.5); a.setVolume('voice', 0.7);
    a.voice('nurse_welcome');   // 无素材静默
    await new Promise(r => setTimeout(r, 800));
    out.push('audio paths OK, state=' + a.ctx.state);
  } catch (e) {
    out.push('FAIL: ' + (e.stack || e));
  }
  return out;
});
console.log(result.join('\n'));
console.log(errors.length ? '页面错误:\n' + errors.join('\n') : '无页面错误');
await browser.close();
process.exit(result.some(r => r.startsWith('FAIL')) || errors.length ? 1 : 0);
