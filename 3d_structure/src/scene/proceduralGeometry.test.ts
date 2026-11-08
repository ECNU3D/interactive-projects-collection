import { BufferGeometry, Vector3 } from 'three'
import {
  createChamferedBoxGeometry,
  createClosedLoftGeometry,
  createExtrudedProfileGeometry,
  createRadialToothPrism,
  createRevolvedProfileGeometry,
  createTwistedRadialAssembly,
} from './proceduralGeometry'

const disposableGeometries: BufferGeometry[] = []
const vertexA = new Vector3()
const vertexB = new Vector3()
const vertexC = new Vector3()
const edgeAB = new Vector3()
const edgeAC = new Vector3()

function track<T extends BufferGeometry>(geometry: T): T {
  disposableGeometries.push(geometry)
  return geometry
}

function expectGeometryFinite(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')

  expect(position).toBeDefined()
  expect(normal).toBeDefined()
  expect(geometry.index).not.toBeNull()
  expect(Array.from(position.array).every(Number.isFinite)).toBe(true)
  expect(Array.from(normal.array).every(Number.isFinite)).toBe(true)

  if (geometry.index) {
    expect(Array.from(geometry.index.array).every(Number.isFinite)).toBe(true)
    expect(Math.max(...geometry.index.array)).toBeLessThan(position.count)
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  expect(geometry.boundingBox).not.toBeNull()
  expect(geometry.boundingSphere).not.toBeNull()
  expect(
    [
      ...geometry.boundingBox!.min.toArray(),
      ...geometry.boundingBox!.max.toArray(),
      ...geometry.boundingSphere!.center.toArray(),
      geometry.boundingSphere!.radius,
    ].every(Number.isFinite),
  ).toBe(true)
}

function expectNoZeroAreaTriangles(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const index = geometry.index
  const count = index?.count ?? position.count

  expect(count % 3).toBe(0)

  for (let offset = 0; offset < count; offset += 3) {
    const a = index ? index.getX(offset) : offset
    const b = index ? index.getX(offset + 1) : offset + 1
    const c = index ? index.getX(offset + 2) : offset + 2

    vertexA.fromBufferAttribute(position, a)
    vertexB.fromBufferAttribute(position, b)
    vertexC.fromBufferAttribute(position, c)
    edgeAB.subVectors(vertexB, vertexA)
    edgeAC.subVectors(vertexC, vertexA)

    expect(edgeAB.cross(edgeAC).lengthSq()).toBeGreaterThan(1e-12)
  }
}

function expectSoundGeometry(geometry: BufferGeometry) {
  expectGeometryFinite(geometry)
  expectNoZeroAreaTriangles(geometry)
}

function uniqueNormals(geometry: BufferGeometry) {
  const normal = geometry.getAttribute('normal')
  const values = new Set<string>()

  for (let index = 0; index < normal.count; index += 1) {
    values.add(
      [normal.getX(index), normal.getY(index), normal.getZ(index)]
        .map((value) => value.toFixed(3))
        .join(','),
    )
  }

  return values
}

function triangleFaceNormal(
  geometry: BufferGeometry,
  triangleOffset: number,
) {
  const position = geometry.getAttribute('position')
  const index = geometry.index!
  const a = new Vector3().fromBufferAttribute(
    position,
    index.getX(triangleOffset),
  )
  const b = new Vector3().fromBufferAttribute(
    position,
    index.getX(triangleOffset + 1),
  )
  const c = new Vector3().fromBufferAttribute(
    position,
    index.getX(triangleOffset + 2),
  )
  return {
    vertices: [a, b, c] as const,
    normal: new Vector3()
      .subVectors(b, a)
      .cross(new Vector3().subVectors(c, a))
      .normalize(),
  }
}

function firstBladeCrossSection(
  geometry: BufferGeometry,
  radial: number,
) {
  const position = geometry.getAttribute('position')
  const index = geometry.index!
  const firstBlade = geometry.groups[0]
  const uniquePoints = new Map<string, Vector3>()

  for (
    let offset = firstBlade.start;
    offset < firstBlade.start + firstBlade.count;
    offset += 1
  ) {
    const vertexIndex = index.getX(offset)
    if (Math.abs(position.getY(vertexIndex) - radial) < 1e-5) {
      const point = new Vector3(
        position.getX(vertexIndex),
        position.getY(vertexIndex),
        position.getZ(vertexIndex),
      )
      uniquePoints.set(
        [point.x, point.y, point.z]
          .map((coordinate) => coordinate.toFixed(6))
          .join(','),
        point,
      )
    }
  }

  const points = [...uniquePoints.values()]
  const center = points
    .reduce((sum, point) => sum.add(point), new Vector3())
    .multiplyScalar(1 / points.length)
  return {
    center,
    points: points.map((point) => point.sub(center)),
  }
}

function principalAxisAngle(points: readonly Vector3[]) {
  const covariance = points.reduce(
    (sum, point) => ({
      xx: sum.xx + point.x * point.x,
      xz: sum.xz + point.x * point.z,
      zz: sum.zz + point.z * point.z,
    }),
    { xx: 0, xz: 0, zz: 0 },
  )
  return Math.atan2(
    2 * covariance.xz,
    covariance.xx - covariance.zz,
  ) / 2
}

function axisAngleDistanceModuloPi(first: number, second: number) {
  const raw = Math.abs(first - second) % Math.PI
  return Math.min(raw, Math.PI - raw)
}

afterEach(() => {
  disposableGeometries.splice(0).forEach((geometry) => geometry.dispose())
})

describe('createClosedLoftGeometry', () => {
  const sections = [
    {
      x: -1.2,
      points: [
        [-0.46, -0.36],
        [0.46, -0.36],
        [0.46, 0.36],
        [-0.46, 0.36],
      ],
    },
    {
      x: 0,
      points: [
        [-0.7, -0.52],
        [0.7, -0.52],
        [0.7, 0.52],
        [-0.7, 0.52],
      ],
    },
    {
      x: 1.15,
      points: [
        [-0.38, -0.28],
        [0.38, -0.28],
        [0.38, 0.28],
        [-0.38, 0.28],
      ],
    },
  ] as const

  it('creates a capped, creased finite shell from equal closed sections', () => {
    const geometry = track(
      createClosedLoftGeometry(sections, {
        capEnds: true,
        creaseAngle: Math.PI / 5,
      }),
    )

    expectSoundGeometry(geometry)
    expect(uniqueNormals(geometry).size).toBeGreaterThanOrEqual(6)
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-1.2)
    expect(geometry.boundingBox?.max.x).toBeCloseTo(1.15)
  })

  it('rejects missing, mismatched, non-finite, and degenerate sections', () => {
    expect(() => createClosedLoftGeometry([sections[0]])).toThrow()
    expect(() =>
      createClosedLoftGeometry([
        sections[0],
        { x: 0, points: sections[1].points.slice(0, 3) },
      ]),
    ).toThrow()
    expect(() =>
      createClosedLoftGeometry([
        sections[0],
        { ...sections[1], x: Number.NaN },
      ]),
    ).toThrow()
    expect(() =>
      createClosedLoftGeometry([
        sections[0],
        {
          x: 0,
          points: [
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
          ],
        },
      ]),
    ).toThrow()
  })

  it('triangulates convex and concave end caps from their own outlines', () => {
    const convexStart = [
      [-1, 0],
      [-0.5, -0.8],
      [0.5, -0.8],
      [1, 0],
      [0.5, 0.8],
      [-0.5, 0.8],
    ] as const
    const concaveEnd = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [0.2, 1],
      [0.2, -0.2],
      [-1, 1],
    ] as const
    const geometry = track(
      createClosedLoftGeometry(
        [
          { x: -1, points: convexStart },
          { x: 1, points: concaveEnd },
        ],
        { capEnds: true, creaseAngle: Math.PI / 5 },
      ),
    )

    expectSoundGeometry(geometry)
    const caps = { start: [] as Vector3[], end: [] as Vector3[] }
    for (let offset = 0; offset < geometry.index!.count; offset += 3) {
      const face = triangleFaceNormal(geometry, offset)
      if (face.vertices.every((vertex) => Math.abs(vertex.x + 1) < 1e-6)) {
        caps.start.push(face.normal)
      }
      if (face.vertices.every((vertex) => Math.abs(vertex.x - 1) < 1e-6)) {
        caps.end.push(face.normal)
      }
    }

    expect(caps.start).toHaveLength(convexStart.length - 2)
    expect(caps.end).toHaveLength(concaveEnd.length - 2)
    caps.start.forEach((normal) => expect(normal.x).toBeLessThan(-0.999))
    caps.end.forEach((normal) => expect(normal.x).toBeGreaterThan(0.999))
  })

  it('normalizes consistently clockwise sections to outward side faces', () => {
    const clockwise = [
      [-0.5, 0.5],
      [0.5, 0.5],
      [0.5, -0.5],
      [-0.5, -0.5],
    ] as const
    const geometry = track(
      createClosedLoftGeometry(
        [
          { x: -1, points: clockwise },
          { x: 1, points: clockwise },
        ],
        { capEnds: false, creaseAngle: Math.PI / 5 },
      ),
    )

    expectSoundGeometry(geometry)
    for (let offset = 0; offset < geometry.index!.count; offset += 3) {
      const face = triangleFaceNormal(geometry, offset)
      const centroid = face.vertices
        .reduce((sum, point) => sum.add(point), new Vector3())
        .multiplyScalar(1 / 3)
      expect(
        face.normal.y * centroid.y + face.normal.z * centroid.z,
      ).toBeGreaterThan(0)
    }
  })

  it('rejects mixed section winding before pairing their vertices', () => {
    const counterClockwise = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ] as const

    expect(() =>
      createClosedLoftGeometry([
        { x: -1, points: counterClockwise },
        { x: 1, points: [...counterClockwise].reverse() },
      ]),
    ).toThrow('loft sections must use one consistent winding')
  })
})

