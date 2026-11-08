import {
  firearmExhibitIds,
  firearmPartIds,
  stepIds,
  type ExhibitDefinition,
  type ExploreStep,
  type FirearmCycleKind,
  type FirearmExhibitId,
  type PartDefinition,
} from './types'

export { firearmExhibitIds, firearmPartIds }

type StepCopy = Omit<ExploreStep, 'id' | 'index'>

type StepCopyTuple = readonly [
  StepCopy,
  StepCopy,
  StepCopy,
  StepCopy,
  StepCopy,
  StepCopy,
]

type FirearmStepTuple = readonly [
  ExploreStep,
  ExploreStep,
  ExploreStep,
  ExploreStep,
  ExploreStep,
  ExploreStep,
]

type FirearmPartTuple = readonly [
  PartDefinition<'firearm-support-shell'>,
  PartDefinition<'firearm-receiver-shell'>,
  PartDefinition<'firearm-barrel-chamber'>,
  PartDefinition<'firearm-breech-member'>,
  PartDefinition<'firearm-lock-delay-system'>,
  PartDefinition<'firearm-return-drive-system'>,
  PartDefinition<'firearm-input-linkage'>,
  PartDefinition<'firearm-feed-module'>,
  PartDefinition<'firearm-extraction-path'>,
  PartDefinition<'firearm-inert-round-path'>,
  PartDefinition<'firearm-cycle-indicator'>,
]

function defineSteps(copy: StepCopyTuple): FirearmStepTuple {
  return [
    { id: stepIds[0], index: 0, ...copy[0] },
    { id: stepIds[1], index: 1, ...copy[1] },
    { id: stepIds[2], index: 2, ...copy[2] },
    { id: stepIds[3], index: 3, ...copy[3] },
    { id: stepIds[4], index: 4, ...copy[4] },
    { id: stepIds[5], index: 5, ...copy[5] },
  ]
}

function defineParts(parts: FirearmPartTuple): FirearmPartTuple {
  for (const [index, expectedId] of firearmPartIds.entries()) {
    if (parts[index].id !== expectedId) {
      throw new Error(`Firearm part ${index} must be ${expectedId}`)
    }
  }

  return parts
}

const reconstructionNote =
  '项目原创（project-authored）的教学几何（teaching geometry），以透明惰性替代物和抽象能量构成惰性示意，只解释可见结构的单次关系；这是非拆装展项，不提供尺寸、参数或操作信息。'

export const m1903Steps = defineSteps([
  {
    label: '整体识别',
    shortLabel: '整体',
    question: '支承外形、机匣与枪管怎样形成连续的结构主线？',
    hint: '沿木质支承轮廓向前观察，再找到机匣体积与枪管轴线的连接关系。',
    takeaway: 'M1903 教学剖面只保留主要结构层次，不混用 M1903A3 的外形或部件特征。',
  },
  {
    label: '外壳支承',
    shortLabel: '外壳',
    question: '外部支承与金属机匣分别承担怎样的定位关系？',
    hint: '比较长条支承外形与中央机匣壳体，留意两者包围范围的差异。',
    takeaway: '支承外形组织接触区域，机匣壳体约束内部往复件；这里只比较空间关系。',
  },
  {
    label: '闭锁界面',
    shortLabel: '闭锁',
    question: '旋转件与机匣界面怎样从对齐状态转为可后移状态？',
    hint: '观察抽象凸耳与对应边界的相对朝向，不追踪任何可执行动作。',
    takeaway: '旋转闭锁示意表达先解除界面约束、再允许纵向移动的机械顺序。',
  },
  {
    label: '惰性事件',
    shortLabel: '能量',
    question: '抽象能量与透明惰性替代物怎样标示循环的起点？',
    hint: '先看短暂的抽象能量光带，再看透明惰性替代物沿轴线离开。',
    takeaway: '抽象投射体离开之后，模型才进入由观察者触发的手动阶段；两者不会自动连成循环。',
  },
  {
    label: '手动往复',
    shortLabel: '往复',
    question: '为什么后移、返回与再次闭锁要被画成分开的观察阶段？',
    hint: '沿循环指示器查看枪机后移、抽取路径和返回路径的先后。',
    takeaway: 'M1903 的教学循环依赖手动输入，不会自动循环，也不展示执行方法。',
  },
  {
    label: '路径复盘',
    shortLabel: '复盘',
    question: '哪些路径属于惰性替代物，哪些路径属于往复构件？',
    hint: '用不同颜色分别追踪透明惰性替代物、抽取线与枪机位置指示。',
    takeaway: '单次复盘把闭锁、抽象能量事件与手动往复分开，避免把示意误解为自动过程。',
  },
])

export const m1911a1Steps = defineSteps([
  {
    label: '整体识别',
    shortLabel: '整体',
    question: '套筒外形、握持支承与枪管轴线怎样叠合成紧凑结构？',
    hint: '从外部轮廓进入半透明壳体，寻找套筒、枪管与握持区域的相对位置。',
    takeaway: 'M1911A1 剖面以少量教学体积表达结构层次，不复刻内部可操作细节。',
  },
  {
    label: '外壳导向',
    shortLabel: '外壳',
    question: '往复外壳为什么要与内部枪管保持同轴而又能相对移动？',
    hint: '比较套筒壳体的长条轨迹与枪管的短程位置指示。',
    takeaway: '外壳提供往复边界，内部枪管只在教学指示中显示有限的共同位移。',
  },
  {
    label: '倾斜闭锁',
    shortLabel: '闭锁',
    question: '枪管短后坐之后，倾斜闭锁界面怎样改变约束状态？',
    hint: '观察枪管后段的高低变化与套筒继续后移之间的先后。',
    takeaway: '短后坐先让枪管与套筒共同移动，随后倾斜变化解除高层闭锁关系。',
  },
  {
    label: '抽象能量',
    shortLabel: '能量',
    question: '抽象能量怎样同时标记透明惰性替代物离开与外壳开始移动？',
    hint: '留意能量光带分成轴向示意与短后坐指示的时刻。',
    takeaway: '模型只用抽象能量和透明惰性替代物说明因果先后，不补充其他内部构造。',
  },
  {
    label: '返回路径',
    shortLabel: '返回',
    question: '储能带、外壳与供给路径怎样在单次循环中重新对齐？',
    hint: '沿返回驱动示意查看外壳前移，再观察枪管恢复轴线位置。',
    takeaway: '返回示意只连接几个抽象位置，不包含可执行步骤或内部调校信息。',
  },
  {
    label: '边界复盘',
    shortLabel: '复盘',
    question: '哪些内部机件被有意省略，为什么省略仍能解释循环？',
    hint: '对照输入联动框、循环指示器和被留空的内部区域。',
    takeaway: '击锤与击针内部机件不建模为可操作几何，循环教学仍可停留在外壳与闭锁层级。',
  },
])

