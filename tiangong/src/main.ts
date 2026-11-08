/**
 * main.ts —— 引导与主装配｜文档 02 §2 / §6.4
 *
 * 阶段 0：壳 + loading + AudioContext 预备
 * 阶段 1：出生区域（齐天府 + 蟠桃园）+ 天空 + 云海 → 「入天门」按钮亮起
 * 阶段 2–3：后台生成主轴与其余区域
 */
import * as THREE from 'three/webgpu';
import { Renderer } from './core/Renderer';
import { Loop } from './core/Loop';
import { QualityManager, detectTier } from './core/Quality';
import { store, isLoreVisited } from './core/Store';
import { createAtmosphere, applyHeightFog } from './fx/Sky';
import { buildCloudSea } from './gen/nature/CloudSea';
import { buildMotes } from './fx/Motes';
import { buildRibbon } from './fx/Ribbon';
import { FlightController } from './player/FlightController';
import { CameraRig } from './player/Camera';
import { Collision } from './player/Collision';
import { buildWukong } from './player/Avatar';
import { NpcManager } from './npc/NpcManager';
import { DialogueEngine, type DialogueEvents } from './dialogue/DialogueEngine';
import type { DialogueFile } from './dialogue/types';
import { VoiceBank } from './dialogue/VoiceBank';
import { AudioCore } from './audio/AudioCore';
import { SpatialAudio, bellSource, pestleSource, furnaceSource, strikeBell } from './audio/Spatial';
import { Music } from './audio/Music';
import { Hud } from './ui/Hud';
import { MapUI } from './ui/Map';
import { DialogueBox } from './ui/DialogueBox';
import { Annotation, type AnnotationEntry } from './ui/Annotation';
import { SettingsPanel } from './ui/Settings';
import { loadLoreSites, type LoreSite } from './lore/LoreSites';
import { LoreEngine } from './lore/LoreEngine';
import { buildLoreMarker, setMarkerVisited } from './lore/LoreMarker';
import { UI_CSS } from './ui/style';
import { LayerManager, PLACES, LAYERS, placeAt, layerAtY } from './world/Layers';
import { Streaming } from './world/Streaming';
import type { GameCtx, Interactable } from './world/Region';

// 对话 yaml（构建时编译为 JSON，文档 02 §8.2）
const DIALOGUES = import.meta.glob<{ default: DialogueFile }>('/content/dialogue/*.yaml', { eager: true });
function dialogueFile(npcId: string): DialogueFile | null {
  const key = `/content/dialogue/${npcId}.yaml`;
  return DIALOGUES[key]?.default ?? null;
}

