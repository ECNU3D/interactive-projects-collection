import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  createChamferedBoxGeometry,
  createClosedLoftGeometry,
  createExtrudedProfileGeometry,
  createRevolvedProfileGeometry,
  createTwistedRadialAssembly,
  type TwistedRadialStation,
} from './proceduralGeometry'

export interface VesselHullSectionSpec {
  /** Original unitless station coordinate; not a real hull line or dimension. */
  x: number
  halfWidth: number
  deckY: number
  chineY: number
  keelY: number
  bottomHalfWidth: number
}

/**
 * Original, unitless teaching silhouette. The sparse stations communicate
 * bow/midship/stern relationships only and intentionally encode no vessel's
 * real lines, displacement or stability data.
 */
export const VESSEL_HULL_SECTIONS = [
  { x: -3.18, halfWidth: 0.6, deckY: 0.68, chineY: -0.18, keelY: -0.76, bottomHalfWidth: 0.24 },
  { x: -2.55, halfWidth: 0.86, deckY: 0.56, chineY: -0.25, keelY: -0.83, bottomHalfWidth: 0.35 },
  { x: -1.75, halfWidth: 1.08, deckY: 0.48, chineY: -0.28, keelY: -0.86, bottomHalfWidth: 0.43 },
  { x: -0.8, halfWidth: 1.16, deckY: 0.43, chineY: -0.3, keelY: -0.88, bottomHalfWidth: 0.47 },
  { x: 0.2, halfWidth: 1.18, deckY: 0.42, chineY: -0.3, keelY: -0.88, bottomHalfWidth: 0.47 },
  { x: 1.2, halfWidth: 1.13, deckY: 0.46, chineY: -0.27, keelY: -0.84, bottomHalfWidth: 0.43 },
  { x: 2.1, halfWidth: 0.91, deckY: 0.54, chineY: -0.2, keelY: -0.76, bottomHalfWidth: 0.33 },
  { x: 2.76, halfWidth: 0.53, deckY: 0.65, chineY: -0.1, keelY: -0.64, bottomHalfWidth: 0.18 },
  { x: 3.18, halfWidth: 0.14, deckY: 0.72, chineY: 0.02, keelY: -0.46, bottomHalfWidth: 0.05 },
] as const satisfies readonly VesselHullSectionSpec[]

export const VESSEL_PROPELLER_STATIONS = [
  { radial: 0.13, chord: 0.18, sweep: 0, thickness: 0.055, twist: -0.18 },
  { radial: 0.36, chord: 0.29, sweep: 0.045, thickness: 0.045, twist: 0.08 },
  { radial: 0.62, chord: 0.21, sweep: 0.105, thickness: 0.034, twist: 0.34 },
] as const satisfies readonly TwistedRadialStation[]

/** Original unitless x/z outline; it is not a real rescue-vessel deck plan. */
export const VESSEL_MAIN_DECK_PLANFORM = [
  [-2.68, 0.72],
  [1.55, 1.02],
  [2.35, 0.82],
  [2.72, 0.38],
  [2.78, 0],
  [2.72, -0.38],
  [2.35, -0.82],
  [1.55, -1.02],
  [-2.68, -0.72],
] as const

export const VESSEL_SUPERSTRUCTURE_LAYOUT = {
  wheelhouse: {
    position: [0.5, 1.3, 0],
    height: 0.52,
  },
  roof: {
    role: 'thin-roof-canopy',
    position: [0.5, 1.62, 0],
    height: 0.12,
  },
} as const

export const VESSEL_RUB_RAIL_TRANSFORMS = [
  { position: [-1.85, 0.31, 0.84], rotation: [0, -0.16, 0] },
  { position: [-0.15, 0.31, 1.02], rotation: [0, 0, 0] },
  { position: [1.55, 0.34, 0.84], rotation: [0, 0.22, 0] },
  { position: [-1.85, 0.31, -0.84], rotation: [0, 0.16, 0] },
  { position: [-0.15, 0.31, -1.02], rotation: [0, 0, 0] },
  { position: [1.55, 0.34, -0.84], rotation: [0, -0.22, 0] },
] as const

