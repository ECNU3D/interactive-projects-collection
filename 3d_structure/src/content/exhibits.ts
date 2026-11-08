import { asr10Parts, asr10Steps } from './asr10'
import { firearmExhibits } from './firearms'
import { m4Parts, m4Steps } from './m4'
import type { ExhibitDefinition, ExhibitId } from './types'
import { x57Parts, x57Steps } from './x57'

export const exhibits = {
  m4: {
    id: 'm4',
    category: 'tank',
    title: 'M4 中型坦克',
    subtitle: '从动力舱到履带',
    diagramVariant: 'tank',
    modelLabel: 'M4 中型坦克结构教学模型',
    reconstructionNote:
      '项目原创的程序化教育示意，用于解释系统层次与相对位置，不是工程级数字孪生。',
    steps: m4Steps,
    parts: m4Parts,
  },
  x57: {
    id: 'x57',
    category: 'aircraft',
    title: 'NASA X-57 Maxwell',
    subtitle: 'Mod IV 分布式电推进研究构型',
    diagramVariant: 'aircraft',
    modelLabel: 'NASA X-57 Mod IV 结构教学模型',
    reconstructionNote:
      '项目原创的程序化教育示意。X-57 的 Mod IV 是规划与研究构型，项目在首次飞行前结束；模型不把地面、风洞、仿真或部件结果描述成整机实飞结论。',
    steps: x57Steps,
    parts: x57Parts,
  },
  asr10: {
    id: 'asr10',
    category: 'vessel',
    title: '海上救援结构实验室',
    subtitle: 'ASR-10 启发的教学复合模型',
    diagramVariant: 'vessel',
    modelLabel: '现代救援船通用结构教学复合模型',
    reconstructionNote:
      '历史 ASR-10 是系泊式海上应急避难设施，依靠无线电呼叫快速救援船；三维船只是受其救援叙事启发的现代救援船教学复合模型，不是 ASR-10 原物或任何真实艇型的复刻。',
    steps: asr10Steps,
    parts: asr10Parts,
  },
  ...firearmExhibits,
} as const satisfies Record<ExhibitId, ExhibitDefinition>

export function getExhibit(exhibitId: ExhibitId): ExhibitDefinition {
  return exhibits[exhibitId]
}
