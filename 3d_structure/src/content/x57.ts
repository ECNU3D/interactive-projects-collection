import type { ExploreStep, PartDefinition, X57PartId } from './types'

export const x57Steps = [
  {
    id: 'whole',
    index: 0,
    label: '整机概览',
    shortLabel: '整机',
    question: '研究团队为什么先从一架已有的轻型飞机开始改造？',
    hint: '比较机身、座舱与新机翼：有些结构来自基础飞机，有些专为电推进研究而规划。',
    takeaway: '沿用基础机身让研究团队能把注意力集中在电推进、机翼和系统整合；X-57 项目最终在首次飞行前结束。',
  },
  {
    id: 'exterior',
    index: 1,
    label: '气动骨架',
    shortLabel: '骨架',
    question: '细长机翼、尾翼和起落架分别怎样支持飞行研究？',
    hint: '先看横向展开的机翼，再找机尾的稳定面和机身下方的接地支点。',
    takeaway: '机翼产生主要升力，尾翼帮助保持姿态与方向，起落架在地面支撑飞机；模型只说明相对位置。',
  },
  {
    id: 'hull',
    index: 2,
    label: '分布推进',
    shortLabel: '推进',
    question: '为什么 Mod IV 设计把两种电机分布在机翼不同位置？',
    hint: '找翼尖的两台巡航电机，再数一数机翼前缘的十二个高升力位置。',
    takeaway: 'Mod IV 规划用两台翼尖电机服务巡航，并用十二台高升力电机在低速时改变机翼附近的气流；这套构型没有完成联合飞行。',
  },
  {
    id: 'power',
    index: 3,
    label: '储能供电',
    shortLabel: '供电',
    question: '两套电池与两条电力通道为什么要分开显示？',
    hint: '从机身里的两个储能体积出发，沿 A、B 两条抽象线路看向左右推进系统。',
    takeaway: '分开的储能与供电通道帮助研究团队观察故障隔离和能量分配；示意线不代表真实线束路径。',
  },
  {
    id: 'running',
    index: 4,
    label: '功率变换',
    shortLabel: '变换',
    question: '电池送出的直流电为什么不能只靠一根线直接驱动电机？',
    hint: '在电池与电机之间寻找控制器，它们负责调节送往电机的电流。',
    takeaway: '功率控制器把储能系统的直流电调节为电机需要的形式，同时接受控制命令并报告状态。',
  },
  {
    id: 'details',
    index: 5,
    label: '感知散热',
    shortLabel: '监测',
    question: '研究人员怎样同时看见电系统状态和热量去向？',
    hint: '观察座舱显示与控制器外壳周围的冷却风路，想想传感器把什么信息带回座舱。',
    takeaway: '监测系统把关键状态集中呈现，被动风路和散热表面带走部分热量；这些工作属于地面与部件研究成果。',
  },
] as const satisfies readonly ExploreStep[]

