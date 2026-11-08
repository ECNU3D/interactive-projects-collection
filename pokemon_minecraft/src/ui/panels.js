// 面板 UI（设计文档 §15）：对话框、队伍/背包、商店、设置、进化演出、放生面板
import { getSpecies, SPECIES } from '../data/species.js';
import { getMove, MOVES } from '../data/movedata.js';
import { ITEMS, ITEM_CATEGORIES } from '../data/items.js';
import { SHOP_STAPLE, sellPrice } from '../data/shopData.js';
import { STATUS } from '../data/statusData.js';
import { TYPE_NAMES } from '../data/typeChart.js';
import { DIALOGUES } from '../data/dialogues.js';
import { stoneEvolution } from '../pokemon/evolution.js';
import { hasSave } from '../save/storage.js';

const STATUS_ICON = { paralysis: '⚡', burn: '🔥', freeze: '❄', poison: '☠', badpoison: '☠', sleep: '💤' };

export class Panels {
  constructor(game) {
    this.game = game;
    this.dialogEl = document.getElementById('dialog');
    this.panelEl = document.getElementById('panel');
    this.evoEl = document.getElementById('evolution');
    this.dialog = null;          // { lines, idx, char, choices, onEnd }
    this.evoState = null;
    this.openPanelName = null;
  }

  get modalOpen() {
    return !!this.dialog || this.openPanelName || !!this.evoState;
  }

  // ============ NPC 对话框（打字机，F 继续，§15） ============
  showDialog({ lines, choices = null, onEnd = null }) {
    this.game.mode = 'dialog';
    this.dialog = { lines, idx: 0, char: 0, choices, onEnd, done: false };
    this.dialogEl.classList.remove('hidden');
    this.dialogEl.querySelector('.choices').innerHTML = '';
    this._renderDialogLine(true);
  }

  _renderDialogLine(first = false) {
    const d = this.dialog;
    const line = d.lines[d.idx];
    this.dialogEl.querySelector('.speaker').textContent = line.speaker || '';
    this.dialogEl.querySelector('.text').textContent = '';
    d.char = 0;
    d.done = false;
    // 语音（§14.3：对话开始播放，F 跳过即停）
    if (line.voice) this.game.audio.voice(line.voice);
  }

  advanceDialog() {
    const d = this.dialog;
    if (!d) return;
    const line = d.lines[d.idx];
    if (!d.done) {                       // 第一次按：补全文字（并停语音）
      d.char = line.text.length;
      d.done = true;
      this.game.audio.stopVoice();
      this._renderDialogText(line);
      if (d.idx === d.lines.length - 1 && d.choices) this._showChoices(d.choices);
      return;
    }
    if (d.idx < d.lines.length - 1) {
      d.idx++;
      this._renderDialogLine();
    } else if (!d.choices) {
      this.closeDialog();
    }
  }

  _renderDialogText(line) {
    this.dialogEl.querySelector('.text').textContent = line.text.slice(0, this.dialog.char);
  }

  _showChoices(choices) {
    const box = this.dialogEl.querySelector('.choices');
    box.innerHTML = '';
    for (const c of choices) {
      const b = document.createElement('button');
      b.className = 'mc-btn small';
      b.textContent = c.label;
      b.onclick = () => {
        this.closeDialog();
        c.action?.();
      };
      box.appendChild(b);
    }
  }

  closeDialog() {
    const onEnd = this.dialog?.onEnd;
    this.dialog = null;
    this.dialogEl.classList.add('hidden');
    this.game.audio.stopVoice();
    if (this.game.mode === 'dialog') this.game.mode = 'play';
    onEnd?.();
  }

  setDialogEnd(fn) { this._dialogEnd = fn; }

  showConfirm(text, onYes) {
    this.showDialog({
      lines: [{ speaker: '系统', text }],
      choices: [{ label: '确定', action: onYes }, { label: '取消', action: null }],
    });
  }

  updateDialog(dt) {
    const d = this.dialog;
    if (!d) return;
    const line = d.lines[d.idx];
    if (!d.done) {
      d.char = Math.min(line.text.length, d.char + dt * 30);   // 打字机
      this._renderDialogText(line);
      if (d.char >= line.text.length) {
        d.done = true;
        if (d.idx === d.lines.length - 1 && d.choices) this._showChoices(d.choices);
      }
    }
  }

  // ============ Tab：队伍 + 背包 ============
  togglePartyPanel() {
    if (this.openPanelName === 'party') { this.closePanel(); return; }
    this.openPartyPanel();
  }

