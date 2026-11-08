// 赤壁之战 · 战役剧本（唯一数据源：导演时间线 + 解说配音文本）
// 每个事件：id / 触发时刻(秒) / 标题 / 解说词(配音与字幕共用) / 镜头 / 持续估计
// 注意：修改 text 后需重新生成对应配音文件（见 配音配乐/generated）。

export const BATTLE_DURATION = 300; // 整场战役约 5 分钟

export const EVENTS = [
  {
    id: 'standoff',
    t: 0,
    title: '隔江对峙',
    text: '建安十三年冬，曹操挟二十万众，陈兵江北乌林；孙刘联军五万，屯于南岸赤壁。两军隔江对峙，大战一触即发。',
    camera: 'wideRiver',
  },
  {
    id: 'chainShips',
    t: 30,
    title: '铁索连舟',
    text: '曹军不习水战，士卒晕船。曹操下令以铁索连舟，船船相接，如履平地——却也为火攻埋下了祸根。',
    camera: 'weiFleet',
  },
  {
    id: 'defection',
    t: 62,
    title: '黄盖诈降',
    text: '东吴老将黄盖献苦肉计，修书诈降曹操。是夜，黄盖率蒙冲斗舰数十艘，满载薪草膏油，扬帆向北岸驶去。',
    camera: 'fireShipsSail',
  },
  {
    id: 'southeastWind',
    t: 96,
    title: '东南风起',
    text: '冬至前后，江上骤起东南风。周瑜苦苦等待的天时，终于到了。',
    camera: 'flags',
  },
  {
    id: 'fireAttack',
    t: 118,
    title: '火烧连船',
    text: '距曹军水寨二里，黄盖下令点火！火船借风，如离弦之箭冲入曹营。铁索连舟，避无可避，顷刻间烈焰冲天！',
    camera: 'fireImpact',
  },
  {
    id: 'allOutAttack',
    t: 165,
    title: '联军总攻',
    text: '火光为号，周瑜挥师渡江，刘备军自侧翼包抄。万箭齐发，喊杀震天，曹军大乱。',
    camera: 'volley',
  },
  {
    id: 'retreat',
    t: 215,
    title: '曹军败退',
    text: '曹军烧死溺死者不计其数。曹操率残部沿华容道北撤，江面上只余断樯残帆。',
    camera: 'retreat',
  },
  {
    id: 'epilogue',
    t: 262,
    title: '三分天下',
    text: '赤壁一战，奠定三分天下。大江东去，浪淘尽，千古风流人物。',
    camera: 'epilogue',
  },
];

// 配音文件路径（由 配音配乐 目录下的生成脚本产出）
export const AUDIO_BASE = './配音配乐/generated/';
export const narrAudio = (id) => `${AUDIO_BASE}narr_${id}.mp3`;
export const BGM_FILE = `${AUDIO_BASE}bgm_battle.mp3`;
