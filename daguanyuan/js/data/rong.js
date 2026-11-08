// 榮國府 —— 中路（五道禮儀之門）、西路（賈母院·鳳姐院·李紈院）、東路（賈赦東院·書房·議事廳）、東北服務區
// 依第三回黛玉進府路線：西角門 → 一射之地 → 垂花門 → 抄手遊廊 → 穿堂（大理石大插屏）
//                    → 小小三間廳 → 正房大院 → 正面五間上房 → 兩邊穿山遊廊廂房
import { P } from './../palette.js';
import { RONG } from './../layout.js';
import { wallRun, corridor } from './../parts.js';
import { COUPLETS } from './../plaques.js';

const GX = RONG.gateX;          // -91.2 榮國府大門中線

export const RONG_DEFS = [
  // ---------------------------------------------------------------- 府牆
  {
    id: 'rong-wall', name: '荣国府', x0: RONG.x0, z0: RONG.z0, x1: RONG.x1, z1: RONG.z1,
    wall: false, region: true, cull: false,
    extra(gb) {
      const W = { h: 4.6, color: P.qingzhuan, ch: 'brick' };
      const fx = (x, a, b) => (x - a) / (b - a);
      // 南牆：大門居中留 18m；西角門（黛玉自此入）在 x=-137
      wallRun(gb, { x0: RONG.x0, z0: 0, x1: GX - 9, z1: 0, ...W, gapAt: fx(-137, RONG.x0, GX - 9), gapW: 4.6 });
      wallRun(gb, { x0: GX + 9, z0: 0, x1: RONG.x1, z1: 0, ...W });
      // 西牆
      wallRun(gb, { x0: RONG.x0, z0: RONG.z0, x1: RONG.x0, z1: 0, ...W });
      // 東牆：北段開口通寧榮夾道（省親後已連屬）
      wallRun(gb, { x0: RONG.x1, z0: RONG.z0, x1: RONG.x1, z1: 0, ...W, gapAt: 0.10, gapW: 9 });
      // 北牆：通後街（西角門對著大觀園西角門），東段群房已拆
      wallRun(gb, { x0: RONG.x0, z0: RONG.z0, x1: -56, z1: RONG.z0, ...W, gapAt: fx(-150, RONG.x0, -56), gapW: 6 });
      wallRun(gb, { x0: -32, z0: RONG.z0, x1: RONG.x1, z1: RONG.z0, ...W, gapAt: 0.5, gapW: 5 });
    },
  },

  // ---------------------------------------------------------------- 中路
  {
    id: 'rong-gate', name: '荣国府大门', x0: GX - 26, z0: -32, x1: GX + 26, z1: 2, wall: false,
    gates: [{ side: 'S', type: 'gate', x: GX, z: -4, bays: 3, bayW: 5.0, depth: 7,
      rank: 2, name: '敕造榮國府', lions: true }],
    pave: [[GX, -21, 34, 22, 'mandi', P.mandi]],
    yingbi: [[GX, -24, Math.PI, 9, 4.6]],
    vats: [[GX - 9.5, 3.5], [GX + 9.5, 3.5]],
    flags: [[GX - 17, 7, 10], [GX + 17, 7, 10]],
    trees: [['song', GX - 21, -27, 1.1], ['song', GX + 21, -27, 1.1]],
  },
  {
    id: 'rong-yimen', name: '荣府仪门', x0: GX - 24, z0: -56, x1: GX + 24, z1: -32, wall: false,
    buildings: [{ x: GX, z: -44, bays: 3, bayW: 4.8, depth: 5.5, rank: 2, roof: 'yingshan',
      name: '儀門', front: 'gate', back: 'gate', enterable: true }],
    pave: [[GX, -48, 30, 20, 'mandi', P.mandi]],
    trees: [['huai', GX - 18, -52, 1.2], ['huai', GX + 18, -52, 1.2]],
  },
  {
    id: 'rong-dating', name: '荣府大厅', x0: GX - 27, z0: -92, x1: GX + 27, z1: -56, wall: false,
    // 「大廳（暖閣）」——中路第二重，五間
    buildings: [
      { x: GX, z: -76, bays: 5, bayW: 4.8, depth: 11, rank: 2, roof: 'xieshan', enterable: true },
      { x: GX - 21, z: -64, rot: Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
      { x: GX + 21, z: -64, rot: -Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
    ],
    pave: [[GX, -62, 34, 12, 'mandi', P.mandi]],
    corridors: [{ pts: [[GX - 25, -58], [GX - 25, -70]] }, { pts: [[GX + 25, -58], [GX + 25, -70]] }],
    tables: [[GX - 14, -60]],
  },
  {
    id: 'rong-neimen', name: '荣府内三门', x0: GX - 22, z0: -134, x1: GX + 22, z1: -92, wall: false,
    buildings: [
      { x: GX, z: -100, bays: 3, bayW: 4.6, depth: 5, rank: 2, roof: 'yingshan', front: 'gate', back: 'gate', enterable: true },
      { x: GX, z: -117, bays: 3, bayW: 4.6, depth: 5, rank: 2, roof: 'yingshan', name: '內儀門', front: 'gate', back: 'gate', enterable: true },
      { x: GX, z: -130, bays: 3, bayW: 4.2, depth: 4, rank: 3, roof: 'juanpeng', front: 'gate', back: 'gate', enterable: true },
    ],
    pave: [[GX, -112, 20, 32, 'mandi', P.mandi]],
    extra(gb) {
      corridor(gb, [[GX - 20, -98], [GX - 20, -132]]);
      corridor(gb, [[GX + 20, -98], [GX + 20, -132]]);
    },
  },
  {
    id: 'rong-rongxitang', name: '荣禧堂', x0: GX - 30, z0: -168, x1: GX + 46, z1: -134, wall: false,
    buildings: [
      { x: GX, z: -152, bays: 5, bayW: 4.8, depth: 11, rank: 2, roof: 'yingshan',
        name: '榮禧堂', couplet: COUPLETS[4], enterable: true, porch: true },
      // 第三回：王夫人「時常居坐宴息，亦不在這正室，只在這正室東邊的三間耳房內」
      { x: GX + 32, z: -148, bays: 3, bayW: 4.0, depth: 7, rank: 3, roof: 'yingshan', enterable: true },
      { x: GX - 25, z: -144, rot: Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
    ],
    pave: [[GX + 4, -140, 48, 10, 'mandi', P.mandi]],
    corridors: [{ pts: [[GX + 14, -140], [GX + 28, -140]] }],
    vats: [[GX - 13, -141], [GX + 13, -141]],
    trees: [['gui', GX - 19, -137, 1.0], ['gui', GX + 19, -137, 1.0]],
  },
  {
    id: 'rong-houzhao', name: '荣府后罩房', x0: GX - 34, z0: -197, x1: GX + 34, z1: -168, wall: false,
    buildings: [{ x: GX, z: -188, bays: 7, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan', name: '後罩房' }],
    pave: [[GX, -176, 60, 10, 'brick', P.qingzhuan]],
    wells: [[GX - 26, -178]],
  },

  // ---------------------------------------------------------------- 西路：賈母院
  {
    id: 'rong-jiamu', name: '贾母院', x0: -174, z0: -128, x1: -120, z1: -52,
    wall: { h: 3.8, color: P.fenqiang, ch: 'plaster' },
    gates: [{ side: 'S', type: 'chuihua', x: -147, z: -52, w: 4.8 }],
    buildings: [
      // 「轉過插屏，小小的三間廳，廳後就是後面的正房大院」
      { x: -147, z: -76, bays: 3, bayW: 4.2, depth: 6, rank: 2, roof: 'juanpeng', front: 'open', back: 'open' },
      // 「正面五間上房，皆雕梁畫棟」
      { x: -147, z: -104, bays: 5, bayW: 4.8, depth: 10.5, rank: 2, roof: 'yingshan',
        name: '榮慶堂', enterable: true, porch: true },
      // 「兩邊穿山遊廊廂房」
      { x: -169, z: -90, rot: Math.PI / 2, bays: 3, bayW: 3.8, depth: 6.5, rank: 3, roof: 'yingshan' },
      { x: -125, z: -90, rot: -Math.PI / 2, bays: 3, bayW: 3.8, depth: 6.5, rank: 3, roof: 'yingshan' },
      { x: -147, z: -122, bays: 5, bayW: 3.4, depth: 5, rank: 3, roof: 'yingshan' },
    ],
    // 「兩邊是抄手遊廊」
    corridors: [
      { pts: [[-152, -56], [-166, -56], [-166, -84]] },
      { pts: [[-142, -56], [-128, -56], [-128, -84]] },
      { pts: [[-166, -96], [-166, -110], [-152, -110]] },
      { pts: [[-128, -96], [-128, -110], [-142, -110]] },
    ],
    pave: [[-147, -88, 22, 18, 'mandi', P.mandi]],
    trees: [['hai', -158, -84, 1.1], ['hai', -136, -84, 1.1], ['song', -164, -118, 1.2], ['gui', -130, -118, 1.0]],
    rocks: [[-147, -64, 1.1, 21]],
    vats: [[-155, -70], [-139, -70]],
    tables: [[-136, -114]],
    bushes: [[-160, -74, 1.2, 0xd6e4c4, 31], [-134, -74, 1.2, 0xe0c4d8, 33]],
  },
  {
    id: 'rong-fengjie', name: '凤姐院', x0: -174, z0: -166, x1: -128, z1: -132,
    wall: { h: 3.6 },
    gates: [{ side: 'S', type: 'plain', x: -151, z: -132, w: 3.2 }],
    buildings: [
      { x: -151, z: -157, bays: 3, bayW: 4.4, depth: 8.5, rank: 2, roof: 'yingshan', enterable: true, porch: true },
      { x: -170, z: -145, rot: Math.PI / 2, bays: 2, bayW: 3.4, depth: 5.5, rank: 3, roof: 'yingshan' },
      { x: -132, z: -145, rot: -Math.PI / 2, bays: 2, bayW: 3.4, depth: 5.5, rank: 3, roof: 'yingshan' },
    ],
    corridors: [{ pts: [[-160, -138], [-160, -148]] }, { pts: [[-142, -138], [-142, -148]] }],
    pave: [[-151, -142, 16, 12, 'mandi', P.mandi]],
    trees: [['hai', -162, -137, 0.9], ['tao', -140, -137, 0.9]],
    vats: [[-157, -136]],
  },
  {
    id: 'rong-linwan', name: '李纨院', x0: -174, z0: -198, x1: -134, z1: -170,
    wall: { h: 3.5 },
    gates: [{ side: 'S', type: 'plain', x: -154, z: -170, w: 3.0 }],
    buildings: [
      { x: -154, z: -190, bays: 3, bayW: 4.0, depth: 7.5, rank: 3, roof: 'yingshan' },
      { x: -170, z: -180, rot: Math.PI / 2, bays: 2, bayW: 3.2, depth: 5, rank: 4, roof: 'yingshan' },
    ],
    pave: [[-154, -178, 14, 10, 'brick', P.qingzhuan]],
    trees: [['li', -164, -176, 1.0]],
    bamboo: [[-140, -178, 3.5, 22, 41]],
  },
  {
    id: 'rong-maju', name: '荣府马厩车房', x0: -176, z0: -48, x1: -152, z1: -6, wall: false,
    buildings: [
      { x: -168, z: -30, rot: -Math.PI / 2, bays: 6, bayW: 3.2, depth: 5.5, rank: 4, roof: 'yingshan',
        name: '馬廄', front: 'open' },
    ],
    troughs: [[-158, -30, 2.4, 10]],
    pave: [[-160, -20, 26, 24, 'brick', P.qingzhuan]],
    trees: [['huai', -156, -12, 1.2]],
  },

  // ---------------------------------------------------------------- 東路：賈赦東院
  {
    id: 'rong-jiashe', name: '贾赦东院', x0: -66, z0: -80, x1: -8, z1: -4,
    wall: { h: 4.0, color: P.fenqiang },
    // 第三回：「亦出了西角門，往東過榮府正門，便入一黑油大門中，至儀門前方下來」
    gates: [{ side: 'S', type: 'gate', x: -37, z: -10, bays: 3, bayW: 4.2, depth: 5.5, rank: 3, name: '賈赦東院' }],
    buildings: [
      // 「進入三層儀門，果見正房廂廡遊廊，悉皆小巧別致」
      { x: -37, z: -28, bays: 3, bayW: 4.0, depth: 4.5, rank: 3, roof: 'juanpeng', front: 'gate', back: 'gate', enterable: true },
      { x: -37, z: -42, bays: 3, bayW: 4.0, depth: 4.5, rank: 3, roof: 'juanpeng', front: 'gate', back: 'gate', enterable: true },
      { x: -37, z: -70, bays: 5, bayW: 4.2, depth: 9, rank: 2, roof: 'yingshan', enterable: true, porch: true },
      { x: -60, z: -58, rot: Math.PI / 2, bays: 3, bayW: 3.4, depth: 5.5, rank: 3, roof: 'juanpeng' },
      { x: -14, z: -58, rot: -Math.PI / 2, bays: 3, bayW: 3.4, depth: 5.5, rank: 3, roof: 'juanpeng' },
    ],
    corridors: [{ pts: [[-55, -50], [-55, -62]] }, { pts: [[-19, -50], [-19, -62]] }],
    pave: [[-37, -54, 20, 16, 'cobble', P.luanshi]],
    trees: [['gui', -50, -50, 0.9], ['mei', -24, -50, 0.9], ['song', -58, -18, 1.0]],
    rocks: [[-37, -20, 0.9, 51]],
    tables: [[-48, -64, 0.75]],
  },
  {
    id: 'rong-jiuyuan', name: '荣府旧园', x0: -66, z0: -108, x1: -8, z1: -80, wall: false,
    // 第十六回：「賈赦住的乃是榮府舊園，其中竹樹山石以及亭榭欄杆等物，皆可挪就前來」——建園時已搬走大半
    pavilions: [{ x: -50, z: -96, r: 2.8, name: '折帶朱欄' }],
    rocks: [[-24, -92, 1.5, 61], [-34, -102, 1.0, 63]],
    trees: [['liu', -14, -96, 1.2], ['song', -60, -104, 1.1]],
    bamboo: [[-40, -88, 5, 26, 65]],
    bushes: [[-30, -84, 1.3, 0xd6e4c4, 67]],
  },
  {
    id: 'rong-mengpo', name: '梦坡斋', x0: -66, z0: -136, x1: -22, z1: -110,
    wall: { h: 3.4 },
    gates: [{ side: 'S', type: 'plain', x: -44, z: -110, w: 3.0, name: '夢坡齋' }],
    buildings: [{ x: -44, z: -128, bays: 3, bayW: 4.0, depth: 7, rank: 3, roof: 'juanpeng', enterable: true }],
    pave: [[-44, -118, 14, 10, 'cobble', P.luanshi]],
    trees: [['gui', -28, -118, 0.9]],
    bamboo: [[-58, -118, 3.2, 18, 71]],
    rocks: [[-30, -132, 0.8, 73]],
  },
  {
    id: 'rong-qixian', name: '绮霰斋', x0: -66, z0: -170, x1: -22, z1: -140,
    wall: { h: 3.4 },
    gates: [{ side: 'S', type: 'plain', x: -46, z: -140, w: 3.0, name: '綺霰齋' }],
    buildings: [
      { x: -46, z: -158, bays: 3, bayW: 3.8, depth: 6.5, rank: 3, roof: 'juanpeng' },
      { x: -30, z: -168, rot: Math.PI, bays: 4, bayW: 3.4, depth: 5.5, rank: 3, roof: 'yingshan', name: '議事廳' },
    ],
    pave: [[-46, -148, 12, 10, 'cobble', P.luanshi]],
    trees: [['hai', -58, -148, 0.9], ['mei', -32, -148, 0.9]],
  },

  // ---------------------------------------------------------------- 東北：梨香院與服務區
  {
    id: 'rong-lixiang', name: '梨香院', x0: -60, z0: -199, x1: -16, z1: -174,
    // 第四回：「乃當日榮公暮年養靜之所……另有一門通街，薛公子等日後出入亦甚便宜」
    wall: { h: 3.6 },
    gates: [
      { side: 'S', type: 'plain', x: -38, z: -174, w: 3.2, name: '梨香院' },
      { side: 'N', type: 'plain', x: -38, z: -199, w: 3.0 },
    ],
    buildings: [
      { x: -38, z: -193, bays: 5, bayW: 3.8, depth: 8, rank: 3, roof: 'yingshan', enterable: true },
      { x: -56, z: -183, rot: Math.PI / 2, bays: 2, bayW: 3.2, depth: 5, rank: 3, roof: 'yingshan' },
      { x: -20, z: -183, rot: -Math.PI / 2, bays: 2, bayW: 3.2, depth: 5, rank: 3, roof: 'yingshan' },
    ],
    pave: [[-38, -182, 16, 10, 'mandi', P.mandi]],
    trees: [['li', -48, -179, 1.1], ['li', -28, -179, 1.1]],
    wells: [[-52, -196]],
  },
  {
    id: 'rong-service', name: '荣府库房厨房', x0: -128, z0: -198, x1: -66, z1: -172, wall: false,
    buildings: [
      { x: -114, z: -192, bays: 5, bayW: 3.4, depth: 5.5, rank: 4, roof: 'yingshan', name: '庫房' },
      { x: -80, z: -192, bays: 5, bayW: 3.4, depth: 5.5, rank: 4, roof: 'yingshan', name: '大廚房' },
      { x: -98, z: -176, rot: Math.PI, bays: 4, bayW: 3.2, depth: 5, rank: 4, roof: 'yingshan', name: '賬房' },
    ],
    pave: [[-98, -184, 56, 6, 'brick', P.qingzhuan]],
    wells: [[-70, -186]],
    trees: [['yu', -124, -176, 1.0]],
  },
  {
    id: 'rong-qunfang', name: '荣府群房', x0: -122, z0: -196, x1: -104, z1: -110, wall: false,
    buildings: [
      { x: -118, z: -122, rot: -Math.PI / 2, bays: 4, bayW: 3.0, depth: 5, rank: 4, roof: 'yingshan' },
      { x: -118, z: -150, rot: -Math.PI / 2, bays: 4, bayW: 3.0, depth: 5, rank: 4, roof: 'yingshan' },
      { x: -118, z: -172, rot: -Math.PI / 2, bays: 3, bayW: 3.0, depth: 5, rank: 4, roof: 'yingshan' },
    ],
    pave: [[-110, -147, 6, 72, 'brick', P.qingzhuan]],
  },
];
