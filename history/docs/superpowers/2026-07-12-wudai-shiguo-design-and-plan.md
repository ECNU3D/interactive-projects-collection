# 《烽烟十国》——五代十国乱世画卷互动游戏 设计文档与实现计划

> **改编说明**：本文档由 `specs/2026-07-12-china-modern-history-game-design.md`（《山河岁月》设计文档）与 `plans/2026-07-12-shanhe-suiyue-game.md`（《山河岁月》实现计划）改编而来，仅将历史主题由"中国近代史（1839–1978）"替换为"五代十国（875–979）"，玩法机制、数据结构、章节/校验框架等原样保留。**按用户要求，本文档只完成内容改编，不进行实际编码实现**，合并放在这一份单独文件中，分为「第一部分：设计文档」「第二部分：实现计划」。

- 日期：2026-07-12
- 状态：内容改编稿（未实现，供后续需要时再行开发）
- 主题跨度：**875（黄巢起义）→ 907（朱温篡唐、五代开端）→ 960（陈桥兵变、北宋建立）→ 979（北汉平定、天下一统）**
- 主题引言：安重荣曾言"天子,兵强马壮者当为之,宁有种耶！"——这句话是整个五代十国的政治底色。本作即以此为骨，讲述从藩镇割据、五朝更迭到重归一统的七十余年乱世棋局。

---

# 第一部分：设计文档

## 1. 项目概述

一个中国古代史科普 + 游戏类型的网页 App，时间跨度 **875（黄巢起义前夜）→ 907（朱温篡唐、后梁建立）→ 960（陈桥兵变、北宋建立）→ 979（北汉平定、天下一统）**。玩家沿一条横向展开的历史画卷逐节点推进历史进程，在关键节点做出抉择、获得得分，同时学习五代十国的史实与人物知识。

核心原则（与原作一致）：

1. **历史不可改变**：玩家选错不改变剧情走向；立即展示正确答案与"为什么历史选择了这条路"的解析，剧情严格按史实推进。部分抉择点属于"历史教训型"——即"正确"选项与历史上实际发生的选择并不一致（如石敬瑭割地称儿皇帝、杜重威降辽），用于凸显该抉择造成的历史悲剧，但剧情仍按史实（石敬瑭接受、杜重威投降）推进。
2. **史实第一**：所有时间、政权、人物、因果先落盘为本地数据文件并逐条核对，数据可后续增改；先有数据，后有 App。
3. **美感与底蕴**：宣纸水墨视觉、画卷式交互、沉浸式全景抉择；终章基调借《三国演义》开篇"话说天下大势，分久必合，合久必分"收束全篇——不做单一政权的颂扬式终章，而是呈现"统一来之不易"的厚重历史感，并点出燕云十六州未能收复、遗祸北宋百年的历史尾声。

## 2. 已确认的关键决策

| 决策 | 结论 |
|------|------|
| 内容规模 | 详尽版：12 章、71 历史节点、32 关键抉择点 |
| 图片策略 | 混合：抉择点全景图用 gpt-image-bridge 生成（32 张）；人物画像/事件场景优先公有领域古代绘画、石刻拓片、后世画像，下载到本地并记录来源；缺失的用 AI 生成补足 |
| 运行方式 | 纯静态网页：数据打包为 `.js` 文件，双击 `index.html` 即玩（file:// 协议下可运行），无构建、无外部网络依赖 |
| 整体结构 | 沿用原方案A：画卷主轴 + 沉浸抉择 + 人物星图，吸收关卡式的节点解锁与进度要素 |

## 3. 章节结构（12 章）

1. 唐末藩镇与朱温篡唐（875–907）
2. 后梁与晋的对峙（907–923）
3. 后唐盛衰：伶人误国（923–936）
4. 儿皇帝与燕云十六州（936–947）
5. 后汉短祚与郭威代周（947–951）
6. 十国并立（上）：淮南、两浙、闽、楚（902–943）
7. 十国并立（下）：巴蜀、荆湖、两广（907–943）
8. 后周世宗与统一之基（951–959）
9. 陈桥兵变与北宋建立（960–961）
10. 先南后北：统一江南（963–971）
11. 江南终局：南唐后主与吴越纳土（971–978）
12. 天下一统：北汉平定与终章（976–979）

每章含 5–7 个历史节点；其中 1–4 个是关键抉择点。全程合计 71 节点、32 抉择点。

## 4. 文件结构

```
history-wudai/
├── index.html              # 入口，双击即玩
├── validate.html           # 数据自检页，打开自动运行全部校验
├── css/
│   └── main.css            # 宣纸纹理、水墨风、政权色调主题
├── js/
│   ├── app.js              # 启动与路由（画卷 / 沉浸抉择 / 人物星图 / 终章）
│   ├── scroll.js           # 画卷渲染与节点推进
│   ├── choice.js           # 沉浸式抉择模式
│   ├── score.js            # 计分、评级、称号、localStorage 存档
│   ├── graph.js            # 人物知识图谱（d3 力导向）
│   ├── audio.js            # Web Audio 合成音效
│   └── ending.js            # 终章卷轴
├── vendor/
│   └── d3.v7.min.js        # 本地化，仅用于人物图谱
├── data/                   # 全部为 `window.WDFY_DATA` 风格的 .js 文件
│   ├── chapters.js         # 12 章元信息（题名、起止年份、政权色调、章引言）
│   ├── events.js           # 71 节点
│   ├── choices.js          # 32 抉择点
│   └── persons.js          # 60 人物 + 关系边
└── assets/
    └── images/
        ├── panorama/       # AI 生成全景图（抉择点沉浸背景，c01–c32）
        ├── persons/        # 公有领域人物画像/拓片
        ├── events/         # 公有领域事件场景画作
        └── CREDITS.md      # 每张图片的来源与许可记录
```

## 5. 数据模型

（字段名与原作完全一致，仅命名空间由 `SHY_DATA` 改为 `WDFY_DATA`）

### chapters.js
`{ id, title, subtitle, startYear, endYear, theme(政权色调), intro(章引言 100–200字) }`

### events.js（历史节点）
`{ id, chapterId, date, title, place, summary(150–300字正文), significance(历史意义 80–150字), extra(史海钩沉小知识 50–120字), image(可选), personIds[], choiceId(可选) }`

### choices.js（关键抉择点）
`{ id, eventId, scene, panorama, question, options: [{ text, correct, feedback }], historyNote }`

抉择点设计原则与原作一致：站在历史当事人视角提问；"正确"选项 = 史学公认的正确方向，多数情况下与历史实际走向一致（如"是否亲率禁军督战"），但**部分是"历史教训型"**——"正确"选项与实际发生的选择相反（如"是否接受割地称儿皇帝"），用于点明这一抉择的历史代价；两种类型都必须在 `historyNote` 中清楚说明真实历史走向。

