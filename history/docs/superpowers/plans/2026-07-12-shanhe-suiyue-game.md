# 《山河岁月》中国近代史画卷互动游戏 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个纯静态、双击即玩的中国近代史（1839–1978）画卷式科普互动游戏网页 App。

**Architecture:** 数据先行——全部史实内容落盘为 `data/*.js` 全局变量文件并通过 `validate.html` 自动校验；游戏层为原生 JS 多脚本（非 ES module，保证 file:// 可运行），画卷主视图 + 全屏沉浸抉择 + d3 人物星图 + 终章卷轴四个视图切换。

**Tech Stack:** 原生 HTML/CSS/JS、d3 v7（本地 vendor，仅人物图谱）、Web Audio API（合成音效）、localStorage（存档）、gpt-image-bridge（全景图生成）、Wikimedia Commons API（公有领域照片）。

## Global Constraints

- **file:// 必须可运行**：一切 JS 用普通 `<script>` 全局变量，禁止 ES module / fetch 加载本地 JSON / 任何 CDN 引用。
- **数据全局命名**：每个数据文件向 `window.SHY_DATA` 挂载（`chapters` / `events` / `choices` / `persons` / `relations`）。
- **历史不可改变**：答错只影响得分，剧情严格按史实推进；每个抉择必须有"历史真实走向"说明。
- **史实口径**：以中学/大学通行中国近代史叙述为准，只呈现学界公认结论；敏感/争议时期（第15章）采用教科书"艰辛探索与曲折"口径，庄重客观。
- **图片标注**：AI 生成图必须标"AI 生成想象图"；历史照片必须在 `assets/images/CREDITS.md` 记录来源 URL 与许可。
- **规模底线**：≥70 历史节点、≥25 抉择点、≥40 人物（本计划骨架：85 节点、26 抉择、55 人物）。
- **存档键**：localStorage 键统一为 `shanhe_save_v1`（进度/分数）与 `shanhe_settings_v1`（静音等）。
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
window.SHY_DATA = window.SHY_DATA || {};
window.SHY_DATA.chapters = [{
  id: "ch01", order: 1, title: "鸦片战争与国门洞开",
  subtitle: "天朝上国的黄昏", startYear: 1839, endYear: 1860,
  theme: { primary: "#8a6d3b", bg: "#f4ead6", accent: "#a33c22" },
  intro: "……（100–200字章引言）"
}];

// events.js
window.SHY_DATA.events = [{
  id: "e0101", chapterId: "ch01", order: 1,
  date: "1839-06-03", dateText: "1839年6月3日",
  title: "虎门销烟", place: "广东虎门",
  summary: "……150–300字", significance: "……80–150字",
  extra: "……50–120字史海钩沉",
  image: "assets/images/events/humen.jpg",   // 可为 null
  imageCredit: "历史照片/绘画 · 来源见CREDITS",   // 或 "AI 生成想象图"
  personIds: ["p_linzexu"],
  choiceId: null                              // 抉择点则指向 choices.id
}];

