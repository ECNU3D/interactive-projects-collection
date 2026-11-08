// 寧國府 —— 中路九重（大門·儀門·大廳暖閣·內廳·內三門·內儀門·內塞門·正堂·後罩房）
// 徐建平考證：「書中明確交代：大門、儀門、大廳（暖閣）、內廳、內三門、內儀門、內塞門，正堂。
//              大門三間，正堂五間」——規制同清代貝勒府。
import { P } from './../palette.js';
import { NING } from './../layout.js';
import { wallRun, corridor } from './../parts.js';

const GX = NING.gateX;          // 91.2

export const NING_DEFS = [
  {
    id: 'ning-wall', name: '宁国府', x0: NING.x0, z0: NING.z0, x1: NING.x1, z1: NING.z1,
    wall: false, region: true, cull: false,
    extra(gb) {
      const W = { h: 4.6, color: P.qingzhuan, ch: 'brick' };
      wallRun(gb, { x0: NING.x0, z0: 0, x1: GX - 9, z1: 0, ...W, gapAt: 0.55, gapW: 4.4 });
      wallRun(gb, { x0: GX + 9, z0: 0, x1: NING.x1, z1: 0, ...W, gapAt: 0.6, gapW: 4.4 });
      wallRun(gb, { x0: NING.x1, z0: NING.z0, x1: NING.x1, z1: 0, ...W });
      // 西牆：北段開口通寧榮夾道
      wallRun(gb, { x0: NING.x0, z0: NING.z0, x1: NING.x0, z1: 0, ...W, gapAt: 0.10, gapW: 9 });
      // 北牆：會芳園一帶牆垣樓閣已拆（第十六回），直通大觀園
      wallRun(gb, { x0: NING.x0, z0: NING.z0, x1: 96, z1: NING.z0, ...W, gapAt: 0.5, gapW: 5 });
      wallRun(gb, { x0: 138, z0: NING.z0, x1: NING.x1, z1: NING.z0, ...W });
    },
  },

  // ---------------------------------------------------------------- 中路
  {
    id: 'ning-gate', name: '宁国府大门', x0: GX - 26, z0: -32, x1: GX + 26, z1: 2, wall: false,
    gates: [{ side: 'S', type: 'gate', x: GX, z: -4, bays: 3, bayW: 5.0, depth: 7,
      rank: 2, name: '敕造寧國府', lions: true }],
    pave: [[GX, -21, 34, 22, 'mandi', P.mandi]],
    yingbi: [[GX, -24, Math.PI, 9, 4.6]],
    vats: [[GX - 9.5, 3.5], [GX + 9.5, 3.5]],
    flags: [[GX - 17, 7, 10], [GX + 17, 7, 10]],
    trees: [['song', GX - 21, -27, 1.1], ['song', GX + 21, -27, 1.1]],
  },
  {
    id: 'ning-yimen', name: '宁府仪门', x0: GX - 24, z0: -56, x1: GX + 24, z1: -32, wall: false,
    buildings: [{ x: GX, z: -44, bays: 3, bayW: 4.8, depth: 5.5, rank: 2, roof: 'yingshan',
      name: '儀門', front: 'gate', back: 'gate', enterable: true }],
    pave: [[GX, -48, 30, 20, 'mandi', P.mandi]],
    trees: [['huai', GX - 18, -52, 1.2], ['huai', GX + 18, -52, 1.2]],
  },
  {
    id: 'ning-dating', name: '宁府大厅', x0: GX - 27, z0: -88, x1: GX + 27, z1: -56, wall: false,
    buildings: [
      { x: GX, z: -74, bays: 5, bayW: 4.8, depth: 11, rank: 2, roof: 'xieshan', enterable: true },
      { x: GX - 21, z: -63, rot: Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
      { x: GX + 21, z: -63, rot: -Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
    ],
    pave: [[GX, -61, 34, 10, 'mandi', P.mandi]],
    corridors: [{ pts: [[GX - 25, -58], [GX - 25, -68]] }, { pts: [[GX + 25, -58], [GX + 25, -68]] }],
  },
  {
    id: 'ning-neiting', name: '宁府内厅', x0: GX - 24, z0: -146, x1: GX + 24, z1: -88, wall: false,
    buildings: [
      { x: GX, z: -100, bays: 5, bayW: 4.4, depth: 9, rank: 2, roof: 'yingshan', enterable: true },
      { x: GX, z: -120, bays: 3, bayW: 4.6, depth: 4.5, rank: 2, roof: 'yingshan', front: 'gate', back: 'gate', enterable: true },
      { x: GX, z: -132, bays: 3, bayW: 4.4, depth: 4.5, rank: 2, roof: 'yingshan', name: '內儀門', front: 'gate', back: 'gate', enterable: true },
      { x: GX, z: -142, bays: 3, bayW: 4.2, depth: 4, rank: 3, roof: 'juanpeng', front: 'gate', back: 'gate', enterable: true },
    ],
    pave: [[GX, -128, 20, 34, 'mandi', P.mandi]],
    extra(gb) {
      corridor(gb, [[GX - 21, -118], [GX - 21, -144]]);
      corridor(gb, [[GX + 21, -118], [GX + 21, -144]]);
    },
  },
  {
    id: 'ning-zhengtang', name: '宁府正堂', x0: GX - 30, z0: -178, x1: GX + 30, z1: -146, wall: false,
    buildings: [
      { x: GX, z: -162, bays: 5, bayW: 4.8, depth: 11, rank: 2, roof: 'yingshan', enterable: true, porch: true },
      { x: GX - 25, z: -154, rot: Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
      { x: GX + 25, z: -154, rot: -Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
    ],
    pave: [[GX, -151, 40, 10, 'mandi', P.mandi]],
    vats: [[GX - 13, -152], [GX + 13, -152]],
    trees: [['gui', GX - 20, -149, 1.0], ['gui', GX + 20, -149, 1.0]],
  },
  {
    id: 'ning-houzhao', name: '宁府后罩房', x0: GX - 34, z0: -198, x1: GX + 34, z1: -178, wall: false,
    buildings: [{ x: GX, z: -190, bays: 7, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan', name: '後罩房' }],
    pave: [[GX, -180, 60, 8, 'brick', P.qingzhuan]],
    wells: [[GX - 26, -181]],
  },

  // ---------------------------------------------------------------- 西路：宗祠、叢綠堂、玄真觀
  {
    id: 'ning-zongci', name: '贾氏宗祠', x0: 12, z0: -78, x1: 64, z1: -18,
    // 第五十三回：「賈氏宗祠……但見院中白石甬路，兩邊皆是蒼松翠柏」
    wall: { h: 4.2, color: P.fenqiang },
    gates: [{ side: 'S', type: 'gate', x: 38, z: -24, bays: 3, bayW: 4.2, depth: 5, rank: 2, name: '賈氏宗祠' }],
    buildings: [
      { x: 38, z: -66, bays: 5, bayW: 4.4, depth: 9.5, rank: 2, roof: 'xieshan', enterable: true },
      { x: 18, z: -50, rot: Math.PI / 2, bays: 3, bayW: 3.4, depth: 5.5, rank: 3, roof: 'yingshan' },
      { x: 58, z: -50, rot: -Math.PI / 2, bays: 3, bayW: 3.4, depth: 5.5, rank: 3, roof: 'yingshan' },
    ],
    // 「白石甬路，兩邊皆是蒼松翠柏」
    paths: [{ pts: [[38, -30], [38, -58]], w: 3.4, ch: 'stone', color: P.hanbaiyu }],
    trees: [['song', 28, -36, 1.3], ['song', 48, -36, 1.3], ['song', 28, -48, 1.3], ['song', 48, -48, 1.3]],
    flags: [[26, -22, 8], [50, -22, 8]],
    vats: [[30, -30], [46, -30]],
  },
  {
    id: 'ning-conglu', name: '丛绿堂', x0: 12, z0: -114, x1: 60, z1: -84,
    wall: { h: 3.5 },
    gates: [{ side: 'S', type: 'plain', x: 36, z: -84, w: 3.2, name: '叢綠堂' }],
    buildings: [{ x: 36, z: -104, bays: 3, bayW: 4.2, depth: 7.5, rank: 3, roof: 'juanpeng', enterable: true }],
    pave: [[36, -94, 16, 12, 'cobble', P.luanshi]],
    bamboo: [[20, -94, 4.5, 30, 81]],
    trees: [['gui', 52, -94, 1.0], ['song', 22, -110, 1.0]],
    rocks: [[46, -110, 0.9, 83]],
  },
  {
    id: 'ning-xuanzhen', name: '玄真观', x0: 12, z0: -152, x1: 56, z1: -122,
    // 賈敬「一味好道，只愛燒丹煉汞……都不在家，只在都中城外和道士們胡羼」
    wall: { h: 3.6 },
    gates: [{ side: 'S', type: 'plain', x: 34, z: -122, w: 3.0, name: '玄真觀' }],
    buildings: [{ x: 34, z: -142, bays: 3, bayW: 4.0, depth: 7, rank: 3, roof: 'yingshan', enterable: true }],
    pave: [[34, -132, 14, 12, 'brick', P.qingzhuan]],
    trees: [['song', 20, -130, 1.2], ['song', 48, -130, 1.2]],
    vats: [[27, -128]],
    rocks: [[44, -148, 0.8, 85]],
  },
  {
    id: 'ning-xiqun', name: '宁府西群房', x0: 10, z0: -198, x1: 58, z1: -158, wall: false,
    buildings: [
      { x: 32, z: -190, bays: 6, bayW: 3.2, depth: 5.5, rank: 4, roof: 'yingshan' },
      { x: 14, z: -172, rot: Math.PI / 2, bays: 4, bayW: 3.0, depth: 5, rank: 4, roof: 'yingshan' },
    ],
    pave: [[34, -178, 44, 8, 'brick', P.qingzhuan]],
    wells: [[52, -176]],
  },

  // ---------------------------------------------------------------- 東路：賈珍、尤氏、佩鳳偕鸞
  {
    id: 'ning-jiazhen', name: '贾珍居所', x0: 120, z0: -80, x1: 172, z1: -22,
    wall: { h: 3.8 },
    gates: [{ side: 'S', type: 'chuihua', x: 146, z: -22, w: 4.6 }],
    buildings: [
      { x: 146, z: -60, bays: 5, bayW: 4.4, depth: 9, rank: 2, roof: 'yingshan', enterable: true, porch: true },
      { x: 126, z: -44, rot: Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
      { x: 166, z: -44, rot: -Math.PI / 2, bays: 3, bayW: 3.6, depth: 6, rank: 3, roof: 'yingshan' },
    ],
    corridors: [{ pts: [[132, -28], [132, -40]] }, { pts: [[160, -28], [160, -40]] }],
    pave: [[146, -40, 22, 16, 'mandi', P.mandi]],
    trees: [['hai', 134, -34, 1.0], ['hai', 158, -34, 1.0]],
    rocks: [[146, -28, 1.0, 87]],
    tables: [[160, -52, 0.8]],
  },
  {
    id: 'ning-youshi', name: '尤氏上房', x0: 120, z0: -122, x1: 168, z1: -88,
    wall: { h: 3.6 },
    gates: [{ side: 'S', type: 'plain', x: 144, z: -88, w: 3.2 }],
    buildings: [
      { x: 144, z: -112, bays: 3, bayW: 4.4, depth: 8, rank: 2, roof: 'yingshan', enterable: true, porch: true },
      { x: 126, z: -100, rot: Math.PI / 2, bays: 2, bayW: 3.4, depth: 5.5, rank: 3, roof: 'yingshan' },
    ],
    pave: [[144, -98, 18, 12, 'mandi', P.mandi]],
    trees: [['gui', 158, -96, 1.0], ['tao', 132, -94, 0.9]],
    vats: [[150, -92]],
  },
  {
    id: 'ning-peifeng', name: '佩凤偕鸾院', x0: 120, z0: -166, x1: 166, z1: -132,
    wall: { h: 3.5 },
    gates: [{ side: 'S', type: 'plain', x: 143, z: -132, w: 3.0, name: '佩鳳偕鸞' }],
    buildings: [{ x: 143, z: -156, bays: 3, bayW: 4.0, depth: 7, rank: 3, roof: 'juanpeng', enterable: true }],
    pave: [[143, -144, 14, 12, 'cobble', P.luanshi]],
    trees: [['hai', 130, -142, 0.9], ['mei', 156, -142, 0.9]],
    bushes: [[136, -162, 1.2, 0xe0c4d8, 91]],
  },
  {
    id: 'ning-dongqun', name: '宁府东群房', x0: 118, z0: -198, x1: 172, z1: -172, wall: false,
    buildings: [
      { x: 144, z: -190, bays: 6, bayW: 3.2, depth: 5.5, rank: 4, roof: 'yingshan' },
      { x: 168, z: -180, rot: -Math.PI / 2, bays: 3, bayW: 3.0, depth: 5, rank: 4, roof: 'yingshan' },
    ],
    pave: [[144, -178, 48, 8, 'brick', P.qingzhuan]],
    troughs: [[124, -180, 6, 2.2]],
  },
];
