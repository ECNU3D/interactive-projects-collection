// UI 门面：合并 HUD 与 Panels，对游戏逻辑暴露统一接口
import { HUD } from './hud.js';
import { Panels } from './panels.js';

export class UI {
  constructor(game) {
    this.hud = new HUD(game);
    this.panels = new Panels(game);
  }
  show() { this.hud.show(); }
  update(dt) {
    this.hud.update(dt);
    this.panels.updateDialog(dt);
    this.panels.updateEvolution(dt);
  }
  get modalOpen() { return this.panels.modalOpen; }
  // HUD 直通
  damageText(...a) { this.hud.damageText(...a); }
  floatText(...a) { this.hud.floatText(...a); }
  announce(...a) { this.hud.announce(...a); }
  hint(...a) { this.hud.hint(...a); }
  flashVignette(...a) { this.hud.flashVignette(...a); }
  showInteractTip(...a) { this.hud.showInteractTip(...a); }
  refreshParty(...a) { this.hud.refreshParty(...a); }
  refreshActive(...a) { this.hud.refreshActive(...a); }
  refreshItems(...a) { this.hud.refreshItems(...a); }
  refreshSkills(...a) { this.hud.refreshSkills(...a); }
  refreshMoney(...a) { this.hud.refreshMoney(...a); }
  // Panels 直通
  showDialog(...a) { this.panels.showDialog(...a); }
  advanceDialog() { this.panels.advanceDialog(); }
  closeDialog() { this.panels.closeDialog(); }
  showConfirm(...a) { this.panels.showConfirm(...a); }
  openShop(...a) { this.panels.openShop(...a); }
  openMenu(...a) { this.panels.openMenu(...a); }
  togglePartyPanel(...a) { this.panels.togglePartyPanel(...a); }
  closePanel(...a) { this.panels.closePanel(...a); }
  showMoveReplace(...a) { this.panels.showMoveReplace(...a); }
  showReleasePanel(...a) { this.panels.showReleasePanel(...a); }
  startEvolution(...a) { this.panels.startEvolution(...a); }
  cancelEvolution(...a) { this.panels.cancelEvolution(...a); }
}