export const m1GarandSteps = defineSteps([
  {
    label: '整体识别',
    shortLabel: '整体',
    question: '长支承外形、机匣与操作杆怎样构成并列的结构主线？',
    hint: '先沿枪管轴线观察，再寻找机匣侧方延伸的操作杆示意。',
    takeaway: '本展项采用 1940 年后常见的导气孔概念，集中解释 M1 Garand 的高层循环关系。',
  },
  {
    label: '承载外形',
    shortLabel: '外壳',
    question: '外部支承为什么要同时容纳机匣、枪管与侧方连杆？',
    hint: '比较木质支承轮廓、金属机匣体积和侧方通道的覆盖范围。',
    takeaway: '支承外形把多个系统组织为连续整体，剖面只显示彼此位置。',
  },
  {
    label: '旋转闭锁',
    shortLabel: '闭锁',
    question: '操作杆的纵向移动怎样与旋转枪机的状态变化关联？',
    hint: '观察侧方指示线到枪机旋转标记之间的时间差。',
    takeaway: '教学模型把纵向输入与旋转闭锁分成两个清楚的状态，不重建接触细节。',
  },
  {
    label: '导气概念',
    shortLabel: '能量',
    question: '抽象能量怎样从枪管前段关联到操作杆路径？',
    hint: '看抽象能量先伴随透明惰性替代物离开，再点亮前段导气孔与侧方路径。',
    takeaway: '1940 年后的导气孔概念在这里仅表示抽象能量的分支，不给出工程参数。',
  },
  {
    label: '操作杆往复',
    shortLabel: '往复',
    question: '操作杆、旋转枪机与返回驱动怎样完成一次状态往返？',
    hint: '按循环指示依次观察后移、抽取示意、返回和再次闭锁。',
    takeaway: '单次机械循环把能量分支、操作杆与枪机联系起来，但不提供使用方法。',
  },
  {
    label: '供给复盘',
    shortLabel: '复盘',
    question: '整体式弹夹与透明惰性替代物路径怎样区别于盒式容器？',
    hint: '观察机匣内的弹夹轮廓和向上路径，不把它想象成外置盒体。',
    takeaway: '教学供给模块表示整体式弹夹，不是可拆卸盒式弹匣；这里只讲识别边界。',
  },
])

export const mp5Steps = defineSteps([
  {
    label: '标准外形',
    shortLabel: '整体',
    question: '管状机匣、支承外形与供给模块怎样构成 MP5 的标准轮廓？',
    hint: '从外部剪影进入透明机匣，识别轴线与下方供给体积。',
    takeaway: '本展项采用 HK MP5 的标准外形，只抽象呈现闭锁件与滚柱区域。',
  },
  {
    label: '机匣边界',
    shortLabel: '外壳',
    question: '机匣壳体如何为枪机组件和返回驱动划分连续通道？',
    hint: '沿壳体内部的长向空腔观察前后位置标记。',
    takeaway: '壳体示意只说明部件被约束在同一轴向区域，不展示制造结构。',
  },
  {
    label: '滚柱延迟',
    shortLabel: '延迟',
    question: '滚柱与闭锁件怎样用状态变化表达短暂延迟？',
    hint: '看两侧滚柱标记先保持外展，再与后移指示分阶段变化。',
    takeaway: '循环从闭膛（closed-bolt）的闭锁状态开始，以滚柱延迟反冲的高层顺序解释何时允许后移。',
  },
  {
    label: '惰性能量',
    shortLabel: '能量',
    question: '抽象能量与透明惰性替代物如何标记轴向事件？',
    hint: '观察短暂能量光带和透明惰性替代物的单向移动。',
    takeaway: '抽象能量只负责点亮状态转换，透明惰性替代物不包含内部结构信息。',
  },
  {
    label: '往复返回',
    shortLabel: '返回',
    question: '闭锁件后移与返回驱动怎样在示意时间线上先后出现？',
    hint: '按循环指示查看延迟结束、后移、返回与重新闭锁。',
    takeaway: '模型只播放一次机械状态往返，不展示连续模式或时序参数。',
  },
  {
    label: '路径复盘',
    shortLabel: '复盘',
    question: '怎样区分闭锁件路径、抽取路径和惰性替代物路径？',
    hint: '分别跟随三种颜色，确认它们的起点与终点并不相同。',
    takeaway: '颜色编码帮助理解滚柱延迟、返回与供给之间的关系，同时保持非行动化表达。',
  },
])

