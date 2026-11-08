import type { Asr10PartId, ExploreStep, PartDefinition } from './types'

export const asr10Steps = [
  {
    id: 'whole',
    index: 0,
    label: '整艇概览',
    shortLabel: '整艇',
    question: '船体怎样同时排开水、承载系统并提供工作平台？',
    hint: '从水线附近观察船体包围的体积，再看甲板、上层建筑与内部空间怎样叠放。',
    takeaway: '船体排开水形成浮力，同时把结构、机械与人员空间组织成工作平台；眼前是现代救援艇原理的教学复合模型。',
  },
  {
    id: 'exterior',
    index: 1,
    label: '船体骨架',
    shortLabel: '骨架',
    question: '外壳、甲板与上层建筑怎样围成可工作的船内空间？',
    hint: '先找水下外壳，再沿舷侧向上观察甲板边界和驾驶空间。',
    takeaway: '外壳围出排水体积，甲板封闭上方并承载活动，上层建筑提供受保护空间；几何不对应任何真实艇型。',
  },
  {
    id: 'hull',
    index: 2,
    label: '内部空间',
    shortLabel: '内部',
    question: '为什么救援船会把内部划分成不同功能的空间？',
    hint: '观察横向隔开的浮力舱、低处的排水示意与靠近工作甲板的人员空间。',
    takeaway: '分舱帮助限制进水影响，排水系统关注低处积水，人员区则让救援对象离开露天环境；这些都是通用原理。',
  },
  {
    id: 'power',
    index: 3,
    label: '动力传递',
    shortLabel: '动力',
    question: '发动机产生的旋转怎样经过传动路径推动水？',
    hint: '从两个抽象发动机模块出发，沿轴线一直看到船尾的螺旋桨示意。',
    takeaway: '发动机产生旋转，传动路径把旋转送到螺旋桨，螺旋桨推动水并获得反向作用；它们不是历史 ASR-10 的结构。',
  },
  {
    id: 'running',
    index: 4,
    label: '航向控制',
    shortLabel: '航向',
    question: '船尾的水流变化怎样与驾驶空间里的观察信息联系起来？',
    hint: '看螺旋桨后方的舵面，再沿信息光线找到驾驶舱与观察桅杆。',
    takeaway: '舵面改变附近水流并产生转向作用，驾驶空间汇总观察与系统状态；模型不提供驾驶或设备操作方法。',
  },
  {
    id: 'details',
    index: 5,
    label: '系统协作',
    shortLabel: '协作',
    question: '排水、救援甲板与人员空间怎样共同支持海上救援？',
    hint: '把低处的积水路径、开阔的工作面和受保护的安置空间连成一条观察路线。',
    takeaway: '稳定的平台、可管理的内部空间和清晰的信息共同支持救援工作；本展品只解释结构关系，不教授救援程序。',
  },
] as const satisfies readonly ExploreStep[]