### persons.js（人物知识图谱）
`{ id, name, courtesy(可选), birth, death, role, bio(150–300字小传), image, chapterIds[] }`
关系边：`{ source, target, relation(师承/同盟/对立/影响/亲属), note }`

## 6. 玩法与计分

与原作一致：
- **推进**：节点按顺序解锁；抉择点必须作答后才能继续。
- **计分**：首答即对 +100；答错后阅读解析 +20（明理分）；阅读"史海钩沉" +10（探索分）；连击加成 ×1.1/×1.2/×1.3（封顶）。
- **章节评级**：甲（≥85%）/ 乙（≥60%）/ 丙（<60%）。
- **称号**（改编为契合五代十国主题的称谓）：按总分解锁——**"初识五代"（<1500）→ "乱世观澜"（<3000）→ "良史之笔"（<4500）→ "定鼎之臣"（≥4500）**。
- **存档**：localStorage，键改为 `wdfy_save_v1` / `wdfy_settings_v1`。

## 7. 界面与美术

- **画卷主界面**：横向滚动长卷；宣纸底纹 + 水墨晕染；章节题名竖排 + 藩镇印章风格印记；时间轴节点珠串三态（未解锁灰暗、当前鎏金、已完成朱红）。
- **政权色调**：随章节渐变——唐末藩镇的昏暗铁灰 → 梁晋鏖战的暗红 → 伶人祸乱的浑浊金 → 儿皇帝屈辱的灰紫 → 郭威黄旗初醒的土黄 → 十国并立的斑斓杂色（吴越青碧、南唐绛红、蜀地翠绿分述）→ 世宗改革的冷青转暖 → 陈桥黄袍的鎏金 → 统一江南的沉稳赭红 → 终章天下一统的黎明青金。示例：ch01 `#4a4a4a/#e8e3d8/#7a2e2e`（铁灰配暗红印），ch09 陈桥兵变章 `#c9a227/#fdf6e3/#8b0000`（鎏金配朱红），ch12 终章 `#2c3e50/#f0ead6/#c9a227`（黎明青转金）。
- **节点卡片**：图文结合（事件画作 + 正文 + 意义 + 史海钩沉 + 关联人物头像，点头像跳人物星图）。
- **沉浸抉择模式**：全屏全景图 + 情境旁白渐入 + 选项卡片；答对：金光印章"史笔如铁"；答错：墨色晕开 + 解析卷轴。
- **人物星图**：d3 力导向图；关系边按类型着色（师承金/同盟青/对立赭/亲属紫/影响灰蓝）。
- **终章卷轴**：979 年天下一统高潮节点后，以"分久必合"为主题收束——回顾玩家全程抉择与得分，青金色调渐亮的黎明主题，末段点出"燕云十六州终宋一代未能收复"的历史遗留，留一分厚重与反思，不做单一政权的颂扬式煽情。

## 8. 音效（Web Audio 合成，无外部音频文件）

与原作一致：环境古琴泛音底噪（可选）；交互翻页声、节点解锁清音、答对编钟声、答错沉闷鼓音、终章庄重和声；全局静音开关。

## 9. 图片素材流程

1. **全景图（32 张）**：gpt-image-bridge 生成；统一提示词风格（史诗历史场景、写实历史画风融合水墨意蕴、无文字、宽幅 16:9）；存 `assets/images/panorama/`。
2. **历史画像**：优先从 Wikimedia Commons 等公有领域来源下载古代人物画像、石刻拓片（五代十国传世画像稀少，多为后世历代摹绘，需在 `CREDITS.md` 注明"后世摹绘/想象画像"）；缺失的用 AI 生成补足并标注"AI 生成想象图"。
3. 页面上 AI 生成图与后世摹绘图均须注明性质，科普严谨性优先。

## 10. 史实保障

- 数据先行：先完成全部 `data/*.js` 再写游戏代码。
- 编写时逐条核对公认史实（以《旧五代史》《新五代史》《资治通鉴》及通行中国古代史教材口径为准）。
- 完成后运行一次独立的**史实复核**（fact-check pass）。
- 争议性/传说性表述从谨慎标注："相传""据载存疑"等字样标出（如"斧声烛影""牵机药赐死""十四万人齐解甲"诗句归属等历史悬案或存疑记载），不作定论式陈述。

## 11. 校验与测试

- `validate.html`：打开自动校验——
  - 事件按时间升序且都落在所属章节年份区间内；
  - 所有 `personIds` / `choiceId` / 图片路径引用存在；
  - 每个抉择点恰有一个 `correct: true` 且各选项均有 feedback；
  - 章节数（12）、总节点数（≥70）、抉择点数（≥30）、人物数（≥45）达标。
- 计分逻辑以纯函数实现，`validate.html` 内附带用例断言。
- 人工验收：file:// 双击打开全程走一遍。

## 12. 明确不做（YAGNI）

- 不做后端、账号系统、排行榜联网功能。
- 不做多语言（仅简体中文）。
- 不做历史改变的"架空分支"玩法。
- 不做移动端原生打包；但布局做基础自适应。

---

# 第二部分：实现计划

> **For agentic workers（若日后确需实现，方按此执行）：** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）or superpowers:executing-plans。步骤用 checkbox（`- [ ]`）语法跟踪。**当前按用户要求，本计划仅作内容改编存档，暂不执行。**

**Goal:** 构建一个纯静态、双击即玩的五代十国（875–979）画卷式科普互动游戏网页 App。

**Architecture:** 数据先行——全部史实内容落盘为 `data/*.js` 全局变量文件并通过 `validate.html` 自动校验；游戏层为原生 JS 多脚本（非 ES module，保证 file:// 可运行），画卷主视图 + 全屏沉浸抉择 + d3 人物星图 + 终章卷轴四个视图切换。

**Tech Stack:** 原生 HTML/CSS/JS、d3 v7（本地 vendor）、Web Audio API、localStorage、gpt-image-bridge、Wikimedia Commons API。

## Global Constraints

- **file:// 必须可运行**：一切 JS 用普通 `<script>` 全局变量，禁止 ES module / fetch 加载本地 JSON / 任何 CDN 引用。
- **数据全局命名**：每个数据文件向 `window.WDFY_DATA` 挂载（`chapters` / `events` / `choices` / `persons` / `relations`）。
- **历史不可改变**：答错只影响得分，剧情严格按史实推进；每个抉择必须有"历史真实走向"说明；"历史教训型"抉择的剧情按实际发生的（往往是负面的）选择推进。
- **史实口径**：以《旧五代史》《新五代史》《资治通鉴》及通行古代史叙述为准；存疑/传说性记载（斧声烛影、牵机药、十四万人齐解甲诗归属等）须标注"相传/存疑"，不作武断陈述。
- **图片标注**：AI 生成图必须标"AI 生成想象图"；历史画像须在 `assets/images/CREDITS.md` 记录来源、许可与是否为"后世摹绘"。
- **规模底线**：≥70 历史节点、≥30 抉择点、≥45 人物（本计划骨架：71 节点、32 抉择、60 人物）。
- **存档键**：localStorage 键统一为 `wdfy_save_v1`（进度/分数）与 `wdfy_settings_v1`（静音等）。
- 提交信息用中文，遵循 `feat:/fix:/docs:/data:` 前缀。

