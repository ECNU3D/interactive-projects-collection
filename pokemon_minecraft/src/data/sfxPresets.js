// 8-bit 程序化音效配方（设计文档 §14.4）：一种技能一条配方，运行时 Web Audio 合成
// 每条配方 = 图层数组；图层字段:
//   src:'tone'|'noise'  声源（振荡器/噪声）
//   wave: 振荡器波形 (square|sawtooth|triangle|sine)
//   freq/freqEnd: 起始/结束频率 Hz（滑音），dur: 时长秒，vol: 音量 0~1
//   filter:{type:'lowpass'|'highpass', freq, freqEnd} 可选滤波扫频
//   delay: 图层延迟秒
export const SFX_PRESETS = {
  // ---- 属性技能音 ----
  electric: [ {src:'tone', wave:'square', freq:1800, freqEnd:400, dur:0.12, vol:0.5},
              {src:'noise', dur:0.1, vol:0.3, filter:{type:'highpass', freq:3000}},
              {src:'tone', wave:'square', freq:2400, freqEnd:900, dur:0.08, vol:0.35, delay:0.06} ],
  fire:     [ {src:'noise', dur:0.35, vol:0.4, filter:{type:'lowpass', freq:4000, freqEnd:400}},
              {src:'tone', wave:'sawtooth', freq:120, freqEnd:60, dur:0.3, vol:0.3} ],
  water:    [ {src:'noise', dur:0.25, vol:0.35, filter:{type:'highpass', freq:1200}},
              {src:'tone', wave:'sine', freq:800, freqEnd:200, dur:0.22, vol:0.4} ],
  grass:    [ {src:'tone', wave:'sawtooth', freq:600, freqEnd:1800, dur:0.1, vol:0.35} ],
  rock:     [ {src:'tone', wave:'square', freq:90, freqEnd:50, dur:0.18, vol:0.55},
              {src:'noise', dur:0.12, vol:0.4, filter:{type:'lowpass', freq:800}} ],
  ghost:    [ {src:'tone', wave:'triangle', freq:400, freqEnd:250, dur:0.45, vol:0.4},
              {src:'tone', wave:'triangle', freq:405, freqEnd:255, dur:0.45, vol:0.25, delay:0.05} ],
  psychic:  [ {src:'tone', wave:'triangle', freq:900, freqEnd:1400, dur:0.3, vol:0.3},
              {src:'tone', wave:'sine', freq:1350, freqEnd:2100, dur:0.25, vol:0.2, delay:0.05} ],
  ice:      [ {src:'tone', wave:'sine', freq:2600, freqEnd:3200, dur:0.07, vol:0.4},
              {src:'tone', wave:'sine', freq:3100, freqEnd:2400, dur:0.07, vol:0.35, delay:0.07},
              {src:'tone', wave:'sine', freq:3600, freqEnd:2900, dur:0.09, vol:0.3, delay:0.14} ],
  poison:   [ {src:'tone', wave:'sine', freq:300, freqEnd:80, dur:0.25, vol:0.4},
              {src:'noise', dur:0.2, vol:0.25, filter:{type:'lowpass', freq:1200}} ],

  // ---- 通用命中 ----
  hit_normal: [ {src:'tone', wave:'square', freq:220, freqEnd:110, dur:0.07, vol:0.5} ],
  hit_super:  [ {src:'tone', wave:'square', freq:880, dur:0.08, vol:0.5},
                {src:'tone', wave:'square', freq:1320, dur:0.12, vol:0.5, delay:0.09} ],
  miss:       [ {src:'noise', dur:0.08, vol:0.2, filter:{type:'highpass', freq:2000}} ],

  // ---- UI ----
  ui_blip:   [ {src:'tone', wave:'square', freq:1200, dur:0.04, vol:0.3} ],
  ui_page:   [ {src:'tone', wave:'square', freq:900, freqEnd:1400, dur:0.06, vol:0.3} ],
  ui_error:  [ {src:'tone', wave:'square', freq:200, dur:0.12, vol:0.35},
               {src:'tone', wave:'square', freq:160, dur:0.15, vol:0.35, delay:0.1} ],
  ui_buy:    [ {src:'tone', wave:'square', freq:1000, dur:0.05, vol:0.35},
               {src:'tone', wave:'square', freq:1500, dur:0.08, vol:0.35, delay:0.06} ],
  ui_heal:   [ {src:'tone', wave:'sine', freq:660, dur:0.1, vol:0.3},
               {src:'tone', wave:'sine', freq:880, dur:0.1, vol:0.3, delay:0.1},
               {src:'tone', wave:'sine', freq:1320, dur:0.18, vol:0.3, delay:0.2} ],

  // ---- 精灵球组 ----
  ball_throw:  [ {src:'tone', wave:'sine', freq:400, freqEnd:1200, dur:0.18, vol:0.35} ],
  ball_absorb: [ {src:'tone', wave:'sine', freq:1400, freqEnd:300, dur:0.3, vol:0.4} ],
  ball_shake:  [ {src:'tone', wave:'square', freq:500, dur:0.05, vol:0.35},
                 {src:'tone', wave:'square', freq:500, dur:0.05, vol:0.35, delay:0.12} ],
  ball_click:  [ {src:'tone', wave:'square', freq:800, dur:0.04, vol:0.4} ],
  ball_break:  [ {src:'noise', dur:0.15, vol:0.4, filter:{type:'highpass', freq:2500}} ],
  ball_success:[ {src:'tone', wave:'square', freq:1046, dur:0.09, vol:0.4},
                 {src:'tone', wave:'square', freq:1318, dur:0.09, vol:0.4, delay:0.09},
                 {src:'tone', wave:'square', freq:1568, dur:0.16, vol:0.4, delay:0.18} ],

  // ---- 异常状态特征短音 ----
  status_para:    [ {src:'tone', wave:'square', freq:2000, freqEnd:600, dur:0.09, vol:0.4},
                    {src:'tone', wave:'square', freq:1800, freqEnd:500, dur:0.09, vol:0.35, delay:0.1} ],
  status_poison:  [ {src:'tone', wave:'sine', freq:250, freqEnd:90, dur:0.28, vol:0.4} ],
  status_sleep:   [ {src:'tone', wave:'sine', freq:700, freqEnd:300, dur:0.4, vol:0.3} ],
  status_burn:    [ {src:'noise', dur:0.25, vol:0.35, filter:{type:'lowpass', freq:2000, freqEnd:300}} ],
  status_freeze:  [ {src:'tone', wave:'sine', freq:2800, freqEnd:2000, dur:0.2, vol:0.35} ],
  status_confuse: [ {src:'tone', wave:'triangle', freq:600, freqEnd:900, dur:0.15, vol:0.3},
                    {src:'tone', wave:'triangle', freq:900, freqEnd:600, dur:0.15, vol:0.3, delay:0.15} ],

  // ---- 成长/事件 ----
  levelup:   [ {src:'tone', wave:'square', freq:523, dur:0.08, vol:0.35},
               {src:'tone', wave:'square', freq:659, dur:0.08, vol:0.35, delay:0.08},
               {src:'tone', wave:'square', freq:784, dur:0.08, vol:0.35, delay:0.16},
               {src:'tone', wave:'square', freq:1046, dur:0.2, vol:0.4, delay:0.24} ],
  exp_gain:  [ {src:'tone', wave:'square', freq:1568, dur:0.03, vol:0.2} ],
  evolve_start:[ {src:'tone', wave:'sawtooth', freq:200, freqEnd:2000, dur:1.2, vol:0.3} ],
  money:     [ {src:'tone', wave:'square', freq:1800, dur:0.05, vol:0.3},
               {src:'tone', wave:'square', freq:2400, dur:0.09, vol:0.3, delay:0.05} ],
  jump:      [ {src:'tone', wave:'square', freq:300, freqEnd:600, dur:0.1, vol:0.25} ],
  land:      [ {src:'tone', wave:'square', freq:150, freqEnd:80, dur:0.08, vol:0.25} ],
  hurt:      [ {src:'tone', wave:'square', freq:180, freqEnd:90, dur:0.12, vol:0.4} ],
  faint:     [ {src:'tone', wave:'sawtooth', freq:400, freqEnd:60, dur:0.5, vol:0.4} ],
  run_away:  [ {src:'tone', wave:'square', freq:800, freqEnd:1600, dur:0.15, vol:0.3} ],
  chest:     [ {src:'tone', wave:'square', freq:700, dur:0.07, vol:0.35},
               {src:'tone', wave:'square', freq:1050, dur:0.12, vol:0.35, delay:0.08} ],
  badge:     [ {src:'tone', wave:'square', freq:784, dur:0.1, vol:0.4},
               {src:'tone', wave:'square', freq:988, dur:0.1, vol:0.4, delay:0.1},
               {src:'tone', wave:'square', freq:1175, dur:0.1, vol:0.4, delay:0.2},
               {src:'tone', wave:'square', freq:1568, dur:0.25, vol:0.45, delay:0.3} ],
};

// 精灵叫声合成（§14.4）：按图鉴 id 程序化派生参数，同族异形态共享变调
export function cryParams(speciesId) {
  // 确定性伪随机（同一种叫声固定）
  let s = speciesId * 2654435761 >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const base = 300 + rnd() * 900;
  const dir = rnd() > 0.5 ? 1 : -1;
  const dur = 0.2 + rnd() * 0.35;
  const waves = ['square','sawtooth','triangle'];
  return {
    wave: waves[Math.floor(rnd() * 3)],
    freq: base,
    freqEnd: Math.max(80, base + dir * (150 + rnd() * 600)),
    dur,
    chirp: rnd() > 0.6,   // 双音节
  };
}
