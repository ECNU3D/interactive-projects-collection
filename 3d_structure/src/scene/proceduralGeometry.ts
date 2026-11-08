import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  mergeGeometries,
  mergeVertices,
  toCreasedNormals,
} from 'three/addons/utils/BufferGeometryUtils.js'

type Point2 = readonly [number, number]
export type GeometryAxis = 'x' | 'y' | 'z'

export interface ClosedLoftSection {
  /** Abstract, unitless position along the local X axis. */
  x: number
  /** Abstract, unitless closed outline in the local Y/Z plane. */
  points: readonly Point2[]
}

export interface ClosedLoftOptions {
  capEnds?: boolean
  creaseAngle?: number
}

export interface RevolvedProfileOptions {
  axis?: GeometryAxis
  segments?: number
}

export interface ExtrudedProfileOptions {
  depth: number
  bevelSize?: number
}

/**
 * Abstract blade stations only. These values deliberately carry no units and
 * do not correspond to operational, installation, or manufacturing parameters.
 */
export interface TwistedRadialStation {
  radial: number
  chord: number
  sweep: number
  thickness: number
  twist: number
}

export interface RadialToothPrismOptions {
  rootRadius: number
  tipRadius: number
  toothCount: number
  depth: number
}

export interface ChamferedBoxOptions {
  width: number
  height: number
  depth: number
  bevelSize: number
  /** Kept at one to bound detail and preserve a faceted educational style. */
  segments?: 1
}

