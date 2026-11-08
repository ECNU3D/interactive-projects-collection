import type { ExhibitCycleState } from './types'
import {
  getFirearmContactShadowFrames,
  getFirearmContactShadowRevision,
} from './FirearmScene'
import { resolveAccumulativeShadowProps } from './sceneShadows'

const desktopQuality = {
  shadowFrames: 24,
  shadowResolution: 512,
} as const

describe('accumulative museum shadow props', () => {
  it('keeps a static revision finite at the authored desktop quality', () => {
    expect(
      resolveAccumulativeShadowProps({
        revision: '3:explode:false:0',
        requestedFrames: 24,
        reducedMotion: false,
        continuousAnimation: false,
        shadowResolution: 512,
      }),
    ).toEqual({
      revision: '3:explode:false:0',
      frames: 24,
      limit: 24,
      resolution: 512,
      randomizedLightMapSize: 512,
    })
  })

  it('normalizes every continuous firearm phase to one stable update', () => {
    const phaseOne: ExhibitCycleState = {
      phaseIndex: 1,
      status: 'playing',
      revision: 4,
    }
    const phaseTwo: ExhibitCycleState = {
      phaseIndex: 2,
      status: 'playing',
      revision: 4,
    }
    const resolveFirearmPhase = (cycleState: ExhibitCycleState) =>
      resolveAccumulativeShadowProps({
        revision: getFirearmContactShadowRevision({
          stepIndex: 5,
          mode: 'principle',
          autoplay: false,
          resetToken: 0,
          cycleState,
        }),
        requestedFrames: getFirearmContactShadowFrames(
          desktopQuality,
          cycleState,
          false,
        ),
        reducedMotion: false,
        continuousAnimation: true,
        shadowResolution: desktopQuality.shadowResolution,
      })

    const first = resolveFirearmPhase(phaseOne)
    const second = resolveFirearmPhase(phaseTwo)

    expect(first).toEqual({
      revision: 'continuous-animation',
      frames: 1,
      limit: 1,
      resolution: 512,
      randomizedLightMapSize: 512,
    })
    expect(second).toEqual(first)
  })
})
