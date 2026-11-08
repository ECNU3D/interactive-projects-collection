import { Line as FlowLine } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import {
  type DependencyList,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import {
  MathUtils,
  Mesh,
  type Group,
  type MeshStandardMaterial,
  type Object3D,
} from 'three'
import { asr10Parts } from '../content/asr10'
import type { Asr10PartId, PartDefinition } from '../content/types'
import type { ExploreMode } from '../experience/state'
import { GeometryInstances, type GeometryInstanceTransform } from './GeometryInstances'
import { getSceneBudgetReport, type SceneBudgetReport } from './sceneBudget'
import { createTeachingGlowMaterial } from './teachingGlow'
import { useOwnedResource } from './useOwnedResource'
import {
  createVesselGeometrySet,
  disposeVesselGeometrySet,
  VESSEL_BASE_DRAW_CALL_BUDGET,
  VESSEL_RUB_RAIL_TRANSFORMS,
  VESSEL_SUPERSTRUCTURE_LAYOUT,
  VESSEL_TRIANGLE_BUDGET,
  type VesselGeometrySet,
} from './VesselGeometry'
import { VesselPart } from './VesselPart'

type Vector3Tuple = readonly [number, number, number]

export const VESSEL_PROCEDURAL_PART_IDS = [
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

export const VESSEL_ENGINE_POSITIONS = [
  [-0.35, -0.23, 0.48],
  [-0.35, -0.23, -0.48],
] as const satisfies readonly Vector3Tuple[]

export const VESSEL_SHAFT_PATHS = [
  { start: [-0.85, -0.34, 0.48], end: [-2.8, -0.64, 0.56] },
  { start: [-0.85, -0.34, -0.48], end: [-2.8, -0.64, -0.56] },
] as const satisfies readonly { start: Vector3Tuple; end: Vector3Tuple }[]

const VESSEL_SHAFT_SEGMENT_POINTS = VESSEL_SHAFT_PATHS.flatMap((path) => [
  path.start,
  path.end,
])

export const VESSEL_PROPELLER_POSITIONS = [
  [-2.95, -0.66, 0.56],
  [-2.95, -0.66, -0.56],
] as const satisfies readonly Vector3Tuple[]

export const VESSEL_RUDDER_POSITIONS = [
  [-3.22, -0.38, 0.56],
  [-3.22, -0.38, -0.56],
] as const satisfies readonly Vector3Tuple[]

export const VESSEL_FOCUS_POINTS = {
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
} as const satisfies Record<Asr10PartId, Vector3Tuple>

export const VESSEL_MODEL_POSITION: Vector3Tuple = [0, -0.05, 0]
export const VESSEL_MODEL_SCALE = 1

export const VESSEL_TEACHING_GLOW_MATERIALS = {
  energyPulse: createTeachingGlowMaterial('#f0c77c', 3.4),
  fluidPulse: createTeachingGlowMaterial('#8ad5cb', 4.4),
} as const

const PARTS_BY_ID = Object.fromEntries(
  asr10Parts.map((part) => [part.id, part]),
) as Record<Asr10PartId, PartDefinition<Asr10PartId>>

export interface VesselModelProps {
  stepIndex: number
  mode: ExploreMode
  selectedPartId: Asr10PartId | null
  autoplay: boolean
  reducedMotion: boolean
  onSelect: (partId: Asr10PartId) => void
}

export type VesselSceneBudgetReport = SceneBudgetReport

export function getVesselSceneBudgetReport(
  root: Object3D,
): SceneBudgetReport {
  return getSceneBudgetReport(root, {
    drawCalls: VESSEL_BASE_DRAW_CALL_BUDGET,
    triangles: VESSEL_TRIANGLE_BUDGET,
  })
}

export type VesselGeometryFactory = () => VesselGeometrySet
export type VesselGeometryDisposer = (geometries: VesselGeometrySet) => void

export function useVesselGeometrySet(
  factory: VesselGeometryFactory = createVesselGeometrySet,
  disposer: VesselGeometryDisposer = disposeVesselGeometrySet,
) {
  return useOwnedResource(factory, disposer)
}

export function useVesselRenderBudgetProbe(
  rootRef: RefObject<Group | null>,
  dependencies: DependencyList,
  canvas?: HTMLCanvasElement,
  enabled = true,
) {
  useLayoutEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    if (!root) return

    const report = getVesselSceneBudgetReport(root)
    root.userData.renderBudget = report
    if (canvas) {
      canvas.dataset.vesselDrawCalls = String(report.baseDrawCalls)
      canvas.dataset.vesselRenderedTriangles = String(report.renderedTriangles)
      canvas.dataset.vesselInstancedDetails = String(report.instancedDetails)
      canvas.dataset.vesselRenderBudget = report.withinBudget ? 'pass' : 'fail'
    }
  }, [canvas, enabled, rootRef, ...dependencies])
}

