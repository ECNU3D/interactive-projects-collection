import type { FirearmCycleKind } from '../content/types'
import {
  FIREARM_CYCLE_PHASE_DURATION_MS,
  FIREARM_CYCLE_PHASES,
  sampleFirearmCycle,
  type FirearmCycleSample,
} from './firearmCycle'

const kinds = [
  'manual-bolt',
  'short-recoil',
  'gas-op-rod',
  'roller-delay',
] as const satisfies readonly FirearmCycleKind[]

const canonicalReadySample: FirearmCycleSample = {
  breechX: 0,
  breechRotation: 0,
  barrelX: 0,
  barrelY: 0,
  driveX: 0,
  lockAmount: 0,
  returnCompression: 0,
  feedLift: 0,
  caseX: 0,
  caseY: 0,
  caseVisible: false,
  projectileX: 0,
  projectileVisible: false,
  energyAmount: 0,
}

const numericSampleFields = [
  'breechX',
  'breechRotation',
  'barrelX',
  'barrelY',
  'driveX',
  'lockAmount',
  'returnCompression',
  'feedLift',
  'caseX',
  'caseY',
  'projectileX',
  'energyAmount',
] as const satisfies readonly (keyof FirearmCycleSample)[]

describe('sampleFirearmCycle', () => {
  it('shares one UI-only phase duration with scene playback controls', () => {
    expect(FIREARM_CYCLE_PHASE_DURATION_MS).toBe(800)
  })

  it('exports the exact six teaching phases', () => {
    expect(FIREARM_CYCLE_PHASES).toEqual([
      'ready',
      'energy',
      'projectile',
      'unlock',
      'extract',
      'return',
    ])
  })

  it.each(kinds)('returns the canonical ready state for %s', (kind) => {
    expect(sampleFirearmCycle(kind, 0, 0.75)).toEqual(canonicalReadySample)
  })

  it('clamps phase and progress inputs to the sampler boundaries', () => {
    expect(sampleFirearmCycle('gas-op-rod', -20, 0.5)).toEqual(
      canonicalReadySample,
    )
    expect(sampleFirearmCycle('gas-op-rod', 1, -20)).toEqual(
      sampleFirearmCycle('gas-op-rod', 1, 0),
    )
    expect(sampleFirearmCycle('gas-op-rod', 4, 20)).toEqual(
      sampleFirearmCycle('gas-op-rod', 4, 1),
    )
    expect(sampleFirearmCycle('gas-op-rod', 20, 1)).toEqual(
      canonicalReadySample,
    )
  })

  it.each(kinds)(
    '%s keeps every numeric assembly field continuous from unlock to extraction',
    (kind) => {
      const unlockEnd = sampleFirearmCycle(kind, 3, 1)
      const extractionStart = sampleFirearmCycle(kind, 4, 0)

      for (const field of numericSampleFields) {
        expect(extractionStart[field]).toBe(unlockEnd[field])
      }
    },
  )

  it.each(kinds)('%s clamps non-finite progress within an active phase', (kind) => {
    const phaseStart = sampleFirearmCycle(kind, 4, 0)
    const phaseEnd = sampleFirearmCycle(kind, 4, 1)

    expect(sampleFirearmCycle(kind, 4, Number.NaN)).toEqual(phaseStart)
    expect(sampleFirearmCycle(kind, 4, Number.NEGATIVE_INFINITY)).toEqual(
      phaseStart,
    )
    expect(sampleFirearmCycle(kind, 4, Number.POSITIVE_INFINITY)).toEqual(
      phaseEnd,
    )
  })

  it.each(kinds)('%s clamps non-finite phases with finite progress', (kind) => {
    expect(sampleFirearmCycle(kind, Number.NaN, 0.5)).toEqual(
      sampleFirearmCycle(kind, 0, 0.5),
    )
    expect(
      sampleFirearmCycle(kind, Number.NEGATIVE_INFINITY, 0.5),
    ).toEqual(sampleFirearmCycle(kind, 0, 0.5))
    expect(
      sampleFirearmCycle(kind, Number.POSITIVE_INFINITY, 0.5),
    ).toEqual(sampleFirearmCycle(kind, 5, 0.5))
  })

  it('keeps every sampled teaching value finite at input edges', () => {
    for (const kind of kinds) {
      for (let phase = 0; phase < FIREARM_CYCLE_PHASES.length; phase += 1) {
        for (const progress of [0, 1]) {
          const sample = sampleFirearmCycle(kind, phase, progress)

          for (const value of Object.values(sample)) {
            if (typeof value === 'number') {
              expect(Number.isFinite(value)).toBe(true)
            }
          }
        }
      }
    }
  })

  it.each(kinds)('%s grows abstract energy without moving the breech', (kind) => {
    const start = sampleFirearmCycle(kind, 1, 0)
    const end = sampleFirearmCycle(kind, 1, 1)

    expect(end.energyAmount).toBeGreaterThan(start.energyAmount)
    expect(end.breechX).toBe(0)
    expect(end.breechRotation).toBe(0)
  })

  it.each(kinds)(
    '%s shows the inert projectile substitute only during phase 2 while the breech stays closed',
    (kind) => {
      for (const phase of [0, 1, 3, 4, 5]) {
        expect(sampleFirearmCycle(kind, phase, 0.5).projectileVisible).toBe(
          false,
        )
      }

      const start = sampleFirearmCycle(kind, 2, 0)
      const end = sampleFirearmCycle(kind, 2, 1)

      expect(start.projectileVisible).toBe(true)
      expect(end.projectileVisible).toBe(true)
      expect(end.projectileX).toBeGreaterThan(start.projectileX)
      expect(end.energyAmount).toBeLessThan(start.energyAmount)
      expect(start.breechX).toBe(0)
      expect(end.breechX).toBe(0)
    },
  )

  it('rotates the manual bolt before translating it and never adds automatic drive', () => {
    const unlock = sampleFirearmCycle('manual-bolt', 3, 1)
    const extract = sampleFirearmCycle('manual-bolt', 4, 1)

    expect(unlock.breechRotation).toBeGreaterThan(0)
    expect(unlock.breechX).toBe(0)
    expect(extract.breechX).toBeLessThan(0)
    expect(extract.driveX).toBe(0)
  })

  it('expresses the short-recoil distinction as shared motion followed by barrel shift', () => {
    const sharedMotion = sampleFirearmCycle('short-recoil', 3, 0.25)
    const unlocked = sampleFirearmCycle('short-recoil', 3, 1)

    expect(sharedMotion.barrelX).toBeCloseTo(sharedMotion.breechX)
    expect(sharedMotion.barrelY).toBe(0)
    expect(unlocked.barrelY).not.toBe(0)
  })

  it('expresses gas operation as the strongest abstract drive and unlock rotation', () => {
    const unlock = sampleFirearmCycle('gas-op-rod', 3, 1)
    const gasExtract = sampleFirearmCycle('gas-op-rod', 4, 1)
    const otherDrives = kinds
      .filter((kind) => kind !== 'gas-op-rod')
      .map((kind) => Math.abs(sampleFirearmCycle(kind, 4, 1).driveX))

    expect(unlock.driveX).toBeLessThan(0)
    expect(unlock.breechRotation).toBeGreaterThan(0)
    expect(Math.abs(gasExtract.driveX)).toBeGreaterThan(Math.max(...otherDrives))
  })

  it('changes the roller-delay lock before applying its smaller relative motion', () => {
    const early = sampleFirearmCycle('roller-delay', 3, 0.25)
    const late = sampleFirearmCycle('roller-delay', 3, 1)
    const shortRecoilLate = sampleFirearmCycle('short-recoil', 3, 1)

    expect(early.lockAmount).toBeGreaterThan(0)
    expect(early.breechX).toBe(0)
    expect(late.breechX).toBeLessThan(0)
    expect(Math.abs(late.breechX)).toBeLessThan(
      Math.abs(shortRecoilLate.breechX),
    )
  })

  it.each([
    ['manual-bolt', 0],
    ['short-recoil', -0.18],
    ['gas-op-rod', -0.44],
    ['roller-delay', -0.12],
  ] as const)(
    'samples the distinct normalized %s linkage at extraction',
    (kind, expectedDriveX) => {
      const sample = sampleFirearmCycle(kind, 4, 1)

      expect(sample.driveX).toBeCloseTo(expectedDriveX)
      expect(sample.breechX).toBeLessThan(0)
      expect(sample.returnCompression).toBeGreaterThan(0)
      expect(sample.caseVisible).toBe(true)
      expect(sample.caseX).not.toBe(0)
      expect(sample.caseY).not.toBe(0)
    },
  )

  it.each(kinds)('%s shows the case substitute only during extract and return', (kind) => {
    for (const phase of [0, 1, 2, 3]) {
      expect(sampleFirearmCycle(kind, phase, 0.5).caseVisible).toBe(false)
    }

    expect(sampleFirearmCycle(kind, 4, 0.5).caseVisible).toBe(true)
    expect(sampleFirearmCycle(kind, 5, 0.25).caseVisible).toBe(true)
    expect(sampleFirearmCycle(kind, 5, 1).caseVisible).toBe(false)
  })

  it.each(kinds)(
    '%s lifts and settles the inert feed substitute before the exact final reset',
    (kind) => {
      const start = sampleFirearmCycle(kind, 5, 0)
      const middle = sampleFirearmCycle(kind, 5, 0.5)
      const end = sampleFirearmCycle(kind, 5, 1)

      expect(middle.feedLift).toBeGreaterThan(start.feedLift)
      expect(Math.abs(middle.breechX)).toBeLessThan(Math.abs(start.breechX))
      expect(end).toEqual(canonicalReadySample)
    },
  )

  it('is repeatable and does not retain mutations to returned samples', () => {
    const first = sampleFirearmCycle('gas-op-rod', 4, 0.625)
    const second = sampleFirearmCycle('gas-op-rod', 4, 0.625)

    expect(second).toEqual(first)
    expect(second).not.toBe(first)

    first.breechX = 999
    expect(sampleFirearmCycle('gas-op-rod', 4, 0.625)).toEqual(second)
  })
})
