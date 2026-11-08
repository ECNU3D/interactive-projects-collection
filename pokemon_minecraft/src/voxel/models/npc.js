// NPC 与道具体素模型（设计文档 §3.3：MC 村民比例——大头、粗鼻、长袍）
import { Vox } from '../vox.js';

const SKIN = 0xE8B88A, EYE = 0x1A1A1A, W = 0xFFFFFF;

// 村民基底（换色袍子）
function villagerBase(robe, trim) {
  const v = new Vox();
  v.bevelBox(-2, 2, 0, 5, -1, 1, robe);          // 长袍身体
  v.box(-2, 2, 0, 0, -1, 1, trim);              // 袍摆
  v.bevelBox(-3, 3, 5, 10, -2, 2, SKIN);        // 大头
  v.box(-1, 1, 6, 7, 2, 3, SKIN);               // 粗鼻
  for (const s of [1, -1]) {
    v.set(s * 1, 8, 2, EYE); v.set(s * 1, 9, 2, W);
    v.box(s * 3, s * 4, 2, 4, -1, 1, robe);     // 手臂（垂在两侧）
  }
  v.box(-2, 2, 8, 8, 2, 2, 0x6B4A2F);           // 一字眉
  return v;
}

export function buildVillager(variant = 0) {
  const robes = [
    [0x8A6A3A, 0x6B4A2F],   // 农夫 棕
    [0x4A6A9C, 0x3A5A8C],   // 渔夫 蓝
    [0x7A7A7A, 0x5A5A5A],   // 老人 灰
    [0x6A8A4A, 0x4A6A3A],   // 绿衣
  ];
  const [robe, trim] = robes[variant % robes.length];
  const v = villagerBase(robe, trim);
  if (variant % 4 === 0) v.box(-1, 1, 10, 11, -1, 1, 0x5DA347);  // 农夫草帽
  if (variant % 4 === 2) v.box(-2, 2, 10, 10, -2, 2, 0xDDDDDD);  // 老人白发
  return v;
}

export function buildNurse() {
  const v = new Vox();
  const PINK = 0xF2A7C3, WHITE = 0xF8F8F8, HAIR = 0xF2D45A;
  v.bevelBox(-2, 2, 0, 5, -1, 1, PINK);          // 粉色护士裙
  v.box(-2, 2, 0, 0, -1, 1, WHITE);
  v.bevelBox(-3, 3, 5, 10, -2, 2, SKIN);
  v.box(-1, 1, 6, 7, 2, 3, SKIN);
  for (const s of [1, -1]) {
    v.set(s * 1, 8, 2, EYE); v.set(s * 1, 9, 2, W);
    v.box(s * 3, s * 4, 2, 4, -1, 1, PINK);
    v.box(s * 2, s * 3, 5, 10, -2, -2, HAIR);    // 两侧金发
  }
  v.box(-3, 3, 10, 10, -2, 2, HAIR);             // 头顶发
  // 护士帽（红十字）
  v.box(-2, 2, 11, 11, -2, 1, WHITE);
  v.set(0, 12, 0, 0xE03A3A); v.set(-1, 11, 0, 0xE03A3A); v.set(1, 11, 0, 0xE03A3A);
  v.set(0, 11, -1, 0xE03A3A); v.set(0, 11, 1, 0xE03A3A);
  return v;
}

export function buildMerchant() {
  const v = new Vox();
  const ROBE = 0x7A5230, TRIM = 0x5A3A20, HAT = 0x9C7A4A;
  v.bevelBox(-2, 2, 0, 5, -1, 1, ROBE);          // 棕袍
  v.box(-2, 2, 0, 0, -1, 1, TRIM);
  v.bevelBox(-3, 3, 5, 10, -2, 2, SKIN);
  v.box(-1, 1, 6, 7, 2, 3, SKIN);
  for (const s of [1, -1]) {
    v.set(s * 1, 8, 2, EYE); v.set(s * 1, 9, 2, W);
    v.box(s * 3, s * 4, 2, 4, -1, 1, ROBE);
  }
  v.box(-3, 3, 10, 11, -2, 2, HAT);              // 宽檐帽
  v.box(-2, 2, 12, 12, -1, 1, HAT);
  v.box(-2, 2, 3, 4, -3, -2, 0x8A6A3A);          // 背篓
  v.set(0, 5, -3, 0xFCDC5F);                     // 金币袋
  v.box(-2, 2, 6, 6, 2, 2, 0x3A2A1A);            // 胡子
  return v;
}

// ---- 道具 ----
export function buildPokeball(top = 0xE03A3A) {
  const v = new Vox();
  const W2 = 0xF0F0F0, B = 0x222222;
  // 4×4×4 球
  v.bevelBox(0, 3, 0, 3, 0, 3, top);
  v.box(0, 3, 0, 1, 0, 3, W2);                    // 下半白
  v.box(0, 3, 1, 2, 0, 3, B);                     // 中间黑带
  v.set(1, 2, 1, 0xF0F0F0); v.set(1, 2, 2, 0xF0F0F0); // 按钮
  v.set(2, 2, 1, 0xF0F0F0); v.set(2, 2, 2, 0xF0F0F0);
  return v;
}

export function buildChest() {
  const v = new Vox();
  const WOOD = 0x9C6A3A, DARK = 0x6B4A2F, GOLD = 0xFCDC5F;
  v.box(0, 5, 0, 2, 0, 4, WOOD);
  v.box(0, 5, 3, 4, 0, 4, DARK);
  v.box(0, 5, 2, 2, 0, 0, GOLD); v.box(0, 5, 2, 2, 4, 4, GOLD);
  v.box(2, 3, 2, 3, 2, 2, GOLD);                  // 锁扣
  return v;
}

export function buildItemCube(color) {
  const v = new Vox();
  v.bevelBox(0, 2, 0, 2, 0, 2, color);
  return v;
}
