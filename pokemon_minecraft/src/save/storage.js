// 存档系统（设计文档 §16）：localStorage 自动存档 + 导出/导入 JSON
const SAVE_KEY = 'pokemon_voxel_save_v1';

// 需要持久化的游戏状态切片
export function serialize(game) {
  return JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    player: {
      x: game.player.pos.x, y: game.player.pos.y, z: game.player.pos.z,
      yaw: game.player.yaw,
    },
    party: game.party.members.map(m => ({ ...m })),
    activeIndex: game.party.activeIndex,
    bag: { ...game.bag },
    quickbar: [...game.quickbar],
    money: game.money,
    badges: [...game.badges],
    dex: [...game.dex],                 // 已点亮的图鉴 chain
    respawn: game.respawn,              // 最近使用过的宝可梦中心 {village, x,y,z}
    chestsOpened: [...game.chestsOpened],
    merchant: game.merchantState,       // 当日商人位置与稀有栏
    completed: !!game.completed,        // 通关标记（v4 结局）
    volumes: { ...game.volumes },       // 三通道音量
    dayTime: game.dayTime,
  });
}

export function deserialize(json) {
  const data = JSON.parse(json);
  if (!data || data.version !== 1) throw new Error('存档版本不兼容');
  return data;
}

export function save(game) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(game));
    return true;
  } catch (e) { console.warn('存档失败', e); return false; }
}

export function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try { return deserialize(raw); } catch (e) { console.warn('读档失败', e); return null; }
}

export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
export function clearSave() { localStorage.removeItem(SAVE_KEY); }
