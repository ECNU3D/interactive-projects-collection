import type { ExploreStep, PartDefinition } from './types'

export const m4Steps = [
  {
    id: 'whole',
    index: 0,
    label: '观察整体',
    shortLabel: '整体',
    question: '哪些形状帮助这台机械跨过不平整地面？',
    hint: '先找又宽又长的履带，再看看许多轮子怎样排成一列。',
    takeaway: '宽履带把重量分散到更大的地面，成组轮子则帮助机械贴着起伏前进。',
  },
  {
    id: 'exterior',
    index: 1,
    label: '外部结构',
    shortLabel: '外部',
    question: '车体、炮塔和履带分别承担什么任务？',
    hint: '从下往上看：履带接触地面，车体容纳系统，炮塔位于车体上方。',
    takeaway: '外部结构分工不同：履带负责接触地面，车体组织内部，炮塔形成上方旋转空间。',
  },
  {
    id: 'hull',
    index: 2,
    label: '打开车体',
    shortLabel: '车体',
    question: '有限空间里，乘员与机械怎样分区？',
    hint: '留意半透明的人体活动空间，再找它旁边的动力和传动结构。',
    takeaway: '乘员与机械共享有限空间，因此通道、操作空间和大型部件需要彼此错开。',
  },
  {
    id: 'power',
    index: 3,
    label: '动力传递',
    shortLabel: '动力',
    question: '旋转怎样从发动机一路到达驱动轮？',
    hint: '从后部发动机开始，沿着车体中的抽象传动路径一直看到驱动轮。',
    takeaway: '发动机产生旋转，传动系统改变并传递旋转，最后由驱动轮带动履带循环。',
  },
  {
    id: 'running',
    index: 4,
    label: '悬挂与行走',
    shortLabel: '行走',
    question: '为什么履带不是直接固定在车体上？',
    hint: '比较车体和负重轮：轮子需要有一点上下移动的空间。',
    takeaway: '悬挂让轮子追随地面起伏并分担冲击，履带才能尽量保持连续接触。',
  },
  {
    id: 'details',
    index: 5,
    label: '关键零件',
    shortLabel: '零件',
    question: '观察、缓冲和支撑系统如何协同？',
    hint: '分别找视线、缓冲运动和支撑车体的结构，再想它们帮助了谁。',
    takeaway: '观察提供外部信息，缓冲减慢快速变化，支撑系统保持机械稳定；它们共同帮助系统协作。',
  },
] as const satisfies readonly ExploreStep[]

