// main.js — 游戏主循环 / 输入 / 碰撞 / HUD / 音频
import * as THREE from 'three';
import { makeSkyTexture, makePlanetTexture, makeGlowSprite, makeLockSprite, makePortrait, loadImage } from './textures.js?v=20260728';
import { buildCockpit, buildPlayerShip } from './models.js?v=20260728';
import { Bullet, Explosion, Pickup, Asteroid, Missile, ENEMY_TYPES, BOSS_TYPES } from './entities.js?v=20260728';
import { Environment } from './environment.js?v=20260728';
import { LEVELS } from './levels.js?v=20260728';

// ============================================================ 音频合成
class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null;
    this.musicEl = null;      // 当前 BGM
    this.musicName = '';
    this.voiceEl = null;      // 当前配音
    this.onVoiceEnd = null;
  }
  // ---- BGM（交叉淡入淡出）----
  playMusic(name) {
    if (this.musicName === name) return;
    this.musicName = name;
    const next = new Audio(`assets/audio/${name}.mp3`);
    next.loop = true;
    next.volume = 0;
    next.play().catch(() => {});
    const prev = this.musicEl;
    this.musicEl = next;
    // 淡入
    const fadeIn = setInterval(() => {
      if (next.volume < 0.42) next.volume = Math.min(0.42, next.volume + 0.03);
      else clearInterval(fadeIn);
    }, 90);
    // 淡出旧曲
    if (prev) {
      const fadeOut = setInterval(() => {
        if (prev.volume > 0.03) prev.volume = Math.max(0, prev.volume - 0.04);
        else { prev.pause(); clearInterval(fadeOut); }
      }, 90);
    }
    next.addEventListener('error', () => {
      // 该曲目缺失时回退到菜单曲，避免无声
      if (name !== 'bgm_menu' && this.musicName === name) {
        this.musicName = '';
        this.playMusic('bgm_menu');
      }
    });
  }
  duckMusic(on) {
    if (this.musicEl) this.musicEl.volume = on ? 0.12 : 0.42;
  }
  // ---- 配音（播放时压低 BGM）----
  playVoice(name, onEnd) {
    this.stopVoice();
    const v = new Audio(`assets/audio/${name}.mp3`);
    v.volume = 0.95;
    this.voiceEl = v;
    this.duckMusic(true);
    const done = (ok) => { this.duckMusic(false); if (onEnd) onEnd(ok); };
    v.addEventListener('ended', () => done(true));
    v.addEventListener('error', () => done(false)); // 文件缺失时走字幕兜底时长
    v.play().catch(() => {});
  }
  stopVoice() {
    if (this.voiceEl) { this.voiceEl.pause(); this.voiceEl = null; this.duckMusic(false); }
  }
  stopAll() {
    this.stopVoice();
    if (this.musicEl) { this.musicEl.pause(); this.musicEl = null; this.musicName = ''; }
  }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // 噪声缓冲
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  tone(freq, dur, type = 'square', vol = 0.3, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }
  noise(dur, vol = 0.4, lowpass = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }
  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'shoot':       this.tone(880, 0.09, 'square', 0.16, -500); break;
      case 'shootPlasma': this.tone(520, 0.14, 'sawtooth', 0.2, -300); break;
      case 'enemyShoot':  this.tone(300, 0.12, 'square', 0.08, -120); break;
      case 'hit':         this.tone(1200, 0.05, 'square', 0.12, -400); break;
      case 'explosion':   this.noise(0.6, 0.5, 900); this.tone(90, 0.5, 'sine', 0.35, -50); break;
      case 'bigExplosion':this.noise(1.4, 0.7, 700); this.tone(60, 1.2, 'sine', 0.5, -35); break;
      case 'playerHit':   this.noise(0.3, 0.4, 2000); this.tone(200, 0.25, 'sawtooth', 0.25, -120); break;
      case 'pickup':      this.tone(660, 0.08, 'sine', 0.25); setTimeout(() => this.tone(990, 0.12, 'sine', 0.25), 80); break;
      case 'weaponUp':    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'square', 0.2), i * 70)); break;
      case 'bomb':        this.noise(1.8, 0.8, 500); this.tone(45, 1.5, 'sine', 0.6, -20); break;
      case 'bossBarrage': this.tone(180, 0.3, 'sawtooth', 0.15, -60); break;
      case 'warning':     [0, 1, 2].forEach(i => setTimeout(() => this.tone(440, 0.18, 'square', 0.22, 0), i * 300)); break;
      case 'bossDown':    this.noise(2.5, 0.8, 600); [220, 165, 110, 55].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'sawtooth', 0.25, -30), i * 250)); break;
      case 'lockOn':      this.tone(1400, 0.05, 'sine', 0.12); break;
      case 'locked':      this.tone(1750, 0.08, 'sine', 0.18); setTimeout(() => this.tone(1750, 0.1, 'sine', 0.18), 90); break;
      case 'missileLaunch': this.noise(0.5, 0.35, 2500); this.tone(320, 0.4, 'sawtooth', 0.2, 240); break;
    }
  }
}

// 线段-球体扫掠检测（samples 点采样）
const _sv = new THREE.Vector3();
function segSphereHit(a, b, center, r, samples = 3) {
  const r2 = r * r;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    const dx = x - center.x, dy = y - center.y, dz = z - center.z;
    if (dx * dx + dy * dy + dz * dz < r2) return true;
  }
  return false;
}

