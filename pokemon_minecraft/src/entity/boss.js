// 结局 Boss（v4 新增）：雪山深处沉睡的巨大卡比兽（呼应村民传闻"雪山深处有只很大的宝可梦"）
// 集齐 2 枚徽章后可唤醒挑战；击败或捕获即通关（结局记录到存档）
import { Creature } from './creature.js';
import { createInstance } from '../pokemon/stats.js';

export const BOSS_SPOT = { x: 80, z: 256 };      // 雪山深处（西侧）
export const BOSS_LEVEL = 40;
export const BOSS_BADGES_REQUIRED = 2;

export class Boss {
  constructor(game) {
    this.game = game;
    // 整平一块 Boss 空地，让巨大卡比兽清晰可见、易于抵达
    const spot = game.world.carveClearing(BOSS_SPOT.x, BOSS_SPOT.z, 7);
    this.spot = spot;
    const inst = createInstance('snorlax', BOSS_LEVEL);
    inst.maxHp = Math.floor(inst.maxHp * 1.5);        // Boss 强化：HP ×1.5
    inst.curHp = inst.maxHp;
    const c = new Creature(game, inst, { wild: false });
    c.boss = true;
    c.placeAt(spot.x + 0.5, game.world.effH(spot.x, spot.z) + 1.02, spot.z + 0.5);
    c.homePos = c.pos.clone();
    c.model.scale.setScalar(2 / 8);                   // 巨大化（2 倍模型）
    c.half = 0.6;
    c.height = 1.6;
    c.bossSleeping = true;
    game.spawner.creatures.push(c);
    this.creature = c;
  }

  get defeated() { return this.creature.fainted || this.creature.removeMe; }

  update(dt) {
    const c = this.creature, g = this.game;
    if (this.defeated) return;
    if (c.bossSleeping) {
      c.vel.x = 0; c.vel.z = 0;
      // 熟睡 Z 粒子
      if (c.distToPlayer() < 50 && Math.random() < dt * 1.5) {
        g.particles.spawn(c.pos.x, c.pos.y + 1.8, c.pos.z,
          { color: 0x88A8F8, count: 1, spread: 0.2, up: 0.8, life: 1.2, gravity: -1.2 });
      }
      return;
    }
    // 玩家跑远：回血重新入睡（Boss 战重置）
    if (c.distToPlayer() > 50) {
      c.bossSleeping = true;
      c.inst.curHp = c.inst.maxHp;
      c.state = 'wander';
      c.target = null;
      g.combat.onDeaggro(c);
    }
  }

  // F 交互：唤醒挑战
  tryInteract() {
    const g = this.game, c = this.creature;
    if (this.defeated || !c.bossSleeping) return false;
    if (c.distToPlayer() > 4.5) return false;
    if (g.badges.size < BOSS_BADGES_REQUIRED) {
      g.ui.showDialog({ lines: [{ speaker: '卡比兽', text: `卡比兽挡住了去路，正在熟睡……\n（需要集齐 ${BOSS_BADGES_REQUIRED} 枚徽章才能挑战，当前 ${g.badges.size}/${BOSS_BADGES_REQUIRED}）` }] });
    } else {
      g.ui.showConfirm(`唤醒沉睡的卡比兽，发起最终挑战吗？\nLv.${BOSS_LEVEL} · 巨大化 Boss · HP 强化`, () => this.wake());
    }
    document.exitPointerLock?.();
    return true;
  }

  wake() {
    const g = this.game, c = this.creature;
    c.bossSleeping = false;
    c.state = 'alert';
    c.stateT = 0;
    g.combat.onAggro(c);
    g.audio.cry(c.species.id, 'encounter');
    g.audio.bgm('battle_gym');
    g.ui.announce('卡比兽醒来了！！');
  }
}
