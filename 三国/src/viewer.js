// 模型赏析查看器 —— 场景 / 灯光 / 相机 / 模型切换
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLouchuan } from './models/louchuan.js';
import { createOaredBoat } from './models/oaredBoat.js';
import { createFireShip } from './models/fireShip.js';
import { createWatchtower } from './models/watchtower.js';
import { createChibiScene } from './models/chibiScene.js';

const VIEWS = [
  {
    id: 'scene', name: '赤壁水寨', build: createChibiScene,
    desc: '建安十三年（208）冬，长江赤壁—乌林段。孙刘联军江岸水寨：木栅围营、营门楼橹、仓棚帷帐、修船架、双栈桥，楼船、火攻船与桨战船泊于江汊。',
    ref: '参考 01_chibi_landscape / 06_riverside_naval_camp',
  },
  {
    id: 'louchuan', name: '楼船 · 指挥舰', build: createLouchuan,
    desc: '东汉大型两层楼船。狭长浅吃水木船，低栏楯、两层克制战棚、桨位二十四、尾舵与舵楼、单桅矩形织物帆。水战中坚与指挥之所。',
    ref: '参考 02_han_louchuan_command_ship',
  },
  {
    id: 'oaredBoat', name: '桨战船 · 走舸', build: createOaredBoat,
    desc: '东汉中型快速桨战船。长窄船体、低舷、二十四支侧桨、竹席拱篷、短桅卷帆、尾操纵桨、石碇麻绳。用于突击、传令与交通。',
    ref: '参考 03_han_oared_fighting_boat',
  },
  {
    id: 'fireShip', name: '黄盖火攻船', build: createFireShip,
    desc: '蒙冲式浅吃水火船，实以薪草、膏灌其中、裹以帷幕，尾系走舸两艘。点火前状态——距曹军水寨最后一里的沉默。',
    ref: '参考 04_huang_gai_fire_ship',
  },
  {
    id: 'watchtower', name: '营门 · 楼橹', build: createWatchtower,
    desc: '临时军寨木营门与两层瞭望楼。木柱板门、铜环、短木栅、开放式瞭望台、灰瓦四坡顶、简化斗栱、木梯与警鼓。',
    ref: '参考 05_han_camp_gate_watchtower',
  },
];

// ---------- 渲染基础 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9aa5ab');
scene.fog = new THREE.Fog('#9aa5ab', 45, 140);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.52;

// ---------- 灯光（阴冷秋晨） ----------
scene.add(new THREE.HemisphereLight('#c8cfd4', '#5a544a', 1.15));
const sun = new THREE.DirectionalLight('#fff2e0', 2.2);
sun.position.set(14, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
sun.shadow.camera.right = sun.shadow.camera.top = 30;
sun.shadow.bias = -0.0005;
scene.add(sun);
const rim = new THREE.DirectionalLight('#a8bfd4', 0.7);
rim.position.set(-16, 10, -14);
scene.add(rim);

// ---------- 地面（单体模式的展台） ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(60, 48),
  new THREE.MeshStandardMaterial({ color: '#8f938f', roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;

// ---------- 模型管理 ----------
let current = null;
const cache = new Map();

function setView(id) {
  const v = VIEWS.find((x) => x.id === id);
  if (!v) return;
  if (current) scene.remove(current.group);
  scene.remove(ground);

  if (!cache.has(id)) cache.set(id, v.build());
  const group = cache.get(id);
  current = { group, view: v };
  scene.add(group);
  if (id !== 'scene') scene.add(ground);

  // 相机取景
  const { radius, y } = group.userData.view || { radius: 10, y: 3 };
  const target = new THREE.Vector3(0, y * 0.45, 0);
  camera.position.set(radius * 0.72, y + radius * 0.42, radius * 0.78);
  controls.target.copy(target);
  controls.update();

  document.getElementById('infoName').textContent = v.name;
  document.getElementById('infoDesc').textContent = v.desc;
  document.getElementById('infoRef').textContent = v.ref;
  document.querySelectorAll('.btn').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
}

// ---------- UI ----------
const dock = document.getElementById('dock');
for (const v of VIEWS) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = v.name;
  b.dataset.id = v.id;
  b.onclick = () => setView(v.id);
  dock.appendChild(b);
}

// ---------- 循环 ----------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

setView('scene');
const loading = document.getElementById('loading');
loading.style.opacity = '0';
setTimeout(() => loading.remove(), 600);
