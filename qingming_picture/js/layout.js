// 世界布局：手卷四段，自西向东（+X 方向前行）
//   郊野春光 0..300 | 汴河漕运 300..396 岸 | 虹桥 388..484 | 城门 640 | 城內街市 640..980

export const WORLD = {
  x0: -80, x1: 1060,
  z0: -230, z1: 230,
};

export const RIVER = {
  x0: 396, x1: 476,        // 水面范围
  bank0: 388, bank1: 484,  // 岸坡起点
  waterY: -1.15,
  bedY: -3.2,
};

export const BRIDGE = {
  x0: 388, x1: 484,
  cx: 436,
  half: 48,
  height: 8.2,
  deckHalfW: 6,
  walkHalfW: 5.2,
};

export const WALL = {
  x: 660, thick: 12, gateHalf: 8.5, height: 13,
};

export const ROAD = { halfW: 8, cityHalfW: 12 };

export const SECTIONS = [
  { name: '郊野春光', x0: -40, x1: 300 },
  { name: '汴河漕運', x0: 300, x1: 396 },
  { name: '虹橋喧闐', x0: 396, x1: 520 },
  { name: '城內街市', x0: 520, x1: 1000 },
];

// 桥面高度
export function bridgeY(x) {
  const dx = (x - BRIDGE.cx) / BRIDGE.half;
  if (Math.abs(dx) > 1) return 0;
  return BRIDGE.height * Math.pow(Math.max(0, 1 - dx * dx), 1.25);
}

// 建筑碰撞盒（世界各处注册）
export const colliders = [];
export function addCollider(x0, x1, z0, z1) {
  colliders.push({ x0, x1, z0, z1 });
}

// 可行走高度；返回 null 表示不可进入（河水）
export function walkHeight(x, z) {
  const onBridgeX = x > BRIDGE.x0 && x < BRIDGE.x1;
  const inRiverX = x > RIVER.bank0 + 2 && x < RIVER.bank1 - 2;
  if (onBridgeX && Math.abs(z) <= BRIDGE.deckHalfW) return bridgeY(x);
  if (inRiverX) return null;
  return 0;
}
