import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import {
  createChamferedBoxGeometry,
  createClosedLoftGeometry,
  createRadialToothPrism,
  createRevolvedProfileGeometry,
} from './proceduralGeometry'

export interface TankHullSectionSpec {
  /** Original unitless station; it is not an armor or manufacturing dimension. */
  x: number
  bottomY: number
  shoulderY: number
  deckY: number
  bottomHalfWidth: number
  halfWidth: number
  upperHalfWidth: number
}

/**
 * Sparse, original teaching silhouette. The stations communicate only the
 * relationship between a lower hull, side shoulder, deck, and sloped ends.
 */
export const TANK_HULL_SECTIONS = [
  {
    x: -2.38,
    bottomY: 0.62,
    shoulderY: 0.84,
    deckY: 1.12,
    bottomHalfWidth: 0.68,
    halfWidth: 0.96,
    upperHalfWidth: 0.82,
  },
  {
    x: -2.04,
    bottomY: 0.52,
    shoulderY: 0.9,
    deckY: 1.46,
    bottomHalfWidth: 0.9,
    halfWidth: 1.18,
    upperHalfWidth: 1.08,
  },
  {
    x: -1.42,
    bottomY: 0.48,
    shoulderY: 0.92,
    deckY: 1.64,
    bottomHalfWidth: 0.98,
    halfWidth: 1.25,
    upperHalfWidth: 1.16,
  },
  {
    x: -0.28,
    bottomY: 0.47,
    shoulderY: 0.93,
    deckY: 1.68,
    bottomHalfWidth: 1,
    halfWidth: 1.27,
    upperHalfWidth: 1.18,
  },
  {
    x: 0.9,
    bottomY: 0.48,
    shoulderY: 0.93,
    deckY: 1.65,
    bottomHalfWidth: 0.99,
    halfWidth: 1.26,
    upperHalfWidth: 1.17,
  },
  {
    x: 1.72,
    bottomY: 0.52,
    shoulderY: 0.9,
    deckY: 1.52,
    bottomHalfWidth: 0.91,
    halfWidth: 1.2,
    upperHalfWidth: 1.08,
  },
  {
    x: 2.16,
    bottomY: 0.6,
    shoulderY: 0.88,
    deckY: 1.34,
    bottomHalfWidth: 0.76,
    halfWidth: 1.06,
    upperHalfWidth: 0.88,
  },
  {
    x: 2.4,
    bottomY: 0.72,
    shoulderY: 0.9,
    deckY: 1.06,
    bottomHalfWidth: 0.58,
    halfWidth: 0.82,
    upperHalfWidth: 0.64,
  },
] as const satisfies readonly TankHullSectionSpec[]

/** Original low-segment teaching profile, not a measured turret section. */
export const TANK_TURRET_PROFILE = [
  [-0.4, 0],
  [-0.34, 0.72],
  [-0.29, 0.93],
  [-0.16, 1.12],
  [0.08, 1.18],
  [0.31, 1.1],
  [0.5, 0.91],
  [0.61, 0.64],
  [0.68, 0],
] as const

export const TANK_ROAD_WHEEL_X = [
  -1.76, -1.12, -0.48, 0.48, 1.12, 1.76,
] as const

/** Deliberately generic and non-historical. */
export const TANK_DRIVE_TOOTH_COUNT = 11

export type TankGeometryKey =
  | 'hull'
  | 'hullBolt'
  | 'turret'
  | 'turretRing'
  | 'gunMantlet'
  | 'exteriorBarrel'
  | 'commanderHatch'
  | 'trackLink'
  | 'roadWheelRim'
  | 'roadWheelHub'
  | 'returnRollerRim'
  | 'bogieHousing'
  | 'springHousing'
  | 'supportBeam'
  | 'driveToothRing'
  | 'driveHub'
  | 'idlerRim'
  | 'idlerHub'
  | 'idlerSpoke'
  | 'engineCylinder'
  | 'engineHub'
  | 'engineBand'
  | 'transmissionShaft'
  | 'transmissionBand'
  | 'transmissionHousing'
  | 'crewCompartment'
  | 'crewTurretSpace'
  | 'crewBulkhead'
  | 'periscope'
  | 'sightLine'
  | 'recoilOuter'
  | 'recoilInner'
  | 'recoilRing'

export type TankGeometrySet = Record<TankGeometryKey, BufferGeometry>

interface TankRenderBatch {
  geometry: TankGeometryKey
  drawCalls: number
  instances: number
  instanced?: true
}