export const x57Parts = [
  {
    id: 'airframe-cabin',
    label: '基础机身与座舱',
    englishLabel: 'Baseline airframe and cabin',
    system: '研究平台',
    stepId: 'whole',
    historicalFact:
      'NASA 以 Tecnam P2006T 轻型飞机为基础逐步规划 X-57 改装，使电推进系统、实验机翼和研究仪表能够分阶段整合。',
    simplifiedPrinciple:
      '模型保留熟悉的机身与座舱轮廓，只用于说明“基础平台加实验系统”的关系，不复原结构尺寸、材料或内部操纵装置。',
    prompt: '保留基础机身能帮助研究团队减少哪些同时变化的因素？',
    sourceId: 'nasa-x57-project',
    accent: 'brass',
    explodeOffset: [0, 0.35, 0],
  },
  {
    id: 'high-aspect-wing',
    label: '高展弦比机翼',
    englishLabel: 'High-aspect-ratio wing',
    system: '气动结构',
    stepId: 'exterior',
    historicalFact:
      'NASA 的 Mod III/IV 研究构型规划使用面积更小、展弦比更高的实验机翼，以研究巡航效率与分布式推进的气动关系。',
    simplifiedPrinciple:
      '模型把机翼画得细长，帮助比较翼展与翼弦的比例；它不呈现真实翼型、载荷、蒙皮厚度或可制造尺寸。',
    prompt: '当翼展相对翼弦变长时，机翼的整体轮廓发生了什么变化？',
    sourceId: 'nasa-x57-overview',
    accent: 'teal',
    explodeOffset: [0, 0.85, 0],
  },
  {
    id: 'tail-control-surfaces',
    label: '尾翼与操纵面',
    englishLabel: 'Tail and control surfaces',
    system: '姿态稳定',
    stepId: 'exterior',
    historicalFact:
      'X-57 的改装路线保留基础飞机机身与尾部总体关系，让研究重点集中在电推进系统及实验机翼的整合。',
    simplifiedPrinciple:
      '模型用水平面和垂直面表示尾部稳定结构，用轻微偏转说明气流可产生姿态变化，不给出控制方法或飞行参数。',
    prompt: '为什么飞机需要同时有水平和垂直方向的尾部表面？',
    sourceId: 'nasa-x57-project',
    accent: 'teal',
    explodeOffset: [-0.8, 0.55, 0],
  },
  {
    id: 'landing-gear',
    label: '起落架',
    englishLabel: 'Landing gear',
    system: '地面支撑',
    stepId: 'exterior',
    historicalFact:
      'NASA 的 X-57 项目总结明确说明项目在首次飞行前结束；本卡只把起落架作为模型中的地面支点，不推断具体测试活动或飞行成果。',
    simplifiedPrinciple:
      '模型用三个接地点表示地面承载与姿态支撑，只比较相对位置，不展示减震、制动、转向或起降操作。',
    prompt: '三个相隔较远的接地点怎样帮助飞机在地面保持稳定？',
    sourceId: 'nasa-x57-project',
    accent: 'brass',
    explodeOffset: [0, -0.65, 0],
  },
  {
    id: 'wingtip-cruise-motors',
    label: '翼尖巡航电机',
    englishLabel: 'Wingtip cruise motors',
    system: '巡航推进',
    stepId: 'hull',
    historicalFact:
      'Mod III/IV 设计把两台巡航电机布置在机翼尖端，用于研究推进与翼尖气流的相互作用；电动构型最终没有完成飞行。',
    simplifiedPrinciple:
      '模型让翼尖两处旋转光环表示巡航推力方向，只解释位置与能量流，不呈现螺旋桨尺寸、电机参数或控制方式。',
    prompt: '把巡航电机移到翼尖，会让推进气流与机翼在哪个区域相遇？',
    sourceId: 'ntrs-x57-modiv-performance',
    accent: 'oxide',
    explodeOffset: [0.25, 0.25, 1.25],
  },
  {
    id: 'high-lift-motor-array',
    label: '十二台高升力电机',
    englishLabel: 'Twelve high-lift motors',
    system: '低速气流研究',
    stepId: 'hull',
    historicalFact:
      'NASA 的 Mod IV 规划在实验机翼前缘增加十二台高升力电机，以比较低速性能；项目结束前没有完成这套构型的整机飞行。',
    simplifiedPrinciple:
      '模型用十二个等距节点展示分布概念，并以气流带说明局部加速；它不代表真实推力、转速、桨距或联合飞行结果。',
    prompt: '许多小推进点怎样让气流分布区别于少数大推进点？',
    sourceId: 'ntrs-x57-modiv-performance',
    accent: 'oxide',
    explodeOffset: [0.45, 0.55, 0],
  },
  {
    id: 'battery-modules',
    label: '锂离子电池组',
    englishLabel: 'Lithium-ion battery modules',
    system: '储能系统',
    stepId: 'power',
    historicalFact:
      'NASA 对 X-57 的电池与高压电气系统进行了地面测试，项目总结把这些测试列为在首次飞行前仍然取得的重要研究经验。',
    simplifiedPrinciple:
      '模型用两个封闭体积表示分开的储能集合，只说明能量储存与系统分区，不展示电芯排布、容量、电压或维护方法。',
    prompt: '把储能分成两个区域，能让研究人员分别观察哪些状态？',
    sourceId: 'nasa-x57-project',
    accent: 'teal',
    explodeOffset: [-0.25, 0.75, 0],
  },
  {
    id: 'dual-power-bus',
    label: 'A/B 电力通道',
    englishLabel: 'A/B traction-power channels',
    system: '电力分配',
    stepId: 'power',
    historicalFact:
      'NASA 技术资料将 X-57 牵引电力系统描述为相互区分的电池与配电通道，用于系统整合、故障研究和推进供电。',
    simplifiedPrinciple:
      '模型用两种并行光线表示 A/B 能量通道，帮助追踪“从储能到负载”的方向；线路不是实际线束位置或接线图。',
    prompt: '两条通道并行而不混成一条线，观察故障时有什么好处？',
    sourceId: 'ntrs-x57-power',
    accent: 'brass',
    explodeOffset: [0, 0.15, 0.85],
  },
  {
    id: 'inverter-controllers',
    label: '逆变器与控制器',
    englishLabel: 'Inverters and motor controllers',
    system: '功率变换',
    stepId: 'running',
    historicalFact:
      'X-57 牵引电力与指令系统研究涵盖巡航电机控制器，它们在电池供电、推进电机和指令系统之间承担功率调节与状态交换。',
    simplifiedPrinciple:
      '模型用中间模块和脉冲光表示“直流储能—受控电流—电机”的高层关系，不给出电路、开关频率或调试步骤。',
    prompt: '为什么功率调节模块要位于电池与电机之间？',
    sourceId: 'ntrs-x57-power',
    accent: 'oxide',
    explodeOffset: [0.55, 0.25, 0],
  },
  {
    id: 'cockpit-monitoring',
    label: '驾驶舱监测系统',
    englishLabel: 'Cockpit monitoring system',
    system: '感知与显示',
    stepId: 'details',
    historicalFact:
      'NASA 为 X-57 开发的座舱显示系统汇集巡航电机、控制器、电池控制模块和多处温度信息，也支持地面测试中的核验。',
    simplifiedPrinciple:
      '模型用仪表面板上的分区光点表示多系统状态汇总，只解释信息流向，不重建真实画面、警告逻辑或驾驶操作。',
    prompt: '哪些电气与温度信息适合在同一块研究显示器上比较？',
    sourceId: 'ntrs-x57-cockpit',
    accent: 'brass',
    explodeOffset: [0.8, 0.75, 0],
  },
  {
    id: 'passive-cooling-path',
    label: '被动冷却路径',
    englishLabel: 'Passive cooling path',
    system: '热管理',
    stepId: 'details',
    historicalFact:
      'NASA 的座舱显示与控制器资料记录了温度测量、控制器壳体散热片和内部导热垫等热管理研究对象。',
    simplifiedPrinciple:
      '模型用缓慢流动的半透明带表示热量从部件到表面、再被周围气流带走的概念，不表示真实温度或风道尺寸。',
    prompt: '增大与空气接触的散热表面，可能怎样改变热量离开的速度？',
    sourceId: 'ntrs-x57-cockpit',
    accent: 'teal',
    explodeOffset: [0.3, 1.05, -0.55],
  },
] as const satisfies readonly PartDefinition<X57PartId>[]
