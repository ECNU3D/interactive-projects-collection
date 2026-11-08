import { firearmExhibits } from '../content/firearms'
import { firearmExhibitIds } from '../content/types'
import type { ExhibitCycleState } from './types'
import {
  getFirearmCameraPreset,
  getFirearmContactShadowFrames,
  getFirearmContactShadowRevision,
  getFirearmFocusTarget,
  getFirearmFrameloop,
  getFirearmSceneLabel,
  getFirearmStageConfig,
  isFirearmSceneExhibit,
} from './FirearmScene'

describe('configurable firearm scene helpers', () => {
  it('uses each exhibit model label and rejects non-firearm IDs safely', () => {
    for (const exhibitId of firearmExhibitIds) {
      expect(getFirearmSceneLabel(exhibitId)).toBe(
        firearmExhibits[exhibitId].modelLabel,
      )
    }
    expect(isFirearmSceneExhibit('m4')).toBe(false)
    expect(isFirearmSceneExhibit('mp5')).toBe(true)
  })

  it('returns finite authored focus targets and follows exploded offsets', () => {
    const assembled = getFirearmFocusTarget(
      'm1-garand',
      'firearm-return-drive-system',
      5,
      'xray',
    )
    const exploded = getFirearmFocusTarget(
      'm1-garand',
      'firearm-return-drive-system',
      5,
      'explode',
    )

    expect(assembled).toHaveLength(3)
    expect(assembled.every(Number.isFinite)).toBe(true)
    expect(exploded).not.toEqual(assembled)
    expect(getFirearmFocusTarget('mp5', null, 0, 'explode')).toEqual([
      0,
      0.28,
      0,
    ])
  })

  it('uses profile-aware side-camera limits for long and compact exhibits', () => {
    const rifle = getFirearmCameraPreset('rifle')
    const pistol = getFirearmCameraPreset('pistol')
    const compact = getFirearmCameraPreset('compact')

    expect(rifle.position[2]).toBeGreaterThan(pistol.position[2])
    expect(rifle.maxDistance).toBeGreaterThan(compact.maxDistance)
    expect(rifle.position[2]).toBeGreaterThan(Math.abs(rifle.position[0]) * 5)
    expect(pistol.minDistance).toBeLessThan(rifle.minDistance)
  })

  it('sizes shared podiums by exhibit profile without exposing cycle wording', () => {
    const rifle = getFirearmStageConfig('m1-garand')
    const compact = getFirearmStageConfig('mp5')

    expect(rifle.floorY).toBe(-1.5)
    expect(rifle.radius).toBeGreaterThan(compact.radius)
    expect(rifle.label).toBe('M1 Garand')
    expect(rifle.label).not.toContain('机械循环')
  })

  it('renders continuously only for active full-motion cycle playback', () => {
    const playing: ExhibitCycleState = {
      phaseIndex: 3,
      status: 'playing',
      revision: 1,
    }

    expect(getFirearmFrameloop('principle', playing, false)).toBe('always')
    expect(
      getFirearmFrameloop('principle', { ...playing, status: 'paused' }, false),
    ).toBe('demand')
    expect(getFirearmFrameloop('principle', playing, true)).toBe('demand')
    expect(getFirearmFrameloop('xray', playing, false)).toBe('demand')
    expect(getFirearmFrameloop('principle', undefined, false)).toBe('demand')
  })

  it('does not restart contact shadows for selection-only changes', () => {
    const state = {
      stepIndex: 4,
      mode: 'principle' as const,
      autoplay: false,
      resetToken: 2,
      cycleState: {
        phaseIndex: 3,
        status: 'playing' as const,
        revision: 7,
      },
    }

    const revision = getFirearmContactShadowRevision(state)
    expect(getFirearmContactShadowRevision({ ...state })).toBe(revision)
    expect(
      getFirearmContactShadowRevision({ ...state, stepIndex: 5 }),
    ).not.toBe(revision)
    expect(
      getFirearmContactShadowRevision({
        ...state,
        cycleState: { ...state.cycleState, phaseIndex: 4 },
      }),
    ).not.toBe(revision)
    expect(
      getFirearmContactShadowRevision({
        ...state,
        cycleState: { ...state.cycleState, status: 'paused' },
      }),
    ).not.toBe(revision)
    expect(
      getFirearmContactShadowRevision({
        ...state,
        cycleState: { ...state.cycleState, revision: 8 },
      }),
    ).not.toBe(revision)
  })

  it('captures a finite full phase while playing and a settle frame when stopped', () => {
    const desktop = {
      dpr: [1, 1.6] as [number, number],
      shadowResolution: 512,
      shadowFrames: 24,
    }
    const constrained = {
      dpr: [1, 1.25] as [number, number],
      shadowResolution: 256,
      shadowFrames: 8,
    }
    const playing: ExhibitCycleState = {
      phaseIndex: 2,
      status: 'playing',
      revision: 1,
    }

    expect(getFirearmContactShadowFrames(desktop, playing, false)).toBe(48)
    expect(getFirearmContactShadowFrames(constrained, playing, false)).toBe(24)
    const pausedFrames = getFirearmContactShadowFrames(
      desktop,
      { ...playing, status: 'paused' },
      false,
    )
    const completeFrames = getFirearmContactShadowFrames(
      desktop,
      { ...playing, status: 'complete' },
      false,
    )
    expect(pausedFrames).toBe(1)
    expect(completeFrames).toBe(1)
    expect(getFirearmContactShadowFrames(desktop, playing, true)).toBe(1)

    for (const frames of [
      getFirearmContactShadowFrames(desktop, playing, false),
      getFirearmContactShadowFrames(constrained, playing, false),
      getFirearmContactShadowFrames(desktop, playing, true),
      pausedFrames,
      completeFrames,
    ]) {
      expect(Number.isFinite(frames)).toBe(true)
    }
  })
})
