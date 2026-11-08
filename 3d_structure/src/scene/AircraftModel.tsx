import { Line as FlowLine } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  type DependencyList,
  type RefObject,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { x57Parts } from '../content/x57'
import type { PartDefinition, X57PartId } from '../content/types'
import type { ExploreMode } from '../experience/state'
import {
  AIRCRAFT_GEAR_CONTACTS,
  AIRCRAFT_GEOMETRY_BUDGET,
  AIRCRAFT_SURFACE_LAYOUT,
  createAircraftGeometrySet,
  disposeAircraftGeometrySet,
  type AircraftGeometrySet,
} from './AircraftGeometry'
import { AircraftPart } from './AircraftPart'
import { GeometryInstances, type GeometryInstanceTransform } from './GeometryInstances'
import { getSceneBudgetReport, type SceneBudgetReport } from './sceneBudget'
import { createTeachingGlowMaterial } from './teachingGlow'
import { useOwnedResource } from './useOwnedResource'

type Vector3Tuple = readonly [number, number, number]

export const AIRCRAFT_PROCEDURAL_PART_IDS = [
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

const HIGH_LIFT_SPAN_POSITIONS = [0.82, 1.44, 2.06, 2.68, 3.3, 3.92] as const

export const AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS = HIGH_LIFT_SPAN_POSITIONS.flatMap(
  (z) => [
    [0.63, 0.45, z] as const,
    [0.63, 0.45, -z] as const,
  ],
)

export const AIRCRAFT_WINGTIP_MOTOR_POSITIONS = [
  [0.18, 0.43, 4.72],
  [0.18, 0.43, -4.72],
] as const satisfies readonly Vector3Tuple[]

export const AIRCRAFT_FOCUS_POINTS = {
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
} as const satisfies Record<X57PartId, Vector3Tuple>

export const AIRCRAFT_MODEL_POSITION: Vector3Tuple = [0, -0.14, 0]
export const AIRCRAFT_MODEL_SCALE = 0.92

export const AIRCRAFT_TEACHING_GLOW_MATERIALS = {
  energyPulse: createTeachingGlowMaterial('#f0c77c', 3.4),
  coolingLoop: createTeachingGlowMaterial('#72c0b3', 4.8),
} as const

const PARTS_BY_ID = Object.fromEntries(
  x57Parts.map((part) => [part.id, part]),
) as Record<X57PartId, PartDefinition<X57PartId>>

export interface AircraftModelProps {
  stepIndex: number
  mode: ExploreMode
  selectedPartId: X57PartId | null
  autoplay: boolean
  reducedMotion: boolean
  onSelect: (partId: X57PartId) => void
}

export function getAircraftSceneBudgetReport(root: Group): SceneBudgetReport {
  const principleVisible = root.getObjectByName('aircraft-principle-flow')?.visible
  return getSceneBudgetReport(root, {
    drawCalls: principleVisible
      ? AIRCRAFT_GEOMETRY_BUDGET.principleDrawCalls
      : AIRCRAFT_GEOMETRY_BUDGET.baseDrawCalls,
    triangles: AIRCRAFT_GEOMETRY_BUDGET.triangles,
  })
}

export type AircraftGeometryFactory = () => AircraftGeometrySet
export type AircraftGeometryDisposer = (set: AircraftGeometrySet) => void

export function useAircraftGeometrySet(
  factory: AircraftGeometryFactory = createAircraftGeometrySet,
  disposer: AircraftGeometryDisposer = disposeAircraftGeometrySet,
) {
  return useOwnedResource(factory, disposer)
}

export function useAircraftRenderBudgetProbe(
  rootRef: RefObject<Group | null>,
  dependencies: DependencyList,
  canvas?: HTMLCanvasElement,
  enabled = true,
) {
  useLayoutEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    if (!root) return

    const report = getAircraftSceneBudgetReport(root)
    root.userData.renderBudget = report
    if (canvas) {
      canvas.dataset.aircraftDrawCalls = String(report.baseDrawCalls)
      canvas.dataset.aircraftRenderedTriangles = String(report.renderedTriangles)
      canvas.dataset.aircraftInstancedDetails = String(report.instancedDetails)
      canvas.dataset.aircraftRenderBudget = report.withinBudget ? 'pass' : 'fail'
    }
  }, [canvas, enabled, rootRef, ...dependencies])
}

