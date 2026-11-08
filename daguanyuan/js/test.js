// 構件試裝：獨立驗證屋頂、殿宇、大門、遊廊、亭、橋、牌坊、月洞門
import * as THREE from 'three';
import { P } from './palette.js';
import { uniforms, makeSky } from './materials.js';
import { GeoBuilder } from './geo.js';
import { hall, gateHouse, chuihuaMen, corridor, pavilion, pailou, bridge, yuedongMen, yingbi, wallRun, rockery } from './parts.js';

const qp = new URLSearchParams(location.search);
const log = document.getElementById('log');
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: qp.has('still') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.fogColor);
scene.add(makeSky());
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.2, 2000);

scene.add(new THREE.HemisphereLight(0xdfe8ea, 0x6b6455, 1.25));
const sun = new THREE.DirectionalLight(P.sunColor, 1.5);
sun.position.set(60, 110, 80);
scene.add(sun);

// 地面
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshLambertMaterial({ color: 0x9a978d })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

let err = '';
try {
  const gb = new GeoBuilder('test');

  // 一等：省親正殿（廡殿 + 和璽 + 須彌座 + 綠琉璃剪邊）
  hall(gb, { x: -70, z: 0, bays: 5, bayW: 5.6, depth: 13, rank: 1, roofType: 'wudian', name: '顧恩思義', couplet: ['座上珠璣昭日月', '堂前黼黻煥煙霞'], veranda: true });
  // 二等：榮禧堂（硬山 + 旋子）
  hall(gb, { x: -20, z: 0, bays: 5, bayW: 4.6, depth: 10, rank: 2, roofType: 'yingshan', name: '榮禧堂', enterable: true });
  // 二等歇山
  hall(gb, { x: 24, z: 0, bays: 3, bayW: 4.6, depth: 9, rank: 2, roofType: 'xieshan', name: '榮慶堂', porch: true });
  // 三等卷棚（園中軒館）
  hall(gb, { x: 60, z: 0, bays: 3, bayW: 4.0, depth: 7, rank: 3, roofType: 'juanpeng', name: '瀟湘館', couplet: ['寶鼎茶閒煙尚綠', '幽窗棋罷指猶涼'] });
  // 三等懸山
  hall(gb, { x: 92, z: 0, bays: 3, bayW: 3.8, depth: 6.5, rank: 3, roofType: 'xuanshan', name: '藕香榭' });
  // 四等茅茨（稻香村）
  hall(gb, { x: 120, z: 0, bays: 3, bayW: 3.4, depth: 6, rank: 4, roofType: 'xuanshan', thatch: true, name: '稻香村', wallColor: P.huangni, wallCh: 'earth' });
  // 樓
  hall(gb, { x: -120, z: 0, bays: 5, bayW: 4.8, depth: 10, rank: 2, roofType: 'xieshan', storey: 2, name: '天香樓' });

  // 大門
  gateHouse(gb, { x: -70, z: 50, bays: 3, bayW: 5.0, depth: 7, rank: 2, name: '敕造榮國府', lions: true });
  // 垂花門
  chuihuaMen(gb, { x: -20, z: 50 });
  // 影壁
  yingbi(gb, { x: 20, z: 50 });
  // 月洞門 + 院牆
  wallRun(gb, { x0: 50, z0: 50, x1: 66, z1: 50 });
  yuedongMen(gb, { x: 70, z: 50 });
  wallRun(gb, { x0: 74, z0: 50, x1: 92, z1: 50 });
  // 亭
  pavilion(gb, { x: 118, z: 50, r: 3.4, name: '滴翠亭', couplet: ['繞堤柳借三篙翠', '隔岸花分一脈香'] });
  // 牌坊
  pailou(gb, { x: -120, z: 50, w: 13, h: 9 });
  // 遊廊
  corridor(gb, [[-100, -40], [-60, -40], [-60, -10]]);
  // 橋
  bridge(gb, { a: [0, -50], b: [0, -20], w: 5, rise: 2.6 });
  // 假山
  rockery(gb, 30, -40, 1.4, 7);

  const g = gb.emit(scene, { cull: false });
  let tris = 0;
  g.children.forEach((m) => { tris += m.geometry.index.count / 3; });
  log.textContent = `channels=${g.children.length} tris=${tris | 0}`;
} catch (e) {
  err = e.stack || String(e);
  log.textContent = 'ERR ' + err;
  console.error(e);
}

const cx = parseFloat(qp.get('x') ?? '-20');
const cy = parseFloat(qp.get('y') ?? '14');
const cz = parseFloat(qp.get('z') ?? '45');
const tx = parseFloat(qp.get('tx') ?? '-20');
const ty = parseFloat(qp.get('ty') ?? '6');
const tz = parseFloat(qp.get('tz') ?? '0');
camera.position.set(cx, cy, cz);
camera.lookAt(tx, ty, tz);

const clock = new THREE.Clock();
if (qp.has('still')) {
  // 截圖模式：渲數幀後停止 rAF（持續迴圈會耗盡 Chrome 的 virtual-time budget）
  uniforms.uTime.value = 1.5;
  let n = 0;
  const once = () => { renderer.render(scene, camera); if (++n < 4) requestAnimationFrame(once); else document.title = 'ready'; };
  once();
} else {
  const tick = () => {
    requestAnimationFrame(tick);
    uniforms.uTime.value += clock.getDelta();
    renderer.render(scene, camera);
  };
  tick();
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
window.TEST = { scene, camera, renderer, err };
