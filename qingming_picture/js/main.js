// 清明上河圖 · 入畫遊 —— 主入口（分批加载 + 距离裁剪）
import * as THREE from 'three';
import { P } from './palette.js';
import { uniforms } from './materials.js';
import { buildTerrain, buildLights } from './terrain.js';
import { WalkControls } from './controls.js';
import { WORLD, walkHeight } from './layout.js';
import { cullables } from './geo.js';
import { buildArchitecture } from './buildings.js';
import { buildVegetation } from './trees.js';
import { Crowd } from './people.js';
import { Animals } from './animals.js';
import { Boats } from './boats.js';
import { Smoke, Birds } from './effects.js';
import { AudioSys } from './audio.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.fogColor);
scene.fog = new THREE.Fog(P.fogColor, 55, 265);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
const controls = new WalkControls(camera, canvas);

// 触屏设备：替换操作提示
if (controls.isTouch) {
  const hint = document.querySelector('.hint-line');
  if (hint) hint.textContent = '左下搖桿行走 · 滑動畫面環顧 · 搖桿推滿疾行 · 行至妙處自有講解';
}

// ---------- UI 句柄 ----------
const titleScreen = document.getElementById('title-screen');
const enterBtn = document.getElementById('enter-btn');
const muteBtn = document.getElementById('mute-btn');
const viewBtn = document.getElementById('view-btn');
const marker = document.getElementById('scroll-marker');
const status = document.getElementById('load-status');
const setStatus = (t) => { if (status) status.textContent = t; };

// ---------- 分批构建世界 ----------
const world = { lights: null, crowd: null, animals: null, boats: null, smoke: null, birds: null };
const audio = new AudioSys();
let ready = false;

// 讲解触发时联动场景：让移动元素（驴队、驼队）出现在语音描述的位置
audio.onTrigger = (id, pos) => { world.animals?.cue(id, pos?.x ?? 0); };

const nextFrame = () => new Promise((r) => setTimeout(r, 16));   // 让出主线程，浏览器得以绘制进度

const STAGES = [
  ['展卷 · 大地江河', () => { buildTerrain(scene); world.lights = buildLights(scene); }],
  ['落墨 · 屋宇樓臺', () => buildArchitecture(scene)],
  ['點苔 · 堤柳林木', () => buildVegetation(scene)],
  ['傳神 · 市井人物', () => { world.crowd = new Crowd(scene); }],
  ['寫生 · 牲畜駝隊', () => { world.animals = new Animals(scene, world.crowd); }],
  ['行舟 · 漕船客渡', () => { world.boats = new Boats(scene); }],
  ['生煙 · 炊煙飛鳥', () => { world.smoke = new Smoke(scene); world.birds = new Birds(scene); }],
];

enterBtn.disabled = true;
const loading = (async () => {
  for (let i = 0; i < STAGES.length; i++) {
    const [label, fn] = STAGES[i];
    setStatus(`${label}（${i + 1}/${STAGES.length}）⋯⋯`);
    await nextFrame();
    try {
      fn();
    } catch (err) {
      setStatus(`ERR@${label}: ${err.message}`);
      console.error(`[STAGE-ERR] ${label}`, err);
      throw err;
    }
  }
  await nextFrame();
  setStatus('畫卷已備，請入畫');
  enterBtn.disabled = false;
  ready = true;
})();

// ---------- UI 事件 ----------
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
  viewBtn.textContent = controls.flyMode ? '風' : '遊';
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') viewBtn.textContent = controls.flyMode ? '風' : '遊';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 手卷映射：游戏位置 → 原画横向位置（自左端计，手卷右起左行） ----------
// 锚点由原卷扫描标定：虹桥顶 49.5%，城门楼 18%，孙羊正店 12%，十千脚店欢门 44.5%
const SCROLL_ANCHORS = [
  [-40, 0.952], [85, 0.875], [300, 0.72], [376, 0.60], [396, 0.53],
  [436, 0.495], [484, 0.468], [506, 0.445], [660, 0.18], [768, 0.12],
  [924, 0.042], [1000, 0.022],
];
function paintingFrac(x) {
  const A = SCROLL_ANCHORS;
  if (x <= A[0][0]) return A[0][1];
  for (let i = 1; i < A.length; i++) {
    if (x <= A[i][0]) {
      const t = (x - A[i - 1][0]) / (A[i][0] - A[i - 1][0]);
      return A[i - 1][1] + (A[i][1] - A[i - 1][1]) * t;
    }
  }
  return A[A.length - 1][1];
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let elapsed = 0;
const CULL_DIST = 300;

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  elapsed += dt;
  uniforms.uTime.value = elapsed;

  controls.update(dt);
  const p = controls.pos;

  // 距离裁剪（按画卷 X 轴分块）
  for (let i = 0; i < cullables.length; i++) {
    const m = cullables[i];
    m.visible = p.x > m.userData.x0 - CULL_DIST && p.x < m.userData.x1 + CULL_DIST;
  }

  world.lights?.follow(p.x, p.z);
  world.crowd?.update(dt, elapsed, p);
  world.animals?.update(dt, elapsed);
  world.boats?.update(dt, elapsed);
  world.smoke?.update(elapsed);
  world.birds?.update(dt, elapsed);
  audio.update(p, dt);

  // 手卷进度：标记指向原画对应段落
  marker.style.left = (paintingFrac(p.x) * 100) + '%';

  renderer.render(scene, camera);
}
tick();

window.APP = { scene, camera, controls, renderer, world, audio };

// —— 调试机位：?shot=1&x=100&z=0&yaw=-1.57&pitch=-0.1&fly=1 ——
const qp = new URLSearchParams(location.search);
if (qp.get('shot')) {
  loading.then(() => {
    titleScreen.style.display = 'none';
    controls.enabled = true;
    controls.pos.x = parseFloat(qp.get('x') ?? '30');
    controls.pos.z = parseFloat(qp.get('z') ?? '6');
    controls.yaw = parseFloat(qp.get('yaw') ?? String(-Math.PI / 2));
    controls.pitch = parseFloat(qp.get('pitch') ?? '-0.05');
    controls.pos.y = (walkHeight(controls.pos.x, controls.pos.z) ?? 0) + 1.68;
    if (qp.get('fly')) { controls.flyMode = true; controls.flyT = 1; controls.pos.y = 55; }
    if (qp.get('cue')) world.animals?.cue(qp.get('cue'), controls.pos.x);
    setTimeout(() => {
      const r = renderer.info.render;
      console.log(`[PERF] calls=${r.calls} tris=${r.triangles} pos=${controls.pos.x.toFixed(1)},${controls.pos.y.toFixed(1)},${controls.pos.z.toFixed(1)} yaw=${controls.yaw.toFixed(2)}`);
    }, 2500);
    if (qp.get('audiotest')) {
      audio.begin();
      setTimeout(() => {
        console.log(`[AUDIO] narr=${!!audio.narrations} current=${!!audio.current} bgmErr=${audio.bgm.error ? audio.bgm.error.code : 'none'}`);
      }, 4000);
    }
    if (qp.get('subtest')) {
      const showSub = () => {
        if (!audio.debugSubtitle('xumu', 2)) setTimeout(showSub, 150);
      };
      showSub();
    }
  });
}
