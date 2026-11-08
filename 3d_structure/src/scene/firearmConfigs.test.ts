import { firearmCycleKinds, firearmExhibits } from '../content/firearms'
import {
  firearmExhibitIds,
  firearmPartIds,
  type FirearmExhibitId,
} from '../content/types'
import { FIREARM_CONFIGS } from './firearmConfigs'

const expectedProfiles = {
  m1903: 'rifle',
  m1911a1: 'pistol',
  'm1-garand': 'rifle',
  mp5: 'compact',
} as const satisfies Record<FirearmExhibitId, 'rifle' | 'pistol' | 'compact'>

const expectFiniteTuple = (tuple: readonly number[]) => {
  expect(tuple).toHaveLength(3)
  expect(tuple.every(Number.isFinite)).toBe(true)
}

describe('procedural firearm configuration contract', () => {
  it.each(firearmExhibitIds)(
    '%s covers the exact authored part order and cycle identity',
    (exhibitId) => {
      const config = FIREARM_CONFIGS[exhibitId]
      const exhibit = firearmExhibits[exhibitId]

      expect(config.id).toBe(exhibitId)
      expect(config.partIds).toEqual(exhibit.parts.map((part) => part.id))
      expect(config.partIds).toEqual(firearmPartIds)
      expect(new Set(config.partIds).size).toBe(11)
      expect(config.cycleKind).toBe(firearmCycleKinds[exhibitId])
      expect(config.profile).toBe(expectedProfiles[exhibitId])
    },
  )

  it.each(firearmExhibitIds)(
    '%s has a finite transform and focus point for all eleven parts',
    (exhibitId) => {
      const config = FIREARM_CONFIGS[exhibitId]

      expect(Object.keys(config.partTransforms)).toEqual([...config.partIds])
      expect(Object.keys(config.focusPoints)).toEqual([...config.partIds])

      for (const partId of config.partIds) {
        const transform = config.partTransforms[partId]
        expectFiniteTuple(transform.position)
        expectFiniteTuple(transform.rotation)
        expectFiniteTuple(transform.scale)
        expect(transform.scale.every((value) => value > 0)).toBe(true)
        expectFiniteTuple(config.focusPoints[partId])
      }

      expect(
        new Set(
          config.partIds.map((partId) =>
            config.partTransforms[partId].position.join(':'),
          ),
        ).size,
      ).toBeGreaterThan(8)
    },
  )

  it.each(firearmExhibitIds)(
    '%s identifies only authored shells and uses normalized proportions',
    (exhibitId) => {
      const config = FIREARM_CONFIGS[exhibitId]

      expect(config.shellIds.length).toBeGreaterThan(0)
      for (const shellId of config.shellIds) {
        expect(config.partIds).toContain(shellId)
      }
      for (const proportion of Object.values(config.proportions)) {
        expect(proportion).toBeGreaterThan(0)
        expect(proportion).toBeLessThanOrEqual(1)
      }
    },
  )

  it('authors four visibly distinct side-profile proportions', () => {
    const springfield = FIREARM_CONFIGS.m1903
    const pistol = FIREARM_CONFIGS.m1911a1
    const garand = FIREARM_CONFIGS['m1-garand']
    const compact = FIREARM_CONFIGS.mp5

    expect(springfield.proportions.barrelLength).toBeGreaterThan(
      pistol.proportions.barrelLength,
    )
    expect(springfield.proportions.supportLength).toBeGreaterThan(
      pistol.proportions.supportLength,
    )
    expect(
      garand.partTransforms['firearm-return-drive-system'].position[0],
    ).toBeGreaterThan(
      garand.partTransforms['firearm-receiver-shell'].position[0],
    )
    expect(compact.proportions.barrelLength).toBeLessThan(
      springfield.proportions.barrelLength,
    )
    expect(
      compact.partTransforms['firearm-support-shell'].position[0],
    ).toBeLessThan(
      compact.partTransforms['firearm-receiver-shell'].position[0],
    )
  })

  it('contains no real-world performance or dimension fields', () => {
    const forbiddenKeys = new Set([
      'caliber',
      'capacity',
      'mass',
      'pressure',
      'range',
      'rateOfFire',
      'realDimensions',
      'velocity',
      'weight',
    ])

    const inspectKeys = (value: unknown) => {
      if (!value || typeof value !== 'object') return
      for (const [key, nestedValue] of Object.entries(value)) {
        expect(forbiddenKeys.has(key)).toBe(false)
        inspectKeys(nestedValue)
      }
    }

    inspectKeys(FIREARM_CONFIGS)
  })
})