export const m1903Parts = defineParts([
  {
    id: 'firearm-support-shell',
    label: 'M1903 木质支承外形',
    englishLabel: 'M1903 stock support shell',
    system: '长体支承轮廓',
    stepId: 'whole',
    historicalFact:
      '国家公园管理局的 M1903 历史资料将该型枪置于斯普林菲尔德兵工厂的制式步枪发展脉络中，本展项据此限定年代身份。',
    simplifiedPrinciple:
      '连续的半透明外形只用来承托机匣与枪管轴线，帮助观察前后布局，不表达材料层次或真实连接方式。',
    prompt: '长条支承外形怎样把中央机匣与前方枪管组织在同一轴线上？',
    sourceId: 'nps-m1903-history',
    accent: 'brass',
    explodeOffset: [0, -0.55, 0],
  },
  {
    id: 'firearm-receiver-shell',
    label: 'M1903 机匣教学壳',
    englishLabel: 'M1903 receiver teaching shell',
    system: '枪机导向边界',
    stepId: 'exterior',
    historicalFact:
      '国家公园管理局的生产记录把 Model 1903 与斯普林菲尔德兵工厂的制造历史相连，展项不借用后期 M1903A3 的特征。',
    simplifiedPrinciple:
      '机匣教学壳用一段透明体积标出往复件受约束的范围，并让闭锁位置与供给区域保持清楚间隔。',
    prompt: '如果没有连续的机匣边界，往复件的前后位置会变得怎样难以判断？',
    sourceId: 'nps-m1903-production',
    accent: 'teal',
    explodeOffset: [0, 0.45, 0],
  },
  {
    id: 'firearm-barrel-chamber',
    label: 'M1903 枪管膛室轴线',
    englishLabel: 'M1903 barrel and chamber axis',
    system: '轴向通道基准',
    stepId: 'exterior',
    historicalFact:
      'M1903 馆史资料所描述的是旋转后拉枪机制式步枪，本卡仅把枪管与膛室视为连接机匣前端的历史识别要素。',
    simplifiedPrinciple:
      '一条封闭圆柱通道表示透明惰性替代物的轴向基准，也为枪机前端提供可视化对齐参照。',
    prompt: '枪管轴线为什么适合作为比较枪机、膛室与替代物位置的共同基准？',
    sourceId: 'nps-m1903-history',
    accent: 'oxide',
    explodeOffset: [0.75, 0.15, 0],
  },
  {
    id: 'firearm-breech-member',
    label: 'M1903 旋转后拉枪机',
    englishLabel: 'M1903 rotating bolt member',
    system: '手动往复构件',
    stepId: 'hull',
    historicalFact:
      '国家公园管理局以 M1903 记录这一历史型号；教学内容只保留其手动旋转后拉枪机这一高层识别关系。',
    simplifiedPrinciple:
      '抽象枪机先以颜色变化表示旋转状态，再沿机匣轴线改变位置，使两个不同方向的状态容易分辨。',
    prompt: '旋转状态与纵向位置分开显示后，哪一种变化应当先被观察？',
    sourceId: 'nps-m1903-history',
    accent: 'brass',
    explodeOffset: [-0.35, 0.35, 0],
  },
  {
    id: 'firearm-lock-delay-system',
    label: 'M1903 闭锁凸耳界面',
    englishLabel: 'M1903 locking-lug interface',
    system: '旋转约束关系',
    stepId: 'hull',
    historicalFact:
      'M1903 的历史识别与旋转枪机相连，展项用抽象凸耳对表示闭锁概念，并明确不混用 M1903A3 的外部识别特征。',
    simplifiedPrinciple:
      '两组色块只表达对齐时限制纵向移动、错开后解除限制的逻辑，不呈现真实接触面或制造信息。',
    prompt: '当两组抽象界面从对齐变为错开时，纵向约束会怎样改变？',
    sourceId: 'nps-m1903-production',
    accent: 'teal',
    explodeOffset: [-0.15, 0.75, 0.45],
  },
  {
    id: 'firearm-return-drive-system',
    label: 'M1903 手动返回轨迹',
    englishLabel: 'M1903 manual return track',
    system: '人机输入回路',
    stepId: 'running',
    historicalFact:
      'M1903 属于手动枪机历史类型，抽象投射体离开之后才由独立手动输入带来后续状态变化，不存在自动往复。',
    simplifiedPrinciple:
      '往返光带只把后方位置与前方位置连接起来，强调能量事件结束后需要新的外部输入才能改变状态。',
    prompt: '为什么抽象能量事件结束后，返回轨迹不会自行点亮？',
    sourceId: 'nps-m1903-history',
    accent: 'oxide',
    explodeOffset: [-0.55, 0.15, 0],
  },
  {
    id: 'firearm-input-linkage',
    label: 'M1903 输入联动框',
    englishLabel: 'M1903 input linkage frame',
    system: '输入状态隔离',
    stepId: 'details',
    historicalFact:
      'NPS 的历史页面用于确认 M1903 型号背景；本教学框不复原内部输入零件，只标记输入事件在时间线中的位置。',
    simplifiedPrinciple:
      '一个不可交互的框形标记把外部输入与抽象能量分离，避免把不同事件误读为连续的自动过程。',
    prompt: '把输入事件画成独立框格，怎样帮助区分它与抽象能量事件？',
    sourceId: 'nps-m1903-history',
    accent: 'brass',
    explodeOffset: [0, -0.35, -0.55],
  },
  {
    id: 'firearm-feed-module',
    label: 'M1903 固定供给体积',
    englishLabel: 'M1903 fixed feed volume',
    system: '内部供给边界',
    stepId: 'details',
    historicalFact:
      'M1903 生产史资料为型号与年代提供边界，本展项把机匣下方供给区域简化为封闭体积，不复刻内部零件。',
    simplifiedPrinciple:
      '封闭的暗色体积只说明透明惰性替代物从下方接近轴线，不展示装填、容纳结构或接触关系。',
    prompt: '供给体积位于轴线下方时，替代物路径需要产生怎样的方向变化？',
    sourceId: 'nps-m1903-production',
    accent: 'teal',
    explodeOffset: [0, -0.8, 0.35],
  },
  {
    id: 'firearm-extraction-path',
    label: 'M1903 后移抽取光线',
    englishLabel: 'M1903 rearward extraction trace',
    system: '后向路径辨识',
    stepId: 'running',
    historicalFact:
      '手动旋转后拉是 M1903 教学循环的历史识别重点，抽取光线因此只在枪机解除约束并后移之后出现。',
    simplifiedPrinciple:
      '一条向后的细线把膛室位置与后方观察区相连，用于区分构件移动和透明惰性替代物移动。',
    prompt: '为什么抽取光线要等到闭锁界面改变后才显示？',
    sourceId: 'nps-m1903-history',
    accent: 'oxide',
    explodeOffset: [-0.8, 0.45, -0.35],
  },
  {
    id: 'firearm-inert-round-path',
    label: 'M1903 透明惰性路径',
    englishLabel: 'M1903 transparent inert path',
    system: '替代物位置序列',
    stepId: 'power',
    historicalFact:
      'NPS 资料支撑 M1903 的历史身份；路径中的物体完全是透明惰性替代物，不代表任何可用物品。',
    simplifiedPrinciple:
      '半透明节点依次标出供给区、膛室轴线和离开方向，让观察者比较位置而不接触内部构造。',
    prompt: '三个分开的透明节点怎样表达替代物所在位置的先后？',
    sourceId: 'nps-m1903-history',
    accent: 'teal',
    explodeOffset: [0.45, 0.55, 0.65],
  },
  {
    id: 'firearm-cycle-indicator',
    label: 'M1903 单次循环指示',
    englishLabel: 'M1903 single-cycle indicator',
    system: '手动阶段时间线',
    stepId: 'details',
    historicalFact:
      'M1903 的手动机制边界要求每次后续变化由单独输入触发，因此指示器明确停在一个循环终点。',
    simplifiedPrinciple:
      '六格指示依次点亮整体、闭锁、抽象能量、后移、返回与复盘，结束后不会重复播放。',
    prompt: '在循环终点停止而不重复，能避免对机械关系产生什么误解？',
    sourceId: 'nps-m1903-history',
    accent: 'brass',
    explodeOffset: [-0.25, 1.05, 0],
  },
])