interface PartProps extends AircraftModelProps {
  id: X57PartId
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
    <AircraftPart
      definition={PARTS_BY_ID[id]}
      stepIndex={stepIndex}
      mode={mode}
      selected={selectedPartId === id}
      reducedMotion={reducedMotion}
      onSelect={onSelect}
    >
      {children}
    </AircraftPart>
  )
}

interface RotorMotionProps {
  active: boolean
  reducedMotion: boolean
  children: ReactNode
  phase?: number
}

function RotorMotion({
  active,
  reducedMotion,
  children,
  phase = 0,
}: RotorMotionProps) {
  const groupRef = useRef<Group>(null)

  useLayoutEffect(() => {
    if (groupRef.current && reducedMotion) {
      groupRef.current.rotation.x = phase
    }
  }, [phase, reducedMotion])

  useFrame((_, delta) => {
    if (!groupRef.current || !active || reducedMotion) return
    groupRef.current.rotation.x += delta * 2.2
  })

  return <group ref={groupRef}>{children}</group>
}

function RotorBlades({
  position,
  material,
  geometry,
  active,
  reducedMotion,
  rotorOffset,
  phase = 0,
}: {
  position: Vector3Tuple
  material: MeshStandardMaterial
  geometry: AircraftGeometrySet['highLiftRotor']
  active: boolean
  reducedMotion: boolean
  rotorOffset: number
  phase?: number
}) {
  return (
    <group position={position}>
      <RotorMotion active={active} reducedMotion={reducedMotion} phase={phase}>
        <mesh
          geometry={geometry}
          position={[rotorOffset, 0, 0]}
          material={material}
          castShadow
        />
      </RotorMotion>
    </group>
  )
}

interface GeometryPartProps {
  material: MeshStandardMaterial
  geometries: AircraftGeometrySet
}

const CANOPY_WINDOW_TRANSFORMS = [-0.29, 0.29].map((z) => ({
  position: [0.95, 0.57, z],
  rotation: [0, 0, -0.08] as const,
})) satisfies GeometryInstanceTransform[]

const WING_TIP_TRANSFORMS = [-4.48, 4.48].map((z) => ({
  position: [-0.08, 0.59, z],
  rotation: [z > 0 ? -0.035 : 0.035, z > 0 ? 0.08 : -0.08, 0] as const,
})) satisfies GeometryInstanceTransform[]

const GEAR_STRUT_TRANSFORMS = AIRCRAFT_GEAR_CONTACTS.map(
  ([x, y, z], index) => ({
    position: [x, y + 0.31, z],
    rotation: [0, 0, index === 0 ? 0.08 : z > 0 ? -0.22 : 0.22],
  }),
) satisfies GeometryInstanceTransform[]

const GEAR_FORK_TRANSFORMS = AIRCRAFT_GEAR_CONTACTS.map(([x, y, z]) => ({
  position: [x, y, z],
})) satisfies GeometryInstanceTransform[]

const GEAR_WHEEL_TRANSFORMS = AIRCRAFT_GEAR_CONTACTS.map(([x, y, z]) => ({
  position: [x, y, z],
})) satisfies GeometryInstanceTransform[]

const GEAR_HUB_TRANSFORMS = AIRCRAFT_GEAR_CONTACTS.map(([x, y, z]) => ({
  position: [x, y, z],
  rotation: [Math.PI / 2, 0, 0] as const,
})) satisfies GeometryInstanceTransform[]

export const HIGH_LIFT_NACELLE_TRANSFORMS = AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS.map(
  (position) => ({ position }),
) satisfies GeometryInstanceTransform[]

const WINGTIP_NACELLE_TRANSFORMS = AIRCRAFT_WINGTIP_MOTOR_POSITIONS.map(
  (position) => ({ position }),
) satisfies GeometryInstanceTransform[]

const BATTERY_TRANSFORMS = [-0.22, 0.22].map((z) => ({
  position: [-0.38, 0.02, z],
})) satisfies GeometryInstanceTransform[]

