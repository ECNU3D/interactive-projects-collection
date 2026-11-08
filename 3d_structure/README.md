# 机械星球 · 3D 结构博物馆

一个面向约 8–14 岁儿童与亲子用户的机械结构科普 Web APP。当前包含 M4 风格中型坦克、NASA X-57 Maxwell 研究构型、受历史 ASR-10 救生叙事启发的现代救援船教学复合模型，以及 M1903 Springfield、M1911A1、M1 Garand、HK MP5 四件枪械循环教学模型。七件展品都可通过可旋转、可缩放的程序化 3D 模型观察结构与系统协作。

> 本项目是教育性重建，不是工程图纸，也不提供制造、改装、射击、弹药、火控或战术操作信息。

## 当前体验

- 夜航博物馆风格的七展项藏品大厅，分为“陆海空大型机械”和“发射循环实验室”。
- 七套完整结构探索：M4 中型坦克、X-57 电动飞机、现代救援船教学复合模型，以及四种不同机构的枪械循环教学模型。
- 每件展品都有 6 个观察阶段和 11 个可选结构部件。
- 77 张中文知识卡，均区分史实依据、简化示意、观察问题与一手来源。
- 默认开启的新手导览、分阶段提示、无惩罚观察结论和可暂停自动演示。
- 知识卡明确区分“史实依据”“简化示意”和“观察问题”。
- 拆解、透视、原理三种显示模式；四件枪械还提供确定性的六阶段单次循环、暂停、前后逐步查看与复原。
- 鼠标、触控、键盘和知识卡朗读入口。
- WebGL 不可用或 3D 模块失败时的完整静态学习路径。
- `prefers-reduced-motion`、清晰焦点、44 px 触控目标与移动端布局；减少动态时停用枪械连续播放，但保留手动逐阶段查看。
- 七件展品的学习进度分别保存在当前浏览器的 `localStorage`，互不覆盖，不需要账号或后端。

## 视觉呈现架构

### 自适应质量与程序化灯光

动态展品共用一套质量策略和夜场展台。宽度大于 820 px、且不是粗指针设备时使用桌面质量档：DPR 范围为 1–2，开启 Canvas 阴影、2048 px 主阴影贴图、有限帧 AccumulativeShadows，并按需懒加载 N8AO、选择描边、选择性 Bloom、SMAA 与 Vignette。宽度不超过 820 px 或使用粗指针时进入受限档：DPR 范围为 1–1.25，关闭 Canvas 阴影和整条后处理，改用浏览器抗锯齿与一次有限的 256 px ContactShadows。受限档不会请求桌面后处理 chunk。

反射环境不依赖外部 HDRI。`ScenePresentation` 使用项目自建的暖色顶光板、冷色轮廓光板和黄铜低位反射板，再配合暖主光、冷轮廓光和低位补光形成三点光语法；圆形哑光展台、刻度环、渐变穹顶和静态尘埃同样完全程序化。船舶水面是冻结友好的抽象教学着色器，明确不是海况或稳性模型。

`prefers-reduced-motion` 下所有入场动效、相机缓移和连续原理播放都停止；静态降级、减少动态与手动暂停状态由浏览器像素稳定测试守护。React Three Fiber 继续使用 demand 帧，只在状态或有限阴影采样真正变化时重绘。

### 共享材质状态与舞台优先 UI

七件展品统一使用 `solid | pending | xray | dimmed` 材质状态。正常已展示零件是不透明实体；未解锁零件用低饱和“待展出”材质；只有 X 光壳体和明确标记的教学体积允许透明。hover、selected 只改变强调级别、选择描边和轻微尺度，不会覆盖安全的透明语义。八色机械调色板与知识卡色点使用相同设计令牌。

探索室采用舞台优先布局：桌面和平板的舞台至少占工作区宽度与视口高度的 70%；单一 `LearningGuide` 负责当前问题和模式说明，单一 `JourneyBar` 承载六阶段时间线，零件清单与知识卡收进可折叠 `ExplorerInspector`。移动端 Inspector 变为不高于 `62dvh` 的 bottom sheet，保持在旅程条和底部导航之上；所有可见控制维持至少 44 × 44 px 的触控目标。

## 本地运行

需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm install
npm run dev
```

Vite 默认会提供类似 `http://127.0.0.1:5173` 的本地地址。

常用命令：

```bash
npm test -- --run  # 运行全部 Vitest 单元与组件测试
npm run build      # TypeScript + Vite 生产构建 + 资源预算门禁
npm run test:e2e   # 用 Chromium 运行全部 Playwright 端到端测试
npm run test:watch # 交互式 Vitest 监听
```

