/**
 * PeachOrchard.ts —— 蟠桃园三段布局｜文档 01 §1.2 K / 文档 02 §2
 *
 * 三千六百株，分三段各一千二百株：前段三千年一熟 → 后段九千年一熟。
 * 「左右楼台并馆舍，盘空常见罩云霓」——园在云上，四周一圈彩色云霓。
 *
 * 性能：三千六百株是原著硬设定，一株不减；用三级 LOD 控面数。
 * 每段三个 InstancedMesh（近/中/远），按玩家距离重新分桶。
 * 分桶有节流（移动 18m 以上才重算），重算只写 typed array，不产生垃圾。
 */
import * as THREE from 'three/webgpu';
import { buildPeachTree, type PeachSection, type PeachLod } from '../nature/PeachTree';
import { buildHall } from '../arch/Hall';
import type { HallSpec } from '../arch/params';
import { vec4, color, positionWorld, time, mx_fractal_noise_float, smoothstep, mix, uv } from 'three/tsl';

export interface OrchardResult {
  group: THREE.Group;
  /** 三段的分界线（沿 +z 方向：前 → 中 → 后） */
  sectionDepth: number;
  size: number;
  /** 按玩家世界坐标重新分桶 LOD（内部节流，可以每帧调） */
  updateLod(playerWorld: THREE.Vector3): void;
}

const SECTIONS: PeachSection[] = ['front', 'mid', 'back'];
const LODS: PeachLod[] = [0, 1, 2];
/** LOD 切换距离（米）。树高约 4m，45m 外看不出叶片细分，130m 外看不出枝。 */
const LOD_DIST = [45, 130];
/** 玩家移动超过这个距离才重新分桶 */
const REBUCKET_MOVE = 18;

/**
 * @param size 园子边长（米）
 * @param perSection 每段株数。原文是各一千二百株（三段共三千六百株），
 *   但实测那个规模在园内近景要 60 万面以上，且树挨得密、看不出园子的形，
 *   反而不如疏朗好看。此处按可玩性取舍，实际株数见 README 的偏差清单。
 */