const BATTERY_CONNECTOR_TRANSFORMS = [-0.8, -0.34, 0.12].flatMap((x) =>
  [-0.22, 0.22].map((z) => ({
    position: [x, 0.2, z],
    rotation: [Math.PI / 2, 0, 0] as const,
  })),
) satisfies GeometryInstanceTransform[]

const POWER_BUS_LONG_TRANSFORMS = [-0.12, 0.12].map((y) => ({
  position: [0.04, 0.26 + y, 0],
})) satisfies GeometryInstanceTransform[]

const POWER_BUS_SPAN_TRANSFORMS = [-0.12, 0.12].map((y, index) => ({
  position: [0.52, 0.34 + y, index === 0 ? 2.25 : -2.25],
})) satisfies GeometryInstanceTransform[]

const INVERTER_TRANSFORMS = [-1.55, -0.52, 0.52, 1.55].map((z) => ({
  position: [0.38, 0.21, z],
})) satisfies GeometryInstanceTransform[]

const COCKPIT_INDICATOR_TRANSFORMS = [-0.13, 0, 0.13].flatMap((z) =>
  [0.01, 0.11].map((y) => ({ position: [1.31, 0.39 + y, z] })),
) satisfies GeometryInstanceTransform[]

const COOLING_FIN_TRANSFORMS = [-1.55, -0.52, 0.52, 1.55].flatMap((z) =>
  [-0.12, 0, 0.12].map((offset) => ({
    position: [0.39 + offset, 0.43, z],
  })),
) satisfies GeometryInstanceTransform[]

function AirframeCabin({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.fuselage} position={[0, 0.08, 0]} material={material} castShadow receiveShadow />
      <mesh geometry={geometries.canopy} position={[0.9, 0.48, 0]} rotation={[0, 0, -0.08]} material={material} castShadow />
      <GeometryInstances geometry={geometries.canopyWindow} material={material} transforms={CANOPY_WINDOW_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function HighAspectWing({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.mainWing} position={[AIRCRAFT_SURFACE_LAYOUT.mainWingX, 0.45, 0]} material={material} castShadow receiveShadow />
      <GeometryInstances geometry={geometries.wingTip} material={material} transforms={WING_TIP_TRANSFORMS} />
      <mesh geometry={geometries.wingSpar} position={[-0.24, 0.39, 0]} material={material} />
    </>
  )
}

function TailControlSurfaces({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.horizontalTail} position={[AIRCRAFT_SURFACE_LAYOUT.horizontalTailX, 0.42, 0]} material={material} castShadow />
      <mesh geometry={geometries.verticalTail} position={[AIRCRAFT_SURFACE_LAYOUT.verticalTailX, 0.46, -0.05]} material={material} castShadow />
      <mesh geometry={geometries.tailTrim} position={[-2.73, 0.42, 0]} material={material} />
    </>
  )
}

