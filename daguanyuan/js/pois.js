// 講解觸發點（對應 audio/*.mp3 與 narrations.json）
export const POIS = [
  { id: 'welcome', x: -91.2, z: 30, r: 22 },
  // 榮國府
  { id: 'rongmen', x: -91.2, z: -6, r: 12 },
  { id: 'yimen', x: -91.2, z: -44, r: 10 },
  { id: 'rongxitang', x: -91.2, z: -144, r: 12 },
  { id: 'jiamu', x: -147, z: -94, r: 14 },
  { id: 'fengjie', x: -151, z: -148, r: 11 },
  { id: 'jiashe', x: -37, z: -55, r: 13 },
  { id: 'lixiang', x: -38, z: -184, r: 11 },
  // 寧國府
  { id: 'ningmen', x: 91.2, z: -6, r: 12 },
  { id: 'zongci', x: 38, z: -48, r: 14 },
  { id: 'ningtang', x: 91.2, z: -154, r: 12 },
  { id: 'jiadao', x: 0, z: -180, r: 15 },
  // 大觀園
  { id: 'yuanmen', x: -20, z: -218, r: 12 },
  { id: 'cuizhang', x: -18, z: -248, r: 13 },
  { id: 'qinfang', x: -20, z: -291, r: 13 },
  { id: 'xiaoxiang', x: -119, z: -318, r: 16 },
  { id: 'huazhong', x: -152, z: -340, r: 12 },
  { id: 'yihong', x: 126, z: -334, r: 16 },
  { id: 'dicui', x: 66, z: -362, r: 12 },
  { id: 'qiushuang', x: -96, z: -402, r: 14 },
  { id: 'ouxiang', x: 34, z: -438, r: 13 },
  { id: 'zhuijin', x: 102, z: -448, r: 13 },
  { id: 'nuanxiang', x: 145, z: -500, r: 12 },
  { id: 'hengwu', x: 28, z: -510, r: 15 },
  { id: 'daoxiang', x: -134, z: -484, r: 16 },
  { id: 'longcui', x: -156, z: -564, r: 14 },
  { id: 'luxue', x: -64, z: -632, r: 12 },
  { id: 'liaoting', x: -30, z: -681, r: 13 },
  { id: 'shengqin', x: 0, z: -622, r: 18 },
  { id: 'jiayin', x: -8, z: -704, r: 13 },
  { id: 'tubi', x: 140, z: -782, r: 22 },
  { id: 'zha', x: 168, z: -804, r: 13 },
  { id: 'tianxiang', x: 150, z: -254, r: 13 },
];

// 全圖上的景點（可點擊神遊）
export const MAP_SPOTS = POIS.filter((p) => p.id !== 'welcome');
