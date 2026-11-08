// 无头浏览器截图/验证驱动（开发用）：node tests/browser.mjs [--shot out.png] [--test]
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8642';

const args = process.argv.slice(2);
const mode = args[0] || '--test';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run', '--window-size=1280,720'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (t.includes('Failed to load resource') && t.includes('404')) return;   // manifest.json 未生成属预期回退
  errors.push(t);
});

if (mode === '--test') {
  await page.goto(BASE + '/?autotest=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.title === 'TEST PASS' || document.title === 'TEST FAIL', { timeout: 120000 });
  const title = await page.title();
  const text = await page.$eval('#test-result', el => el.textContent);
  console.log(text);
  await page.screenshot({ path: '/tmp/autotest_end.png' });
  console.log('== ' + title + ' ==' + (errors.length ? '\n页面错误:\n' + errors.join('\n') : ''));
  process.exit(title === 'TEST PASS' && !errors.length ? 0 : 1);
} else {
  // --shot <url-suffix> <out.png>
  const suffix = args[1] || '?autostart=1&still=1';
  const out = args[2] || '/tmp/shot.png';
  await page.goto(BASE + '/' + suffix, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.title === 'STILL READY', { timeout: 120000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: out });
  console.log('saved ' + out + (errors.length ? '\n页面错误:\n' + errors.join('\n') : ''));
}

await browser.close();
