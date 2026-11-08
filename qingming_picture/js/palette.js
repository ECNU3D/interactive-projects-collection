// 绢本设色调色板 —— 统一的古画配色
export const P = {
  // 环境
  silk:      0xd9c9a3,   // 绢底
  fogColor:  0xd3c29a,
  skyTop:    0xc4b48d,
  skyBottom: 0xe6d8b4,

  // 地面
  earth:     0xb09a6e,   // 土路
  earthDark: 0x9a8258,
  grass:     0x9aa06a,   // 春草（偏黄绿，古画感）
  grassDry:  0xb0a870,
  field1:    0x8f9c62,
  field2:    0xa8a468,
  field3:    0x979062,
  mud:       0x8a7250,
  paving:    0xa89878,   // 城内砖石
  riverbed:  0x6f6248,

  // 水
  waterDeep:    0x5f7a6e,
  waterShallow: 0x8fa48c,

  // 建筑
  woodDark:  0x6b4a30,   // 深木梁柱
  wood:      0x8a6540,   // 木墙板
  woodLight: 0xa8845c,
  column:    0x7a4632,   // 柱（偏赭红）
  wallWhite: 0xcfc2a2,   // 粉墙（偏米）
  wallEarth: 0xb5a37e,   // 夯土墙
  tile:      0x5b5e64,   // 青瓦
  tileDark:  0x4a4d54,
  thatch:    0xa08d5c,   // 茅草
  thatchDark:0x86744a,
  brick:     0x8f8878,   // 城墙砖
  brickDark: 0x77705f,
  ridge:     0x3e4046,   // 屋脊

  // 装饰
  lattice:   0x5c4128,   // 木格窗
  banner:    0xc8b890,   // 酒旗布
  bannerRed: 0x9e3428,
  huanmen:   0xb5763c,   // 彩楼欢门彩帛
  huanmen2:  0x7d8a56,
  lantern:   0xc27544,
  paper:     0xd8cba6,

  // 桥与船
  bridgeWood: 0x93683e,
  bridgeRail: 0x7a5230,
  boatHull:   0x6e4f32,
  boatDark:   0x543a24,
  mat:        0xb3a172,  // 苇席/船篷
  rope:       0x9c8a62,

  // 植物
  trunk:     0x6a5138,
  willow:    0x8fa055,
  willowD:   0x76884a,
  peach:     0xc9a3a0,
  pine:      0x5e6e4e,
  leaf:      0x84905c,
  bare:      0x7a6748,   // 秃枝

  // 人物
  skin:      0xc8a882,
  hatStraw:  0xb3a067,
  hatBlack:  0x33291c,

  // 动物
  donkey:  0x6e6258,
  donkeyD: 0x57493e,
  camel:   0xa08050,
  camelD:  0x8a6c40,
  ox:      0x5a4a3a,
  pig:     0x3a322a,
  dog:     0x8a7a5e,
  horse:   0x704f38,
  horseD:  0x4e3626,
};

// 平民袍色（灰调）与体面人袍色（微彩）
export const ROBES = [
  0x7d7460, 0x8a8068, 0x6d7a6a, 0x9c8e6e, 0x5c6656, 0x8f7f5c,
  0xa89878, 0x746a52, 0x86685a, 0x63594a, 0x99a084, 0x7f6f66,
  0xb0a488, 0x6a5c48, 0x58504a, 0x92846a,
];
export const ROBES_RICH = [ 0x8a4438, 0x4a5a70, 0x6a4a68, 0x3e5648, 0x8a6a2e, 0x5c3a30 ];

export function vary(hex, amt = 0.06) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const f = 1 + (Math.random() * 2 - 1) * amt;
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
