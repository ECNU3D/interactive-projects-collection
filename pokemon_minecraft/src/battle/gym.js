// 道馆系统（设计文档 §12）：村庄内进入独立竞技场，依次 1v1 车轮战
import { GYMS, GYM_MOVESETS } from '../data/gyms.js';
import { Creature } from '../entity/creature.js';
import { createInstance } from '../pokemon/stats.js';
import { DIALOGUES } from '../data/dialogues.js';

export class GymSystem {
  constructor(game) {
    this.game = game;
    this.active = null;      // { gym, index, creatures: [] }
  }

  // 按 F 进入道馆
  enter(gymType, village) {
    const g = this.game;
    const gym = GYMS[gymType];
    if (g.badges.has(gym.badge)) {
      g.ui.showDialog({ lines: [{ speaker: gym.leaderName, text: '你已经拿到' + gym.badge + '了，去挑战更强的对手吧！' }] });
      return;
    }
    g.ui.showConfirm(`挑战${gym.name}？\n馆主${gym.leaderName} · 推荐等级 ${gym.recLevel}\n（3 只车轮战，场间不回复）`, () => this.startBattle(gym, village));
  }

  startBattle(gym, village) {
    const g = this.game;
    const arena = g.world.buildArena(gym.id);
    g.playerInGym = { gym, arena, returnPos: g.player.pos.clone() };
    g.spawner.clearAll();
    g.combat.aggroSet.clear();
    // 传送玩家进竞技场
    g.player.spawnAt(arena.playerX, arena.floorY + 1, arena.playerZ);
    for (let i = 0; i < 40; i++) g.world.ensureChunks(arena.playerX, arena.playerZ);
    this.active = { gym, arena, index: 0, creatures: [] };
    // 馆主战前台词（语音）
    const introKey = gym.id === 'rock' ? 'gym_rock_intro' : 'gym_fire_intro';
    g.ui.showDialog({
      lines: [{ voice: introKey, speaker: gym.leaderName, text: DIALOGUES[introKey].text }],
      onEnd: () => this.spawnNext(),
    });
    g.audio?.bgm('battle_gym');
  }

  spawnNext() {
    const g = this.game;
    const { gym, index } = this.active;
    if (index >= gym.team.length) { this.victory(); return; }
    const member = gym.team[index];
    const inst = createInstance(member.species, member.level, { moves: GYM_MOVESETS[member.species] });
    const c = new Creature(g, inst, { wild: false, gymMon: true });
    c.placeAt(this.active.arena.enemyX + 0.5, this.active.arena.floorY + 1.02, this.active.arena.enemyZ + 0.5);
    c.homePos = c.pos.clone();
    c.state = 'alert';
    c.stateT = 0;
    this.active.creatures.push(c);
    g.spawner.creatures.push(c);
    this.active.index++;
    g.ui.announce(`${gym.leaderName} 派出了 ${c.species.name} Lv.${member.level}!`);
    g.audio?.cry(c.species.id, 'encounter');
    // 立即仇恨玩家
    setTimeout(() => { if (!c.fainted) { c.state = 'chase'; g.combat.onAggro(c); } }, 800);
  }

  update(dt) {
    if (!this.active) return;
    // 当前对手倒下 → 下一只
    const cur = this.active.creatures[this.active.creatures.length - 1];
    if (cur && cur.fainted && cur.faintT > 0.6) {
      this.spawnNext();
    }
  }

  victory() {
    const g = this.game;
    const gym = this.active.gym;
    const loseKey = gym.id === 'rock' ? 'gym_rock_lose' : 'gym_fire_lose';
    g.audio?.jingle('victory');
    g.ui.showDialog({
      lines: [{ voice: loseKey, speaker: gym.leaderName, text: DIALOGUES[loseKey].text }],
      onEnd: () => {
        g.badges.add(gym.badge);
        g.addMoney(gym.reward.money);
        for (const it of gym.reward.items) g.addItem(it.id, it.count);
        g.audio?.sfx('badge');
        g.audio?.jingle('victory');
        const narratorKey = gym.id === 'rock' ? 'narrator_badge_rock' : 'narrator_badge_fire';
        g.ui.showDialog({
          lines: [{ voice: narratorKey, speaker: '系统', text: `获得了${gym.badge}！奖金 ¥${gym.reward.money}！` }],
          onEnd: () => this.exit(),
        });
        g.saveGame?.();
      },
    });
  }

  // 全灭被送出（道馆重置）
  onBlackout() {
    if (this.active) {
      this.game.ui.announce('挑战失败……被送出了道馆');
      this.exit(true);
    }
  }

  exit(failed = false) {
    const g = this.game;
    if (this.active) {
      for (const c of this.active.creatures) { if (!c.removeMe) { c.removeMe = true; c.dispose(); } }
      g.spawner.creatures = g.spawner.creatures.filter(c => !c.gymMon);
      this.active = null;
    }
    const ret = g.playerInGym?.returnPos;
    g.playerInGym = null;
    if (ret) {
      g.player.pos.copy(ret);
      g.player.vel.set(0, 0, 0);
    }
    g._scheduleAmbientBgm?.();
  }
}
