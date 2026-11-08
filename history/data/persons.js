// data/persons.js
// 《山河岁月》人物知识图谱数据：81 位事件中实际出现的历史人物 + 蔡元培（角色名册完整性补录）。
// 字段说明见 .superpowers/sdd/shared-interfaces.md「数据结构」章节。
// 史实口径：以中学/大学通行中国近代史叙述为准，敏感/争议人物采用教科书艰辛探索与曲折口径，庄重客观，功过分明。
window.SHY_DATA = window.SHY_DATA || {};
window.SHY_DATA.persons = [
  {
    id: "p_linzexu", name: "林则徐", courtesy: "字元抚，一字少穆",
    birth: 1785, death: 1850, role: "清末政治家，民族英雄，虎门销烟主持者",
    bio: "林则徐，福建侯官人，历任湖广总督、两广总督。1839年奉旨赴广东查禁鸦片，虎门销烟震动中外，展现中国维护主权的坚定意志。鸦片战争爆发后因主张严禁强硬御敌，被清廷诿过革职，遣戍新疆伊犁。晚年仍受命办理陕甘、云贵军务，病逝于赴任途中。他主张开眼看世界，组织编译《四洲志》等西方资料，为近代中国睁眼看世界第一人，后人尊为民族英雄。",
    image: "assets/images/persons/linzexu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch01"]
  },
  {
    id: "p_daoguangdi", name: "道光帝", courtesy: null,
    birth: 1782, death: 1850, role: "清朝第八位皇帝，鸦片战争时期最高统治者",
    bio: "道光帝爱新觉罗·旻宁，清宣宗，1820年至1850年在位。执政期间朝纲废弛，财政拮据，鸦片走私泛滥。他先后起用林则徐禁烟，又在战事失利后转向妥协，罢免主战大臣，签订中国近代第一个不平等条约《南京条约》，割让香港岛、开放五口通商。道光一朝标志着清王朝由盛转衰、被迫卷入近代世界体系的开端，其治国因循守旧，未能扭转国势颓势。",
    image: "assets/images/persons/daoguangdi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch01"]
  },
  {
    id: "p_guantianpei", name: "关天培", courtesy: "字仲因，号滋圃",
    birth: 1781, death: 1841, role: "清末爱国将领，广东水师提督",
    bio: "关天培，江苏山阳人，行伍出身，历任参将、总兵等职，治军严整，深得士卒爱戴，官至广东水师提督。协助林则徐筹办海防，加强虎门炮台防御，参与虎门销烟的军事保障。1841年英军进攻虎门，他率部死守靖远炮台，弹尽援绝仍坚持奋战，终于阵地力战殉国，年六十岁。其英勇殉国事迹广为传颂，是鸦片战争中民族气节的代表人物之一，后被追赠振威将军，谥忠节。",
    image: "assets/images/persons/guantianpei.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch01"]
  },
  {
    id: "p_qishan", name: "琦善", courtesy: "字静庵",
    birth: 1786, death: 1854, role: "清末大臣，主抚派代表人物",
    bio: "琦善，满洲正黄旗人，历任直隶总督等要职。鸦片战争爆发后接替林则徐为钦差大臣、两广总督，主张对英妥协求和，撤防求款，擅自与英方议定割让香港等条件，事后被清廷以擅许香港、办理不善之罪革职查办、抄没家产。琦善代表了清廷统治集团中畏敌求和的一派，其举措加速了战争失利，历来为史家所诟病，也反映了清廷内部战和摇摆不定的困境。",
    image: "assets/images/persons/qishan.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch01"]
  },
  {
    id: "p_weiyuan", name: "魏源", courtesy: "字默深",
    birth: 1794, death: 1857, role: "清末思想家，《海国图志》作者",
    bio: "魏源，湖南邵阳人，晚清今文经学家、思想家，曾任江苏东台、兴化等地知县，关心民生疾苦。受林则徐嘱托整理翻译资料，编成《海国图志》一书，系统介绍世界各国历史地理与政治制度，首倡师夷长技以制夷的主张，呼吁学习西方先进技术以自强御侮。这一思想开近代中国向西方学习之先河，深刻影响了此后的洋务运动，是近代中国思想启蒙的重要先驱人物，晚年潜心佛学，病逝于杭州。",
    image: "assets/images/persons/weiyuan.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch01"]
  },
  {
    id: "p_xianfengdi", name: "咸丰帝", courtesy: null,
    birth: 1831, death: 1861, role: "清朝第九位皇帝",
    bio: "咸丰帝爱新觉罗·奕詝，1850年至1861年在位。在位期间内忧外患交织，太平天国运动席卷南方，第二次鸦片战争爆发，英法联军攻入北京、火烧圆明园，咸丰帝仓皇出逃热河避暑山庄。他任用曾国藩等汉族官员编练湘军镇压太平天国，客观上开启了地方督抚崛起的局面。1861年病逝于承德避暑山庄，临终遗命肃顺等八大臣辅政，此后引发辛酉政变。",
    image: "assets/images/persons/xianfengdi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch01"]
  },
  {
    id: "p_yixin", name: "奕䜣", courtesy: null,
    birth: 1833, death: 1898, role: "恭亲王，洋务派代表，总理衙门首任领班大臣",
    bio: "爱新觉罗·奕䜣，道光帝六子，咸丰帝异母弟，封恭亲王，自幼聪颖，深得道光帝喜爱。第二次鸦片战争后留守北京与英法议和，1861年联合慈禧太后发动辛酉政变，铲除顾命八大臣，此后主持中枢政务近三十年。他倡设总理各国事务衙门，支持兴办新式学堂、创建近代海军，是洋务运动在中央的主要推动者，人称鬼子六。因屡遭慈禧太后猜忌排挤，几度被罢黜又复起，晚年郁郁而终。",
    image: "assets/images/persons/yixin.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch01", "ch03"]
  },
  {
    id: "p_hongxiuquan", name: "洪秀全", courtesy: "原名仁坤",
    birth: 1814, death: 1864, role: "太平天国天王，运动创立者与最高领袖",
    bio: "洪秀全，广东花县人，屡试不第后创立拜上帝会，糅合基督教教义与传统思想，于1851年在广西金田村发动起义，建号太平天国，自称天王。太平军一度攻占南京，改称天京，建立政权，颁行《天朝田亩制度》，试图推行绝对平均的土地纲领。后期因天京事变自相残杀、用人失当，加之清军与外国势力联合镇压，太平天国由盛转衰。1864年天京城破前夕，洪秀全病逝城中，运动随后失败。",
    image: "assets/images/persons/hongxiuquan.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch02"]
  },
  {
    id: "p_yangxiuqing", name: "杨秀清", courtesy: null,
    birth: 1823, death: 1856, role: "太平天国东王，早期核心领导人",
    bio: "杨秀清，广西桂平人，出身贫寒，早年以烧炭为生，后参与拜上帝会，以天父下凡代言人身份在太平天国政权中掌握实权，封东王，节制诸王。他军事谋略出众，指挥太平军攻克南京并建立天京政权，是太平天国前期发展壮大的关键人物。后期因权力膨胀、逼封万岁，引发洪秀全猜忌，1856年天京事变中被韦昌辉部所杀，太平天国自此元气大伤，由盛转衰，此后再未恢复元气。",
    image: null, imageCredit: null, chapterIds: ["ch02"]
  },
  {
    id: "p_shidakai", name: "石达开", courtesy: null,
    birth: 1831, death: 1863, role: "太平天国翼王，著名军事将领",
    bio: "石达开，广西贵县人，太平天国封王中最年轻的一位，封翼王，素有军事才能，屡立战功，深得军民拥戴。天京事变后因遭猜忌排挤，1857年率部出走，转战江西、浙江、福建、四川等地，孤军奋战数年。1863年在四川大渡河紫打地陷入清军重围，粮尽援绝，为保全部众性命自赴清营投降，旋即在成都被凌迟处死，年仅三十二岁。",
    image: null, imageCredit: null, chapterIds: ["ch02"]
  },
  {
    id: "p_hongrengan", name: "洪仁玕", courtesy: null,
    birth: 1822, death: 1864, role: "太平天国干王，后期主要政治设计者",
    bio: "洪仁玕，广东花县人，洪秀全族弟。早年赴香港接触西方文明，1859年辗转抵达天京，被封为干王，总理朝政。他著《资政新篇》，系统提出仿行西方政治经济制度、发展近代工商业、修铁路办邮政等主张，是太平天国后期难得的具有近代化眼光的纲领性文件，但因战乱环境未能真正推行。天京陷落后被清军俘获，1864年就义于南昌。",
    image: null, imageCredit: null, chapterIds: ["ch02"]
  },
  {
    id: "p_zengguofan", name: "曾国藩", courtesy: "字伯涵，号涤生",
    birth: 1811, death: 1872, role: "晚清重臣，湘军创建者，洋务运动发起人之一",
    bio: "曾国藩，湖南湘乡人，晚清理学名臣。太平天国兴起后，奉命在湖南编练地方团练，建成湘军，历经艰苦鏖战，最终于1864年攻陷天京，镇压太平天国。他倡导师夷长技，创办安庆内军械所等近代军事工业，会同李鸿章选派幼童赴美留学，是洋务运动的重要发起者，官至两江总督、直隶总督，封一等毅勇侯。因处理天津教案受到舆论指责，晚年声名受损，1872年病逝于南京任上。",
    image: "assets/images/persons/zengguofan.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch02", "ch03"]
  },
  {
    id: "p_lihongzhang", name: "李鸿章", courtesy: "字渐甫，号少荃",
    birth: 1823, death: 1901, role: "晚清重臣，淮军与北洋水师创建者，洋务运动核心人物",
    bio: "李鸿章，安徽合肥人，曾国藩弟子，创建淮军，协助镇压太平天国与捻军。历任直隶总督兼北洋大臣二十余年，主持创办江南制造总局、轮船招商局、北洋水师等一系列近代军事与民用企业，是洋务运动的核心推动者。甲午战争中北洋水师覆没，他代表清廷签订《马关条约》，后又签订《辛丑条约》，因屡任丧权辱国条约的签字人饱受争议。其一生功过交织，既是近代化事业的实干者，也是弱国外交的承受者，1901年病逝于北京。",
    image: "assets/images/persons/lihongzhang.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch02", "ch03", "ch04", "ch06"]
  },
  {
    id: "p_zuozongtang", name: "左宗棠", courtesy: "字季高",
    birth: 1812, death: 1885, role: "晚清重臣，收复新疆的军事统帅，洋务派代表",
    bio: "左宗棠，湖南湘阴人，早年屡试不第，长期担任地方幕僚，后受曾国藩举荐领兵，参与镇压太平天国、捻军，历任浙江巡抚、闽浙总督、陕甘总督等职。1875年受命督办新疆军务，力排众议主张塞防与海防并重，率军西征，历时数年收复新疆大部领土，为维护国家统一立下卓著功勋，后奏请设立新疆行省。他还创办福州船政局，是洋务运动的重要人物之一。1885年中法战争期间病逝于福州任上。",
    image: "assets/images/persons/zuozongtang.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch02", "ch03"]
  },
  {
    id: "p_zhangzhidong", name: "张之洞", courtesy: "字孝达，号香涛",
    birth: 1837, death: 1909, role: "晚清重臣，湖广总督，洋务运动后期代表人物",
    bio: "张之洞，直隶南皮人，同治年间探花及第，历任两广总督、湖广总督等职，是洋务运动后期最具影响力的封疆大吏之一。他在湖北创办汉阳铁厂、湖北织布局等近代工业，兴办新式学堂、编练自强军，提出中学为体、西学为用的主张，力图在维护纲常名教的前提下引进西方技术，其教育与实业举措深刻影响了近代中国的现代化进程。晚年调任军机大臣，参与清末新政的筹划，1909年病逝于北京。",
    image: "assets/images/persons/zhangzhidong.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch03"]
  },
  {
    id: "p_cixi", name: "慈禧太后", courtesy: null,
    birth: 1835, death: 1908, role: "晚清实际最高统治者，两度垂帘听政",
    bio: "慈禧太后，叶赫那拉氏，咸丰帝妃，同治帝生母。1861年联合恭亲王奕䜣发动辛酉政变，此后长期垂帘听政或训政，实际掌控清廷最高权力近半个世纪。她起用洋务派兴办近代实业，但在戊戌变法中发动政变，囚禁光绪帝，处死维新志士，变法夭折；又因纵容义和团排外招致八国联军侵华，被迫签订《辛丑条约》。晚年推行清末新政、预备立宪，试图挽救统治危机，终未能扭转清朝覆亡之势，1908年病逝。",
    image: "assets/images/persons/cixi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch03", "ch05", "ch06"]
  },
  {
    id: "p_ronghong", name: "容闳", courtesy: "字达萌，号纯甫",
    birth: 1828, death: 1912, role: "中国留学生先驱，留美幼童计划倡导者",
    bio: "容闳，广东香山人，1854年毕业于美国耶鲁大学，是近代中国第一位留学欧美并获得学位的学生。他毕生致力于推动中国教育近代化，多方奔走促成清廷派遣幼童赴美留学的计划，1872年至1875年间共组织四批共一百二十名幼童赴美，开中国官派留学之先河，詹天佑即为其中一员。晚年支持维新与革命活动，长期旅居美国，1912年病逝于美国康涅狄格州。",
    image: "assets/images/persons/ronghong.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch03"]
  },
  {
    id: "p_zhantianyou", name: "詹天佑", courtesy: "字眷诚",
    birth: 1861, death: 1919, role: "中国铁路工程先驱，京张铁路总工程师",
    bio: "詹天佑，广东南海人，幼年作为首批留美幼童赴美求学，毕业于耶鲁大学土木工程系。归国后投身铁路事业，主持修建京张铁路，创造性设计人字形线路解决陡坡难题，全部由中国工程技术人员自主完成，打破了外国人认为中国人不能自建铁路的偏见，铁路于1909年提前通车。他被誉为中国铁路之父，此后又主持多条铁路的勘测建设，1919年病逝。",
    image: "assets/images/persons/zhantianyou.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch03"]
  },
  {
    id: "p_dingruchang", name: "丁汝昌", courtesy: "字禹廷",
    birth: 1836, death: 1895, role: "北洋水师提督",
    bio: "丁汝昌，安徽庐江人，早年参加淮军，后调任北洋水师提督，统领北洋海军。1894年甲午战争爆发，他率舰队在黄海海战中与日本联合舰队激战，损失惨重。此后奉李鸿章避战保船之命退守威海卫军港，1895年初日军水陆合围，北洋水师弹尽援绝，丁汝昌拒绝投降，服毒自尽，以身殉国，北洋水师全军覆没。其气节为后世所敬重。",
    image: "assets/images/persons/dingruchang.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch03", "ch04"]
  },
  {
    id: "p_dengshichang", name: "邓世昌", courtesy: "字正卿",
    birth: 1849, death: 1894, role: "北洋水师致远舰管带，甲午海战殉国英雄",
    bio: "邓世昌，广东番禺人，福州船政学堂毕业，历任多艘军舰管带，治军严明，后统领北洋水师致远舰。1894年黄海海战中，致远舰弹药将尽、舰身受创，他下令开足马力冲向日舰吉野号，欲与敌舰同归于尽，不幸中鱼雷沉没，邓世昌与全舰官兵二百余人壮烈殉国。其誓死不退的英勇气概，成为甲午战争中民族精神的象征，光绪帝闻讯痛悼，追赠其为壮节公，赐建专祠。",
    image: "assets/images/persons/dengshichang.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch03", "ch04"]
  },
  {
    id: "p_guangxudi", name: "光绪帝", courtesy: null,
    birth: 1871, death: 1908, role: "清朝第十一位皇帝，戊戌变法推行者",
    bio: "光绪帝爱新觉罗·载湉，醇亲王奕譞之子，四岁入承大统，由慈禧太后垂帘听政、训政多年。甲午战败刺激下，他支持康有为、梁启超等人推行变法，颁布诏书推行新政，史称戊戌变法或百日维新。变法触动守旧势力利益，1898年慈禧太后发动政变，光绪帝被幽禁于中南海瀛台，变法失败。此后形同傀儡，1908年病逝，死因至今存有争议。",
    image: "assets/images/persons/guangxudi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch04", "ch05", "ch06"]
  },
  {
    id: "p_kangyouwei", name: "康有为", courtesy: "字广厦，号长素",
    birth: 1858, death: 1927, role: "戊戌变法领袖，维新思想家",
    bio: "康有为，广东南海人，近代著名思想家、维新派领袖。他创办万木草堂讲学授徒，撰写《新学伪经考》《孔子改制考》为变法提供理论依据，1895年发起公车上书，此后多次上书光绪帝，力主变法图强，推动百日维新的展开。变法失败后流亡海外，长期组织保皇会，反对革命，政治立场趋于保守，晚年一度支持张勋复辟，1927年病逝于青岛。",
    image: "assets/images/persons/kangyouwei.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch04", "ch05"]
  },
  {
    id: "p_liangqichao", name: "梁启超", courtesy: "字卓如，号任公",
    birth: 1873, death: 1929, role: "维新思想家、政论家，近代学术大家",
    bio: "梁启超，广东新会人，师从康有为，戊戌变法核心人物之一。变法失败后流亡日本，创办《新民丛报》，以犀利文笔宣传新思想，深刻影响一代青年的思想启蒙。他曾支持袁世凯，后又策动蔡锷发起护国运动反对帝制复辟。晚年潜心学术，在历史学、文学等领域著述丰富，是近代中国从传统士大夫向现代知识分子转型的代表人物，1929年病逝于北京。",
    image: "assets/images/persons/liangqichao.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch04", "ch05", "ch06", "ch08"]
  },
  {
    id: "p_tansitong", name: "谭嗣同", courtesy: "字复生，号壮飞",
    birth: 1865, death: 1898, role: "戊戌变法核心人物，戊戌六君子之一",
    bio: "谭嗣同，湖南浏阳人，维新派激进代表，著有《仁学》一书，猛烈抨击封建纲常礼教。戊戌变法期间积极参与新政筹划，政变发生后拒绝出走，慷慨表示各国变法无不从流血而成，今日中国未闻有因变法而流血者，请自嗣同始，1898年9月28日与其他五位志士在北京菜市口就义，史称戊戌六君子，其舍身取义的精神激励了后世无数仁人志士。",
    image: "assets/images/persons/tansitong.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch05"]
  },
  {
    id: "p_yanfu", name: "严复", courtesy: "字又陵，一字几道",
    birth: 1854, death: 1921, role: "近代启蒙思想家、翻译家",
    bio: "严复，福建侯官人，早年留学英国学习海军，归国后投身译介西方学术，先后翻译赫胥黎《天演论》、亚当·斯密《原富》等著作，系统引入物竞天择、适者生存等进化论思想，深刻震撼了当时的知识界，成为维新变法与救亡图存思潮的重要理论武器。他还主持京师大学堂译书局等，是近代中国系统介绍西方思想文化的第一人，1921年病逝。",
    image: "assets/images/persons/yanfu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch05"]
  },
  {
    id: "p_yuanshikai", name: "袁世凯", courtesy: "字慰亭，号容庵",
    birth: 1859, death: 1916, role: "北洋军阀领袖，中华民国首任大总统",
    bio: "袁世凯，河南项城人，早年编练新建陆军，奠定北洋军阀基础。戊戌变法期间向荣禄告密，致使变法失败，光绪帝被囚。辛亥革命爆发后，他凭借军事实力两面周旋，逼迫清帝退位，又迫使孙中山让出临时大总统之位，就任中华民国大总统。此后镇压二次革命，刺杀宋教仁，进一步集权专制，1915年悍然复辟帝制，改元洪宪，激起全国声讨与护国战争，被迫取消帝制，1916年在举国唾骂声中忧愤而死。",
    image: "assets/images/persons/yuanshikai.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch05", "ch06", "ch07", "ch08"]
  },
  {
    id: "p_songjiaoren", name: "宋教仁", courtesy: "字遁初，号渔父",
    birth: 1882, death: 1913, role: "民初政党政治倡导者，国民党代理理事长",
    bio: "宋教仁，湖南桃源人，早年参加华兴会、同盟会，是辛亥革命的重要筹划者之一。民国建立后致力于推行议会政党政治，将同盟会改组为国民党并出任代理理事长，在1912年底至1913年初的国会选举中国民党获得压倒性胜利，宋教仁本有望出任内阁总理。1913年3月他在上海火车站遇刺身亡，年仅三十岁，此案被广泛认为与袁世凯有关，成为二次革命爆发的导火索。",
    image: "assets/images/persons/songjiaoren.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch06", "ch08"]
  },
  {
    id: "p_huangxing", name: "黄兴", courtesy: "字克强",
    birth: 1874, death: 1916, role: "辛亥革命主要领导人，同盟会创建者之一",
    bio: "黄兴，湖南长沙人，早年留学日本，回国后组织华兴会，1905年与孙中山等共同创立中国同盟会，任执行部庶务，实际主持会务。他多次亲自策划、参与广州黄花岗起义等武装起义，屡败屡战。武昌起义后赶赴前线任战时总司令，与清军激战于汉口、汉阳。民国建立后与孙中山共同致力于反袁斗争，是革命党内仅次于孙中山的核心领袖，1916年病逝于上海。",
    image: "assets/images/persons/huangxing.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch06", "ch07"]
  },
  {
    id: "p_sunzhongshan", name: "孙中山", courtesy: "名文，字德明，号逸仙",
    birth: 1866, death: 1925, role: "中国民主革命先行者，中华民国临时大总统",
    bio: "孙中山，广东香山人，早年立志推翻清朝统治，创立兴中会、同盟会，提出驱除鞑虏、恢复中华、创立民国、平均地权纲领与三民主义学说。1911年武昌起义成功后被推举为中华民国临时大总统，后为实现共和让位于袁世凯。此后长期领导护国、护法运动，晚年改组国民党，确立联俄、联共、扶助农工三大政策，创办黄埔军校，筹备北伐。1925年因病在北京逝世，被尊为国父，是中国民主革命的伟大先行者。",
    image: "assets/images/persons/sunzhongshan.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch06", "ch07", "ch08", "ch10"]
  },
  {
    id: "p_linjuemin", name: "林觉民", courtesy: "字意洞，号抖飞",
    birth: 1887, death: 1911, role: "黄花岗七十二烈士之一",
    bio: "林觉民，福建闽侯人，早年留学日本，加入中国同盟会。1911年春参加广州黄花岗起义，起义前夜写下感人至深的《与妻书》，倾诉对妻子的深情与对革命的坚定信念，表示吾牺牲百死而不辞。起义中他率敢死队攻打两广总督衙门，激战中受伤被俘，慷慨陈词、宁死不屈，就义时年仅二十四岁，是黄花岗七十二烈士中最广为人知的一位，其绝笔家书至今传诵不衰。",
    image: "assets/images/persons/linjuemin.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch07"]
  },
  {
    id: "p_liyuanhong", name: "黎元洪", courtesy: "字宋卿",
    birth: 1864, death: 1928, role: "武昌起义后被推为都督，两任民国大总统",
    bio: "黎元洪，湖北黄陂人，原为清军新军将领。1911年武昌起义爆发，革命党人仓促间推举其出任湖北军政府都督，此后成为南方革命阵营重要旗帜性人物。民国成立后历任副总统，1916年袁世凯死后继任大总统，1917年因府院之争被张勋利用，导致张勋复辟事件，复辟失败后被迫下野。此后一度短暂复任大总统，晚年退出政坛经营实业，1928年病逝于天津。",
    image: "assets/images/persons/liyuanhong.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch07"]
  },
  {
    id: "p_longyu", name: "隆裕太后", courtesy: null,
    birth: 1868, death: 1913, role: "光绪帝皇后，清朝末代太后，颁布清帝退位诏书",
    bio: "隆裕太后，叶赫那拉氏静芬，慈禧太后弟弟之女，经指婚成为光绪帝皇后。光绪帝、慈禧太后相继去世后，宣统朝初由监国摄政王载沣主政，她以皇太后身份抚养溥仪，至1911年12月载沣辞位后方实际主政。武昌起义后南北议和，她在袁世凯等人的斡旋和压力下，最终于1912年2月代表清廷颁布退位诏书，宣告清朝二百六十余年统治与两千余年帝制正式终结。此举避免了更大规模的流血冲突，1913年因病郁郁而终。",
    image: "assets/images/persons/longyu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch07"]
  },
  {
    id: "p_caie", name: "蔡锷", courtesy: "字松坡",
    birth: 1882, death: 1916, role: "护国战争发起者，云南都督",
    bio: "蔡锷，湖南邵阳人，早年就读长沙时务学堂，师从梁启超，后留学日本学习军事。辛亥革命时在云南发动新军起义响应，任云南都督。袁世凯复辟帝制后，他潜离北京辗转返回云南，于1915年底联合唐继尧等通电全国，宣布云南独立，组织护国军讨伐袁世凯，护国战争由此爆发，各省纷纷响应，迫使袁世凯取消帝制。因积劳成疾，1916年病逝于日本，年仅三十四岁。",
    image: "assets/images/persons/caie.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch08"]
  },
  {
    id: "p_chenduxiu", name: "陈独秀", courtesy: "字仲甫",
    birth: 1879, death: 1942, role: "新文化运动主要发起人，中国共产党主要创始人",
    bio: "陈独秀，安徽怀宁人，1915年创办《青年杂志》（后改名《新青年》），高举民主与科学旗帜，掀起新文化运动，猛烈抨击封建旧礼教。五四运动前后接受马克思主义，与李大钊等筹备建党，1921年中共一大当选为中央局书记，成为中国共产党早期主要领导人。大革命后期因右倾错误被撤销领导职务，此后又转向托派立场，被开除党籍。1942年病逝于四川江津，一生思想经历数次转折，功过并存。",
    image: "assets/images/persons/chenduxiu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch08", "ch09"]
  },
  {
    id: "p_hushi", name: "胡适", courtesy: "字适之",
    birth: 1891, death: 1962, role: "新文化运动代表人物，学者、教育家",
    bio: "胡适，安徽绩溪人，早年留学美国师从杜威，归国后任北京大学教授。他在《新青年》发表《文学改良刍议》，倡导以白话文取代文言文，是新文化运动文学革命的旗手之一，此后长期从事学术研究与教育事业，在哲学、文学、历史考证等领域著述颇丰。政治上主张自由主义，反对激进革命。1949年后长居美国、台湾，曾任台湾中央研究院院长，1962年在台北病逝。",
    image: "assets/images/persons/hushi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch08"]
  },
  {
    id: "p_luxun", name: "鲁迅", courtesy: "原名周树人，字豫才",
    birth: 1881, death: 1936, role: "新文化运动旗手，现代文学奠基人",
    bio: "鲁迅，原名周树人，浙江绍兴人，早年赴日本学医，后弃医从文，立志以文艺改造国民精神。1918年发表中国现代文学史上第一篇白话小说《狂人日记》，此后创作《阿Q正传》《呐喊》《彷徨》等大量作品，以犀利笔锋深刻剖析国民劣根性，抨击封建礼教吃人的本质，是新文化运动的旗帜性人物，被誉为民族魂。晚年积极参与左翼文化运动，1936年病逝于上海。",
    image: "assets/images/persons/luxun.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch08"]
  },
  {
    id: "p_zhangxun", name: "张勋", courtesy: "字少轩",
    birth: 1854, death: 1923, role: "清末军阀，复辟闹剧发动者",
    bio: "张勋，江西奉新人，行伍出身，效忠清室，所部官兵始终保留发辫，人称辫子军。辛亥革命后仍以清室遗臣自居，拒剪发辫。1917年借调停府院之争之机，率辫子军入京，于7月1日拥立逊帝溥仪复辟，恢复清朝年号，史称张勋复辟。复辟仅维持十二天即被段祺瑞讨伐军击败，张勋逃入荷兰使馆避难，复辟闹剧宣告失败，此后隐居天津，1923年病逝。",
    image: "assets/images/persons/zhangxun.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch08"]
  },
  {
    id: "p_caiyuanpei", name: "蔡元培", courtesy: "字鹤卿，号孑民",
    birth: 1868, death: 1940, role: "教育家，北京大学校长",
    bio: "蔡元培，浙江绍兴人，清末进士出身，早年加入同盟会，民国成立后曾任教育总长。1917年出任北京大学校长，提出思想自由、兼容并包的办学方针，延揽陈独秀、李大钊、胡适等新文化运动骨干到校任教，使北大成为新文化运动与五四运动的策源地。他一生致力于教育改革与学术自由，历任大学院院长、中央研究院院长等职，1940年病逝于香港。",
    image: "assets/images/persons/caiyuanpei.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch08"]
  },
  {
    id: "p_dongbiwu", name: "董必武", courtesy: "字洁畲",
    birth: 1886, death: 1975, role: "中国共产党创始人之一，法学家、政治家",
    bio: "董必武，湖北黄安（今红安）人，早年加入同盟会参加辛亥革命，后接受马克思主义，1921年作为湖北代表出席中共一大，是中国共产党最早的党员和创建者之一。此后长期从事党的组织、统战与政法工作，抗战与解放战争时期在国统区从事统一战线工作，新中国成立后历任最高人民法院院长、国家副主席等要职，为新中国法制建设作出重要贡献，1975年在北京逝世。",
    image: "assets/images/persons/dongbiwu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch09"]
  },
  {
    id: "p_guweijun", name: "顾维钧", courtesy: "字少川",
    birth: 1888, death: 1985, role: "民国外交家，巴黎和会中国代表团成员",
    bio: "顾维钧，江苏嘉定人，早年留学美国哥伦比亚大学，学成归国后长期从事外交工作。1919年巴黎和会上，他代表中国据理力争，反对将德国在山东的权益转让给日本，发表著名演说痛陈利害，虽因列强操纵未能挽回结果，但其外交才干与爱国立场为国人所敬重，也直接促成中国代表团拒签和约。此后历任民国政府驻外公使、大使及外交部长等职，是近代中国杰出的职业外交家，1985年在美国逝世。",
    image: "assets/images/persons/guweijun.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch09"]
  },
  {
    id: "p_lida", name: "李达", courtesy: "字永锡",
    birth: 1890, death: 1966, role: "中国共产党创始人之一，马克思主义理论家",
    bio: "李达，湖南零陵人，早年留学日本研习马克思主义理论，回国后积极宣传马克思主义，与陈独秀等筹建上海共产主义小组，1921年出席中共一大并当选为中央局宣传主任。此后长期从事马克思主义理论研究与教育工作，著有《社会学大纲》等著作，新中国成立后曾任武汉大学校长，为马克思主义哲学在中国的传播与发展作出重要贡献，1966年逝世。",
    image: "assets/images/persons/lida.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch09"]
  },
  {
    id: "p_lidazhao", name: "李大钊", courtesy: "字守常",
    birth: 1889, death: 1927, role: "中国共产主义运动先驱，中国共产党主要创始人",
    bio: "李大钊，河北乐亭人，早年留学日本，回国后任北京大学教授兼图书馆主任。俄国十月革命后，他率先在中国举起马克思主义旗帜，发表《庶民的胜利》《我的马克思主义观》等文章，系统介绍马克思主义学说，在北大培养、影响了包括毛泽东在内的一批青年革命者。他与陈独秀相约南陈北李、相约建党，是中国共产党的主要创建者之一。1927年在北京被奉系军阀张作霖逮捕，从容就义，年仅三十八岁。",
    image: "assets/images/persons/lidazhao.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch08", "ch09", "ch10"]
  },
  {
    id: "p_linxiangqian", name: "林祥谦", courtesy: null,
    birth: 1892, death: 1923, role: "京汉铁路工人运动领袖，二七惨案烈士",
    bio: "林祥谦，福建闽侯人，京汉铁路江岸机务段工人，京汉铁路总工会江岸分会负责人。1923年2月他领导发动京汉铁路工人大罢工，反抗军阀吴佩孚的压迫。军阀出动军警血腥镇压，制造二七惨案，林祥谦被捕后遭反复逼迫下令复工，他坚贞不屈，高呼头可断、血可流、工不可复，最终被军阀杀害于江岸车站，年仅三十岁，是中国工人运动史上英勇不屈的代表人物。",
    image: "assets/images/persons/linxiangqian.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch09"]
  },
  {
    id: "p_maozedong", name: "毛泽东", courtesy: "字润之",
    birth: 1893, death: 1976, role: "中国共产党和中华人民共和国主要缔造者",
    bio: "毛泽东，湖南湘潭人，中国共产党创始人之一，1921年出席中共一大。大革命失败后领导秋收起义，创建井冈山革命根据地，开辟农村包围城市的中国革命道路。长征途中遵义会议确立其在党和红军中的领导地位。抗日战争、解放战争时期领导中国共产党团结人民取得革命胜利，1949年在北京宣告中华人民共和国成立，任中央人民政府主席、党和国家最高领导人。此后领导社会主义改造与建设，也在探索中发生大跃进、文化大革命等严重失误，给国家带来深重曲折。1976年在北京逝世，其历史功过至今仍是研究近现代中国的核心课题。",
    image: "assets/images/persons/maozedong.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch09", "ch10", "ch11", "ch12", "ch13", "ch14", "ch15"]
  },
  {
    id: "p_shiyang", name: "施洋", courtesy: "字伯高",
    birth: 1889, death: 1923, role: "工人运动律师，二七惨案烈士",
    bio: "施洋，湖北竹山人，早年习法律，是京汉铁路工人运动的重要组织者与法律顾问，被誉为劳工律师。他积极为工人维权奔走，参与领导京汉铁路总工会成立及1923年二七大罢工的组织发动。罢工遭军阀镇压后，施洋不顾个人安危，坚持工作，同年2月被军阀吴佩孚部逮捕，遇害于武昌洪山，年仅三十四岁，是中国早期工人运动史上著名的革命烈士。",
    image: "assets/images/persons/shiyang.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch09"]
  },
  {
    id: "p_liaozhongkai", name: "廖仲恺", courtesy: "字仲恺",
    birth: 1877, death: 1925, role: "国民党左派领袖，孙中山三大政策坚定拥护者",
    bio: "廖仲恺，广东惠阳人，早年追随孙中山参加同盟会，是国民党内最坚定拥护联俄、联共、扶助农工三大政策的左派领袖之一。国民党改组后任中央执行委员，兼任黄埔军校党代表，全力支持军校建设与国民革命发展，与蒋介石等共同主持军校事务。1925年8月在广州国民党中央党部门前遇刺身亡，年仅四十八岁，其遇害被认为与国民党内右派势力有关，是国民革命阵营的重大损失。",
    image: "assets/images/persons/liaozhongkai.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch10"]
  },
  {
    id: "p_jiangjieshi", name: "蒋介石", courtesy: "名中正，字介石",
    birth: 1887, death: 1975, role: "国民党领袖，国民政府军事委员会委员长",
    bio: "蒋介石，浙江奉化人，早年留学日本，加入同盟会，1924年出任黄埔军校首任校长，深得孙中山倚重。孙中山逝世后逐步掌握国民党军政大权，1926年誓师北伐，基本统一全国。1927年发动四一二事变，大肆清共，国共第一次合作破裂，此后长期实行专制统治并数度围剿红军。全面抗战爆发后领导国民政府组织正面战场抵抗日本侵略，对争取抗战胜利有其贡献。抗战胜利后发动全面内战，最终在解放战争中败退台湾，长期担任台湾当局领导人，1975年病逝于台北。",
    image: "assets/images/persons/jiangjieshi.jpg", imageCredit: "Wikimedia Commons · Attribution", chapterIds: ["ch10", "ch12", "ch13"]
  },
  {
    id: "p_qiuqiubai", name: "瞿秋白", courtesy: null,
    birth: 1899, death: 1935, role: "中国共产党早期主要领导人，文学家",
    bio: "瞿秋白，江苏常州人，早年留学苏俄，系统学习马克思主义理论，是中国共产党早期重要的理论家与领导人之一。1927年八七会议上，他主持清算陈独秀的右倾错误，会后主持中央工作，其间中央一度滋长左倾盲动主义错误，1928年中共六大后不再主持中央工作。1931年后逐渐离开中央领导岗位，转而从事文学与文化工作，翻译介绍苏俄文学。第五次反围剿失败后，他留守中央苏区坚持斗争，1935年在福建长汀突围时被国民党军队俘获，同年6月从容就义，其一生兼具革命家与文学家的双重色彩。",
    image: "assets/images/persons/qiuqiubai.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch10"]
  },
  {
    id: "p_songqingling", name: "宋庆龄", courtesy: null,
    birth: 1893, death: 1981, role: "孙中山夫人，杰出的社会活动家",
    bio: "宋庆龄，广东文昌人，早年留学美国，1915年与孙中山结婚，此后长期辅助孙中山从事革命事业。孙中山逝世后，她坚持捍卫其联俄、联共、扶助农工三大政策，公开反对蒋介石的清共政策，长期站在进步立场从事抗日救亡与民主运动。新中国成立后历任中央人民政府副主席、国家名誉主席等职，积极投身妇女儿童福利事业，是二十世纪中国政治舞台上极具影响力的女性领袖，1981年在北京逝世。",
    image: "assets/images/persons/songqingling.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch10", "ch14"]
  },
  {
    id: "p_yeting", name: "叶挺", courtesy: "字希夷",
    birth: 1896, death: 1946, role: "南昌起义领导人之一，新四军军长",
    bio: "叶挺，广东惠阳人，早年参加北伐战争，所部第四军独立团骁勇善战，被誉为铁军。1927年他与周恩来、朱德、贺龙、刘伯承等共同领导南昌起义，任前敌总指挥，打响了武装反抗国民党反动派的第一枪。抗日战争爆发后出任新四军军长，1941年皖南事变中被国民党军扣押，长期囚禁。抗战胜利后获释，1946年4月飞返延安途中因飞机失事在山西黑茶山罹难，是中国革命史上重要的军事将领。",
    image: "assets/images/persons/yeting.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch10", "ch11"]
  },
  {
    id: "p_bogu", name: "博古", courtesy: "原名秦邦宪",
    birth: 1907, death: 1946, role: "中共临时中央负责人",
    bio: "博古，原名秦邦宪，江苏无锡人，早年留学苏联莫斯科中山大学。1931年起担任中共临时中央主要负责人，第五次反围剿期间，他与共产国际军事顾问推行军事教条主义，指挥失误，导致中央苏区反围剿失败，红军被迫长征。1935年遵义会议上，中央纠正了这一错误路线，他随后不再担任党的最高领导职务，但仍继续为党工作，抗战时期任《解放日报》社长、新华社社长等职。1946年4月由重庆返回延安途中因飞机失事罹难于山西黑茶山，是四八烈士之一。",
    image: "assets/images/persons/bogu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch11"]
  },
  {
    id: "p_chenyun", name: "陈云", courtesy: null,
    birth: 1905, death: 1995, role: "中国共产党和国家重要领导人，经济工作卓越领导者",
    bio: "陈云，江苏青浦（今属上海）人，早年参加工人运动，是中国共产党长期重要的领导成员之一。他长期主管党的经济与财经工作，新中国成立初期为稳定物价、恢复国民经济发挥了关键作用，此后又参与制定第一个五年计划。改革开放时期，他坚持实事求是的思想路线，在拨乱反正、平反冤假错案及经济体制调整中发挥重要作用，是中共第二代中央领导集体的重要成员，1995年在北京逝世。",
    image: "assets/images/persons/chenyun.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch15"]
  },
  {
    id: "p_helong", name: "贺龙", courtesy: "字云卿",
    birth: 1896, death: 1969, role: "南昌起义总指挥，中国人民解放军创建者之一",
    bio: "贺龙，湖南桑植人，早年参加辛亥革命及讨袁护法斗争。1927年他率部参加南昌起义，任起义军总指挥，打响武装反抗国民党反动派第一枪，此后领导创建湘鄂西革命根据地。长征中率红二方面军北上会师，抗战与解放战争时期屡建战功，新中国成立后曾主持体育事业发展。文化大革命中遭受残酷迫害，1969年含冤逝世，1974年得到平反昭雪，恢复名誉。",
    image: "assets/images/persons/helong.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch11"]
  },
  {
    id: "p_wangjiaxiang", name: "王稼祥", courtesy: null,
    birth: 1906, death: 1974, role: "中共重要领导人，遵义会议参与者",
    bio: "王稼祥，安徽泾县人，早年留学苏联莫斯科中山大学。1931年后进入中央苏区，任中革军委副主席等职。1935年遵义会议上，他坚决支持毛泽东的正确军事主张，投下关键一票，对确立毛泽东在党和红军中的领导地位起到重要作用。此后长期从事党的对外联络与理论宣传工作，1943年首次提出毛泽东思想这一概念，新中国成立后曾任驻苏联大使，1974年在北京逝世。",
    image: "assets/images/persons/wangjiaxiang.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch11"]
  },
  {
    id: "p_zhangwentian", name: "张闻天", courtesy: "号洛甫",
    birth: 1900, death: 1976, role: "中共中央前总负责人，遵义会议主持者之一",
    bio: "张闻天，江苏南汇（今属上海）人，早年留学苏联莫斯科中山大学，曾任中共中央宣传部长等职。1935年遵义会议上，他支持毛泽东的正确路线，会后接替博古担任中共中央总负责人，主持中央工作长达数年，为确立毛泽东的领导核心地位创造了组织条件。此后长期从事党的理论与外交工作，文化大革命中受到冲击，晚年仍坚持独立思考，1976年在江苏无锡逝世。",
    image: "assets/images/persons/zhangwentian.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch11"]
  },
  {
    id: "p_zhouenlai", name: "周恩来", courtesy: "字翔宇",
    birth: 1898, death: 1976, role: "中国共产党和中华人民共和国主要缔造者，首任国务院总理",
    bio: "周恩来，江苏淮安人，早年留学日本、法国，参与创建旅欧中国共产党组织。回国后任黄埔军校政治部主任，1927年与贺龙、叶挺、朱德、刘伯承等领导南昌起义。长征途中在遵义会议上支持毛泽东的正确主张，此后长期担任党和军队重要领导职务。抗战与解放战争时期从事统一战线与外交工作，新中国成立后任政务院（国务院）总理达二十六年，兼任外交部长，在国家建设、外交事务、文革中艰难维系国家运转等方面发挥了不可替代的作用，深受人民爱戴，1976年在北京逝世。",
    image: "assets/images/persons/zhouenlai.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch10", "ch11", "ch12", "ch13", "ch15"]
  },
  {
    id: "p_zhude", name: "朱德", courtesy: "字玉阶",
    birth: 1886, death: 1976, role: "中国人民解放军主要缔造者，十大元帅之首",
    bio: "朱德，四川仪陇人，早年参加辛亥革命、护国战争，后赴德国、苏联学习并加入中国共产党。1927年参与领导南昌起义，此后率部与毛泽东领导的秋收起义部队会师井冈山，组成中国工农红军第四军，史称朱毛会师，奠定了人民军队的重要基础。长征、抗战、解放战争中长期担任红军及人民解放军总司令，指挥若定，功勋卓著。新中国成立后曾任中央人民政府副主席、全国人大常委会委员长等职，1955年被授予元帅军衔，位列十大元帅之首，1976年在北京逝世。",
    image: "assets/images/persons/zhude.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch11", "ch14"]
  },
  {
    id: "p_pengdehuai", name: "彭德怀", courtesy: "原名彭得华",
    birth: 1898, death: 1974, role: "中国人民解放军高级将领，十大元帅之一",
    bio: "彭德怀，湖南湘潭人，早年参加湘军，1928年领导平江起义后加入红军。土地革命战争、长征、抗日战争期间屡立战功，指挥百团大战沉重打击日军。解放战争中指挥西北野战军对阵胡宗南部，屡挫强敌。1950年任中国人民志愿军司令员，率军入朝作战。1955年被授予元帅军衔。1959年庐山会议上，他就大跃进问题直言进谏，被错误批判为右倾机会主义反党集团，此后长期受到不公正对待，文化大革命中遭受严重迫害，1974年含冤逝世，1978年得到平反昭雪。",
    image: "assets/images/persons/pengdehuai.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch11", "ch12", "ch13", "ch14"]
  },
  {
    id: "p_chenyi", name: "陈毅", courtesy: "字仲弘",
    birth: 1901, death: 1972, role: "中国人民解放军高级将领，十大元帅之一，外交家",
    bio: "陈毅，四川乐至人，早年留学法国勤工俭学，参加南昌起义后转战井冈山，与朱德、毛泽东会师。皖南事变后任新四军代军长，解放战争时期与粟裕搭档指挥华东野战军（第三野战军），取得莱芜、孟良崮、淮海等重大战役胜利，为解放战争胜利立下卓越功勋。1955年被授予元帅军衔。新中国成立后长期兼任国务院副总理兼外交部长，是新中国重要的军事家与外交家，文化大革命中受到冲击，1972年在北京逝世。",
    image: "assets/images/persons/chenyi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch11", "ch13"]
  },
  {
    id: "p_huzongnan", name: "胡宗南", courtesy: null,
    birth: 1896, death: 1962, role: "国民党高级将领",
    bio: "胡宗南，浙江孝丰人，黄埔军校第一期毕业生，是蒋介石极为倚重的国民党将领之一，长期统率国民党军在西北地区的重兵集团。解放战争时期，他奉命于1947年率部进攻中共中央所在地延安，一度攻占延安城，但毛泽东等中央领导采取转战陕北的策略从容应对，彭德怀指挥西北野战军在青化砭、羊马河、沙家店等战役中连挫胡部，其军事进攻最终归于失败。1949年后退往台湾，1962年病逝。",
    image: "assets/images/persons/huzongnan.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch13"]
  },
  {
    id: "p_lizongren", name: "李宗仁", courtesy: "字德邻",
    birth: 1891, death: 1969, role: "桂系将领，代理中华民国总统",
    bio: "李宗仁，广西临桂人，桂系军阀首领，北伐战争中战功卓著。抗日战争中任第五战区司令长官，1938年指挥台儿庄战役取得抗战以来重大胜利，极大鼓舞了全国抗战士气。解放战争后期，蒋介石引退，他以副总统身份代行总统职权，试图与中共进行和谈，未获成功。1949年南京解放前夕出走美国，1965年毅然回归祖国大陆，受到党和政府的欢迎，1969年在北京病逝。",
    image: "assets/images/persons/lizongren.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12"]
  },
  {
    id: "p_linbiao", name: "林彪", courtesy: null,
    birth: 1907, death: 1971, role: "中国人民解放军高级将领，十大元帅之一",
    bio: "林彪，湖北黄冈人，黄埔军校第四期毕业生，长期在毛泽东、朱德麾下担任军事将领。抗日战争初期指挥八路军一一五师取得平型关大捷，是全面抗战爆发后中国军队取得的首个重大胜利。解放战争中指挥东北野战军（第四野战军）取得辽沈战役等重大胜利，为解放战争全面胜利作出重要贡献，1955年被授予元帅军衔。新中国成立后曾任国防部长、党中央副主席等要职，文化大革命中一度被确定为接班人。1971年9月因阴谋政变败露，在出逃途中坠机身亡于蒙古温都尔汗，其叛党叛国行径为党和历史所否定。",
    image: "assets/images/persons/linbiao.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12", "ch13"]
  },
  {
    id: "p_tonglinge", name: "佟麟阁", courtesy: "字捷三",
    birth: 1892, death: 1937, role: "抗日殉国将领，第二十九军副军长",
    bio: "佟麟阁，河北高阳人，早年投身西北军系统，历经多年军旅生涯，后任国民革命军第二十九军副军长。1937年七七事变后，日军大举进犯北平，他奉命率部在南苑一带阻击日军，激战中身负重伤仍坚持指挥，终因伤势过重壮烈殉国，是全面抗战爆发后中国军队牺牲的第一位高级将领，其英勇殉国事迹极大激发了全国军民的抗战决心，后被追认为革命烈士。",
    image: "assets/images/persons/tonglinge.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12"]
  },
  {
    id: "p_yanghucheng", name: "杨虎城", courtesy: null,
    birth: 1893, death: 1949, role: "西安事变发动者之一，国民党第十七路军总指挥",
    bio: "杨虎城，陕西蒲城人，早年投身反清、护国、护法斗争，后任国民党第十七路军总指挥、西安绥靖公署主任。面对日本侵略步步紧逼，他与张学良两人政见相合，1936年12月联合发动西安事变，扣押蒋介石，逼其停止内战、联共抗日，事变和平解决后促成了抗日民族统一战线的初步形成。事变后被迫辞职出国考察，抗战爆发后回国即遭蒋介石长期监禁，1949年在重庆解放前夕被秘密杀害。",
    image: "assets/images/persons/yanghucheng.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12"]
  },
  {
    id: "p_yangjingyu", name: "杨靖宇", courtesy: "原名马尚德",
    birth: 1905, death: 1940, role: "东北抗日联军主要领导人",
    bio: "杨靖宇，原名马尚德，河南确山人，九一八事变后受党组织派遣赴东北组织抗日武装，历任东北人民革命军、东北抗日联军领导职务，长期在极端艰苦的条件下坚持敌后抗日游击战争，屡挫日伪军。1940年初在吉林蒙江（今靖宇县）遭日伪军重兵围困，弹尽粮绝，孤身奋战至最后一刻壮烈牺牲。日军解剖其遗体，发现胃中仅存草根树皮棉絮，无一粒粮食，其坚贞不屈的精神令敌人也为之震撼。",
    image: "assets/images/persons/yangjingyu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12"]
  },
  {
    id: "p_zhangxueliang", name: "张学良", courtesy: "字汉卿",
    birth: 1901, death: 2001, role: "西安事变发动者之一，东北军领袖",
    bio: "张学良，辽宁海城人，奉系军阀张作霖之子，1928年皇姑屯事件后继承父业主政东北，同年宣布东北易帜，服从南京国民政府，促成全国形式上的统一。九一八事变中执行不抵抗政策，东北迅速沦陷，此举广受国人诟病。1936年他与杨虎城出于抗日救国的考虑，联合发动西安事变，扣押蒋介石逼其联共抗日，事变和平解决，成为扭转时局的重要转折点。此后张学良亲自护送蒋介石返回南京，随即遭长期软禁，1990年代获释后移居美国，2001年在夏威夷逝世。",
    image: "assets/images/persons/zhangxueliang.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12"]
  },
  {
    id: "p_zhangzizhong", name: "张自忠", courtesy: "字荩忱",
    birth: 1891, death: 1940, role: "抗日殉国将领，第三十三集团军总司令",
    bio: "张自忠，山东临清人，早年隶属西北军系统，后任国民革命军第三十三集团军总司令。全面抗战爆发后率部转战南北，参与徐州会战、台儿庄战役等重大战役，战功显赫。1940年枣宜会战中，他亲率部队渡河出击，在湖北宜城南瓜店遭日军重兵包围，激战中身中数弹，仍坚持指挥直至壮烈殉国，是抗日战争中牺牲的军衔最高的中国将领之一，被追赠为陆军上将，其忠勇殉国事迹广受后世敬仰。",
    image: "assets/images/persons/zhangzizhong.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12"]
  },
  {
    id: "p_zuoquan", name: "左权", courtesy: null,
    birth: 1905, death: 1942, role: "八路军副参谋长",
    bio: "左权，湖南醴陵人，早年就读黄埔军校，后留学苏联，回国后长期在红军及八路军中担任军事指挥与参谋工作，历任红一军团参谋长、八路军副参谋长等职，协助朱德、彭德怀指挥百团大战等重大战役，展现出卓越的军事才能。1942年5月，日军对太行山八路军总部所在地发动大规模扫荡，左权在指挥部队突围掩护中央机关转移时，不幸被炮弹击中，壮烈牺牲，年仅三十七岁，是八路军在抗战中牺牲的最高级别将领之一。",
    image: "assets/images/persons/zuoquan.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch12"]
  },
  {
    id: "p_fuzuoyi", name: "傅作义", courtesy: "字宜生",
    birth: 1895, death: 1974, role: "国民党高级将领，北平和平解放促成者",
    bio: "傅作义，山西荣河人，长期在晋绥军系统任职，抗日战争中率部坚守绥远，屡挫日军，战功卓著。解放战争后期任华北剿总总司令，统率平津地区国民党重兵集团。1948年底至1949年初平津战役中，在中共方面争取下，他审时度势，接受和平改编条件，率部弃暗投明，使千年古都北平免遭战火破坏，实现和平解放。新中国成立后历任水利部部长等职，为新中国水利事业作出贡献，1974年在北京逝世。",
    image: "assets/images/persons/fuzuoyi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch13"]
  },
  {
    id: "p_liubocheng", name: "刘伯承", courtesy: "原名刘明昭",
    birth: 1892, death: 1986, role: "中国人民解放军军事家，十大元帅之一",
    bio: "刘伯承，四川开县人，早年参加护国、护法战争，作战中负伤致右眼失明，人称军神。1927年参与领导南昌起义任参谋团参谋长，后留学苏联深造军事理论。解放战争时期与邓小平搭档，率晋冀鲁豫野战军（后为第二野战军）转战中原，千里跃进大别山，人称刘邓大军，为解放战争的战略转折作出重大贡献。1955年被授予元帅军衔，新中国成立后长期从事军事教育事业，创办南京军事学院，1986年在北京逝世。",
    image: "assets/images/persons/liubocheng.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch13"]
  },
  {
    id: "p_nierongzhen", name: "聂荣臻", courtesy: null,
    birth: 1899, death: 1992, role: "中国人民解放军军事家，十大元帅之一",
    bio: "聂荣臻，四川江津人，早年留学法国、比利时勤工俭学，回国后任黄埔军校政治部秘书，长期在周恩来领导下从事军事政治工作。抗日战争时期创建晋察冀敌后抗日根据地，解放战争中指挥华北野战部队参与平津战役，促成北平和平解放，此后出任北平（北京）第一任市长，主持接管与建设工作。1955年被授予元帅军衔，新中国成立后长期主管国防科技事业，为两弹一星事业作出重要贡献，1992年在北京逝世。",
    image: "assets/images/persons/nierongzhen.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch13"]
  },
  {
    id: "p_suyu", name: "粟裕", courtesy: null,
    birth: 1907, death: 1984, role: "中国人民解放军著名军事家，十大将之首",
    bio: "粟裕，湖南会同人，早年参加南昌起义、井冈山斗争，长期在华东地区领导游击战争与正规作战。解放战争时期与陈毅搭档指挥华东野战军（第三野战军），先后取得苏中七战七捷、孟良崮战役、豫东战役、淮海战役等一系列重大胜利，尤以淮海战役中的卓越指挥闻名，为解放战争的胜利作出杰出贡献。1955年被授予大将军衔，位列十大将之首，晚年从事军事科学研究，1984年在北京逝世。",
    image: "assets/images/persons/suyu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch13"]
  },
  {
    id: "p_dengxiaoping", name: "邓小平", courtesy: "原名邓先圣，学名邓希贤",
    birth: 1904, death: 1997, role: "中国改革开放总设计师",
    bio: "邓小平，四川广安人，早年留学法国、苏联，长期从事党的军事与政治领导工作，与刘伯承搭档指挥刘邓大军参与解放战争重大战役。新中国成立后历任党和国家重要领导职务，文化大革命中三次被打倒又三次复出。1978年在他推动下召开中共十一届三中全会，确立解放思想、实事求是的思想路线，作出改革开放的历史性决策，此后长期领导改革开放和社会主义现代化建设，提出建设中国特色社会主义理论，被誉为改革开放和社会主义现代化建设的总设计师，1997年在北京逝世。",
    image: "assets/images/persons/dengxiaoping.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch13", "ch15"]
  },
  {
    id: "p_huangjiguang", name: "黄继光", courtesy: null,
    birth: 1931, death: 1952, role: "抗美援朝战斗英雄",
    bio: "黄继光，四川中江人，中国人民志愿军战士。1952年上甘岭战役中，为配合部队夺取阵地，他主动请缨执行爆破任务，在身负重伤、弹药耗尽的情况下，毅然用自己的身躯堵住敌人机枪射孔，为部队开辟进攻道路争取了宝贵时间，壮烈牺牲，年仅二十一岁。他被追记特等功，追授特级战斗英雄称号，其英勇事迹成为抗美援朝战争中舍生忘死、保家卫国精神的典范。",
    image: null, imageCredit: null, chapterIds: ["ch14"]
  },
  {
    id: "p_qiushaoyun", name: "邱少云", courtesy: null,
    birth: 1926, death: 1952, role: "抗美援朝战斗英雄",
    bio: "邱少云，重庆铜梁人，中国人民志愿军战士。1952年在朝鲜战场执行潜伏任务时，敌军投掷的燃烧弹引燃了他身边的草丛，为了不暴露整个潜伏部队、保证战斗计划成功，他强忍剧痛，一动不动地任凭烈火烧身，直至壮烈牺牲，年仅二十六岁。他用生命恪守了严明的纪律，被追记特等功，追授一级英雄称号，其顽强的意志与纪律精神被后世广为传颂。",
    image: "assets/images/persons/qiushaoyun.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch14"]
  },
  {
    id: "p_liushaoqi", name: "刘少奇", courtesy: null,
    birth: 1898, death: 1969, role: "中华人民共和国主席",
    bio: "刘少奇，湖南宁乡人，早年从事工人运动，是中国共产党重要的理论家与领导人之一，长期从事党的组织、白区工作与理论建设，著有《论共产党员的修养》等重要著作。新中国成立后曾任中央人民政府副主席，1959年起担任中华人民共和国主席，协助毛泽东主持一线工作，在国民经济调整时期发挥重要作用。文化大革命中被错误批判打倒，遭受残酷迫害，1969年含冤逝世于河南开封，1980年中共十一届五中全会为其平反昭雪，恢复名誉。",
    image: "assets/images/persons/liushaoqi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch14", "ch15"]
  },
  {
    id: "p_dengjiaxian", name: "邓稼先", courtesy: null,
    birth: 1924, death: 1986, role: "两弹元勋，核物理学家",
    bio: "邓稼先，安徽怀宁人，早年留学美国获物理学博士学位，学成后毅然回国投身国防科技事业。他隐姓埋名二十余年，长期在西北荒漠戈壁主持中国原子弹、氢弹的理论设计与研制工作，是中国核武器事业的主要奠基人之一，为打破超级大国核垄断、增强国防实力作出了卓越贡献。长期接触核辐射使其健康严重受损，1986年因癌症在北京病逝，被誉为两弹元勋，其淡泊名利、无私奉献的精神广受后人敬仰。",
    image: "assets/images/persons/dengjiaxian.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch15"]
  },
  {
    id: "p_guoyonghuai", name: "郭永怀", courtesy: null,
    birth: 1909, death: 1968, role: "力学家，两弹一星元勋",
    bio: "郭永怀，山东荣成人，早年留学美国加州理工学院，获博士学位并在应用力学、空气动力学领域成就卓著。1956年放弃国外优厚待遇毅然回国，投身中国原子弹、导弹与人造卫星事业，是两弹一星事业的重要奠基人之一。1968年他在赴北京途中因飞机失事不幸罹难，生命最后一刻他与警卫员紧紧相拥，用身体保护住了绝密科研资料，被追授烈士称号，是两弹一星功勋奖章获得者中唯一一位因公殉职的科学家。",
    image: "assets/images/persons/guoyonghuai.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch15"]
  },
  {
    id: "p_leifeng", name: "雷锋", courtesy: null,
    birth: 1940, death: 1962, role: "中国人民解放军战士，全民学习楷模",
    bio: "雷锋，湖南望城人，出身贫苦，新中国成立后在党的培养下成长为一名解放军战士。他在平凡的岗位上坚持乐于助人、艰苦朴素，全心全意为人民服务，留下大量感人事迹与日记，其把有限的生命投入到无限的为人民服务之中去的精神广为流传。1962年因公殉职，年仅二十二岁。毛泽东此后题词向雷锋同志学习，在全国掀起学习雷锋精神的热潮，雷锋精神至今仍是中国社会重要的道德标杆。",
    image: "assets/images/persons/leifeng.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch15"]
  },
  {
    id: "p_jiaoyulu", name: "焦裕禄", courtesy: null,
    birth: 1922, death: 1964, role: "河南兰考县委书记，党的好干部楷模",
    bio: "焦裕禄，山东淄博人，1962年调任河南兰考县委书记。当时兰考正遭受风沙、盐碱、内涝三害肆虐，他不顾肝病缠身，亲自带队查风口、探流沙、访贫问苦，与干部群众一起艰苦奋战，全力治理灾害、发展生产，忍着剧痛坚持工作，鞠躬尽瘁。1964年因肝癌病逝，年仅四十二岁。他心系群众、艰苦奋斗、无私奉献的公仆精神，被誉为共产党人的楷模，焦裕禄精神影响了一代又一代党员干部。",
    image: "assets/images/persons/jiaoyulu.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch15"]
  },
  {
    id: "p_wangjinxi", name: "王进喜", courtesy: null,
    birth: 1923, death: 1970, role: "大庆石油会战铁人，全国工业战线楷模",
    bio: "王进喜，甘肃玉门人，1960年参加大庆油田石油会战，任钻井队队长。面对极其艰苦的自然条件与技术设备短缺，他带领全队人拉肩扛运设备、破冰取水保开钻，喊出有条件要上、没有条件创造条件也要上的口号。井喷时为制服险情，他奋不顾身跳入泥浆池用身体搅拌泥浆，展现了不畏艰险、拼搏奉献的精神，被誉为铁人。1970年因积劳成疾患胃癌病逝，年仅四十七岁，铁人精神成为中国工业战线的重要精神标杆。",
    image: "assets/images/persons/wangjinxi.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch15"]
  },
  {
    id: "p_qianxuesen", name: "钱学森", courtesy: null,
    birth: 1911, death: 2009, role: "中国航天事业奠基人，两弹一星元勋",
    bio: "钱学森，上海人，早年留学美国麻省理工学院、加州理工学院，师从航空航天大师冯·卡门，在空气动力学、导弹与航天领域取得卓越成就，是世界知名的科学家。1955年他冲破美国政府重重阻挠，历经周折终于回到祖国，随即投身中国国防科技事业，主持两弹一星中导弹与航天技术的研制工作，被誉为中国航天之父、火箭之王，为中国导弹与航天事业的从无到有作出了奠基性贡献，2009年在北京逝世。",
    image: "assets/images/persons/qianxuesen.jpg", imageCredit: "Wikimedia Commons · 公有领域", chapterIds: ["ch15"]
  }
];