---

## 数据接口总览（所有任务共用）

`index.html` 中脚本加载顺序（固定）：

```html
<script src="data/chapters.js"></script>
<script src="data/events.js"></script>
<script src="data/choices.js"></script>
<script src="data/persons.js"></script>
<script src="vendor/d3.v7.min.js"></script>
<script src="js/audio.js"></script>
<script src="js/score.js"></script>
<script src="js/scroll.js"></script>
<script src="js/choice.js"></script>
<script src="js/graph.js"></script>
<script src="js/ending.js"></script>
<script src="js/app.js"></script>
```

数据结构（后续任务不得偏离字段名）：

```js
// chapters.js
window.WDFY_DATA = window.WDFY_DATA || {};
window.WDFY_DATA.chapters = [{
  id: "ch01", order: 1, title: "唐末藩镇与朱温篡唐",
  subtitle: "兵强马壮者为天子", startYear: 875, endYear: 907,
  theme: { primary: "#4a4a4a", bg: "#e8e3d8", accent: "#7a2e2e" },
  intro: "……（100–200字章引言）"
}];

// events.js
window.WDFY_DATA.events = [{
  id: "e0101", chapterId: "ch01", order: 1,
  date: "884", dateText: "884年",
  title: "上源驿之谋：梁晋结下世仇", place: "汴州上源驿",
  summary: "……150–300字", significance: "……80–150字",
  extra: "……50–120字史海钩沉",
  image: "assets/images/events/shangyuanyi.jpg",   // 可为 null
  imageCredit: "后世摹绘/想象画作 · 来源见CREDITS",   // 或 "AI 生成想象图"
  personIds: ["p_likeyong", "p_zhuwen"],
  choiceId: "c01"
}];

// choices.js
window.WDFY_DATA.choices = [{
  id: "c01", eventId: "e0103",
  kind: "roleplay",                            // roleplay 代入型 | insight 史识型
  scene: "……第二人称情境 120–250字",
  panorama: "assets/images/panorama/c01.jpg",
  question: "……",
  options: [
    { text: "……", correct: false, feedback: "……为什么错 100–200字" },
    { text: "……", correct: true,  feedback: "……为什么对 100–200字" },
    { text: "……", correct: false, feedback: "……" }
  ],
  historyNote: "历史真实走向：……"
}];

// persons.js
window.WDFY_DATA.persons = [{
  id: "p_zhuwen", name: "朱温", courtesy: "赐名全忠，庙号太祖",
  birth: 852, death: 912, role: "后梁开国皇帝，唐末藩镇枭雄",
  bio: "……150–300字", image: "assets/images/persons/zhuwen.jpg",
  imageCredit: "后世摹绘画像", chapterIds: ["ch01","ch02"]
}];
window.WDFY_DATA.relations = [
  { source: "p_guowei", target: "p_chairong", relation: "亲属", note: "郭威养子（内侄），后周世宗" }
  // relation ∈ 师承|同盟|对立|亲属|影响
];
```

---

## 历史内容骨架（71 节点 / 32 抉择，内容任务的唯一依据）

> 标记【抉择·代入】= roleplay，【抉择·史识】= insight。执行内容任务时按此表逐条撰写，不得增删节点或改动日期；若发现骨架有史实错误，先修订本表并在提交信息中说明。

**第1章 唐末藩镇与朱温篡唐（875–907）** — 5节点/2抉择
| id | 日期 | 标题 | 抉择 | 关联人物 |
|----|------|------|------|----------|
| e0101 | 875–884 | 黄巢起义与长安陷落 | — | 黄巢 |
| e0102 | 883 | 朱温降唐受赐名"全忠"，割据宣武军 | — | 朱温 |
| e0103 | 884 | 上源驿之谋：梁晋结下世仇 | 【抉择·代入】c01：你是884年赴宴的河东节度使李克用，主人朱温于上源驿纵火围杀，你侥幸缒城逃脱，此后如何处置这段血仇？正确=公开揭露、诉诸朝廷并誓言复仇——历史上李克用终生未与朱温和解，梁晋对峙三十余年直至其子李存勖灭梁 | 李克用、朱温 |
| e0104 | 905 | 白马之祸：诛杀清流朝臣 | 【抉择·史识】c02：如何评价朱温"白马之祸"投朝臣于黄河？正确=标志士族清流政治的彻底终结，五代政治由此奠定血腥底色 | 朱温、李振 |
| e0105 | 907-04 | 朱温废唐建梁，唐朝灭亡 | — | 朱温、唐哀帝 |

**第2章 后梁与晋的对峙（907–923）** — 7节点/3抉择
| e0201 | 907 | 后梁建立，定都汴州 | — | 朱温 |
| e0202 | 908-01 | 李克用死，三矢遗命 | — | 李克用、李存勖 |
| e0203 | 910-12 | 柏乡之战：晋梁攻守易势 | — | 周德威、李存勖 |
| e0204 | 913 | 李存勖灭刘仁恭刘守光，统一河北 | 【抉择·代入】c03：你是913年的李存勖，父王临终三矢遗命，此刻刘守光僭号称帝挑衅在先，先北取幽州还是先东攻汴州？正确=先取幽州统一河北，稳固后方后再图后梁 | 李存勖、刘守光、刘仁恭 |
| e0205 | 915–922 | 梁末猜忌宿将，屡战屡败 | 【抉择·史识】c04：后梁末年为何屡战屡败、江河日下？正确=末帝朱友贞猜忌宿将、任用外戚宵小，自毁长城 | 朱友贞 |
| e0206 | 923-04 | 王彦章临危受命，兵败殉节 | 【抉择·代入】c05：你是923年的后梁老将王彦章，国势已危、兵力悬殊、援兵不至，是死战还是保全己身？正确=死战不降——历史上王彦章兵败被俘，答以"豹死留皮，人死留名"，慷慨就义 | 王彦章、朱友贞 |
| e0207 | 923-10 | 李存勖奇袭汴州，后梁灭亡 | — | 李存勖、朱友贞 |