async function boot(): Promise<void> {
  const statusEl = document.getElementById('boot-status')!;
  const enterBtn = document.getElementById('boot-enter') as HTMLButtonElement;
  const settingsBtn = document.getElementById('boot-settings') as HTMLButtonElement;
  const say = (s: string) => (statusEl.textContent = s);

  // ── UI 样式与面板（loading 页即可访问设置，文档 02 §4.4） ──
  const styleEl = document.createElement('style');
  styleEl.textContent = UI_CSS;
  document.head.append(styleEl);
  const uiRoot = document.body;
  const settingsPanel = new SettingsPanel(uiRoot);
  settingsBtn.addEventListener('click', () => settingsPanel.toggle());

  // ── 渲染器 ──
  const app = document.getElementById('app')!;
  const r = new Renderer();
  const renderer = await r.init(app);
  QualityManager.applyPreset(detectTier(r.backend));
  console.info(`[tiangong] backend=${r.backend} tier=${QualityManager.current.tier}`);

  const scene = new THREE.Scene();
  const cameraRig = new CameraRig(innerWidth / innerHeight);
  const camera = cameraRig.camera;

  // ── 大气 ──
  const atm = createAtmosphere(store.get('settings').sunPreset);
  scene.add(atm.sky);
  applyHeightFog(scene, atm, { density: 0.0009, baseY: 30, falloff: 0.006, inscatter: 0.32 });

  const sun = new THREE.DirectionalLight(0xffd9a0, 3.6);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xd8c8e8, 0xf5f2ea, 1.1);
  scene.add(hemi);
  function syncSun(): void {
    const d = atm.sunDirection.value as THREE.Vector3;
    sun.position.copy(d).multiplyScalar(1000);
    sun.color.copy(atm.sunColor.value as THREE.Color);
  }
  syncSun();
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(atm.sky.geometry, atm.sky.material));
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.85;
    pmrem.dispose();
  } catch {
    console.warn('[env] PMREM 不可用');
  }
  store.on('settings', (s) => {
    atm.applyPreset(s.sunPreset);
    syncSun();
  });

  // ── 云海：每层一片 + 最深处的下界云海 ──
  // 文档 03 §3.3：灵霄金顶露出、蟠桃园开洞、斩妖台压厚云
  // 只显示当前层 ± 相邻层的云海（性能：透明大平面是全屏 overdraw 大头）
  const cloudSeas: { mesh: THREE.Mesh; y: number; always?: boolean }[] = [];
  const addCloud = (mesh: THREE.Mesh, y: number, always = false): void => {
    cloudSeas.push({ mesh, y, always });
    scene.add(mesh);
  };
  addCloud(buildCloudSea({ baseY: -60, size: 9000, layers: 10, density: 1 }), -60, true); // 下界
  addCloud(buildCloudSea({ baseY: LAYERS[2].cloudY, size: 4200, layers: 8, holes: [
    { x: 0, z: -230, radius: 260, amount: -0.42 }, // 灵霄宝殿金顶露出（导航地标）
    { x: 390, z: -270, radius: 150, amount: 0.4 }, // 斩妖台压厚云
  ] }), LAYERS[2].cloudY);
  addCloud(buildCloudSea({ baseY: LAYERS[3].cloudY, size: 2600, layers: 7, holes: [
    { x: 0, z: 90, radius: 300, amount: -0.48 }, // 蟠桃园上空开洞，阳光直射
    { x: 310, z: 90, radius: 130, amount: -0.4 }, // 齐天府
    { x: -290, z: -60, radius: 150, amount: -0.38 }, // 瑶池
  ] }), LAYERS[3].cloudY);
  addCloud(buildCloudSea({ baseY: LAYERS[4].cloudY, size: 2000, layers: 6, tint: 'cold', centerX: -750, centerZ: -350, holes: [{ x: -750, z: -350, radius: 190, amount: -0.45 }] }), LAYERS[4].cloudY);
  addCloud(buildCloudSea({ baseY: LAYERS[5].cloudY, size: 1800, layers: 6, centerX: 460, centerZ: 260, density: 0.8, holes: [{ x: 460, z: 260, radius: 170, amount: -0.45 }] }), LAYERS[5].cloudY);

  // ── 流光（把空旷填满） ──
  scene.add(buildRibbon({ points: [new THREE.Vector3(-200, 180, 300), new THREE.Vector3(0, 200, 100), new THREE.Vector3(200, 170, -100), new THREE.Vector3(100, 190, -350)], width: 3, color: 0xffe0a0, color2: 0xc9b8e0 }));
  scene.add(buildRibbon({ points: [new THREE.Vector3(300, 320, 300), new THREE.Vector3(100, 330, 100), new THREE.Vector3(-200, 310, 0), new THREE.Vector3(-350, 325, -150)], width: 2.4, color: 0xe8a0a8, color2: 0xa9cbd6, speed: 0.015 }));

  // ── 灵光浮尘（跟随玩家） ──
  const motes = buildMotes({ count: QualityManager.current.particles });
  scene.add(motes);

  // ── 玩家 ──
  const flight = new FlightController();
  const SPAWN = new THREE.Vector3(310, 280.05, 78); // 齐天府院子（蟠桃园右首），出生即落地
  flight.state.pos.copy(SPAWN);
  flight.state.yaw = Math.PI * 0.75;
  flight.state.grounded = true;
  const avatar = buildWukong();
  scene.add(avatar);

  const collision = new Collision();
  /** 五层云面高度（可站立的软地板），由低到高 */
  const CLOUD_SURFACES = Object.values(LAYERS)
    .map((l) => l.cloudY + 14)
    .sort((a, b) => a - b);
  collision.groundY = (_x, y, _z) => {
    // 「脚下那层云面」= 不高于当前高度的最高一层云面。
    // 原先按 layerAtY 取「最近那层」的云面，于是本层云面会高过层间分界线
    // （第三层云面 248 > 二三层分界 210），五层就成了只能上不能下；
    // 而且一旦穿到云面以下，那层云面还会把你往上吸回去。
    let best = -Infinity;
    for (const s of CLOUD_SURFACES) if (s <= y + 0.5 && s > best) best = s;
    return best;
  };

  // ── 音频 ──
  const audio = new AudioCore();
  audio.init();
  const voice = new VoiceBank(audio);
  const spatial = new SpatialAudio(audio, camera);
  const music = new Music(audio);

  // ── UI ──
  const hud = new Hud(uiRoot);
  const minimap = new MapUI(uiRoot);
  const dialogueBox = new DialogueBox(uiRoot);
  const annotation = new Annotation(uiRoot);

  // 画质自动降档要真的生效：至少把渲染分辨率与粒子跟着降下来
  QualityManager.onChange = (q) => {
    r.setSize();
    motes.visible = q.particles > 0;
  };

  // ── 事件与上下文 ──
  const npcs = new NpcManager();
  const interactables: Interactable[] = [];
  const eventHandlers = new Map<string, ((data?: unknown) => void)[]>();
  const ephemeral: { obj: THREE.Object3D; until: number }[] = [];
  const ctx: GameCtx = {
    scene,
    npcs,
    collision,
    interactables,
    events: {
      emit(name, data) {
        for (const fn of eventHandlers.get(name) ?? []) fn(data);
        if (name === 'pick-peach' && typeof data === 'string') {
          hud.setPrompt(data);
          setTimeout(() => hud.setPrompt(null), 4200);
        }
      },
      on(name, fn) {
        const arr = eventHandlers.get(name) ?? [];
        arr.push(fn);
        eventHandlers.set(name, arr);
      },
    },
    audio: {
      playBell(pos) {
        void pos;
        strikeBell(audio, 160);
      },
      playDrum() {
        strikeBell(audio, 82);
      },
    },
    addEphemeral(obj, ttlMs) {
      scene.add(obj);
      ephemeral.push({ obj, until: performance.now() + ttlMs });
    },
  };

  // ── 「书中此处」剧情点 ──
  const loreSites = loadLoreSites();
  const loreMarkers = new Map<string, THREE.Group>();
  const loreEngine = new LoreEngine(voice, dialogueBox, audio, {
    onSource: (site) => annotation.show(loreAnnotations(site)),
    onVisited: (site) => {
      const m = loreMarkers.get(site.id);
      if (m) setMarkerVisited(m, true);
      minimap.setLore(loreSites, store.get('visitedLore'));
    },
  });
  for (const site of loreSites) {
    const m = buildLoreMarker(site, isLoreVisited(site.id));
    scene.add(m);
    loreMarkers.set(site.id, m);
    interactables.push({
      id: `lore-${site.id}`,
      position: site.position.clone(),
      radius: 14,
      prompt: '听书中此处',
      cooldown: 500,
      action: () => void loreEngine.start(site).catch((e) => console.error('[lore]', e)),
    });
  }
  minimap.setLore(loreSites, store.get('visitedLore'));

  // ── 世界生成（初始只建出生区域，其余按距离懒加载，文档 02 §6.2） ──
  const streaming = new Streaming(ctx);
  say('正在起齐天府……');
  await streaming.buildInitial(say);
  say('云海已铺就。');

  //  positional loops（解锁后挂载）
  let audioHooksMounted = false;
  function mountAudioHooks(): void {
    if (audioHooksMounted) return;
    audioHooksMounted = true;
    spatial.startWind();
    void music.start();
    // 捣药声（广寒宫玉兔）/ 炉火（兜率宫）/ 金钟远闻
    const yutu = npcs.get('yutu');
    if (yutu) spatial.attachLoop(yutu.group, pestleSource, { refDistance: 6, maxDistance: 200, gain: 0.9 });
    const furnace = new THREE.Object3D();
    furnace.position.set(466, 560, 284);
    scene.add(furnace);
    spatial.attachLoop(furnace, furnaceSource, { refDistance: 10, maxDistance: 300, gain: 0.8 });
    const bell = new THREE.Object3D();
    bell.position.set(-12, 143, 166);
    scene.add(bell);
    spatial.attachLoop(bell, (c) => bellSource(c, 160), { refDistance: 60, maxDistance: 3000, rolloff: 0.5, gain: 0.12 });
    // 巽位风声彩蛋（八卦炉东南位，只有站到那里才听得见 —— 文档 04 §5.1）
    const xun = new THREE.Object3D();
    xun.position.set(464.9, 561.8, 285.2);
    scene.add(xun);
    spatial.attachLoop(xun, (c) => {
      // 尖细的风哨：窄带噪声（缓冲内已成型，直接输出）
      const len = c.sampleRate * 3;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        lp += (w - lp) * 0.3;
        d[i] = lp * Math.sin((i / len) * Math.PI * 2 * 2) * 0.8;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      return src;
    }, { refDistance: 1.5, maxDistance: 40, gain: 1 });
  }

  // ── 输入 ──
  const canvas = renderer.domElement;
  let pointerLocked = false;
  canvas.addEventListener('click', () => {
    if (!pointerLocked && entered) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (pointerLocked && !store.get('inDialogue')) {
      flight.lookDX += e.movementX;
      flight.lookDY += e.movementY;
    }
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (loreEngine.active) loreEngine.abort();
      else if (minimap.open) minimap.close();
      else settingsPanel.toggle();
      return;
    }
    if (e.code === 'KeyM' && !store.get('inDialogue')) {
      minimap.toggle();
      return;
    }
    if (e.code === 'KeyC' && !store.get('inDialogue')) cameraRig.toggleFirstPerson();
    flight.keys.add(e.code);
  });
  addEventListener('keyup', (e) => flight.keys.delete(e.code));

  // 移动端虚拟摇杆
  setupTouchSticks(flight);

  // ── 对话引擎 ──
  const engine = new DialogueEngine(voice);
  let dialogueNpc: string | null = null;
  const engineEvents: DialogueEvents = {
    onLine: (line, speaker) => {
      dialogueBox.showLine(line, speaker);
      const npc = dialogueNpc ? npcs.get(dialogueNpc) : null;
      if (npc) npc.talking = line.speaker === 'npc';
    },
    onTopics: (topics) => dialogueBox.setTopics(topics),
    onTopicList: () => void 0,
    onEnd: () => {
      dialogueBox.close();
      if (dialogueNpc) {
        const n = npcs.get(dialogueNpc);
        if (n) n.talking = false;
      }
      dialogueNpc = null;
      cameraRig.exitDialogue();
      audio.restoreAfterDialogue();
    },
    onTalking: () => void 0,
    onSource: (source) => {
      annotation.show([{ title: '出处', source, body: '该话题原文见上回目。' }]);
    },
  };
  dialogueBox.handlers(
    (goto) => void engine.choose(goto, engineEvents),
    (line) => {
      annotation.show([{ title: '原文直引', source: '见考据栏白名单', body: line.text }]);
      if (!annotation['openState' as never]) annotation.toggleOpen();
    },
  );
  engine.onTopicDone = (npcId, topicId) => {
    // 通明殿递本 → 天师引奏 → 灵霄殿准入（文档 01 §1.3）
    if (topicId === 'yinzou' && ['zhang-daoling', 'ge-xianweng', 'xu-jingyang', 'qiu-hongji'].includes(npcId)) {
      store.set('lingxiaoAdmitted', true);
      hud.setPrompt('天师已引奏。灵霄殿门，为你开了。');
      setTimeout(() => hud.setPrompt(null), 5000);
    }
  };

  async function startDialogue(npcId: string): Promise<void> {
    const file = dialogueFile(npcId);
    const npc = npcs.get(npcId);
    if (!file || !npc) return;
    dialogueNpc = npcId;
    // 悟空分片随该 NPC 所在区域（文档 04 §8.1：当前片 + 通用片驻留）
    const SHARD: Record<string, string> = {
      nantianmen: 'wukong-tianmen', dongtianmen: 'wukong-tianmen', xitianmen: 'wukong-tianmen', beitianmen: 'wukong-tianmen', tianhe: 'wukong-tianmen',
      pantaoyuan: 'wukong-neiyuan', 'qitian-fu': 'wukong-neiyuan', yaochi: 'wukong-neiyuan',
      guanghangong: 'wukong-shangceng', doushuaigong: 'wukong-shangceng',
    };
    engine.wukongPack = SHARD[npc.def.region] ?? 'wukong-gongcheng';
    cameraRig.enterDialogue(flight.state.pos, npc.group.position, flight.state.yaw);
    audio.duckForDialogue();
    dialogueBox.open();
    void voice.prefetch([npcId, engine.wukongPack, 'wukong-common', 'narrator']);
    document.exitPointerLock?.();
    await engine.start(npcId, file, engineEvents);
  }

  // ── 主循环 ──
  const loop = new Loop();
  let entered = false;
  let currentRegion = '';
  let currentLayer = 3;
  let streamTimer = 1; // 立即触发第一次流式检查
  const layerMgr = new LayerManager(scene);
  void layerMgr;
  const fwdDir = new THREE.Vector3(); // 前瞻射线方向（复用，热路径不分配）
  /** 玩家碰撞半径：resolve 的推出量与 groundProbe 的落地面必须用同一个值 */
  const PLAYER_RADIUS = 0.6;

  loop.onUpdate((dt) => {
    if (!entered) return;

    // 游戏日（18 分钟抽象周期，文档 01 §4）
    store.set('gameDay', (store.get('gameDay') + dt / 1080) % 1);

    if (!store.get('inDialogue')) {
      flight.update(dt);
      // 前瞻减速 + 地面探测（降落用）
      fwdDir.copy(flight.state.vel).normalize();
      flight.obstacleAhead = collision.raycastForward(flight.state.pos, fwdDir, 950);
      // 按住 X = 「我要下去」：穿过脚下云面落到下一层。最底层（天门）不放行，
      // 否则会一路掉出世界（下界没有实体）。实心建筑照常挡住，不会穿墙。
      const wantDown = flight.keys.has('KeyX') || flight.keys.has('ControlLeft');
      const solidY = collision.groundProbe(flight.state.pos, PLAYER_RADIUS, false);
      const cloudSurface = collision.groundY(flight.state.pos.x, flight.state.pos.y, flight.state.pos.z);
      // 脚下是云还是实地——决定按 X 能不能沉下去
      flight.groundIsSoft = cloudSurface > solidY;
      const sinking = wantDown && flight.groundIsSoft && layerAtY(flight.state.pos.y) > 1;
      flight.groundY = sinking ? solidY : Math.max(solidY, cloudSurface);
      // 墙体碰撞（同时清掉撞向墙面的速度分量，否则贴墙抖 + 脱离时弹射）
      const resolved = collision.resolve(flight.state.pos, PLAYER_RADIUS, flight.state.vel);
      flight.state.pos.copy(resolved);
      if (flight.state.grounded) flight.state.pos.y = Math.max(flight.state.pos.y, flight.groundY);
    }

    // LOD 分桶（蟠桃园三千六百株等；各自内部节流）
    streaming.updateLod(flight.state.pos);

    // 区域流式加载（每 0.5s）
    streamTimer += dt;
    if (streamTimer > 0.5) {
      streamTimer = 0;
      streaming.update(flight.state.pos);
      // 云海显隐：只显示相邻层
      for (const c of cloudSeas) {
        // 阈值必须小于层间距（130–158m），否则任何高度都能同时看到 ±2 层。
        // 云海是透明大平面、全屏 overdraw：实测高空同时可见 5 片时占掉 55ms/帧（77%）。
        // 下界云海（size 9000、层数最多）原本 always 常驻，但玩家在内苑以上时
        // 它早被上面几层云挡住，纯属白烧填充率 —— 改为只在下两层可见。
        const dy = Math.abs(c.y - flight.state.pos.y);
        c.mesh.visible = c.always ? flight.state.pos.y < 200 : dy < 170;
      }
    }

    // 区域检测
    const place = placeAt(flight.state.pos);
    if (place && place.id !== currentRegion) {
      currentRegion = place.id;
      store.set('region', place.id);
      hud.showRegion(place.name);
      music.apply(place.music);
      if (place.track) void music.setSceneTrack(place.track);
      else music.clearSceneTrack();
      spatial.setSpace(place.reverb);
      annotation.show(streaming.annotationsOf(place.id));
      streaming.enter(place.id);
      // 语音包按区域预取
      const ids = npcs.npcs.filter((n) => n.def.region === place.id).map((n) => n.def.id);
      if (ids.length) void voice.prefetch(ids);
    } else if (!place && currentRegion) {
      currentRegion = '';
      music.clearSceneTrack();
    }
    const layer = layerAtY(flight.state.pos.y);
    if (layer !== currentLayer) {
      currentLayer = layer;
      store.set('layer', layer);
      layerMgr.updateVisibility(layer);
    }

    // NPC 更新
    npcs.update(dt, performance.now() / 1000, flight.state.pos);

    // 区域 update
    if (currentRegion) streaming.updateRegion(currentRegion, dt, performance.now() / 1000);

    // 交互提示
    if (!store.get('inDialogue')) {
      const near = npcs.nearest(flight.state.pos);
      const nearIt = nearestInteractable(flight.state.pos);
      if (near && (!nearIt || nearIt.dist > near.dist)) {
        hud.setPrompt(`按 E · 与${near.npc.def.name}交谈`);
      } else if (nearIt) {
        hud.setPrompt(`按 E · ${nearIt.it.prompt}`);
        // 走近剧情点就后台备好说书语音（3.3MB），按 E 才能立刻出声
        if (nearIt.it.id.startsWith('lore-')) loreEngine.prewarm();
      } else {
        hud.setPrompt(null);
      }
    }

    // 风（音频，跟着逻辑步走即可）
    spatial.updateWind(flight.state.pos.y, flight.state.vel.length());

    // 临时对象回收
    const now = performance.now();
    for (let i = ephemeral.length - 1; i >= 0; i--) {
      if (now > ephemeral[i].until) {
        scene.remove(ephemeral[i].obj);
        ephemeral.splice(i, 1);
      }
    }
  });

  loop.onRender((dt, alpha) => {
    // 逻辑是 60Hz 定步长、渲染是可变帧率 —— 渲染层必须在 prev→state 之间插值，
    // 否则总有帧「不动」或「走两格」（60Hz 屏 13.7% 的帧，120Hz 屏近半）。
    const view = flight.sample(entered ? alpha : 1);

    // 化身跟随（插值位姿）
    avatar.position.copy(view.pos);
    avatar.rotation.y = view.yaw + Math.PI;
    avatar.visible = cameraRig.mode === 'third';
    avatar.rotation.x = Math.min(0.6, flight.state.vel.length() / 180) * 0.5; // 飞行姿态：前倾

    // 灵光跟随
    (motes as never as { setFollow: (v: THREE.Vector3) => void }).setFollow(view.pos);

    cameraRig.update(dt, view.pos, view.yaw, view.pitch, flight.fovOffset(), view.bank);
    hud.setYaw(view.yaw);
    hud.setSpeedLines(flight.state.boostK, store.get('settings').speedLines);
    minimap.update(view.pos, view.yaw);
    spatial.updateListener();
    r.render(true, scene, cameraRig.camera);
    // 自适应降档：必须用真实渲染帧时间（此前误传固定步长 16.67ms，判据永不成立）。
    // 区域后台生成期间不采样 —— 那是加载开销，不是稳态性能，不该换来永久降档。
    if (entered && !streaming.isBuilding) QualityManager.sampleFrame(dt * 1000);
    if (showFps) {
      fpsFrames++;
      fpsAccum += dt;
      if (fpsFrames >= 120) {
        console.info(`[fps] ${(fpsFrames / fpsAccum).toFixed(1)} tier=${QualityManager.current.tier} regions=${streaming.built.size}`);
        fpsFrames = 0;
        fpsAccum = 0;
      }
    }
  });

  addEventListener('resize', () => {
    cameraRig.camera.aspect = innerWidth / innerHeight;
    cameraRig.camera.updateProjectionMatrix();
    r.setSize();
  });

  r.buildPost(scene, cameraRig.camera, sun);
  renderer.setAnimationLoop((t) => loop.tick(t));
  cameraRig.snapBehind(SPAWN, flight.state.yaw);
  flight.resetInterpolation();
  const showFps = new URLSearchParams(location.search).has('fps');
  let fpsFrames = 0;
  let fpsAccum = 0;

  // ── 交互键 ──
  const cooldowns = new Map<string, number>();
  function nearestInteractable(pos: THREE.Vector3): { it: Interactable; dist: number } | null {
    let best: Interactable | null = null;
    let bd = Infinity;
    for (const it of interactables) {
      const d = it.position.distanceTo(pos);
      if (d < it.radius && d < bd) {
        bd = d;
        best = it;
      }
    }
    return best ? { it: best, dist: bd } : null;
  }
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || !entered) return;
    if (store.get('inDialogue')) return;
    // 全图是 z-index 55 的近乎不透明遮罩，对话框才 30：开着图触发交互，
    // 字幕会被整个盖住，而 M 键此时又被 inDialogue 挡住，只能连按两次 Esc 才出得来
    if (minimap.open) return;
    const near = npcs.nearest(flight.state.pos);
    const nearIt = nearestInteractable(flight.state.pos);
    if (near && (!nearIt || near.dist <= nearIt.dist)) {
      void startDialogue(near.npc.def.id);
    } else if (nearIt) {
      const cd = cooldowns.get(nearIt.it.id) ?? 0;
      if (performance.now() > cd) {
        cooldowns.set(nearIt.it.id, performance.now() + (nearIt.it.cooldown ?? 2000));
        nearIt.it.action(ctx);
      }
    }
  });

  // ── 入天门 ──
  enterBtn.disabled = false;
  enterBtn.addEventListener('click', async () => {
    say('');
    try {
      await Promise.race([audio.unlock(), new Promise((r) => setTimeout(r, 900))]);
    } catch {
      /* 无手势环境下跳过解锁 */
    }
    mountAudioHooks();
    document.getElementById('boot')!.classList.add('hidden');
    entered = true;
    store.set('region', 'qitian-fu');
    hud.showRegion('齐天大圣府');
    annotation.show(streaming.annotationsOf('qitian-fu'));
    canvas.requestPointerLock();
    console.info('[tiangong] 出生区域就绪，其余区域后台预热 + 按距离显隐');
    // 后台低速预热：玩家在附近活动时逐步生成全图（帧间让出，不阻塞操作）
    setTimeout(() => void streaming.warmUp(flight.state.pos), 2500);
  });

  // 开发用：?autoenter=1&pos=x,y,z&yaw=r 直接入场截图
  const qp = new URLSearchParams(location.search);
  if (qp.get('autoenter')) {
    const tryEnter = () => {
      if (!enterBtn.disabled) {
        enterBtn.click();
        const pos = qp.get('pos');
        if (pos) {
          const [x, y, z] = pos.split(',').map(Number);
          flight.state.pos.set(x, y, z);
        }
        if (qp.has('yaw')) flight.state.yaw = Number(qp.get('yaw'));
        if (qp.has('pitch')) flight.state.pitch = Number(qp.get('pitch'));
        flight.resetInterpolation();
        cameraRig.snapBehind(flight.state.pos, flight.state.yaw);
        if (qp.get('fp')) cameraRig.toggleFirstPerson();
        const talk = qp.get('talk');
        if (talk) setTimeout(() => void startDialogue(talk), 1500);
      } else {
        setTimeout(tryEnter, 500);
      }
    };
    setTimeout(tryEnter, 400);
  }

  (window as never as { __game: unknown }).__game = { flight, cameraRig, store, npcs, streaming, engine, renderer, scene, loop, avatar, minimap, lore: { sites: loreSites, engine: loreEngine, markers: loreMarkers } };
  (window as never as { __ready: boolean }).__ready = true;
}

