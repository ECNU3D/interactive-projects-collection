#!/usr/bin/env node
// gen-map.mjs — 山河舆图几何数据构建脚本
// 拉取 Natural Earth geojson（缓存到 tools/.cache/），投影 + 简化 + 量化后
// 烘焙为 data/map-geo.js（window.SHY_MAP_GEO）。用法：node tools/gen-map.mjs
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "tools", ".cache");
const OUT = join(ROOT, "data", "map-geo.js");

const SOURCES = {
  countries: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  provinces: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
  rivers: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson",
};

const NEIGHBOR_NAMES = [
  "Russia", "Mongolia", "Kazakhstan", "Kyrgyzstan", "Tajikistan",
  "Afghanistan", "Pakistan", "India", "Nepal", "Bhutan",
  "Myanmar", "Laos", "Vietnam", "North Korea", "South Korea", "Japan",
];

// ---- 下载（带缓存） ----
async function load(name, url) {
  const file = join(CACHE, url.split("/").pop());
  if (!existsSync(file)) {
    mkdirSync(CACHE, { recursive: true });
    console.log("download:", url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

// ---- 投影：伪墨卡托 ----
// merc(φ) 以“度”为单位，便于与经度同一比例：merc(φ) = ln tan(π/4 + φ/2) · 180/π
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)) * R2D;
const invMerc = (m) => (2 * Math.atan(Math.exp(m * D2R)) - Math.PI / 2) * R2D;

// 主视图：viewBox 1000×760，参考 bbox 为中国大陆（73–135.5E, 17.5–54N），
// 四边至少留 20px 边距，等比缩放后居中。
const VIEW_W = 1000, VIEW_H = 760, MARGIN = 20;
const REF = { lngMin: 73, lngMax: 135.5, latMin: 17.5, latMax: 54 };

function fitProj(lngMin, lngMax, latMin, latMax, w, h, margin) {
  const du = lngMax - lngMin;
  const dv = merc(latMax) - merc(latMin);
  const K = Math.min((w - 2 * margin) / du, (h - 2 * margin) / dv);
  const lng0 = (lngMin + lngMax) / 2 - w / 2 / K;
  const merc0 = (merc(latMax) + merc(latMin)) / 2 + h / 2 / K;
  return { lng0, lat0: invMerc(merc0), K };
}

const PROJ = fitProj(REF.lngMin, REF.lngMax, REF.latMin, REF.latMax, VIEW_W, VIEW_H, MARGIN);
const project = (lng, lat) => [(lng - PROJ.lng0) * PROJ.K, (merc(PROJ.lat0) - merc(lat)) * PROJ.K];

// ---- Douglas-Peucker 简化（像素空间） ----
function dp(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = ((px - ax) * dx + (py - ay) * dy) / len2;
        const cx = ax + Math.max(0, Math.min(1, t)) * dx;
        const cy = ay + Math.max(0, Math.min(1, t)) * dy;
        d = Math.hypot(px - cx, py - cy);
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

// ---- path 序列化：1 位小数（去尾零），绝对 M/L/Z，连续 L 省略命令字 ----
const fmt = (n) => {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};
function ringToPath(pts, close) {
  let s = "M" + fmt(pts[0][0]) + " " + fmt(pts[0][1]);
  for (let i = 1; i < pts.length; i++) s += " " + fmt(pts[i][0]) + " " + fmt(pts[i][1]);
  return close ? s + "Z" : s;
}

// geometry(Polygon|MultiPolygon) → 投影+简化后的环数组
function polyRings(geom, tol) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  const rings = [];
  for (const poly of polys) {
    for (const ring of poly) {
      const pts = dp(ring.map(([lng, lat]) => project(lng, lat)), tol);
      if (pts.length >= 4) rings.push(pts);
    }
  }
  return rings;
}

function fillPath(features, tol) {
  let parts = [], nPts = 0;
  for (const f of features) {
    for (const ring of polyRings(f.geometry, tol)) {
      parts.push(ringToPath(ring, true));
      nPts += ring.length;
    }
  }
  return { d: parts.join(""), nPts };
}

// ---- 主流程 ----
const [countries, provinces, rivers] = await Promise.all([
  load("countries", SOURCES.countries),
  load("provinces", SOURCES.provinces),
  load("rivers", SOURCES.rivers),
]);

// 1. 国家：china = China + Taiwan；neighbors = 周边 16 国
const byName = (n) => countries.features.filter((f) => f.properties.NAME === n);
const china = fillPath([...byName("China"), ...byName("Taiwan")], 0.7);
const neighborFeats = NEIGHBOR_NAMES.flatMap((n) => {
  const f = byName(n);
  if (!f.length) throw new Error(`missing country: ${n}`);
  return f;
});
const neighbors = fillPath(neighborFeats, 0.7);

// 2. 省界：admin == China / Taiwan，描边用（外环+内环都画）
const provFeats = provinces.features.filter(
  (f) => f.properties.admin === "China" || f.properties.admin === "Taiwan"
);
if (!provFeats.length) throw new Error("no CN provinces found");
const provParts = [];
let provPts = 0;
for (const f of provFeats) {
  for (const ring of polyRings(f.geometry, 0.9)) {
    provParts.push(ringToPath(ring, false));
    provPts += ring.length;
  }
}
const provincesPath = { d: provParts.join(""), nPts: provPts };

// 3. 河流：长江 = Tongtian + Jinsha + Chang Jiang + Yangtze 四段拼接；
//    黄河 = 全部 Huang（River 类）三段。各段 LineString 全部保留。
function mainRiver(match) {
  const parts = [];
  const allPts = [];
  let nPts = 0;
  for (const f of rivers.features.filter(match)) {
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const line of lines) {
      const pts = dp(line.map(([lng, lat]) => project(lng, lat)), 0.5);
      parts.push(ringToPath(pts, false));
      allPts.push(...pts);
      nPts += pts.length;
    }
  }
  if (!parts.length) throw new Error("river not found");
  const mid = allPts[Math.floor(allPts.length / 2)];
  return { d: parts.join(""), nPts, labelAnchor: [Math.round(mid[0] * 10) / 10, Math.round(mid[1] * 10) / 10] };
}
const YANGTZE_SEGMENTS = ["Tongtian", "Jinsha", "Chang Jiang", "Yangtze"];
const yangtze = mainRiver((f) => YANGTZE_SEGMENTS.includes(f.properties.name));
const yellow = mainRiver((f) => f.properties.name === "Huang" && f.properties.featurecla === "River");