第一次运行端到端测试前，如本机尚未安装 Playwright Chromium，可执行：

```bash
npx playwright install chromium
```

仅复核本轮视觉品质契约和固定轮廓基线时，可执行：

```bash
npx playwright test tests/e2e/visual-quality.spec.ts tests/e2e/geometry-silhouette.spec.ts
```

## 使用方式

在藏品大厅选择任意一件藏品的“开始探索”进入对应结构探索室。

### 鼠标与触控

- 在模型上拖动：旋转观察角度。
- 滚轮或双指缩放：拉近或拉远模型。
- 使用舞台右下角相机胶囊里的“左转 / 右转 / 拉近 / 拉远 / 聚焦”按钮：无需拖拽也能控制视角，按钮可用键盘操作。
- 点击模型部件，或在桌面 Inspector / 移动端 bottom sheet 的零件清单中选择：打开对应知识卡。
- 点击六步时间轴：直接切换拆解阶段。
- “拆解 / 透视 / 原理”：切换结构表达方式。
- 枪械展品进入“原理”后，可播放一次六阶段机械循环，或使用上一/下一循环阶段逐步观察。
- “复原模型”：回到第 1 步、拆解模式与默认相机。

拖动模型不会触发零件选择；所有 3D 选择操作也都有可点按的按钮替代。

### 键盘

- `←` / `→`：切换上一个或下一个阶段。
- `R`：复原模型。
- `Escape`：返回藏品大厅。
- `Tab` / `Shift + Tab`：在按钮、时间轴、零件与知识卡控件之间移动焦点。
- `Enter` / `Space`：操作当前聚焦的按钮。

### 路由与静态降级模式

七件展品的 canonical Hash 路由为：

```text
http://127.0.0.1:5173/#/explore/m4
http://127.0.0.1:5173/#/explore/x57
http://127.0.0.1:5173/#/explore/asr10
http://127.0.0.1:5173/#/explore/m1903
http://127.0.0.1:5173/#/explore/m1911a1
http://127.0.0.1:5173/#/explore/m1-garand
http://127.0.0.1:5173/#/explore/mp5
```

在任一路由末尾追加 `?no-webgl=1`，可强制进入静态降级模式。该模式保留六步时间轴、11 个零件入口、知识卡、原理模式和来源链接，只把 3D 舞台替换为项目自建的 SVG 结构示意；枪械静态示意还会同步当前循环阶段。

## 项目结构

```text
src/
├── app/          # Hash 路由、懒加载与应用入口
├── components/   # 时间轴、知识卡、静态示意、错误边界与朗读控件
├── content/      # 藏品、步骤、零件与可追溯来源数据
├── experience/   # 纯 reducer 状态机与本地进度保护
├── pages/        # 藏品大厅和结构探索室组合
├── scene/        # React Three Fiber 场景、程序化模型与运动规则
├── styles/       # 夜航博物馆设计系统和响应式布局
└── test/         # Vitest / Testing Library 环境
```

核心数据流是：

```text
选择藏品 → 创建探索状态 → 渲染结构部件 → 切换阶段/零件/模式
         → reducer 产生新状态 → 3D、知识卡与无障碍播报同步
```

Three.js 场景只在进入探索室后动态加载，因此藏品大厅不会下载 3D 运行时。四个枪械路由共用一个配置化 `FirearmScene` 和同一个懒加载块，由纯函数循环采样器驱动不同机构的运动；内容层不依赖 React 或 Three.js，结构步骤和知识卡可以单独做完整性测试。

`npm run build` 在 Vite 输出后自动执行 `scripts/check-build-budget.mjs`。门禁要求所有 WOFF2 总计不超过 5.25 MiB、构建中只能出现一个 CJK 字体家族，并限制每个懒加载展品闭包相对已登记基线增长不超过 15%；浏览器契约另要求 Gallery 和 Explorer 各自实际请求的字体资源不超过 1.25 MiB。Vite 的通用 500 kB 提示仍作为拆分线索保留，不等同于失败或性能承诺。

## 模型与内容安全

七件模型完全由本项目程序化构建，没有打包来源不明的扫描模型、贴图、馆藏图片、厂商图片或机构徽标。大型机械使用原创、无单位的封闭截面放样、旋转轮廓、挤出、窄倒角、通用齿圈与抽象扭转叶片；这些参数只服务屏幕轮廓与儿童阅读，不对应真实尺寸、翼型、船体线型、螺距、装配位置、公差或制造数据。三件几何升级保持既有 part id、focus point、explode offset、六阶段和 11 零件接口不变。

