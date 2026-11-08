import type { ExploreMode } from '../experience/state'

export type PrincipleMotionKind =
  | 'engine'
  | 'transmission'
  | 'suspension-left'
  | 'suspension-right'
  | 'recoil'

export interface PrincipleSample {
  positionX: number
  positionY: number
  rotationX: number
  scale: number
}

export function isPrinciplePlaybackActive(
  mode: ExploreMode,
  autoplay: boolean,
  reducedMotion: boolean,
) {
  return mode === 'principle' && autoplay && !reducedMotion
}

export function resetPrincipleSample(sample: PrincipleSample) {
  sample.positionX = 0
  sample.positionY = 0
  sample.rotationX = 0
  sample.scale = 1
  return sample
}

export function samplePrincipleMotion(
  kind: PrincipleMotionKind,
  elapsed: number,
  sample: PrincipleSample,
) {
  resetPrincipleSample(sample)

  switch (kind) {
    case 'engine':
      sample.rotationX = elapsed * 0.22
      break
    case 'transmission':
      sample.positionX = Math.sin(elapsed * 0.9) * 0.06
      sample.scale = 1 + (Math.sin(elapsed * 1.8) * 0.5 + 0.5) * 0.025
      break
    case 'suspension-left':
      sample.positionY = Math.sin(elapsed * 1.4) * 0.035
      break
    case 'suspension-right':
      sample.positionY = -Math.sin(elapsed * 1.4) * 0.035
      break
    case 'recoil': {
      const cycle = elapsed % 3.2
      sample.positionX =
        Math.sin(cycle * 8) * Math.exp(-cycle * 2.2) * 0.1
      break
    }
  }

  return sample
}
