// 村庄人口（设计文档 §4.3）：护士常驻、商人按日随机、村民随机游荡
import { meshFromVox } from '../voxel/mesher.js';
import { buildNurse, buildMerchant, buildVillager } from '../voxel/models/npc.js';
import { VILLAGER_CHATTER, TUTORIAL_LINES, DIALOGUES } from '../data/dialogues.js';
import { dailyRareItems } from '../data/shopData.js';

const VILLAGER_NAMES = ['小岩', '阿明', '花花', '大树', '阿福', '小梅', '铁蛋', '兰兰', '老伯', '柱子', '翠花', '二牛'];

let NPCID = 1;

export class NPC {
  constructor(game, kind, model, x, y, z, opts = {}) {
    this.id = NPCID++;
    this.game = game;
    this.kind = kind;                       // nurse | merchant | villager
    this.model = model;
    this.pos = new THREE.Vector3(x, y, z);
    this.homePos = this.pos.clone();
    this.model.position.copy(this.pos);
    this.village = opts.village || null;
    this.name = opts.name || '';
    this.variant = opts.variant ?? 0;
    this.faceYaw = Math.random() * Math.PI * 2;
    this.model.rotation.y = this.faceYaw;
    this.wanderT = 0;
    this.wanderTarget = null;
    this.moveTime = 0;
    this.lastGreetAt = -999;
    game.scene.add(this.model);
    // 商人头顶 $ 浮动标记（§4.3）
    if (kind === 'merchant' || kind === 'nurse') {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.textAlign = 'center';
      if (kind === 'merchant') {
        ctx.font = 'bold 48px sans-serif';
        ctx.fillStyle = '#FCDC5F';
        ctx.strokeStyle = '#3e3308';
        ctx.lineWidth = 6;
        ctx.strokeText('$', 32, 46);
        ctx.fillText('$', 32, 46);
      } else {
        // 护士：红十字标记
        ctx.fillStyle = '#F8F8F8';
        ctx.fillRect(10, 10, 44, 44);
        ctx.fillStyle = '#E03A3A';
        ctx.fillRect(26, 16, 12, 32);
        ctx.fillRect(16, 26, 32, 12);
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
      sp.scale.set(0.7, 0.7, 1);
      sp.position.y = 2.1;
      this.model.add(sp);
      this.dollarSign = sp;
    }
  }

  update(dt) {
    // 村民在村内游荡
    if (this.kind === 'villager') {
      this.wanderT -= dt;
      if (this.wanderTarget) {
        const dx = this.wanderTarget.x - this.pos.x, dz = this.wanderTarget.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5) { this.wanderTarget = null; this.wanderT = 2 + Math.random() * 5; }
        else {
          const ang = Math.atan2(dx, dz);
          this.faceYaw = ang;
          this.pos.x += Math.sin(ang) * 1.1 * dt;
          this.pos.z += Math.cos(ang) * 1.1 * dt;
          this.moveTime += dt;
        }
      } else if (this.wanderT <= 0 && this.village) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (this.village.r - 6);
        this.wanderTarget = { x: this.village.x + Math.sin(a) * r, z: this.village.z + Math.cos(a) * r };
      }
      this.model.position.copy(this.pos);
      this.model.position.y = this.pos.y + (this.wanderTarget ? Math.abs(Math.sin(this.moveTime * 6)) * 0.06 : 0);
    } else {
      // 护士/商人原地呼吸浮动
      this.model.position.y = this.pos.y + Math.sin(performance.now() * 0.002 + this.id) * 0.03;
    }
    if ((this.kind === 'merchant' || this.kind === 'nurse') && this.dollarSign) {
      this.dollarSign.position.y = 2.1 + Math.sin(performance.now() * 0.003) * 0.12;
    }
    // 面向靠近的玩家
    const p = this.game.player.pos;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (d < 4) this.faceYaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let dy = this.faceYaw - this.model.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.model.rotation.y += dy * Math.min(1, 8 * dt);
  }

  dispose() { this.game.scene.remove(this.model); }
}

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.npcs = [];
  }

  // 进入世界时生成人口（§4.3 规则）
  populate(dayRoll = Math.random) {
    this.clearAll();
    const g = this.game;
    for (const v of g.world.villages) {
      // 护士常驻
      const ns = v.npcSpots.nurse;
      this.npcs.push(new NPC(g, 'nurse', meshFromVox('npc_nurse', buildNurse(), 1 / 8), ns.x + 0.5, ns.y, ns.z + 0.5, { village: v, name: '护士' }));
      // 村民 3~6 名
      const count = 3 + Math.floor(dayRoll() * 4);
      for (let i = 0; i < count; i++) {
        const variant = Math.floor(dayRoll() * 4);
        const name = VILLAGER_NAMES[Math.floor(dayRoll() * VILLAGER_NAMES.length)];
        const a = dayRoll() * Math.PI * 2, r = 4 + dayRoll() * (v.r - 10);
        const x = v.x + Math.sin(a) * r, z = v.z + Math.cos(a) * r;
        this.npcs.push(new NPC(g, 'villager', meshFromVox('npc_villager' + variant, buildVillager(variant), 1 / 8), x + 0.5, v.baseH + 1, z + 0.5, { village: v, name, variant }));
      }
    }
    this.placeMerchant();
  }

  // 商人：每个游戏日 70% 概率出现在随机村庄摊位（§4.3）
  placeMerchant() {
    const g = this.game;
    this.npcs = this.npcs.filter(n => { if (n.kind === 'merchant') { n.dispose(); return false; } return true; });
    const roll = Math.random();
    const state = { present: roll < 0.7, village: null, rareItems: [], day: g.world.dayCount };
    if (state.present) {
      const vi = Math.floor(Math.random() * g.world.villages.length);
      const v = g.world.villages[vi];
      state.village = v.key;
      state.rareItems = dailyRareItems(g.world.dayCount, Math.random);
      const ms = v.npcSpots.merchant;
      this.npcs.push(new NPC(g, 'merchant', meshFromVox('npc_merchant', buildMerchant(), 1 / 8), ms.x + 0.5, ms.y, ms.z + 0.5, { village: v, name: '道具商人' }));
    }
    g.merchantState = state;
  }

  // 新的一天：重掷商人
  onNewDay() { this.placeMerchant(); }

  nearest(x, z, maxDist = 2.8) {
    let best = null, bd = maxDist;
    for (const n of this.npcs) {
      const d = Math.hypot(n.pos.x - x, n.pos.z - z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  update(dt) { for (const n of this.npcs) n.update(dt); }

  clearAll() { for (const n of this.npcs) n.dispose(); this.npcs = []; }

  // 对话内容（返回 {lines:[{voice,text,speaker}], onEnd}）
  getDialog(npc) {
    const g = this.game;
    const now = g.time;
    if (npc.kind === 'nurse') {
      return {
        lines: [{ voice: 'nurse_welcome', speaker: '护士', text: DIALOGUES.nurse_welcome.text }],
        choices: [
          { label: '恢复健康', action: () => g.nurseHeal(npc) },
          { label: '离开', action: null },
        ],
      };
    }
    if (npc.kind === 'merchant') {
      return {
        lines: [{ voice: 'merchant_welcome', speaker: '道具商人', text: DIALOGUES.merchant_welcome.text }],
        choices: [
          { label: '购买道具', action: () => g.ui.openShop('buy') },
          { label: '出售道具', action: () => g.ui.openShop('sell') },
          { label: '离开', action: null },
        ],
      };
    }
    // 村民闲聊（带预生成语音 id，§14.3）
    const profile = 'villager_' + ['m', 'f', 'o', 'm'][npc.variant % 4];
    const pool = VILLAGER_CHATTER[profile] || VILLAGER_CHATTER.villager_m;
    let text, voice = null;
    if (npc.village?.key === 'grass' && npc.id % 3 === 0) {
      text = TUTORIAL_LINES[Math.floor(Math.random() * TUTORIAL_LINES.length)];
    } else {
      const i = Math.floor(Math.random() * pool.length);
      text = pool[i];
      voice = `chatter_${profile}_${i}`;
    }
    return { lines: [{ voice, speaker: npc.name, text }] };
  }
}
