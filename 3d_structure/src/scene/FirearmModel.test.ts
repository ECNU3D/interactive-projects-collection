import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Raycaster,
  Vector3,
} from 'three'
import { firearmExhibits } from '../content/firearms'
import {
  firearmExhibitIds,
  firearmPartIds,
  type FirearmExhibitId,
} from '../content/types'
import {
  FIREARM_CYCLE_PHASE_DURATION_MS,
  sampleFirearmCycle,
  type FirearmCycleSample,
} from './firearmCycle'
import {
  PROCEDURAL_FIREARM_PART_IDS,
  applyFirearmCycleVisuals,
  getProceduralFirearmPartCoverage,
  getFirearmSampleRequest,
  getProjectileSubstituteOpacity,
  resolveFirearmPhaseProgress,
} from './FirearmModel'
import { disableFirearmSubstituteRaycast } from './FirearmGeometry'

describe('procedural firearm model contract', () => {
  it.each(firearmExhibitIds)(
    '%s renders every authored selectable group exactly once',
    (exhibitId) => {
      expect(PROCEDURAL_FIREARM_PART_IDS).toEqual(firearmPartIds)
      expect(getProceduralFirearmPartCoverage(exhibitId)).toEqual(
        firearmExhibits[exhibitId].parts.map((part) => part.id),
      )
      expect(new Set(getProceduralFirearmPartCoverage(exhibitId)).size).toBe(11)
    },
  )

  it('applies every sampler field to the real Three visual targets', () => {
    const refs = {
      breech: { current: new Group() },
      barrel: { current: new Group() },
      lock: { current: new Group() },
      drive: { current: new Group() },
      feed: { current: new Group() },
      extractedCase: { current: new Group() },
      extractedCaseMaterial: { current: new MeshPhysicalMaterial() },
      projectile: { current: new Group() },
      projectileMaterial: { current: new MeshPhysicalMaterial() },
      indicator: { current: new Group() },
      energy: { current: new Group() },
    }
    const sample: FirearmCycleSample = {
      breechX: 0.2,
      breechRotation: 0.3,
      barrelX: -0.1,
      barrelY: -0.08,
      driveX: -0.4,
      lockAmount: 0.6,
      returnCompression: 0.5,
      feedLift: 0.25,
      caseX: -0.2,
      caseY: 0.3,
      caseVisible: true,
      projectileX: 0.65,
      projectileVisible: true,
      energyAmount: 0.7,
    }

    applyFirearmCycleVisuals(refs, sample)

    expect(refs.breech.current.position.x).toBeCloseTo(0.25)
    expect(refs.breech.current.rotation.x).toBeCloseTo(0.3)
    expect(refs.barrel.current.position.x).toBeCloseTo(-0.115)
    expect(refs.barrel.current.position.y).toBeCloseTo(-0.112)
    expect(refs.lock.current.position.y).toBeCloseTo(-0.078)
    expect(refs.lock.current.rotation.z).toBeCloseTo(0.168)
    expect(refs.drive.current.position.x).toBeCloseTo(-0.52)
    expect(refs.drive.current.scale.x).toBeCloseTo(0.84)
    expect(refs.feed.current.position.y).toBeCloseTo(0.18)
    expect(refs.extractedCase.current.position.x).toBeCloseTo(-0.36)
    expect(refs.extractedCase.current.position.y).toBeCloseTo(0.435)
    expect(refs.extractedCase.current.visible).toBe(true)
    expect(refs.extractedCaseMaterial.current.opacity).toBeCloseTo(0.62)
    expect(refs.projectile.current.position.x).toBeCloseTo(1.365)
    expect(refs.projectile.current.visible).toBe(true)
    expect(refs.projectileMaterial.current.opacity).toBeCloseTo(
      getProjectileSubstituteOpacity(true, sample.projectileX),
    )
    expect(refs.indicator.current.rotation.z).toBeCloseTo(0.7 * Math.PI * 1.6)
    expect(refs.indicator.current.scale.x).toBeCloseTo(1.045)
    expect(refs.energy.current.visible).toBe(true)
    expect(refs.energy.current.scale.x).toBeCloseTo(1.225)

    applyFirearmCycleVisuals(refs, {
      ...sample,
      caseVisible: false,
      projectileVisible: false,
      energyAmount: 0,
    })
    expect(refs.extractedCase.current.visible).toBe(false)
    expect(refs.extractedCaseMaterial.current.opacity).toBe(0)
    expect(refs.projectile.current.visible).toBe(false)
    expect(refs.projectileMaterial.current.opacity).toBe(0)
    expect(refs.energy.current.visible).toBe(false)
  })

  it('requests the canonical first phase when cycle state is absent', () => {
    expect(getFirearmSampleRequest('principle', undefined, false, 0.73)).toEqual({
      active: false,
      phaseIndex: 0,
      phaseProgress: 0,
    })
  })

  it('never requests cycle sampling outside principle mode', () => {
    expect(
      getFirearmSampleRequest(
        'xray',
        { phaseIndex: 4, status: 'playing', revision: 2 },
        false,
        0.6,
      ),
    ).toBeNull()
  })

  it('continues playing, freezes paused progress, and samples phase ends for reduced motion', () => {
    const state = { phaseIndex: 4, revision: 3 } as const

    expect(
      getFirearmSampleRequest(
        'principle',
        { ...state, status: 'playing' },
        false,
        0.42,
      ),
    ).toEqual({ active: true, phaseIndex: 4, phaseProgress: 0.42 })
    expect(
      getFirearmSampleRequest(
        'principle',
        { ...state, status: 'paused' },
        false,
        0.42,
      ),
    ).toEqual({ active: false, phaseIndex: 4, phaseProgress: 0.42 })
    expect(
      getFirearmSampleRequest(
        'principle',
        { ...state, status: 'playing' },
        true,
        0.1,
      ),
    ).toEqual({ active: false, phaseIndex: 4, phaseProgress: 1 })
  })

  it('finishes phase five at canonical rest regardless of stale progress', () => {
    const request = getFirearmSampleRequest(
      'principle',
      { phaseIndex: 5, status: 'complete', revision: 8 },
      false,
      0.2,
    )

    expect(request).toEqual({ active: false, phaseIndex: 5, phaseProgress: 1 })
    for (const exhibitId of firearmExhibitIds) {
      expect(sampleFirearmCycle(kindFor(exhibitId), 5, 1)).toEqual(
        sampleFirearmCycle(kindFor(exhibitId), 0, 0),
      )
    }
  })

  it('fades the inert substitute near the end of its internal teaching path', () => {
    expect(getProjectileSubstituteOpacity(false, 0.2)).toBe(0)
    expect(getProjectileSubstituteOpacity(true, 0.2)).toBeGreaterThan(0.5)
    expect(getProjectileSubstituteOpacity(true, 0.76)).toBeLessThan(
      getProjectileSubstituteOpacity(true, 0.55),
    )
    expect(getProjectileSubstituteOpacity(true, 0.76)).toBeGreaterThan(0)
  })

  it('persists endpoint sampling until phase or revision identity changes', () => {
    const playing = {
      phaseIndex: 4,
      status: 'playing' as const,
      revision: 3,
    }
    let progress = resolveFirearmPhaseProgress(
      0.4,
      4,
      3,
      'principle',
      playing,
      true,
      0,
    )
    expect(progress).toBe(1)

    progress = resolveFirearmPhaseProgress(
      progress,
      4,
      3,
      'principle',
      playing,
      false,
      0,
    )
    expect(progress).toBe(1)
    expect(
      resolveFirearmPhaseProgress(
        progress,
        4,
        3,
        'principle',
        { ...playing, phaseIndex: 5 },
        false,
        0,
      ),
    ).toBe(0)
    expect(
      resolveFirearmPhaseProgress(
        0.3,
        5,
        3,
        'principle',
        { phaseIndex: 5, status: 'complete', revision: 3 },
        false,
        0,
      ),
    ).toBe(1)
    expect(
      resolveFirearmPhaseProgress(
        0.6,
        4,
        3,
        'principle',
        { ...playing, revision: 4 },
        false,
        0,
      ),
    ).toBe(0)
  })

  it('advances playing progress from the shared phase duration', () => {
    expect(
      resolveFirearmPhaseProgress(
        0,
        2,
        7,
        'principle',
        { phaseIndex: 2, status: 'playing', revision: 7 },
        false,
        FIREARM_CYCLE_PHASE_DURATION_MS / 2,
      ),
    ).toBe(0.5)
  })

  it('disables hidden substitute hits without disabling selectable part geometry', () => {
    const root = new Group()
    const selectable = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
    )
    const hiddenSubstitute = new Mesh(
      new BoxGeometry(0.5, 0.5, 0.5),
      new MeshBasicMaterial(),
    )
    hiddenSubstitute.visible = false
    root.add(selectable, hiddenSubstitute)
    root.updateMatrixWorld(true)
    const raycaster = new Raycaster(
      new Vector3(0, 0, 3),
      new Vector3(0, 0, -1),
    )

    expect(
      raycaster
        .intersectObject(hiddenSubstitute, false)
        .some((hit) => hit.object === hiddenSubstitute),
    ).toBe(true)

    disableFirearmSubstituteRaycast(hiddenSubstitute)
    const intersections = raycaster.intersectObject(root, true)

    expect(intersections.some((hit) => hit.object === hiddenSubstitute)).toBe(
      false,
    )
    expect(intersections.some((hit) => hit.object === selectable)).toBe(true)

    selectable.geometry.dispose()
    hiddenSubstitute.geometry.dispose()
    ;(selectable.material as MeshBasicMaterial).dispose()
    ;(hiddenSubstitute.material as MeshBasicMaterial).dispose()
  })
})

function kindFor(exhibitId: FirearmExhibitId) {
  return firearmExhibits[exhibitId].cycleKind
}
