vi.mock('@react-three/drei', () => ({ RoundedBox: () => null }))
vi.mock('./PrincipleMotion', () => ({ PrincipleMotion: () => null }))
vi.mock('./TankPart', () => ({ TankPart: () => null }))

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { BufferGeometry, Euler, Group, Vector3 } from 'three'
import { m4Parts, m4Steps } from '../content/m4'
import type { PartId } from '../content/types'
import {
  createTankGeometrySet,
  disposeTankGeometrySet,
  getTankGeometryBudgetReport,
  TANK_DRIVE_TOOTH_COUNT,
  TANK_GEOMETRY_BUDGET,
  TANK_HULL_SECTIONS,
  TANK_ROAD_WHEEL_X,
  TANK_TURRET_PROFILE,
} from './TankGeometry'
import {
  ENGINE_CENTER,
  ENGINE_HUB_LOCAL_POSITION,
  getTankSceneBudgetReport,
  makeEngineCylinderLocalTransforms,
  makeSuspensionTransforms,
  makeTrackTransforms,
  PROCEDURAL_PART_IDS,
  useTankGeometrySet,
} from './TankModel'
import * as tankModelModule from './TankModel'

const EXPECTED_PART_IDS = [
  'hull-shell',
  'turret-shell',
  'engine-module',
  'transmission-path',
  'suspension-left',
  'suspension-right',
  'track-left',
  'track-right',
  'crew-space',
  'observation-system',
  'recoil-concept',
] as const satisfies readonly PartId[]

const EXPECTED_EXPLODE_OFFSETS = {
  'hull-shell': [0, 0.35, 0],
  'turret-shell': [0, 1.4, 0],
  'engine-module': [-1.1, 0.25, 0],
  'transmission-path': [0, -0.45, 0],
  'suspension-left': [0, 0, 1.1],
  'suspension-right': [0, 0, -1.1],
  'track-left': [0, -0.2, 1.65],
  'track-right': [0, -0.2, -1.65],
  'crew-space': [0.2, 0.7, 0],
  'observation-system': [0.55, 1.05, 0.45],
  'recoil-concept': [1.15, 0.95, 0],
} as const satisfies Record<PartId, readonly [number, number, number]>

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

function uniqueRoundedNormals(geometry: BufferGeometry) {
  const normal = geometry.getAttribute('normal')
  return new Set(
    Array.from({ length: normal.count }, (_, index) =>
      [normal.getX(index), normal.getY(index), normal.getZ(index)]
        .map((value) => value.toFixed(2))
        .join(','),
    ),
  )
}

function radialValues(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  return Array.from({ length: position.count }, (_, index) =>
    Math.hypot(position.getX(index), position.getY(index)),
  )
}

