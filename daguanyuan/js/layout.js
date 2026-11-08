// 世界常量、地形高度、碰撞、分區
// 尺度依徐建平考證：模數「方三丈」= 9.6m；二府各面闊 18 格 = 172.8m，進深 21 格 = 201.6m，
// 大門間距 182.4m（小於「一箭之路」192m）；大觀園周長三里半 ≈ 2016m。

export const GRID = 9.6;

export const WORLD = { x0: -280, x1: 280, z0: -900, z1: 70 };

// 寧榮街（二府之南）
export const STREET = { z0: 0, z1: 17, x0: -230, x1: 230 };

// 榮國府（西）／夾道（省親後已連屬）／寧國府（東）
export const RONG = { x0: -177.6, x1: -4.8, z0: -201.6, z1: 0, gateX: -91.2 };
export const JIADAO = { x0: -4.8, x1: 4.8, z0: -201.6, z1: 0 };
export const NING = { x0: 4.8, x1: 177.6, z0: -201.6, z1: 0, gateX: 91.2 };

// 後街（府北，梨香院另有街門通此）
export const HOUJIE = { z0: -211.2, z1: -201.6 };

// 大觀園
export const YUAN = { x0: -182.4, x1: 182.4, z0: -854.4, z1: -211.2 };
export const YUAN_GATE = { x: -20, z: -211.2 };          // 園正門（五間）
export const YUAN_EGATE = { x: 122, z: -211.2 };         // 東角門（通寧府會芳園舊路）
export const YUAN_WGATE = { x: -150, z: -211.2 };        // 西角門（通榮府賈母院後）

// ---------------------------------------------------------------- 地形
// 假山土阜：走上去平緩可行
export const HILLS = [
  { x: -20, z: -243, r: 26, h: 7.5 },      // 翠嶂（入園迎面）
  { x: 150, z: -762, r: 62, h: 15 },       // 凸碧山莊所在的山脊
  { x: 118, z: -800, r: 34, h: 5 },        // 凹晶溪館所在的低窪外緣
  { x: 26, z: -498, r: 30, h: 5.5 },       // 蘅蕪苑前的大玲瓏山石堆
  { x: -152, z: -566, r: 26, h: 6 },       // 櫳翠庵坡地
  { x: -66, z: -628, r: 22, h: 4 },        // 蘆雪廣傍山
  { x: 96, z: -690, r: 28, h: 6.5 },
  { x: -128, z: -700, r: 30, h: 5 },
];

function hillH(x, z) {
  let h = 0;
  for (let i = 0; i < HILLS.length; i++) {
    const H = HILLS[i];
    const d = Math.hypot(x - H.x, z - H.z);
    if (d < H.r) {
      const t = 1 - d / H.r;
      h += H.h * t * t * (3 - 2 * t);
    }
  }
  return h;
}

// ---------------------------------------------------------------- 沁芳水系
// 第十七回賈珍：「原從那閘起流至那洞口，從東北山坳裡引到那村莊裡，
// 又開一道岔口，引至西南上，共總流到這裡。」——自東北入，繞園一周，匯於沁芳橋。
export const STREAM = [
  // 主流：東北閘口 → 凹晶溪館 → 西南
  { a: [168, -800], b: [140, -790], w: 7 },
  { a: [140, -790], b: [112, -778], w: 8 },
  { a: [112, -778], b: [90, -748], w: 8 },
  { a: [90, -748], b: [58, -712], w: 9 },
  { a: [58, -712], b: [12, -676], w: 9 },
  { a: [12, -680], b: [-56, -664], w: 10 },       // 繞省親別墅與綴錦閣之北
  { a: [-56, -664], b: [-92, -606], w: 10 },      // 蘆雪廣傍水
  { a: [-92, -606], b: [-94, -516], w: 9 },       // 「引到那村莊裡」——傍稻香村東牆外
  // 西支：稻香村 → 秋爽齋東 → 瀟湘館 →（西南）沁芳。均自院牆外繞行
  { a: [-94, -516], b: [-92, -456], w: 9 },
  { a: [-92, -456], b: [-64, -424], w: 9 },
  { a: [-64, -424], b: [-52, -372], w: 10 },
  { a: [-52, -372], b: [-20, -292], w: 11 },
  // 東支：「又開一道岔口」——藕香榭 → 紫菱洲 → 怡紅院 → 沁芳
  { a: [58, -712], b: [86, -668], w: 7 },
  { a: [86, -668], b: [92, -610], w: 8 },
  { a: [92, -610], b: [78, -546], w: 8 },
  { a: [78, -546], b: [62, -478], w: 9 },
  { a: [62, -478], b: [60, -424], w: 10 },
  { a: [60, -424], b: [84, -380], w: 10 },
  { a: [84, -380], b: [88, -334], w: 9 },
  { a: [88, -334], b: [48, -300], w: 10 },
  { a: [48, -300], b: [-20, -292], w: 11 },
  // 「共總流到這裡」：沁芳橋下一帶東西向水面
  { a: [-20, -292], b: [-76, -280], w: 11 },
  { a: [-76, -280], b: [-130, -276], w: 9 },
];

function segDist(px, pz, s) {
  const ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1];
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz;
  let t = L2 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function waterDepth(x, z) {
  let best = -1;
  for (let i = 0; i < STREAM.length; i++) {
    const s = STREAM[i];
    const d = segDist(x, z, s);
    const hw = s.w / 2;
    if (d < hw) best = Math.max(best, 1 - d / hw);
  }
  return best;   // <0 表示不在水中
}

