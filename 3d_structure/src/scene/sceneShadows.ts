export const CONTINUOUS_SHADOW_REVISION = 'continuous-animation'

export interface AccumulativeShadowInput {
  revision: string
  requestedFrames: number
  reducedMotion: boolean
  continuousAnimation: boolean
  shadowResolution: number
}

export interface AccumulativeShadowProps {
  revision: string
  frames: number
  limit: number
  resolution: number
  randomizedLightMapSize: number
}

export function resolveAccumulativeShadowProps({
  revision,
  requestedFrames,
  reducedMotion,
  continuousAnimation,
  shadowResolution,
}: AccumulativeShadowInput): AccumulativeShadowProps {
  const finiteFrames = reducedMotion
    ? 1
    : Math.max(
        1,
        Math.trunc(Number.isFinite(requestedFrames) ? requestedFrames : 1),
      )
  const isContinuous = continuousAnimation && !reducedMotion
  const frames = isContinuous ? 1 : finiteFrames

  return {
    revision: isContinuous ? CONTINUOUS_SHADOW_REVISION : revision,
    frames,
    limit: frames,
    resolution: shadowResolution,
    randomizedLightMapSize: shadowResolution,
  }
}