程序化几何工厂限制截面数量、轮廓点数、径向分段与三角形预算，并在测试中检查封闭性、法线、资源释放和浏览器实际 draw-call/triangle/instance 预算。坦克只补充概括的外轮廓与行走装置层次，不表现装甲厚度、膛内结构、弹药或火控；飞机不提供真实翼型、弦长、安装角或桨距；船舶不提供真实船体线型、稳性、推进器尺寸或桨距。

X-57 展品表现 NASA 规划并进行地面、部件、风洞与仿真研究的 Mod IV 构型。项目在首次飞行前结束，因此页面不会把设计目标或部件结果写成整机实飞结论。

历史 ASR-10 是系泊海上的应急避难设施，不是机动救援艇。船舶展品以这段救生历史为叙事引子，发动机、传动、螺旋桨、舵、泵路和驾驶空间均明确属于现代救援船的通用教学示意，而非 ASR-10 原物复刻。

四件枪械展品只用青白色惰性替代物、抽象能量和慢动作状态表现高层机械因果；输入与击发合并为不可拆分的教学模块，每次只展示一个循环。拆解视图是教学分层，不对应真实拆装顺序。

内容允许解释：

- 承载结构与空间分区。
- 发动机到驱动轮的抽象能量路径。
- 悬挂、负重轮和履带的协作关系。
- 观察方向与机械缓冲概念。
- 四种枪械机构在六个抽象状态中的高层联动差异。

内容不包含：

- 真实尺寸、公差、材料配方、加工参数、压力或速度数据。
- 弹药内部、点火链路、可制造接触几何或火控数据。
- 制造、拆装顺序、故障排查、改装、操作射击、瞄准或战术指导。
- 真实枪声、枪口焰、连发、射速比较、目标、命中或伤害表现。

## 史料与资源路线

当前程序化模型及 SVG 图形均为项目自建。公开资料用于史实校对和未来资产研究：