export type VesselGeometryKey =
  | 'hull'
  | 'mainDeck'
  | 'lowerCabin'
  | 'wheelhouseRoof'
  | 'windowPanel'
  | 'windowFrame'
  | 'rubRail'
  | 'fender'
  | 'buoyancyCompartment'
  | 'bulkhead'
  | 'engineBlock'
  | 'engineCap'
  | 'shaftBearing'
  | 'propellerHub'
  | 'propellerBlades'
  | 'rudderShaft'
  | 'rudderBlade'
  | 'bilgePump'
  | 'wheelhouse'
  | 'mast'
  | 'mastCrossbar'
  | 'mastLight'
  | 'workDeck'
  | 'hatchCoaming'
  | 'railPost'
  | 'railSide'
  | 'railCross'
  | 'survivorCabin'
  | 'survivorBench'
  | 'principlePulse'

export type VesselGeometryResources = Record<VesselGeometryKey, BufferGeometry>

export interface VesselGeometrySet extends VesselGeometryResources {
  readonly propellerStations: readonly TwistedRadialStation[]
}

interface VesselRenderBatch {
  id: string
  geometry?: VesselGeometryKey
  /** Actual WebGL submissions represented by this component batch. */
  drawCalls: number
  /** Geometry repetitions, including instanced details. */
  instances: number
  instanced?: true
}

/**
 * Kept beside the geometry factories and consumed by the budget report. Each
 * entry maps to a concrete mesh, line, or GeometryInstances batch in
 * VesselModel; it is not a hand-entered total.
 */
export const VESSEL_BASE_RENDER_BATCHES = [
  { id: 'hull-shell', geometry: 'hull', drawCalls: 1, instances: 1 },
  { id: 'main-deck', geometry: 'mainDeck', drawCalls: 1, instances: 1 },
  { id: 'lower-cabin', geometry: 'lowerCabin', drawCalls: 1, instances: 1 },
  { id: 'wheelhouse-roof', geometry: 'wheelhouseRoof', drawCalls: 1, instances: 1 },
  { id: 'front-windows', geometry: 'windowPanel', drawCalls: 1, instances: 3, instanced: true },
  { id: 'rub-rails', geometry: 'rubRail', drawCalls: 1, instances: 6, instanced: true },
  { id: 'fenders', geometry: 'fender', drawCalls: 1, instances: 6, instanced: true },
  { id: 'buoyancy-cells', geometry: 'buoyancyCompartment', drawCalls: 1, instances: 4, instanced: true },
  { id: 'bulkheads', geometry: 'bulkhead', drawCalls: 1, instances: 3, instanced: true },
  { id: 'engine-blocks', geometry: 'engineBlock', drawCalls: 1, instances: 2, instanced: true },
  { id: 'engine-caps', geometry: 'engineCap', drawCalls: 1, instances: 6, instanced: true },
  { id: 'shaft-lines', drawCalls: 1, instances: 2 },
  { id: 'shaft-bearings', geometry: 'shaftBearing', drawCalls: 1, instances: 2, instanced: true },
  { id: 'propeller-hubs', geometry: 'propellerHub', drawCalls: 2, instances: 2 },
  { id: 'propeller-blades', geometry: 'propellerBlades', drawCalls: 2, instances: 2 },
  { id: 'rudder-shafts', geometry: 'rudderShaft', drawCalls: 2, instances: 2 },
  { id: 'rudder-blades', geometry: 'rudderBlade', drawCalls: 2, instances: 2 },
  { id: 'bilge-pump', geometry: 'bilgePump', drawCalls: 1, instances: 1 },
  { id: 'bilge-line', drawCalls: 1, instances: 1 },
  { id: 'wheelhouse', geometry: 'wheelhouse', drawCalls: 1, instances: 1 },
  { id: 'window-frames', geometry: 'windowFrame', drawCalls: 1, instances: 3, instanced: true },
  { id: 'mast', geometry: 'mast', drawCalls: 1, instances: 1 },
  { id: 'mast-crossbar', geometry: 'mastCrossbar', drawCalls: 1, instances: 1 },
  { id: 'mast-lights', geometry: 'mastLight', drawCalls: 1, instances: 3, instanced: true },
  { id: 'work-deck', geometry: 'workDeck', drawCalls: 1, instances: 1 },
  { id: 'hatch-coaming', geometry: 'hatchCoaming', drawCalls: 1, instances: 1 },
  { id: 'rail-posts', geometry: 'railPost', drawCalls: 1, instances: 6, instanced: true },
  { id: 'side-rails', geometry: 'railSide', drawCalls: 2, instances: 2 },
  { id: 'cross-rail', geometry: 'railCross', drawCalls: 1, instances: 1 },
  { id: 'survivor-cabin', geometry: 'survivorCabin', drawCalls: 1, instances: 1 },
  { id: 'survivor-benches', geometry: 'survivorBench', drawCalls: 1, instances: 2, instanced: true },
] as const satisfies readonly VesselRenderBatch[]

