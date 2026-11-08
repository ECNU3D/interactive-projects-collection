import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  createChamferedBoxGeometry,
  createExtrudedProfileGeometry,
  createRevolvedProfileGeometry,
  createTwistedRadialAssembly,
  type TwistedRadialStation,
} from './proceduralGeometry'

type Vector3Tuple = readonly [number, number, number]

/**
 * Original, unitless teaching silhouette. It intentionally describes only a
 * recognizable nose/body/tail relationship and contains no X-57 dimensions.
 */
export const AIRCRAFT_FUSELAGE_PROFILE = [
  [-2.74, 0],
  [-2.58, 0.2],
  [-2.2, 0.38],
  [-1.48, 0.49],
  [-0.62, 0.54],
  [0.28, 0.55],
  [1.08, 0.5],
  [1.72, 0.41],
  [2.18, 0.29],
  [2.58, 0.11],
  [2.74, 0],
] as const

/** Original rounded planforms, not a named or measured airfoil. */
export const AIRCRAFT_MAIN_WING_PLANFORM = [
  [0.62, 0],
  [0.18, 4.18],
  [-0.35, 4.18],
  [-0.62, 0],
  [-0.35, -4.18],
  [0.18, -4.18],
] as const

export const AIRCRAFT_HORIZONTAL_TAIL_PLANFORM = [
  [0.35, 0],
  [0.06, 1.06],
  [-0.32, 1.06],
  [-0.38, 0],
  [-0.32, -1.06],
  [0.06, -1.06],
] as const

export const AIRCRAFT_VERTICAL_TAIL_PROFILE = [
  [0.38, 0],
  [0.1, 0.84],
  [-0.36, 0.72],
  [-0.48, 0],
] as const

export const AIRCRAFT_SURFACE_LAYOUT = {
  mainWingX: 0.03,
  horizontalTailX: -2.48,
  verticalTailX: -2.52,
} as const

export const AIRCRAFT_GEAR_CONTACTS = [
  [1.18, -0.55, 0],
  [-0.55, -0.58, 0.72],
  [-0.55, -0.58, -0.72],
] as const satisfies readonly Vector3Tuple[]

const HIGH_LIFT_ROTOR_STATIONS = [
  { radial: 0.045, chord: 0.055, sweep: 0, thickness: 0.018, twist: -0.04 },
  { radial: 0.13, chord: 0.075, sweep: 0.012, thickness: 0.014, twist: 0.03 },
  { radial: 0.22, chord: 0.045, sweep: 0.025, thickness: 0.01, twist: 0.09 },
] as const satisfies readonly TwistedRadialStation[]

const WINGTIP_ROTOR_STATIONS = [
  { radial: 0.08, chord: 0.1, sweep: 0, thickness: 0.026, twist: -0.05 },
  { radial: 0.27, chord: 0.14, sweep: 0.025, thickness: 0.02, twist: 0.04 },
  { radial: 0.48, chord: 0.09, sweep: 0.06, thickness: 0.014, twist: 0.11 },
] as const satisfies readonly TwistedRadialStation[]

export type AircraftGeometryKey =
  | 'fuselage'
  | 'canopy'
  | 'canopyWindow'
  | 'mainWing'
  | 'wingTip'
  | 'wingSpar'
  | 'horizontalTail'
  | 'verticalTail'
  | 'tailTrim'
  | 'gearStrut'
  | 'gearFork'
  | 'gearTire'
  | 'gearHub'
  | 'highLiftNacelle'
  | 'highLiftRotor'
  | 'wingtipNacelle'
  | 'wingtipRotor'
  | 'batteryModule'
  | 'batteryConnector'
  | 'powerBusLong'
  | 'powerBusSpan'
  | 'inverter'
  | 'cockpitUnit'
  | 'cockpitIndicator'
  | 'coolingFin'
  | 'coolingLoop'
  | 'principlePulse'

export type AircraftGeometrySet = Record<AircraftGeometryKey, BufferGeometry>