// 4. 南海诸岛附图：frame 在 viewBox 左下角，独立小比例尺投影，坐标直接烘焙
const FRAME = [30, 560, 150, 180];
const DASH_LNGLAT = [
  [109.5, 21.0], [111.5, 19.5], [111.8, 15.5], [110.5, 12.0], [109.0, 7.5],
  [109.5, 5.0], [111.5, 3.5], [113.5, 6.5], [114.5, 10.0], [117.5, 15.0],
  [119.0, 18.5], [120.5, 20.5], [121.5, 22.0],
];
const ISLANDS = { 西沙群岛: [112.3, 16.5], 东沙群岛: [116.7, 20.7], 黄岩岛: [117.8, 15.1], 太平岛: [114.4, 10.4] };
const insetProj = fitProj(105, 123, 2, 24, FRAME[2], FRAME[3], 10);
const insetProject = (lng, lat) => [
  FRAME[0] + (lng - insetProj.lng0) * insetProj.K,
  FRAME[1] + (merc(insetProj.lat0) - merc(lat)) * insetProj.K,
];
const dashes = ringToPath(DASH_LNGLAT.map(([a, b]) => insetProject(a, b)), false);
const islands = Object.values(ISLANDS).map(([a, b]) => insetProject(a, b).map((n) => +n.toFixed(1)));
const label = { text: "南海诸岛", x: +(FRAME[0] + FRAME[2] / 2).toFixed(1), y: +(FRAME[1] + FRAME[3] - 10).toFixed(1) };

