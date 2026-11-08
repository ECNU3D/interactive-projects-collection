// 讲解触发点（对应 audio/*.mp3 与 narrations.json）
// 半径保证沿主路（z≈0）行走即可触发；触发瞬间可通过 cue 召回移动场景元素
export const POIS = [
  { id: 'xumu',     x: 85,  z: 0,   r: 16 },
  { id: 'caoyun',   x: 376, z: -16, r: 17 },
  { id: 'feihong',  x: 398, z: 0,   r: 11 },
  { id: 'xianqing', x: 436, z: 0,   r: 10 },
  { id: 'zhengdao', x: 471, z: 0,   r: 10 },
  { id: 'jiaodian', x: 504, z: -10, r: 11 },
  { id: 'xinjiu',   x: 526, z: 5,   r: 10 },
  { id: 'chengmen', x: 655, z: 0,   r: 13 },
  { id: 'shuiwu',   x: 684, z: 8,   r: 12 },
  { id: 'sunyang',  x: 768, z: -8,  r: 13 },
  { id: 'zhima',    x: 814, z: 10,  r: 11 },
  { id: 'yinzi',    x: 845, z: -10, r: 11 },
  { id: 'taicheng', x: 924, z: -8,  r: 13 },
];
