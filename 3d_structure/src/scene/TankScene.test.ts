import { describe, expect, it } from 'vitest'
import type { PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import * as tankSceneModule from './TankScene'

type CameraTarget = readonly [number, number, number]
type CameraCommandType =
  | 'rotate-left'
  | 'rotate-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'focus-selected'

const {
  DEFAULT_CAMERA_FOV,
  applyCameraCommand,
  advanceCameraFocusTarget,
  getContactShadowRevision,
  getCameraFocusTarget,
  getSceneQualityProfile,
  TANK_STAGE_CONFIG,
  getTankFrameloop,
} = tankSceneModule as typeof tankSceneModule & {
  DEFAULT_CAMERA_FOV?: number
  applyCameraCommand?: (
    position: CameraTarget,
    target: CameraTarget,
    focusTarget: CameraTarget,
    command: CameraCommandType,
    distanceRange?: { min: number; max: number },
  ) => { position: CameraTarget; target: CameraTarget }
  advanceCameraFocusTarget?: (
    current: CameraTarget,
    target: CameraTarget,
    delta: number,
    reducedMotion: boolean,
  ) => CameraTarget
  getCameraFocusTarget?: (
    partId: PartId | null,
    stepIndex: number,
    mode: ExploreMode,
  ) => CameraTarget
  getContactShadowRevision?: (state: {
    stepIndex: number
    mode: ExploreMode
    selectedPartId: PartId | null
    autoplay: boolean
    resetToken: number
  }) => string
  getSceneQualityProfile?: (environment: {
    viewportWidth: number
    coarsePointer: boolean
  }) => {
    dpr: readonly [number, number]
    shadowResolution: number
    shadowFrames: number
  }
}

describe('DEFAULT_CAMERA_FOV', () => {
  it('keeps the fully exploded model inside the vertical frame', () => {
    expect(DEFAULT_CAMERA_FOV).toBeDefined()
    expect(DEFAULT_CAMERA_FOV).toBeGreaterThanOrEqual(40)
  })
})

describe('tank scene render scheduling', () => {
  it('renders continuously only while a visible principle animation is active', () => {
    expect(getTankFrameloop('principle', true, false)).toBe('always')
    expect(getTankFrameloop('principle', false, false)).toBe('demand')
    expect(getTankFrameloop('principle', true, true)).toBe('demand')
    expect(getTankFrameloop('explode', true, false)).toBe('demand')
  })

  it('uses the shared circular podium without a debug-grid variant', () => {
    expect(TANK_STAGE_CONFIG).toMatchObject({
      floorY: -1.03,
      label: 'M4 中型坦克',
    })
    expect(TANK_STAGE_CONFIG.radius).toBeGreaterThan(4)
  })
})

describe('camera focus targets', () => {
  const assembledTargets = {
    'hull-shell': [0, 0.835, 0],
    'turret-shell': [0.8496, 1.9324, 0],
    'engine-module': [-1.7464, 0.835, 0],
    'transmission-path': [0.2124, 0.2214, 0],
    'suspension-left': [0, 0.363, 1.6402],
    'suspension-right': [0, 0.363, -1.6402],
    'track-left': [0, 0.0444, 1.829],
    'track-right': [0, 0.0444, -1.829],
    'crew-space': [0.354, 1.189, 0],
    'observation-system': [0.59, 2.605, 0],
    'recoil-concept': [1.062, 1.8734, 0.3776],
  } as const satisfies Record<PartId, CameraTarget>

  it('uses the museum overview target when no part is selected', () => {
    expect(getCameraFocusTarget).toBeTypeOf('function')
    expect(getCameraFocusTarget?.(null, 0, 'explode')).toEqual([0, 0.65, 0])
  })

  it('follows a revealed part to its authored exploded position', () => {
    expect(getCameraFocusTarget).toBeTypeOf('function')

    const assembled = getCameraFocusTarget?.('engine-module', 2, 'explode')
    const exploded = getCameraFocusTarget?.('engine-module', 3, 'explode')

    expect(assembled).toBeDefined()
    expect(exploded).toBeDefined()
    expect(exploded?.[0]).toBeCloseTo((assembled?.[0] ?? 0) - 1.1 * 1.18)
    expect(exploded?.[1]).toBeCloseTo((assembled?.[1] ?? 0) + 0.25 * 1.18)
    expect(getCameraFocusTarget?.('engine-module', 3, 'xray')).toEqual(
      assembled,
    )
  })

  it('freezes all eleven assembled focus targets in world space', () => {
    expect(Object.keys(assembledTargets)).toHaveLength(11)

    for (const [partId, expected] of Object.entries(assembledTargets)) {
      const actual = getCameraFocusTarget?.(partId as PartId, 5, 'xray')

      expect(actual).toBeDefined()
      expected.forEach((coordinate, index) => {
        expect(actual?.[index]).toBeCloseTo(coordinate, 10)
      })
    }
  })

  it('keeps left and right running-gear targets spatially distinct', () => {
    const left = getCameraFocusTarget?.('suspension-left', 0, 'explode')
    const right = getCameraFocusTarget?.('suspension-right', 0, 'explode')

    expect(left).toBeDefined()
    expect(right).toBeDefined()
    expect(left?.[2]).toBeGreaterThan(0)
    expect(right?.[2]).toBeLessThan(0)
  })

  it('damps toward a selected target and jumps immediately for reduced motion', () => {
    expect(advanceCameraFocusTarget).toBeTypeOf('function')

    const current = [0, 0.65, 0] as const
    const target = [-1.7, 0.72, 0] as const
    const animated = advanceCameraFocusTarget?.(current, target, 1 / 60, false)

    expect(animated?.[0]).toBeLessThan(current[0])
    expect(animated?.[0]).toBeGreaterThan(target[0])
    expect(advanceCameraFocusTarget?.(current, target, 1 / 60, true)).toEqual(
      target,
    )
  })
})

describe('camera commands', () => {
  it('rotates around the current target without changing orbit distance', () => {
    expect(applyCameraCommand).toBeTypeOf('function')

    const position = [8, 4, 8] as const
    const target = [0, 1, 0] as const
    const left = applyCameraCommand?.(
      position,
      target,
      target,
      'rotate-left',
    )
    const right = applyCameraCommand?.(
      position,
      target,
      target,
      'rotate-right',
    )
    const distance = Math.hypot(
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    )

    expect(left?.position).not.toEqual(position)
    expect(right?.position).not.toEqual(position)
    expect(left?.position[1]).toBe(position[1])
    expect(right?.position[1]).toBe(position[1])
    expect(
      Math.hypot(
        (left?.position[0] ?? 0) - target[0],
        (left?.position[1] ?? 0) - target[1],
        (left?.position[2] ?? 0) - target[2],
      ),
    ).toBeCloseTo(distance)
    expect(left?.position[0]).not.toBe(right?.position[0])
  })

  it('zooms along the view direction and clamps the orbit distance', () => {
    expect(applyCameraCommand).toBeTypeOf('function')

    const target = [0, 0, 0] as const
    const zoomedIn = applyCameraCommand?.(
      [0, 0, 10],
      target,
      target,
      'zoom-in',
    )
    const zoomedOut = applyCameraCommand?.(
      [0, 0, 12.8],
      target,
      target,
      'zoom-out',
    )

    expect(zoomedIn?.position).toEqual([0, 0, 8.5])
    expect(zoomedOut?.position).toEqual([0, 0, 13])
  })

  it('focuses the authored target without moving the camera position', () => {
    const position = [7.8, 4.8, 8.6] as const
    const focusTarget = [-1.7, 0.8, 0] as const

    expect(
      applyCameraCommand?.(
        position,
        [0, 0.65, 0],
        focusTarget,
        'focus-selected',
      ),
    ).toEqual({ position, target: focusTarget })
  })

  it('honors scene-specific zoom limits', () => {
    const zoomed = applyCameraCommand?.(
      [0, 0, 14.8],
      [0, 0, 0],
      [0, 0, 0],
      'zoom-out',
      { min: 5.8, max: 15 },
    )

    expect(zoomed?.position[2]).toBeCloseTo(15)
  })
})

describe('scene quality', () => {
  it('uses a reduced render budget on narrow or coarse-pointer devices', () => {
    expect(getSceneQualityProfile).toBeTypeOf('function')

    expect(
      getSceneQualityProfile?.({ viewportWidth: 390, coarsePointer: false }),
    ).toEqual({
      dpr: [1, 1.25],
      shadows: false,
      shadowMode: 'contact',
      postprocessing: false,
      antialias: true,
      shadowResolution: 256,
      shadowMapSize: 1024,
      shadowFrames: 8,
      environmentResolution: 64,
    })
    expect(
      getSceneQualityProfile?.({ viewportWidth: 1440, coarsePointer: true }),
    ).toEqual({
      dpr: [1, 1.25],
      shadows: false,
      shadowMode: 'contact',
      postprocessing: false,
      antialias: true,
      shadowResolution: 256,
      shadowMapSize: 1024,
      shadowFrames: 8,
      environmentResolution: 64,
    })
    expect(
      getSceneQualityProfile?.({ viewportWidth: 1440, coarsePointer: false }),
    ).toEqual({
      dpr: [1, 2],
      shadows: true,
      shadowMode: 'accumulative',
      postprocessing: true,
      antialias: false,
      shadowResolution: 512,
      shadowMapSize: 2048,
      shadowFrames: 24,
      environmentResolution: 128,
    })
  })

  it('does not restart contact-shadow accumulation for selection-only changes', () => {
    expect(getContactShadowRevision).toBeTypeOf('function')

    const state = {
      stepIndex: 3,
      mode: 'explode' as const,
      selectedPartId: null,
      autoplay: false,
      resetToken: 0,
    }
    const withoutSelection = getContactShadowRevision?.(state)
    const withSelection = getContactShadowRevision?.({
      ...state,
      selectedPartId: 'engine-module',
    })

    expect(withSelection).toBe(withoutSelection)
    expect(
      getContactShadowRevision?.({ ...state, stepIndex: state.stepIndex + 1 }),
    ).not.toBe(withoutSelection)
  })
})