describe('createRevolvedProfileGeometry', () => {
  it('revolves an original profile around the requested axis with finite endpoints', () => {
    const geometry = track(
      createRevolvedProfileGeometry(
        [
          [-1, 0],
          [-0.72, 0.34],
          [-0.15, 0.58],
          [0.5, 0.46],
          [1, 0],
        ],
        { axis: 'x', segments: 16 },
      ),
    )

    expectSoundGeometry(geometry)
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-1)
    expect(geometry.boundingBox?.max.x).toBeCloseTo(1)
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-0.58)
    expect(geometry.boundingBox?.max.y).toBeCloseTo(0.58)

    const position = geometry.getAttribute('position')
    const poles = [-1, 1].map(
      (axial) =>
        Array.from({ length: position.count }, (_, index) => index).filter(
          (index) =>
            Math.abs(position.getX(index) - axial) < 1e-6 &&
            Math.hypot(position.getY(index), position.getZ(index)) < 1e-6,
        ).length,
    )
    expect(poles).toEqual([1, 1])
  })

  it('rejects invalid axes, segments, radii, ordering, and non-finite values', () => {
    expect(() =>
      createRevolvedProfileGeometry(
        [
          [0, 0.4],
          [1, 0.5],
        ],
        { axis: 'bad' as 'x' },
      ),
    ).toThrow()
    expect(() =>
      createRevolvedProfileGeometry(
        [
          [0, 0.4],
          [1, 0.5],
        ],
        { segments: 2 },
      ),
    ).toThrow()
    expect(() =>
      createRevolvedProfileGeometry([
        [0, -0.1],
        [1, 0.5],
      ]),
    ).toThrow()
    expect(() =>
      createRevolvedProfileGeometry([
        [0, 0.1],
        [0.5, 0],
        [1, 0.1],
      ]),
    ).toThrow()
    expect(() =>
      createRevolvedProfileGeometry([
        [1, 0.4],
        [0, 0.5],
      ]),
    ).toThrow()
    expect(() =>
      createRevolvedProfileGeometry([
        [0, 0.4],
        [1, Number.POSITIVE_INFINITY],
      ]),
    ).toThrow()
  })

  it('keeps smooth surface normals facing outward on every supported axis', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      const geometry = track(
        createRevolvedProfileGeometry(
          [
            [-1, 0.3],
            [0, 0.6],
            [1, 0.3],
          ],
          { axis, segments: 12 },
        ),
      )
      const normal = geometry.getAttribute('normal')
      const middleRingStart = 12
      const outward =
        axis === 'x' ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
      const actual = new Vector3(
        normal.getX(middleRingStart),
        normal.getY(middleRingStart),
        normal.getZ(middleRingStart),
      )

      expect(actual.dot(outward)).toBeGreaterThan(0.8)
    }
  })
})