interface AircraftRenderBatch {
  id: string
  geometry?: AircraftGeometryKey
  drawCalls: number
  instances: number
  instanced?: true
}

export const AIRCRAFT_BASE_RENDER_BATCHES = [
  { id: 'fuselage', geometry: 'fuselage', drawCalls: 1, instances: 1 },
  { id: 'canopy', geometry: 'canopy', drawCalls: 1, instances: 1 },
  { id: 'canopy-windows', geometry: 'canopyWindow', drawCalls: 1, instances: 2, instanced: true },
  { id: 'main-wing', geometry: 'mainWing', drawCalls: 1, instances: 1 },
  { id: 'wing-tips', geometry: 'wingTip', drawCalls: 1, instances: 2, instanced: true },
  { id: 'wing-spar', geometry: 'wingSpar', drawCalls: 1, instances: 1 },
  { id: 'horizontal-tail', geometry: 'horizontalTail', drawCalls: 1, instances: 1 },
  { id: 'vertical-tail', geometry: 'verticalTail', drawCalls: 1, instances: 1 },
  { id: 'tail-trim', geometry: 'tailTrim', drawCalls: 1, instances: 1 },
  { id: 'gear-struts', geometry: 'gearStrut', drawCalls: 1, instances: 3, instanced: true },
  { id: 'gear-forks', geometry: 'gearFork', drawCalls: 1, instances: 3, instanced: true },
  { id: 'gear-tires', geometry: 'gearTire', drawCalls: 1, instances: 3, instanced: true },
  { id: 'gear-hubs', geometry: 'gearHub', drawCalls: 1, instances: 3, instanced: true },
  { id: 'tip-nacelles', geometry: 'wingtipNacelle', drawCalls: 1, instances: 2, instanced: true },
  { id: 'tip-rotors', geometry: 'wingtipRotor', drawCalls: 2, instances: 2 },
  { id: 'lift-nacelles', geometry: 'highLiftNacelle', drawCalls: 1, instances: 12, instanced: true },
  { id: 'lift-rotors', geometry: 'highLiftRotor', drawCalls: 12, instances: 12 },
  { id: 'battery-modules', geometry: 'batteryModule', drawCalls: 1, instances: 2, instanced: true },
  { id: 'battery-connectors', geometry: 'batteryConnector', drawCalls: 1, instances: 6, instanced: true },
  { id: 'long-power-buses', geometry: 'powerBusLong', drawCalls: 1, instances: 2, instanced: true },
  { id: 'span-power-buses', geometry: 'powerBusSpan', drawCalls: 1, instances: 2, instanced: true },
  { id: 'inverters', geometry: 'inverter', drawCalls: 1, instances: 4, instanced: true },
  { id: 'cockpit-unit', geometry: 'cockpitUnit', drawCalls: 1, instances: 1 },
  { id: 'cockpit-indicators', geometry: 'cockpitIndicator', drawCalls: 1, instances: 6, instanced: true },
  { id: 'cooling-fins', geometry: 'coolingFin', drawCalls: 1, instances: 12, instanced: true },
  { id: 'cooling-loops', geometry: 'coolingLoop', drawCalls: 4, instances: 4 },
] as const satisfies readonly AircraftRenderBatch[]

export const AIRCRAFT_GEOMETRY_BUDGET = {
  baseDrawCalls: 59,
  principleDrawCalls: 89,
  triangles: 24_000,
} as const