// 5. 海域标注（主图投影）
const SEAS = [
  ["渤海", 118.5, 38.8], ["黄海", 124.0, 35.8], ["东海", 126.5, 27.5], ["南海", 115.0, 17.0],
];
const seas = SEAS.map(([name, lng, lat]) => {
  const [x, y] = project(lng, lat);
  return { name, x: +x.toFixed(1), y: +y.toFixed(1) };
});

// ---- 输出 ----
const round = (n) => +n.toFixed(6);
const out = `// 山河舆图几何数据 — 由 tools/gen-map.mjs 生成，勿手改
// 投影公式（伪墨卡托，无依赖，运行时 js/map.js 用同一公式复现）：
//   merc(φ) = ln tan(π/4 + φ/2) · 180/π        （φ 单位：度）
//   x = (lng - proj.lng0) · proj.K
//   y = (merc(proj.lat0) - merc(lat)) · proj.K
// 数据源：Natural Earth（nvkelso/natural-earth-vector，公有领域）
window.SHY_MAP_GEO = {
  viewBox: { width: ${VIEW_W}, height: ${VIEW_H} },
  proj: { lng0: ${round(PROJ.lng0)}, lat0: ${round(PROJ.lat0)}, K: ${round(PROJ.K)} },
  china: "${china.d}",
  neighbors: "${neighbors.d}",
  provinces: "${provincesPath.d}",
  rivers: { yangtze: "${yangtze.d}", yellow: "${yellow.d}" },
  riverLabels: [
    { name: "长江", x: ${yangtze.labelAnchor[0]}, y: ${yangtze.labelAnchor[1] + 14} },
    { name: "黄河", x: ${yellow.labelAnchor[0]}, y: ${yellow.labelAnchor[1] - 10} }
  ],
  seas: ${JSON.stringify(seas)},
  southSea: {
    frame: [${FRAME.join(", ")}],
    dashes: "${dashes}",
    islands: ${JSON.stringify(islands)},
    label: ${JSON.stringify(label)},
  },
};
`;
writeFileSync(OUT, out);

// ---- 校验与汇报 ----
const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
const stats = [
  ["china", china], ["neighbors", neighbors], ["provinces", provincesPath],
  ["rivers.yangtze", yangtze], ["rivers.yellow", yellow],
];
for (const [name, s] of stats) {
  if (!s.d || s.d.length < 10) throw new Error(`${name} path empty`);
  console.log(`${name}: ${s.nPts} pts, path ${(s.d.length / 1024).toFixed(1)}KB`);
}
if (seas.length !== 4) throw new Error("seas incomplete");
const inBox = ([x, y]) => x >= 0 && x <= VIEW_W && y >= 0 && y <= VIEW_H;
for (const [label2, lng, lat, region] of [
  ["北京", 116.4, 39.9], ["乌鲁木齐", 87.6, 43.8], ["广州", 113.3, 23.1],
]) {
  const p = project(lng, lat);
  console.log(`project(${label2} ${lng},${lat}) = [${p[0].toFixed(1)}, ${p[1].toFixed(1)}] ${inBox(p) ? "OK" : "OUT-OF-VIEWBOX"}`);
  if (!inBox(p)) throw new Error(`${label2} 投影落在 viewBox 外`);
}
for (const s of seas) if (!inBox([s.x, s.y])) console.warn(`warn: sea ${s.name} outside viewBox`);
console.log(`wrote ${OUT} (${kb}KB)${kb >= 400 ? " — OVER 400KB!" : ""}`);
if (kb >= 400) process.exitCode = 1;
