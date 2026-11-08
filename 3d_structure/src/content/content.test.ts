import { catalog } from './catalog'
import { asr10Parts, asr10Steps } from './asr10'
import { exhibits } from './exhibits'
import {
  firearmCycleKinds,
  firearmExhibitIds,
  firearmExhibits,
  firearmPartIds,
  m1903Parts,
  m1903Steps,
} from './firearms'
import { m4Parts, m4Steps } from './m4'
import { sources } from './sources'
import {
  exhibitIds,
  stepIds,
  type ExploreStep,
  type PartDefinition,
} from './types'
import { x57Parts, x57Steps } from './x57'

type ExactFirearmStepTuple = readonly [
  ExploreStep,
  ExploreStep,
  ExploreStep,
  ExploreStep,
  ExploreStep,
  ExploreStep,
]

type ExactFirearmPartTuple = readonly [
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

describe('museum content integrity', () => {
  it('lists all seven catalog exhibits as available in the approved order', () => {
    expect(catalog.map((item) => item.id)).toEqual([
      'm4',
      'x57',
      'asr10',
      'm1903',
      'm1911a1',
      'm1-garand',
      'mp5',
    ])
    expect(catalog.map((item) => item.category)).toEqual([
      'tank',
      'aircraft',
      'vessel',
      'firearm',
      'firearm',
      'firearm',
      'firearm',
    ])
    expect(catalog.every((item) => item.status === 'available')).toBe(true)
  })

  it('registers a complete six-stage, eleven-part contract for every exhibit', () => {
    expect(exhibitIds).toEqual([
      'm4',
      'x57',
      'asr10',
      'm1903',
      'm1911a1',
      'm1-garand',
      'mp5',
    ])
    expect(Object.keys(exhibits)).toEqual([
      'm4',
      'x57',
      'asr10',
      'm1903',
      'm1911a1',
      'm1-garand',
      'mp5',
    ])

    for (const exhibit of Object.values(exhibits)) {
      expect(exhibit.steps).toHaveLength(6)
      expect(exhibit.parts).toHaveLength(11)
      expect(exhibit.steps.map((step) => step.index)).toEqual([0, 1, 2, 3, 4, 5])
    }

    expect(x57Steps).toHaveLength(6)
    expect(x57Parts).toHaveLength(11)
    expect(asr10Steps).toHaveLength(6)
    expect(asr10Parts).toHaveLength(11)
  })

  it('registers the approved firearm cycle map', () => {
    expect(firearmExhibitIds).toEqual([
      'm1903',
      'm1911a1',
      'm1-garand',
      'mp5',
    ])
    expect(firearmCycleKinds).toEqual({
      m1903: 'manual-bolt',
      m1911a1: 'short-recoil',
      'm1-garand': 'gas-op-rod',
      mp5: 'roller-delay',
    })
    expect(
      Object.fromEntries(
        firearmExhibitIds.map((id) => [id, firearmExhibits[id].cycleKind]),
      ),
    ).toEqual(firearmCycleKinds)
  })

  it('uses the shared six-step and eleven-part firearm contracts', () => {
    expect(firearmPartIds).toEqual([
      'firearm-support-shell',
      'firearm-receiver-shell',
      'firearm-barrel-chamber',
      'firearm-breech-member',
      'firearm-lock-delay-system',
      'firearm-return-drive-system',
      'firearm-input-linkage',
      'firearm-feed-module',
      'firearm-extraction-path',
      'firearm-inert-round-path',
      'firearm-cycle-indicator',
    ])

    for (const exhibitId of firearmExhibitIds) {
      const exhibit = firearmExhibits[exhibitId]

      expect(exhibit.steps.map((step) => step.id)).toEqual(stepIds)
      expect(exhibit.parts.map((part) => part.id)).toEqual(firearmPartIds)
      expect(new Set(exhibit.parts.map((part) => part.label)).size).toBe(11)
      expect(new Set(exhibit.parts.map((part) => part.englishLabel)).size).toBe(11)
      expect(new Set(exhibit.parts.map((part) => part.system)).size).toBe(11)

      for (const part of exhibit.parts) {
        expect(part.label.length).toBeGreaterThan(3)
        expect(part.englishLabel.length).toBeGreaterThan(5)
        expect(part.system.length).toBeGreaterThan(3)
      }
    }
  })

  it('exposes exact firearm step and part tuples to TypeScript', () => {
    expectTypeOf(m1903Steps).toEqualTypeOf<ExactFirearmStepTuple>()
    expectTypeOf(m1903Parts).toEqualTypeOf<ExactFirearmPartTuple>()
  })

  it('pins firearm sources to official URLs without reusing external media', () => {
    const expectedSources = {
      'nps-m1903-history':
        'https://www.nps.gov/spar/learn/historyculture/the-1903-springfield-rifle.htm',
      'nps-m1903-production':
        'https://www.nps.gov/spar/learn/historyculture/u-s-springfield-model-1903-production.htm',
      'smithsonian-m1911a1':
        'https://americanhistory.si.edu/collections/object/nmah_415704',
      'army-browning-m1911':
        'https://www.army.mil/article/15705/arming_the_army_john_m_browning',
      'army-firearm-systems':
        'https://asc.army.mil/web/news-perseverance-pays-off/',
      'nps-springfield-ww2':
        'https://www.nps.gov/articles/springfieldarmoryww2.htm',
      'nps-m1-variations':
        'https://www.nps.gov/spar/learn/historyculture/m1-variations.htm',
      'smithsonian-m1':
        'https://www.americanhistory.si.edu/collections/object/nmah_418516',
      'hk-mp5-official':
        'https://www.heckler-koch.com/en/Products/Military%20and%20Law%20Enforcement/Submachine%20guns/MP5',
      'hk-roller-delay-history':
        'https://hk-usa.com/2019/12/03/heckler-koch-launches-the-new-sp5/',
    }
    const firearmSources = sources.filter((source) => source.id in expectedSources)

    expect(
      Object.fromEntries(firearmSources.map((source) => [source.id, source.url])),
    ).toEqual(expectedSources)
    expect(firearmSources).toHaveLength(10)
    for (const source of firearmSources) {
      expect(source.licenseNote).toMatch(/no external media is reused/i)
    }
  })

  it('keeps firearm reconstructions explicitly inert and non-actionable', () => {
    for (const exhibitId of firearmExhibitIds) {
      const exhibit = firearmExhibits[exhibitId]
      const teachingText = JSON.stringify({
        steps: exhibit.steps,
        parts: exhibit.parts,
      })

      expect(exhibit).toEqual(
        expect.objectContaining({
          category: 'firearm',
          diagramVariant: 'firearm',
          modelLabel: `${exhibit.title} 可交互机械循环教学模型`,
        }),
      )
      expect(exhibit.reconstructionNote).toMatch(
        /项目原创.*教学几何.*惰性示意.*非拆装.*不提供尺寸、参数或操作信息/,
      )
      expect(teachingText).toMatch(/透明惰性替代物/)
      expect(teachingText).toMatch(/抽象能量/)
      expect(teachingText).not.toMatch(
        /弹药内部|弹药构造|膛压|火药|压力|初速|速度|射程|穿透|目标|靶标|射击|瞄准|组装步骤|拆卸步骤|拆装方法|故障排查|改装|尺寸|公差|容差|比值|角度/,
      )
    }
  })

  it('states the firearm historical and mechanism boundaries conservatively', () => {
    const text = Object.fromEntries(
      firearmExhibitIds.map((id) => [id, JSON.stringify(firearmExhibits[id])]),
    )

    expect(text.m1903).toMatch(/不混用 M1903A3/)
    expect(text.m1903).toMatch(/抽象投射体.*之后.*手动/)
    expect(text.m1903).toMatch(/不会自动循环/)

    expect(text.m1911a1).toMatch(/短后坐/)
    expect(text.m1911a1).toMatch(/倾斜闭锁/)
    expect(text.m1911a1).toMatch(/击锤与击针.*不建模为可操作几何/)

    expect(text['m1-garand']).toMatch(/1940 年后.*导气孔/)
    expect(text['m1-garand']).toMatch(/整体式弹夹/)
    expect(text['m1-garand']).toMatch(/不是可拆卸盒式弹匣/)

    expect(text.mp5).toMatch(/标准外形/)
    expect(text.mp5).toMatch(/闭膛（closed-bolt）/)
    expect(text.mp5).toMatch(/闭锁状态.*滚柱延迟反冲/)
  })

  it('limits the M1911A1 lock card citation to the source-supported claim', () => {
    const lockInterface = firearmExhibits.m1911a1.parts.find(
      (part) => part.id === 'firearm-lock-delay-system',
    )

    expect(lockInterface?.sourceId).toBe('army-browning-m1911')
    expect(lockInterface?.historicalFact).toMatch(
      /美国陆军.*直接支持.*短后坐/,
    )
    expect(lockInterface?.historicalFact).toMatch(
      /倾斜方向界面.*项目原创教学几何/,
    )
    expect(lockInterface?.historicalFact).not.toMatch(/公认高层描述/)
  })

  it('marks every Army-sourced M1911A1 tilt or lock claim as teaching geometry', () => {
    const armySourcedParts = firearmExhibits.m1911a1.parts.filter(
      (part) => part.sourceId === 'army-browning-m1911',
    )

    for (const part of armySourcedParts) {
      if (/倾斜|闭锁/.test(part.historicalFact)) {
        expect(part.historicalFact, part.id).toMatch(
          /项目原创|教学姿态|示意/,
        )
      }
    }
  })

  it('adds four safe firearm catalog cards after the original three', () => {
    expect(
      catalog.slice(3).map(({ id, title, subtitle, facts, silhouette }) => ({
        id,
        title,
        subtitle,
        facts: [...facts],
        silhouette,
      })),
    ).toEqual([
      {
        id: 'm1903',
        title: 'M1903 Springfield',
        subtitle: '手动旋转后拉枪机教学剖面',
        facts: ['11 个结构热点', '6 段拆解导览', '单次机械循环'],
        silhouette: 'firearm',
      },
      {
        id: 'm1911a1',
        title: 'M1911A1',
        subtitle: '枪管短后坐与倾斜闭锁教学剖面',
        facts: ['11 个结构热点', '6 段拆解导览', '单次机械循环'],
        silhouette: 'firearm',
      },
      {
        id: 'm1-garand',
        title: 'M1 Garand',
        subtitle: '导气操作杆与旋转枪机教学剖面',
        facts: ['11 个结构热点', '6 段拆解导览', '单次机械循环'],
        silhouette: 'firearm',
      },
      {
        id: 'mp5',
        title: 'HK MP5',
        subtitle: '滚柱延迟反冲教学剖面',
        facts: ['11 个结构热点', '6 段拆解导览', '单次机械循环'],
        silhouette: 'firearm',
      },
    ])

    for (const item of catalog.slice(3)) {
      expect(item.eyebrow.length).toBeGreaterThan(5)
      expect(item.description).toMatch(/教学|观察|机械/)
      expect(item.description).not.toMatch(/射击|瞄准|操作步骤|维护|改装/)
    }
  })

  it('keeps every registered knowledge card descriptive and traceable', () => {
    const sourceIds = new Set(sources.map((source) => source.id))

    for (const exhibit of Object.values(exhibits)) {
      const exhibitStepIds = new Set(exhibit.steps.map((step) => step.id))

      for (const part of exhibit.parts) {
        expect(part.historicalFact.length).toBeGreaterThanOrEqual(20)
        expect(part.simplifiedPrinciple.length).toBeGreaterThanOrEqual(20)
        expect(part.prompt.length).toBeGreaterThan(10)
        expect(sourceIds.has(part.sourceId)).toBe(true)
        expect(exhibitStepIds.has(part.stepId)).toBe(true)
        expect(part.explodeOffset).toHaveLength(3)
      }
    }
  })

  it('does not mistake the historical ASR-10 shelter for the teaching vessel', () => {
    expect(exhibits.x57.reconstructionNote).toMatch(/首次飞行前结束/)
    expect(exhibits.asr10.reconstructionNote).toMatch(/系泊式.*避难设施/)
    expect(exhibits.asr10.reconstructionNote).toMatch(/教学复合模型/)

    for (const part of asr10Parts.filter((part) =>
      [
        'twin-engine-modules',
        'shaft-paths',
        'propeller-concept',
        'rudder-steering',
        'bilge-pump-path',
        'wheelhouse-observation-mast',
        'buoyancy-compartments',
      ].includes(part.id),
    )) {
      expect(`${part.historicalFact}${part.simplifiedPrinciple}`).toMatch(
        /教学复合模型|现代救援艇|通用原理/,
      )
      expect(`${part.historicalFact}${part.simplifiedPrinciple}`).toMatch(
        /不是历史 ASR-10|并非历史 ASR-10|不属于历史 ASR-10/,
      )
    }
  })

  it('pins the corrected X-57 landing-gear fact to a conservative NASA claim', () => {
    const landingGear = x57Parts.find((part) => part.id === 'landing-gear')

    expect(landingGear?.sourceId).toBe('nasa-x57-project')
    expect(landingGear?.historicalFact).toMatch(/首次飞行前结束/)
    expect(landingGear?.historicalFact).toMatch(/只把起落架作为.*地面支点/)
    expect(landingGear?.historicalFact).not.toMatch(/高压|螺旋桨|检查/)
  })

  it('pins the historical ASR-10 boundary to the museum vessel record', () => {
    const asr10Source = sources.find(
      (source) => source.id === 'scottish-maritime-asr10',
    )

    expect(asr10Source).toEqual(
      expect.objectContaining({
        url: 'https://www.scottishmaritimemuseum.org/3d_collections/air-sea-rescue-craft-asr-10/',
        licenseNote: expect.stringMatching(
          /fact reference.*no museum media is reused/i,
        ),
      }),
    )
    expect(exhibits.asr10.reconstructionNote).toMatch(
      /系泊式海上应急避难设施.*教学复合模型.*不是 ASR-10 原物/,
    )
    expect(
      asr10Parts.find((part) => part.id === 'survivor-space')?.sourceId,
    ).toBe('scottish-maritime-asr10')
  })

  it('defines the six M4 exploration steps in order', () => {
    expect(m4Steps.map((step) => step.id)).toEqual([
      'whole',
      'exterior',
      'hull',
      'power',
      'running',
      'details',
    ])
    expect(m4Steps.map((step) => step.index)).toEqual([0, 1, 2, 3, 4, 5])

    for (const step of m4Steps) {
      expect(step).toEqual(
        expect.objectContaining({
          hint: expect.stringMatching(/.{8,}/),
          takeaway: expect.stringMatching(/.{12,}/),
        }),
      )
    }
  })

  it('keeps every M4 part descriptive and traceable', () => {
    const sourceIds = new Set(sources.map((source) => source.id))
    const stepIds = new Set(m4Steps.map((step) => step.id))

    expect(m4Parts).toHaveLength(11)

    for (const part of m4Parts) {
      expect(part).toEqual(
        expect.objectContaining({
          historicalFact: expect.stringMatching(/.{20,}/),
          simplifiedPrinciple: expect.stringMatching(/.{20,}/),
        }),
      )
      expect(part.prompt.length).toBeGreaterThan(10)
      expect(sourceIds.has(part.sourceId)).toBe(true)
      expect(stepIds.has(part.stepId)).toBe(true)
      expect(part.explodeOffset).toHaveLength(3)
    }
  })

  it('uses a variant-appropriate source for the radial engine lesson', () => {
    const engineModule = m4Parts.find((part) => part.id === 'engine-module')

    expect({
      source: sources.at(4),
      engineSourceId: engineModule?.sourceId,
    }).toEqual({
      source: {
        id: 'tank-museum-m4a1',
        title: 'Sherman M4A1 (76) W',
        organization: 'The Tank Museum',
        url: 'https://tankmuseum.org/article/latest-from-the-museums-youtube-channel-november/',
        licenseNote:
          'Historical fact verification only; no museum media is reused. The museum identifies the M4A1 variant as using a Continental radial engine.',
      },
      engineSourceId: 'tank-museum-m4a1',
    })
  })

  it('matches the approved content contract', () => {
    expect(m4Parts).toHaveLength(11)
    expect(
      m4Parts.map(({ id, stepId, sourceId, explodeOffset }) => ({
        id,
        stepId,
        sourceId,
        explodeOffset: [...explodeOffset],
      })),
    ).toEqual([
      {
        id: 'hull-shell',
        stepId: 'exterior',
        sourceId: 'm4-cutaway',
        explodeOffset: [0, 0.35, 0],
      },
      {
        id: 'turret-shell',
        stepId: 'exterior',
        sourceId: 'm4-cutaway',
        explodeOffset: [0, 1.4, 0],
      },
      {
        id: 'engine-module',
        stepId: 'power',
        sourceId: 'tank-museum-m4a1',
        explodeOffset: [-1.1, 0.25, 0],
      },
      {
        id: 'transmission-path',
        stepId: 'power',
        sourceId: 'm4-cutaway',
        explodeOffset: [0, -0.45, 0],
      },
      {
        id: 'suspension-left',
        stepId: 'running',
        sourceId: 'm4-cutaway',
        explodeOffset: [0, 0, 1.1],
      },
      {
        id: 'suspension-right',
        stepId: 'running',
        sourceId: 'm4-cutaway',
        explodeOffset: [0, 0, -1.1],
      },
      {
        id: 'track-left',
        stepId: 'running',
        sourceId: 'm4-cutaway',
        explodeOffset: [0, -0.2, 1.65],
      },
      {
        id: 'track-right',
        stepId: 'running',
        sourceId: 'm4-cutaway',
        explodeOffset: [0, -0.2, -1.65],
      },
      {
        id: 'crew-space',
        stepId: 'hull',
        sourceId: 'm4-cutaway',
        explodeOffset: [0.2, 0.7, 0],
      },
      {
        id: 'observation-system',
        stepId: 'details',
        sourceId: 'm4-cutaway',
        explodeOffset: [0.55, 1.05, 0.45],
      },
      {
        id: 'recoil-concept',
        stepId: 'details',
        sourceId: 'm4-cutaway',
        explodeOffset: [1.15, 0.95, 0],
      },
    ])

    expect(catalog.slice(0, 3).map((item) => item.description)).toEqual([
      '沿六个观察阶段，理解承载、动力、传动和行走系统如何共同工作。',
      '沿六个观察阶段，理解机翼、分布式电推进、储能供电与散热怎样协同。',
      '沿六个观察阶段，用教学复合模型理解船体、浮力、推进、转向与救援空间。',
    ])
  })
})
