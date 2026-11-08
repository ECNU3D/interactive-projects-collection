import { useThree } from '@react-three/fiber'
import {
  type DependencyList,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import type { Group, MeshStandardMaterial, Object3D } from 'three'
import { m4Parts } from '../content/m4'
import type { PartDefinition, PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  ENGINE_CENTER,
  TANK_MODEL_POSITION,
  TANK_MODEL_SCALE,
} from './cameraControls'
import {
  GeometryInstances,
  type GeometryInstanceTransform,
} from './GeometryInstances'
import { PrincipleMotion } from './PrincipleMotion'
import { getSceneBudgetReport, type SceneBudgetReport } from './sceneBudget'
import {
  createTankGeometrySet,
  disposeTankGeometrySet,
  TANK_GEOMETRY_BUDGET,
  TANK_ROAD_WHEEL_X,
  type TankGeometrySet,
} from './TankGeometry'
import { TankPart } from './TankPart'
import { useOwnedResource } from './useOwnedResource'

export { ENGINE_CENTER } from './cameraControls'
export { TANK_ROAD_WHEEL_X } from './TankGeometry'

export interface TankModelProps {
  stepIndex: number
  mode: ExploreMode
  selectedPartId: PartId | null
  autoplay: boolean
  reducedMotion: boolean
  onSelect: (partId: PartId) => void
}

export const PROCEDURAL_PART_IDS = [
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

const PARTS_BY_ID = Object.fromEntries(
  m4Parts.map((part) => [part.id, part]),
) as Record<PartId, PartDefinition>

const BOGIE_X = [-1.42, 0, 1.42] as const
const DRIVE_X = 2.28
const IDLER_X = -2.28
const RUNNING_GEAR_Y = 0.62
const RUNNING_GEAR_SIDE_Z = 1.4
/** Original unitless clearance radius; it is not a real track-pitch fit. */
const TRACK_CENTERLINE_RADIUS = 0.68
const TRACK_STRAIGHT_LENGTH = DRIVE_X - IDLER_X
const TRACK_ARC_LENGTH = Math.PI * TRACK_CENTERLINE_RADIUS
const TRACK_PATH_LENGTH = TRACK_STRAIGHT_LENGTH * 2 + TRACK_ARC_LENGTH * 2

export const ENGINE_HUB_LOCAL_POSITION: [number, number, number] = [0, 0, 0]
export const RECOIL_RING_ROTATION = [0, Math.PI / 2, 0] as const

function sampleTrackPath(pathDistance: number) {
  if (pathDistance < TRACK_STRAIGHT_LENGTH) {
    return {
      x: IDLER_X + pathDistance,
      y: RUNNING_GEAR_Y + TRACK_CENTERLINE_RADIUS,
      rotationZ: 0,
    }
  }

  const afterTop = pathDistance - TRACK_STRAIGHT_LENGTH
  if (afterTop < TRACK_ARC_LENGTH) {
    const angle = Math.PI / 2 - afterTop / TRACK_CENTERLINE_RADIUS
    return {
      x: DRIVE_X + Math.cos(angle) * TRACK_CENTERLINE_RADIUS,
      y: RUNNING_GEAR_Y + Math.sin(angle) * TRACK_CENTERLINE_RADIUS,
      rotationZ: angle - Math.PI / 2,
    }
  }

  const afterDrive = afterTop - TRACK_ARC_LENGTH
  if (afterDrive < TRACK_STRAIGHT_LENGTH) {
    return {
      x: DRIVE_X - afterDrive,
      y: RUNNING_GEAR_Y - TRACK_CENTERLINE_RADIUS,
      rotationZ: Math.PI,
    }
  }

  const afterBottom = afterDrive - TRACK_STRAIGHT_LENGTH
  const angle = -Math.PI / 2 - afterBottom / TRACK_CENTERLINE_RADIUS
  return {
    x: IDLER_X + Math.cos(angle) * TRACK_CENTERLINE_RADIUS,
    y: RUNNING_GEAR_Y + Math.sin(angle) * TRACK_CENTERLINE_RADIUS,
    rotationZ: angle - Math.PI / 2,
  }
}

export function makeTrackTransforms(
  side: -1 | 1,
): readonly GeometryInstanceTransform[] {
  const linkCount = 44
  const sampleDistance = TRACK_PATH_LENGTH / linkCount

  return Array.from({ length: linkCount }, (_, index) => {
    const pathDistance = index * sampleDistance
    const sample = sampleTrackPath(pathDistance)

    return {
      position: [sample.x, sample.y, side * 1.55],
      rotation: [0, 0, sample.rotationZ],
    }
  })
}

export function makeSuspensionTransforms(side: -1 | 1) {
  const wheelRotation = [Math.PI / 2, 0, 0] as const
  const wheelPositions = TANK_ROAD_WHEEL_X.map(
    (x) => [x, 0.55, side * 1.39] as const,
  )
  const returnRollerPositions = BOGIE_X.map(
    (x) => [x, 1.24, side * 1.39] as const,
  )
  const drive = {
    position: [DRIVE_X, RUNNING_GEAR_Y, side * RUNNING_GEAR_SIDE_Z] as const,
  }
  const idler = {
    position: [IDLER_X, RUNNING_GEAR_Y, side * RUNNING_GEAR_SIDE_Z] as const,
  }

  return {
    wheels: wheelPositions.map((position) => ({
      position,
      rotation: wheelRotation,
    })),
    wheelRims: wheelPositions.map((position) => ({ position })),
    returnRollers: returnRollerPositions.map((position) => ({ position })),
    housings: BOGIE_X.map((x) => ({
      position: [x, 1.02, side * 1.29] as const,
    })),
    springs: BOGIE_X.map((x) => ({
      position: [x, 1.18, side * 1.46] as const,
      rotation: [0, 0, Math.PI / 2] as const,
    })),
    drive,
    idler,
    idlerSpokes: Array.from({ length: 6 }, (_, index) => {
      const angle = (index / 6) * Math.PI * 2
      return {
        position: [
          IDLER_X + Math.cos(angle) * 0.18,
          RUNNING_GEAR_Y + Math.sin(angle) * 0.18,
          side * (RUNNING_GEAR_SIDE_Z + 0.1),
        ] as const,
        rotation: [0, 0, angle] as const,
      }
    }),
  }
}

export function makeEngineCylinderLocalTransforms(): readonly GeometryInstanceTransform[] {
  return Array.from({ length: 9 }, (_, index) => {
    const angle = (index / 9) * Math.PI * 2

    return {
      position: [0, Math.cos(angle) * 0.57, Math.sin(angle) * 0.57],
      rotation: [angle, 0, 0],
    }
  })
}

const HULL_BOLTS: readonly GeometryInstanceTransform[] = [
  ...[-1.85, -1.22, -0.58, 0.06, 0.7, 1.34, 1.98].flatMap((x) => [
    { position: [x, 1.29, 1.29] as const },
    { position: [x, 1.29, -1.29] as const },
  ]),
  ...[-1.32, -0.66, 0, 0.66, 1.32].map((z) => ({
    position: [1.88, 1.35, z] as const,
  })),
]

const PERISCOPE_TRANSFORMS: readonly GeometryInstanceTransform[] = [
  { position: [0.08, 2.72, 0.5], rotation: [0, 0.18, 0] },
  { position: [0.52, 2.76, -0.16], rotation: [0, -0.08, 0] },
  { position: [0.28, 2.7, -0.55], rotation: [0, -0.28, 0] },
]

const SIGHT_LINE_TRANSFORMS = [
  { position: [0.82, 2.77, 0.5], rotation: [0, 0.12, 0] },
  { position: [1.18, 2.79, -0.16], rotation: [0, -0.04, 0] },
  { position: [0.86, 2.74, -0.55], rotation: [0, -0.25, 0] },
] as const satisfies readonly GeometryInstanceTransform[]

const TRANSMISSION_BAND_TRANSFORMS = [-0.78, 0.2, 1.18].map((x) => ({
  position: [x, 0.73, 0] as const,
  rotation: [0, Math.PI / 2, 0] as const,
}))

export function getTankSceneBudgetReport(root: Object3D): SceneBudgetReport {
  return getSceneBudgetReport(root, {
    drawCalls: TANK_GEOMETRY_BUDGET.baseDrawCalls,
    triangles: TANK_GEOMETRY_BUDGET.triangles,
  })
}

export type TankGeometryFactory = () => TankGeometrySet
export type TankGeometryDisposer = (set: TankGeometrySet) => void

export function useTankGeometrySet(
  factory: TankGeometryFactory = createTankGeometrySet,
  disposer: TankGeometryDisposer = disposeTankGeometrySet,
) {
  return useOwnedResource(factory, disposer)
}

export function useTankRenderBudgetProbe(
  rootRef: RefObject<Group | null>,
  dependencies: DependencyList,
  canvas?: HTMLCanvasElement,
  enabled = true,
) {
  useLayoutEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    if (!root) return

    const report = getTankSceneBudgetReport(root)
    root.userData.renderBudget = report
    if (canvas) {
      canvas.dataset.tankDrawCalls = String(report.baseDrawCalls)
      canvas.dataset.tankRenderedTriangles = String(report.renderedTriangles)
      canvas.dataset.tankInstancedDetails = String(report.instancedDetails)
      canvas.dataset.tankRenderBudget = report.withinBudget ? 'pass' : 'fail'
    }
  }, [canvas, enabled, rootRef, ...dependencies])
}

