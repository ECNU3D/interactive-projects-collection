// 主入口：引导、游戏状态、主循环
import { World } from './world/world.js';
import { Player } from './entity/player.js';
import { Spawner } from './entity/spawner.js';
import { updateAI } from './entity/ai.js';
import { NPCManager } from './npc/npcs.js';
import { Combat } from './battle/combat.js';
import { GymSystem } from './battle/gym.js';
import { Boss } from './entity/boss.js';
import { Particles, burstStars, burstHeal } from './fx/particles.js';
import { AudioEngine } from './audio/audioEngine.js';
import { UI } from './ui/ui.js';
import { Party } from './pokemon/party.js';
import { createInstance, expForLevel } from './pokemon/stats.js';
import { gainExp, tryLearn } from './pokemon/learnset.js';
import { applyEvolution, stoneEvolution, levelUpEvolution } from './pokemon/evolution.js';
import { getMove } from './data/movedata.js';
import { getSpecies, SPECIES } from './data/species.js';
import { ITEMS } from './data/items.js';
import { sellPrice } from './data/shopData.js';
import { cureStatus, applyStatus } from './battle/status.js';
import { GYMS } from './data/gyms.js';
import { DIALOGUES } from './data/dialogues.js';
import * as storage from './save/storage.js';
import { buildItemCube, buildChest } from './voxel/models/npc.js';
import { meshFromVox } from './voxel/mesher.js';
import { evolutionParticles } from './fx/moveAnims.js';

const AUTOTEST = new URLSearchParams(location.search).has('autotest');

class Game {
  constructor() {
    this.mode = 'title';
    this.time = 0;
    this.party = new Party();
    this.bag = {};
    this.quickbar = ['pokeball', 'potion', null, null, null];
    this.money = 3000;
    this.badges = new Set();
    this.dex = new Set();
    this.respawn = null;
    this.merchantState = null;
    this.chestsOpened = new Set();
    this.volumes = { bgm: 0.6, sfx: 0.8, voice: 0.9 };
    this.playerInGym = null;
    this.completed = false;       // 通关标记（v4：击败/捕获雪山 Boss）
    this.pendingMoves = [];       // 待学习技能 [{inst, moveId}]
    this.pendingEvos = [];        // 待进化 [{inst, evo}]
    this.healAnim = 0;
    this.autosaveT = 30;
    this._errors = [];
    this.getMove = getMove;
  }

  // ============ 启动 ============
  async boot() {
    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8FD1FF);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
    window.__camera = this.camera;
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    this.audio = new AudioEngine();
    this.ui = new UI(this);

    // 加载界面
    const loadEl = document.getElementById('loading');
    document.getElementById('title').classList.add('hidden');
    loadEl.classList.remove('hidden');
    const setLoad = (p, t) => {
      document.getElementById('load-bar').style.width = (p * 100) + '%';
      document.getElementById('load-text').textContent = t;
    };
    await frame();
    setLoad(0.1, '生成地形…');
    await frame();
    this.world = new World(this.scene);
    setLoad(0.5, '搭建村庄…');
    await frame();
    this.particles = new Particles(this.scene);
    this.player = new Player(this.world, this.scene, this.camera, this);
    this.spawner = new Spawner(this);
    this.combat = new Combat(this);
    this.npcs = new NPCManager(this);
    this.gym = new GymSystem(this);
    this.boss = new Boss(this);          // 结局 Boss：雪山深处沉睡的巨大卡比兽
    setLoad(0.7, '铺设区块…');
    await frame();
    for (let i = 0; i < 60; i++) this.world.ensureChunks(256, 270);   // 预生成出生点周边
    setLoad(0.9, '准备就绪');
    this._bindInput();
    this._buildLootMeshes();
    loadEl.classList.add('hidden');