**第3章 后唐盛衰：伶人误国（923–936）** — 7节点/3抉择
| e0301 | 923-04 | 李存勖称帝，定都洛阳 | — | 李存勖 |
| e0302 | 925 | 后唐灭前蜀 | — | 郭崇韬、王衍 |
| e0303 | 925-12 | 郭崇韬蒙冤被杀 | 【抉择·史识】c06：灭蜀首功之臣郭崇韬为何反遭冤杀？正确=宦官与伶人构陷、庄宗猜忌功高震主之臣——功臣屡遭猜忌是五代政治的通病 | 郭崇韬、李继岌 |
| e0304 | 926-04 | 兴教门之变，庄宗死于伶人之乱 | 【抉择·史识】c07：李存勖灭梁称帝后何以骤然败亡？正确=宠幸伶人伎乐、猜忌诛杀功臣，"忧劳可以兴国，逸豫可以亡身"（欧阳修《伶官传序》评语） | 李存勖、郭从谦 |
| e0305 | 926–933 | 明宗李嗣源息兵安民 | — | 李嗣源 |
| e0306 | 934 | 闵帝末帝更迭 | — | 李从厚、李从珂 |
| e0307 | 936 | 石敬瑭称"儿皇帝"，割燕云十六州 | 【抉择·代入】c08：你是936年被后唐末帝步步紧逼的河东节度使石敬瑭，契丹愿出兵助你，但要求称臣称儿、割让燕云十六州、岁贡布帛，你是否接受？正确=拒绝（历史教训型：历史上石敬瑭选择接受，建后晋、割燕云，史称"儿皇帝"，遗祸中原四百余年） | 石敬瑭、耶律德光、李从珂 |

**第4章 儿皇帝与燕云十六州（936–947）** — 6节点/3抉择
| e0401 | 936 | 后晋建立，燕云十六州割让契丹 | — | 石敬瑭 |
| e0402 | 936–942 | 苟安岁贡，藩镇仍叛服不常 | — | 石敬瑭 |
| e0403 | 942 | 石重贵继位，"称孙不称臣" | 【抉择·史识】c09：石重贵"称孙不称臣"触怒契丹是否值得肯定？正确=值得肯定——虽引发辽晋战争，但体现摆脱屈辱藩属地位的气节，只是国力军备未能匹配决心，当辩证看待"气节"与"实力"的关系 | 石重贵、景延广 |
| e0404 | 944 | 阳城之战，晋军险胜 | — | 杜重威 |
| e0405 | 946 | 杜重威降辽，后晋门户洞开 | 【抉择·代入】c10：你是946年后晋主力统帅杜重威，大军与契丹对峙、粮尽援绝，坚守死战还是举军出降？正确=坚守死战（历史教训型：杜重威历史上率数万大军不战而降，直接葬送后晋） | 杜重威 |
| e0406 | 947 | 契丹灭晋，"打草谷"激起反抗后北撤 | 【抉择·史识】c11：契丹灭后晋、入主中原后为何又仓皇北撤？正确="打草谷"式劫掠激起中原军民普遍反抗，耶律德光叹"我不知中国之人难制如此" | 耶律德光 |

**第5章 后汉短祚与郭威代周（947–951）** — 5节点/2抉择
| e0501 | 947 | 刘知远太原称帝，建后汉 | — | 刘知远 |
| e0502 | 948 | 隐帝继位，猜忌顾命大臣 | 【抉择·史识】c12：后汉为何是五代最短命的王朝（仅四年）？正确=隐帝年少猜忌，矫诏诛杀顾命大臣、又谋害在外统兵的郭威全家，自毁根基 | 刘承祐、杨邠、史弘肇 |
| e0503 | 950 | 郭威全家罹难，澶州举兵 | — | 郭威 |
| e0504 | 950-11 | 澶州兵变，黄旗加身 | 【抉择·代入】c13：你是950年的郭威，隐帝密诏欲杀你全家、你已家破人亡，麾下将士愤而裂黄旗披于你身、拥你为帅清君侧，是否顺势举兵入京？正确=举兵（历史选择：郭威由此还京称帝，建后周；十年后这一幕将在陈桥驿重演） | 郭威 |
| e0505 | 951 | 郭威称帝建周，北汉并立 | — | 郭威、刘崇 |

**第6章 十国并立（上）：淮南、两浙、闽、楚（902–943）** — 6节点/3抉择
| e0601 | 902 | 杨行密建吴，奠定江南基业 | — | 杨行密 |
| e0602 | 907 | 钱镠受封吴越王，保境安民 | 【抉择·代入】c14：你是907年新受封吴越王的钱镠，中原战乱不休，麾下有人劝你争雄天下、逐鹿中原，你如何抉择？正确=保境安民，不与中原争锋，专注兴修水利（捍海石塘）与发展经济——偏安并非全然懦弱，亦可能是保全一方百姓的务实智慧 | 钱镠 |
| e0603 | 909 | 王审知建闽国 | — | 王审知 |
| e0604 | 917 | 刘岩称帝广州，建南汉 | — | 刘岩（刘龑） |
| e0605 | 927 | 马殷建楚，以茶易马 | 【抉择·史识】c15：马楚"以茶易马"的经济政策体现了怎样的智慧？正确=利用湖南茶叶优势换取战马财货，是乱世中区域政权因地制宜、以商养国的典型 | 马殷 |
| e0606 | 937 | 徐知诰代吴建南唐 | 【抉择·史识】c16：徐知诰（李昪）代吴称帝后为何改回"唐"国号并自称唐室后裔？正确=借"唐"之正统名分收揽江淮人心——反映五代十国政权普遍存在的"正统性"焦虑 | 徐知诰（李昪） |

**第7章 十国并立（下）：巴蜀、荆湖、两广（907–943）** — 6节点/3抉择
| e0701 | 907 | 王建建前蜀，据险割据 | — | 王建 |
| e0702 | 918–925 | 王衍荒政，前蜀速亡 | 【抉择·史识】c17：前蜀立国仅18年（907–925）即亡，根源何在？正确=后主王衍奢靡荒政（"水晶宫"游宴无度），后唐乘隙灭蜀，王衍出降后仍被杀于途中 | 王建、王衍 |
| e0703 | 924 | 高季兴建荆南，"高赖子"生存术 | 【抉择·代入】c18：你是十国中最弱小的荆南国主高季兴，四邻皆为强国，你如何在夹缝中自处？正确=对四方大国均称臣纳贡、脚踏多只船，甚至截留过路使节的赏赐财货以自肥——弱国生存的实用主义智慧 | 高季兴 |
| e0704 | 934 | 孟知祥称帝建后蜀 | — | 孟知祥 |
| e0705 | 951–953 | 马楚内乱，楚地分裂 | — | 马希萼、马希声 |
| e0706 | 943 | 冯道历仕四朝十君 | 【抉择·史识】c19：如何评价历仕后唐、后晋、契丹、后汉、后周五朝十位君主的宰相冯道？正确=评价需一分为二——他自诩以孝悌忠信为本、屡屡救民于兵燹，但欧阳修等后世史家斥其"无廉耻"，这一争议本身正是乱世士人处境的缩影 | 冯道 |

