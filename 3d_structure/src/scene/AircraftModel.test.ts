import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { BoxGeometry, BufferGeometry, Vector3 } from 'three'
import { x57Parts, x57Steps } from '../content/x57'
import type { X57PartId } from '../content/types'
import {
  AIRCRAFT_FUSELAGE_PROFILE,
  AIRCRAFT_GEOMETRY_BUDGET,
  AIRCRAFT_GEAR_CONTACTS,
  AIRCRAFT_SURFACE_LAYOUT,
  createAircraftGeometrySet,
  disposeAircraftGeometrySet,
  getAircraftGeometryBudgetReport,
  mergeOwnedAircraftGeometries,
  prepareAircraftGeometry,
} from './AircraftGeometry'
import {
  AIRCRAFT_FOCUS_POINTS,
  AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS,
  AIRCRAFT_PRINCIPLE_FLOW_PATHS,
  AIRCRAFT_PROCEDURAL_PART_IDS,
  AIRCRAFT_TEACHING_GLOW_MATERIALS,
  AIRCRAFT_WINGTIP_MOTOR_POSITIONS,
  useAircraftGeometrySet,
  isAircraftPrincipleActive,
} from './AircraftModel'
import {
  getAircraftPartMotion,
  isAircraftRaycastDisabled,
  isAircraftShell,
} from './AircraftPart'

const EXPECTED_PART_IDS = [
  'airframe-cabin',
  'high-aspect-wing',
  'tail-control-surfaces',
  'landing-gear',
  'wingtip-cruise-motors',
  'high-lift-motor-array',
  'battery-modules',
  'dual-power-bus',
  'inverter-controllers',
  'cockpit-monitoring',
  'passive-cooling-path',
] as const satisfies readonly X57PartId[]

const EXPECTED_FOCUS_POINTS = {
  'airframe-cabin': [0, 0.18, 0],
  'high-aspect-wing': [0.1, 0.47, 0],
  'tail-control-surfaces': [-2.55, 0.52, 0],
  'landing-gear': [-0.05, -0.52, 0],
  'wingtip-cruise-motors': [0.18, 0.43, 0],
  'high-lift-motor-array': [0.63, 0.45, 0],
  'battery-modules': [-0.42, 0.02, 0],
  'dual-power-bus': [0.05, 0.29, 0],
  'inverter-controllers': [0.35, 0.2, 0],
  'cockpit-monitoring': [1.18, 0.42, 0],
  'passive-cooling-path': [0.14, 0.62, 0],
} as const satisfies Record<X57PartId, readonly [number, number, number]>

const EXPECTED_EXPLODE_OFFSETS = {
  'airframe-cabin': [0, 0.35, 0],
  'high-aspect-wing': [0, 0.85, 0],
  'tail-control-surfaces': [-0.8, 0.55, 0],
  'landing-gear': [0, -0.65, 0],
  'wingtip-cruise-motors': [0.25, 0.25, 1.25],
  'high-lift-motor-array': [0.45, 0.55, 0],
  'battery-modules': [-0.25, 0.75, 0],
  'dual-power-bus': [0, 0.15, 0.85],
  'inverter-controllers': [0.55, 0.25, 0],
  'cockpit-monitoring': [0.8, 0.75, 0],
  'passive-cooling-path': [0.3, 1.05, -0.55],
} as const satisfies Record<X57PartId, readonly [number, number, number]>

const EXPECTED_HIGH_LIFT_MOTORS = [
  [0.63, 0.45, 0.82],
  [0.63, 0.45, -0.82],
  [0.63, 0.45, 1.44],
  [0.63, 0.45, -1.44],
  [0.63, 0.45, 2.06],
  [0.63, 0.45, -2.06],
  [0.63, 0.45, 2.68],
  [0.63, 0.45, -2.68],
  [0.63, 0.45, 3.3],
  [0.63, 0.45, -3.3],
  [0.63, 0.45, 3.92],
  [0.63, 0.45, -3.92],
] as const