  openPartyPanel(tab = 'party') {
    this.openPanelName = 'party';
    this.game.mode = 'panel';
    const g = this.game;
    const el = this.panelEl;
    el.classList.remove('hidden');
    let html = `<span class="close-x" data-x>✕</span><h2>队伍与背包</h2>
      <div class="tabs">
        <div class="tab ${tab === 'party' ? 'sel' : ''}" data-tab="party">队伍 (${g.party.members.length}/6)</div>
        <div class="tab ${tab === 'bag' ? 'sel' : ''}" data-tab="bag">背包</div>
        <div class="tab ${tab === 'dex' ? 'sel' : ''}" data-tab="dex">图鉴</div>
      </div><div id="panel-body"></div>`;
    el.innerHTML = html;
    el.querySelector('[data-x]').onclick = () => this.closePanel();
    el.querySelectorAll('.tab').forEach(t => t.onclick = () => this.openPartyPanel(t.dataset.tab));
    const body = el.querySelector('#panel-body');
    if (tab === 'party') this._renderPartyTab(body);
    else if (tab === 'bag') this._renderBagTab(body);
    else this._renderDexTab(body);
  }

  _renderPartyTab(body) {
    const g = this.game;
    body.innerHTML = '';
    g.party.members.forEach((m, i) => {
      const sp = getSpecies(m.speciesKey);
      const d = document.createElement('div');
      d.className = 'mon-card' + (i === g.party.activeIndex ? ' active' : '');
      const ivTotal = m.ivs.hp + m.ivs.atk + m.ivs.def + m.ivs.spd;
      const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(ivTotal / 64 * 5))));
      const moves = m.moves.map(id => getMove(id).name).join(' / ');
      d.innerHTML = `
        <div class="dot" style="background:${speciesColor(m.speciesKey)}"></div>
        <div class="info">
          <div class="nm">${sp.name} <span style="color:#FCDC5F">Lv.${m.level}</span> ${STATUS_ICON[m.status] || ''} <span class="iv" title="个体值">${stars}</span></div>
          <div class="sub">${sp.types.map(t => TYPE_NAMES[t]).join('·')} · ${moves}</div>
          <div class="sub">HP ${m.curHp}/${m.maxHp} · 经验 ${m.exp}</div>
        </div>
        <div class="hp"><div style="width:${m.curHp / m.maxHp * 100}%"></div></div>`;
      const btns = document.createElement('div');
      if (i !== g.party.activeIndex && m.curHp > 0) {
        const b = mkBtn('出战', 'small green', () => { g.switchActive(i); this.openPartyPanel('party'); });
        btns.appendChild(b);
      }
      const nevBtn = mkBtn(m.noEvolve ? '✔ 永不进化' : '永不进化', 'small' + (m.noEvolve ? ' red' : ''), () => {
        m.noEvolve = !m.noEvolve;
        this.openPartyPanel('party');
      });
      btns.appendChild(nevBtn);
      if (g.party.members.length > 1) {
        btns.appendChild(mkBtn('放生', 'small red', () => {
          this.showConfirm(`确定要放生 ${sp.name} 吗？`, () => { g.releasePokemon(i); this.openPartyPanel('party'); });
        }));
      }
      d.appendChild(btns);
      body.appendChild(d);
    });
  }

  _renderBagTab(body, category = 'ball') {
    const g = this.game;
    body.innerHTML = '';
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    for (const cat of ITEM_CATEGORIES) {
      const t = document.createElement('div');
      t.className = 'tab' + (cat.key === category ? ' sel' : '');
      t.textContent = cat.name;
      t.onclick = () => this._renderBagTab(body, cat.key);
      tabs.appendChild(t);
    }
    body.appendChild(tabs);
    const grid = document.createElement('div');
    grid.className = 'bag-grid';
    body.appendChild(grid);
    const items = Object.entries(g.bag).filter(([id, n]) => n > 0 && ITEMS[id]?.kind === category);
    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;color:#777;text-align:center;padding:20px">这个分类是空的</div>';
    }
    for (const [id, n] of items) {
      const it = ITEMS[id];
      const d = document.createElement('div');
      d.className = 'bag-item';
      d.innerHTML = `<div class="icon">${it.icon}</div><div class="nm">${it.name}</div><div class="cnt">×${n}</div>`;
      d.onclick = () => this._itemMenu(id);
      grid.appendChild(d);
    }
    // 快捷栏绑定提示
    const tip = document.createElement('div');
    tip.style.cssText = 'color:#888;font-size:11px;margin-top:8px';
    tip.textContent = '点击道具：使用 / 绑定到快捷栏 5~9（精灵球、回复药、解异常药）';
    body.appendChild(tip);
  }

  _itemMenu(itemId) {
    const g = this.game;
    const it = ITEMS[itemId];
    const btns = [];
    if (it.kind === 'heal' || it.kind === 'status' || it.kind === 'stone') {
      btns.push({ label: '使用', action: () => this._selectTargetForItem(itemId) });
    }
    if (['ball', 'heal', 'status'].includes(it.kind)) {
      btns.push({ label: '绑定快捷栏', action: () => { g.bindQuickbar(itemId); this.openPartyPanel('bag'); } });
    }
    btns.push({ label: '取消', action: null });
    this.showDialog({ lines: [{ speaker: it.name, text: it.desc }], choices: btns });
  }

  _selectTargetForItem(itemId) {
    const g = this.game;
    const it = ITEMS[itemId];
    const choices = g.party.members.map((m, i) => {
      const sp = getSpecies(m.speciesKey);
      return {
        label: `${sp.name} Lv.${m.level} (${m.curHp}/${m.maxHp})`,
        action: () => g.useItemOn(itemId, i),
      };
    });
    choices.push({ label: '取消', action: null });
    this.showDialog({ lines: [{ speaker: it.name, text: `要对哪只宝可梦使用${it.name}？` }], choices });
  }

  _renderDexTab(body) {
    const g = this.game;
    body.innerHTML = '';
    // 按进化链分组（§7.3）
    const chains = {};
    for (const sp of Object.values(SPECIES)) {
      chains[sp.chain] = chains[sp.chain] || [];
      chains[sp.chain].push(sp);
    }
    const grid = document.createElement('div');
    grid.className = 'bag-grid';
    for (const [chain, members] of Object.entries(chains)) {
      const lit = g.dex.has(chain);
      const first = members[0];
      const d = document.createElement('div');
      d.className = 'bag-item';
      d.style.opacity = lit ? 1 : 0.35;
      const names = members.map(m => m.name).join('→');
      d.innerHTML = `<div class="icon">${lit ? '◆' : '◇'}</div><div class="nm" style="font-size:10px">${lit ? names : '？？？'}</div>`;
      grid.appendChild(d);
    }
    body.appendChild(grid);
  }

  // ============ 商店（§5.2 MC 交易风格） ============
  openShop(mode = 'buy') {
    this.openPanelName = 'shop';
    this.game.mode = 'panel';
    const g = this.game;
    const el = this.panelEl;
    el.classList.remove('hidden');
    const rare = g.merchantState?.rareItems || [];
    el.innerHTML = `<span class="close-x" data-x>✕</span><h2>道具商店 · 🪙 ${g.money}</h2>
      <div class="tabs">
        <div class="tab ${mode === 'buy' ? 'sel' : ''}" data-mode="buy">购买</div>
        <div class="tab ${mode === 'sell' ? 'sel' : ''}" data-mode="sell">出售（半价）</div>
      </div><div id="panel-body"></div>`;
    el.querySelector('[data-x]').onclick = () => this.closePanel();
    el.querySelectorAll('.tab').forEach(t => t.onclick = () => this.openShop(t.dataset.mode));
    const body = el.querySelector('#panel-body');
    if (mode === 'buy') {
      const mkRow = (id, rareTag = false) => {
        const it = ITEMS[id];
        const d = document.createElement('div');
        d.className = 'shop-row';
        d.innerHTML = `<span class="icon">${it.icon}</span>
          <span class="nm">${it.name}${rareTag ? ' <span style="color:#FCDC5F">★稀有</span>' : ''}<span class="desc">${it.desc}</span></span>
          <span class="pr">¥${it.price}</span>`;
        d.appendChild(mkBtn('购买', 'small green', () => {
          if (g.buyItem(id)) { this.openShop('buy'); }
        }));
        body.appendChild(d);
      };
      for (const id of SHOP_STAPLE) mkRow(id);
      if (rare.length) {
        const h = document.createElement('h2');
        h.textContent = '—— 今日稀有 ——';
        h.style.fontSize = '13px';
        body.appendChild(h);
        for (const id of rare) mkRow(id, true);
      }
    } else {
      const sellable = Object.entries(g.bag).filter(([id, n]) => n > 0);
      if (!sellable.length) body.innerHTML = '<div style="color:#777;text-align:center;padding:20px">背包是空的</div>';
      for (const [id, n] of sellable) {
        const it = ITEMS[id];
        const d = document.createElement('div');
        d.className = 'shop-row';
        d.innerHTML = `<span class="icon">${it.icon}</span>
          <span class="nm">${it.name}<span class="desc">${it.desc}</span></span>
          <span class="cnt">×${n}</span><span class="pr">¥${sellPrice(id)}</span>`;
        d.appendChild(mkBtn('卖出', 'small gold', () => {
          if (g.sellItem(id)) { this.openShop('sell'); }
        }));
        body.appendChild(d);
      }
    }
  }

  // ============ Esc 菜单（保存/读取/设置/导出导入，§15/§16） ============
  openMenu() {
    this._prePanelMode = this.game.mode;   // 从标题界面也能打开设置
    this.openPanelName = 'menu';
    this.game.mode = 'panel';
    const g = this.game;
    const el = this.panelEl;
    el.classList.remove('hidden');
    el.innerHTML = `<span class="close-x" data-x>✕</span><h2>菜单</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="mc-btn small green" data-act="save">保存</button>
        <button class="mc-btn small" data-act="export">导出存档</button>
        <button class="mc-btn small" data-act="import">导入存档</button>
        <button class="mc-btn small red" data-act="title">回标题</button>
      </div>
      <h2>音量设置</h2>
      ${['bgm', 'sfx', 'voice'].map(k => `
        <div class="vol-row"><label>${{ bgm: '音乐', sfx: '音效', voice: '语音' }[k]}</label>
        <input type="range" min="0" max="100" value="${Math.round(g.volumes[k] * 100)}" data-vol="${k}">
        <span class="v" id="vol-${k}">${Math.round(g.volumes[k] * 100)}%</span></div>`).join('')}
      <div style="color:#888;font-size:11px;margin-top:10px">徽章：${[...g.badges].join('、') || '无'} · 第 ${g.world.dayCount} 天</div>`;
    el.querySelector('[data-x]').onclick = () => this.closePanel();
    el.querySelector('[data-act="save"]').onclick = () => { g.saveGame(); g.ui.hint('已保存'); };
    el.querySelector('[data-act="export"]').onclick = () => g.exportSave();
    el.querySelector('[data-act="import"]').onclick = () => g.importSave();
    el.querySelector('[data-act="title"]').onclick = () => location.reload();
    el.querySelectorAll('[data-vol]').forEach(input => {
      input.oninput = () => {
        const k = input.dataset.vol;
        g.setVolume(k, input.value / 100);
        document.getElementById('vol-' + k).textContent = input.value + '%';
      };
    });
  }

  // ============ 技能替换面板（§7.2：已满 4 个弹替换面板） ============
  showMoveReplace(inst, moveId, onDone) {
    this.openPanelName = 'move';
    this.game.mode = 'panel';
    const sp = getSpecies(inst.speciesKey);
    const mv = getMove(moveId);
    const el = this.panelEl;
    el.classList.remove('hidden');
    el.innerHTML = `<h2>${sp.name} 想要学会「${mv.name}」！</h2>
      <p style="margin-bottom:10px;color:#ccc">但技能栏已满（最多 4 个）。选择一个技能替换，或放弃学习：</p>
      <div id="panel-body"></div>`;
    const body = el.querySelector('#panel-body');
    inst.moves.forEach((id, i) => {
      const m = getMove(id);
      const d = document.createElement('div');
      d.className = 'shop-row';
      d.innerHTML = `<span class="icon" style="color:${typeColor(m.type)}">◆</span>
        <span class="nm">${m.name}<span class="desc">${TYPE_NAMES[m.type]} · 威力${m.power || '—'} · 命中${m.accuracy}</span></span>`;
      d.appendChild(mkBtn('替换', 'small', () => {
        const old = getMove(inst.moves[i]).name;
        inst.moves[i] = moveId;
        this.closePanel();
        this.game.ui.announce(`忘记了 ${old}，学会了 ${mv.name}!`);
        onDone?.(true);
      }));
      body.appendChild(d);
    });
    body.appendChild(mkBtn('放弃学习', 'red', () => { this.closePanel(); onDone?.(false); }));
  }

  // ============ 放生面板（§7.4：满 6 只捕获第 7 只时 7 选 1） ============
  showReleasePanel(newInst, onDone) {
    this.openPanelName = 'release';
    this.game.mode = 'panel';
    const g = this.game;
    const el = this.panelEl;
    el.classList.remove('hidden');
    const newSp = getSpecies(newInst.speciesKey);
    el.innerHTML = `<h2>队伍已满！</h2>
      <p style="margin-bottom:10px;color:#ccc">捕获了 ${newSp.name} Lv.${newInst.level}。选择一只放生，或放弃新伙伴：</p>
      <div id="panel-body"></div>`;
    const body = el.querySelector('#panel-body');
    g.party.members.forEach((m, i) => {
      const sp = getSpecies(m.speciesKey);
      const d = document.createElement('div');
      d.className = 'mon-card';
      d.innerHTML = `<div class="dot" style="background:${speciesColor(m.speciesKey)}"></div>
        <div class="info"><div class="nm">${sp.name} Lv.${m.level}</div>
        <div class="sub">HP ${m.curHp}/${m.maxHp}</div></div>`;
      d.appendChild(mkBtn('放生它', 'small red', () => {
        this.closePanel();
        onDone({ action: 'release', index: i });
      }));
      body.appendChild(d);
    });
    body.appendChild(mkBtn(`放弃 ${newSp.name}`, 'gold', () => {
      this.closePanel();
      onDone({ action: 'drop' });
    }));
  }

  // ============ 进化演出（§7.3：白光闪烁→剪影渐变→星星爆发；Esc 取消） ============
  startEvolution(inst, evo, onDone) {
    const g = this.game;
    this.evoState = { inst, evo, t: 0, phase: 'flash', onDone, canceled: false };
    this.game.mode = 'evolution';
    const fromSp = getSpecies(inst.speciesKey);
    const toSp = getSpecies(evo.to);
    this.evoEl.classList.remove('hidden');
    this.evoEl.querySelector('.stage').textContent = `什么？${fromSp.name} 的样子……！`;
    g.audio.jingle('evolution');
    g.audio.sfx('evolve_start');
    // 用两张模型快照 canvas 做剪影渐变（简化：文字 + 白光闪烁 + 粒子由场景播）
    this._evoNames = [fromSp.name, toSp.name];
  }

  cancelEvolution() {
    const e = this.evoState;
    if (!e || e.phase !== 'flash') return;   // 只有闪烁阶段（应用前）可取消
    e.canceled = true;
    this._endEvolution(false);
  }

  updateEvolution(dt) {
    const e = this.evoState;
    if (!e) return;
    e.t += dt;
    const cv = this.evoEl.querySelector('.evo-canvas');
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 300, 300);
    if (e.phase === 'flash') {
      // 白光闪烁 1.6s
      const flash = Math.sin(e.t * 18) > 0;
      ctx.fillStyle = flash ? '#fff' : '#666';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this._evoNames[0], 150, 160);
      if (e.t > 1.6) {
        e.phase = 'transform';
        e.t = 0;
        // 应用进化
        this._evoResult = this.game.applyEvolutionNow(e.inst, e.evo);
      }
    } else if (e.phase === 'transform') {
      // 剪影渐变 1.2s
      const r = Math.min(1, e.t / 1.2);
      ctx.fillStyle = '#888';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this._evoNames[0], 150 - r * 100, 160);
      ctx.fillStyle = '#FCDC5F';
      ctx.fillText(this._evoNames[1], 150 + (1 - r) * 100, 160);
      if (r >= 1) {
        e.phase = 'done';
        e.t = 0;
        this.evoEl.querySelector('.stage').textContent = `恭喜！${this._evoNames[0]} 进化成了 ${this._evoNames[1]}！`;
        this.game.audio.jingle('evolution');
      }
    } else if (e.phase === 'done' && e.t > 1.8) {
      this._endEvolution(true);
    }
  }

  _endEvolution(success) {
    const e = this.evoState;
    this.evoState = null;
    this.evoEl.classList.add('hidden');
    this.game.mode = 'play';
    if (!success) this.game.ui.announce('进化被取消了……');
    e.onDone?.(success);
  }

  closePanel() {
    this.openPanelName = null;
    this.panelEl.classList.add('hidden');
    if (this.game.mode === 'panel') this.game.mode = this._prePanelMode === 'title' ? 'title' : 'play';
    this._prePanelMode = null;
  }
}

function mkBtn(label, cls, onclick) {
  const b = document.createElement('button');
  b.className = 'mc-btn ' + cls;
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

function speciesColor(key) {
  const sp = getSpecies(key);
  return { normal: '#A8A878', fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030', rock: '#B8A038', poison: '#A040A0', ghost: '#705898', ice: '#98D8D8', psychic: '#F85888' }[sp.types[0]] || '#fff';
}

function typeColor(t) { return speciesColorType(t) || '#fff'; }
function speciesColorType(t) {
  return { normal: '#A8A878', fire: '#F08030', water: '#6890F0', grass: '#78C850', electric: '#F8D030', rock: '#B8A038', poison: '#A040A0', ghost: '#705898', ice: '#98D8D8', psychic: '#F85888' }[t];
}
