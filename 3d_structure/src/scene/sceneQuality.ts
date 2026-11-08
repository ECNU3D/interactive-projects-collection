import type { ExhibitPartId } from '../content/types'
import type { ExploreMode } from '../experience/state'

export interface SceneQualityEnvironment {
  viewportWidth: number
  coarsePointer: boolean
}

export interface SceneQualityProfile {
  dpr: [number, number]
  shadows: boolean
  shadowMode: 'contact' | 'accumulative'
  postprocessing: boolean
  antialias: boolean
  /** @deprecated Use shadowMapSize for the adaptive shadow renderer. */
  shadowResolution: number
  shadowMapSize: 1024 | 2048
  shadowFrames: number
  environmentResolution: 64 | 128
}

interface ContactShadowState {
  stepIndex: number
  mode: ExploreMode
  selectedPartId: ExhibitPartId | null
  autoplay: boolean
  resetToken: number
}

const CONSTRAINED_SCENE_QUALITY: SceneQualityProfile = {
  dpr: [1, 1.25],
  shadows: false,
  shadowMode: 'contact',
  postprocessing: false,
  antialias: true,
  shadowResolution: 256,
  shadowMapSize: 1024,
  shadowFrames: 8,
  environmentResolution: 64,
}

const DESKTOP_SCENE_QUALITY: SceneQualityProfile = {
  dpr: [1, 2],
  shadows: true,
  shadowMode: 'accumulative',
  postprocessing: true,
  antialias: false,
  shadowResolution: 512,
  shadowMapSize: 2048,
  shadowFrames: 24,
  environmentResolution: 128,
}

export function getSceneQualityProfile({
  viewportWidth,
  coarsePointer,
}: SceneQualityEnvironment): SceneQualityProfile {
  return viewportWidth <= 820 || coarsePointer
    ? CONSTRAINED_SCENE_QUALITY
    : DESKTOP_SCENE_QUALITY
}

export function getContactShadowRevision({
  stepIndex,
  mode,
  autoplay,
  resetToken,
}: ContactShadowState) {
  return `${stepIndex}:${mode}:${autoplay}:${resetToken}`
}
