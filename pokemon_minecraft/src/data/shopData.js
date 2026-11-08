// 商店数据（设计文档 §5.2）
import { ITEMS } from './items.js';

// 常驻商品
export const SHOP_STAPLE = [
  'pokeball','greatball','ultraball',
  'potion','superpotion','fullrestore',
  'antidote','paralyzheal','burnheal','iceheal','awakening','fullheal',
];

// 稀有栏：每日随机上架 2~3 种；大师球 1% 概率
export const SHOP_RARE_POOL = ['firestone','waterstone','thunderstone','leafstone','moonstone','icestone'];
export const SHOP_RARE_COUNT = [2, 3];        // 每日 2~3 种
export const MASTERBALL_CHANCE = 0.01;

// 卖出价格为买入价的一半
export function sellPrice(itemId) {
  return Math.floor((ITEMS[itemId]?.price || 0) / 2);
}

// 用种子随机生成当日稀有栏（同一天全服一致）
export function dailyRareItems(daySeed, rand) {
  const items = [];
  const pool = [...SHOP_RARE_POOL];
  const count = SHOP_RARE_COUNT[0] + Math.floor(rand() * (SHOP_RARE_COUNT[1] - SHOP_RARE_COUNT[0] + 1));
  for (let i = 0; i < count && pool.length; i++) {
    items.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  if (rand() < MASTERBALL_CHANCE) items.push('masterball');
  return items;
}
