// 道具数据（设计文档 §11 / §5.2，价格参考官方作品）
// kind: ball 精灵球 / heal 回复 / status 解异常 / stone 进化石
export const ITEMS = {
  pokeball:    { name:'精灵球', kind:'ball',  price:200,  ballBonus:1.0, icon:'⚪', desc:'用于捕捉野生宝可梦的标准球。' },
  greatball:   { name:'超级球', kind:'ball',  price:600,  ballBonus:1.5, icon:'🔵', desc:'比精灵球更容易捕捉宝可梦。' },
  ultraball:   { name:'高级球', kind:'ball',  price:1200, ballBonus:2.0, icon:'🟡', desc:'性能优异的高级精灵球。' },
  masterball:  { name:'大师球', kind:'ball',  price:50000, ballBonus:255, icon:'🟣', desc:'必定能捕捉到宝可梦的传说之球。' },

  potion:      { name:'伤药',   kind:'heal',  price:300,  heal:20,  icon:'🧪', desc:'回复 20 点 HP。' },
  superpotion: { name:'好伤药', kind:'heal',  price:700,  heal:60,  icon:'💉', desc:'回复 60 点 HP。' },
  fullrestore: { name:'全满药', kind:'heal',  price:2500, heal:999, icon:'⚗️', desc:'HP 全部回复。' },

  antidote:    { name:'解毒药', kind:'status', price:100, cures:['poison','badpoison'], icon:'🟢', desc:'解除中毒/剧毒状态。' },
  paralyzheal: { name:'麻痹药', kind:'status', price:200, cures:['paralysis'], icon:'🟡', desc:'解除麻痹状态。' },
  burnheal:    { name:'烧伤药', kind:'status', price:250, cures:['burn'], icon:'🟠', desc:'解除烧伤状态。' },
  iceheal:     { name:'解冻药', kind:'status', price:250, cures:['freeze'], icon:'🔵', desc:'解除冰冻状态。' },
  awakening:   { name:'苏醒药', kind:'status', price:250, cures:['sleep'], icon:'⚪', desc:'解除睡眠状态。' },
  fullheal:    { name:'万灵药', kind:'status', price:600, cures:['poison','badpoison','paralysis','burn','freeze','sleep'], icon:'🌈', desc:'解除全部异常状态。' },

  firestone:    { name:'火之石', kind:'stone', price:3000, icon:'🔥', desc:'让特定宝可梦进化的火焰之石。' },
  waterstone:   { name:'水之石', kind:'stone', price:3000, icon:'💧', desc:'让特定宝可梦进化的水之石。' },
  thunderstone: { name:'雷之石', kind:'stone', price:3000, icon:'⚡', desc:'让特定宝可梦进化的雷之石。' },
  leafstone:    { name:'叶之石', kind:'stone', price:3000, icon:'🍃', desc:'让特定宝可梦进化的叶之石。' },
  moonstone:    { name:'月之石', kind:'stone', price:3000, icon:'🌙', desc:'让特定宝可梦进化的月之石。' },
  icestone:     { name:'冰之石', kind:'stone', price:3000, icon:'❄️', desc:'让特定宝可梦进化的冰之石。' },
};

export const ITEM_CATEGORIES = [
  { key:'ball',   name:'精灵球' },
  { key:'heal',   name:'回复' },
  { key:'status', name:'解异常' },
  { key:'stone',  name:'进化石' },
];