**第8章 后周世宗与统一之基（951–959）** — 7节点/3抉择
| e0801 | 951–954 | 郭威轻徭薄赋，五代少见善政 | — | 郭威 |
| e0802 | 954 | 柴荣继位，是为周世宗 | — | 柴荣 |
| e0803 | 954-03 | 高平之战，世宗亲冒矢石 | 【抉择·代入】c20：你是954年高平之战中的周世宗柴荣，右翼大将樊爱能、何徽临阵先遁，全军动摇，是否亲率禁军冒着箭矢殿前督战？正确=亲自督战（历史上柴荣冒矢冲锋、反败为胜，战后严惩逃将、整顿禁军、选拔赵匡胤等悍将） | 柴荣、樊爱能、赵匡胤 |
| e0804 | 955 | 显德毁佛，整顿吏治 | 【抉择·史识】c21：周世宗"显德毁佛"引发争议，如何评价这一政策？正确=虽损佛教香火，却充实国库军资、抑制寺院经济过度膨胀，是五代少见的务实改革 | 柴荣 |
| e0805 | 955–958 | 西取四州，南平江北十四州 | — | 柴荣 |
| e0806 | 959 | 北伐辽国，收复三关三州 | — | 柴荣 |
| e0807 | 959-06 | 世宗暴病早逝，主少国疑 | 【抉择·代入】c22：你是959年北伐途中忽然病重的周世宗，眼看幽云十六州近在咫尺却身体不支，是否强撑病体继续亲征？正确历史=被迫班师（历史教训型：柴荣同年病逝，年仅39岁，未能完成收复夙愿——"出师未捷身先死"，此后燕云问题遗留北宋始终未能解决） | 柴荣 |

**第9章 陈桥兵变与北宋建立（960–961）** — 6节点/4抉择
| e0901 | 960-01 | 边报传警，赵匡胤奉命出征 | — | 赵匡胤 |
| e0902 | 960-01 | 陈桥兵变，黄袍加身 | 【抉择·代入】c23：你是960年陈桥驿的赵匡胤，将士们已经将黄袍披在你身上、山呼万岁拥你为帝，是否接受拥立？正确=接受（历史选择：赵匡胤由此兵不血刃改朝换代；但请留意——这一幕与十年前郭威澶州"黄旗加身"何其相似） | 赵匡胤 |
| e0903 | 960 | 逼周恭帝禅位，北宋建立 | 【抉择·史识】c24："陈桥兵变"与十年前"郭威澶州兵变"高度相似，这说明了什么？正确="兵强马壮者为天子"（安重荣语）的政治逻辑延续到宋初，赵匡胤深知必须终结这一逻辑才能长治久安，这正是"杯酒释兵权"的历史动因 | 赵匡胤、郭威 |
| e0904 | 960 | 李筠、李重进相继叛乱被平 | — | 李筠、李重进 |
| e0905 | 961-07 | 杯酒释兵权 | 【抉择·代入】c25：你是961年的赵匡胤，如何处置手握重兵、拥立你登基的禁军宿将石守信等人——效仿前代大杀功臣，还是设宴温言劝退？正确=设宴劝退（以厚禄换兵权，不诛杀不猜忌，开创和平解除武将专权的先例） | 赵匡胤、石守信 |
| e0906 | 961 | 赵普献"先南后北"统一方略 | 【抉择·史识】c26：赵普"先南后北、先易后难"的统一方略体现了怎样的战略思维？正确=避免同时树敌北方强辽与南方诸国，先取国力弱、抵抗弱的南方割据政权积累实力财富，再图强敌契丹 | 赵普、赵匡胤 |

**第10章 先南后北：统一江南（963–971）** — 5节点/2抉择
| e1001 | 963 | 假道灭虢，宋灭荆南、武平 | — | 高继冲、周保权 |
| e1002 | 964–965 | 宋灭后蜀，孟昶出降 | 【抉择·史识】c27：宋灭后蜀为何如此迅速（仅66天）？正确=后主孟昶多年奢靡怠政、军备废弛，大将王昭远指挥无能，"十四万人齐解甲，更无一个是男儿"（相传花蕊夫人诗）道尽亡国之痛 | 孟昶、王昭远、花蕊夫人 |
| e1003 | 965 | 孟昶暴卒开封，史家存疑 | — | 孟昶 |
| e1004 | 970–971 | 宋灭南汉，刘鋹出降 | 【抉择·史识】c28：南汉末主刘鋹信用宦官（甚至令士人先阉割方可任高官）、猜忌宗室武将，导致了什么后果？正确=朝政腐败、军无战力，宋军一至即土崩瓦解，是十国灭亡最具警示性的反面案例 | 刘鋹 |
| e1005 | 971 | 南汉亡，两广纳入宋土 | — | — |

**第11章 江南终局：南唐后主与吴越纳土（971–978）** — 6节点/3抉择
| e1101 | 971–974 | 南唐去帝号，李煜屈辱求和 | — | 李煜 |
| e1102 | 974 | 李煜托病不朝，宋军南征 | 【抉择·代入】c29：你是974年的江南国主李煜，宋朝屡次要求你亲自入朝，明知此去凶多吉少，去还是不去？正确=无论去留都难挽国运——南唐国力已远非宋朝对手，根本出路在于此前应厉行改革自强而非偏安享乐，这一两难本身即是历史的教训 | 李煜 |
| e1103 | 975-11 | 金陵城破，南唐灭亡 | — | 李煜 |
| e1104 | 976 | 李煜被俘至汴京，封"违命侯" | — | 李煜 |
| e1105 | 978 | 吴越钱俶审时度势，纳土归宋 | 【抉择·代入】c30：你是978年的吴越国主钱俶，宋朝已灭南唐等诸国、天下大势已定，是负隅顽抗还是纳土归降？正确=纳土归宋（遵循先祖"善事中国"祖训，以和平方式结束吴越国祚，两浙百姓免遭战火，钱俶本人亦得善终封王——与南唐形成鲜明对比的历史智慧） | 钱俶 |
| e1106 | 978-08 | 《虞美人》与李煜之死 | 【抉择·史识】c31：如何评价李煜"作个才人真绝代，可怜薄命作君王"的历史悲剧？正确=治国才能与文学才华不可等同，李煜的词作成就千古绝唱，但作为君主未能挽救国运，恰恰揭示了五代十国乱世对统治者能力的严酷要求 | 李煜 |

**第12章 天下一统：北汉平定与终章（976–979）** — 5节点/1抉择
| e1201 | 976-10 | 斧声烛影，宋太宗继位 | — | 赵匡胤、赵光义 |
| e1202 | 979-05 | 白马岭之战，辽援军受挫 | — | 杨业 |
| e1203 | 979-05 | 北汉出降，太原城破 | 【抉择·史识】c32：五代十国短短七十余年间中原五易其朝、十余位君主更迭，乱世为何最终走向统一而非持续分裂？正确=统一是经济文化交流、民心思定的历史大势所趋，加之郭威、柴荣、赵匡胤等历代统治者的改革（整顿禁军、抑制藩镇、务实统一战略）逐步扫清了统一的制度障碍 | 刘继元、赵光义 |
| e1204 | 979 | 天下一统（高潮节点，特殊排版） | — | 赵光义 |
| e1205 | 979-06 | 高梁河之战，燕云梦碎 | — | 赵光义 |