export const asr10Parts = [
  {
    id: 'vessel-hull-shell',
    label: '船体外壳',
    englishLabel: 'Hull shell',
    system: '浮力与承载',
    stepId: 'exterior',
    historicalFact:
      'NOAA 的浮力教育资料说明，船体通过排开一定体积的水获得向上的浮力；船体形状也会影响与水接触时的阻力。',
    simplifiedPrinciple:
      '教学复合模型用一个连续曲面围出排水体积，只比较浮力与空间关系，不提供真实船体线型、尺度或结构参数。',
    prompt: '当船体包围的排水体积增大时，能够排开的水会怎样变化？',
    sourceId: 'noaa-boat-buoyancy',
    accent: 'teal',
    explodeOffset: [0, -0.45, 0],
  },
  {
    id: 'deck-superstructure',
    label: '甲板与上层建筑',
    englishLabel: 'Deck and superstructure',
    system: '工作平台',
    stepId: 'exterior',
    historicalFact:
      'RNLI 的救援艇资料把水密驾驶室、露天工作区与船体空间作为相互联系的区域；这是现代救援艇的通用布局思路。',
    simplifiedPrinciple:
      '教学复合模型用水平甲板和封闭上层体积表示干湿区域边界，它们不是历史 ASR-10 原物的甲板或上层建筑。',
    prompt: '为什么露天工作面与受保护空间都需要方便地到达？',
    sourceId: 'rnli-brede-lifeboat',
    accent: 'brass',
    explodeOffset: [0, 0.65, 0],
  },
  {
    id: 'buoyancy-compartments',
    label: '水密与浮力舱',
    englishLabel: 'Watertight buoyancy compartments',
    system: '分舱与稳性',
    stepId: 'hull',
    historicalFact:
      'IMO 说明船舶分舱的高层目标是限制进水扩散并帮助船舶保持浮航与稳定；这里引用的是现代船舶通用原理。',
    simplifiedPrinciple:
      '教学复合模型用隔开的透明体积表示分舱，不属于历史 ASR-10 的内部复原，也不能用于真实船舶稳性计算。',
    prompt: '如果一个空间进水，完整的边界为什么可能减慢水向其他区域扩散？',
    sourceId: 'imo-damage-stability',
    accent: 'teal',
    explodeOffset: [0, 0.2, 0.85],
  },
  {
    id: 'twin-engine-modules',
    label: '双发动机模块',
    englishLabel: 'Twin engine modules',
    system: '动力系统',
    stepId: 'power',
    historicalFact:
      'RNLI 的 Brede 原型艇资料记录了双发动机与各自传动系统的现代救援艇实例；这不是历史 ASR-10 的动力配置。',
    simplifiedPrinciple:
      '教学复合模型以两个抽象方块表示并列动力源，只说明旋转从哪里开始，并非历史 ASR-10 原物或真实发动机复刻。',
    prompt: '两个并列动力源会让传动路径呈现怎样的左右关系？',
    sourceId: 'rnli-brede-lifeboat',
    accent: 'oxide',
    explodeOffset: [-0.45, 0.35, 0],
  },
  {
    id: 'shaft-paths',
    label: '传动轴路径',
    englishLabel: 'Shaft paths',
    system: '动力传递',
    stepId: 'power',
    historicalFact:
      'RNLI 的 Brede 资料把发动机、减速传动和螺旋桨列为相连的现代推进链；它们并非历史 ASR-10 的原物结构。',
    simplifiedPrinciple:
      '教学复合模型用两条直线表示旋转能量朝船尾移动的通用原理，不属于历史 ASR-10，也不表达轴系尺寸或安装角度。',
    prompt: '为什么传动路径需要把船内的旋转送到与水接触的位置？',
    sourceId: 'rnli-brede-lifeboat',
    accent: 'brass',
    explodeOffset: [0, -0.25, 0.55],
  },
  {
    id: 'propeller-concept',
    label: '螺旋桨示意',
    englishLabel: 'Propeller concept',
    system: '水中推进',
    stepId: 'power',
    historicalFact:
      'RNLI 的 Brede 原型艇使用双发动机与螺旋桨推进，为现代救援艇提供一个公开实例；它不是历史 ASR-10 的推进装置。',
    simplifiedPrinciple:
      '教学复合模型让抽象桨叶推动水流光带，只说明作用与反作用的通用原理，并非历史 ASR-10 原物或可制造桨形。',
    prompt: '螺旋桨把水推向后方时，船体会获得哪个方向的作用？',
    sourceId: 'rnli-brede-lifeboat',
    accent: 'oxide',
    explodeOffset: [-0.75, -0.15, 0.75],
  },
  {
    id: 'rudder-steering',
    label: '舵与转向',
    englishLabel: 'Rudder and steering',
    system: '航向控制',
    stepId: 'running',
    historicalFact:
      'RNLI 的 Brede 资料提到螺旋桨、操纵性和备用舵柄，说明舵系属于现代救援艇的航向控制关系；不是历史 ASR-10 结构。',
    simplifiedPrinciple:
      '教学复合模型用可轻微偏转的平面表示改变水流方向的通用原理，不属于历史 ASR-10，也不提供驾驶方法或舵角参数。',
    prompt: '舵面转动后，流过它的水会在哪个方向发生偏转？',
    sourceId: 'rnli-brede-lifeboat',
    accent: 'teal',
    explodeOffset: [-0.6, 0.2, -0.75],
  },
  {
    id: 'bilge-pump-path',
    label: '泵舱与舱底排水',
    englishLabel: 'Bilge pump path',
    system: '积水管理',
    stepId: 'details',
    historicalFact:
      'RNLI 的现代集成管理系统把舱底状态与发动机、电气等信息共同监测；这类泵路与监测并非历史 ASR-10 原物。',
    simplifiedPrinciple:
      '教学复合模型用低处汇集点和向外光线表示一般舱底排水概念，不属于历史 ASR-10，也不展示阀门、管径或操作程序。',
    prompt: '为什么积水汇集与监测位置通常需要关注船内较低区域？',
    sourceId: 'rnli-sims-bridge',
    accent: 'oxide',
    explodeOffset: [0.25, -0.55, 0],
  },
  {
    id: 'wheelhouse-observation-mast',
    label: '驾驶舱与观察桅杆',
    englishLabel: 'Wheelhouse and observation mast',
    system: '观察与信息',
    stepId: 'running',
    historicalFact:
      'RNLI 资料说明现代救援艇可在驾驶空间集中呈现导航、通信、发动机和舱底等信息；这些设备不是历史 ASR-10 原物。',
    simplifiedPrinciple:
      '教学复合模型用窗面、桅杆和信息光点表示观察与状态汇总的通用原理，并非历史 ASR-10 驾驶台或设备布局。',
    prompt: '把外部观察与内部系统状态集中起来，能减少哪些信息往返？',
    sourceId: 'rnli-sims-bridge',
    accent: 'brass',
    explodeOffset: [0.4, 1.2, 0],
  },
  {
    id: 'rescue-work-deck',
    label: '救援工作甲板',
    englishLabel: 'Rescue work deck',
    system: '救援工作区',
    stepId: 'details',
    historicalFact:
      'RNLI 的 Brede 资料描述了可从露天区域把担架直接送入前舱的空间联系，体现现代救援艇重视工作面与内部通道。',
    simplifiedPrinciple:
      '教学复合模型用一块开阔平面表示人员与物品的临时工作空间，不复刻具体艇型，也不教授靠近、转移或救援程序。',
    prompt: '工作甲板与受保护空间之间为什么需要清楚、少转折的联系？',
    sourceId: 'rnli-brede-lifeboat',
    accent: 'oxide',
    explodeOffset: [0.65, 0.8, 0],
  },
  {
    id: 'survivor-space',
    label: '人员安置空间',
    englishLabel: 'Survivor accommodation space',
    system: '受保护空间',
    stepId: 'hull',
    historicalFact:
      '历史 ASR-10 是系泊式应急避难设施，馆藏记录提到食物、饮水和铺位；现代 RNLI 救援艇也重视让获救人员减少暴露。',
    simplifiedPrinciple:
      '教学复合模型用温暖色体积表示临时受保护空间；它借用“先安置人员”的救援叙事，但不是历史 ASR-10 内部复原。',
    prompt: '让刚离开海面的人进入干燥、受保护的空间，首先改变了哪些环境条件？',
    sourceId: 'scottish-maritime-asr10',
    accent: 'brass',
    explodeOffset: [0.55, 0.45, -0.55],
  },
] as const satisfies readonly PartDefinition<Asr10PartId>[]
