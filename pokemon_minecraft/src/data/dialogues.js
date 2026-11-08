// NPC 台词集中维护（设计文档 §14.3）：每条带 voiceFile 字段供离线语音生成
// voice: 音色 key（tools/bgm-prompts.json / gen-audio.mjs 使用）
export const VOICE_PROFILES = {
  nurse:     { voiceId:'female-tianmei',  emotion:'happy', pitch:0,  desc:'甜美温柔女声' },
  merchant:  { voiceId:'male-qn-qingse',  emotion:'happy', pitch:2,  desc:'成熟爽朗男声' },
  villager_m:{ voiceId:'male-qn-qingse',  emotion:'calm',  pitch:0,  desc:'青年男声' },
  villager_f:{ voiceId:'female-shaonv',   emotion:'calm',  pitch:1,  desc:'少女声' },
  villager_o:{ voiceId:'male-qn-qingse',  emotion:'calm',  pitch:-3, desc:'老者声' },
  gym_rock:  { voiceId:'male-qn-qingse',  emotion:'calm',  pitch:-6, desc:'低沉厚重男声' },
  gym_fire:  { voiceId:'male-qn-qingse',  emotion:'angry', pitch:3,  desc:'热血高亢男声' },
  narrator:  { voiceId:'female-tianmei',  emotion:'calm',  pitch:0,  desc:'清晰中性播报' },
};

export const DIALOGUES = {
  nurse_welcome: { voice:'nurse', text:'欢迎来到宝可梦中心！要为您的宝可梦恢复健康吗？' },
  nurse_heal:    { voice:'nurse', text:'请稍等……正在为您的宝可梦治疗。' },
  nurse_done:    { voice:'nurse', text:'您的宝可梦已经完全恢复健康了！<#0.3#>期待您再次光临！' },

  merchant_welcome: { voice:'merchant', text:'(laughs) 欢迎光临！看看有什么需要的吧！' },
  merchant_rare:    { voice:'merchant', text:'这可是稀罕货哦。' },
  merchant_thanks:  { voice:'merchant', text:'谢谢惠顾！' },
  merchant_bye:     { voice:'merchant', text:'欢迎下次再来！' },

  gym_rock_intro:  { voice:'gym_rock', text:'想拿徽章？先过我这关！' },
  gym_rock_lose:   { voice:'gym_rock', text:'好硬的意志……徽章拿去吧！' },
  gym_fire_intro:  { voice:'gym_fire', text:'让你见识火焰的热情！' },
  gym_fire_lose:   { voice:'gym_fire', text:'燃烧殆尽了……你赢了！' },

  narrator_badge_rock: { voice:'narrator', text:'获得了岩石徽章！' },
  narrator_badge_fire: { voice:'narrator', text:'获得了火焰徽章！' },
  narrator_evolution:  { voice:'narrator', text:'恭喜！宝可梦进化了！' },
};

// 村民闲聊语料池（玩法提示 / 传闻 / 寒暄），三种音色各一套
export const VILLAGER_CHATTER = {
  villager_m: [
    '按数字键 1 到 4 可以释放技能，5 到 9 是道具快捷栏。',
    '草丛里更容易遇到野生宝可梦，小心等级太高的区域。',
    '把野生宝可梦打到残血再投球，捕捉成功率会高很多。',
    '听说雪山深处住着一只很大的宝可梦……',
    '村口的道馆可不好惹，先把等级练上去再去挑战吧。',
  ],
  villager_f: [
    '护士姐姐治疗完全免费，受伤了一定要回来哦。',
    '晚上的草原会出现幽灵系宝可梦，好可怕呀……',
    '商人大叔不是每天都在，看到头顶的钱币标志就别错过！',
    '皮卡丘用雷之石就能进化成雷丘，进化石商人偶尔有卖。',
    '按 Tab 可以查看队伍和背包，按 R 能快速换出战伙伴。',
  ],
  villager_o: [
    '火山那边的岩浆池会烫伤脚，路过要小心呐。',
    '麻痹了就跑不快了，随身带点麻痹药总没错。',
    '老身年轻时也挑战过道馆……那馆主的宝可梦可真硬。',
    '宝可梦全灭的话，会损失一半的金钱，切记切记。',
    '湖里的鲤鱼王跃起二十级就能化龙，可别小看它。',
  ],
};

// 玩法提示（草原村新手村民固定说）
export const TUTORIAL_LINES = [
  '欢迎来到宝可梦世界！W A S D 移动，鼠标转动镜头。',
  '靠近野生宝可梦会进入战斗，技能会自动瞄准最近的目标。',
  '按 F 可以和村民、护士、商人对话，也能开宝箱、进道馆。',
];