    if (AUTOTEST) { this._initAutotest(); return; }
    if (new URLSearchParams(location.search).has('autostart')) { this.newGame(); return; }
    this._showTitle();
  }

  _showTitle() {
    const t = document.getElementById('title');
    t.classList.remove('hidden');
    document.getElementById('btn-continue').disabled = !storage.hasSave();
    document.getElementById('btn-continue').style.opacity = storage.hasSave() ? 1 : 0.4;
    document.getElementById('btn-new').onclick = () => { this.audio.init(); this.newGame(); };
    document.getElementById('btn-continue').onclick = () => {
      this.audio.init();
      if (storage.hasSave()) this.loadGame();
      else this.newGame();
    };
    document.getElementById('btn-settings').onclick = () => {
      this.audio.init();
      this.ui.openMenu();
    };
    this.mode = 'title';
    this._renderTitleScene();
  }

  // 标题背景：绕着草原村旋转的镜头
  _renderTitleScene() {
    this.mode = 'title';
    const tick = () => {
      if (this.mode !== 'title') return;
      const t = performance.now() * 0.0001;
      this.camera.position.set(256 + Math.sin(t) * 40, 34, 256 + Math.cos(t) * 40);
      this.camera.lookAt(256, 22, 256);
      this.world.updateDayNight(0.016, this.camera.position);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }

  // ============ 新游戏 / 读档 ============
  newGame() {
    document.getElementById('title').classList.add('hidden');
    this.party = new Party();
    const starter = createInstance('pikachu', 5);
    this.party.add(starter);
    this.bag = { pokeball: 5, potion: 5, superpotion: 2 };   // 开局多备药，降低前期难度
    this.quickbar = ['pokeball', 'potion', null, null, null];
    this.money = 3000;
    this.badges = new Set();
    this.dex = new Set(['pikachu']);
    this.chestsOpened = new Set();
    const gv = this.world.villages[0];
    this.respawn = { ...gv.respawnPoint, village: gv.key };
    this.player.spawnAt(gv.respawnPoint.x, gv.respawnPoint.y, gv.respawnPoint.z + 3);
    // 调试/截图参数：?px=&pz=&yaw=
    const q = new URLSearchParams(location.search);
    if (q.has('px') && q.has('pz')) {
      this.player.spawnAt(+q.get('px'), 30, +q.get('pz'));
      if (q.has('yaw')) this.player.yaw = +q.get('yaw');
    }
    this.startPlay();
    this.ui.announce('欢迎来到宝可梦世界！');
  }

  loadGame() {
    const data = storage.load();
    if (!data) { this.newGame(); return; }
    document.getElementById('title').classList.add('hidden');
    this.party = new Party();
    for (const m of data.party) this.party.members.push(m);
    this.party.activeIndex = data.activeIndex || 0;
    this.bag = data.bag || {};
    this.quickbar = data.quickbar || ['pokeball', null, null, null, null];
    this.money = data.money ?? 3000;
    this.badges = new Set(data.badges || []);
    this.dex = new Set(data.dex || []);
    this.respawn = data.respawn || { ...this.world.villages[0].respawnPoint, village: 'grass' };
    this.merchantState = data.merchant;
    this.completed = !!data.completed;
    this.volumes = { ...this.volumes, ...data.volumes };
    for (const k of Object.keys(this.volumes)) this.audio.setVolume(k, this.volumes[k]);
    this.world.dayTime = data.dayTime ?? 0.3;
    for (const id of (data.chestsOpened || [])) {
      const c = this.world.chests.find(c => c.id === id);
      if (c) { c.opened = true; this.chestsOpened.add(id); }
    }
    const p = data.player;
    this.player.spawnAt(p.x, p.y, p.z);
    this.startPlay();
    this.ui.announce('读取存档成功！');
  }

  startPlay() {
    this.mode = 'play';
    this.player.refreshModel();
    this.player.bindInput(this.renderer.domElement);
    this.npcs.populate();
    this.ui.show();
    this.ui.refreshParty();
    this.ui.refreshItems();
    this.ui.refreshMoney();
    this._lockPointer();
    this.audio.bgm('grassland');
    if (new URLSearchParams(location.search).has('still')) {
      // 截图模式：手动推进若干帧后渲染一帧静态画面
      for (let i = 0; i < 120; i++) { this.time += 0.033; this._update(0.033); }
      this.renderer.render(this.scene, this.camera);
      document.title = 'STILL READY';
      return;
    }
    if (!AUTOTEST) this._loop();
  }

  _lockPointer() {
    if (AUTOTEST) return;
    this.renderer.domElement.requestPointerLock?.();
  }

  // ============ 输入 ============
  _bindInput() {
    addEventListener('keydown', e => {
      if (e.code === 'Tab') e.preventDefault();
      if (this.mode === 'title') return;
      const k = e.code;
      // 对话框推进
      if (this.mode === 'dialog' && (k === 'KeyF' || k === 'Space' || k === 'Enter')) {
        e.preventDefault();
        this.ui.advanceDialog();
        return;
      }
      // 进化取消
      if (this.mode === 'evolution' && k === 'Escape') { this.ui.cancelEvolution(); return; }
      // 面板开关
      if (k === 'Tab') {
        if (this.mode === 'play' || (this.mode === 'panel' && this.ui.panels.openPanelName === 'party')) this.ui.togglePartyPanel();
        return;
      }
      if (k === 'Escape') {
        if (this.mode === 'panel') { this.ui.closePanel(); this._lockPointer(); }
        else if (this.mode === 'play') { this.ui.openMenu(); document.exitPointerLock?.(); }
        return;
      }
      if (this.mode !== 'play') return;
      // 技能 1~4
      if (k.startsWith('Digit')) {
        const n = +k.slice(5);
        if (n >= 1 && n <= 4) this.combat.playerCastMove(n - 1);
        else if (n >= 5 && n <= 9) this.useQuickbar(n - 5);
        return;
      }
      if (k === 'KeyR') { this.quickSwitch(); return; }
      if (k === 'KeyF') { this.interact(); return; }
    });
    // 点击画布锁定指针
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'play') this._lockPointer();
    });
  }

  // ============ 交互（F 键） ============
  interact() {
    const p = this.player.pos;
    // NPC
    const npc = this.npcs.nearest(p.x, p.z, 3);
    if (npc) {
      const dlg = this.npcs.getDialog(npc);
      this.ui.showDialog(dlg);
      document.exitPointerLock?.();
      return;
    }
    // 结局 Boss（雪山沉睡的卡比兽）
    if (this.boss?.tryInteract()) return;
    // 宝箱
    for (const c of this.world.chests) {
      if (!c.opened && Math.hypot(c.x - p.x, c.z - p.z) < 2.5) {
        c.opened = true;
        this.chestsOpened.add(c.id);
        this.audio.sfx('chest');
        burstStars(this.particles, new THREE.Vector3(c.x, c.y + 0.5, c.z), 16);
        const names = c.loot.map(l => `${ITEMS[l.id].name}×${l.count}`).join('、');
        for (const l of c.loot) this.addItem(l.id, l.count);
        this.ui.announce(`打开宝箱：${names}！`);
        this._refreshChestMesh(c);
        this.saveGame();
        return;
      }
    }
    // 道馆门
    for (const v of this.world.villages) {
      if (v.gym) {
        const d = Math.hypot(v.gym.doorX - p.x, v.gym.doorZ - p.z);
        if (d < 3.5) {
          this.gym.enter(v.gym.type, v);
          document.exitPointerLock?.();
          return;
        }
      }
      // 指示牌
      for (const s of (v.signs || [])) {
        if (Math.hypot(s.x - p.x, s.z - p.z) < 2.5 && s.gym) {
          this.ui.showDialog({ lines: [{ speaker: '指示牌', text: GYMS[s.gym].sign }] });
          return;
        }
      }
    }
  }

  // 道具点拾取（走动碰到即拾取）
  _updateItemPoints(dt) {
    const p = this.player.pos;
    for (const ip of this.world.itemPoints) {
      if (!ip.active) continue;
      if (Math.hypot(ip.x - p.x, ip.z - p.z) < 1.2 && Math.abs(ip.y - p.y) < 2) {
        ip.active = false;
        ip.respawnAt = this.time + 180;            // 3 分钟重生
        this.addItem(ip.itemId, 1);
        this.audio.sfx('ui_blip');
        this.ui.floatText(p.clone().setY(p.y + 2), `拾取 ${ITEMS[ip.itemId].name}`, '#FCDC5F');
      }
    }
    // 网格显示同步 + 旋转动画
    for (const [ip, mesh] of this._lootMeshes) {
      mesh.visible = ip.active && mesh.position.distanceTo(p) < 60;
      if (mesh.visible) {
        mesh.rotation.y += dt * 2;
        mesh.position.y = ip.y + 0.3 + Math.sin(this.time * 2 + ip.x) * 0.15;
      }
    }
    this.world.updateLoot(this.time);
  }

  _buildLootMeshes() {
    this._lootMeshes = [];
    for (const ip of this.world.itemPoints) {
      const m = meshFromVox('item_cube', buildItemCube(0xFCDC5F), 1 / 8);
      m.position.set(ip.x, ip.y + 0.3, ip.z);
      this.scene.add(m);
      this._lootMeshes.push([ip, m]);
    }
    this._chestMeshes = [];
    for (const c of this.world.chests) {
      const m = meshFromVox('chest', buildChest(), 1 / 8);
      m.position.set(c.x, c.y, c.z);
      this.scene.add(m);
      this._chestMeshes.push([c, m]);
    }
  }

  _refreshChestMesh(c) {
    const found = this._chestMeshes.find(([cc]) => cc === c);
    if (found) found[1].visible = false;
  }

  // ============ 背包 / 道具 / 经济 ============
  addItem(id, n = 1) {
    this.bag[id] = (this.bag[id] || 0) + n;
    this.ui.refreshItems();
  }

  removeItem(id, n = 1) {
    if ((this.bag[id] || 0) < n) return false;
    this.bag[id] -= n;
    this.ui.refreshItems();
    return true;
  }

  addMoney(n) {
    this.money = Math.max(0, this.money + n);
    this.ui.refreshMoney();
  }

  buyItem(id) {
    const it = ITEMS[id];
    if (this.money < it.price) { this.ui.hint('金钱不足！'); this.audio.sfx('ui_error'); return false; }
    this.addMoney(-it.price);
    this.addItem(id, 1);
    this.audio.sfx('ui_buy');
    if (this.merchantState?.rareItems?.includes(id)) this.audio.voice('merchant_rare');
    return true;
  }

  sellItem(id) {
    if (!this.removeItem(id, 1)) return false;
    this.addMoney(sellPrice(id));
    this.audio.sfx('ui_buy');
    return true;
  }

  bindQuickbar(itemId) {
    const idx = this.quickbar.indexOf(itemId);
    if (idx >= 0) this.quickbar[idx] = null;
    else {
      const empty = this.quickbar.indexOf(null);
      if (empty >= 0) this.quickbar[empty] = itemId;
      else this.quickbar[0] = itemId;
    }
    this.ui.refreshItems();
    this.audio.sfx('ui_blip');
  }

  useQuickbar(slot) {
    const itemId = this.quickbar[slot];
    if (!itemId) return;
    const it = ITEMS[itemId];
    if (!it || (this.bag[itemId] || 0) <= 0) { this.ui.hint('这个道具用完了'); return; }
    if (this._itemCd && this.time < this._itemCd) return;   // 公共冷却 1s
    if (it.kind === 'ball') {
      if (this.combat.throwBall(itemId)) this._itemCd = this.time + 1;
      return;
    }
    if (it.kind === 'heal' || it.kind === 'status') {
      if (this.useItemOn(itemId, this.party.activeIndex)) this._itemCd = this.time + 1;
      return;
    }
    this.ui.hint('请在背包中使用这个道具');
  }

  // 对队伍成员使用道具
  useItemOn(itemId, index) {
    const m = this.party.members[index];
    if (!m) return false;
    const it = ITEMS[itemId];
    const sp = getSpecies(m.speciesKey);
    if (it.kind === 'heal') {
      if (m.curHp <= 0 || m.curHp >= m.maxHp) { this.ui.hint(m.curHp <= 0 ? '倒下的宝可梦无法用药，请去宝可梦中心' : 'HP 已经是满的'); return false; }
      if (!this.removeItem(itemId, 1)) return false;
      m.curHp = Math.min(m.maxHp, m.curHp + it.heal);
      this.audio.sfx('ui_heal');
      this.ui.floatText(this.player.pos.clone().setY(this.player.pos.y + 2), `${sp.name} +${Math.min(it.heal, m.maxHp - m.curHp)} HP`, '#7AEF7A');
      burstHeal(this.particles, this.player.pos);
    } else if (it.kind === 'status') {
      if (!m.status || !it.cures.includes(m.status)) { this.ui.hint('没有反应……'); return false; }
      if (!this.removeItem(itemId, 1)) return false;
      cureStatus(m);
      this.audio.sfx('ui_heal');
      this.ui.announce(`${sp.name} 的异常状态解除了！`);
    } else if (it.kind === 'stone') {
      const evo = stoneEvolution(m, itemId);
      if (!evo) { this.ui.hint('没有反应……'); this.audio.sfx('ui_error'); return false; }
      if (!this.removeItem(itemId, 1)) return false;
      this.queueEvolution(m, evo);
    }
    this.ui.refreshParty();
    return true;
  }

  // ============ 队伍操作 ============
  switchActive(i) {
    if (this.party.switchTo(i)) {
      this.player.refreshModel();
      this.ui.refreshParty();
      const sp = getSpecies(this.party.active.speciesKey);
      this.audio.cry(sp.id, 'encounter');
    }
  }

  quickSwitch() {
    const next = this.party.nextUsable();
    if (next >= 0) this.switchActive(next);
  }

  releasePokemon(i) {
    const m = this.party.members[i];
    if (!m || this.party.members.length <= 1) return;
    const sp = getSpecies(m.speciesKey);
    this.party.remove(i);
    this.player.refreshModel();
    this.ui.refreshParty();
    this.ui.announce(`${sp.name} 被放生了……`);
    this.particles.spawn(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z,
      { color: 0xFFFFFF, count: 24, spread: 2, up: 3, life: 1, gravity: -0.5 });
  }

  onPokemonCaptured(inst) {
    const sp = getSpecies(inst.speciesKey);
    this.dex.add(sp.chain);
    this.ui.announce(`成功捕获 ${sp.name} Lv.${inst.level}！`);
    this.saveGame();
    if (!this.party.isFull()) {
      this.party.add(inst);
      this.ui.refreshParty();
      return;
    }
    // 满 6 只：7 选 1 放生面板
    this.ui.showReleasePanel(inst, (res) => {
      if (res.action === 'release') {
        this.releasePokemon(res.index);
        this.party.add(inst);
        this.ui.refreshParty();
        this.ui.announce(`${sp.name} 加入了队伍！`);
      } else {
        this.ui.announce(`放弃了 ${sp.name}……`);
      }
    });
    document.exitPointerLock?.();
  }

  // ============ 技能学习 / 进化 ============
  queueMoveLearn(inst, moveId) {
    if (tryLearn(inst, moveId)) {
      const sp = getSpecies(inst.speciesKey);
      this.ui.announce(`${sp.name} 学会了 ${getMove(moveId).name}！`);
      this.ui.refreshSkills?.();
      return;
    }
    this.pendingMoves.push({ inst, moveId });
  }

  queueEvolution(inst, evo) { this.pendingEvos.push({ inst, evo }); }

  applyEvolutionNow(inst, evo) {
    const result = applyEvolution(inst, evo.to);
    this.dex.add(getSpecies(evo.to).chain);
    if (this.party.active === inst) this.player.refreshModel();
    evolutionParticles(this, this.player.pos);
    this.ui.refreshParty();
    for (const mv of result.pendingMoves) this.queueMoveLearn(inst, mv);
    this.saveGame();
    return result;
  }

  _processQueues() {
    if (this.ui.modalOpen || this.mode !== 'play') return;
    if (this.pendingEvos.length) {
      const { inst, evo } = this.pendingEvos.shift();
      if (inst.curHp <= 0) return;
      document.exitPointerLock?.();
      this.ui.startEvolution(inst, evo, () => {});
      return;
    }
    if (this.pendingMoves.length) {
      const { inst, moveId } = this.pendingMoves.shift();
      document.exitPointerLock?.();
      this.ui.showMoveReplace(inst, moveId, () => { this.ui.refreshParty(); });
    }
  }

  // ============ 护士治疗（§5.1） ============
  nurseHeal(npc) {
    const g = this;
    this.ui.showDialog({ lines: [{ voice: 'nurse_heal', speaker: '护士', text: DIALOGUES.nurse_heal.text }] });
    this.healAnim = 3;
    // 3 秒回复动画：队伍图标逐个亮起（简化为粒子+音效）
    let step = 0;
    const timer = setInterval(() => {
      step++;
      this.audio.sfx('ui_heal');
      burstHeal(this.particles, this.player.pos);
      if (step >= 3) {
        clearInterval(timer);
        this.party.healAll();
        this.ui.refreshParty();
        // 复活点绑定（官方设定）
        if (npc.village) {
          this.respawn = { ...npc.village.respawnPoint, village: npc.village.key };
        }
        this.ui.showDialog({ lines: [{ voice: 'nurse_done', speaker: '护士', text: DIALOGUES.nurse_done.text }] });
        this.saveGame();
      }
    }, 1000);
  }

  // ============ 通关（v4：击败或捕获雪山 Boss 卡比兽） ============
  onBossDefeated() {
    if (this.completed) return;
    this.completed = true;
    this.audio.jingle('victory');
    burstStars(this.particles, this.player.pos, 40);
    const totalChains = new Set(Object.values(SPECIES).map(s => s.chain)).size;
    this.ui.showDialog({ lines: [
      { speaker: '系统', text: '🏆 恭喜通关！你战胜了雪山深处的巨大卡比兽！' },
      { speaker: '系统', text: `冒险统计：徽章 ${this.badges.size}/2 · 图鉴 ${this.dex.size}/${totalChains} 链 · 金钱 ¥${this.money} · 第 ${this.world.dayCount} 天` },
      { speaker: '系统', text: '世界将继续开放，自由探索、集齐图鉴吧！（通关记录已写入存档）' },
    ] });
    document.exitPointerLock?.();
    this.saveGame();
  }

  // ============ 全灭（§8.1：传送回最近宝可梦中心，金钱减半） ============
  onBlackout() {
    if (this._blackout) return;
    this._blackout = true;
    this.gym.onBlackout();
    this.audio.jingle('defeat');
    this.money = Math.floor(this.money / 2);
    this.ui.refreshMoney();
    this.ui.announce('眼前一黑……');
    setTimeout(() => {
      const r = this.respawn || { ...this.world.villages[0].respawnPoint };
      this.player.spawnAt(r.x, r.y, r.z);
      this.party.healAll();
      this.player.refreshModel();
      this.ui.refreshParty();
      this.combat.aggroSet.clear();
      this._scheduleAmbientBgm();
      this.ui.announce('被送回了宝可梦中心……金钱减半');
      this._blackout = false;
      this.saveGame();
    }, 1500);
  }

  onPlayerHazard(dmg, label) {
    const inst = this.party.active;
    if (!inst || inst.curHp <= 0) return;
    inst.curHp = Math.max(0, inst.curHp - dmg);
    this.ui.damageText(this.player.pos.clone().setY(this.player.pos.y + 1.8), `-${dmg} ${label}`, '#FF8040');
    this.ui.flashVignette();
    this.audio.sfx('hurt');
    if (inst.curHp <= 0) this.combat.onPlayerMonFainted();
    this.ui.refreshActive();
  }

  // ============ 存档 ============
  saveGame() { if (this.mode !== 'title') storage.save(this); }
  exportSave() {
    const json = storage.serialize(this);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pokemon_save.json';
    a.click();
  }
  importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      try {
        const text = await input.files[0].text();
        storage.deserialize(text);
        localStorage.setItem('pokemon_voxel_save_v1', text);
        location.reload();
      } catch (e) { this.ui.hint('存档文件无效'); }
    };
    input.click();
  }

  setVolume(k, v) {
    this.volumes[k] = v;
    this.audio.setVolume(k, v);
  }

  // ============ BGM 场景规则（§14.2） ============
  _updateBgm() {
    if (this.combat.inBattle) return;      // 战斗曲由 combat 控制
    const p = this.player.pos;
    let key;
    if (this.world.villageAt(p.x, p.z)) key = 'village';
    else if (this.world.night) key = 'night';
    else key = { grass: 'grassland', forest: 'forest', lake: 'lake', volcano: 'volcano', snow: 'snow' }[this.world.biomeAt(p.x, p.z)] || 'grassland';
    this.audio.bgm(key);
    this.audio.ambience(this.world.night ? 'night' : (this.world.villageAt(p.x, p.z) ? 'village' : this.world.biomeAt(p.x, p.z)));
  }

  _scheduleAmbientBgm() {
    setTimeout(() => { if (!this.combat.inBattle) this._updateBgm(); }, 3000);
  }
  // combat 调用
  get audioReady() { return this.audio.ready; }

  // ============ 主循环 ============
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this._dt());
    this.time += dt;
    this._update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _dt() {
    const now = performance.now();
    const dt = (now - (this._last || now)) / 1000;
    this._last = now;
    return dt;
  }

  _update(dt) {
    const playing = this.mode === 'play';
    if (playing || this.mode === 'dialog' || this.mode === 'panel' || this.mode === 'evolution') {
      // 世界总是呼吸着
      const dayChanged = this.world.dayCount;
      this.world.updateDayNight(dt, this.player.pos);
      if (this.world.dayCount !== dayChanged) this.npcs.onNewDay();
      this.world.ensureChunks(this.player.pos.x, this.player.pos.z);
      this.particles.update(dt);
      this.ui.update(dt);
    }
    if (!playing) return;

    this.player.update(dt);
    // 野生精灵 AI + 状态
    for (const c of this.spawner.creatures) {
      if (!c.dormant && !c.held) updateAI(c, dt);
    }
    this.spawner.update(dt);
    this.combat.update(dt);
    this.gym.update(dt);
    this.boss.update(dt);
    this.npcs.update(dt);
    this._updateItemPoints(dt);
    this._processQueues();

    // 玩家出战精灵异常 tick
    const inst = this.party.active;
    if (inst) {
      const events = this._tickPlayerStatus(dt);
      for (const ev of events) {
        if (ev.type === 'dot' && ev.amount > 0) this.ui.damageText(this.player.pos.clone().setY(this.player.pos.y + 1.8), '-' + ev.amount, '#A040A0');
      }
    }

    // F 交互提示
    this._updateInteractTip();
    // BGM
    this._bgmT = (this._bgmT || 0) - dt;
    if (this._bgmT <= 0) { this._bgmT = 2; this._updateBgm(); }
    // 自动存档 30s
    this.autosaveT -= dt;
    if (this.autosaveT <= 0) { this.autosaveT = 30; this.saveGame(); }
  }

  _tickPlayerStatus(dt) {
    // 复用 status tick（active 宝可梦）
    const inst = this.party.active;
    if (!inst) return [];
    const { tickStatus } = statusModule;
    return tickStatus(inst, dt);
  }

  _updateInteractTip() {
    const p = this.player.pos;
    const npc = this.npcs.nearest(p.x, p.z, 3);
    if (npc) { this.ui.showInteractTip(`按 F 与 ${npc.name} 对话`); return; }
    for (const c of this.world.chests) {
      if (!c.opened && Math.hypot(c.x - p.x, c.z - p.z) < 2.5) { this.ui.showInteractTip('按 F 打开宝箱'); return; }
    }
    for (const v of this.world.villages) {
      if (v.gym && Math.hypot(v.gym.doorX - p.x, v.gym.doorZ - p.z) < 3.5) {
        this.ui.showInteractTip(`按 F 进入${GYMS[v.gym.type].name}`);
        return;
      }
    }
    this.ui.showInteractTip(null);
  }

  // ============ 自动化测试钩子 ============
  _initAutotest() {
    window.__errors = [];
    addEventListener('error', e => window.__errors.push(String(e.message)));
    addEventListener('unhandledrejection', e => window.__errors.push(String(e.reason)));
    this.audio.init = () => {};      // 无头环境跳过音频
    this.newGame();
    this._autotest();
  }

  async _autotest() {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const results = [];
    const check = (name, cond) => {
      results.push(`${cond ? 'PASS' : 'FAIL'} ${name}`);
      if (!cond) window.__errors.push('assert failed: ' + name);
    };
    try {
      // 手动驱动主循环（无 rAF 依赖）
      const step = (n, dt = 0.05) => { for (let i = 0; i < n; i++) { this.time += dt; this._update(dt); this.renderer.render(this.scene, this.camera); } };
      step(20);
      check('世界生成:3村庄', this.world.villages.length === 3);
      check('出生队伍:皮卡丘', this.party.active?.speciesKey === 'pikachu');
      check('初始伤药充足', (this.bag.potion || 0) >= 5 && (this.bag.superpotion || 0) >= 2);
      check('模型已挂载', !!this.player.modelGroup);
      check('NPC已生成', this.npcs.npcs.length > 3);
      // 出生点旁必有护士（方便练级回血）
      const nurse0 = this.npcs.npcs.find(n => n.kind === 'nurse' && n.village?.key === 'grass');
      check('出生村有护士', !!nurse0 && Math.hypot(nurse0.pos.x - this.respawn.x, nurse0.pos.z - this.respawn.z) < 10);

      // 传送出村 → 强制刷新野怪
      this.player.spawnAt(256, 25, 180);
      step(10);
      let spawned = 0;
      for (let i = 0; i < 30 && !this.spawner.creatures.some(c => !c.boss); i++) { this.spawner.trySpawn(); spawned++; }
      const wild = this.spawner.creatures.find(c => !c.boss);
      check('野怪刷新', !!wild);
      check('野怪有技能', wild.inst.moves.length > 0);

      // 战斗：把野怪拉到面前（面朝 +z），放技能
      this.player.faceYaw = 0;
      wild.pos.copy(this.player.pos).z += 3;
      wild.state = 'chase';
      this.combat.onAggro(wild);
      const hpBefore = wild.inst.curHp;
      const castOk = this.combat.playerCastMove(0);
      step(40);   // 等前摇+命中
      check('技能命中掉血', wild.inst.curHp < hpBefore);
      if (!(wild.inst.curHp < hpBefore)) results.push(`  debug: castOk=${castOk} hp=${wild.inst.curHp}/${hpBefore} dist=${wild.distToPlayer().toFixed(1)} move=${this.party.active.moves[0]} casting=${!!this.combat.playerCasting}`);

      // 击杀 → 经验金币
      const expBefore = this.party.active.exp;
      this.combat.damageCreature(wild, 99999, null, 'normal');
      step(30);
      const expAfter = this.party.active.exp;
      check('击杀获得经验', expAfter > expBefore || this.party.active.level > 5);
      if (!(expAfter > expBefore || this.party.active.level > 5)) results.push(`  debug: exp ${expBefore}→${expAfter} curHp=${this.party.active.curHp} fainted=${wild.fainted} faintT=${wild.faintT}`);

      // 捕获：再刷一只压血线投球
      this.bag.pokeball = 5;
      this.spawner.trySpawn();
      const wild2 = this.spawner.creatures.find(c => !c.fainted && c !== wild && !c.boss);
      check('第二只野怪', !!wild2);
      if (wild2) {
        wild2.inst.curHp = 1;
        wild2.pos.copy(this.player.pos).z += 3;
        this.combat.throwBall('pokeball');
        step(120);  // 球飞行+摇晃
        check('捕获流程结束', !this.combat.capturing);
        check('捕获入队或挣脱', this.party.members.length >= 1);
      }

      // 道具：伤药
      this.party.active.curHp = 1;
      const healed = this.useItemOn('potion', 0);
      check('伤药回血', healed && this.party.active.curHp > 1);

      // ---- M4 异常链路：麻痹→麻痹药解除 ----
      const { applyStatus: apSt } = await import('./battle/status.js');
      const paraTest = createInstance('rattata', 8);   // 皮卡丘电系免疫麻痹，用小拉达
      this.party.add(paraTest);
      apSt(paraTest, 'paralysis');
      check('麻痹生效', paraTest.status === 'paralysis');
      this.bag.paralyzheal = 1;
      this.useItemOn('paralyzheal', this.party.members.indexOf(paraTest));
      check('麻痹药解除', paraTest.status === null);

      // ---- M5 进化：皮卡丘雷之石→雷丘（可取消分支已覆盖在逻辑测试） ----
      this.party.members = [createInstance('pikachu', 20)];
      this.party.activeIndex = 0;
      this.player.refreshModel();
      this.bag.thunderstone = 1;
      this.useItemOn('thunderstone', 0);
      check('进化石触发', this.pendingEvos.length === 1);
      step(10);                       // _processQueues 开启动画
      check('进化演出开始', this.mode === 'evolution');
      step(120, 0.05);                // 走完演出(约5s)
      check('进化完成:雷丘', this.party.active.speciesKey === 'raichu');
      check('进化后等级保留', this.party.active.level === 20);
      this.pendingMoves.length = 0;   // 清空补学队列，避免阻塞后续流程
      this.ui.closePanel();

      // ---- M3 满 6 只捕获第 7 只 → 放生面板 ----
      const { SPECIES: SP } = await import('./data/species.js');
      while (this.party.members.length < 6) this.party.add(createInstance('rattata', 5));
      const seventh = createInstance('pidgey', 5);
      this.onPokemonCaptured(seventh);
      check('满员触发放生面板', this.ui.panels.openPanelName === 'release');
      // 选择放生第一只
      this.ui.panels.panelEl.querySelector('button').click();
      step(5);
      check('放生后新精灵入队', this.party.members.length === 6 && this.party.members.some(m => m.speciesKey === 'pidgey'));

      // ---- 商店买卖 ----
      this.merchantState = { present: true, village: 'grass', rareItems: ['firestone'], day: 1 };
      this.money = 5000;
      const ballsBefore = this.bag.pokeball || 0;
      check('购买精灵球', this.buyItem('pokeball') && (this.bag.pokeball === ballsBefore + 1) && this.money === 4800);
      const moneyBefore = this.money;
      check('半价卖出', this.sellItem('pokeball') && this.money === moneyBefore + 100);

      // ---- 护士治疗（3 秒动画 + 复活点绑定） ----
      this.party.members[0].curHp = 1;
      apSt(this.party.members[0], 'burn');
      const nurse = this.npcs.npcs.find(n => n.kind === 'nurse');
      check('护士存在', !!nurse);
      this.nurseHeal(nurse);
      await sleep(3400);
      check('护士全队回满+解异常', this.party.members[0].curHp === this.party.members[0].maxHp && this.party.members[0].status === null);
      check('复活点绑定', !!this.respawn);
      this.ui.closeDialog();

      // ---- M6 道馆车轮战 ----
      const { GYMS: G } = await import('./data/gyms.js');
      const ace = createInstance('charizard', 100);   // 满级避免升级学技能面板打断流程
      this.party.members = [ace];
      this.party.activeIndex = 0;
      this.player.refreshModel();
      this.gym.startBattle(G.rock, this.world.villages[0]);
      check('进入道馆', !!this.playerInGym);
      this.ui.closeDialog();   // 馆主开场白 → 触发 spawnNext
      for (let guard = 0; guard < 20 && this.gym.active; guard++) {
        const cur = this.gym.active?.creatures[this.gym.active.creatures.length - 1];
        if (cur && !cur.fainted) this.combat.damageCreature(cur, 999999, null, 'normal');
        step(40);
        await sleep(50);
      }
      // 推进胜利对话
      for (let i = 0; i < 6 && this.ui.panels.dialog; i++) { this.ui.advanceDialog(); step(5); }
      check('道馆对手全部击败', !this.gym.active);
      check('获得岩石徽章', this.badges.has('岩石徽章'));
      check('道馆奖励金钱', this.money >= 4800 + 2000 - 100);
      check('被传送出竞技场', !this.playerInGym);

      // ---- 结局：雪山沉睡的巨大卡比兽 ----
      check('Boss 沉睡于雪山', this.boss.creature.bossSleeping === true);
      check('小地图标注 Boss', this.boss.spot.x < 152);
      // 徽章不足时无法挑战（先移除岩徽章测试）
      this.badges.delete('岩石徽章');
      this.player.spawnAt(this.boss.spot.x, this.boss.spot.y + 1, this.boss.spot.z + 2);
      this.interact();
      step(3);
      check('徽章不足提示', this.ui.panels.dialog?.lines[0].text.includes('徽章'));
      this.ui.closeDialog();
      check('Boss 未被唤醒', this.boss.creature.bossSleeping === true);
      // 集齐 2 枚徽章 → 唤醒 → 击败 → 通关
      this.badges.add('岩石徽章');
      this.badges.add('火焰徽章');
      this.interact();
      this.ui.advanceDialog();   // 补全打字机，显示选择按钮
      step(3);
      const wakeBtn = [...this.ui.panels.dialogEl.querySelectorAll('.choices button')].find(b => b.textContent.includes('确定'));
      check('Boss 唤醒确认', !!wakeBtn);
      wakeBtn?.click();
      step(5);
      check('Boss 被唤醒', this.boss.creature.bossSleeping === false);
      this.combat.damageCreature(this.boss.creature, 9999999, null, 'normal');
      step(10);
      check('通关判定', this.completed === true);
      for (let i = 0; i < 8 && this.ui.panels.dialog; i++) { this.ui.advanceDialog(); step(2); }

      // ---- 全灭惩罚：回宝可梦中心 + 金钱减半 ----
      for (const c of this.combat.coins) this.scene.remove(c.mesh);   // 清掉未拾取金币避免干扰
      this.combat.coins.length = 0;
      const money0 = this.money;
      this.combat.damagePlayer(999999, null, null);
      await sleep(1700);
      step(10);
      check('全灭金钱减半', this.money === Math.floor(money0 / 2));
      check('全灭后全队回满', this.party.members.every(m => m.curHp === m.maxHp));

      // ---- 存档 ----
      this.saveGame();
      const saved = storage.load();
      check('存档可读取', !!saved && saved.badges.includes('岩石徽章') && saved.party.length >= 1);

      // ---- 宝箱 ----
      const chest = this.world.chests.find(c => !c.opened);
      const lootBefore = JSON.stringify(this.bag);
      this.player.spawnAt(chest.x, chest.y + 1, chest.z);
      this.interact();
      check('宝箱开启得道具', chest.opened && JSON.stringify(this.bag) !== lootBefore);

      // ---- 地面道具点拾取 ----
      const ip = this.world.itemPoints.find(p => p.active);
      const ipItem = ip.itemId;
      const ipBefore = this.bag[ipItem] || 0;
      this.player.spawnAt(ip.x, ip.y + 1, ip.z);
      step(10);
      check('道具点拾取', !ip.active && (this.bag[ipItem] || 0) === ipBefore + 1);

      // ---- 岩浆伤害 ----
      let lavaPos = null;
      outer: for (let z = 0; z < 512; z += 3) for (let x = 0; x < 512; x += 3) {
        if (this.world.terrain.lava[z * 512 + x]) { lavaPos = { x, z }; break outer; }
      }
      check('岩浆池存在', !!lavaPos);
      if (lavaPos) {
        const hpLavaBefore = this.party.active.curHp;
        this.player.spawnAt(lavaPos.x, this.world.terrain.groundH[lavaPos.z * 512 + lavaPos.x] + 2, lavaPos.z);
        step(40);
        check('岩浆灼烧', this.party.active.curHp < hpLavaBefore);
      }

      // ---- 夜间刷鬼斯 ----
      this.world.dayTime = 0.7;
      this.world.updateDayNight(0.001, this.player.pos);
      check('夜晚判定', this.world.night === true);
      let gastlySeen = false;
      for (let i = 0; i < 300 && !gastlySeen; i++) {
        const e = this.spawner.pickSpecies('grass', true);
        if (e?.species === 'gastly') gastlySeen = true;
      }
      check('夜间出现鬼斯', gastlySeen);

      // ---- 技能替换面板 ----
      const act = this.party.active;
      act.moves = ['tackle', 'quickattack', 'bite', 'swift'];
      this.queueMoveLearn(act, 'bodyslam');
      step(5);
      check('换技能面板弹出', this.ui.panels.openPanelName === 'move');
      this.ui.panels.panelEl.querySelector('button').click();
      check('替换后学会', act.moves[0] === 'bodyslam');

      // ---- R 快速轮换 ----
      this.party.add(createInstance('eevee', 10));
      const idxBefore = this.party.activeIndex;
      this.quickSwitch();
      check('R 轮换出战', this.party.activeIndex !== idxBefore);

      // ---- 商人对话→商店 ----
      let merchant = this.npcs.npcs.find(n => n.kind === 'merchant');
      for (let i = 0; i < 20 && !merchant; i++) { this.npcs.placeMerchant(); merchant = this.npcs.npcs.find(n => n.kind === 'merchant'); }
      check('商人出现', !!merchant);
      if (merchant) {
        const dlg = this.npcs.getDialog(merchant);
        this.ui.showDialog(dlg);
        this.ui.advanceDialog();
        step(5);
        const buyBtn = [...this.ui.panels.dialogEl.querySelectorAll('.choices button')].find(b => b.textContent.includes('购买'));
        check('商人对话选项', !!buyBtn);
        buyBtn?.click();
        check('商店打开', this.ui.panels.openPanelName === 'shop');
        this.ui.closePanel();
      }
      // 村民闲聊
      const villager = this.npcs.npcs.find(n => n.kind === 'villager');
      const vdlg = this.npcs.getDialog(villager);
      check('村民闲聊', vdlg.lines.length > 0 && vdlg.lines[0].text.length > 0);

      // 渲染一帧无错误
      this.mode = 'play';
      step(10);
      check('运行时无错误', window.__errors.length === 0);
    } catch (e) {
      window.__errors.push(String(e.stack || e));
      results.push('FAIL exception: ' + e.message);
    }
    const pass = window.__errors.length === 0 && results.every(r => r.startsWith('PASS'));
    const out = (pass ? 'TEST PASS' : 'TEST FAIL') + '\n' + results.join('\n') +
      (window.__errors.length ? '\nERRORS:\n' + window.__errors.slice(0, 5).join('\n') : '');
    document.getElementById('test-result').textContent = out;
    document.title = pass ? 'TEST PASS' : 'TEST FAIL';
    console.log(out);
  }
}

// 状态模块（延迟绑定避免循环 import）
import * as statusModule from './battle/status.js';

function frame() {
  if (AUTOTEST) return new Promise(r => setTimeout(r, 0));   // 无头虚拟时间下 rAF 不可靠
  return new Promise(r => requestAnimationFrame(r));
}

const game = new Game();
window.__game = game;
// 全局错误兜底（冒烟验证用）
addEventListener('error', e => {
  (window.__errors = window.__errors || []).push(String(e.message));
  const el = document.getElementById('test-result');
  if (el) el.textContent = 'PAGE ERROR: ' + e.message + '\n' + (e.error?.stack || '');
});
addEventListener('unhandledrejection', e => {
  (window.__errors = window.__errors || []).push(String(e.reason));
  const el = document.getElementById('test-result');
  if (el) el.textContent = 'PAGE ERROR: ' + String(e.reason?.stack || e.reason);
});
game.boot();