- [Wikimedia Commons · M4A4 cutaway](https://commons.wikimedia.org/wiki/File:M4A4_cutaway.png)：美国政府公有领域历史剖面参考。
- [The Tank Museum · Sherman M4A1 (76) W](https://tankmuseum.org/article/latest-from-the-museums-youtube-channel-november/)：用于核对部分 M4A1 型采用大陆公司星形发动机这一史实；未复用博物馆媒体。
- [Smithsonian Open Access](https://www.si.edu/openaccess/faq)：开放馆藏与未来 3D 资产参考。
- [NASA 3D Resources](https://science.nasa.gov/3d-resources/)：飞机资料路线；未来使用仍需遵守 NASA 媒体与标识规则。
- [NASA · X-57 Maxwell](https://www.nasa.gov/x-57-maxwell/) 与 [X-57 技术论文](https://www.nasa.gov/directorates/armd/x-57-technical-papers/)：项目状态、分布式电推进、电力架构与研究边界。
- [Scottish Maritime Museum · ASR-10](https://www.scottishmaritimemuseum.org/vessels/)：核对其系泊式海上避难用途；未复用馆藏媒体。
- [NOAA · Boat Building Challenge](https://oceanservice.noaa.gov/education/dyw-boat-building.html)、[IMO · Damage Stability](https://www.imo.org/en/ourwork/safety/pages/damagestability.aspx) 与 [RNLI 救援艇资料](https://rnli.org/what-we-do/lifeboats-and-stations/our-lifeboat-fleet)：核对浮力、分舱、推进与救援空间的通用原理。
- [NPS · The 1903 Springfield Rifle](https://www.nps.gov/spar/learn/historyculture/the-1903-springfield-rifle.htm) 与 [NPS · Model 1903 Production](https://www.nps.gov/spar/learn/historyculture/u-s-springfield-model-1903-production.htm)：核对 M1903 的历史构型与高层机构关系。
- [Smithsonian · M1911A1 馆藏记录](https://americanhistory.si.edu/collections/object/nmah_415704)、[美国陆军 · John M. Browning](https://www.army.mil/article/15705/arming_the_army_john_m_browning) 与 [美国陆军 · Firearm Systems](https://asc.army.mil/web/news-perseverance-pays-off/)：核对 M1911A1 历史边界与短后坐原理。
- [NPS · Springfield Armory and World War II](https://www.nps.gov/articles/springfieldarmoryww2.htm)、[NPS · M1 Variations](https://www.nps.gov/spar/learn/historyculture/m1-variations.htm) 与 [Smithsonian · M1 Garand 馆藏记录](https://www.americanhistory.si.edu/collections/object/nmah_418516)：核对 M1 Garand 的历史构型、供弹概念与高层导气关系。
- [Heckler & Koch · MP5](https://www.heckler-koch.com/en/Products/Military%20and%20Law%20Enforcement/Submachine%20guns/MP5) 与 [HK USA · Roller-delayed System History](https://hk-usa.com/2019/12/03/heckler-koch-launches-the-new-sp5/)：核对标准型 MP5 与滚柱延迟的高层概念。

上述页面只用于史实与高层机械关系校对，应用没有复用其馆藏图像、厂商图片或三维资产。未来引入任何外部资产时，必须逐项保存来源 URL、作者、许可证、获取日期、修改记录和归属文字。优先使用 CC0；CC BY 必须显示归属；不会因为合集页面标注开放就跳过单个资产的许可证复核。

### 打包字体

UI 正文自托管 `@fontsource-variable/noto-sans-sc 5.2.10` 提供的 Noto Sans SC Variable，仅引入可变字重的常规样式 CSS。npm 包 metadata 的 author 字段为 Google Inc.；官方包页面为 [Fontsource · Noto Sans SC](https://fontsource.org/fonts/noto-sans-sc)，repository 字段为 `git+https://github.com/fontsource/font-files.git`，directory 字段为 `fonts/variable/noto-sans-sc`。许可证为 SIL Open Font License 1.1（`OFL-1.1`），获取日期为 2026-07-15，本项目未修改字体文件。完整许可文本保存在 [`public/licenses/noto-sans-sc-OFL-1.1.txt`](public/licenses/noto-sans-sc-OFL-1.1.txt)，第三方登记见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

本轮视觉环境、展台、水面、尘埃、材质和三件大型机械几何没有新增外部图片、HDRI 或三维资产，因此没有额外媒体归属要求；史料链接只用于核对高层事实与系统关系。

## 测试策略

- 内容完整性：每个零件都必须对应有效阶段、知识卡和来源。
- 状态机：覆盖前进、后退、跳转、复原、模式、减少动态与无效输入。
- 组件：覆盖七个 canonical 路由、知识卡、朗读、错误重试、静态降级和七展项进度隔离。
- 3D 纯逻辑：覆盖拆解位置、透明度、原理运动、枪械六阶段采样和点击/拖拽判定。
- 真实浏览器：覆盖桌面、平板、移动端、WebGL、静态降级、减少动态手动步进、单次循环、键盘、进度恢复、朗读和控制台错误。
- 视觉品质：覆盖 70% 舞台占比、单一导览声音、Inspector/mobile sheet、44 px 目标、字体请求预算、受限质量档、静止帧、材质状态像素变化与三件大型机械固定相机 Canvas 轮廓基线。确定性的纯几何测试是主守卫；平台无关文件名的 canonical Chromium Canvas 快照作为低容差集成守卫。

发布前验证命令为：

```bash
npm test -- --run
npm run build
npm run test:e2e
git diff --check
```

Playwright 的 HTML 报告、trace 和失败截图写入已忽略的 `output/playwright/`。四件枪械的 12 张视觉验收截图写入 `output/playwright/screenshots/`：

```text
m1903-desktop-principle-1440x900.png      m1911a1-desktop-principle-1440x900.png
m1-garand-desktop-principle-1440x900.png  mp5-desktop-principle-1440x900.png
m1903-tablet-static-1024x768.png          m1911a1-tablet-static-1024x768.png
m1-garand-tablet-static-1024x768.png      mp5-tablet-static-1024x768.png
m1903-mobile-static-390x844.png           m1911a1-mobile-static-390x844.png
m1-garand-mobile-static-390x844.png       mp5-mobile-static-390x844.png
```

详细产品边界与验收标准见 [首版设计规格](docs/superpowers/specs/2026-07-11-mechanical-atlas-design.md)、[飞机/舰艇扩展规格](docs/superpowers/specs/2026-07-13-air-sea-exhibits-design.md) 与 [枪械机械循环实验室规格](docs/superpowers/specs/2026-07-13-firearm-cycle-lab-design.md)；实现与验证流程见 [飞机/舰艇实施计划](docs/superpowers/plans/2026-07-13-air-sea-exhibits-implementation.md) 与 [枪械循环实施计划](docs/superpowers/plans/2026-07-13-firearm-cycle-lab-implementation.md)。