interface PartProps extends TankModelProps {
  id: PartId
  children: (material: MeshStandardMaterial) => ReactNode
}

function Part({
  id,
  children,
  stepIndex,
  mode,
  selectedPartId,
  reducedMotion,
  onSelect,
}: PartProps) {
  return (
    <TankPart
      definition={PARTS_BY_ID[id]}
      stepIndex={stepIndex}
      mode={mode}
      selected={selectedPartId === id}
      reducedMotion={reducedMotion}
      onSelect={onSelect}
    >
      {children}
    </TankPart>
  )
}

interface GeometryPartProps {
  material: MeshStandardMaterial
  geometries: TankGeometrySet
}

function HullShell({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh
        geometry={geometries.hull}
        material={material}
        castShadow
        receiveShadow
      />
      <GeometryInstances
        geometry={geometries.hullBolt}
        material={material}
        transforms={HULL_BOLTS}
      />
    </>
  )
}

function TurretShell({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh
        geometry={geometries.turret}
        position={[0.38, 2.08, 0]}
        material={material}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={geometries.turretRing}
        position={[0.38, 1.76, 0]}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.gunMantlet}
        position={[1.35, 2.15, 0]}
        rotation={[0, 0, Math.PI / 2]}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.exteriorBarrel}
        position={[2.45, 2.18, 0]}
        rotation={[0, 0, Math.PI / 2]}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.commanderHatch}
        position={[0.12, 2.68, 0.32]}
        material={material}
        castShadow
      />
    </>
  )
}

