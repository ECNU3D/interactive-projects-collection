import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { asr10Parts, asr10Steps } from '../content/asr10'
import type { Asr10PartId } from '../content/types'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import {
  VESSEL_HULL_SECTIONS,
  VESSEL_MAIN_DECK_PLANFORM,
  VESSEL_RUB_RAIL_TRANSFORMS,
  VESSEL_SUPERSTRUCTURE_LAYOUT,
  createVesselDetailFrameGeometry,
  createVesselGeometrySet,
  disposeVesselGeometrySet,
  getVesselGeometryBudgetReport,
} from './VesselGeometry'
import {
  VESSEL_ENGINE_POSITIONS,
  VESSEL_FOCUS_POINTS,
  VESSEL_PRINCIPLE_FLOW_PATHS,
  VESSEL_PROCEDURAL_PART_IDS,
  VESSEL_PROPELLER_POSITIONS,
  VESSEL_RUDDER_POSITIONS,
  VESSEL_TEACHING_GLOW_MATERIALS,
  VESSEL_SHAFT_PATHS,
  getVesselSceneBudgetReport,
  isVesselPrincipleActive,
  useVesselGeometrySet,
  useVesselRenderBudgetProbe,
} from './VesselModel'
import { getVesselPartMotion, isVesselShell } from './VesselPart'

const EXPECTED_PART_IDS = [
  'vessel-hull-shell',
  'deck-superstructure',
  'buoyancy-compartments',
  'twin-engine-modules',
  'shaft-paths',
  'propeller-concept',
  'rudder-steering',
  'bilge-pump-path',
  'wheelhouse-observation-mast',
  'rescue-work-deck',
  'survivor-space',
] as const satisfies readonly Asr10PartId[]

const EXPECTED_FOCUS_POINTS = {
  'vessel-hull-shell': [0, -0.08, 0],
  'deck-superstructure': [0.45, 0.72, 0],
  'buoyancy-compartments': [0.15, -0.12, 0],
  'twin-engine-modules': [-0.35, -0.23, 0],
  'shaft-paths': [-1.75, -0.5, 0],
  'propeller-concept': [-2.95, -0.66, 0],
  'rudder-steering': [-3.22, -0.38, 0],
  'bilge-pump-path': [0.15, -0.58, 0],
  'wheelhouse-observation-mast': [0.65, 1.35, 0],
  'rescue-work-deck': [-1.35, 0.52, 0],
  'survivor-space': [1.2, 0.02, 0],
} as const satisfies Record<Asr10PartId, readonly [number, number, number]>

const EXPECTED_EXPLODE_OFFSETS = {
  'vessel-hull-shell': [0, -0.45, 0],
  'deck-superstructure': [0, 0.65, 0],
  'buoyancy-compartments': [0, 0.2, 0.85],
  'twin-engine-modules': [-0.45, 0.35, 0],
  'shaft-paths': [0, -0.25, 0.55],
  'propeller-concept': [-0.75, -0.15, 0.75],
  'rudder-steering': [-0.6, 0.2, -0.75],
  'bilge-pump-path': [0.25, -0.55, 0],
  'wheelhouse-observation-mast': [0.4, 1.2, 0],
  'rescue-work-deck': [0.65, 0.8, 0],
  'survivor-space': [0.55, 0.45, -0.55],
} as const satisfies Record<Asr10PartId, readonly [number, number, number]>

const expectFiniteVector = (value: readonly number[]) => {
  expect(value).toHaveLength(3)
  expect(value.every(Number.isFinite)).toBe(true)
}

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
  expect(index).not.toBeNull()
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