节点合计：5+7+7+6+5+6+6+7+6+5+6+5 = **71**。抉择合计：2+3+3+3+2+3+3+3+4+2+3+1 = **32**。（均超出规模底线，执行时以本表为准。）

**人物名册（60人，persons.js 的唯一依据）**：黄巢、朱温、李克用、李振、唐哀帝、李存勖、周德威、刘守光、刘仁恭、朱友贞、王彦章、郭崇韬、王衍、李继岌、郭从谦、李嗣源、李从厚、李从珂、石敬瑭、耶律德光、石重贵、景延广、杜重威、刘知远、刘承祐、杨邠、史弘肇、郭威、刘崇、柴荣、樊爱能、赵匡胤、杨行密、钱镠、王审知、刘岩（刘龑）、马殷、徐知诰（李昪）、王建、高季兴、孟知祥、马希萼、马希声、冯道、石守信、李筠、李重进、赵普、高继冲、周保权、孟昶、王昭远、花蕊夫人、刘鋹、李煜、钱俶、赵光义、杨业、刘继元、安重荣。
（执行时全部收录；冯道等争议人物一分为二陈述功过，不作简单褒贬。）
关系边≥15条，覆盖五类：师承（冯道→提携的门生故吏）、同盟（石敬瑭—耶律德光认父称臣之盟）、对立（朱温—李克用梁晋世仇；李煜—钱俶南唐吴越累世交兵）、亲属（郭威—柴荣养父子；高季兴—高继冲祖孙；马殷—马希萼/马希声父子；孟知祥—孟昶父子；钱镠—钱俶祖孙）、影响（王彦章"豹死留皮"精神影响后世武将气节；周世宗改革影响赵匡胤统一方略；安重荣"兵强马壮"论主导五代政治逻辑；欧阳修《伶官传序》评李存勖成为后世治乱鉴戒）。

---

### Task 1: 项目脚手架 + chapters.js + validate.html 校验框架

**Files:**
- Create: `index.html`（仅骨架：脚本加载顺序如上、四个视图容器 div）
- Create: `data/chapters.js`（12 章完整数据，含 theme 色值与章引言）
- Create: `validate.html`
- Create: `js/`、`css/`、`data/`、`vendor/`、`assets/images/{panorama,persons,events}/` 目录（用 `.gitkeep`）

**Interfaces:**
- Produces: `window.WDFY_DATA.chapters`（12 项，字段见"数据接口总览"）；`validate.html` 的 `runChecks()` 返回 `{pass: number, fail: number, messages: string[]}`。

- [ ] **Step 1: 写 validate.html（先写校验=测试先行）**——包含断言函数与全部数据校验规则：

```html
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>数据自检</title></head>
<body><pre id="out">运行中……</pre>
<script src="data/chapters.js"></script>
<script src="data/events.js"></script>
<script src="data/choices.js"></script>
<script src="data/persons.js"></script>
<script src="js/score.js"></script>
<script>
const R = { pass: 0, fail: 0, messages: [] };
function ok(cond, msg) { if (cond) R.pass++; else { R.fail++; R.messages.push("✘ " + msg); } }
const D = window.WDFY_DATA || {};
// —— 章节 ——
ok(D.chapters && D.chapters.length === 12, "章节数须为12");
(D.chapters||[]).forEach(c => {
  ok(c.id && c.title && c.intro && c.intro.length >= 80, `章节${c.id}字段完整且引言≥80字`);
  ok(c.startYear <= c.endYear, `章节${c.id}年份区间合法`);
});
// —— 事件 ——
ok(D.events && D.events.length >= 70, "节点数须≥70");
const chapterOf = Object.fromEntries((D.chapters||[]).map(c=>[c.id,c]));
let prevKey = "";
(D.events||[]).forEach(e => {
  ok(chapterOf[e.chapterId], `事件${e.id}的chapterId存在`);
  ok(/^\d{3,4}/.test(e.date), `事件${e.id}日期以年份开头`);
  const y = parseInt(e.date.slice(0,4),10), c = chapterOf[e.chapterId];
  if (c) ok(y >= c.startYear - 1 && y <= c.endYear + 1, `事件${e.id}(${y})落在章节区间`);
  ok(e.summary && e.summary.length >= 100, `事件${e.id}正文≥100字`);
  ok(e.significance && e.extra, `事件${e.id}有意义与钩沉`);
  const key = e.chapterId + String(e.order).padStart(3,"0");
  ok(key > prevKey, `事件${e.id}章内顺序递增`); prevKey = key;
});
// —— 抉择 ——
ok(D.choices && D.choices.length >= 30, "抉择点须≥30");
const eventIds = new Set((D.events||[]).map(e=>e.id));
(D.choices||[]).forEach(c => {
  ok(eventIds.has(c.eventId), `抉择${c.id}挂在真实事件上`);
  ok(["roleplay","insight"].includes(c.kind), `抉择${c.id}类型合法`);
  ok(c.options.filter(o=>o.correct).length === 1, `抉择${c.id}恰有一个正确项`);
  c.options.forEach((o,i)=> ok(o.feedback && o.feedback.length >= 60, `抉择${c.id}选项${i}有≥60字解析`));
  ok(c.scene && c.historyNote && c.panorama, `抉择${c.id}有情境/史实走向/全景图`);
});
(D.events||[]).forEach(e => { if (e.choiceId) ok((D.choices||[]).some(c=>c.id===e.choiceId), `事件${e.id}的choiceId存在`); });
// —— 人物 ——
ok(D.persons && D.persons.length >= 45, "人物须≥45");
const personIds = new Set((D.persons||[]).map(p=>p.id));
(D.events||[]).forEach(e => (e.personIds||[]).forEach(pid => ok(personIds.has(pid), `事件${e.id}引用人物${pid}存在`)));
(D.relations||[]).forEach(r => ok(personIds.has(r.source) && personIds.has(r.target) && ["师承","同盟","对立","亲属","影响"].includes(r.relation), `关系${r.source}->${r.target}合法`));
(D.persons||[]).forEach(p => ok(p.bio && p.bio.length >= 100 && p.role, `人物${p.id}小传≥100字`));
// —— 计分纯函数用例 ——
if (window.WDFY_SCORE) {
  const S = window.WDFY_SCORE;
  ok(S.comboMultiplier(0)===1.0 && S.comboMultiplier(1)===1.0 && S.comboMultiplier(2)===1.1 && S.comboMultiplier(3)===1.2 && S.comboMultiplier(4)===1.3 && S.comboMultiplier(9)===1.3, "连击倍率表正确");
  ok(S.scoreForAnswer(true,0)===100 && S.scoreForAnswer(true,2)===110 && S.scoreForAnswer(false,5)===0, "答题得分：首对100、带连击110、答错0");
  ok(S.LEARN===20 && S.EXTRA===10, "明理分20/探索分10");
  ok(S.chapterGrade(85,100)==="甲" && S.chapterGrade(60,100)==="乙" && S.chapterGrade(59,100)==="丙", "章节评级阈值 85/60");
  ok(S.titleForTotal(0)==="初识五代" && S.titleForTotal(1500)==="乱世观澜" && S.titleForTotal(3000)==="良史之笔" && S.titleForTotal(4500)==="定鼎之臣", "称号阈值 0/1500/3000/4500");
} else { R.fail++; R.messages.push("✘ score.js 未加载"); }
document.getElementById("out").textContent =
  `通过 ${R.pass} 项，失败 ${R.fail} 项\n` + R.messages.join("\n");
</script></body></html>
```