const triangleA = new Vector3()
const triangleB = new Vector3()
const triangleC = new Vector3()
const edgeAB = new Vector3()
const edgeAC = new Vector3()

function expectSoundGeometry(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.index

  expect(position).toBeDefined()
  expect(normal).toBeDefined()
  expect(Array.from(position.array).every(Number.isFinite)).toBe(true)
  expect(Array.from(normal.array).every(Number.isFinite)).toBe(true)

  const triangleCoordinateCount = index?.count ?? position.count
  expect(triangleCoordinateCount % 3).toBe(0)
  for (let offset = 0; offset < triangleCoordinateCount; offset += 3) {
    const a = index ? index.getX(offset) : offset
    const b = index ? index.getX(offset + 1) : offset + 1
    const c = index ? index.getX(offset + 2) : offset + 2
    triangleA.fromBufferAttribute(position, a)
    triangleB.fromBufferAttribute(position, b)
    triangleC.fromBufferAttribute(position, c)
    edgeAB.subVectors(triangleB, triangleA)
    edgeAC.subVectors(triangleC, triangleA)
    expect(edgeAB.cross(edgeAC).lengthSq()).toBeGreaterThan(1e-12)
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  expect(
    [
      ...geometry.boundingBox!.min.toArray(),
      ...geometry.boundingBox!.max.toArray(),
      ...geometry.boundingSphere!.center.toArray(),
      geometry.boundingSphere!.radius,
    ].every(Number.isFinite),
  ).toBe(true)
  expect(geometry.boundingSphere!.radius).toBeGreaterThan(0)
}

function sectionCenterY(
  geometry: BufferGeometry,
  includes: (z: number) => boolean,
) {
  const position = geometry.getAttribute('position')
  const values = Array.from({ length: position.count }, (_, index) => index)
    .filter((index) => includes(position.getZ(index)))
    .map((index) => position.getY(index))
  expect(values.length).toBeGreaterThan(0)
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

describe('X-57 procedural model contract', () => {
  it('uses owned geometry resources instead of render-time primitives', () => {
    const modelSource = readFileSync(
      resolve(process.cwd(), 'src/scene/AircraftModel.tsx'),
      'utf8',
    )

    expect(modelSource).toContain('<GeometryInstances')
    expect(modelSource).not.toMatch(/<(?:box|sphere|cone|cylinder|torus)Geometry\b/)
    expect(modelSource).not.toContain('dispose={null}')
    expect(modelSource).toContain("accuracy: 'educational-system-relationships-only'")
    expect(modelSource).toMatch(
      /geometry=\{geometries\.highLiftNacelle\}[\s\S]*transforms=\{HIGH_LIFT_NACELLE_TRANSFORMS\}/,
    )
  })

  it('creates a closed, finite eleven-station fuselage around local X', () => {
    expect(AIRCRAFT_FUSELAGE_PROFILE).toHaveLength(11)
    expect(AIRCRAFT_FUSELAGE_PROFILE[0][1]).toBe(0)
    expect(AIRCRAFT_FUSELAGE_PROFILE.at(-1)![1]).toBe(0)
    expect(
      AIRCRAFT_FUSELAGE_PROFILE.slice(1, -1).every(([, radius]) => radius > 0),
    ).toBe(true)

    const geometries = createAircraftGeometrySet()
    try {
      expectSoundGeometry(geometries.fuselage)
      geometries.fuselage.computeBoundingBox()
      expect(geometries.fuselage.boundingBox!.min.x).toBeLessThan(-2.6)
      expect(geometries.fuselage.boundingBox!.max.x).toBeGreaterThan(2.6)
    } finally {
      disposeAircraftGeometrySet(geometries)
    }
  })

  it('gives the main and tail lifting surfaces thickness and conservative proportions', () => {
    const geometries = createAircraftGeometrySet()
    try {
      expectSoundGeometry(geometries.mainWing)
      expectSoundGeometry(geometries.horizontalTail)
      expectSoundGeometry(geometries.verticalTail)

      geometries.mainWing.computeBoundingBox()
      const size = geometries.mainWing.boundingBox!.getSize(new Vector3())
      expect(size.y).toBeGreaterThan(0.08)
      expect(size.z).toBeGreaterThanOrEqual(8.3)
      expect(size.z).toBeLessThanOrEqual(8.5)
      expect(size.z / size.x).toBeGreaterThan(6.5)

      expect(AIRCRAFT_SURFACE_LAYOUT.horizontalTailX).toBeLessThan(
        AIRCRAFT_SURFACE_LAYOUT.mainWingX - 1.5,
      )
      expect(AIRCRAFT_SURFACE_LAYOUT.verticalTailX).toBeLessThan(
        AIRCRAFT_SURFACE_LAYOUT.mainWingX - 1.5,
      )
    } finally {
      disposeAircraftGeometrySet(geometries)
    }
  })

  it('raises both main-wing tips symmetrically above the root section', () => {
    const geometries = createAircraftGeometrySet()
    try {
      const rootCenterY = sectionCenterY(
        geometries.mainWing,
        (z) => Math.abs(z) < 0.04,
      )
      const leftTipCenterY = sectionCenterY(
        geometries.mainWing,
        (z) => z > 4.1,
      )
      const rightTipCenterY = sectionCenterY(
        geometries.mainWing,
        (z) => z < -4.1,
      )

      expect(leftTipCenterY).toBeCloseTo(rightTipCenterY, 5)
      expect(leftTipCenterY).toBeGreaterThan(rootCenterY)
    } finally {
      disposeAircraftGeometrySet(geometries)
    }
  })

  it('keeps three exact, non-collinear landing contacts', () => {
    expect(AIRCRAFT_GEAR_CONTACTS).toEqual([
      [1.18, -0.55, 0],
      [-0.55, -0.58, 0.72],
      [-0.55, -0.58, -0.72],
    ])

    const [nose, left, right] = AIRCRAFT_GEAR_CONTACTS.map(
      (point) => new Vector3(...point),
    )
    const area = left
      .clone()
      .sub(nose)
      .cross(right.clone().sub(nose))
      .length()
    expect(area).toBeGreaterThan(1)
  })

  it('uses one merged rotor assembly per motor and stays inside geometry budgets', () => {
    const geometries = createAircraftGeometrySet()
    try {
      expectSoundGeometry(geometries.highLiftRotor)
      expectSoundGeometry(geometries.wingtipRotor)
      expect(geometries.highLiftRotor.groups).toHaveLength(3)
      expect(geometries.wingtipRotor.groups).toHaveLength(3)

      const report = getAircraftGeometryBudgetReport(geometries)
      expect(report.baseDrawCalls).toBeLessThan(60)
      expect(report.principleDrawCalls).toBeLessThan(90)
      expect(report.renderedTriangles).toBeGreaterThan(report.geometryTriangles)
      expect(report.renderedTriangles).toBeLessThanOrEqual(
        AIRCRAFT_GEOMETRY_BUDGET.triangles,
      )
      expect(report.instancedDetails).toBeGreaterThanOrEqual(40)
    } finally {
      disposeAircraftGeometrySet(geometries)
    }
  })

  it('owns one geometry set and disposes every resource exactly once', () => {
    const generated: ReturnType<typeof createAircraftGeometrySet>[] = []
    const disposeSpies = new Map<BufferGeometry, ReturnType<typeof vi.spyOn>>()
    const factory = vi.fn(() => {
      const geometries = createAircraftGeometrySet()
      generated.push(geometries)
      Object.values(geometries).forEach((geometry) => {
        disposeSpies.set(geometry, vi.spyOn(geometry, 'dispose'))
      })
      return geometries
    })
    const disposer = vi.fn(disposeAircraftGeometrySet)

    const { result, unmount } = renderHook(
      () => useAircraftGeometrySet(factory, disposer),
      { wrapper: StrictMode },
    )

    expect(generated.length).toBeGreaterThanOrEqual(2)
    expect(result.current).not.toBeNull()
    generated.forEach((geometries) => {
      Object.values(geometries).forEach((geometry) => {
        expect(disposeSpies.get(geometry)).toHaveBeenCalledTimes(
          geometries === result.current ? 0 : 1,
        )
      })
    })

    unmount()
    generated.forEach((geometries) => {
      Object.values(geometries).forEach((geometry) => {
        expect(disposeSpies.get(geometry)).toHaveBeenCalledTimes(1)
      })
    })
    expect(disposer).toHaveBeenCalledTimes(generated.length)
  })

  it('releases prepared and merged geometry when bounds preparation throws', () => {
    const direct = new BoxGeometry()
    const directDispose = vi.spyOn(direct, 'dispose')
    vi.spyOn(direct, 'computeBoundingBox').mockImplementation(() => {
      throw new Error('bounds failure')
    })
    expect(() => prepareAircraftGeometry(direct)).toThrow('bounds failure')
    expect(directDispose).toHaveBeenCalledTimes(1)

    const inputs = [new BoxGeometry(), new BoxGeometry()]
    const inputDisposes = inputs.map((geometry) => vi.spyOn(geometry, 'dispose'))
    const merged = new BoxGeometry()
    const mergedDispose = vi.spyOn(merged, 'dispose')
    vi.spyOn(merged, 'computeBoundingSphere').mockImplementation(() => {
      throw new Error('sphere failure')
    })
    expect(() =>
      mergeOwnedAircraftGeometries(inputs, 'failure probe', () => merged),
    ).toThrow('sphere failure')
    inputDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1))
    expect(mergedDispose).toHaveBeenCalledTimes(1)
  })

  it('implements every authored learning part exactly once', () => {
    expect(AIRCRAFT_PROCEDURAL_PART_IDS).toEqual(EXPECTED_PART_IDS)
    expect(x57Parts.map((part) => part.id)).toEqual(EXPECTED_PART_IDS)
    expect(x57Steps.map((step) => step.id)).toEqual([
      'whole',
      'exterior',
      'hull',
      'power',
      'running',
      'details',
    ])
    expect(new Set(AIRCRAFT_PROCEDURAL_PART_IDS).size).toBe(
      AIRCRAFT_PROCEDURAL_PART_IDS.length,
    )
  })

  it('places twelve high-lift motors as mirrored wing pairs', () => {
    expect(AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS).toEqual(
      EXPECTED_HIGH_LIFT_MOTORS,
    )

    for (const [x, y, z] of AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS) {
      expect(z).not.toBe(0)
      expect(AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS).toContainEqual([x, y, -z])
    }
  })

  it('places the two cruise motors symmetrically at the wing tips', () => {
    expect(AIRCRAFT_WINGTIP_MOTOR_POSITIONS).toEqual([
      [0.18, 0.43, 4.72],
      [0.18, 0.43, -4.72],
    ])

    const [left, right] = AIRCRAFT_WINGTIP_MOTOR_POSITIONS
    expect(left[0]).toBe(right[0])
    expect(left[1]).toBe(right[1])
    expect(left[2]).toBe(-right[2])
    expect(Math.abs(left[2])).toBeGreaterThan(4)
  })

  it('provides a finite three-dimensional focus point for every part', () => {
    expect(AIRCRAFT_FOCUS_POINTS).toEqual(EXPECTED_FOCUS_POINTS)

    for (const id of EXPECTED_PART_IDS) {
      const focus = AIRCRAFT_FOCUS_POINTS[id]

      expect(focus).toHaveLength(3)
      expect(focus.every(Number.isFinite)).toBe(true)
    }
  })

  it('keeps every authored explode offset frozen while revealing by stage', () => {
    expect(
      Object.fromEntries(x57Parts.map((part) => [part.id, part.explodeOffset])),
    ).toEqual(EXPECTED_EXPLODE_OFFSETS)

    for (const part of x57Parts) {
      expect(getAircraftPartMotion(part, 5, 'explode', false).position).toEqual(
        EXPECTED_EXPLODE_OFFSETS[part.id],
      )
    }

    const battery = x57Parts.find((part) => part.id === 'battery-modules')!
    expect(getAircraftPartMotion(battery, 2, 'explode', false).position).toEqual([
      0,
      0,
      0,
    ])
  })

  it('lets xray pointer hits pass through the airframe shells', () => {
    const airframe = x57Parts.find((part) => part.id === 'airframe-cabin')!
    const battery = x57Parts.find((part) => part.id === 'battery-modules')!

    expect(isAircraftShell(airframe.id)).toBe(true)
    expect(isAircraftShell(battery.id)).toBe(false)
    expect(
      getAircraftPartMotion(airframe, 5, 'xray', false).material,
    ).toMatchObject({ state: 'xray', transparent: true, depthWrite: false })
    expect(
      getAircraftPartMotion(battery, 5, 'xray', false).material,
    ).toMatchObject({ state: 'solid', transparent: false, depthWrite: true })
    expect(isAircraftRaycastDisabled(airframe.id, 'xray')).toBe(true)
    expect(isAircraftRaycastDisabled(airframe.id, 'principle')).toBe(true)
    expect(isAircraftRaycastDisabled(battery.id, 'xray')).toBe(false)
    expect(isAircraftRaycastDisabled(airframe.id, 'explode')).toBe(false)
  })

  it('keeps the passive cooling teaching volume transparent', () => {
    const coolingPath = x57Parts.find(
      (part) => part.id === 'passive-cooling-path',
    )!

    expect(
      getAircraftPartMotion(coolingPath, 5, 'explode', false).material,
    ).toMatchObject({
      state: 'solid',
      role: 'teaching-volume',
      transparent: true,
      depthWrite: false,
    })
  })

  it('connects battery, buses, controllers, and every motor in the principle flow', () => {
    const stages = AIRCRAFT_PRINCIPLE_FLOW_PATHS.reduce<
      Record<string, typeof AIRCRAFT_PRINCIPLE_FLOW_PATHS[number][]>
    >((groups, path) => {
      ;(groups[path.stage] ??= []).push(path)
      return groups
    }, {})

    expect(stages['battery-bus']).toHaveLength(2)
    expect(stages['bus-controller']).toHaveLength(4)
    expect(stages['controller-motor']).toHaveLength(14)

    const motorEndpoints = (stages['controller-motor'] ?? []).map(
      (path) => path.end,
    )
    for (const position of [
      ...AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS,
      ...AIRCRAFT_WINGTIP_MOTOR_POSITIONS,
    ]) {
      expect(motorEndpoints).toContainEqual(position)
    }
  })

  it('runs principle motion only while explicitly playing at full motion', () => {
    expect(isAircraftPrincipleActive('principle', true, false)).toBe(true)
    expect(isAircraftPrincipleActive('principle', false, false)).toBe(false)
    expect(isAircraftPrincipleActive('principle', true, true)).toBe(false)
    expect(isAircraftPrincipleActive('explode', true, false)).toBe(false)
  })

  it('uses HDR non-tone-mapped materials only for principle teaching overlays', () => {
    for (const material of Object.values(AIRCRAFT_TEACHING_GLOW_MATERIALS)) {
      expect(material.toneMapped).toBe(false)
      expect(Math.max(material.color.r, material.color.g, material.color.b)).toBeGreaterThan(1)
    }
  })
})