interface PartProps extends VesselModelProps {
  id: Asr10PartId
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
    <VesselPart
      definition={PARTS_BY_ID[id]}
      stepIndex={stepIndex}
      mode={mode}
      selected={selectedPartId === id}
      reducedMotion={reducedMotion}
      onSelect={onSelect}
    >
      {children}
    </VesselPart>
  )
}

interface GeometryPartProps {
  material: MeshStandardMaterial
  geometries: VesselGeometrySet
}

const FRONT_WINDOW_TRANSFORMS = [-0.45, 0, 0.45].map(
  (z) => ({
    position: [1.02, 1.43, z],
    rotation: [0, 0, -0.08],
  }),
) satisfies GeometryInstanceTransform[]

const FENDER_TRANSFORMS = [-1.72, 0, 1.72].flatMap((x) =>
  [-1.08, 1.08].map((z) => ({ position: [x, 0.05, z] })),
) satisfies GeometryInstanceTransform[]

const BUOYANCY_TRANSFORMS = [-1.65, -0.55, 0.55, 1.65].map(
  (x) => ({ position: [x, -0.1, 0] }),
) satisfies GeometryInstanceTransform[]

const BULKHEAD_TRANSFORMS = [-1.1, 0, 1.1].map(
  (x) => ({ position: [x, -0.02, 0] }),
) satisfies GeometryInstanceTransform[]

const ENGINE_TRANSFORMS = VESSEL_ENGINE_POSITIONS.map((position) => ({
  position,
})) satisfies GeometryInstanceTransform[]

const ENGINE_CAP_TRANSFORMS = VESSEL_ENGINE_POSITIONS.flatMap((position) =>
  [-0.28, 0, 0.28].map((offset) => ({
    position: [position[0] + offset, position[1] + 0.31, position[2]],
  })),
) satisfies GeometryInstanceTransform[]

const SHAFT_BEARING_TRANSFORMS = VESSEL_SHAFT_PATHS.map((path) => ({
  position: path.end,
  rotation: [0, 0, Math.PI / 2] as const,
})) satisfies GeometryInstanceTransform[]

const WINDOW_FRAME_TRANSFORMS = [-0.45, 0, 0.45].map((z) => ({
  position: [1.062, 1.43, z],
  rotation: [0, Math.PI / 2, 0] as const,
})) satisfies GeometryInstanceTransform[]

const MAST_LIGHT_TRANSFORMS = [-0.28, 0, 0.28].map((z, index) => ({
  position: [0.05, index === 1 ? 2.42 : 2.25, z],
})) satisfies GeometryInstanceTransform[]

const RAIL_POST_TRANSFORMS = [-2.05, -1.25, -0.45].flatMap((x) =>
  [-0.72, 0.72].map((z) => ({ position: [x, 0.84, z] })),
) satisfies GeometryInstanceTransform[]

const SURVIVOR_BENCH_TRANSFORMS = [-0.46, 0.46].map((z) => ({
  position: [1.15, 0.2, z],
})) satisfies GeometryInstanceTransform[]

function HullShell({ material, geometries }: GeometryPartProps) {
  return (
    <mesh
      geometry={geometries.hull}
      material={material}
      castShadow
      receiveShadow
    />
  )
}