function EngineModule({ material, geometries }: GeometryPartProps) {
  const cylinders = useMemo(() => makeEngineCylinderLocalTransforms(), [])

  return (
    <>
      <GeometryInstances
        geometry={geometries.engineCylinder}
        material={material}
        transforms={cylinders}
      />
      <mesh
        geometry={geometries.engineHub}
        position={ENGINE_HUB_LOCAL_POSITION}
        rotation={[0, 0, Math.PI / 2]}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.engineBand}
        position={[0.31, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={material}
        castShadow
      />
    </>
  )
}

function TransmissionPath({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh
        geometry={geometries.transmissionShaft}
        position={[0.18, 0.73, 0]}
        rotation={[0, 0, Math.PI / 2]}
        material={material}
        castShadow
      />
      <GeometryInstances
        geometry={geometries.transmissionBand}
        material={material}
        transforms={TRANSMISSION_BAND_TRANSFORMS}
      />
      <mesh
        geometry={geometries.transmissionHousing}
        position={[1.74, 0.76, 0]}
        rotation={[0, 0, Math.PI / 2]}
        material={material}
        castShadow
      />
    </>
  )
}

interface SuspensionProps extends GeometryPartProps {
  side: -1 | 1
}

function Suspension({ side, material, geometries }: SuspensionProps) {
  const transforms = useMemo(() => makeSuspensionTransforms(side), [side])

  return (
    <>
      <GeometryInstances
        geometry={geometries.roadWheelRim}
        material={material}
        transforms={transforms.wheelRims}
      />
      <GeometryInstances
        geometry={geometries.roadWheelHub}
        material={material}
        transforms={transforms.wheels}
      />
      <GeometryInstances
        geometry={geometries.returnRollerRim}
        material={material}
        transforms={transforms.returnRollers}
      />
      <GeometryInstances
        geometry={geometries.bogieHousing}
        material={material}
        transforms={transforms.housings}
      />
      <GeometryInstances
        geometry={geometries.springHousing}
        material={material}
        transforms={transforms.springs}
      />
      <mesh
        geometry={geometries.supportBeam}
        position={[0, 0.78, side * 1.3]}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.driveToothRing}
        position={transforms.drive.position}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.driveHub}
        position={transforms.drive.position}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.idlerRim}
        position={transforms.idler.position}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.idlerHub}
        position={transforms.idler.position}
        material={material}
        castShadow
      />
      <GeometryInstances
        geometry={geometries.idlerSpoke}
        material={material}
        transforms={transforms.idlerSpokes}
      />
    </>
  )
}

function Track({ side, material, geometries }: SuspensionProps) {
  const transforms = useMemo(() => makeTrackTransforms(side), [side])
  return (
    <GeometryInstances
      geometry={geometries.trackLink}
      material={material}
      transforms={transforms}
    />
  )
}

