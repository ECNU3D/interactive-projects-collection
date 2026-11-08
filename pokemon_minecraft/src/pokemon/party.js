// 队伍系统（设计文档 §7.4）：上限 6 只；第 7 只触发放生面板；不做 PC 仓库
export const PARTY_MAX = 6;

export class Party {
  constructor() { this.members = []; this.activeIndex = 0; }

  get active() { return this.members[this.activeIndex] || null; }

  isFull() { return this.members.length >= PARTY_MAX; }

  add(inst) {
    if (this.isFull()) return false;
    this.members.push(inst);
    return true;
  }

  remove(index) {
    if (index < 0 || index >= this.members.length) return null;
    const [removed] = this.members.splice(index, 1);
    if (this.activeIndex >= this.members.length) this.activeIndex = 0;
    return removed;
  }

  // 下一只可出战（HP>0）的成员索引；没有则返回 -1
  nextUsable(fromIndex = this.activeIndex) {
    for (let i = 1; i <= this.members.length; i++) {
      const idx = (fromIndex + i) % this.members.length;
      if (this.members[idx] && this.members[idx].curHp > 0) return idx;
    }
    return -1;
  }

  switchTo(index) {
    if (index >= 0 && index < this.members.length && this.members[index].curHp > 0) {
      this.activeIndex = index;
      return true;
    }
    return false;
  }

  allFainted() { return this.members.every(m => m.curHp <= 0); }

  healAll() {
    for (const m of this.members) {
      m.curHp = m.maxHp;
      m.status = null;
      m.statusData = null;
      m.volatile = [];
    }
  }

  // 队伍未出战成员分得 50% 经验
  distributeExp(amount, activeShare = 1) {
    const gains = [];
    this.members.forEach((m, i) => {
      const share = i === this.activeIndex ? amount : Math.floor(amount * 0.5);
      if (share > 0 && m.curHp > 0) gains.push({ index: i, amount: share });
    });
    return gains;
  }
}