/**
 * 「书中此处」听完后推给考据栏的条目。
 *
 * 必须把原文直引与说书人自撰转述分开：整段拼在一个〔出处〕下，等于让回目
 * 为自撰文字背书，抹平了字幕里逐行标注的粒度——而「凡原著没有的，明确标注」
 * 正是本作的底线（同 Annotation.ts 的 selfAuthored 字段本意）。
 */
function loreAnnotations(site: LoreSite): AnnotationEntry[] {
  const out: AnnotationEntry[] = [];
  const quoted = site.lines.filter((l) => l.quote).map((l) => l.text);
  const retold = site.lines.filter((l) => !l.quote).map((l) => l.text);
  if (quoted.length) {
    out.push({ title: `书中此处 · ${site.label}`, source: site.source, body: quoted.join('\n') });
  }
  if (retold.length) {
    out.push({
      title: quoted.length ? '说书人转述' : `书中此处 · ${site.label}`,
      body: retold.join('\n'),
      selfAuthored: true,
      // 情节出自原著，只是没用原文——与「原著无载」的自拟内容不是一回事
      selfAuthoredLabel: `说书人转述（情节见${site.source}，非原文）`,
    });
  }
  return out;
}

function setupTouchSticks(flight: FlightController): void {
  if (!(navigator.maxTouchPoints > 1 && !matchMedia('(pointer: fine)').matches)) return;
  for (const side of ['l', 'r'] as const) {
    const stick = document.createElement('div');
    stick.className = 'tg-stick tg-ui';
    stick.id = `tg-stick-${side}`;
    const nub = document.createElement('div');
    nub.className = 'nub';
    stick.append(nub);
    document.body.append(stick);
    let active = -1;
    const center = { x: 0, y: 0 };
    stick.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      active = t.identifier;
      const rect = stick.getBoundingClientRect();
      center.x = rect.left + rect.width / 2;
      center.y = rect.top + rect.height / 2;
      e.preventDefault();
    });
    stick.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== active) continue;
        const dx = (t.clientX - center.x) / 45;
        const dy = (t.clientY - center.y) / 45;
        const c = Math.min(1, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        const cx = Math.cos(a) * c;
        const cy = Math.sin(a) * c;
        nub.style.transform = `translate(calc(-50% + ${cx * 32}px), calc(-50% + ${cy * 32}px))`;
        if (side === 'l') {
          flight.stick.x = cx;
          flight.stick.y = cy;
        } else {
          flight.stickLook.x = cx;
          flight.stickLook.y = cy;
        }
      }
      e.preventDefault();
    });
    stick.addEventListener('touchend', () => {
      active = -1;
      nub.style.transform = 'translate(-50%,-50%)';
      if (side === 'l') {
        flight.stick.x = 0;
        flight.stick.y = 0;
      } else {
        flight.stickLook.x = 0;
        flight.stickLook.y = 0;
      }
    });
  }
  // 双击右摇杆区 = 加速
  let lastTap = 0;
  document.getElementById('tg-stick-r')!.addEventListener('touchstart', () => {
    const now = performance.now();
    if (now - lastTap < 350) {
      flight.keys.add('ShiftLeft');
      setTimeout(() => flight.keys.delete('ShiftLeft'), 1600);
    }
    lastTap = now;
  });
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('boot-status');
  if (el) el.textContent = '初始化失败：' + String(e).slice(0, 200);
});