function CrewSpace({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh
        geometry={geometries.crewCompartment}
        position={[0.35, 1.35, 0]}
        material={material}
        renderOrder={1}
      />
      <mesh
        geometry={geometries.crewTurretSpace}
        position={[0.38, 2.05, 0]}
        material={material}
        renderOrder={1}
      />
      <mesh
        geometry={geometries.crewBulkhead}
        position={[-0.35, 1.12, 0]}
        material={material}
        renderOrder={1}
      />
    </>
  )
}

function ObservationSystem({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <GeometryInstances
        geometry={geometries.periscope}
        material={material}
        transforms={PERISCOPE_TRANSFORMS}
      />
      {SIGHT_LINE_TRANSFORMS.map((transform) => (
        <mesh
          key={transform.position.join(':')}
          geometry={geometries.sightLine}
          position={transform.position}
          rotation={transform.rotation}
          material={material}
          raycast={() => undefined}
        />
      ))}
    </>
  )
}

function RecoilConcept({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh
        geometry={geometries.recoilOuter}
        position={[0.91, 2.13, 0.32]}
        rotation={[0, 0, Math.PI / 2]}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.recoilInner}
        position={[1.11, 2.13, 0.32]}
        rotation={[0, 0, Math.PI / 2]}
        material={material}
        castShadow
      />
      <mesh
        geometry={geometries.recoilRing}
        position={[0.42, 2.13, 0.32]}
        rotation={RECOIL_RING_ROTATION}
        material={material}
        castShadow
      />
    </>
  )
}

export function TankModel(props: TankModelProps) {
  const geometries = useTankGeometrySet()
  const modelRef = useRef<Group>(null)
  const canvas = useThree((state) => state.gl.domElement)
  useTankRenderBudgetProbe(
    modelRef,
    [
      geometries,
      props.autoplay,
      props.mode,
      props.reducedMotion,
      props.selectedPartId,
      props.stepIndex,
    ],
    canvas,
    geometries !== null,
  )
  const principleMotion = {
    mode: props.mode,
    autoplay: props.autoplay,
    reducedMotion: props.reducedMotion,
  }

  if (!geometries) {
    return (
      <group
        ref={modelRef}
        name="procedural-m4-study"
        position={TANK_MODEL_POSITION}
        scale={TANK_MODEL_SCALE}
        userData={{
          exhibitKind: 'tracked-vehicle-teaching-composite',
          accuracy: 'educational-system-relationships-only',
        }}
      />
    )
  }

  return (
    <group
      ref={modelRef}
      name="procedural-m4-study"
      position={TANK_MODEL_POSITION}
      scale={TANK_MODEL_SCALE}
      userData={{
        exhibitKind: 'tracked-vehicle-teaching-composite',
        accuracy: 'educational-system-relationships-only',
      }}
    >
      <Part {...props} id="hull-shell">
        {(material) => (
          <HullShell material={material} geometries={geometries} />
        )}
      </Part>
      <Part {...props} id="turret-shell">
        {(material) => (
          <TurretShell material={material} geometries={geometries} />
        )}
      </Part>
      <Part {...props} id="engine-module">
        {(material) => (
          <group position={ENGINE_CENTER}>
            <PrincipleMotion kind="engine" {...principleMotion}>
              <EngineModule material={material} geometries={geometries} />
            </PrincipleMotion>
          </group>
        )}
      </Part>
      <Part {...props} id="transmission-path">
        {(material) => (
          <PrincipleMotion kind="transmission" {...principleMotion}>
            <TransmissionPath material={material} geometries={geometries} />
          </PrincipleMotion>
        )}
      </Part>
      <Part {...props} id="suspension-left">
        {(material) => (
          <PrincipleMotion kind="suspension-left" {...principleMotion}>
            <Suspension side={1} material={material} geometries={geometries} />
          </PrincipleMotion>
        )}
      </Part>
      <Part {...props} id="suspension-right">
        {(material) => (
          <PrincipleMotion kind="suspension-right" {...principleMotion}>
            <Suspension side={-1} material={material} geometries={geometries} />
          </PrincipleMotion>
        )}
      </Part>
      <Part {...props} id="track-left">
        {(material) => (
          <Track side={1} material={material} geometries={geometries} />
        )}
      </Part>
      <Part {...props} id="track-right">
        {(material) => (
          <Track side={-1} material={material} geometries={geometries} />
        )}
      </Part>
      <Part {...props} id="crew-space">
        {(material) => (
          <CrewSpace material={material} geometries={geometries} />
        )}
      </Part>
      <Part {...props} id="observation-system">
        {(material) => (
          <ObservationSystem material={material} geometries={geometries} />
        )}
      </Part>
      <Part {...props} id="recoil-concept">
        {(material) => (
          <PrincipleMotion kind="recoil" {...principleMotion}>
            <RecoilConcept material={material} geometries={geometries} />
          </PrincipleMotion>
        )}
      </Part>
    </group>
  )
}