const EPSILON = 1e-8
const MAX_PROFILE_POINTS = 64
const MAX_LOFT_SECTIONS = 32
const MAX_RADIAL_SEGMENTS = 64
const DEFAULT_CREASE_ANGLE = Math.PI / 4
const triangleA = new Vector3()
const triangleB = new Vector3()
const triangleC = new Vector3()
const triangleAB = new Vector3()
const triangleAC = new Vector3()

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`)
  }
}

function assertPositive(value: number, label: string) {
  assertFinite(value, label)
  if (value <= 0) {
    throw new Error(`${label} must be greater than zero`)
  }
}

function signedArea(points: readonly Point2[]) {
  let twiceArea = 0
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    const next = points[(index + 1) % points.length]
    twiceArea += point[0] * next[1] - next[0] * point[1]
  }
  return twiceArea / 2
}

function orientation(a: Point2, b: Point2, c: Point2) {
  return (b[0] - a[0]) * (c[1] - a[1]) -
    (b[1] - a[1]) * (c[0] - a[0])
}

function pointOnSegment(a: Point2, b: Point2, point: Point2) {
  return (
    Math.abs(orientation(a, b, point)) <= EPSILON &&
    point[0] >= Math.min(a[0], b[0]) - EPSILON &&
    point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON &&
    point[1] <= Math.max(a[1], b[1]) + EPSILON
  )
}

function segmentsIntersect(a: Point2, b: Point2, c: Point2, d: Point2) {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)

  if (
    ((abC > EPSILON && abD < -EPSILON) ||
      (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) ||
      (cdA < -EPSILON && cdB > EPSILON))
  ) {
    return true
  }

  return (
    pointOnSegment(a, b, c) ||
    pointOnSegment(a, b, d) ||
    pointOnSegment(c, d, a) ||
    pointOnSegment(c, d, b)
  )
}

function validateClosedProfile(points: readonly Point2[], label: string) {
  if (points.length < 3 || points.length > MAX_PROFILE_POINTS) {
    throw new Error(`${label} must contain 3-${MAX_PROFILE_POINTS} points`)
  }

  points.forEach((point, pointIndex) => {
    if (point.length !== 2) {
      throw new Error(`${label}[${pointIndex}] must contain two coordinates`)
    }
    assertFinite(point[0], `${label}[${pointIndex}][0]`)
    assertFinite(point[1], `${label}[${pointIndex}][1]`)

    const next = points[(pointIndex + 1) % points.length]
    if (Math.hypot(point[0] - next[0], point[1] - next[1]) <= EPSILON) {
      throw new Error(`${label} contains a zero-length edge`)
    }
  })

  if (Math.abs(signedArea(points)) <= EPSILON) {
    throw new Error(`${label} must enclose a non-zero area`)
  }

  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length
      const adjacent =
        first === second ||
        firstNext === second ||
        secondNext === first ||
        (first === 0 && secondNext === 0)

      if (
        !adjacent &&
        segmentsIntersect(
          points[first],
          points[firstNext],
          points[second],
          points[secondNext],
        )
      ) {
        throw new Error(`${label} must not self-intersect`)
      }
    }
  }
}

function assertFiniteGeometry(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')

  if (!position || !normal || position.count === 0) {
    throw new Error('generated geometry must contain positions and normals')
  }

  for (const [label, array] of [
    ['position', position.array],
    ['normal', normal.array],
  ] as const) {
    if (!Array.from(array).every(Number.isFinite)) {
      throw new Error(`generated ${label} data must be finite`)
    }
  }

  if (
    geometry.index &&
    (!Array.from(geometry.index.array).every(Number.isFinite) ||
      Math.max(...geometry.index.array) >= position.count)
  ) {
    throw new Error('generated index data must be finite and in range')
  }

  const index = geometry.index
  const triangleCoordinateCount = index?.count ?? position.count
  if (triangleCoordinateCount % 3 !== 0) {
    throw new Error('generated geometry must contain complete triangles')
  }

  for (let offset = 0; offset < triangleCoordinateCount; offset += 3) {
    const a = index ? index.getX(offset) : offset
    const b = index ? index.getX(offset + 1) : offset + 1
    const c = index ? index.getX(offset + 2) : offset + 2
    triangleA.fromBufferAttribute(position, a)
    triangleB.fromBufferAttribute(position, b)
    triangleC.fromBufferAttribute(position, c)
    triangleAB.subVectors(triangleB, triangleA)
    triangleAC.subVectors(triangleC, triangleA)
    if (triangleAB.cross(triangleAC).lengthSq() <= EPSILON * EPSILON) {
      throw new Error('generated geometry must not contain zero-area triangles')
    }
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const bounds = [
    ...geometry.boundingBox!.min.toArray(),
    ...geometry.boundingBox!.max.toArray(),
    ...geometry.boundingSphere!.center.toArray(),
    geometry.boundingSphere!.radius,
  ]
  if (!bounds.every(Number.isFinite) || geometry.boundingSphere!.radius <= 0) {
    throw new Error('generated geometry must have finite, non-zero bounds')
  }

  return geometry
}

function finishGeometry(geometry: BufferGeometry) {
  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals()
  }

  let result: BufferGeometry
  try {
    result = geometry.index ? geometry : mergeVertices(geometry, 1e-6)
  } catch (error) {
    geometry.dispose()
    throw error
  }
  if (result !== geometry) {
    geometry.dispose()
  }

  try {
    return assertFiniteGeometry(result)
  } catch (error) {
    result.dispose()
    throw error
  }
}

function createCreasedGeometry(
  geometry: BufferGeometry,
  creaseAngle: number,
) {
  assertFinite(creaseAngle, 'creaseAngle')
  if (creaseAngle <= 0 || creaseAngle > Math.PI) {
    geometry.dispose()
    throw new Error('creaseAngle must be within (0, PI]')
  }

  geometry.computeVertexNormals()
  let creased: BufferGeometry
  try {
    creased = toCreasedNormals(geometry, creaseAngle)
  } catch (error) {
    geometry.dispose()
    throw error
  }
  if (creased !== geometry) {
    geometry.dispose()
  }
  return finishGeometry(creased)
}

/**
 * Creates a low-segment, unitless closed shell along local X. It is intended
 * for original teaching silhouettes, not real hull stations or engineering data.
 */
export function createClosedLoftGeometry(
  sections: readonly ClosedLoftSection[],
  options: ClosedLoftOptions = {},
) {
  if (
    sections.length < 2 ||
    sections.length > MAX_LOFT_SECTIONS ||
    !sections.every((section) => section.points.length === sections[0].points.length)
  ) {
    throw new Error(
      `loft requires 2-${MAX_LOFT_SECTIONS} sections with equal point counts`,
    )
  }

  sections.forEach((section, sectionIndex) => {
    assertFinite(section.x, `sections[${sectionIndex}].x`)
    validateClosedProfile(section.points, `sections[${sectionIndex}].points`)
    if (sectionIndex > 0 && section.x <= sections[sectionIndex - 1].x) {
      throw new Error('loft section positions must increase strictly')
    }
  })

  const winding = Math.sign(signedArea(sections[0].points))
  if (
    sections.some(
      (section) => Math.sign(signedArea(section.points)) !== winding,
    )
  ) {
    throw new Error('loft sections must use one consistent winding')
  }
  const normalizedSections = sections.map((section) => ({
    ...section,
    points:
      winding > 0
        ? section.points
        : [section.points[0], ...section.points.slice(1).reverse()],
  }))

  const ringSize = normalizedSections[0].points.length
  const positions = normalizedSections.flatMap((section) =>
    section.points.flatMap((point) => [section.x, point[0], point[1]]),
  )
  const indices: number[] = []

  for (
    let sectionIndex = 0;
    sectionIndex < normalizedSections.length - 1;
    sectionIndex += 1
  ) {
    const currentStart = sectionIndex * ringSize
    const nextStart = (sectionIndex + 1) * ringSize
    for (let pointIndex = 0; pointIndex < ringSize; pointIndex += 1) {
      const nextPoint = (pointIndex + 1) % ringSize
      const a = currentStart + pointIndex
      const b = currentStart + nextPoint
      const c = nextStart + nextPoint
      const d = nextStart + pointIndex
      indices.push(a, b, c, a, c, d)
    }
  }

  if (options.capEnds ?? true) {
    const startCapTriangles = ShapeUtils.triangulateShape(
      normalizedSections[0].points.map(
        (point) => new Vector2(point[0], point[1]),
      ),
      [],
    )
    const endSection = normalizedSections.at(-1)!
    const endCapTriangles = ShapeUtils.triangulateShape(
      endSection.points.map((point) => new Vector2(point[0], point[1])),
      [],
    )
    const endStart = (normalizedSections.length - 1) * ringSize
    startCapTriangles.forEach(([a, b, c]) => {
      indices.push(c, b, a)
    })
    endCapTriangles.forEach(([a, b, c]) => {
      indices.push(endStart + a, endStart + b, endStart + c)
    })
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return createCreasedGeometry(
    geometry,
    options.creaseAngle ?? DEFAULT_CREASE_ANGLE,
  )
}

/** Revolves an original unitless axial/radius profile around a local axis. */
export function createRevolvedProfileGeometry(
  profile: readonly Point2[],
  options: RevolvedProfileOptions = {},
) {
  if (profile.length < 2 || profile.length > MAX_PROFILE_POINTS) {
    throw new Error(`revolved profile must contain 2-${MAX_PROFILE_POINTS} points`)
  }

  const axis = options.axis ?? 'y'
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') {
    throw new Error('axis must be x, y, or z')
  }

  const segments = options.segments ?? 16
  if (
    !Number.isInteger(segments) ||
    segments < 3 ||
    segments > MAX_RADIAL_SEGMENTS
  ) {
    throw new Error(`segments must be an integer from 3-${MAX_RADIAL_SEGMENTS}`)
  }

  profile.forEach(([axial, radius], index) => {
    assertFinite(axial, `profile[${index}][0]`)
    assertFinite(radius, `profile[${index}][1]`)
    const endpoint = index === 0 || index === profile.length - 1
    if (radius < 0 || (!endpoint && radius <= 0)) {
      throw new Error(
        `profile[${index}][1] must be positive except for a zero-radius endpoint`,
      )
    }
    if (index > 0 && axial <= profile[index - 1][0]) {
      throw new Error('revolved axial positions must increase strictly')
    }
  })

  if (!profile.some(([, radius]) => radius > 0)) {
    throw new Error('revolved profile must contain a positive radius')
  }

  const positions: number[] = []
  const rings = profile.map(([axial, radius]) => {
    if (radius === 0) {
      const index = positions.length / 3
      if (axis === 'x') positions.push(axial, 0, 0)
      if (axis === 'y') positions.push(0, axial, 0)
      if (axis === 'z') positions.push(0, 0, axial)
      return [index]
    }

    return Array.from({ length: segments }, (_, segment) => {
      const angle = (segment / segments) * Math.PI * 2
      const firstRadial = Math.cos(angle) * radius
      const secondRadial = Math.sin(angle) * radius
      const index = positions.length / 3
      if (axis === 'x') positions.push(axial, firstRadial, secondRadial)
      if (axis === 'y') positions.push(firstRadial, axial, secondRadial)
      if (axis === 'z') positions.push(firstRadial, secondRadial, axial)
      return index
    })
  })
  const indices: number[] = []
  const addTriangle = (a: number, b: number, c: number) => {
    if (axis === 'y') indices.push(a, c, b)
    else indices.push(a, b, c)
  }

  for (let station = 0; station < rings.length - 1; station += 1) {
    const current = rings[station]
    const next = rings[station + 1]
    if (current.length === 1 && next.length === 1) {
      throw new Error('adjacent zero-radius stations cannot form a surface')
    }

    for (let segment = 0; segment < segments; segment += 1) {
      const following = (segment + 1) % segments
      if (current.length === 1) {
        addTriangle(current[0], next[following], next[segment])
      } else if (next.length === 1) {
        addTriangle(current[segment], current[following], next[0])
      } else {
        addTriangle(
          current[segment],
          current[following],
          next[following],
        )
        addTriangle(current[segment], next[following], next[segment])
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return finishGeometry(geometry)
}

/** Extrudes a small original 2D profile around the local Z origin. */
export function createExtrudedProfileGeometry(
  points: readonly Point2[],
  options: ExtrudedProfileOptions,
) {
  validateClosedProfile(points, 'extruded profile')
  assertPositive(options.depth, 'depth')
  const bevelSize = options.bevelSize ?? 0
  assertFinite(bevelSize, 'bevelSize')
  if (bevelSize < 0 || bevelSize >= options.depth / 2) {
    throw new Error('bevelSize must be non-negative and less than half the depth')
  }

  const shape = new Shape()
  shape.moveTo(points[0][0], points[0][1])
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y))
  shape.closePath()

  const bevelEnabled = bevelSize > 0
  const innerDepth = options.depth - bevelSize * 2
  const geometry = new ExtrudeGeometry(shape, {
    depth: innerDepth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled,
    bevelSegments: bevelEnabled ? 1 : 0,
    bevelSize,
    bevelThickness: bevelSize,
  })
  geometry.translate(0, 0, -innerDepth / 2)
  return finishGeometry(geometry)
}

/**
 * Creates a bounded set of disconnected abstract blades around local X. The API
 * intentionally exposes no operational or manufacturing parameter.
 */
export function createTwistedRadialAssembly(
  stations: readonly TwistedRadialStation[],
  bladeCount: number,
) {
  if (stations.length < 2 || stations.length > 12) {
    throw new Error('radial assembly requires 2-12 unitless stations')
  }
  if (!Number.isInteger(bladeCount) || bladeCount < 2 || bladeCount > 6) {
    throw new Error('bladeCount must be an integer from 2-6')
  }

  stations.forEach((station, index) => {
    assertPositive(station.radial, `stations[${index}].radial`)
    assertPositive(station.chord, `stations[${index}].chord`)
    assertPositive(station.thickness, `stations[${index}].thickness`)
    assertFinite(station.sweep, `stations[${index}].sweep`)
    assertFinite(station.twist, `stations[${index}].twist`)
    if (index > 0 && station.radial <= stations[index - 1].radial) {
      throw new Error('radial stations must increase strictly')
    }
  })

  const bladeSections = stations.map((station) => {
    const halfThickness = station.thickness / 2
    const halfChord = station.chord / 2
    const cosine = Math.cos(station.twist)
    const sine = Math.sin(station.twist)
    const outline: Point2[] = [
      [-halfThickness, station.sweep - halfChord],
      [halfThickness, station.sweep - halfChord],
      [halfThickness, station.sweep + halfChord],
      [-halfThickness, station.sweep + halfChord],
    ].map(([crosswise, chordwise]) => [
      crosswise * cosine - chordwise * sine,
      crosswise * sine + chordwise * cosine,
    ])

    return { x: station.radial, points: outline }
  })

  const blades: BufferGeometry[] = []
  let assembly: BufferGeometry | null
  try {
    for (let index = 0; index < bladeCount; index += 1) {
      const blade = createClosedLoftGeometry(bladeSections, {
        capEnds: true,
        creaseAngle: DEFAULT_CREASE_ANGLE,
      })
      blades.push(blade)
      blade.rotateZ(Math.PI / 2)
      blade.rotateX((index * Math.PI * 2) / bladeCount)
    }
    assembly = mergeGeometries(blades, true)
  } finally {
    blades.forEach((blade) => blade.dispose())
  }
  if (!assembly) {
    throw new Error('unable to merge radial blade geometry')
  }
  return finishGeometry(assembly)
}

/**
 * Creates a centered, faceted educational tooth prism in the local XY plane.
 * Four outline points per tooth keep the public maximum within the 64-point
 * profile budget.
 */
export function createRadialToothPrism(options: RadialToothPrismOptions) {
  assertPositive(options.rootRadius, 'rootRadius')
  assertPositive(options.tipRadius, 'tipRadius')
  assertPositive(options.depth, 'depth')
  if (options.tipRadius <= options.rootRadius) {
    throw new Error('tipRadius must be greater than rootRadius')
  }
  if (
    !Number.isInteger(options.toothCount) ||
    options.toothCount < 3 ||
    options.toothCount > 16
  ) {
    throw new Error('toothCount must be an integer from 3-16')
  }

  const step = (Math.PI * 2) / options.toothCount
  const points: Point2[] = []
  for (let tooth = 0; tooth < options.toothCount; tooth += 1) {
    const start = tooth * step
    ;[
      [start + step * 0.05, options.rootRadius],
      [start + step * 0.28, options.tipRadius],
      [start + step * 0.72, options.tipRadius],
      [start + step * 0.95, options.rootRadius],
    ].forEach(([angle, radius]) => {
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
    })
  }

  return createExtrudedProfileGeometry(points, { depth: options.depth })
}

/** Creates a low-segment box with a deliberately narrow abstract chamfer. */
export function createChamferedBoxGeometry(options: ChamferedBoxOptions) {
  assertPositive(options.width, 'width')
  assertPositive(options.height, 'height')
  assertPositive(options.depth, 'depth')
  assertPositive(options.bevelSize, 'bevelSize')
  if (options.segments !== undefined && options.segments !== 1) {
    throw new Error('chamfer segments must remain at one')
  }
  if (
    options.bevelSize >=
    Math.min(options.width, options.height, options.depth) / 4
  ) {
    throw new Error('bevelSize must remain narrower than one quarter of a side')
  }

  return finishGeometry(
    new RoundedBoxGeometry(
      options.width,
      options.height,
      options.depth,
      1,
      options.bevelSize,
    ),
  )
}