export const m1911a1Parts = defineParts([
  {
    id: 'firearm-support-shell',
    label: 'M1911A1 握持支承壳',
    englishLabel: 'M1911A1 grip support shell',
    system: '紧凑支承轮廓',
    stepId: 'whole',
    historicalFact:
      '史密森尼馆藏记录确认了 M1911A1 的历史对象身份，教学外形据此保留套筒与握持区域的总体比例关系。',
    simplifiedPrinciple:
      '握持支承壳只作为机匣下方的空间基准，让供给模块与上方往复外壳保持可辨认的相对位置。',
    prompt: '握持区域为什么适合作为比较上方轴线与下方供给体积的基准？',
    sourceId: 'smithsonian-m1911a1',
    accent: 'brass',
    explodeOffset: [0, -0.6, 0],
  },
  {
    id: 'firearm-receiver-shell',
    label: 'M1911A1 套筒导向壳',
    englishLabel: 'M1911A1 slide guide shell',
    system: '往复外壳边界',
    stepId: 'exterior',
    historicalFact:
      '美国陆军的 Browning 历史文章与史密森尼馆藏共同提供 M1911 系列背景，本卡只识别可见套筒外壳。',
    simplifiedPrinciple:
      '长条壳体用前后两个高亮位置表示受约束的往复区域，并为内部枪管提供共同观察窗口。',
    prompt: '用两个高亮位置表示套筒状态，比连续移动更容易看出什么？',
    sourceId: 'army-browning-m1911',
    accent: 'teal',
    explodeOffset: [-0.35, 0.45, 0],
  },
  {
    id: 'firearm-barrel-chamber',
    label: 'M1911A1 短后坐枪管',
    englishLabel: 'M1911A1 short-recoil barrel',
    system: '枪管共同位移',
    stepId: 'hull',
    historicalFact:
      'M1911 系列在高层机械史中与枪管短后坐相连，教学枪管仅显示与套筒共同移动的一小段状态变化。',
    simplifiedPrinciple:
      '枪管轴线先整体后移，随后后段位置轻微下移，以两个离散姿态说明共同移动与分离的先后。',
    prompt: '枪管与套筒先共同变化，再出现不同姿态，这说明了怎样的阶段关系？',
    sourceId: 'army-browning-m1911',
    accent: 'oxide',
    explodeOffset: [0.55, 0.2, 0],
  },
  {
    id: 'firearm-breech-member',
    label: 'M1911A1 套筒闭锁体',
    englishLabel: 'M1911A1 slide breech body',
    system: '后膛往复构件',
    stepId: 'hull',
    historicalFact:
      '史密森尼将馆藏对象记录为 M1911A1，本展项以套筒后段代表闭锁体积，不扩展到被遮蔽的小型机件。',
    simplifiedPrinciple:
      '后部色块与套筒同步改变位置，帮助观察枪管短后坐结束后外壳继续后移的差别。',
    prompt: '当枪管停止共同位移而闭锁体继续后移时，两者间距会怎样变化？',
    sourceId: 'smithsonian-m1911a1',
    accent: 'brass',
    explodeOffset: [-0.65, 0.2, 0],
  },
  {
    id: 'firearm-lock-delay-system',
    label: 'M1911A1 倾斜闭锁界面',
    englishLabel: 'M1911A1 tilting-lock interface',
    system: '倾斜解除约束',
    stepId: 'hull',
    historicalFact:
      '美国陆军的 Browning 历史文章直接支持 M1911 的短后坐描述；本卡的倾斜方向界面是项目原创教学几何，不把这部分可视化归于来源页面。',
    simplifiedPrinciple:
      '两个抽象接触区域在共同后移后发生上下错位，用几何状态表达闭锁关系解除而不呈现具体接触结构。',
    prompt: '上下错位为什么能直观表示原先的共同约束已经改变？',
    sourceId: 'army-browning-m1911',
    accent: 'teal',
    explodeOffset: [0.15, 0.75, 0.45],
  },
  {
    id: 'firearm-return-drive-system',
    label: 'M1911A1 返回储能带',
    englishLabel: 'M1911A1 return-energy band',
    system: '前向复位示意',
    stepId: 'running',
    historicalFact:
      'M1911A1 的单次短后坐循环包含外壳返回阶段，本卡仅以抽象储能带标出这一方向关系。',
    simplifiedPrinciple:
      '压缩与伸展只由光带疏密表示，外壳回到前方时枪管姿态也恢复到轴线基准。',
    prompt: '光带由密变疏时，外壳的位置指示会朝哪个方向变化？',
    sourceId: 'smithsonian-m1911a1',
    accent: 'oxide',
    explodeOffset: [0.4, -0.35, -0.45],
  },
  {
    id: 'firearm-input-linkage',
    label: 'M1911A1 输入隔离框',
    englishLabel: 'M1911A1 isolated input frame',
    system: '内部机件省略区',
    stepId: 'details',
    historicalFact:
      'Browning 历史资料用于说明 M1911 系列背景；击锤与击针内部机件不建模为可操作几何，也不显示联动接触。',
    simplifiedPrinciple:
      '空心框只标出输入事件与抽象能量事件的先后，让循环解释无需暴露小型内部构件。',
    prompt: '省略内部小型构件后，哪些外部状态仍足以说明循环先后？',
    sourceId: 'army-browning-m1911',
    accent: 'brass',
    explodeOffset: [-0.25, -0.55, -0.5],
  },
  {
    id: 'firearm-feed-module',
    label: 'M1911A1 供给轮廓模块',
    englishLabel: 'M1911A1 feed silhouette module',
    system: '下方供给区域',
    stepId: 'details',
    historicalFact:
      '史密森尼馆藏页用于确认 M1911A1 对象，本教学模块仅保留握持区域内的供给体积位置。',
    simplifiedPrinciple:
      '深色长方体与上方轴线通过一列透明节点相连，只表达位置迁移，不呈现内部保持结构。',
    prompt: '从握持区域向上到轴线的透明节点为什么需要按顺序点亮？',
    sourceId: 'smithsonian-m1911a1',
    accent: 'teal',
    explodeOffset: [0, -0.9, 0.35],
  },
  {
    id: 'firearm-extraction-path',
    label: 'M1911A1 外壳后移线',
    englishLabel: 'M1911A1 slide extraction trace',
    system: '后移路径分层',
    stepId: 'running',
    historicalFact:
      '美国陆军的 Browning 历史文章直接支持 M1911 的短后坐描述；后移线与倾斜闭锁教学姿态的先后由项目原创可视化安排，不归因于来源页面。',
    simplifiedPrinciple:
      '后移线分为短实线与较长虚线，分别对应共同移动阶段和外壳独立移动阶段。',
    prompt: '把后移路径分成实线与虚线，怎样帮助比较两个机械阶段？',
    sourceId: 'army-browning-m1911',
    accent: 'oxide',
    explodeOffset: [-0.8, 0.55, -0.25],
  },
  {
    id: 'firearm-inert-round-path',
    label: 'M1911A1 透明惰性序列',
    englishLabel: 'M1911A1 transparent inert sequence',
    system: '惰性物体位置图',
    stepId: 'power',
    historicalFact:
      '馆藏记录限定了历史外形，循环中的透明惰性替代物则完全由项目创建，只承担位置说明。',
    simplifiedPrinciple:
      '透明节点从供给区域移到轴线，再以单向淡出表示离开；抽象能量只在状态转换处短暂出现。',
    prompt: '透明节点从下方移到轴线时，哪两个结构边界提供位置参照？',
    sourceId: 'smithsonian-m1911a1',
    accent: 'teal',
    explodeOffset: [0.45, 0.5, 0.6],
  },
  {
    id: 'firearm-cycle-indicator',
    label: 'M1911A1 短后坐时间标',
    englishLabel: 'M1911A1 short-recoil timeline',
    system: '单次状态计时',
    stepId: 'details',
    historicalFact:
      '美国陆军的 Browning 历史文章直接支持 M1911 的短后坐描述；倾斜方向、闭锁状态与循环停点由项目原创教学时间线组织，不归因于来源页面。',
    simplifiedPrinciple:
      '时间标依次突出共同后移、倾斜变化、外壳后移与返回，最后停留在重新对齐状态。',
    prompt: '将时间标停在重新对齐状态，如何突出这是一次而非连续循环？',
    sourceId: 'army-browning-m1911',
    accent: 'brass',
    explodeOffset: [-0.25, 1.05, 0],
  },
])

