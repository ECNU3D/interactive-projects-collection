// HUD（设计文档 §15）：技能栏、道具栏、队伍栏、金钱、小地图、飘字、头顶血条
import { getMove } from '../data/movedata.js';
import { getSpecies } from '../data/species.js';
import { ITEMS } from '../data/items.js';
import { STATUS } from '../data/statusData.js';
import { TYPE_NAMES } from '../data/typeChart.js';
import { WORLD_SIZE, WATER_LEVEL, BIOME_ID, VILLAGES, idx } from '../world/terrain.js';
import { GYMS } from '../data/gyms.js';

const STATUS_ICON = { paralysis: '⚡', burn: '🔥', freeze: '❄', poison: '☠', badpoison: '☠', sleep: '💤' };

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('money-val'),
      minimap: document.getElementById('minimap'),
      partybar: document.getElementById('partybar'),
      activemon: document.getElementById('activemon'),
      skills: document.getElementById('skills'),
      items: document.getElementById('items'),
      announce: document.getElementById('announce'),
      hint: document.getElementById('hint'),
      interactTip: document.getElementById('interact-tip'),
      floaters: document.getElementById('floaters'),
      mobBars: document.getElementById('mob-bars'),
      vignette: document.getElementById('vignette'),
    };
    this.floaters = [];
    this.mobBarPool = [];
    this.announceT = 0;
    this.hintT = 0;
    this.vignetteT = 0;
    this.minimapT = 0;
    this._mapBase = null;   // 世界生成后懒构建
  }

  show() { this.el.hud.classList.remove('hidden'); }

  // ---- 小地图（§15：标注村庄、当日商人位置 $、道馆） ----
  _buildMinimapBase() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const colors = ['#79B94C', '#3E7D32', '#3A76C9', '#5A5A5E', '#F0F6F8'];
    for (let z = 0; z < 128; z++) for (let x = 0; x < 128; x++) {
      const wx = x * 4, wz = z * 4;
      const t = this.game.world.terrain;
      const i = idx(wx, wz);
      let c = colors[t.biome[i]] || '#333';
      if (t.biome[i] === BIOME_ID.lake && t.groundH[i] < WATER_LEVEL) c = '#2A5A9C';
      if (t.lava[i]) c = '#E85A10';
      g.fillStyle = c;
      g.fillRect(x, z, 1, 1);
    }
    this._mapBase = cv;
  }

  drawMinimap() {
    if (!this._mapBase) {
      if (!this.game.world) return;
      this._buildMinimapBase();
    }
    const g = this.el.minimap.getContext('2d');
    const w = this.game.world;
    g.imageSmoothingEnabled = false;
    g.drawImage(this._mapBase, 0, 0, 140, 140);
    const px = x => x / WORLD_SIZE * 140;
    // 村庄
    g.font = '10px sans-serif';
    for (const v of w.villages) {
      g.fillStyle = '#FCDC5F';
      g.fillRect(px(v.x) - 3, px(v.z) - 3, 6, 6);
      g.fillStyle = '#000';
      g.fillRect(px(v.x) - 2, px(v.z) - 2, 4, 4);
      g.fillStyle = '#fff';
    }
    // 道馆
    g.fillStyle = '#FF6B6B';
    for (const v of w.villages) {
      if (v.hasGym) {
        g.fillRect(px(v.x) + 3, px(v.z) - 8, 5, 5);
      }
    }
    // 当日商人 $
    const ms = this.game.merchantState;
    if (ms?.present) {
      const v = w.villages.find(v => v.key === ms.village);
      if (v) {
        g.fillStyle = '#FCDC5F';
        g.font = 'bold 11px sans-serif';
        g.fillText('$', px(v.x) + 6, px(v.z) + 2);
      }
    }
    // 结局 Boss 位置 ★（未击败时）
    const bs = this.game.boss;
    if (bs && !bs.defeated) {
      g.fillStyle = '#FFD700';
      g.font = 'bold 12px sans-serif';
      g.fillText('★', px(bs.spot.x) - 4, px(bs.spot.z) + 4);
    }
    // 玩家箭头
    const p = this.game.player.pos;
    const yaw = this.game.player.yaw;
    g.save();
    g.translate(px(p.x), px(p.z));
    g.rotate(-yaw + Math.PI);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -5); g.lineTo(3.5, 4); g.lineTo(-3.5, 4);
    g.closePath(); g.fill();
    g.restore();
  }

  // ---- 飘字 ----
  damageText(pos, text, color = '#fff') { this._addFloater(pos, text, color, 0.9, -40); }
  floatText(pos, text, color = '#fff') { this._addFloater(pos, text, color, 1.4, -30); }

  _addFloater(pos, text, color, life, rise) {
    if (this.floaters.length > 40) this.floaters.shift();
    const el = document.createElement('div');
    el.className = 'floater';
    el.textContent = text;
    el.style.color = color;
    this.el.floaters.appendChild(el);
    this.floaters.push({ el, pos: pos.clone(), life, maxLife: life, rise });
  }

  announce(text) {
    this.el.announce.textContent = text;
    this.el.announce.style.opacity = 1;
    this.announceT = 2.5;
  }

  hint(text) {
    this.el.hint.textContent = text;
    this.el.hint.style.opacity = 1;
    this.hintT = 2;
  }

  flashVignette() { this.vignetteT = 0.4; }

  showInteractTip(text) {
    if (text) { this.el.interactTip.textContent = text; this.el.interactTip.classList.remove('hidden'); }
    else this.el.interactTip.classList.add('hidden');
  }

  // ---- 队伍栏 / 出战栏 ----
  refreshParty() {
    const g = this.game;
    const pb = this.el.partybar;
    pb.innerHTML = '';
    g.party.members.forEach((m, i) => {
      const sp = getSpecies(m.speciesKey);
      const d = document.createElement('div');
      d.className = 'pm-slot' + (i === g.party.activeIndex ? ' active' : '') + (m.curHp <= 0 ? ' fainted' : '');
      const ratio = m.curHp / m.maxHp;
      d.innerHTML = `<div class="st">${STATUS_ICON[m.status] || ''}</div>
        <div>${sp.name}</div><div style="color:#FCDC5F">Lv.${m.level}</div>
        <div class="hp"><div style="width:${ratio * 100}%;background:${hpColor(ratio)}"></div></div>`;
      d.onclick = () => { if (i !== g.party.activeIndex) g.switchActive(i); };
      pb.appendChild(d);
    });
    this.refreshActive();
  }

  refreshActive() {
    const g = this.game;
    const m = g.party.active;
    const el = this.el.activemon;
    if (!m) { el.innerHTML = ''; this.el.skills.innerHTML = ''; return; }
    const sp = getSpecies(m.speciesKey);
    const ratio = m.curHp / m.maxHp;
    const expLo = expForLevelSafe(sp.growthRate, m.level), expHi = expForLevelSafe(sp.growthRate, m.level + 1);
    const expRatio = expHi > expLo ? (m.exp - expLo) / (expHi - expLo) : 1;
    el.innerHTML = `<span class="nm">${sp.name}</span><span class="lv">Lv.${m.level}</span>
      <span class="sticon">${STATUS_ICON[m.status] || ''}</span>
      <div style="flex:1"><div class="hpbar"><div style="width:${ratio * 100}%;background:${hpColor(ratio)}"></div></div>
      <div class="expbar"><div style="width:${expRatio * 100}%"></div></div></div>
      <span class="hptext">${m.curHp}/${m.maxHp}</span>`;
    this.refreshSkills();
  }

  refreshSkills() {
    const g = this.game;
    const m = g.party.active;
    const el = this.el.skills;
    el.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div');
      d.className = 'hb';
      const moveId = m?.moves[i];
      if (moveId) {
        const mv = getMove(moveId);
        d.innerHTML = `<span class="key">${i + 1}</span><span class="icon" style="color:${typeColor(mv.type)}">◆</span>
          <span>${mv.name}</span><span style="color:#aaa;font-size:9px">${TYPE_NAMES[mv.type]}·${mv.power || '—'}</span>`;
        d.dataset.move = moveId;
      } else {
        d.classList.add('empty');
        d.innerHTML = `<span class="key">${i + 1}</span>`;
      }
      el.appendChild(d);
    }
  }

  refreshItems() {
    const g = this.game;
    const el = this.el.items;
    el.innerHTML = '';
    g.quickbar.forEach((itemId, i) => {
      const d = document.createElement('div');
      d.className = 'hb' + (itemId ? '' : ' empty');
      if (itemId) {
        const cnt = g.bag[itemId] || 0;
        d.innerHTML = `<span class="key">${i + 5}</span><span class="icon">${ITEMS[itemId].icon}</span>
          <span>${ITEMS[itemId].name}</span><span class="cnt">${cnt}</span>`;
        if (cnt <= 0) d.classList.add('empty');
      } else {
        d.innerHTML = `<span class="key">${i + 5}</span>`;
      }
      el.appendChild(d);
    });
  }

  refreshMoney() { this.el.money.textContent = this.game.money; }

  // ---- 每帧 ----
  update(dt) {
    const g = this.game;
    // 冷却遮罩
    const now = g.time;
    for (const d of this.el.skills.children) {
      const moveId = d.dataset.move;
      if (!moveId) continue;
      const mv = getMove(moveId);
      const remain = (g.combat.playerCooldowns[moveId] || 0) - now;
      let cd = d.querySelector('.cd');
      if (remain > 0) {
        if (!cd) { cd = document.createElement('div'); cd.className = 'cd'; d.appendChild(cd); }
        cd.textContent = remain.toFixed(1);
        cd.style.background = `rgba(0,0,0,${Math.min(0.75, remain / mv.cooldown)})`;
      } else if (cd) cd.remove();
    }
    // 飘字
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) { f.el.remove(); this.floaters.splice(i, 1); continue; }
      f.pos.y += dt * (-f.rise / 30);
      const s = project(f.pos, g.camera);
      if (s.visible) {
        f.el.style.left = s.x + 'px';
        f.el.style.top = s.y + 'px';
        f.el.style.opacity = Math.min(1, f.life / (f.maxLife * 0.4));
      } else f.el.style.opacity = 0;
    }
    // 野怪头顶血条
    this._updateMobBars();
    // announce / hint / vignette 计时
    if (this.announceT > 0) { this.announceT -= dt; if (this.announceT <= 0) this.el.announce.style.opacity = 0; }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.el.hint.style.opacity = 0; }
    if (this.vignetteT > 0) {
      this.vignetteT -= dt;
      this.el.vignette.style.opacity = Math.max(0, this.vignetteT / 0.4);
    }
    // 小地图 0.25s 刷新
    this.minimapT -= dt;
    if (this.minimapT <= 0) { this.minimapT = 0.25; this.drawMinimap(); }
    // 出战栏 HP 实时
    this._activeT = (this._activeT || 0) - dt;
    if (this._activeT <= 0) { this._activeT = 0.3; this.refreshActive(); }
  }

  _updateMobBars() {
    const g = this.game;
    const list = [];
    for (const c of g.spawner.creatures) {
      if (c.fainted || c.removeMe || c.dormant) continue;
      if (c.distToPlayer() > 30) continue;
      list.push(c);
    }
    while (this.mobBarPool.length < list.length) {
      const el = document.createElement('div');
      el.className = 'mobbar';
      el.innerHTML = `<div class="nm"></div><div class="hp"><div></div></div><div class="st"></div>`;
      this.el.mobBars.appendChild(el);
      this.mobBarPool.push(el);
    }
    this.mobBarPool.forEach((el, i) => {
      const c = list[i];
      if (!c) { el.style.display = 'none'; return; }
      const s = project(c.headPos(), g.camera);
      if (!s.visible) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      el.querySelector('.nm').textContent = `${c.species.name} Lv.${c.inst.level}`;
      const ratio = c.inst.curHp / c.inst.maxHp;
      const bar = el.querySelector('.hp>div');
      bar.style.width = (ratio * 100) + '%';
      bar.style.background = hpColor(ratio);
      el.querySelector('.st').textContent = STATUS_ICON[c.inst.status] || '';
    });
  }
}

function hpColor(r) { return r > 0.5 ? '#6abe6a' : r > 0.2 ? '#FCDC5F' : '#e05a5a'; }
function typeColor(t) {
  return { normal: '#A8A878', fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030', rock: '#B8A038', poison: '#A040A0', ghost: '#705898', ice: '#98D8D8', psychic: '#F85888' }[t] || '#fff';
}

function project(v3, camera) {
  const v = v3.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * innerWidth,
    y: (-v.y * 0.5 + 0.5) * innerHeight,
    visible: v.z < 1 && v.x > -1.2 && v.x < 1.2 && v.y > -1.2 && v.y < 1.2,
  };
}

// 避免循环依赖：内联经验曲线
function expForLevelSafe(rate, lv) {
  if (lv <= 1) return 0;
  const c = lv ** 3;
  return Math.floor(rate === 'fast' ? 0.8 * c : rate === 'slow' ? 1.25 * c : c);
}
