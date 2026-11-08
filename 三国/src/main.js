// 赤壁之战 · 主入口 —— 第三方视角观战：环境 / 营寨 / 舰队 / 特效 / 导演 / 运镜 / 音频 / UI
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironment } from './battle/env.js';
import { EffectsEngine } from './battle/effects.js';
import { buildFleets } from './battle/fleet.js';
import { createCamps } from './battle/camps.js';
import { createHuarong } from './battle/huarong.js';
import { Director } from './battle/director.js';
import { CameraRig } from './battle/cameraRig.js';
import { BattleAudio } from './battle/audio.js';
import { createUI } from './battle/ui.js';
import { BATTLE_DURATION } from './battle/script.js';

// ---------- 渲染基础 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1600);
camera.position.set(90, 45, 150);
// 竖屏（手机/窄窗）加大纵向视场，保住为横屏设计的构图
const fitFov = () => { camera.fov = innerWidth < innerHeight ? 62 : 45; };
fitFov();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.52;
controls.minDistance = 4;
controls.maxDistance = 480;
// 注：three r166 的 zoomToCursor 存在 NaN 缺陷，勿开启；
// 自由视角的缩放手感由 CameraRig.setMode 里重置注视点保证
controls.target.set(0, 0, -5);
controls.enabled = false;   // 默认跟随运镜

// ---------- 后期管线：线性 HDR 渲染 → 泛光 → ACES 色调映射输出 ----------
// （借鉴 moon-rover / LinearAbilityCasting 的 bloom+ACES 流程；火光、灯笼、月亮自然辉光）
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- 世界组装 ----------
const env = createEnvironment(scene);
const effects = new EffectsEngine(scene, env);
const camps = createCamps(scene, env, effects);
const huarong = createHuarong(scene, env, effects);
const fleets = buildFleets(scene, env, effects);
const rig = new CameraRig(camera, controls, {
  leadFire: () => fleets.huangGai.find((s) => s.alive),
  wuFlagship: () => fleets.wu[1],
  retreatShip: () =>
    fleets.wei.find((s) => s.alive && s.state === 'fleeing') ||
    fleets.wei.find((s) => s.alive) ||
    fleets.wu[1],
});
const audio = new BattleAudio();
const director = new Director({ env, fleets, effects, cameraRig: rig, audio, ui: null, huarong });

const ui = createUI({
  onStart() { audio.unlock(); director.start(); rig.play('wideRiver'); },
  onToggleCamera() {
    const free = rig.mode === 'cine';
    rig.setMode(free ? 'free' : 'cine');
    return free;
  },
  onMute() { return audio.toggleMute(); },
});
director.ui = ui;

// ---------- 循环 ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  director.update(dt);
  fleets.update(dt, t);
  env.update(dt, t);
  camps.update(dt, t);
  huarong.update(dt, t);
  effects.update(dt, t);
  rig.update(dt, t);
  audio.update(dt);
  ui.setProgress(director.t / BATTLE_DURATION);
  if (location.search.includes('debugtime')) {
    document.getElementById('err').textContent = `t=${director.t.toFixed(1)} clock=${clock.elapsedTime.toFixed(1)} dt=${dt.toFixed(4)} calls=${renderer.info.render.calls} tris=${renderer.info.render.triangles} arrows=${effects.flying} fires=${effects.fires.length}`;
  }
  composer.render();
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  fitFov();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---------- 调试：?autostart=1 跳过开场帘；?seek=秒 快进推演 ----------
const params = new URLSearchParams(location.search);
if (params.get('autostart')) {
  document.getElementById('startBtn')?.click();       // 走真实按钮路径
  const ov = document.getElementById('startOverlay');
  if (ov) ov.remove();                                // 无头截图不等渐隐
}
const seek = parseFloat(params.get('seek') || '0');
if (seek > 0) {
  const step = 1 / 30;
  let ts = 0;
  const n = Math.min(seek, BATTLE_DURATION) * 30;
  for (let i = 0; i < n; i++) {
    ts += step;
    director.update(step);
    fleets.update(step, ts);
    env.update(step, ts);
    camps.update(step, ts);
    huarong.update(step, ts);
    effects.update(step, ts);
    rig.update(step, ts);
  }
}

// 调试钩子：控制台可直接摆机位（?debug 场景排查用）
window.__debug = { camera, controls, rig, scene, audio };

const loading = document.getElementById('loading');
loading.style.opacity = '0';
setTimeout(() => loading.remove(), 600);