function groupCentroidAngleAroundX(
  geometry: BufferGeometry,
  groupIndex: number,
) {
  const position = geometry.getAttribute('position')
  const index = geometry.index!
  const group = geometry.groups[groupIndex]
  const vertices = new Set<number>()
  for (let offset = group.start; offset < group.start + group.count; offset += 1) {
    vertices.add(index.getX(offset))
  }
  const centroid = [...vertices].reduce(
    (sum, vertexIndex) =>
      sum.add(
        new Vector3(
          position.getX(vertexIndex),
          position.getY(vertexIndex),
          position.getZ(vertexIndex),
        ),
      ),
    new Vector3(),
  )
  centroid.multiplyScalar(1 / vertices.size)
  return Math.atan2(centroid.z, centroid.y)
}

describe('modern rescue vessel teaching-composite contract', () => {
  it('batches repeated details without delegating vessel resources to R3F', () => {
    const modelSource = readFileSync(
      resolve(process.cwd(), 'src/scene/VesselModel.tsx'),
      'utf8',
    )

    expect(modelSource).toContain('<GeometryInstances')
    expect(modelSource).not.toMatch(/<(?:box|sphere|cone|cylinder)Geometry\b/)
    expect(modelSource).not.toContain('dispose={null}')
    expect(modelSource).toContain("accuracy: 'educational-system-relationships-only'")
  })

  it('defines an original nine-station hull with sheer and chine inside the camera envelope', () => {
    expect(VESSEL_HULL_SECTIONS).toHaveLength(9)

    const midpoint = VESSEL_HULL_SECTIONS[Math.floor(VESSEL_HULL_SECTIONS.length / 2)]
    const stern = VESSEL_HULL_SECTIONS[0]
    const bow = VESSEL_HULL_SECTIONS.at(-1)!
    expect(midpoint.halfWidth).toBeGreaterThan(stern.halfWidth)
    expect(midpoint.halfWidth).toBeGreaterThan(bow.halfWidth)
    expect(stern.deckY).toBeGreaterThan(midpoint.deckY)
    expect(bow.deckY).toBeGreaterThan(midpoint.deckY)

    for (const section of VESSEL_HULL_SECTIONS) {
      expect(section.chineY).toBeGreaterThan(section.keelY)
      expect(section.chineY).toBeLessThan(section.deckY)
    }

    const geometries = createVesselGeometrySet()
    try {
      expectSoundGeometry(geometries.hull)
      expect(geometries.hull.boundingBox!.min.x).toBeGreaterThanOrEqual(-3.3)
      expect(geometries.hull.boundingBox!.max.x).toBeLessThanOrEqual(3.3)
      expect(geometries.hull.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.95)
      expect(geometries.hull.boundingBox!.max.y).toBeLessThanOrEqual(0.75)
      expect(geometries.hull.boundingBox!.min.z).toBeGreaterThanOrEqual(-1.25)
      expect(geometries.hull.boundingBox!.max.z).toBeLessThanOrEqual(1.25)
    } finally {
      disposeVesselGeometrySet(geometries)
    }
  })

  it('uses a tapered deck planform that leaves the hull sheer and ends readable', () => {
    const positiveEdges = VESSEL_MAIN_DECK_PLANFORM.filter(
      ([, halfBreadth]) => halfBreadth >= 0,
    )
    const midshipHalfBreadth = Math.max(
      ...positiveEdges.map(([, halfBreadth]) => halfBreadth),
    )
    const endHalfBreadths = positiveEdges
      .filter(
        ([x]) =>
          x === Math.min(...positiveEdges.map(([station]) => station)) ||
          x === Math.max(...positiveEdges.map(([station]) => station)),
      )
      .map(([, halfBreadth]) => halfBreadth)

    expect(new Set(positiveEdges.map(([, halfBreadth]) => halfBreadth)).size).toBeGreaterThan(3)
    endHalfBreadths.forEach((halfBreadth) =>
      expect(halfBreadth).toBeLessThan(midshipHalfBreadth),
    )

    const geometries = createVesselGeometrySet()
    try {
      expectSoundGeometry(geometries.mainDeck)
      expect(geometries.mainDeck.boundingBox!.min.x).toBeGreaterThan(-2.8)
      expect(geometries.mainDeck.boundingBox!.max.x).toBeLessThan(2.9)
      expect(geometries.mainDeck.boundingBox!.min.z).toBeGreaterThan(-1.1)
      expect(geometries.mainDeck.boundingBox!.max.z).toBeLessThan(1.1)
    } finally {
      disposeVesselGeometrySet(geometries)
    }
  })

  it('separates the wheelhouse body from a thin roof canopy', () => {
    const { wheelhouse, roof } = VESSEL_SUPERSTRUCTURE_LAYOUT
    const wheelhouseTop = wheelhouse.position[1] + wheelhouse.height / 2
    const roofBottom = roof.position[1] - roof.height / 2

    expect(roof.role).toBe('thin-roof-canopy')
    expect(roof.height).toBeLessThanOrEqual(0.14)
    expect(roofBottom).toBeGreaterThanOrEqual(wheelhouseTop)

    const geometries = createVesselGeometrySet()
    try {
      geometries.wheelhouseRoof.computeBoundingBox()
      expect(
        geometries.wheelhouseRoof.boundingBox!.max.y -
          geometries.wheelhouseRoof.boundingBox!.min.y,
      ).toBeCloseTo(roof.height)
    } finally {
      disposeVesselGeometrySet(geometries)
    }
  })

  it('follows the tapered sheer with six mirrored rub-rail segments in one batch', () => {
    expect(VESSEL_RUB_RAIL_TRANSFORMS).toHaveLength(6)
    const port = VESSEL_RUB_RAIL_TRANSFORMS.filter(
      (transform) => transform.position[2] > 0,
    ).sort((first, second) => first.position[0] - second.position[0])
    const starboard = VESSEL_RUB_RAIL_TRANSFORMS.filter(
      (transform) => transform.position[2] < 0,
    ).sort((first, second) => first.position[0] - second.position[0])
    expect(port).toHaveLength(3)
    expect(starboard).toHaveLength(3)
    port.forEach((transform, index) => {
      expect(transform.position[0]).toBe(starboard[index].position[0])
      expect(transform.position[1]).toBe(starboard[index].position[1])
      expect(transform.position[2]).toBe(-starboard[index].position[2])
      expect(transform.rotation[1]).toBeCloseTo(-starboard[index].rotation[1])
    })
    expect(port[0].position[2]).toBeLessThan(port[1].position[2])
    expect(port[2].position[2]).toBeLessThan(port[1].position[2])

    const geometries = createVesselGeometrySet()
    try {
      geometries.rubRail.computeBoundingBox()
      expect(
        geometries.rubRail.boundingBox!.max.x -
          geometries.rubRail.boundingBox!.min.x,
      ).toBeLessThanOrEqual(1.8)
    } finally {
      disposeVesselGeometrySet(geometries)
    }
  })

  it('builds one finite abstract three-blade propeller assembly at exact 120 degree spacing', () => {
    const geometries = createVesselGeometrySet()
    try {
      expectSoundGeometry(geometries.propellerBlades)
      expect(geometries.propellerBlades.groups).toHaveLength(3)
      const angles = geometries.propellerBlades.groups
        .map((_, index) => groupCentroidAngleAroundX(geometries.propellerBlades, index))
        .sort((first, second) => first - second)
      const gaps = angles.map((angle, index) => {
        const next = angles[(index + 1) % angles.length]
        return (next - angle + Math.PI * 2) % (Math.PI * 2)
      })
      gaps.forEach((gap) => expect(gap).toBeCloseTo((Math.PI * 2) / 3, 5))

      const [root, middle, tip] = geometries.propellerStations
      expect(new Set([root.twist, middle.twist, tip.twist]).size).toBe(3)
      expect(new Set([root.chord, middle.chord, tip.chord]).size).toBe(3)
      expect(tip.sweep).not.toBe(root.sweep)
    } finally {
      disposeVesselGeometrySet(geometries)
    }
  })

  it('keeps generic window and hatch frames open and rejects overlapping bars', () => {
    const frame = createVesselDetailFrameGeometry(0.38, 0.3, 0.04, 0.045)
    try {
      expectSoundGeometry(frame)
      expect(frame.index!.count / 3).toBe(48)
      const position = frame.getAttribute('position')
      const centerVertices = Array.from(
        { length: position.count },
        (_, index) => index,
      ).filter(
        (index) =>
          Math.abs(position.getX(index)) < 0.1 &&
          Math.abs(position.getY(index)) < 0.07,
      )
      expect(centerVertices).toHaveLength(0)
    } finally {
      frame.dispose()
    }

    expect(() =>
      createVesselDetailFrameGeometry(0.08, 0.3, 0.045, 0.04),
    ).toThrow('frame bars must leave an open center')
  })

  it('keeps the descriptive geometry estimate available without using it as the budget authority', () => {
    const geometries = createVesselGeometrySet()
    try {
      const report = getVesselGeometryBudgetReport(geometries)
      expect(report.geometryTriangles).toBeGreaterThan(0)
      expect(report.renderedTriangles).toBeGreaterThanOrEqual(
        report.geometryTriangles,
      )
      expect(report.instancedDetails).toBeGreaterThan(6)
    } finally {
      disposeVesselGeometrySet(geometries)
    }
  })

  it('counts visible scene draw calls and triangles from real Three objects', () => {
    const groupedGeometry = new BufferGeometry()
    groupedGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        [
          0, 0, 0, 1, 0, 0, 0, 1, 0,
          0, 0, 1, 1, 0, 1, 0, 1, 1,
        ],
        3,
      ),
    )
    groupedGeometry.addGroup(0, 3, 0)
    groupedGeometry.addGroup(3, 3, 1)
    const triangleGeometry = new BufferGeometry()
    triangleGeometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    const lineGeometry = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
    ])
    const groupedMaterials = [new MeshBasicMaterial(), new MeshBasicMaterial()]
    const instanceMaterial = new MeshBasicMaterial()
    const lineMaterial = new LineBasicMaterial()
    const root = new Group()
    root.add(new Mesh(groupedGeometry, groupedMaterials))
    root.add(new InstancedMesh(triangleGeometry, instanceMaterial, 4))
    root.add(new Line(lineGeometry, lineMaterial))
    const hiddenBranch = new Group()
    hiddenBranch.visible = false
    hiddenBranch.add(new Mesh(triangleGeometry, instanceMaterial))
    root.add(hiddenBranch)

    try {
      expect(getVesselSceneBudgetReport(root)).toEqual({
        baseDrawCalls: 4,
        renderedTriangles: 6,
        instancedDetails: 4,
        visibleRenderObjects: 3,
        withinBudget: true,
      })
    } finally {
      groupedGeometry.dispose()
      triangleGeometry.dispose()
      lineGeometry.dispose()
      groupedMaterials.forEach((material) => material.dispose())
      instanceMaterial.dispose()
      lineMaterial.dispose()
    }
  })

  it('multiplies ordinary meshes backed by multi-segment LineGeometry', () => {
    const geometry = new LineGeometry()
    geometry.setPositions([
      0, 0, 0,
      1, 0, 0,
      2, 0, 0,
      3, 0, 0,
    ])
    const material = new LineMaterial()
    const root = new Group()
    root.add(new Line2(geometry, material))

    try {
      expect(geometry.instanceCount).toBe(3)
      expect(getVesselSceneBudgetReport(root)).toMatchObject({
        baseDrawCalls: 1,
        renderedTriangles: 18,
        visibleRenderObjects: 1,
      })

      geometry.instanceCount = Number.POSITIVE_INFINITY
      expect(getVesselSceneBudgetReport(root)).toMatchObject({
        baseDrawCalls: 1,
        renderedTriangles: 18,
        visibleRenderObjects: 1,
      })

      geometry.instanceCount = 0
      expect(getVesselSceneBudgetReport(root)).toMatchObject({
        baseDrawCalls: 0,
        renderedTriangles: 0,
        visibleRenderObjects: 0,
      })
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })

  it('writes the authoritative runtime report onto the assembled model root', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    const material = new MeshBasicMaterial()
    const root = new Group()
    root.add(new Mesh(geometry, material))
    const rootRef = { current: root }
    const canvas = document.createElement('canvas')

    try {
      renderHook(() =>
        useVesselRenderBudgetProbe(rootRef, ['assembled'], canvas),
      )

      expect(root.userData.renderBudget).toEqual(
        getVesselSceneBudgetReport(root),
      )
      expect(root.userData.renderBudget.withinBudget).toBe(true)
      expect(canvas.dataset.vesselDrawCalls).toBe('1')
      expect(canvas.dataset.vesselRenderedTriangles).toBe('1')
      expect(canvas.dataset.vesselRenderBudget).toBe('pass')
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })

  it('owns one geometry set and disposes every resource exactly once on unmount', () => {
    const generated: ReturnType<typeof createVesselGeometrySet>[] = []
    const disposeSpies = new Map<BufferGeometry, ReturnType<typeof vi.spyOn>>()
    const factory = vi.fn(() => {
      const geometries = createVesselGeometrySet()
      generated.push(geometries)
      Object.values(geometries).forEach((resource) => {
        if (resource instanceof BufferGeometry) {
          disposeSpies.set(resource, vi.spyOn(resource, 'dispose'))
        }
      })
      return geometries
    })
    const disposer = vi.fn(disposeVesselGeometrySet)

    const { result, unmount } = renderHook(
      () => useVesselGeometrySet(factory, disposer),
      { wrapper: StrictMode },
    )

    expect(generated.length).toBeGreaterThanOrEqual(2)
    expect(result.current).not.toBeNull()
    generated.forEach((geometries) => {
      Object.values(geometries).forEach((resource) => {
        if (resource instanceof BufferGeometry) {
          expect(disposeSpies.get(resource)).toHaveBeenCalledTimes(
            geometries === result.current ? 0 : 1,
          )
        }
      })
    })

    unmount()
    generated.forEach((geometries) => {
      Object.values(geometries).forEach((resource) => {
        if (resource instanceof BufferGeometry) {
          expect(disposeSpies.get(resource)).toHaveBeenCalledTimes(1)
        }
      })
    })
    expect(disposer).toHaveBeenCalledTimes(generated.length)
  })

  it('implements every authored learning part exactly once', () => {
    expect(VESSEL_PROCEDURAL_PART_IDS).toEqual(EXPECTED_PART_IDS)
    expect(asr10Parts.map((part) => part.id)).toEqual(EXPECTED_PART_IDS)
    expect(asr10Steps.map((step) => step.id)).toEqual([
      'whole',
      'exterior',
      'hull',
      'power',
      'running',
      'details',
    ])
    expect(new Set(VESSEL_PROCEDURAL_PART_IDS).size).toBe(
      VESSEL_PROCEDURAL_PART_IDS.length,
    )
  })

  it('places engines, shafts, propellers, and rudders as finite mirrored pairs', () => {
    expect(VESSEL_ENGINE_POSITIONS).toEqual([
      [-0.35, -0.23, 0.48],
      [-0.35, -0.23, -0.48],
    ])
    expect(VESSEL_SHAFT_PATHS).toEqual([
      { start: [-0.85, -0.34, 0.48], end: [-2.8, -0.64, 0.56] },
      { start: [-0.85, -0.34, -0.48], end: [-2.8, -0.64, -0.56] },
    ])
    expect(VESSEL_PROPELLER_POSITIONS).toEqual([
      [-2.95, -0.66, 0.56],
      [-2.95, -0.66, -0.56],
    ])
    expect(VESSEL_RUDDER_POSITIONS).toEqual([
      [-3.22, -0.38, 0.56],
      [-3.22, -0.38, -0.56],
    ])

    for (const positions of [
      VESSEL_ENGINE_POSITIONS,
      VESSEL_PROPELLER_POSITIONS,
      VESSEL_RUDDER_POSITIONS,
    ]) {
      const [port, starboard] = positions
      expectFiniteVector(port)
      expectFiniteVector(starboard)
      expect(port[0]).toBe(starboard[0])
      expect(port[1]).toBe(starboard[1])
      expect(port[2]).toBe(-starboard[2])
    }

    const [portShaft, starboardShaft] = VESSEL_SHAFT_PATHS
    expectFiniteVector(portShaft.start)
    expectFiniteVector(portShaft.end)
    expectFiniteVector(starboardShaft.start)
    expectFiniteVector(starboardShaft.end)
    expect(portShaft.start[2]).toBe(-starboardShaft.start[2])
    expect(portShaft.end[2]).toBe(-starboardShaft.end[2])
  })

  it('provides a finite three-dimensional focus point for every part', () => {
    expect(VESSEL_FOCUS_POINTS).toEqual(EXPECTED_FOCUS_POINTS)

    for (const id of EXPECTED_PART_IDS) {
      expectFiniteVector(VESSEL_FOCUS_POINTS[id])
    }
  })

  it('keeps every authored explode offset frozen while revealing by stage', () => {
    expect(
      Object.fromEntries(asr10Parts.map((part) => [part.id, part.explodeOffset])),
    ).toEqual(EXPECTED_EXPLODE_OFFSETS)

    for (const part of asr10Parts) {
      expect(getVesselPartMotion(part, 5, 'explode', false).position).toEqual(
        EXPECTED_EXPLODE_OFFSETS[part.id],
      )
    }

    const engines = asr10Parts.find(
      (part) => part.id === 'twin-engine-modules',
    )!

    expect(getVesselPartMotion(engines, 2, 'explode', false).position).toEqual([
      0,
      0,
      0,
    ])
  })

  it('makes the hull pass-through in xray while internal parts remain readable', () => {
    const hull = asr10Parts.find(
      (part) => part.id === 'vessel-hull-shell',
    )!
    const engines = asr10Parts.find(
      (part) => part.id === 'twin-engine-modules',
    )!

    expect(isVesselShell(hull.id)).toBe(true)
    expect(isVesselShell(engines.id)).toBe(false)
    expect(
      getVesselPartMotion(hull, 5, 'xray', false).material,
    ).toMatchObject({ state: 'xray', transparent: true, depthWrite: false })
    expect(
      getVesselPartMotion(engines, 5, 'xray', false).material,
    ).toMatchObject({ state: 'solid', transparent: false, depthWrite: true })
  })

  it('keeps the buoyancy teaching volume transparent', () => {
    const buoyancy = asr10Parts.find(
      (part) => part.id === 'buoyancy-compartments',
    )!

    expect(
      getVesselPartMotion(buoyancy, 5, 'explode', false).material,
    ).toMatchObject({
      state: 'solid',
      role: 'teaching-volume',
      transparent: true,
      depthWrite: false,
    })
  })

  it('animates only an explicitly playing principle lesson', () => {
    expect(isVesselPrincipleActive('principle', true, false)).toBe(true)
    expect(isVesselPrincipleActive('principle', false, false)).toBe(false)
    expect(isVesselPrincipleActive('principle', true, true)).toBe(false)
    expect(isVesselPrincipleActive('xray', true, false)).toBe(false)
  })

  it('keeps propulsion and bilge-pump clues finite and abstract', () => {
    expect(VESSEL_PRINCIPLE_FLOW_PATHS).toHaveLength(5)

    for (const path of VESSEL_PRINCIPLE_FLOW_PATHS) {
      expectFiniteVector(path.start)
      expectFiniteVector(path.end)
    }
  })

  it('uses HDR non-tone-mapped materials only for principle teaching pulses', () => {
    for (const material of Object.values(VESSEL_TEACHING_GLOW_MATERIALS)) {
      expect(material.toneMapped).toBe(false)
      expect(Math.max(material.color.r, material.color.g, material.color.b)).toBeGreaterThan(1)
    }
  })
})
