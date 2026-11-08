// 紅樓夢 · 入府遊 —— 主入口（分階段興造 + 院落裁剪）
import * as THREE from 'three';
import { P } from './palette.js';
import { uniforms, makeSky } from './materials.js';
import { cullables } from './geo.js';
import { buildGround, buildWater, buildBridges, buildStreet, buildAlleys, buildLights } from './world.js';
import { buildAllAsync } from './compound.js';
import { RONG_DEFS } from './data/rong.js';
import { NING_DEFS } from './data/ning.js';
import { YUAN_DEFS } from './data/yuan.js';
import { Crowd, Figures } from './people.js';
import { buildNav } from './nav.js';
import { Interiors } from './interior.js';
import { WalkControls } from './controls.js';
import { walkHeight, regionAt, SPAWN } from './layout.js';
import { AudioSys } from './audio.js';
import { drawMiniMap, drawBigMap, hitBigMap } from './map.js';

const qp = new URLSearchParams(location.search);
const still = qp.has('still');
// 截圖／自檢用：只興造鏡頭附近的院落（軟件光柵化跑不動全園）
const NEAR = qp.has('near') ? parseFloat(qp.get('near')) : 0;
const shotX = parseFloat(qp.get('x') ?? '0');
const shotZ = parseFloat(qp.get('z') ?? '0');
const localDefs = (defs) => (NEAR
  ? defs.filter((d) => d.x0 === undefined
    || Math.hypot((d.x0 + d.x1) / 2 - shotX, (d.z0 + d.z1) / 2 - shotZ) < NEAR + (d.x1 - d.x0 + d.z1 - d.z0) / 4)
  : defs);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: still });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.fogColor);
scene.fog = new THREE.Fog(P.fogColor, 90, 420);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2400);
const controls = new WalkControls(camera, canvas);

if (controls.isTouch) {
  const hint = document.querySelector('.hint-line');
  if (hint) hint.textContent = '左下摇杆行走 · 滑动画面环顾 · 右上「图」展开全图 · 行至妙处自有讲解';
}

// ---------- UI ----------
const titleScreen = document.getElementById('title-screen');
const enterBtn = document.getElementById('enter-btn');
const muteBtn = document.getElementById('mute-btn');
const viewBtn = document.getElementById('view-btn');
const mapBtn = document.getElementById('map-btn');
const statusEl = document.getElementById('load-status');
const miniCv = document.getElementById('minimap-canvas');
const miniLabel = document.getElementById('minimap-label');
const bigmap = document.getElementById('bigmap');
const bigCv = document.getElementById('bigmap-canvas');
const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

