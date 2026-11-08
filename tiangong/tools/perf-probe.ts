/**
 * tools/perf-probe.ts —— 性能取证探针（开发用，不入生产包）
 *
 * 用法：npm run dev 之后
 *   npx tsx tools/perf-probe.ts [url] [warmMs]
 *
 * 输出：场景规模（可见三角/draw call/碰撞盒）、帧时间分位数、
 *      固定步长 vs 渲染帧的步进分布（判断 judder）、区域生成卡顿。
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/?autoenter=1';
const warmMs = Number(process.argv[3] ?? 32000);

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,SkiaGraphite', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
page.on('console', (m) => {
  const t = m.text();
  if (/fps|quality|tiangong|rror/.test(t)) console.log('[console]', t.slice(0, 300));
});
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => (window as never as { __ready: boolean }).__ready === true, { timeout: 60000 });
console.log(`--- ready；等待后台预热 ${warmMs}ms ---`);
await page.waitForTimeout(warmMs);

const stats = await page.evaluate(`(() => {
  const g = window.__game;
  const col = g.streaming.ctx.collision;
  let meshes = 0, points = 0, instanced = 0, tris = 0, visible = 0;
  g.scene.traverse((o) => {
    if (o.isInstancedMesh) instanced++; else if (o.isPoints) points++; else if (o.isMesh) meshes++;
    if (o.isMesh || o.isPoints) {
      let vis = true, p = o;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      visible++;
      const geo = o.geometry;
      const n = geo?.index ? geo.index.count / 3 : (geo?.attributes?.position?.count ?? 0) / 3;
      tris += n * (o.isInstancedMesh ? o.count : 1);
    }
  });
  const info = g.renderer.info;
  return {
    collisionBoxes: col.boxes.length,
    regionsBuilt: g.streaming.built.size,
    npcs: g.npcs.npcs.length,
    meshes, instanced, points, visibleDrawables: visible,
    approxVisibleTris: Math.round(tris),
    renderInfo: { drawCalls: info.render.drawCalls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures },
    pixelRatio: g.renderer.getPixelRatio(),
    tier: g.store.get('tier'),
  };
})()`);
console.log('--- 场景规模 ---');
console.log(JSON.stringify(stats, null, 2));

// 平滑度：同一次运行里同时量「原始逻辑位置」与「渲染用的插值位置」每帧位移。
// 必须在开阔空中匀速直飞时测 —— 撞墙/落地会产生合法的静止帧，污染判据。
await page.evaluate(`(() => {
  const g = window.__game, f = g.flight;
  f.state.pos.set(0, 900, 0); f.state.yaw = 0; f.state.pitch = 0;
  f.state.vel.set(0, 0, -40); f.state.grounded = false; f.state.mode = 'glide';
  f.resetInterpolation();
  g.cameraRig.snapBehind(f.state.pos, f.state.yaw);
})()`);
await page.waitForTimeout(500);

const smooth = await page.evaluate(`new Promise((resolve) => {
  const g = window.__game;
  g.flight.keys.add('KeyW');
  const raw = [], interp = [];
  let pr = g.flight.state.pos.clone(), pi = g.avatar.position.clone();
  let n = 0;
  const tick = () => {
    raw.push(g.flight.state.pos.distanceTo(pr)); pr.copy(g.flight.state.pos);
    interp.push(g.avatar.position.distanceTo(pi)); pi.copy(g.avatar.position);
    if (++n < 400) requestAnimationFrame(tick);
    else {
      const stat = (a) => {
        const s = a.slice(1); // 丢掉第一帧
        const m = s.reduce((x,y)=>x+y,0)/s.length;
        const sd = Math.sqrt(s.reduce((x,y)=>x+(y-m)*(y-m),0)/s.length);
        return { meanStepM: +m.toFixed(4), stddevM: +sd.toFixed(4), cv: +(sd/Math.max(m,1e-6)).toFixed(3),
                 frozenFrames: s.filter((v)=>v < m*0.02).length, doubleFrames: s.filter((v)=>v > m*1.6).length };
      };
      resolve({ 原始逻辑位置: stat(raw), 渲染插值位置: stat(interp), frames: n });
    }
  };
  requestAnimationFrame(tick);
})`);
console.log('--- 运动平滑度（cv 越小越顺；frozen=该帧几乎没动，double=该帧走了两倍）---');
console.log(JSON.stringify(smooth, null, 2));
await page.evaluate(`window.__game.flight.keys.delete('KeyW')`);

const timing = await page.evaluate(`new Promise((resolve) => {
  const g = window.__game;
  const col = g.streaming.ctx.collision;
  g.flight.keys.add('KeyW');
  const acc = { raycast: 0, resolve: 0, ground: 0, update: 0, render: 0 };
  const wrap = (obj, name, key) => {
    const orig = obj[name].bind(obj);
    obj[name] = function () { const t = performance.now(); const r = orig.apply(null, arguments); acc[key] += performance.now() - t; return r; };
  };
  wrap(col, 'raycastForward', 'raycast');
  wrap(col, 'resolve', 'resolve');
  wrap(col, 'groundProbe', 'ground');

  // 步进分布：每个渲染帧跑了几次固定步长逻辑
  const stepHist = {};
  const origTick = g.loop.tick.bind(g.loop);
  let stepsThisFrame = 0;
  const updaters = g.loop.updaters;
  const wrappedUpdaters = updaters.map((fn) => (dt) => { stepsThisFrame++; const t = performance.now(); fn(dt); acc.update += performance.now() - t; });
  g.loop.updaters = wrappedUpdaters;
  const renderers = g.loop.renderers;
  g.loop.renderers = renderers.map((fn) => (dt, a) => { const t = performance.now(); fn(dt, a); acc.render += performance.now() - t; });

  const frames = [];
  let last = performance.now();
  const t0 = last;
  let n = 0;
  const tick = () => {
    const now = performance.now();
    frames.push(now - last);
    last = now;
    const s = Math.round(stepsThisFrame / Math.max(wrappedUpdaters.length, 1));
    stepHist[s] = (stepHist[s] || 0) + 1;
    stepsThisFrame = 0;
    n++;
    if (now - t0 < 8000) requestAnimationFrame(tick);
    else {
      const sorted = frames.slice().sort((a, b) => a - b);
      const pct = (p) => sorted[Math.floor(sorted.length * p)];
      const sum = frames.reduce((a, b) => a + b, 0);
      resolve({
        frames: frames.length,
        fps: +(1000 / (sum / frames.length)).toFixed(1),
        p50: +pct(0.5).toFixed(2), p95: +pct(0.95).toFixed(2), p99: +pct(0.99).toFixed(2),
        max: +sorted[sorted.length - 1].toFixed(2),
        hitchesOver33ms: frames.filter((f) => f > 33).length,
        stepsPerRenderFrame: stepHist,
        msPerFrame: {
          update: +(acc.update / n).toFixed(3),
          render: +(acc.render / n).toFixed(3),
          collisionRaycast: +(acc.raycast / n).toFixed(3),
          collisionResolve: +(acc.resolve / n).toFixed(3),
          collisionGround: +(acc.ground / n).toFixed(3),
        },
      });
    }
  };
  requestAnimationFrame(tick);
})`);
console.log('--- 帧时间（持续按 W 飞行 8s）---');
console.log(JSON.stringify(timing, null, 2));

await browser.close();