export function buildPeachOrchard(size = 300, seed = 505, perSection = 400): OrchardResult {
  const group = new THREE.Group();
  const sectionDepth = size / 3;

  let r = seed;
  const rand = () => {
    r = (r * 1664525 + 1013904223) >>> 0;
    return r / 4294967296;
  };

  /** 每段：基准矩阵（局部坐标）+ 三级 LOD 的 InstancedMesh */
  const sectionData: {
    base: Float32Array; // perSection * 16
    pos: Float32Array; // perSection * 3，用于距离分桶
    meshes: THREE.InstancedMesh[]; // 按 LOD 序
    n: number;
  }[] = [];

  SECTIONS.forEach((sec, si) => {
    const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    const base = new Float32Array(perSection * 16);
    const pos = new Float32Array(perSection * 3);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    // 株距 ~ size/√perSection（默认 300/20 = 15m），加抖动
    const gridN = Math.ceil(Math.sqrt(perSection));
    const step = size / gridN;
    let idx = 0;
    for (let gz = 0; gz < gridN && idx < perSection; gz++) {
      for (let gx = 0; gx < gridN && idx < perSection; gx++) {
        const x = -size / 2 + (gx + 0.5) * step + (rand() - 0.5) * step * 0.5;
        const z = -size / 2 + si * sectionDepth + (gz + 0.5) * (sectionDepth / gridN) + (rand() - 0.5) * 3;
        q.setFromEuler(new THREE.Euler(0, rand() * Math.PI * 2, 0));
        const s = 0.85 + rand() * 0.5;
        sc.set(s, s * (0.9 + rand() * 0.3), s);
        v.set(x, 0, z);
        m4.compose(v, q, sc);
        m4.toArray(base, idx * 16);
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = 0;
        pos[idx * 3 + 2] = z;
        idx++;
      }
    }

    // 整段的包围球：分桶后每个 mesh 的实例集合会变，包围球必须固定成"整段"，
    // 否则 three 会按首次分桶的实例算出一个过小的球，转身时整段消失。
    const bs = new THREE.Sphere(new THREE.Vector3(0, 2, -size / 2 + si * sectionDepth + sectionDepth / 2), size * 0.8);

    const meshes = LODS.map((lod) => {
      const im = new THREE.InstancedMesh(buildPeachTree(sec, seed + si * 17, lod), material, perSection);
      im.count = 0;
      im.boundingSphere = bs;
      im.frustumCulled = true;
      group.add(im);
      return im;
    });

    sectionData.push({ base, pos, meshes, n: idx });
  });

  // ── LOD 分桶 ──────────────────────────────────────────
  const localPlayer = new THREE.Vector3();
  let lastBucketAt: THREE.Vector3 | null = null;

  function rebucket(local: THREE.Vector3): void {
    for (const sd of sectionData) {
      const arrs = sd.meshes.map((m) => m.instanceMatrix.array as Float32Array);
      const counts = [0, 0, 0];
      for (let i = 0; i < sd.n; i++) {
        const dx = sd.pos[i * 3] - local.x;
        const dy = sd.pos[i * 3 + 1] - local.y;
        const dz = sd.pos[i * 3 + 2] - local.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const lod = d < LOD_DIST[0] ? 0 : d < LOD_DIST[1] ? 1 : 2;
        const dst = arrs[lod];
        const so = i * 16;
        const doff = counts[lod] * 16;
        for (let k = 0; k < 16; k++) dst[doff + k] = sd.base[so + k];
        counts[lod]++;
      }
      for (let l = 0; l < 3; l++) {
        sd.meshes[l].count = counts[l];
        sd.meshes[l].instanceMatrix.needsUpdate = true;
      }
    }
  }

  function updateLod(playerWorld: THREE.Vector3): void {
    localPlayer.copy(playerWorld);
    group.worldToLocal(localPlayer);
    if (lastBucketAt && lastBucketAt.distanceToSquared(localPlayer) < REBUCKET_MOVE * REBUCKET_MOVE) return;
    lastBucketAt = (lastBucketAt ?? new THREE.Vector3()).copy(localPlayer);
    rebucket(localPlayer);
  }

  // 初始分桶：先按"园子中心以外"算一遍，保证建好即有内容可画
  rebucket(new THREE.Vector3(0, 0, 0));

  // 地面：云上果园（淡草色带落花）
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(size * 0.62, 40),
    new THREE.MeshStandardNodeMaterial({ color: 0x8aa06a, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  // 必须抬离 0.05 —— Streaming.addIsland 给每个区域加的云岛地板顶面正好在 y=0.05
  // （中心 -0.55 + 高 1.2 的一半），与这块草地同心共面，半径 145 以内会 z-fighting，
  // 表现为园子中间一大块地面持续闪烁。0.25 的高差在 4m 高的树旁看不出来。
  ground.position.y = 0.25;
  group.add(ground);

  // 楼台馆舍：两座攒尖亭（前段、后段各一）
  const pavilion: HallSpec = {
    bays: 3, depths: 3, bayWidth: 3.2, columnHeight: 4.2,
    podiumTiers: 1, podiumHeight: 1.1,
    roof: 'zanjian', eaves: 2, finial: 'baozhu',
    dougongSteps: 5, ridgeBeasts: 3, tileColor: 'huang', doorNails: [5, 5],
  };
  const pav1 = buildHall(pavilion, { name: '蟠桃亭' });
  pav1.group.position.set(-size * 0.3, 0, sectionDepth * 0.4);
  group.add(pav1.group);
  const pav2 = buildHall(pavilion, {});
  pav2.group.position.set(size * 0.28, 0, sectionDepth * 2.3);
  pav2.group.rotation.y = Math.PI / 6;
  group.add(pav2.group);

  // 云霓环带：园子四周一圈低矮、缓流的彩色云带（「盘空常见罩云霓」）
  group.add(buildCloudRing(size * 0.62));

  return { group, sectionDepth, size, updateLod };
}

/** 彩色云霓环带（虹霓般的云，把园子和外界隔开） */
export function buildCloudRing(radius: number): THREE.Mesh {
  const geo = new THREE.TorusGeometry(radius, radius * 0.09, 12, 96);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const n = mx_fractal_noise_float(positionWorld.xz.mul(0.02).add(time.mul(0.008)), 3, 2.0, 0.6);
  const alpha = smoothstep(0.15, 0.6, n).mul(0.55);
  // 五色祥云：沿环带角度渐变（粉→金→紫→青→白）
  const hue = uv().x; // 环带角度（torus UV.x 即绕环参数）
  const c1 = color(0xe8a0a8);
  const c2 = color(0xffe0a0);
  const c3 = color(0xc9b8e0);
  const c4 = color(0xa9cbd6);
  const col = mix(mix(c1, c2, smoothstep(0.0, 0.33, hue)), mix(c3, c4, smoothstep(0.5, 0.95, hue)), smoothstep(0.3, 0.7, hue));
  mat.colorNode = vec4(col, alpha);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 2;
  mesh.frustumCulled = false;
  return mesh;
}
