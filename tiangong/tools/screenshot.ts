/**
 * tools/screenshot.ts —— 开发用截图工具（不入生产包）。
 * 用法：npx tsx tools/screenshot.ts "http://127.0.0.1:5173/?dev=hall" out.png [--wait 6000] [--cam "x,y,z,tx,ty,tz"]
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? 'shot.png';
const waitIdx = process.argv.indexOf('--wait');
const waitMs = waitIdx > 0 ? Number(process.argv[waitIdx + 1]) : 8000;

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,SkiaGraphite',
    '--use-angle=metal',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