- [ ] **Step 2: 打开 validate.html 验证它失败**——`open validate.html`，预期大量 ✘（数据文件还不存在）。
- [ ] **Step 3: 写 `data/chapters.js`**：12 章完整数据。每章 `theme` 色调按设计（铁灰暗红→浑浊金→灰紫→土黄→斑斓杂色→冷青转暖→鎏金朱红→赭红→青金黎明）取值。章引言 100–200 字，文风庄重带乱世苍凉感。
- [ ] **Step 4: 写 `index.html` 骨架**：`<div id="scroll-view">`、`<div id="choice-view" hidden>`、`<div id="graph-view" hidden>`、`<div id="ending-view" hidden>`、`<div id="about-view" hidden>` + 顶栏，按总览顺序引脚本（暂缺文件属正常）。
- [ ] **Step 5: 重开 validate.html**——预期：章节 12 项相关检查全部通过，其余因数据缺失仍失败。
- [ ] **Step 6: Commit** `feat: 脚手架、12章数据与数据自检页`

### Task 2–5: 数据内容——events.js + choices.js（按章分批）

> 四个同构任务：Task2=第1–3章，Task3=第4–6章，Task4=第7–9章，Task5=第10–12章。**严格按骨架表撰写**，每条 summary 150–300 字、significance 80–150 字、extra 50–120 字、choice 各字段达到规定字数；文风：正文客观庄重，抉择 scene 用第二人称沉浸描写。event.image 本阶段一律先填 `null`，panorama 按 `assets/images/panorama/<choiceId>.jpg` 预填。

**Files:**
- Create/Modify: `data/events.js`、`data/choices.js`

**Interfaces:**
- Produces: 骨架表中对应章节的全部 events/choices 记录，字段名严格按"数据接口总览"。

每个任务的步骤（以 Task 2 为例，其余同构）：
- [ ] **Step 1:** 按骨架表写第 1–3 章全部 19 个事件 + 8 个抉择（c01–c08）的完整内容。
- [ ] **Step 2:** 打开 validate.html，确认本批事件/抉择的全部检查通过。
- [ ] **Step 3:** 逐条自读一遍日期与史实陈述，与骨架表核对；特别注意存疑/传说性表述已标注"相传/据载"。
- [ ] **Step 4: Commit** `data: 第1–3章历史节点与抉择内容`（各任务改相应章节号）

### Task 6: persons.js 人物图谱数据

**Files:**
- Create: `data/persons.js`

**Interfaces:**
- Produces: `window.WDFY_DATA.persons`（60 人，字段见总览，image 先填 null）与 `window.WDFY_DATA.relations`（≥15 条边）。

- [ ] **Step 1:** 按人物名册写全部人物（bio 150–300 字，客观陈述，功过分明；冯道、杜重威等争议人物尤须一分为二）。
- [ ] **Step 2:** 写关系边 ≥15 条，五类关系均有覆盖，每条带 note。
- [ ] **Step 3:** validate.html：人物/关系/事件引用检查全绿。
- [ ] **Step 4: Commit** `data: 60位历史人物小传与关系图谱`

### Task 7: 史实复核（fact-check pass）

**Files:**
- Modify: `data/*.js`（仅修错）；Create: `docs/superpowers/specs/wudai-fact-check-log.md`

- [ ] **Step 1:** 由独立视角（新subagent或新会话）逐章交叉核对：所有日期、人名、地名、政权更迭、因果表述、引语出处；对照《旧五代史》《新五代史》《资治通鉴》。
- [ ] **Step 2:** 每处修改记入 `wudai-fact-check-log.md`（原文→改后→依据）。
- [ ] **Step 3:** validate.html 全绿。
- [ ] **Step 4: Commit** `data: 史实复核修订`

### Task 8: score.js 计分纯函数

**Files:**
- Create: `js/score.js`；Test: validate.html 已内置断言（Task 1 Step 1）

**Interfaces:**
- Produces: `window.WDFY_SCORE = { BASE_CORRECT:100, LEARN:20, EXTRA:10, comboMultiplier(combo), scoreForAnswer(firstTryCorrect, combo), chapterGrade(earned, possible), titleForTotal(total), newState(), saveState(state), loadState() }`
- `newState()` 返回 `{ unlockedCount:1, total:0, combo:0, answered:{}, readExtra:{}, litPersons:[], chapterEarned:{}, finished:false }`；`saveState/loadState` 用键 `wdfy_save_v1`。

- [ ] **Step 1:** 打开 validate.html 确认计分断言当前为失败（score.js 未加载）。
- [ ] **Step 2:** 实现上述纯函数：连击倍率与 chapterGrade 阈值同原作；`titleForTotal`：<1500"初识五代"、<3000"乱世观澜"、<4500"良史之笔"、≥4500"定鼎之臣"。
- [ ] **Step 3:** validate.html 计分断言全绿。
- [ ] **Step 4: Commit** `feat: 计分系统纯函数与存档`

### Task 9: 画卷主界面（css/main.css + js/scroll.js + js/app.js）

**Files:**
- Create: `css/main.css`、`js/scroll.js`、`js/app.js`；Modify: `index.html`

**Interfaces:**
- Consumes: `WDFY_DATA.*`、`WDFY_SCORE.*`
- Produces: `window.WDFY_APP = { showView(name), refreshHud(), state }`；`window.WDFY_SCROLL = { render(), openEvent(eventId), advance() }`；自定义事件 `document.dispatchEvent(new CustomEvent("wdfy:enter-choice", {detail:{choiceId}}))`、`"wdfy:choice-done"`。

- [ ] **Step 1:** main.css：宣纸底纹、水墨配色 CSS 变量（每章 theme 注入）、竖排章题、节点珠串三态。
- [ ] **Step 2:** scroll.js：横向长卷渲染、节点卡片、抉择点派发 `wdfy:enter-choice`；天下一统节点（e1204）加特殊金青排版类 `.node-climax`；最后节点完成后派发 `wdfy:enter-ending`。
- [ ] **Step 3:** app.js：视图切换、HUD、静音按钮、重新开始、"关于"页。
- [ ] **Step 4:** 手动验收：file:// 打开，能从 e0101 推进到 e0103，刷新后进度保留。
- [ ] **Step 5: Commit** `feat: 画卷主界面与节点推进`