export const TANK_BASE_RENDER_BATCHES = [
  { geometry: 'hull', drawCalls: 1, instances: 1 },
  { geometry: 'hullBolt', drawCalls: 1, instances: 19, instanced: true },
  { geometry: 'turret', drawCalls: 1, instances: 1 },
  { geometry: 'turretRing', drawCalls: 1, instances: 1 },
  { geometry: 'gunMantlet', drawCalls: 1, instances: 1 },
  { geometry: 'exteriorBarrel', drawCalls: 1, instances: 1 },
  { geometry: 'commanderHatch', drawCalls: 1, instances: 1 },
  { geometry: 'engineCylinder', drawCalls: 1, instances: 9, instanced: true },
  { geometry: 'engineHub', drawCalls: 1, instances: 1 },
  { geometry: 'engineBand', drawCalls: 1, instances: 1 },
  { geometry: 'transmissionShaft', drawCalls: 1, instances: 1 },
  { geometry: 'transmissionBand', drawCalls: 1, instances: 3, instanced: true },
  { geometry: 'transmissionHousing', drawCalls: 1, instances: 1 },
  { geometry: 'roadWheelRim', drawCalls: 2, instances: 12, instanced: true },
  { geometry: 'roadWheelHub', drawCalls: 2, instances: 12, instanced: true },
  { geometry: 'returnRollerRim', drawCalls: 2, instances: 6, instanced: true },
  { geometry: 'bogieHousing', drawCalls: 2, instances: 6, instanced: true },
  { geometry: 'springHousing', drawCalls: 2, instances: 6, instanced: true },
  { geometry: 'supportBeam', drawCalls: 2, instances: 2 },
  { geometry: 'driveToothRing', drawCalls: 2, instances: 2 },
  { geometry: 'driveHub', drawCalls: 2, instances: 2 },
  { geometry: 'idlerRim', drawCalls: 2, instances: 2 },
  { geometry: 'idlerHub', drawCalls: 2, instances: 2 },
  { geometry: 'idlerSpoke', drawCalls: 2, instances: 12, instanced: true },
  { geometry: 'trackLink', drawCalls: 2, instances: 88, instanced: true },
  { geometry: 'crewCompartment', drawCalls: 1, instances: 1 },
  { geometry: 'crewTurretSpace', drawCalls: 1, instances: 1 },
  { geometry: 'crewBulkhead', drawCalls: 1, instances: 1 },
  { geometry: 'periscope', drawCalls: 1, instances: 3, instanced: true },
  { geometry: 'sightLine', drawCalls: 3, instances: 3 },
  { geometry: 'recoilOuter', drawCalls: 1, instances: 1 },
  { geometry: 'recoilInner', drawCalls: 1, instances: 1 },
  { geometry: 'recoilRing', drawCalls: 1, instances: 1 },
] as const satisfies readonly TankRenderBatch[]

export const TANK_GEOMETRY_BUDGET = {
  baseDrawCalls: 59,
  principleDrawCalls: 59,
  triangles: 30_000,
} as const

export function prepareTankGeometry<T extends BufferGeometry>(geometry: T) {
  try {
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  } catch (error) {
    geometry.dispose()
    throw error
  }
}

function hullPoints(section: TankHullSectionSpec) {
  return [
    [section.bottomY, -section.bottomHalfWidth],
    [section.shoulderY, -section.halfWidth],
    [section.deckY, -section.upperHalfWidth],
    [section.deckY, section.upperHalfWidth],
    [section.shoulderY, section.halfWidth],
    [section.bottomY, section.bottomHalfWidth],
  ] as const
}

function prepareRoadWheelRim() {
  return prepareTankGeometry(new TorusGeometry(0.34, 0.09, 8, 18))
}

function prepareAxialCylinder(
  radiusTop: number,
  radiusBottom: number,
  depth: number,
  segments: number,
) {
  const geometry = new CylinderGeometry(
    radiusTop,
    radiusBottom,
    depth,
    segments,
  )
  geometry.rotateX(Math.PI / 2)
  return prepareTankGeometry(geometry)
}