export function prepareAircraftGeometry<T extends BufferGeometry>(geometry: T) {
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

export type AircraftGeometryMerger = (
  geometries: BufferGeometry[],
  useGroups?: boolean,
) => BufferGeometry | null

export function mergeOwnedAircraftGeometries(
  parts: BufferGeometry[],
  label: string,
  merge: AircraftGeometryMerger = mergeGeometries,
) {
  let merged: BufferGeometry | null = null
  try {
    merged = merge(parts, false)
  } finally {
    parts.forEach((part) => part.dispose())
  }
  if (!merged) throw new Error(`unable to create ${label}`)
  return prepareAircraftGeometry(merged)
}

function createGearForkGeometry() {
  return mergeOwnedAircraftGeometries(
    [
      new BoxGeometry(0.045, 0.25, 0.045).translate(0, 0.1, -0.09),
      new BoxGeometry(0.045, 0.25, 0.045).translate(0, 0.1, 0.09),
      new BoxGeometry(0.045, 0.045, 0.22).translate(0, 0.22, 0),
    ],
    'aircraft landing-gear fork',
  )
}

function createCanopyGeometry() {
  const canopy = new SphereGeometry(0.5, 18, 10)
  canopy.scale(1.35, 0.42, 0.76)
  return prepareAircraftGeometry(canopy)
}

function createLiftingSurface(
  planform: readonly (readonly [number, number])[],
  thickness: number,
) {
  const geometry = createExtrudedProfileGeometry(planform, {
    depth: thickness,
    bevelSize: Math.min(0.018, thickness * 0.18),
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createMainWingGeometry() {
  const geometry = createLiftingSurface(AIRCRAFT_MAIN_WING_PLANFORM, 0.13)
  const position = geometry.getAttribute('position')
  const teachingTipRise = 0.14
  const teachingHalfSpan = 4.18

  for (let index = 0; index < position.count; index += 1) {
    const spanProgress = Math.min(
      1,
      Math.abs(position.getZ(index)) / teachingHalfSpan,
    )
    position.setY(
      index,
      position.getY(index) + teachingTipRise * spanProgress,
    )
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function createAircraftGeometrySet(): AircraftGeometrySet {
  const resources: Partial<AircraftGeometrySet> = {}

  try {
    resources.fuselage = createRevolvedProfileGeometry(
      AIRCRAFT_FUSELAGE_PROFILE,
      { axis: 'x', segments: 22 },
    )
    resources.canopy = createCanopyGeometry()
    resources.canopyWindow = createChamferedBoxGeometry({
      width: 0.68,
      height: 0.055,
      depth: 0.3,
      bevelSize: 0.012,
      segments: 1,
    })
    resources.mainWing = createMainWingGeometry()
    resources.wingTip = createChamferedBoxGeometry({
      width: 0.72,
      height: 0.105,
      depth: 0.7,
      bevelSize: 0.02,
      segments: 1,
    })
    resources.wingSpar = createChamferedBoxGeometry({
      width: 0.09,
      height: 0.085,
      depth: 8.62,
      bevelSize: 0.015,
      segments: 1,
    })
    resources.horizontalTail = createLiftingSurface(
      AIRCRAFT_HORIZONTAL_TAIL_PLANFORM,
      0.1,
    )
    resources.verticalTail = createExtrudedProfileGeometry(
      AIRCRAFT_VERTICAL_TAIL_PROFILE,
      { depth: 0.1, bevelSize: 0.018 },
    )
    resources.tailTrim = createChamferedBoxGeometry({
      width: 0.08,
      height: 0.12,
      depth: 2.14,
      bevelSize: 0.014,
      segments: 1,
    })
    resources.gearStrut = prepareAircraftGeometry(
      new CylinderGeometry(0.035, 0.045, 0.66, 10),
    )
    resources.gearFork = createGearForkGeometry()
    resources.gearTire = prepareAircraftGeometry(
      new TorusGeometry(0.115, 0.045, 8, 18),
    )
    resources.gearHub = prepareAircraftGeometry(
      new CylinderGeometry(0.07, 0.07, 0.12, 14),
    )
    resources.highLiftNacelle = createRevolvedProfileGeometry(
      [[-0.2, 0], [-0.15, 0.12], [0.13, 0.13], [0.22, 0]],
      { axis: 'x', segments: 14 },
    )
    resources.highLiftRotor = createTwistedRadialAssembly(
      HIGH_LIFT_ROTOR_STATIONS,
      3,
    )
    resources.wingtipNacelle = createRevolvedProfileGeometry(
      [[-0.35, 0], [-0.27, 0.21], [0.22, 0.24], [0.36, 0]],
      { axis: 'x', segments: 16 },
    )
    resources.wingtipRotor = createTwistedRadialAssembly(
      WINGTIP_ROTOR_STATIONS,
      3,
    )
    resources.batteryModule = createChamferedBoxGeometry({
      width: 1.45,
      height: 0.34,
      depth: 0.32,
      bevelSize: 0.055,
      segments: 1,
    })
    resources.batteryConnector = prepareAircraftGeometry(
      new CylinderGeometry(0.018, 0.018, 0.22, 8),
    )
    resources.powerBusLong = createChamferedBoxGeometry({
      width: 1.75,
      height: 0.035,
      depth: 0.045,
      bevelSize: 0.007,
      segments: 1,
    })
    resources.powerBusSpan = createChamferedBoxGeometry({
      width: 0.045,
      height: 0.035,
      depth: 4.5,
      bevelSize: 0.007,
      segments: 1,
    })
    resources.inverter = createChamferedBoxGeometry({
      width: 0.44,
      height: 0.3,
      depth: 0.38,
      bevelSize: 0.045,
      segments: 1,
    })
    resources.cockpitUnit = createChamferedBoxGeometry({
      width: 0.42,
      height: 0.3,
      depth: 0.52,
      bevelSize: 0.035,
      segments: 1,
    })
    resources.cockpitIndicator = prepareAircraftGeometry(
      new SphereGeometry(0.026, 8, 6),
    )
    resources.coolingFin = createChamferedBoxGeometry({
      width: 0.045,
      height: 0.26,
      depth: 0.32,
      bevelSize: 0.007,
      segments: 1,
    })
    resources.coolingLoop = prepareAircraftGeometry(
      new TorusGeometry(0.22, 0.026, 7, 28, Math.PI * 1.45),
    )
    resources.principlePulse = prepareAircraftGeometry(
      new SphereGeometry(0.075, 10, 8),
    )

    return resources as AircraftGeometrySet
  } catch (error) {
    Object.values(resources).forEach((geometry) => geometry?.dispose())
    throw error
  }
}

function triangleCount(geometry: BufferGeometry) {
  return (geometry.index?.count ?? geometry.getAttribute('position').count) / 3
}

export function getAircraftGeometryBudgetReport(set: AircraftGeometrySet) {
  const entries = Object.entries(set) as [AircraftGeometryKey, BufferGeometry][]
  const geometryTriangles = entries.reduce(
    (total, [, geometry]) => total + triangleCount(geometry),
    0,
  )
  const usedKeys = new Set<AircraftGeometryKey>()
  const renderedTriangles = AIRCRAFT_BASE_RENDER_BATCHES.reduce(
    (total, batch) => {
      if (!('geometry' in batch)) return total
      usedKeys.add(batch.geometry)
      return total + triangleCount(set[batch.geometry]) * batch.instances
    },
    0,
  ) + entries.reduce(
    (total, [key, geometry]) => total + (usedKeys.has(key) ? 0 : triangleCount(geometry)),
    0,
  )
  const baseDrawCalls = AIRCRAFT_BASE_RENDER_BATCHES.reduce(
    (total, batch) => total + batch.drawCalls,
    0,
  )

  return {
    geometryTriangles,
    renderedTriangles,
    baseDrawCalls,
    principleDrawCalls: baseDrawCalls + 44,
    instancedDetails: AIRCRAFT_BASE_RENDER_BATCHES.reduce(
      (total, batch) =>
        total + ('instanced' in batch && batch.instanced ? batch.instances : 0),
      0,
    ),
  } as const
}

export function disposeAircraftGeometrySet(set: AircraftGeometrySet) {
  Object.values(set).forEach((geometry) => geometry.dispose())
}
