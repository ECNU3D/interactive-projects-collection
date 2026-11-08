/**
 * style.ts —— UI 样式｜文档 03 §8.2
 * 极简，不做拟物边框；对话框半透明深色底 + 一条金线；全部渐显渐隐。
 */
export const UI_CSS = `
.tg-ui { font-family: "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif; color: #f0e8d8;
  -webkit-font-smoothing: antialiased; user-select: none; }
.tg-fade { transition: opacity .45s ease; }

/* HUD：极简方位 + 区域名（常驻 UI 只有这两个，文档 03 §8.2） */
#tg-compass { position: fixed; top: 18px; left: 50%; transform: translateX(-50%);
  font-size: 13px; letter-spacing: .35em; color: rgba(240,232,216,.75); pointer-events: none; z-index: 20; }
#tg-region { position: fixed; top: 44px; left: 50%; transform: translateX(-50%);
  font-size: 22px; letter-spacing: .5em; text-indent: .5em; color: rgba(240,226,188,.95);
  text-shadow: 0 1px 12px rgba(0,0,0,.5); pointer-events: none; z-index: 20; opacity: 0; }
#tg-prompt { position: fixed; left: 50%; bottom: 22%; transform: translateX(-50%);
  font-size: 15px; color: #ffe9b8; letter-spacing: .2em; pointer-events: none; z-index: 20;
  text-shadow: 0 1px 8px rgba(0,0,0,.6); opacity: 0; }
#tg-hint { position: fixed; left: 24px; bottom: 20px; font-size: 12px; color: rgba(240,232,216,.5);
  letter-spacing: .15em; pointer-events: none; z-index: 20; line-height: 1.9; }

/* 固定参考框（晕动症缓解，文档 02 §4.4） */
#tg-frame { position: fixed; inset: 0; pointer-events: none; z-index: 15; display: none;
  border: 22px solid rgba(20,14,30,.35); box-shadow: inset 0 0 0 1px rgba(232,180,85,.25); }

/* 对话框 */
#tg-dialogue { position: fixed; left: 50%; bottom: 6vh; transform: translateX(-50%);
  width: min(760px, 86vw); z-index: 30; opacity: 0; pointer-events: none; }
#tg-dialogue.open { opacity: 1; pointer-events: auto; }
#tg-dlg-speaker { font-size: 15px; color: #e8b455; letter-spacing: .3em; margin-bottom: 8px; }
#tg-dlg-box { background: rgba(18,12,28,.72); border-top: 1px solid rgba(232,180,85,.75);
  padding: 18px 26px 20px; min-height: 74px; backdrop-filter: blur(6px); }
#tg-dlg-text { font-size: 19px; line-height: 1.85; letter-spacing: .06em; }
#tg-dlg-text .quote-mark { color: #e8b455; cursor: pointer; border-bottom: 1px dashed rgba(232,180,85,.6);
  font-size: 12px; margin-left: 6px; vertical-align: super; }
#tg-dlg-next { text-align: right; font-size: 12px; color: rgba(240,232,216,.45); margin-top: 6px; letter-spacing: .2em; }
#tg-topics { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.tg-topic { background: rgba(18,12,28,.6); border-left: 2px solid rgba(232,180,85,.55);
  padding: 9px 18px; font-size: 16px; cursor: pointer; letter-spacing: .08em; transition: background .25s; }
.tg-topic:hover { background: rgba(60,44,20,.75); }
/* 退出按钮（说书用）：线性播放没有话题分支，得给个看得见的出口 */
.tg-dismiss { display: block; margin: 8px 0 0 auto; font-family: inherit;
  background: rgba(18,12,28,.72); color: rgba(240,232,216,.8);
  border: 1px solid rgba(232,180,85,.45); border-radius: 2px;
  padding: 7px 20px; font-size: 13px; letter-spacing: .2em; cursor: pointer;
  transition: background .25s, color .25s; }
.tg-dismiss:hover { background: rgba(60,44,20,.85); color: #ffe9b8; }

/* 考据栏（可折叠右侧栏，默认收起；古籍页面质感，朱笔批注） */
#tg-annotation { position: fixed; right: 0; top: 0; height: 100%; width: 320px; z-index: 25;
  background: linear-gradient(to left, rgba(24,18,14,.92), rgba(24,18,14,.82));
  border-left: 1px solid rgba(232,180,85,.4); padding: 28px 22px;
  transform: translateX(100%); transition: transform .5s ease; overflow-y: auto; }
#tg-annotation.open { transform: translateX(0); }
#tg-annotation h3 { font-size: 17px; color: #e8d9a0; letter-spacing: .3em; margin: 0 0 14px;
  border-bottom: 1px solid rgba(232,180,85,.3); padding-bottom: 10px; }
#tg-annotation .anno-src { color: #c2402f; font-size: 13px; letter-spacing: .1em; margin: 10px 0 4px; } /* 朱笔批注色 */
#tg-annotation .anno-body { font-size: 14px; line-height: 1.9; color: rgba(240,232,216,.85); }
#tg-annotation .anno-self { font-size: 12px; color: #b9a8cf; border: 1px solid rgba(139,111,176,.4);
  padding: 2px 8px; display: inline-block; margin-top: 6px; }
#tg-anno-toggle { position: fixed; right: 18px; top: 50%; z-index: 26; writing-mode: vertical-rl;
  background: rgba(18,12,28,.6); color: #e8d9a0; border: 1px solid rgba(232,180,85,.4);
  font-size: 13px; letter-spacing: .3em; padding: 14px 7px; cursor: pointer; }

/* 设置面板 */
#tg-settings { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: min(560px, 90vw); max-height: 82vh; overflow-y: auto; z-index: 60;
  background: rgba(18,12,28,.94); border: 1px solid rgba(232,180,85,.5); padding: 26px 30px; display: none; }
#tg-settings.open { display: block; }
#tg-settings h3 { margin: 0 0 16px; font-size: 18px; letter-spacing: .4em; color: #e8d9a0; }
.tg-set-row { display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid rgba(232,180,85,.12); font-size: 14px; letter-spacing: .1em; }
.tg-set-row select, .tg-set-row input[type=range] { accent-color: #e8b455; background: #241a38; color: #f0e8d8;
  border: 1px solid rgba(232,180,85,.4); font-family: inherit; padding: 3px 8px; font-size: 13px; }
#tg-settings .tg-close { margin-top: 18px; text-align: center; }
#tg-settings button { font-family: inherit; background: rgba(232,180,85,.1); color: #f0e2bc;
  border: 1px solid rgba(232,180,85,.55); padding: 8px 30px; font-size: 14px; letter-spacing: .3em; cursor: pointer; }

/* ── 小地图：右上常驻，右侧挂五层标尺（垂直位置一眼可见） ── */
#tg-minimap { position: fixed; top: 18px; right: 18px; z-index: 22; display: flex; gap: 8px;
  align-items: flex-start; pointer-events: none; }
.tg-mini-plate { position: relative; background: rgba(18,12,28,.62);
  border: 1px solid rgba(232,180,85,.42); backdrop-filter: blur(4px); }
.tg-mini-canvas { display: block; }
.tg-mini-label { position: absolute; left: 0; right: 0; bottom: 0; text-align: center;
  font-size: 11px; letter-spacing: .22em; color: rgba(240,226,188,.92); padding: 4px 0 5px;
  background: linear-gradient(to top, rgba(18,12,28,.85), transparent);
  text-shadow: 0 1px 6px rgba(0,0,0,.7); }
#tg-layer-ruler { display: flex; flex-direction: column; gap: 1px; padding: 4px 0;
  background: rgba(18,12,28,.62); border: 1px solid rgba(232,180,85,.28); backdrop-filter: blur(4px); }
.tg-ruler-row { display: flex; align-items: center; gap: 5px; font-size: 10px; letter-spacing: .12em;
  color: rgba(240,232,216,.42); border-right: 2px solid transparent; padding: 3px 5px 3px 7px; transition: color .3s; }
.tg-ruler-row.on { color: #ffe9b8; border-right-color: #e8b455; }
.tg-ruler-num { color: inherit; opacity: .8; }
.tg-ruler-name { writing-mode: horizontal-tb; }

/* ── 全图（M 键） ── */
#tg-fullmap { position: fixed; inset: 0; z-index: 55; display: flex; align-items: center;
  justify-content: center; opacity: 0; pointer-events: none; transition: opacity .35s ease;
  background: radial-gradient(ellipse at 50% 50%, rgba(36,26,56,.82) 0%, rgba(12,9,20,.93) 70%); }
#tg-fullmap.open { opacity: 1; pointer-events: auto; }
.tg-fullmap-inner { background: rgba(18,12,28,.78); border: 1px solid rgba(232,180,85,.5);
  padding: 22px 26px 18px; max-height: 92vh; overflow-y: auto; }
.tg-fullmap-title { font-size: 17px; letter-spacing: .5em; text-indent: .5em; color: #e8d9a0;
  text-align: center; margin-bottom: 14px; }
.tg-fullmap-lore { text-align: center; font-size: 12px; letter-spacing: .3em;
  color: #e8b455; margin: -6px 0 12px; }
.tg-full-canvas { display: block; margin: 0 auto; }
.tg-fullmap-list { margin-top: 14px; border-top: 1px solid rgba(232,180,85,.2); padding-top: 12px; }
.tg-fm-row { display: flex; gap: 14px; font-size: 12px; line-height: 2; letter-spacing: .1em;
  color: rgba(240,232,216,.45); }
.tg-fm-row.on { color: rgba(240,232,216,.9); }
.tg-fm-layer { flex: 0 0 84px; color: #e8b455; opacity: .75; }
.tg-fm-row.on .tg-fm-layer { opacity: 1; }
.tg-fm-names b { color: #ffe9b8; font-weight: normal; border-bottom: 1px solid rgba(232,180,85,.6); }
.tg-fullmap-foot { margin-top: 12px; text-align: center; font-size: 11px; letter-spacing: .2em;
  color: rgba(240,232,216,.35); }

@media (max-width: 720px) {
  #tg-minimap { top: 12px; right: 12px; transform: scale(.82); transform-origin: top right; }
}

/* 移动端虚拟摇杆 */
.tg-stick { position: fixed; bottom: 9vh; width: 110px; height: 110px; border-radius: 50%;
  border: 1px solid rgba(240,232,216,.35); background: rgba(18,12,28,.3); z-index: 40; touch-action: none; }
#tg-stick-l { left: 6vw; }
#tg-stick-r { right: 6vw; }
.tg-stick .nub { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; border-radius: 50%;
  background: rgba(232,180,85,.35); transform: translate(-50%,-50%); }
`;