export const m1GarandParts = defineParts([
  {
    id: 'firearm-support-shell',
    label: 'M1 Garand 木质支承外形',
    englishLabel: 'M1 Garand stock support shell',
    system: '长枪整体承托',
    stepId: 'whole',
    historicalFact:
      '史密森尼的 M1 Garand 馆藏记录与国家公园管理局的兵工厂历史共同限定了展项所指的历史对象。',
    simplifiedPrinciple:
      '木质外形被概括为连续支承体，用于联系机匣、枪管和侧方操作杆位置，不表达真实固定方式。',
    prompt: '连续支承体怎样帮助观察三个相隔较远的金属系统？',
    sourceId: 'smithsonian-m1',
    accent: 'brass',
    explodeOffset: [0, -0.55, 0],
  },
  {
    id: 'firearm-receiver-shell',
    label: 'M1 Garand 机匣导向壳',
    englishLabel: 'M1 Garand receiver guide shell',
    system: '中央循环边界',
    stepId: 'exterior',
    historicalFact:
      '国家公园管理局的 M1 变型资料用于区分历史轮廓，本教学机匣采用标准 M1 Garand 的高层外形边界。',
    simplifiedPrinciple:
      '半透明机匣把旋转枪机、整体式弹夹与供给路径置于同一观察窗口，便于比较上下关系。',
    prompt: '把枪机与弹夹轮廓放在同一个透明窗口中，最容易比较哪种关系？',
    sourceId: 'nps-m1-variations',
    accent: 'teal',
    explodeOffset: [0, 0.45, 0],
  },
  {
    id: 'firearm-barrel-chamber',
    label: 'M1 Garand 导气枪管轴线',
    englishLabel: 'M1 Garand gas-port barrel axis',
    system: '前段能量分支',
    stepId: 'power',
    historicalFact:
      '斯普林菲尔德兵工厂二战史支撑 M1 的生产语境，本展项明确采用 1940 年后常见的枪管导气孔概念。',
    simplifiedPrinciple:
      '主轴线旁的一条短分支只在抽象能量经过前段后点亮，用于表示能量关系而非内部细节。',
    prompt: '短分支为什么要等抽象能量沿主轴线经过后才出现？',
    sourceId: 'nps-springfield-ww2',
    accent: 'oxide',
    explodeOffset: [0.85, 0.15, 0],
  },
  {
    id: 'firearm-breech-member',
    label: 'M1 Garand 旋转枪机体',
    englishLabel: 'M1 Garand rotating bolt body',
    system: '枪机状态转换',
    stepId: 'hull',
    historicalFact:
      'M1 Garand 的公开历史资料将其与导气操作系统相连，教学枪机只保留旋转与纵向往返两个状态。',
    simplifiedPrinciple:
      '圆柱色块先旋转标记，再沿机匣改变位置，使闭锁变化与后移过程不会混成一个动作。',
    prompt: '先显示旋转标记再显示后移箭头，能澄清怎样的先后关系？',
    sourceId: 'nps-m1-variations',
    accent: 'brass',
    explodeOffset: [-0.3, 0.35, 0],
  },
  {
    id: 'firearm-lock-delay-system',
    label: 'M1 Garand 旋转闭锁界面',
    englishLabel: 'M1 Garand rotary locking interface',
    system: '枪机约束状态',
    stepId: 'hull',
    historicalFact:
      '国家公园管理局的 M1 资料用于限定型号，本卡把旋转枪机的闭锁关系压缩为两组抽象界面。',
    simplifiedPrinciple:
      '对齐色块表示纵向移动受限，旋转错开表示限制改变；模型不显示具体接触形状。',
    prompt: '界面颜色与朝向同时变化时，哪一个视觉线索更容易判断状态？',
    sourceId: 'nps-m1-variations',
    accent: 'teal',
    explodeOffset: [-0.15, 0.75, 0.45],
  },
  {
    id: 'firearm-return-drive-system',
    label: 'M1 Garand 操作杆返回带',
    englishLabel: 'M1 Garand operating-rod return band',
    system: '操作杆回程关系',
    stepId: 'running',
    historicalFact:
      'M1 的导气操作概念把枪管前段、操作杆与枪机联系起来，返回阶段在教学中被单独标记。',
    simplifiedPrinciple:
      '侧方长带先向后缩短再恢复前向长度，表示操作杆与枪机在一个状态周期中的共同往返。',
    prompt: '侧方长带与中央枪机同步变化时，怎样看出两者属于同一循环？',
    sourceId: 'army-firearm-systems',
    accent: 'oxide',
    explodeOffset: [0, -0.25, -0.65],
  },
  {
    id: 'firearm-input-linkage',
    label: 'M1 Garand 输入状态框',
    englishLabel: 'M1 Garand input state frame',
    system: '事件起点标识',
    stepId: 'details',
    historicalFact:
      'M1 的历史说明用于建立机械系统背景，输入状态框由项目原创，并不复原被遮蔽的内部联动零件。',
    simplifiedPrinciple:
      '单一框格只负责在时间线上标记抽象能量出现之前的独立事件，不允许直接操控任何构件。',
    prompt: '把事件起点与后续能量分支分开，能避免哪种因果混淆？',
    sourceId: 'army-firearm-systems',
    accent: 'brass',
    explodeOffset: [-0.2, -0.4, -0.5],
  },
  {
    id: 'firearm-feed-module',
    label: 'M1 Garand 整体式弹夹轮廓',
    englishLabel: 'M1 Garand en-bloc clip silhouette',
    system: '弹夹供给识别',
    stepId: 'details',
    historicalFact:
      'M1 Garand 的供给识别特征是整体式弹夹，本教学轮廓不是可拆卸盒式弹匣，也不展示内部保持细节。',
    simplifiedPrinciple:
      '一个浅色框架位于机匣内部，透明惰性替代物节点从框架内向轴线移动，仅说明空间顺序。',
    prompt: '位于机匣内部的框架与外置盒体在轮廓上有什么明显区别？',
    sourceId: 'smithsonian-m1',
    accent: 'teal',
    explodeOffset: [0, -0.75, 0.35],
  },
  {
    id: 'firearm-extraction-path',
    label: 'M1 Garand 后向抽取轨迹',
    englishLabel: 'M1 Garand rearward extraction trace',
    system: '枪机后移伴随线',
    stepId: 'running',
    historicalFact:
      '导气操作杆与旋转枪机的高层关系决定抽取轨迹只在闭锁状态改变并发生后移时显示。',
    simplifiedPrinciple:
      '细虚线从膛室区域向后延伸，与侧方操作杆带保持同步，但颜色不同以区分两类路径。',
    prompt: '两条同步但颜色不同的路径分别帮助追踪哪些对象？',
    sourceId: 'nps-m1-variations',
    accent: 'oxide',
    explodeOffset: [-0.75, 0.5, -0.35],
  },
  {
    id: 'firearm-inert-round-path',
    label: 'M1 Garand 透明惰性路线',
    englishLabel: 'M1 Garand transparent inert route',
    system: '弹夹至轴线序列',
    stepId: 'power',
    historicalFact:
      '史密森尼馆藏记录限定历史对象，路线中的透明惰性替代物则是完全独立的教学符号。',
    simplifiedPrinciple:
      '透明节点从整体式弹夹轮廓上方进入轴线，并在抽象能量出现后沿前方淡出。',
    prompt: '替代物从弹夹轮廓到轴线时，路径的垂直变化发生在哪里？',
    sourceId: 'smithsonian-m1',
    accent: 'teal',
    explodeOffset: [0.45, 0.55, 0.65],
  },
  {
    id: 'firearm-cycle-indicator',
    label: 'M1 Garand 导气循环指示',
    englishLabel: 'M1 Garand gas-cycle indicator',
    system: '单次能量时间线',
    stepId: 'details',
    historicalFact:
      '本展项以 1940 年后导气孔概念为边界，把 M1 Garand 循环限定为一次可暂停的状态序列。',
    simplifiedPrinciple:
      '指示器依次点亮抽象能量、前段分支、操作杆后移、枪机旋转、返回与停留状态。',
    prompt: '把前段分支放在操作杆后移之前，说明了怎样的因果次序？',
    sourceId: 'nps-springfield-ww2',
    accent: 'brass',
    explodeOffset: [-0.25, 1.05, 0],
  },
])

