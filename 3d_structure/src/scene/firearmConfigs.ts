import { firearmCycleKinds } from '../content/firearms'
import {
  firearmPartIds,
  type FirearmCycleKind,
  type FirearmExhibitId,
  type FirearmPartId,
} from '../content/types'

export type FirearmProfile = 'rifle' | 'pistol' | 'compact'
export type FirearmVector = readonly [number, number, number]

export interface FirearmPartTransform {
  position: FirearmVector
  rotation: FirearmVector
  scale: FirearmVector
}

export interface FirearmConfig {
  id: FirearmExhibitId
  cycleKind: FirearmCycleKind
  profile: FirearmProfile
  /** Dimensionless silhouette ratios used only by this teaching model. */
  proportions: {
    bodyLength: number
    barrelLength: number
    supportLength: number
  }
  partIds: readonly FirearmPartId[]
  shellIds: readonly FirearmPartId[]
  /** Dimensionless museum-stage coordinates, not physical dimensions. */
  partTransforms: Readonly<Record<FirearmPartId, FirearmPartTransform>>
  focusPoints: Readonly<Record<FirearmPartId, FirearmVector>>
}

const ZERO: FirearmVector = [0, 0, 0]
const ONE: FirearmVector = [1, 1, 1]

function transform(
  position: FirearmVector,
  rotation: FirearmVector = ZERO,
  scale: FirearmVector = ONE,
): FirearmPartTransform {
  return { position, rotation, scale }
}

function defineFirearmConfig(
  config: Omit<FirearmConfig, 'partIds' | 'focusPoints'>,
): FirearmConfig {
  const focusPoints = Object.fromEntries(
    firearmPartIds.map((partId) => [
      partId,
      config.partTransforms[partId].position,
    ]),
  ) as Record<FirearmPartId, FirearmVector>

  return {
    ...config,
    partIds: firearmPartIds,
    focusPoints,
  }
}

const commonShellIds = [
  'firearm-support-shell',
  'firearm-receiver-shell',
] as const satisfies readonly FirearmPartId[]

export const FIREARM_CONFIGS = {
  m1903: defineFirearmConfig({
    id: 'm1903',
    cycleKind: firearmCycleKinds.m1903,
    profile: 'rifle',
    proportions: {
      bodyLength: 0.82,
      barrelLength: 1,
      supportLength: 1,
    },
    shellIds: commonShellIds,
    partTransforms: {
      'firearm-support-shell': transform([-0.7, -0.42, 0]),
      'firearm-receiver-shell': transform([0.05, 0.38, 0]),
      'firearm-barrel-chamber': transform([2.32, 0.5, 0]),
      'firearm-breech-member': transform([0.08, 0.5, 0.03]),
      'firearm-lock-delay-system': transform([0.68, 0.5, 0.08]),
      'firearm-return-drive-system': transform([-1.34, 0.34, 0.04]),
      'firearm-input-linkage': transform([-0.72, -0.68, 0.2]),
      'firearm-feed-module': transform([-0.08, -0.72, 0.02]),
      'firearm-extraction-path': transform([-0.02, 0.91, 0.2]),
      'firearm-inert-round-path': transform([1.55, 0.5, 0.24]),
      'firearm-cycle-indicator': transform([-1.05, 1.22, 0.06]),
    },
  }),
  m1911a1: defineFirearmConfig({
    id: 'm1911a1',
    cycleKind: firearmCycleKinds.m1911a1,
    profile: 'pistol',
    proportions: {
      bodyLength: 0.54,
      barrelLength: 0.42,
      supportLength: 0.3,
    },
    shellIds: commonShellIds,
    partTransforms: {
      'firearm-support-shell': transform([-0.48, -0.48, 0], [0, 0, -0.15]),
      'firearm-receiver-shell': transform([0.14, 0.28, 0]),
      'firearm-barrel-chamber': transform([1.06, 0.57, 0]),
      'firearm-breech-member': transform([0.06, 0.57, 0.04]),
      'firearm-lock-delay-system': transform([0.48, 0.38, 0.09]),
      'firearm-return-drive-system': transform([0.65, 0.08, 0.03]),
      'firearm-input-linkage': transform([-0.38, -0.58, 0.2]),
      'firearm-feed-module': transform([-0.04, -0.78, 0.02]),
      'firearm-extraction-path': transform([0.18, 0.91, 0.2]),
      'firearm-inert-round-path': transform([0.92, 0.57, 0.24]),
      'firearm-cycle-indicator': transform([-0.48, 1.16, 0.06]),
    },
  }),
  'm1-garand': defineFirearmConfig({
    id: 'm1-garand',
    cycleKind: firearmCycleKinds['m1-garand'],
    profile: 'rifle',
    proportions: {
      bodyLength: 1,
      barrelLength: 0.9,
      supportLength: 0.92,
    },
    shellIds: commonShellIds,
    partTransforms: {
      'firearm-support-shell': transform([-0.52, -0.43, 0]),
      'firearm-receiver-shell': transform([-0.24, 0.39, 0]),
      'firearm-barrel-chamber': transform([2.28, 0.51, 0]),
      'firearm-breech-member': transform([-0.22, 0.51, 0.03]),
      'firearm-lock-delay-system': transform([0.43, 0.51, 0.08]),
      'firearm-return-drive-system': transform([1.14, 0.08, 0.04]),
      'firearm-input-linkage': transform([-0.62, -0.65, 0.2]),
      'firearm-feed-module': transform([0.02, -0.68, 0.02]),
      'firearm-extraction-path': transform([-0.1, 0.93, 0.2]),
      'firearm-inert-round-path': transform([1.48, 0.51, 0.24]),
      'firearm-cycle-indicator': transform([-0.92, 1.23, 0.06]),
    },
  }),
  mp5: defineFirearmConfig({
    id: 'mp5',
    cycleKind: firearmCycleKinds.mp5,
    profile: 'compact',
    proportions: {
      bodyLength: 0.66,
      barrelLength: 0.34,
      supportLength: 0.48,
    },
    shellIds: commonShellIds,
    partTransforms: {
      'firearm-support-shell': transform([-1.42, 0.12, 0]),
      'firearm-receiver-shell': transform([-0.16, 0.38, 0]),
      'firearm-barrel-chamber': transform([1.18, 0.49, 0]),
      'firearm-breech-member': transform([-0.13, 0.49, 0.03]),
      'firearm-lock-delay-system': transform([0.36, 0.49, 0.1]),
      'firearm-return-drive-system': transform([-0.77, 0.72, 0.04]),
      'firearm-input-linkage': transform([-0.58, -0.58, 0.2]),
      'firearm-feed-module': transform([-0.05, -0.76, 0.02], [0, 0, 0.08]),
      'firearm-extraction-path': transform([-0.12, 0.91, 0.2]),
      'firearm-inert-round-path': transform([0.94, 0.49, 0.24]),
      'firearm-cycle-indicator': transform([-0.98, 1.22, 0.06]),
    },
  }),
} as const satisfies Record<FirearmExhibitId, FirearmConfig>

export function getFirearmConfig(exhibitId: FirearmExhibitId): FirearmConfig {
  return FIREARM_CONFIGS[exhibitId]
}
