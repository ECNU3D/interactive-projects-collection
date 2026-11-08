import type { FirearmCycleKind } from '../content/types'

export const FIREARM_CYCLE_PHASES = [
  'ready',
  'energy',
  'projectile',
  'unlock',
  'extract',
  'return',
] as const

/** UI interpolation only; this duration carries no physical timing meaning. */
export const FIREARM_CYCLE_PHASE_DURATION_MS = 800

export interface FirearmCycleSample {
  breechX: number
  breechRotation: number
  barrelX: number
  barrelY: number
  driveX: number
  lockAmount: number
  returnCompression: number
  feedLift: number
  caseX: number
  caseY: number
  caseVisible: boolean
  projectileX: number
  projectileVisible: boolean
  energyAmount: number
}

// Every value is a dimensionless screen-space teaching offset or emphasis.
// The sampler intentionally contains no physical units or performance data.
const READY_SAMPLE: Readonly<FirearmCycleSample> = {
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

const extractionDriveByKind: Record<FirearmCycleKind, number> = {
  'manual-bolt': 0,
  'short-recoil': -0.18,
  'gas-op-rod': -0.44,
  'roller-delay': -0.12,
}

function readySample(): FirearmCycleSample {
  return { ...READY_SAMPLE }
}

function clampUnit(value: number): number {
  if (Number.isNaN(value) || value === Number.NEGATIVE_INFINITY) return 0
  if (value === Number.POSITIVE_INFINITY) return 1
  return Math.min(1, Math.max(0, value))
}

function clampPhase(value: number): number {
  if (Number.isNaN(value) || value === Number.NEGATIVE_INFINITY) return 0
  if (value === Number.POSITIVE_INFINITY) return FIREARM_CYCLE_PHASES.length - 1
  return Math.min(
    FIREARM_CYCLE_PHASES.length - 1,
    Math.max(0, Math.trunc(value)),
  )
}

function smooth(progress: number): number {
  return progress * progress * (3 - 2 * progress)
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function scale(offset: number, amount: number): number {
  return amount === 0 ? 0 : offset * amount
}

function sampleUnlock(
  kind: FirearmCycleKind,
  progress: number,
): FirearmCycleSample {
  const amount = smooth(progress)
  const sample = readySample()

  switch (kind) {
    case 'manual-bolt':
      sample.breechRotation = 0.62 * amount
      sample.lockAmount = amount
      return sample

    case 'short-recoil': {
      const sharedAmount = smooth(clampUnit(progress * 2))
      const barrelShift = smooth(clampUnit((progress - 0.5) * 2))
      sample.breechX = scale(-0.08, sharedAmount)
      sample.barrelX = scale(-0.08, sharedAmount)
      sample.barrelY = scale(-0.07, barrelShift)
      sample.lockAmount = barrelShift
      sample.returnCompression = 0.12 * amount
      return sample
    }

    case 'gas-op-rod':
      sample.driveX = scale(-0.16, amount)
      sample.breechRotation = 0.58 * amount
      sample.lockAmount = amount
      sample.energyAmount = 0.3 * (1 - amount)
      return sample

    case 'roller-delay': {
      const lockChange = smooth(clampUnit(progress * 2))
      const relativeMotion = smooth(clampUnit((progress - 0.5) * 2))
      sample.lockAmount = lockChange
      sample.breechX = scale(-0.04, relativeMotion)
      sample.driveX = scale(-0.04, relativeMotion)
      return sample
    }
  }
}

function sampleExtract(
  kind: FirearmCycleKind,
  progress: number,
): FirearmCycleSample {
  const amount = smooth(progress)
  const sample = readySample()

  sample.caseVisible = true
  sample.caseX = scale(-0.22, amount)
  sample.caseY = 0.28 * amount
  sample.returnCompression = 0.9 * amount
  sample.lockAmount = 1

  switch (kind) {
    case 'manual-bolt':
      sample.breechX = scale(-0.52, amount)
      sample.breechRotation = 0.62
      break

    case 'short-recoil':
      sample.breechX = mix(-0.08, -0.56, amount)
      sample.barrelX = mix(-0.08, -0.03, amount)
      sample.barrelY = -0.07
      sample.returnCompression = mix(0.12, 0.9, amount)
      break

    case 'gas-op-rod':
      sample.breechX = scale(-0.56, amount)
      sample.breechRotation = 0.58
      sample.driveX = mix(-0.16, extractionDriveByKind[kind], amount)
      break

    case 'roller-delay':
      sample.breechX = mix(-0.04, -0.42, amount)
      sample.driveX = mix(-0.04, extractionDriveByKind[kind], amount)
      sample.lockAmount = mix(1, 0.65, amount)
      break
  }

  sample.driveX ||= scale(extractionDriveByKind[kind], amount)
  return sample
}

function sampleReturn(
  kind: FirearmCycleKind,
  progress: number,
): FirearmCycleSample {
  if (progress === 1) return readySample()

  const extractionEnd = sampleExtract(kind, 1)
  const amount = smooth(progress)
  const remaining = 1 - amount

  return {
    breechX: extractionEnd.breechX * remaining,
    breechRotation: extractionEnd.breechRotation * remaining,
    barrelX: extractionEnd.barrelX * remaining,
    barrelY: extractionEnd.barrelY * remaining,
    driveX: extractionEnd.driveX * remaining,
    lockAmount: extractionEnd.lockAmount * remaining,
    returnCompression: extractionEnd.returnCompression * remaining,
    feedLift: 0.38 * Math.sin(Math.PI * progress),
    caseX: mix(extractionEnd.caseX, -0.34, amount),
    caseY: mix(extractionEnd.caseY, 0.48, amount),
    caseVisible: progress < 0.72,
    projectileX: 0,
    projectileVisible: false,
    energyAmount: 0,
  }
}

/**
 * Samples one deterministic, teaching-only animation state. Inputs select a
 * conceptual phase and normalized progress; outputs are non-physical visuals.
 */
export function sampleFirearmCycle(
  kind: FirearmCycleKind,
  phaseIndex: number,
  phaseProgress: number,
): FirearmCycleSample {
  const phase = clampPhase(phaseIndex)
  const progress = clampUnit(phaseProgress)

  switch (phase) {
    case 0:
      return readySample()

    case 1:
      return {
        ...readySample(),
        energyAmount: smooth(progress),
      }

    case 2:
      return {
        ...readySample(),
        projectileX: 0.76 * smooth(progress),
        projectileVisible: true,
        energyAmount: mix(1, 0.35, smooth(progress)),
      }

    case 3:
      return sampleUnlock(kind, progress)

    case 4:
      return sampleExtract(kind, progress)

    case 5:
      return sampleReturn(kind, progress)

    default:
      return readySample()
  }
}
