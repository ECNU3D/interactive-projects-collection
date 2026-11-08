# 山河舆图（历史地图）设计文档

日期：2026-07-24
状态：已确认（用户委托设计 + 实现，自动模式）

## 背景与目标

《山河岁月》主界面为横向时间卷轴（15 章 / 93 事件 / 26 抉择）。每个事件已有 `place` 中文地名字段，但无坐标，项目无任何地图功能。

目标：让用户知道每个关键事件发生的地理位置，并提供有视觉冲击力的动效，风格与「水墨宣纸 + 墨色/朱砂/鎏金」体系一致，全部资源本地化（零外部运行时请求）。

## 底图方案决策

候选方案：

1. **公有领域古地图扫描图（Wikimedia）**：有历史感，但投影未知导致事件标点错位，与水墨 UI 风格割裂。否决。
2. **在线地图（Leaflet/高德）**：违背项目全本地原则，现代风格违和。否决。
3. **Natural Earth 公有领域数据自建矢量水墨舆图（选定）**：构建脚本拉取公开地理数据（国界、中国省界、长江/黄河、南海诸岛），投影 + 简化后烘焙为 SVG path 数据文件。定位精确（经纬度→投影数学映射），风格完全可控，运行时零依赖。

## 功能设计

### 1. 新视图「山河舆图」（map-view）

- 顶栏新增「舆图」按钮，与「星图」并列；复用 app.js 的视图切换机制（`#views` 内新增 `map-view`）。
- 地图内容（SVG，viewBox 约 1000×800）：
  - 中国轮廓（含台湾、海南），墨色描边 + 宣纸色填充；
  - 邻国（俄、蒙、朝、韩、日、越、印等）淡墨轮廓作地理语境；
  - 中国省界淡墨细线；
  - 长江、黄河以稍粗墨线绘出（"山河"点题）；
  - 竖排海域标注（渤海/黄海/东海/南海）与少量地名注记；
  - 左下角南海诸岛附图框（虚线九段线 + 主要岛礁点）。
- 事件标注：
  - 普通事件 = 朱砂圆点；抉择事件 = 旋转 45° 菱形（与长卷节点语言一致）；开国大典 e1401 为特殊大标记。
  - **只显示已解锁事件**（读 `shanhe_save_v1` 的 unlockedCount，与长卷防剧透逻辑一致）；当前前沿节点鎏金呼吸动画。
  - 域外事件（巴黎和会、马关条约/下关、重返联合国/纽约、留美幼童等少量）在地图对应方向边缘以「域外注记」标注：小字标签 + 虚线引线指向图外。
- 交互：
  - 悬停：tooltip 显示事件名 + 年代，墨晕扩散；
  - 点击：调用 `SHY_SCROLL.openEvent(eventId)` 打开现有事件卡 modal；
  - 聚焦模式（从事件卡跳入）：地图平滑平移缩放至目标事件，金色同心圆扩散三圈。

### 2. 动效

- 视图进入：容器如宣纸展开（opacity + scaleY 缓动）→ 国土墨线自绘（stroke-dashoffset）→ 事件点按全局时间序 staggered 落点（缩放弹入 + 涟漪环）。
- 「历史足迹」路线：按全局时间序将所有已显示事件连成一条金色折线，以 dash 动画自绘；一颗金色光点沿路径循环行进（`getPointAtLength` + rAF），光点经过处事件点短暂提亮。
- 前沿事件：`shy-pulse` 呼吸（复用长卷动画）。
- 章节主题联动：地图强调色读 `--c-primary/--c-accent`（与整页主题一致）。
- 性能：全部动效为 CSS transform/opacity + SVG stroke 动画 + 单个 rAF 光点，不引入 WebGL。

### 3. 与长卷联动

- 事件卡（scroll.js 的 `.event-card`）meta 行的"地点"渲染为按钮：`📍 {place} · 查看舆图`，点击 → 切换 map-view 并 `SHY_MAP.focus(eventId)`。
- 从舆图返回：沿用 app.js 的 navOrigin 导航栈（返回长卷）。

### 4. 数据

- `tools/gen-map.mjs`（构建期脚本，node 直接运行）：
  - 下载 Natural Earth geojson（nvkelso/natural-earth-vector 镜像）：
    - `ne_50m_admin_0_countries.geojson`（国界，50m 足够小）；
    - `ne_10m_admin_1_states_provinces.geojson`（取中国省界，简化）；
    - `ne_50m_rivers_lake_centerlines.geojson`（取 Yangtze/Huang He）。
  - 处理：筛选所需国家/省/河 → 伪墨卡托投影（自实现，无依赖）→ 坐标量化（1 位小数）→ 可选道格拉斯-普克简化 → 输出 `data/map-geo.js`（`window.SHY_MAP_GEO = {...}`，含 china/neighbors/provinces/rivers 的 path 串 + 投影参数 + 南海诸岛附图数据）。
  - 下载文件缓存在 `tools/.cache/`（gitignore）。
- `data/map-places.js`（手工编写）：`window.SHY_MAP_PLACES = { eventId: {geo:[lng,lat], offshore?: "W"|"E"|..., label?} }`，覆盖全部 93 个事件；坐标按事件 `place` 字段查常用城市坐标，同地复用；域外事件标 `offshore`。
- 经纬度→SVG 坐标换算在 js/map.js 运行时进行（用 map-geo.js 里的投影参数），保证附图/注记也可复用。

### 5. 文件改动清单

| 文件 | 改动 |
|---|---|
| `tools/gen-map.mjs` | 新增：地理数据获取/投影/简化/烘焙脚本 |
| `data/map-geo.js` | 新增（脚本生成）：几何数据 |
| `data/map-places.js` | 新增（手工）：93 事件经纬度 |
| `js/map.js` | 新增：`SHY_MAP {render, focus(eventId), refresh()}`，经典 script 全局模式（与项目一致） |
| `index.html` | 顶栏加「舆图」按钮；`#views` 加 `map-view`；script 标签加 data/map-geo、data/map-places、js/map.js |
| `js/app.js` | 注册 map-view 视图切换、导航栈、顶栏按钮 |
| `js/scroll.js` | 事件卡地点渲染为「查看舆图」入口；解锁推进后 `SHY_MAP.refresh()` |
| `css/main.css` | 舆图全部样式 + 动效 keyframes |

### 6. 边界与非目标

- 不做在线瓦片地图、不做拖拽缩放自由浏览（仅聚焦模式的程序性平移缩放；若实现成本低可允许滚轮缩放/拖拽，作为可选项）。
- 不改变事件解锁/计分/存档结构；只读存档。
- 域外事件不做世界地图，仅边缘注记。
- 历史疆域变迁（清朝 vs 民国 vs 新中国边界差异）不做分时切换，统一用现代中国轮廓（教育类简化，南海诸岛附图保证完整）。

## 测试与验证

- `node tools/gen-map.mjs` 可重复运行，输出体积检查（目标 map-geo.js < 400KB）。
- `node --check` 校验所有新增/修改 JS。
- 本地 `node tools/serve.mjs` 启动后：浏览器打开验证（如有 headless 截图工具则截图核对地图渲染、标注位置、动效首帧）。
- 抽查若干事件标点位置与常识地理位置一致（如遵义在贵州、西柏坡在河北）。