### Task 10: 沉浸抉择模式（js/choice.js）

**Files:** Create: `js/choice.js`；Modify: `css/main.css`

**Interfaces:**
- Consumes: `wdfy:enter-choice` 事件、`WDFY_SCORE`；Produces: `wdfy:choice-done`。

- [ ] **Step 1:** 全屏 overlay：panorama 背景 + Ken Burns 动画、scene 旁白逐段淡入、问题与选项卡片。
- [ ] **Step 2:** 作答逻辑同原作（对：金色印章"史笔如铁"；错：墨晕动效 + feedback + historyNote 卷轴）；图片右下角常驻"AI 生成想象图"角标。
- [ ] **Step 3:** 手动验收 c01 对/错两条路径、得分与连击正确。
- [ ] **Step 4: Commit** `feat: 沉浸式抉择模式`

### Task 11: 人物星图（js/graph.js + vendor/d3）

**Files:** Create: `js/graph.js`、`vendor/d3.v7.min.js`

**Interfaces:**
- Consumes: `WDFY_DATA.persons/relations`、`state.litPersons`；Produces: `window.WDFY_GRAPH = { render() }`。

- [ ] **Step 1:** d3 力导向：节点=人物，边按五类关系着色+图例；点选人物侧栏显示小传、生卒、关系列表。
- [ ] **Step 2:** 手动验收：推进两章后星图点亮人数正确、拖拽缩放流畅。
- [ ] **Step 3: Commit** `feat: 人物知识星图`

### Task 12: 音效（js/audio.js）

**Files:** Create: `js/audio.js`；Modify: `js/app.js`

**Interfaces:**
- Produces: `window.WDFY_AUDIO = { init(), play(name), setMuted(b), muted }`；设置存 `wdfy_settings_v1`。

- [ ] **Step 1:** Web Audio 合成各音效（同原作设计）。
- [ ] **Step 2:** 手动验收各音效与静音持久化。
- [ ] **Step 3: Commit** `feat: WebAudio合成音效`

### Task 13: 终章卷轴（js/ending.js）

**Files:** Create: `js/ending.js`；Modify: `css/main.css`

**Interfaces:**
- Consumes: `wdfy:enter-ending`、`state`；Produces: 终章视图渲染。

- [ ] **Step 1:** 青金黎明主题竖向卷轴：① 总分/称号/各章评级总览；② 玩家走过的 32 个抉择回顾；③ 收束段落——引"话说天下大势，分久必合，合久必分"，回顾从黄巢起义到天下一统的七十余年乱世，末段点出燕云十六州终宋一代未能收复，留一分历史反思而非单纯颂扬；④ "重走长卷"按钮。
- [ ] **Step 2:** 手动验收：完成 e1205 后自动进入终章，数据统计正确。
- [ ] **Step 3: Commit** `feat: 终章卷轴`

### Task 14: 历史图片收集（人物/事件配图）

**Files:** Create: `assets/images/persons/*.jpg`、`assets/images/events/*.jpg`、`assets/images/CREDITS.md`；Modify: `data/persons.js`、`data/events.js`

- [ ] **Step 1:** 用 Wikimedia Commons API 检索公有领域古代画像/拓片/后世摹绘图，确认许可后下载并统一压缩（`sips -Z 600`）；五代十国传世画像稀少，多数需注明"后世摹绘"。
- [ ] **Step 2:** 事件配图同法（如陈桥兵变、南唐李煜等后世画作）。
- [ ] **Step 3:** 找不到合适图片的人物/事件：用 gpt-image-bridge 生成，imageCredit 标"AI 生成想象图"。
- [ ] **Step 4:** 全部来源写入 CREDITS.md；回填 image 字段；validate.html 全绿。
- [ ] **Step 5: Commit** `feat: 人物与事件历史图片素材`

### Task 15: 全景图生成（32 张）

**Files:** Create: `assets/images/panorama/c01.jpg … c32.jpg`

- [ ] **Step 1:** 统一提示词模板：`史诗历史场景全景，<场景描述>，写实历史画风融合中国水墨意蕴，电影级光效，宽画幅，无任何文字水印`；每个抉择点按其 scene 写场景描述。
- [ ] **Step 2:** 用 gpt-image-bridge 逐张生成（16:9），文件名与 choices.js 的 panorama 路径一致。
- [ ] **Step 3:** 逐张目检：无文字乱码、无史实硬伤（如唐末场景出现宋代以后器物）、氛围契合；不合格重生成。
- [ ] **Step 4: Commit** `feat: 32张抉择点沉浸全景图`

### Task 16: 集成验收

- [ ] **Step 1:** validate.html 全绿（0 失败）。
- [ ] **Step 2:** file:// 双击 index.html 全流程走查清单：12 章推进到底、至少各答一次对/错、静音切换、刷新续档、重新开始、人物星图点亮、天下一统特殊节点、终章统计、手机宽度响应式检查。
- [ ] **Step 3:** 发现问题修复并逐项复验。
- [ ] **Step 4: Commit** `fix: 集成验收修复`；打 tag `v1.0`。

---

## Self-Review 记录

1. **Spec 覆盖**：12章✓、≥70节点（71）✓、≥30抉择（32）✓、≥45人物（60）✓、混合图片策略（Task 14/15）✓、纯静态 file://（全局约束+Task 9 验收）✓、计分/评级/称号（Task 8，阈值已改编为五代十国主题）✓、音效（Task 12）✓、终章"分久必合"主题（Task 13）✓、史实复核（Task 7）✓、CREDITS 与 AI 图标注（Task 14/10）✓、validate 校验（Task 1）✓、YAGNI 清单未引入被排除项✓。
2. **占位符扫描**：内容任务以骨架表为唯一依据（表已含全部节点日期/标题/抉择设计与正确答案），无 TBD。
3. **类型一致性**：`WDFY_DATA`/`WDFY_SCORE`/`WDFY_APP`/`WDFY_SCROLL`/`WDFY_GRAPH`/`WDFY_AUDIO` 与两个自定义事件名（`wdfy:enter-choice`/`wdfy:choice-done`/`wdfy:enter-ending`）在各任务 Interfaces 中口径一致；validate.html 断言的阈值与 Task 8 实现一致（85/60、1500/3000/4500、20/10、连击表）。
4. **与原作差异说明**：本次改编未执行任何 Task，仅完成"设计文档"与"实现计划"两份文本的历史主题替换，供后续需要时按图施工；15章→12章、93节点→71节点、26抉择→32抉择、55人物→60人物均因五代十国史料密度与叙事节奏与中国近代史不同而重新设计，非简单等比例替换。