export const m4Parts = [
  {
    id: 'hull-shell',
    label: '车体外壳',
    englishLabel: 'Hull shell',
    system: '承载与防护',
    stepId: 'exterior',
    historicalFact:
      '公开的 M4A4 剖面资料显示，车体内部同时安排乘员区域、动力相关结构与贯穿车体的传动关系。',
    simplifiedPrinciple:
      '模型把车体做成可淡化、可移开的整体外壳，只帮助观察空间分区与承载关系，不表示真实厚度。',
    prompt: '发动机区域为什么需要留出通风路径？',
    sourceId: 'm4-cutaway',
    accent: 'brass',
    explodeOffset: [0, 0.35, 0],
    dimAfterStep: 3,
  },
  {
    id: 'turret-shell',
    label: '炮塔与旋转环',
    englishLabel: 'Turret and ring',
    system: '旋转平台',
    stepId: 'exterior',
    historicalFact:
      '公开剖面资料显示，炮塔位于车体上方，并通过大直径旋转环与车体中的内部空间相接。',
    simplifiedPrinciple:
      '模型把炮塔与旋转环合成一个观察模块，用相对转动说明空间关系，不还原内部机构或参数。',
    prompt: '较小的旋转环会怎样影响内部空间？',
    sourceId: 'm4-cutaway',
    accent: 'brass',
    explodeOffset: [0, 1.4, 0],
  },
  {
    id: 'engine-module',
    label: '星形发动机',
    englishLabel: 'Radial engine',
    system: '动力系统',
    stepId: 'power',
    historicalFact:
      '坦克博物馆资料说明，部分 M4A1 型使用大陆公司生产的星形发动机；不同 M4 型号的动力配置并不完全相同。',
    simplifiedPrinciple:
      '模型用九个圆柱体围成一圈，只表示星形排列与紧凑长度，不表示真实零件、尺寸或装配方式。',
    prompt: '放射状排列会怎样影响发动机的整体长度？',
    sourceId: 'tank-museum-m4a1',
    accent: 'oxide',
    explodeOffset: [-1.1, 0.25, 0],
  },
  {
    id: 'transmission-path',
    label: '传动路径',
    englishLabel: 'Transmission path',
    system: '动力系统',
    stepId: 'power',
    historicalFact:
      '公开剖面资料显示，M4 的动力舱位于车体后部，动力通过车体内部的传动关系连接前部驱动系统。',
    simplifiedPrinciple:
      '模型用一根轴和几个圆环表示能量流向，只解释旋转怎样被传递，不呈现齿轮细节、参数或操作。',
    prompt: '后部动力需要经过怎样的路径到达驱动轮？',
    sourceId: 'm4-cutaway',
    accent: 'oxide',
    explodeOffset: [0, -0.45, 0],
  },
  {
    id: 'suspension-left',
    label: '左侧悬挂',
    englishLabel: 'Left suspension',
    system: '行走系统',
    stepId: 'running',
    historicalFact:
      'M4 外部可见成组的负重轮与悬挂单元，左右两侧各自沿车体排列并支撑履带。',
    simplifiedPrinciple:
      '模型让左侧轮组轻微上下移动，用来观察悬挂分担冲击的概念，不复原真实行程或材料。',
    prompt: '刚性固定的车轮越过凸起时会发生什么？',
    sourceId: 'm4-cutaway',
    accent: 'teal',
    explodeOffset: [0, 0, 1.1],
  },
  {
    id: 'suspension-right',
    label: '右侧悬挂',
    englishLabel: 'Right suspension',
    system: '行走系统',
    stepId: 'running',
    historicalFact:
      'M4 外部可见成组的负重轮与悬挂单元，左右两侧各自沿车体排列并支撑履带。',
    simplifiedPrinciple:
      '模型让右侧轮组与左侧反向轻微移动，用来比较两侧独立响应，不表示真实行驶状态。',
    prompt: '左右两侧为什么需要分别响应地面变化？',
    sourceId: 'm4-cutaway',
    accent: 'teal',
    explodeOffset: [0, 0, -1.1],
  },
  {
    id: 'track-left',
    label: '左侧履带',
    englishLabel: 'Left track',
    system: '行走系统',
    stepId: 'running',
    historicalFact:
      'M4 的左右履带由许多相连的履带板形成闭合接地带，并绕轮组连续排列。',
    simplifiedPrinciple:
      '模型用重复的小块组成左侧履带，帮助观察接触面积和循环路径，不表示真实板形与连接尺寸。',
    prompt: '接触面积增大时，单位面积承受的压力怎样变化？',
    sourceId: 'm4-cutaway',
    accent: 'teal',
    explodeOffset: [0, -0.2, 1.65],
  },
  {
    id: 'track-right',
    label: '右侧履带',
    englishLabel: 'Right track',
    system: '行走系统',
    stepId: 'running',
    historicalFact:
      '公开剖面资料显示，右侧履带围绕驱动轮与多组支重轮形成连续的闭合路径。',
    simplifiedPrinciple:
      '模型把右侧履带做成规则环形排列，用来比较上下履带段与轮组的相对运动，不表示真实张紧状态。',
    prompt: '相对地面而言，哪一段履带在接触时近似静止？',
    sourceId: 'm4-cutaway',
    accent: 'teal',
    explodeOffset: [0, -0.2, -1.65],
  },
  {
    id: 'crew-space',
    label: '乘员空间',
    englishLabel: 'Crew space',
    system: '内部布局',
    stepId: 'hull',
    historicalFact:
      '公开剖面资料显示，乘员区域位于车体与炮塔下方，并与动力、传动等机械结构共享有限空间。',
    simplifiedPrinciple:
      '模型用半透明体积表示人需要的活动范围，只比较空间占用，不重建座椅、控制装置或操作位置。',
    prompt: '哪些相邻系统会占用乘员转身所需的空间？',
    sourceId: 'm4-cutaway',
    accent: 'teal',
    explodeOffset: [0.2, 0.7, 0],
  },
  {
    id: 'observation-system',
    label: '观察系统',
    englishLabel: 'Observation system',
    system: '观察与协作',
    stepId: 'details',
    historicalFact:
      '公开剖面资料显示，M4 在车体和炮塔上设置多个受保护的观察位置，帮助乘员了解不同方向。',
    simplifiedPrinciple:
      '模型用三个小外壳和发光线表示观察方向，只说明视线关系，不涉及火控、瞄准或使用方法。',
    prompt: '为什么受保护的空间仍需要观察多个方向？',
    sourceId: 'm4-cutaway',
    accent: 'brass',
    explodeOffset: [0.55, 1.05, 0.45],
  },
  {
    id: 'recoil-concept',
    label: '后坐缓冲示意',
    englishLabel: 'Recoil damping concept',
    system: '缓冲结构',
    stepId: 'details',
    historicalFact:
      '公开剖面资料标示炮塔内部存在与快速往复运动相关的缓冲组件，用于管理机械运动带来的冲击。',
    simplifiedPrinciple:
      '模型用两根圆柱做短暂的衰减移动，只解释缓冲与复位概念，不展示结构参数、装配或操作方法。',
    prompt: '如果冲击作用被延长，瞬间变化会怎样？',
    sourceId: 'm4-cutaway',
    accent: 'oxide',
    explodeOffset: [1.15, 0.95, 0],
  },
] as const satisfies readonly PartDefinition[]