// ---------------------------------------------------------------- 橋
// deck: 橋面標高（拱頂）；橋以 a→b 為軸，寬 w
export const BRIDGES = [
  { id: 'qinfang', name: '沁芳桥', a: [-20, -310], b: [-20, -272], w: 5.4, rise: 2.6 },
  { id: 'fengyao', name: '蜂腰桥', a: [93, -377], b: [78, -373], w: 3.0, rise: 1.8 },
  { id: 'cuiyan', name: '翠烟桥', a: [-72, -445], b: [-84, -435], w: 3.0, rise: 1.7 },
  { id: 'ouxiang', name: '藕香榭竹桥', a: [48, -450], b: [72, -451], w: 2.6, rise: 1.0 },
  { id: 'huaxu', name: '花溆小桥', a: [-21, -310], b: [-37, -299], w: 2.8, rise: 1.3 },
  { id: 'liaoting', name: '蓼汀桥', a: [-30, -680], b: [-26, -661], w: 3.2, rise: 2.0 },
  { id: 'aojing', name: '凹晶溪馆石樑', a: [96, -790], b: [128, -770], w: 2.6, rise: 1.1 },
  { id: 'luxueqiao', name: '芦雪桥', a: [-104, -556], b: [-83, -554], w: 2.6, rise: 1.2 },
  { id: 'daoxiang', name: '稻香村板桥', a: [-86, -480], b: [-99, -479], w: 2.4, rise: 1.0 },
];

function bridgeH(x, z) {
  for (let i = 0; i < BRIDGES.length; i++) {
    const B = BRIDGES[i];
    const ax = B.a[0], az = B.a[1], bx = B.b[0], bz = B.b[1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    let t = L2 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0;
    if (t < -0.22 || t > 1.22) continue;
    const cl = Math.hypot(x - (ax + dx * Math.max(0, Math.min(1, t))), z - (az + dz * Math.max(0, Math.min(1, t))));
    if (cl > B.w / 2) continue;
    const tt = Math.max(0, Math.min(1, t));
    return { h: B.rise * Math.sin(Math.PI * tt), b: B };
  }
  return null;
}

// ---------------------------------------------------------------- 碰撞
// 每個碰撞盒 {x0,z0,x1,z1}；門洞用 gaps（沿 x 或 z 的開口）避免堵死
export const colliders = [];

export function addCollider(x0, z0, x1, z1) {
  colliders.push({
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1),
  });
}

/** 牆帶門洞：沿長邊開一段口 */
export function addWallWithGap(x0, z0, x1, z1, gapAt, gapW) {
  const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  if (gapW <= 0) { addCollider(x0, z0, x1, z1); return; }
  if (horiz) {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    const g0 = gapAt - gapW / 2, g1 = gapAt + gapW / 2;
    if (g0 > lo) addCollider(lo, z0, g0, z1);
    if (g1 < hi) addCollider(g1, z0, hi, z1);
  } else {
    const lo = Math.min(z0, z1), hi = Math.max(z0, z1);
    const g0 = gapAt - gapW / 2, g1 = gapAt + gapW / 2;
    if (g0 > lo) addCollider(x0, lo, x1, g0);
    if (g1 < hi) addCollider(x0, g1, x1, hi);
  }
}

// ---------------------------------------------------------------- 台基與踏跺
// 台基：矩形平台，站上去即抬高；踏跺：沿 axis 方向由 h0 漸變到 h1
export const platforms = [];

export function addPlatform(x0, z0, x1, z1, h) {
  platforms.push({
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1), h, ramp: null,
  });
}

/** axis: 'z' 表示沿 z 由 z0→z1 從 h0 升到 h1；'x' 同理 */
export function addRamp(x0, z0, x1, z1, h0, h1, axis = 'z') {
  platforms.push({
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    h: Math.max(h0, h1), ramp: { h0, h1, axis, a0: axis === 'z' ? z0 : x0, a1: axis === 'z' ? z1 : x1 },
  });
}

function platformH(x, z) {
  let best = 0;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    let h = p.h;
    if (p.ramp) {
      const a = p.ramp.axis === 'z' ? z : x;
      let t = (a - p.ramp.a0) / (p.ramp.a1 - p.ramp.a0);
      t = Math.max(0, Math.min(1, t));
      h = p.ramp.h0 + (p.ramp.h1 - p.ramp.h0) * t;
    }
    if (h > best) best = h;
  }
  return best;
}

// ---------------------------------------------------------------- 地面高度
/** 返回可行走高度；null = 不可通行（水面） */
export function walkHeight(x, z) {
  const br = bridgeH(x, z);
  const pf = platformH(x, z);
  // 橋與台基重疊時取高者；若只用橋高，台基上會被挖出一個踏空的坑
  const best = Math.max(br ? br.h : -Infinity, pf > 0 ? pf : -Infinity);
  if (best > -Infinity) return best;
  if (waterDepth(x, z) > 0) return null;
  return hillH(x, z);
}

/** 純地形高度（造景時用，不判水） */
export function groundHeight(x, z) {
  return hillH(x, z);
}

// ---------------------------------------------------------------- 分區（小地圖題名用）
// 依次匹配，先命中者為準
export const REGIONS = [];

export function addRegion(name, x0, z0, x1, z1, kind = 'yard') {
  REGIONS.push({
    name, kind,
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1),
  });
}

export function regionAt(x, z) {
  let best = null, bestArea = Infinity;
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i];
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      const a = (r.x1 - r.x0) * (r.z1 - r.z0);
      if (a < bestArea) { bestArea = a; best = r; }
    }
  }
  if (best) return best.name;
  if (z > STREET.z0 - 2) return '宁荣街';
  if (z > YUAN.z1) return x < JIADAO.x0 ? '荣国府' : x > JIADAO.x1 ? '宁国府' : '宁荣夹道';
  return '大观园';
}

// 出生點：寧榮街上，榮國府大門之南
export const SPAWN = { x: -91.2, z: 13, yaw: 0 };