export const mp5Parts = defineParts([
  {
    id: 'firearm-support-shell',
    label: 'MP5 外部支承轮廓',
    englishLabel: 'MP5 external support silhouette',
    system: '标准外形基准',
    stepId: 'whole',
    historicalFact:
      'Heckler & Koch 官方产品页提供 MP5 系列的制造商背景，本展项采用其标准外形而不混入其他衍生轮廓。',
    simplifiedPrinciple:
      '外部剪影只负责定位管状机匣、前部支承和下方供给区域，内部均为项目原创抽象体。',
    prompt: '标准剪影中哪一条长向轮廓最适合用来定位机匣轴线？',
    sourceId: 'hk-mp5-official',
    accent: 'brass',
    explodeOffset: [0, -0.5, 0],
  },
  {
    id: 'firearm-receiver-shell',
    label: 'MP5 管状机匣教学壳',
    englishLabel: 'MP5 tubular receiver teaching shell',
    system: '闭锁组件通道',
    stepId: 'exterior',
    historicalFact:
      'HK 官方资料用于限定 MP5 标准轮廓，教学机匣仅保留容纳闭锁组件的长向空间关系。',
    simplifiedPrinciple:
      '透明长壳以三个位置标记闭锁、后移和返回状态，让内部构件始终在同一通道内比较。',
    prompt: '三个位置标记沿同一通道排列，怎样帮助判断构件移动方向？',
    sourceId: 'hk-mp5-official',
    accent: 'teal',
    explodeOffset: [0, 0.45, 0],
  },
  {
    id: 'firearm-barrel-chamber',
    label: 'MP5 枪管膛室基准',
    englishLabel: 'MP5 barrel and chamber reference',
    system: '前方轴线参照',
    stepId: 'exterior',
    historicalFact:
      '制造商页面把 MP5 置于其产品历史中，本卡仅用枪管与膛室轴线连接标准外形和闭锁组件位置。',
    simplifiedPrinciple:
      '封闭轴线为透明惰性替代物提供淡出方向，也为滚柱区域提供固定的前方参照。',
    prompt: '固定轴线如何帮助比较滚柱区域与后方闭锁件的相对位置？',
    sourceId: 'hk-mp5-official',
    accent: 'oxide',
    explodeOffset: [0.75, 0.1, 0],
  },
  {
    id: 'firearm-breech-member',
    label: 'MP5 闭锁件组合体',
    englishLabel: 'MP5 breech-member assembly',
    system: '后移状态主体',
    stepId: 'hull',
    historicalFact:
      'HK USA 的历史文章以滚柱延迟系统解释相关平台背景，教学组合体只显示前后两个离散状态。',
    simplifiedPrinciple:
      '前后色块在延迟标记改变后共同向后移动，用于表达闭锁件组合体的高层位移。',
    prompt: '为什么闭锁件要等滚柱状态标记改变后才显示后移？',
    sourceId: 'hk-roller-delay-history',
    accent: 'brass',
    explodeOffset: [-0.35, 0.35, 0],
  },
  {
    id: 'firearm-lock-delay-system',
    label: 'MP5 滚柱延迟界面',
    englishLabel: 'MP5 roller-delay interface',
    system: '延迟状态可视化',
    stepId: 'hull',
    historicalFact:
      '制造商历史资料将滚柱延迟反冲作为高层机械特征，本展项从闭锁状态开始说明这一关系。',
    simplifiedPrinciple:
      '两侧滚柱仅在外展与内收标记间切换，表示后移并非立刻发生，不呈现可用于复刻的接触几何。',
    prompt: '滚柱先改变状态、组合体后改变位置，这两步为什么要分开显示？',
    sourceId: 'hk-roller-delay-history',
    accent: 'teal',
    explodeOffset: [-0.1, 0.75, 0.5],
  },
  {
    id: 'firearm-return-drive-system',
    label: 'MP5 后方返回驱动带',
    englishLabel: 'MP5 rear return-drive band',
    system: '闭锁件前向返回',
    stepId: 'running',
    historicalFact:
      'MP5 的高层机械循环包含闭锁组件返回前方的阶段，教学带不复原实际内部弹性构件。',
    simplifiedPrinciple:
      '后方光带由压缩标记过渡到伸展标记，推动位置指示回到前端并重新建立闭锁状态。',
    prompt: '返回带恢复时，闭锁件与滚柱标记应当按什么先后出现？',
    sourceId: 'hk-mp5-official',
    accent: 'oxide',
    explodeOffset: [-0.55, 0.1, -0.4],
  },
  {
    id: 'firearm-input-linkage',
    label: 'MP5 输入事件隔离框',
    englishLabel: 'MP5 isolated input event frame',
    system: '事件与循环分隔',
    stepId: 'details',
    historicalFact:
      'HK 官方资料提供产品背景，输入事件隔离框完全由项目创建，不重建任何内部联动零件。',
    simplifiedPrinciple:
      '独立框格只启动一次抽象能量标记，随后立即失去交互性，使机械时间线保持单次播放。',
    prompt: '输入框只允许触发一次状态标记，如何帮助限定教学范围？',
    sourceId: 'hk-mp5-official',
    accent: 'brass',
    explodeOffset: [-0.2, -0.45, -0.55],
  },
  {
    id: 'firearm-feed-module',
    label: 'MP5 下方供给教学体',
    englishLabel: 'MP5 lower feed teaching volume',
    system: '供给区域定位',
    stepId: 'details',
    historicalFact:
      'MP5 标准轮廓具有易识别的下方供给区域，教学体只借此建立透明惰性替代物的起点。',
    simplifiedPrinciple:
      '弧形暗色体积与上方轴线通过稀疏透明节点相连，不表现内部容纳或保持结构。',
    prompt: '下方弧形轮廓如何帮助判断透明节点进入轴线的方向？',
    sourceId: 'hk-mp5-official',
    accent: 'teal',
    explodeOffset: [0, -0.85, 0.35],
  },
  {
    id: 'firearm-extraction-path',
    label: 'MP5 延迟后抽取线',
    englishLabel: 'MP5 post-delay extraction trace',
    system: '后向路径时序',
    stepId: 'running',
    historicalFact:
      '滚柱延迟的高层描述要求抽取线在延迟状态改变后才显示，本卡不展开更细的机构关系。',
    simplifiedPrinciple:
      '虚线从膛室基准向后延伸，并与闭锁件位置标记同步，以颜色区分对象与构件。',
    prompt: '抽取虚线延后出现，怎样强化滚柱状态先变化的时间关系？',
    sourceId: 'hk-roller-delay-history',
    accent: 'oxide',
    explodeOffset: [-0.75, 0.5, -0.35],
  },
  {
    id: 'firearm-inert-round-path',
    label: 'MP5 透明惰性位置带',
    englishLabel: 'MP5 transparent inert position band',
    system: '轴向替代物示意',
    stepId: 'power',
    historicalFact:
      '标准外形来自制造商背景资料，所有路径节点则是透明惰性替代物，不对应任何外部媒体或真实物品。',
    simplifiedPrinciple:
      '节点由下方向轴线迁移，在抽象能量出现时沿前方淡出，仅承担空间位置的连续提示。',
    prompt: '位置带从下方转入轴线时，机匣壳提供了怎样的参照边界？',
    sourceId: 'hk-mp5-official',
    accent: 'teal',
    explodeOffset: [0.45, 0.55, 0.65],
  },
  {
    id: 'firearm-cycle-indicator',
    label: 'MP5 滚柱循环指示器',
    englishLabel: 'MP5 roller-cycle indicator',
    system: '单次延迟时间线',
    stepId: 'details',
    historicalFact:
      'MP5 教学时间线只采用闭锁起点、滚柱状态变化、后移、返回和重新闭锁的高层顺序。',
    simplifiedPrinciple:
      '五段光标在一个循环后停住，不显示连续模式，也不提供时序数据或内部调节关系。',
    prompt: '让光标在重新闭锁后停住，为什么更适合高层机械教学？',
    sourceId: 'hk-roller-delay-history',
    accent: 'brass',
    explodeOffset: [-0.25, 1.05, 0],
  },
])