function DeckSuperstructure({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.mainDeck} position={[0, 0.43, 0]} material={material} castShadow />
      <mesh geometry={geometries.lowerCabin} position={[0.55, 0.87, 0]} material={material} castShadow />
      <mesh geometry={geometries.wheelhouseRoof} position={VESSEL_SUPERSTRUCTURE_LAYOUT.roof.position} material={material} castShadow />
      <GeometryInstances geometry={geometries.windowPanel} material={material} transforms={FRONT_WINDOW_TRANSFORMS} castShadow={false} receiveShadow={false} />
      <GeometryInstances geometry={geometries.rubRail} material={material} transforms={VESSEL_RUB_RAIL_TRANSFORMS} castShadow={false} receiveShadow={false} />
      <GeometryInstances geometry={geometries.fender} material={material} transforms={FENDER_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function BuoyancyCompartments({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <GeometryInstances geometry={geometries.buoyancyCompartment} material={material} transforms={BUOYANCY_TRANSFORMS} castShadow={false} receiveShadow={false} />
      <GeometryInstances geometry={geometries.bulkhead} material={material} transforms={BULKHEAD_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function EngineModules({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <GeometryInstances geometry={geometries.engineBlock} material={material} transforms={ENGINE_TRANSFORMS} />
      <GeometryInstances geometry={geometries.engineCap} material={material} transforms={ENGINE_CAP_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function ShaftPaths({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <FlowLine
        points={VESSEL_SHAFT_SEGMENT_POINTS}
        color={material.color}
        lineWidth={4}
        segments
      />
      <GeometryInstances geometry={geometries.shaftBearing} material={material} transforms={SHAFT_BEARING_TRANSFORMS} castShadow={false} />
    </>
  )
}

function SpinGroup({
  active,
  reducedMotion,
  children,
}: {
  active: boolean
  reducedMotion: boolean
  children: ReactNode
}) {
  const groupRef = useRef<Group>(null)

  useLayoutEffect(() => {
    if (groupRef.current && reducedMotion) groupRef.current.rotation.x = 0
  }, [reducedMotion])

  useFrame((_, delta) => {
    if (!groupRef.current || !active || reducedMotion) return
    groupRef.current.rotation.x += delta * 2
  })

  return <group ref={groupRef}>{children}</group>
}

function Propellers({
  material,
  geometries,
  active,
  reducedMotion,
}: {
  material: MeshStandardMaterial
  geometries: VesselGeometrySet
  active: boolean
  reducedMotion: boolean
}) {
  return (
    <>
      {VESSEL_PROPELLER_POSITIONS.map((position) => (
        <group key={position[2]} position={position}>
          <mesh geometry={geometries.propellerHub} material={material} castShadow />
          <SpinGroup active={active} reducedMotion={reducedMotion}>
            <mesh geometry={geometries.propellerBlades} material={material} castShadow />
          </SpinGroup>
        </group>
      ))}
    </>
  )
}

function Rudders({
  material,
  geometries,
  active,
  reducedMotion,
}: {
  material: MeshStandardMaterial
  geometries: VesselGeometrySet
  active: boolean
  reducedMotion: boolean
}) {
  const rudderRefs = useRef<(Group | null)[]>([])
  const elapsedRef = useRef(0)

  useLayoutEffect(() => {
    elapsedRef.current = 0
    rudderRefs.current.forEach((rudder) => {
      if (rudder) rudder.rotation.y = 0
    })
  }, [active, reducedMotion])

  useFrame((_, delta) => {
    if (!active || reducedMotion) return
    elapsedRef.current += delta
    const deflection = Math.sin(elapsedRef.current * 0.8) * 0.22
    rudderRefs.current.forEach((rudder) => {
      if (rudder) rudder.rotation.y = deflection
    })
  })

  return (
    <group>
      {VESSEL_RUDDER_POSITIONS.map((position) => (
        <group
          key={position[2]}
          ref={(group) => {
            rudderRefs.current[position[2] > 0 ? 0 : 1] = group
          }}
          position={position}
        >
          <mesh geometry={geometries.rudderShaft} position={[0, 0.3, 0]} material={material} />
          <mesh geometry={geometries.rudderBlade} position={[-0.08, 0, 0]} material={material} castShadow />
        </group>
      ))}
    </group>
  )
}

function BilgePumpPath({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.bilgePump} position={[0.15, -0.62, 0]} material={material} />
      <FlowLine
        points={[
          [0.15, -0.62, 0],
          [0.15, 0.18, 0],
          [0.15, 0.18, 1.28],
        ]}
        color={material.color}
        lineWidth={4}
      />
    </>
  )
}

function WheelhouseMast({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.wheelhouse} position={VESSEL_SUPERSTRUCTURE_LAYOUT.wheelhouse.position} material={material} castShadow />
      <GeometryInstances geometry={geometries.windowFrame} material={material} transforms={WINDOW_FRAME_TRANSFORMS} castShadow={false} receiveShadow={false} />
      <mesh geometry={geometries.mast} position={[0.05, 2.03, 0]} material={material} castShadow={false} />
      <mesh geometry={geometries.mastCrossbar} position={[0.05, 2.3, 0]} rotation={[0, 0, Math.PI / 2]} material={material} castShadow={false} />
      <GeometryInstances geometry={geometries.mastLight} material={material} transforms={MAST_LIGHT_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

function RescueWorkDeck({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.workDeck} position={[-1.25, 0.56, 0]} material={material} castShadow />
      <mesh geometry={geometries.hatchCoaming} position={[-1.25, 0.66, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} castShadow={false} />
      <GeometryInstances geometry={geometries.railPost} material={material} transforms={RAIL_POST_TRANSFORMS} castShadow={false} receiveShadow={false} />
      <mesh geometry={geometries.railSide} position={[-1.25, 1.08, -0.72]} rotation={[0, 0, Math.PI / 2]} material={material} castShadow={false} />
      <mesh geometry={geometries.railSide} position={[-1.25, 1.08, 0.72]} rotation={[0, 0, Math.PI / 2]} material={material} castShadow={false} />
      <mesh geometry={geometries.railCross} position={[-2.05, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]} material={material} castShadow={false} />
    </>
  )
}

function SurvivorSpace({ material, geometries }: GeometryPartProps) {
  return (
    <>
      <mesh geometry={geometries.survivorCabin} position={[1.15, 0.05, 0]} material={material} />
      <GeometryInstances geometry={geometries.survivorBench} material={material} transforms={SURVIVOR_BENCH_TRANSFORMS} castShadow={false} receiveShadow={false} />
    </>
  )
}

export const VESSEL_PRINCIPLE_FLOW_PATHS = [
  { start: VESSEL_ENGINE_POSITIONS[0], end: VESSEL_PROPELLER_POSITIONS[0] },
  { start: VESSEL_ENGINE_POSITIONS[1], end: VESSEL_PROPELLER_POSITIONS[1] },
  { start: VESSEL_PROPELLER_POSITIONS[0], end: [-4.2, -0.64, 0.82] },
  { start: VESSEL_PROPELLER_POSITIONS[1], end: [-4.2, -0.64, -0.82] },
  { start: [0.15, -0.68, 0], end: [0.15, 0.22, 1.42] },
] as const satisfies readonly { start: Vector3Tuple; end: Vector3Tuple }[]

export function isVesselPrincipleActive(
  mode: ExploreMode,
  autoplay: boolean,
  reducedMotion: boolean,
) {
  return mode === 'principle' && autoplay && !reducedMotion
}

function VesselPrincipleFlow({
  mode,
  autoplay,
  reducedMotion,
  geometries,
}: Pick<VesselModelProps, 'mode' | 'autoplay' | 'reducedMotion'> & {
  geometries: VesselGeometrySet
}) {
  const pulseRefs = useRef<(Mesh | null)[]>([])
  const elapsedRef = useRef(0)
  const visible = mode === 'principle'
  const active = isVesselPrincipleActive(mode, autoplay, reducedMotion)

  useLayoutEffect(() => {
    elapsedRef.current = 0
    VESSEL_PRINCIPLE_FLOW_PATHS.forEach((path, index) => {
      pulseRefs.current[index]?.position.set(
        path.start[0],
        path.start[1],
        path.start[2],
      )
    })
  }, [mode, reducedMotion])

  useFrame((_, delta) => {
    if (!active) return
    elapsedRef.current += delta

    VESSEL_PRINCIPLE_FLOW_PATHS.forEach((path, index) => {
      const pulse = pulseRefs.current[index]
      if (!pulse) return
      const progress = (elapsedRef.current * 0.3 + index * 0.17) % 1
      pulse.position.set(
        MathUtils.lerp(path.start[0], path.end[0], progress),
        MathUtils.lerp(path.start[1], path.end[1], progress),
        MathUtils.lerp(path.start[2], path.end[2], progress),
      )
    })
  })

  return (
    <group name="teaching-vessel-principle-flow" visible={visible}>
      {VESSEL_PRINCIPLE_FLOW_PATHS.map((path, index) => (
        <group key={index}>
          <FlowLine
            points={[path.start, path.end]}
            color={index === 4 ? '#72c8bc' : '#d98555'}
            lineWidth={1.15}
            transparent
            opacity={0.42}
          />
          <mesh
            geometry={geometries.principlePulse}
            ref={(mesh) => {
              pulseRefs.current[index] = mesh
            }}
          >
            <meshBasicMaterial
              {...(index === 4
                ? VESSEL_TEACHING_GLOW_MATERIALS.fluidPulse
                : VESSEL_TEACHING_GLOW_MATERIALS.energyPulse)}
              transparent
              opacity={0.92}
            />
          </mesh>
        </group>
      ))}
      {VESSEL_RUDDER_POSITIONS.map((position) => (
        <FlowLine
          key={position[2]}
          points={[
            [-2.75, -0.42, position[2]],
            [-3.45, -0.4, position[2]],
            [-4.15, -0.35, position[2] * 1.3],
          ]}
          color="#72c8bc"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}
    </group>
  )
}

export function VesselModel(props: VesselModelProps) {
  const principleActive = isVesselPrincipleActive(
    props.mode,
    props.autoplay,
    props.reducedMotion,
  )
  const modelProps = useMemo(() => props, [props])
  const modelRef = useRef<Group>(null)
  const canvas = useThree((state) => state.gl.domElement)
  const geometries = useVesselGeometrySet()
  useVesselRenderBudgetProbe(
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
        name="modern-rescue-vessel-teaching-composite"
        position={VESSEL_MODEL_POSITION}
        scale={VESSEL_MODEL_SCALE}
        userData={{
          exhibitKind: 'modern-rescue-vessel-teaching-composite',
          accuracy: 'educational-system-relationships-only',
        }}
      />
    )
  }

  return (
    <group
      ref={modelRef}
      name="modern-rescue-vessel-teaching-composite"
      position={VESSEL_MODEL_POSITION}
      scale={VESSEL_MODEL_SCALE}
      userData={{
        exhibitKind: 'modern-rescue-vessel-teaching-composite',
        accuracy: 'educational-system-relationships-only',
      }}
    >
      <Part {...modelProps} id="vessel-hull-shell">
        {(material) => <HullShell material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="deck-superstructure">
        {(material) => <DeckSuperstructure material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="buoyancy-compartments">
        {(material) => <BuoyancyCompartments material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="twin-engine-modules">
        {(material) => <EngineModules material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="shaft-paths">
        {(material) => <ShaftPaths material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="propeller-concept">
        {(material) => (
          <Propellers
            material={material}
            geometries={geometries}
            active={principleActive}
            reducedMotion={props.reducedMotion}
          />
        )}
      </Part>
      <Part {...modelProps} id="rudder-steering">
        {(material) => (
          <Rudders
            material={material}
            geometries={geometries}
            active={principleActive}
            reducedMotion={props.reducedMotion}
          />
        )}
      </Part>
      <Part {...modelProps} id="bilge-pump-path">
        {(material) => <BilgePumpPath material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="wheelhouse-observation-mast">
        {(material) => <WheelhouseMast material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="rescue-work-deck">
        {(material) => <RescueWorkDeck material={material} geometries={geometries} />}
      </Part>
      <Part {...modelProps} id="survivor-space">
        {(material) => <SurvivorSpace material={material} geometries={geometries} />}
      </Part>
      <VesselPrincipleFlow
        mode={props.mode}
        autoplay={props.autoplay}
        reducedMotion={props.reducedMotion}
        geometries={geometries}
      />
    </group>
  )
}