// 興造中出錯時，把原因寫到標題頁上（自檢用）
window.addEventListener('error', (e) => setStatus(`ERR ${e.message} @${e.filename?.split('/').pop()}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => setStatus(`ERR ${e.reason?.message ?? e.reason}`));

// ---------- 分階段興造 ----------
const world = { crowd: null, figures: null, interiors: null };
const audio = new AudioSys();
const visited = new Set();
let ready = false;

const nextFrame = () => (still ? Promise.resolve() : new Promise((r) => setTimeout(r, 12)));

let stageLabel = '';
const sub = (i, n, id) => setStatus(`${stageLabel}　${i}/${n} ${id ?? ''}⋯⋯`);

const STAGES = [
  ['平地 · 大地水木', () => { scene.add(makeSky()); buildLights(scene); buildGround(scene); }],
  ['引水 · 沁芳一脉', () => { buildWater(scene); buildBridges(scene); }],
  ['开街 · 宁荣夹道', () => { buildStreet(scene); buildAlleys(scene); }],
  ['兴造 · 荣国府', () => buildAllAsync(scene, localDefs(RONG_DEFS), sub, still)],
  ['兴造 · 宁国府', () => buildAllAsync(scene, localDefs(NING_DEFS), sub, still)],
  ['兴造 · 大观园', () => buildAllAsync(scene, localDefs(YUAN_DEFS), sub, still)],
  ['传神 · 府中人物', () => {
    if (!NEAR || qp.has('npc')) world.crowd = new Crowd(scene);
    world.figures = new Figures(scene);
    // 走近主要人物即講其故事
    world.figures.onNear = (f) => {
      if (f && !audio.played.has(f.narr) && audio.playNarration(f.narr)) visited.add(f.narr);
    };
  }],
  ['陈设 · 堂奥器用', () => { world.interiors = new Interiors(scene); }],
];

enterBtn.disabled = true;
const loading = (async () => {
  const t0 = performance.now();
  for (let i = 0; i < STAGES.length; i++) {
    const [label, fn] = STAGES[i];
    stageLabel = `${label}（${i + 1}/${STAGES.length}）`;
    setStatus(`${stageLabel}⋯⋯`);
    await nextFrame();
    const ts = performance.now();
    try {
      await fn();
      console.log(`[BUILD] ${label} ${(performance.now() - ts).toFixed(0)}ms`);
    } catch (err) {
      setStatus(`ERR@${label}: ${err.message}`);
      console.error(`[STAGE-ERR] ${label}`, err);
      throw err;
    }
  }
  await nextFrame();
  console.log(`[BUILD] total ${(performance.now() - t0).toFixed(0)}ms`);
  if (!NEAR || qp.has('map')) { drawBigMap(bigCv, visited); mapDrawn = visited.size; }
  setStatus('府第已成，请入府');
  enterBtn.disabled = false;
  ready = true;
})();

audio.onTrigger = (id) => { visited.add(id); };

// ---------- 事件 ----------
enterBtn.addEventListener('click', () => {
  if (!ready) return;
  titleScreen.classList.add('gone');
  controls.start();
  audio.begin();
});

muteBtn.addEventListener('click', () => {
  const on = audio.toggleMute();
  muteBtn.classList.toggle('off', !on);
});
viewBtn.addEventListener('click', () => {
  controls.toggleFly();
  viewBtn.textContent = controls.flyMode ? '风' : '游';
});

let mapOpen = false;
let mapDrawn = -1;
function toggleMap() {
  mapOpen = !mapOpen;
  bigmap.classList.toggle('hidden', !mapOpen);
  mapBtn.classList.toggle('off', !mapOpen);
  controls.frozen = mapOpen;
  if (mapOpen) {
    if (mapDrawn !== visited.size) { drawBigMap(bigCv, visited); mapDrawn = visited.size; }
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
mapBtn.addEventListener('click', toggleMap);
controls.onKey = (code) => {
  if (code === 'KeyM') toggleMap();
  if (code === 'KeyF') viewBtn.textContent = controls.flyMode ? '风' : '游';
  if (code === 'Escape' && mapOpen) toggleMap();
};

bigCv.addEventListener('click', (e) => {
  const hit = hitBigMap(bigCv, e.clientX, e.clientY);
  if (!hit) return;
  controls.teleport(hit.x, hit.z + 16, 0);
  toggleMap();
  audio.showPlaque(`神游 · ${hit.name}`, 3.5);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 主循環 ----------
const clock = new THREE.Clock();
let elapsed = 0;
const CULL = 190;
let miniTick = 0;

function step(dt) {
  elapsed += dt;
  uniforms.uTime.value = elapsed;
  controls.update(dt);
  const p = controls.pos;

  // 院落裁剪
  const far = controls.flyMode ? 1100 : CULL;
  for (let i = 0; i < cullables.length; i++) {
    const g = cullables[i];
    const u = g.userData;
    g.visible = (p.x - u.cx) ** 2 + (p.z - u.cz) ** 2 < (u.r + far) ** 2;
  }

  world.crowd?.update(dt, elapsed, p);
  world.figures?.update(dt, elapsed, p);
  world.interiors?.update(p);
  audio.update(p, dt);

  // 小地圖（每 3 幀）
  if (++miniTick % 3 === 0 && !mapOpen) {
    drawMiniMap(miniCv, p.x, p.z, controls.yaw, visited);
    const rn = regionAt(p.x, p.z);
    if (miniLabel.textContent !== rn) miniLabel.textContent = rn;
  }
}

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  step(dt);
  renderer.render(scene, camera);
}

if (!still) tick();

window.APP = { scene, camera, controls, renderer, world, audio, visited };

// ---------- 調試機位 ----------
// ?shot=1&x=..&z=..&yaw=..&pitch=..&fly=1&still=1
if (qp.has('shot') || still) {
  loading.then(() => {
    titleScreen.style.display = 'none';
    controls.enabled = true;
    const x = parseFloat(qp.get('x') ?? String(SPAWN.x));
    const z = parseFloat(qp.get('z') ?? String(SPAWN.z));
    controls.teleport(x, z, parseFloat(qp.get('yaw') ?? String(SPAWN.yaw)));
    controls.pitch = parseFloat(qp.get('pitch') ?? '-0.05');
    if (qp.get('fly')) { controls.flyMode = true; controls.flyT = 1; controls.pos.y = parseFloat(qp.get('h') ?? '90'); }
    if (qp.get('sub')) audio.debugSubtitle(qp.get('sub'), 1);
    if (qp.get('map')) toggleMap();

    if (still) {
      // 同步連渲數幀（配合 preserveDrawingBuffer），不進 rAF，載入事件後畫面即最終幀
      for (let n = 0; n < 3; n++) {
        step(0.016);
        if (qp.get('fly')) { controls.flyT = 1; controls.pos.y = parseFloat(qp.get('h') ?? '90'); controls.update(0.016); }
        renderer.render(scene, camera);
      }
      const r = renderer.info.render;
      console.log(`[PERF] calls=${r.calls} tris=${r.triangles} size=${renderer.domElement.width}x${renderer.domElement.height} aspect=${camera.aspect.toFixed(3)} pos=${controls.pos.x.toFixed(1)},${controls.pos.y.toFixed(2)},${controls.pos.z.toFixed(1)} yaw=${controls.yaw.toFixed(2)} vis=${cullables.filter((g) => g.visible).length}/${cullables.length} region=${regionAt(controls.pos.x, controls.pos.z)}`);
      // 把畫面直接讀回 DOM，繞開無頭合成時序（tools/grab.sh 取用）
      try {
        const el = document.createElement('div');
        el.id = 'shot-data';
        el.style.display = 'none';
        // ?map=1 时取全图画布，便于单独验收地图排版
        const srcCanvas = qp.has('map') ? bigCv : renderer.domElement;
        el.textContent = srcCanvas.toDataURL('image/png');
        document.body.appendChild(el);
      } catch (e) { console.error('[SHOT] toDataURL failed', e); }
      document.title = 'ready';
    } else {
      setTimeout(() => {
        const r = renderer.info.render;
        console.log(`[PERF] calls=${r.calls} tris=${r.triangles}`);
      }, 2500);
    }
  });
}
