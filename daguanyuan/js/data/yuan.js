// 大觀園 —— 第十七回「大觀園試才題對額」的遊園次第：
// 園門 → 翠嶂 → 曲徑通幽 → 沁芳亭橋 → 瀟湘館 → 稻香村 → 蘅蕪苑 → 蓼汀花漵 → 省親別墅 → 怡紅院
// 第十六回：「從東邊一帶，借著東府裡花園起，轉至北邊，一共丈量準了，三里半大」
import { P } from './../palette.js';
import { YUAN, YUAN_GATE, YUAN_EGATE, YUAN_WGATE } from './../layout.js';
import { wallRun, corridor, plaqueBoard, frame, railing, rockery } from './../parts.js';
import { COUPLETS } from './../plaques.js';

export const YUAN_DEFS = [
  // ---------------------------------------------------------------- 園牆與正門
  {
    id: 'yuan-wall', name: '大观园', x0: YUAN.x0, z0: YUAN.z0, x1: YUAN.x1, z1: YUAN.z1,
    wall: false, region: true, cull: false,
    extra(gb) {
      const W = { h: 4.2, color: P.fenqiang, ch: 'plaster' };
      const fx = (x, a, b) => (x - a) / (b - a);
      const S = YUAN.z1;
      // 南牆：正門（五間）、東角門（通會芳園舊路）、西角門（通榮府）
      wallRun(gb, { x0: YUAN.x0, z0: S, x1: -46, z1: S, ...W, gapAt: fx(YUAN_WGATE.x, YUAN.x0, -46), gapW: 5.5 });
      wallRun(gb, { x0: 6, z0: S, x1: YUAN.x1, z1: S, ...W, gapAt: fx(YUAN_EGATE.x, 6, YUAN.x1), gapW: 5.5 });
      // 正門居中一段由門樓佔位（-46 ~ 6）
      wallRun(gb, { x0: YUAN.x0, z0: YUAN.z0, x1: YUAN.x1, z1: YUAN.z0, ...W });
      wallRun(gb, { x0: YUAN.x0, z0: YUAN.z0, x1: YUAN.x0, z1: S, ...W });
      wallRun(gb, { x0: YUAN.x1, z0: YUAN.z0, x1: YUAN.x1, z1: S, ...W });
    },
  },
  {
    id: 'yuan-gate', name: '大观园正门', x0: -50, z0: -232, x1: 10, z1: -206, wall: false,
    // 第十七回：「只見正門五間，上面桶瓦泥鰍脊，那門欄窗槅，皆是細雕新鮮花樣，
    //             並無朱粉塗飾；一色水磨群牆，下面白石台磯，鑿成西番草花樣」
    gates: [{ side: 'S', type: 'gate', x: YUAN_GATE.x, z: YUAN_GATE.z - 3, bays: 5, bayW: 4.4,
      depth: 7, rank: 2, name: '大觀園' }],
    pave: [[YUAN_GATE.x, -224, 26, 14, 'stone', P.hanbaiyu]],
    trees: [['song', -44, -226, 1.2], ['song', 4, -226, 1.2]],
  },
  {
    // 「一帶翠嶂擋在前面……說著，往前一望，見白石崚嶒，或如鬼怪，或如猛獸」「曲徑通幽處」
    id: 'yuan-cuizhang', name: '翠嶂', x0: -56, z0: -266, x1: 20, z1: -228, wall: false,
    rocks: [
      [-38, -238, 2.4, 101], [-30, -246, 2.8, 103], [-6, -240, 2.6, 105], [2, -250, 2.2, 107],
      [-44, -256, 2.0, 109], [10, -258, 1.8, 111], [-34, -262, 1.6, 113],
    ],
    trees: [['song', -46, -244, 1.3], ['song', 14, -246, 1.2], ['zhu', -14, -232, 0.9]],
    bamboo: [[-16, -262, 5, 30, 115]],
    paths: [{ pts: [[-20, -228], [-19, -244], [-14, -252], [-20, -266]], w: 2.6, ch: 'cobble', color: P.luanshi }],
    extra(gb) {
      // 洞口題石：曲徑通幽處
      const F = frame(-14, -252, 0);
      plaqueBoard(gb, F, '曲徑通幽', 0, 3.4, 2.4, 3.0, 1.0);
      gb.box(4.2, 5.0, 1.2, P.taihu, { ch: 'rock', x: -14, y: 2.5, z: 3.0 - 252 + 0.6 });
    },
  },

  // ---------------------------------------------------------------- 沁芳
  {
    id: 'yuan-qinfang', name: '沁芳亭', x0: -46, z0: -320, x1: 6, z1: -266, wall: false,
    tufts: [[-36, -276, 7, 16, 71], [-6, -306, 7, 16, 73], [-40, -308, 6, 12, 75]],
    // 寶玉題「沁芳」，對聯「繞堤柳借三篙翠，隔岸花分一脈香」
    pavilions: [{ x: -20, z: -291, r: 3.2, name: '沁芳亭', couplet: COUPLETS[0], baseH: 2.9, bench: true }],
    trees: [
      ['liu', -36, -280, 1.2], ['liu', -34, -302, 1.2], ['liu', -4, -278, 1.2], ['liu', -2, -304, 1.2],
      ['tao', -42, -292, 1.0], ['tao', 4, -294, 1.0],
    ],
    rocks: [[-40, -272, 1.1, 121], [2, -312, 1.0, 123]],
  },

  // ---------------------------------------------------------------- 瀟湘館（黛玉）
  {
    id: 'yuan-xiaoxiang', name: '潇湘馆', x0: -146, z0: -344, x1: -92, z1: -294,
    tufts: [[-140, -340, 5, 12, 81], [-98, -340, 5, 12, 83]],
    // 第十七回：「忽抬頭看見前面一帶粉垣，數楹修舍，有千百竿翠竹遮映……
    //             後院牆下忽開一隙，得泉一派，開溝僅尺許，灌入牆內，繞階緣屋至前院，盤旋竹下而出」
    wall: { h: 3.4, color: P.fenqiang },
    gates: [{ side: 'S', type: 'plain', x: -119, z: -294, w: 3.2, name: '瀟湘館' }],
    buildings: [
      { x: -119, z: -330, bays: 3, bayW: 4.2, depth: 8, rank: 3, roof: 'juanpeng',
        name: '有鳳來儀', couplet: COUPLETS[1], enterable: true, veranda: true, latCh: 'ice' },
      { x: -140, z: -316, rot: Math.PI / 2, bays: 2, bayW: 3.4, depth: 5.5, rank: 3, roof: 'juanpeng' },
      { x: -98, z: -316, rot: -Math.PI / 2, bays: 2, bayW: 3.4, depth: 5.5, rank: 3, roof: 'juanpeng' },
    ],
    // 「一入門，兩邊都是遊廊相接」（曲折遊廊）
    corridors: [
      { pts: [[-114, -298], [-104, -298], [-104, -312]], w: 2.0 },
      { pts: [[-124, -298], [-134, -298], [-134, -312]], w: 2.0 },
    ],
    pave: [[-119, -308, 18, 14, 'cobble', P.luanshi]],
    bamboo: [[-136, -302, 7, 64, 131], [-102, -302, 7, 64, 133], [-119, -341, 10, 72, 135], [-142, -322, 5, 40, 137], [-96, -322, 5, 40, 139]],
    trees: [['li', -136, -338, 1.1], ['jiao', -104, -338, 1.0], ['jiao', -110, -340, 0.9]],
    rocks: [[-131, -300, 0.9, 137], [-107, -301, 0.7, 143]],
  },
  {
    id: 'yuan-huazhong', name: '花冢', x0: -168, z0: -352, x1: -140, z1: -324, wall: false,
    tufts: [[-156, -332, 7, 18, 85]],
    // 第二十七回：黛玉葬花處，「那畸角上我有一個花冢」
    rocks: [[-152, -344, 1.2, 141]],
    trees: [['tao', -158, -336, 1.2], ['tao', -146, -334, 1.1], ['tao', -152, -350, 1.0]],
    bushes: [[-160, -346, 1.1, 0xd6e4c4, 143]],
    extra(gb) {
      gb.box(2.6, 0.5, 2.6, 0x8a7a58, { ch: 'earth', x: -152, y: 0.25, z: -338 });
      gb.box(0.6, 1.1, 0.16, P.hanbaiyu, { ch: 'stone', x: -152, y: 0.9, z: -336.6 });
    },
  },

  // ---------------------------------------------------------------- 怡紅院（寶玉）
  {
    id: 'yuan-yihong', name: '怡红院', x0: 96, z0: -362, x1: 156, z1: -308,
    // 第十七回：「一入門，兩邊俱是遊廊相接。院中點襯幾塊山石，一邊種著數本芭蕉；
    //             那一邊乃是一顆西府海棠，其勢若傘，絲垂翠縷，葩吐丹砂」
    wall: { h: 3.6, color: P.fenqiang },
    gates: [{ side: 'S', type: 'plain', x: 126, z: -308, w: 3.6, name: '怡紅院' }],
    buildings: [
      { x: 126, z: -346, bays: 5, bayW: 4.4, depth: 9, rank: 2, roof: 'juanpeng',
        name: '紅香綠玉', enterable: true, veranda: true, latCh: 'tortoise' },
      { x: 102, z: -330, rot: Math.PI / 2, bays: 2, bayW: 3.6, depth: 6, rank: 3, roof: 'juanpeng' },
      { x: 150, z: -330, rot: -Math.PI / 2, bays: 2, bayW: 3.6, depth: 6, rank: 3, roof: 'juanpeng' },
    ],
    corridors: [
      { pts: [[121, -312], [108, -312], [108, -326]], w: 2.2 },
      { pts: [[131, -312], [144, -312], [144, -326]], w: 2.2 },
    ],
    pave: [[126, -322, 22, 14, 'cobble', P.luanshi]],
    // 一邊芭蕉，一邊西府海棠
    trees: [
      ['jiao', 112, -320, 1.2], ['jiao', 108, -324, 1.1], ['jiao', 116, -325, 1.0],
      ['hai', 140, -321, 1.5], ['hai', 145, -326, 1.2],
      ['gui', 100, -356, 1.0], ['mei', 152, -356, 1.0],
    ],
    rocks: [[126, -313, 1.0, 151], [134, -334, 0.7, 153]],
    tables: [[112, -336, 0.8]],
  },

  // ---------------------------------------------------------------- 秋爽齋（探春）
  {
    id: 'yuan-qiushuang', name: '秋爽斋', x0: -122, z0: -424, x1: -70, z1: -382,
    // 第四十回：「這三間屋子並不曾隔斷。當地放著一張花梨大理石大案……」
    wall: { h: 3.4 },
    gates: [{ side: 'S', type: 'plain', x: -96, z: -382, w: 3.2, name: '秋爽齋' }],
    buildings: [
      { x: -96, z: -412, bays: 3, bayW: 5.0, depth: 8.5, rank: 3, roof: 'juanpeng',
        name: '秋爽齋', couplet: COUPLETS[7], enterable: true, veranda: true, front: 'open' },
      { x: -116, z: -398, rot: Math.PI / 2, bays: 2, bayW: 3.4, depth: 5, rank: 3, roof: 'juanpeng' },
    ],
    pave: [[-96, -394, 20, 12, 'cobble', P.luanshi]],
    // 「愛那些梧桐芭蕉」
    trees: [['huai', -112, -390, 1.4], ['jiao', -80, -390, 1.1], ['jiao', -84, -394, 1.0], ['gui', -78, -418, 1.0]],
    rocks: [[-96, -386, 0.8, 161]],
    tables: [[-108, -406, 0.85]],
  },

  // ---------------------------------------------------------------- 蘅蕪苑（寶釵）
  {
    id: 'yuan-hengwu', name: '蘅芜苑', x0: 0, z0: -536, x1: 56, z1: -486,
    // 第十七回：「只見許多異草：或有牽藤的，或有引蔓的……一所清涼瓦舍，一色水磨磚牆，
    //             清瓦花堵。那大主山所分之脈，皆穿牆而過。上面小小五間房舍，一明兩暗，
    //             裡面都是合著地步打就的床几椅案。從裡間房內又得一小門，出去則是後院」
    wall: { h: 3.4, color: P.qingzhuan, ch: 'brick' },
    gates: [{ side: 'S', type: 'plain', x: 28, z: -486, w: 3.2, name: '蘅蕪苑' }],
    buildings: [
      { x: 28, z: -520, bays: 5, bayW: 3.8, depth: 8, rank: 3, roof: 'juanpeng',
        name: '蘅芷清芬', couplet: COUPLETS[2], enterable: true, veranda: true,
        wallColor: P.qingzhuan, wallCh: 'brick' },
    ],
    pave: [[28, -500, 24, 16, 'stone', P.hanbaiyu]],
    // 「大玲瓏山石」「異草仙藤，累垂可愛」
    rocks: [[10, -496, 2.6, 171], [20, -492, 2.2, 173], [40, -493, 2.4, 175], [48, -500, 1.8, 177], [4, -510, 1.6, 179]],
    vines: [[16, -498, 8, 20, 181], [42, -499, 7, 18, 183], [28, -530, 8, 16, 185]],
    trees: [['gui', 4, -528, 0.9], ['gui', 52, -528, 0.9]],
  },

  // ---------------------------------------------------------------- 稻香村（李紈）
  {
    id: 'yuan-daoxiang', name: '稻香村', x0: -164, z0: -512, x1: -104, z1: -456,
    // 第十七回：「轉過山懷中，隱隱露出一帶黃泥築就矮牆，牆頭皆用稻莖掩護。
    //             有幾百株杏花，如噴火蒸霞一般。裡面數楹茅屋。外面卻是桑、榆、槿、柘，
    //             各色樹稚新條，隨其曲折，編就兩溜青籬……下面分畦列畝，佳蔬菜花，
    //             漫然無際。……一帶清流，從花木深處曲折瀉於石隙之下」
    wall: { h: 2.4, color: P.huangni, ch: 'earth' },
    gates: [{ side: 'S', type: 'plain', x: -134, z: -456, w: 3.0, name: '稻香村' }],
    buildings: [
      { x: -134, z: -498, bays: 3, bayW: 4.0, depth: 7, rank: 4, roof: 'xuanshan', thatch: true,
        name: '杏簾在望', couplet: COUPLETS[3], enterable: true,
        wallColor: P.huangni, wallCh: 'earth', latCh: 'zhiling' },
      { x: -156, z: -486, rot: Math.PI / 2, bays: 2, bayW: 3.2, depth: 5, rank: 4, roof: 'xuanshan',
        thatch: true, wallColor: P.huangni, wallCh: 'earth' },
    ],
    paddy: [[-160, -474, -108, -462, 191]],
    trees: [
      ['xing', -156, -506, 1.3], ['xing', -148, -510, 1.2], ['xing', -120, -508, 1.3],
      ['xing', -112, -502, 1.2], ['xing', -160, -494, 1.1], ['sang', -110, -486, 1.1],
      ['yu', -112, -472, 1.0], ['jin', -158, -466, 0.9], ['zhe', -116, -464, 0.9],
    ],
    wells: [[-148, -480]],
    pave: [[-134, -488, 14, 10, 'earth', P.huangni]],
    extra(gb) {
      // 酒幌：「杏簾在望」
      gb.box(0.14, 4.2, 0.14, P.woodLight, { ch: 'wood', x: -124, y: 2.1, z: -460 });
      gb.box(0.9, 1.9, 0.06, P.hongsha, { ch: 'silk', x: -123.4, y: 3.0, z: -460, wind: 0.5 });
    },
  },
  {
    id: 'yuan-xiaochufang', name: '大观园小厨房', x0: -160, z0: -444, x1: -128, z1: -420, wall: false,
    // 第六十一回柳家的所管
    buildings: [{ x: -144, z: -436, bays: 4, bayW: 3.2, depth: 5.5, rank: 4, roof: 'yingshan', name: '小廚房' }],
    pave: [[-144, -426, 24, 8, 'brick', P.qingzhuan]],
    wells: [[-156, -426]],
    trees: [['yu', -132, -424, 1.0]],
  },

  // ---------------------------------------------------------------- 綴錦樓·紫菱洲（迎春）
  {
    id: 'yuan-zhuijin', name: '缀锦楼（紫菱洲）', x0: 78, z0: -472, x1: 126, z1: -428,
    wall: { h: 3.4 },
    gates: [{ side: 'S', type: 'plain', x: 102, z: -428, w: 3.2, name: '紫菱洲' }],
    buildings: [
      { x: 102, z: -458, bays: 3, bayW: 4.4, depth: 8, rank: 2, roof: 'xieshan', storey: 2,
        name: '綴錦樓', enterable: true },
      { x: 84, z: -444, rot: Math.PI / 2, bays: 2, bayW: 3.2, depth: 5, rank: 3, roof: 'juanpeng' },
    ],
    pave: [[102, -440, 18, 12, 'cobble', P.luanshi]],
    trees: [['liu', 88, -434, 1.2], ['liu', 118, -436, 1.1], ['hai', 120, -466, 1.0]],
    rocks: [[92, -466, 1.1, 201]],
  },

  // ---------------------------------------------------------------- 暖香塢（惜春）
  {
    id: 'yuan-nuanxiang', name: '暖香坞', x0: 122, z0: -520, x1: 168, z1: -484,
    wall: { h: 3.4 },
    gates: [{ side: 'S', type: 'plain', x: 145, z: -484, w: 3.2, name: '暖香塢' }],
    buildings: [
      { x: 145, z: -508, bays: 3, bayW: 4.0, depth: 7.5, rank: 3, roof: 'juanpeng', enterable: true },
    ],
    pave: [[145, -494, 16, 12, 'cobble', P.luanshi]],
    trees: [['mei', 132, -492, 1.1], ['mei', 158, -492, 1.1], ['song', 126, -516, 1.0]],
    rocks: [[160, -514, 1.0, 211]],
    bushes: [[138, -516, 1.1, 0xe0c4d8, 213]],
  },

  // ---------------------------------------------------------------- 櫳翠庵（妙玉）
  {
    id: 'yuan-longcui', name: '栊翠庵', x0: -180, z0: -586, x1: -132, z1: -542,
    // 第五十回：「櫳翠庵中有十數株紅梅如胭脂一般，映著雪色，分外顯得精神」
    wall: { h: 3.6, color: P.fenqiang },
    gates: [{ side: 'S', type: 'plain', x: -156, z: -542, w: 3.0, name: '櫳翠庵' }],
    buildings: [
      { x: -156, z: -574, bays: 3, bayW: 4.0, depth: 7.5, rank: 3, roof: 'xieshan',
        couplet: COUPLETS[6], enterable: true },
      { x: -174, z: -560, rot: Math.PI / 2, bays: 2, bayW: 3.0, depth: 5, rank: 4, roof: 'yingshan' },
    ],
    pave: [[-156, -556, 16, 14, 'stone', P.hanbaiyu]],
    trees: [
      ['mei', -168, -550, 1.3], ['mei', -162, -548, 1.2], ['mei', -150, -549, 1.3],
      ['mei', -142, -552, 1.2], ['mei', -172, -580, 1.1], ['mei', -140, -578, 1.1],
      ['song', -136, -560, 1.2],
    ],
    bamboo: [[-176, -546, 3.5, 20, 221]],
    vats: [[-162, -548]],
  },

  // ---------------------------------------------------------------- 藕香榭
  {
    id: 'yuan-ouxiang', name: '藕香榭', x0: 14, z0: -458, x1: 58, z1: -418, wall: false,
    tufts: [[18, -424, 6, 14, 95]],
    // 第三十八回：「藕香榭已經蓋在池中，四面有窗，左右有曲廊可通，也是跨水接岸，
    //               後面又有曲折竹橋暗接」
    buildings: [
      { x: 34, z: -440, bays: 3, bayW: 4.2, depth: 7, rank: 3, roof: 'xuanshan',
        name: '藕香榭', front: 'open', enterable: true, veranda: true, baseH: 1.5 },
    ],
    corridors: [{ pts: [[20, -430], [34, -430]], w: 2.0 }],
    lotus: [[54, -448, 9, 30, 231], [50, -428, 7, 22, 233]],
    trees: [['liu', 18, -422, 1.2], ['liu', 20, -454, 1.1]],
    rocks: [[16, -436, 1.0, 235]],
  },
  {
    id: 'yuan-dicui', name: '滴翠亭', x0: 50, z0: -378, x1: 84, z1: -348, wall: false,
    // 第二十七回寶釵撲蝶處：「原來這亭子四面俱是遊廊曲橋，蓋造在池中水上，四面雕鏤槅子糊著紙」
    pavilions: [{ x: 66, z: -362, r: 3.0, name: '滴翠亭', baseH: 1.6, bench: true }],
    extra(gb) {
      corridor(gb, [[66, -356], [66, -348]], { w: 1.8 });
    },
    lotus: [[74, -370, 6, 16, 241]],
    trees: [['liu', 54, -352, 1.1], ['liu', 80, -374, 1.0]],
  },

  // ---------------------------------------------------------------- 蘆雪廣 · 蓼汀花漵 · 荇葉渚
  {
    id: 'yuan-luxue', name: '芦雪广', x0: -86, z0: -648, x1: -42, z1: -612, wall: false,
    tufts: [[-78, -622, 7, 16, 91], [-50, -646, 7, 16, 93]],
    // 第四十九回：「原來這蘆雪廣蓋在傍山臨水河灘之上，一帶幾間，茅簷土壁，
    //               槿籬竹牖，推窗便可垂釣」
    buildings: [
      { x: -64, z: -636, bays: 3, bayW: 3.8, depth: 6.5, rank: 4, roof: 'xuanshan', thatch: true,
        name: '蘆雪廣', enterable: true, wallColor: P.huangni, wallCh: 'earth', latCh: 'zhiling' },
    ],
    pave: [[-64, -624, 14, 10, 'earth', P.huangni]],
    trees: [['liu', -80, -620, 1.1], ['mei', -48, -620, 1.0], ['jin', -46, -644, 0.9]],
    rocks: [[-82, -642, 1.4, 251]],
    bushes: [[-52, -628, 1.2, 0xdce8c0, 253]],
  },
  {
    id: 'yuan-liaoting', name: '蓼汀花溆', x0: -62, z0: -694, x1: -2, z1: -634, wall: false,
    tufts: [[-44, -652, 9, 22, 87], [-14, -684, 9, 22, 89]],
    // 第十七回：「說著，引人步入亭中……忽見柳陰中又露出一個折帶朱欄板橋來」
    pavilions: [{ x: -30, z: -676, r: 2.8, name: '蓼汀花漵', baseH: 1.2 }],
    trees: [
      ['liu', -8, -636, 1.2], ['liu', -30, -660, 1.2], ['liu', 8, -676, 1.1],
      ['tao', -40, -640, 1.0], ['xing', 34, -672, 1.0],
    ],
    rocks: [[-42, -668, 1.6, 261], [36, -634, 1.2, 263]],
    lotus: [[-16, -658, 11, 34, 265]],
    bushes: [[-36, -650, 1.4, 0xdce8c0, 267], [16, -668, 1.3, 0xdce8c0, 269]],
  },
  {
    id: 'yuan-xingye', name: '荇叶渚', x0: 60, z0: -636, x1: 110, z1: -590, wall: false,
    pavilions: [{ x: 84, z: -612, r: 2.6, name: '荇葉渚', baseH: 1.0 }],
    lotus: [[90, -600, 8, 24, 271]],
    trees: [['liu', 66, -596, 1.1], ['liu', 104, -628, 1.0], ['gui', 100, -598, 0.9]],
    rocks: [[64, -628, 1.2, 273]],
  },

  // ---------------------------------------------------------------- 省親別墅（大觀樓）
  {
    id: 'yuan-shengqin', name: '省亲别墅', x0: -76, z0: -680, x1: 76, z1: -592, wall: false,
    // 第十七回：「崇閣巍峨，層樓高起，面面琳宮合抱，迢迢複道縈紆；青松拂檐，玉欄繞砌；
    //             金輝獸面，彩煥螭頭」；玉石牌坊題「天仙寶境」，元春改「省親別墅」
    pailou: [{ x: 0, z: -604, w: 15, h: 9.5, name: '省親別墅' }],
    buildings: [
      { x: 0, z: -650, bays: 5, bayW: 5.6, depth: 13, rank: 1, roof: 'wudian', storey: 2,
        name: '顧恩思義', couplet: COUPLETS[4], enterable: true, veranda: true },
      { x: -50, z: -644, bays: 3, bayW: 4.4, depth: 9, rank: 2, roof: 'xieshan', storey: 2, name: '綴錦閣' },
      { x: 50, z: -644, bays: 3, bayW: 4.4, depth: 9, rank: 2, roof: 'xieshan', storey: 2, name: '含芳閣' },
    ],
    // 迢迢複道：正殿與兩閣以遊廊相接
    corridors: [
      { pts: [[-22, -636], [-38, -636]], w: 2.6 },
      { pts: [[22, -636], [38, -636]], w: 2.6 },
    ],
    pave: [[0, -622, 46, 22, 'stone', P.hanbaiyu]],
    trees: [
      ['song', -30, -612, 1.5], ['song', 30, -612, 1.5], ['song', -34, -600, 1.3], ['song', 34, -600, 1.3],
      ['gui', -62, -628, 1.0], ['gui', 62, -628, 1.0],
    ],
    vats: [[-16, -616], [16, -616]],
    extra(gb) {
      // 月台玉欄
      const F = frame(0, -622, 0);
      railing(gb, F, -23, 11, 23, 11, 0.6, { stone: true, h: 0.95 });
      railing(gb, F, -23, -11, -23, 11, 0.6, { stone: true, h: 0.95 });
      railing(gb, F, 23, -11, 23, 11, 0.6, { stone: true, h: 0.95 });
    },
  },
  {
    id: 'yuan-jiayin', name: '嘉荫堂', x0: -32, z0: -724, x1: 16, z1: -690, wall: false,
    // 第七十五回中秋賞月處
    buildings: [{ x: -8, z: -712, bays: 3, bayW: 4.4, depth: 8, rank: 3, roof: 'xieshan',
      name: '嘉蔭堂', enterable: true, veranda: true }],
    pave: [[-8, -698, 20, 12, 'stone', P.hanbaiyu]],
    trees: [['gui', -24, -696, 1.2], ['gui', 8, -696, 1.2], ['song', -28, -720, 1.1]],
    tables: [[6, -702, 0.9]],
  },

  // ---------------------------------------------------------------- 凸碧山莊 · 凹晶溪館
  {
    id: 'yuan-tubi', name: '凸碧山庄', x0: 126, z0: -790, x1: 178, z1: -742, wall: false,
    // 第七十六回：「凸碧山莊」在山之高脊，「凹晶溪館」在山之低窪近水
    buildings: [{ x: 152, z: -772, bays: 3, bayW: 4.2, depth: 7.5, rank: 3, roof: 'xieshan',
      name: '凸碧山莊', enterable: true, veranda: true }],
    pave: [[152, -756, 20, 14, 'stone', P.hanbaiyu]],
    trees: [['song', 134, -754, 1.4], ['song', 170, -756, 1.4], ['gui', 172, -784, 1.0]],
    rocks: [[132, -784, 1.8, 281], [170, -742, 1.4, 283]],
    tables: [[140, -760, 0.9]],
  },
  {
    id: 'yuan-aojing', name: '凹晶溪馆', x0: 96, z0: -822, x1: 142, z1: -790, wall: false,
    buildings: [{ x: 118, z: -812, bays: 3, bayW: 3.8, depth: 6.5, rank: 3, roof: 'juanpeng',
      name: '凹晶溪館', enterable: true, veranda: true, baseH: 0.8 }],
    pave: [[118, -800, 18, 10, 'stone', P.hanbaiyu]],
    trees: [['liu', 102, -796, 1.2], ['liu', 136, -798, 1.1], ['gui', 100, -818, 0.9]],
    rocks: [[138, -816, 1.3, 291]],
    lotus: [[126, -784, 6, 14, 293]],
  },
  {
    id: 'yuan-zha', name: '沁芳闸', x0: 152, z0: -820, x1: 182, z1: -788, wall: false,
    // 第十七回賈珍：「原從那閘起流至那洞口……」
    extra(gb) {
      const F = frame(168, -802, 0.5);
      for (const sx of [-1, 1]) {
        gb.box(2.0, 4.2, 5.0, P.hanbaiyu, { ch: 'stone', x: 168 + sx * 5.4, y: 1.2, z: -802 - sx * 1.6, ry: 0.5 });
      }
      gb.box(12.5, 1.1, 3.2, P.hanbaiyu, { ch: 'stone', x: 168, y: 2.9, z: -802, ry: 0.5 });
      gb.box(11.0, 2.4, 0.6, P.woodDark, { ch: 'wood', x: 168, y: 1.0, z: -802, ry: 0.5 });
      plaqueBoard(gb, F, '沁芳閘', 0, 3.6, 1.7, 2.6, 0.9);
      rockery(gb, 178, -814, 1.6, 301);
    },
    trees: [['song', 158, -816, 1.2], ['liu', 176, -792, 1.1]],
  },

  // ---------------------------------------------------------------- 會芳園遺構（寧府舊園，省親時併入）
  {
    id: 'yuan-tianxiang', name: '天香楼', x0: 128, z0: -276, x1: 174, z1: -238, wall: false,
    // 第十回、第十三回：寧府會芳園天香樓；秦可卿歿於此，故此處為遺構，配第十三回講解
    buildings: [{ x: 150, z: -258, bays: 3, bayW: 4.6, depth: 9, rank: 2, roof: 'xieshan', storey: 2,
      name: '天香樓', enterable: true }],
    pave: [[150, -242, 22, 12, 'mandi', P.mandi]],
    trees: [['gui', 134, -240, 1.1], ['gui', 166, -240, 1.1], ['song', 170, -270, 1.1]],
    rocks: [[130, -270, 1.2, 311]],
  },
  {
    id: 'yuan-dengxian', name: '登仙阁', x0: 96, z0: -268, x1: 130, z1: -236, wall: false,
    buildings: [{ x: 112, z: -254, bays: 3, bayW: 3.8, depth: 7, rank: 3, roof: 'xieshan', storey: 2,
      name: '登仙閣' }],
    pave: [[112, -242, 16, 8, 'cobble', P.luanshi]],
    trees: [['song', 100, -262, 1.1], ['mei', 126, -240, 0.9]],
  },
  {
    id: 'yuan-doufeng', name: '逗蜂轩', x0: 152, z0: -312, x1: 182, z1: -282, wall: false,
    buildings: [{ x: 167, z: -302, bays: 3, bayW: 3.6, depth: 6.5, rank: 3, roof: 'juanpeng', name: '逗蜂軒' }],
    pave: [[167, -290, 14, 8, 'cobble', P.luanshi]],
    bushes: [[156, -288, 1.3, 0xf0dcb0, 321], [178, -290, 1.2, 0xf0dcb0, 323]],
    trees: [['hai', 156, -308, 1.0]],
  },
  {
    id: 'yuan-ningxi', name: '凝曦轩', x0: 80, z0: -298, x1: 114, z1: -266, wall: false,
    buildings: [{ x: 97, z: -288, bays: 3, bayW: 3.8, depth: 6.5, rank: 3, roof: 'juanpeng', name: '凝曦軒' }],
    pave: [[97, -276, 14, 8, 'cobble', P.luanshi]],
    trees: [['liu', 84, -272, 1.1], ['gui', 110, -274, 1.0]],
    rocks: [[84, -294, 1.0, 331]],
  },

  // ---------------------------------------------------------------- 園中散景
  {
    id: 'yuan-scatter-w', name: '大观园西路', x0: -182, z0: -700, x1: -100, z1: -600, wall: false,
    tufts: [[-150, -630, 12, 24, 101], [-120, -676, 12, 24, 103], [-168, -664, 10, 18, 105]],
    trees: [
      ['song', -170, -616, 1.3], ['song', -146, -640, 1.2], ['huai', -120, -664, 1.3],
      ['liu', -108, -612, 1.2], ['gui', -160, -680, 1.1], ['mei', -132, -692, 1.0],
      ['tao', -176, -660, 1.0], ['huai', -150, -700, 1.2],
    ],
    rocks: [[-128, -700, 1.8, 341], [-166, -700, 1.2, 343]],
    paths: [{ pts: [[-140, -560], [-130, -620], [-110, -680], [-60, -700]], w: 2.4, ch: 'cobble', color: P.luanshi }],
    bushes: [[-152, -628, 1.4, 0xd6e4c4, 345], [-118, -644, 1.3, 0xe0c4d8, 347]],
  },
  {
    id: 'yuan-scatter-n', name: '大观园北山', x0: -100, z0: -854, x1: 120, z1: -720, wall: false,
    tufts: [[-40, -770, 14, 26, 107], [40, -800, 14, 26, 109], [90, -746, 12, 20, 111]],
    trees: [
      ['song', -60, -760, 1.4], ['song', -20, -790, 1.3], ['song', 30, -770, 1.4],
      ['song', 70, -812, 1.2], ['huai', -80, -820, 1.3], ['huai', 10, -836, 1.2],
      ['gui', -40, -736, 1.1], ['mei', 50, -740, 1.0], ['liu', 90, -746, 1.1],
      ['tao', -70, -744, 1.0], ['xing', 60, -840, 1.0], ['song', 100, -840, 1.2],
    ],
    rocks: [[-50, -800, 2.2, 351], [20, -816, 1.8, 353], [-90, -770, 1.6, 355], [80, -778, 1.5, 357]],
    paths: [{ pts: [[-8, -720], [10, -760], [60, -790], [110, -790]], w: 2.4, ch: 'cobble', color: P.luanshi }],
  },
  {
    id: 'yuan-scatter-e', name: '大观园东路', x0: 100, z0: -600, x1: 182, z1: -400, wall: false,
    tufts: [[150, -470, 12, 22, 113], [140, -560, 12, 22, 115]],
    trees: [
      ['liu', 140, -420, 1.2], ['gui', 168, -450, 1.1], ['song', 118, -470, 1.2],
      ['mei', 172, -530, 1.0], ['huai', 130, -556, 1.3], ['tao', 160, -580, 1.0],
      ['song', 176, -600, 1.2], ['hai', 108, -540, 1.0],
    ],
    rocks: [[150, -546, 1.6, 361], [176, -486, 1.2, 363]],
    paths: [{ pts: [[126, -404], [140, -470], [130, -540], [110, -590]], w: 2.4, ch: 'cobble', color: P.luanshi }],
  },
  {
    id: 'yuan-scatter-s', name: '大观园南路', x0: -100, z0: -400, x1: 100, z1: -260, wall: false,
    tufts: [[-60, -330, 12, 24, 117], [40, -300, 12, 24, 119], [30, -380, 12, 22, 121]],
    trees: [
      ['liu', -60, -320, 1.2], ['tao', -70, -350, 1.1], ['xing', 20, -330, 1.1],
      ['hai', 40, -318, 1.0], ['gui', -84, -286, 1.0], ['huai', 62, -290, 1.2],
      ['liu', 30, -388, 1.1], ['mei', -50, -390, 1.0],
    ],
    rocks: [[-72, -366, 1.4, 371], [46, -344, 1.2, 373]],
    paths: [
      { pts: [[-20, -266], [-22, -300], [-40, -330], [-80, -350], [-110, -380]], w: 2.8, ch: 'cobble', color: P.luanshi },
      { pts: [[-16, -300], [20, -320], [60, -336], [100, -334]], w: 2.6, ch: 'cobble', color: P.luanshi },
    ],
    bushes: [[-56, -300, 1.3, 0xd6e4c4, 375], [16, -352, 1.2, 0xe0c4d8, 377]],
  },
];
