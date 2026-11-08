/**
 * tools/lore-check.ts —— 「书中此处」端到端校验（开发用，常驻工具，不入生产包）
 * 用法：先 npm run dev，再 npm run lore-check
 *
 * 断言：
 *  1. 剧情点全部建出（数量从 sites.length 派生，不写死），marker/交互点数与之一致，
 *     且每处 site.place 在 content/places.json 里存在、site.position 的水平距离落在该区域 radius 内
 *  2. 走到点上 → 提示正确 → 触发 → 播放中对话框显示"说书人" → 播完 → 进度记入 →
 *     Store 标记 → marker 强度降到 0.22 → 退出对话态
 *  3. Esc 中断（调 engine.abort()）→ 不落盘、marker 不转暗、恢复可操作
 *  4. 引擎互斥：inDialogue=true 时按真实 KeyE 键位不会触发剧情点（main.ts 的 KeyE 处理器
 *     首行 `if (store.get('inDialogue')) return;`，与 NPC 对话共用同一把闸门）
 *  5. 全图 `.tg-fullmap-lore` 计数正确、全程无 JS 错误
 *
 * 注：当前没有语音文件，走 VoiceBank 的字幕降级路径（按字数估算播放时长）——
 * 实测单处播放（7 句 + 一次性引子）约 45 秒，故只完整播 1 处，其余用直接断言状态验证。
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

interface PlaceInfo {
  id: string;
  center: [number, number, number];
  radius: number;
}
const places = (
  JSON.parse(fs.readFileSync(path.join(ROOT, 'content/places.json'), 'utf8')) as { places: PlaceInfo[] }
).places;
const placesById = new Map(places.map((p) => [p.id, p]));

const url = process.argv[2] ?? 'http://127.0.0.1:5173/?autoenter=1';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,SkiaGraphite', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// 播放走字幕降级路径，单处可达 45s；不设默认超时的话 Playwright 30s 默认值会
// 盖过下面单个调用里传的 timeout（对 waitForFunction 等有独立超时参数的调用也一样）。
page.setDefaultTimeout(180000);

const errs: string[] = [];
page.on('pageerror', (e) => {
  const s = String(e);
  if (!s.includes('pointer lock')) errs.push(s.slice(0, 200));
});
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200));
});

let failed = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed++;
};

try {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => (window as never as { __ready: boolean }).__ready === true, { timeout: 60000 });
  await page.waitForTimeout(9000);

  // ── 1. 站点完整性：数量不写死，从 sites.length 派生一致性 ──
  const sites = (await page.evaluate(`(() => {
    const g = window.__game;
    return g.lore.sites.map((s) => ({
      id: s.id,
      place: s.place,
      lines: s.lines.length,
      position: { x: s.position.x, y: s.position.y, z: s.position.z },
      hasMarker: g.lore.markers.has(s.id),
      placeBuilt: g.streaming.built.has(s.place),
    }));
  })()`)) as {
    id: string;
    place: string;
    lines: number;
    position: { x: number; y: number; z: number };
    hasMarker: boolean;
    placeBuilt: boolean;
  }[];
  const markerCount = (await page.evaluate(`window.__game.lore.markers.size`)) as number;
  const loreInteractableIds = (await page.evaluate(
    `window.__game.streaming.ctx.interactables.filter((i) => i.id.startsWith('lore-')).map((i) => i.id)`,
  )) as string[];

  check('剧情点已加载（sites.length > 0）', sites.length > 0, `实际 ${sites.length}`);
  check('marker 数与站点数一致', markerCount === sites.length, `sites=${sites.length} markers=${markerCount}`);
  check(
    'lore- 交互点数与站点数一致',
    loreInteractableIds.length === sites.length,
    `sites=${sites.length} interactables=${loreInteractableIds.length}`,
  );
  check('每处都有 marker', sites.every((s) => s.hasMarker), sites.filter((s) => !s.hasMarker).map((s) => s.id).join(','));
  check(
    '每处台词 ≥ 3 条',
    sites.every((s) => s.lines >= 3),
    sites.filter((s) => s.lines < 3).map((s) => s.id).join(',') || '',
  );
  check(
    '每处的 place 都是已建区域',
    sites.every((s) => s.placeBuilt),
    sites.filter((s) => !s.placeBuilt).map((s) => s.id).join(','),
  );

  // ── 1b. 站点位置合法性：place 存在于 content/places.json，且水平距离落在该区域 radius 内 ──
  const badPlaceRef = sites.filter((s) => !placesById.has(s.place));
  check(
    '每处 site.place 都能在 content/places.json 找到',
    badPlaceRef.length === 0,
    badPlaceRef.map((s) => `${s.id}→${s.place}`).join(','),
  );
  const outOfRadius = sites.filter((s) => {
    const p = placesById.get(s.place);
    if (!p) return false; // 上一条已经报过，这里不重复计
    const d = Math.hypot(s.position.x - p.center[0], s.position.z - p.center[2]);
    return d > p.radius;
  });
  check(
    '每处 site.position 的水平距离落在所属区域 radius 内',
    outOfRadius.length === 0,
    outOfRadius
      .map((s) => {
        const p = placesById.get(s.place)!;
        const d = Math.hypot(s.position.x - p.center[0], s.position.z - p.center[2]);
        return `${s.id}(${d.toFixed(1)}>${p.radius})`;
      })
      .join(','),
  );

  // ── 2. 走到点上，断言按键提示；触发 → 播完，断言落盘 / marker 强度 / 退出对话态 ──
  const target = sites[0].id;
  const before = (await page.evaluate(
    `window.__game.store.get('visitedLore')`,
  )) as string[];
  await page.evaluate(`(() => {
    const g = window.__game;
    const s = g.lore.sites.find((x) => x.id === ${JSON.stringify(target)});
    g.flight.state.pos.copy(s.position);
    g.flight.resetInterpolation();
    g.store.set('settings', { ...g.store.get('settings'), autoAdvance: true });
  })()`);
  await page.waitForTimeout(600); // 让 loop.onUpdate 跑够帧数刷新 #tg-prompt

  const promptText = await page.textContent('#tg-prompt');
  check('走到点上显示按键提示', (promptText ?? '').includes('按 E · 听书中此处'), promptText ?? '(空)');

  // 走近会触发 LoreEngine.prewarm 后台拉说书语音包（3.3MB）。等它就绪再按 E ——
  // 这就是玩家的真实节奏（走近、站定、开口）。不等的话，start() 内部要先 await
  // 载入才开对话框，下面「播放中」的断言会在字幕出现之前就跑。
  await page.waitForFunction(`window.__game.engine.voice.has('shuoshu')`, { timeout: 60000, polling: 200 });
  check('走近后说书语音包已预热就绪', true);

  await page.evaluate(
    // 注意：必须 void 掉 start() 返回的 Promise，不能 return 给 page.evaluate ——
    // evaluate 会自动 await 收到的 thenable，若把整条播放链路的 Promise 交回去，
    // 这一句就会一直卡到整段播完才返回，后面「播放中」的断言就变成了播完之后的假阳性。
    `(() => { const g = window.__game; const s = g.lore.sites.find((x) => x.id === ${JSON.stringify(target)}); void g.lore.engine.start(s); })()`,
  );
  await page.waitForTimeout(400);
  const speakerText = await page.textContent('#tg-dlg-speaker');
  check('播放中对话框显示"说书人"', speakerText === '说书人', speakerText ?? '(空)');
  check('播放中 inDialogue 为 true', (await page.evaluate(`window.__game.store.get('inDialogue') === true`)) as boolean);

  // 字幕降级路径下单处播放可达 45s；超时给足 180s，显式设 polling 避免过于频繁的 evaluate 往返。
  await page.waitForFunction(`!window.__game.lore.engine.active`, { timeout: 180000, polling: 500 });

  const after = (await page.evaluate(
    `window.__game.store.get('visitedLore')`,
  )) as string[];
  check('播完后记入进度', after.includes(target), `before=${before.length} after=${after.length}`);
  check(
    'Store 里也标记了',
    (await page.evaluate(`window.__game.store.get('visitedLore').includes(${JSON.stringify(target)})`)) as boolean,
  );
  check(
    'marker 强度降到 0.22',
    (await page.evaluate(
      `Math.abs(window.__game.lore.markers.get(${JSON.stringify(target)}).__strength.value - 0.22) < 1e-9`,
    )) as boolean,
  );
  check('播完已退出对话态', (await page.evaluate(`window.__game.store.get('inDialogue') === false`)) as boolean);

  // ── 3. Esc 中断（调 engine.abort()）：不落盘、marker 不转暗、恢复可操作 ──
  const target2 = sites.find((s) => s.id !== target)!.id;
  await page.evaluate(
    `(() => { const g = window.__game; const s = g.lore.sites.find((x) => x.id === ${JSON.stringify(target2)}); void g.lore.engine.start(s); })()`,
  );
  await page.waitForTimeout(1200);
  await page.evaluate(`window.__game.lore.engine.abort()`);
  await page.waitForFunction(`!window.__game.lore.engine.active`, { timeout: 30000 });
  const after2 = (await page.evaluate(
    `window.__game.store.get('visitedLore')`,
  )) as string[];
  check('中断后不标记已听', !after2.includes(target2));
  check(
    '中断后 marker 强度仍为 1.0（未转暗）',
    (await page.evaluate(`window.__game.lore.markers.get(${JSON.stringify(target2)}).__strength.value === 1`)) as boolean,
  );
  check('中断后恢复可操作（inDialogue 回 false）', (await page.evaluate(`window.__game.store.get('inDialogue') === false`)) as boolean);

  // ── 4. 引擎互斥：inDialogue=true 时，真实 KeyE 键位不会触发剧情点 ──
  // main.ts 的 KeyE 处理器首行是 `if (store.get('inDialogue')) return;`，
  // NPC 对话引擎与 LoreEngine 启动时都会同步置 inDialogue = true，共用同一把闸门。
  // 用 target2（上面已确认未标记已听、engine 未 active）站位，人工把 inDialogue 顶成 true
  // （与 DialogueEngine.start() 内部做的事完全一样），再派发真实 keydown 事件，
  // 断言 KeyE 处理器在第一行就短路返回——LoreEngine 没有被触发。
  await page.evaluate(`(() => {
    const g = window.__game;
    const s = g.lore.sites.find((x) => x.id === ${JSON.stringify(target2)});
    g.flight.state.pos.copy(s.position);
    g.flight.resetInterpolation();
  })()`);
  await page.waitForTimeout(300);
  await page.evaluate(`window.__game.store.set('inDialogue', true)`);
  await page.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))`);
  await page.waitForTimeout(300);
  const mutexHeld = (await page.evaluate(
    `!window.__game.lore.engine.active && !window.__game.store.get('visitedLore').includes(${JSON.stringify(target2)})`,
  )) as boolean;
  check('inDialogue=true 时 KeyE 不会触发剧情点（引擎互斥）', mutexHeld);
  await page.evaluate(`window.__game.store.set('inDialogue', false)`); // 复位，不污染后续断言

  // ── 5. 地图计数 ──
  await page.evaluate(`window.__game.minimap.toggle()`);
  await page.waitForTimeout(500);
  const countText = await page.textContent('.tg-fullmap-lore');
  check(
    '全图显示计数',
    new RegExp(`书中此处\\s+1\\s*/\\s*${sites.length}`).test(countText ?? ''),
    countText ?? '(空)',
  );

  check('无 JS 错误', errs.length === 0, errs.join(' | '));
} catch (e) {
  console.error('❌ 校验脚本异常终止：', e);
  failed++;
} finally {
  await browser.close();
}

console.log(failed ? `\n❌ ${failed} 项未通过` : '\n✅ 全部通过');
process.exit(failed ? 1 : 0);