export const firearmCycleKinds = {
  m1903: 'manual-bolt',
  m1911a1: 'short-recoil',
  'm1-garand': 'gas-op-rod',
  mp5: 'roller-delay',
} as const satisfies Record<FirearmExhibitId, FirearmCycleKind>

export const firearmExhibits = {
  m1903: {
    id: 'm1903',
    category: 'firearm',
    title: 'M1903 Springfield',
    subtitle: '手动旋转后拉枪机教学剖面',
    diagramVariant: 'firearm',
    cycleKind: firearmCycleKinds.m1903,
    modelLabel: 'M1903 Springfield 可交互机械循环教学模型',
    reconstructionNote,
    steps: m1903Steps,
    parts: m1903Parts,
  },
  m1911a1: {
    id: 'm1911a1',
    category: 'firearm',
    title: 'M1911A1',
    subtitle: '枪管短后坐与倾斜闭锁教学剖面',
    diagramVariant: 'firearm',
    cycleKind: firearmCycleKinds.m1911a1,
    modelLabel: 'M1911A1 可交互机械循环教学模型',
    reconstructionNote,
    steps: m1911a1Steps,
    parts: m1911a1Parts,
  },
  'm1-garand': {
    id: 'm1-garand',
    category: 'firearm',
    title: 'M1 Garand',
    subtitle: '导气操作杆与旋转枪机教学剖面',
    diagramVariant: 'firearm',
    cycleKind: firearmCycleKinds['m1-garand'],
    modelLabel: 'M1 Garand 可交互机械循环教学模型',
    reconstructionNote,
    steps: m1GarandSteps,
    parts: m1GarandParts,
  },
  mp5: {
    id: 'mp5',
    category: 'firearm',
    title: 'HK MP5',
    subtitle: '滚柱延迟反冲教学剖面',
    diagramVariant: 'firearm',
    cycleKind: firearmCycleKinds.mp5,
    modelLabel: 'HK MP5 可交互机械循环教学模型',
    reconstructionNote,
    steps: mp5Steps,
    parts: mp5Parts,
  },
} as const satisfies Record<FirearmExhibitId, ExhibitDefinition>