export const VESSEL_BASE_DRAW_CALL_BUDGET = 48
export const VESSEL_TRIANGLE_BUDGET = 18_000

function prepareGeometry<T extends BufferGeometry>(geometry: T) {
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function createVesselDetailFrameGeometry(
  width: number,
  height: number,
  bar: number,
  depth: number,
) {
  if (
    ![width, height, bar, depth].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    throw new Error('frame dimensions must be finite and positive')
  }
  if (bar * 2 >= Math.min(width, height)) {
    throw new Error('frame bars must leave an open center')
  }

  const parts = [
    new BoxGeometry(width, bar, depth).translate(0, (height - bar) / 2, 0),
    new BoxGeometry(width, bar, depth).translate(0, -(height - bar) / 2, 0),
    new BoxGeometry(bar, height - bar * 2, depth).translate((width - bar) / 2, 0, 0),
    new BoxGeometry(bar, height - bar * 2, depth).translate(-(width - bar) / 2, 0, 0),
  ]
  let frame: BufferGeometry | null = null
  try {
    frame = mergeGeometries(parts, false)
  } finally {
    parts.forEach((part) => part.dispose())
  }
  if (!frame) throw new Error('unable to create vessel detail frame')
  return prepareGeometry(frame)
}

function hullPoints(section: VesselHullSectionSpec) {
  return [
    [section.deckY, -section.halfWidth * 0.82],
    [section.chineY, -section.halfWidth],
    [section.keelY + 0.12, -section.bottomHalfWidth],
    [section.keelY, 0],
    [section.keelY + 0.12, section.bottomHalfWidth],
    [section.chineY, section.halfWidth],
    [section.deckY, section.halfWidth * 0.82],
    [section.deckY + 0.025, 0],
  ] as const
}

export function createVesselGeometrySet(): VesselGeometrySet {
  const resources: Partial<VesselGeometryResources> = {}

  try {
    resources.hull = createClosedLoftGeometry(
      VESSEL_HULL_SECTIONS.map((section) => ({
        x: section.x,
        points: hullPoints(section),
      })),
      { capEnds: true, creaseAngle: Math.PI / 5 },
    )
    resources.mainDeck = createExtrudedProfileGeometry(
      VESSEL_MAIN_DECK_PLANFORM,
      { depth: 0.14, bevelSize: 0.02 },
    )
    resources.mainDeck.rotateX(-Math.PI / 2)
    resources.mainDeck.computeBoundingBox()
    resources.mainDeck.computeBoundingSphere()
    resources.lowerCabin = createChamferedBoxGeometry({ width: 1.75, height: 0.8, depth: 1.48, bevelSize: 0.045, segments: 1 })
    resources.wheelhouseRoof = createChamferedBoxGeometry({ width: 1.25, height: VESSEL_SUPERSTRUCTURE_LAYOUT.roof.height, depth: 1.68, bevelSize: 0.02, segments: 1 })
    resources.windowPanel = createChamferedBoxGeometry({ width: 0.05, height: 0.22, depth: 0.32, bevelSize: 0.009, segments: 1 })
    resources.windowFrame = createVesselDetailFrameGeometry(0.38, 0.3, 0.04, 0.045)
    resources.rubRail = createChamferedBoxGeometry({ width: 1.75, height: 0.11, depth: 0.1, bevelSize: 0.018, segments: 1 })
    resources.fender = createChamferedBoxGeometry({ width: 0.1, height: 0.44, depth: 0.14, bevelSize: 0.018, segments: 1 })
    resources.buoyancyCompartment = createChamferedBoxGeometry({ width: 0.84, height: 0.72, depth: 1.72, bevelSize: 0.04, segments: 1 })
    resources.bulkhead = prepareGeometry(new BoxGeometry(0.045, 0.8, 1.92))
    resources.engineBlock = createChamferedBoxGeometry({ width: 1.05, height: 0.55, depth: 0.58, bevelSize: 0.04, segments: 1 })
    resources.engineCap = prepareGeometry(new CylinderGeometry(0.08, 0.08, 0.22, 12))
    resources.shaftBearing = prepareGeometry(new CylinderGeometry(0.08, 0.08, 0.36, 12))
    resources.propellerHub = createRevolvedProfileGeometry(
      [[-0.18, 0], [-0.13, 0.1], [0.1, 0.13], [0.18, 0]],
      { axis: 'x', segments: 14 },
    )
    resources.propellerBlades = createTwistedRadialAssembly(
      VESSEL_PROPELLER_STATIONS,
      3,
    )
    resources.rudderShaft = prepareGeometry(new CylinderGeometry(0.035, 0.035, 0.72, 9))
    resources.rudderBlade = createChamferedBoxGeometry({ width: 0.12, height: 0.72, depth: 0.42, bevelSize: 0.025, segments: 1 })
    resources.bilgePump = createChamferedBoxGeometry({ width: 0.54, height: 0.28, depth: 0.54, bevelSize: 0.03, segments: 1 })
    resources.wheelhouse = createChamferedBoxGeometry({ width: 1.1, height: 0.52, depth: 1.48, bevelSize: 0.035, segments: 1 })
    resources.mast = prepareGeometry(new CylinderGeometry(0.045, 0.065, 1.1, 10))
    resources.mastCrossbar = prepareGeometry(new CylinderGeometry(0.03, 0.03, 0.74, 8))
    resources.mastLight = prepareGeometry(new SphereGeometry(0.075, 10, 8))
    resources.workDeck = createChamferedBoxGeometry({ width: 2.05, height: 0.12, depth: 1.78, bevelSize: 0.025, segments: 1 })
    resources.hatchCoaming = createVesselDetailFrameGeometry(0.72, 0.52, 0.065, 0.09)
    resources.railPost = prepareGeometry(new CylinderGeometry(0.025, 0.025, 0.5, 8))
    resources.railSide = prepareGeometry(new CylinderGeometry(0.025, 0.025, 1.7, 8))
    resources.railCross = prepareGeometry(new CylinderGeometry(0.025, 0.025, 1.42, 8))
    resources.survivorCabin = createChamferedBoxGeometry({ width: 1.45, height: 0.56, depth: 1.4, bevelSize: 0.045, segments: 1 })
    resources.survivorBench = createChamferedBoxGeometry({ width: 1.08, height: 0.16, depth: 0.28, bevelSize: 0.025, segments: 1 })
    resources.principlePulse = prepareGeometry(new SphereGeometry(0.075, 10, 8))

    return {
      ...(resources as VesselGeometryResources),
      propellerStations: VESSEL_PROPELLER_STATIONS,
    }
  } catch (error) {
    Object.values(resources).forEach((geometry) => geometry?.dispose())
    throw error
  }
}

function triangleCount(geometry: BufferGeometry) {
  return (geometry.index?.count ?? geometry.getAttribute('position').count) / 3
}

export function getVesselGeometryBudgetReport(set: VesselGeometrySet) {
  const entries = Object.entries(set).filter(
    (entry): entry is [VesselGeometryKey, BufferGeometry] =>
      entry[1] instanceof BufferGeometry,
  )
  const geometryTriangles = entries.reduce(
    (total, [, geometry]) => total + triangleCount(geometry),
    0,
  )
  const usedKeys = new Set<VesselGeometryKey>()
  const repeatedTriangles = VESSEL_BASE_RENDER_BATCHES.reduce(
    (total, batch) => {
      if (!('geometry' in batch)) return total
      usedKeys.add(batch.geometry)
      return total + triangleCount(set[batch.geometry]) * batch.instances
    },
    0,
  )
  const unbatchedResourceTriangles = entries.reduce(
    (total, [key, geometry]) =>
      total + (usedKeys.has(key) ? 0 : triangleCount(geometry)),
    0,
  )

  return {
    geometryTriangles,
    renderedTriangles: repeatedTriangles + unbatchedResourceTriangles,
    baseDrawCalls: VESSEL_BASE_RENDER_BATCHES.reduce(
      (total, batch) => total + batch.drawCalls,
      0,
    ),
    instancedDetails: VESSEL_BASE_RENDER_BATCHES.reduce(
      (total, batch) =>
        total + ('instanced' in batch && batch.instanced ? batch.instances : 0),
      0,
    ),
  } as const
}

export function disposeVesselGeometrySet(set: VesselGeometrySet) {
  Object.values(set).forEach((resource) => {
    if (resource instanceof BufferGeometry) resource.dispose()
  })
}