window.SHY_DATA.relations = [
  { source: "p_kangyouwei", target: "p_liangqichao", relation: "师承", note: "万木草堂师生" },
  { source: "p_liangqichao", target: "p_caie", relation: "师承", note: "长沙时务学堂师生" },
  { source: "p_zengguofan", target: "p_lihongzhang", relation: "师承", note: "识拔栽培，保荐创建淮军" },
  { source: "p_sunzhongshan", target: "p_jiangjieshi", relation: "师承", note: "黄埔军校总理与首任校长，倚重栽培" },
  { source: "p_lidazhao", target: "p_maozedong", relation: "师承", note: "北大图书馆引路，毛泽东的马克思主义引路人" },
  { source: "p_weiyuan", target: "p_yixin", relation: "影响", note: "《海国图志》师夷长技思想影响洋务运动" },
  { source: "p_chenduxiu", target: "p_maozedong", relation: "影响", note: "《新青年》思想启蒙与建党引领" },
  { source: "p_yanfu", target: "p_liangqichao", relation: "影响", note: "《天演论》物竞天择思想启迪维新思潮" },
  { source: "p_ronghong", target: "p_zhantianyou", relation: "影响", note: "倡建留美幼童计划，詹天佑为首批学童" },
  { source: "p_kangyouwei", target: "p_guangxudi", relation: "影响", note: "公车上书与保国会，坚定变法决心" },
  { source: "p_weiyuan", target: "p_zengguofan", relation: "影响", note: "师夷长技思想启迪洋务重臣" },
  { source: "p_liangqichao", target: "p_maozedong", relation: "影响", note: "《新民丛报》文章启蒙青年毛泽东" },
  { source: "p_kangyouwei", target: "p_tansitong", relation: "影响", note: "维新思想感召，投身变法" },
  { source: "p_maozedong", target: "p_leifeng", relation: "影响", note: "向雷锋同志学习题词，确立时代精神偶像" },
  { source: "p_weiyuan", target: "p_zhangzhidong", relation: "影响", note: "师夷长技思想影响洋务运动后期代表" },
  { source: "p_sunzhongshan", target: "p_huangxing", relation: "同盟", note: "同盟会创立搭档" },
  { source: "p_sunzhongshan", target: "p_songjiaoren", relation: "同盟", note: "同盟会与国民党组建" },
  { source: "p_huangxing", target: "p_songjiaoren", relation: "同盟", note: "华兴会同志，合组同盟会" },
  { source: "p_sunzhongshan", target: "p_liaozhongkai", relation: "同盟", note: "联俄联共扶助农工，国民党左派骨干" },
  { source: "p_liaozhongkai", target: "p_jiangjieshi", relation: "同盟", note: "黄埔军校党代表与校长" },
  { source: "p_maozedong", target: "p_zhouenlai", relation: "同盟", note: "革命领导核心搭档" },
  { source: "p_maozedong", target: "p_zhude", relation: "同盟", note: "朱毛红军，井冈山会师" },
  { source: "p_maozedong", target: "p_zhangwentian", relation: "同盟", note: "遵义会议支持毛泽东正确路线" },
  { source: "p_maozedong", target: "p_wangjiaxiang", relation: "同盟", note: "遵义会议投下关键一票" },
  { source: "p_zhouenlai", target: "p_zhude", relation: "同盟", note: "长期并肩领导革命军队" },
  { source: "p_helong", target: "p_zhouenlai", relation: "同盟", note: "南昌起义共同领导人" },
  { source: "p_yeting", target: "p_helong", relation: "同盟", note: "南昌起义总指挥与前敌总指挥" },
  { source: "p_yeting", target: "p_zhouenlai", relation: "同盟", note: "南昌起义前敌总指挥与前委书记" },
  { source: "p_liubocheng", target: "p_zhouenlai", relation: "同盟", note: "南昌起义参谋团" },
  { source: "p_liubocheng", target: "p_dengxiaoping", relation: "同盟", note: "刘邓大军，晋冀鲁豫野战军搭档" },
  { source: "p_chenyi", target: "p_suyu", relation: "同盟", note: "华东野战军搭档，陈毅粟裕" },
  { source: "p_zuoquan", target: "p_pengdehuai", relation: "同盟", note: "八路军副参谋长，协助指挥百团大战" },
  { source: "p_zhangxueliang", target: "p_yanghucheng", relation: "同盟", note: "西安事变联合发动者" },
  { source: "p_bogu", target: "p_zhangwentian", relation: "同盟", note: "同为莫斯科中山大学同学，同属留苏派骨干" },
  { source: "p_wangjiaxiang", target: "p_zhangwentian", relation: "同盟", note: "遵义会议联合支持毛泽东正确路线" },
  { source: "p_zengguofan", target: "p_ronghong", relation: "同盟", note: "会同李鸿章奏请朝廷，选派留美幼童" },
  { source: "p_yixin", target: "p_lihongzhang", relation: "同盟", note: "总理衙门与地方督抚，共倡洋务新政" },
  { source: "p_nierongzhen", target: "p_zhouenlai", relation: "同盟", note: "黄埔军校政治部同僚，长期共事" },
  { source: "p_lizongren", target: "p_zhangzizhong", relation: "同盟", note: "徐州会战台儿庄战役，第五战区并肩作战" },
  { source: "p_tonglinge", target: "p_zhangzizhong", relation: "同盟", note: "同出西北军系统，同为抗战捐躯的将领" },
  { source: "p_fuzuoyi", target: "p_nierongzhen", relation: "同盟", note: "北平和平解放谈判促成，共同接管建设" },
  { source: "p_lidazhao", target: "p_chenduxiu", relation: "同盟", note: "《新青年》同仁，南陈北李、相约建党" },
  { source: "p_chenduxiu", target: "p_hushi", relation: "同盟", note: "《新青年》编辑同仁，文学革命" },
  { source: "p_chenduxiu", target: "p_luxun", relation: "同盟", note: "《新青年》撰稿同仁" },
  { source: "p_caiyuanpei", target: "p_luxun", relation: "同盟", note: "教育部、北大同仁，延揽任教" },
  { source: "p_caiyuanpei", target: "p_chenduxiu", relation: "同盟", note: "北大校长延揽文科学长，共倡新文化运动" },
  { source: "p_caiyuanpei", target: "p_hushi", relation: "同盟", note: "北大校长延揽任教，共倡新文化运动" },
  { source: "p_lidazhao", target: "p_dongbiwu", relation: "同盟", note: "中共建党先驱同志" },
  { source: "p_lida", target: "p_chenduxiu", relation: "同盟", note: "共同创建中共（陈未出席一大，当选中央局书记）" },
  { source: "p_lida", target: "p_maozedong", relation: "同盟", note: "中共一大代表同席" },
  { source: "p_linxiangqian", target: "p_shiyang", relation: "同盟", note: "二七大罢工，京汉铁路工人运动领袖" },
  { source: "p_linzexu", target: "p_qishan", relation: "对立", note: "主战主抚对立" },
  { source: "p_yuanshikai", target: "p_kangyouwei", relation: "对立", note: "戊戌政变告密，导致变法失败" },
  { source: "p_yuanshikai", target: "p_songjiaoren", relation: "对立", note: "宋教仁遇刺案幕后嫌疑" },
  { source: "p_yuanshikai", target: "p_caie", relation: "对立", note: "护国战争讨伐帝制" },
  { source: "p_yuanshikai", target: "p_sunzhongshan", relation: "对立", note: "窃取民国大总统，镇压二次革命" },
  { source: "p_zhangxun", target: "p_liyuanhong", relation: "对立", note: "张勋复辟，驱逐黎元洪总统" },
  { source: "p_jiangjieshi", target: "p_maozedong", relation: "对立", note: "国共两党最高领导人，长期政治军事对立" },
  { source: "p_jiangjieshi", target: "p_zhouenlai", relation: "对立", note: "国共长期对立，两度合作又分裂" },
  { source: "p_zhangxueliang", target: "p_jiangjieshi", relation: "对立", note: "西安事变兵谏扣蒋，逼其抗日" },
  { source: "p_yanghucheng", target: "p_jiangjieshi", relation: "对立", note: "参与西安事变逼蒋抗日" },
  { source: "p_hongxiuquan", target: "p_yangxiuqing", relation: "对立", note: "天京事变，诛杀东王" },
  { source: "p_hongxiuquan", target: "p_shidakai", relation: "对立", note: "猜忌逼走，石达开负气出走远征" },
  { source: "p_zengguofan", target: "p_hongxiuquan", relation: "对立", note: "湘军镇压太平天国" },
  { source: "p_lihongzhang", target: "p_hongxiuquan", relation: "对立", note: "淮军助剿太平天国" },
  { source: "p_zuozongtang", target: "p_zengguofan", relation: "对立", note: "湘军统帅同僚，政见不合交恶多年" },
  { source: "p_lihongzhang", target: "p_zuozongtang", relation: "对立", note: "海防塞防之争，政见分歧" },
  { source: "p_cixi", target: "p_guangxudi", relation: "对立", note: "帝后党争，戊戌政变后幽禁瀛台" },
  { source: "p_yuanshikai", target: "p_guangxudi", relation: "对立", note: "戊戌政变告密，光绪被囚瀛台" },
  { source: "p_qiuqiubai", target: "p_chenduxiu", relation: "对立", note: "八七会议清算陈独秀右倾错误，接任中央领导" },
  { source: "p_bogu", target: "p_maozedong", relation: "对立", note: "第五次反围剿路线分歧，遵义会议后让出领导权" },
  { source: "p_huzongnan", target: "p_maozedong", relation: "对立", note: "进攻延安，毛泽东转战陕北" },
  { source: "p_huzongnan", target: "p_pengdehuai", relation: "对立", note: "西北战场交战对手，青化砭、沙家店等战役" },
  { source: "p_linbiao", target: "p_fuzuoyi", relation: "对立", note: "平津战役对阵，后促成北平和平解放" },
  { source: "p_sunzhongshan", target: "p_songqingling", relation: "亲属", note: "夫妻" },
  { source: "p_jiangjieshi", target: "p_songqingling", relation: "亲属", note: "姻亲，胞妹宋美龄为蒋介石夫人" },
  { source: "p_cixi", target: "p_longyu", relation: "亲属", note: "姑侄，指婚为光绪帝皇后" },
  { source: "p_guangxudi", target: "p_longyu", relation: "亲属", note: "帝后" },
  { source: "p_hongxiuquan", target: "p_hongrengan", relation: "亲属", note: "族弟，后期倚为谋主干王" },
  { source: "p_daoguangdi", target: "p_xianfengdi", relation: "亲属", note: "父子" },
  { source: "p_daoguangdi", target: "p_yixin", relation: "亲属", note: "父子" },
  { source: "p_yixin", target: "p_guangxudi", relation: "亲属", note: "伯侄，弟奕譞之子入承大统" }
];
