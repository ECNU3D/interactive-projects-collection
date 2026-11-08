// 赤壁之战 · UI 模块 —— 开场帘/字幕/事件标题/时间轴/阵营图例/工具栏/落幕
import { EVENTS, BATTLE_DURATION } from './script.js';

export function createUI(handlers) {
  const $ = (tag, id, parent = document.body, cls = '') => {
    const el = document.createElement(tag);
    if (id) el.id = id;
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
  };

  // ---- 开场帘 ----
  const overlay = $('div', 'startOverlay');
  overlay.innerHTML = `
    <div class="ov-box">
      <div class="ov-era">建安十三年 · 公元 208 年冬</div>
      <h1>赤 壁 之 战</h1>
      <div class="ov-sub">曹操二十万众陈兵乌林 · 孙刘联军五万屯于赤壁<br/>第三方视角 · 实时推演</div>
      <button id="startBtn">进 入 战 场</button>
      <div class="ov-tip">建议开启声音 · 含 AI 生成解说与配乐</div>
    </div>`;
  overlay.querySelector('#startBtn').onclick = () => {
    overlay.classList.add('hide');
    setTimeout(() => overlay.remove(), 900);
    handlers.onStart?.();
  };

  // ---- 字幕 ----
  const subtitle = $('div', 'subtitle');
  let subT = null;
  function showSubtitle(text) {
    subtitle.textContent = text;
    subtitle.classList.add('show');
    clearTimeout(subT);
    subT = setTimeout(() => subtitle.classList.remove('show'), 9000);
  }

  // ---- 事件标题 ----
  const toast = $('div', 'toast');
  let toastT = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  // ---- 时间轴 ----
  const tl = $('div', 'timeline');
  const fill = $('div', 'tlFill', tl);
  const marks = new Map();
  for (const ev of EVENTS) {
    const m = $('div', '', tl, 'tlMark');
    m.style.left = `${(ev.t / BATTLE_DURATION) * 100}%`;
    m.innerHTML = `<i></i><span>${ev.title}</span>`;
    marks.set(ev.id, m);
  }

  // ---- 阵营图例 ----
  const legend = $('div', 'legend');
  legend.innerHTML = `
    <div class="lg-title">赤壁 · 建安十三年</div>
    <div class="lg-row"><i style="background:#262a33"></i>魏 · 曹军水寨（北岸乌林）</div>
    <div class="lg-row"><i style="background:#274d31"></i>吴 · 周瑜水军（南岸）</div>
    <div class="lg-row"><i style="background:#6e241c"></i>汉 · 刘备军（南岸东翼）</div>
    <div class="lg-row"><i style="background:#a8761f"></i>黄盖火攻船队</div>`;

  // ---- 工具栏 ----
  const bar = $('div', 'toolbar');
  const btnCam = $('button', '', bar, 'tb');
  btnCam.textContent = '自由视角';
  btnCam.onclick = () => {
    const free = handlers.onToggleCamera?.();
    btnCam.textContent = free ? '跟随运镜' : '自由视角';
    btnCam.classList.toggle('on', !!free);
  };
  const btnMute = $('button', '', bar, 'tb');
  btnMute.textContent = '静音';
  btnMute.onclick = () => {
    const m = handlers.onMute?.();
    btnMute.textContent = m ? '取消静音' : '静音';
    btnMute.classList.toggle('on', !!m);
  };
  const btnReplay = $('button', '', bar, 'tb');
  btnReplay.textContent = '重新上演';
  // 剥掉 ?autostart/?seek 等调试参数，保证回到"点击开始"的开场帘
  btnReplay.onclick = () => location.href = location.pathname;
  const btnViewer = $('a', '', bar, 'tb');
  btnViewer.textContent = '模型赏析';
  btnViewer.href = './viewer.html';
  btnViewer.target = '_blank';

  // ---- 落幕 ----
  function showEnd() {
    const end = $('div', 'endCard');
    end.innerHTML = `
      <div class="ov-box">
        <h1>赤 壁 之 战</h1>
        <div class="ov-sub">曹操北还 · 三分天下之势成<br/><br/>大江东去，浪淘尽，千古风流人物</div>
        <button id="endReplay">重 新 上 演</button>
      </div>`;
    end.querySelector('#endReplay').onclick = () => location.href = location.pathname;
    requestAnimationFrame(() => end.classList.add('show'));
  }

  return {
    subtitle: showSubtitle,
    toast: showToast,
    markEvent(id) { marks.get(id)?.classList.add('hit'); },
    setProgress(k) { fill.style.width = `${Math.min(k, 1) * 100}%`; },
    showEnd,
  };
}