// ============================================================ 游戏主体
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 4000);
    this.camera.position.set(0, 0, 0);

    // 灯光
    this.scene.add(new THREE.AmbientLight(0x99aacc, 1.3));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
    sun.position.set(-60, 80, -200);
    this.scene.add(sun);
    // 前置补光（照亮敌机面向玩家的一侧）
    const fill = new THREE.DirectionalLight(0x88aaff, 0.9);
    fill.position.set(30, 30, 150);
    this.scene.add(fill);
    const cockpitLight = new THREE.PointLight(0x40ff90, 0.6, 8);
    cockpitLight.position.set(0, -0.3, -1);
    this.camera.add(cockpitLight);
    this.scene.add(this.camera);

    // 座舱（第一人称）
    this.cockpit = buildCockpit();
    this.camera.add(this.cockpit);
    // 玩家战机（第三人称）
    this.playerShip = buildPlayerShip();
    this.playerShip.visible = false;
    this.scene.add(this.playerShip);
    this.viewMode = 'third'; // 'first' 座舱 | 'third' 第三人称
    this._camPos = new THREE.Vector3(0, 3.2, 9.5);

    // 状态
    this.state = 'menu'; // menu | intro | select | cutscene | playing | paused | levelEnd | ending | over | victory
    this.cycle = +(localStorage.getItem('sf64_cycle') || 1); // 周目数（通关后 +1，敌人更强）
    this.levelIndex = 0;
    this.score = 0;
    this.hull = 100; this.hullMax = 100;
    this.shield = 50; this.shieldMax = 50;
    this.shieldRegenDelay = 0;
    this.weaponLevel = 1;
    this.bombs = 1;
    this.playerPos = new THREE.Vector3(0, 0, 0);
    this.shipVel = new THREE.Vector2();
    this.targetPos = new THREE.Vector2(0, 0);
    this.scrollSpeed = 55;
    this.baseScroll = 55;
    this.levelTime = 0;
    this.boss = null;
    this.bossWarned = false;
    this.fireCooldown = 0;
    this.firing = false;
    this.shakeT = 0;
    this.invulnT = 0;
    this.endTimer = 0;
    this.pendingNext = -1;

    // 实体数组
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.explosions = [];
    this.missiles = [];
    this.trailPuffs = [];

    // 导弹锁定
    this.lockCharging = false;
    this.locks = new Map(); // key -> {progress, marker, getPos, radius, apply, alive}
    this.lockTexIdle = null;
    this.lockTexOn = null;
    // 导弹库存 / 冷却
    this.missileMax = 3;
    this.missileStock = 3;
    this.missileReloadTime = 4;
    this.missileReloadT = 0;

    // 环境
    this.env = null;

    // 输入
    this.mouse = new THREE.Vector2(0, 0); // NDC
    this.keys = {};
    this.bindInput();

    // HUD
    this.ui = {};
    for (const id of ['hud','hp-fill','shield-fill','score','level-name','weapon-level','bombs',
      'boss-panel','boss-name','boss-fill','crosshair','hitmarker','banner','banner-title','banner-sub',
      'damage-vignette','menu-screen','end-screen','end-title','end-stats','end-hint',
      'radio-box','radio-name','radio-text','radio-portrait','lock-count','missiles',
      'intro-screen','intro-card','select-screen','level-nodes','select-back','cycle-badge','select-cycle','reset-progress'])
      this.ui[id] = document.getElementById(id);

    // 角色头像（官方立绘贴图，Canvas 头像兜底）
    this.portraits = {
      '佩珀将军': 'assets/textures/portraits/pepper.png',
      '佩比': 'assets/textures/portraits/peppy.png',
      '法尔科': 'assets/textures/portraits/falco.png',
      '斯利皮': 'assets/textures/portraits/slippy.png',
      '旁白': 'assets/textures/portraits/fox.png',
    };
    this.portraitFallback = {
      '佩珀将军': makePortrait('dog'),
      '佩比': makePortrait('rabbit'),
      '法尔科': makePortrait('bird'),
      '斯利皮': makePortrait('frog'),
      '旁白': makePortrait('fox'),
    };

    // 选关界面事件
    this.ui['select-back'].addEventListener('click', () => {
      this.ui['select-screen'].classList.add('hidden');
      this.ui['menu-screen'].classList.remove('hidden');
      this.state = 'menu';
      this.updateMenuInfo();
    });
    // 重置进度按钮（阻止冒泡，避免触发菜单点击进入；连点两次确认，不用原生 confirm）
    const resetBtn = this.ui['reset-progress'];
    let resetArmed = false, resetTimer = 0;
    const disarmReset = () => {
      resetArmed = false;
      resetBtn.textContent = '重 置 进 度';
      resetBtn.classList.remove('armed');
    };
    resetBtn.addEventListener('mousedown', e => {
      e.stopPropagation();
      this.audio.init();
      if (!resetArmed) {
        resetArmed = true;
        resetBtn.textContent = '确定重置？再点一次';
        resetBtn.classList.add('armed');
        clearTimeout(resetTimer);
        resetTimer = setTimeout(disarmReset, 3000);
        this.audio.play('warning');
        return;
      }
      clearTimeout(resetTimer);
      disarmReset();
      localStorage.removeItem('sf64_unlock');
      localStorage.removeItem('sf64_cycle');
      this.cycle = 1;
      this.updateMenuInfo();
      this.audio.play('explosion');
    });
    resetBtn.addEventListener('click', e => e.stopPropagation());
    this.updateMenuInfo();

    this.audio = new AudioEngine();

    // 星野（近景视差星点）
    this.starField = null;
    this.skyMesh = null;
    this.planetMesh = null;
    this.skyImages = {};

    this.clock = new THREE.Clock();
    this.loadAssets().then(() => {
      this.buildSky(0); // 菜单背景用第一关天空
      this.animate();
    });
  }

  async loadAssets() {
    const names = ['nebula', 'stars', 'planet', 'galaxy'];
    await Promise.all(names.map(async n => {
      this.skyImages[n] = await loadImage(`assets/textures/${n}.jpg`);
    }));
  }

  // ---------------- 天空 / 场景装饰 ----------------
  buildSky(levelIdx) {
    if (this.skyMesh) { this.scene.remove(this.skyMesh); this.skyMesh.material.map.dispose(); this.skyMesh.material.dispose(); }
    if (this.planetMesh) { this.scene.remove(this.planetMesh); this.planetMesh = null; }
    if (this.starField) { this.scene.remove(this.starField); this.starField = null; }

    const lv = LEVELS[levelIdx];
    const img = this.skyImages[lv.sky.images[0]];
    const img2 = this.skyImages[lv.sky.images[1]];
    const tex = makeSkyTexture(img || img2, lv.sky.tint);
    if (img && img2) {
      // 两张图混合已在 makeSkyTexture 里以平铺方式处理
    }
    this.skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2500, 40, 24),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    );
    this.scene.add(this.skyMesh);
    this.scene.fog = new THREE.FogExp2(lv.fog, 0.0016);

    // 行星装饰
    if (lv.sky.planet && this.skyImages.planet) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(180, 40, 30),
        new THREE.MeshStandardMaterial({ map: makePlanetTexture(this.skyImages.planet), roughness: 0.9, fog: false })
      );
      p.position.set(-420, -160, -1400);
      this.scene.add(p);
      this.planetMesh = p;
    }

    // 近景星点（视差）
    const N = 700;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 500;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 300;
      pos[i * 3 + 2] = -Math.random() * 1500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starField = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcfe4ff, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0.9, fog: false,
      map: makeGlowSprite('#ffffff', 'rgba(200,220,255,0)'), depthWrite: false,
    }));
    this.scene.add(this.starField);

    // 近景太空尘埃（强视差参照物，让移动/闪避清晰可见）
    if (this.dustField) { this.scene.remove(this.dustField); this.dustField = null; }
    const M = 380;
    const dpos = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 170;
      dpos[i * 3 + 1] = (Math.random() - 0.5) * 105;
      dpos[i * 3 + 2] = -Math.random() * 500;
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.dustField = new THREE.Points(dgeo, new THREE.PointsMaterial({
      color: 0x9fb8d8, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.6, fog: false,
      map: makeGlowSprite('#ffffff', 'rgba(160,190,255,0)'), depthWrite: false,
    }));
    this.scene.add(this.dustField);
  }

  // ---------------- 输入 ----------------
  bindInput() {
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      this.mouse.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      this.ui && this.moveCrosshair(e.clientX, e.clientY);
    });
    addEventListener('mousedown', e => {
      if (this.state === 'menu') { this.onMenuClick(); return; }
      if (this.state === 'intro' || this.state === 'cutscene' || this.state === 'ending') { this.skipSteps(); return; }
      if (this.state === 'levelEnd' || this.state === 'over' || this.state === 'victory') { this.onEndClick(); return; }
      if (e.button === 0) this.firing = true;
      if (e.button === 2) this.startLockCharge();
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this.releaseLockCharge();
    });
    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') { this.firing = true; e.preventDefault(); }
      if (e.code === 'KeyB') this.useBomb();
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyV') this.toggleView();
      if (e.code === 'KeyF' && !e.repeat) this.startLockCharge();
      if (e.code === 'Enter') {
        if (this.state === 'menu') this.onMenuClick();
        else if (this.state === 'intro' || this.state === 'cutscene' || this.state === 'ending') this.skipSteps();
        else if (this.state === 'levelEnd' || this.state === 'over' || this.state === 'victory') this.onEndClick();
      }
    });
    addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.firing = false;
      if (e.code === 'KeyF') this.releaseLockCharge();
    });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  moveCrosshair(x, y) {
    this.ui['crosshair'].style.left = x + 'px';
    this.ui['crosshair'].style.top = y + 'px';
    this.ui['hitmarker'].style.left = x + 'px';
    this.ui['hitmarker'].style.top = y + 'px';
  }

  // ---------------- 周目 ----------------
  get hpMul() { return 1 + 0.4 * (this.cycle - 1); }   // 敌方血量倍率（随周目递增）
  get dmgMul() { return 1 + 0.25 * (this.cycle - 1); } // 敌方伤害倍率
  cycleLabel() {
    const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return `第${cn[this.cycle - 1] || this.cycle}周目`;
  }
  updateMenuInfo() {
    if (this.ui['cycle-badge']) this.ui['cycle-badge'].textContent = `— ${this.cycleLabel()} —`;
    if (this.ui['select-cycle']) this.ui['select-cycle'].textContent =
      `LYLAT SYSTEM — 星域航线图 · ${this.cycleLabel()}` +
      (this.cycle > 1 ? `（敌方强度提升：血量 ×${this.hpMul.toFixed(1)} 伤害 ×${this.dmgMul.toFixed(2)}）` : '');
  }
  onMenuClick() {
    // 二周目以后跳过开场动画，直接进入选关
    if (this.cycle > 1) { this.audio.init(); this.showSelect(); }
    else this.startIntro();
  }

  // ---------------- 剧情演出（开场 / 战前 / 结局共用） ----------------
  setupCardBackdrop() {
    // 剧情镜头：行星缓推
    this.cockpit.visible = false;
    this.playerShip.visible = false;
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -100);
    if (!this.planetMesh && this.skyImages.planet) {
      this.planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(140, 40, 30),
        new THREE.MeshStandardMaterial({ map: makePlanetTexture(this.skyImages.planet), roughness: 0.9, fog: false })
      );
      this.scene.add(this.planetMesh);
    }
    if (this.planetMesh) {
      this.planetMesh.visible = true;
      this.planetMesh.position.set(60, -40, -2200);
    }
    this.introCamT = 0;
  }

  teardownCardBackdrop() {
    // 复位相机
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -100);
    if (this.planetMesh && !LEVELS[0].sky.planet) this.planetMesh.visible = false;
  }

  playSteps(steps, state, onDone) {
    this.introSteps = steps;
    this.introIdx = -1;
    this._stepsDone = onDone;
    this.state = state;
    this.ui['intro-screen'].classList.remove('hidden');
    this.nextIntroStep();
  }

  nextIntroStep() {
    this.introIdx++;
    clearTimeout(this._introTimer);
    if (this.introIdx >= this.introSteps.length) { this._finishSteps(); return; }
    const st = this.introSteps[this.introIdx];
    const card = this.ui['intro-card'];
    card.classList.remove('on');
    setTimeout(() => { card.innerText = st.text; card.classList.add('on'); }, 350);
    let advanced = false;
    const advance = () => { if (!advanced) { advanced = true; this.nextIntroStep(); } };
    // 配音自然播完后停顿 0.6s 进下一段；配音缺失时不触发，由 dur 字幕时长兜底
    this.audio.playVoice(st.voice, ok => { if (ok) setTimeout(advance, 600); });
    this._introTimer = setTimeout(advance, st.dur);
  }

  skipSteps() { // 点击 / 回车跳过演出
    if (!this._stepsDone) return;
    clearTimeout(this._introTimer);
    this.audio.stopVoice();
    this._finishSteps();
  }

  _finishSteps() {
    clearTimeout(this._introTimer);
    this.ui['intro-screen'].classList.add('hidden');
    const f = this._stepsDone;
    this._stepsDone = null;
    if (f) f();
  }

  // ---------------- 开场剧情 ----------------
  startIntro() {
    this.audio.init();
    this.setupCardBackdrop();
    this.ui['menu-screen'].classList.add('hidden');
    this.audio.playMusic('bgm_opening');
    this.playSteps([
      { text: '利拉特星系，和平延续了无数世代。\n直到那一天——安德罗斯皇帝在维诺姆星崛起，向整个星系宣战。', voice: 'opening_1', dur: 9500 },
      { text: '科内利亚首都市区遭到猛烈攻击，行星防线岌岌可危。\n佩珀将军向宇宙中最传奇的佣兵小队发出了求救信号。', voice: 'opening_2', dur: 10500 },
      { text: '他们，就是星际火狐。', voice: 'opening_3', dur: 4200 },
    ], 'intro', () => { this.teardownCardBackdrop(); this.showSelect(); });
  }

  // ---------------- 战前剧情（每关开始前） ----------------
  startCutscene(idx) {
    this.audio.init();
    this.setupCardBackdrop();
    this.ui['select-screen'].classList.add('hidden');
    this.audio.playMusic('bgm_opening');
    this.playSteps(LEVELS[idx].cutscene || [], 'cutscene',
      () => { this.teardownCardBackdrop(); this.startGame(idx); });
  }

  // ---------------- 通关结局 ----------------
  startEnding() {
    this.ui.hud.classList.remove('on');
    this.ui['end-screen'].classList.add('hidden');
    this.setupCardBackdrop();
    this.audio.playMusic('bgm_victory');
    this.playSteps([
      { text: '安德罗斯的能量反应正在崩溃——\n维诺姆核心开始坍缩！福克斯，干得漂亮！', voice: 'ending_1', dur: 7000 },
      { text: '战争结束了。\n利拉特星系的每一颗星球，都在传颂火狐小队的名字。', voice: 'ending_2', dur: 6800 },
      { text: '但是，宇宙的暗处仍有残党蠢动。\n更高的挑战，正在等待传奇的翼尖。新的轮回，就此开启。', voice: 'ending_3', dur: 8600 },
    ], 'ending', () => { this.teardownCardBackdrop(); this.showEndScreen('victory'); });
  }

  // ---------------- 关卡选择 ----------------
  showSelect() {
    this.state = 'select';
    this.cockpit.visible = false;
    this.playerShip.visible = false;
    this.ui['menu-screen'].classList.add('hidden');
    this.ui['end-screen'].classList.add('hidden');
    this.ui['intro-screen'].classList.add('hidden');
    this.ui.hud.classList.remove('on');
    this.ui['select-screen'].classList.remove('hidden');
    this.audio.playMusic('bgm_menu');
    this.updateMenuInfo();
    const unlock = +(localStorage.getItem('sf64_unlock') || 1);
    const icons = ['🏙️', '☄️', '🏜️', '🌊', '❄️', '🌋'];
    const wrap = this.ui['level-nodes'];
    wrap.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = i >= unlock;
      const div = document.createElement('div');
      div.className = 'lv-node' + (locked ? ' locked' : '') + (i < unlock - 1 ? ' cleared' : '');
      div.innerHTML = `<div class="lv-num">STAGE ${i + 1}</div><div class="lv-icon">${icons[i] || '🛰️'}</div>` +
        `<div class="lv-name">${lv.name.split('·')[1].trim()}</div><div class="lv-env">${lv.sub}</div>`;
      if (!locked) div.addEventListener('click', () => this.startCutscene(i)); // 先播战前剧情再出击
      wrap.appendChild(div);
    });
  }

  unlockProgress(idx) {
    const cur = +(localStorage.getItem('sf64_unlock') || 1);
    if (idx + 2 > cur) localStorage.setItem('sf64_unlock', Math.min(LEVELS.length, idx + 2));
  }

  // ---------------- 流程控制 ----------------
  startGame(idx = 0) {
    this.audio.init();
    this.ui['menu-screen'].classList.add('hidden');
    this.ui['select-screen'].classList.add('hidden');
    this.ui.hud.classList.add('on');
    this.score = 0;
    this.weaponLevel = 1;
    this.bombs = 1;
    this.hull = this.hullMax;
    this.shield = this.shieldMax;
    this.startLevel(idx);
  }

  startLevel(idx) {
    this.clearEntities();
    this.levelIndex = idx;
    const lv = LEVELS[idx];
    this.baseScroll = lv.scroll;
    this.scrollSpeed = lv.scroll;
    this.levelTime = 0;
    this.eventQueue = lv.events.slice();
    this.boss = null;
    this.bossSpawned = false;
    this.buildSky(idx);
    // 行星地表环境
    if (this.env) { this.env.dispose(); this.env = null; }
    if (lv.env && lv.env !== 'space') {
      this.env = new Environment(this.scene, lv.env);
      if (this.skyMesh) this.skyMesh.visible = false; // 用大气层天空
    }
    this.state = 'playing';
    this.hull = this.hullMax;
    this.shield = this.shieldMax;
    this.ui['level-name'].textContent = (this.cycle > 1 ? `${this.cycleLabel()} · ` : '') + lv.name;
    this.ui['boss-panel'].style.display = 'none';
    this.ui['end-screen'].classList.add('hidden');
    this.ui.hud.classList.add('on');
    // 环境 BGM
    this.audio.playMusic(lv.bgm || 'bgm_corneria');
  }

  clearEntities() {
    for (const b of this.playerBullets) b.dispose(this.scene);
    for (const b of this.enemyBullets) b.dispose(this.scene);
    for (const e of this.enemies) e.dispose();
    for (const p of this.pickups) p.dispose();
    for (const x of this.explosions) x.dispose();
    for (const m of this.missiles) m.dispose();
    for (const t of this.trailPuffs) this.scene.remove(t);
    this.playerBullets = []; this.enemyBullets = []; this.enemies = []; this.pickups = []; this.explosions = [];
    this.missiles = []; this.trailPuffs = [];
    this.clearLockMarkers();
    this.lockCharging = false;
    if (this.boss) { this.boss.dispose(); this.boss = null; }
  }

  onEndClick() {
    if (this.state === 'levelEnd') {
      this.showSelect(); // 返回星域航线图选择下一关
    } else if (this.state === 'over') {
      this.startGame(this.levelIndex); // 重试本关
    } else if (this.state === 'victory') {
      // 进入下一周目：关卡推进重置（从第一关重新打起），敌人血量/伤害提升
      this.cycle++;
      localStorage.setItem('sf64_cycle', this.cycle);
      localStorage.setItem('sf64_unlock', 1);
      this.updateMenuInfo();
      this.ui['end-screen'].classList.add('hidden');
      this.showSelect();
    }
  }

  toggleView() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.viewMode = this.viewMode === 'first' ? 'third' : 'first';
    this.banner(this.viewMode === 'first' ? '座舱视角' : '第三人称视角', '按 V 切换', 1.4);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.banner('已暂停', '按 P 继续', 9999);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.banner.style.opacity = 0;
      this.clock.getDelta();
    }
  }

  showEndScreen(kind) {
    this.ui.hud.classList.remove('on');
    this.ui['end-screen'].classList.remove('hidden');
    if (kind !== 'over') this.audio.playMusic('bgm_victory');
    const t = this.ui['end-title'], s = this.ui['end-stats'];
    if (kind === 'levelEnd') {
      this.state = 'levelEnd';
      t.textContent = '关卡完成'; t.style.color = '#7dffb0';
      s.innerHTML = `${LEVELS[this.levelIndex].name} 已肃清<br>当前得分 ${this.score}`;
      this.ui['end-hint'].textContent = '点 击 进 入 下 一 关';
    } else if (kind === 'over') {
      this.state = 'over';
      t.textContent = '战机损毁'; t.style.color = '#ff7d7d';
      s.innerHTML = `${LEVELS[this.levelIndex].name}<br>最终得分 ${this.score}`;
      this.ui['end-hint'].textContent = '点 击 重 新 出 击';
    } else {
      this.state = 'victory';
      t.textContent = '任务达成'; t.style.color = '#ffe27a';
      s.innerHTML = `安德罗斯已被消灭，利拉特星系重归和平<br>${this.cycleLabel()} 通关 · 最终得分 ${this.score}` +
        `<br><span style="color:#ffd27a">下一周目已开启：敌人血量 ×${(this.hpMul + 0.4).toFixed(1)}、伤害 ×${(this.dmgMul + 0.25).toFixed(2)}</span>`;
      this.ui['end-hint'].textContent = '点 击 挑 战 下 一 周 目';
    }
  }

  // ---------------- 战斗 API（供实体调用） ----------------
  sfx(n) { this.audio.play(n); }
  addScore(n) { this.score += n; this.ui.score.textContent = this.score; }

  banner(title, sub, dur = 2.5) {
    this.ui['banner-title'].textContent = title;
    this.ui['banner-sub'].textContent = sub || '';
    this.ui.banner.style.opacity = 1;
    clearTimeout(this._bannerTimer);
    if (dur < 9000) this._bannerTimer = setTimeout(() => { this.ui.banner.style.opacity = 0; }, dur * 1000);
  }

  explode(pos, scale = 1) {
    this.explosions.push(new Explosion(this.scene, pos, scale));
    this.audio.play(scale > 2 ? 'bigExplosion' : 'explosion');
  }

  spawnEnemy(type, x, y, z = -900) {
    const Cls = ENEMY_TYPES[type];
    if (!Cls) return;
    const e = new Cls(this.scene, this);
    e.hp = Math.round(e.hp * this.hpMul); // 周目血量加成
    e.spawnAt(x ?? (Math.random() - 0.5) * 56, y ?? (Math.random() - 0.5) * 30, z);
    this.enemies.push(e);
    return e;
  }

  spawnAsteroid(x, y, z, scale) {
    const a = new Asteroid(this.scene, this, scale);
    a.hp = Math.round(a.hp * this.hpMul);
    a.spawnAt(x, y, z);
    this.enemies.push(a);
  }

  addEnemyBullet(from, vel, color = 0xff5030) {
    this.enemyBullets.push(new Bullet(this.scene, from, vel,
      { friendly: false, damage: Math.round(8 * this.dmgMul), color, radius: 1.4 })); // 周目伤害加成
  }

  onEnemyKilled(e) {
    this.addScore(e.scoreValue);
    this.explode(e.group.position.clone(), e.radius > 4 ? 2 : 1);
    this.hitmark();
    // 掉落
    if (Math.random() < e.dropChance) {
      const r = Math.random();
      const type = r < 0.38 ? 'weapon' : r < 0.66 ? 'shield' : r < 0.83 ? 'bomb' : 'missile';
      this.pickups.push(new Pickup(this.scene, e.group.position, type));
    }
  }

  onMineExplode(mine) {
    this.explode(mine.group.position.clone(), 1.5);
    const d = mine.group.position.distanceTo(this.playerPos);
    if (d < 14) this.damagePlayer(18);
  }

  onPickup(type) {
    this.audio.play('pickup');
    if (type === 'weapon') {
      if (this.weaponLevel < 4) {
        this.weaponLevel++;
        this.audio.play('weaponUp');
        this.banner(`武器升级 LV.${this.weaponLevel}`, ['', '双联激光', '三联散射', '等离子重炮'][this.weaponLevel - 1], 1.8);
      } else {
        this.addScore(500);
        this.banner('武器已满级 +500', '', 1.2);
      }
    } else if (type === 'shield') {
      this.shield = this.shieldMax;
      this.hull = Math.min(this.hullMax, this.hull + 15);
      this.banner('护盾恢复', '', 1.2);
    } else if (type === 'bomb') {
      if (this.bombs < 3) { this.bombs++; this.banner('智能炸弹 +1', '', 1.2); }
      else { this.addScore(300); this.banner('炸弹已满 +300', '', 1.2); }
    } else if (type === 'missile') {
      const grew = this.missileMax < 6;
      if (grew) this.missileMax++;
      this.missileReloadTime = Math.max(1.8, this.missileReloadTime * 0.85);
      this.missileStock = this.missileMax; // 立即补满
      this.banner(grew ? `导弹舱扩容 ×${this.missileMax}` : '导弹已补满', `装填时间 ${this.missileReloadTime.toFixed(1)}s`, 1.6);
    }
  }

  onBossDefeated(boss) {
    this.addScore(boss.scoreValue);
    this.audio.play('bossDown');
    this.radio('佩珀将军', '干得好，火狐小队！区域已肃清，准备前往下一个战区！', 'radio_victory');
    // 连环爆炸
    const p = boss.group.position;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        this.explode(new THREE.Vector3(
          p.x + (Math.random() - 0.5) * 30,
          p.y + (Math.random() - 0.5) * 20,
          p.z + (Math.random() - 0.5) * 30), 2.5);
        this.shakeT = Math.max(this.shakeT, 0.5);
      }, i * 220);
    }
    setTimeout(() => this.explode(p.clone(), 5), 1800);
    this.ui['boss-panel'].style.display = 'none';
    const isLast = this.levelIndex >= LEVELS.length - 1;
    this.unlockProgress(this.levelIndex);
    setTimeout(() => {
      if (isLast) this.startEnding(); // 最终关：播放通关结局演出
      else { this.pendingNext = this.levelIndex + 1; this.showEndScreen('levelEnd'); }
    }, 3200);
  }

  damagePlayer(n) {
    if (this.invulnT > 0 || this.state !== 'playing') return;
    this.shieldRegenDelay = 2.5;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, n);
      this.shield -= absorbed;
      n -= absorbed;
    }
    if (n > 0) this.hull -= n;
    this.audio.play('playerHit');
    this.shakeT = Math.max(this.shakeT, 0.35);
    this.invulnT = 0.3;
    // 红屏
    this.ui['damage-vignette'].style.opacity = 0.9;
    setTimeout(() => { this.ui['damage-vignette'].style.opacity = 0; }, 180);
    if (this.hull <= 0) {
      this.hull = 0;
      this.gameOver();
    }
  }

  gameOver() {
    if (this.state !== 'playing') return;
    this.radio('佩珀将军', '战机损毁……福克斯，听到请回答！听到请回答！', 'radio_gameover');
    this.explode(this.camera.position.clone().add(new THREE.Vector3(0, -1, -6)), 3);
    this.shakeT = 1.5;
    setTimeout(() => this.showEndScreen('over'), 1200);
    this.state = 'dying';
  }

  useBomb() {
    if (this.state !== 'playing' || this.bombs <= 0) return;
    this.bombs--;
    this.audio.play('bomb');
    this.shakeT = 1.2;
    // 清屏
    for (const b of this.enemyBullets) { b.alive = false; }
    for (const e of this.enemies) {
      if (e.group.position.z > -400) e.takeDamage(120, this);
    }
    if (this.boss && !this.boss.entering) {
      for (const w of this.boss.weakPoints) this.boss.damageWeak(w, 60, this);
      if (this.boss.coreExposed) this.boss.damageCore(60, this);
    }
    // 闪光
    this.explode(this.camera.position.clone().add(new THREE.Vector3(0, 0, -60)), 6);
  }

  hitmark() {
    this.ui.hitmarker.style.opacity = 1;
    clearTimeout(this._hmTimer);
    this._hmTimer = setTimeout(() => { this.ui.hitmarker.style.opacity = 0; }, 90);
  }

  // ---------------- 无线电通讯 ----------------
  radio(name, text, voiceFile) {
    const box = this.ui['radio-box'];
    this.ui['radio-name'].textContent = name;
    this.ui['radio-text'].textContent = text;
    const img = this.ui['radio-portrait'];
    img.onerror = () => { img.onerror = null; img.src = this.portraitFallback[name] || this.portraitFallback['旁白']; };
    img.src = this.portraits[name] || this.portraits['旁白'];
    box.classList.add('on');
    clearTimeout(this._radioTimer);
    // 字幕至少显示 2.8s，或按文本长度
    const dur = Math.max(2800, text.length * 130);
    this._radioTimer = setTimeout(() => box.classList.remove('on'), dur);
    if (voiceFile) this.audio.playVoice(voiceFile);
  }

  // ---------------- 导弹锁定 ----------------
  startLockCharge() {
    if (this.state !== 'playing') return;
    if (this.missileStock <= 0) {
      this.banner('导弹装载中…', `${this.missileReloadTime.toFixed(0)} 秒装填一枚`, 1);
      return;
    }
    this.lockCharging = true;
  }

  releaseLockCharge() {
    if (!this.lockCharging) return;
    this.lockCharging = false;
    const locked = [...this.locks.values()].filter(l => l.progress >= 1 && l.alive());
    const n = Math.min(locked.length, this.missileStock);
    if (locked.length > 0 && n > 0) {
      for (let i = 0; i < n; i++) {
        this.fireMissile(locked[i], i);
        this.missileStock--;
      }
      this.audio.play('missileLaunch');
    } else if (locked.length === 0 && this.missileStock > 0) {
      // 无锁定：直射一枚重导弹
      this.fireMissile(null, 0);
      this.missileStock--;
      this.audio.play('missileLaunch');
    } else {
      // 弹舱空了
      this.banner('导弹装载中…', '等待装填或拾取 M 级扩容道具', 1.4);
      this.audio.play('hit');
    }
    this.clearLockMarkers();
  }

  fireMissile(lock, idx) {
    // 从翼尖交替发射
    let from;
    if (this.viewMode === 'first') {
      from = this.camera.localToWorld(new THREE.Vector3(idx % 2 === 0 ? -1.4 : 1.4, -0.6, -2));
    } else {
      this.playerShip.updateMatrixWorld();
      from = this.playerShip.localToWorld(new THREE.Vector3(idx % 2 === 0 ? -2.8 : 2.8, -0.4, -1));
    }
    // 初始速度：追踪弹先散开再抬头（礼花效果）；直射弹不加散布
    const dir = this.getAimPoint().sub(from).normalize();
    if (lock) {
      dir.y -= 0.25 + (idx % 3) * 0.08;
      dir.x += (idx % 2 === 0 ? -0.15 : 0.15);
    }
    const m = new Missile(this.scene, from, dir.normalize().multiplyScalar(180), lock);
    this.missiles.push(m);
  }

  clearLockMarkers() {
    for (const l of this.locks.values()) this.scene.remove(l.marker);
    this.locks.clear();
  }

  updateLocks(dt) {
    // 充能中：准星附近目标积累锁定进度
    if (this.lockCharging) {
      const LOCK_RANGE = 0.26; // NDC 半径
      const candidates = this.getLockCandidates();
      for (const c of candidates) {
        if (this.locks.has(c.key)) continue;
        if (this.locks.size >= 4) continue; // 最多 4 个锁定
        const sp = c.getPos().clone().project(this.camera);
        if (sp.z > 1 || sp.z < -1) continue;
        const dx = sp.x - this.mouse.x, dy = sp.y - this.mouse.y;
        if (dx * dx + dy * dy < LOCK_RANGE * LOCK_RANGE) {
          // 新建锁定目标
          if (!this.lockTexIdle) { this.lockTexIdle = makeLockSprite(false); this.lockTexOn = makeLockSprite(true); }
          const marker = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.lockTexIdle, transparent: true, depthWrite: false, depthTest: false,
          }));
          marker.scale.set(5, 5, 1);
          this.scene.add(marker);
          this.locks.set(c.key, { ...c, progress: 0, marker });
          this.audio.play('lockOn');
        }
      }
      // 推进进度
      for (const l of this.locks.values()) {
        if (l.progress < 1) {
          l.progress += dt / 0.65;
          if (l.progress >= 1) {
            l.marker.material.map = this.lockTexOn;
            this.audio.play('locked');
          }
        }
      }
    }
    // 标记跟随 + 清理无效目标
    for (const [key, l] of this.locks) {
      if (!l.alive()) {
        this.scene.remove(l.marker);
        this.locks.delete(key);
        continue;
      }
      l.marker.position.copy(l.getPos());
      const s = l.progress >= 1 ? 4.2 + Math.sin(performance.now() * 0.012) * 0.5 : 5;
      l.marker.scale.set(s, s, 1);
    }
  }

  getLockCandidates() {
    const list = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const z = e.group.position.z;
      if (z > -15 || z < -780) continue;
      const key = e;
      list.push({
        key,
        getPos: () => e.group.position,
        radius: e.radius,
        alive: () => e.alive,
        apply: (dmg, game) => e.takeDamage(dmg, game),
      });
    }
    if (this.boss && this.boss.alive && !this.boss.entering) {
      const boss = this.boss;
      for (const w of boss.weakPoints) {
        if (!w.alive) continue;
        list.push({
          key: w,
          getPos: () => w.mesh.getWorldPosition(new THREE.Vector3()),
          radius: w.radius,
          alive: () => w.alive,
          apply: (dmg, game) => boss.damageWeak(w, dmg, game),
        });
      }
      if (boss.coreExposed && boss.core) {
        list.push({
          key: 'boss-core',
          getPos: () => boss.core.getWorldPosition(new THREE.Vector3()),
          radius: boss.coreRadius || 3,
          alive: () => boss.alive && boss.coreExposed,
          apply: (dmg, game) => boss.damageCore(dmg, game),
        });
      }
    }
    return list;
  }

  spawnTrailPuff(pos, vel) {
    // 导弹尾迹：短寿命辉光粒子
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowSprite('#ffd8a0', 'rgba(255,120,30,0)'),
      transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.position.copy(pos);
    s.scale.set(1.2, 1.2, 1);
    s.userData.life = 0.45;
    this.scene.add(s);
    this.trailPuffs.push(s);
  }

  // ---------------- 武器 ----------------
  fireWeapon(dt) {
    this.fireCooldown -= dt;
    if (!this.firing || this.fireCooldown > 0) return;
    const aim = this.getAimPoint();
    const mkBolt = (from, color, speed, spreadAngle = 0) => {
      const dir = aim.clone().sub(from).normalize();
      if (spreadAngle) {
        dir.x += spreadAngle; dir.normalize();
      }
      const b = new Bullet(this.scene, from, dir.multiplyScalar(speed), {
        friendly: true, damage: 10, color, radius: 1.6,
      });
      this.playerBullets.push(b);
      return b;
    };
    // 弹道起点按视角选择：座舱翼尖炮 或 第三人称战机翼炮
    let tipL, tipR, center;
    if (this.viewMode === 'first') {
      const guns = this.cockpit.userData.gunTips;
      tipL = this.camera.localToWorld(guns[0].clone());
      tipR = this.camera.localToWorld(guns[1].clone());
      center = this.camera.localToWorld(new THREE.Vector3(0, -0.5, -2.2));
    } else {
      const guns = this.playerShip.userData.gunTips;
      this.playerShip.updateMatrixWorld();
      tipL = this.playerShip.localToWorld(guns[0].clone());
      tipR = this.playerShip.localToWorld(guns[1].clone());
      center = this.playerShip.localToWorld(new THREE.Vector3(0, 0, -4.5));
    }

    switch (this.weaponLevel) {
      case 1:
        mkBolt(center, 0x40ff90, 520);
        this.fireCooldown = 0.16;
        this.audio.play('shoot');
        break;
      case 2:
        mkBolt(tipL, 0x40ff90, 530); mkBolt(tipR, 0x40ff90, 530);
        this.fireCooldown = 0.14;
        this.audio.play('shoot');
        break;
      case 3: {
        mkBolt(tipL, 0x40c0ff, 530); mkBolt(tipR, 0x40c0ff, 530);
        mkBolt(center, 0x40c0ff, 530);
        this.fireCooldown = 0.14;
        this.audio.play('shoot');
        break;
      }
      case 4: {
        const b1 = mkBolt(tipL, 0xc060ff, 560); b1.damage = 26; b1.radius = 2.4; b1.mesh.scale.setScalar(1.8);
        const b2 = mkBolt(tipR, 0xc060ff, 560); b2.damage = 26; b2.radius = 2.4; b2.mesh.scale.setScalar(1.8);
        mkBolt(center, 0x40ff90, 540);
        this.fireCooldown = 0.12;
        this.audio.play('shootPlasma');
        break;
      }
    }
  }

  getAimPoint() {
    // 准星射线：先求沿射线最近目标的距离，让子弹正好收敛到目标深度，
    // 消除"枪口→固定远点"的视差（第三人称下该视差导致打不中 Boss）
    const v = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const o = this.camera.position;
    const tmp = new THREE.Vector3();
    let best = Infinity;
    const test = (p, r) => {
      const t = tmp.copy(p).sub(o).dot(dir);
      if (t < 20 || t > 700 || t >= best) return;
      const closest = tmp.copy(o).addScaledVector(dir, t);
      if (closest.distanceTo(p) < r) best = t;
    };
    for (const e of this.enemies) {
      if (e.alive) test(e.group.position, e.radius + 2.5);
    }
    if (this.boss && this.boss.alive && !this.boss.entering) {
      for (const w of this.boss.weakPoints)
        if (w.alive) test(w.mesh.getWorldPosition(new THREE.Vector3()), w.radius + 2);
      if (this.boss.core) test(this.boss.core.getWorldPosition(new THREE.Vector3()), (this.boss.coreRadius || 3) + 2);
      test(this.boss.group.position, this.boss.radius);
    }
    const dist = best < Infinity ? best : 320;
    return o.clone().addScaledVector(dir, dist);
  }

  // ---------------- 关卡事件 ----------------
  runEvents() {
    while (this.eventQueue.length && this.eventQueue[0].t <= this.levelTime) {
      const ev = this.eventQueue.shift();
      const R = (a, b) => a + Math.random() * (b - a);
      switch (ev.type) {
        case 'banner': this.banner(ev.title, ev.sub, 3); break;
        case 'radio': this.radio(ev.name, ev.text, ev.voice); break;
        case 'spawn': this.spawnEnemy(ev.enemy, ev.x, ev.y); break;
        case 'tankRow': {
          const gy = this.env ? this.env.groundY : -26;
          for (let i = 0; i < ev.count; i++)
            this.spawnEnemy('tank', -30 + i * (60 / Math.max(1, ev.count - 1)) + R(-4, 4), gy, -900 - i * 40);
          break;
        }
        case 'squadron': {
          const cx = R(-18, 18), cy = R(-8, 10);
          for (let i = 0; i < ev.count; i++) {
            let x = cx, y = cy;
            if (ev.formation === 'vee') { x = cx + (i - (ev.count - 1) / 2) * 8; y = cy + Math.abs(i - (ev.count - 1) / 2) * 4; }
            else if (ev.formation === 'line') { x = cx + (i - (ev.count - 1) / 2) * 10; }
            else if (ev.formation === 'ring') { const a = i / ev.count * Math.PI * 2; x = cx + Math.cos(a) * 14; y = cy + Math.sin(a) * 9; }
            this.spawnEnemy(ev.enemy, x, y, -900 - i * 25);
          }
          break;
        }
        case 'asteroids':
          for (let i = 0; i < ev.count; i++)
            this.spawnAsteroid(R(-45, 45), R(-28, 28), -900 - i * 60, (ev.scale || 1) * R(0.6, 1.4));
          break;
        case 'mineLine':
          for (let i = 0; i < ev.count; i++)
            this.spawnEnemy('mine', -30 + i * (60 / Math.max(1, ev.count - 1)), R(-6, 6), -900 - i * 15);
          break;
        case 'turretRow': {
          const gy = this.env ? this.env.groundY + 2.2 : null;
          for (let i = 0; i < ev.count; i++)
            this.spawnEnemy('turret', R(-40, 40),
              ev.ground && gy !== null ? gy : (i % 2 === 0 ? -22 : 22), -900 - i * 45);
          break;
        }
      }
    }
    // Boss 出场
    if (!this.bossSpawned && this.levelTime >= LEVELS[this.levelIndex].duration) {
      this.bossSpawned = true;
      const lv = LEVELS[this.levelIndex];
      this.audio.play('warning');
      this.audio.playMusic('bgm_boss');
      this.banner(lv.bossIntro.title, lv.bossIntro.sub, 3.5);
      const BossCls = BOSS_TYPES[lv.boss];
      this.boss = new BossCls(this.scene, this);
      // 周目血量加成（本体 + 各弱点/成员）
      this.boss.hp = Math.round(this.boss.hp * this.hpMul);
      this.boss.maxHp = Math.round(this.boss.maxHp * this.hpMul);
      for (const w of this.boss.weakPoints) {
        w.hp = Math.round(w.hp * this.hpMul);
        w.maxHp = Math.round(w.maxHp * this.hpMul);
      }
      if (lv.bossName) this.boss.name = lv.bossName;
      this.ui['boss-panel'].style.display = 'block';
      this.ui['boss-name'].textContent = this.boss.name;
    }
  }

  bossProgress() {
    if (!this.boss) return 0;
    const b = this.boss;
    let total = b.maxHp, cur = Math.max(0, b.hp);
    for (const w of b.weakPoints) { total += w.maxHp; cur += Math.max(0, w.hp); }
    return cur / total;
  }

  // ---------------- 主循环 ----------------
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'playing' || this.state === 'dying') this.update(dt);
    else if (this.state === 'menu' || this.state === 'select') this.updateMenuBg(dt);
    else if (this.state === 'intro' || this.state === 'cutscene' || this.state === 'ending') {
      this.updateMenuBg(dt);
      // 行星缓慢推镜
      this.introCamT += dt;
      if (this.planetMesh) {
        this.planetMesh.position.z = Math.min(-900, this.planetMesh.position.z + dt * 90);
        this.planetMesh.rotation.y += dt * 0.02;
      }
      this.camera.lookAt(20, -12, -200);
    }
    this.renderer.render(this.scene, this.camera);
  }

  updateMenuBg(dt) {
    if (this.skyMesh) this.skyMesh.rotation.y += dt * 0.005;
    if (this.starField) {
      const pos = this.starField.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + 20 * dt;
        if (z > 50) z = -1500;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }
  }

  update(dt) {
    this.levelTime += dt;
    const playing = this.state === 'playing';

    // ---- 速度控制 ----
    let targetScroll = this.baseScroll;
    if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) targetScroll = this.baseScroll + 45;
    if (this.keys['KeyC']) targetScroll = this.baseScroll * 0.45;
    this.scrollSpeed += (targetScroll - this.scrollSpeed) * dt * 3;

    // ---- 飞船移动：WASD / 方向键直接驾驶，鼠标仅瞄准 ----
    const BX = 34, BY = 19;
    if (playing) {
      let kx = 0, ky = 0;
      if (this.keys['KeyA'] || this.keys['ArrowLeft'])  kx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;
      if (this.keys['KeyW'] || this.keys['ArrowUp'])    ky += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown'])  ky -= 1;
      if (kx || ky) {
        this.targetPos.x = THREE.MathUtils.clamp(this.targetPos.x + kx * 60 * dt, -BX, BX);
        this.targetPos.y = THREE.MathUtils.clamp(this.targetPos.y + ky * 45 * dt, -BY, BY);
      }
    }
    const px = this.playerPos.x, py = this.playerPos.y;
    this.playerPos.x += (this.targetPos.x - px) * dt * 7;
    this.playerPos.y += (this.targetPos.y - py) * dt * 7;
    this.shipVel.set((this.playerPos.x - px) / Math.max(dt, 1e-4), (this.playerPos.y - py) / Math.max(dt, 1e-4));

    // 相机位置 + 抖动
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = this.shakeT * 0.8;
      sx = (Math.random() - 0.5) * k; sy = (Math.random() - 0.5) * k;
    }
    // ---- 视角与相机 ----
    const first = this.viewMode === 'first';
    this.cockpit.visible = first;
    this.playerShip.visible = !first;
    if (first) {
      // 座舱视角：相机即战机
      this.camera.position.set(this.playerPos.x + sx, this.playerPos.y + sy, 0);
      this.camera.lookAt(this.playerPos.x + this.mouse.x * 6, this.playerPos.y + this.mouse.y * 4, -100);
      // 座舱动态：侧倾 + 惯性滞后位移（幅度克制以免遮挡视野）
      this.cockpit.rotation.z = THREE.MathUtils.clamp(-this.shipVel.x * 0.004, -0.16, 0.16);
      this.cockpit.rotation.x = THREE.MathUtils.clamp(this.shipVel.y * 0.003, -0.1, 0.1);
      this.cockpit.position.x = THREE.MathUtils.clamp(-this.shipVel.x * 0.006, -0.14, 0.14);
      this.cockpit.position.y = THREE.MathUtils.clamp(-this.shipVel.y * 0.005, -0.1, 0.1);
    } else {
      // 第三人称：战机姿态 + 跟随相机
      const ship = this.playerShip;
      ship.position.set(this.playerPos.x, this.playerPos.y, 0);
      ship.rotation.z = THREE.MathUtils.clamp(-this.shipVel.x * 0.022, -0.6, 0.6);
      ship.rotation.x = THREE.MathUtils.clamp(this.shipVel.y * 0.013, -0.3, 0.3);
      ship.rotation.y = THREE.MathUtils.clamp(-this.shipVel.x * 0.004, -0.25, 0.25);
      // 尾焰随加速增强
      const boost = Math.max(0, this.scrollSpeed - this.baseScroll);
      const fl = 0.9 + Math.random() * 0.25 + boost * 0.02;
      for (const f of ship.userData.flames) f.scale.set(fl, fl, 1);
      // 跟随相机（略滞后，带抖动；高位后拉让战机处于画面下三分之一）
      this._camPos.lerp(new THREE.Vector3(this.playerPos.x * 0.9, this.playerPos.y * 0.88 + 4.4, 14.5), Math.min(1, dt * 7));
      this.camera.position.set(this._camPos.x + sx, this._camPos.y + sy, this._camPos.z);
      this.camera.lookAt(this.playerPos.x + this.mouse.x * 5, this.playerPos.y + 1.2 + this.mouse.y * 3.5, -60);
    }
    // 加速时视野外扩
    const targetFov = 72 + (this.scrollSpeed - this.baseScroll) * 0.18;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * dt * 4;
      this.camera.updateProjectionMatrix();
    }

    // 护盾恢复
    this.shieldRegenDelay -= dt;
    if (this.shieldRegenDelay <= 0 && this.shield < this.shieldMax)
      this.shield = Math.min(this.shieldMax, this.shield + 5 * dt);
    this.invulnT -= dt;

    // 导弹装填
    if (this.missileStock < this.missileMax) {
      this.missileReloadT += dt;
      if (this.missileReloadT >= this.missileReloadTime) {
        this.missileReloadT = 0;
        this.missileStock++;
        this.audio.play('lockOn');
      }
    } else {
      this.missileReloadT = 0;
    }

    // ---- 事件 / 开火 ----
    if (playing) {
      this.runEvents();
      this.fireWeapon(dt);
    }

    // ---- 星野滚动 ----
    if (this.starField) {
      const pos = this.starField.geometry.attributes.position;
      const spd = this.scrollSpeed * 2.2;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + spd * dt;
        if (z > 50) z = -1500;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }
    // ---- 尘埃滚动 ----
    if (this.dustField) {
      const pos = this.dustField.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i) + this.scrollSpeed * dt;
        if (z > 30) z = -500;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
    }

    // ---- 实体更新 ----
    for (const b of this.playerBullets) b.update(dt);
    for (const b of this.enemyBullets) b.update(dt);
    for (const e of this.enemies) e.update(dt, this);
    for (const p of this.pickups) p.update(dt, this);
    for (const x of this.explosions) x.update(dt, this.scrollSpeed * 0.4);
    if (this.boss && this.boss.alive) this.boss.update(dt, this);
    if (playing) this.updateLocks(dt);
    for (const m of this.missiles) m.update(dt, this);
    for (const t of this.trailPuffs) {
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life * 1.6);
      const sc = t.scale.x + dt * 2;
      t.scale.set(sc, sc, 1);
      t.position.z += this.scrollSpeed * 0.5 * dt;
    }
    if (this.env) this.env.update(dt, this.scrollSpeed, this.playerPos.x);

    // ---- 碰撞 ----
    this.collide(dt);

    // ---- 清理 ----
    this.playerBullets = this.playerBullets.filter(b => { if (!b.alive) b.dispose(this.scene); return b.alive; });
    this.enemyBullets = this.enemyBullets.filter(b => { if (!b.alive) b.dispose(this.scene); return b.alive; });
    this.enemies = this.enemies.filter(e => { if (!e.alive) e.dispose(); return e.alive; });
    this.pickups = this.pickups.filter(p => { if (!p.alive) p.dispose(); return p.alive; });
    this.explosions = this.explosions.filter(x => { if (!x.alive) x.dispose(); return x.alive; });
    this.missiles = this.missiles.filter(m => { if (!m.alive) m.dispose(); return m.alive; });
    this.trailPuffs = this.trailPuffs.filter(t => { if (t.userData.life <= 0) { this.scene.remove(t); return false; } return true; });
    if (this.boss && !this.boss.alive) { this.boss.dispose(); this.boss = null; }

    // ---- HUD ----
    this.ui['hp-fill'].style.width = (this.hull / this.hullMax * 100) + '%';
    this.ui['shield-fill'].style.width = (this.shield / this.shieldMax * 100) + '%';
    this.ui['weapon-level'].textContent = `武器 LV.${this.weaponLevel}` + (this.weaponLevel >= 4 ? ' MAX' : '');
    this.ui.bombs.textContent = `智能炸弹 × ${this.bombs}`;
    let ms = `导弹 ${'◉'.repeat(this.missileStock)}${'○'.repeat(this.missileMax - this.missileStock)}`;
    if (this.missileStock < this.missileMax) ms += ` (装填 ${Math.max(0, this.missileReloadTime - this.missileReloadT).toFixed(1)}s)`;
    this.ui.missiles.textContent = ms;
    const lockedN = [...this.locks.values()].filter(l => l.progress >= 1).length;
    this.ui['lock-count'].textContent = this.lockCharging ? (lockedN > 0 ? `已锁定 ×${lockedN}` : '锁定中…') : '';
    if (this.boss) this.ui['boss-fill'].style.width = (this.bossProgress() * 100) + '%';
  }

  collide(dt) {
    const pp = this.playerPos;

    // 玩家子弹 vs 敌人 / Boss（沿本帧路径扫掠采样，防穿透）
    for (const b of this.playerBullets) {
      if (!b.alive) continue;
      const bp = b.mesh.position;
      // 弹道磁吸：子弹靠近目标时轻微修正轨迹（街机手感，弥补目标移动）
      {
        let mag = null, magD = 11;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = bp.distanceTo(e.group.position);
          if (d < magD) { magD = d; mag = e.group.position; }
        }
        if (this.boss && this.boss.alive && !this.boss.entering) {
          for (const w of this.boss.weakPoints) {
            if (!w.alive) continue;
            const p = w.mesh.getWorldPosition(new THREE.Vector3());
            const d = bp.distanceTo(p);
            if (d < 15 && d < magD) { magD = d; mag = p; }
          }
          if (this.boss.coreExposed && this.boss.core) {
            const p = this.boss.core.getWorldPosition(new THREE.Vector3());
            const d = bp.distanceTo(p);
            if (d < 15 && d < magD) { magD = d; mag = p; }
          }
        }
        if (mag) {
          const speed = b.vel.length();
          const want = mag.clone().sub(bp).normalize().multiplyScalar(speed);
          if (want.dot(b.vel) > 0) b.vel.lerp(want, 0.25).setLength(speed);
        }
      }
      const prev = _sv.copy(bp).addScaledVector(b.vel, -dt);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.abs(e.group.position.z - bp.z) > 16) continue;
        if (segSphereHit(prev, bp, e.group.position, e.radius + b.radius, 2)) {
          b.alive = false;
          e.takeDamage(b.damage, this);
          this.audio.play('hit');
          this.hitmark();
          break;
        }
      }
      if (!b.alive || !this.boss || !this.boss.alive || this.boss.entering) continue;
      const boss = this.boss;
      if (Math.abs(boss.group.position.z - bp.z) > 80) continue;
      // 弱点（优先于舰体判定）
      const wps = boss.weakPoints.filter(w => w.alive)
        .map(w => ({ w, p: w.mesh.getWorldPosition(new THREE.Vector3()) }));
      let hitWeak = null;
      for (const { w, p } of wps) {
        if (segSphereHit(prev, bp, p, w.radius + b.radius, 4)) { hitWeak = w; break; }
      }
      if (hitWeak) {
        b.alive = false;
        boss.damageWeak(hitWeak, b.damage, this);
        this.hitmark();
        continue;
      }
      // 核心
      const coreP = (boss.coreExposed && boss.core) ? boss.core.getWorldPosition(new THREE.Vector3()) : null;
      if (coreP && segSphereHit(prev, bp, coreP, (boss.coreRadius || 3) + b.radius, 4)) {
        b.alive = false;
        boss.damageCore(b.damage, this);
        this.audio.play('hit');
        this.hitmark();
        continue;
      }
      // 舰体（子弹在弱点/核心附近时豁免，避免被舰体提前拦截）
      const nearWeak = wps.some(({ p }) => p.distanceTo(bp) < 12) || (coreP && coreP.distanceTo(bp) < 12);
      if (!nearWeak && boss.bodyHit(bp, b.radius)) {
        b.alive = false;
        boss.takeDamage(b.damage, this);
        this.explosions.push(new Explosion(this.scene, bp.clone(), 0.4, 6));
      }
    }

    // 无锁定直射导弹 vs 敌人 / Boss 舰体
    for (const m of this.missiles) {
      if (!m.alive || m.target) continue; // 追踪弹自带命中判定
      const mp = m.mesh.position;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (mp.distanceTo(e.group.position) < e.radius + 2.5) {
          m.alive = false;
          e.takeDamage(m.damage, this);
          this.explode(mp.clone(), 1.8);
          break;
        }
      }
      if (!m.alive || !this.boss || !this.boss.alive || this.boss.entering) continue;
      if (this.boss.bodyHit(mp, 2.5)) {
        m.alive = false;
        this.boss.takeDamage(m.damage, this);
        this.explode(mp.clone(), 1.8);
      }
    }

    // 敌方子弹 vs 玩家
    for (const b of this.enemyBullets) {
      if (!b.alive) continue;
      const bp = b.mesh.position;
      if (bp.z > -4 && bp.z < 4 && bp.distanceTo(pp) < 2.4) {
        b.alive = false;
        this.damagePlayer(b.damage);
      }
    }

    // 敌机撞击玩家
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ep = e.group.position;
      if (ep.z > -6 && ep.z < 6 && ep.distanceTo(pp) < e.radius + 1.8) {
        e.alive = false;
        this.explode(ep.clone(), 1.2);
        this.damagePlayer(e instanceof Asteroid ? 30 : 20);
      }
    }

    // Boss 撞击（大体型警告区）
    if (this.boss && this.boss.alive && !this.boss.entering) {
      const bp = this.boss.group.position;
      if (bp.z > -40 && bp.distanceTo(pp) < this.boss.radius) {
        this.damagePlayer(25);
      }
    }
  }
}

// ============================================================ 启动
const game = new Game();
window.__game = game; // 调试入口
