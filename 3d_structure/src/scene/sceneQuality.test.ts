import {
  getContactShadowRevision,
  getSceneQualityProfile,
} from './sceneQuality'

describe('getSceneQualityProfile', () => {
  const constrainedProfile = {
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

  const desktopProfile = {
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

  it('uses the constrained profile at the 820px boundary', () => {
    expect(
      getSceneQualityProfile({ viewportWidth: 820, coarsePointer: false }),
    ).toEqual(constrainedProfile)
  })

  it('uses the constrained profile for coarse pointers on wide viewports', () => {
    expect(
      getSceneQualityProfile({ viewportWidth: 1440, coarsePointer: true }),
    ).toEqual(constrainedProfile)
  })

  it('uses the desktop profile above the width boundary', () => {
    expect(
      getSceneQualityProfile({ viewportWidth: 821, coarsePointer: false }),
    ).toEqual(desktopProfile)
  })
})

describe('getContactShadowRevision', () => {
  it('keeps the existing revision format', () => {
    expect(
      getContactShadowRevision({
        stepIndex: 3,
        mode: 'principle',
        selectedPartId: null,
        autoplay: true,
        resetToken: 7,
      }),
    ).toBe('3:principle:true:7')
  })
})