function LandingGear({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <GeometryInstances geometry={geometries.gearStrut} material={material} transforms={GEAR_STRUT_TRANSFORMS} />
      <GeometryInstances geometry={geometries.gearFork} material={material} transforms={GEAR_FORK_TRANSFORMS} />
      <GeometryInstances geometry={geometries.gearTire} material={material} transforms={GEAR_WHEEL_TRANSFORMS} />
      <GeometryInstances geometry={geometries.gearHub} material={material} transforms={GEAR_HUB_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function BatteryModules({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <GeometryInstances geometry={geometries.batteryModule} material={material} transforms={BATTERY_TRANSFORMS} />
      <GeometryInstances geometry={geometries.batteryConnector} material={material} transforms={BATTERY_CONNECTOR_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function PowerBus({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <GeometryInstances geometry={geometries.powerBusLong} material={material} transforms={POWER_BUS_LONG_TRANSFORMS} castShadow={false} receiveShadow={false} />
      <GeometryInstances geometry={geometries.powerBusSpan} material={material} transforms={POWER_BUS_SPAN_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function InverterControllers({ material, geometries }: GeometryPartProps) {
  return <GeometryInstances geometry={geometries.inverter} material={material} transforms={INVERTER_TRANSFORMS} />
}

function CockpitMonitoring({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.cockpitUnit} position={[1.08, 0.39, 0]} rotation={[0, 0, -0.18]} material={material} />
      <GeometryInstances geometry={geometries.cockpitIndicator} material={material} transforms={COCKPIT_INDICATOR_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function PassiveCoolingPath({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <GeometryInstances geometry={geometries.coolingFin} material={material} transforms={COOLING_FIN_TRANSFORMS} castShadow={false} receiveShadow={false} />
      {[-1.55, -0.52, 0.52, 1.55].map((z) => (
        <mesh key={z} geometry={geometries.coolingLoop} position={[0.08, 0.68, z]} rotation={[0, 0, Math.PI / 2]} material={material} />
      ))}
    </>
  )
}

export interface AircraftPrincipleFlowPath {
  stage: 'battery-bus' | 'bus-controller' | 'controller-motor'
  start: Vector3Tuple
  end: Vector3Tuple
}

const CONTROLLER_POSITIONS = [-1.55, -0.52, 0.52, 1.55].map(
  (z) => [0.38, 0.3, z] as const,
)

export const AIRCRAFT_PRINCIPLE_FLOW_PATHS = [
  {
    stage: 'battery-bus',
    start: [-0.65, 0.15, 0.22],
    end: [0.05, 0.34, 0.12],
  },
  {
    stage: 'battery-bus',
    start: [-0.65, 0.15, -0.22],
    end: [0.05, 0.22, -0.12],
  },
  ...CONTROLLER_POSITIONS.map((position) => ({
    stage: 'bus-controller' as const,
    start: [0.05, position[2] > 0 ? 0.34 : 0.22, position[2] > 0 ? 0.12 : -0.12] as const,
    end: position,
  })),
  ...AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS.map((position) => ({
    stage: 'controller-motor' as const,
    start: [
      0.38,
      0.3,
      Math.sign(position[2]) * (Math.abs(position[2]) > 2.2 ? 1.55 : 0.52),
    ] as const,
    end: position,
  })),
  ...AIRCRAFT_WINGTIP_MOTOR_POSITIONS.map((position) => ({
    stage: 'controller-motor' as const,
    start: [0.38, 0.3, Math.sign(position[2]) * 1.55] as const,
    end: position,
  })),
] as const satisfies readonly AircraftPrincipleFlowPath[]

export function isAircraftPrincipleActive(
  mode: ExploreMode,
  autoplay: boolean,
  reducedMotion: boolean,
) {
  return mode === 'principle' && autoplay && !reducedMotion
}

function AircraftPrincipleFlow({
  mode,
  autoplay,
  reducedMotion,
  geometries,
}: Pick<AircraftModelProps, 'mode' | 'autoplay' | 'reducedMotion'> & {
  geometries: AircraftGeometrySet
}) {
  const pulseRefs = useRef<(Mesh | null)[]>([])
  const coolingRef = useRef<Group>(null)
  const elapsedRef = useRef(0)
  const visible = mode === 'principle'
  const active = isAircraftPrincipleActive(mode, autoplay, reducedMotion)

  useLayoutEffect(() => {
    elapsedRef.current = 0
    AIRCRAFT_PRINCIPLE_FLOW_PATHS.forEach((path, index) => {
      pulseRefs.current[index]?.position.set(
        path.start[0],
        path.start[1],
        path.start[2],
      )
    })
    if (coolingRef.current) coolingRef.current.position.y = 0
  }, [mode, reducedMotion])

  useFrame((_, delta) => {
    if (!active) return
    elapsedRef.current += delta

    AIRCRAFT_PRINCIPLE_FLOW_PATHS.forEach((path, index) => {
      const pulse = pulseRefs.current[index]
      if (!pulse) return
      const progress = (elapsedRef.current * 0.34 + index * 0.13) % 1
      pulse.position.set(
        MathUtils.lerp(path.start[0], path.end[0], progress),
        MathUtils.lerp(path.start[1], path.end[1], progress),
        MathUtils.lerp(path.start[2], path.end[2], progress),
      )
    })

    if (coolingRef.current) {
      coolingRef.current.position.y = Math.sin(elapsedRef.current * 1.2) * 0.045
    }
  })

  return (
    <group name="aircraft-principle-flow" visible={visible}>
      {AIRCRAFT_PRINCIPLE_FLOW_PATHS.map((path, index) => {
        return (
          <group key={index}>
            <FlowLine
              points={[path.start, path.end]}
              color="#d98555"
              lineWidth={1.1}
              transparent
              opacity={0.34}
            />
            <mesh
              geometry={geometries.principlePulse}
              ref={(mesh) => {
                pulseRefs.current[index] = mesh
              }}
            >
              <meshBasicMaterial
                {...AIRCRAFT_TEACHING_GLOW_MATERIALS.energyPulse}
                transparent
                opacity={0.92}
              />
            </mesh>
          </group>
        )
      })}
      <group ref={coolingRef}>
        {[-1.55, -0.52, 0.52, 1.55].map((z) => (
          <mesh key={z} geometry={geometries.coolingLoop} position={[0.12, 0.78, z]} rotation={[0, 0, Math.PI / 2]}>
            <meshBasicMaterial
              {...AIRCRAFT_TEACHING_GLOW_MATERIALS.coolingLoop}
              transparent
              opacity={0.58}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function AircraftModel(props: AircraftModelProps) {
  const rotorsActive =
    props.mode === 'principle' && props.autoplay && !props.reducedMotion
  const geometries = useAircraftGeometrySet()
  const modelRef = useRef<Group>(null)
  const canvas = useThree((state) => state.gl.domElement)
  useAircraftRenderBudgetProbe(
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

  if (!geometries) {
    return (
      <group
        ref={modelRef}
        name="electric-aircraft-teaching-composite"
        position={AIRCRAFT_MODEL_POSITION}
        scale={AIRCRAFT_MODEL_SCALE}
        userData={{
          exhibitKind: 'electric-aircraft-teaching-composite',
          accuracy: 'educational-system-relationships-only',
        }}
      />
    )
  }

  return (
    <group
      ref={modelRef}
      name="electric-aircraft-teaching-composite"
      position={AIRCRAFT_MODEL_POSITION}
      scale={AIRCRAFT_MODEL_SCALE}
      userData={{
        exhibitKind: 'electric-aircraft-teaching-composite',
        accuracy: 'educational-system-relationships-only',
      }}
    >
      <Part {...props} id="airframe-cabin">
        {(material) => <AirframeCabin material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="high-aspect-wing">
        {(material) => <HighAspectWing material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="tail-control-surfaces">
        {(material) => <TailControlSurfaces material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="landing-gear">
        {(material) => <LandingGear material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="wingtip-cruise-motors">
        {(material) => (
          <>
            <GeometryInstances geometry={geometries.wingtipNacelle} material={material} transforms={WINGTIP_NACELLE_TRANSFORMS} />
            {AIRCRAFT_WINGTIP_MOTOR_POSITIONS.map((position, index) => (
              <RotorBlades
                key={position[2]}
                position={position}
                material={material}
                geometry={geometries.wingtipRotor}
                active={rotorsActive}
                reducedMotion={props.reducedMotion}
                rotorOffset={0.4}
                phase={index * 0.45}
              />
            ))}
          </>
        )}
      </Part>
      <Part {...props} id="high-lift-motor-array">
        {(material) => (
          <>
            <GeometryInstances geometry={geometries.highLiftNacelle} material={material} transforms={HIGH_LIFT_NACELLE_TRANSFORMS} />
            {AIRCRAFT_HIGH_LIFT_MOTOR_POSITIONS.map((position, index) => (
              <RotorBlades
                key={position[2]}
                position={position}
                material={material}
                geometry={geometries.highLiftRotor}
                active={rotorsActive}
                reducedMotion={props.reducedMotion}
                rotorOffset={0.25}
                phase={index * 0.17}
              />
            ))}
          </>
        )}
      </Part>
      <Part {...props} id="battery-modules">
        {(material) => <BatteryModules material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="dual-power-bus">
        {(material) => <PowerBus material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="inverter-controllers">
        {(material) => <InverterControllers material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="cockpit-monitoring">
        {(material) => <CockpitMonitoring material={material} geometries={geometries} />}
      </Part>
      <Part {...props} id="passive-cooling-path">
        {(material) => <PassiveCoolingPath material={material} geometries={geometries} />}
      </Part>
      <AircraftPrincipleFlow
        mode={props.mode}
        autoplay={props.autoplay}
        reducedMotion={props.reducedMotion}
        geometries={geometries}
      />
    </group>
  )
}