describe('createExtrudedProfileGeometry', () => {
  it('adds one narrow bevel while preserving main and sloped normals', () => {
    const geometry = track(
      createExtrudedProfileGeometry(
        [
          [-0.8, -0.35],
          [0.55, -0.42],
          [0.85, 0.08],
          [0.2, 0.48],
          [-0.72, 0.34],
        ],
        { depth: 0.28, bevelSize: 0.035 },
      ),
    )

    expectSoundGeometry(geometry)

    const normal = geometry.getAttribute('normal')
    let mainPlane = false
    let slopedBevel = false
    for (let index = 0; index < normal.count; index += 1) {
      const values = [
        Math.abs(normal.getX(index)),
        Math.abs(normal.getY(index)),
        Math.abs(normal.getZ(index)),
      ]
      mainPlane ||= Math.max(...values) > 0.999
      slopedBevel ||=
        values.filter((value) => value > 0.08).length >= 2 &&
        Math.max(...values) < 0.999
    }
    expect(mainPlane).toBe(true)
    expect(slopedBevel).toBe(true)
  })

  it('rejects non-finite, zero-area, and unsafe depth or bevel inputs', () => {
    expect(() =>
      createExtrudedProfileGeometry(
        [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
        { depth: 0.2 },
      ),
    ).toThrow()
    expect(() =>
      createExtrudedProfileGeometry(
        [
          [0, 0],
          [1, 0],
          [0, Number.NaN],
        ],
        { depth: 0.2 },
      ),
    ).toThrow()
    expect(() =>
      createExtrudedProfileGeometry(
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        { depth: 0 },
      ),
    ).toThrow()
    expect(() =>
      createExtrudedProfileGeometry(
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        { depth: 0.2, bevelSize: 0.11 },
      ),
    ).toThrow()
  })
})

describe('createTwistedRadialAssembly', () => {
  const stations = [
    { radial: 0.35, chord: 0.48, sweep: 0, thickness: 0.12, twist: 0 },
    {
      radial: 0.82,
      chord: 0.34,
      sweep: 0.08,
      thickness: 0.085,
      twist: 0.32,
    },
    {
      radial: 1.3,
      chord: 0.2,
      sweep: 0.18,
      thickness: 0.06,
      twist: 0.65,
    },
  ] as const

  it('builds exactly three distinct blades at 120 degree intervals', () => {
    const geometry = track(createTwistedRadialAssembly(stations, 3))

    expectSoundGeometry(geometry)
    expect(geometry.groups).toHaveLength(3)

    const position = geometry.getAttribute('position')
    const index = geometry.index!
    const componentAngles = geometry.groups
      .map((group) => {
        const centroid = new Vector3()
        for (let offset = group.start; offset < group.start + group.count; offset += 1) {
          const vertexIndex = index.getX(offset)
          centroid.x += position.getX(vertexIndex)
          centroid.y += position.getY(vertexIndex)
          centroid.z += position.getZ(vertexIndex)
        }
        centroid.multiplyScalar(1 / group.count)
        return Math.atan2(centroid.z, centroid.y)
      })
      .map((angle) => (angle + Math.PI * 2) % (Math.PI * 2))
      .sort((a, b) => a - b)

    const intervals = componentAngles.map((angle, index) => {
      const next = componentAngles[(index + 1) % componentAngles.length]
      return (next - angle + Math.PI * 2) % (Math.PI * 2)
    })
    intervals.forEach((interval) => {
      expect(interval).toBeCloseTo((Math.PI * 2) / 3, 5)
    })
  })

  it('gives the root and tip different outline sizes', () => {
    const geometry = track(createTwistedRadialAssembly(stations, 3))
    const root = firstBladeCrossSection(geometry, stations[0].radial)
    const tip = firstBladeCrossSection(geometry, stations[2].radial)
    const rootOutlineRadius = Math.max(
      ...root.points.map((point) => Math.hypot(point.x, point.z)),
    )
    const tipOutlineRadius = Math.max(
      ...tip.points.map((point) => Math.hypot(point.x, point.z)),
    )
    expect(rootOutlineRadius).toBeGreaterThan(tipOutlineRadius * 1.5)
  })

  it('rotates a de-centered cross-section principal axis when only twist changes', () => {
    const twistOnlyStations = [
      {
        radial: 0.4,
        chord: 0.5,
        sweep: 0.06,
        thickness: 0.12,
        twist: 0,
      },
      {
        radial: 1.2,
        chord: 0.5,
        sweep: 0.06,
        thickness: 0.12,
        twist: Math.PI / 3,
      },
    ] as const
    const geometry = track(
      createTwistedRadialAssembly(twistOnlyStations, 3),
    )
    const root = firstBladeCrossSection(
      geometry,
      twistOnlyStations[0].radial,
    )
    const tip = firstBladeCrossSection(
      geometry,
      twistOnlyStations[1].radial,
    )

    expect(
      axisAngleDistanceModuloPi(
        principalAxisAngle(root.points),
        principalAxisAngle(tip.points),
      ),
    ).toBeGreaterThan(0.8)
  })

  it('rejects unordered, mismatched, non-finite, or degenerate unitless stations', () => {
    expect(() => createTwistedRadialAssembly(stations.slice(0, 1), 3)).toThrow()
    expect(() =>
      createTwistedRadialAssembly([stations[1], stations[0]], 3),
    ).toThrow()
    expect(() =>
      createTwistedRadialAssembly([
        stations[0],
        { ...stations[1], chord: 0 },
      ], 3),
    ).toThrow()
    expect(() =>
      createTwistedRadialAssembly([
        stations[0],
        { ...stations[1], twist: Number.NaN },
      ], 3),
    ).toThrow()
    expect(() => createTwistedRadialAssembly(stations, 1)).toThrow()
    expect(() => createTwistedRadialAssembly(stations, 2.5)).toThrow()
    expect(() => createTwistedRadialAssembly(stations, 7)).toThrow()
  })
})

describe('createRadialToothPrism', () => {
  it('alternates abstract root and tip radii for the requested tooth count', () => {
    const geometry = track(
      createRadialToothPrism({
        rootRadius: 0.72,
        tipRadius: 0.9,
        toothCount: 9,
        depth: 0.18,
      }),
    )

    expectSoundGeometry(geometry)

    const position = geometry.getAttribute('position')
    const radii = new Set<number>()
    for (let index = 0; index < position.count; index += 1) {
      radii.add(Number(Math.hypot(position.getX(index), position.getY(index)).toFixed(3)))
    }
    expect(radii).toContain(0.72)
    expect(radii).toContain(0.9)
  })

  it('rejects invalid radius ordering, count, depth, and non-finite values', () => {
    expect(() =>
      createRadialToothPrism({
        rootRadius: 0.9,
        tipRadius: 0.72,
        toothCount: 9,
        depth: 0.18,
      }),
    ).toThrow()
    expect(() =>
      createRadialToothPrism({
        rootRadius: 0.72,
        tipRadius: 0.9,
        toothCount: 2,
        depth: 0.18,
      }),
    ).toThrow()
    expect(() =>
      createRadialToothPrism({
        rootRadius: 0.72,
        tipRadius: 0.9,
        toothCount: 9,
        depth: 0,
      }),
    ).toThrow()
    expect(() =>
      createRadialToothPrism({
        rootRadius: 0.72,
        tipRadius: Number.NaN,
        toothCount: 9,
        depth: 0.18,
      }),
    ).toThrow()
  })

  it('supports sixteen abstract teeth and rejects counts beyond its profile budget', () => {
    const geometry = track(
      createRadialToothPrism({
        rootRadius: 0.72,
        tipRadius: 0.9,
        toothCount: 16,
        depth: 0.18,
      }),
    )

    expectSoundGeometry(geometry)

    for (const toothCount of [17, 48]) {
      expect(() =>
        createRadialToothPrism({
          rootRadius: 0.72,
          tipRadius: 0.9,
          toothCount,
          depth: 0.18,
        }),
      ).toThrow('toothCount must be an integer from 3-16')
    }
  })
})

describe('createChamferedBoxGeometry', () => {
  it('uses one narrow chamfer segment with main-plane and sloped normals', () => {
    const geometry = track(
      createChamferedBoxGeometry({
        width: 1.4,
        height: 0.7,
        depth: 0.5,
        bevelSize: 0.06,
        segments: 1,
      }),
    )

    expectSoundGeometry(geometry)
    const normal = geometry.getAttribute('normal')
    let principal = false
    let chamfered = false
    for (let index = 0; index < normal.count; index += 1) {
      const values = [
        Math.abs(normal.getX(index)),
        Math.abs(normal.getY(index)),
        Math.abs(normal.getZ(index)),
      ]
      principal ||= Math.max(...values) > 0.999
      chamfered ||=
        values.filter((value) => value > 0.08).length >= 2 &&
        Math.max(...values) < 0.999
    }
    expect(principal).toBe(true)
    expect(chamfered).toBe(true)
  })

  it('rejects non-finite, non-positive, overly wide, and multi-segment bevels', () => {
    expect(() =>
      createChamferedBoxGeometry({
        width: Number.NaN,
        height: 1,
        depth: 1,
        bevelSize: 0.05,
      }),
    ).toThrow()
    expect(() =>
      createChamferedBoxGeometry({
        width: 0,
        height: 1,
        depth: 1,
        bevelSize: 0.05,
      }),
    ).toThrow()
    expect(() =>
      createChamferedBoxGeometry({
        width: 1,
        height: 1,
        depth: 1,
        bevelSize: 0.3,
      }),
    ).toThrow()
    expect(() =>
      createChamferedBoxGeometry({
        width: 1,
        height: 1,
        depth: 1,
        bevelSize: 0.05,
        segments: 2 as 1,
      }),
    ).toThrow()
  })

  it('emits an explicit disposal event', () => {
    const geometry = track(
      createChamferedBoxGeometry({
        width: 1,
        height: 0.7,
        depth: 0.5,
        bevelSize: 0.04,
      }),
    )
    let disposed = false
    geometry.addEventListener('dispose', () => {
      disposed = true
    })

    geometry.dispose()

    expect(disposed).toBe(true)
  })
})
