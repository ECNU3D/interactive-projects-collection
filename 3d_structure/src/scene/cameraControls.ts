import { MathUtils } from 'three'
import { m4Parts } from '../content/m4'
import type { PartDefinition, PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import { getPartMotion } from './partMotion'

export type CameraVector = readonly [number, number, number]

export type CameraCommandType =
  | 'rotate-left'
  | 'rotate-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'focus-selected'

export interface CameraCommand {
  token: number
  type: CameraCommandType
}

export interface CameraDistanceRange {
  min: number
  max: number
}

export const DEFAULT_CAMERA_TARGET: CameraVector = [0, 0.65, 0]
export const MIN_CAMERA_DISTANCE = 6.5
export const MAX_CAMERA_DISTANCE = 13
export const TANK_MODEL_POSITION: CameraVector = [0, -0.64, 0]
export const TANK_MODEL_SCALE = 1.18
export const ENGINE_CENTER: [number, number, number] = [-1.48, 1.25, 0]

const CAMERA_TARGET_DAMPING = 5.5
const CAMERA_TARGET_EPSILON = 0.001
const CAMERA_ROTATION_STEP = Math.PI / 12
const CAMERA_ZOOM_FACTOR = 0.85

const PARTS_BY_ID = Object.fromEntries(
  m4Parts.map((part) => [part.id, part]),
) as Record<PartId, PartDefinition>

const PART_LOCAL_FOCUS_TARGETS = {
  'hull-shell': [0, 1.25, 0],
  'turret-shell': [0.72, 2.18, 0],
  'engine-module': ENGINE_CENTER,
  'transmission-path': [0.18, 0.73, 0],
  'suspension-left': [0, 0.85, 1.39],
  'suspension-right': [0, 0.85, -1.39],
  'track-left': [0, 0.58, 1.55],
  'track-right': [0, 0.58, -1.55],
  'crew-space': [0.3, 1.55, 0],
  'observation-system': [0.5, 2.75, 0],
  'recoil-concept': [0.9, 2.13, 0.32],
} as const satisfies Record<PartId, CameraVector>

export function getCameraFocusTarget(
  partId: PartId | null,
  stepIndex: number,
  mode: ExploreMode,
): CameraVector {
  if (!partId) {
    return DEFAULT_CAMERA_TARGET
  }

  const base = PART_LOCAL_FOCUS_TARGETS[partId]
  const motion = getPartMotion(PARTS_BY_ID[partId], stepIndex, mode, false)

  return [
    TANK_MODEL_POSITION[0] +
      (base[0] + motion.position[0]) * TANK_MODEL_SCALE,
    TANK_MODEL_POSITION[1] +
      (base[1] + motion.position[1]) * TANK_MODEL_SCALE,
    TANK_MODEL_POSITION[2] +
      (base[2] + motion.position[2]) * TANK_MODEL_SCALE,
  ]
}

export function advanceCameraFocusTarget(
  current: CameraVector,
  target: CameraVector,
  delta: number,
  reducedMotion: boolean,
): CameraVector {
  if (reducedMotion) {
    return target
  }

  const next = current.map((value, index) =>
    MathUtils.damp(value, target[index], CAMERA_TARGET_DAMPING, delta),
  ) as unknown as CameraVector

  return next.every(
    (value, index) => Math.abs(value - target[index]) < CAMERA_TARGET_EPSILON,
  )
    ? target
    : next
}

function cameraDistance(position: CameraVector, target: CameraVector) {
  return Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  )
}

export function applyCameraCommand(
  position: CameraVector,
  target: CameraVector,
  focusTarget: CameraVector,
  command: CameraCommandType,
  distanceRange: CameraDistanceRange = {
    min: MIN_CAMERA_DISTANCE,
    max: MAX_CAMERA_DISTANCE,
  },
): { position: CameraVector; target: CameraVector } {
  if (command === 'focus-selected') {
    return { position, target: focusTarget }
  }

  const offset: CameraVector = [
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  ]

  if (command === 'rotate-left' || command === 'rotate-right') {
    const angle =
      command === 'rotate-left' ? CAMERA_ROTATION_STEP : -CAMERA_ROTATION_STEP
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)

    return {
      position: [
        target[0] + offset[0] * cosine - offset[2] * sine,
        position[1],
        target[2] + offset[0] * sine + offset[2] * cosine,
      ],
      target,
    }
  }

  const distance = cameraDistance(position, target)

  if (distance === 0) {
    return { position, target }
  }

  const requestedDistance =
    command === 'zoom-in'
      ? distance * CAMERA_ZOOM_FACTOR
      : distance / CAMERA_ZOOM_FACTOR
  const nextDistance = MathUtils.clamp(
    requestedDistance,
    distanceRange.min,
    distanceRange.max,
  )
  const scale = nextDistance / distance

  return {
    position: [
      target[0] + offset[0] * scale,
      target[1] + offset[1] * scale,
      target[2] + offset[2] * scale,
    ],
    target,
  }
}