// choices.js
window.SHY_DATA.choices = [{
  id: "c01", eventId: "e0102",
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
window.SHY_DATA.persons = [{
  id: "p_linzexu", name: "林则徐", courtesy: "字元抚，号少穆",
  birth: 1785, death: 1850, role: "清末政治家、民族英雄，虎门销烟主持者",
  bio: "……150–300字", image: "assets/images/persons/linzexu.jpg",
  imageCredit: "公有领域照片/画像", chapterIds: ["ch01"]
}];
window.SHY_DATA.relations = [
  { source: "p_kangyouwei", target: "p_liangqichao", relation: "师承", note: "万木草堂师生" }
  // relation ∈ 师承|同盟|对立|亲属|影响
];
```

---

## 历史内容骨架（85 节点 / 26 抉择，内容任务的唯一依据）

> 标记【抉择·代入】= roleplay，【抉择·史识】= insight。执行内容任务时按此表逐条撰写，不得增删节点或改动日期；若发现骨架有史实错误，先修订本表并在提交信息中说明。

**第1章 鸦片战争与国门洞开（1839–1860）** — 7节点/2抉择
| id | 日期 | 标题 | 抉择 | 关联人物 |
|----|------|------|------|----------|
| e0101 | 1839-06-03 | 虎门销烟 | — | 林则徐、关天培、道光帝 |
| e0102 | 1838-12 | 严禁与弛禁之争 | 【抉择·代入】c01：你是道光帝，鸦片泛滥白银外流，采纳严禁派（林则徐）还是弛禁派？正确=严禁 | 道光帝、林则徐、琦善 |
| e0103 | 1840-06 | 鸦片战争爆发 | — | 林则徐、琦善 |
| e0104 | 1841-05-29 | 三元里人民抗英 | — | — |
| e0105 | 1842-08-29 | 《南京条约》签订 | — | 道光帝 |
| e0106 | 1842 | 开眼看世界 | 【抉择·史识】c02：战败之后，士大夫应当如何？正确=如魏源"师夷长技以制夷"，编《海国图志》 | 魏源、林则徐 |
| e0107 | 1856–1860 | 第二次鸦片战争与火烧圆明园 | — | 咸丰帝、奕䜣 |

**第2章 太平天国运动（1851–1864）** — 6节点/2抉择
| e0201 | 1851-01-11 | 金田起义 | — | 洪秀全、杨秀清 |
| e0202 | 1853-03 | 定都天京与《天朝田亩制度》 | — | 洪秀全 |
| e0203 | 1856-09 | 天京事变 | 【抉择·史识】c03：太平天国由盛转衰的转折点及其根源？正确=天京事变，暴露农民阶级局限性 | 洪秀全、杨秀清、石达开 |
| e0204 | 1859 | 《资政新篇》 | 【抉择·史识】c04：洪仁玕的新方案为何未能实施？正确=缺乏社会基础与和平环境，但它是先进中国人向西方寻求真理的探索 | 洪仁玕 |
| e0205 | 1861 | 湘军淮军与中外会剿 | — | 曾国藩、李鸿章、左宗棠 |
| e0206 | 1864-07 | 天京陷落 | — | 曾国藩、洪秀全 |

**第3章 洋务运动：自强与求富（1861–1895）** — 6节点/2抉择
| e0301 | 1861-01 | 总理衙门设立 | — | 奕䜣、慈禧太后 |
| e0302 | 1865 | 江南制造总局与军事工业 | 【抉择·代入】c05：你是1866年的恭亲王奕䜣，顽固派倭仁称"立国之道尚礼义不尚权谋"，办不办洋务？正确=办，师夷长技 | 奕䜣、曾国藩、李鸿章 |
| e0303 | 1872 | 轮船招商局与求富 | — | 李鸿章、张之洞 |
| e0304 | 1872-08 | 留美幼童起航 | — | 容闳、詹天佑 |
| e0305 | 1875 | 海防与塞防之争 | 【抉择·代入】c06：你是清廷决策者，李鸿章主专务海防、左宗棠主海塞并重收复新疆，如何决断？正确=海塞并重，左宗棠收复新疆 | 左宗棠、李鸿章 |
| e0306 | 1888-12 | 北洋水师成军 | — | 李鸿章、丁汝昌、邓世昌 |

**第4章 甲午战争与瓜分狂潮（1894–1898）** — 6节点/2抉择
| e0401 | 1894-07-25 | 丰岛海战与甲午战争爆发 | — | 李鸿章、光绪帝 |
| e0402 | 1894-09-17 | 黄海海战·致远冲锋 | — | 邓世昌、丁汝昌 |
| e0403 | 1894-10 | 避战保船之误 | 【抉择·史识】c07：黄海之后北洋舰队应当如何？正确=力争制海权、主动作战；历史上李鸿章令"避战保船"，1895年2月威海卫全军覆没——历史教训型抉择 | 李鸿章、丁汝昌 |
| e0404 | 1895-04-17 | 《马关条约》 | 【抉择·史识】c08：《马关条约》危害最深远的条款？正确=允许日本在通商口岸开设工厂（列强资本输出）+割台湾 | 李鸿章、光绪帝 |
| e0405 | 1895–1898 | 三国干涉还辽与瓜分狂潮 | — | — |
| e0406 | 1895-05-02 | 公车上书 | — | 康有为、梁启超 |

**第5章 戊戌变法（1898）** — 4节点/1抉择
| e0501 | 1898-06-11 | 《定国是诏》：百日维新开始 | — | 光绪帝、康有为 |
| e0502 | 1898-06–09 | 维新新政百日 | 【抉择·史识】c09：维新派最缺少的是什么？正确=依靠力量——没有实权、没有军队、没有广泛社会基础，只依靠无实权的皇帝 | 光绪帝、康有为、梁启超、严复 |
| e0503 | 1898-09-21 | 戊戌政变 | — | 慈禧太后、光绪帝、袁世凯 |
| e0504 | 1898-09-28 | 戊戌六君子就义 | — | 谭嗣同 |

**第6章 义和团、庚子国变与清末新政（1899–1911）** — 6节点/2抉择
| e0601 | 1899 | 义和团运动兴起 | 【抉择·史识】c10：如何评价"扶清灭洋"？正确=反帝爱国性质，但带有盲目排外与迷信局限 | 慈禧太后 |
| e0602 | 1900-08 | 八国联军侵华、庚子国变 | — | 慈禧太后、光绪帝 |
| e0603 | 1901-09-07 | 《辛丑条约》：完全沦为半殖民地 | — | 李鸿章 |
| e0604 | 1901–1911 | 清末新政与预备立宪（1905废科举、1911皇族内阁） | — | 慈禧太后、袁世凯 |
| e0605 | 1905-08-20 | 中国同盟会成立与三民主义 | — | 孙中山、黄兴、宋教仁 |
| e0606 | 1905–1907 | 革命与改良的大论战 | 【抉择·史识】c11：《民报》与《新民丛报》之争，历史为何选择革命？正确=清廷"皇族内阁"证明其无意真立宪，改良之路走不通 | 孙中山、梁启超 |

**第7章 辛亥革命（1911–1912）** — 6节点/2抉择
| e0701 | 1911-04-27 | 黄花岗起义与《与妻书》 | — | 黄兴、林觉民 |
| e0702 | 1911-05 | 保路运动 | — | — |
| e0703 | 1911-10-10 | 武昌起义 | 【抉择·代入】c12：你是武昌新军工程第八营的士兵，名册泄露、同志被捕，今夜怎么办？正确=立即起义 | 黎元洪 |
| e0704 | 1912-01-01 | 中华民国临时政府成立 | — | 孙中山 |
| e0705 | 1912-02-12 | 清帝退位与帝制终结 | — | 袁世凯、隆裕太后 |
| e0706 | 1912-03 | 袁世凯窃取革命果实 | 【抉择·史识】c13：辛亥革命的伟大功绩与历史局限？正确=推翻帝制、民主共和观念深入人心，但没有改变半殖民地半封建社会性质 | 孙中山、袁世凯 |

**第8章 民初乱局与新文化运动（1912–1919）** — 6节点/1抉择
| e0801 | 1913-03-20 | 宋教仁遇刺与二次革命 | — | 宋教仁、袁世凯、孙中山 |
| e0802 | 1915-12 | 袁世凯称帝与护国战争 | — | 袁世凯、蔡锷、梁启超 |
| e0803 | 1915-09-15 | 《青年杂志》创刊：德先生与赛先生 | — | 陈独秀 |
| e0804 | 1917 | 文学革命 | 【抉择·代入】c14：你是《新青年》编辑，胡适寄来《文学改良刍议》，登还是不登？正确=登，白话文让新思想走向大众 | 胡适、陈独秀、鲁迅 |
| e0805 | 1917-07-01 | 张勋复辟十二日闹剧 | — | 张勋 |
| e0806 | 1918-11 | 十月革命一声炮响：《庶民的胜利》 | — | 李大钊 |

**第9章 五四运动与中国共产党诞生（1919–1923）** — 6节点/2抉择
| e0901 | 1919-04 | 巴黎和会中国外交失败 | — | 顾维钧 |
| e0902 | 1919-05-04 | 五四运动爆发 | 【抉择·代入】c15：你是北京的大学生，青岛就要被转让给日本，5月4日这天你去不去天安门？正确=去，"外争主权，内除国贼" | 陈独秀、李大钊 |
| e0903 | 1919-06 | 六三大逮捕与工人阶级登上舞台 | — | — |
| e0904 | 1919–1920 | 马克思主义的传播与"问题与主义"之争 | 【抉择·史识】c16：为什么中国先进分子最终选择了马克思主义？正确=十月革命的成功示范+五四实践证明工人阶级力量+改良主义在中国走不通 | 李大钊、陈独秀、毛泽东 |
| e0905 | 1921-07-23 | 中共一大：开天辟地（上海—南湖红船） | — | 毛泽东、董必武、李达 |
| e0906 | 1922–1923 | 中共二大纲领与京汉铁路大罢工 | — | — |

**第10章 国民革命（1924–1927）** — 6节点/1抉择
| e1001 | 1924-01 | 国民党一大与第一次国共合作 | — | 孙中山、李大钊、廖仲恺 |
| e1002 | 1924-06-16 | 黄埔军校创办 | — | 孙中山、蒋介石、周恩来 |
| e1003 | 1925-03-12 | 孙中山逝世与五卅运动 | — | 孙中山、宋庆龄 |
| e1004 | 1926-07-09 | 北伐战争：铁军扬威 | — | 叶挺 |
| e1005 | 1927-04-12 | 四一二反革命政变 | — | 蒋介石、周恩来 |
| e1006 | 1927-08-07 | 八七会议 | 【抉择·代入】c17：大革命失败、同志倒在血泊中，中国革命的出路在哪里？正确="枪杆子里面出政权"，独立领导武装斗争 | 毛泽东、瞿秋白 |

**第11章 土地革命与红军长征（1927–1936）** — 7节点/2抉择
| e1101 | 1927-08-01 | 南昌起义：第一枪 | — | 周恩来、贺龙、朱德、叶挺 |
| e1102 | 1927-09 | 秋收起义与文家市决策 | 【抉择·代入】c18：你在1927年9月的文家市，攻长沙受挫，是继续攻打大城市，还是向敌人力量薄弱的农村进军？正确=上井冈山，农村包围城市 | 毛泽东 |
| e1103 | 1928-04 | 井冈山会师与工农武装割据 | — | 毛泽东、朱德、陈毅 |
| e1104 | 1929-12 | 古田会议：思想建党、政治建军 | — | 毛泽东、朱德 |
| e1105 | 1934-10 | 第五次反"围剿"失败与长征开始、血战湘江 | — | 博古、周恩来 |
| e1106 | 1935-01-15 | 遵义会议：生死攸关的转折 | 【抉择·代入】c19：湘江之后红军去向？按原计划去湘西与二、六军团会合（敌已布口袋阵），还是转兵贵州？正确=转兵贵州（通道转兵→遵义会议确立毛泽东领导地位） | 毛泽东、周恩来、张闻天、王稼祥 |
| e1107 | 1935–1936 | 四渡赤水、飞夺泸定桥、三军会师 | — | 毛泽东、朱德、彭德怀 |

**第12章 抗日战争（1931–1945）** — 8节点/3抉择
| e1201 | 1931-09-18 | 九一八事变 | 【抉择·史识】c20：面对侵略，"攘外必先安内"的不抵抗政策错在哪里？正确=民族矛盾已上升为主要矛盾，丢失东北助长侵略气焰 | 张学良、杨靖宇 |
| e1202 | 1935-12-09 | 华北危急与一二·九运动 | — | — |
| e1203 | 1936-12-12 | 西安事变 | 【抉择·代入】c21：你参与中共决策：蒋介石被扣押，杀蒋报仇还是逼蒋抗日、和平解决？正确=和平解决，建立抗日民族统一战线大局为重 | 张学良、杨虎城、周恩来、蒋介石 |
| e1204 | 1937-07-07 | 七七事变与全民族抗战 | — | 佟麟阁 |
| e1205 | 1937-12-13 | 淞沪会战与南京大屠杀 | — | 张自忠 |
| e1206 | 1938-05 | 《论持久战》 | 【抉择·史识】c22："亡国论""速胜论"为何都是错的？正确=敌强我弱但敌小我大、失道寡助，抗战是持久战，最后胜利属于中国 | 毛泽东 |
| e1207 | 1937–1940 | 平型关、台儿庄与百团大战 | — | 林彪、李宗仁、彭德怀、左权 |
| e1208 | 1945-08-15 | 抗战胜利与台湾光复 | — | 毛泽东、蒋介石 |

**第13章 解放战争（1945–1949）** — 7节点/2抉择
| e1301 | 1945-08-28 | 重庆谈判 | 【抉择·代入】c23：延安机场，国民党三电相邀、许多人担心鸿门宴，毛泽东去不去重庆？正确=去，弥天大勇争取和平、揭穿假和平真面目 | 毛泽东、周恩来、蒋介石 |
| e1302 | 1946-06 | 全面内战爆发与转战陕北 | — | 毛泽东、彭德怀、胡宗南 |
| e1303 | 1947-06-30 | 千里跃进大别山 | — | 刘伯承、邓小平 |
| e1304 | 1948-09–1949-01 | 三大战役：辽沈、淮海、平津 | — | 林彪、粟裕、聂荣臻 |
| e1305 | 1949-01-31 | 北平和平解放 | 【抉择·代入】c24：你是傅作义，几十万大军困守孤城，战则古都毁于战火，和则士兵百姓得生，如何抉择？正确=接受和平改编 | 傅作义、聂荣臻 |
| e1306 | 1949-03 | 七届二中全会与"进京赶考" | — | 毛泽东 |
| e1307 | 1949-04-23 | 渡江战役与南京解放 | — | 邓小平、陈毅 |

**第14章 新中国成立与社会主义建设（1949–1956）** — 6节点/1抉择
| e1401 | 1949-10-01 | 开国大典（高潮节点，特殊排版） | — | 毛泽东、朱德、宋庆龄 |
| e1402 | 1950-10 | 抗美援朝 | 【抉择·代入】c25：战火烧到鸭绿江边，国内百废待兴、敌我装备悬殊，出不出兵？正确=出兵，"打得一拳开，免得百拳来" | 毛泽东、彭德怀、黄继光、邱少云 |
| e1403 | 1950–1952 | 土地改革：耕者有其田 | — | — |
| e1404 | 1953–1957 | 一五计划与工业化奠基 | — | — |
| e1405 | 1954-09 | 一届人大与《五四宪法》 | — | 毛泽东、刘少奇 |
| e1406 | 1956 | 三大改造完成：社会主义制度确立 | — | — |

**第15章 曲折探索与改革开放（1956–1978）** — 6节点/1抉择
| e1501 | 1956-09 | 中共八大：良好开端 | — | 毛泽东、刘少奇、邓小平 |
| e1502 | 1958–1965 | 艰辛探索与调整（大跃进教训与国民经济调整） | — | 周恩来、陈云 |
| e1503 | 1964-10-16 | 两弹一星：东方巨响 | — | 钱学森、邓稼先、郭永怀 |
| e1504 | 1960s | 时代楷模：雷锋、焦裕禄、王进喜 | — | 雷锋、焦裕禄、王进喜 |
| e1505 | 1971-10-25 | 重返联合国与中美破冰 | — | 毛泽东、周恩来 |
| e1506 | 1978-12-18 | 真理标准大讨论与十一届三中全会 | 【抉择·史识】c26："两个凡是"还是实践标准？正确=实践是检验真理的唯一标准；三中全会把工作中心转移到经济建设上来，改革开放启航 | 邓小平 |

节点合计：7+6+6+6+4+6+6+6+6+6+7+8+7+6+6 = **93**。抉择合计：2+2+2+2+1+2+2+1+2+1+2+3+2+1+1 = **26**。（超出规模底线即可，执行时以本表为准。）

**人物名册（55人，persons.js 的唯一依据）**：林则徐、道光帝、关天培、琦善、魏源、咸丰帝、奕䜣、洪秀全、杨秀清、石达开、洪仁玕、曾国藩、李鸿章、左宗棠、张之洞、慈禧太后、容闳、詹天佑、丁汝昌、邓世昌、光绪帝、康有为、梁启超、谭嗣同、严复、袁世凯、孙中山、黄兴、宋教仁、林觉民、黎元洪、蔡锷、陈独秀、李大钊、胡适、鲁迅、蔡元培、顾维钧、毛泽东、周恩来、朱德、董必武、瞿秋白、蒋介石、宋庆龄、廖仲恺、叶挺、贺龙、陈毅、彭德怀、刘伯承、邓小平、张闻天、王稼祥、博古、张学良、杨虎城、杨靖宇、张自忠、佟麟阁、左权、李宗仁、粟裕、聂荣臻、傅作义、刘少奇、黄继光、邱少云、钱学森、邓稼先、郭永怀、雷锋、焦裕禄、王进喜、陈云、隆裕太后、张勋、李达、胡宗南、林彪。
（>55，执行时全部收录；林彪、博古等人物客观陈述功过，口径同教科书。）
关系边≥60条，覆盖五类：师承（康有为→梁启超）、同盟（孙中山—黄兴）、对立（维新派—顽固派）、亲属（孙中山—宋庆龄）、影响（魏源→奕䜣）。

---

### Task 1: 项目脚手架 + chapters.js + validate.html 校验框架

**Files:**
- Create: `index.html`（仅骨架：脚本加载顺序如上、四个视图容器 div）
- Create: `data/chapters.js`（15 章完整数据，含 theme 色值与章引言）
- Create: `validate.html`
- Create: `js/`、`css/`、`data/`、`vendor/`、`assets/images/{panorama,persons,events}/` 目录（用 `.gitkeep`）

**Interfaces:**
- Produces: `window.SHY_DATA.chapters`（15 项，字段见"数据接口总览"）；`validate.html` 的 `runChecks()` 返回 `{pass: number, fail: number, messages: string[]}`。

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
const D = window.SHY_DATA || {};
// —— 章节 ——
ok(D.chapters && D.chapters.length === 15, "章节数须为15");
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
  ok(/^\d{4}/.test(e.date), `事件${e.id}日期以年份开头`);
  const y = parseInt(e.date.slice(0,4),10), c = chapterOf[e.chapterId];
  if (c) ok(y >= c.startYear - 1 && y <= c.endYear + 1, `事件${e.id}(${y})落在章节区间`);
  ok(e.summary && e.summary.length >= 100, `事件${e.id}正文≥100字`);
  ok(e.significance && e.extra, `事件${e.id}有意义与钩沉`);
  const key = e.chapterId + String(e.order).padStart(3,"0");
  ok(key > prevKey, `事件${e.id}章内顺序递增`); prevKey = key;
});
// —— 抉择 ——
ok(D.choices && D.choices.length >= 25, "抉择点须≥25");
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
ok(D.persons && D.persons.length >= 40, "人物须≥40");
const personIds = new Set((D.persons||[]).map(p=>p.id));
(D.events||[]).forEach(e => (e.personIds||[]).forEach(pid => ok(personIds.has(pid), `事件${e.id}引用人物${pid}存在`)));
(D.relations||[]).forEach(r => ok(personIds.has(r.source) && personIds.has(r.target) && ["师承","同盟","对立","亲属","影响"].includes(r.relation), `关系${r.source}->${r.target}合法`));
(D.persons||[]).forEach(p => ok(p.bio && p.bio.length >= 100 && p.role, `人物${p.id}小传≥100字`));
// —— 计分纯函数用例 ——
if (window.SHY_SCORE) {
  const S = window.SHY_SCORE;
  ok(S.comboMultiplier(0)===1.0 && S.comboMultiplier(1)===1.0 && S.comboMultiplier(2)===1.1 && S.comboMultiplier(3)===1.2 && S.comboMultiplier(4)===1.3 && S.comboMultiplier(9)===1.3, "连击倍率表正确");
  ok(S.scoreForAnswer(true,0)===100 && S.scoreForAnswer(true,2)===110 && S.scoreForAnswer(false,5)===0, "答题得分：首对100、带连击110、答错0");
  ok(S.LEARN===20 && S.EXTRA===10, "明理分20/探索分10");
  ok(S.chapterGrade(85,100)==="甲" && S.chapterGrade(60,100)==="乙" && S.chapterGrade(59,100)==="丙", "章节评级阈值 85/60");
  ok(S.titleForTotal(0)==="初识风云" && S.titleForTotal(1200)==="洞察者" && S.titleForTotal(2400)==="史家" && S.titleForTotal(3600)==="民族脊梁", "称号阈值 0/1200/2400/3600");
} else { R.fail++; R.messages.push("✘ score.js 未加载"); }
document.getElementById("out").textContent =
  `通过 ${R.pass} 项，失败 ${R.fail} 项\n` + R.messages.join("\n");
</script></body></html>
```

- [ ] **Step 2: 打开 validate.html 验证它失败**——`open validate.html`，预期大量 ✘（数据文件还不存在）。
- [ ] **Step 3: 写 `data/chapters.js`**：15 章完整数据。每章 `theme` 色调按设计（晚清昏黄→灰蓝→渐亮→肃穆→炽红→明亮→晨曦）取值，示例：ch01 `#8a6d3b/#f4ead6/#a33c22`，ch09 起 accent 转向 `#c0392b` 系，ch14 `#b71c1c/#fdf6ec/#d4a017`。章引言 100–200 字，文风庄重带画卷感。
- [ ] **Step 4: 写 `index.html` 骨架**：`<div id="scroll-view">`、`<div id="choice-view" hidden>`、`<div id="graph-view" hidden>`、`<div id="ending-view" hidden>`、`<div id="about-view" hidden>` + 顶栏（标题/得分/静音/人物星图/关于按钮），按总览顺序引脚本（暂缺文件属正常）。
- [ ] **Step 5: 重开 validate.html**——预期：章节 15 项相关检查全部通过，其余因数据缺失仍失败。
- [ ] **Step 6: Commit** `feat: 脚手架、15章数据与数据自检页`

### Task 2–6: 数据内容——events.js + choices.js（按章分批）

> 五个同构任务：Task2=第1–3章，Task3=第4–6章，Task4=第7–9章，Task5=第10–12章，Task6=第13–15章。**严格按骨架表撰写**，每条 summary 150–300 字、significance 80–150 字、extra 50–120 字、choice 各字段达到规定字数；文风：正文客观庄重，抉择 scene 用第二人称沉浸描写。event.image 本阶段一律先填 `null`（Task 15 补图后回填），panorama 按 `assets/images/panorama/<choiceId>.jpg` 预填。

**Files:**
- Create/Modify: `data/events.js`、`data/choices.js`（首个任务创建并写 `window.SHY_DATA.events = [` 数组，后续任务追加本批元素）

**Interfaces:**
- Produces: 骨架表中对应章节的全部 events/choices 记录，字段名严格按"数据接口总览"。

每个任务的步骤（以 Task 2 为例，其余同构）：
- [ ] **Step 1:** 按骨架表写第 1–3 章全部 19 个事件 + 6 个抉择（c01–c06）的完整内容。
- [ ] **Step 2:** 打开 validate.html，确认本批事件/抉择的全部检查通过（其余章节缺失的失败项数量相应减少）。
- [ ] **Step 3:** 逐条自读一遍日期与史实陈述，与骨架表核对。
- [ ] **Step 4: Commit** `data: 第1–3章历史节点与抉择内容`（各任务改相应章节号）

### Task 7: persons.js 人物图谱数据

**Files:**
- Create: `data/persons.js`

**Interfaces:**
- Produces: `window.SHY_DATA.persons`（≥55 人，字段见总览，image 先填 null）与 `window.SHY_DATA.relations`（≥60 条边）。

- [ ] **Step 1:** 按人物名册写全部人物（bio 150–300 字，客观陈述，功过分明）。
- [ ] **Step 2:** 写关系边 ≥60 条，五类关系均有覆盖，每条带 note。
- [ ] **Step 3:** validate.html：人物/关系/事件引用检查全绿。
- [ ] **Step 4: Commit** `data: 55位历史人物小传与关系图谱`

### Task 8: 史实复核（fact-check pass）

**Files:**
- Modify: `data/*.js`（仅修错）；Create: `docs/superpowers/specs/fact-check-log.md`

- [ ] **Step 1:** 由独立视角（新subagent或新会话）逐章交叉核对：所有日期、人名、地名、条约条款、因果表述、引语出处；对照通行教科书口径。
- [ ] **Step 2:** 每处修改记入 `fact-check-log.md`（原文→改后→依据）。
- [ ] **Step 3:** validate.html 全绿。
- [ ] **Step 4: Commit** `data: 史实复核修订`

### Task 9: score.js 计分纯函数

**Files:**
- Create: `js/score.js`；Test: validate.html 已内置断言（Task 1 Step 1）

**Interfaces:**
- Produces: `window.SHY_SCORE = { BASE_CORRECT:100, LEARN:20, EXTRA:10, comboMultiplier(combo), scoreForAnswer(firstTryCorrect, combo), chapterGrade(earned, possible), titleForTotal(total), newState(), saveState(state), loadState() }`
- `newState()` 返回 `{ unlockedCount:1, total:0, combo:0, answered:{}, readExtra:{}, litPersons:[], chapterEarned:{}, finished:false }`；`saveState/loadState` 用键 `shanhe_save_v1`。

- [ ] **Step 1:** 打开 validate.html 确认计分断言当前为失败（score.js 未加载）。
- [ ] **Step 2:** 实现上述纯函数：`comboMultiplier`: 0–1→1.0, 2→1.1, 3→1.2, ≥4→1.3；`scoreForAnswer(t,c)` = t ? round(100×倍率) : 0；`chapterGrade`: 率≥0.85"甲"、≥0.60"乙"、否则"丙"；`titleForTotal`: <1200"初识风云"、<2400"洞察者"、<3600"史家"、≥3600"民族脊梁"。
- [ ] **Step 3:** validate.html 计分断言全绿。
- [ ] **Step 4: Commit** `feat: 计分系统纯函数与存档`

### Task 10: 画卷主界面（css/main.css + js/scroll.js + js/app.js）

**Files:**
- Create: `css/main.css`、`js/scroll.js`、`js/app.js`；Modify: `index.html`

**Interfaces:**
- Consumes: `SHY_DATA.*`、`SHY_SCORE.*`
- Produces: `window.SHY_APP = { showView(name), refreshHud(), state }`（name ∈ scroll|choice|graph|ending|about）；`window.SHY_SCROLL = { render(), openEvent(eventId), advance() }`；自定义事件 `document.dispatchEvent(new CustomEvent("shy:enter-choice", {detail:{choiceId}}))` 由 scroll 发出、choice.js 监听；`"shy:choice-done"` 反向。

- [ ] **Step 1:** main.css：宣纸底纹（CSS 渐变+noise 用 SVG feTurbulence data URI）、水墨配色 CSS 变量（每章 theme 注入 `--c-primary/--c-bg/--c-accent`）、竖排章题（writing-mode: vertical-rl）、朱砂印章样式、节点珠串三态（灰暗/鎏金脉动/朱红）。
- [ ] **Step 2:** scroll.js：横向长卷 DOM 渲染（章节段落+时间轴+节点珠串），点击已解锁节点开图文卡片（summary/significance/extra"史海钩沉"点击展开得 EXTRA 分/人物头像行），卡片"继续"按钮 → `advance()` 解锁下一节点并平滑滚动；节点为抉择点时派发 `shy:enter-choice`；开国大典节点（e1401）加特殊金红排版类 `.node-climax`；最后节点完成后派发 `shy:enter-ending`。
- [ ] **Step 3:** app.js：视图切换、HUD（总分/称号/章节评级角标）、静音按钮、重新开始（清 localStorage 确认框）、"关于"页（数据口径与图片来源说明）。
- [ ] **Step 4:** 手动验收：file:// 打开，能从 e0101 推进到 e0103，刷新后进度保留。
- [ ] **Step 5: Commit** `feat: 画卷主界面与节点推进`

### Task 11: 沉浸抉择模式（js/choice.js）

**Files:** Create: `js/choice.js`；Modify: `css/main.css`

**Interfaces:**
- Consumes: `shy:enter-choice` 事件、`SHY_SCORE`；Produces: `shy:choice-done`，写 `state.answered[choiceId] = {firstTryCorrect, tries}`。

- [ ] **Step 1:** 全屏 overlay：panorama 背景（object-fit: cover + 缓慢 Ken Burns 动画）、scene 旁白逐段淡入、问题与选项卡片。
- [ ] **Step 2:** 作答逻辑：选对→金色印章"史笔如铁"动效 + `scoreForAnswer(true, combo)` 入账、combo+1；选错→墨晕动效 + 展示该选项 feedback + 正确答案 + historyNote 卷轴，点"我明白了"得 LEARN 分、combo 归零；两种路径都必须展示 historyNote 后才能"继续前行"。图片右下角常驻"AI 生成想象图"角标。
- [ ] **Step 3:** 手动验收 c01 对/错两条路径、得分与连击正确、答过的抉择重进画卷不重复计分。
- [ ] **Step 4: Commit** `feat: 沉浸式抉择模式`

### Task 12: 人物星图（js/graph.js + vendor/d3）

**Files:** Create: `js/graph.js`、`vendor/d3.v7.min.js`（`curl -L https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js -o vendor/d3.v7.min.js`，提交入库）

**Interfaces:**
- Consumes: `SHY_DATA.persons/relations`、`state.litPersons`；Produces: `window.SHY_GRAPH = { render() }`。事件卡人物头像点击 → `SHY_APP.showView("graph")` 并高亮该人物。

- [ ] **Step 1:** d3 力导向：节点=人物（已点亮者彩色+可点，未点亮灰暗剪影）；边按五类关系着色（师承金/同盟青/对立赭/亲属紫/影响灰蓝）+图例；点选人物侧栏显示小传、生卒、关系列表。人物随剧情推进点亮：事件卡出现过的 personIds 加入 litPersons。
- [ ] **Step 2:** 手动验收：推进两章后星图点亮人数正确、拖拽缩放流畅、file:// 下 d3 正常加载。
- [ ] **Step 3: Commit** `feat: 人物知识星图`

### Task 13: 音效（js/audio.js）

**Files:** Create: `js/audio.js`；Modify: `js/app.js`（静音开关接入）

**Interfaces:**
- Produces: `window.SHY_AUDIO = { init(), play(name), setMuted(b), muted }`，name ∈ `page|unlock|correct|wrong|ending`；设置存 `shanhe_settings_v1`。

- [ ] **Step 1:** Web Audio 合成：`page` 短噪声沙沙、`unlock` 五声音阶单音清音、`correct` 编钟双音（宫+徵）、`wrong` 低频沉鼓、`ending` 庄重和弦琶音；首次用户点击时 `init()` 解锁 AudioContext。
- [ ] **Step 2:** 手动验收各音效与静音持久化。
- [ ] **Step 3: Commit** `feat: WebAudio合成音效`

### Task 14: 终章卷轴（js/ending.js）

**Files:** Create: `js/ending.js`；Modify: `css/main.css`

**Interfaces:**
- Consumes: `shy:enter-ending`、`state`；Produces: 终章视图渲染。

- [ ] **Step 1:** 红色主题竖向卷轴：① 总分/称号/各章评级总览；② 玩家走过的 26 个抉择回顾（对错标记+一句史实）；③ 致敬段落——从虎门销烟到开国大典再到改革开放，"无数先辈的牺牲与正确抉择，才换来新中国与今日中国"，配五星红旗色调渐变与庄重排版；④ "重走长卷"按钮。
- [ ] **Step 2:** 手动验收：完成 e1506 后自动进入终章，数据统计正确。
- [ ] **Step 3: Commit** `feat: 终章卷轴`

### Task 15: 历史照片收集（人物/事件配图）

**Files:** Create: `assets/images/persons/*.jpg`、`assets/images/events/*.jpg`、`assets/images/CREDITS.md`；Modify: `data/persons.js`、`data/events.js`（回填 image 路径）

- [ ] **Step 1:** 用 Wikimedia Commons API 逐人检索公有领域照片/画像（`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<人名>&prop=imageinfo&iiprop=url|extmetadata&format=json`），确认许可为 PD/CC 后 `curl` 下载，统一压缩到宽 ≤600px（`sips -Z 600`）。
- [ ] **Step 2:** 事件配图同法（如虎门销烟画、南京条约签约图、开国大典照片等，优先 1949 年前公有领域影像）。
- [ ] **Step 3:** 找不到合适照片的人物/事件：用 gpt-image-bridge 生成肖像/场景，imageCredit 标"AI 生成想象图"。
- [ ] **Step 4:** 全部来源写入 CREDITS.md（文件名/来源URL/许可/作者）；回填 data 中 image 字段；validate.html 全绿；file:// 打开抽查图片显示。
- [ ] **Step 5: Commit** `feat: 人物与事件历史图片素材`

### Task 16: 全景图生成（26 张）

**Files:** Create: `assets/images/panorama/c01.jpg … c26.jpg`

- [ ] **Step 1:** 统一提示词模板：`史诗历史场景全景，<场景描述：时间/地点/氛围/关键元素>，写实历史油画风格融合中国水墨意蕴，电影级光效，宽画幅，无任何文字水印`；每个抉择点按其 scene 写场景描述。
- [ ] **Step 2:** 用 gpt-image-bridge 逐张生成（16:9 横幅），文件名与 choices.js 的 panorama 路径一致。
- [ ] **Step 3:** 逐张目检：无文字乱码、无史实硬伤（如清代场景出现现代物件）、氛围契合；不合格重生成。
- [ ] **Step 4: Commit** `feat: 26张抉择点沉浸全景图`

### Task 17: 集成验收

- [ ] **Step 1:** validate.html 全绿（0 失败）。
- [ ] **Step 2:** file:// 双击 index.html 全流程走查清单：15 章推进到底、至少各答一次对/错、静音切换、刷新续档、重新开始、人物星图点亮、开国大典特殊节点、终章统计、手机宽度（响应式基础检查，DevTools 375px）。
- [ ] **Step 3:** 发现问题修复并逐项复验。
- [ ] **Step 4: Commit** `fix: 集成验收修复`；打 tag `v1.0`。

---

## Self-Review 记录

1. **Spec 覆盖**：15章✓、≥70节点（93）✓、≥25抉择（26）✓、≥40人物（~80）✓、混合图片策略（Task 15/16）✓、纯静态 file://（全局约束+Task 10 验收）✓、计分/评级/称号（Task 9，阈值与 spec §6 一致）✓、音效（Task 13）✓、终章红色主题（Task 14）✓、史实复核（Task 8）✓、CREDITS 与 AI 图标注（Task 15/11）✓、validate 校验（Task 1）✓、YAGNI 清单未引入被排除项✓。
2. **占位符扫描**：内容任务以骨架表为唯一依据（表已含全部节点日期/标题/抉择设计与正确答案），无 TBD。
3. **类型一致性**：`SHY_DATA`/`SHY_SCORE`/`SHY_APP`/`SHY_SCROLL`/`SHY_GRAPH`/`SHY_AUDIO` 与两个自定义事件名在各任务 Interfaces 中口径一致；validate.html 断言的阈值与 Task 9 实现一致（85/60、1200/2400/3600、20/10、连击表）。