describe('tank procedural silhouette contract', () => {
  it('owns all geometry resources instead of allocating primitives during render', () => {
    const modelSource = readFileSync(
      resolve(process.cwd(), 'src/scene/TankModel.tsx'),
      'utf8',
    )

    expect(modelSource).toContain('<GeometryInstances')
    expect(modelSource).not.toMatch(
      /<(?:box|sphere|cone|cylinder|torus)Geometry\b/,
    )
    expect(modelSource).not.toContain('dispose={null}')
    expect(modelSource).toContain(
      "accuracy: 'educational-system-relationships-only'",
    )
  })

  it('builds a finite faceted loft hull with large creases and sloped ends', () => {
    expect(TANK_HULL_SECTIONS.length).toBeGreaterThanOrEqual(6)
    expect(TANK_HULL_SECTIONS[1].deckY).toBeGreaterThan(
      TANK_HULL_SECTIONS[0].deckY,
    )
    expect(TANK_HULL_SECTIONS.at(-2)!.deckY).toBeGreaterThan(
      TANK_HULL_SECTIONS.at(-1)!.deckY,
    )

    const geometries = createTankGeometrySet()
    try {
      expectSoundGeometry(geometries.hull)
      const normals = uniqueRoundedNormals(geometries.hull)
      expect(normals.size).toBeGreaterThanOrEqual(12)
      expect(
        [...normals].some((value) => {
          const [x, y] = value.split(',').map(Number)
          return Math.abs(x) > 0.2 && Math.abs(y) > 0.2
        }),
      ).toBe(true)
      expect(geometries.hull.boundingBox!.min.x).toBeGreaterThanOrEqual(-2.5)
      expect(geometries.hull.boundingBox!.max.x).toBeLessThanOrEqual(2.5)
      expect(geometries.hull.boundingBox!.max.y).toBeLessThanOrEqual(1.85)
      expect(geometries.hull.boundingBox!.max.z).toBeLessThanOrEqual(1.35)
    } finally {
      disposeTankGeometrySet(geometries)
    }
  })

  it('uses an original turret profile that expands then contracts', () => {
    expect(TANK_TURRET_PROFILE.length).toBeGreaterThanOrEqual(6)
    const radii: number[] = TANK_TURRET_PROFILE.map(([, radius]) => radius)
    expect(radii[0]).toBe(0)
    expect(radii.at(-1)).toBe(0)
    const peakIndex = radii.indexOf(Math.max(...radii))
    expect(peakIndex).toBeGreaterThan(0)
    expect(peakIndex).toBeLessThan(radii.length - 1)
    expect(radii[peakIndex]).toBeGreaterThan(radii[1])
    expect(radii[peakIndex]).toBeGreaterThan(radii.at(-2)!)

    const geometries = createTankGeometrySet()
    try {
      expectSoundGeometry(geometries.turret)
      geometries.turret.computeBoundingBox()
      const size = geometries.turret.boundingBox!.getSize(new Vector3())
      expect(size.x).not.toBeCloseTo(size.z, 2)
    } finally {
      disposeTankGeometrySet(geometries)
    }
  })

  it('preserves exact mirrored road-wheel stations and 44 links per side', () => {
    expect(TANK_ROAD_WHEEL_X).toEqual([-1.76, -1.12, -0.48, 0.48, 1.12, 1.76])
    const left = makeSuspensionTransforms(1)
    const right = makeSuspensionTransforms(-1)
    expect(left.wheels).toHaveLength(6)
    expect(right.wheels).toHaveLength(6)
    left.wheels.forEach((transform, index) => {
      expect(transform.position[0]).toBe(TANK_ROAD_WHEEL_X[index])
      expect(transform.position[2]).toBe(-right.wheels[index].position[2])
    })
    expect(makeTrackTransforms(1)).toHaveLength(44)
    expect(makeTrackTransforms(-1)).toHaveLength(44)
    expect(left.drive.position).toEqual([2.28, 0.62, 1.4])
    expect(left.idler.position).toEqual([-2.28, 0.62, 1.4])
    expect(right.drive.position).toEqual([2.28, 0.62, -1.4])
    expect(right.idler.position).toEqual([-2.28, 0.62, -1.4])
    expect(
      left.idlerSpokes.every(
        (transform) => transform.position[2] > left.idler.position[2],
      ),
    ).toBe(true)
    expect(
      right.idlerSpokes.every(
        (transform) => transform.position[2] < right.idler.position[2],
      ),
    ).toBe(true)

    const leftTrackX = makeTrackTransforms(1).map(
      (transform) => transform.position[0],
    )
    expect(Math.max(...leftTrackX)).toBeGreaterThan(left.drive.position[0])
    expect(Math.min(...leftTrackX)).toBeLessThan(left.idler.position[0])
  })

  it('samples the closed teaching track independently from its rendered transforms', () => {
    const samples = makeTrackTransforms(1)
    const idlerX = -2.28
    const driveX = 2.28
    const centerY = 0.62
    const centerlineRadius = 0.68
    const topY = centerY + centerlineRadius
    const bottomY = centerY - centerlineRadius
    const straightLength = driveX - idlerX
    const pathLength =
      straightLength * 2 + Math.PI * centerlineRadius * 2
    const expectedStep = pathLength / 44
    const tolerance = 1e-8
    const wrappedAngleDelta = (actual: number, expected: number) =>
      Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected))

    expect(samples).toHaveLength(44)
    expect(
      samples.every(
        (sample) =>
          !('pathDistance' in sample) && !('pathSection' in sample),
      ),
    ).toBe(true)

    const classified = samples.map((sample) => {
      const [x, y] = sample.position
      const rotationZ = sample.rotation?.[2] ?? 0

      if (
        Math.abs(y - topY) <= tolerance &&
        x >= idlerX - tolerance &&
        x <= driveX + tolerance
      ) {
        return {
          section: 'top' as const,
          pathDistance: x - idlerX,
          rotationZ,
          x,
          y,
        }
      }

      if (
        Math.abs(y - bottomY) <= tolerance &&
        x >= idlerX - tolerance &&
        x <= driveX + tolerance
      ) {
        return {
          section: 'bottom' as const,
          pathDistance:
            straightLength +
            Math.PI * centerlineRadius +
            (driveX - x),
          rotationZ,
          x,
          y,
        }
      }

      const wheelX = x > 0 ? driveX : idlerX
      const radius = Math.hypot(x - wheelX, y - centerY)
      expect(radius).toBeCloseTo(centerlineRadius, 10)
      const rawAngle = Math.atan2(y - centerY, x - wheelX)

      if (wheelX === driveX) {
        return {
          section: 'drive-arc' as const,
          pathDistance:
            straightLength +
            centerlineRadius * (Math.PI / 2 - rawAngle),
          polarAngle: rawAngle,
          rotationZ,
          x,
          y,
        }
      }

      const polarAngle =
        rawAngle > Math.PI / 2 - tolerance
          ? rawAngle - Math.PI * 2
          : rawAngle
      return {
        section: 'idler-arc' as const,
        pathDistance:
          straightLength * 2 +
          Math.PI * centerlineRadius +
          centerlineRadius * (-Math.PI / 2 - polarAngle),
        polarAngle,
        rotationZ,
        x,
        y,
      }
    })

    expect(new Set(classified.map((sample) => sample.section))).toEqual(
      new Set(['top', 'drive-arc', 'bottom', 'idler-arc']),
    )
    classified.slice(1).forEach((sample, index) => {
      expect(sample.pathDistance - classified[index].pathDistance).toBeCloseTo(
        expectedStep,
        9,
      )
    })

    const top = classified.filter((sample) => sample.section === 'top')
    const bottom = classified.filter((sample) => sample.section === 'bottom')
    expect(top.length).toBeGreaterThan(8)
    expect(bottom.length).toBeGreaterThan(8)
    top.forEach((sample, index) => {
      expect(sample.y).toBeCloseTo(topY, 10)
      expect(wrappedAngleDelta(sample.rotationZ, 0)).toBeCloseTo(0, 10)
      if (index > 0) {
        expect(sample.x - top[index - 1].x).toBeCloseTo(expectedStep, 9)
      }
    })
    bottom.forEach((sample, index) => {
      expect(sample.y).toBeCloseTo(bottomY, 10)
      expect(wrappedAngleDelta(sample.rotationZ, Math.PI)).toBeCloseTo(0, 10)
      if (index > 0) {
        expect(bottom[index - 1].x - sample.x).toBeCloseTo(expectedStep, 9)
      }
    })

    for (const section of ['drive-arc', 'idler-arc'] as const) {
      const arc = classified.filter(
        (
          sample,
        ): sample is Extract<
          (typeof classified)[number],
          { section: typeof section }
        > => sample.section === section,
      )
      expect(arc.length).toBeGreaterThan(4)
      arc.forEach((sample, index) => {
        expect(
          wrappedAngleDelta(
            sample.rotationZ,
            sample.polarAngle - Math.PI / 2,
          ),
        ).toBeCloseTo(0, 10)
        if (index > 0) {
          expect(sample.polarAngle - arc[index - 1].polarAngle).toBeCloseTo(
            -expectedStep / centerlineRadius,
            9,
          )
        }
      })
    }

    const first = classified[0]
    const last = classified.at(-1)!
    expect(first.section).toBe('top')
    expect(last.section).toBe('idler-arc')
    expect(pathLength - last.pathDistance).toBeCloseTo(expectedStep, 9)
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeCloseTo(
      2 *
        centerlineRadius *
        Math.sin(expectedStep / centerlineRadius / 2),
      9,
    )
    expect(wrappedAngleDelta(first.rotationZ, last.rotationZ)).toBeCloseTo(
      -expectedStep / centerlineRadius,
      9,
    )
  })

  it('keeps every oriented track-link bound outside both end-wheel envelopes', () => {
    const geometries = createTankGeometrySet()
    try {
      geometries.trackLink.computeBoundingBox()
      const bounds = geometries.trackLink.boundingBox!
      const endWheels = [
        { center: [2.28, 0.62] as const, outerRadius: 0.52 },
        { center: [-2.28, 0.62] as const, outerRadius: 0.465 },
      ] as const

      for (const transform of makeTrackTransforms(1)) {
        const angle = transform.rotation?.[2] ?? 0
        const cosine = Math.cos(angle)
        const sine = Math.sin(angle)
        for (const wheel of endWheels) {
          const worldDeltaX = wheel.center[0] - transform.position[0]
          const worldDeltaY = wheel.center[1] - transform.position[1]
          const wheelLocalX = worldDeltaX * cosine + worldDeltaY * sine
          const wheelLocalY = -worldDeltaX * sine + worldDeltaY * cosine
          const distanceToBoundX = Math.max(
            bounds.min.x - wheelLocalX,
            0,
            wheelLocalX - bounds.max.x,
          )
          const distanceToBoundY = Math.max(
            bounds.min.y - wheelLocalY,
            0,
            wheelLocalY - bounds.max.y,
          )

          expect(Math.hypot(distanceToBoundX, distanceToBoundY)).toBeGreaterThan(
            wheel.outerRadius + 0.01,
          )
        }
      }
    } finally {
      disposeTankGeometrySet(geometries)
    }
  })

  it('aligns the recoil teaching ring with the neighboring local X cylinders', () => {
    const rotation = (
      tankModelModule as typeof tankModelModule & {
        RECOIL_RING_ROTATION?: readonly [number, number, number]
      }
    ).RECOIL_RING_ROTATION

    expect(rotation).toBeDefined()
    const ringAxis = new Vector3(0, 0, 1).applyEuler(
      new Euler(rotation![0], rotation![1], rotation![2]),
    )
    expect(ringAxis.x).toBeCloseTo(1, 10)
    expect(ringAxis.y).toBeCloseTo(0, 10)
    expect(ringAxis.z).toBeCloseTo(0, 10)
  })

  it('keeps road-wheel rim and hub as distinct layers and uses a generic tooth rhythm', () => {
    expect(TANK_DRIVE_TOOTH_COUNT).toBeGreaterThanOrEqual(3)
    expect(TANK_DRIVE_TOOTH_COUNT).toBeLessThanOrEqual(16)
    const geometries = createTankGeometrySet()
    try {
      expectSoundGeometry(geometries.roadWheelRim)
      expectSoundGeometry(geometries.roadWheelHub)
      expect(geometries.roadWheelRim).not.toBe(geometries.roadWheelHub)
      expectSoundGeometry(geometries.driveToothRing)
      const roundedRadii = new Set(
        radialValues(geometries.driveToothRing).map((radius) =>
          radius.toFixed(3),
        ),
      )
      expect(roundedRadii.size).toBeGreaterThanOrEqual(2)
      expect(Math.max(...[...roundedRadii].map(Number))).toBeGreaterThan(
        Math.min(...[...roundedRadii].map(Number)),
      )
    } finally {
      disposeTankGeometrySet(geometries)
    }
  })

  it('keeps geometry estimates descriptive while the runtime scene graph is authoritative', () => {
    const geometries = createTankGeometrySet()
    try {
      const report = getTankGeometryBudgetReport(geometries)
      expect(report.geometryTriangles).toBeGreaterThan(0)
      expect(report.renderedTriangles).toBeGreaterThanOrEqual(
        report.geometryTriangles,
      )
      expect(report.baseDrawCalls).toBeLessThan(60)
      expect(report.baseDrawCalls).toBe(47)
      expect(report.renderedTriangles).toBeLessThanOrEqual(
        TANK_GEOMETRY_BUDGET.triangles,
      )
      expect(report.instancedDetails).toBeGreaterThanOrEqual(100)
    } finally {
      disposeTankGeometrySet(geometries)
    }
  })

  it('owns each StrictMode geometry set and disposes every resource exactly once', () => {
    const generated: ReturnType<typeof createTankGeometrySet>[] = []
    const disposeSpies = new Map<BufferGeometry, ReturnType<typeof vi.spyOn>>()
    const factory = vi.fn(() => {
      const geometries = createTankGeometrySet()
      generated.push(geometries)
      Object.values(geometries).forEach((geometry) => {
        disposeSpies.set(geometry, vi.spyOn(geometry, 'dispose'))
      })
      return geometries
    })
    const disposer = vi.fn(disposeTankGeometrySet)

    const { result, unmount } = renderHook(
      () => useTankGeometrySet(factory, disposer),
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

  it('does not treat hand-maintained estimates as the runtime budget authority', () => {
    const emptyRoot = new Group()
    expect(getTankSceneBudgetReport(emptyRoot)).toMatchObject({
      baseDrawCalls: 0,
      renderedTriangles: 0,
      visibleRenderObjects: 0,
    })
  })
})

it('keeps procedural geometry in exact parity with the authored part catalog', () => {
  expect(PROCEDURAL_PART_IDS).toEqual(EXPECTED_PART_IDS)
  expect(m4Parts.map((part) => part.id)).toEqual(EXPECTED_PART_IDS)
  expect(m4Steps.map((step) => step.id)).toEqual([
    'whole',
    'exterior',
    'hull',
    'power',
    'running',
    'details',
  ])
})

it('freezes all authored abstract explode offsets', () => {
  expect(
    Object.fromEntries(m4Parts.map((part) => [part.id, part.explodeOffset])),
  ).toEqual(EXPECTED_EXPLODE_OFFSETS)
})

it('centers the radial engine children on a shared assembly pivot', () => {
  const cylinders = makeEngineCylinderLocalTransforms()
  const centroid = cylinders.reduce(
    (sum, transform) => [
      sum[0] + transform.position[0],
      sum[1] + transform.position[1],
      sum[2] + transform.position[2],
    ],
    [0, 0, 0],
  )

  expect(ENGINE_CENTER).toEqual([-1.48, 1.25, 0])
  expect(ENGINE_HUB_LOCAL_POSITION).toEqual([0, 0, 0])
  expect(cylinders).toHaveLength(9)

  for (const coordinate of centroid) {
    expect(coordinate / cylinders.length).toBeCloseTo(0, 10)
  }

  for (const cylinder of cylinders) {
    expect(cylinder.position[0]).toBe(0)
    expect(Math.hypot(cylinder.position[1], cylinder.position[2])).toBeCloseTo(
      0.57,
    )
  }
})

it('freezes the six abstract road-wheel stations shared by both sides', () => {
  expect(TANK_ROAD_WHEEL_X).toEqual([-1.76, -1.12, -0.48, 0.48, 1.12, 1.76])
})