export function createTankGeometrySet(): TankGeometrySet {
  const resources: Partial<TankGeometrySet> = {}

  try {
    resources.hull = createClosedLoftGeometry(
      TANK_HULL_SECTIONS.map((section) => ({
        x: section.x,
        points: hullPoints(section),
      })),
      { capEnds: true, creaseAngle: Math.PI / 5 },
    )
    resources.hullBolt = prepareTankGeometry(new SphereGeometry(0.045, 8, 6))

    resources.turret = createRevolvedProfileGeometry(TANK_TURRET_PROFILE, {
      axis: 'y',
      segments: 16,
    })
    resources.turret.scale(1, 1, 0.86)
    resources.turret.computeBoundingBox()
    resources.turret.computeBoundingSphere()
    resources.turretRing = prepareTankGeometry(
      new TorusGeometry(1.04, 0.075, 8, 24),
    )
    resources.turretRing.rotateX(Math.PI / 2)
    resources.gunMantlet = prepareTankGeometry(
      new CylinderGeometry(0.3, 0.36, 0.38, 12),
    )
    resources.exteriorBarrel = prepareTankGeometry(
      new CylinderGeometry(0.12, 0.16, 1.9, 12),
    )
    resources.commanderHatch = prepareTankGeometry(
      new CylinderGeometry(0.33, 0.36, 0.11, 14),
    )

    resources.trackLink = createChamferedBoxGeometry({
      width: 0.34,
      height: 0.12,
      depth: 0.48,
      bevelSize: 0.018,
      segments: 1,
    })
    resources.roadWheelRim = prepareRoadWheelRim()
    resources.roadWheelHub = prepareTankGeometry(
      new CylinderGeometry(0.23, 0.23, 0.25, 14),
    )
    resources.returnRollerRim = prepareTankGeometry(
      new TorusGeometry(0.2, 0.06, 7, 14),
    )
    resources.bogieHousing = createChamferedBoxGeometry({
      width: 0.72,
      height: 0.32,
      depth: 0.22,
      bevelSize: 0.035,
      segments: 1,
    })
    resources.springHousing = prepareTankGeometry(
      new CylinderGeometry(0.12, 0.12, 0.52, 10),
    )
    resources.supportBeam = createChamferedBoxGeometry({
      width: 4.25,
      height: 0.1,
      depth: 0.12,
      bevelSize: 0.018,
      segments: 1,
    })
    resources.driveToothRing = createRadialToothPrism({
      rootRadius: 0.42,
      tipRadius: 0.52,
      toothCount: TANK_DRIVE_TOOTH_COUNT,
      depth: 0.16,
    })
    resources.driveHub = prepareAxialCylinder(0.22, 0.22, 0.22, 14)
    resources.idlerRim = prepareTankGeometry(
      new TorusGeometry(0.39, 0.075, 8, 18),
    )
    resources.idlerHub = prepareAxialCylinder(0.16, 0.16, 0.18, 12)
    resources.idlerSpoke = createChamferedBoxGeometry({
      width: 0.44,
      height: 0.055,
      depth: 0.08,
      bevelSize: 0.009,
      segments: 1,
    })

    resources.engineCylinder = prepareTankGeometry(
      new CylinderGeometry(0.14, 0.17, 0.56, 10),
    )
    resources.engineHub = prepareTankGeometry(
      new CylinderGeometry(0.35, 0.35, 0.52, 16),
    )
    resources.engineBand = prepareTankGeometry(
      new TorusGeometry(0.22, 0.055, 8, 20),
    )
    resources.transmissionShaft = prepareTankGeometry(
      new CylinderGeometry(0.1, 0.1, 2.85, 12),
    )
    resources.transmissionBand = prepareTankGeometry(
      new TorusGeometry(0.26, 0.045, 8, 20),
    )
    resources.transmissionHousing = prepareTankGeometry(
      new CylinderGeometry(0.32, 0.38, 0.48, 12),
    )
    resources.crewCompartment = createChamferedBoxGeometry({
      width: 1.45,
      height: 0.72,
      depth: 1.52,
      bevelSize: 0.09,
      segments: 1,
    })
    resources.crewTurretSpace = prepareTankGeometry(
      new CylinderGeometry(0.61, 0.7, 0.7, 14),
    )
    resources.crewBulkhead = prepareTankGeometry(
      new BoxGeometry(0.06, 0.62, 1.28),
    )
    resources.periscope = createChamferedBoxGeometry({
      width: 0.18,
      height: 0.22,
      depth: 0.13,
      bevelSize: 0.018,
      segments: 1,
    })
    resources.sightLine = prepareTankGeometry(
      new BoxGeometry(1.4, 0.018, 0.018),
    )
    resources.recoilOuter = prepareTankGeometry(
      new CylinderGeometry(0.17, 0.17, 0.82, 14),
    )
    resources.recoilInner = prepareTankGeometry(
      new CylinderGeometry(0.1, 0.1, 0.92, 14),
    )
    resources.recoilRing = prepareTankGeometry(
      new TorusGeometry(0.2, 0.045, 8, 18),
    )

    return resources as TankGeometrySet
  } catch (error) {
    Object.values(resources).forEach((geometry) => geometry?.dispose())
    throw error
  }
}

function triangleCount(geometry: BufferGeometry) {
  return (geometry.index?.count ?? geometry.getAttribute('position').count) / 3
}

export function getTankGeometryBudgetReport(set: TankGeometrySet) {
  const entries = Object.entries(set) as [TankGeometryKey, BufferGeometry][]
  const geometryTriangles = entries.reduce(
    (total, [, geometry]) => total + triangleCount(geometry),
    0,
  )
  const renderedTriangles = TANK_BASE_RENDER_BATCHES.reduce(
    (total, batch) =>
      total + triangleCount(set[batch.geometry]) * batch.instances,
    0,
  )

  return {
    geometryTriangles,
    renderedTriangles,
    baseDrawCalls: TANK_BASE_RENDER_BATCHES.reduce(
      (total, batch) => total + batch.drawCalls,
      0,
    ),
    principleDrawCalls: TANK_BASE_RENDER_BATCHES.reduce(
      (total, batch) => total + batch.drawCalls,
      0,
    ),
    instancedDetails: TANK_BASE_RENDER_BATCHES.reduce(
      (total, batch) =>
        total + ('instanced' in batch && batch.instanced ? batch.instances : 0),
      0,
    ),
  } as const
}

export function disposeTankGeometrySet(set: TankGeometrySet) {
  Object.values(set).forEach((geometry) => geometry.dispose())
}
